#!/usr/bin/env bash
# check-reputation.sh — Check reputation score and stats for an agent.
# Usage: check-reputation.sh [address]

source "$(dirname "$0")/helpers.sh"

require_cast

# ── Determine address ───────────────────────────────────────────────────────

if [[ $# -ge 1 ]]; then
  ADDRESS="$1"
  if ! [[ "$ADDRESS" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
    echo "Error: Invalid address format. Expected 0x + 40 hex chars, got '$ADDRESS'" >&2
    exit 1
  fi
else
  require_private_key
  ADDRESS=$(get_wallet_address)
fi

echo "Address: $ADDRESS"
echo ""

# ── Reputation Score ────────────────────────────────────────────────────────

SCORE=$(cast call "$REPUTATION_TOKEN" \
  "scoreOf(address)(uint256)" \
  "$ADDRESS" \
  --rpc-url "$SWARMS_RPC_URL" 2>/dev/null | strip_cast || echo "0")

echo "Reputation Score: $SCORE"

# ── Detailed Stats ──────────────────────────────────────────────────────────

STATS=$(cast call "$REPUTATION_TOKEN" \
  "statsOf(address)((uint64,uint64,uint128,uint64))" \
  "$ADDRESS" \
  --rpc-url "$SWARMS_RPC_URL" 2>/dev/null | strip_cast || echo "")

if [[ -n "$STATS" ]]; then
  # cast returns tuples as "(val1, val2, val3, val4)" — strip parens and split on ", "
  CLEAN=$(echo "$STATS" | tr -d '()' | tr -s ' ')
  JOBS_COMPLETED=$(echo "$CLEAN" | cut -d',' -f1 | tr -d ' ')
  JOBS_FAILED=$(echo "$CLEAN" | cut -d',' -f2 | tr -d ' ')
  TOTAL_EARNED_RAW=$(echo "$CLEAN" | cut -d',' -f3 | tr -d ' ')
  LAST_UPDATED=$(echo "$CLEAN" | cut -d',' -f4 | tr -d ' ')

  TOTAL_EARNED=$(raw_to_usdc "${TOTAL_EARNED_RAW:-0}")
  LAST_DATE=$(format_date "${LAST_UPDATED:-0}")

  echo "Jobs Completed: ${JOBS_COMPLETED:-0}"
  echo "Jobs Failed:    ${JOBS_FAILED:-0}"
  echo "Total Earned:   ${TOTAL_EARNED:-0} USDC"
  echo "Last Updated:   $LAST_DATE"
else
  echo "Stats: No data available"
fi
