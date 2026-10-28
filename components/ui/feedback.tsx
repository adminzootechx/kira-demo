"use client";

import { AlertTriangle, CheckCircle2, Info, SearchX, X, XCircle } from "lucide-react";
import { toneClasses, type Tone } from "@/lib/format";

/**
 * In-page feedback: banners that stay put, and the states a data panel can be
 * in other than "full of data". Toasts cover things that happen to the user;
 * these cover things that are true about what they are looking at.
 *
 * Every one of them names the condition in words and shows a glyph, so none of
 * them depends on colour to be understood, and each offers the next step —
 * a retry, a filter reset, a route — rather than dead-ending.
 */

/* ---------------------------------------------------------------- Alert */

export type AlertVariant = "error" | "warning" | "success" | "info";

const ALERT: Record<AlertVariant, { tone: Tone; icon: typeof Info; label: string }> = {
  error: { tone: "negative", icon: XCircle, label: "Error" },
  warning: { tone: "warn", icon: AlertTriangle, label: "Warning" },
  success: { tone: "positive", icon: CheckCircle2, label: "Success" },
  info: { tone: "info", icon: Info, label: "Information" },
};

/**
 * A persistent banner. Use it for a condition the user is looking at — stale
 * data, a partial load, a failed save that is still recoverable — not for
 * something that just happened, which is a toast.
 */
export function Alert({
  variant = "info",
  title,
  children,
  action,
  onDismiss,
  className = "",
}: {
  variant?: AlertVariant;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  /** Omit to make the banner permanent — the right default for real failures. */
  onDismiss?: () => void;
  className?: string;
}) {
  const { tone, icon: Icon, label } = ALERT[variant];
  const t = toneClasses[tone];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex gap-3.5 rounded-[8px] border p-4 ${t.bg} ${t.border} ${className}`}
    >
      <Icon size={16} strokeWidth={2.2} className={`mt-px shrink-0 ${t.text}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={`text-[13.5px] font-semibold leading-snug ${t.text}`}>
          <span className="sr-only">{label}: </span>
          {title}
        </p>
        {children && (
          <div className="mt-1.5 text-[13px] leading-relaxed text-navy-soft">{children}</div>
        )}
        {action && <div className="mt-3 flex flex-wrap items-center gap-2.5">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss: ${title}`}
          className="-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-card hover:text-navy"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Panel states */

/**
 * A panel that legitimately has nothing to show. It says why it is empty and
 * what would fill it — an empty exceptions table is good news, and should not
 * look identical to one that failed to load.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "px-6 py-10" : "px-6 py-16"
      }`}
    >
      <span className="text-muted-foreground" aria-hidden>
        {icon ?? <SearchX size={22} strokeWidth={1.8} />}
      </span>
      <p className="mt-3.5 text-[14.5px] font-semibold text-navy">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- Skeletons */

/** A neutral placeholder block. Sized by the caller so it matches what lands. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-[4px] bg-muted ${className}`} aria-hidden />;
}
