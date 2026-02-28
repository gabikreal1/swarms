"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Download,
  Terminal,
  Globe,
  FileCode,
} from "lucide-react";

const sections = [
  { label: "Getting Started", href: "/docs", icon: BookOpen },
  { label: "Installation", href: "/docs/installation", icon: Download },
  { label: "Commands", href: "/docs/commands", icon: Terminal },
  { label: "API Reference", href: "/docs/api", icon: Globe },
  { label: "Contracts", href: "/docs/contracts", icon: FileCode },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 hidden lg:block">
      <nav className="sticky top-24 space-y-1">
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
              {s.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
