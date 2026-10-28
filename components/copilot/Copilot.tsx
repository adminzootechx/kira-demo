"use client";

import { useRef, useState } from "react";
import { ArrowUp, Bot, Table2, UserRound } from "lucide-react";
import { Table, Td, Th } from "@/components/ui/primitives";
import { findErrorCode } from "@/lib/errorCodes";

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; answer: CopilotAnswer };

type CopilotAnswer = {
  question: string;
  summary: string;
  evidence: string[];
  actions?: string[];
  table?: { head: string[]; rows: string[][] };
};

const fallback = (question: string): CopilotAnswer => ({
  question,
  summary:
    "I cannot answer questions about your sales yet. Answers from your own sales records are not connected, and I will not guess or make up a figure.",
  evidence: [
    "For now I can look up what a LUSTRE error code means. Type a code such as SYNC-2.",
  ],
});

/** Recognizes "LUSTRE-XXX-N" anywhere in the question, with or without the
 *  "LUSTRE-" prefix (someone asking "what does SYNC-2 mean" still resolves). */
function errorCodeAnswer(q: string): CopilotAnswer | null {
  const match = q.match(/\b(?:lustre-)?([a-z]+-\d+)\b/i);
  if (!match) return null;
  const code = findErrorCode(`LUSTRE-${match[1]}`) ?? findErrorCode(match[0]);
  if (!code) return null;
  return {
    question: q,
    summary: `${code.code} — ${code.title}. ${code.description}`,
    evidence: [`What to do: ${code.resolution}`],
    actions: ["See the full error-code list on the Help page."],
  };
}

function matchAnswer(q: string): CopilotAnswer {
  const errorAnswer = errorCodeAnswer(q);
  if (errorAnswer) return errorAnswer;

  return fallback(q);
}

export default function Copilot({ fill = false }: { fill?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setTurns((t) => [...t, { role: "user", text: q }, { role: "assistant", answer: matchAnswer(q) }]);
    setInput("");
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  return (
    <div
      className={
        fill
          ? "flex h-full min-h-0 flex-col"
          : "surface flex h-[min(calc(100vh-220px),760px)] min-h-[540px] flex-col overflow-hidden"
      }
    >
      {/* Header — skipped in fill mode: the drawer it sits in already shows
          its own title bar, and a second "Ask a question" heading right
          under it would just repeat what the drawer already said. */}
      {!fill && (
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-lg border border-accent-border bg-accent-bg text-accent-dark">
            <Bot size={17} />
          </span>
          <div className="flex-1">
            <h2 className="display text-[16px] font-semibold leading-tight text-navy">
              Ask a question
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Looks up LUSTRE error codes
            </p>
          </div>
          
        </div>
      )}

      {/* Transcript */}
      <div className={`flex-1 overflow-y-auto px-5 py-5 ${turns.length === 0 ? "flex items-center justify-center" : "space-y-5"}`}>
        {turns.length === 0 && (
          <div className="mx-auto max-w-2xl text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-accent-border bg-accent-bg text-accent-dark">
              <Bot size={20} />
            </span>
            <h3 className="mt-4 display text-[19px] font-semibold text-navy">
              Look up an error code
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
              Type a LUSTRE error code, such as SYNC-2, to see what it means and what to do. Questions about your sales are not connected yet.
            </p>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end gap-3">
              <p className="max-w-[80%] rounded-xl rounded-br-sm bg-navy px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
                {t.text}
              </p>
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-navy">
                <UserRound size={14} />
              </span>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-accent-border bg-accent-bg text-accent-dark">
                <Bot size={14} />
              </span>
              <div className="min-w-0 max-w-[86%] space-y-3">
                <p className="rounded-xl rounded-tl-sm border border-border bg-card px-3.5 py-2.5 text-[13px] leading-relaxed text-navy-soft">
                  {t.answer.summary}
                </p>

                {t.answer.table && (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      <Table2 size={11} />
                      The numbers behind this
                    </div>
                    <Table>
                      <thead>
                        <tr>
                          {t.answer.table.head.map((h, hi) => (
                            <Th key={h} align={hi === 0 ? "left" : "right"}>{h}</Th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {t.answer.table.rows.map((r, ri) => (
                          <tr key={ri}>
                            {r.map((cell, ci) => (
                              <Td
                                key={ci}
                                align={ci === 0 ? "left" : "right"}
                                className={ci === 0 ? "font-semibold text-navy" : ""}
                              >
                                {cell}
                              </Td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}

                <div className="rounded-lg border border-border bg-secondary/50 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Where this comes from
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {t.answer.evidence.map((e) => (
                      <li key={e} className="flex gap-2 text-[12px] leading-relaxed text-navy-soft">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>

                {t.answer.actions && (
                  <div className="rounded-lg border border-accent-border bg-accent-bg px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-accent-dark">
                      What to do about it
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {t.answer.actions.map((a) => (
                        <li key={a} className="flex gap-2 text-[12px] leading-relaxed text-navy-soft">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent-dark" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border px-5 py-3.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type an error code, such as SYNC-2"
            className="flex-1 rounded-lg border border-border bg-input/60 px-3.5 py-2.5 text-[13px] text-navy outline-none placeholder:text-muted-foreground focus:border-accent focus:bg-card"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy text-white transition-colors hover:bg-navy-soft disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
