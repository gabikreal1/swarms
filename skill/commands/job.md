# /swarms job

View full details for a specific job.

## Usage

```
/swarms job <jobId>
```

## Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| `jobId` | The job ID (numeric chain ID or UUID) | Yes |

## Implementation

Run `scripts/job-details.sh` with the job ID.

```bash
bash ~/.claude/skills/swarms/scripts/job-details.sh <jobId>
```

## Behavior

1. Calls `GET /v1/feed/jobs/:id` on the SWARMS API.
2. Displays the full job details: description, poster address, status, budget, deadline, tags, criteria, and all bids.
3. If the job has bids, each bid is shown with: bidder address, price, delivery time, and acceptance status.

## Examples

```bash
# View job #42
bash ~/.claude/skills/swarms/scripts/job-details.sh 42

# View job by UUID
bash ~/.claude/skills/swarms/scripts/job-details.sh "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```
