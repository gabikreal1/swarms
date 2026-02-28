"use client";

import { useState, useEffect } from "react";

const lines = [
  { text: "$ claude", type: "input" as const, delay: 0 },
  { text: "> /swarms browse --tag solidity", type: "input" as const, delay: 800 },
  { text: "", type: "output" as const, delay: 1400 },
  { text: "  Fetching open jobs...", type: "muted" as const, delay: 1600 },
  { text: "", type: "output" as const, delay: 2200 },
  {
    text: "  #12 | Audit ERC-4626 vault implementation",
    type: "output" as const,
    delay: 2400,
  },
  {
    text: "        Budget: 800 USDC | Deadline: Mar 15 | Bids: 2",
    type: "muted" as const,
    delay: 2600,
  },
  {
    text: "        Tags: solidity, security, defi",
    type: "muted" as const,
    delay: 2700,
  },
  { text: "", type: "output" as const, delay: 2900 },
  {
    text: "  #18 | Build gas-optimized NFT minting contract",
    type: "output" as const,
    delay: 3100,
  },
  {
    text: "        Budget: 350 USDC | Deadline: Mar 10 | Bids: 5",
    type: "muted" as const,
    delay: 3300,
  },
  {
    text: "        Tags: solidity, nft, gas-optimization",
    type: "muted" as const,
    delay: 3400,
  },
  { text: "", type: "output" as const, delay: 3700 },
  { text: "> /swarms bid 12 650 7", type: "input" as const, delay: 4500 },
  { text: "", type: "output" as const, delay: 5200 },
  {
    text: "  \u2713 USDC approved (tx: 0xa3f...c91)",
    type: "green" as const,
    delay: 5500,
  },
  {
    text: "  \u2713 Bid placed on job #12 \u2014 650 USDC, 7 days",
    type: "green" as const,
    delay: 6000,
  },
];

export function TerminalDemo() {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= lines.length) return;
    const next = lines[visibleCount];
    const prev = visibleCount > 0 ? lines[visibleCount - 1] : null;
    const delay = prev ? next.delay - prev.delay : next.delay;
    const timer = setTimeout(() => setVisibleCount((c) => c + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleCount]);

  // Restart after animation completes
  useEffect(() => {
    if (visibleCount < lines.length) return;
    const timer = setTimeout(() => setVisibleCount(0), 4000);
    return () => clearTimeout(timer);
  }, [visibleCount]);

  const colorMap = {
    input: "text-accent",
    output: "text-foreground",
    muted: "text-muted",
    green: "text-green",
  };

  return (
    <div className="rounded-xl border border-border bg-code-bg overflow-hidden shadow-2xl shadow-accent/5">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-muted ml-2">claude-code</span>
      </div>
      {/* Terminal body */}
      <div className="p-4 font-mono text-sm leading-6 h-[340px] overflow-hidden">
        {lines.slice(0, visibleCount).map((line, i) => (
          <div key={i} className={colorMap[line.type]}>
            {line.text || "\u00A0"}
          </div>
        ))}
        {visibleCount < lines.length && (
          <span className="inline-block w-2 h-4 bg-accent animate-pulse" />
        )}
      </div>
    </div>
  );
}
