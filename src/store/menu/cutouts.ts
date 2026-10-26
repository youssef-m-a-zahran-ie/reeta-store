import type { MenuBase, MenuCoating } from "../data";

/**
 * Plate photos with the background taken out, in /public/menu/cut/<nut>-<sauce|plain>.webp.
 * `from` is the storage photo each one was cut from (the uuid in menu/<uuid>.webp): if the photo is
 * replaced in the admin, its cutout no longer matches and the plate falls back to the full photo.
 * Filled by scripts/cut-plates.py; empty means every plate shows its full photo.
 */
export const CUTOUTS: Record<string, { from?: string }> = {
  "almond-dark": { from: "453a95ce-d631-4173-bf8c-151c3ac18eb3" },
  "almond-milk": { from: "7631b93b-ccb9-4a24-8ca4-0ead7c23f823" },
  "almond-pistachio": { from: "9bcb5bb3-0d71-4e2c-bb32-d7a3dca0d763" },
  "almond-plain": { from: "c8d6d946-b38d-4a7b-a6f3-768832dd4635" },
  "almond-white": { from: "2718e444-b346-4e0d-a01f-777ba04a012a" },
  "cashew-dark": { from: "ce0da791-8e2e-4337-a1dc-886a8d18bcff" },
  "cashew-milk": { from: "66fd615a-b8a9-4926-a6bf-0dd14331f343" },
  "cashew-pistachio": { from: "de5f73ec-0296-42bd-a0dd-f2b3a659d2e5" },
  "cashew-plain": { from: "d8ea5b94-6f6d-466b-ad9f-50baba321a30" },
  "cashew-white": { from: "2df1404e-6670-4fdb-b535-ce9ab48d5c63" },
  "hazelnut-dark": { from: "32f9e35c-8589-4fae-9017-7d3429d5edb1" },
  "hazelnut-milk": { from: "156c1cfa-daad-46b3-9304-bdd755091afc" },
  "hazelnut-pistachio": { from: "acd76662-1562-42c8-bc89-16ec823760b8" },
  "hazelnut-plain": { from: "ce1fa86e-d582-43dc-8766-a97e7dc9dfd7" },
  "hazelnut-white": { from: "4703e9a6-dadf-4e14-ad91-e9eaba979c54" },
  "macadamia-dark": { from: "094d3db5-0b0e-472c-8f9f-aec901eeda30" },
  "macadamia-milk": { from: "0a2703b2-72b7-4a84-85df-3018a208e6af" },
  "macadamia-pistachio": { from: "d1dab44c-a08b-40eb-b014-ec3ff7921d84" },
  "macadamia-plain": { from: "e6ee57ed-7fc3-4a60-b0bb-428e30f27a26" },
  "macadamia-white": { from: "d88dd194-7109-4e62-bdf7-d25ff7761dda" },
};

export function cutoutFor(
  base: MenuBase,
  coat: MenuCoating | null,
  photoSrc: string | null,
): string | null {
  const key = `${base.visual}-${coat ? coat.visual : "plain"}`;
  const c = CUTOUTS[key];
  if (!c) return null;
  if (c.from && !(photoSrc ?? "").includes(c.from)) return null;
  return `/menu/cut/${key}.webp`;
}
