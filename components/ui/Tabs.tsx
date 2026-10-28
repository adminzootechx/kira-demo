"use client";

import { useState } from "react";

export function Tabs({
  tabs,
  children,
  initial,
}: {
  tabs: string[];
  children: (active: string) => React.ReactNode;
  /** The tab to open on, e.g. from a link; ignored if it is not one of `tabs`. */
  initial?: string;
}) {
  const [active, setActive] = useState(initial && tabs.includes(initial) ? initial : tabs[0]);
  return (
    <>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`rounded-[5px] px-3.5 py-2 text-[13px] transition-colors duration-150 ${
              active === t
                ? "bg-navy font-semibold text-white"
                : "text-muted-foreground hover:bg-secondary hover:text-navy"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {/* Keyed on the active tab so the panel re-enters on every switch —
          without the key React reuses the node and the fade never replays. */}
      <div key={active} className="fade-in">
        {children(active)}
      </div>
    </>
  );
}
