import "server-only";

/**
 * Brute-force guard for the credentials login. Locks an email out after 5
 * failed attempts within a 15-minute window.
 *
 * ponytail: in-memory per-process state, same ceiling as
 * lib/tradeapi/rateLimiter.ts — fine for one dev/warm instance, not a real
 * limit across multiple serverless instances on Vercel. Move to a shared
 * store (Upstash/Redis) if this ever needs to hold under real traffic.
 *
 * Cached on globalThis so Next's dev-server hot reload doesn't reset it.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;

type Attempts = Map<string, number[]>;

const globalForAttempts = globalThis as unknown as { __lustreLoginAttempts?: Attempts };
const attempts = globalForAttempts.__lustreLoginAttempts ?? new Map();
globalForAttempts.__lustreLoginAttempts = attempts;

function prune(email: string, now: number): number[] {
  const timestamps = (attempts.get(email) ?? []).filter((t: number) => t > now - WINDOW_MS);
  attempts.set(email, timestamps);
  return timestamps;
}

/** Throws if this email is currently locked out. */
export function assertNotLockedOut(email: string): void {
  const now = Date.now();
  const timestamps = prune(email, now);
  if (timestamps.length >= MAX_ATTEMPTS) {
    const retryInMs = timestamps[0] + WINDOW_MS - now;
    const retryInMin = Math.max(1, Math.ceil(retryInMs / 60_000));
    throw new Error(`Too many attempts. Try again in ${retryInMin} minute${retryInMin === 1 ? "" : "s"}. (LUSTRE-AUTH-3)`);
  }
}

export function recordFailedAttempt(email: string): void {
  const now = Date.now();
  const timestamps = prune(email, now);
  timestamps.push(now);
  attempts.set(email, timestamps);
}

export function clearAttempts(email: string): void {
  attempts.delete(email);
}
