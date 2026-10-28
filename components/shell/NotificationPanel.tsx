"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRight, CheckCheck, CircleAlert, Radar, TrendingDown, TrendingUp, X,
} from "lucide-react";
import { useCustomerAnalytics } from "@/lib/data/store";
import { useRole } from "./RoleContext";
import { toneClasses, usd, type Tone } from "@/lib/format";
import { ACTIVE_WINDOW_DAYS, ELEVATED_CHURN } from "@/lib/analytics/portfolio";
import { clientKey } from "@/lib/clientKey";

/* ------------------------------------------------------------------ */
/* Feed                                                                */
/* ------------------------------------------------------------------ */

export type Notification = {
  id: string;
  group: "Reorders" | "At risk";
  title: string;
  detail: string;
  tone: Tone;
  /** Plain-language recency, from the account's own last-order date. */
  when: string;
  owner: string;
  href: string;
  cta: string;
};

/** Rows per group — a tray is a nudge, the full lists live on My day and Customers. */
const PER_GROUP = 5;

/**
 * Built only from the customer book the server sends, which is already limited
 * to the signed-in salesperson's own customers (management gets everyone):
 * customers due or past their usual reorder time, and customers slipping. Nothing here is a stored or
 * sample record — it is recomputed from the same data the Home page reads.
 */
function useNotificationFeed(): Notification[] {
  const { isImported, reorderDue, customers } = useCustomerAnalytics();
  return useMemo(() => {
    if (!isImported) return [];
    const reorders: Notification[] = reorderDue
      .filter((c) => c.kind === "Due now" || c.kind === "Past their usual time")
      .slice(0, PER_GROUP)
      .map((c) => ({
        // The id names the event, so a new order or a change of status is a new alert.
        id: `reorder:${clientKey(c.name)}:${c.lastPurchase}:${c.kind}`,
        group: "Reorders",
        title: c.kind === "Due now" ? `${c.name} is due to reorder` : `${c.name} is past their usual reorder time`,
        detail: `Last ordered ${c.daysSince} days ago; they usually order every ${c.window}.`,
        tone: c.kind === "Past their usual time" ? "warn" : "accent",
        when: `${c.daysSince} days since last order`,
        owner: c.owner,
        href: `/customers/${c.id}`,
        cta: "View customer",
      }));
    // Same count as Home's "At risk of leaving": still buying, but slipping
    // sharply. Anyone already listed under Reorders is not repeated.
    const shown = new Set(reorders.map((n) => n.href));
    const risks: Notification[] = customers
      .filter((c) => !c.pausedUntil && c.churnRisk >= ELEVATED_CHURN && c.daysSince <= ACTIVE_WINDOW_DAYS && !shown.has(`/customers/${c.id}`))
      .sort((a, b) => b.lastYear - b.ytd - (a.lastYear - a.ytd))
      .slice(0, PER_GROUP)
      .map((c) => ({
        id: `risk:${clientKey(c.name)}:${c.lastPurchase}`,
        group: "At risk",
        title: `${c.name} may be drifting away`,
        detail: `Bought ${usd(c.lastYear)} in the 12 months before, ${usd(c.ytd)} in the last 12. Last order ${c.daysSince} days ago.`,
        tone: "negative",
        when: `${c.daysSince} days since last order`,
        owner: c.owner,
        href: `/customers/${c.id}`,
        cta: "View customer",
      }));
    return [...reorders, ...risks];
  }, [isImported, reorderDue, customers]);
}

const toneIcon: Record<string, React.ReactNode> = {
  negative: <TrendingDown size={16} />,
  warn: <CircleAlert size={16} />,
  positive: <TrendingUp size={16} />,
  info: <Radar size={16} />,
};

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export default function NotificationPanel({
  open,
  onClose,
  readIds,
  onRead,
  onReadAll,
  returnFocusTo,
}: {
  open: boolean;
  onClose: () => void;
  readIds: Set<string>;
  onRead: (id: string) => void;
  onReadAll: () => void;
  returnFocusTo: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const notifications = useNotificationFeed();
  const { isSystem } = useRole();

  // Escape closes; Tab is kept inside the dialog while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Freeze the page behind the drawer. `main` is the scroll container here,
  // not the body, so that is what has to be locked.
  useEffect(() => {
    if (!open) return;
    const scroller = document.getElementById("main-content");
    const previous = scroller?.style.overflow;
    if (scroller) scroller.style.overflow = "hidden";
    return () => {
      if (scroller) scroller.style.overflow = previous ?? "";
    };
  }, [open]);

  // Move focus in on open, and hand it back to the bell on close — but only
  // after a real open, so nothing steals focus on first paint.
  const restore = returnFocusTo;
  const hasOpened = useRef(false);
  useEffect(() => {
    if (open) {
      hasOpened.current = true;
      closeRef.current?.focus();
    } else if (hasOpened.current) {
      restore.current?.focus();
    }
  }, [open, restore]);

  const groups = useMemo(
    () =>
      (["Reorders", "At risk"] as const).map((group) => ({
        group,
        items: notifications.filter((n) => n.group === group),
      })),
    [notifications],
  );

  const unread = notifications.filter((n) => !readIds.has(n.id)).length;

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Scrim — a plain navy wash, no blur */}
      <button
        aria-label="Close notifications"
        tabIndex={-1}
        onClick={onClose}
        className="drawer-scrim absolute inset-0 h-full w-full cursor-default bg-navy/25"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-panel-title"
        className="drawer-panel absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-border bg-card shadow-[var(--shadow-raised)]"
      >
        {/* Header ------------------------------------------------- */}
        <div className="flex h-[72px] shrink-0 items-center gap-4 border-b border-border px-5">
          <div className="min-w-0 flex-1">
            <h2
              id="notification-panel-title"
              className="display text-[17px] font-bold leading-tight text-navy"
            >
              Notifications
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {unread} unread of {notifications.length}
            </p>
          </div>
          {unread > 0 && (
            <button onClick={onReadAll} className="btn btn-ghost text-[12px]">
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
          <button ref={closeRef} onClick={onClose} className="icon-btn" aria-label="Close notifications">
            <X size={17} />
          </button>
        </div>

        {/* Feed --------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {notifications.length === 0 && (
            <p className="px-5 py-10 text-center text-[13px] leading-relaxed text-muted-foreground">
              Nothing needs your attention right now.
            </p>
          )}
          {groups.filter(({ items }) => items.length > 0).map(({ group, items }) => (
            <section key={group}>
              <h3 className="sticky top-0 z-10 border-b border-border bg-secondary px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-navy-muted">
                {group}
                <span className="ml-2 font-semibold tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </h3>

              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const isUnread = !readIds.has(n.id);
                  return (
                    <li key={n.id} className="relative">
                      {/* Unread is carried by a rail and a weight change, not
                          by colour alone. */}
                      {isUnread && (
                        <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden />
                      )}
                      <div className={`px-5 py-4 ${isUnread ? "bg-accent-bg/40" : ""}`}>
                        <div className="flex gap-3">
                          <span className={`mt-0.5 shrink-0 ${toneClasses[n.tone].text}`} aria-hidden>
                            {toneIcon[n.tone] ?? toneIcon.info}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <h4
                                className={`text-[14px] leading-snug text-navy ${
                                  isUnread ? "font-bold" : "font-medium"
                                }`}
                              >
                                {n.title}
                                {isUnread && <span className="sr-only"> (unread)</span>}
                              </h4>
                              <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11.5px] text-muted-foreground">
                                {n.when}
                              </span>
                            </div>

                            <p className="mt-1.5 text-[13px] leading-relaxed text-navy-muted">
                              {n.detail}
                            </p>

                            {isSystem && (
                              <div className="mt-2.5 text-[11.5px] text-muted-foreground">
                                Owner <span className="font-semibold text-navy">{n.owner}</span>
                              </div>
                            )}

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                              <Link
                                href={n.href}
                                onClick={() => {
                                  onRead(n.id);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1.5 rounded-[4px] text-[12.5px] font-semibold text-accent-dark transition-colors hover:text-navy"
                              >
                                {n.cta}
                                <ArrowRight size={13} />
                              </Link>
                              {isUnread && (
                                <button
                                  onClick={() => onRead(n.id)}
                                  className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-navy"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer ------------------------------------------------- */}
        <div className="flex shrink-0 items-center gap-3 border-t border-border px-5 py-3.5">
          <Link href="/customers" onClick={onClose} className="btn btn-secondary flex-1">
            Customers
          </Link>
          <Link href="/priorities" onClick={onClose} className="btn btn-secondary flex-1">
            My day
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Seen and read state, saved per user so it survives reloads and new logins.
 * "Seen" means the bell was opened while the alert was listed; the badge counts
 * only alerts not yet seen. "Read" means it was opened or marked read, and
 * drives the bold styling inside the panel.
 */
export function useNotificationState() {
  const notifications = useNotificationFeed();
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { seen: string[]; read: string[] } | null) => {
        if (cancelled || !b) return;
        setSeenIds(new Set(b.seen));
        setReadIds(new Set(b.read));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback((ids: string[], read: boolean) => {
    if (!ids.length) return;
    void fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, read }),
    }).catch(() => {});
  }, []);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => new Set(prev).add(id));
      setSeenIds((prev) => new Set(prev).add(id));
      save([id], true);
    },
    [save],
  );
  const markAllRead = useCallback(() => {
    const ids = notifications.map((n) => n.id);
    setReadIds((prev) => new Set([...prev, ...ids]));
    setSeenIds((prev) => new Set([...prev, ...ids]));
    save(ids, true);
  }, [notifications, save]);
  const markSeen = useCallback(() => {
    const ids = notifications.map((n) => n.id).filter((id) => !seenIds.has(id));
    if (!ids.length) return;
    setSeenIds((prev) => new Set([...prev, ...ids]));
    save(ids, false);
  }, [notifications, seenIds, save]);

  // Badge and panel count the same thing: alerts not yet opened or marked read.
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  return { readIds, markRead, markAllRead, markSeen, unread: unreadCount };
}
