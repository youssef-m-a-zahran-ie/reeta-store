import Link from "next/link";
import { getOrder, getSettings } from "../data";
import { dict, href, loc, money, type Lang } from "../i18n";
import { CheckoutForm } from "../components/checkout-form";
import { CopyButton } from "../components/copy-button";
import { waLink } from "../components/whatsapp";

export async function CheckoutView({ lang }: { lang: Lang }) {
  const t = dict[lang];
  const settings = await getSettings();
  return (
    <main className="px-4 pt-8 pb-10 md:px-6 md:pt-12">
      <div className="mx-auto grid max-w-[1200px] gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[40px] leading-tight font-semibold md:text-[56px]">{t.checkout.title}</h1>
          <Link href={href(lang, "/shop")} className="text-sm font-semibold text-plum underline underline-offset-4">
            {t.checkout.back}
          </Link>
        </div>
        <CheckoutForm lang={lang} paused={settings.orders_paused} />
      </div>
    </main>
  );
}

export async function OrderView({ lang, id }: { lang: Lang; id: string }) {
  const t = dict[lang];
  const o = await getOrder(id);
  if (!o) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-4 text-center">
        <div className="grid gap-4">
          <p className="text-xl text-plum">{t.order.notFound}</p>
          <Link href={href(lang, "/shop")} className="justify-self-center rounded-full bg-plum px-6 py-3 font-display font-semibold text-blush">
            {t.order.keepShopping}
          </Link>
        </div>
      </main>
    );
  }
  const address = [o.address_line, o.building, o.floor, o.apartment, o.landmark].filter(Boolean).join(lang === "ar" ? "، " : ", ");

  return (
    <main className="px-4 pt-10 pb-10 md:px-6 md:pt-16">
      <div className="mx-auto grid max-w-2xl gap-6">
        <div className="dot-grid grid justify-items-center gap-4 rounded-[32px] bg-blush px-6 py-10 text-center">
          {/* The seal closes the pouch. */}
          <div className="order-seal relative size-28" aria-hidden="true">
            <span className="absolute inset-0 grid place-items-center rounded-full bg-plum text-blush shadow-[0_14px_28px_-12px_rgb(58_36_32/.6)]">
              <span className="mark mark-full size-20" />
            </span>
          </div>
          <span className="eyebrow">{t.order.number(o.number)}</span>
          <h1 className="text-[36px] leading-tight font-semibold md:text-[48px]">{t.order.thanks}</h1>
          <p className="text-lg text-cocoa/85">{t.order.confirmCall}</p>
        </div>

        {o.payment_method === "instapay" && o.instapay_handle && o.payment_status !== "paid" && (
          <section className="grid gap-3 rounded-[28px] bg-plum p-6 text-blush">
            <h2 className="text-2xl font-semibold text-blush">{t.order.instapayTitle}</h2>
            <p className="text-blush/85">{t.order.instapayText(money(o.total, lang))}</p>
            {o.instapay_link && (
              <div className="grid gap-1.5">
                <a
                  href={o.instapay_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-blush px-6 py-3.5 text-center font-display text-lg font-semibold text-plum transition-colors hover:bg-cream"
                >
                  {t.order.payNow}
                </a>
                <p className="text-center text-sm text-blush/75">{t.order.payNowHint(money(o.total, lang))}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-blush px-4 py-3 text-plum">
              <span className="flex-1 font-display text-2xl font-semibold tracking-wide select-all" dir="ltr">
                {o.instapay_handle}
              </span>
              <CopyButton text={o.instapay_handle} label={t.order.copy} done={t.order.copied} />
            </div>
            {o.instapay_name && <p className="text-sm text-blush/75">{o.instapay_name}</p>}
          </section>
        )}

        <section className="grid gap-3 rounded-[28px] bg-cream p-6">
          <h2 className="text-xl font-semibold">{t.order.items}</h2>
          <ul className="grid gap-2">
            {o.items.map((i, k) => (
              <li key={k} className="flex justify-between gap-3">
                <span>
                  {i.qty} × {loc(i, "name", lang)}
                  {i.label && (
                    <span className="text-cocoa/65">
                      {" · "}
                      <bdi>{i.label}</bdi>
                    </span>
                  )}
                </span>
                <span className="tabular-nums">{money(i.line_total, lang)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid gap-1.5 border-t border-plum/15 pt-3 text-[15px]">
            <div className="flex justify-between">
              <dt>{t.checkout.subtotal}</dt>
              <dd className="tabular-nums">{money(o.subtotal, lang)}</dd>
            </div>
            {o.discount_total > 0 && (
              <div className="flex justify-between">
                <dt>
                  {t.checkout.discount} {o.discount_code && `(${o.discount_code})`}
                </dt>
                <dd className="tabular-nums">−{money(o.discount_total, lang)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>{t.checkout.delivery}</dt>
              <dd className="tabular-nums">{o.shipping_fee > 0 ? money(o.shipping_fee, lang) : t.checkout.deliveryFree}</dd>
            </div>
            <div className="flex justify-between border-t border-plum/15 pt-2 font-display text-xl font-semibold text-plum">
              <dt>{t.checkout.total}</dt>
              <dd className="tabular-nums">{money(o.total, lang)}</dd>
            </div>
          </dl>
          <p className="text-sm text-cocoa/75">
            {t.order.deliverTo}: {address}
          </p>
        </section>

        <div className="flex flex-wrap justify-center gap-3">
          {o.whatsapp_number && (
            <a
              href={waLink(o.whatsapp_number, t.order.waText(o.number))}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-sage px-6 py-3 font-display font-semibold text-white hover:brightness-95"
            >
              {t.order.whatsapp}
            </a>
          )}
          <Link href={href(lang, "/shop")} className="rounded-full border-2 border-plum px-6 py-[10px] font-display font-semibold text-plum hover:bg-blush">
            {t.order.keepShopping}
          </Link>
        </div>
      </div>
    </main>
  );
}
