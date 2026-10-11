import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { EmptyState, PageHeader, Section, Tabs } from "@/components/admin/ui";
import { MENU_TABS } from "../tabs";
import { PhotoCell } from "./photo-cell";

export const metadata: Metadata = { title: "Plate photos" };

export default async function MenuPhotosPage() {
  const { supabase } = await requireAdmin();
  const [{ data: bases }, { data: coatings }, { data: photos }] = await Promise.all([
    supabase.from("custom_bases").select("base_id, image_path, is_active, sort, bases(name_en)").order("sort"),
    supabase.from("custom_coatings").select("coating_id, label_en, is_active, sort, coatings(name_en, color)").order("sort"),
    supabase.from("custom_plate_photos").select("base_id, coating_id, image_path"),
  ]);
  const photoOf = (b: string, c: string) => photos?.find((p) => p.base_id === b && p.coating_id === c)?.image_path ?? null;
  const shown = (bases ?? []).filter((b) => b.is_active);
  const sauces = (coatings ?? []).filter((c) => c.is_active);

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Menu"
        description="The plate the shopper sees: plain on the grid, then with the sauce they pick. Use square photos shot from the same angle and light, on a plain or transparent background, so switching sauces looks smooth. Until a photo is added, the store shows a stand-in."
        actions={
          <Link href="/#menu" target="_blank" className="btn btn-secondary btn-sm">
            Open on the store
          </Link>
        }
      />
      <Tabs items={MENU_TABS} current="/admin/menu/photos" />

      {!shown.length ? (
        <EmptyState title="No nuts on the menu yet" />
      ) : (
        <div className="grid gap-4">
          {shown.map((b) => (
            <Section key={b.base_id} title={b.bases?.name_en ?? ""}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <PhotoCell baseId={b.base_id} coatingId={null} label="Plain (on the grid)" path={b.image_path} />
                {sauces.map((c) => (
                  <PhotoCell
                    key={c.coating_id}
                    baseId={b.base_id}
                    coatingId={c.coating_id}
                    label={c.label_en || c.coatings?.name_en || ""}
                    color={c.coatings?.color ?? null}
                    path={photoOf(b.base_id, c.coating_id)}
                  />
                ))}
              </div>
            </Section>
          ))}
        </div>
      )}
    </>
  );
}
