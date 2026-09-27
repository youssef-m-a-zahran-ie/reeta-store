export type Lang = "en" | "ar";

/** Link inside the store for a language: "/shop" → "/ar/shop" for Arabic. */
export function href(lang: Lang, path: string) {
  if (lang === "en") return path;
  return path === "/" ? "/ar" : `/ar${path}`;
}

/** The same page in the other language. */
export function switchLangPath(lang: Lang, pathname: string) {
  if (lang === "ar") return pathname.replace(/^\/ar(?=\/|$)/, "") || "/";
  return pathname === "/" ? "/ar" : `/ar${pathname}`;
}

/** Picks name_en / name_ar from any record. */
export function loc<T extends Record<string, unknown>>(obj: T | null | undefined, key: string, lang: Lang): string {
  if (!obj) return "";
  const v = obj[`${key}_${lang}`] ?? obj[`${key}_en`];
  return typeof v === "string" ? v : "";
}

const nf = {
  en: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }),
  ar: new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2, numberingSystem: "latn" }),
};

export function money(n: number, lang: Lang) {
  return lang === "ar" ? `${nf.ar.format(n)} ج.م` : `${nf.en.format(n)} EGP`;
}

export function number(n: number, lang: Lang) {
  return nf[lang].format(n);
}

const en = {
  brandLine: "Nuts, coated in chocolate.",
  nav: { shop: "Shop", bundles: "Bundles", about: "About", contact: "Contact", home: "Home", menu: "Menu", close: "Close" },
  langSwitch: "عربي",
  langSwitchLabel: "Switch to Arabic",
  cart: {
    open: (n: number) => `Open your pouch, ${n} item${n === 1 ? "" : "s"}`,
    title: "Your pouch",
    empty: "Your pouch is empty.",
    emptyCta: "Shop bestsellers",
    subtotal: "Subtotal",
    checkout: "Checkout",
    checkoutSoon: "Checkout opens with the next update.",
    free: "Free delivery unlocked.",
    toFree: (amount: string) => `Add ${amount} for free delivery.`,
    remove: (name: string) => `Remove one ${name}`,
    add: (name: string) => `Add one ${name}`,
    added: (name: string) => `Added ${name}`,
    freeToast: "Free delivery unlocked",
    deliveryNote: "Delivery is calculated at checkout from your location.",
  },
  product: {
    addToPouch: "Add to pouch",
    soldOut: "Sold out",
    from: (p: string) => `From ${p}`,
    weight: "Size",
    qty: "Quantity",
    description: "About it",
    ingredients: "Ingredients",
    allergens: "Allergens",
    storage: "Storage and shelf life",
    related: "You might also like",
    unavailableSize: "This size is sold out",
    backToShop: "Back to shop",
    decrease: "One less",
    increase: "One more",
  },
  shop: {
    eyebrow: "Shop",
    title: "All pouches",
    all: "All",
    flavor: "Flavor",
    base: "Nut",
    inStock: "In stock only",
    sort: "Sort",
    sortFeatured: "Bestsellers first",
    sortPriceLow: "Price: low to high",
    sortPriceHigh: "Price: high to low",
    sortNew: "Newest",
    count: (n: number) => `${n} product${n === 1 ? "" : "s"}`,
    none: "Nothing matches these filters.",
    clear: "Clear filters",
    empty: "New pouches are on their way. Check back soon.",
  },
  bundles: {
    eyebrow: "Bundles",
    title: "Boxes to share",
    text: "Ready-made boxes that cost less than buying each pouch on its own.",
    save: (a: string) => `You save ${a}`,
    add: "Add box to pouch",
    contents: "In the box",
    none: "Bundles are coming soon.",
    unavailable: "Something in this box is sold out",
    view: "See the box",
  },
  contact: {
    eyebrow: "Contact",
    title: "Talk to us",
    text: "The fastest way to reach us is WhatsApp.",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    tiktok: "TikTok",
    facebook: "Facebook",
    faq: "Questions people ask",
    soon: "Our contact details are on their way.",
  },
  about: { eyebrow: "About", title: "About Reeta" },
  notFound: { title: "This pouch rolled away.", text: "The page you're looking for isn't here.", cta: "Back to the shop" },
  footer: { shop: "Shop", help: "Help", follow: "Follow us", rights: "All rights reserved." },
  paused: "We're not taking orders right now.",
  whatsappFloat: "Chat on WhatsApp",
  skip: "Skip to content",
};

type Dict = typeof en;

const ar: Dict = {
  brandLine: "مكسرات متغطية شوكولاتة.",
  nav: { shop: "المنتجات", bundles: "البوكسات", about: "عن ريتا", contact: "تواصل معنا", home: "الرئيسية", menu: "القائمة", close: "إغلاق" },
  langSwitch: "English",
  langSwitchLabel: "Switch to English",
  cart: {
    open: (n: number) => `افتح عبوتك، ${n} منتج`,
    title: "عبوتك",
    empty: "عبوتك فاضية.",
    emptyCta: "شوف الأكثر مبيعًا",
    subtotal: "الإجمالي",
    checkout: "إتمام الطلب",
    checkoutSoon: "إتمام الطلب هيفتح مع التحديث الجاي.",
    free: "التوصيل بقى مجاني.",
    toFree: (amount: string) => `ضيف ${amount} والتوصيل يبقى مجاني.`,
    remove: (name: string) => `شيل واحد ${name}`,
    add: (name: string) => `زوّد واحد ${name}`,
    added: (name: string) => `اتضاف ${name}`,
    freeToast: "التوصيل بقى مجاني",
    deliveryNote: "سعر التوصيل بيتحسب في الخطوة الجاية حسب مكانك.",
  },
  product: {
    addToPouch: "ضيف للعبوة",
    soldOut: "خلصت",
    from: (p: string) => `يبدأ من ${p}`,
    weight: "الحجم",
    qty: "الكمية",
    description: "عنه",
    ingredients: "المكونات",
    allergens: "مسببات الحساسية",
    storage: "الحفظ والصلاحية",
    related: "ممكن يعجبك كمان",
    unavailableSize: "الحجم ده خلص",
    backToShop: "ارجع للمنتجات",
    decrease: "قلّل واحد",
    increase: "زوّد واحد",
  },
  shop: {
    eyebrow: "المنتجات",
    title: "كل العبوات",
    all: "الكل",
    flavor: "النكهة",
    base: "النوع",
    inStock: "المتاح بس",
    sort: "الترتيب",
    sortFeatured: "الأكثر مبيعًا",
    sortPriceLow: "السعر: من الأقل",
    sortPriceHigh: "السعر: من الأعلى",
    sortNew: "الأحدث",
    count: (n: number) => `${n} منتج`,
    none: "مفيش منتجات بالاختيارات دي.",
    clear: "امسح الاختيارات",
    empty: "عبوات جديدة جاية في الطريق. ارجعلنا قريب.",
  },
  bundles: {
    eyebrow: "البوكسات",
    title: "بوكسات للمشاركة",
    text: "بوكسات جاهزة بسعر أقل من إنك تشتري كل عبوة لوحدها.",
    save: (a: string) => `هتوفّر ${a}`,
    add: "ضيف البوكس للعبوة",
    contents: "جوه البوكس",
    none: "البوكسات جاية قريب.",
    unavailable: "في حاجة في البوكس ده خلصت",
    view: "شوف البوكس",
  },
  contact: {
    eyebrow: "تواصل معنا",
    title: "كلّمنا",
    text: "أسرع طريقة توصلنا بيها هي واتساب.",
    whatsapp: "واتساب",
    instagram: "إنستجرام",
    tiktok: "تيك توك",
    facebook: "فيسبوك",
    faq: "أسئلة بتتسأل كتير",
    soon: "بيانات التواصل جاية قريب.",
  },
  about: { eyebrow: "عن ريتا", title: "عن ريتا" },
  notFound: { title: "العبوة دي اتدحرجت بعيد.", text: "الصفحة اللي بتدور عليها مش هنا.", cta: "ارجع للمنتجات" },
  footer: { shop: "تسوّق", help: "مساعدة", follow: "تابعنا", rights: "كل الحقوق محفوظة." },
  paused: "مش بنستقبل طلبات دلوقتي.",
  whatsappFloat: "كلّمنا واتساب",
  skip: "انتقل للمحتوى",
};

export const dict: Record<Lang, Dict> = { en, ar };
export type { Dict };
