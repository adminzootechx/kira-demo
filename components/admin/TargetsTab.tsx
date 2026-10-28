"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { usd } from "@/lib/format";
import type { TargetsResponse } from "@/app/api/targets/route";

export default function TargetsTab() {
  const [data, setData] = useState<TargetsResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { error, success } = useToast();

  const load = () =>
    fetch("/api/targets", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: TargetsResponse) => {
        setData(b);
        const next: Record<string, string> = {};
        for (const r of [b.company, ...b.reps]) if (r) next[r.owner] = r.target ? String(r.target) : "";
        setDraft(next);
      });

  useEffect(() => {
    void load();
  }, []);

  const save = async (owner: string) => {
    if (!data) return;
    const amount = Number((draft[owner] ?? "").replace(/,/g, "")) || 0;
    const res = await fetch("/api/admin/targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: data.year, owner, amount }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not save the target", body.error ?? "Try again.");
      return;
    }
    success("Saved", amount > 0 ? `Target set to ${usd(amount)}.` : "Target cleared.");
    void load();
  };

  if (!data) return <p className="text-[13px] text-muted-foreground">Loading targets…</p>;

  const rows = [
    { owner: "", label: "Whole company", actual: data.company?.actual ?? 0 },
    ...data.reps.map((r) => ({ owner: r.owner, label: r.owner, actual: r.actual })),
  ];

  return (
    <Card>
      <CardHeader
        title={`Sales targets for ${data.year}`}
        subtitle="One yearly amount in US dollars per salesperson, and one for the whole company. Leave blank or 0 for no target. Everyone sees theirs on the Targets page."
      />
      <CardBody>
        <Table>
          <thead>
            <tr>
              <Th>Who</Th>
              <Th align="right">Sold so far</Th>
              <Th align="right">Target for the year (USD)</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.owner || "company"}>
                <Td className="font-semibold text-navy">{r.label}</Td>
                <Td align="right">{usd(r.actual)}</Td>
                <Td align="right">
                  <input
                    inputMode="numeric"
                    aria-label={`Target for ${r.label}`}
                    value={draft[r.owner] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.owner]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && void save(r.owner)}
                    placeholder="No target"
                    className="w-40 rounded-lg border border-border bg-input/60 px-3 py-2 text-right text-[13px] text-navy outline-none focus:border-accent focus:bg-card"
                  />
                </Td>
                <Td align="right">
                  <button type="button" onClick={() => void save(r.owner)} className="btn btn-secondary">
                    Save
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CardBody>
    </Card>
  );
}
