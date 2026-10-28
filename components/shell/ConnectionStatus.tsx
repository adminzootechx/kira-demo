"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

/**
 * Watches the browser's connectivity and says so. Without this, a dashboard
 * that is entirely reads looks perfectly healthy while offline — every figure
 * on screen is the last one fetched, silently going stale, and the freshness
 * stamp in the topbar keeps claiming the data is live.
 *
 * While offline a bar stays on screen, because the condition persists; coming
 * back is a moment, so that is a toast. The bar is a real strip rather than a
 * floating translucent overlay so it never sits on top of a figure.
 */

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const isOnline = () => navigator.onLine;
/** The server has no `navigator`; assume connected so hydration matches. */
const assumeOnline = () => true;

export default function ConnectionStatus() {
  const online = useSyncExternalStore(subscribe, isOnline, assumeOnline);
  const { success } = useToast();

  // Only the transition back is worth a toast — the offline state announces
  // itself through the bar below, and re-announcing it on every render would
  // be noise.
  const wasOnline = useRef(true);
  useEffect(() => {
    if (online && !wasOnline.current) {
      success(
        "Connection restored",
        "Figures on screen may still be from before the interruption — reload to refresh them.",
      );
    }
    wasOnline.current = online;
  }, [online, success]);

  if (online) return null;

  return (
    <div
      role="alert"
      className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-negative/20 bg-negative-bg px-6 py-2.5 text-[13px] text-negative lg:px-8"
    >
      <WifiOff size={14} strokeWidth={2.2} aria-hidden />
      <span className="font-semibold">No connection.</span>
      <span className="text-navy-soft">
        LUSTRE is showing the last data it loaded — treat every figure as out of date until
        the connection returns.
      </span>
    </div>
  );
}
