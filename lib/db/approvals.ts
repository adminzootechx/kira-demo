import "server-only";

import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db/client";
import { approvalRequests, approvalTypes, users } from "@/lib/db/schema";

export class ApprovalError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type ApprovalType = { id: number; name: string; needsAmount: boolean; needsCustomer: boolean; active: boolean };

export type ApprovalRow = {
  id: number;
  typeName: string;
  requesterId: number;
  requesterName: string;
  managerId: number;
  managerName: string;
  customerName: string | null;
  amount: number | null;
  note: string;
  status: "waiting" | "approved" | "declined" | "cancelled";
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export async function listApprovalTypes(activeOnly = false): Promise<ApprovalType[]> {
  const rows = await getDb()
    .select({
      id: approvalTypes.id,
      name: approvalTypes.name,
      needsAmount: approvalTypes.needsAmount,
      needsCustomer: approvalTypes.needsCustomer,
      active: approvalTypes.active,
    })
    .from(approvalTypes)
    .where(activeOnly ? eq(approvalTypes.active, true) : undefined)
    .orderBy(approvalTypes.id);
  return rows;
}

export async function createApprovalType(input: { name: string; needsAmount: boolean; needsCustomer: boolean }) {
  const name = input.name.trim();
  if (!name || name.length > 80) throw new ApprovalError("Give the request type a name of up to 80 characters.");
  try {
    const [row] = await getDb()
      .insert(approvalTypes)
      .values({ name, needsAmount: input.needsAmount, needsCustomer: input.needsCustomer })
      .returning({ id: approvalTypes.id });
    return row.id;
  } catch {
    throw new ApprovalError("A request type with that name already exists.", 409);
  }
}

export async function updateApprovalType(
  id: number,
  patch: { name?: string; needsAmount?: boolean; needsCustomer?: boolean; active?: boolean },
) {
  const set: typeof patch = {};
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name || name.length > 80) throw new ApprovalError("Give the request type a name of up to 80 characters.");
    set.name = name;
  }
  if (typeof patch.needsAmount === "boolean") set.needsAmount = patch.needsAmount;
  if (typeof patch.needsCustomer === "boolean") set.needsCustomer = patch.needsCustomer;
  if (typeof patch.active === "boolean") set.active = patch.active;
  if (!Object.keys(set).length) throw new ApprovalError("Nothing to update.");
  try {
    const updated = await getDb().update(approvalTypes).set(set).where(eq(approvalTypes.id, id)).returning({ id: approvalTypes.id });
    if (!updated.length) throw new ApprovalError("Request type not found.", 404);
  } catch (e) {
    if (e instanceof ApprovalError) throw e;
    throw new ApprovalError("A request type with that name already exists.", 409);
  }
}

const requester = alias(users, "requester");
const manager = alias(users, "manager");
const decider = alias(users, "decider");

const rowSelection = {
  id: approvalRequests.id,
  typeName: approvalTypes.name,
  requesterId: approvalRequests.requesterId,
  requesterName: requester.name,
  managerId: approvalRequests.managerId,
  managerName: manager.name,
  customerName: approvalRequests.customerName,
  amount: approvalRequests.amount,
  note: approvalRequests.note,
  status: approvalRequests.status,
  decidedByName: decider.name,
  decidedAt: sql<string | null>`${approvalRequests.decidedAt}`,
  decisionNote: approvalRequests.decisionNote,
  createdAt: sql<string>`${approvalRequests.createdAt}`,
};

function selectRows() {
  return getDb()
    .select(rowSelection)
    .from(approvalRequests)
    .innerJoin(approvalTypes, eq(approvalRequests.typeId, approvalTypes.id))
    .innerJoin(requester, eq(approvalRequests.requesterId, requester.id))
    .innerJoin(manager, eq(approvalRequests.managerId, manager.id))
    .leftJoin(decider, eq(approvalRequests.decidedBy, decider.id));
}

type Viewer = { id: number; isSystem: boolean };

/** Everything the Approvals page shows: my own requests, what waits for me, and what I decided. */
export async function approvalsFor(viewer: Viewer) {
  const [me] = await getDb()
    .select({ managerId: users.managerId, managerName: manager.name })
    .from(users)
    .leftJoin(manager, eq(users.managerId, manager.id))
    .where(eq(users.id, viewer.id));

  const mine = (await selectRows().where(eq(approvalRequests.requesterId, viewer.id)).orderBy(desc(approvalRequests.createdAt)).limit(100)) as ApprovalRow[];

  // Management sees everything that is waiting; anyone else, only what was sent to them.
  const toMe = viewer.isSystem ? undefined : eq(approvalRequests.managerId, viewer.id);
  const waiting = (await selectRows()
    .where(and(eq(approvalRequests.status, "waiting"), ne(approvalRequests.requesterId, viewer.id), toMe))
    .orderBy(approvalRequests.createdAt)) as ApprovalRow[];

  const decided = (await selectRows()
    .where(and(or(eq(approvalRequests.decidedBy, viewer.id), toMe), or(eq(approvalRequests.status, "approved"), eq(approvalRequests.status, "declined")), ne(approvalRequests.requesterId, viewer.id)))
    .orderBy(desc(approvalRequests.decidedAt))
    .limit(50)) as ApprovalRow[];

  return {
    managerId: me?.managerId ?? null,
    managerName: me?.managerName ?? null,
    mine,
    waiting,
    decided,
    types: await listApprovalTypes(true),
  };
}

export async function createRequest(
  viewer: Viewer,
  input: { typeId: number; note: string; amount?: number | null; customerKey?: string | null; customerName?: string | null },
) {
  const db = getDb();
  const [me] = await db.select({ managerId: users.managerId }).from(users).where(eq(users.id, viewer.id));
  if (!me?.managerId) throw new ApprovalError("You do not have a manager set yet. Ask an administrator to set who you report to.");

  const [type] = await db.select().from(approvalTypes).where(eq(approvalTypes.id, input.typeId));
  if (!type || !type.active) throw new ApprovalError("Choose one of the request types.");

  const note = input.note.trim();
  if (!note) throw new ApprovalError("Write a short note so your manager knows what you are asking.");
  if (note.length > 1000) throw new ApprovalError("Keep the note under 1,000 characters.");

  const amount = typeof input.amount === "number" && Number.isFinite(input.amount) && input.amount >= 0 ? input.amount : null;
  if (type.needsAmount && amount === null) throw new ApprovalError("This kind of request needs an amount.");
  const customerName = input.customerName?.trim() || null;
  if (type.needsCustomer && !customerName) throw new ApprovalError("This kind of request needs a customer.");

  const [row] = await db
    .insert(approvalRequests)
    .values({
      typeId: type.id,
      requesterId: viewer.id,
      managerId: me.managerId,
      note,
      amount: type.needsAmount ? amount : null,
      customerKey: customerName ? (input.customerKey ?? null) : null,
      customerName,
    })
    .returning({ id: approvalRequests.id });
  return row.id;
}

/** A manager (or an administrator) decides a waiting request. The update itself carries every rule, so two clicks cannot both win. */
export async function decideRequest(viewer: Viewer, id: number, approve: boolean, note: string) {
  const decisionNote = note.trim() || null;
  if (!approve && !decisionNote) throw new ApprovalError("Say why you are declining, so they know what to change.");
  if (decisionNote && decisionNote.length > 1000) throw new ApprovalError("Keep the comment under 1,000 characters.");

  const updated = await getDb()
    .update(approvalRequests)
    .set({ status: approve ? "approved" : "declined", decidedBy: viewer.id, decidedAt: new Date(), decisionNote })
    .where(and(
      eq(approvalRequests.id, id),
      eq(approvalRequests.status, "waiting"),
      ne(approvalRequests.requesterId, viewer.id),
      viewer.isSystem ? undefined : eq(approvalRequests.managerId, viewer.id),
    ))
    .returning({ id: approvalRequests.id });
  if (!updated.length) throw new ApprovalError("This request is no longer waiting for you.", 409);
}

export async function cancelRequest(viewer: Viewer, id: number) {
  const updated = await getDb()
    .update(approvalRequests)
    .set({ status: "cancelled" })
    .where(and(eq(approvalRequests.id, id), eq(approvalRequests.requesterId, viewer.id), eq(approvalRequests.status, "waiting")))
    .returning({ id: approvalRequests.id });
  if (!updated.length) throw new ApprovalError("Only a request that is still waiting can be cancelled.", 409);
}
