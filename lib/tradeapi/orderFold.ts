import { clientKey } from "@/lib/clientKey";
import type { LotRowInput } from "@/lib/db/repository";

export type OrderCell = {
  customerKey: string; orderNo: string; customerName: string; saleDate: string;
  stones: number; carats: number; amount: number; discSum: number; discN: number;
  owner: string | null; location: string | null; terms: string | null;
};
export type OrderAcc = Map<string, OrderCell>;

/** Rolls sale rows up to one line per customer order. A row with no order number
 *  is grouped by customer and day so it still shows up in the history. */
export function foldOrders(acc: OrderAcc, rows: LotRowInput[]) {
  for (const r of rows) {
    if (!r.saleDate) continue;
    const customerKey = clientKey(r.customerName);
    const orderNo = (r.orderNo || "day-" + r.saleDate).slice(0, 64);
    const key = customerKey + "\u0001" + orderNo;
    let c = acc.get(key);
    if (!c) {
      c = {
        customerKey, orderNo, customerName: r.customerName, saleDate: r.saleDate,
        stones: 0, carats: 0, amount: 0, discSum: 0, discN: 0,
        owner: r.owner, location: r.location, terms: r.terms,
      };
      acc.set(key, c);
    }
    if (r.saleDate > c.saleDate) c.saleDate = r.saleDate;
    c.stones += 1;
    c.carats += r.carats;
    c.amount += r.amount;
    if (r.discPercent !== null && r.discPercent > 0 && r.discPercent <= 150) {
      c.discSum += r.discPercent;
      c.discN += 1;
    }
  }
}
