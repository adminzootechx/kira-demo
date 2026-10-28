import { NextResponse } from "next/server";
import { authorizeCustomer } from "@/lib/db/customerAccess";
import { fetchSalesData } from "@/lib/tradeapi/client";
import { mapRow } from "@/lib/tradeapi/sync";
import { logError } from "@/lib/errorCodes";
import { snapshotOrders } from "@/lib/data/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A demo order (from data/demo-orders.json): splits each spec line of the order into its stones, sizes varied deterministically. */
function demoStones(key: string, orderNo: string) {
  const order = snapshotOrders(key).find((o) => o.orderNo === orderNo);
  return (order?.lines ?? []).flatMap(([shape, colour, clarity, lab, stones, carats, amount, discount, days, location]) =>
    Array.from({ length: stones }, (_, i) => {
      const share = (1 + 0.15 * Math.sin(i * 2.7)) / stones;
      return {
        shape, carats: Math.round(carats * share * 100) / 100, colour, clarity, cut: "EX", polish: "EX", symmetry: i % 4 ? "EX" : "VG",
        fluorescence: "NON", lab, pricePerCarat: carats > 0 ? amount / carats : 0, amount: Math.round(amount * share * 100) / 100,
        discount, daysInStock: days, location,
      };
    }),
  );
}

/**
 * ?name=&date=&order= — the stones inside one order, fetched live from the
 * sales API for that customer in a week around the sale date (the API returns
 * nothing for very short ranges). Needs a working API login; when there is
 * none the page says so instead of failing.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const name = q.get("name") ?? "";
  const date = q.get("date") ?? "";
  const order = q.get("order") ?? "";
  const ok = await authorizeCustomer(name);
  if (!ok || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const demo = demoStones(ok.key, order);
  if (demo.length) return NextResponse.json({ stones: demo });

  const centre = Date.parse(date);
  try {
    const page = await fetchSalesData({
      startRow: 1, endRow: 1000, party2: name,
      fromDate: iso(centre - 3 * DAY), toDate: iso(centre + 3 * DAY),
    });
    const stones = page.rows
      .map(mapRow)
      .filter((r) => !order.startsWith("day-") ? r.orderNo === order : r.saleDate === date)
      .map((r) => ({
        shape: r.shape, carats: r.carats, colour: r.colour, clarity: r.clarity, cut: r.cut,
        polish: r.polish, symmetry: r.symmetry, fluorescence: r.fluorescence, lab: r.lab,
        pricePerCarat: r.carats > 0 ? r.amount / r.carats : 0, amount: r.amount,
        discount: r.discPercent, daysInStock: r.daysInStock, location: r.location,
      }));
    return NextResponse.json({ stones });
  } catch (error) {
    logError("LUSTRE-SYNC-2", "api/customers/orders/stones", error);
    return NextResponse.json(
      { error: "Stone details could not be loaded right now. Try again later; if it keeps happening, ask an administrator to refresh the sales data connection." },
      { status: 502 },
    );
  }
}
