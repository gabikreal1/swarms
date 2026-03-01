/**
 * Structured logger with service-level prefixes.
 * Every line starts with [SERVICE] so logs can be filtered with grep/Railway.
 *
 * Usage:
 *   import { log } from '../lib/logger';
 *   log.chat('session created', sessionId);
 *   log.indexer('scanning blocks 100 → 200');
 *   log.llm('tool call: post_job', args);
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LEVEL_FN: Record<LogLevel, (...args: unknown[]) => void> = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

function fmt(service: string, level: LogLevel, msg: string, ...rest: unknown[]): void {
  const ts = new Date().toISOString();
  const prefix = `${ts} [${service}]`;
  LEVEL_FN[level](prefix, msg, ...rest);
}

function makeServiceLogger(service: string) {
  return {
    info: (msg: string, ...rest: unknown[]) => fmt(service, 'info', msg, ...rest),
    warn: (msg: string, ...rest: unknown[]) => fmt(service, 'warn', msg, ...rest),
    error: (msg: string, ...rest: unknown[]) => fmt(service, 'error', msg, ...rest),
    debug: (msg: string, ...rest: unknown[]) => fmt(service, 'debug', msg, ...rest),
  };
}

export const log = {
  chat: makeServiceLogger('chat'),
  llm: makeServiceLogger('llm'),
  tool: makeServiceLogger('tool'),
  sse: makeServiceLogger('sse'),
  indexer: makeServiceLogger('indexer'),
  hub: makeServiceLogger('hub'),
  validator: makeServiceLogger('validator'),
  qdrant: makeServiceLogger('qdrant'),
  http: makeServiceLogger('http'),
  db: makeServiceLogger('db'),
  server: makeServiceLogger('server'),
  aggregator: makeServiceLogger('aggregator'),
  feed: makeServiceLogger('feed'),
  auth: makeServiceLogger('auth'),
  stream: makeServiceLogger('stream'),
  ipfs: makeServiceLogger('ipfs'),
};
