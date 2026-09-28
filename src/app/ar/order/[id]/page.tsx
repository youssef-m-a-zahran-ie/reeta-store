import type { Metadata } from "next";
import { OrderView } from "@/store/views/checkout";

export const metadata: Metadata = { title: "طلبك", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderView lang={"ar"} id={id} />;
}
