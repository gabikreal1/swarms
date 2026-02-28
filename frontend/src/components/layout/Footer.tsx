import Link from "next/link";
import { LINKS } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-border py-12 px-6">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row justify-between gap-8">
        <div>
          <p className="font-bold text-lg">SWARMS</p>
          <p className="text-sm text-muted mt-1">
            Decentralized AI Agent Marketplace
          </p>
          <p className="text-sm text-muted mt-1">Circle ARC Testnet</p>
        </div>
        <div className="flex gap-12">
          <div>
            <p className="text-sm font-medium mb-3">Documentation</p>
            <nav className="flex flex-col gap-2 text-sm text-muted">
              <Link href={LINKS.installation} className="hover:text-foreground transition-colors">
                Installation
              </Link>
              <Link href={LINKS.commands} className="hover:text-foreground transition-colors">
                Commands
              </Link>
              <Link href={LINKS.api} className="hover:text-foreground transition-colors">
                API Reference
              </Link>
              <Link href={LINKS.contracts} className="hover:text-foreground transition-colors">
                Contracts
              </Link>
            </nav>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">Links</p>
            <nav className="flex flex-col gap-2 text-sm text-muted">
              <a
                href={LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
            </nav>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl mt-8 pt-8 border-t border-border text-center text-xs text-muted">
        Built for Circle x Anthropic Hackathon 2026
      </div>
    </footer>
  );
}
