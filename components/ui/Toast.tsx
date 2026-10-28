"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { toneClasses, type Tone } from "@/lib/format";

/**
 * Transient alerts for things that happen *after* render — a save that failed,
 * an export that finished, a connection that dropped. Error boundaries cannot
 * see any of these, so without this the product would silently swallow them.
 *
 * The panel is a polite live region by default and an assertive one for errors,
 * so a screen reader hears a failed save without having to go looking for it.
 * Severity is carried by an icon and a word as well as colour, never colour
 * alone, and nothing about a toast animates for attention — it slides in once,
 * short, and is dropped entirely under `prefers-reduced-motion`.
 */

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastOptions = {
  title: string;
  /** Supporting line. Say what the user can do about it, not just what broke. */
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds on screen. Pass 0 to require an explicit dismissal. */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type Toast = ToastOptions & { id: string; variant: ToastVariant; duration: number };

type ToastApi = {
  toast: (options: ToastOptions) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
};

const noop = () => "";
const ToastCtx = createContext<ToastApi>({
  toast: noop,
  success: noop,
  error: noop,
  warning: noop,
  info: noop,
  dismiss: () => {},
});

/** Errors stay until dismissed; everything else clears itself. */
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 5000,
  warning: 7000,
  error: 0,
};

const VARIANT: Record<ToastVariant, { tone: Tone; icon: typeof Info; label: string }> = {
  success: { tone: "positive", icon: CheckCircle2, label: "Success" },
  error: { tone: "negative", icon: XCircle, label: "Error" },
  warning: { tone: "warn", icon: AlertTriangle, label: "Warning" },
  info: { tone: "info", icon: Info, label: "Information" },
};

/** Toasts beyond this are dropped oldest-first — a stack of ten helps nobody. */
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((options: ToastOptions) => {
    const variant = options.variant ?? "info";
    const id = `toast-${++seq.current}`;
    const next: Toast = {
      ...options,
      id,
      variant,
      duration: options.duration ?? DEFAULT_DURATION[variant],
    };
    setToasts((current) => [...current, next].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (title, description) => push({ title, description, variant: "success" }),
      error: (title, description) => push({ title, description, variant: "error" }),
      warning: (title, description) => push({ title, description, variant: "warning" }),
      info: (title, description) => push({ title, description, variant: "info" }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/* ------------------------------------------------------------- Viewport */

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      // Not `role="region"` with a label the user must go find — the toasts
      // announce themselves and the container is otherwise inert.
      className="pointer-events-none fixed bottom-0 right-0 z-50 flex w-full max-w-[404px] flex-col gap-2.5 p-4 sm:p-6"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { tone, icon: Icon, label } = VARIANT[toast.variant];
  const t = toneClasses[tone];
  const [paused, setPaused] = useState(false);

  // Hovering or focusing a toast holds it open — a message the user is in the
  // middle of reading must never disappear out from under them.
  useEffect(() => {
    if (!toast.duration || paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration, toast.id, paused, onDismiss]);

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="toast-card pointer-events-auto relative flex gap-3.5 overflow-hidden rounded-[8px] border border-border bg-card p-4 pl-5 shadow-raised"
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${t.dot}`} aria-hidden />
      <Icon size={16} strokeWidth={2.2} className={`mt-px shrink-0 ${t.text}`} aria-hidden />

      <div className="min-w-0 flex-1">
        {/* The severity word is what a screen reader leads with, and what a
            colour-blind user reads instead of the rail. */}
        <p className="text-[13.5px] font-semibold leading-snug text-navy">
          <span className="sr-only">{label}: </span>
          {toast.title}
        </p>
        {toast.description && (
          <p className="mt-1 text-[13px] leading-relaxed text-navy-muted">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2.5 text-[12.5px] font-semibold text-accent-dark underline underline-offset-2 transition-colors hover:text-navy"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={`Dismiss: ${toast.title}`}
        className="-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-secondary hover:text-navy"
      >
        <X size={14} />
      </button>
    </div>
  );
}
