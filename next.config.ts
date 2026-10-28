import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `lib/data/snapshot.ts` reads the committed export capture with `fs` at
   * request time, and a path built at runtime is invisible to output file
   * tracing — the routes would deploy without their data and silently fall
   * back to the sample book. Keys are route globs; values resolve from the
   * project root.
   */
  outputFileTracingIncludes: {
    "/api/book": ["./data/**"],
    "/api/team/tiers": ["./data/**"],
    "/api/customers/orders": ["./data/**"],
    "/api/customers/orders/stones": ["./data/**"],
    "/api/dimensions": ["./data/**"],
  },

  experimental: {
    /**
     * Enables the `forbidden()` and `unauthorized()` interrupts, which render
     * `app/forbidden.tsx` (403) and `app/unauthorized.tsx` (401). LUSTRE gates
     * several surfaces on the management role, so it needs a real answer for
     * "signed in, but not allowed" that is distinct from a 404.
     */
    authInterrupts: true,

    /**
     * Routes unmatched URLs to `app/global-not-found.tsx`, which renders
     * instead of the app rather than inside it. Without this the 404 comes up
     * within the dashboard shell, framed like a screen of the product; a
     * mistyped address should own the whole viewport.
     */
    globalNotFound: true,
  },
};

export default nextConfig;
