import type { MenuBase, MenuCoating } from "../data";

/**
 * Plate photos with the background taken out, in /public/menu/cut/<nut>-<sauce|plain>.webp.
 * `from` is the storage photo each one was cut from (the uuid in menu/<uuid>.webp): if the photo is
 * replaced in the admin, its cutout no longer matches and the plate falls back to the full photo.
 * Filled by scripts/cut-plates.py; empty means every plate shows its full photo.
 */
export const CUTOUTS: Record<string, { from?: string }> = {};

export function cutoutFor(base: MenuBase, coat: MenuCoating | null, photoSrc: string | null): string | null {
  const key = `${base.visual}-${coat ? coat.visual : "plain"}`;
  const c = CUTOUTS[key];
  if (!c) return null;
  if (c.from && !(photoSrc ?? "").includes(c.from)) return null;
  return `/menu/cut/${key}.webp`;
}
