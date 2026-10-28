"use client";

import Link from "next/link";
import { Mail, Target, UserRound } from "lucide-react";
import { RailCard } from "@/components/ui/primitives";
import { useRole } from "./RoleContext";

/**
 * Who you are signed in as, in the rail rather than buried in the account
 * menu — every figure on the page is scoped to this identity, and the rail
 * is where you can see at a glance whose numbers you are looking at.
 *
 * A client component because it reads the Auth.js session; the rest of the
 * dashboard stays a server component around it.
 */
export default function DeskCard() {
  const { viewer } = useRole();

  return (
    <RailCard eyebrow="Your desk" icon={<UserRound size={12} strokeWidth={2.4} />}>
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-[16px] font-bold text-white">
          {viewer.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-navy">
            {viewer.name}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            {viewer.title}
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <dt className="sr-only">Email</dt>
          <Mail size={13} className="shrink-0 text-muted-foreground" aria-hidden />
          <dd className="min-w-0">
            <a
              href={`mailto:${viewer.email}`}
              className="block truncate text-[12.5px] font-medium text-accent transition-colors hover:text-accent-dark"
            >
              {viewer.email}
            </a>
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border-soft pt-3.5 text-[12px] text-muted-foreground">
        <span>
          Market <span className="font-semibold text-navy">{viewer.market}</span>
        </span>
        <span>
          Team <span className="font-semibold text-navy">{viewer.team}</span>
        </span>
      </div>

      <Link href="/targets" className="btn btn-secondary mt-4 w-full">
        <Target size={15} />
        See targets
      </Link>
    </RailCard>
  );
}
