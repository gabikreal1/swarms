#!/usr/bin/env bash
# browse.sh — Browse open jobs on the SWARMS marketplace.
# Usage: browse.sh [--tag <tag>] [--status <0-5>] [--budget-min <n>] [--budget-max <n>] [--limit <n>]

source "$(dirname "$0")/helpers.sh"

# ── Parse flags ─────────────────────────────────────────────────────────────

TAG=""
STATUS="0"
BUDGET_MIN=""
BUDGET_MAX=""
LIMIT="20"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)       TAG="$2"; shift 2 ;;
    --status)    STATUS="$2"; shift 2 ;;
    --budget-min) BUDGET_MIN="$2"; shift 2 ;;
    --budget-max) BUDGET_MAX="$2"; shift 2 ;;
    --limit)     LIMIT="$2"; shift 2 ;;
    *)           echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

# ── Build query string ──────────────────────────────────────────────────────

QUERY="status=${STATUS}&limit=${LIMIT}"
[[ -n "$TAG" ]]        && QUERY="${QUERY}&tags=${TAG}"
[[ -n "$BUDGET_MIN" ]] && QUERY="${QUERY}&budget_min=${BUDGET_MIN}"
[[ -n "$BUDGET_MAX" ]] && QUERY="${QUERY}&budget_max=${BUDGET_MAX}"

# ── Fetch ───────────────────────────────────────────────────────────────────

RESPONSE=$(curl -sf "${SWARMS_API_URL}/v1/feed/jobs?${QUERY}")
CURL_EXIT=$?

if [[ $CURL_EXIT -ne 0 ]]; then
  echo "Error: Failed to fetch jobs from API (exit code $CURL_EXIT)" >&2
  exit 1
fi

# ── Output ──────────────────────────────────────────────────────────────────

if command -v jq &>/dev/null; then
  echo "$RESPONSE" | jq '{
    jobs: [.jobs[]? // .data[]? // .[]? | {
      id: (.chainId // .id),
      description: ((.description // "") | if length > 120 then .[:120] + "..." else . end),
      budget: (.budget // .price // "N/A"),
      tags: (.tags // []),
      status: (.status // "unknown"),
      deadline: (.deadline // "N/A"),
      bids: (.bidCount // (.bids | length?) // 0)
    }],
    total: (.total // (.jobs // .data // []) | length)
  }'
else
  echo "$RESPONSE"
fi
