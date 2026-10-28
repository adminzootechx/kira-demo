"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { clientKey } from "@/lib/clientKey";
import type { AssignmentsResponse } from "@/app/api/admin/assignments/route";

/**
 * Admin-only: who handles this customer. Reassigning moves the customer out of
 * one salesperson's book, so it takes a deliberate step — pick a name, read
 * who gains and who loses the customer, confirm — and can be undone from the
 * confirmation toast.
 */
export default function AssignRep({ name, owner }: { name: string; owner: string }) {
  const [reps, setReps] = useState<string[]>([]);
  const [current, setCurrent] = useState(owner);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { error, toast } = useToast();
  const listId = useId();

  useEffect(() => {
    fetch("/api/admin/assignments?repsOnly=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: AssignmentsResponse) => setReps(b.reps ?? []))
      .catch(() => {});
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reps.filter((r) => r !== current && (!q || r.toLowerCase().includes(q))).slice(0, 8);
  }, [reps, query, current]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setPick(null);
  };

  const save = async (to: string): Promise<boolean> => {
    const res = await fetch("/api/admin/assignments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: [clientKey(name)], owner: to }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not change who handles this customer", body.error ?? "Try again.");
      return false;
    }
    return true;
  };

  const confirmMove = async () => {
    if (!pick || busy) return;
    const from = current;
    const to = pick;
    setBusy(true);
    const ok = await save(to);
    setBusy(false);
    if (!ok) return;
    setCurrent(to);
    close();
    toast({
      variant: "success",
      title: `${name} is now handled by ${to}`,
      description: `${from} no longer sees this customer.`,
      action: {
        label: "Undo",
        onClick: async () => {
          if (await save(from)) setCurrent(from);
        },
      },
    });
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <span>
          Handled by <span className="font-semibold text-navy">{current}</span>
        </span>
        <button type="button" className="btn btn-ghost text-[12.5px]" onClick={() => setOpen(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-[12px] border border-border bg-card p-3">
      {pick ? (
        <div className="space-y-3">
          <p className="text-[13.5px] leading-relaxed text-navy">
            Move <span className="font-semibold">{name}</span> from{" "}
            <span className="font-semibold">{current}</span> to <span className="font-semibold">{pick}</span>?
          </p>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {current} will no longer see this customer. Their past sales stay with whoever made them.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirmMove()}>
              {busy ? "Moving…" : `Move to ${pick}`}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPick(null)}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`${listId}-q`} className="block text-[12.5px] font-semibold text-navy">
            Who should handle {name}?
          </label>
          <input
            id={`${listId}-q`}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && close()}
            placeholder="Search salespeople"
            className="h-10 w-full rounded-lg border border-border bg-input/60 px-3 text-[13px] text-navy outline-none focus:border-accent focus:bg-card"
          />
          <ul id={listId} className="max-h-56 overflow-y-auto">
            {matches.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => setPick(r)}
                  className="block min-h-10 w-full rounded-md px-2.5 py-2 text-left text-[13px] text-navy-soft hover:bg-accent-bg hover:text-accent-dark"
                >
                  {r}
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-2.5 py-2 text-[12.5px] text-muted-foreground">No salesperson matches that name.</li>
            )}
          </ul>
          <button type="button" className="btn btn-ghost text-[12.5px]" onClick={close}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
