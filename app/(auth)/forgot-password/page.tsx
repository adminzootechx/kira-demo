import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, LifeBuoy, ShieldCheck } from "lucide-react";
import Logo from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Password help — LUSTRE Sales Intelligence",
  description: "How to recover access to your LUSTRE account.",
};

/**
 * Password recovery.
 *
 * LUSTRE has no self-service reset: accounts are provisioned against the company
 * directory, so a reset is an administrator action rather than an email round
 * trip. Saying that in one screen is more useful than a form that collects an
 * address and then quietly does nothing — which is what "Forgot your password?"
 * would otherwise have to be while Phase 1 has no auth service behind it.
 */

const steps = [
  {
    icon: ShieldCheck,
    title: "Accounts are directory-backed",
    description:
      "Your LUSTRE sign-in is the same work account you use elsewhere. Resetting it there resets it here — there is no separate LUSTRE password to recover.",
  },
  {
    icon: KeyRound,
    title: "Locked out instead?",
    description:
      "Repeated failed attempts suspend a session rather than the account. Your sales operations administrator can clear it without touching your password.",
  },
  {
    icon: LifeBuoy,
    title: "Nobody to ask",
    description:
      "Write to sales-ops@lustre.example with your name and market. Requests are answered the same working day from Mumbai, Antwerp and Dubai.",
  },
];

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-14 sm:px-10">
      <div className="mx-auto w-full max-w-[540px]">
        <div className="mb-9">
          <Logo size="md" descriptor />
        </div>

        <section className="surface overflow-hidden">
          <span className="block h-[3px] bg-accent" aria-hidden />

          <div className="px-7 pb-7 pt-7 sm:px-8">
            <p className="eyebrow">Password help</p>
            <h1 className="display-lg mt-3 text-[24px] font-bold leading-tight text-navy">
              Recovering access to LUSTRE
            </h1>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-navy-muted">
              LUSTRE does not hold a password of its own, so there is nothing here to reset.
              One of the three routes below will cover it.
            </p>

            <ul className="mt-7 space-y-6">
              {steps.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex gap-3.5">
                  <Icon
                    size={16}
                    strokeWidth={1.7}
                    className="mt-0.5 w-4 shrink-0 text-accent"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold leading-snug text-navy">{title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border bg-secondary/50 px-7 py-5 sm:px-8">
            <Link href="/login" className="btn btn-secondary">
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
