import "server-only";

import NextAuth from "next-auth";
import { after } from "next/server";
import { ensureFresh } from "@/lib/tradeapi/autoSync";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { departments, groups, markets, roles, users } from "@/lib/db/schema";
import { assertNotLockedOut, clearAttempts, recordFailedAttempt } from "@/lib/loginAttempts";
import type { AppSessionUser } from "@/lib/sessionUser";
import { demoUser, isDemoMode } from "@/lib/demo";

/* Same shape check as LoginForm.tsx's client-side validation — repeated here
 * because a client check is a UX nicety, not a security boundary. Every
 * credential the server trusts must be validated by the server itself. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, passkey: {} },
      async authorize(credentials) {
        const rawEmail = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!rawEmail || !password) return null;

        const email = rawEmail.trim().toLowerCase();
        if (!EMAIL.test(email)) return null;
        // Bounds match the column widths in lib/db/schema.ts — an
        // absurdly long credential is rejected before it ever reaches bcrypt
        // or the database.
        if (email.length > 254 || password.length > 200) return null;

        // Locked out first, so a lockout never leaks whether the account
        // exists via a timing or error-shape difference from "wrong password".
        assertNotLockedOut(email);

        // No database configured: sign in against the built-in demo accounts.
        if (isDemoMode()) {
          const demo = demoUser(email, password);
          if (!demo) recordFailedAttempt(email);
          else clearAttempts(email);
          return demo;
        }

        const [row] = await getDb()
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            passwordHash: users.passwordHash,
            ownerName: users.ownerName,
            permissionMode: users.permissionMode,
            roleId: roles.id,
            roleKey: roles.key,
            roleLabel: roles.label,
            groupId: groups.id,
            groupKey: groups.key,
            groupLabel: groups.label,
            isSystem: groups.isSystem,
            scopeOwnData: groups.scopeOwnData,
            departmentId: departments.id,
            departmentName: departments.name,
            marketId: markets.id,
            marketName: markets.name,
            createdAt: users.createdAt,
          })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .innerJoin(groups, eq(users.groupId, groups.id))
          .leftJoin(departments, eq(users.departmentId, departments.id))
          .leftJoin(markets, eq(users.marketId, markets.id))
          .where(eq(users.email, email));

        if (!row) {
          recordFailedAttempt(email);
          return null;
        }

        const valid = await bcrypt.compare(password, row.passwordHash);
        if (!valid) {
          recordFailedAttempt(email);
          return null;
        }

        clearAttempts(email);

        // The passkey is the data-service password. It is handed straight to a
        // background sync and never written to the session, the database or a log.
        const passkey = ((credentials?.passkey as string | undefined) ?? "").trim();
        const sync = () => ensureFresh({ passkey: passkey || undefined, force: Boolean(passkey) });
        try {
          after(sync);
        } catch {
          void sync();
        }

        const sessionUser: AppSessionUser = {
          id: String(row.id),
          email: row.email,
          name: row.name,
          roleId: row.roleId,
          roleKey: row.roleKey,
          roleLabel: row.roleLabel,
          groupId: row.groupId,
          groupKey: row.groupKey,
          groupLabel: row.groupLabel,
          isSystem: row.isSystem,
          scopeOwnData: row.scopeOwnData,
          permissionMode: row.permissionMode as "inherit" | "manual",
          departmentId: row.departmentId,
          departmentName: row.departmentName,
          marketId: row.marketId,
          marketName: row.marketName,
          ownerName: row.ownerName,
          createdAt: row.createdAt.toISOString(),
        };
        return sessionUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        Object.assign(token, user as AppSessionUser);
      }
      return token;
    },
    async session({ session, token }) {
      Object.assign(session.user, token);
      return session;
    },
  },
});
