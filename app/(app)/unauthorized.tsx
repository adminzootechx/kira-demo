import type { Metadata } from "next";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { StatusPage } from "@/components/ui/StatusPage";

export const metadata: Metadata = {
  title: "Session expired — LUSTRE Sales Intelligence",
};

/**
 * Rendered when a segment calls `unauthorized()` — there is no valid session at
 * all. In practice this is almost always an expired session rather than an
 * anonymous visitor, so the page leads with that reading and tells the user
 * their unsaved work is the thing at risk.
 */
export default function Unauthorized() {
  return (
    <StatusPage
      code="401"
      tone="accent"
      eyebrow="Not signed in"
      title="Your session has ended"
      description="LUSTRE could not verify an active session for this request. Sessions close after a period of inactivity, and on a shared machine they close when the browser does. Signing in again returns you to the screen you were on."
      icon={<LogIn size={30} strokeWidth={1.6} />}
      detail={[
        { label: "Cause", value: "No valid session token" },
        { label: "Effect", value: "Saved work is unaffected" },
      ]}
      actions={
        <>
          <Link href="/login" className="btn btn-primary">
            Sign in again
          </Link>
          <Link href="/account" className="btn btn-secondary">
            Account and sessions
          </Link>
        </>
      }
    />
  );
}
