import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { loadLookups } from "../lookups";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const { supabase } = await requireAdmin();
  const lookups = await loadLookups(supabase);
  return (
    <>
      <PageHeader
        eyebrow="Catalog · New product"
        title="New product"
        description="Start with the name, category and how it's sold. Sizes, prices and photos come right after."
        actions={
          <Link href="/admin/catalog/products" className="btn btn-ghost">
            Cancel
          </Link>
        }
      />
      <ProductForm product={null} lookups={lookups} />
    </>
  );
}
