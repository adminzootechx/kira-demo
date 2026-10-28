"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { refreshBook } from "@/lib/data/store";

type Note = {
  id: number;
  authorId: number | null;
  authorName: string | null;
  body: string;
  pauseUntil: string | null;
  createdAt: string;
};

const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Written reasons for why a customer is behaving the way they are. Shown on the
 * customer page and in a panel on My day. A note can pause the customer's alerts
 * until a date; deleting that note ends the pause.
 */
export default function CustomerNotes({ name }: { name: string }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [me, setMe] = useState<number | null>(null);
  const [isSystem, setIsSystem] = useState(false);
  const [body, setBody] = useState("");
  const [pauseUntil, setPauseUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const { error, success } = useToast();

  const load = useCallback(() => {
    fetch(`/api/notes?customer=${encodeURIComponent(name)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { notes: Note[]; me: number; isSystem: boolean }) => {
        setNotes(b.notes);
        setMe(b.me);
        setIsSystem(b.isSystem);
      })
      .catch(() => setNotes([]));
  }, [name]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server on mount
    load();
  }, [load]);

  const add = async () => {
    setSaving(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: name, body, pauseUntil: pauseUntil || undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      error("Could not save the note", b.error ?? "Try again.");
      return;
    }
    success("Note saved", pauseUntil ? `Alerts for this customer are paused until ${day(pauseUntil)}.` : undefined);
    setBody("");
    setPauseUntil("");
    load();
    if (pauseUntil) refreshBook();
  };

  const remove = async (n: Note) => {
    const res = await fetch(`/api/notes/${n.id}`, { method: "DELETE" });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      error("Could not delete the note", b.error ?? "Try again.");
      return;
    }
    load();
    if (n.pauseUntil) refreshBook();
  };

  const pausedUntil = notes?.map((n) => n.pauseUntil).filter((d): d is string => !!d && d >= todayIso()).sort().pop();

  return (
    <div className="space-y-5">
      {pausedUntil && (
        <p className="rounded-[10px] border border-warn/30 bg-warn-bg px-3.5 py-2.5 text-[13px] text-navy">
          Alerts for this customer are paused until <span className="font-semibold">{day(pausedUntil)}</span>. Delete the note that set the pause to bring them back sooner.
        </p>
      )}

      <div className="space-y-3">
        <label className="block text-[13px] font-semibold text-navy" htmlFor={`note-${name}`}>
          Add a note
        </label>
        <textarea
          id={`note-${name}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Why is this customer behaving this way? For example: buyer is on leave until the 20th."
          className="w-full rounded-[10px] border border-border bg-card px-3 py-2.5 text-[13.5px] text-navy outline-none transition-colors placeholder:text-muted-foreground hover:border-[#d8dfeb] focus:border-accent"
        />
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
          <button type="button" onClick={add} disabled={!body.trim() || saving} className="btn btn-primary disabled:opacity-50">
            Save note
          </button>
        </div>
      </div>

      {notes === null ? (
        <p className="text-[13px] text-muted-foreground">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {notes.map((n) => (
            <li key={n.id} className="py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12.5px] text-muted-foreground">
                  <span className="font-semibold text-navy">{n.authorName ?? "Former user"}</span> · {day(n.createdAt)}
                </p>
                <div className="flex items-center gap-2">
                  {n.pauseUntil && <Badge tone={n.pauseUntil >= todayIso() ? "warn" : "neutral"}>{n.pauseUntil >= todayIso() ? `Paused until ${day(n.pauseUntil)}` : `Pause ended ${day(n.pauseUntil)}`}</Badge>}
                  {(isSystem || n.authorId === me) && (
                    <button type="button" onClick={() => remove(n)} aria-label="Delete this note" className="text-muted-foreground transition-colors hover:text-negative">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-navy">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
