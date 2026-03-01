import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { SiweMessage, generateNonce } from 'siwe';
import { getPool } from '../db/pool';

const router = Router();

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Ensure auth tables exist (idempotent)
async function ensureAuthTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_nonces (
      nonce TEXT PRIMARY KEY,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_wallet ON auth_sessions(wallet);
  `);
}

let tablesReady: Promise<void> | null = null;
function ready(): Promise<void> {
  if (!tablesReady) tablesReady = ensureAuthTables();
  return tablesReady;
}

// Periodic cleanup of expired entries (every 10 minutes)
setInterval(async () => {
  try {
    const pool = getPool();
    await pool.query(`DELETE FROM auth_nonces WHERE expires_at < NOW()`);
    await pool.query(`DELETE FROM auth_sessions WHERE expires_at < NOW()`);
  } catch {
    // DB not ready yet, ignore
  }
}, 10 * 60 * 1000);

// ── POST /v1/auth/nonce ──────────────────────────────────────────────
router.post('/nonce', async (_req: Request, res: Response) => {
  await ready();
  const nonce = generateNonce();
  const pool = getPool();
  await pool.query(
    `INSERT INTO auth_nonces (nonce, expires_at) VALUES ($1, $2)`,
    [nonce, new Date(Date.now() + NONCE_TTL_MS)],
  );
  res.json({ nonce });
});

// ── POST /v1/auth/login ─────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    await ready();
    const { message, signature } = req.body;

    if (!message || !signature) {
      res.status(400).json({ error: 'message and signature are required' });
      return;
    }

    const siweMessage = new SiweMessage(message);
    const pool = getPool();

    // Verify the nonce was issued by us
    const { rows } = await pool.query(
      `DELETE FROM auth_nonces WHERE nonce = $1 AND expires_at > NOW() RETURNING nonce`,
      [siweMessage.nonce],
    );
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid or expired nonce' });
      return;
    }

    // Verify signature
    const result = await siweMessage.verify({ signature });
    if (!result.success) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const wallet = siweMessage.address.toLowerCase();
    await pool.query(
      `INSERT INTO auth_sessions (token, wallet, expires_at) VALUES ($1, $2, $3)`,
      [token, wallet, new Date(Date.now() + SESSION_TTL_MS)],
    );

    res.json({ token, wallet });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// ── POST /v1/auth/logout ────────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  await ready();
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const pool = getPool();
    await pool.query(`DELETE FROM auth_sessions WHERE token = $1`, [token]);
  }
  res.json({ ok: true });
});

// ── Middleware: authMiddleware ────────────────────────────────────────
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.slice(7);
  const pool = getPool();

  pool.query(
    `SELECT wallet FROM auth_sessions WHERE token = $1 AND expires_at > NOW()`,
    [token],
  ).then(({ rows }) => {
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    req.walletAddress = rows[0].wallet;
    next();
  }).catch(() => {
    res.status(401).json({ error: 'Auth check failed' });
  });
}

// ── Middleware: optionalAuth ─────────────────────────────────────────
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const pool = getPool();

  pool.query(
    `SELECT wallet FROM auth_sessions WHERE token = $1 AND expires_at > NOW()`,
    [token],
  ).then(({ rows }) => {
    if (rows.length > 0) {
      req.walletAddress = rows[0].wallet;
    }
    next();
  }).catch(() => {
    next();
  });
}

export default router;
