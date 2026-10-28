import "server-only";

import { acquireSlot } from "./rateLimiter";
import { logError } from "../errorCodes";

/**
 * Client for the trade data API (api.example.com).
 * See LustreDashboard_API_Documentation.txt for the full spec.
 */

const BASE_URL = "https://api.example.com";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // token is valid 24h per the doc

type TokenCache = { token: string; expiresAt: number } | null;
const globalForToken = globalThis as unknown as { __tradeApiToken?: TokenCache };

export type StoneDetail = Record<string, string>;

export type SalesDataResult = {
  code: number;
  flag: boolean;
  message: string;
  totalCount: number;
  rows: StoneDetail[];
};

async function verifyUser(passwordOverride?: string): Promise<string> {
  const username = process.env.TRADE_API_USERNAME;
  const password = passwordOverride || process.env.TRADE_API_PASSWORD;
  if (!username || !password) {
    throw new Error("TRADE_API_USERNAME / TRADE_API_PASSWORD not set.");
  }

  await acquireSlot();
  const url = new URL(`${BASE_URL}/api/ApiOrder/VerifyUser`);
  url.searchParams.set("username", username);
  url.searchParams.set("password", password);

  const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(90_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) {
    logError("LUSTRE-SYNC-1", "tradeapi/client.verifyUser", body.message ?? res.status);
    throw new Error(`${body.message || `VerifyUser failed (${res.status})`} (LUSTRE-SYNC-1)`);
  }
  return body.token as string;
}

async function getToken(): Promise<string> {
  const cached = globalForToken.__tradeApiToken;
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const token = await verifyUser();
  globalForToken.__tradeApiToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

/**
 * Signs in with a passkey a user typed at login and caches only the resulting
 * 24-hour token, so later calls need no password. The passkey itself is not kept.
 */
export async function signInWithPasskey(passkey: string): Promise<void> {
  const token = await verifyUser(passkey);
  globalForToken.__tradeApiToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
}

export type FetchSalesDataParams = {
  startRow: number;
  endRow: number;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  salePerson?: string;
  party2?: string;
  fields?: string[];
};

export async function fetchSalesData(params: FetchSalesDataParams): Promise<SalesDataResult> {
  const token = await getToken();

  await acquireSlot();
  const res = await fetch(`${BASE_URL}/api/ApiOrder/GetPowerbisalesdata`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      StartRow: params.startRow,
      EndRow: params.endRow,
      OrderFromDate: params.fromDate,
      OrderToDate: params.toDate,
      SalePerson: params.salePerson ?? null,
      Party2: params.party2 ?? null,
      Fields: params.fields ?? null,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    logError("LUSTRE-SYNC-2", "tradeapi/client.fetchSalesData", body.message ?? res.status);
    throw new Error(`${body.message || `GetPowerbisalesdata failed (${res.status})`} (LUSTRE-SYNC-2)`);
  }

  return {
    code: body.Code,
    flag: body.Flag,
    message: body.Message,
    totalCount: Number(body.Data?.TotalCount ?? 0),
    rows: body.Data?.stoneDetailsales ?? [],
  };
}
