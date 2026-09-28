import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { EmptyState, PageHeader, StatusChip } from "@/components/admin/ui";
import { egp } from "@/lib/format";
import { mediaUrl } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Bundles" };

export default async function BundlesPage({ searchParams }: PageProps<"/admin/bundles">) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: bundles } = await supabase
    .from("bundles")
    .select("id, name_en, name_ar, price, status, bundle_items(qty), bundle_images(path, sort)")
    .order("sort")
    .order("created_at");

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Bundles"
        description="Ready-made boxes at one price. The store shows how much the customer saves compared with buying each pouch."
        actions={
          <Link href="/admin/bundles/new" className="btn btn-primary">
            New box
          </Link>
        }
      />
      {sp.deleted && <p className="mb-4 rounded-xl bg-sage/15 px-4 py-2 text-sm font-medium text-[#4d5a33]">Box deleted.</p>}
      {!bundles?.length ? (
        <EmptyState
          title="No boxes yet"
          action={
            <Link href="/admin/bundles/new" className="btn btn-primary btn-sm">
              New box
            </Link>
          }
        >
          A box mixes a few pouches at a better price, like 250 g White Cashew + 250 g Dark Almond.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b) => {
            const cover = [...(b.bundle_images ?? [])].sort((x, y) => x.sort - y.sort)[0];
            return (
              <Link key={b.id} href={`/admin/bundles/${b.id}`} className="card grid gap-3 p-4 transition-colors hover:bg-blush/40">
                <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl bg-plum text-blush">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(cover.path)!} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="mark mark-full size-14" aria-hidden="true" />
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="grid">
                    <span className="font-semibold text-plum">{b.name_en}</span>
                    <span className="text-sm text-muted">{(b.bundle_items ?? []).reduce((s, i) => s + i.qty, 0)} pouches</span>
                  </span>
                  <StatusChip status={b.status} />
                </div>
                <span className="num font-display text-xl font-semibold text-plum">{egp(b.price)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
