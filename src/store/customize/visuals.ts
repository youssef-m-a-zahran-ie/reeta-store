/**
 * Photo sets for the Atelier. Each nut and each coating that has photos is listed here;
 * the admin links a base or coating to one of these keys. A new nut or coating needs its photos
 * in /public/atelier and one line here.
 *
 * Files per nut:            {nut}-bare.webp
 * Files per nut × coating:  {nut}-{coating}-drip.webp (the hero piece), {nut}-{coating}-piece.webp (heap pieces)
 */
export const BASE_VISUALS = {
  hazelnut: { label: "Hazelnut", piece: 0.8 },
  almond: { label: "Almond", piece: 1.0 },
  cashew: { label: "Cashew", piece: 0.92 },
  peanut: { label: "Peanut", piece: 0.95 },
} as const;

/** c1–c3: the pour's shadow, body and highlight colors. */
export const COATING_VISUALS = {
  dark: { label: "Dark chocolate", c1: "#3d1a12", c2: "#5c281d", c3: "#86483a" },
  milk: { label: "Milk chocolate", c1: "#6f3016", c2: "#934828", c3: "#c07650" },
  white: { label: "White chocolate", c1: "#d9c49c", c2: "#efe1c2", c3: "#fff8ea" },
  pistachio: { label: "Pistachio", c1: "#6f6a1c", c2: "#9a9440", c3: "#c3bd68" },
} as const;

export type BaseVisual = keyof typeof BASE_VISUALS;
export type CoatingVisual = keyof typeof COATING_VISUALS;

export const isBaseVisual = (v: string | null | undefined): v is BaseVisual => !!v && v in BASE_VISUALS;
export const isCoatingVisual = (v: string | null | undefined): v is CoatingVisual => !!v && v in COATING_VISUALS;

const DIR = "/atelier";
export const atelierImg = {
  bare: (b: string) => `${DIR}/${b}-bare.webp`,
  drip: (b: string, c: string) => `${DIR}/${b}-${c}-drip.webp`,
  piece: (b: string, c: string) => `${DIR}/${b}-${c}-piece.webp`,
  bowlBack: `${DIR}/bowl-back.webp`,
  bowlFront: `${DIR}/bowl-front.webp`,
};
