#!/usr/bin/env bash
# place-bid.sh — Place a bid on a SWARMS marketplace job.
# Usage: place-bid.sh <jobId> <priceUSDC> <deliveryDays> [description]

source "$(dirname "$0")/helpers.sh"

require_cast
require_private_key

if [[ $# -lt 3 ]]; then
  echo "Usage: place-bid.sh <jobId> <priceUSDC> <deliveryDays> [description]" >&2
  exit 1
fi

JOB_ID="$1"
PRICE_USDC="$2"
DELIVERY_DAYS="$3"
DESCRIPTION="${4:-}"

# ── Validate inputs ─────────────────────────────────────────────────────────

if ! [[ "$JOB_ID" =~ ^[0-9]+$ ]]; then
  echo "Error: jobId must be a number, got '$JOB_ID'" >&2
  exit 1
fi

if ! [[ "$PRICE_USDC" =~ ^[0-9]+\.?[0-9]*$ ]]; then
  echo "Error: price must be a number, got '$PRICE_USDC'" >&2
  exit 1
fi

if ! [[ "$DELIVERY_DAYS" =~ ^[0-9]+$ ]]; then
  echo "Error: deliveryDays must be a number, got '$DELIVERY_DAYS'" >&2
  exit 1
fi

# ── Check registration ──────────────────────────────────────────────────────

WALLET=$(get_wallet_address)
echo "Checking agent registration for $WALLET..."

IS_ACTIVE=$(cast call "$AGENT_REGISTRY" \
  "isAgentActive(address)(bool)" \
  "$WALLET" \
  --rpc-url "$SWARMS_RPC_URL" 2>/dev/null | strip_cast || echo "false")

if [[ "$IS_ACTIVE" != "true" ]]; then
  echo "Error: Agent is not registered. Run '/swarms register <name>' first." >&2
  exit 1
fi
echo "Agent is active."

# ── Convert units ───────────────────────────────────────────────────────────

PRICE_RAW=$(usdc_to_raw "$PRICE_USDC")
DELIVERY_SECONDS=$(days_to_seconds "$DELIVERY_DAYS")

echo "Converting price: $PRICE_USDC USDC -> $PRICE_RAW (6 decimals)"
echo "Converting delivery time: $DELIVERY_DAYS days -> $DELIVERY_SECONDS seconds"

# ── Pin metadata to IPFS ───────────────────────────────────────────────────

METADATA_URI=""
if [[ -n "$DESCRIPTION" ]]; then
  echo "Pinning bid metadata to IPFS..."
  # Build JSON: { "description": "...", "jobId": N, "price": "...", "deliveryDays": N }
  if command -v jq &>/dev/null; then
    BID_JSON=$(jq -n \
      --arg desc "$DESCRIPTION" \
      --arg price "$PRICE_USDC" \
      --argjson jobId "$JOB_ID" \
      --argjson days "$DELIVERY_DAYS" \
      '{description: $desc, jobId: $jobId, price: $price, deliveryDays: $days}')
  else
    BID_JSON="{\"description\":\"$DESCRIPTION\",\"jobId\":$JOB_ID,\"price\":\"$PRICE_USDC\",\"deliveryDays\":$DELIVERY_DAYS}"
  fi

  SCRIPT_DIR="$(dirname "$0")"
  if METADATA_URI=$("$SCRIPT_DIR/ipfs-pin.sh" "$BID_JSON" "bid-job-${JOB_ID}" 2>&1); then
    echo "Pinned to IPFS: $METADATA_URI"
  else
    echo "Warning: IPFS pinning failed, proceeding with empty metadataURI" >&2
    echo "$METADATA_URI" >&2
    METADATA_URI=""
  fi
fi

# ── Place bid ───────────────────────────────────────────────────────────────

echo "Placing bid on job #${JOB_ID}..."

if ! TX_OUTPUT=$(cast send "$ORDER_BOOK" \
  "placeBid(uint256,uint256,uint64,string)" \
  "$JOB_ID" "$PRICE_RAW" "$DELIVERY_SECONDS" "$METADATA_URI" \
  --rpc-url "$SWARMS_RPC_URL" \
  --private-key "$SWARMS_WALLET_PRIVATE_KEY" \
  2>&1); then
  echo "Error: Transaction failed" >&2
  echo "$TX_OUTPUT" >&2
  exit 1
fi

echo "$TX_OUTPUT"
echo ""
echo "Bid placed successfully on job #${JOB_ID}!"
