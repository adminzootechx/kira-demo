import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { userPreferences } from "@/lib/db/schema";
import type { AppSessionUser } from "@/lib/sessionUser";
import { logError } from "@/lib/errorCodes";

export const dynamic = "force-dynamic";

/** One row per user in the generic `user_preferences` key/value table,
 *  keyed "account-settings" — not localStorage. A shared browser (two reps
 *  on the same machine, or this session testing both demo accounts back to
 *  back) was showing one account's saved name/title on another's screen,
 *  since localStorage has no notion of which account is signed in. */
const KEY = "account-settings";

export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as AppSessionUser | undefined;
  if (!user) return NextResponse.json({ error: "Not signed in. (LUSTRE-AUTH-1)" }, { status: 401 });

  try {
    const [row] = await getDb()
      .select({ value: userPreferences.value })
      .from(userPreferences)
      .where(and(eq(userPreferences.userId, Number(user.id)), eq(userPreferences.key, KEY)));

    return NextResponse.json({ settings: row?.value ?? null });
  } catch (err) {
    logError("LUSTRE-DATA-1", "api/account/settings GET", err);
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  const user = session?.user as unknown as AppSessionUser | undefined;
  if (!user) return NextResponse.json({ error: "Not signed in. (LUSTRE-AUTH-1)" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid settings payload. (LUSTRE-DATA-2)" }, { status: 400 });
  }

  try {
    const userId = Number(user.id);
    const db = getDb();
    const [existing] = await db
      .select({ id: userPreferences.id })
      .from(userPreferences)
      .where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, KEY)));

    if (existing) {
      await db
        .update(userPreferences)
        .set({ value: body, updatedAt: new Date() })
        .where(eq(userPreferences.id, existing.id));
    } else {
      await db.insert(userPreferences).values({ userId, key: KEY, value: body });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("LUSTRE-DATA-1", "api/account/settings PUT", err);
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
}
