import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section, Tabs } from "@/components/admin/ui";
import { DeleteForm } from "@/components/admin/delete-form";
import { deleteReview } from "../actions";
import { CONTENT_TABS } from "../schema";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const { supabase } = await requireAdmin();
  const { data: reviews } = await supabase.from("testimonials").select("*").order("sort").order("created_at");
  const nextSort = (reviews?.at(-1)?.sort ?? 0) + 1;

  return (
    <>
      <PageHeader
        eyebrow="Site"
        title="Content"
        description="Customer reviews for the home page. Paste what they wrote, add a screenshot of the chat, or both. The section stays hidden until one review is visible."
      />
      <Tabs items={CONTENT_TABS} current="/admin/content/reviews" />
      <div className="grid gap-5">
        {(reviews ?? []).map((r) => (
          <Section key={r.id}>
            <ReviewForm review={r} />
            <div className="mt-3 flex justify-end border-t border-line pt-3">
              <DeleteForm action={deleteReview} id={r.id} label="Delete review" />
            </div>
          </Section>
        ))}
        <Section title="Add a review">
          <ReviewForm key={reviews?.length ?? 0} nextSort={nextSort} />
        </Section>
      </div>
    </>
  );
}
