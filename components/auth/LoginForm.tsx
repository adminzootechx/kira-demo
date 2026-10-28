"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Check, CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";

/** Demo accounts seeded by lib/db/seedAccess.ts — no session exists yet at
 *  this point, so these are plain known values, not read from RoleContext. */
const DEMO_ACCOUNTS = {
  management: "arjun.malhotra@lustre.example",
  rep: "priya.mehta@lustre.example",
};

/**
 * The sign-in form. Backed by Auth.js's credentials provider (`lib/auth.ts`) —
 * `signIn("credentials", ...)` posts to `/api/auth/callback/credentials`,
 * which checks the password against `users.passwordHash` and issues the
 * session JWT. Role and owner scoping come from that session afterward, not
 * from anything typed here.
 *
 * Validation is deliberately deferred to submit rather than fired on every
 * keystroke. Marking an email invalid while someone is still halfway through
 * typing it is noise, so a field only turns red once it has been submitted or
 * left, and clears the moment it is corrected.
 */

/* Shape only. Anything stricter belongs on the server, where the address can be
   checked against a directory instead of against a regex. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = { email?: string; password?: string };

const control =
  "h-11 w-full rounded-[6px] border bg-card px-3 text-[14px] text-navy outline-none transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

export default function LoginForm() {
  const router = useRouter();

  const emailId = useId();
  const passwordId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passkey, setPasskey] = useState("");
  const passkeyId = useId();
  const [remember, setRemember] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  const validate = (): Errors => {
    const next: Errors = {};
    if (!email.trim()) next.email = "Enter your work email address.";
    else if (!EMAIL.test(email.trim())) next.email = "That does not look like an email address.";
    if (!password) next.password = "Enter your password.";
    return next;
  };

  /** Clears a field's error as soon as it is corrected, but never raises a new
   *  one mid-typing — errors only appear on blur and on submit. */
  const edit = (field: keyof Errors, set: (v: string) => void) => (v: string) => {
    set(v);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;

    const found = validate();
    setErrors(found);
    if (found.email || found.password) {
      // Focus follows the first problem, so a keyboard user is not left to hunt
      // for which of the two fields the message belongs to.
      (found.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setPending(true);
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      passkey,
      redirect: false,
    });
    setPending(false);

    if (result?.error) {
      setErrors({ password: "That email or password isn't right." });
      passwordRef.current?.focus();
      return;
    }

    router.push("/");
    router.refresh();
  };

  const errorCount = (errors.email ? 1 : 0) + (errors.password ? 1 : 0);

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8">
      {/* One summary above the form, then the specifics beside the fields.
          Announced politely: it appears in response to the user's own submit,
          so it does not need to interrupt whatever else is being read. */}
      {errorCount > 0 && (
        <div
          role="status"
          className="fade-in mb-6 flex items-start gap-2.5 rounded-[6px] border border-negative/25 bg-negative-bg px-3.5 py-3"
        >
          <CircleAlert size={15} strokeWidth={2} className="mt-px shrink-0 text-negative" aria-hidden />
          <p className="text-[13px] leading-relaxed text-negative">
            {errorCount === 1
              ? "One field needs your attention before you can sign in."
              : "Two fields need your attention before you can sign in."}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Work email ------------------------------------------------- */}
        <div className="min-w-0">
          <label htmlFor={emailId} className="block text-[13px] font-semibold text-navy">
            Work email
          </label>
          <div className="mt-2">
            <input
              ref={emailRef}
              id={emailId}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoFocus
              spellCheck={false}
              placeholder="you@lustre.example"
              value={email}
              disabled={pending}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
              onChange={(e) => edit("email", setEmail)(e.target.value)}
              onBlur={() => setErrors((prev) => ({ ...prev, email: validate().email }))}
              className={`${control} ${
                errors.email
                  ? "border-negative focus:border-negative"
                  : "border-border hover:border-[#d8dfeb] focus:border-accent"
              }`}
            />
          </div>
          {errors.email && (
            <p id={`${emailId}-error`} className="mt-1.5 text-[12px] leading-relaxed text-negative">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password --------------------------------------------------- */}
        <div className="min-w-0">
          <label htmlFor={passwordId} className="block text-[13px] font-semibold text-navy">
            Password
          </label>
          <div className="relative mt-2">
            <input
              ref={passwordRef}
              id={passwordId}
              name="password"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              disabled={pending}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? `${passwordId}-error` : undefined}
              onChange={(e) => edit("password", setPassword)(e.target.value)}
              onBlur={() => setErrors((prev) => ({ ...prev, password: validate().password }))}
              className={`${control} pr-11 ${
                errors.password
                  ? "border-negative focus:border-negative"
                  : "border-border hover:border-[#d8dfeb] focus:border-accent"
              }`}
            />
            {/* Sits inside the field rather than beside it, so revealing a
                password never shifts the layout of the form. */}
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              disabled={pending}
              aria-pressed={reveal}
              aria-label={reveal ? "Hide password" : "Show password"}
              className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-secondary hover:text-navy disabled:pointer-events-none"
            >
              {reveal ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
            </button>
          </div>
          {errors.password && (
            <p id={`${passwordId}-error`} className="mt-1.5 text-[12px] leading-relaxed text-negative">
              {errors.password}
            </p>
          )}
        </div>
      </div>

      {/* Passkey: the data-service password. It is used once, right after
          sign-in, to fetch newer sales data, and is never stored. */}
      <div className="mt-5">
        <label htmlFor={passkeyId} className="block text-[13px] font-semibold text-navy">
          Passkey <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id={passkeyId}
          name="passkey"
          type="password"
          autoComplete="off"
          value={passkey}
          disabled={pending}
          onChange={(e) => setPasskey(e.target.value)}
          className={`${control} mt-2 border-border focus:border-accent`}
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          Enter today&apos;s passkey to bring in any sales newer than what is already loaded. It is used once and not saved.
        </p>
      </div>

      {/* Session length and recovery ---------------------------------- */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <label className="flex cursor-pointer select-none items-center gap-2.5">
          <span
            className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
              remember ? "border-accent bg-accent text-white" : "border-border bg-card text-transparent"
            }`}
          >
            <Check size={12} strokeWidth={3} aria-hidden />
          </span>
          <input
            type="checkbox"
            checked={remember}
            disabled={pending}
            onChange={(e) => setRemember(e.target.checked)}
            className="sr-only"
          />
          <span className="text-[13px] text-navy-muted">Keep me signed in</span>
        </label>

        {/* A real destination rather than a dead link: password recovery is
            administrator-led here, and the page says so in one screen. */}
        <Link
          href="/forgot-password"
          className="text-[13px] font-semibold text-accent underline-offset-4 transition-colors hover:text-accent-dark hover:underline"
        >
          Forgot your password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-7 h-11 w-full text-[14px] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <>
            <LoaderCircle size={15} className="animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>

      {/* States plainly what this does and does not do. Better here, on the
          screen itself, than discovered by someone typing a real password into
          a form that never checks one. */}
      <p className="mt-6 border-t border-border pt-5 text-[12px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-navy-muted">Demo accounts.</span> Password is{" "}
        <span className="font-mono text-navy-muted">changeme123</span> for both. Use{" "}
        <button
          type="button"
          onClick={() => {
            setEmail(DEMO_ACCOUNTS.management);
            setErrors((e) => ({ ...e, email: undefined }));
            passwordRef.current?.focus();
          }}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          {DEMO_ACCOUNTS.management}
        </button>{" "}
        to open the management view, or{" "}
        <button
          type="button"
          onClick={() => {
            setEmail(DEMO_ACCOUNTS.rep);
            setErrors((e) => ({ ...e, email: undefined }));
            passwordRef.current?.focus();
          }}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          {DEMO_ACCOUNTS.rep}
        </button>{" "}
        for the sales rep view.
      </p>
    </form>
  );
}
