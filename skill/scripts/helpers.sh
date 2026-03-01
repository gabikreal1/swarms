#!/usr/bin/env bash
# helpers.sh — Shared environment validation, contract addresses, and formatting utilities.
# Source this file from other scripts: source "$(dirname "$0")/helpers.sh"

set -euo pipefail

# ── Contract Addresses (ARC Testnet, Chain ID 5042002) ──────────────────────

export ORDER_BOOK="0x15b109eb67Bf2400CD44D4448ea1086A91aEac72"
export AGENT_REGISTRY="0xf90aD6E1FECa8F14e8c289A43366E7EcC5bbF67c"
export REPUTATION_TOKEN="0xd6D35D4584B69B4556928207d492d8d39de89D55"
export USDC_TOKEN="0xd37475e12B93AA4e592C4ebB9607daE55fF56AB1"
export ESCROW="0xbE8532a5E21aB5783f0499d3f44A77d5dae12580"

# ── Environment Defaults ────────────────────────────────────────────────────

export SWARMS_API_URL="${SWARMS_API_URL:-https://swarms-api-production-d35e.up.railway.app}"
export SWARMS_RPC_URL="${SWARMS_RPC_URL:-https://rpc.testnet.arc.network}"

# ── Validation ──────────────────────────────────────────────────────────────

require_cast() {
  if ! command -v cast &>/dev/null; then
    echo "Error: 'cast' not found. Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup" >&2
    exit 1
  fi
}

require_private_key() {
  if [[ -z "${SWARMS_WALLET_PRIVATE_KEY:-}" ]]; then
    echo "Error: SWARMS_WALLET_PRIVATE_KEY is not set." >&2
    echo "Export it: export SWARMS_WALLET_PRIVATE_KEY=0xYourKeyHere" >&2
    exit 1
  fi
}

get_wallet_address() {
  require_cast
  require_private_key
  cast wallet address --private-key "$SWARMS_WALLET_PRIVATE_KEY"
}

# ── Formatting ──────────────────────────────────────────────────────────────

# Strip cast's annotation suffixes: "29400000 [2.94e7]" → "29400000"
# Also handles inline annotations in tuples: "(1, 0, 30000000 [3e7])" → "(1, 0, 30000000)"
strip_cast() {
  sed 's/ \[[^]]*\]//g'
}

# Convert human-readable USDC (e.g. "500") to 6-decimal integer (e.g. "500000000")
usdc_to_raw() {
  local amount="$1"
  # Handle decimal input by multiplying by 1e6
  if command -v bc &>/dev/null; then
    echo "$amount * 1000000" | bc | sed 's/\..*$//'
  else
    # Fallback: integer-only multiplication
    echo $(( ${amount%%.*} * 1000000 ))
  fi
}

# Convert 6-decimal integer to human-readable USDC
raw_to_usdc() {
  local raw="$1"
  if command -v bc &>/dev/null; then
    echo "scale=2; $raw / 1000000" | bc
  else
    echo $(( raw / 1000000 ))
  fi
}

# Convert Unix timestamp to human-readable date
format_date() {
  local ts="$1"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    date -r "$ts" '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || echo "$ts"
  else
    date -d "@$ts" '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || echo "$ts"
  fi
}

# Convert days to seconds
days_to_seconds() {
  echo $(( $1 * 86400 ))
}

# ── Output Helpers ──────────────────────────────────────────────────────────

# Pretty-print JSON if jq is available, otherwise output raw
format_json() {
  if command -v jq &>/dev/null; then
    jq '.'
  else
    cat
  fi
}

# Extract a field from JSON if jq is available
json_field() {
  local field="$1"
  if command -v jq &>/dev/null; then
    jq -r "$field"
  else
    cat
  fi
}
