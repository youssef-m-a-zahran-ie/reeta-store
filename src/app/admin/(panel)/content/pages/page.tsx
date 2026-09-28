import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section, Tabs } from "@/components/admin/ui";
import { ActionForm, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { savePage } from "../actions";
import { CONTENT_TABS } from "../schema";
import { Bilingual } from "../bilingual";

export const metadata: Metadata = { title: "Pages" };

const ORDER = ["about", "shipping-returns", "privacy", "terms"];
const HINTS: Record<string, string> = {
  about: "Shown on the About page.",
  "shipping-returns": "Linked in the footer once published.",
  privacy: "Needed before running Meta or TikTok ads. Linked in the footer once published.",
  terms: "Linked in the footer once published.",
};

export default async function PagesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("pages").select("*");
  const pages = [...(data ?? [])].sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));

  return (
    <>
      <PageHeader eyebrow="Site" title="Content" description="Leave an empty line between paragraphs. Drafts stay hidden from the store." />
      <Tabs items={CONTENT_TABS} current="/admin/content/pages" />
      <div className="grid gap-5">
        {pages.map((p) => (
          <Section
            key={p.slug}
            title={p.title_en}
            description={HINTS[p.slug]}
            actions={
              p.is_published ? (
                <a
                  href={p.slug === "about" ? "/about" : `/policies/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chip bg-sage/15 px-3 py-1 text-[#56633a] hover:underline"
                >
                  Live · view
                </a>
              ) : (
                <span className="chip bg-cream px-3 py-1 text-cocoa">Draft</span>
              )
            }
          >
            <ActionForm action={savePage} className="grid gap-4">
              <input type="hidden" name="slug" value={p.slug} />
              <Bilingual name="title" label="Title" en={p.title_en} ar={p.title_ar} />
              <Bilingual name="body" label="Text" long rows={10} en={p.body_en ?? ""} ar={p.body_ar ?? ""} />
              <div className="flex flex-wrap items-center gap-4">
                <Toggle name="is_published" defaultChecked={p.is_published} label="Published" />
                <SubmitButton className="btn btn-primary btn-sm ms-auto">Save</SubmitButton>
              </div>
            </ActionForm>
          </Section>
        ))}
      </div>
    </>
  );
}
