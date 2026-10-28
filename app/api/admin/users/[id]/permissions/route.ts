import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { getUserPermissions, setUserPermissions } from "@/lib/db/adminQueries";
import { adminErrorResponse } from "@/lib/adminErrors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }
  const permissions = await getUserPermissions(id);
  return NextResponse.json({ permissions });
}

/** Body: `{ permissions: Record<string, boolean> }` — only meaningful (and
 *  only accepted) when this user's permissionMode is already "manual". */
export async function PATCH(request: Request, { params }: Params) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { permissions?: Record<string, boolean> };
  if (!body.permissions || typeof body.permissions !== "object") {
    return NextResponse.json({ error: "Missing permissions." }, { status: 400 });
  }
  try {
    await setUserPermissions(id, body.permissions);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body: errBody, status } = adminErrorResponse(error, "api/admin/users/[id]/permissions PATCH");
    return NextResponse.json(errBody, { status });
  }
}
