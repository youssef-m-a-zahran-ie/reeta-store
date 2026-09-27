import type { Metadata } from "next";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/figtree";
import "@fontsource-variable/readex-pro";
import "@fontsource/baloo-bhaijaan-2/600.css";
import "@fontsource/baloo-bhaijaan-2/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Reeta", template: "%s · Reeta" },
  description: "Nuts, coated in chocolate.",
  icons: { icon: "/brand/mark-full.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
