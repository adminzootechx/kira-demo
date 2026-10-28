import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDatabaseAvailable } from "@/lib/db/client";
import {
  allCompanies, claimCompany, companiesFor, reassignCompany, removeCompany,
} from "@/lib/db/opportunities";
import type { AppSessionUser } from "@/lib/sessionUser";

export const dynamic = "force-dynamic";

const MESSAGES = {
  invalid: "Enter the company's name.",
  taken: "That company is already handled by another sales rep, so it can't be added.",
  "no-owner": "Your account is not linked to a salesperson name yet. Ask an administrator.",
} as const;

async function who() {
  const user = (await auth())?.user as unknown as AppSessionUser | undefined;
  if (!user) return { error: NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 }) };
  if (!(await isDatabaseAvailable())) {
    return { error: NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 }) };
  }
  return { user };
}

/** A salesperson gets only their own companies and scraper data on their own customers; management gets everything. */
export async function GET() {
  const { user, error } = await who();
  if (!user) return error;
  const rows = user.isSystem ? await allCompanies() : await companiesFor(user.ownerName ?? "\u0000none");
  return NextResponse.json({ isAdmin: user.isSystem, companies: rows });
}

/** Body: { name, country?, owner? } — owner is honoured for management only. */
export async function POST(request: Request) {
  const { user, error } = await who();
  if (!user) return error;
  const body = (await request.json().catch(() => ({}))) as { name?: string; country?: string; owner?: string | null };

  const owner = user.isSystem ? (body.owner?.trim() || null) : user.ownerName;
  const result = await claimCompany({
    name: body.name ?? "", country: body.country, owner: user.isSystem ? owner : (owner ?? ""), addedBy: user.name ?? user.email,
  });
  if (!result.ok) {
    return NextResponse.json({ error: MESSAGES[result.reason] }, { status: result.reason === "taken" ? 409 : 400 });
  }
  return NextResponse.json({
    status: result.status,
    message: result.status === "yours" ? "That company is already yours." : "Added to your companies.",
  });
}

/** ?key= — a salesperson can remove only what they hold; management can remove any. */
export async function DELETE(request: Request) {
  const { user, error } = await who();
  if (!user) return error;
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const removed = await removeCompany(key, user.isSystem ? null : (user.ownerName ?? "\u0000none"));
  return removed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}

/** Management only. Body: { key, owner: string | null } */
export async function PATCH(request: Request) {
  const { user, error } = await who();
  if (!user) return error;
  if (!user.isSystem) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const { key, owner } = (await request.json().catch(() => ({}))) as { key?: string; owner?: string | null };
  if (!key) return NextResponse.json({ error: "Choose a company." }, { status: 400 });
  const ok = await reassignCompany(key, owner?.trim() || null);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: MESSAGES.taken }, { status: 409 });
}
