import type { Metadata } from "next";
import { ListChecks, ShieldCheck, TrendingUp, Users } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import Logo from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Sign in — LUSTRE Sales Intelligence",
  description:
    "Sign in to LUSTRE, sales intelligence for the diamond trade.",
};

/**
 * The sign-in screen.
 *
 * Two columns on a wide display: the sky carries the brand and states what the
 * product is, the white sheet carries the work. It is the same division the
 * rest of LUSTRE uses — the canvas behind, the product surface in front — turned
 * up in scale, because this is the one screen with nothing else on it. Signing
 * in therefore happens under exactly the sky the dashboard then rises out of.
 *
 * Below `lg` the brand panel is dropped rather than stacked above the form. On
 * a phone the first thing on screen should be the email field, not a paragraph
 * of positioning the user has to scroll past to reach it; the lockup alone
 * carries the brand there.
 */

const capabilities = [
  {
    icon: TrendingUp,
    title: "Performance against plan",
    description: "Targets, the year ahead, and how well prices held — brought together every morning.",
  },
  {
    icon: Users,
    title: "Customer intelligence",
    description: "How healthy every account is, how they buy, and who looks like drifting away.",
  },
  {
    icon: ListChecks,
    title: "Ranked action",
    description: "The day's priorities and exceptions, ordered by what they are worth.",
  },
];

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Sky — identity and positioning ------------------------------ */}
      <section
        aria-labelledby="brand-heading"
        className="canvas-panel relative hidden flex-col justify-between overflow-hidden px-12 py-14 lg:flex xl:px-16"
      >
        {/* Brand. The full lockup — the one screen with room for it. */}
        <Logo size="lg" descriptor className="self-start" />

        <div className="max-w-lg py-16">
          <h2
            id="brand-heading"
            className="display-lg text-[35.5px] font-bold leading-[1.15] text-navy xl:text-[40px]"
          >
            The whole desk, reconciled before you open it.
          </h2>
          <p className="mt-5 text-[14.5px] leading-relaxed text-navy-soft">
            Every part of the business reading the same sales records — so the number in
            the morning review is the same number in the forecast, the exception queue and
            the customer file.
          </p>

          <ul className="mt-11 space-y-4">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <li
                key={title}
                // Each sits on its own translucent card: over a gradient, plain
                // text and an icon have no consistent ground to read against,
                // and the list starts to dissolve where the sky is lightest.
                className="flex gap-3.5 rounded-[14px] border border-white/70 bg-white/55 p-4 backdrop-blur-sm"
              >
                <Icon
                  size={17}
                  strokeWidth={1.8}
                  className="mt-0.5 w-[17px] shrink-0 text-accent"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold leading-snug text-navy">{title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-navy-muted">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Sets the expectation that what you see next depends on who you are,
            before the shell silently does exactly that. */}
        <div className="flex items-start gap-3 border-t border-navy/10 pt-6">
          <ShieldCheck size={15} strokeWidth={1.8} className="mt-px shrink-0 text-accent" aria-hidden />
          <p className="text-[12px] leading-relaxed text-navy-muted">
            Access is role-based. A salesperson sees their own customers; management
            sees everyone.
          </p>
        </div>
      </section>

      {/* Sheet — the work. Opaque, because the layout behind it is the sky:
          a form field floating directly on a gradient has no ground. -- */}
      <section className="flex flex-col justify-center bg-background px-6 py-14 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-[400px]">
          {/* Stands in for the brand panel where it is not rendered. */}
          <div className="mb-10 lg:hidden">
            <Logo size="md" descriptor />
          </div>

          <p className="eyebrow">Sales Intelligence Platform</p>
          <h1 className="display-lg mt-3 text-[28.5px] font-bold leading-tight text-navy">
            Sign in to LUSTRE
          </h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-navy-muted">
            Use your LUSTRE work account. Sessions close after a period of inactivity, and on
            a shared machine they close when the browser does.
          </p>

          <LoginForm />

          <p className="mt-10 text-[11.5px] leading-relaxed text-muted-foreground">
            © 2026 LUSTRE · Sales intelligence for the diamond trade
          </p>
        </div>
      </section>
    </div>
  );
}
