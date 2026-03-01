-- Migration 002: BIGINT → UUID primary keys
--
-- On-chain contracts emit sequential uint256 IDs (1, 2, 3...) which collide
-- with seed data that also uses sequential integers. By switching to UUID PKs
-- with a nullable chain_id column, seed data and on-chain data coexist.
--
-- Strategy: truncate + recreate. All prod data is either seed (recreatable)
-- or on-chain (re-indexable via EventListener). We reset indexer_state so
-- the EventListener re-indexes from chain.

BEGIN;

-- ============================================================
-- 1. Truncate all data (order matters for FK constraints)
-- ============================================================

TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE deliveries CASCADE;
TRUNCATE TABLE escrows CASCADE;
TRUNCATE TABLE disputes CASCADE;
TRUNCATE TABLE bids CASCADE;
TRUNCATE TABLE jobs CASCADE;
TRUNCATE TABLE reputation_events CASCADE;
TRUNCATE TABLE tag_clusters CASCADE;
TRUNCATE TABLE trend_snapshots CASCADE;
TRUNCATE TABLE price_series CASCADE;
TRUNCATE TABLE supply_demand CASCADE;
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE chat_sessions CASCADE;

-- ============================================================
-- 2. Drop existing FK constraints
-- ============================================================

ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_job_id_fkey;
ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_job_id_fkey;
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_job_id_fkey;
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_bid_id_fkey;
ALTER TABLE escrows DROP CONSTRAINT IF EXISTS escrows_job_id_fkey;

-- ============================================================
-- 3. Alter jobs table: BIGINT → UUID PK, add chain_id
-- ============================================================

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_pkey;
ALTER TABLE jobs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE jobs ALTER COLUMN id SET DATA TYPE UUID USING gen_random_uuid();
ALTER TABLE jobs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE jobs ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS chain_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_chain_id ON jobs (chain_id) WHERE chain_id IS NOT NULL;

-- ============================================================
-- 4. Alter bids table: BIGINT → UUID PK, add chain_id
-- ============================================================

ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_pkey;
ALTER TABLE bids ALTER COLUMN id DROP DEFAULT;
ALTER TABLE bids ALTER COLUMN id SET DATA TYPE UUID USING gen_random_uuid();
ALTER TABLE bids ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE bids ADD CONSTRAINT bids_pkey PRIMARY KEY (id);

ALTER TABLE bids ADD COLUMN IF NOT EXISTS chain_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bids_chain_id ON bids (chain_id) WHERE chain_id IS NOT NULL;

-- Convert bids.job_id to UUID
ALTER TABLE bids ALTER COLUMN job_id SET DATA TYPE UUID USING gen_random_uuid();

-- ============================================================
-- 5. Alter disputes table: BIGINT → UUID PK, add chain_id
-- ============================================================

ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_pkey;
ALTER TABLE disputes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE disputes ALTER COLUMN id SET DATA TYPE UUID USING gen_random_uuid();
ALTER TABLE disputes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE disputes ADD CONSTRAINT disputes_pkey PRIMARY KEY (id);

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS chain_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_chain_id ON disputes (chain_id) WHERE chain_id IS NOT NULL;

-- Convert disputes.job_id to UUID
ALTER TABLE disputes ALTER COLUMN job_id SET DATA TYPE UUID USING gen_random_uuid();

-- ============================================================
-- 6. Alter deliveries table: job_id + bid_id → UUID
-- ============================================================

ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_pkey;
ALTER TABLE deliveries ALTER COLUMN job_id SET DATA TYPE UUID USING gen_random_uuid();
ALTER TABLE deliveries ALTER COLUMN bid_id SET DATA TYPE UUID USING gen_random_uuid();
ALTER TABLE deliveries ADD CONSTRAINT deliveries_pkey PRIMARY KEY (job_id);

-- ============================================================
-- 7. Alter escrows table: job_id → UUID
-- ============================================================

ALTER TABLE escrows DROP CONSTRAINT IF EXISTS escrows_pkey;
ALTER TABLE escrows ALTER COLUMN job_id SET DATA TYPE UUID USING gen_random_uuid();
ALTER TABLE escrows ADD CONSTRAINT escrows_pkey PRIMARY KEY (job_id);

-- ============================================================
-- 8. Alter events table: job_id → UUID
-- ============================================================

ALTER TABLE events ALTER COLUMN job_id SET DATA TYPE UUID USING NULL;

-- ============================================================
-- 9. Re-add FK constraints
-- ============================================================

ALTER TABLE bids ADD CONSTRAINT bids_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id);
ALTER TABLE disputes ADD CONSTRAINT disputes_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id);
ALTER TABLE deliveries ADD CONSTRAINT deliveries_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id);
ALTER TABLE deliveries ADD CONSTRAINT deliveries_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES bids(id);
ALTER TABLE escrows ADD CONSTRAINT escrows_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id);

-- ============================================================
-- 10. Reset indexer state so EventListener re-indexes from chain
-- ============================================================

TRUNCATE TABLE indexer_state;

COMMIT;
