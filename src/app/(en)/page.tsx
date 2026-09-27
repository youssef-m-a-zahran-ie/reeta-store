import type { Metadata } from "next";
import { HomeView } from "@/store/views/home";
import { pageMeta } from "@/store/meta";

export const metadata: Metadata = pageMeta({ lang: "en", path: "/" });

export default function Page() {
  return <HomeView lang={"en"} />;
}
