import { config } from "./config.js";
import { fetchOpenJobs, fetchMarketOverview } from "./api.js";
import { getWalletAddress, getUSDCBalance, isRegistered, registerAgent, getReputation, placeBid, getJobOnChain, submitDelivery, scanJobsFromChain } from "./chain.js";
import { evaluateJob, calculateBidPrice, generateDeliveryProof } from "./brain.js";
import { loadState, saveState, type AgentState } from "./state.js";
import { log, logSuccess, logWarn, logError, logHeader } from "./log.js";

// ─── Startup ─────────────────────────────────────────────────

async function startup(): Promise<AgentState> {
  logHeader(`${config.name} — SWARMS Autonomous Agent`);

  if (!config.privateKey) {
    logError("SWARMS_WALLET_PRIVATE_KEY not set!");
    process.exit(1);
  }

  const address = await getWalletAddress();
  const balance = await getUSDCBalance();
  const rep = await getReputation();

  log(`Wallet:       ${address}`);
  log(`USDC Balance: ${Number(balance) / 1e6}`);
  log(`Reputation:   ${rep.score} (${rep.completed} completed, ${rep.failed} failed)`);
  log(`Capabilities: ${config.capabilities.join(", ")}`);
  log(`Poll interval: ${config.pollIntervalMs / 1000}s`);

  const state = loadState();

  // Register if needed
  const registered = await isRegistered();
  if (!registered) {
    logWarn("Not registered on AgentRegistry — registering now...");
    try {
      await registerAgent();
      state.registered = true;
      saveState(state);
      logSuccess("Registered on-chain!");
    } catch (err) {
      logError(`Registration failed: ${err}`);
    }
  } else {
    state.registered = true;
    logSuccess("Already registered on-chain");
  }

  return state;
}

// ─── Check active bids — did any get accepted? ──────────────

async function checkActiveBids(state: AgentState): Promise<void> {
  if (state.activeBids.length === 0) return;

  log(`Checking ${state.activeBids.length} active bids...`);
  const stillPending: number[] = [];

  for (const jobId of state.activeBids) {
    const data = await getJobOnChain(jobId);
    if (!data) {
      stillPending.push(jobId);
      continue;
    }

    const { job, bids } = data;
    const myAddress = (await getWalletAddress()).toLowerCase();

    // Status 1 = IN_PROGRESS — a bid was accepted
    if (Number(job.status) === 1) {
      const acceptedBid = bids.find(
        (b: { accepted: boolean; bidder: string }) => b.accepted && b.bidder.toLowerCase() === myAddress,
      );

      if (acceptedBid) {
        logSuccess(`Bid ACCEPTED on job #${jobId}! Moving to active jobs.`);
        state.activeJobs.push(jobId);
      } else {
        logWarn(`Job #${jobId} accepted another agent's bid.`);
      }
    } else if (Number(job.status) === 0) {
      // Still open
      stillPending.push(jobId);
    } else {
      logWarn(`Job #${jobId} changed to status ${job.status} — removing from active bids`);
    }
  }

  state.activeBids = stillPending;
}

// ─── Execute active jobs ────────────────────────────────────

async function executeActiveJobs(state: AgentState): Promise<void> {
  if (state.activeJobs.length === 0) return;

  logHeader("Executing Active Jobs");

  for (const jobId of [...state.activeJobs]) {
    const data = await getJobOnChain(jobId);
    if (!data) continue;

    // Already delivered?
    if (Number(data.job.status) >= 2) {
      log(`Job #${jobId} already delivered/completed — removing`);
      state.activeJobs = state.activeJobs.filter((id) => id !== jobId);
      if (Number(data.job.status) === 3) {
        state.completedJobs.push(jobId);
        logSuccess(`Job #${jobId} COMPLETED!`);
      }
      continue;
    }

    log(`Executing job #${jobId}...`);

    // Simulate work — in a real agent, this would invoke Claude or run code
    log("  [Simulating work] Analyzing smart contracts...");
    log("  [Simulating work] Checking for vulnerabilities...");
    log("  [Simulating work] Generating audit report...");

    // Generate delivery proof
    const proofHash = generateDeliveryProof(jobId, "audit-report");

    try {
      await submitDelivery(jobId, proofHash);
      logSuccess(`Job #${jobId} delivered! Waiting for approval.`);
      state.activeJobs = state.activeJobs.filter((id) => id !== jobId);
    } catch (err) {
      logError(`Failed to deliver job #${jobId}: ${err}`);
    }
  }
}

// ─── Browse & bid ───────────────────────────────────────────

async function browseAndBid(state: AgentState): Promise<void> {
  logHeader("Scanning Marketplace");

  // Try API feed first, fallback to on-chain scan
  let jobs = await fetchOpenJobs();
  let source = "API";

  if (jobs.length === 0) {
    log("API feed empty — scanning chain directly...");
    jobs = await scanJobsFromChain(20) as any;
    source = "on-chain";
  }

  log(`Found ${jobs.length} open jobs (via ${source})`);

  if (jobs.length === 0) {
    logWarn("No open jobs available");
    return;
  }

  if (source === "API") {
    const overview = await fetchMarketOverview();
    if (overview) {
      log(`Market: ${overview.totalJobs} total jobs, ${overview.activeAgents} agents, ${overview.totalVolume} USDC volume`);
    }
  }

  // Filter out jobs we already bid on, completed, or skipped
  const knownJobIds = new Set([
    ...state.activeBids,
    ...state.activeJobs,
    ...state.completedJobs,
    ...state.skippedJobs,
  ]);
  const newJobs = jobs.filter((j) => !knownJobIds.has(j.id));

  if (newJobs.length === 0) {
    log("No new jobs to evaluate");
    return;
  }

  log(`Evaluating ${newJobs.length} new jobs...`);

  for (const job of newJobs) {
    const evaluation = evaluateJob(job);
    const statusIcon = evaluation.canDo ? "+" : "-";
    log(`  #${job.id} [${evaluation.score}/100] ${statusIcon} ${job.description.slice(0, 70)}...`);
    log(`    ${evaluation.reasoning}`);

    if (evaluation.canDo) {
      const bidPrice = calculateBidPrice(job);
      log(`  -> Bidding ${bidPrice} USDC on job #${job.id}`);

      try {
        const { txHash } = await placeBid(
          job.id,
          bidPrice,
          config.maxDeliveryDays,
          `${config.name}: Specialized in ${config.capabilities.slice(0, 3).join(", ")}. Score: ${evaluation.score}/100.`,
        );

        state.bidsPlaced.push({
          jobId: job.id,
          price: bidPrice,
          txHash,
          timestamp: new Date().toISOString(),
        });
        state.activeBids.push(job.id);
        logSuccess(`Bid placed on job #${job.id}!`);
      } catch (err) {
        logError(`Failed to bid on job #${job.id}: ${err}`);
        state.skippedJobs.push(job.id);
      }
    } else {
      state.skippedJobs.push(job.id);
    }
  }
}

// ─── Main Loop ──────────────────────────────────────────────

async function tick(state: AgentState): Promise<void> {
  try {
    state.lastPollAt = new Date().toISOString();

    // 1. Check if any active bids were accepted
    await checkActiveBids(state);

    // 2. Execute any active jobs
    await executeActiveJobs(state);

    // 3. Browse for new jobs and bid
    await browseAndBid(state);

    saveState(state);
  } catch (err) {
    logError(`Tick error: ${err}`);
  }
}

async function main() {
  const state = await startup();

  // First tick immediately
  await tick(state);

  // Then poll on interval
  log(`\nNext poll in ${config.pollIntervalMs / 1000}s...`);
  setInterval(async () => {
    logHeader(`Poll — ${new Date().toISOString()}`);
    await tick(state);
    log(`Next poll in ${config.pollIntervalMs / 1000}s...`);
  }, config.pollIntervalMs);
}

main().catch((err) => {
  logError(`Fatal: ${err}`);
  process.exit(1);
});
