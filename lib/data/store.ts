"use client";

import { useMemo, useSyncExternalStore } from "react";
import { analyseBook } from "@/lib/analytics/portfolio";
import type { Customer } from "./types";

/**
 * The active customer book, served by the database.
 *
 * Until the live book arrives from `/api/book` — and whenever there is none —
 * the book is empty. It is never padded with sample customers: the dashboard
 * shows real data or says there is none.
 *
 * Scoring happens server-side, so what arrives here is already the computed
 * profile. The client never re-runs the models.
 */

export type BookMeta = {
  importId: number;
  fileName: string;
  source: string;
  importedAt: string;
  rowCount: number;
  assumedFields: string[];
  modelVersion: string;
  /** Real latest transaction date this import's data covers through
   *  (YYYY-MM-DD), not when the import ran. Null for imports that predate
   *  this field. */
  dataAsOf: string | null;
};

/**
 * "snapshot" means the figures are real but read-only — served from the
 * committed export capture rather than a live database. It is deliberately
 * distinct from "connected" (a database you can import into) and from
 * "unavailable" (no real figures at all).
 */
export type DatabaseStatus =
  | "unknown" | "connected" | "snapshot" | "unavailable" | "error";

type BookState = {
  status: "idle" | "loading" | "ready";
  customers: Customer[] | null;
  meta: BookMeta | null;
  database: DatabaseStatus;
};

const SERVER_STATE: BookState = {
  status: "idle",
  customers: null,
  meta: null,
  database: "unknown",
};

let state: BookState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(next: BookState) {
  state = next;
  listeners.forEach((l) => l());
}

async function load() {
  set({ ...state, status: "loading" });
  try {
    const response = await fetch("/api/book", { cache: "no-store" });
    const payload = (await response.json()) as {
      book: { customers: Customer[]; meta: BookMeta } | null;
      database: DatabaseStatus;
    };
    set({
      status: "ready",
      customers: payload.book?.customers ?? null,
      meta: payload.book?.meta ?? null,
      database: payload.database ?? "error",
    });
  } catch {
    // A failed fetch is not an error the user needs to see — it just means the
    // sample book stays in place.
    set({ status: "ready", customers: null, meta: null, database: "unavailable" });
  }
}

/** Re-fetch after an import, an activation or a delete. */
export function refreshBook(): void {
  void load();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // The first subscriber triggers the fetch. Doing it here rather than in an
  // effect keeps the store the single owner of its own loading.
  if (state.status === "idle") void load();
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

export type CustomerBook = {
  customers: Customer[];
  meta: BookMeta | null;
  /** True when real rows have arrived from the database. */
  isImported: boolean;
  isLoading: boolean;
  database: DatabaseStatus;
};

export function useCustomerBook(): CustomerBook {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(
    () => ({
      customers: snapshot.customers ?? [],
      meta: snapshot.meta,
      isImported: Boolean(snapshot.customers),
      isLoading: snapshot.status !== "ready",
      database: snapshot.database,
    }),
    [snapshot],
  );
}

/**
 * The full derived picture for the active book. Aggregation is memoised on the
 * customer array, so switching tabs does not recount several hundred rows.
 */
export function useCustomerAnalytics() {
  const { customers, meta, isImported, isLoading, database } = useCustomerBook();
  const analysis = useMemo(() => analyseBook(customers), [customers]);
  return { ...analysis, meta, isImported, isLoading, database };
}
