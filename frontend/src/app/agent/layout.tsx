"use client";

import { AgentSidebar } from "@/components/agent/AgentSidebar";
import { WalletProvider } from "@/lib/wallet-context";

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <div className="pt-24 pb-20 px-6">
        <div className="mx-auto max-w-7xl flex gap-10">
          <AgentSidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </WalletProvider>
  );
}
