import type { Metadata } from "next";
import Link from "next/link";
import "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "Not found · Reeta" };

// Shown for any URL that matches no page.
export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body>
        <main className="dot-grid grid min-h-screen place-items-center bg-blush px-4 text-center">
          <div className="grid justify-items-center gap-5">
            <span className="mark mark-full size-24 text-plum" aria-hidden="true" />
            <h1 className="text-[40px] leading-tight font-semibold">This pouch rolled away.</h1>
            <p className="text-lg text-cocoa/80">The page you&apos;re looking for isn&apos;t here.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/shop" className="rounded-full bg-plum px-6 py-3 font-display font-semibold text-blush">
                Back to the shop
              </Link>
              <Link href="/ar/shop" className="rounded-full border-2 border-plum px-6 py-[10px] font-display font-semibold text-plum">
                ارجع للمنتجات
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
