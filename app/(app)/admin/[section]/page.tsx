import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { adminSections } from "@/components/admin/sections";
import UsersTab from "@/components/admin/UsersTab";
import GroupsTab from "@/components/admin/GroupsTab";
import RolesTab from "@/components/admin/RolesTab";
import { DepartmentsList, MarketsList } from "@/components/admin/DepartmentsMarketsTab";
import TargetsTab from "@/components/admin/TargetsTab";
import ClientAssignmentsTab from "@/components/admin/ClientAssignmentsTab";
import ApprovalTypesTab from "@/components/admin/ApprovalTypesTab";

const pages: Record<string, React.ReactNode> = {
  "team-members": <UsersTab />,
  "access-levels": <GroupsTab />,
  "job-titles": <RolesTab />,
  departments: <DepartmentsList />,
  markets: <MarketsList />,
  targets: <TargetsTab />,
  clients: <ClientAssignmentsTab />,
  "request-types": <ApprovalTypesTab />,
};

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const s = adminSections.find((x) => x.slug === section);
  return { title: `${s?.title ?? "Administration"} — LUSTRE Sales Intelligence` };
}

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const s = adminSections.find((x) => x.slug === section);
  if (!s) notFound();

  return (
    <>
      <PageHeader breadcrumb={["Administration", s.label]} title={s.title} subtitle={s.subtitle} />
      {pages[s.slug]}
    </>
  );
}
