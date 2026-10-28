import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { createMarket, listMarkets } from "@/lib/db/adminQueries";
import { adminErrorResponse } from "@/lib/adminErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  return NextResponse.json({ markets: await listMarkets() });
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "A market needs a name." }, { status: 400 });
  }
  try {
    const market = await createMarket(body.name.trim());
    return NextResponse.json({ market });
  } catch (error) {
    const { body: errBody, status } = adminErrorResponse(error, "api/admin/markets POST");
    return NextResponse.json(errBody, { status });
  }
}
