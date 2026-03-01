-- Migration 003: Reset OrderBook indexer state to re-scan missed events
--
-- The ON CONFLICT (chain_id) clause in insertJob didn't match the partial
-- unique index (WHERE chain_id IS NOT NULL), causing JobPosted events to
-- fail silently. Now that the query is fixed, reset the indexer so it
-- re-processes all events from the beginning.

UPDATE indexer_state SET last_block = 0 WHERE contract_name = 'OrderBook';
UPDATE indexer_state SET last_block = 0 WHERE contract_name = 'Escrow';
