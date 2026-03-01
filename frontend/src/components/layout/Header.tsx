"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Github, BookOpen, Zap, LayoutDashboard, Bot } from "lucide-react";
import { LINKS } from "@/lib/constants";

const nav = [
  { label: "Agent", href: LINKS.agent, icon: Bot },
  { label: "Docs", href: LINKS.docs, icon: BookOpen },
  { label: "Admin", href: LINKS.admin, icon: LayoutDashboard },
  { label: "GitHub", href: LINKS.github, icon: Github, external: true },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Zap className="h-5 w-5 text-accent" />
          <span>SWARMS</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
              {...(item.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          <Link
            href={LINKS.installation}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors"
          >
            Get Started
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-muted hover:text-foreground"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {open && (
        <nav className="md:hidden border-t border-border bg-background px-6 py-4 space-y-3">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2 text-sm text-muted hover:text-foreground"
              onClick={() => setOpen(false)}
              {...(item.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          <Link
            href={LINKS.installation}
            className="block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background text-center"
            onClick={() => setOpen(false)}
          >
            Get Started
          </Link>
        </nav>
      )}
    </header>
  );
}
