"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { toWebp } from "@/components/admin/image-manager";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET, mediaUrl } from "@/lib/supabase/env";
import { saveReview } from "../actions";

type Review = { id: string; name: string | null; text_en: string | null; text_ar: string | null; image_path: string | null; sort: number; is_visible: boolean };

export function ReviewForm({ review, nextSort }: { review?: Review; nextSort?: number }) {
  const [image, setImage] = useState(review?.image_path ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy("Uploading…");
    try {
      const blob = await toWebp(file);
      const path = `reviews/${crypto.randomUUID()}.webp`;
      const { error } = await createClient().storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) setBusy("Upload failed. Try again.");
      else {
        setImage(path);
        setBusy(null);
      }
    } catch {
      setBusy("Couldn't read that image.");
    }
  }

  return (
    <ActionForm action={saveReview} className="grid gap-4" resetOnSuccess={!review}>
      {review && <input type="hidden" name="id" value={review.id} />}
      <input type="hidden" name="image_path" value={image} />
      <div className="grid gap-4 md:grid-cols-[160px_1fr]">
        <div className="grid content-start gap-2">
          <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-page">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(image)!} alt="" className="size-full object-cover" />
            ) : (
              <span className="px-3 text-center text-xs text-muted">Screenshot (optional)</span>
            )}
          </div>
          <label className="btn btn-secondary btn-sm cursor-pointer">
            {image ? "Change" : "Add screenshot"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {image && (
            <button type="button" className="btn btn-ghost btn-sm text-rose" onClick={() => setImage("")}>
              Remove image
            </button>
          )}
          {busy && <p className="text-xs text-plum">{busy}</p>}
        </div>
        <div className="grid content-start gap-3">
          <label className="field">
            <span className="label">Customer name (or first name)</span>
            <input className="input" name="name" defaultValue={review?.name ?? ""} />
          </label>
          <div className="grid gap-2 md:grid-cols-2">
            <textarea className="input" name="text_en" defaultValue={review?.text_en ?? ""} rows={3} placeholder="What they said (English)" aria-label="Review in English" />
            <textarea className="input" name="text_ar" defaultValue={review?.text_ar ?? ""} rows={3} dir="rtl" placeholder="الكلام بالعربي" aria-label="Review in Arabic" />
          </div>
          <p className="hint">Use real reviews only, with the customer&apos;s permission.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Toggle name="is_visible" defaultChecked={review?.is_visible ?? true} label="Show on the home page" />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Position</span>
          <input className="input num w-20 py-1.5" type="number" name="sort" defaultValue={review?.sort ?? nextSort ?? 0} />
        </label>
        <SubmitButton className="btn btn-primary btn-sm ms-auto">{review ? "Save" : "Add review"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
