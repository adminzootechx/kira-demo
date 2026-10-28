"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useCustomerBook } from "@/lib/data/store";
import { useRole } from "@/components/shell/RoleContext";

/** Data older than this many days gets a warning on every page. */
const STALE_AFTER_DAYS = 3;

/**
 * One strip under the header, on every page, when the sales data has fallen
 * behind. Day counts, pace and "due" lists are all measured to the data date,
 * so the strip says which date that is. The remedy differs by role: only
 * management holds the day's passkey.
 */
export default function StaleDataNotice() {
  const { meta, isImported } = useCustomerBook();
  const { isSystem } = useRole();
  // Read once on mount; a page is not open long enough for this to drift.
  const [now] = useState(() => Date.now());

  const asOf = meta?.dataAsOf ?? null;
  if (!isImported || !asOf) return null;
  const daysBehind = Math.floor((now - Date.parse(asOf)) / 86_400_000);
  if (daysBehind <= STALE_AFTER_DAYS) return null;

  const asOfLabel = new Date(`${asOf}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: "UTC",
  });

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-warn/30 bg-warn-bg px-6 py-2.5 text-[13px] text-navy-soft lg:px-8"
    >
      <TriangleAlert size={14} strokeWidth={2.2} className="text-warn" aria-hidden />
      <span className="font-semibold text-navy">
        Sales data runs to {asOfLabel}, {daysBehind} days behind.
      </span>
      <span>
        Day counts and pace are measured to {asOfLabel}.{" "}
        {isSystem
          ? "Sign in with today's passkey to bring it up to date."
          : "Ask your manager to sign in with today's passkey to bring it up to date."}
      </span>
    </div>
  );
}
