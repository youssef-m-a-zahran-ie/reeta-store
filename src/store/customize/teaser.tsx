import Link from "next/link";
import { dict, href, type Lang } from "../i18n";
import { atelierImg } from "./visuals";

/** Home page invitation to the Atelier: a coated hazelnut under a slow pour, beside the copy. */
export function AtelierTeaser({ lang }: { lang: Lang }) {
  const a = dict[lang].atelier;
  return (
    <section className="px-4 py-16 md:px-6 md:py-24" aria-labelledby="h-atelier">
      <div className="reveal mx-auto grid max-w-[1200px] overflow-hidden rounded-[36px] bg-plum text-blush md:grid-cols-[1fr_1.05fr]">
        <div className="dot-grid-dark grid content-center justify-items-start gap-4 px-6 py-12 md:px-12 md:py-16">
          <span className="eyebrow text-blush/60">{a.teaserEyebrow}</span>
          <h2 id="h-atelier" className="text-[34px] leading-[1.08] font-semibold text-blush md:text-[46px]">
            {a.teaserTitle}
          </h2>
          <p className="max-w-[42ch] text-blush/80 md:text-lg">{a.teaserText}</p>
          <Link href={href(lang, "/customize")} className="lift mt-2 rounded-full bg-blush px-7 py-3 text-lg font-medium text-plum hover:bg-cream">
            {a.teaserCta}
          </Link>
        </div>
        <Link href={href(lang, "/customize")} className="atelier-teaser group relative block aspect-[5/4] md:aspect-auto md:min-h-[440px]" tabIndex={-1} aria-hidden="true">
          <span className="atelier-frame" />
          <span className="teaser-pour" />
          <span className="atelier-floor !top-[80%] !w-[34%]" />
          <span className="teaser-nut">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={atelierImg.drip("hazelnut", "dark")} alt="" loading="lazy" />
          </span>
        </Link>
      </div>
    </section>
  );
}
