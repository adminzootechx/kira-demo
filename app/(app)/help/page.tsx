import Link from "next/link";
import { CircleHelp, MessageSquareText } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { errorCodes } from "@/lib/errorCodes";

/**
 * Not part of `navigation`/the permission system, deliberately — like
 * `/account`, help should never be gated behind a role, since the person
 * most likely to need it is the one currently stuck.
 */
export default function HelpPage() {
  return (
    <>
      <PageHeader
        title="Help"
        subtitle="What each error code on screen means, and how to resolve it."
      />

      <Card>
        <CardHeader
          icon={<CircleHelp size={16} />}
          title="Error codes"
          subtitle="Shown alongside an error message or reference on screen — look up the code here for what happened and what to do about it."
        />
        <CardBody className="divide-y divide-border/70 !p-0">
          {errorCodes.map((e) => (
            <div key={e.code} id={e.code} className="scroll-mt-24 px-6 py-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[12.5px] font-bold text-accent">{e.code}</span>
                <h3 className="text-[14px] font-semibold text-navy">{e.title}</h3>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-navy-muted">{e.description}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-navy">
                <span className="font-semibold">What to do: </span>
                {e.resolution}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<MessageSquareText size={16} />}
          title="Still stuck?"
          subtitle="Ask the Copilot to explain a code directly, or reach the person who set up LUSTRE for you."
        />
        <CardBody>
          <p className="text-[13px] leading-relaxed text-navy-soft">
            You can ask the{" "}
            <Link href="/copilot" className="font-semibold text-accent hover:text-accent-dark">
              AI Sales Copilot
            </Link>{" "}
            things like &ldquo;what does LUSTRE-SYNC-2 mean?&rdquo; and it will answer from this same list.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
