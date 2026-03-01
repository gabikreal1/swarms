#!/usr/bin/env bash
# submit-delivery.sh — Submit delivery proof for a job.
# Usage: submit-delivery.sh <jobId> <proofHash> [evidenceURI]
#
# If evidenceURI is provided, uses submitDeliveryWithEvidence (stores the URI
# on-chain so the frontend can display/link to the actual deliverable).
# Otherwise falls back to the simple submitDelivery.

source "$(dirname "$0")/helpers.sh"

require_cast
require_private_key

if [[ $# -lt 2 ]]; then
  echo "Usage: submit-delivery.sh <jobId> <proofHash> [evidenceURI]" >&2
  exit 1
fi

JOB_ID="$1"
PROOF_HASH="$2"
EVIDENCE_URI="${3:-}"

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

if [[ -n "$EVIDENCE_URI" ]]; then
  echo "Evidence URI: $EVIDENCE_URI"
  echo "Using submitDeliveryWithEvidence..."

  # evidenceMerkleRoot — use the proofHash as the merkle root (single-leaf tree)
  MERKLE_ROOT="$PROOF_HASH"

  if ! TX_OUTPUT=$(cast send "$ORDER_BOOK" \
    "submitDeliveryWithEvidence(uint256,bytes32,bytes32,string)" \
    "$JOB_ID" "$PROOF_HASH" "$MERKLE_ROOT" "$EVIDENCE_URI" \
    --rpc-url "$SWARMS_RPC_URL" \
    --private-key "$SWARMS_WALLET_PRIVATE_KEY" \
    2>&1); then
    echo "Error: Transaction failed" >&2
    echo "$TX_OUTPUT" >&2
    exit 1
  fi
else
  echo "No evidence URI provided, using simple submitDelivery..."

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
fi

echo "$TX_OUTPUT"
echo ""
echo "Delivery submitted for job #${JOB_ID}! Waiting for poster approval."
