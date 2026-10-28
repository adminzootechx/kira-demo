"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminGroups } from "./sections";

const link = (active: boolean) =>
  `block rounded-[8px] px-3 py-2 text-[13.5px] font-medium transition-colors ${
    active ? "bg-accent-bg font-semibold text-accent-dark" : "text-navy-muted hover:bg-secondary/60 hover:text-navy"
  }`;

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Phone: one dropdown instead of a column that would push the page down. */}
      <label className="block lg:hidden">
        <span className="sr-only">Go to an Administration page</span>
        <select
          value={pathname}
          onChange={(e) => router.push(e.target.value)}
          className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-[13.5px] text-navy"
        >
          <option value="/admin">Overview</option>
          {adminGroups.map((g) => (
            <optgroup key={g.heading} label={g.heading}>
              {g.sections.map((s) => (
                <option key={s.slug} value={`/admin/${s.slug}`}>{s.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <nav aria-label="Administration" className="hidden lg:block">
        <Link href="/admin" className={link(pathname === "/admin")}>Overview</Link>
        {adminGroups.map((g) => (
          <div key={g.heading} className="mt-5">
            <p className="px-3 pb-1.5 text-[12px] font-semibold text-muted-foreground">{g.heading}</p>
            {g.sections.map((s) => (
              <Link key={s.slug} href={`/admin/${s.slug}`} className={link(pathname === `/admin/${s.slug}`)} aria-current={pathname === `/admin/${s.slug}` ? "page" : undefined}>
                {s.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
