import ApprovalsView from "@/components/approvals/ApprovalsView";
import { PageHeader } from "@/components/ui/primitives";

export const metadata = {
  title: "Approvals — LUSTRE Sales Intelligence",
};

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader
        breadcrumb={["Work", "Approvals"]}
        title="Approvals"
        subtitle="Ask your manager to approve something, and decide the requests sent to you."
      />
      <ApprovalsView />
    </>
  );
}
