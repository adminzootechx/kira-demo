import AccountSettings from "@/components/account/AccountSettings";
import { PageHeader } from "@/components/ui/primitives";

export const metadata = {
  title: "Account Settings — LUSTRE Sales Intelligence",
};

export default function AccountPage() {
  return (
    <>
      <PageHeader
        breadcrumb={["Account", "Settings"]}
        title="Account Settings"
        subtitle="Your details, how the site looks and behaves for you, what you get told about, and how your account is kept safe."
      />
      <AccountSettings />
    </>
  );
}
