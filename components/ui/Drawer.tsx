"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * The generic slide-over panel, extracted from the notification drawer's own
 * accessibility handling (focus trap, Escape, scroll lock, focus restore) so
 * a second consumer — the admin edit panels — doesn't have to reimplement it.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  actions,
  width = 480,
  padded = true,
  returnFocusTo,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Small accent badge before the title — same visual language as
   *  `CardHeader`'s `icon` prop. Omit for a plain text title (the admin
   *  edit panel's own name/email header has no icon to show). */
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  width?: number;
  /** False lets a child that already manages its own internal padding (a
   *  chat transcript with its own composer, say) sit flush against the
   *  panel edges instead of padding twice. */
  padded?: boolean;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  // Move focus in on open, and hand it back to the trigger on close — but
  // only after a real open, so nothing steals focus on first paint.
  const hasOpened = useRef(false);
  useEffect(() => {
    if (open) {
      hasOpened.current = true;
      closeRef.current?.focus();
    } else if (hasOpened.current) {
      returnFocusTo?.current?.focus();
    }
  }, [open, returnFocusTo]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        aria-label={`Close ${title}`}
        tabIndex={-1}
        onClick={onClose}
        className="drawer-scrim absolute inset-0 h-full w-full cursor-default bg-navy/25"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="drawer-panel absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-card shadow-[var(--shadow-raised)]"
        style={{ maxWidth: width }}
      >
        <div className="flex shrink-0 items-start gap-3.5 border-b border-border px-6 py-5">
          {icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent-border bg-accent-bg text-accent-dark">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="drawer-title" className="display text-[17px] font-bold leading-tight text-navy">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
          <button ref={closeRef} onClick={onClose} className="icon-btn" aria-label="Close panel">
            <X size={17} />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto overscroll-contain ${padded ? "px-6 py-5" : ""}`}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
