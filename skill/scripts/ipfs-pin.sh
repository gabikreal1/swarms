#!/usr/bin/env bash
# ipfs-pin.sh — Pin JSON metadata to IPFS via the SWARMS API (SIWE auth).
# Usage: ipfs-pin.sh <json-string> [name]
# Returns the IPFS URI (ipfs://Qm...) on stdout.

source "$(dirname "$0")/helpers.sh"

require_cast
require_private_key

if [[ $# -lt 1 ]]; then
  echo "Usage: ipfs-pin.sh '<json-string>' [name]" >&2
  exit 1
fi

JSON_CONTENT="$1"
PIN_NAME="${2:-swarms-bid-$(date +%s)}"

WALLET=$(get_wallet_address)

# ── Step 1: Get nonce ───────────────────────────────────────────────────────

NONCE_RESP=$(curl -sf -X POST "${SWARMS_API_URL}/v1/auth/nonce")
if [[ $? -ne 0 ]] || [[ -z "$NONCE_RESP" ]]; then
  echo "Error: Failed to get auth nonce from API" >&2
  exit 1
fi

NONCE=$(echo "$NONCE_RESP" | json_field '.nonce')
if [[ -z "$NONCE" ]] || [[ "$NONCE" == "null" ]]; then
  echo "Error: Could not parse nonce from response: $NONCE_RESP" >&2
  exit 1
fi

# ── Step 2: Build & sign SIWE message ──────────────────────────────────────

ISSUED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DOMAIN="swarms-skill"
URI="https://swarms.ai"
CHAIN_ID="5042002"

# EIP-4361 SIWE message format
SIWE_MESSAGE="${DOMAIN} wants you to sign in with your Ethereum account:
${WALLET}

Sign in to SWARMS

URI: ${URI}
Version: 1
Chain ID: ${CHAIN_ID}
Nonce: ${NONCE}
Issued At: ${ISSUED_AT}"

SIGNATURE=$(cast wallet sign --private-key "$SWARMS_WALLET_PRIVATE_KEY" "$SIWE_MESSAGE" 2>&1)
if [[ $? -ne 0 ]]; then
  echo "Error: Failed to sign SIWE message" >&2
  echo "$SIGNATURE" >&2
  exit 1
fi

# ── Step 3: Login ──────────────────────────────────────────────────────────

LOGIN_BODY=$(jq -n --arg msg "$SIWE_MESSAGE" --arg sig "$SIGNATURE" \
  '{message: $msg, signature: $sig}')

LOGIN_RESP=$(curl -sf -X POST "${SWARMS_API_URL}/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY")

if [[ $? -ne 0 ]] || [[ -z "$LOGIN_RESP" ]]; then
  echo "Error: Login failed" >&2
  exit 1
fi

TOKEN=$(echo "$LOGIN_RESP" | json_field '.token')
if [[ -z "$TOKEN" ]] || [[ "$TOKEN" == "null" ]]; then
  echo "Error: Could not parse token from login response: $LOGIN_RESP" >&2
  exit 1
fi

# ── Step 4: Pin to IPFS ────────────────────────────────────────────────────

PIN_BODY=$(jq -n --argjson content "$JSON_CONTENT" --arg name "$PIN_NAME" \
  '{content: $content, name: $name}')

PIN_RESP=$(curl -sf -X POST "${SWARMS_API_URL}/v1/ipfs/pin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "$PIN_BODY")

if [[ $? -ne 0 ]] || [[ -z "$PIN_RESP" ]]; then
  echo "Error: IPFS pinning failed" >&2
  exit 1
fi

IPFS_URI=$(echo "$PIN_RESP" | json_field '.uri')
if [[ -z "$IPFS_URI" ]] || [[ "$IPFS_URI" == "null" ]]; then
  echo "Error: Could not parse IPFS URI from response: $PIN_RESP" >&2
  exit 1
fi

# Output just the URI — caller captures this
echo "$IPFS_URI"
