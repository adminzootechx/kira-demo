import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { toneClasses, type Tone } from "@/lib/format";

/**
 * The shared frame for every terminal state the product can land on — 404, 403,
 * 401 and uncaught exceptions. They all read as one family so a user who hits
 * one recognises it as part of LUSTRE rather than as a broken page.
 *
 * Composition follows the same rules as the rest of the product: the status
 * code is a figure (tracked in, tabular), colour is confined to a hairline rail
 * and the glyph, and the recovery routes are listed rather than hidden behind a
 * single "go home" button — the point of the page is to cost the user fewer
 * clicks, not more.
 */

export type StatusRoute = { href: string; label: string; description: string };

export function StatusPage({
  code,
  tone = "neutral",
  eyebrow,
  title,
  description,
  icon,
  detail,
  actions,
  routes,
}: {
  /** HTTP status, or a short word for states that have none. */
  code: string;
  tone?: Tone;
  eyebrow: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  /** Diagnostics — the error digest, the path that missed, the signed-in role. */
  detail?: { label: string; value: string }[];
  actions?: React.ReactNode;
  routes?: StatusRoute[];
}) {
  const t = toneClasses[tone];

  return (
    <div className="mx-auto w-full max-w-3xl py-6">
      <section className="surface relative overflow-hidden">
        <span className={`absolute inset-x-0 top-0 h-[3px] ${t.dot}`} aria-hidden />

        <div className="flex flex-col gap-6 px-8 pb-8 pt-9 sm:flex-row sm:gap-8">
          {icon && (
            <span className={`shrink-0 ${t.text}`} aria-hidden>
              {icon}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className={`kpi-value text-[35.5px] leading-none ${t.text}`}>{code}</p>
              <p className="eyebrow">{eyebrow}</p>
            </div>

            <h1 className="display-lg mt-4 text-[25px] font-bold leading-tight text-navy">
              {title}
            </h1>
            <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-navy-muted">
              {description}
            </p>

            {actions && (
              <div className="mt-6 flex flex-wrap items-center gap-2.5">{actions}</div>
            )}

            {detail && detail.length > 0 && (
              <dl className="mt-7 grid gap-x-8 gap-y-3 border-t border-border pt-5 sm:grid-cols-2">
                {detail.map((d) => (
                  <div key={d.label} className="min-w-0">
                    <dt className="eyebrow">{d.label}</dt>
                    <dd className="mt-1.5 truncate font-mono text-[12.5px] text-navy-soft" title={d.value}>
                      {d.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {routes && routes.length > 0 && (
          <div className="border-t border-border bg-secondary/50 px-8 py-6">
            <p className="eyebrow">Continue from here</p>
            <ul className="mt-3.5 grid gap-x-8 sm:grid-cols-2">
              {routes.map((r) => (
                <li key={r.href} className="border-b border-border/70 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
                  <Link
                    href={r.href}
                    className="group flex items-baseline justify-between gap-4 py-3 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-navy group-hover:text-accent-dark">
                        {r.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                        {r.description}
                      </span>
                    </span>
                    <ArrowRight
                      size={13}
                      className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-accent-dark"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

/** The destinations offered on a 404 — the four surfaces people actually want. */
export const primaryRoutes: StatusRoute[] = [
  { href: "/", label: "Command Centre", description: "Headline performance and the daily briefing" },
  { href: "/customers", label: "Customers", description: "Accounts, health scores and RFM segments" },
  { href: "/priorities", label: "Daily Priorities", description: "The ranked action queue for today" },
  { href: "/exceptions", label: "Exceptions", description: "Margin, credit and inventory alerts" },
];
