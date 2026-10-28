import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { StatusPage } from "@/components/ui/StatusPage";

export const metadata: Metadata = {
  title: "Access not permitted — LUSTRE Sales Intelligence",
};

/**
 * Rendered when a segment calls `forbidden()` — the viewer is signed in, but
 * their role does not reach this screen. LUSTRE separates management from reps,
 * and several surfaces (Pricing, Team & Brokers, Exceptions) are management
 * only, so this is a real state rather than a theoretical one.
 *
 * It names the boundary plainly instead of pretending the page does not exist:
 * an account manager who lands here should understand that the screen is real
 * and that their manager can grant it, not that they mistyped a URL.
 */
export default function Forbidden() {
  return (
    <StatusPage
      code="403"
      tone="warn"
      eyebrow="Access not permitted"
      title="Your role does not include this screen"
      description="You are signed in, but this surface is restricted to sales management. Commercially sensitive views — how well prices held, broker performance and margin exceptions — are limited by role rather than hidden."
      icon={<ShieldAlert size={30} strokeWidth={1.6} />}
      routes={[
        { href: "/", label: "Command Centre", description: "Everything your role does cover, in one view" },
        { href: "/customers", label: "Customers", description: "Your accounts, health scores and cycles" },
        { href: "/priorities", label: "Daily Priorities", description: "The ranked action queue for today" },
        { href: "/account", label: "Account", description: "Check which role you are signed in as" },
      ]}
      actions={
        <>
          <Link href="/" className="btn btn-primary">
            Go to Command Centre
          </Link>
          <Link href="/account" className="btn btn-secondary">
            Review my access
          </Link>
        </>
      }
    />
  );
}
