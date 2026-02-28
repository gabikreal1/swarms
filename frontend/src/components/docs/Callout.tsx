import { Info, AlertTriangle } from "lucide-react";

interface CalloutProps {
  type?: "info" | "warning";
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = "info", title, children }: CalloutProps) {
  const styles = {
    info: "border-accent/30 bg-accent/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
  };

  const Icon = type === "info" ? Info : AlertTriangle;
  const iconColor = type === "info" ? "text-accent" : "text-yellow-500";

  return (
    <div className={`rounded-lg border p-4 my-4 ${styles[type]}`}>
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconColor}`} />
        <div>
          {title && <p className="font-medium mb-1">{title}</p>}
          <div className="text-sm text-muted">{children}</div>
        </div>
      </div>
    </div>
  );
}
