import "server-only";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import { externalCompanies } from "./schema";
import { getActiveBook } from "./repository";
import { companyKey, sameRep } from "@/lib/companyKey";

export type ExternalCompany = typeof externalCompanies.$inferSelect;

export type ClaimResult =
  | { ok: true; status: "added" | "yours"; company: ExternalCompany | null }
  | { ok: false; reason: "invalid" | "taken" | "no-owner" };

/** Every customer in the book, keyed the same way as external companies. */
async function bookOwners() {
  const book = await getActiveBook();
  return new Map((book?.customers ?? []).map((c) => [companyKey(c.name), c.owner] as const));
}

/**
 * The one rule: a company belongs to one salesperson. A company is free to add
 * only if it is not already a customer handled by someone else and not already
 * claimed by someone else. Reasons are deliberately generic so a salesperson
 * cannot learn who holds a company they are blocked from.
 */
export async function claimCompany(input: { name: string; country?: string; owner: string | null; addedBy: string }): Promise<ClaimResult> {
  const key = companyKey(input.name);
  if (!key || !input.name.trim()) return { ok: false, reason: "invalid" };
  if (input.owner !== null && !input.owner.trim()) return { ok: false, reason: "no-owner" };

  const db = getDb();
  if (input.owner !== null) {
    const customerOwner = (await bookOwners()).get(key);
    if (customerOwner !== undefined) {
      return sameRep(customerOwner, input.owner)
        ? { ok: true, status: "yours", company: null }
        : { ok: false, reason: "taken" };
    }
  }

  const [existing] = await db.select().from(externalCompanies).where(eq(externalCompanies.companyKey, key));
  if (existing) {
    if (input.owner === null || sameRep(existing.owner, input.owner)) return { ok: true, status: "yours", company: existing };
    if (existing.owner) return { ok: false, reason: "taken" };
    // Unclaimed (e.g. loaded by the scraper): the first salesperson to claim it gets it.
    const [claimed] = await db.update(externalCompanies)
      .set({ owner: input.owner, addedBy: input.addedBy, updatedAt: new Date() })
      .where(and(eq(externalCompanies.companyKey, key), isNull(externalCompanies.owner)))
      .returning();
    return claimed ? { ok: true, status: "added", company: claimed } : { ok: false, reason: "taken" };
  }

  const [created] = await db.insert(externalCompanies)
    .values({ companyKey: key, name: input.name.trim(), country: input.country?.trim() || null, owner: input.owner, addedBy: input.addedBy })
    .onConflictDoNothing()
    .returning();
  return created ? { ok: true, status: "added", company: created } : { ok: false, reason: "taken" };
}

/** What a salesperson may see: companies they hold, plus scraper data on their own customers. */
export async function companiesFor(owner: string): Promise<(ExternalCompany & { isClient: boolean })[]> {
  const book = await getActiveBook({ ownerName: owner });
  const myClients = new Set((book?.customers ?? []).map((c) => companyKey(c.name)));
  const rows = await getDb().select().from(externalCompanies).where(
    myClients.size
      ? or(eq(externalCompanies.owner, owner), inArray(externalCompanies.companyKey, [...myClients]))
      : eq(externalCompanies.owner, owner),
  );
  // A row that merely matches a client must not be someone else's claim.
  return rows
    .filter((r) => sameRep(r.owner, owner) || (r.owner === null && myClients.has(r.companyKey)))
    .map((r) => ({ ...r, isClient: myClients.has(r.companyKey) }));
}

export async function allCompanies() {
  const owners = await bookOwners();
  const rows = await getDb().select().from(externalCompanies).orderBy(externalCompanies.name);
  return rows.map((r) => ({ ...r, isClient: owners.has(r.companyKey) }));
}

export async function removeCompany(key: string, owner: string | null) {
  const cond = owner === null
    ? eq(externalCompanies.companyKey, key)
    : and(eq(externalCompanies.companyKey, key), sql`lower(regexp_replace(trim(${externalCompanies.owner}), '[[:space:]]+', ' ', 'g')) = ${owner.trim().replace(/\s+/g, " ").toLowerCase()}`);
  const gone = await getDb().delete(externalCompanies).where(cond).returning({ k: externalCompanies.companyKey });
  return gone.length > 0;
}

/** Admin: give a company to a salesperson, or release it (null). A customer's own owner still wins. */
export async function reassignCompany(key: string, owner: string | null) {
  if (owner !== null) {
    const customerOwner = (await bookOwners()).get(key);
    if (customerOwner !== undefined && !sameRep(customerOwner, owner)) return false;
  }
  const done = await getDb().update(externalCompanies).set({ owner, updatedAt: new Date() })
    .where(eq(externalCompanies.companyKey, key)).returning({ k: externalCompanies.companyKey });
  return done.length > 0;
}

/** Scraper intake: inserts new companies unowned and refreshes the scraped data on existing ones. */
export async function ingestCompanies(items: { name: string; country?: string; data?: unknown }[]) {
  let n = 0;
  for (const it of items) {
    const key = companyKey(it.name ?? "");
    if (!key) continue;
    await getDb().insert(externalCompanies)
      .values({ companyKey: key, name: it.name.trim(), country: it.country?.trim() || null, data: it.data ?? null })
      .onConflictDoUpdate({
        target: externalCompanies.companyKey,
        set: { data: it.data ?? null, country: it.country?.trim() || null, updatedAt: new Date() },
      });
    n += 1;
  }
  return n;
}
