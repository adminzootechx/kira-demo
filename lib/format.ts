/** Shared formatting helpers. All money is USD — LUSTRE trades internationally. */

export function usd(value: number, opts: { compact?: boolean } = {}): string {
  const { compact = true } = opts;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (!compact) {
    return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

/** A price per carat: whole dollars from $1,000 up, cents below that. */
export function perCarat(value: number): string {
  const digits = Math.abs(value) < 1000 ? 2 : 0;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}/ct`;
}

/** Tone used across badges, deltas and chart marks. */
export type Tone = "positive" | "negative" | "warn" | "info" | "neutral" | "accent" | "violet";

export const toneClasses: Record<Tone, { text: string; bg: string; border: string; dot: string }> = {
  positive: { text: "text-positive", bg: "bg-positive-bg", border: "border-positive/20", dot: "bg-positive" },
  negative: { text: "text-negative", bg: "bg-negative-bg", border: "border-negative/20", dot: "bg-negative" },
  warn: { text: "text-warn", bg: "bg-warn-bg", border: "border-warn/20", dot: "bg-warn" },
  info: { text: "text-info", bg: "bg-info-bg", border: "border-info/20", dot: "bg-info" },
  accent: { text: "text-accent-dark", bg: "bg-accent-bg", border: "border-accent-border", dot: "bg-accent" },
  violet: { text: "text-violet", bg: "bg-violet-bg", border: "border-violet/20", dot: "bg-violet" },
  neutral: { text: "text-muted-foreground", bg: "bg-muted", border: "border-border", dot: "bg-navy-muted" },
};
