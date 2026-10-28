"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, Check, KeyRound, RotateCcw, UserRound,
} from "lucide-react";
import { navigation } from "@/components/shell/nav";
import { useRole, usePermissions } from "@/components/shell/RoleContext";
import SectionNav from "@/components/shell/SectionNav";
import { Badge, Card, CardBody, CardHeader, SectionHeading } from "@/components/ui/primitives";
import { ReadOnlyRow, SelectInput, TextInput, Toggle } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import {
  countChanges, defaultSettings, landingPages, loadSettings,
  mergeSettings, saveSettings, timezones,
  type AccountSettings as Settings,
} from "@/lib/settings";

const sections = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "access", label: "Access" },
];

export default function AccountSettings() {
  const { role, viewer } = useRole();
  const base = useMemo(() => defaultSettings(viewer), [viewer]);
  const { error } = useToast();

  // Loaded once per signed-in account from /api/account/settings — never
  // localStorage, which has no notion of which account is signed in and so
  // would show one user's saved name/title on another account's screen on a
  // shared browser.
  const [raw, setRaw] = useState<Partial<Settings> | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server on mount
    setRaw(undefined);
    loadSettings()
      .then((s) => {
        if (!cancelled) setRaw(s);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setRaw(null);
          error("Could not load your settings", `${e.message} Showing defaults.`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role, error]);

  const loading = raw === undefined;
  const saved = useMemo(() => mergeSettings(base, raw ?? null), [base, raw]);

  const [justSaved, setJustSaved] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);
  const confirmSaved = useCallback((next: Settings) => {
    // The just-written record becomes the new saved baseline directly — no
    // need to re-fetch what this same request just wrote.
    setRaw(next);
    setJustSaved(true);
    window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setJustSaved(false), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  if (loading) {
    return <p className="text-[13px] text-muted-foreground">Loading your settings…</p>;
  }

  return (
    <SettingsForm
      key={role}
      saved={saved}
      justSaved={justSaved}
      onSaved={confirmSaved}
    />
  );
}

function SettingsForm({
  saved,
  justSaved,
  onSaved,
}: {
  saved: Settings;
  justSaved: boolean;
  onSaved: (next: Settings) => void;
}) {
  const { isSystem, viewer } = useRole();
  const { permissions } = usePermissions();

  const [draft, setDraft] = useState<Settings>(saved);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { error } = useToast();

  const changes = countChanges(saved, draft);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const commit = async () => {
    setSaving(true);
    const failure = await saveSettings(draft);
    setSaving(false);
    setSaveError(failure);
    if (failure) {
      // The inline note in the save bar is easy to miss on a long settings
      // page, and a failed save is the one thing here the user must not walk
      // away believing succeeded — so it is also raised as a toast, which
      // stays on screen until it is dismissed.
      error("Settings were not saved", failure);
      return;
    }
    onSaved(draft);
  };

  // A non-admin must never learn a hidden screen exists — so a non-system
  // role sees only the pages already open to them, with no count or list
  // entry hinting at what else is out there. Only an isSystem role (the de
  // facto admin) sees the full picture, disallowed items included.
  const engineAccess = navigation
    .flatMap((g) => g.items.map((i) => ({ ...i, section: g.section, allowed: isSystem || (permissions[i.permissionKey] ?? false) })))
    .filter((e) => isSystem || e.allowed);

  return (
    <>
      <SectionNav sections={sections} />

      {/* ==================================================== Profile == */}
      <section className="space-y-6">
        <SectionHeading
          id="profile"
          title="Profile"
          description="How you appear to the rest of the sales organisation, and where LUSTRE sends anything addressed to you."
        />

        <Card>
          <CardBody className="space-y-8">
            <div className="flex flex-wrap items-center gap-5">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[21px] font-semibold text-navy">
                {viewer.initials}
              </span>
              <div className="min-w-0">
                <p className="display text-[18px] font-bold text-navy">{viewer.name}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {viewer.team} · Joined {viewer.joined}
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <TextInput label="Full name" value={draft.name} onChange={(v) => set("name", v)} autoComplete="name" />
              <TextInput label="Job title" value={draft.title} onChange={(v) => set("title", v)} autoComplete="organization-title" />
              <TextInput label="Work email" type="email" value={draft.email} onChange={(v) => set("email", v)} autoComplete="email" />
              <TextInput label="Phone" type="tel" value={draft.phone} onChange={(v) => set("phone", v)} autoComplete="tel" />
              <SelectInput
                label="Primary market"
                hint="Sets the market this account opens on across the site."
                value={draft.market}
                onChange={(v) => set("market", v)}
                options={[
                  { value: "Global", label: "Global" },
                  { value: "Belgium", label: "Belgium" },
                  { value: "Dubai", label: "Dubai" },
                  { value: "Israel", label: "Israel" },
                  { value: "Hong Kong", label: "Hong Kong" },
                  { value: "India", label: "India" },
                  { value: "USA", label: "USA" },
                ]}
              />
            </div>
          </CardBody>
        </Card>
      </section>

      {/* ================================================ Preferences == */}
      <section className="space-y-6">
        <SectionHeading
          id="preferences"
          title="Preferences"
          description="How LUSTRE opens, and how figures and dates are formatted for you."
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Workspace" subtitle="Where the product starts and which view it opens in" />
            <CardBody className="grid gap-6 sm:grid-cols-2">
              <SelectInput
                label="Landing page"
                value={draft.landingPage}
                onChange={(v) => set("landingPage", v)}
                options={landingPages}
              />
              <SelectInput
                label="Timezone"
                value={draft.timezone}
                onChange={(v) => set("timezone", v)}
                options={timezones}
              />
              <SelectInput
                label="Week starts on"
                value={draft.weekStart}
                onChange={(v) => set("weekStart", v as Settings["weekStart"])}
                options={[
                  { value: "monday", label: "Monday" },
                  { value: "sunday", label: "Sunday" },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Display" subtitle="Formatting applied to figures, dates and table density" />
            <CardBody className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <SelectInput
                  label="Currency figures"
                  value={draft.currencyFormat}
                  onChange={(v) => set("currencyFormat", v as Settings["currencyFormat"])}
                  options={[
                    { value: "compact", label: "Compact — $342.0M" },
                    { value: "full", label: "Full — $342,000,000" },
                  ]}
                />
                <SelectInput
                  label="Date format"
                  value={draft.dateFormat}
                  onChange={(v) => set("dateFormat", v as Settings["dateFormat"])}
                  options={[
                    { value: "dmy", label: "17 Jul 2026" },
                    { value: "mdy", label: "Jul 17, 2026" },
                    { value: "iso", label: "2026-07-17" },
                  ]}
                />
              </div>
              <div className="divide-y divide-border/70 border-t border-border/70">
                <Toggle
                  label="Compact table density"
                  description="Tighter rows in every table and list."
                  checked={draft.density === "compact"}
                  onChange={(v) => set("density", v ? "compact" : "comfortable")}
                />
                <Toggle
                  label="Reduce motion"
                  description="Removes panel and chart transitions."
                  checked={draft.reduceMotion}
                  onChange={(v) => set("reduceMotion", v)}
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ============================================== Notifications == */}
      <section className="space-y-6">
        <SectionHeading
          id="notifications"
          title="Notifications"
          description="What the bell at the top of the page tells you about."
        />

        <Card>
          <CardBody className="space-y-3">
            <p className="text-[13.5px] leading-relaxed text-navy-soft">
              Notifications appear in the bell at the top of every page. They list customers who
              are due to reorder or past their usual time, and customers at risk of leaving, from
              your own book.
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Email notifications, daily or weekly summaries and quiet hours are not available yet.
            </p>
          </CardBody>
        </Card>
      </section>

      {/* =================================================== Security == */}
      <section className="space-y-6">
        <SectionHeading
          id="security"
          title="Security"
          description="How you sign in."
        />

        <Card>
          <CardHeader icon={<KeyRound size={16} />} title="Password" />
          <CardBody className="space-y-3">
            <p className="text-[13.5px] leading-relaxed text-navy-soft">
              Passwords are set by your administrator. To change yours, ask an administrator to
              reset it from Administration.
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Two-factor sign-in, automatic sign-out and a list of your signed-in devices are not
              available yet.
            </p>
          </CardBody>
        </Card>
      </section>

      {/* ===================================================== Access == */}
      <section className="space-y-6">
        <SectionHeading
          id="access"
          title="Access"
          description="The pages this account can open. Access is set by your administrator."
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader icon={isSystem ? <Building2 size={16} /> : <UserRound size={16} />} title="Role" subtitle="Sets which screens you can open" />
            <CardBody>
              <ReadOnlyRow label="Current role" value={viewer.title} />
              <ReadOnlyRow label="Team" value={viewer.team} />
              <ReadOnlyRow label="Primary market" value={viewer.market} />
              <ReadOnlyRow label="Member since" value={viewer.joined} />
              <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
                Roles are assigned by your LUSTRE administrator.
              </p>
            </CardBody>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader
              title="Screens you can open"
              subtitle="Set by the role this account has been given"
              action={
                <Badge tone="neutral">
                  {isSystem
                    ? `${engineAccess.filter((e) => e.allowed).length} of ${engineAccess.length} available`
                    : `${engineAccess.length} available`}
                </Badge>
              }
            />
            <CardBody className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {engineAccess.map((e) => (
                <div
                  key={e.href}
                  className="flex items-center justify-between gap-4 border-b border-border/70 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-navy">{e.label}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {e.section}
                    </p>
                  </div>
                  {e.allowed ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-positive">
                      <Check size={13} strokeWidth={3} />
                      Available
                    </span>
                  ) : (
                    <span className="shrink-0 text-[12px] font-medium text-muted-foreground">
                      Not in role
                    </span>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </section>

      {/* Save bar — only present when there is something to save.

          It bleeds to the sheet's edges, so the negative margin has to cancel
          the content column's padding exactly at every breakpoint. It was
          missing the `sm` step and cancelled `-mx-6` against a `px-5` column at
          base, which pushed the bar 4px past the sheet on narrow screens. */}
      {changes > 0 && (
        <div className="sticky bottom-0 z-10 -mx-5 border-t border-border bg-card px-5 py-4 shadow-[0_-2px_8px_rgba(15,23,41,0.07)] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[13px] text-navy-muted">
              <span className="font-semibold text-navy">
                {changes} unsaved {changes === 1 ? "change" : "changes"}
              </span>
              {saveError && (
                <span className="ml-2 text-negative">{saveError}</span>
              )}
            </p>
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => setDraft(saved)} disabled={saving} className="btn btn-secondary">
                <RotateCcw size={14} />
                Discard
              </button>
              <button type="button" onClick={commit} disabled={saving} className="btn btn-primary">
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {justSaved && (
        <p role="status" className="text-[13px] font-semibold text-positive">
          <Check size={14} strokeWidth={3} className="mr-1.5 inline align-text-bottom" />
          Settings saved.
        </p>
      )}
    </>
  );
}
