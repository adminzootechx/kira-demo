import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { liveViewer } from "@/lib/db/customerAccess";
import { deleteTask, setTaskDone, TaskError } from "@/lib/db/userTasks";

export const dynamic = "force-dynamic";

async function guard(params: Promise<{ id: string }>) {
  if (!(await isDatabaseAvailable())) return { res: NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 }) };
  const viewer = await liveViewer();
  if (!viewer) return { res: NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 }) };
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return { res: NextResponse.json({ error: "Unknown task." }, { status: 400 }) };
  return { viewer, id };
}

const fail = (e: unknown) => {
  if (e instanceof TaskError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
};

/** Body: { done: boolean } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if (g.res) return g.res;
  const b = (await request.json().catch(() => ({}))) as { done?: unknown };
  if (typeof b.done !== "boolean") return NextResponse.json({ error: "Send done as true or false." }, { status: 400 });
  try {
    await setTaskDone(g.viewer!.id, g.id!, b.done);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if (g.res) return g.res;
  try {
    await deleteTask(g.viewer!.id, g.id!);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
