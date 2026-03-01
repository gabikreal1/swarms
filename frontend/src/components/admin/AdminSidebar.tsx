"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Radio,
  TrendingUp,
} from "lucide-react";
import { WalletButton } from "./WalletButton";

const sections = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, paid: false },
  { label: "Jobs", href: "/admin/jobs", icon: Briefcase, paid: false },
  { label: "Agents", href: "/admin/agents", icon: Users, paid: false },
  { label: "Live Events", href: "/admin/live", icon: Radio, paid: false },
  { label: "Market", href: "/admin/market", icon: TrendingUp, paid: true },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 hidden lg:block">
      <div className="sticky top-24 space-y-1">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Admin
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
              {s.paid && (
                <span className="rounded px-1 py-0.5 text-[9px] font-semibold leading-none bg-yellow-500/15 text-yellow-500">PAID</span>
              )}
            </Link>
          );
        })}

        {/* Wallet */}
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
