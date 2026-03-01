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
  id?: string;           // UUID — omit to auto-generate
  chainId?: bigint;      // on-chain uint256 jobId (NULL for seed data)
  poster: string;
  description: string;
  metadataUri: string;
  tags: string[];
  deadline: bigint;
  blockNumber: bigint;
  txHash: string;
}

export async function insertJob(p: InsertJobParams): Promise<string> {
  if (p.chainId != null) {
    // Chain data: upsert on chain_id
    const res = await db().query(
      `INSERT INTO jobs (chain_id, poster, description, metadata_uri, tags, deadline, status, block_number, tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)
       ON CONFLICT (chain_id) DO UPDATE SET
         description = EXCLUDED.description,
         metadata_uri = EXCLUDED.metadata_uri,
         tags = EXCLUDED.tags,
         deadline = EXCLUDED.deadline,
         updated_at = NOW()
       RETURNING id`,
      [
        p.chainId.toString(),
        p.poster,
        p.description,
        p.metadataUri,
        p.tags,
        p.deadline.toString(),
        p.blockNumber.toString(),
        p.txHash,
      ],
    );
    return res.rows[0].id;
  }

  // Seed data: insert with optional explicit UUID, no chain_id
  const id = p.id ?? undefined;
  const res = await db().query(
    id
      ? `INSERT INTO jobs (id, poster, description, metadata_uri, tags, deadline, status, block_number, tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           description = EXCLUDED.description,
           metadata_uri = EXCLUDED.metadata_uri,
           tags = EXCLUDED.tags,
           deadline = EXCLUDED.deadline,
           updated_at = NOW()
         RETURNING id`
      : `INSERT INTO jobs (poster, description, metadata_uri, tags, deadline, status, block_number, tx_hash)
         VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)
         RETURNING id`,
    id
      ? [id, p.poster, p.description, p.metadataUri, p.tags, p.deadline.toString(), p.blockNumber.toString(), p.txHash]
      : [p.poster, p.description, p.metadataUri, p.tags, p.deadline.toString(), p.blockNumber.toString(), p.txHash],
  );
  return res.rows[0].id;
}

export async function updateJobStatus(
  jobId: string,
  status: string,
): Promise<void> {
  const extra =
    status === "completed" ? ", completed_at = NOW()" : "";
  await db().query(
    `UPDATE jobs SET status = $1, updated_at = NOW()${extra} WHERE id = $2`,
    [status, jobId],
  );
}

// ── Chain ID lookup helpers ──────────────────────────────────

export async function getJobUuidByChainId(chainId: bigint): Promise<string | null> {
  const res = await db().query(
    `SELECT id FROM jobs WHERE chain_id = $1`,
    [chainId.toString()],
  );
  return res.rows[0]?.id ?? null;
}

export async function getBidUuidByChainId(chainId: bigint): Promise<string | null> {
  const res = await db().query(
    `SELECT id FROM bids WHERE chain_id = $1`,
    [chainId.toString()],
  );
  return res.rows[0]?.id ?? null;
}

export async function getDisputeUuidByChainId(chainId: bigint): Promise<string | null> {
  const res = await db().query(
    `SELECT id FROM disputes WHERE chain_id = $1`,
    [chainId.toString()],
  );
  return res.rows[0]?.id ?? null;
}

export async function updateJobStatusByChainId(
  chainId: bigint,
  status: string,
): Promise<void> {
  const extra =
    status === "completed" ? ", completed_at = NOW()" : "";
  await db().query(
    `UPDATE jobs SET status = $1, updated_at = NOW()${extra} WHERE chain_id = $2`,
    [status, chainId.toString()],
  );
}

export async function markBidAcceptedByChainId(
  chainBidId: bigint,
  responseUri: string,
): Promise<void> {
  await db().query(
    `UPDATE bids SET accepted = TRUE, response_uri = $2 WHERE chain_id = $1`,
    [chainBidId.toString(), responseUri],
  );
}

// ────────────────────────────────────────────────────────────
// Bids
// ────────────────────────────────────────────────────────────

export interface InsertBidParams {
  id?: string;           // UUID — omit to auto-generate
  chainId?: bigint;      // on-chain uint256 bidId
  jobId: string;         // UUID of the parent job
  bidder: string;
  price: bigint;
  deliveryTime: bigint;
  reputation: bigint;
  metadataUri: string;
  blockNumber: bigint;
  txHash: string;
}

export async function insertBid(p: InsertBidParams): Promise<string> {
  if (p.chainId != null) {
    // Chain data: upsert on chain_id
    const res = await db().query(
      `INSERT INTO bids (chain_id, job_id, bidder, price, delivery_time, reputation, metadata_uri, block_number, tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (chain_id) DO NOTHING
       RETURNING id`,
      [
        p.chainId.toString(),
        p.jobId,
        p.bidder,
        p.price.toString(),
        p.deliveryTime.toString(),
        p.reputation.toString(),
        p.metadataUri,
        p.blockNumber.toString(),
        p.txHash,
      ],
    );
    return res.rows[0]?.id ?? (await getBidUuidByChainId(p.chainId))!;
  }

  // Seed data
  const id = p.id ?? undefined;
  const res = await db().query(
    id
      ? `INSERT INTO bids (id, job_id, bidder, price, delivery_time, reputation, metadata_uri, block_number, tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`
      : `INSERT INTO bids (job_id, bidder, price, delivery_time, reputation, metadata_uri, block_number, tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
    id
      ? [id, p.jobId, p.bidder, p.price.toString(), p.deliveryTime.toString(), p.reputation.toString(), p.metadataUri, p.blockNumber.toString(), p.txHash]
      : [p.jobId, p.bidder, p.price.toString(), p.deliveryTime.toString(), p.reputation.toString(), p.metadataUri, p.blockNumber.toString(), p.txHash],
  );
  return res.rows[0]?.id ?? id!;
}

export async function markBidAccepted(
  bidId: string,
  responseUri: string,
): Promise<void> {
  await db().query(
    `UPDATE bids SET accepted = TRUE, response_uri = $2 WHERE id = $1`,
    [bidId, responseUri],
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
  id?: string;           // UUID — omit to auto-generate
  chainId?: bigint;      // on-chain uint256 disputeId
  jobId: string;         // UUID of the parent job
  initiator: string;
  reason: string;
  blockNumber: bigint;
  txHash: string;
}

export async function insertDispute(p: InsertDisputeParams): Promise<string> {
  if (p.chainId != null) {
    const res = await db().query(
      `INSERT INTO disputes (chain_id, job_id, initiator, reason, block_number, tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (chain_id) DO NOTHING
       RETURNING id`,
      [
        p.chainId.toString(),
        p.jobId,
        p.initiator,
        p.reason,
        p.blockNumber.toString(),
        p.txHash,
      ],
    );
    return res.rows[0]?.id ?? (await getDisputeUuidByChainId(p.chainId))!;
  }

  const id = p.id ?? undefined;
  const res = await db().query(
    id
      ? `INSERT INTO disputes (id, job_id, initiator, reason, block_number, tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`
      : `INSERT INTO disputes (job_id, initiator, reason, block_number, tx_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
    id
      ? [id, p.jobId, p.initiator, p.reason, p.blockNumber.toString(), p.txHash]
      : [p.jobId, p.initiator, p.reason, p.blockNumber.toString(), p.txHash],
  );
  return res.rows[0]?.id ?? id!;
}

export async function updateDisputeStatus(
  disputeId: string,
  status: string,
  resolutionMessage: string,
): Promise<void> {
  await db().query(
    `UPDATE disputes SET status = $2, resolution_message = $3, resolved_at = NOW() WHERE id = $1`,
    [disputeId, status, resolutionMessage],
  );
}

export async function updateDisputeStatusByChainId(
  chainDisputeId: bigint,
  status: string,
  resolutionMessage: string,
): Promise<void> {
  await db().query(
    `UPDATE disputes SET status = $2, resolution_message = $3, resolved_at = NOW() WHERE chain_id = $1`,
    [chainDisputeId.toString(), status, resolutionMessage],
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
  jobId: string,
  bidId: string,
  proofHash: string,
  blockNumber: bigint,
  txHash: string,
): Promise<void> {
  await db().query(
    `INSERT INTO deliveries (job_id, bid_id, proof_hash, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (job_id) DO UPDATE SET
       proof_hash = EXCLUDED.proof_hash`,
    [jobId, bidId, proofHash, blockNumber.toString(), txHash],
  );
}

// ────────────────────────────────────────────────────────────
// Escrows
// ────────────────────────────────────────────────────────────

export async function insertEscrow(
  jobId: string,
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
    [jobId, poster, agent, amount.toString(), blockNumber.toString(), txHash],
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
