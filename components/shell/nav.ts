export type NavItem = {
  href: string;
  label: string;
  icon: string; // lucide icon name
  badge?: number;
  /** Key in role_permissions gating this page for any non-system role. An
   *  isSystem role (management) always sees every item regardless of this. */
  permissionKey: string;
  /** Seed-time default for the "rep" role only — whether this page starts
   *  enabled when the permissions table is first populated. A brand-new
   *  custom role starts with every page off (see lib/access.ts's fail-safe)
   *  and an admin turns pages on deliberately from /account/access. */
  defaultEnabledForRep: boolean;
};

export type NavGroup = {
  section: string;
  items: NavItem[];
  /**
   * Kept out of the header bar and shown only in the drawer. Setup screens are
   * visited a handful of times a year; spending a permanent slot on one costs
   * every daily destination the width it needs.
   */
  drawerOnly?: boolean;
};

/**
 * Section names are the labels that appear across the header, so they are
 * single plain nouns — "Sales", "Stock", "Work" — never a description of what
 * the section contains. An earlier version used sentences ("How we are doing",
 * "Who and what we sell", "Finding new business"); they read as prose rather
 * than as navigation, and together they made the bar 823px wide, which is what
 * pushed it into the search field and the account menu.
 *
 * A section holding one screen renders as a direct link showing the item's own
 * label, so those sections are named after their screen.
 */
export const navigation: NavGroup[] = [
  {
    section: "Sales",
    items: [
      // Targets has its own page again (admin sets the amounts in Administration).
      { href: "/", label: "Home", icon: "LayoutDashboard", permissionKey: "nav.today", defaultEnabledForRep: true },
      { href: "/targets", label: "Targets", icon: "Target", permissionKey: "nav.targets", defaultEnabledForRep: true },
    ],
  },
  {
    section: "Customers",
    items: [
      { href: "/customers", label: "Customers", icon: "Users", permissionKey: "nav.customers", defaultEnabledForRep: true },
    ],
  },
  {
    section: "Stock",
    items: [
      { href: "/products", label: "Stock", icon: "Gem", permissionKey: "nav.products", defaultEnabledForRep: true },
    ],
  },
  {
    section: "Prices",
    items: [
      { href: "/pricing", label: "Prices", icon: "BadgeDollarSign", permissionKey: "nav.pricing", defaultEnabledForRep: false },
    ],
  },
  {
    section: "Team",
    items: [
      { href: "/team", label: "Team", icon: "Trophy", permissionKey: "nav.team", defaultEnabledForRep: false },
      // On the admin/management side this sits as a sub-page of Team, same
      // as any other team-scorecard screen. For a rep it's pulled out into
      // its own top-level tab instead — see HeaderNav's per-role split.
      { href: "/my-performance", label: "My achievements", icon: "Award", permissionKey: "nav.my-performance", defaultEnabledForRep: true },
    ],
  },
  {
    section: "Work",
    items: [
      { href: "/priorities", label: "My day", icon: "ListChecks", permissionKey: "nav.priorities", defaultEnabledForRep: true },
      { href: "/exceptions", label: "Things to check", icon: "TriangleAlert", permissionKey: "nav.exceptions", defaultEnabledForRep: false },
      { href: "/approvals", label: "Approvals", icon: "BadgeCheck", permissionKey: "nav.approvals", defaultEnabledForRep: true },
    ],
  },
  {
    section: "Growth",
    items: [
      { href: "/sales-navigator", label: "New buyers", icon: "Compass", permissionKey: "nav.sales-navigator", defaultEnabledForRep: true },
      { href: "/copilot", label: "Ask a question", icon: "Bot", permissionKey: "nav.copilot", defaultEnabledForRep: true },
    ],
  },
  {
    section: "Setup",
    drawerOnly: true,
    items: [
      { href: "/data", label: "Your data", icon: "Database", permissionKey: "nav.data", defaultEnabledForRep: false },
    ],
  },
];

/** Not part of `navigation` — this is gated by `isSystem` directly in
 *  HeaderNav/SideNav/proxy.ts, never by a role_permissions row. Letting a
 *  non-system role see or reach this page would let it manage the very
 *  permissions that are supposed to constrain it. */
export const adminNavItem = { href: "/admin", label: "Administration" };
