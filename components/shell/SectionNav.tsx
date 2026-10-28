"use client";

import { useEffect, useState } from "react";

export type SectionLink = { id: string; label: string };

/**
 * Sticky in-page rail for long dashboards. It keeps every section one click
 * away without hiding any of them behind tabs, and highlights the section
 * currently in view. Purely additive navigation — nothing is collapsed.
 */
export default function SectionNav({ sections }: { sections: SectionLink[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const scroller = document.getElementById("main-content");
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => Boolean(n));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      {
        root: scroller ?? null,
        // Trigger once a heading reaches the upper third of the viewport.
        rootMargin: "-96px 0px -62% 0px",
        threshold: 0,
      },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
    // Keep the URL shareable without letting the browser fight the smooth scroll.
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="sticky top-0 z-10 -mx-5 bg-background/85 px-5 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      {/* The rail wraps rather than scrolls. Seven links that scroll sideways
          put a scrollbar on the Command Centre and hide the last section behind
          a drag; wrapping keeps every section visible and clickable at any
          width, and costs a second row only below roughly 1100px.

          Pills rather than underlined tabs, to match the header: the product
          has exactly one shape for "a place you can go", and an underline here
          would read as a second, competing navigation system. */}
      <nav aria-label="Dashboard sections" className="flex flex-wrap gap-1.5">
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => go(e, s.id)}
              aria-current={isActive ? "true" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                isActive
                  ? "bg-accent text-white shadow-[0_2px_8px_-2px_rgba(47,79,224,0.45)]"
                  : "text-navy-muted hover:bg-secondary hover:text-navy"
              }`}
            >
              {s.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
