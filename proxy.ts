import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasAccess, PAGE_PERMISSION_KEYS } from "@/lib/access";
import type { AppSessionUser } from "@/lib/sessionUser";

export default auth(async function proxy(req) {
  const { pathname } = req.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/forgot-password");
  const isApiAuthRoute = pathname.startsWith("/api/auth");

  if (isApiAuthRoute) return NextResponse.next();

  const session = req.auth;
  if (!session?.user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session?.user && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // The admin panel is isSystem-only, never a regular role_permissions
  // lookup — see components/shell/nav.ts's adminNavItem comment for why.
  if (pathname.startsWith("/admin")) {
    const isSystem = (session?.user as unknown as AppSessionUser | undefined)?.isSystem ?? false;
    if (!isSystem) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  const permissionKey = PAGE_PERMISSION_KEYS[pathname];
  if (session?.user && permissionKey) {
    const { id, groupId, isSystem, permissionMode } = session.user as unknown as AppSessionUser;
    const allowed = await hasAccess({ userId: Number(id), groupId, isSystem, permissionMode }, permissionKey);
    if (!allowed) {
      // Never redirect to "/" here — "/" (Today) is itself a permissionKey
      // ("nav.today"), and a role with it disabled would bounce right back
      // into this same check, looping forever. A brand-new role starts with
      // every page off (see nav.ts's fail-safe comment), so this is reachable
      // the moment an admin creates one without enabling Today first.
      // /account carries no permissionKey (it's outside the `navigation`
      // array), so it can never itself trigger this branch again.
      return NextResponse.redirect(new URL("/account", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
