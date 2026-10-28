import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { activateImport, deleteImport, rescoreImport } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** `{ action: "activate" | "rescore" }` — make live, or re-run the models. */
export async function PATCH(request: Request, { params }: Params) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid import id." }, { status: 400 });
  }

  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  try {
    if (action === "rescore") {
      const snapshotId = await rescoreImport(id);
      return NextResponse.json({ ok: true, snapshotId });
    }
    await activateImport(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/imports PATCH]", error);
    return NextResponse.json({ error: "Could not update the import." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid import id." }, { status: 400 });
  }
  try {
    await deleteImport(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/imports DELETE]", error);
    return NextResponse.json({ error: "Could not delete the import." }, { status: 500 });
  }
}
