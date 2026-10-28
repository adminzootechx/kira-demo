"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, ServerCrash } from "lucide-react";
import { StatusPage, primaryRoutes } from "@/components/ui/StatusPage";
import { logError } from "@/lib/errorCodes";

/**
 * The route-level error boundary. It wraps every page in the app, so any
 * uncaught exception during render lands here instead of on a blank screen.
 *
 * Two things matter to a Sales Director who hits this mid-review: that nothing
 * they were doing was saved or lost, and that they can get back to the numbers
 * without a full reload. `retry()` re-renders the segment inside a transition,
 * which keeps the shell and its state alive.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Stands in for the error reporting service. The digest is the only handle
    // that ties this screen to the corresponding server-side log line.
    logError("LUSTRE-APP-1", "Unhandled render error", error);
  }, [error]);

  return (
    <StatusPage
      code="500"
      tone="negative"
      eyebrow="Something went wrong"
      title="This screen could not be rendered"
      description="An unexpected error interrupted the page while it was loading. Your data is untouched — nothing was saved, changed or submitted, so retrying is safe."
      icon={<ServerCrash size={30} strokeWidth={1.6} />}
      detail={[
        { label: "Error code", value: "LUSTRE-APP-1" },
        { label: "Reference", value: error.digest ?? "not available" },
        { label: "Detail", value: error.message || "No message was reported" },
      ]}
      routes={primaryRoutes}
      actions={
        <>
          <button type="button" onClick={() => retry()} className="btn btn-primary">
            <RotateCw size={14} />
            Try again
          </button>
          <Link href="/" className="btn btn-secondary">
            Go to Command Centre
          </Link>
        </>
      }
    />
  );
}
