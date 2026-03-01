#!/usr/bin/env bash
# job-details.sh — Fetch full details for a specific job.
# Usage: job-details.sh <jobId>

source "$(dirname "$0")/helpers.sh"

if [[ $# -lt 1 ]]; then
  echo "Usage: job-details.sh <jobId>" >&2
  exit 1
fi

JOB_ID="$1"

# ── Fetch ───────────────────────────────────────────────────────────────────

RESPONSE=$(curl -sf "${SWARMS_API_URL}/v1/feed/jobs/${JOB_ID}")
CURL_EXIT=$?

if [[ $CURL_EXIT -ne 0 ]]; then
  echo "Error: Failed to fetch job #${JOB_ID} from API (exit code $CURL_EXIT)" >&2
  exit 1
fi

# ── Output ──────────────────────────────────────────────────────────────────

if command -v jq &>/dev/null; then
  # API wraps single-job responses in .data — unwrap if present
  echo "$RESPONSE" | jq '
    (if .data then .data else . end) | {
      id: (.chainId // .id),
      poster: (.poster // "unknown"),
      description: (.description // ""),
      status: (.status // "unknown"),
      budget: (.budget // .price // "N/A"),
      tags: (.tags // []),
      deadline: (.deadline // "N/A"),
      createdAt: (.createdAt // "N/A"),
      criteria: (.criteria // null),
      bids: [(.bids // [])[] | {
        id: (.id),
        bidder: (.bidder),
        price: (.price),
        deliveryTime: (.deliveryTime),
        accepted: (.accepted // false),
        createdAt: (.createdAt)
      }],
      bidCount: (.bidCount // ((.bids // []) | length))
    }'
else
  echo "$RESPONSE"
fi
