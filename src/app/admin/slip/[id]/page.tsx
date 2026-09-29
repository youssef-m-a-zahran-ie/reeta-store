import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { Mark } from "@/components/brand/mark";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Packing slip" };

const T = {
  en: {
    order: "Order",
    to: "Deliver to",
    items: "In this bag",
    subtotal: "Subtotal",
    discount: "Discount",
    delivery: "Delivery",
    free: "Free",
    total: "Total",
    collect: "Collect on delivery",
    paid: "Paid by InstaPay",
    toPay: "InstaPay: not received yet",
    thanks: "Thank you for choosing Reeta. Enjoy every bite.",
    follow: "Share your box with us",
    egp: "EGP",
    building: "Building",
    floor: "Floor",
    apartment: "Apt",
  },
  ar: {
    order: "طلب",
    to: "التوصيل إلى",
    items: "في الشنطة",
    subtotal: "المجموع",
    discount: "الخصم",
    delivery: "التوصيل",
    free: "مجاني",
    total: "الإجمالي",
    collect: "المطلوب تحصيله",
    paid: "مدفوع بإنستاباي",
    toPay: "إنستاباي: لسه ما وصلش",
    thanks: "شكرًا إنك اخترت ريتا. بالهنا والشفا.",
    follow: "صوّر البوكس وشاركه معانا",
    egp: "ج.م",
    building: "عمارة",
    floor: "دور",
    apartment: "شقة",
  },
} as const;

export default async function SlipPage({ params }: PageProps<"/admin/slip/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [{ data: o }, { data: items }, { data: s }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("name_en, name_ar, option_label, qty, line_total").eq("order_id", id).order("id"),
    supabase.from("settings").select("instagram_url, whatsapp_number").eq("id", 1).single(),
  ]);
  if (!o) notFound();

  const lang = o.lang === "ar" ? "ar" : "en";
  const t = T[lang];
  const n = (v: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v)} ${t.egp}`;
  const date = new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Africa/Cairo" }).format(new Date(o.created_at));
  const handle = s?.instagram_url?.match(/instagram\.com\/([^/?#]+)/)?.[1];
  const collect = o.payment_method === "cod" && o.payment_status !== "paid";

  return (
    <div className="min-h-screen bg-page py-8 print:bg-white print:py-0" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <style>{`@page { size: A5; margin: 10mm; } @media print { .no-print { display: none !important; } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[148mm] justify-end gap-2 px-4">
        <PrintButton />
      </div>

      <article lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="mx-auto grid max-w-[148mm] gap-5 bg-white p-7 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-center justify-between gap-4 border-b-2 border-plum pb-4">
          <span className="flex items-center gap-2.5 text-plum">
            <Mark className="size-11" />
            <span className="font-wordmark text-2xl font-semibold tracking-[0.07em]" dir="ltr">
              REETA
            </span>
          </span>
          <span className="grid text-end">
            <span className="text-2xl font-medium text-plum">
              {t.order} <span dir="ltr">#{o.number}</span>
            </span>
            <span className="text-sm text-muted">{date}</span>
          </span>
        </header>

        <section className="grid gap-1">
          <h2 className="font-sans text-sm font-medium tracking-[0.1em] text-toffee uppercase">{t.to}</h2>
          <p className="text-lg font-semibold text-plum">
            <bdi>{o.customer_name}</bdi>
          </p>
          <p className="num">
            <bdi dir="ltr">{o.phone}</bdi>
          </p>
          <p>
            <bdi>{o.address_line}</bdi>
          </p>
          {(o.building || o.floor || o.apartment) && (
            <p>
              {[o.building && `${t.building} ${o.building}`, o.floor && `${t.floor} ${o.floor}`, o.apartment && `${t.apartment} ${o.apartment}`].filter(Boolean).join(" · ")}
            </p>
          )}
          {o.landmark && (
            <p className="text-sm text-muted">
              <bdi>{o.landmark}</bdi>
            </p>
          )}
          {o.customer_note && (
            <p className="mt-1 rounded-lg border border-honey px-3 py-1.5 text-sm">
              <bdi>{o.customer_note}</bdi>
            </p>
          )}
        </section>

        <section className="grid gap-2">
          <h2 className="font-sans text-sm font-medium tracking-[0.1em] text-toffee uppercase">{t.items}</h2>
          <table className="w-full border-collapse text-[15px]">
            <tbody>
              {(items ?? []).map((i, k) => (
                <tr key={k} className="border-b border-line">
                  <td className="w-10 py-2 align-top">
                    <span className="inline-grid size-7 place-items-center rounded-full border-2 border-plum text-sm font-bold text-plum">{i.qty}</span>
                  </td>
                  <td className="py-2">
                    {lang === "ar" ? i.name_ar : i.name_en}
                    {i.option_label && (
                      <span className="text-muted">
                        {" · "}
                        <bdi dir="ltr">{i.option_label}</bdi>
                      </span>
                    )}
                  </td>
                  <td className="num py-2 text-end whitespace-nowrap">{n(i.line_total)}</td>
                  <td className="w-8 py-2 text-end">
                    <span className="inline-block size-4 rounded border-[1.5px] border-cocoa/40" aria-hidden="true" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ms-auto grid w-64 gap-1 text-[15px]">
            <Row k={t.subtotal} v={n(o.subtotal)} />
            {o.discount_total > 0 && <Row k={`${t.discount}${o.discount_code ? ` (${o.discount_code})` : ""}`} v={`−${n(o.discount_total)}`} />}
            <Row k={t.delivery} v={o.shipping_fee > 0 ? n(o.shipping_fee) : t.free} />
            <div className="flex justify-between gap-4 border-t border-plum pt-1.5 text-lg font-medium text-plum">
              <dt>{t.total}</dt>
              <dd className="num">{n(o.total)}</dd>
            </div>
          </dl>
        </section>

        <p
          className={`rounded-2xl px-4 py-3 text-center text-lg font-medium ${
            collect ? "bg-plum text-blush" : o.payment_status === "paid" ? "border-2 border-sage text-[#56633a]" : "border-2 border-honey text-cocoa"
          }`}
        >
          {collect ? `${t.collect}: ${n(o.total)}` : o.payment_status === "paid" ? t.paid : t.toPay}
        </p>

        <footer className="grid justify-items-center gap-1 border-t border-dashed border-line pt-4 text-center">
          <p className="text-[15px] text-plum">{t.thanks}</p>
          {handle && (
            <p className="text-sm text-muted">
              {t.follow} · <span dir="ltr">@{handle}</span>
            </p>
          )}
        </footer>
      </article>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}
