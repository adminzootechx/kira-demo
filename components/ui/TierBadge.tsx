import Image from "next/image";
import type { TierName } from "@/lib/analytics/tiers";

/** The tier badge art (three transparent PNGs in public/badges/) — used
 *  wherever a tier name is
 *  shown, instead of the plain text pill. */
const TIER_BADGE_SRC: Record<TierName, string> = {
  Silver: "/badges/tier-silver.png",
  Gold: "/badges/tier-gold.png",
  "Lustre Diamond": "/badges/tier-diamond.png",
};

/** Each source badge is close to square (~677x681 to 711x695) — one ratio
 *  works for all three without distortion. */
const ASPECT = 677 / 681;

const SIZES = {
  xs: 22,
  sm: 32,
  md: 48,
  lg: 180,
} as const;

export function TierBadge({
  tier,
  size = "sm",
  className = "",
}: {
  tier: TierName;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const h = SIZES[size];
  const w = Math.round(h * ASPECT);
  return (
    <Image
      src={TIER_BADGE_SRC[tier]}
      alt={`${tier} tier`}
      width={w}
      height={h}
      className={`inline-block shrink-0 ${className}`}
      // The small in-table sizes are well under the next-gen-format threshold
      // where optimisation matters, and the hero size is decorative chrome,
      // not content whose load time gates anything — skip the optimizer.
      unoptimized
    />
  );
}
