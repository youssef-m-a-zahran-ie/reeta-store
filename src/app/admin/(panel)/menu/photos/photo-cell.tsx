"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET, mediaUrl } from "@/lib/supabase/env";
import { toWebp } from "@/components/admin/image-manager";
import { Swatch } from "@/components/admin/ui";
import type { ActionState } from "@/lib/admin/state";
import { removePlatePhoto, setPlatePhoto } from "../actions";

/** One plate photo: the nut plain, or the nut with one sauce. Drop or pick a file to replace it. */
export function PhotoCell({
  baseId,
  coatingId,
  label,
  color,
  path,
}: {
  baseId: string;
  coatingId: string | null;
  label: string;
  color?: string | null;
  path: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>(null);
  const [over, setOver] = useState(false);
  const [, start] = useTransition();

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setState({ ok: false, message: "Pick an image (JPG, PNG or WebP)." });
    setState(null);
    try {
      setBusy("Preparing…");
      const blob = await toWebp(file);
      const p = `menu/${crypto.randomUUID()}.webp`;
      setBusy("Uploading…");
      const { error } = await createClient().storage.from(MEDIA_BUCKET).upload(p, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw error;
      setBusy("Saving…");
      setState(await setPlatePhoto(baseId, coatingId, p));
      start(() => router.refresh());
    } catch {
      setState({ ok: false, message: "Upload failed. Check your connection and try again." });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy("Removing…");
    setState(await removePlatePhoto(baseId, coatingId));
    setBusy(null);
    start(() => router.refresh());
  }

  return (
    <div className="grid content-start gap-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {color !== undefined && <Swatch color={color} size={14} />}
        {label}
      </div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files[0]);
        }}
        disabled={busy !== null}
        className={`relative grid aspect-square place-items-center overflow-hidden rounded-2xl border-2 border-dashed text-sm text-muted transition ${
          over ? "border-plum bg-blush/40" : path ? "border-transparent bg-[#fbf4e9]" : "border-line bg-white hover:border-plum/40"
        }`}
        aria-label={path ? `Replace the ${label} photo` : `Add the ${label} photo`}
      >
        {path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(path)!} alt="" className="size-full object-contain" />
        ) : (
          <span className="px-2 text-center">{busy ?? "Add photo"}</span>
        )}
        {path && busy && <span className="absolute inset-0 grid place-items-center bg-white/75 font-medium text-plum">{busy}</span>}
      </button>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void upload(e.target.files?.[0])} />
      {path && !busy && (
        <div className="flex gap-3 text-xs">
          <button type="button" className="font-semibold text-plum underline-offset-4 hover:underline" onClick={() => input.current?.click()}>
            Replace
          </button>
          <button type="button" className="text-muted underline-offset-4 hover:underline" onClick={remove}>
            Remove
          </button>
        </div>
      )}
      {state && !state.ok && <p className="text-xs text-[#a33a52]" role="alert">{state.message}</p>}
    </div>
  );
}
