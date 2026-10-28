"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { AppSessionUser } from "@/lib/sessionUser";

export type Viewer = {
  name: string;
  email: string;
  initials: string;
  /** Role label stands in for a job title — the app doesn't collect one. */
  title: string;
  team: string;
  market: string;
  joined: string;
};

const FALLBACK_VIEWER: Viewer = {
  name: "", email: "", initials: "", title: "", team: "—", market: "—", joined: "",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Everything about "who is signed in" now comes from the Auth.js session —
 * role, department, and market are admin-assigned rows in Postgres, not a
 * client-toggleable two-value union. `role` here is the role's stable `key`
 * (e.g. "management", "rep", or any custom role an admin creates).
 */
export function useRole() {
  const { data: session, status } = useSession();
  const user = session?.user as unknown as AppSessionUser | undefined;

  const viewer: Viewer = user
    ? {
        name: user.name,
        email: user.email,
        initials: initialsOf(user.name) || "?",
        title: user.roleLabel,
        team: user.departmentName ?? "—",
        market: user.marketName ?? "—",
        joined: user.createdAt ? monthYear(user.createdAt) : "—",
      }
    : FALLBACK_VIEWER;

  return {
    role: user?.roleKey ?? "management",
    roleLabel: user?.roleLabel ?? "",
    isSystem: user?.isSystem ?? true,
    loading: status === "loading",
    viewer,
  };
}

type PermissionsResponse = { isSystem: boolean; permissions: Record<string, boolean> };

/**
 * The signed-in user's page permission map, fetched once per session. An
 * isSystem role gets `isSystem: true` back and the caller should treat every
 * page as allowed rather than consulting `permissions` at all.
 */
export function usePermissions() {
  const { status } = useSession();
  const [data, setData] = useState<PermissionsResponse | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/access/mine", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: PermissionsResponse) => {
        if (!cancelled) setData(body);
      })
      .catch(() => {
        if (!cancelled) setData({ isSystem: false, permissions: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return {
    loading: status === "loading" || (status === "authenticated" && data === null),
    isSystem: data?.isSystem ?? false,
    permissions: data?.permissions ?? {},
  };
}
