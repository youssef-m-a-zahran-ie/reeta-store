"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET, mediaUrl } from "@/lib/supabase/env";
import type { ActionState } from "@/lib/admin/state";
import { Notice } from "@/components/admin/form-bits";
import { addProductImages, deleteProductImage, updateProductImages } from "./actions";

type Img = { id: string; path: string; alt_en: string | null; alt_ar: string | null };

const MAX_SIDE = 1600;
const QUALITY = 0.85;

/** Resizes an image in the browser and encodes it as WebP. */
async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  if (!blob) throw new Error("Could not convert the image");
  return blob;
}

export function ImageManager({ productId, images }: { productId: string; images: Img[] }) {
  const router = useRouter();
  const [list, setList] = useState(images);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>(null);
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Take fresh data from the server after uploads and deletes.
  const [prevImages, setPrevImages] = useState(images);
  if (images !== prevImages) {
    setPrevImages(images);
    setList(images);
    setDirty(false);
  }

  async function upload(files: FileList | File[]) {
    const picked = [...files].filter((f) => f.type.startsWith("image/"));
    if (!picked.length) {
      setState({ ok: false, message: "Pick image files (JPG, PNG or WebP)." });
      return;
    }
    const supabase = createClient();
    const paths: string[] = [];
    const failed: string[] = [];
    for (const [i, file] of picked.entries()) {
      setBusy(`Preparing photo ${i + 1} of ${picked.length}…`);
      try {
        const blob = await toWebp(file);
        const path = `products/${productId}/${crypto.randomUUID()}.webp`;
        setBusy(`Uploading photo ${i + 1} of ${picked.length}…`);
        const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
          contentType: "image/webp",
          cacheControl: "31536000",
        });
        if (error) failed.push(file.name);
        else paths.push(path);
      } catch {
        failed.push(file.name);
      }
    }
    setBusy(paths.length ? "Saving…" : null);
    if (paths.length) {
      const res = await addProductImages(productId, paths);
      setState(
        failed.length && res?.ok
          ? { ok: false, message: `${res.message} These didn't upload: ${failed.join(", ")}.` }
          : res,
      );
      startTransition(() => router.refresh());
    } else {
      setState({ ok: false, message: `Upload failed for ${failed.join(", ")}. Check your connection and try again.` });
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    setDirty(true);
  }

  function setAlt(i: number, key: "alt_en" | "alt_ar", value: string) {
    const next = [...list];
    next[i] = { ...next[i], [key]: value };
    setList(next);
    setDirty(true);
  }

  async function saveOrder() {
    setBusy("Saving…");
    const res = await updateProductImages(
      productId,
      list.map((im) => ({ id: im.id, alt_en: im.alt_en ?? "", alt_ar: im.alt_ar ?? "" })),
    );
    setState(res);
    setBusy(null);
    if (res?.ok) {
      setDirty(false);
      startTransition(() => router.refresh());
    }
  }

  async function remove(id: string) {
    setBusy("Removing…");
    const res = await deleteProductImage(productId, id);
    setState(res);
    setBusy(null);
    if (res?.ok) {
      setList((l) => l.filter((im) => im.id !== id));
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) upload(e.dataTransfer.files);
        }}
        className={`grid justify-items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${dragOver ? "border-plum bg-blush" : "border-line bg-page"}`}
      >
        <p className="font-display text-base font-semibold text-plum">Drop photos here</p>
        <p className="text-sm text-muted">They&apos;re resized and converted to WebP before upload, so the store stays fast.</p>
        <label className="btn btn-secondary btn-sm mt-1 cursor-pointer">
          Choose photos
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={Boolean(busy)}
            onChange={(e) => e.target.files && upload(e.target.files)}
          />
        </label>
        {busy && (
          <p className="text-sm font-medium text-plum" role="status">
            {busy}
          </p>
        )}
      </div>

      {list.length > 0 && (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((im, i) => (
              <li key={im.id} className="grid gap-2 rounded-2xl border border-line p-3">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-blush">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(im.path)!} alt={im.alt_en ?? ""} className="size-full object-cover" />
                  {i === 0 && <span className="chip absolute top-2 left-2 bg-plum text-blush">Main photo</span>}
                </div>
                <input
                  className="input py-1.5 text-sm"
                  value={im.alt_en ?? ""}
                  onChange={(e) => setAlt(i, "alt_en", e.target.value)}
                  placeholder="What's in the photo (English)"
                  aria-label="Photo description in English"
                />
                <input
                  className="input py-1.5 text-sm"
                  value={im.alt_ar ?? ""}
                  onChange={(e) => setAlt(i, "alt_ar", e.target.value)}
                  placeholder="وصف الصورة"
                  dir="rtl"
                  aria-label="Photo description in Arabic"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier">
                      ←
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => move(i, 1)}
                      disabled={i === list.length - 1}
                      aria-label="Move later"
                    >
                      →
                    </button>
                  </div>
                  <RemoveButton onConfirm={() => remove(im.id)} disabled={Boolean(busy)} />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" disabled={!dirty || Boolean(busy)} onClick={saveOrder}>
              Save photo order and text
            </button>
            {dirty && <span className="text-sm text-muted">You have unsaved photo changes.</span>}
          </div>
        </>
      )}
      <Notice state={state} />
    </div>
  );
}

function RemoveButton({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" className="btn btn-ghost btn-sm text-rose" onClick={() => setAsking(true)} disabled={disabled}>
        Remove
      </button>
    );
  return (
    <span className="flex items-center gap-1">
      <button type="button" className="btn btn-danger btn-sm" onClick={onConfirm} disabled={disabled}>
        Remove photo
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  );
}
