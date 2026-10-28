import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { createUser, listUsers } from "@/lib/db/adminQueries";
import { adminErrorResponse } from "@/lib/adminErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    roleId?: number;
    groupId?: number;
    departmentId?: number | null;
    marketId?: number | null;
    ownerName?: string | null;
    managerId?: number | null;
  };
  if (!body.email || !body.name || !body.roleId || !body.groupId) {
    return NextResponse.json({ error: "Email, name, role, and group are required." }, { status: 400 });
  }
  try {
    const result = await createUser({
      email: body.email,
      name: body.name,
      roleId: body.roleId,
      groupId: body.groupId,
      departmentId: body.departmentId ?? null,
      marketId: body.marketId ?? null,
      ownerName: body.ownerName ?? null,
      managerId: body.managerId ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { body: errBody, status } = adminErrorResponse(error, "api/admin/users POST");
    return NextResponse.json(errBody, { status });
  }
}
