import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section, StatusChip } from "@/components/admin/ui";
import { DeleteForm } from "@/components/admin/delete-form";
import { ImageManager } from "@/components/admin/image-manager";
import { BundleForm } from "../bundle-form";
import { loadVariantOptions } from "../options";
import { addBundleImages, deleteBundle, deleteBundleImage, updateBundleImages } from "../actions";

export const metadata: Metadata = { title: "Box" };

export default async function BundlePage({ params, searchParams }: PageProps<"/admin/bundles/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [{ data: bundle }, { data: items }, { data: images }, options] = await Promise.all([
    supabase.from("bundles").select("*").eq("id", id).maybeSingle(),
    supabase.from("bundle_items").select("variant_id, qty").eq("bundle_id", id),
    supabase.from("bundle_images").select("id, path, alt_en, alt_ar").eq("bundle_id", id).order("sort"),
    loadVariantOptions(supabase),
  ]);
  if (!bundle) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Bundles"
        title={bundle.name_en}
        description={<StatusChip status={bundle.status} />}
        actions={
          <Link href="/admin/bundles" className="btn btn-ghost">
            All boxes
          </Link>
        }
      />
      {sp.created && <p className="mb-5 rounded-xl bg-sage/15 px-4 py-2.5 text-sm font-medium text-[#4d5a33]">Box created. Add a photo, then make it active.</p>}
      <div className="grid gap-5">
        <Section title="Photos" description="Without a photo, the store draws the Reeta gift box with the pouches inside.">
          <ImageManager
            folder={`bundles/${bundle.id}`}
            images={images ?? []}
            onAdd={addBundleImages.bind(null, bundle.id)}
            onUpdate={updateBundleImages.bind(null, bundle.id)}
            onDelete={deleteBundleImage.bind(null, bundle.id)}
          />
        </Section>
        <BundleForm bundle={bundle} items={items ?? []} options={options} />
        <Section title="Delete">
          <DeleteForm action={deleteBundle} id={bundle.id} label="Delete box" question={`Delete ${bundle.name_en}? Boxes with orders can only be archived.`} />
        </Section>
      </div>
    </>
  );
}
