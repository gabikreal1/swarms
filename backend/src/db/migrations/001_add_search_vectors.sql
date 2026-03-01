-- Migration: Add full-text search tsvector columns and GIN indexes

-- Jobs: search_vector generated from description + tags
DO $$ BEGIN
  ALTER TABLE jobs ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_search ON jobs USING gin(search_vector);

-- Agents: search_vector generated from name + capabilities
DO $$ BEGIN
  ALTER TABLE agents ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(name, '') || ' ' || coalesce(array_to_string(capabilities, ' '), ''))
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_agents_search ON agents USING gin(search_vector);
