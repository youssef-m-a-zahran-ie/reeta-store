/** Which fields each home section has. Every field is stored as <name>_en and <name>_ar in content_blocks.data. */
export type BlockField = { name: string; label: string; long?: boolean };
export type BlockDef = { key: string; title: string; hint: string; fields: BlockField[]; points?: number; alwaysOn?: boolean };

export const HOME_BLOCKS: BlockDef[] = [
  {
    key: "home.hero",
    title: "Top of the page",
    hint: "The first thing people see, under the moving logo.",
    alwaysOn: true,
    fields: [
      { name: "title", label: "Headline" },
      { name: "subtitle", label: "Line under it", long: true },
      { name: "primary", label: "Main button" },
      { name: "secondary", label: "Second button" },
    ],
  },
  {
    key: "home.bestsellers",
    title: "Bestsellers",
    hint: "Shows products marked Featured, or the first four.",
    alwaysOn: true,
    fields: [
      { name: "eyebrow", label: "Small label" },
      { name: "title", label: "Title" },
    ],
  },
  {
    key: "home.categories",
    title: "Categories",
    hint: "Only appears once there's more than one visible category.",
    fields: [
      { name: "eyebrow", label: "Small label" },
      { name: "title", label: "Title" },
    ],
  },
  {
    key: "home.bundles",
    title: "Boxes",
    hint: "Only appears when at least one box is active.",
    fields: [
      { name: "eyebrow", label: "Small label" },
      { name: "title", label: "Title" },
      { name: "text", label: "Text", long: true },
    ],
  },
  {
    key: "home.why",
    title: "Why Reeta",
    hint: "Three short reasons to buy.",
    points: 3,
    fields: [
      { name: "eyebrow", label: "Small label" },
      { name: "title", label: "Title" },
    ],
  },
  {
    key: "home.testimonials",
    title: "Reviews",
    hint: "Only appears when at least one review is visible (see the Reviews tab).",
    fields: [
      { name: "eyebrow", label: "Small label" },
      { name: "title", label: "Title" },
    ],
  },
  {
    key: "home.cta",
    title: "Closing banner",
    hint: "The plum banner before the footer.",
    fields: [
      { name: "title", label: "Title" },
      { name: "text", label: "Text" },
      { name: "button", label: "Button" },
    ],
  },
];

export const CONTENT_TABS = [
  { href: "/admin/content", label: "Home page" },
  { href: "/admin/content/pages", label: "Pages" },
  { href: "/admin/content/faq", label: "FAQ" },
  { href: "/admin/content/reviews", label: "Reviews" },
];
