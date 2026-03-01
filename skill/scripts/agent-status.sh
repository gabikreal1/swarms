#!/usr/bin/env bash
# agent-status.sh — Show agent wallet, balance, registration, and reputation.
# Usage: agent-status.sh

source "$(dirname "$0")/helpers.sh"

require_cast
require_private_key

WALLET=$(get_wallet_address)
echo "Wallet: $WALLET"
echo ""

# ── USDC Balance ────────────────────────────────────────────────────────────

BALANCE_RAW=$(cast call "$USDC_TOKEN" \
  "balanceOf(address)(uint256)" \
  "$WALLET" \
  --rpc-url "$SWARMS_RPC_URL" 2>/dev/null | strip_cast || echo "0")

BALANCE=$(raw_to_usdc "$BALANCE_RAW")
echo "USDC Balance: $BALANCE"

# ── Registration Status ─────────────────────────────────────────────────────

IS_ACTIVE=$(cast call "$AGENT_REGISTRY" \
  "isAgentActive(address)(bool)" \
  "$WALLET" \
  --rpc-url "$SWARMS_RPC_URL" 2>/dev/null | strip_cast || echo "false")

if [[ "$IS_ACTIVE" == "true" ]]; then
  echo "Registered: Yes (Active)"

  AGENT_JSON=$(curl -sf "${SWARMS_API_URL}/v1/feed/agents?capabilities=&limit=100" 2>/dev/null || echo "")
  if [[ -n "$AGENT_JSON" ]] && command -v jq &>/dev/null; then
    AGENT_INFO=$(echo "$AGENT_JSON" | jq -r --arg w "$WALLET" '
      [.agents[]? // .data[]? // .[]?] |
      map(select(.wallet // .address | ascii_downcase == ($w | ascii_downcase))) |
      first // empty |
      "  Name: \(.name // "N/A")\n  Capabilities: \((.capabilities // []) | join(", "))"
    ' 2>/dev/null || echo "")
    if [[ -n "$AGENT_INFO" ]]; then
      echo -e "$AGENT_INFO"
    fi
  fi
else
  echo "Registered: No"
fi

echo ""

# ── Reputation ──────────────────────────────────────────────────────────────

SCORE=$(cast call "$REPUTATION_TOKEN" \
  "scoreOf(address)(uint256)" \
  "$WALLET" \
  --rpc-url "$SWARMS_RPC_URL" 2>/dev/null | strip_cast || echo "0")

echo "Reputation Score: $SCORE"

STATS=$(cast call "$REPUTATION_TOKEN" \
  "statsOf(address)((uint64,uint64,uint128,uint64))" \
  "$WALLET" \
  --rpc-url "$SWARMS_RPC_URL" 2>/dev/null | strip_cast || echo "")

if [[ -n "$STATS" ]]; then
  CLEAN=$(echo "$STATS" | tr -d '()' | tr -s ' ')
  JOBS_COMPLETED=$(echo "$CLEAN" | cut -d',' -f1 | tr -d ' ')
  JOBS_FAILED=$(echo "$CLEAN" | cut -d',' -f2 | tr -d ' ')
  TOTAL_EARNED_RAW=$(echo "$CLEAN" | cut -d',' -f3 | tr -d ' ')
  LAST_UPDATED=$(echo "$CLEAN" | cut -d',' -f4 | tr -d ' ')

  TOTAL_EARNED=$(raw_to_usdc "${TOTAL_EARNED_RAW:-0}")

  echo "Jobs Completed: ${JOBS_COMPLETED:-0}"
  echo "Jobs Failed:    ${JOBS_FAILED:-0}"
  echo "Total Earned:   ${TOTAL_EARNED:-0} USDC"
fi
