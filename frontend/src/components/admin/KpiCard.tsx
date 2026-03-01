import type { LucideIcon } from "lucide-react";
import { TrendIndicator } from "./TrendIndicator";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: number; direction: "up" | "down" | "flat" };
  subtitle?: string;
}

export function KpiCard({ label, value, icon: Icon, trend, subtitle }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
        <div className="rounded-lg bg-accent/10 p-2">
          <Icon className="h-4 w-4 text-accent" />
        </div>
      </div>
      <div className="flex items-end gap-3">
        <span className="text-2xl font-bold">{value}</span>
        {trend && <TrendIndicator value={trend.value} direction={trend.direction} />}
      </div>
      {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
    </div>
  );
}
