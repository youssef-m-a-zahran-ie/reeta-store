"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "../cart";
import { dict, href, switchLangPath, type Lang } from "../i18n";

const R = 23;
const C = 2 * Math.PI * R;

export function Header({ lang, freeOver }: { lang: Lang; freeOver: number | null }) {
  const t = dict[lang];
  const pathname = usePathname();
  const { count, subtotal, setOpen, cartButton, bump } = useCart();
  const [menu, setMenu] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenu(false);
  }

  const progress = freeOver ? Math.min(1, subtotal / freeOver) : count > 0 ? 1 : 0;
  const full = freeOver !== null && subtotal >= freeOver && count > 0;
  const links = [
    { href: href(lang, "/shop"), label: t.nav.shop },
    { href: href(lang, "/bundles"), label: t.nav.bundles },
    { href: href(lang, "/about"), label: t.nav.about },
    { href: href(lang, "/contact"), label: t.nav.contact },
  ];
  const isActive = (h: string) => pathname === h || pathname.startsWith(`${h}/`);

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-40 border-b border-plum/10 bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-4 px-4 md:gap-6 md:px-6">
        <Link href={href(lang, "/")} className="flex items-center gap-2.5 text-plum" aria-label="Reeta">
          <span className="mark mark-full size-[38px]" aria-hidden="true" />
          <span className="font-display text-[22px] leading-none font-semibold tracking-[0.07em]" dir="ltr">
            REETA
          </span>
        </Link>

        <nav className="ms-auto hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className="rounded-full px-3.5 py-2 font-display text-base font-medium text-plum transition-colors hover:bg-blush aria-[current=page]:bg-blush"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <a
          href={switchLangPath(lang, pathname)}
          hrefLang={lang === "en" ? "ar" : "en"}
          aria-label={t.langSwitchLabel}
          className="ms-auto rounded-full border border-plum/20 px-3 py-1.5 text-sm font-semibold text-plum transition-colors hover:bg-blush md:ms-0"
        >
          {t.langSwitch}
        </a>

        <button
          ref={cartButton}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.cart.open(count)}
          className={`relative size-[52px] shrink-0 rounded-full text-plum ${full ? "cart-full" : ""}`}
        >
          <svg viewBox="0 0 52 52" className="absolute inset-0 size-full -rotate-90 overflow-visible" aria-hidden="true">
            <circle cx="26" cy="26" r={R} fill="none" stroke="rgb(91 70 89 / .22)" strokeWidth="2" strokeDasharray="2 4" />
            <circle
              cx="26"
              cy="26"
              r={R}
              fill="none"
              stroke={full ? "#d9607a" : "#5b4659"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              className="transition-[stroke-dashoffset,stroke] duration-700 ease-[cubic-bezier(.22,1,.36,1)]"
            />
          </svg>
          <span className={`mark mark-inner absolute inset-3 transition-colors ${full ? "text-rose" : ""}`} aria-hidden="true" />
          <span
            key={bump}
            className="cart-count absolute -top-0.5 -end-1 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-cocoa px-1.5 text-xs font-semibold text-cream tabular-nums"
          >
            {count}
          </span>
        </button>

        <button
          type="button"
          className="rounded-full border-2 border-plum px-3.5 py-1.5 font-display text-sm font-semibold text-plum md:hidden"
          aria-expanded={menu}
          aria-controls="store-menu"
          onClick={() => setMenu((m) => !m)}
        >
          {menu ? t.nav.close : t.nav.menu}
        </button>
      </div>

      {menu && (
        <nav id="store-menu" className="border-t border-plum/10 bg-page px-4 pt-2 pb-5 md:hidden" aria-label="Main">
          <ul className="grid gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className="block rounded-2xl px-4 py-3 font-display text-xl font-semibold text-plum aria-[current=page]:bg-blush"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
