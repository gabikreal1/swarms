import { Pool, QueryResult } from "pg";
import { getPool } from "./pool";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function db(): Pool {
  return getPool();
}

// ────────────────────────────────────────────────────────────
// Jobs
// ────────────────────────────────────────────────────────────

export interface InsertJobParams {
  id: bigint;
  poster: string;
  description: string;
  metadataUri: string;
  tags: string[];
  deadline: bigint;
  blockNumber: bigint;
  txHash: string;
}

export async function insertJob(p: InsertJobParams): Promise<void> {
  await db().query(
    `INSERT INTO jobs (id, poster, description, metadata_uri, tags, deadline, status, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       description = EXCLUDED.description,
       metadata_uri = EXCLUDED.metadata_uri,
       tags = EXCLUDED.tags,
       deadline = EXCLUDED.deadline,
       updated_at = NOW()`,
    [
      p.id.toString(),
      p.poster,
      p.description,
      p.metadataUri,
      p.tags,
      p.deadline.toString(),
      p.blockNumber.toString(),
      p.txHash,
    ],
  );
}

export async function updateJobStatus(
  jobId: bigint,
  status: string,
): Promise<void> {
  const extra =
    status === "completed" ? ", completed_at = NOW()" : "";
  await db().query(
    `UPDATE jobs SET status = $1, updated_at = NOW()${extra} WHERE id = $2`,
    [status, jobId.toString()],
  );
}

// ────────────────────────────────────────────────────────────
// Bids
// ────────────────────────────────────────────────────────────

export interface InsertBidParams {
  id: bigint;
  jobId: bigint;
  bidder: string;
  price: bigint;
  deliveryTime: bigint;
  reputation: bigint;
  metadataUri: string;
  blockNumber: bigint;
  txHash: string;
}

export async function insertBid(p: InsertBidParams): Promise<void> {
  await db().query(
    `INSERT INTO bids (id, job_id, bidder, price, delivery_time, reputation, metadata_uri, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO NOTHING`,
    [
      p.id.toString(),
      p.jobId.toString(),
      p.bidder,
      p.price.toString(),
      p.deliveryTime.toString(),
      p.reputation.toString(),
      p.metadataUri,
      p.blockNumber.toString(),
      p.txHash,
    ],
  );
}

export async function markBidAccepted(
  bidId: bigint,
  responseUri: string,
): Promise<void> {
  await db().query(
    `UPDATE bids SET accepted = TRUE, response_uri = $2 WHERE id = $1`,
    [bidId.toString(), responseUri],
  );
}

// ────────────────────────────────────────────────────────────
// Agents
// ────────────────────────────────────────────────────────────

export interface InsertAgentParams {
  wallet: string;
  name: string;
  metadataUri: string;
  capabilities: string[];
  blockNumber: bigint;
  txHash: string;
}

export async function insertAgent(p: InsertAgentParams): Promise<void> {
  await db().query(
    `INSERT INTO agents (wallet, name, metadata_uri, capabilities, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (wallet) DO UPDATE SET
       name = EXCLUDED.name,
       metadata_uri = EXCLUDED.metadata_uri,
       capabilities = EXCLUDED.capabilities,
       updated_at = NOW()`,
    [p.wallet, p.name, p.metadataUri, p.capabilities, p.blockNumber.toString(), p.txHash],
  );
}

export async function updateAgentReputation(
  wallet: string,
  reputation: bigint,
  jobsCompleted: bigint,
  jobsFailed: bigint,
  totalEarned: bigint,
): Promise<void> {
  await db().query(
    `UPDATE agents SET
       reputation = $2,
       jobs_completed = $3,
       jobs_failed = $4,
       total_earned = $5,
       updated_at = NOW()
     WHERE wallet = $1`,
    [
      wallet,
      reputation.toString(),
      jobsCompleted.toString(),
      jobsFailed.toString(),
      totalEarned.toString(),
    ],
  );
}

// ────────────────────────────────────────────────────────────
// Disputes
// ────────────────────────────────────────────────────────────

export interface InsertDisputeParams {
  id: bigint;
  jobId: bigint;
  initiator: string;
  reason: string;
  blockNumber: bigint;
  txHash: string;
}

export async function insertDispute(p: InsertDisputeParams): Promise<void> {
  await db().query(
    `INSERT INTO disputes (id, job_id, initiator, reason, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [
      p.id.toString(),
      p.jobId.toString(),
      p.initiator,
      p.reason,
      p.blockNumber.toString(),
      p.txHash,
    ],
  );
}

export async function updateDisputeStatus(
  disputeId: bigint,
  status: string,
  resolutionMessage: string,
): Promise<void> {
  await db().query(
    `UPDATE disputes SET status = $2, resolution_message = $3, resolved_at = NOW() WHERE id = $1`,
    [disputeId.toString(), status, resolutionMessage],
  );
}

// ────────────────────────────────────────────────────────────
// Reputation events
// ────────────────────────────────────────────────────────────

export interface InsertReputationEventParams {
  agent: string;
  score: bigint;
  jobsCompleted: bigint;
  jobsFailed: bigint;
  totalEarned: bigint;
  lastUpdated: bigint;
  blockNumber: bigint;
  txHash: string;
}

export async function insertReputationEvent(
  p: InsertReputationEventParams,
): Promise<void> {
  await db().query(
    `INSERT INTO reputation_events (agent, score, jobs_completed, jobs_failed, total_earned, last_updated, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      p.agent,
      p.score.toString(),
      p.jobsCompleted.toString(),
      p.jobsFailed.toString(),
      p.totalEarned.toString(),
      p.lastUpdated.toString(),
      p.blockNumber.toString(),
      p.txHash,
    ],
  );
}

// ────────────────────────────────────────────────────────────
// Deliveries
// ────────────────────────────────────────────────────────────

export async function insertDelivery(
  jobId: bigint,
  bidId: bigint,
  proofHash: string,
  blockNumber: bigint,
  txHash: string,
): Promise<void> {
  await db().query(
    `INSERT INTO deliveries (job_id, bid_id, proof_hash, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (job_id) DO UPDATE SET
       proof_hash = EXCLUDED.proof_hash`,
    [jobId.toString(), bidId.toString(), proofHash, blockNumber.toString(), txHash],
  );
}

// ────────────────────────────────────────────────────────────
// Escrows
// ────────────────────────────────────────────────────────────

export async function insertEscrow(
  jobId: bigint,
  poster: string,
  agent: string,
  amount: bigint,
  blockNumber: bigint,
  txHash: string,
): Promise<void> {
  await db().query(
    `INSERT INTO escrows (job_id, poster, agent, amount, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (job_id) DO NOTHING`,
    [jobId.toString(), poster, agent, amount.toString(), blockNumber.toString(), txHash],
  );
}

// ────────────────────────────────────────────────────────────
// Read queries
// ────────────────────────────────────────────────────────────

export async function getJobsByTag(tag: string, limit = 50, offset = 0) {
  const res = await db().query(
    `SELECT * FROM jobs WHERE $1 = ANY(tags) ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [tag, limit, offset],
  );
  return res.rows;
}

export async function getJobsByStatus(status: string, limit = 50, offset = 0) {
  const res = await db().query(
    `SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [status, limit, offset],
  );
  return res.rows;
}

export async function getAgentStats(wallet: string) {
  const res = await db().query(
    `SELECT wallet, name, reputation, jobs_completed, jobs_failed, total_earned, status
     FROM agents WHERE wallet = $1`,
    [wallet],
  );
  return res.rows[0] ?? null;
}

// ────────────────────────────────────────────────────────────
// Aggregation queries
// ────────────────────────────────────────────────────────────

export async function getTagClusterStats(limit = 100) {
  const res = await db().query(
    `SELECT * FROM tag_clusters ORDER BY job_count DESC LIMIT $1`,
    [limit],
  );
  return res.rows;
}

export async function getTrendSnapshots(tag: string, limit = 30) {
  const res = await db().query(
    `SELECT * FROM trend_snapshots WHERE tag = $1 ORDER BY window_end DESC LIMIT $2`,
    [tag, limit],
  );
  return res.rows;
}

export async function getPriceSeries(tag: string, limit = 60) {
  const res = await db().query(
    `SELECT * FROM price_series WHERE tag = $1 ORDER BY bucket_end DESC LIMIT $2`,
    [tag, limit],
  );
  return res.rows;
}

export async function getSupplyDemand(tag: string, limit = 30) {
  const res = await db().query(
    `SELECT * FROM supply_demand WHERE tag = $1 ORDER BY snapshot_at DESC LIMIT $2`,
    [tag, limit],
  );
  return res.rows;
}

// ────────────────────────────────────────────────────────────
// Indexer state
// ────────────────────────────────────────────────────────────

export async function getLastBlock(contractName: string): Promise<bigint> {
  const res = await db().query(
    `SELECT last_block FROM indexer_state WHERE contract_name = $1`,
    [contractName],
  );
  if (res.rows.length === 0) return 0n;
  return BigInt(res.rows[0].last_block);
}

export async function setLastBlock(
  contractName: string,
  blockNumber: bigint,
): Promise<void> {
  await db().query(
    `INSERT INTO indexer_state (contract_name, last_block, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (contract_name) DO UPDATE SET last_block = EXCLUDED.last_block, updated_at = NOW()`,
    [contractName, blockNumber.toString()],
  );
}
