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
  } catch (err) {
    console.error('[migrate] failed to apply schema:', err);
    throw err;
  }
}
