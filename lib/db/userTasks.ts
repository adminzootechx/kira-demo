import "server-only";

import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { userTasks } from "@/lib/db/schema";

export class TaskError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Open tasks, plus ones finished in the last 7 days so a tick can be undone. Newest first. */
export async function listTasks(userId: number) {
  return getDb()
    .select({ id: userTasks.id, title: userTasks.title, doneAt: sql<string | null>`${userTasks.doneAt}` })
    .from(userTasks)
    .where(and(eq(userTasks.userId, userId), or(isNull(userTasks.doneAt), gt(userTasks.doneAt, sql`now() - interval '7 days'`))))
    .orderBy(desc(userTasks.createdAt));
}

export async function addTask(userId: number, title: string) {
  const t = title.trim();
  if (!t) throw new TaskError("Write what you need to do.");
  if (t.length > 300) throw new TaskError("Keep the task under 300 characters.");
  const [row] = await getDb().insert(userTasks).values({ userId, title: t }).returning({ id: userTasks.id });
  return row.id;
}

/** Only ever touches the caller's own rows. */
export async function setTaskDone(userId: number, id: number, done: boolean) {
  const r = await getDb()
    .update(userTasks)
    .set({ doneAt: done ? new Date() : null })
    .where(and(eq(userTasks.id, id), eq(userTasks.userId, userId)))
    .returning({ id: userTasks.id });
  if (!r.length) throw new TaskError("Task not found.", 404);
}

export async function deleteTask(userId: number, id: number) {
  const r = await getDb().delete(userTasks).where(and(eq(userTasks.id, id), eq(userTasks.userId, userId))).returning({ id: userTasks.id });
  if (!r.length) throw new TaskError("Task not found.", 404);
}
