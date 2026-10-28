import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { createRole, listRoles } from "@/lib/db/adminQueries";
import { adminErrorResponse } from "@/lib/adminErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const roles = await listRoles();
  return NextResponse.json({ roles });
}

/** Body: `{ label: string }` — a plain designation, no access rights. */
export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { label?: string };
  if (!body.label?.trim()) {
    return NextResponse.json({ error: "A role needs a name." }, { status: 400 });
  }
  try {
    const role = await createRole(body.label.trim());
    return NextResponse.json({ role });
  } catch (error) {
    const { body: errBody, status } = adminErrorResponse(error, "api/admin/roles POST");
    return NextResponse.json(errBody, { status });
  }
}
