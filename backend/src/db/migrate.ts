import fs from 'fs';
import path from 'path';
import { getPool } from './pool';
import { log } from '../lib/logger';

export async function runMigrations(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');

  // In production the dist/ folder won't have schema.sql,
  // so also check the src/ relative path
  const candidates = [
    schemaPath,
    path.resolve(__dirname, '../../src/db/schema.sql'),
  ];

  let sql: string | null = null;
  for (const p of candidates) {
    try {
      sql = fs.readFileSync(p, 'utf-8');
      break;
    } catch {
      // try next
    }
  }

  if (!sql) {
    log.db.warn('schema.sql not found — skipping auto-migration');
    return;
  }

  const pool = getPool();
  try {
    await pool.query(sql);
    log.db.info('schema applied');
  } catch (err: any) {
    // Non-fatal: tables may already exist with slightly different schema
    log.db.warn('schema warning (non-fatal):', err?.message || err);
  }

  // Run incremental migration files (tracked — each runs only once)
  await runMigrationFiles(pool);
}

async function runMigrationFiles(pool: ReturnType<typeof getPool>): Promise<void> {
  const migrationsDirs = [
    path.join(__dirname, 'migrations'),
    path.resolve(__dirname, '../../src/db/migrations'),
  ];

  let migrationsDir: string | null = null;
  for (const dir of migrationsDirs) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        migrationsDir = dir;
        break;
      }
    } catch {
      // try next
    }
  }

  if (!migrationsDir) return;

  // Create tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Bootstrap: if tracking table is empty but migrations clearly ran
  // (e.g., jobs.chain_id column exists from 002), mark them as applied
  const { rows: existing } = await pool.query(
    `SELECT filename FROM schema_migrations`
  );
  if (existing.length === 0) {
    try {
      // Check if migration 002 already ran (chain_id column exists on jobs)
      const { rows: cols } = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'jobs' AND column_name = 'chain_id'`
      );
      if (cols.length > 0) {
        // Mark 001 and 002 as already applied
        await pool.query(
          `INSERT INTO schema_migrations (filename) VALUES ('001_add_search_vectors.sql'), ('002_uuid_primary_keys.sql') ON CONFLICT DO NOTHING`
        );
        log.db.info('bootstrapped migration tracking (001, 002 marked as applied)');
      }
    } catch {
      // Non-fatal
    }
  }

  // Get already-applied migrations
  const { rows: applied } = await pool.query(
    `SELECT filename FROM schema_migrations`
  );
  const appliedSet = new Set(applied.map((r: any) => r.filename));

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue; // already applied
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    try {
      await pool.query(sql);
      await pool.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
        [file],
      );
      log.db.info(`migration applied: ${file}`);
    } catch (err: any) {
      log.db.warn(`migration failed: ${file}:`, err?.message || err);
    }
  }
}
