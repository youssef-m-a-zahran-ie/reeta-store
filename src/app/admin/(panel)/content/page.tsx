import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section, Tabs } from "@/components/admin/ui";
import { ActionForm, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { saveBlock } from "./actions";
import { CONTENT_TABS, HOME_BLOCKS } from "./schema";
import { Bilingual } from "./bilingual";

export const metadata: Metadata = { title: "Content" };

type Data = Record<string, unknown>;
const s = (d: Data | undefined, k: string) => (typeof d?.[k] === "string" ? (d[k] as string) : "");

export default async function ContentPage() {
  const { supabase } = await requireAdmin();
  const { data: blocks } = await supabase.from("content_blocks").select("*").eq("page", "home");
  const byKey = new Map((blocks ?? []).map((b) => [b.key, b]));

  return (
    <>
      <PageHeader
        eyebrow="Site"
        title="Content"
        description="The words on the store, in English and Arabic. Changes go live as soon as you save."
        actions={
          <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            View the store
          </a>
        }
      />
      <Tabs items={CONTENT_TABS} current="/admin/content" />

      <div className="grid gap-5">
        {HOME_BLOCKS.map((def) => {
          const b = byKey.get(def.key);
          const d = (b?.data ?? {}) as Data;
          const points = (Array.isArray(d.points) ? d.points : []) as Data[];
          return (
            <Section key={def.key} title={def.title} description={def.hint}>
              <ActionForm action={saveBlock} className="grid gap-4">
                <input type="hidden" name="key" value={def.key} />
                {def.fields.map((f) => (
                  <Bilingual key={f.name} name={f.name} label={f.label} long={f.long} en={s(d, `${f.name}_en`)} ar={s(d, `${f.name}_ar`)} />
                ))}
                {def.points &&
                  Array.from({ length: def.points }, (_, i) => (
                    <fieldset key={i} className="grid gap-3 rounded-2xl border border-line p-4">
                      <legend className="px-1 font-display text-sm font-semibold text-plum">Reason {i + 1}</legend>
                      <Bilingual name={`p${i}_title`} label="Title" en={s(points[i], "title_en")} ar={s(points[i], "title_ar")} />
                      <Bilingual name={`p${i}_text`} label="Text" long en={s(points[i], "text_en")} ar={s(points[i], "text_ar")} />
                    </fieldset>
                  ))}
                <div className="flex flex-wrap items-center gap-4">
                  {def.alwaysOn ? (
                    <input type="hidden" name="sort" value={b?.sort ?? 0} />
                  ) : (
                    <>
                      <Toggle name="is_visible" defaultChecked={b?.is_visible ?? true} label="Show on the home page" />
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Position</span>
                        <input className="input num w-20 py-1.5" type="number" name="sort" defaultValue={b?.sort ?? 0} min={0} max={99} />
                      </label>
                    </>
                  )}
                  <SubmitButton className="btn btn-primary btn-sm ms-auto">Save</SubmitButton>
                </div>
              </ActionForm>
            </Section>
          );
        })}
      </div>
    </>
  );
}
