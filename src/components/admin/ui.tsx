import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="grid gap-1.5">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="text-[32px] leading-tight font-semibold md:text-[40px]">{title}</h1>
        {description && <p className="max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  children,
  actions,
  className = "",
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 md:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            {title && <h2 className="text-xl font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const STATUS: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-sage text-white" },
  draft: { label: "Draft", className: "bg-cream text-cocoa" },
  archived: { label: "Archived", className: "bg-cocoa/10 text-cocoa/70" },
  ok: { label: "In stock", className: "bg-sage/15 text-[#56633a]" },
  low: { label: "Low", className: "bg-honey text-cocoa" },
  out: { label: "Out", className: "bg-rose text-white" },
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const s = STATUS[status] ?? { label: status, className: "bg-cream text-cocoa" };
  return <span className={`chip ${s.className}`}>{label ?? s.label}</span>;
}

/** Round color dot in the style of the brand's coated rounds. */
export function Swatch({ color, size = 18, className = "" }: { color: string | null | undefined; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: color ?? "transparent",
        border: color ? "none" : "1.5px dashed rgb(91 70 89 / .35)",
        boxShadow: color ? "inset -2px -3px 0 rgb(0 0 0 / .13)" : undefined,
      }}
    />
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-[22px] border-2 border-dashed border-line px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-plum">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Section">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.href === current ? "page" : undefined}
          className="rounded-full px-4 py-1.5 text-sm font-semibold text-plum hover:bg-blush aria-[current=page]:bg-plum aria-[current=page]:text-blush"
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

export const CATALOG_TABS = [
  { href: "/admin/catalog/products", label: "Products" },
  { href: "/admin/catalog/categories", label: "Categories" },
  { href: "/admin/catalog/bases", label: "Bases" },
  { href: "/admin/catalog/coatings", label: "Coatings" },
  { href: "/admin/catalog/options", label: "Options" },
  { href: "/admin/catalog/prices", label: "Price templates" },
];

export const BRAND_COLORS: { value: string; name: string }[] = [
  { value: "#3a2420", name: "Cocoa" },
  { value: "#f5ead8", name: "Cream" },
  { value: "#a0673f", name: "Toffee" },
  { value: "#8a9a62", name: "Sage" },
  { value: "#c9955f", name: "Honey" },
  { value: "#d9607a", name: "Rose" },
  { value: "#5b4659", name: "Plum" },
  { value: "#f2d0e3", name: "Blush" },
];
