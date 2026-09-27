import "../fonts";
import "../globals.css";
import { StoreRootLayout, storeMetadata, storeViewport } from "@/store/root-layout";

export const metadata = storeMetadata("en");
export const viewport = storeViewport;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StoreRootLayout lang={"en"}>{children}</StoreRootLayout>;
}
