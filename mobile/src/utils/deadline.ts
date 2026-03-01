export function parseDeadline(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') {
    // Seconds (unix timestamp) vs milliseconds heuristic
    if (raw > 1e9 && raw < 1e12) return new Date(raw * 1000);
    if (raw >= 1e12) return new Date(raw);
    return null;
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDeadline(raw: unknown): string {
  const d = parseDeadline(raw);
  return d ? d.toLocaleDateString() : 'None';
}
