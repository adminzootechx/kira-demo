"use client";

import { useEffect, useState } from "react";
import { Award, Trophy } from "lucide-react";
import { useRole } from "@/components/shell/RoleContext";
import { TIER_THRESHOLDS, type PublicRepTier, type TierName } from "@/lib/analytics/tiers";
import { TierBadge } from "@/components/ui/TierBadge";
import {
  Card, CardBody, CardHeader, DataNote, Delta, Meter, PageHeader, Table, Td, Th,
} from "@/components/ui/primitives";
import { usd } from "@/lib/format";

type Needed = { extraSales: number; extraPercent: number } | null;
type Above = { rank: number; composite: number; tier: TierName; pointsToPass: number; salesToPass: Needed } | null;
type ToNext = { tier: TierName; sales: Needed } | null;

const TIER_ORDER: TierName[] = ["Silver", "Gold", "Lustre Diamond"];

/** The tier directly above this one, or null once already at the top. */
function nextTier(tier: TierName): TierName | null {
  const i = TIER_ORDER.indexOf(tier);
  return i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : null;
}

/** Same name-matching the owner field already uses elsewhere (team page,
 *  priorities) — case/whitespace-insensitive, since the signed-in user's
 *  display name and the Excel export's SalePerson text aren't guaranteed to
 *  match byte-for-byte. The server (/api/team/tiers) always sends the
 *  caller's own row in full regardless of role, so a match here is safe to
 *  treat as complete — only *other* reps' rows arrive name+tier only. */
function findMe(reps: PublicRepTier[], viewerName: string) {
  const target = viewerName.trim().toLowerCase();
  if (!target) return undefined;
  const found = reps.find((r) => r.name.trim().toLowerCase() === target);
  return found as (PublicRepTier & Required<PublicRepTier>) | undefined;
}

export default function MyPerformancePage() {
  const { viewer, isSystem } = useRole();
  // Always the whole-team leaderboard, never the signed-in rep's own scoped
  // book — /api/book narrows to one rep's own customers for pages like
  // Customers, which would rank a rep against a team of one here (every
  // score normalises to 100/100). /api/team/tiers never applies that scope.
  // It also redacts every row but the caller's own down to name + tier for a
  // non-admin viewer — reps don't get to see each other's revenue or growth.
  const [reps, setReps] = useState<PublicRepTier[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [above, setAbove] = useState<Above>(null);
  const [toNext, setToNext] = useState<ToNext>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team/tiers", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { tiers: PublicRepTier[]; rank?: number; above?: Above; toNextTier?: ToNext }) => {
        if (cancelled) return;
        setReps(body.tiers);
        setRank(body.rank ?? null);
        setAbove(body.above ?? null);
        setToNext(body.toNextTier ?? null);
      })
      .catch(() => {
        if (!cancelled) setReps([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const me = findMe(reps, viewer.name);
  const myRank = isSystem ? (me ? reps.indexOf(me) + 1 : null) : rank;
  const up = me ? nextTier(me.tier) : null;
  const pointsToNext = me && up ? TIER_THRESHOLDS[up] - me.composite : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My achievements"
        subtitle={isSystem ? "Every salesperson's tier and score, from real sales data over the trailing 12 months" : "Your tier, your score, and what it takes to move up, from real sales data over the trailing 12 months"}
      />

      {!loading && reps.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">
              No sales data is loaded yet, so there&apos;s no tier to show. Import your LUSTRE export to see where you stand.
            </p>
          </CardBody>
        </Card>
      )}

      {!loading && reps.length > 0 && !me && (
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t match your account name ({viewer.name || "unknown"}) to a salesperson in the sales
              data, so we can&apos;t show your personal tier.
            </p>
          </CardBody>
        </Card>
      )}

      {me && (
        <>
          {/* Hero — the client's own badge art, large, is the tier: the word
              and the metal/stone it's rendered in both come from the one
              image, so nothing here duplicates what it already says. */}
          <Card>
            <CardBody className="flex flex-wrap items-center gap-8">
              <TierBadge tier={me.tier} size="lg" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your tier</p>
                <p className="display mt-1 text-[28px] font-bold leading-tight text-navy">{me.tier}</p>
                <p className="mt-1 text-sm text-muted-foreground">{isSystem ? `Ranked #${myRank} of ${reps.length} on the team` : `Your rank: #${myRank}`}</p>
              </div>
            </CardBody>
          </Card>

          {!isSystem && (
            <Card>
              <CardHeader icon={<Trophy size={16} />} title="Your next spot" subtitle="The salesperson one place above you, without names" />
              <CardBody>
                {above ? (
                  <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rank #{above.rank} has</p>
                      <p className="mt-1 text-2xl font-bold text-navy">{above.composite}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">You need</p>
                      <p className="mt-1 text-2xl font-bold text-accent-dark">{above.pointsToPass} more {above.pointsToPass === 1 ? "point" : "points"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In sales, that is about</p>
                      <p className="mt-1 text-2xl font-bold text-navy">
                        {above.salesToPass ? usd(above.salesToPass.extraSales) : "—"}
                      </p>
                      {above.salesToPass && (
                        <p className="text-[12px] text-muted-foreground">more this year, {above.salesToPass.extraPercent.toFixed(0)}% on top of your {usd(me.ytd)}</p>
                      )}
                    </div>
                    <p className="basis-full text-[13px] text-muted-foreground">
                      to take rank #{above.rank}. You are on {me.composite}. The sales figure assumes everyone else stays where they
                      are; more sales also lifts your growth score, so it is less than the revenue gap alone would suggest.
                    </p>
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">You are in first place. Keep your customers ordering to stay there.</p>
                )}
              </CardBody>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardBody>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your score</p>
                <p className="mt-2 text-2xl font-bold text-navy">{me.composite}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sales, last 12 months</p>
                <p className="mt-2 text-2xl font-bold text-navy">{usd(me.ytd)}</p>
                <Delta value={me.growth} />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {up ? `To ${up}` : "Top tier reached"}
                </p>
                <p className="mt-2 text-2xl font-bold text-navy">
                  {up ? `${Math.max(0, Math.ceil(pointsToNext ?? 0))} pts` : "Top tier"}
                </p>
                {up && toNext?.sales && (
                  <p className="mt-1 text-[12px] text-muted-foreground">About {usd(toNext.sales.extraSales)} more in sales</p>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader icon={<Award size={16} />} title="Score breakdown" subtitle="Sales count most (60%), then growth (25%), then customers still ordering on time (15%), each compared with the rest of the team" />
            <CardBody className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-navy">Revenue</span>
                  <span className="text-muted-foreground">{me.revenueScore}/100</span>
                </div>
                <Meter value={me.revenueScore} tone="accent" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-navy">Growth</span>
                  <span className="text-muted-foreground">{me.growthScore}/100</span>
                </div>
                <Meter value={me.growthScore} tone="positive" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-navy">Customers ordering on time</span>
                  <span className="text-muted-foreground">{me.retentionScore}/100</span>
                </div>
                <Meter value={me.retentionScore} tone="violet" />
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {isSystem && reps.length > 0 && (
        <Card>
          <CardHeader
            icon={<Trophy size={16} />}
            title="Team leaderboard"
            subtitle={isSystem ? "Every salesperson, ranked by score" : "Every rep, ranked by tier — only your own score and sales are shown to you"}
          />
          <Table dense>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Salesperson</Th>
                <Th>Tier</Th>
                {isSystem && <Th align="right">Score</Th>}
                {isSystem && <Th align="right">Sales, last 12 months</Th>}
                {isSystem && <Th align="right">Growth</Th>}
              </tr>
            </thead>
            <tbody>
              {reps.map((r, i) => (
                <tr
                  key={r.name}
                  className={`transition-colors hover:bg-secondary/40 ${
                    me?.name === r.name ? "bg-accent-bg/40" : ""
                  }`}
                >
                  <Td className="text-muted-foreground">{i + 1}</Td>
                  <Td className="font-semibold text-navy">{r.name}</Td>
                  <Td><TierBadge tier={r.tier} size="xs" /></Td>
                  {isSystem && <Td align="right">{r.composite ?? "—"}</Td>}
                  {isSystem && <Td align="right">{r.ytd !== undefined ? usd(r.ytd) : "—"}</Td>}
                  {isSystem && <Td align="right">{r.growth !== undefined ? <Delta value={r.growth} /> : "—"}</Td>}
                </tr>
              ))}
            </tbody>
          </Table>
          <DataNote>
            {isSystem
              ? `Tiers: Lustre Diamond from ${TIER_THRESHOLDS["Lustre Diamond"]} points, Gold from ${TIER_THRESHOLDS.Gold}, otherwise Silver, over the last 12 months. The score is 60% sales, 25% growth on the 12 months before, and 15% customers still ordering on time, each compared with the rest of the team rather than a fixed target.`
              : `Tiers: Lustre Diamond from ${TIER_THRESHOLDS["Lustre Diamond"]} points, Gold from ${TIER_THRESHOLDS.Gold}, otherwise Silver, over the last 12 months. Other salespeople's sales and growth are not shown here.`}
          </DataNote>
        </Card>
      )}
    </div>
  );
}
