import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { liveViewer } from "@/lib/db/customerAccess";
import { getNotificationState, markNotifications } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

/** The signed-in user's own seen/read state for the bell. */
export async function GET() {
  if (!(await isDatabaseAvailable())) return NextResponse.json({ seen: [], read: [] });
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const rows = await getNotificationState(viewer.id);
  return NextResponse.json({ seen: rows.map((r) => r.id), read: rows.filter((r) => r.read).map((r) => r.id) });
}

/** Body: { ids: string[], read: boolean } — read false records them as seen. Only ever writes the caller's own rows. */
export async function POST(request: Request) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { ids?: unknown; read?: unknown };
  if (!Array.isArray(body.ids) || !body.ids.every((x) => typeof x === "string")) {
    return NextResponse.json({ error: "Send a list of notification ids." }, { status: 400 });
  }
  await markNotifications(viewer.id, body.ids as string[], body.read === true);
  return NextResponse.json({ ok: true });
}
