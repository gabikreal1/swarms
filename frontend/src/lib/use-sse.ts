"use client";

import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "./constants";
import type { StreamEvent } from "./api";

const MAX_EVENTS = 100;

export function useEventStream() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `${API_BASE_URL}/v1/stream/jobs`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);
        const event: StreamEvent = {
          type: raw.type || "unknown",
          data: raw.data || raw,
          timestamp: raw.timestamp || new Date().toISOString(),
        };
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      } catch {
        // skip malformed
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError("Connection lost — reconnecting...");
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return { events, connected, error };
}
