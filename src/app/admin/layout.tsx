import type { Metadata } from "next";
import "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Reeta Admin" },
  robots: { index: false, follow: false },
  icons: { icon: "/brand/favicon.png", apple: "/brand/apple-touch-icon.png" },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" dir="ltr" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
