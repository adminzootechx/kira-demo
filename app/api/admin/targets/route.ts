import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { setTarget } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

/** Body: { year, owner ('' = whole company), amount } — amount 0 clears the target. */
export async function PUT(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const { year, owner, amount } = (await request.json().catch(() => ({}))) as {
    year?: number; owner?: string; amount?: number;
  };
  if (!Number.isInteger(year) || typeof owner !== "string" || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "A target needs a year, a salesperson (or blank for the company) and an amount." }, { status: 400 });
  }
  await setTarget(year as number, owner.trim(), amount);
  return NextResponse.json({ ok: true });
}
