import Link from "next/link";
import type { ReactNode } from "react";
import { mediaUrl } from "@/lib/supabase/env";
import { getBundles, getCatalog, getContent, getTestimonials, type StoreProduct } from "../data";
import { dict, href, loc, type Lang } from "../i18n";
import { OrbitStage } from "../components/orbit-stage";
import { ProductCard } from "../components/product-card";
import { BundleCard } from "../components/bundle-card";

type Data = Record<string, unknown>;
const txt = (d: Data | undefined, key: string, lang: Lang) => (d ? loc(d, key, lang) : "");

const ARCH_COLORS = ["#3a2420", "#8a9a62", "#a0673f", "#d9607a", "#c9955f", "#5b4659"];

export function SectionHead({ eyebrow, title, text, action, id }: { eyebrow?: string; title: string; text?: string; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
      <div className="grid max-w-2xl gap-2">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 id={id} className="text-[32px] leading-[1.15] font-semibold md:text-[48px] md:leading-[1.1]">
          {title}
        </h2>
        {text && <p className="text-[17px] text-cocoa/80 md:text-lg">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export async function HomeView({ lang }: { lang: Lang }) {
  const t = dict[lang];
  const [catalog, bundles, content, testimonials] = await Promise.all([getCatalog(), getBundles(), getContent("home"), getTestimonials()]);
  const block = (k: string) => content[k];
  const hero = block("home.hero")?.data;

  const featured = catalog.products.filter((p) => p.is_featured);
  const best: StoreProduct[] = (featured.length ? featured : catalog.products).slice(0, 4);
  const catName = (p: StoreProduct) => loc(catalog.categories.find((c) => c.id === p.category_id), "name", lang);

  const sections: { key: string; sort: number; node: ReactNode }[] = [];

  const cats = block("home.categories");
  if (cats && catalog.categories.length > 1) {
    sections.push({
      key: cats.key,
      sort: cats.sort,
      node: (
        <section className="px-4 py-16 md:px-6 md:py-24" aria-labelledby="h-cats">
          <div className="mx-auto max-w-[1200px]">
            <SectionHead id="h-cats" eyebrow={txt(cats.data, "eyebrow", lang)} title={txt(cats.data, "title", lang)} />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {catalog.categories.map((c, i) => (
                <Link
                  key={c.id}
                  href={href(lang, `/shop/${c.slug}`)}
                  className="group relative grid aspect-[3/4] content-end overflow-hidden rounded-t-full rounded-b-[28px] p-5 text-center"
                  style={{ background: ARCH_COLORS[i % ARCH_COLORS.length] }}
                >
                  {c.image_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(c.image_path)!}
                      alt=""
                      className="absolute inset-0 size-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <span className="relative rounded-full bg-page/90 px-4 py-2 font-display text-lg font-semibold text-plum">{loc(c, "name", lang)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ),
    });
  }

  const bund = block("home.bundles");
  if (bund && bundles.length) {
    sections.push({
      key: bund.key,
      sort: bund.sort,
      node: (
        <section className="px-4 py-16 md:px-6 md:py-24" aria-labelledby="h-bundles" id="bundles">
          <div className="mx-auto max-w-[1200px]">
            <SectionHead
              id="h-bundles"
              eyebrow={txt(bund.data, "eyebrow", lang)}
              title={txt(bund.data, "title", lang)}
              text={txt(bund.data, "text", lang)}
              action={
                bundles.length > 1 ? (
                  <Link href={href(lang, "/bundles")} className="rounded-full border-2 border-plum px-5 py-2 font-display font-semibold text-plum hover:bg-blush">
                    {t.nav.bundles}
                  </Link>
                ) : undefined
              }
            />
            <BundleCard bundle={bundles[0]} lang={lang} />
          </div>
        </section>
      ),
    });
  }

  const why = block("home.why");
  if (why) {
    const points = (Array.isArray(why.data.points) ? why.data.points : []) as Data[];
    sections.push({
      key: why.key,
      sort: why.sort,
      node: (
        <section className="px-4 py-16 md:px-6 md:py-24" aria-labelledby="h-why">
          <div className="dot-grid mx-auto max-w-[1200px] rounded-[36px] bg-blush px-6 py-12 md:px-12 md:py-16">
            <SectionHead id="h-why" eyebrow={txt(why.data, "eyebrow", lang)} title={txt(why.data, "title", lang)} />
            <div className="grid gap-8 md:grid-cols-3">
              {points.map((pt, i) => (
                <div key={i} className="grid content-start gap-3">
                  <span
                    className="size-12 rounded-full shadow-[inset_-5px_-6px_0_rgb(0_0_0/.13),0_8px_14px_rgb(58_36_32/.16)]"
                    style={{ background: ["#3a2420", "#f5ead8", "#8a9a62"][i % 3] }}
                    aria-hidden="true"
                  />
                  <h3 className="text-2xl font-semibold">{txt(pt, "title", lang)}</h3>
                  <p className="text-cocoa/80">{txt(pt, "text", lang)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ),
    });
  }

  const testi = block("home.testimonials");
  if (testi && testimonials.length) {
    sections.push({
      key: testi.key,
      sort: testi.sort,
      node: (
        <section className="px-4 py-16 md:px-6 md:py-24" aria-labelledby="h-testi">
          <div className="mx-auto max-w-[1200px]">
            <SectionHead id="h-testi" eyebrow={txt(testi.data, "eyebrow", lang)} title={txt(testi.data, "title", lang)} />
            <div className="grid gap-4 md:grid-cols-3">
              {testimonials.map((q) => (
                <figure key={q.id} className="grid content-start gap-4 rounded-[28px] bg-cream p-6">
                  {q.image_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(q.image_path)!} alt="" className="w-full rounded-2xl" loading="lazy" />
                  )}
                  {loc(q, "text", lang) && <blockquote className="text-lg text-cocoa">{loc(q, "text", lang)}</blockquote>}
                  {q.name && <figcaption className="font-display font-semibold text-plum">{q.name}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        </section>
      ),
    });
  }

  const cta = block("home.cta");
  if (cta) {
    sections.push({
      key: cta.key,
      sort: cta.sort,
      node: (
        <section className="px-4 pt-8 md:px-6">
          <div className="dot-grid-dark mx-auto grid max-w-[1200px] justify-items-center gap-4 rounded-[36px] bg-plum px-6 py-14 text-center text-blush md:py-20">
            <span className="mark mark-full size-16" aria-hidden="true" />
            <h2 className="text-[32px] leading-tight font-semibold text-blush md:text-[44px]">{txt(cta.data, "title", lang)}</h2>
            <p className="text-blush/80">{txt(cta.data, "text", lang)}</p>
            <Link href={href(lang, "/shop")} className="mt-2 rounded-full bg-blush px-7 py-3 font-display text-lg font-semibold text-plum hover:bg-cream">
              {txt(cta.data, "button", lang)}
            </Link>
          </div>
        </section>
      ),
    });
  }

  const bestBlock = block("home.bestsellers");

  return (
    <main>
      <OrbitStage>
        <section data-hero className="hero-intro dot-grid relative overflow-hidden bg-blush px-4 pt-14 pb-16 text-center md:pt-20 md:pb-24">
          <div className="pointer-events-none absolute top-[44%] left-1/2" aria-hidden="true">
            <span className="ring-grow absolute top-1/2 left-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed border-plum/20 max-md:size-[620px]" />
            <span className="ring-grow absolute top-1/2 left-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-plum/20 max-md:size-[400px]" />
          </div>
          <div className="relative z-[2] mx-auto grid max-w-3xl justify-items-center gap-5">
            <div className="grid justify-items-center gap-4 text-plum" role="img" aria-label="Reeta">
              <div className="relative size-[172px] md:size-[240px]">
                <span className="mark mark-arcA absolute inset-0" />
                <span className="mark mark-arcB absolute inset-0" />
                <span className="mark mark-inner absolute inset-0" />
              </div>
              <div className="flex font-display text-[50px] leading-none font-semibold tracking-[0.07em] md:text-[72px]" dir="ltr" aria-hidden="true">
                {"REETA".split("").map((ch, i) => (
                  <span key={i} className="rise inline-block" style={{ "--d": `${0.55 + i * 0.06}s` } as React.CSSProperties}>
                    {ch}
                  </span>
                ))}
              </div>
            </div>
            <h1 className="rise text-[30px] leading-[1.1] font-semibold md:text-[40px]" style={{ "--d": "0.85s" } as React.CSSProperties}>
              {txt(hero, "title", lang) || t.brandLine}
            </h1>
            {txt(hero, "subtitle", lang) && (
              <p className="rise max-w-[36ch] text-[16px] text-cocoa md:text-lg" style={{ "--d": "0.95s" } as React.CSSProperties}>
                {txt(hero, "subtitle", lang)}
              </p>
            )}
            <div className="rise mt-1 flex flex-wrap justify-center gap-3" style={{ "--d": "1.05s" } as React.CSSProperties}>
              <Link href={href(lang, "/shop")} className="rounded-full bg-plum px-6 py-3 font-display text-[17px] font-semibold text-blush hover:bg-plum-hover">
                {txt(hero, "primary", lang) || t.nav.shop}
              </Link>
              <Link
                href={href(lang, bundles.length ? "/bundles" : "/shop")}
                className="rounded-full border-2 border-plum px-6 py-[10px] font-display text-[17px] font-semibold text-plum hover:bg-page"
              >
                {txt(hero, "secondary", lang) || t.nav.bundles}
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 pt-20 pb-6 md:px-6 md:pt-28" aria-labelledby="h-best" id="shop">
          <div className="mx-auto max-w-[1200px]">
            <SectionHead
              id="h-best"
              eyebrow={txt(bestBlock?.data, "eyebrow", lang)}
              title={txt(bestBlock?.data, "title", lang) || t.shop.title}
              action={
                catalog.products.length > best.length ? (
                  <Link href={href(lang, "/shop")} className="rounded-full border-2 border-plum px-5 py-2 font-display font-semibold text-plum hover:bg-blush">
                    {t.shop.title}
                  </Link>
                ) : undefined
              }
            />
            {best.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {best.map((p) => (
                  <ProductCard key={p.id} product={p} lang={lang} categoryName={catName(p)} />
                ))}
              </div>
            ) : (
              <p className="rounded-[28px] border-2 border-dashed border-plum/20 px-6 py-12 text-center text-lg text-plum">{t.shop.empty}</p>
            )}
          </div>
        </section>
      </OrbitStage>

      {sections
        .sort((a, b) => a.sort - b.sort)
        .map((s) => (
          <div key={s.key}>{s.node}</div>
        ))}
    </main>
  );
}
