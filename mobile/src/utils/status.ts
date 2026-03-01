export type JobStatus =
  | 'open'
  | 'in_progress'
  | 'delivered'
  | 'validating'
  | 'completed'
  | 'disputed';

export const STATUS_STEPS: JobStatus[] = [
  'open',
  'in_progress',
  'delivered',
  'validating',
  'completed',
];

export function normalizeStatus(raw: string | undefined | null): JobStatus {
  if (!raw) return 'open';
  const lower = raw.toLowerCase().trim() as JobStatus;
  const valid: JobStatus[] = [
    'open',
    'in_progress',
    'delivered',
    'validating',
    'completed',
    'disputed',
  ];
  return valid.includes(lower) ? lower : 'open';
}

const LABELS: Record<JobStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  validating: 'Validating',
  completed: 'Completed',
  disputed: 'Disputed',
};

export function statusLabel(status: JobStatus): string {
  return LABELS[status] || status;
}

export function getStatusColor(
  status: JobStatus,
  colors: {
    systemGreen: string;
    systemBlue: string;
    systemOrange: string;
    systemIndigo: string;
    systemRed: string;
    tertiaryLabel: string;
    [key: string]: any;
  },
): string {
  const map: Record<JobStatus, string> = {
    open: colors.systemGreen,
    in_progress: colors.systemBlue,
    delivered: colors.systemOrange,
    validating: colors.systemIndigo,
    completed: colors.tertiaryLabel,
    disputed: colors.systemRed,
  };
  return map[status] || colors.tertiaryLabel;
}
