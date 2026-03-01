import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, "..", "state.json");

export interface AgentState {
  registered: boolean;
  bidsPlaced: { jobId: number; price: number; txHash: string; timestamp: string }[];
  activeBids: number[]; // job IDs we've bid on and are waiting for acceptance
  activeJobs: number[]; // job IDs where our bid was accepted
  completedJobs: number[];
  skippedJobs: number[]; // jobs we evaluated and decided not to bid on
  lastPollAt: string | null;
  totalEarned: number;
}

const DEFAULT_STATE: AgentState = {
  registered: false,
  bidsPlaced: [],
  activeBids: [],
  activeJobs: [],
  completedJobs: [],
  skippedJobs: [],
  lastPollAt: null,
  totalEarned: 0,
};

export function loadState(): AgentState {
  if (!existsSync(STATE_PATH)) return { ...DEFAULT_STATE };
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: AgentState) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
