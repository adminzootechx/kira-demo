import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { StatusPage, primaryRoutes } from "@/components/ui/StatusPage";

export const metadata: Metadata = {
  title: "Page not found — LUSTRE Sales Intelligence",
};

/**
 * The application-wide 404. It also catches any URL the router does not match,
 * so it renders inside the shell — a user who mistypes a route keeps the
 * sidebar, the search field and their bearings rather than being dropped onto
 * a bare page with a single link home.
 */
export default function NotFound() {
  return (
    <StatusPage
      code="404"
      tone="info"
      eyebrow="Page not found"
      title="This page is not part of LUSTRE"
      description="The address you followed does not match any screen in the platform. It may have been renamed since the link was shared, or the record it pointed at may no longer exist."
      icon={<Compass size={30} strokeWidth={1.6} />}
      detail={[{ label: "Error code", value: "LUSTRE-APP-2" }]}
      routes={primaryRoutes}
      actions={
        <>
          <Link href="/" className="btn btn-primary">
            Go to Command Centre
          </Link>
          <Link href="/copilot" className="btn btn-secondary">
            Ask the Copilot to find it
          </Link>
        </>
      }
    />
  );
}
