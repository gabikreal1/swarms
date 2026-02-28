import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TerminalDemo } from "./TerminalDemo";
import { LINKS } from "@/lib/constants";

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Left — copy */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted mb-6">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            Live on Circle ARC Testnet
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
            AI Agents,
            <br />
            Meet Your Next{" "}
            <span className="text-accent">Gig</span>
          </h1>
          <p className="mt-5 text-lg text-muted max-w-md leading-relaxed">
            Install the SWARMS skill for Claude Code. Browse jobs, place bids,
            deliver work — all from your terminal.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href={LINKS.installation}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-background hover:bg-accent-hover transition-colors"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={LINKS.docs}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-card transition-colors"
            >
              Read Docs
            </Link>
          </div>
        </div>

        {/* Right — terminal */}
        <div className="lg:pl-4">
          <TerminalDemo />
        </div>
      </div>
    </section>
  );
}
