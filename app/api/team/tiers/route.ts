import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDatabaseAvailable } from "@/lib/db/client";
import { getActiveBook } from "@/lib/db/repository";
import { snapshotBook } from "@/lib/data/snapshot";
import { computeRepTiers, salesNeeded, TIER_THRESHOLDS, type PublicRepTier, type TierName } from "@/lib/analytics/tiers";
import type { Customer } from "@/lib/data/types";
import type { AppSessionUser } from "@/lib/sessionUser";

/** Same freshness contract as /api/book: an active import can change between requests. */
export const dynamic = "force-dynamic";

const ORDER: TierName[] = ["Silver", "Gold", "Lustre Diamond"];
const nextTierGoal = (t: TierName) => ORDER[ORDER.indexOf(t) + 1] ?? null;

/** What the viewer is allowed to know about the leaderboard. Management gets
 *  everything. A rep gets their own full row, their own rank, and only the
 *  rank, score and tier of the one rep directly above them — never a name, and
 *  nothing about anyone else, so the bottom of the table is never exposed. */
function forViewer(customers: Customer[], isSystem: boolean, viewerName: string) {
  const tiers = computeRepTiers(customers);
  if (isSystem) return { tiers };
  const target = viewerName.trim().toLowerCase();
  const i = tiers.findIndex((r) => r.name.trim().toLowerCase() === target);
  if (i < 0) return { tiers: [] as PublicRepTier[] };
  const me = tiers[i];
  const above = i > 0 ? tiers[i - 1] : null;
  return {
    tiers: [me] as PublicRepTier[],
    rank: i + 1,
    above: above
      ? {
          rank: i, composite: above.composite, tier: above.tier,
          pointsToPass: Math.max(1, above.composite - me.composite + 1),
          // Sales needed to move above this rep: ahead of them in the re-scored table.
          salesToPass: salesNeeded(customers, me.name, (m, team) => team.indexOf(m) < i),
        }
      : null,
    toNextTier: nextTierGoal(me.tier)
      ? { tier: nextTierGoal(me.tier)!, sales: salesNeeded(customers, me.name, (m) => m.composite >= TIER_THRESHOLDS[nextTierGoal(me.tier)!]) }
      : null,
  };
}

export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as AppSessionUser | undefined;
  const isSystem = user?.isSystem ?? false;
  const viewerName = user?.name ?? "";

  if (await isDatabaseAvailable()) {
    try {
      const book = await getActiveBook();
      if (book) return NextResponse.json(forViewer(book.customers, isSystem, viewerName));
    } catch (error) {
      console.error("[api/team/tiers]", error);
    }
  }

  const snapshot = snapshotBook();
  return NextResponse.json(snapshot ? forViewer(snapshot.customers, isSystem, viewerName) : { tiers: [] });
}
