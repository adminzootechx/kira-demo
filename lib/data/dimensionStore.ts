"use client";

import { useSyncExternalStore } from "react";
import type { Dimensions } from "@/lib/db/dimensions";

/**
 * Specification, pricing, salesperson and location rollups for the active
 * import.
 *
 * Same shape as the customer book store: the server renders the sample
 * figures, the real rollups arrive from `/api/dimensions` immediately after,
 * and a page that has no import to read simply keeps the sample. Pages check
 * `isImported` so they can say which of the two they are showing rather than
 * quietly presenting demo numbers as real ones.
 */

type State = {
  status: "idle" | "loading" | "ready";
  dimensions: Dimensions | null;
  database: "unknown" | "connected" | "snapshot" | "unavailable" | "error";
};

const INITIAL: State = { status: "idle", dimensions: null, database: "unknown" };

let state: State = INITIAL;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

async function load() {
  set({ ...state, status: "loading" });
  try {
    const res = await fetch("/api/dimensions", { cache: "no-store" });
    const body = await res.json();
    set({ status: "ready", dimensions: body.dimensions ?? null, database: body.database ?? "error" });
  } catch {
    set({ status: "ready", dimensions: null, database: "unavailable" });
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (state.status === "idle") void load();
  return () => {
    listeners.delete(onChange);
  };
}

export function useDimensions() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  return {
    dimensions: snapshot.dimensions,
    isImported: Boolean(snapshot.dimensions),
    isLoading: snapshot.status !== "ready",
    database: snapshot.database,
  };
}
