"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileText, Search, User, X } from "lucide-react";
import { useCustomerBook } from "@/lib/data/store";
import { usePermissions } from "./RoleContext";
import { navigation } from "./nav";

type Hit = { id: string; kind: "Customer" | "Page"; title: string; detail: string; href: string };

const MAX_CUSTOMERS = 8;
const MAX_PAGES = 4;

/** Lower is better. Starts-with beats a word start, which beats a match anywhere. */
function score(text: string, q: string): number {
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 0;
  if (t.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) return 1;
  return t.includes(q) ? 2 : 3;
}

/**
 * Header search over the customers this person may see (the book is already
 * scoped to a rep's own customers) and the pages they can open. Nothing is
 * sent anywhere; it filters what the page already holds.
 */
export default function SearchBox({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { customers } = useCustomerBook();
  const { isSystem, permissions } = usePermissions();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [panel, setPanel] = useState(false);

  const pages = useMemo(
    () =>
      navigation
        .flatMap((g) => g.items)
        .filter((i) => isSystem || permissions[i.permissionKey])
        .map((i) => ({ title: i.label, href: i.href })),
    [isSystem, permissions],
  );

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const people = (customers ?? [])
      .map((c) => {
        const s = Math.min(score(c.name, q), score(c.country ?? "", q) + 1, isSystem ? score(c.owner ?? "", q) + 1 : 3);
        return { c, s };
      })
      .filter((x) => x.s < 3)
      .sort((a, b) => a.s - b.s || b.c.ytd - a.c.ytd)
      .slice(0, MAX_CUSTOMERS)
      .map<Hit>(({ c }) => ({
        id: `c-${c.id}`, kind: "Customer", title: c.name,
        detail: [c.country, isSystem ? c.owner : null].filter(Boolean).join(" · "),
        href: `/customers/${c.id}`,
      }));
    const places = pages
      .map((p) => ({ p, s: score(p.title, q) }))
      .filter((x) => x.s < 3)
      .sort((a, b) => a.s - b.s)
      .slice(0, MAX_PAGES)
      .map<Hit>(({ p }) => ({ id: `p-${p.href}`, kind: "Page", title: p.title, detail: "Open this page", href: p.href }));
    return [...people, ...places];
  }, [query, customers, pages, isSystem]);

  const close = () => {
    setOpen(false);
    setPanel(false);
  };

  const go = (hit: Hit) => {
    router.push(hit.href);
    setQuery("");
    close();
    (document.activeElement as HTMLElement | null)?.blur();
  };

  // Press "/" anywhere outside a text field to jump to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      // Both the full field and the compact icon are mounted; only the one on screen answers.
      if (!wrapRef.current || wrapRef.current.getClientRects().length === 0) return;
      e.preventDefault();
      if (compact) setPanel(true);
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [compact]);

  // Close on an outside click.
  useEffect(() => {
    if (!open && !panel) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, panel]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (query) setQuery("");
      else close();
      return;
    }
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[Math.min(active, hits.length - 1)]);
    }
  };

  const input = (
    <div className="relative w-full">
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        id={compact ? undefined : "global-search"}
        type="text"
        role="combobox"
        aria-expanded={open && query.trim().length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search customers and pages"
        autoComplete="off"
        placeholder="Search customers…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-full border border-transparent bg-secondary pl-10 pr-9 text-[13px] text-navy outline-none transition-colors placeholder:text-muted-foreground hover:bg-input focus:border-accent focus:bg-white"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-navy"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );

  const results = open && query.trim().length > 0 && (
    <div
      id={listId}
      role="listbox"
      aria-label="Search results"
      className={`menu-panel absolute top-[calc(100%+10px)] ${compact ? "left-0 right-0" : "right-0 w-[400px] max-w-[90vw]"} z-50 max-h-[min(70vh,420px)] overflow-y-auto rounded-[16px] border border-border bg-card p-1.5 shadow-[var(--shadow-raised)]`}
    >
      {hits.length === 0 ? (
        <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">
          No customers or pages match &quot;{query.trim()}&quot;.
        </p>
      ) : (
        hits.map((h, i) => (
          <button
            key={h.id}
            type="button"
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(h)}
            className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors ${
              i === active ? "bg-accent-bg" : ""
            }`}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-navy-muted" aria-hidden>
              {h.kind === "Customer" ? <User size={13} /> : <FileText size={13} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-navy">{h.title}</span>
              <span className="block truncate text-[11.5px] text-muted-foreground">{h.kind === "Customer" ? h.detail || "Customer" : h.detail}</span>
            </span>
            {i === active && <CornerDownLeft size={13} className="shrink-0 text-muted-foreground" aria-hidden />}
          </button>
        ))
      )}
    </div>
  );

  if (!compact) {
    return (
      <div ref={wrapRef} className="relative mr-1 hidden w-[230px] xl:block 2xl:w-[290px]">
        {input}
        {results}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="xl:hidden">
      <button
        type="button"
        aria-label="Search customers and pages"
        aria-expanded={panel}
        title="Search"
        onClick={() => {
          setPanel((p) => !p);
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="icon-btn size-9"
      >
        <Search size={17} aria-hidden />
      </button>
      {panel && (
        <div className="fixed inset-x-3 top-[84px] z-50 sm:inset-x-auto sm:right-6 sm:w-[360px]">
          <div className="rounded-[16px] border border-border bg-card p-2 shadow-[var(--shadow-raised)]">
            <div className="relative">
              {input}
              {results}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
