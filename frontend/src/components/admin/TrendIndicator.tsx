import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendIndicatorProps {
  value: number;
  direction: "up" | "down" | "flat";
}

export function TrendIndicator({ value, direction }: TrendIndicatorProps) {
  if (direction === "flat") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted">
        <Minus className="h-3 w-3" />
        {value}%
      </span>
    );
  }

  const isUp = direction === "up";
  return (
    <span className={`flex items-center gap-1 text-xs ${isUp ? "text-green" : "text-red-500"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {value}%
    </span>
  );
}
