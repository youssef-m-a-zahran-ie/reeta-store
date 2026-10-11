import { notFound } from "next/navigation";
import { getAtelier, getSettings } from "../data";
import { dict, type Lang } from "../i18n";
import { Atelier } from "../customize/atelier";

export async function AtelierView({ lang }: { lang: Lang }) {
  const t = dict[lang];
  const [data, settings] = await Promise.all([getAtelier(), getSettings()]);
  if (!data) notFound();

  return (
    <main className="px-4 pt-8 md:px-6 md:pt-14">
      <div className="mx-auto max-w-[1200px]">
        <header className="page-rise mb-6 grid max-w-2xl gap-2 md:mb-10 md:gap-3">
          <span className="eyebrow">{t.atelier.eyebrow}</span>
          <h1 className="text-[38px] leading-[1.04] font-semibold md:text-[60px]">{t.atelier.title}</h1>
          <p className="text-[16px] text-pretty text-cocoa/80 md:text-lg">{t.atelier.lede}</p>
        </header>
        <Atelier data={data} lang={lang} whatsapp={settings.whatsapp_button ? settings.whatsapp_number : null} />
      </div>
    </main>
  );
}
