import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section } from "@/components/admin/ui";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { user } = await requireAdmin();
  return (
    <>
      <PageHeader eyebrow="Site" title="Account" description={`Signed in as ${user.email}.`} />
      <Section title="Change password" description="If you came here from a reset link, set your new password now." className="max-w-xl">
        <PasswordForm />
      </Section>
    </>
  );
}
