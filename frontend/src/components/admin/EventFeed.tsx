"use client";

import type { StreamEvent } from "@/lib/api";
import { formatAddress } from "@/lib/format";

const EVENT_CONFIG: Record<string, { label: string; className: string }> = {
  "job.posted": { label: "Job Posted", className: "bg-accent/10 text-accent" },
  "job.bid_placed": { label: "Bid Placed", className: "bg-yellow-500/10 text-yellow-500" },
  "job.bid_accepted": { label: "Bid Accepted", className: "bg-green/10 text-green" },
  "job.delivered": { label: "Delivered", className: "bg-blue-500/10 text-blue-500" },
  "job.completed": { label: "Completed", className: "bg-green/10 text-green" },
  "job.disputed": { label: "Disputed", className: "bg-red-500/10 text-red-500" },
  "market.price_shift": { label: "Price Shift", className: "bg-purple-500/10 text-purple-500" },
  "market.demand_spike": { label: "Demand Spike", className: "bg-yellow-500/10 text-yellow-500" },
};

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function summarizeEvent(event: StreamEvent): string {
  const d = event.data || {};
  switch (event.type) {
    case "job.posted":
      return `Job #${d.jobId} posted by ${formatAddress(String(d.poster || ""))}`;
    case "job.bid_placed":
      return `Bid on job #${d.jobId} by ${formatAddress(String(d.bidder || ""))} — ${d.price} USDC`;
    case "job.bid_accepted":
      return `Bid accepted on job #${d.jobId} — agent ${formatAddress(String(d.agent || ""))}`;
    case "job.delivered":
      return `Job #${d.jobId} delivery submitted`;
    case "job.completed":
      return `Job #${d.jobId} completed`;
    case "job.disputed":
      return `Dispute raised on job #${d.jobId}`;
    case "market.price_shift":
      return `Price shift for ${d.tag}: ${d.direction}`;
    case "market.demand_spike":
      return `Demand spike for ${d.tag}`;
    default:
      return `${event.type}: ${JSON.stringify(d).slice(0, 100)}`;
  }
}

interface EventFeedProps {
  events: StreamEvent[];
  filter?: Set<string>;
}

export function EventFeed({ events, filter }: EventFeedProps) {
  const filtered = filter && filter.size > 0 ? events.filter((e) => filter.has(e.type)) : events;

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted">
        Waiting for events...
      </div>
    );
  }

  return (
    <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
      {filtered.map((event, i) => {
        const config = EVENT_CONFIG[event.type] ?? { label: event.type, className: "bg-card text-muted" };
        return (
          <div key={`${event.timestamp}-${i}`} className="px-4 py-3 flex items-start gap-3 hover:bg-card-hover transition-colors">
            <span className="text-[10px] font-mono text-muted shrink-0 pt-0.5 w-20">
              {formatEventTime(event.timestamp)}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${config.className}`}>
              {config.label}
            </span>
            <span className="text-sm text-foreground">{summarizeEvent(event)}</span>
          </div>
        );
      })}
    </div>
  );
}
