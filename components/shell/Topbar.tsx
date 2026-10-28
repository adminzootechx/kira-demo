"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Bot, MessageSquareText } from "lucide-react";
import SearchBox from "./SearchBox";
import NotificationPanel, { useNotificationState } from "./NotificationPanel";
import AccountMenu from "./AccountMenu";
import HeaderNav from "./HeaderNav";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/primitives";
import Copilot from "@/components/copilot/Copilot";

/**
 * The one piece of chrome in the product: identity, every destination, search
 * and the account, in a single solid white pill floating on the canvas.
 *
 * It used to be a row of separately-grounded controls — the nav on its own
 * translucent capsule, the search field on another, each icon button on a
 * third. Over a gradient that reads as a scatter of unrelated chips rather
 * than a bar. One opaque pill holds the row instead, and everything inside it
 * is transparent until you hover it, so the bar has exactly one edge.
 *
 * The pill spans the sheet below rather than sitting inside its content
 * padding, so its own padding lines the wordmark up with the page title.
 */
export default function Topbar() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const copilotRef = useRef<HTMLButtonElement>(null);
  const { readIds, markRead, markAllRead, markSeen, unread } = useNotificationState();

  // The shell scrolls its own container, not the window.
  useEffect(() => {
    const el = document.getElementById("main-content");
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 8);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * The content column below reserves a scrollbar gutter on both edges; the
   * header has no scrollbar and so reserves nothing, which left the wordmark
   * sitting half a scrollbar to the left of the page title. Publish the width
   * the scroller actually reserved so the header can match it.
   *
   * It defaults to 0, which is already correct on platforms with overlay
   * scrollbars — there is nothing to reserve there.
   */
  useEffect(() => {
    const el = document.getElementById("main-content");
    if (!el) return;
    const measure = () => {
      // `both-edges` reserves one gutter per side, so halve the total.
      const perSide = Math.max(0, (el.offsetWidth - el.clientWidth) / 2);
      document.documentElement.style.setProperty("--shell-gutter", `${perSide}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className="header-bar sticky top-0 z-30 h-[76px] shrink-0 px-2 sm:px-3 lg:px-5 2xl:px-6"
    >
      <div className="h-full" style={{ paddingInline: "var(--shell-gutter, 0px)" }}>
        <div className="mx-auto h-full w-full max-w-[1600px] py-2.5">
          <div className="header-pill flex h-full items-center gap-1.5 pl-2.5 pr-2 sm:gap-2 lg:pl-3.5 lg:pr-2.5">
            <HeaderNav />

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
              {/* Search. Full field where there is room for one; below `xl`
                  the header has to choose between a field and the nav, and
                  the nav wins — so it collapses to the control it already
                  is. Inside a white bar the field needs a recessed ground
                  rather than a raised one, or it disappears. */}
              <SearchBox />
              <SearchBox compact />

              {/* The Copilot has a labelled entry in the Growth menu and its
                  own full page, so this is a shortcut rather than the way
                  the feature is discovered — it opens the same chat in a
                  drawer instead of navigating away, so it stays usable from
                  wherever you already are. */}
              <button
                ref={copilotRef}
                onClick={() => setCopilotOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={copilotOpen}
                aria-label="Ask a question about your sales"
                title="Ask a question"
                className={`icon-btn hidden size-9 sm:inline-flex ${copilotOpen ? "bg-secondary text-navy" : ""}`}
              >
                <MessageSquareText size={17} aria-hidden />
              </button>

              <button
                ref={bellRef}
                onClick={() => {
                  setNotificationsOpen(true);
                  markSeen();
                }}
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                aria-label={
                  unread > 0
                    ? `Notifications — ${unread} unread`
                    : "Notifications — none unread"
                }
                className={`icon-btn relative size-9 ${
                  notificationsOpen ? "bg-secondary text-navy" : ""
                }`}
              >
                <Bell size={17} />
                {unread > 0 && (
                  <span
                    className="absolute right-0 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-negative px-1 text-[10px] font-bold tabular-nums text-white"
                    aria-hidden
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              <AccountMenu />
            </div>
          </div>
        </div>
      </div>

      <NotificationPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        readIds={readIds}
        onRead={markRead}
        onReadAll={markAllRead}
        returnFocusTo={bellRef}
      />

      <Drawer
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        title="Ask a question"
        subtitle="Answers come from your own sales records"
        icon={<Bot size={17} />}
        actions={<Badge tone="accent">Traceable</Badge>}
        width={480}
        padded={false}
        returnFocusTo={copilotRef}
      >
        <Copilot fill />
      </Drawer>
    </header>
  );
}
