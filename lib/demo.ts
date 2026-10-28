import { navigation } from "@/components/shell/nav";
import type { AppSessionUser } from "@/lib/sessionUser";

/**
 * Demo mode: no `DATABASE_URL`, so the app runs on the generated dataset in
 * `data/` and these two built-in accounts stand in for the `users` table.
 * Point `DATABASE_URL` at a seeded Postgres and all of this switches off.
 */
export const isDemoMode = () => !process.env.DATABASE_URL;

/** Same password `lib/db/seedAccess.ts` gives the seeded accounts. */
const DEMO_PASSWORD = "changeme123";

const base = {
  permissionMode: "inherit" as const,
  departmentId: null, marketId: null,
  createdAt: "2025-01-06T09:00:00.000Z",
};

const DEMO_USERS: AppSessionUser[] = [
  {
    ...base, id: "1", email: "arjun.malhotra@lustre.example", name: "Arjun Malhotra",
    roleId: 1, roleKey: "management", roleLabel: "Management",
    groupId: 1, groupKey: "management", groupLabel: "Management", isSystem: true, scopeOwnData: false,
    departmentName: "Sales Leadership", marketName: "Global", ownerName: null,
  },
  {
    ...base, id: "2", email: "priya.mehta@lustre.example", name: "Priya Mehta",
    roleId: 2, roleKey: "rep", roleLabel: "Sales Rep",
    groupId: 2, groupKey: "rep", groupLabel: "Sales Rep", isSystem: false, scopeOwnData: true,
    departmentName: "Europe Desk", marketName: "Belgium", ownerName: "Priya Mehta",
  },
];

export function demoUser(email: string, password: string): AppSessionUser | null {
  if (password !== DEMO_PASSWORD) return null;
  return DEMO_USERS.find((u) => u.email === email) ?? null;
}

/** The Sales Rep group's page access as seeded — anything unlisted is denied. */
export const DEMO_REP_PERMISSIONS: Record<string, boolean> = Object.fromEntries(
  navigation.flatMap((g) => g.items.map((i) => [i.permissionKey, i.defaultEnabledForRep])),
);
