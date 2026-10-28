import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { resetUserPassword, updateUser } from "@/lib/db/adminQueries";
import { adminErrorResponse } from "@/lib/adminErrors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ action: "resetPassword" }` to reset, or any of
 *  `{ roleId?, groupId?, permissionMode?, departmentId?, marketId?, ownerName? }` to update fields. */
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
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    roleId?: number;
    groupId?: number;
    permissionMode?: "inherit" | "manual";
    departmentId?: number | null;
    marketId?: number | null;
    ownerName?: string | null;
    managerId?: number | null;
  };
  try {
    if (body.action === "resetPassword") {
      const tempPassword = await resetUserPassword(id);
      return NextResponse.json({ tempPassword });
    }
    const { action: _action, ...fields } = body;
    const user = await updateUser(id, fields);
    return NextResponse.json({ user });
  } catch (error) {
    const { body: errBody, status } = adminErrorResponse(error, "api/admin/users/[id] PATCH");
    return NextResponse.json(errBody, { status });
  }
}
