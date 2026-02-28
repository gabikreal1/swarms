import { getPool } from './pool';
import type {
  ConversationSession,
  ChatMessage,
  SessionPhase,
  SessionContext,
  GenUIBlock,
} from '../types/chat';

function db() {
  return getPool();
}

// ── Sessions ──────────────────────────────────────────────

export async function upsertSession(session: ConversationSession): Promise<void> {
  await db().query(
    `INSERT INTO chat_sessions (session_id, wallet_address, phase, context, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (session_id) DO UPDATE SET
       phase = EXCLUDED.phase,
       context = EXCLUDED.context,
       updated_at = EXCLUDED.updated_at`,
    [
      session.sessionId,
      session.walletAddress,
      session.phase,
      JSON.stringify(session.context),
      session.createdAt,
      session.updatedAt,
    ],
  );
}

export async function getSession(sessionId: string): Promise<ConversationSession | null> {
  const { rows } = await db().query(
    `SELECT session_id, wallet_address, phase, context, created_at, updated_at
     FROM chat_sessions WHERE session_id = $1`,
    [sessionId],
  );
  if (rows.length === 0) return null;

  const row = rows[0];
  const messages = await getMessages(sessionId);

  return {
    sessionId: row.session_id,
    walletAddress: row.wallet_address,
    phase: row.phase as SessionPhase,
    context: row.context as SessionContext,
    messages,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function updateSessionPhase(
  sessionId: string,
  phase: SessionPhase,
): Promise<void> {
  await db().query(
    `UPDATE chat_sessions SET phase = $1, updated_at = NOW() WHERE session_id = $2`,
    [phase, sessionId],
  );
}

export async function updateSessionContext(
  sessionId: string,
  context: SessionContext,
): Promise<void> {
  await db().query(
    `UPDATE chat_sessions SET context = $1, updated_at = NOW() WHERE session_id = $2`,
    [JSON.stringify(context), sessionId],
  );
}

export async function getSessionsByWallet(
  walletAddress: string,
  limit: number = 20,
): Promise<Pick<ConversationSession, 'sessionId' | 'phase' | 'createdAt' | 'updatedAt'>[]> {
  const { rows } = await db().query(
    `SELECT session_id, phase, created_at, updated_at
     FROM chat_sessions WHERE wallet_address = $1
     ORDER BY updated_at DESC LIMIT $2`,
    [walletAddress, limit],
  );
  return rows.map((r) => ({
    sessionId: r.session_id,
    phase: r.phase as SessionPhase,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }));
}

// ── Messages ──────────────────────────────────────────────

export async function insertMessage(
  sessionId: string,
  message: ChatMessage,
): Promise<void> {
  await db().query(
    `INSERT INTO chat_messages (id, session_id, role, blocks, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [
      message.id,
      sessionId,
      message.role,
      JSON.stringify(message.blocks),
      message.metadata ? JSON.stringify(message.metadata) : null,
      message.timestamp,
    ],
  );
}

export async function getMessages(
  sessionId: string,
  limit: number = 100,
): Promise<ChatMessage[]> {
  const { rows } = await db().query(
    `SELECT id, role, blocks, metadata, created_at
     FROM chat_messages WHERE session_id = $1
     ORDER BY created_at ASC LIMIT $2`,
    [sessionId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    role: r.role as 'user' | 'butler',
    blocks: r.blocks as GenUIBlock[],
    timestamp: r.created_at.toISOString(),
    metadata: r.metadata ?? undefined,
  }));
}
