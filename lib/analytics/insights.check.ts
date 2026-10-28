// Run: npx tsx lib/analytics/insights.check.ts
import { forecast, seasonalShare, revenueBridge, completeMonths } from "@/lib/analytics/insights";
const mk = (y: number, m: number, r: number) => ({ month: `${y}-${String(m).padStart(2, "0")}`, revenue: r, carats: 0, stones: 0, orders: 0 });
const series = [] as ReturnType<typeof mk>[];
for (let m = 1; m <= 12; m++) series.push(mk(2025, m, 100 + m * 10));
for (let m = 1; m <= 9; m++) series.push(mk(2026, m, (100 + m * 10) * 1.2));
const f = forecast(series, "2026-09-30", 3)!;
console.log("forecast", f.map((x) => `${x.month}:${x.revenue.toFixed(0)}[${x.low.toFixed(0)}-${x.high.toFixed(0)}]`).join(" "));
if (Math.abs(f[0].revenue - (100 + 10 * 10) * (1 + 0.7 * 0.2)) > 1) throw new Error("forecast wrong");
const s = seasonalShare(series, "2026-06-30")!;
console.log("share", s.toFixed(3));
if (!(s > 0.4 && s < 0.5)) throw new Error("share wrong");
console.log("partial", completeMonths(series, "2026-09-15").length === 20);
const b = revenueBridge([{ ytd: 10, lastYear: 0 }, { ytd: 0, lastYear: 5 }, { ytd: 8, lastYear: 6 }, { ytd: 3, lastYear: 4 }]);
if (b.now - b.prior !== b.steps.reduce((a, x) => a + x.value, 0)) throw new Error("bridge does not reconcile");
console.log("CHECKS OK");
