#!/usr/bin/env bash
# submit-delivery.sh — Submit delivery proof for a job.
# Usage: submit-delivery.sh <jobId> <proofHash>

source "$(dirname "$0")/helpers.sh"

require_cast
require_private_key

if [[ $# -lt 2 ]]; then
  echo "Usage: submit-delivery.sh <jobId> <proofHash>" >&2
  exit 1
fi

JOB_ID="$1"
PROOF_HASH="$2"

# ── Validate inputs ─────────────────────────────────────────────────────────

if ! [[ "$JOB_ID" =~ ^[0-9]+$ ]]; then
  echo "Error: jobId must be a number, got '$JOB_ID'" >&2
  exit 1
fi

if ! [[ "$PROOF_HASH" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "Error: proofHash must be a 66-character hex string (0x + 64 hex chars), got '$PROOF_HASH'" >&2
  exit 1
fi

# ── Submit delivery ─────────────────────────────────────────────────────────

echo "Submitting delivery for job #${JOB_ID}..."
echo "Proof hash: $PROOF_HASH"

if ! TX_OUTPUT=$(cast send "$ORDER_BOOK" \
  "submitDelivery(uint256,bytes32)" \
  "$JOB_ID" "$PROOF_HASH" \
  --rpc-url "$SWARMS_RPC_URL" \
  --private-key "$SWARMS_WALLET_PRIVATE_KEY" \
  2>&1); then
  echo "Error: Transaction failed" >&2
  echo "$TX_OUTPUT" >&2
  exit 1
fi

echo "$TX_OUTPUT"
echo ""
echo "Delivery submitted for job #${JOB_ID}! Waiting for poster approval."
