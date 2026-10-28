import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp } from "lucide-react";
import { toneClasses, type Tone } from "@/lib/format";
import HelpTip from "./HelpTip";
import { helpFor } from "@/lib/metricHelp";

/* ---------------------------------------------------------------- Card */

export function Card({
  className = "",
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={`surface min-w-0 ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  help,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  /** Explanation shown behind a "?" next to the title. */
  help?: React.ReactNode;
}) {
  const tip = help ?? helpFor(title);
  return (
    <div className="card-header flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-6 pb-4 pt-5">
      <div className="flex min-w-0 gap-3.5">
        {icon && <IconTile tone="accent">{icon}</IconTile>}
        <div className="min-w-0">
          <h2 className="display flex items-center gap-2 text-[18px] font-bold leading-snug text-navy">
            {title}
            {tip && <HelpTip title={title}>{tip}</HelpTip>}
          </h2>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
    </div>
  );
}

export function CardBody({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  // Base padding is deliberately the plain `p-6` it has always been, so a
  // body with no header above it is unchanged and callers that override with
  // their own `py-*` keep winning. The top padding is removed only when a
  // header actually precedes it — see the `.card-header + .card-body` rule.
  return <div className={`card-body p-6 ${className}`}>{children}</div>;
}

/**
 * A fixed-width slot that keeps leading icons optically aligned down a column.
 * Deliberately undecorated — the icon carries the meaning, a tinted rounded
 * chip around it would only add noise.
 */
export function IconTile({
  tone = "accent",
  size = "md",
  children,
}: {
  tone?: Tone;
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  const t = toneClasses[tone];
  const dim = size === "sm" ? "w-4" : "w-5";
  return (
    <span className={`inline-flex ${dim} shrink-0 justify-center pt-0.5 ${t.text}`}>
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Badge */

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  const t = toneClasses[tone];
  return (
    <span className={`pill border ${t.bg} ${t.text} ${t.border}`}>{children}</span>
  );
}

export function Delta({
  value,
  invert = false,
  suffix = "%",
  className = "",
}: {
  value: number;
  invert?: boolean;
  suffix?: string;
  className?: string;
}) {
  const good = invert ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.05;
  const Icon = flat ? Minus : good ? ArrowUpRight : ArrowDownRight;
  const color = flat ? "text-muted-foreground" : good ? "text-positive" : "text-negative";
  const direction = flat ? "flat" : good ? "favourable" : "unfavourable";
  return (
    <span
      title={`${direction} movement`}
      className={`inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums ${color} ${className}`}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      <span className="sr-only">{direction}: </span>
      {/* Growth off a near-zero base reads as an absurd percentage; past 10x
          the multiple is the honest figure. */}
      {suffix === "%" && value >= 900 ? (
        "Over 10×"
      ) : (
        <>
          {value > 0 && !flat ? "+" : ""}
          {value.toFixed(1)}
          {suffix}
        </>
      )}
    </span>
  );
}

/**
 * The same movement as `Delta`, drawn as a filled capsule. Used where the
 * figure sits on its own — the corner of a KPI card, beside a headline value —
 * and needs to hold its own against a large number rather than annotate it.
 */
export function DeltaPill({
  value,
  invert = false,
  suffix = "%",
  digits = 1,
  className = "",
}: {
  value: number;
  invert?: boolean;
  suffix?: string;
  /** 0 for whole counts ("+4"), 1 for rates ("+8.2%"). */
  digits?: number;
  className?: string;
}) {
  const good = invert ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.05;
  const tone: Tone = flat ? "neutral" : good ? "positive" : "negative";
  const t = toneClasses[tone];
  const direction = flat ? "flat" : good ? "favourable" : "unfavourable";
  return (
    <span
      title={`${direction} movement`}
      className={`pill ${t.bg} ${t.text} ${className}`}
    >
      <span className="sr-only">{direction}: </span>
      {value > 0 && !flat ? "+" : ""}
      {value.toFixed(digits)}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------ Sparkline */

/**
 * The micro bar chart that rides in the corner of a stat card. Drawn as spans
 * rather than through the chart library on purpose: at this size there are no
 * axes, no tooltip and no resize behaviour worth paying a Recharts mount for,
 * and a KPI band renders three of these above the fold.
 *
 * Colour walks from the hue's palest step at the left to its full value at the
 * right, so ten marks read as one object that gets denser over time — the
 * shape is the information, the individual bars are not.
 */
export function BarSpark({
  values,
  hue = "violet",
  height = 34,
  baseline = "zero",
}: {
  values: number[];
  hue?: "violet" | "cyan" | "coral";
  height?: number;
  /**
   * `zero` measures each bar from nothing, which is the honest reading for a
   * quantity that can genuinely fall to zero — revenue, volume, a count.
   *
   * `range` measures across the series' own min and max. Reserved for figures
   * that never approach zero, such as a realised price per carat: drawn from
   * zero a 3% move is twelve identical bars, which says less than no chart at
   * all. The trade is that the bar heights then show shape, not magnitude.
   */
  baseline?: "zero" | "range";
}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  // A little headroom below the floor so the smallest bar in `range` mode is
  // still a bar rather than the baseline itself.
  const floor = baseline === "range" ? min - (max - min) * 0.35 : 0;
  const span = Math.max(max - floor, 1e-9);

  const full = `var(--color-spark-${hue})`;
  const soft = `var(--color-spark-${hue}-soft)`;
  const last = Math.max(values.length - 1, 1);

  return (
    <div
      className="flex shrink-0 items-end gap-[3px]"
      style={{ height }}
      aria-hidden
    >
      {values.map((v, i) => (
        <span
          key={i}
          className="w-[3.5px] rounded-full"
          style={{
            // A floor of 14% keeps a near-zero period visible as a mark
            // rather than a gap, which would read as missing data.
            height: `${Math.max(14, ((v - floor) / span) * 100)}%`,
            background: `color-mix(in oklab, ${full} ${20 + (i / last) * 80}%, ${soft})`,
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- KPI */

export function KpiCard({
  label,
  value,
  delta,
  sub,
  invert = false,
  tone,
  footer,
  spark,
  sparkHue = "violet",
  sparkBaseline = "zero",
  href,
  help,
}: {
  label: string;
  value: string;
  delta?: number;
  sub?: string;
  invert?: boolean;
  tone?: Tone;
  footer?: React.ReactNode;
  /** Only pass this when a real time series backs the figure — see BarSpark. */
  spark?: number[];
  sparkHue?: "violet" | "cyan" | "coral";
  sparkBaseline?: "zero" | "range";
  /** Where the customers behind this count are listed. Makes the whole card a link. */
  href?: string;
  /** What the figure means and how it is worked out. Falls back to the shared hint for this label. */
  help?: React.ReactNode;
}) {
  const tip = help ?? helpFor(label);
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="eyebrow leading-relaxed">{label}</p>
          {tip && <HelpTip title={label}>{tip}</HelpTip>}
        </div>
        <div className="flex items-center gap-3">
          {href && <ArrowUpRight size={14} strokeWidth={2.4} className="text-accent" aria-hidden />}
          {spark && <BarSpark values={spark} hue={sparkHue} baseline={sparkBaseline} height={24} />}
          {typeof delta === "number" && <DeltaPill value={delta} invert={invert} />}
        </div>
      </div>
      <div>
        <p className={`kpi-value text-[31.5px] leading-none ${tone ? toneClasses[tone].text : ""}`}>
          {value}
        </p>
        {sub && <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">{sub}</p>}
        {footer}
      </div>
    </>
  );
  const frame = "surface flex flex-col justify-between gap-4 p-5";
  return href ? (
    <Link href={href} className={`${frame} transition-colors hover:border-accent-border`}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}

/* ------------------------------------------------------------- Rail card */

/**
 * A card for the dashboard's right column. The eyebrow carries a small trend
 * glyph so a stack of these reads as a column of live readings rather than a
 * stack of unrelated boxes, and `aside` holds the one figure that belongs on
 * the title line.
 */
export function RailCard({
  eyebrow,
  aside,
  icon,
  help,
  className = "",
  bodyClassName = "",
  children,
}: {
  eyebrow: string;
  aside?: React.ReactNode;
  /** Defaults to a trend glyph; pass one that fits when the card isn't a reading. */
  icon?: React.ReactNode;
  /** Plain-language explanation behind a "?" beside the label. */
  help?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`surface overflow-hidden ${className}`}>
      {/* Top-aligned, not centred: a label long enough to take two lines
          was pulling the trend glyph down to sit between them and leaving
          the aside floating halfway down the card. */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <p className="eyebrow flex min-w-0 flex-wrap items-center gap-x-1.5">
          <span className="mt-px text-accent" aria-hidden>
            {icon ?? <TrendingUp size={12} strokeWidth={2.4} />}
          </span>
          {eyebrow}
          {help && <HelpTip title={eyebrow}>{help}</HelpTip>}
        </p>
        {aside && <span className="shrink-0 whitespace-nowrap">{aside}</span>}
      </div>
      <div className={`px-5 pb-5 pt-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------ Page head */

export function PageHeader({
  title,
  subtitle,
  engine,
  actions,
  breadcrumb,
  meta,
}: {
  title: string;
  subtitle: string;
  engine?: string;
  actions?: React.ReactNode;
  /** Trail above the title, e.g. ["Performance", "Command Centre"]. */
  breadcrumb?: string[];
  /**
   * Freshness / provenance. It shares the breadcrumb row when there is one, so
   * the header costs one row less and the metrics below it sit higher.
   */
  meta?: React.ReactNode;
}) {
  const hasCrumbRow = Boolean(breadcrumb?.length || meta);

  return (
    <header className="pb-2">
      {hasCrumbRow && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-8 gap-y-2">
          {breadcrumb?.length ? (
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-muted-foreground">
                {breadcrumb.map((crumb, i) => (
                  <li key={crumb} className="flex items-center gap-2">
                    {i > 0 && <span className="text-border">/</span>}
                    <span className={i === breadcrumb.length - 1 ? "text-navy" : undefined}>
                      {crumb}
                    </span>
                  </li>
                ))}
              </ol>
            </nav>
          ) : (
            <span />
          )}
          {meta}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="min-w-0 max-w-3xl">
          {engine && (
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
              {engine}
            </p>
          )}
          <h1 className="display-lg text-[33.5px] font-bold leading-[1.12] text-navy">
            {title}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-navy-muted">{subtitle}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * Heading that opens a major band of the page. It sits directly on the sheet
 * rather than inside a card, so the eye reads the page structure before it
 * reads containers.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
  help,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Explanation shown behind a "?" next to the title. */
  help?: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="flex scroll-mt-[96px] flex-wrap items-end justify-between gap-x-8 gap-y-3"
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2 text-accent">{eyebrow}</p>}
        <h2 className="display flex items-center gap-2.5 text-[22px] font-bold leading-snug text-navy">
          {title}
          {help && <HelpTip title={title}>{help}</HelpTip>}
        </h2>
        {description && (
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Meter({
  value,
  max = 100,
  tone = "accent",
  height = "h-1.5",
  track = "bg-muted",
  label,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  height?: string;
  track?: string;
  label?: string;
}) {
  const pctWidth = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={`w-full overflow-hidden rounded-full ${track} ${height}`}
    >
      <div
        className={`h-full rounded-full ${toneClasses[tone].dot} transition-[width] duration-500`}
        style={{ width: `${pctWidth}%` }}
      />
    </div>
  );
}

/* --------------------------------------------------------------- Insight */

export function Insight({
  tone = "accent",
  title,
  children,
  icon,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const t = toneClasses[tone];
  return (
    <div className={`flex gap-3.5 rounded-[14px] border p-4 ${t.bg} ${t.border}`}>
      {icon && <span className={`mt-0.5 shrink-0 ${t.text}`}>{icon}</span>}
      <div>
        {title && <p className={`mb-1 text-[13px] font-semibold ${t.text}`}>{title}</p>}
        <div className="text-[13.5px] leading-relaxed text-navy-soft">{children}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Table */

/**
 * `dense` tightens the horizontal padding on every cell. Wide tables — the rep
 * leaderboard runs to ten columns — were spending 40px per column on padding
 * alone and overflowing into a scrollbar on an ordinary laptop. Squeezing the
 * gutters buys back the width without dropping a single column, which is the
 * one thing these tables must not do.
 */
export function Table({
  children,
  dense = false,
  minWidth = 640,
}: {
  children: React.ReactNode;
  dense?: boolean;
  /** Below this the table scrolls horizontally rather than crushing columns. */
  minWidth?: number;
}) {
  return (
    // `relative` is load-bearing, not decoration: the screen-reader-only
    // spans inside Delta and the sortable headers are absolutely
    // positioned, and without a positioned ancestor here their containing
    // block is the sheet. They then lay out at the wide table's
    // coordinates, escape this scroller entirely, and push the whole page
    // sideways on a phone — a 1px invisible span dragging a 68px scrollbar
    // behind it.
    <div className="relative min-w-0 overflow-x-auto">
      <table
        className={`w-full border-collapse text-left ${dense ? "table-dense" : ""}`}
        style={{ minWidth: `${minWidth}px` }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className = "",
  ariaSort,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /** Sort state belongs on the header cell, not the button inside it. */
  ariaSort?: "ascending" | "descending" | "none";
}) {
  return (
    <th
      aria-sort={ariaSort}
      className={`table-head border-b border-border px-4 py-3 ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-border/70 px-4 py-3.5 text-[13px] text-navy-soft ${
        align === "right" ? "text-right tabular-nums" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------ Link chip */

export function LinkChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full text-[12.5px] font-semibold text-accent transition-colors hover:text-accent-dark"
    >
      {children}
      <ArrowUpRight size={13} strokeWidth={2.4} />
    </Link>
  );
}

/** Data-dependency note — SOW section 8: some capabilities activate only when
 *  LUSTRE supplies the underlying data. Surfacing this in-product keeps
 *  estimated outputs clearly labelled. */
export function DataNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 border-t border-border/60 pt-3 text-[12px] italic leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
