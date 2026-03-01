import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { SiweMessage, generateNonce } from 'siwe';

const router = Router();

// ── In-memory stores ─────────────────────────────────────────────────
// Nonce store: nonce -> expiresAt
const nonceStore = new Map<string, number>();

// Session token store: token -> { wallet, expiresAt }
const tokenStore = new Map<string, { wallet: string; expiresAt: number }>();

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Periodic cleanup of expired entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiresAt] of nonceStore) {
    if (expiresAt < now) nonceStore.delete(nonce);
  }
  for (const [token, session] of tokenStore) {
    if (session.expiresAt < now) tokenStore.delete(token);
  }
}, 10 * 60 * 1000);

// ── POST /v1/auth/nonce ──────────────────────────────────────────────
router.post('/nonce', (_req: Request, res: Response) => {
  const nonce = generateNonce();
  nonceStore.set(nonce, Date.now() + NONCE_TTL_MS);
  res.json({ nonce });
});

// ── POST /v1/auth/login ─────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { message, signature } = req.body;

    if (!message || !signature) {
      res.status(400).json({ error: 'message and signature are required' });
      return;
    }

    const siweMessage = new SiweMessage(message);

    // Verify the nonce was issued by us
    if (!nonceStore.has(siweMessage.nonce)) {
      res.status(401).json({ error: 'Invalid or expired nonce' });
      return;
    }

    // Verify signature
    const result = await siweMessage.verify({ signature });
    if (!result.success) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Consume the nonce so it can't be reused
    nonceStore.delete(siweMessage.nonce);

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const wallet = siweMessage.address.toLowerCase();
    tokenStore.set(token, {
      wallet,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    res.json({ token, wallet });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// ── POST /v1/auth/logout ────────────────────────────────────────────
router.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    tokenStore.delete(token);
  }
  res.json({ ok: true });
});

// ── Middleware: authMiddleware ────────────────────────────────────────
// Requires a valid Bearer token. Rejects with 401 if missing/invalid.
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.slice(7);
  const session = tokenStore.get(token);

  if (!session || session.expiresAt < Date.now()) {
    if (session) tokenStore.delete(token);
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.walletAddress = session.wallet;
  next();
}

// ── Middleware: optionalAuth ─────────────────────────────────────────
// Attaches req.walletAddress if a valid token is present, but doesn't
// reject requests without auth.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const session = tokenStore.get(token);
    if (session && session.expiresAt >= Date.now()) {
      req.walletAddress = session.wallet;
    } else if (session) {
      tokenStore.delete(token);
    }
  }
  next();
}

export default router;
