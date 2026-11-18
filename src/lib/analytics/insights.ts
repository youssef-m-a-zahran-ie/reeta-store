import { fmtValue, pctChange } from "./format";

export type Part = { t: string; h?: boolean };
export type Insight = { id: string; title: string; tone: "good" | "bad" | "info"; date: string; parts: Part[]; spark?: number[]; sparkFrom?: string; sparkTo?: string };

type In = {
  today: string;
  sales: { cur: number; prev: number | null; spark: number[] };
  orders: { cur: number; prev: number | null; spark: number[] };
  from: string;
  to: string;
  topChannel: { label: string; value: number; share: number } | null;
  topProduct: { label: string; value: number } | null;
  sessions: { total: number; cart: number; checkout: number; completed: number };
};

const pctText = (d: number) => `${Math.abs(d).toLocaleString("en-US")}%`;

/** A few plain-language readings of the numbers on the page. Rule based; every sentence is computed from the data. */
export function buildInsights(i: In): Insight[] {
  const out: Insight[] = [];
  const dir = (d: number) => (d > 0 ? "up" : "down");

  const s = pctChange(i.sales.cur, i.sales.prev);
  if (s !== null && s !== 0) {
    out.push({
      id: "sales", tone: s > 0 ? "good" : "bad", date: i.today, title: `Total sales are ${dir(s)} ${pctText(s)} on the previous period`,
      parts: [{ t: "This is a " }, { t: pctText(s), h: true }, { t: ` ${s > 0 ? "increase" : "decrease"} from ` }, { t: fmtValue(i.sales.prev, "money"), h: true }, { t: " to " }, { t: fmtValue(i.sales.cur, "money"), h: true }, { t: "." }],
      spark: i.sales.spark, sparkFrom: i.from, sparkTo: i.to,
    });
  } else if (i.sales.cur > 0 && i.sales.prev === 0) {
    out.push({
      id: "sales", tone: "good", date: i.today, title: "Sales started in this period",
      parts: [{ t: "There were no sales in the comparison period. This period has " }, { t: fmtValue(i.sales.cur, "money"), h: true }, { t: "." }],
      spark: i.sales.spark, sparkFrom: i.from, sparkTo: i.to,
    });
  }

  const o = pctChange(i.orders.cur, i.orders.prev);
  if (o !== null && o !== 0) {
    out.push({
      id: "orders", tone: o > 0 ? "good" : "bad", date: i.today, title: `Orders are ${dir(o)} ${pctText(o)}`,
      parts: [{ t: "From " }, { t: String(i.orders.prev), h: true }, { t: " to " }, { t: String(i.orders.cur), h: true }, { t: " orders." }],
      spark: i.orders.spark, sparkFrom: i.from, sparkTo: i.to,
    });
  }

  if (i.topChannel && i.topChannel.value > 0) {
    out.push({
      id: "channel", tone: "info", date: i.today, title: `${i.topChannel.label} brought the most sales`,
      parts: [{ t: i.topChannel.label, h: true }, { t: " accounts for " }, { t: `${Math.round(i.topChannel.share)}%`, h: true }, { t: " of total sales (" }, { t: fmtValue(i.topChannel.value, "money"), h: true }, { t: ")." }],
    });
  }

  if (i.topProduct && i.topProduct.value > 0) {
    out.push({
      id: "product", tone: "info", date: i.today, title: `${i.topProduct.label} leads on net sales`,
      parts: [{ t: i.topProduct.label, h: true }, { t: " made " }, { t: fmtValue(i.topProduct.value, "money"), h: true }, { t: " in net sales this period." }],
    });
  }

  const se = i.sessions;
  if (se.total > 0 && se.cart > se.completed) {
    const lost = se.cart - se.completed;
    out.push({
      id: "cart", tone: "info", date: i.today, title: `${lost} visit${lost === 1 ? "" : "s"} added to the cart but did not order`,
      parts: [{ t: String(se.cart), h: true }, { t: " visits added something to the cart, " }, { t: String(se.checkout), h: true }, { t: " reached checkout and " }, { t: String(se.completed), h: true }, { t: " completed it." }],
    });
  }
  return out;
}
