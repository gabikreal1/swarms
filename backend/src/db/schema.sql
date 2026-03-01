-- Swarms Marketplace PostgreSQL Schema
-- Mirrors on-chain state for fast off-chain queries

-- ============================================================
-- Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'open', 'in_progress', 'delivered', 'completed', 'disputed', 'validating'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM (
    'none', 'pending', 'under_review', 'resolved_user', 'resolved_agent', 'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE agent_status AS ENUM (
    'unregistered', 'active', 'inactive', 'banned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Core tables
-- ============================================================

CREATE TABLE IF NOT EXISTS jobs (
  id            BIGINT PRIMARY KEY,
  poster        VARCHAR(42) NOT NULL,
  description   TEXT NOT NULL,
  metadata_uri  TEXT,
  tags          TEXT[] DEFAULT '{}',
  deadline      BIGINT,
  status        job_status NOT NULL DEFAULT 'open',
  budget        NUMERIC(78,0),        -- wei-scale uint256
  category      VARCHAR(100),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMP,
  criteria_hash VARCHAR(66),
  criteria_count SMALLINT,
  all_required  BOOLEAN,
  passing_score SMALLINT,
  block_number  BIGINT NOT NULL,
  tx_hash       VARCHAR(66) NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_jobs_poster   ON jobs (poster);
CREATE INDEX IF NOT EXISTS idx_jobs_status   ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_deadline ON jobs (deadline);
CREATE INDEX IF NOT EXISTS idx_jobs_tags     ON jobs USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_jobs_created  ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_search   ON jobs USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS bids (
  id            BIGINT PRIMARY KEY,
  job_id        BIGINT NOT NULL REFERENCES jobs(id),
  bidder        VARCHAR(42) NOT NULL,
  price         NUMERIC(78,0) NOT NULL,
  delivery_time BIGINT,
  reputation    NUMERIC(78,0) DEFAULT 0,
  metadata_uri  TEXT,
  response_uri  TEXT,
  accepted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  block_number  BIGINT NOT NULL,
  tx_hash       VARCHAR(66) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bids_job_id  ON bids (job_id);
CREATE INDEX IF NOT EXISTS idx_bids_bidder  ON bids (bidder);
CREATE INDEX IF NOT EXISTS idx_bids_accepted ON bids (accepted) WHERE accepted = TRUE;

CREATE TABLE IF NOT EXISTS agents (
  wallet        VARCHAR(42) PRIMARY KEY,
  name          TEXT NOT NULL,
  metadata_uri  TEXT,
  capabilities  TEXT[] DEFAULT '{}',
  reputation    NUMERIC(78,0) DEFAULT 0,
  status        agent_status NOT NULL DEFAULT 'active',
  jobs_completed BIGINT DEFAULT 0,
  jobs_failed   BIGINT DEFAULT 0,
  total_earned  NUMERIC(78,0) DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  block_number  BIGINT NOT NULL,
  tx_hash       VARCHAR(66) NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(array_to_string(capabilities, ' '), ''))
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_agents_status     ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agents_reputation ON agents (reputation DESC);
CREATE INDEX IF NOT EXISTS idx_agents_caps       ON agents USING GIN (capabilities);
CREATE INDEX IF NOT EXISTS idx_agents_search     ON agents USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS disputes (
  id                  BIGINT PRIMARY KEY,
  job_id              BIGINT NOT NULL REFERENCES jobs(id),
  initiator           VARCHAR(42) NOT NULL,
  reason              TEXT,
  evidence            TEXT[] DEFAULT '{}',
  status              dispute_status NOT NULL DEFAULT 'pending',
  resolution_message  TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMP,
  block_number        BIGINT NOT NULL,
  tx_hash             VARCHAR(66) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disputes_job_id ON disputes (job_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes (status);

CREATE TABLE IF NOT EXISTS reputation_events (
  id            BIGSERIAL PRIMARY KEY,
  agent         VARCHAR(42) NOT NULL,
  score         NUMERIC(78,0) NOT NULL,
  jobs_completed BIGINT,
  jobs_failed   BIGINT,
  total_earned  NUMERIC(78,0),
  last_updated  BIGINT,
  block_number  BIGINT NOT NULL,
  tx_hash       VARCHAR(66) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_events_agent ON reputation_events (agent);
CREATE INDEX IF NOT EXISTS idx_rep_events_time  ON reputation_events (created_at DESC);

-- ============================================================
-- Delivery tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS deliveries (
  job_id        BIGINT PRIMARY KEY REFERENCES jobs(id),
  bid_id        BIGINT NOT NULL REFERENCES bids(id),
  proof_hash    VARCHAR(66) NOT NULL,
  delivered_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  block_number  BIGINT NOT NULL,
  tx_hash       VARCHAR(66) NOT NULL
);

-- ============================================================
-- Escrow tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS escrows (
  job_id        BIGINT PRIMARY KEY REFERENCES jobs(id),
  poster        VARCHAR(42) NOT NULL,
  agent         VARCHAR(42) NOT NULL,
  amount        NUMERIC(78,0) NOT NULL,
  funded        BOOLEAN NOT NULL DEFAULT TRUE,
  released      BOOLEAN NOT NULL DEFAULT FALSE,
  refunded      BOOLEAN NOT NULL DEFAULT FALSE,
  payout        NUMERIC(78,0),
  fee           NUMERIC(78,0),
  block_number  BIGINT NOT NULL,
  tx_hash       VARCHAR(66) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Aggregation cache tables
-- ============================================================

CREATE TABLE IF NOT EXISTS tag_clusters (
  tag               TEXT PRIMARY KEY,
  job_count         BIGINT NOT NULL DEFAULT 0,
  avg_budget        NUMERIC(78,0),
  success_rate      NUMERIC(5,4),          -- 0.0000 - 1.0000
  avg_completion_s  BIGINT,                -- avg seconds to complete
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trend_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  tag           TEXT NOT NULL,
  window_start  TIMESTAMP NOT NULL,
  window_end    TIMESTAMP NOT NULL,
  job_count     BIGINT NOT NULL DEFAULT 0,
  bid_count     BIGINT NOT NULL DEFAULT 0,
  momentum      NUMERIC(10,4),             -- growth rate vs prior window
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trends_tag    ON trend_snapshots (tag);
CREATE INDEX IF NOT EXISTS idx_trends_window ON trend_snapshots (window_end DESC);

CREATE TABLE IF NOT EXISTS price_series (
  id            BIGSERIAL PRIMARY KEY,
  tag           TEXT NOT NULL,
  bucket_start  TIMESTAMP NOT NULL,
  bucket_end    TIMESTAMP NOT NULL,
  avg_price     NUMERIC(78,0),
  median_price  NUMERIC(78,0),
  p25_price     NUMERIC(78,0),
  p75_price     NUMERIC(78,0),
  sample_count  BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_tag    ON price_series (tag);
CREATE INDEX IF NOT EXISTS idx_price_bucket ON price_series (bucket_end DESC);

CREATE TABLE IF NOT EXISTS supply_demand (
  id              BIGSERIAL PRIMARY KEY,
  tag             TEXT NOT NULL,
  active_agents   BIGINT NOT NULL DEFAULT 0,
  open_jobs       BIGINT NOT NULL DEFAULT 0,
  ratio           NUMERIC(10,4),             -- agents / jobs
  snapshot_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_tag  ON supply_demand (tag);
CREATE INDEX IF NOT EXISTS idx_sd_snap ON supply_demand (snapshot_at DESC);

-- ============================================================
-- ============================================================
-- Events (used by event-hub.ts for materialization)
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id              BIGSERIAL PRIMARY KEY,
  type            VARCHAR(60) NOT NULL,
  job_id          BIGINT,
  data            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
CREATE INDEX IF NOT EXISTS idx_events_job_id ON events (job_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at DESC);

-- ============================================================
-- Chat sessions (Butler conversational state)
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id      UUID PRIMARY KEY,
  wallet_address  VARCHAR(42) NOT NULL,
  phase           VARCHAR(30) NOT NULL DEFAULT 'greeting',
  context         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_wallet ON chat_sessions (wallet_address);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions (updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY,
  session_id      UUID NOT NULL REFERENCES chat_sessions(session_id),
  role            VARCHAR(10) NOT NULL CHECK (role IN ('user', 'butler')),
  blocks          JSONB NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages (session_id, created_at);

-- ============================================================
-- Indexer bookkeeping
-- ============================================================

CREATE TABLE IF NOT EXISTS indexer_state (
  contract_name   TEXT PRIMARY KEY,
  last_block      BIGINT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
