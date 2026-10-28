import CustomerProfileView from "@/components/customers/CustomerProfileView";

/**
 * A thin server shell. The profile itself is a client view so it can read the
 * active customer book, which only exists in the browser once it has loaded.
 */
export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerProfileView id={id} />;
}
