import "server-only";

/**
 * Sliding-window limiter capping calls to api.example.com at 100/minute —
 * the client's explicit instruction, to avoid overloading their server.
 *
 * ponytail: in-memory per-process state. Fine for a single dev server or one
 * long-running instance; on Vercel's serverless functions each cold start
 * gets its own counter, so the real ceiling across concurrent instances is
 * higher than 100/min. Upgrade to a shared store (Upstash/Redis) if traffic
 * ever runs on more than one warm instance at once.
 *
 * Cached on globalThis so Next's dev-server hot reload doesn't reset the
 * window on every edit (same pattern as lib/db/client.ts).
 */

const LIMIT = 100; // reverted — 200/min correlated with the API going empty under sustained load; back to the client's stated limit
const WINDOW_MS = 60_000;

type Bucket = { timestamps: number[] };

const globalForLimiter = globalThis as unknown as { __tradeApiBucket?: Bucket };
const bucket = globalForLimiter.__tradeApiBucket ?? { timestamps: [] };
globalForLimiter.__tradeApiBucket = bucket;

export type RateLimitStatus = {
  limit: number;
  remaining: number;
  resetInMs: number;
};

function prune(now: number) {
  const cutoff = now - WINDOW_MS;
  while (bucket.timestamps.length && bucket.timestamps[0] <= cutoff) {
    bucket.timestamps.shift();
  }
}

export function rateLimitStatus(): RateLimitStatus {
  const now = Date.now();
  prune(now);
  const oldest = bucket.timestamps[0];
  return {
    limit: LIMIT,
    remaining: Math.max(0, LIMIT - bucket.timestamps.length),
    resetInMs: oldest ? Math.max(0, oldest + WINDOW_MS - now) : 0,
  };
}

/** Reserves one call slot, waiting out the window if the limit is hit. */
export async function acquireSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    prune(now);
    if (bucket.timestamps.length < LIMIT) {
      bucket.timestamps.push(now);
      return;
    }
    const waitMs = bucket.timestamps[0] + WINDOW_MS - now;
    await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 50)));
  }
}
