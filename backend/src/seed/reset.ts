import { getPool } from '../db/pool';
import { QdrantService } from '../vector/qdrant';

/**
 * Truncate all tables in dependency order and wipe Qdrant collections.
 */
export async function resetAll(skipVectors: boolean): Promise<void> {
  const pool = getPool();

  console.log('  [reset] truncating all tables...');

  await pool.query(`
    TRUNCATE
      deliveries,
      escrows,
      disputes,
      reputation_events,
      bids,
      events,
      chat_messages,
      chat_sessions,
      supply_demand,
      price_series,
      trend_snapshots,
      tag_clusters,
      jobs,
      agents,
      indexer_state
    CASCADE
  `);

  console.log('  [reset] tables truncated');

  if (!skipVectors) {
    try {
      const qdrant = new QdrantService();
      await qdrant.initCollections();
      console.log('  [reset] Qdrant collections re-initialized');
    } catch (err) {
      console.warn('  [reset] Qdrant reset skipped (not available):', (err as Error).message);
    }
  }
}
