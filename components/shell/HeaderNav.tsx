"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Award, BadgeDollarSign, Bot, ChevronDown, Compass, Database, Gem, LayoutDashboard,
  BadgeCheck, ListChecks, Menu, ShieldCheck, Target, TriangleAlert, Trophy, Users,
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import { Drawer } from "@/components/ui/Drawer";
import { adminNavItem, navigation } from "./nav";
import { usePermissions } from "./RoleContext";

const icons = {
  LayoutDashboard, Target, Users, Gem, BadgeDollarSign, Trophy, Award,
  ListChecks, TriangleAlert, Compass, Bot, Database, BadgeCheck,
} as const;

/**
 * Primary navigation, in the header rather than a rail.
 *
 * Thirteen destinations will not fit across a header as a flat row, and an
 * icon-only strip would cost every one of them its label. So the five sections
 * the product is already organised into become the top level: four open a
 * panel listing their screens, and a section holding a single screen links
 * straight to it rather than opening a menu containing one row.
 *
 * The Command Centre gets its own button at the head of the bar — it is the
 * one destination people return to constantly, and burying the dashboard two
 * clicks deep inside "Performance" would be the worst trade in the whole
 * layout. It stays listed in that menu too; a little redundancy in navigation
 * is cheap, and reach is not.
 */
export default function HeaderNav() {
  const pathname = usePathname();
  const { isSystem, permissions } = usePermissions();

  const [openSection, setOpenSection] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // "My achievements" lives under Team in nav.ts — right for admin/
  // management, who browse it as one more team scorecard. A rep gets it
  // pulled out into its own top-level section instead, since it's their
  // personal milestones/tier, not a team report they're navigating into.
  // Shared between the desktop bar (drawerOnly sections excluded — Setup
  // isn't worth a permanent header slot) and the mobile drawer (which
  // includes them, since it's the only way to reach them on a phone at all).
  const splitAchievements = (list: typeof navigation) =>
    isSystem
      ? list
      : (() => {
          let achievements: (typeof list)[number]["items"][number] | null = null;
          const rest = list
            .map((g) => ({
              ...g,
              items: g.items.filter((i) => {
                if (i.href !== "/my-performance") return true;
                achievements = i;
                return false;
              }),
            }))
            .filter((g) => g.items.length > 0);
          return achievements ? [...rest, { section: "My achievements", items: [achievements] }] : rest;
        })();

  const permissionFiltered = (list: typeof navigation) =>
    list
      .map((g) => ({ ...g, items: g.items.filter((i) => isSystem || permissions[i.permissionKey]) }))
      .filter((g) => g.items.length > 0);

  const groups = splitAchievements(permissionFiltered(navigation.filter((g) => !g.drawerOnly)));
  const mobileGroups = splitAchievements(permissionFiltered(navigation));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  /**
   * Arriving somewhere is the end of navigating, so any open menu closes with
   * the route change. Adjusted during render rather than in an effect: React
   * handles this without committing the stale open menu to the DOM first, and
   * unlike closing from each link's `onClick` it also covers the back button
   * and links inside the page content.
   */
  const [navPath, setNavPath] = useState(pathname);
  if (navPath !== pathname) {
    setNavPath(pathname);
    setOpenSection(null);
    setMobileNavOpen(false);
  }

  // Outside click and Escape. Escape returns focus to the trigger it came
  // from, so keyboard users are never dropped back at the top of the page.
  useEffect(() => {
    if (!openSection) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpenSection(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openSection) triggerRefs.current[openSection]?.focus();
      setOpenSection(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openSection]);

  /** Arrow keys walk the open panel, the way a menubar is expected to. */
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]") ?? [],
    );
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown"
        ? list[(i + 1) % list.length]
        : list[(i - 1 + list.length) % list.length];
    next.focus();
  };

  // Hover opens a menu and leaving closes it after a short grace period, so the
  // pointer can cross the gap between the button and its panel. Mouse only:
  // touch and pen keep tap-to-toggle.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredByMouse = useRef(false);
  const hoverOpen = (e: React.PointerEvent, section: string) => {
    if (e.pointerType !== "mouse") return;
    hoveredByMouse.current = true;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpenSection(section);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpenSection(null), 180);
  };

  const openWithFirstItem = (section: string) => {
    setOpenSection(section);
    // The panel mounts this tick; focus its first row on the next one.
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("[data-nav-item]")?.focus();
    });
  };

  /** Open items roll up to the section, so a closed menu still shows a count. */
  const sectionBadge = (items: { badge?: number }[]) =>
    items.reduce((sum, i) => sum + (i.badge ?? 0), 0);

  return (
    <div ref={wrapRef} className="flex min-w-0 items-center gap-2 xl:gap-3">
      {/* Below `xl` the desktop bar (just past here) hides entirely — this
          is the only way to reach the rest of the product on a phone, where
          a rep is checking the dashboard between client visits. */}
      <button
        ref={menuButtonRef}
        onClick={() => setMobileNavOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={mobileNavOpen}
        aria-label="Open navigation"
        className="icon-btn size-9 shrink-0 xl:hidden"
      >
        <Menu size={18} aria-hidden />
      </button>

      {/* Brand — also the way home, which is why the Command Centre can
          afford to sit inside a menu as well. ----------------------- */}
      <Link
        href="/"
        aria-label="LUSTRE — Today"
        className="shrink-0 rounded-full pr-1"
      >
        <Logo size="md" />
      </Link>

      {/* Desktop bar ------------------------------------------------- */}
      <nav aria-label="Primary" className="relative hidden xl:block">
        <div className="flex items-center gap-0.5">

          {groups.map((group) => {
            const active = group.items.some((i) => isActive(i.href));
            const badge = sectionBadge(group.items);

            // A section holding one screen is a link, not a menu. Opening a
            // panel to reveal a single row is a click spent on nothing.
            if (group.items.length === 1) {
              const only = group.items[0];
              return (
                <Link
                  key={group.section}
                  href={only.href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                                    className="nav-pill"
                >
                  {only.label}
                  {badge > 0 && <NavCount value={badge} active={active} />}
                </Link>
              );
            }

            const open = openSection === group.section;
            return (
              <div
                key={group.section}
                className="relative"
                onPointerEnter={(e) => hoverOpen(e, group.section)}
                onPointerLeave={hoverClose}
              >
                <button
                  ref={(el) => {
                    triggerRefs.current[group.section] = el;
                  }}
                  // A mouse click on a menu hover already opened keeps it open;
                  // everything else toggles.
                  onClick={() => {
                    setOpenSection(open && !hoveredByMouse.current ? null : group.section);
                    hoveredByMouse.current = false;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      openWithFirstItem(group.section);
                    }
                  }}
                  aria-expanded={open}
                  aria-haspopup="true"
                  data-active={active}
                  data-open={open}
                  className="nav-pill"
                >
                  {group.section}
                  {badge > 0 && <NavCount value={badge} active={active} />}
                  <ChevronDown
                    size={13}
                    strokeWidth={2.4}
                    aria-hidden
                    className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open && (
                  <div
                    ref={panelRef}
                    onKeyDown={onPanelKeyDown}
                    className="menu-panel absolute left-1/2 top-[calc(100%+14px)] z-50 w-[332px] max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--shadow-raised)]"
                  >
                    <p className="border-b border-border-soft px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {group.section}
                    </p>
                    <ul className="p-2">
                      {group.items.map((item) => {
                        const Icon = icons[item.icon as keyof typeof icons];
                        const itemActive = isActive(item.href);
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              data-nav-item
                              aria-current={itemActive ? "page" : undefined}
                              className={`flex items-start gap-3 rounded-[12px] px-3 py-2.5 transition-colors ${
                                itemActive
                                  ? "bg-accent-bg"
                                  : "hover:bg-secondary"
                              }`}
                            >
                              <span
                                className={`mt-px flex size-8 shrink-0 items-center justify-center rounded-[9px] ${
                                  itemActive
                                    ? "bg-accent text-white"
                                    : "bg-secondary text-navy-muted"
                                }`}
                              >
                                <Icon size={16} strokeWidth={1.9} aria-hidden />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span
                                    className={`truncate text-[14px] font-semibold ${
                                      itemActive ? "text-accent-dark" : "text-navy"
                                    }`}
                                  >
                                    {item.label}
                                  </span>
                                  {item.badge ? (
                                    <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10.5px] font-bold tabular-nums text-white">
                                      {item.badge}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      </nav>

      {/* Mobile drawer ------------------------------------------------- */}
      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        title="Menu"
        icon={<Menu size={16} />}
        returnFocusTo={menuButtonRef}
        width={320}
      >
        <nav aria-label="All screens" className="-mx-2 space-y-5">
          {mobileGroups.map((group) => (
            <div key={group.section}>
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {group.section}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = icons[item.icon as keyof typeof icons];
                  const itemActive = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={itemActive ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-[11px] px-2 py-2.5 transition-colors ${
                          itemActive ? "bg-accent-bg" : "hover:bg-secondary"
                        }`}
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] ${
                            itemActive ? "bg-accent text-white" : "bg-secondary text-navy-muted"
                          }`}
                        >
                          <Icon size={16} strokeWidth={1.9} aria-hidden />
                        </span>
                        <span
                          className={`flex-1 truncate text-[14px] font-semibold ${
                            itemActive ? "text-accent-dark" : "text-navy"
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.badge ? (
                          <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10.5px] font-bold tabular-nums text-white">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {isSystem && (
            <div>
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Administration
              </p>
              <Link
                href={adminNavItem.href}
                aria-current={isActive(adminNavItem.href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-[11px] px-2 py-2.5 transition-colors ${
                  isActive(adminNavItem.href) ? "bg-accent-bg" : "hover:bg-secondary"
                }`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] ${
                    isActive(adminNavItem.href) ? "bg-accent text-white" : "bg-secondary text-navy-muted"
                  }`}
                >
                  <ShieldCheck size={16} strokeWidth={1.9} aria-hidden />
                </span>
                <span
                  className={`flex-1 truncate text-[14px] font-semibold ${
                    isActive(adminNavItem.href) ? "text-accent-dark" : "text-navy"
                  }`}
                >
                  {adminNavItem.label}
                </span>
              </Link>
            </div>
          )}
        </nav>
      </Drawer>
    </div>
  );
}

/** The rolled-up open count on a closed section. */
function NavCount({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={`flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold tabular-nums ${
        active ? "bg-white/25 text-white" : "bg-accent-bg text-accent-dark"
      }`}
    >
      {value}
    </span>
  );
}
