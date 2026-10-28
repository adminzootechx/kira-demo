import type { Metadata } from "next";
import Link from "next/link";
import { UserSearch } from "lucide-react";
import { StatusPage } from "@/components/ui/StatusPage";

export const metadata: Metadata = {
  title: "Customer not found — LUSTRE Sales Intelligence",
};

/**
 * The segment-level 404 for `notFound()` thrown by a customer profile. The
 * generic page would say "this page is not part of LUSTRE", which is wrong and
 * unhelpful here: the screen exists, the account identifier does not resolve.
 * Bookmarked and shared profile links are common in this product, so the
 * distinction is worth the extra file.
 */
export default function CustomerNotFound() {
  return (
    <StatusPage
      code="404"
      tone="info"
      eyebrow="Customer not found"
      title="No account matches this identifier"
      description="The customer record behind this link is not in LUSTRE. Accounts are removed from the intelligence layer when they are merged into a parent group or archived, and shared links to them stop resolving at that point."
      icon={<UserSearch size={30} strokeWidth={1.6} />}
      detail={[{ label: "Error code", value: "LUSTRE-DATA-3" }]}
      routes={[
        { href: "/customers", label: "All customers", description: "Search the full account list" },
        { href: "/sales-navigator", label: "Sales Navigator", description: "Prospects not yet on the account list" },
        { href: "/priorities", label: "Daily Priorities", description: "Accounts needing attention today" },
        { href: "/copilot", label: "AI Sales Copilot", description: "Ask which account a reference belongs to" },
      ]}
      actions={
        <Link href="/customers" className="btn btn-primary">
          Back to all customers
        </Link>
      }
    />
  );
}
