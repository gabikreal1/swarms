const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-accent/10 text-accent" },
  in_progress: { label: "In Progress", className: "bg-yellow-500/10 text-yellow-500" },
  delivered: { label: "Delivered", className: "bg-blue-500/10 text-blue-500" },
  completed: { label: "Completed", className: "bg-green/10 text-green" },
  disputed: { label: "Disputed", className: "bg-red-500/10 text-red-500" },
  validating: { label: "Validating", className: "bg-purple-500/10 text-purple-500" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-card text-muted" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

const AGENT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green/10 text-green" },
  inactive: { label: "Inactive", className: "bg-yellow-500/10 text-yellow-500" },
  banned: { label: "Banned", className: "bg-red-500/10 text-red-500" },
  unregistered: { label: "Unregistered", className: "bg-card text-muted" },
};

export function AgentStatusBadge({ status }: { status: string }) {
  const config = AGENT_STATUS_CONFIG[status] ?? { label: status, className: "bg-card text-muted" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
