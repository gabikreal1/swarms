"use client";

import { useState } from "react";
import { Radio } from "lucide-react";
import { useEventStream } from "@/lib/use-sse";
import { EventFeed } from "@/components/admin/EventFeed";

const EVENT_TYPES = [
  { type: "job.posted", label: "Posted" },
  { type: "job.bid_placed", label: "Bids" },
  { type: "job.bid_accepted", label: "Accepted" },
  { type: "job.delivered", label: "Delivered" },
  { type: "job.completed", label: "Completed" },
  { type: "job.disputed", label: "Disputed" },
];

export default function AdminLive() {
  const { events, connected, error } = useEventStream();
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  function toggleFilter(type: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Events</h1>
          <p className="text-sm text-muted mt-1">Real-time marketplace activity stream</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green animate-pulse" : "bg-red-500"}`} />
          <span className="text-xs text-muted">{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-500">
          {error}
        </div>
      )}

      {/* Event type filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted mr-1">Filter:</span>
        {EVENT_TYPES.map((et) => {
          const active = activeFilters.has(et.type);
          return (
            <button
              key={et.type}
              onClick={() => toggleFilter(et.type)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-card text-muted border border-border hover:text-foreground"
              }`}
            >
              {et.label}
            </button>
          );
        })}
        {activeFilters.size > 0 && (
          <button
            onClick={() => setActiveFilters(new Set())}
            className="text-xs text-muted hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-muted">
        <span>{events.length} events received</span>
        <span className="text-border">|</span>
        <span>Buffer: max 100</span>
      </div>

      {/* Event Stream */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Radio className={`h-4 w-4 ${connected ? "text-green" : "text-red-500"}`} />
          <span className="text-sm font-medium">Event Stream</span>
        </div>
        <EventFeed events={events} filter={activeFilters.size > 0 ? activeFilters : undefined} />
      </div>
    </div>
  );
}
