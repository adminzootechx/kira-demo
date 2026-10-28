import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { setGroupRoles } from "@/lib/db/adminQueries";
import { adminErrorResponse } from "@/lib/adminErrors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ roleIds: number[] }` — replaces the full set of role
 *  designations this group offers. */
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
  const body = (await request.json().catch(() => ({}))) as { roleIds?: unknown };
  if (!Array.isArray(body.roleIds) || !body.roleIds.every((r) => typeof r === "number")) {
    return NextResponse.json({ error: "roleIds must be a list of numbers." }, { status: 400 });
  }
  try {
    await setGroupRoles(id, body.roleIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body: errBody, status } = adminErrorResponse(error, "api/admin/groups/[id]/roles PATCH");
    return NextResponse.json(errBody, { status });
  }
}
