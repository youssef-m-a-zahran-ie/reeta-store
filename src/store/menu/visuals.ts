import { mediaUrl } from "@/lib/supabase/env";
import type { MenuBase, MenuCoating } from "../data";
import { isNutKind, NUT_KINDS, type NutKind } from "./nut-art";

/** The cartoon each nut uses in the hero (custom_bases.visual). */
export const BASE_VISUALS: Record<NutKind, string> = { cashew: "Cashew", almond: "Almond", hazelnut: "Hazelnut", macadamia: "Macadamia" };
export { isNutKind as isBaseVisual, NUT_KINDS };

/** Sauces the stand-in photos know about (custom_coatings.visual). */
export const COATING_VISUALS = { white: "White chocolate", dark: "Dark chocolate", milk: "Milk chocolate", pistachio: "Pistachio" } as const;
export const isCoatingVisual = (v: string | null | undefined): v is keyof typeof COATING_VISUALS => !!v && v in COATING_VISUALS;

// Single-piece stand-ins shipped in /public/menu, used until the plate photos are uploaded in the admin.
const STAND_INS = new Set(["cashew", "almond", "hazelnut"]);

/**
 * The small transparent cutout kept next to an uploaded plate photo (menu/<id>.webp -> menu/<id>-cut.webp),
 * for the cart. Photos without one fall back to the full picture (see the cart drawer).
 */
export const cutoutOf = (src: string) => (/\/media\/menu\/[0-9a-f-]{36}\.webp$/.test(src) ? src.replace(/\.webp$/, "-cut.webp") : src);

export type PlateImage = { src: string; kind: "photo" | "piece" } | null;

/**
 * Which picture a plate shows: the uploaded photo for that sauce, else the plain plate photo,
 * else a stand-in piece. Null = draw the cartoon nut.
 */
export function plateImage(base: MenuBase, coat: MenuCoating | null): PlateImage {
  if (coat && base.photos[coat.id]) return { src: mediaUrl(base.photos[coat.id])!, kind: "photo" };
  if (!coat && base.image) return { src: mediaUrl(base.image)!, kind: "photo" };
  if (STAND_INS.has(base.visual)) {
    if (coat && isCoatingVisual(coat.visual)) return { src: `/menu/${base.visual}-${coat.visual}-drip.webp`, kind: "piece" };
    if (base.image) return { src: mediaUrl(base.image)!, kind: "photo" };
    return { src: `/menu/${base.visual}-bare.webp`, kind: "piece" };
  }
  if (base.image) return { src: mediaUrl(base.image)!, kind: "photo" };
  return null;
}
