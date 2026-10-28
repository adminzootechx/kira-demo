import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { ingestCompanies } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

/** Management only. Body: { companies: [{ name, country?, data? }] } — loads scraper results; new companies start unowned. */
export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const { companies } = (await request.json().catch(() => ({}))) as {
    companies?: { name: string; country?: string; data?: unknown }[];
  };
  if (!Array.isArray(companies) || !companies.length || companies.length > 2000) {
    return NextResponse.json({ error: "Send between 1 and 2,000 companies." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, loaded: await ingestCompanies(companies) });
}
