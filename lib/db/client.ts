import "server-only";

import { neonConfig, Pool as WsPool } from "@neondatabase/serverless";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Database handle, created on first use.
 *
 * Laziness is the whole point. The pool used to be built at module load, which
 * meant that merely importing this file threw when `DATABASE_URL` was unset —
 * before `isDatabaseAvailable()` could return a polite `false`. Every route
 * that imports it then 500s on a deployment with no database configured,
 * instead of degrading to the snapshot or the sample book. Nothing here
 * touches Postgres until something actually asks for a query.
 *
 * Next dev reloads modules on every edit, so the pools are cached on
 * `globalThis` — without that, each hot reload opens a fresh pool and Postgres
 * runs out of connections within a few minutes of editing.
 *
 * Two databases can be configured (see docs/server-setup.md):
 * - the primary, `DATABASE_URL`. When it is the private LUSTRE server, Vercel
 *   cannot reach it over plain TCP, so `DATABASE_WS_PROXY` (the server's public
 *   address) and `DATABASE_WS_KEY` (its gate key) route it over a WebSocket.
 * - the backup, `DATABASE_URL_BACKUP` (Neon), refreshed from the primary every
 *   night and used only while the primary is unreachable.
 */

export type Db = NodePgDatabase<typeof schema>;
type Target = "primary" | "backup";

const globalForDb = globalThis as unknown as { lustrePools?: Partial<Record<Target, Pool>> };
const pools: Partial<Record<Target, Pool>> = globalForDb.lustrePools ?? {};
if (process.env.NODE_ENV !== "production") globalForDb.lustrePools = pools;
const dbs: Partial<Record<Target, Db>> = {};

/** Which database queries go to. Flips to "backup" only inside `isDatabaseAvailable()`. */
let active: Target = "primary";
let lastPrimaryTry = 0;
/** While on the backup, how often to check whether the primary is back. */
const RETRY_PRIMARY_MS = 60_000;

function createPool(target: Target): Pool {
  const backupUrl = process.env.DATABASE_URL_BACKUP;
  if (target === "backup") return new Pool({ connectionString: backupUrl, max: 8, idleTimeoutMillis: 30_000 });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in a Postgres connection string (e.g. from a free Neon project).",
    );
  }
  // With a backup to fall back to, give up on a dead primary quickly instead of
  // hanging every request on the TCP timeout.
  const options = { connectionString, max: 8, idleTimeoutMillis: 30_000, connectionTimeoutMillis: backupUrl ? 5_000 : undefined };

  const proxyUrl = process.env.DATABASE_WS_PROXY;
  if (!proxyUrl) return new Pool(options);
  const proxy = proxyUrl.replace(/^\w+:\/\//, "").replace(/\/+$/, "");

  const key = process.env.DATABASE_WS_KEY ?? "";
  neonConfig.wsProxy = (host, port) => `${proxy}/v1?address=${host}:${port}`;
  // The server's gate rejects any connection without this header.
  neonConfig.webSocketConstructor = class extends WebSocket {
    constructor(url: string | URL) {
      super(url, { headers: { "X-Lustre-Key": key } } as unknown as string[]);
    }
  };
  // The tunnel serves HTTPS; plain http:// is only for testing on one machine.
  neonConfig.useSecureWebSocket = !/^(http|ws):\/\//.test(proxyUrl);
  neonConfig.forceDisablePgSSL = true; // already encrypted by the tunnel; Postgres itself is localhost-only
  neonConfig.pipelineConnect = false;
  neonConfig.pipelineTLS = false;
  return new WsPool(options) as unknown as Pool;
}

function poolFor(target: Target): Pool {
  return (pools[target] ??= createPool(target));
}

export function getPool(): Pool {
  return poolFor(active);
}

/** The Drizzle handle. Throws only if called without `DATABASE_URL` set. */
export function getDb(): Db {
  return (dbs[active] ??= drizzle(getPool(), { schema }));
}

async function ping(target: Target): Promise<boolean> {
  try {
    await poolFor(target).query("select 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Leaves a mark on the backup that it took writes. The nightly refresh on the
 * server checks for it and refuses to overwrite the backup until someone has
 * looked, so changes made during an outage are never silently lost.
 */
async function markFailover() {
  try {
    const backup = poolFor("backup");
    await backup.query("create table if not exists lustre_failover (at timestamptz not null default now())");
    await backup.query("insert into lustre_failover default values");
  } catch (err) {
    console.error("[db] could not record the switch to the backup database", err);
  }
}

/**
 * Whether a database is reachable, switching between primary and backup.
 *
 * Every read path checks this and falls back to the committed snapshot, then
 * to the in-memory sample book, so a missing or unreachable database degrades
 * the product rather than breaking every page.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;

  // While on the backup, knock on the primary once a minute, not on every request.
  if (active === "primary" || Date.now() - lastPrimaryTry > RETRY_PRIMARY_MS) {
    lastPrimaryTry = Date.now();
    if (await ping("primary")) {
      if (active === "backup") console.warn("[db] primary database is back; switching to it");
      active = "primary";
      return true;
    }
  }

  if (!process.env.DATABASE_URL_BACKUP || !(await ping("backup"))) return false;
  if (active === "primary") {
    console.error("[db] primary database unreachable; using the backup (Neon)");
    active = "backup";
    await markFailover();
  }
  return true;
}
