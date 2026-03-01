import { ethers } from "ethers";
import { config } from "./config.js";
import type { Job } from "./api.js";
import { log } from "./log.js";

/**
 * Evaluate whether this agent can handle a given job.
 * Returns a score 0-100 and reasoning.
 */
export function evaluateJob(job: Job): { score: number; reasoning: string; canDo: boolean } {
  let score = 0;
  const reasons: string[] = [];

  // Tag match — how many of the job's tags match our capabilities?
  const matchingTags = job.tags.filter((t) =>
    config.capabilities.some((c) => t.toLowerCase().includes(c) || c.includes(t.toLowerCase())),
  );
  const tagScore = job.tags.length > 0 ? (matchingTags.length / job.tags.length) * 40 : 0;
  score += tagScore;
  if (matchingTags.length > 0) {
    reasons.push(`Tags match: ${matchingTags.join(", ")} (${Math.round(tagScore)}/40)`);
  }

  // Description keyword match
  const desc = job.description.toLowerCase();
  const keywords = ["audit", "security", "review", "compliance", "smart contract", "solidity", "vulnerability", "defi", "token", "erc"];
  const matchedKeywords = keywords.filter((k) => desc.includes(k));
  const keywordScore = Math.min(matchedKeywords.length * 8, 30);
  score += keywordScore;
  if (matchedKeywords.length > 0) {
    reasons.push(`Keywords: ${matchedKeywords.join(", ")} (${keywordScore}/30)`);
  }

  // Budget in range (budget=0 means on-chain scan, no budget info — give partial score)
  if (job.budget === 0) {
    score += 8;
    reasons.push("No budget info, using default (8/15)");
  } else if (job.budget >= config.minBudgetUSDC && job.budget <= config.maxBudgetUSDC) {
    score += 15;
    reasons.push("Budget in range (15/15)");
  } else {
    reasons.push(`Budget ${job.budget} USDC out of range [${config.minBudgetUSDC}-${config.maxBudgetUSDC}]`);
  }

  // Competition — prefer lower competition
  if (job.bidCount <= 2) {
    score += 10;
    reasons.push(`Low competition: ${job.bidCount} bids (10/10)`);
  } else if (job.bidCount <= 5) {
    score += 5;
    reasons.push(`Medium competition: ${job.bidCount} bids (5/10)`);
  }

  // Deadline check — at least 12 hours remaining
  const daysLeft = (job.deadline - Date.now() / 1000) / 86400;
  if (daysLeft < 0) {
    score -= 50;
    reasons.push(`Expired: ${daysLeft.toFixed(1)} days ago (-50)`);
  } else if (daysLeft < 0.5) {
    score -= 10;
    reasons.push(`Very tight deadline: ${(daysLeft * 24).toFixed(0)}h left (-10)`);
  } else {
    score += 5;
    reasons.push(`Deadline OK: ${daysLeft.toFixed(0)} days left (5/5)`);
  }

  const canDo = score >= 35;
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasoning: reasons.join(" | "),
    canDo,
  };
}

/**
 * Calculate the bid price for a job.
 */
export function calculateBidPrice(job: Job): number {
  const budget = job.budget > 0 ? job.budget : config.defaultBidUSDC;
  const discount = 1 - config.bidDiscountPercent / 100;
  return Math.round(budget * discount);
}

/**
 * Generate a proof hash for delivery (simulated work).
 * In a real scenario, this would be the keccak256 of an IPFS CID
 * containing the actual deliverable.
 */
export function generateDeliveryProof(jobId: number, description: string): string {
  // Simulate: hash of job details + timestamp
  const data = `delivery:${jobId}:${description}:${Date.now()}`;
  return ethers.keccak256(ethers.toUtf8Bytes(data));
}
