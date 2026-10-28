"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut as endSession } from "next-auth/react";
import {
  Bell, ChevronDown, LifeBuoy, LogOut, Settings, ShieldCheck, SlidersHorizontal, Users,
} from "lucide-react";
import { useRole } from "./RoleContext";
import { adminNavItem } from "./nav";

type Item = {
  label: string;
  description?: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const baseItems: Item[] = [
  { label: "Account settings", description: "Profile, contact and role", href: "/account", icon: Settings },
  { label: "Preferences", description: "Landing page, formats, density", href: "/account#preferences", icon: SlidersHorizontal },
  { label: "Notifications", description: "Channels, digest and categories", href: "/account#notifications", icon: Bell },
  { label: "Security", description: "Two-factor and active sessions", href: "/account#security", icon: ShieldCheck },
  { label: "Help & support", description: "Error codes and what to do about them", href: "/help", icon: LifeBuoy },
];

const adminItem: Item = {
  label: adminNavItem.label,
  description: "Roles, users, departments and markets",
  href: adminNavItem.href,
  icon: Users,
};

export default function AccountMenu() {
  const { viewer, isSystem } = useRole();
  const items = isSystem ? [...baseItems, adminItem] : baseItems;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape; Escape returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Arrow keys walk the menu, matching the usual menu-button behaviour.
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const focusables = menuRef.current?.querySelectorAll<HTMLElement>("[data-menu-item]");
    if (!focusables?.length) return;
    const list = Array.from(focusables);
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown"
        ? list[(i + 1) % list.length]
        : list[(i - 1 + list.length) % list.length];
    next.focus();
  };

  const signOut = () => {
    setOpen(false);
    endSession({ callbackUrl: "/login" });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu — ${viewer.name}, ${viewer.title}`}
        className={`flex items-center gap-2.5 rounded-full border border-white/80 bg-white/70 py-1.5 pl-1.5 pr-2.5 shadow-[var(--shadow-card)] backdrop-blur-xl transition-colors hover:bg-white ${
          open ? "!bg-white" : ""
        }`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-[12.5px] font-bold text-white">
          {viewer.initials}
        </span>
        <span className="hidden max-w-[140px] text-left leading-tight 2xl:block">
          <span className="block truncate text-[13px] font-bold text-navy">{viewer.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {viewer.title}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          // Grows from the avatar it hangs off, rather than appearing whole.
          style={{ transformOrigin: "top right" }}
          className="menu-panel absolute right-0 top-[calc(100%+10px)] z-40 w-[288px] overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-raised)]"
        >
          {/* Who you are signed in as */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-[13.5px] font-bold text-white">
              {viewer.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-navy">{viewer.name}</p>
              <p className="truncate text-[12px] text-muted-foreground">{viewer.email}</p>
            </div>
          </div>

          <ul className="py-1.5">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    data-menu-item
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-secondary"
                  >
                    <Icon size={16} className="mt-0.5 shrink-0 text-navy-muted" />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-navy">{item.label}</span>
                      {item.description && (
                        <span className="block text-[12px] leading-snug text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-border py-1.5">
            <button
              data-menu-item
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-negative-bg"
            >
              <LogOut size={16} className="shrink-0 text-negative" />
              <span className="text-[13.5px] font-medium text-negative">Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
