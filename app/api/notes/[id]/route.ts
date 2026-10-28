import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { liveViewer } from "@/lib/db/customerAccess";
import { deleteNote, NoteError } from "@/lib/db/customerNotes";

export const dynamic = "force-dynamic";

/** The writer deletes their own note; management deletes any. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isDatabaseAvailable())) return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Unknown note." }, { status: 400 });
  try {
    await deleteNote(viewer, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NoteError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
