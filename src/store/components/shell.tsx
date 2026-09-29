import Link from "next/link";
import type { ReactNode } from "react";
import { CartProvider } from "../cart";
import { getPublishedPages, getSettings } from "../data";
import { dict, href, loc, type Lang } from "../i18n";
import { CartDrawer } from "./cart-drawer";
import { Header } from "./header";
import { Toast } from "./toast";
import { UtmCapture } from "./utm-capture";
import { Pixels } from "./pixels";
import { PixelPageViews } from "./track";
import { WhatsAppFloat, waLink } from "./whatsapp";

export async function StoreShell({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = dict[lang];
  const [settings, pages] = await Promise.all([getSettings(), getPublishedPages()]);
  const announcement = settings.announcement_visible ? loc(settings, "announcement", lang) : "";
  const pausedMessage = settings.orders_paused ? loc(settings, "paused_message", lang) || t.paused : null;

  const socials = [
    { url: settings.instagram_url, label: t.contact.instagram },
    { url: settings.tiktok_url, label: t.contact.tiktok },
    { url: settings.facebook_url, label: t.contact.facebook },
    { url: settings.whatsapp_number ? waLink(settings.whatsapp_number) : null, label: t.contact.whatsapp },
  ].filter((s): s is { url: string; label: string } => Boolean(s.url));

  return (
    <CartProvider freeOver={settings.free_shipping_over} freeMessage={t.cart.freeToast}>
      <a
        href="#content"
        className="sr-only z-[80] rounded-full bg-plum px-4 py-2 text-blush focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t.skip}
      </a>
      {(pausedMessage || announcement) && (
        <div className={`px-4 py-2 text-center text-sm font-medium ${pausedMessage ? "bg-rose text-white" : "bg-plum text-blush"}`}>
          {pausedMessage ?? announcement}
        </div>
      )}
      <Pixels meta={settings.meta_pixel_id} tiktok={settings.tiktok_pixel_id} ga4={settings.ga4_id} />
      <PixelPageViews />
      <Header lang={lang} freeOver={settings.free_shipping_over} />
      <div id="content">{children}</div>

      <footer className="dot-grid-dark mt-20 bg-plum text-blush">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-6">
          <div className="grid content-start gap-3">
            <Link href={href(lang, "/")} className="flex items-center gap-2.5" aria-label="Reeta">
              <span className="mark mark-full size-11" aria-hidden="true" />
              <span className="font-display text-2xl font-semibold tracking-[0.07em]" dir="ltr">
                REETA
              </span>
            </Link>
            <p className="max-w-xs text-blush/80">{t.brandLine}</p>
          </div>
          <FooterCol title={t.footer.shop}>
            <FooterLink to={href(lang, "/shop")}>{t.nav.shop}</FooterLink>
            <FooterLink to={href(lang, "/bundles")}>{t.nav.bundles}</FooterLink>
            <FooterLink to={href(lang, "/about")}>{t.nav.about}</FooterLink>
          </FooterCol>
          <FooterCol title={t.footer.help}>
            <FooterLink to={href(lang, "/contact")}>{t.nav.contact}</FooterLink>
            {pages
              .filter((p) => p.slug !== "about")
              .map((p) => (
                <FooterLink key={p.slug} to={href(lang, `/policies/${p.slug}`)}>
                  {loc(p, "title", lang)}
                </FooterLink>
              ))}
          </FooterCol>
          {socials.length > 0 && (
            <FooterCol title={t.footer.follow}>
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-block py-1 text-blush/85 underline-offset-4 hover:text-blush hover:underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </FooterCol>
          )}
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-[1200px] px-4 py-5 text-sm text-blush/60 md:px-6">
            © {new Date().getFullYear()} Reeta. {t.footer.rights}
          </p>
        </div>
      </footer>

      {settings.whatsapp_button && settings.whatsapp_number && <WhatsAppFloat lang={lang} number={settings.whatsapp_number} />}
      <CartDrawer lang={lang} freeOver={settings.free_shipping_over} paused={settings.orders_paused} pausedMessage={pausedMessage} />
      <Toast />
      <UtmCapture />
    </CartProvider>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-3">
      <p className="font-display text-[13px] font-medium tracking-[0.1em] text-blush/55 uppercase">{title}</p>
      <ul className="grid">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link href={to} className="inline-block py-1 text-blush/85 underline-offset-4 hover:text-blush hover:underline">
        {children}
      </Link>
    </li>
  );
}
