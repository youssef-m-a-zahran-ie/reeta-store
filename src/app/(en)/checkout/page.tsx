import type { Metadata } from "next";
import { CheckoutView } from "@/store/views/checkout";
import { dict } from "@/store/i18n";

export const metadata: Metadata = { title: dict["en"].checkout.title, robots: { index: false } };

export default function Page() {
  return <CheckoutView lang={"en"} />;
}
