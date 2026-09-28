"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/mark";
import { signOut } from "@/app/admin/login/actions";

type Item = { href: string; label: string; soon?: string; match?: string; badge?: "orders" | "inbox" };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Run the store",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/orders", label: "Orders", badge: "orders" },
      { href: "/admin/customers", label: "Customers" },
    ],
  },
  {
    title: "Products",
    items: [
      { href: "/admin/catalog/products", label: "Catalog", match: "/admin/catalog" },
      { href: "/admin/inventory", label: "Inventory" },
      { href: "/admin/bundles", label: "Bundles" },
      { href: "/admin/discounts", label: "Discounts" },
    ],
  },
  {
    title: "Grow",
    items: [
      { href: "#", label: "Reports", soon: "Phase 6" },
      { href: "#", label: "Ad spend", soon: "Phase 6" },
    ],
  },
  {
    title: "Site",
    items: [
      { href: "/admin/content", label: "Content" },
      { href: "/admin/inbox", label: "Inbox", badge: "inbox" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/account", label: "Account" },
    ],
  },
];

export function AdminNav({ email, counts }: { email: string; counts: { orders: number; inbox: number } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile menu after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isActive = (it: Item) =>
    it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.match ?? it.href);

  return (
    <>
      {/* Mobile bar */}
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-30 flex h-16 items-center justify-between border-b border-line bg-page/90 px-4 backdrop-blur md:hidden">
        <Link href="/admin" aria-label="Overview">
          <Logo />
        </Link>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <aside
        id="admin-sidebar"
        className={`${open ? "block" : "hidden"} fixed inset-x-0 top-16 bottom-0 z-20 overflow-y-auto bg-plum text-blush md:sticky md:top-0 md:block md:h-screen`}
      >
        <div className="dot-grid-dark flex min-h-full flex-col gap-6 px-4 py-6 md:px-5 md:py-8">
          <Link href="/admin" className="hidden items-center gap-2.5 px-2 text-blush md:flex" aria-label="Overview">
            <span className="mark mark-full size-9" aria-hidden="true" />
            <span className="font-display text-[21px] font-semibold tracking-[0.07em]">REETA</span>
          </Link>

          <nav className="grid gap-5" aria-label="Admin">
            {GROUPS.map((g) => (
              <div key={g.title} className="grid gap-1">
                <p className="px-3 pb-1 font-display text-[11px] font-medium tracking-[0.1em] text-blush/55 uppercase">{g.title}</p>
                {g.items.map((it) =>
                  it.soon ? (
                    <span
                      key={it.label}
                      className="flex items-center justify-between rounded-full px-3 py-2 text-[15px] text-blush/45"
                      title={`Coming in ${it.soon}`}
                    >
                      {it.label}
                      <span className="text-[11px] font-medium">{it.soon}</span>
                    </span>
                  ) : (
                    <Link
                      key={it.label}
                      href={it.href}
                      aria-current={isActive(it) ? "page" : undefined}
                      className="flex items-center justify-between rounded-full px-3 py-2 text-[15px] font-medium text-blush/90 transition hover:bg-white/10 aria-[current=page]:bg-blush aria-[current=page]:text-plum"
                    >
                      {it.label}
                      {it.badge && counts[it.badge] > 0 && (
                        <span className="num min-w-6 rounded-full bg-honey px-1.5 text-center text-xs font-bold text-cocoa" aria-label={`${counts[it.badge]} waiting`}>
                          {counts[it.badge]}
                        </span>
                      )}
                    </Link>
                  ),
                )}
              </div>
            ))}
          </nav>

          <div className="mt-auto grid gap-2 border-t border-white/15 px-3 pt-4 text-sm">
            <span className="truncate text-blush/70" title={email}>
              {email}
            </span>
            <form action={signOut}>
              <button type="submit" className="font-semibold text-blush underline-offset-4 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
