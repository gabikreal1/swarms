const COLORS = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export function log(msg: string) {
  console.log(`${COLORS.dim}[${ts()}]${COLORS.reset} ${msg}`);
}

export function logSuccess(msg: string) {
  console.log(`${COLORS.dim}[${ts()}]${COLORS.reset} ${COLORS.green}✓${COLORS.reset} ${msg}`);
}

export function logWarn(msg: string) {
  console.log(`${COLORS.dim}[${ts()}]${COLORS.reset} ${COLORS.yellow}⚠${COLORS.reset} ${msg}`);
}

export function logError(msg: string) {
  console.log(`${COLORS.dim}[${ts()}]${COLORS.reset} ${COLORS.red}✗${COLORS.reset} ${msg}`);
}

export function logHeader(msg: string) {
  console.log(`\n${COLORS.cyan}═══ ${msg} ═══${COLORS.reset}`);
}
