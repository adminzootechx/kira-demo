"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * The "?" affordance beside a section title.
 *
 * Opens on hover and on focus, and toggles on click so it works on touch. The
 * panel is described rather than merely labelled, so a screen reader announces
 * the explanation instead of just the word "help".
 */
export default function HelpTip({
  title,
  children,
  align = "start",
}: {
  /** What the section is called, repeated so the tip stands alone. */
  title?: string;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  // A pinned tip stays until dismissed — click outside or Escape.
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  const visible = open || pinned;

  return (
    <span ref={wrapRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={title ? `About ${title}` : "About this section"}
        aria-expanded={visible}
        aria-describedby={visible ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        onClick={(e) => {
          // The tip can sit inside a card that is itself a link; opening it must not navigate.
          e.preventDefault();
          e.stopPropagation();
          setPinned((p) => !p);
        }}
        className="relative inline-flex size-[18px] items-center justify-center rounded-full text-muted-foreground transition-colors before:absolute before:-inset-3 before:content-[''] hover:text-navy"
      >
        <HelpCircle size={14} aria-hidden />
      </button>

      {visible && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-[calc(100%+8px)] z-30 w-[288px] rounded-[8px] border border-border bg-card p-3.5 text-left shadow-[var(--shadow-raised)] ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {title && (
            <span className="mb-1.5 block text-[12.5px] font-semibold text-navy">{title}</span>
          )}
          <span className="block text-[12.5px] leading-relaxed text-navy-muted">{children}</span>
        </span>
      )}
    </span>
  );
}
