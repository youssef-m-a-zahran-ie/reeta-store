import Link from "next/link";
import { notFound } from "next/navigation";
import { getBundles, getCatalog, getFaqs, getPage, getProduct, getSettings } from "../data";
import { dict, href, loc, type Lang } from "../i18n";
import { ShopBrowser } from "../components/shop-browser";
import { ProductBuy } from "../components/product-buy";
import { ProductCard } from "../components/product-card";
import { BundleCard } from "../components/bundle-card";
import { waLink } from "../components/whatsapp";
import { SectionHead } from "./home";

function PageTop({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="dot-grid bg-blush px-4 pt-14 pb-12 md:px-6 md:pt-20 md:pb-16">
      <div className="mx-auto grid max-w-[1200px] gap-3">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="text-[40px] leading-[1.05] font-semibold md:text-[64px]">{title}</h1>
        {text && <p className="max-w-2xl text-lg text-cocoa/85">{text}</p>}
      </div>
    </div>
  );
}

/* ---------- Shop ---------- */
export async function ShopView({
  lang,
  category,
  searchParams,
}: {
  lang: Lang;
  category: string | null;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = dict[lang];
  const catalog = await getCatalog();
  const cat = category ? catalog.categories.find((c) => c.slug === category) : null;
  if (category && !cat) notFound();
  const flavor = typeof searchParams.flavor === "string" ? searchParams.flavor : undefined;
  const base = typeof searchParams.base === "string" ? searchParams.base : undefined;

  return (
    <main>
      <PageTop eyebrow={t.shop.eyebrow} title={cat ? loc(cat, "name", lang) : t.shop.title} text={cat ? loc(cat, "description", lang) : undefined} />
      <div className="mx-auto max-w-[1200px] px-4 pt-10 md:px-6">
        <ShopBrowser catalog={catalog} lang={lang} category={cat?.slug ?? null} initial={{ flavor, base }} />
      </div>
    </main>
  );
}

/* ---------- Product ---------- */
export async function ProductView({ lang, slug }: { lang: Lang; slug: string }) {
  const t = dict[lang];
  const [product, catalog] = await Promise.all([getProduct(slug), getCatalog()]);
  if (!product || !product.variants.length) notFound();

  const related = catalog.products
    .filter((p) => p.id !== product.id)
    .map((p) => ({ p, score: (p.base_slug === product.base_slug ? 2 : 0) + (p.coating_slug === product.coating_slug ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.p);

  const details = [
    { key: "description", title: t.product.description },
    { key: "ingredients", title: t.product.ingredients },
    { key: "allergens", title: t.product.allergens },
    { key: "storage", title: t.product.storage },
  ].filter((d) => loc(product, d.key, lang));

  const color = product.color ?? "#f5ead8";
  const catName = (id: string) => loc(catalog.categories.find((c) => c.id === id), "name", lang);

  return (
    <main>
      {/* Each product page takes on the color of its coating. */}
      <div style={{ background: `color-mix(in srgb, ${color} 16%, var(--page))` }} className="px-4 pt-6 pb-14 md:px-6 md:pt-10 md:pb-20">
        <div className="mx-auto grid max-w-[1200px] gap-6">
          <nav aria-label="Breadcrumb" className="text-sm text-cocoa/70">
            <Link href={href(lang, "/shop")} className="underline-offset-4 hover:underline">
              {t.nav.shop}
            </Link>
            <span className="mx-2" aria-hidden="true">
              /
            </span>
            <Link href={href(lang, `/shop/${product.category_slug}`)} className="underline-offset-4 hover:underline">
              {loc(product, "category_name", lang)}
            </Link>
          </nav>
          <ProductBuy product={product} lang={lang} />
        </div>
      </div>

      {details.length > 0 && (
        <section className="px-4 py-12 md:px-6 md:py-16">
          <div className="mx-auto grid max-w-3xl gap-3">
            {details.map((d, i) => (
              <details key={d.key} open={i === 0} className="group rounded-[24px] bg-cream/70 px-5 py-4 open:bg-cream">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl font-semibold text-plum [&::-webkit-details-marker]:hidden">
                  {d.title}
                  <span className="grid size-8 place-items-center rounded-full bg-white/70 text-lg transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed whitespace-pre-line text-cocoa/85">{loc(product, d.key, lang)}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="px-4 py-12 md:px-6" aria-labelledby="h-related">
          <div className="mx-auto max-w-[1200px]">
            <SectionHead id="h-related" title={t.product.related} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} lang={lang} categoryName={catName(p.category_id)} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

/* ---------- Bundles ---------- */
export async function BundlesView({ lang }: { lang: Lang }) {
  const t = dict[lang];
  const bundles = await getBundles();
  return (
    <main>
      <PageTop eyebrow={t.bundles.eyebrow} title={t.bundles.title} text={t.bundles.text} />
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 pt-10 md:px-6">
        {bundles.length ? (
          bundles.map((b) => <BundleCard key={b.id} bundle={b} lang={lang} headingLevel="h2" />)
        ) : (
          <p className="rounded-[28px] border-2 border-dashed border-plum/20 px-6 py-12 text-center text-lg text-plum">{t.bundles.none}</p>
        )}
      </div>
    </main>
  );
}

export async function BundleView({ lang, slug }: { lang: Lang; slug: string }) {
  const t = dict[lang];
  const bundles = await getBundles();
  const b = bundles.find((x) => x.slug === slug);
  if (!b) notFound();
  return (
    <main>
      <PageTop eyebrow={t.bundles.eyebrow} title={loc(b, "name", lang)} />
      <div className="mx-auto max-w-[1200px] px-4 pt-10 md:px-6">
        <BundleCard bundle={b} lang={lang} headingLevel="h2" />
      </div>
    </main>
  );
}

/* ---------- About ---------- */
export async function AboutView({ lang }: { lang: Lang }) {
  const t = dict[lang];
  const page = await getPage("about");
  const body = page?.is_published ? loc(page, "body", lang) : "";
  return (
    <main>
      <PageTop eyebrow={t.about.eyebrow} title={page ? loc(page, "title", lang) : t.about.title} />
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 pt-12 md:grid-cols-[1.2fr_1fr] md:px-6">
        <div className="grid gap-5 text-lg leading-relaxed text-cocoa/90">
          {body.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="whitespace-pre-line">
              {para}
            </p>
          ))}
          <Link href={href(lang, "/shop")} className="justify-self-start rounded-full bg-plum px-6 py-3 font-display font-semibold text-blush hover:bg-plum-hover">
            {t.nav.shop}
          </Link>
        </div>
        <div className="dot-grid-dark relative grid aspect-square place-items-center overflow-hidden rounded-[36px] bg-plum text-blush" aria-hidden="true">
          <span className="mark mark-full size-2/5" />
          {["#3a2420", "#f5ead8", "#8a9a62", "#d9607a", "#c9955f"].map((c, i) => (
            <span
              key={c}
              className="absolute rounded-full shadow-[inset_-6px_-8px_0_rgb(0_0_0/.14)]"
              style={{
                background: c,
                width: [70, 90, 44, 30, 52][i],
                height: [70, 90, 44, 30, 52][i],
                top: ["12%", "64%", "18%", "76%", "40%"][i],
                left: ["10%", "70%", "76%", "18%", "84%"][i],
              }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

/* ---------- Contact + FAQ ---------- */
export async function ContactView({ lang }: { lang: Lang }) {
  const t = dict[lang];
  const [settings, faqs] = await Promise.all([getSettings(), getFaqs()]);
  const channels = [
    settings.whatsapp_number && { label: t.contact.whatsapp, value: settings.whatsapp_number, url: waLink(settings.whatsapp_number), color: "#8a9a62" },
    settings.instagram_url && { label: t.contact.instagram, value: settings.instagram_url.replace(/^https?:\/\/(www\.)?/, ""), url: settings.instagram_url, color: "#d9607a" },
    settings.tiktok_url && { label: t.contact.tiktok, value: settings.tiktok_url.replace(/^https?:\/\/(www\.)?/, ""), url: settings.tiktok_url, color: "#3a2420" },
    settings.facebook_url && { label: t.contact.facebook, value: settings.facebook_url.replace(/^https?:\/\/(www\.)?/, ""), url: settings.facebook_url, color: "#5b4659" },
  ].filter(Boolean) as { label: string; value: string; url: string; color: string }[];

  return (
    <main>
      <PageTop eyebrow={t.contact.eyebrow} title={t.contact.title} text={channels.length ? t.contact.text : undefined} />
      <div className="mx-auto grid max-w-[1200px] gap-14 px-4 pt-10 md:px-6">
        {channels.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group grid gap-3 rounded-[28px] bg-cream p-6 transition-colors hover:bg-blush"
              >
                <span className="size-11 rounded-full shadow-[inset_-4px_-5px_0_rgb(0_0_0/.13)]" style={{ background: c.color }} aria-hidden="true" />
                <span className="font-display text-2xl font-semibold text-plum">{c.label}</span>
                <span className="truncate text-cocoa/75" dir="ltr">
                  {c.value}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="rounded-[28px] border-2 border-dashed border-plum/20 px-6 py-10 text-center text-lg text-plum">{t.contact.soon}</p>
        )}

        {faqs.length > 0 && (
          <section aria-labelledby="h-faq" className="mx-auto w-full max-w-3xl">
            <SectionHead id="h-faq" title={t.contact.faq} />
            <div className="grid gap-3">
              {faqs.map((f) => (
                <details key={f.id} className="group rounded-[24px] bg-cream/70 px-5 py-4 open:bg-cream">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold text-plum [&::-webkit-details-marker]:hidden">
                    {loc(f, "question", lang)}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/70 text-lg transition-transform group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-cocoa/85">{loc(f, "answer", lang)}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* ---------- Policies ---------- */
export async function PolicyView({ lang, slug }: { lang: Lang; slug: string }) {
  const page = await getPage(slug);
  if (!page || !page.is_published || slug === "about") notFound();
  const body = loc(page, "body", lang);
  return (
    <main>
      <PageTop eyebrow="Reeta" title={loc(page, "title", lang)} />
      <article className="mx-auto grid max-w-3xl gap-5 px-4 pt-10 text-lg leading-relaxed text-cocoa/90 md:px-6">
        {body.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="whitespace-pre-line">
            {para}
          </p>
        ))}
      </article>
    </main>
  );
}

/* ---------- 404 ---------- */
export function NotFoundView({ lang }: { lang: Lang }) {
  const t = dict[lang];
  return (
    <main className="dot-grid grid min-h-[70vh] place-items-center bg-blush px-4 py-20 text-center">
      <div className="grid justify-items-center gap-5">
        <div className="relative h-28 w-56" aria-hidden="true">
          <span className="absolute bottom-0 left-4 size-20 rounded-full bg-cocoa shadow-[inset_-8px_-10px_0_rgb(0_0_0/.14)]" />
          <span className="absolute right-2 bottom-0 size-8 rounded-full bg-cream shadow-[inset_-3px_-4px_0_rgb(0_0_0/.13)]" />
          <span className="absolute right-14 bottom-0 h-1 w-20 rounded-full bg-plum/15" />
        </div>
        <h1 className="text-[36px] leading-tight font-semibold md:text-[48px]">{t.notFound.title}</h1>
        <p className="text-lg text-cocoa/80">{t.notFound.text}</p>
        <Link href={href(lang, "/shop")} className="rounded-full bg-plum px-6 py-3 font-display font-semibold text-blush hover:bg-plum-hover">
          {t.notFound.cta}
        </Link>
      </div>
    </main>
  );
}
