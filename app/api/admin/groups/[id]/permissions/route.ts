import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { setGroupPermissions } from "@/lib/db/adminQueries";
import { adminErrorResponse } from "@/lib/adminErrors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ permissions: Record<string, boolean> }` — one or more
 *  permissionKey -> enabled pairs to upsert; unlisted keys are untouched. */
export async function PATCH(request: Request, { params }: Params) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid group id." }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { permissions?: Record<string, boolean> };
  if (!body.permissions || typeof body.permissions !== "object") {
    return NextResponse.json({ error: "Missing permissions." }, { status: 400 });
  }
  try {
    await setGroupPermissions(id, body.permissions);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body: errBody, status } = adminErrorResponse(error, "api/admin/groups/[id]/permissions PATCH");
    return NextResponse.json(errBody, { status });
  }
}
