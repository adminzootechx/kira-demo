import Link from "next/link";
import { ArrowRightLeft, Eye, Target, UserPlus } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";

export const metadata = {
  title: "Administration — LUSTRE Sales Intelligence",
};

const shortcuts = [
  { href: "/admin/team-members?add=1", icon: UserPlus, title: "Add a person", text: "Give a new colleague a sign-in." },
  { href: "/admin/access-levels", icon: Eye, title: "Change who can see what", text: "Turn pages on or off for a kind of person." },
  { href: "/admin/targets", icon: Target, title: "Set this year's targets", text: "One amount per salesperson and for the company." },
  { href: "/admin/clients", icon: ArrowRightLeft, title: "Move clients", text: "Hand a salesperson's clients to someone else." },
];

export default function AdminPage() {
  return (
    <>
      <PageHeader
        breadcrumb={["Administration"]}
        title="Administration"
        subtitle="Look after the people who use LUSTRE and how the sales team is set up. Start with what you want to do."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="group block">
            <Card className="flex h-full items-start gap-4 p-5 transition-colors group-hover:border-accent">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-accent-bg text-accent">
                <s.icon size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-[17px] font-bold leading-snug text-navy">{s.title}</p>
                <p className="mt-1 text-[13px] font-normal leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
