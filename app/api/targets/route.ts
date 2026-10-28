import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, isDatabaseAvailable } from "@/lib/db/client";
import { liveViewer } from "@/lib/db/customerAccess";
import { imports } from "@/lib/db/schema";
import { clientKey } from "@/lib/clientKey";
import { seasonalShare, type Month } from "@/lib/analytics/insights";
import { getActiveBook, listOwnerMonthly, listTargets } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

/**
 * `actual` credits each sale to the salesperson recorded on it. `handled` is
 * the same year's sales from the customers the person handles now, after any
 * reassignment (what Team counts); null on the company row, where both agree.
 */
export type TargetRow = { owner: string; target: number | null; actual: number; monthly: number[]; handled: number | null };
/** `asOf` is the date the sales data runs to; pace is measured to it, not to today. */
export type TargetsResponse = { year: number; asOf: string; seasonalShare: number | null; isAdmin: boolean; company: TargetRow | null; reps: TargetRow[] };

const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Targets against real sales for the current calendar year. A rep gets only
 * their own row; management gets the company row plus every salesperson
 * (including those with no target yet, so the admin panel can set one).
 */
export async function GET() {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const isAdmin = viewer.isSystem;
  const mine = viewer.ownerName ?? "";

  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));
  const [sales, targets, monthlyRows, [active], book, orderRows] = await Promise.all([
    listOwnerMonthly(year),
    listTargets(year),
    getDb().execute(sql`select substr(period,1,7) as month, sum(revenue) as revenue from rollups where dim = 'all' group by 1 order by 1`),
    getDb().select({ asOf: imports.dataAsOf }).from(imports).where(eq(imports.isActive, true)).limit(1),
    isAdmin ? getActiveBook() : mine ? getActiveBook({ ownerName: mine }) : Promise.resolve(null),
    getDb().execute(sql`select customer_key as key, sum(amount) as amount from customer_orders where sale_date >= ${`${year}-01-01`} group by 1`),
  ]);
  const asOf = (active?.asOf ?? today).slice(0, 10);
  const monthly = (monthlyRows.rows as { month: string; revenue: number }[]).map((m) => ({ month: m.month, revenue: Number(m.revenue), carats: 0, stones: 0, orders: 0 })) as Month[];
  const share = seasonalShare(monthly, asOf);

  // This year's sales per customer, credited to whoever handles the customer now.
  const saleByKey = new Map((orderRows.rows as { key: string; amount: number }[]).map((r) => [r.key, Number(r.amount)]));
  const handledBy = new Map<string, number>();
  for (const c of book?.customers ?? []) {
    handledBy.set(norm(c.owner), (handledBy.get(norm(c.owner)) ?? 0) + (saleByKey.get(clientKey(c.name)) ?? 0));
  }

  const byOwner = new Map<string, number[]>();
  for (const s of sales) {
    const months = byOwner.get(s.owner) ?? Array(12).fill(0);
    months[Number(s.month.slice(5, 7)) - 1] += s.revenue;
    byOwner.set(s.owner, months);
  }
  const targetOf = new Map(targets.map((t) => [t.owner, t.amount]));
  const row = (owner: string, monthly: number[]): TargetRow => ({
    owner, target: targetOf.get(owner) ?? null, monthly, actual: monthly.reduce((a, b) => a + b, 0),
    handled: owner ? handledBy.get(norm(owner)) ?? 0 : null,
  });

  if (!isAdmin) {
    return NextResponse.json({
      year, asOf, seasonalShare: share, isAdmin, company: null,
      reps: mine ? [row(mine, byOwner.get(mine) ?? Array(12).fill(0))] : [],
    } satisfies TargetsResponse);
  }

  const total: number[] = Array(12).fill(0);
  for (const m of byOwner.values()) m.forEach((v, i) => (total[i] += v));
  const owners = new Set([...byOwner.keys(), ...targets.map((t) => t.owner).filter(Boolean)]);
  return NextResponse.json({
    year, asOf, seasonalShare: share, isAdmin,
    company: row("", total),
    reps: [...owners].map((o) => row(o, byOwner.get(o) ?? Array(12).fill(0))).sort((a, b) => b.actual - a.actual),
  } satisfies TargetsResponse);
}
