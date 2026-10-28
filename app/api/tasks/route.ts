import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { liveViewer } from "@/lib/db/customerAccess";
import { addTask, listTasks, TaskError } from "@/lib/db/userTasks";

export const dynamic = "force-dynamic";

/** The signed-in user's own tasks. */
export async function GET() {
  if (!(await isDatabaseAvailable())) return NextResponse.json({ tasks: [] });
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  return NextResponse.json({ tasks: await listTasks(viewer.id) });
}

/** Body: { title } */
export async function POST(request: Request) {
  if (!(await isDatabaseAvailable())) return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { title?: unknown };
  if (typeof b.title !== "string") return NextResponse.json({ error: "Write what you need to do." }, { status: 400 });
  try {
    return NextResponse.json({ id: await addTask(viewer.id, b.title) });
  } catch (e) {
    if (e instanceof TaskError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
