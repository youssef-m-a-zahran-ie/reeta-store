import { dict, loc, type Lang } from "../i18n";
import type { Menu as MenuData } from "../data";
import { EmptyOrbit } from "../components/orbit-decor";
import { Menu } from "./menu";

/** The menu with its heading: used on the home page and on /shop. */
export function MenuSection({
  data,
  lang,
  heading = "h2",
  copy,
}: {
  data: MenuData | null;
  lang: Lang;
  heading?: "h1" | "h2";
  /** The "home.bestsellers" content block: eyebrow, title, text (each _en/_ar). */
  copy?: Record<string, unknown>;
}) {
  const t = dict[lang].menu;
  const c = (k: string, fallback: string) => (copy ? loc(copy, k, lang) : "") || fallback;
  const H = heading;
  return (
    <section className="scroll-mt-20 px-4 pt-14 pb-10 md:px-6 md:pt-24" aria-labelledby="h-menu" id="menu">
      <div className="mx-auto max-w-[1200px]">
        <div className="reveal mb-6 grid max-w-2xl gap-1.5 md:mb-10 md:gap-2">
          <span className="eyebrow">{c("eyebrow", t.eyebrow)}</span>
          <H id="h-menu" className="text-[34px] leading-[1.1] font-semibold md:text-[52px]">
            {c("title", t.title)}
          </H>
          <p className="text-[16px] text-cocoa/75 md:text-lg">{c("text", t.sub)}</p>
        </div>
        {data ? <Menu data={data} lang={lang} /> : <EmptyOrbit text={t.empty} />}
      </div>
    </section>
  );
}
