"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { refreshBook } from "@/lib/data/store";

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Dismissing a task needs a reason. The reason is saved as a note on the
 * customer, so the next person to look sees why it was set aside. A date can
 * also pause that customer's alerts, the same as a note written on the
 * customer page.
 */
export default function DismissForm({ customer, onCancel, onDone }: { customer: string; onCancel: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [pauseUntil, setPauseUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const { error } = useToast();

  const submit = async () => {
    setSaving(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, body: `Dismissed from My day: ${reason.trim()}`, pauseUntil: pauseUntil || undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      error("Could not dismiss that", b.error ?? "Try again.");
      return;
    }
    if (pauseUntil) refreshBook();
    onDone();
  };

  return (
    <div data-no-row-click className="mt-3 cursor-default space-y-3 rounded-[10px] border border-border bg-secondary/40 p-3.5">
      <label className="block text-[13px] font-semibold text-navy">
        Why are you dismissing this?
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={1900}
          className="mt-1.5 w-full rounded-[10px] border border-border bg-card px-3 py-2 text-[13.5px] font-normal text-navy outline-none focus:border-accent"
        />
      </label>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block text-[12.5px] text-muted-foreground">
          Pause this customer&apos;s alerts until (optional)
          <input
            type="date"
            value={pauseUntil}
            min={todayIso()}
            onChange={(e) => setPauseUntil(e.target.value)}
            className="mt-1 block h-10 rounded-[10px] border border-border bg-card px-3 text-[13.5px] text-navy outline-none focus:border-accent"
          />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button type="button" onClick={submit} disabled={!reason.trim() || saving} className="btn btn-primary disabled:opacity-50">Dismiss</button>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground">Saved as a note on this customer. Without a pause date, the task comes back tomorrow.</p>
    </div>
  );
}
