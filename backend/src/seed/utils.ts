import { ethers } from 'ethers';
import { GENESIS_BLOCK, BLOCK_TIME_S } from './config';

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function pick<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

export function pickN<T>(items: T[], n: number): T[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

export function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function fakeTxHash(): string {
  return '0x' + ethers.hexlify(ethers.randomBytes(32)).slice(2);
}

export function fakeIpfsUri(): string {
  return 'ipfs://Qm' + ethers.hexlify(ethers.randomBytes(22)).slice(2);
}

export function fakeProofHash(): string {
  return ethers.keccak256(ethers.toUtf8Bytes(`proof-${Date.now()}-${Math.random()}`));
}

export function fakeCriteriaHash(criteria: string[]): string {
  return ethers.keccak256(ethers.toUtf8Bytes(criteria.join('|')));
}

/**
 * Convert a timestamp to a plausible block number.
 * Uses a fixed genesis timestamp and block time.
 */
export function timestampToBlock(date: Date, genesisDate: Date): bigint {
  const elapsedSeconds = Math.floor((date.getTime() - genesisDate.getTime()) / 1000);
  return GENESIS_BLOCK + BigInt(Math.max(0, Math.floor(elapsedSeconds / BLOCK_TIME_S)));
}

/**
 * Generate timestamps with ramp-up distribution.
 * Earlier periods get fewer jobs, later periods get more.
 */
export function generateRampUpTimestamps(
  count: number,
  startDate: Date,
  endDate: Date,
): Date[] {
  const timestamps: Date[] = [];
  const totalMs = endDate.getTime() - startDate.getTime();

  for (let i = 0; i < count; i++) {
    // Use quadratic CDF for ramp-up: more events towards the end
    const u = Math.random();
    const t = Math.pow(u, 0.6); // exponent < 1 = front-loaded, > 1 = back-loaded
    const ms = startDate.getTime() + t * totalMs;
    timestamps.push(new Date(ms));
  }

  return timestamps.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Add a random offset to a date.
 */
export function addHours(date: Date, minH: number, maxH: number): Date {
  const offset = randomFloat(minH, maxH) * 3600 * 1000;
  return new Date(date.getTime() + offset);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 3600 * 1000);
}

export function daysAgo(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / (24 * 3600 * 1000);
}
