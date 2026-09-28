import { getAdmin } from "@/lib/admin/guard";
import { loadReport } from "@/lib/admin/report";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function cell(v: string | number | boolean | null | undefined) {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csv(name: string, head: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const body = "﻿" + [head.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Cairo midnight of a day, as an ISO instant. */
const cairoStart = (day: string) => new Date(`${day}T00:00:00+03:00`).toISOString();
const nextDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Not allowed", { status: 403 });
  const u = new URL(req.url);
  const from = u.searchParams.get("from") ?? "";
  const to = u.searchParams.get("to") ?? "";
  if (!ISO.test(from) || !ISO.test(to) || from > to) return new Response("Bad dates", { status: 400 });
  const kind = u.searchParams.get("kind");

  if (kind === "products") {
    const r = await loadReport(admin.supabase, from, to);
    return csv(
      `reeta-products-${from}-to-${to}.csv`,
      ["Product", "Size", "Box", "Quantity", "Grams", "Sales (EGP)", "Profit (EGP)"],
      (r?.products ?? []).map((p) => [p.name, p.label, p.bundle ? "yes" : "no", p.qty, p.grams, p.sales, p.profit]),
    );
  }

  // Egypt has no daylight saving, so +03:00 is right all year.
  const { data } = await admin.supabase
    .from("orders")
    .select(
      "number, created_at, status, payment_method, payment_status, customer_name, phone, address_line, distance_km, subtotal, discount_code, discount_total, shipping_fee, total, source, utm_source, utm_medium, utm_campaign, order_items(qty, name_en, option_label, unit_cost)",
    )
    .gte("created_at", cairoStart(from))
    .lt("created_at", cairoStart(nextDay(to)))
    .order("created_at")
    .limit(10000);

  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short", hour12: false });
  return csv(
    `reeta-orders-${from}-to-${to}.csv`,
    [
      "Order", "Date (Cairo)", "Status", "Payment", "Paid", "Customer", "Phone", "Address", "Distance (km)", "Items",
      "Subtotal", "Discount code", "Discount", "Delivery", "Total", "Product cost", "Source", "UTM source", "UTM medium", "UTM campaign",
    ],
    (data ?? []).map((o) => [
      o.number,
      fmt.format(new Date(o.created_at)),
      o.status,
      o.payment_method === "cod" ? "Cash" : "InstaPay",
      o.payment_status === "paid" ? "yes" : "no",
      o.customer_name,
      o.phone,
      o.address_line,
      o.distance_km,
      (o.order_items ?? []).map((i) => `${i.qty}× ${i.name_en}${i.option_label ? ` ${i.option_label}` : ""}`).join("; "),
      o.subtotal,
      o.discount_code,
      o.discount_total,
      o.shipping_fee,
      o.total,
      (o.order_items ?? []).reduce((s, i) => s + (i.unit_cost ?? 0) * i.qty, 0),
      o.source,
      o.utm_source,
      o.utm_medium,
      o.utm_campaign,
    ]),
  );
}
