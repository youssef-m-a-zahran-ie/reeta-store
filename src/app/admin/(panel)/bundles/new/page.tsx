import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { BundleForm } from "../bundle-form";
import { loadVariantOptions } from "../options";

export const metadata: Metadata = { title: "New box" };

export default async function NewBundlePage() {
  const { supabase } = await requireAdmin();
  const options = await loadVariantOptions(supabase);
  return (
    <>
      <PageHeader
        eyebrow="Bundles · New"
        title="New box"
        actions={
          <Link href="/admin/bundles" className="btn btn-ghost">
            Cancel
          </Link>
        }
      />
      <BundleForm bundle={null} items={[]} options={options} />
    </>
  );
}
