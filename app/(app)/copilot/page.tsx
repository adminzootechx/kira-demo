import { Lock, MessageSquareText, ShieldCheck } from "lucide-react";
import Copilot from "@/components/copilot/Copilot";
import { Card, CardBody, CardHeader, DataNote, PageHeader } from "@/components/ui/primitives";

export default function CopilotPage() {
  return (
    <>
      <PageHeader
        title="Ask a question"
        subtitle="For now this explains LUSTRE error codes. Questions about your sales are not connected yet."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Copilot />

        <div className="space-y-6">
          <Card>
            <CardHeader icon={<MessageSquareText size={16} />} title="What it can answer today" />
            <CardBody className="space-y-2.5 text-[13px] leading-relaxed text-navy-soft">
              <p>Type an error code you have seen, such as LUSTRE-SYNC-2, to see what it means and what to do.</p>
              <p className="text-muted-foreground">
                Answers about customers, stock, prices and targets will come once it is connected to
                your sales data. Until then, those answers are on the pages themselves.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<ShieldCheck size={16} />} title="What it will not do" />
            <CardBody className="space-y-3">
              <div className="flex gap-2.5">
                <Lock size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-[12.5px] leading-relaxed text-navy-soft">
                  It only reads data LUSTRE has approved, and only what you are allowed to see: a
                  salesperson sees their own accounts, management sees everyone.
                </p>
              </div>
              <div className="flex gap-2.5">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-[12.5px] leading-relaxed text-navy-soft">
                  It reads the same checked figures the rest of the site uses. It will not invent
                  a number or draw a conclusion the data does not support.
                </p>
              </div>
              <DataNote>
                When it answers sales questions, each answer will show where its figures come from.
              </DataNote>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
