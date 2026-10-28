import { Badge } from "@/components/ui/primitives";
import type { CallKind } from "@/lib/analytics/portfolio";
import type { Tone } from "@/lib/format";

const TONE: Record<CallKind, Tone> = {
  "Due now": "accent",
  "Past their usual time": "warn",
  Lapsed: "negative",
  "At risk": "negative",
};

/** Where a customer stands against their usual reorder time, in words. */
export function CallBadge({ kind, daysPast }: { kind: CallKind; daysPast?: number }) {
  const label =
    kind === "Past their usual time" && daysPast && daysPast > 0
      ? `${daysPast} ${daysPast === 1 ? "day" : "days"} past usual`
      : kind;
  return <Badge tone={TONE[kind]}>{label}</Badge>;
}
