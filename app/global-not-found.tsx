/* This page renders instead of the app, so there is no client router on it and
   no layout to navigate within — every link out has to be a real document
   request. `next/link` would be wrong here, not merely unnecessary. */
/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ArrowRight, Compass } from "lucide-react";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Page not found — LUSTRE Sales Intelligence",
  description: "The address does not match any screen in the platform.",
};

/**
 * The 404 for a URL that matches no route at all. Next resolves this at the
 * routing layer and skips rendering the app entirely, so it owns the whole
 * viewport — no sidebar, no topbar, no shell chrome behind it. That is the
 * point: a mistyped address is not a screen *inside* the product, and framing
 * it as one made it read like a broken page rather than a wrong door.
 *
 * Because the root layout never runs, this file supplies its own `<html>`,
 * `<body>`, font and stylesheet, and links out with plain anchors — the client
 * router does not exist on this page.
 */
const destinations = [
  { href: "/", label: "Command Centre", description: "Headline performance and the daily briefing" },
  { href: "/customers", label: "Customers", description: "Accounts, health scores and RFM segments" },
  { href: "/priorities", label: "Daily Priorities", description: "The ranked action queue for today" },
  { href: "/exceptions", label: "Exceptions", description: "Margin, credit and inventory alerts" },
];

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
          {/* The mark stands in for the shell that is deliberately absent, so
              the page still reads as LUSTRE rather than as a server default. */}
          <div className="mb-10 flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-navy text-[16px] font-bold text-white">
              K
            </span>
            <span className="display text-[18px] font-bold leading-none text-navy">LUSTRE</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Sales Intelligence
            </span>
          </div>

          <section className="surface relative overflow-hidden">
            <span className="absolute inset-x-0 top-0 h-[3px] bg-info" aria-hidden />

            <div className="flex flex-col gap-6 px-8 pb-8 pt-9 sm:flex-row sm:gap-8">
              <Compass size={30} strokeWidth={1.6} className="shrink-0 text-info" aria-hidden />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="kpi-value text-[35.5px] leading-none text-info">404</p>
                  <p className="eyebrow">Page not found</p>
                </div>

                <h1 className="display-lg mt-4 text-[25px] font-bold leading-tight text-navy">
                  This address is not part of LUSTRE
                </h1>
                <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-navy-muted">
                  The URL you followed does not match any screen in the platform. It may
                  have been renamed since the link was shared, or the record it pointed at
                  may no longer exist.
                </p>
                <p className="mt-2 font-mono text-[11.5px] text-muted-foreground">LUSTRE-APP-2</p>

                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                  <a href="/" className="btn btn-primary">
                    Go to Command Centre
                  </a>
                  <a href="/copilot" className="btn btn-secondary">
                    Ask the Copilot to find it
                  </a>
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-secondary/50 px-8 py-6">
              <p className="eyebrow">Continue from here</p>
              <ul className="mt-3.5 grid gap-x-8 sm:grid-cols-2">
                {destinations.map((d) => (
                  <li
                    key={d.href}
                    className="border-b border-border/70 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0"
                  >
                    <a
                      href={d.href}
                      className="group flex items-baseline justify-between gap-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-navy transition-colors group-hover:text-accent-dark">
                          {d.label}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                          {d.description}
                        </span>
                      </span>
                      <ArrowRight
                        size={13}
                        className="mt-0.5 shrink-0 text-muted-foreground transition-colors group-hover:text-accent-dark"
                        aria-hidden
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
