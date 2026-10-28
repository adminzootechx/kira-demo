import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { deleteDepartment, renameDepartment } from "@/lib/db/adminQueries";
import { adminErrorResponse } from "@/lib/adminErrors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid department id." }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "A department needs a name." }, { status: 400 });
  }
  try {
    const department = await renameDepartment(id, body.name.trim());
    return NextResponse.json({ department });
  } catch (error) {
    const { body: errBody, status } = adminErrorResponse(error, "api/admin/departments/[id] PATCH");
    return NextResponse.json(errBody, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid department id." }, { status: 400 });
  }
  try {
    await deleteDepartment(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = adminErrorResponse(error, "api/admin/departments/[id] DELETE");
    return NextResponse.json(body, { status });
  }
}
