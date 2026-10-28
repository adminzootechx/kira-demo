/**
 * The dataset's own reference date — never the wall clock, which would make
 * every recency figure drift and break server/client render parity.
 *
 * `date` is the newest sale in the loaded export (`asOf` in
 * `data-samples/lustre-periods.json`). Everything downstream measures against
 * it: `csv.ts` derives `daysSince` from it, and a reference earlier than the
 * newest sale silently clamps recency to zero for the most active accounts.
 */
export const asOf = {
  date: "22 Aug 2026",
  time: "18:40",
  fiscalYear: "FY 2026",
  daysElapsed: 234,
  daysInYear: 365,
  daysRemaining: 131,
};
