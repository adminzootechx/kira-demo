"use client";

import { useSyncExternalStore } from "react";

/**
 * Import history, storage counts and snapshot movement.
 *
 * Same shape as the customer book store: an external store whose first
 * subscriber triggers the load. Fetching from an effect and copying the result
 * into state is the pattern React now warns about, and doing it here once
 * keeps every admin surface reading from one place.
 */

export type ImportRow = {
  id: number;
  fileName: string;
  source: string;
  importedAt: string;
  rowCount: number;
  skippedCount: number;
  isActive: boolean;
  assumedFields: string[] | null;
};

export type StorageStats = {
  importCount: number;
  customerRowCount: number;
  snapshotCount: number;
  scoreCount: number;
};

export type TrendRow = {
  metric: string;
  current: number;
  previous: number;
  deltaPct: number;
};

type AdminState = {
  status: "idle" | "loading" | "ready";
  imports: ImportRow[];
  stats: StorageStats | null;
  trend: TrendRow[] | null;
  database: string;
};

const INITIAL: AdminState = {
  status: "idle",
  imports: [],
  stats: null,
  trend: null,
  database: "unknown",
};

let state: AdminState = INITIAL;
const listeners = new Set<() => void>();

function set(next: AdminState) {
  state = next;
  listeners.forEach((l) => l());
}

async function load() {
  set({ ...state, status: "loading" });
  try {
    const [importsRes, trendsRes] = await Promise.all([
      fetch("/api/imports", { cache: "no-store" }),
      fetch("/api/trends", { cache: "no-store" }),
    ]);
    const importsBody = await importsRes.json();
    const trendsBody = await trendsRes.json();
    set({
      status: "ready",
      imports: importsBody.imports ?? [],
      stats: importsBody.stats ?? null,
      trend: trendsBody.trend ?? null,
      database: importsBody.database ?? "error",
    });
  } catch {
    set({ ...INITIAL, status: "ready", database: "unavailable" });
  }
}

export function refreshImports(): void {
  void load();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (state.status === "idle") void load();
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => INITIAL;

export function useImportAdmin(): AdminState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
