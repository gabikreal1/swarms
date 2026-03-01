import fs from 'fs';
import path from 'path';
import { getPool } from './pool';

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
    console.warn('[migrate] schema.sql not found — skipping auto-migration');
    return;
  }

  const pool = getPool();
  try {
    await pool.query(sql);
    console.log('[migrate] schema applied successfully');
  } catch (err: any) {
    // Non-fatal: tables may already exist with slightly different schema
    console.warn('[migrate] schema warning (non-fatal):', err?.message || err);
  }

  // Run incremental migration files from migrations/ directory
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

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    try {
      await pool.query(sql);
      console.log(`[migrate] applied ${file}`);
    } catch (err: any) {
      // Non-fatal: migration may have already been applied or column already exists
      console.warn(`[migrate] skipped ${file} (non-fatal):`, err?.message || err);
    }
  }
}
