"use client";

import { useEffect } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

/**
 * The last line of defence: an error thrown by the root layout itself, which
 * `app/error.tsx` sits inside and therefore cannot catch. This replaces the
 * layout entirely, so it has to supply its own `<html>`, `<body>`, fonts and
 * stylesheet, and it deliberately renders no sidebar, topbar or context
 * provider — any of those could be the thing that just failed.
 *
 * For the same reason it uses a plain anchor rather than `next/link`: a hard
 * navigation rebuilds the app from scratch, which is what a user needs when
 * the shell itself is broken.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[LUSTRE] Application shell failed", error);
  }, [error]);

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
          <section className="surface relative w-full overflow-hidden">
            <span className="absolute inset-x-0 top-0 h-[3px] bg-negative" aria-hidden />
            <div className="px-8 pb-8 pt-9">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="kpi-value text-[35.5px] leading-none text-negative">500</p>
                <p className="eyebrow">Application error</p>
              </div>

              <h1 className="display-lg mt-4 text-[25px] font-bold leading-tight text-navy">
                LUSTRE could not start
              </h1>
              <p className="mt-2.5 text-[14px] leading-relaxed text-navy-muted">
                The application shell failed to load, so the dashboard could not be
                rendered at all. This is a fault in the platform rather than in your
                data — no sales record has been affected.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={() => retry()} className="btn btn-primary">
                  Reload LUSTRE
                </button>
                {/* Deliberately a plain anchor, not `next/link`: the client
                    router lives inside the shell that just failed, so only a
                    full document load is guaranteed to get the user out. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className="btn btn-secondary">
                  Return to Command Centre
                </a>
              </div>

              <dl className="mt-7 grid gap-x-8 gap-y-3 border-t border-border pt-5 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="eyebrow">Error code</dt>
                  <dd className="mt-1.5 truncate font-mono text-[12.5px] text-navy-soft">LUSTRE-APP-1</dd>
                </div>
                <div className="min-w-0">
                  <dt className="eyebrow">Reference</dt>
                  <dd className="mt-1.5 truncate font-mono text-[12.5px] text-navy-soft">
                    {error.digest ?? "not available"}
                  </dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="eyebrow">Detail</dt>
                  <dd className="mt-1.5 truncate font-mono text-[12.5px] text-navy-soft">
                    {error.message || "No message was reported"}
                  </dd>
                </div>
              </dl>

              <p className="mt-6 border-t border-border/60 pt-4 text-[12px] leading-relaxed text-muted-foreground">
                If reloading does not help, quote the reference above to your LUSTRE
                administrator — it matches this failure to the server log.
              </p>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
