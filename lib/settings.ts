/**
 * Account settings model.
 *
 * Persisted server-side, one row per signed-in user in the generic
 * `user_preferences` table (`/api/account/settings`) — not localStorage.
 * Browser storage has no notion of which account is signed in, so on a
 * shared machine (or one session testing two demo accounts back to back)
 * one user's saved name/title would show up on another's screen the moment
 * they opened Account Settings. See `useAccountSettings` below.
 */

export type AccountSettings = {
  /* Profile */
  name: string;
  title: string;
  email: string;
  phone: string;
  market: string;

  /* Preferences */
  landingPage: string;
  currencyFormat: "compact" | "full";
  dateFormat: "dmy" | "mdy" | "iso";
  weekStart: "monday" | "sunday";
  timezone: string;
  density: "comfortable" | "compact";
  reduceMotion: boolean;

  /* Notifications */
  channelInApp: boolean;
  channelEmail: boolean;
  digest: "realtime" | "daily" | "weekly" | "off";
  quietHours: boolean;
  categories: Record<NotificationCategory, boolean>;

  /* Security */
  twoFactor: boolean;
  sessionTimeout: "30" | "60" | "240" | "never";
};

export const notificationCategories = [
  { id: "churn", label: "Churn risk", description: "Customers showing elevated churn signals" },
  { id: "target", label: "Target risk", description: "Portfolios or markets falling behind plan" },
  { id: "pricing", label: "Pricing anomalies", description: "Discounts outside the peer benchmark" },
  { id: "inventory", label: "Inventory & demand", description: "Stock ageing and demand weakness" },
  { id: "coverage", label: "Coverage gaps", description: "Accounts with no contact in 30+ days" },
  { id: "activity", label: "Team activity", description: "Reps below the weekly activity benchmark" },
  { id: "opportunity", label: "Growth opportunities", description: "Upsell, cross-sell and recovery signals" },
] as const;

export type NotificationCategory = (typeof notificationCategories)[number]["id"];

export const landingPages = [
  { value: "/", label: "Home" },
  { value: "/customers", label: "Customers" },
  { value: "/targets", label: "Targets" },
  { value: "/priorities", label: "My day" },
  { value: "/products", label: "Stock" },
  { value: "/pricing", label: "Prices" },
  { value: "/team", label: "Team" },
  { value: "/exceptions", label: "Things to check" },
  { value: "/sales-navigator", label: "New buyers" },
];

export const timezones = [
  { value: "Asia/Kolkata", label: "Mumbai · IST (UTC+5:30)" },
  { value: "Asia/Dubai", label: "Dubai · GST (UTC+4)" },
  { value: "Europe/Brussels", label: "Antwerp · CET (UTC+1)" },
  { value: "Asia/Jerusalem", label: "Tel Aviv · IST (UTC+2)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong · HKT (UTC+8)" },
  { value: "America/New_York", label: "New York · EST (UTC−5)" },
];

export function defaultSettings(viewer: {
  name: string;
  title: string;
  email: string;
  market: string;
}): AccountSettings {
  return {
    name: viewer.name,
    title: viewer.title,
    email: viewer.email,
    // No phone number is collected at sign-in — the user fills this in
    // themselves; there is no real value to default it to.
    phone: "",
    market: viewer.market,

    landingPage: "/",
    currencyFormat: "compact",
    dateFormat: "dmy",
    weekStart: "monday",
    timezone: "Asia/Kolkata",
    density: "comfortable",
    reduceMotion: false,

    channelInApp: true,
    channelEmail: true,
    digest: "daily",
    quietHours: false,
    categories: {
      churn: true,
      target: true,
      pricing: true,
      inventory: true,
      coverage: false,
      activity: true,
      opportunity: true,
    },

    twoFactor: true,
    sessionTimeout: "240",
  };
}

/* --------------------------------------------------------------- Store */

/** Merges a raw saved record over the defaults, tolerating absent or malformed data. */
export function mergeSettings(fallback: AccountSettings, raw: Partial<AccountSettings> | null): AccountSettings {
  if (!raw) return fallback;
  return {
    ...fallback,
    ...raw,
    categories: { ...fallback.categories, ...(raw.categories ?? {}) },
  };
}

/** GET — the signed-in user's saved settings record, or null if they have none yet.
 *  Throws the server's own message (carries a LUSTRE-* code) on failure, not a
 *  generic one, so the caller's toast can show the code. */
export async function loadSettings(): Promise<Partial<AccountSettings> | null> {
  const res = await fetch("/api/account/settings", { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as {
    settings?: Partial<AccountSettings> | null;
    error?: string;
  };
  if (!res.ok) throw new Error(body.error ?? "Could not load settings.");
  return body.settings ?? null;
}

/** PUT — replaces the signed-in user's saved settings record. Returns the
 *  server's error message (with its code) on failure, or null on success. */
export async function saveSettings(settings: AccountSettings): Promise<string | null> {
  try {
    const res = await fetch("/api/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) return null;
    const body = await res.json().catch(() => ({}));
    return (body as { error?: string }).error ?? "Could not save settings.";
  } catch {
    return "Could not reach the server. (LUSTRE-DATA-1)";
  }
}

/** Field-level diff, so the save bar can say exactly how much is pending. */
export function countChanges(a: AccountSettings, b: AccountSettings): number {
  let n = 0;
  (Object.keys(a) as (keyof AccountSettings)[]).forEach((k) => {
    if (k === "categories") {
      const ac = a.categories;
      const bc = b.categories;
      (Object.keys(ac) as NotificationCategory[]).forEach((c) => {
        if (ac[c] !== bc[c]) n += 1;
      });
      return;
    }
    if (a[k] !== b[k]) n += 1;
  });
  return n;
}
