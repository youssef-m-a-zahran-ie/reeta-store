const egpFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function egp(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `${egpFmt.format(n)} EGP`;
}

/** 2500 → "2.5 kg", 850 → "850 g" */
export function grams(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1000) return `${egpFmt.format(n / 1000)} kg`;
  return `${egpFmt.format(n)} g`;
}

export function stockLabel(unit: "grams" | "pieces", n: number) {
  return unit === "grams" ? grams(n) : `${egpFmt.format(n)} pcs`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function margin(price: number | null | undefined, cost: number | null | undefined) {
  if (!price || cost === null || cost === undefined) return null;
  return Math.round(((price - cost) / price) * 100);
}

export const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Cairo",
});

export const dateOnly = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Cairo",
});
