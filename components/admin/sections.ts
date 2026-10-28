/** The Administration menu. One entry per page; the order here is the order on screen. */

export type AdminSection = { slug: string; label: string; title: string; subtitle: string };
export type AdminGroup = { heading: string; sections: AdminSection[] };

export const adminGroups: AdminGroup[] = [
  {
    heading: "People",
    sections: [
      { slug: "team-members", label: "Team members", title: "Team members", subtitle: "Everyone who can sign in. Add a person, change their access, or reset a password." },
      { slug: "access-levels", label: "Access levels", title: "Access levels", subtitle: "Choose which pages each kind of person can open." },
      { slug: "job-titles", label: "Job titles", title: "Job titles", subtitle: "The title shown next to a person's name. It does not change what they can see." },
    ],
  },
  {
    heading: "Organisation",
    sections: [
      { slug: "departments", label: "Departments", title: "Departments", subtitle: "The teams a person can belong to." },
      { slug: "markets", label: "Markets", title: "Markets", subtitle: "The primary market a person can be assigned to." },
    ],
  },
  {
    heading: "Sales set-up",
    sections: [
      { slug: "targets", label: "Targets", title: "Sales targets", subtitle: "Yearly targets for the company and for each salesperson." },
      { slug: "request-types", label: "Request types", title: "Request types", subtitle: "What a salesperson can ask their manager to approve." },
      { slug: "clients", label: "Who handles which client", title: "Who handles which client", subtitle: "See each salesperson's clients and move them to someone else." },
    ],
  },
];

export const adminSections = adminGroups.flatMap((g) => g.sections);
