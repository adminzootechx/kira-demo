"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

type Task = { id: number; title: string; doneAt: string | null };

/** The rep's own to-do items, private to them, shown above the automatic tasks. */
export default function MyTasks() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [title, setTitle] = useState("");
  const { error } = useToast();

  const load = useCallback(() => {
    fetch("/api/tasks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { tasks: Task[] }) => setTasks(b.tasks))
      .catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server on mount
    load();
  }, [load]);

  const call = async (url: string, method: string, body?: object) => {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      error("Could not save that", b.error ?? "Try again.");
      return false;
    }
    load();
    return true;
  };

  const add = async () => {
    if (!title.trim()) return;
    if (await call("/api/tasks", "POST", { title })) setTitle("");
  };

  if (tasks === null) return null;

  return (
    <div className="border-y border-border px-5 py-4">
      <p className="text-[13px] font-semibold text-navy">My own tasks</p>
      <ul className="mt-2 space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={t.doneAt !== null}
              onChange={(e) => {
                const done = e.target.checked;
                setTasks((prev) => prev && prev.map((x) => (x.id === t.id ? { ...x, doneAt: done ? new Date().toISOString() : null } : x)));
                void call(`/api/tasks/${t.id}`, "PATCH", { done });
              }}
              aria-label={`Done: ${t.title}`}
              className="size-5 shrink-0 cursor-pointer accent-[var(--color-accent)]"
            />
            <span className={`min-w-0 flex-1 text-[13.5px] ${t.doneAt ? "text-muted-foreground line-through" : "text-navy"}`}>{t.title}</span>
            <button type="button" onClick={() => call(`/api/tasks/${t.id}`, "DELETE")} aria-label={`Delete task: ${t.title}`} className="text-muted-foreground transition-colors hover:text-negative">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          placeholder="Add a task, for example: send the price list to Taka"
          aria-label="New task"
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-border bg-card px-3 text-[13.5px] text-navy outline-none placeholder:text-muted-foreground focus:border-accent"
        />
        <button type="submit" disabled={!title.trim()} className="btn btn-secondary disabled:opacity-50">
          <Plus size={14} />
          Add
        </button>
      </form>
    </div>
  );
}
