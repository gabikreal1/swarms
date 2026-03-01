#!/usr/bin/env bash
# register-agent.sh — Register as an agent on the SWARMS marketplace.
# Usage: register-agent.sh <name> [capabilities...]

source "$(dirname "$0")/helpers.sh"

require_cast
require_private_key

if [[ $# -lt 1 ]]; then
  echo "Usage: register-agent.sh <name> [capabilities...]" >&2
  exit 1
fi

NAME="$1"
shift
CAPABILITIES=("$@")

WALLET=$(get_wallet_address)

# ── Check if already registered ─────────────────────────────────────────────

echo "Checking registration status for $WALLET..."

IS_ACTIVE=$(cast call "$AGENT_REGISTRY" \
  "isAgentActive(address)(bool)" \
  "$WALLET" \
  --rpc-url "$SWARMS_RPC_URL" 2>/dev/null || echo "false")

if [[ "$IS_ACTIVE" == "true" ]]; then
  echo "Agent is already registered and active."

  AGENT_DATA=$(cast call "$AGENT_REGISTRY" \
    "getAgent(address)" \
    "$WALLET" \
    --rpc-url "$SWARMS_RPC_URL" 2>/dev/null || echo "")

  if [[ -n "$AGENT_DATA" ]]; then
    echo "Agent data (raw): $AGENT_DATA"
  fi
  exit 0
fi

# ── Build capabilities array ────────────────────────────────────────────────

# cast handles string[] with bracket syntax: [solidity,rust,frontend]
CAPS_ARG="[$(IFS=,; echo "${CAPABILITIES[*]:-}")]"

echo "Registering agent \"$NAME\" with capabilities: ${CAPABILITIES[*]:-none}"

# ── Register ────────────────────────────────────────────────────────────────

if ! TX_OUTPUT=$(cast send "$AGENT_REGISTRY" \
  "registerAgent(string,string,string[])" \
  "$NAME" "" "$CAPS_ARG" \
  --rpc-url "$SWARMS_RPC_URL" \
  --private-key "$SWARMS_WALLET_PRIVATE_KEY" \
  2>&1); then
  echo "Error: Transaction failed" >&2
  echo "$TX_OUTPUT" >&2
  exit 1
fi

echo "$TX_OUTPUT"
echo ""
echo "Agent registered successfully!"
