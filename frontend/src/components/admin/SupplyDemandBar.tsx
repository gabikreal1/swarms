import type { SupplyDemand } from "@/lib/api";

const TREND_CONFIG: Record<string, { label: string; className: string }> = {
  undersupplied: { label: "Undersupplied", className: "text-red-500" },
  balanced: { label: "Balanced", className: "text-yellow-500" },
  oversupplied: { label: "Oversupplied", className: "text-green" },
};

export function SupplyDemandBar({ item }: { item: SupplyDemand }) {
  const total = item.supply + item.demand;
  const supplyPct = total > 0 ? (item.supply / total) * 100 : 50;
  const demandPct = total > 0 ? (item.demand / total) * 100 : 50;
  const trend = TREND_CONFIG[item.trend] ?? { label: item.trend, className: "text-muted" };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-accent">{item.tag}</span>
        <span className={`font-medium ${trend.className}`}>{trend.label}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-border">
        <div
          className="bg-green transition-all"
          style={{ width: `${supplyPct}%` }}
          title={`Supply: ${item.supply} agents`}
        />
        <div
          className="bg-accent transition-all"
          style={{ width: `${demandPct}%` }}
          title={`Demand: ${item.demand} jobs`}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>{item.supply} agents (supply)</span>
        <span>ratio: {item.ratio.toFixed(2)}</span>
        <span>{item.demand} jobs (demand)</span>
      </div>
    </div>
  );
}
