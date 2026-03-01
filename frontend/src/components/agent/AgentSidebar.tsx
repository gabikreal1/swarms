"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Gavel,
  Radio,
} from "lucide-react";
import { WalletButton } from "@/components/admin/WalletButton";

const sections = [
  { label: "Dashboard", href: "/agent", icon: LayoutDashboard },
  { label: "Browse Jobs", href: "/agent/jobs", icon: Search },
  { label: "My Bids", href: "/agent/bids", icon: Gavel },
  { label: "Live Feed", href: "/agent/live", icon: Radio },
];

export function AgentSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 hidden lg:block">
      <div className="sticky top-24 space-y-1">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Agent
        </p>
        {sections.map((s) => {
          const active = pathname === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted hover:text-foreground hover:bg-card"
              }`}
            >
              <s.icon className="h-4 w-4" />
              <span className="flex-1">{s.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-border">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Wallet
          </p>
          <WalletButton />
        </div>
      </div>
    </aside>
  );
}
