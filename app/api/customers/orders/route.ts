import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { listCustomerOrders } from "@/lib/db/repository";
import { authorizeCustomer } from "@/lib/db/customerAccess";
import { snapshotOrders } from "@/lib/data/snapshot";

export const dynamic = "force-dynamic";

/** The demo order history, for when no orders have been imported for this customer. */
const demoOrders = (key: string) => NextResponse.json({ orders: snapshotOrders(key).map(({ lines: _lines, ...o }) => o) });

/** ?name= — a customer's past orders, newest first. Reps only get their own customers. */
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const ok = await authorizeCustomer(name);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await isDatabaseAvailable())) return demoOrders(ok.key);
  const rows = await listCustomerOrders(ok.key);
  if (!rows.length) return demoOrders(ok.key);
  return NextResponse.json({
    orders: rows.map((r) => ({
      orderNo: r.orderNo, date: r.saleDate, stones: r.stones, carats: r.carats, amount: r.amount,
      discount: r.discN ? r.discSum / r.discN : null, location: r.location, terms: r.terms,
      owner: r.owner,
    })),
  });
}
