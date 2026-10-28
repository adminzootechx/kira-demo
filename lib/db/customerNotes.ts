import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customerNotes, users } from "@/lib/db/schema";

export type NoteRow = {
  id: number;
  customerKey: string;
  authorId: number | null;
  authorName: string | null;
  body: string;
  pauseUntil: string | null;
  createdAt: string;
};

export class NoteError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

const selection = {
  id: customerNotes.id,
  customerKey: customerNotes.customerKey,
  authorId: customerNotes.authorId,
  authorName: users.name,
  body: customerNotes.body,
  pauseUntil: customerNotes.pauseUntil,
  createdAt: sql<string>`${customerNotes.createdAt}`,
};

/** Newest first. */
export async function listNotes(customerKey: string): Promise<NoteRow[]> {
  return getDb()
    .select(selection)
    .from(customerNotes)
    .leftJoin(users, eq(customerNotes.authorId, users.id))
    .where(eq(customerNotes.customerKey, customerKey))
    .orderBy(desc(customerNotes.createdAt));
}

/** Count and newest note for each of the given customers, for the My day list. */
export async function noteSummary(keys: string[]) {
  if (!keys.length) return [];
  const rows = await getDb()
    .select(selection)
    .from(customerNotes)
    .leftJoin(users, eq(customerNotes.authorId, users.id))
    .where(inArray(customerNotes.customerKey, keys))
    .orderBy(desc(customerNotes.createdAt));
  const by = new Map<string, { key: string; count: number; latest: NoteRow }>();
  for (const r of rows) {
    const hit = by.get(r.customerKey);
    if (hit) hit.count += 1;
    else by.set(r.customerKey, { key: r.customerKey, count: 1, latest: r });
  }
  return [...by.values()];
}

export async function addNote(authorId: number, customerKey: string, body: string, pauseUntil: string | null) {
  const text = body.trim();
  if (!text) throw new NoteError("Write the note first.");
  if (text.length > 2000) throw new NoteError("Keep the note under 2,000 characters.");
  if (pauseUntil !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pauseUntil) || Number.isNaN(Date.parse(pauseUntil))) throw new NoteError("Pick a valid date to pause until.");
    if (pauseUntil < today()) throw new NoteError("The pause date cannot be in the past.");
    if (Date.parse(pauseUntil) - Date.now() > 366 * 86_400_000) throw new NoteError("Pause for up to a year at a time.");
  }
  const [row] = await getDb()
    .insert(customerNotes)
    .values({ customerKey, authorId, body: text, pauseUntil })
    .returning({ id: customerNotes.id });
  return row.id;
}

/** The writer may delete their own note; management may delete any. Deleting a note ends its pause. */
export async function deleteNote(viewer: { id: number; isSystem: boolean }, id: number) {
  const gone = await getDb()
    .delete(customerNotes)
    .where(and(eq(customerNotes.id, id), viewer.isSystem ? undefined : eq(customerNotes.authorId, viewer.id)))
    .returning({ id: customerNotes.id });
  if (!gone.length) throw new NoteError("You can only delete notes you wrote.", 403);
}

/** Customer key -> last day of the pause, for every customer with a pause still running. */
export async function activePauses(): Promise<Map<string, string>> {
  const rows = await getDb()
    .select({ key: customerNotes.customerKey, until: sql<string>`max(${customerNotes.pauseUntil})` })
    .from(customerNotes)
    .where(gte(customerNotes.pauseUntil, today()))
    .groupBy(customerNotes.customerKey);
  return new Map(rows.map((r) => [r.key, String(r.until).slice(0, 10)]));
}
