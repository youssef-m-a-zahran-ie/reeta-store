import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section, Tabs } from "@/components/admin/ui";
import { ActionForm, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { DeleteForm } from "@/components/admin/delete-form";
import { deleteFaq, saveFaq } from "../actions";
import { CONTENT_TABS } from "../schema";
import { Bilingual } from "../bilingual";

export const metadata: Metadata = { title: "FAQ" };

export default async function FaqPage() {
  const { supabase } = await requireAdmin();
  const { data: faqs } = await supabase.from("faqs").select("*").order("sort").order("created_at");
  const nextSort = (faqs?.at(-1)?.sort ?? 0) + 1;

  return (
    <>
      <PageHeader eyebrow="Site" title="Content" description="Questions shown at the bottom of the Contact page. Lower position numbers show first." />
      <Tabs items={CONTENT_TABS} current="/admin/content/faq" />
      <div className="grid gap-5">
        {(faqs ?? []).map((f) => (
          <Section key={f.id}>
            <ActionForm action={saveFaq} className="grid gap-4">
              <input type="hidden" name="id" value={f.id} />
              <Bilingual name="question" label="Question" en={f.question_en} ar={f.question_ar} />
              <Bilingual name="answer" label="Answer" long en={f.answer_en} ar={f.answer_ar} />
              <div className="flex flex-wrap items-center gap-4">
                <Toggle name="is_visible" defaultChecked={f.is_visible} label="Visible" />
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted">Position</span>
                  <input className="input num w-20 py-1.5" type="number" name="sort" defaultValue={f.sort} />
                </label>
                <SubmitButton className="btn btn-primary btn-sm ms-auto">Save</SubmitButton>
              </div>
            </ActionForm>
            <div className="mt-3 flex justify-end border-t border-line pt-3">
              <DeleteForm action={deleteFaq} id={f.id} label="Delete question" />
            </div>
          </Section>
        ))}
        <Section title="Add a question">
          <ActionForm action={saveFaq} className="grid gap-4" resetOnSuccess>
            <Bilingual name="question" label="Question" en="" ar="" />
            <Bilingual name="answer" label="Answer" long en="" ar="" />
            <input type="hidden" name="sort" value={nextSort} />
            <input type="hidden" name="is_visible" value="on" />
            <div>
              <SubmitButton className="btn btn-primary btn-sm">Add question</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
