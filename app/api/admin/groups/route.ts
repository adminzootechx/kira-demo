import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { createGroup, listGroups } from "@/lib/db/adminQueries";
import { adminErrorResponse } from "@/lib/adminErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const groups = await listGroups();
  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { label?: string; scopeOwnData?: boolean };
  if (!body.label?.trim()) {
    return NextResponse.json({ error: "A group needs a name." }, { status: 400 });
  }
  try {
    const group = await createGroup({ label: body.label.trim(), scopeOwnData: body.scopeOwnData ?? true });
    return NextResponse.json({ group });
  } catch (error) {
    const { body: errBody, status } = adminErrorResponse(error, "api/admin/groups POST");
    return NextResponse.json(errBody, { status });
  }
}
