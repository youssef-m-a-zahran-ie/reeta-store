import { Mark } from "@/components/brand/mark";

// Temporary home until the storefront is built in phase 3.
export default function Home() {
  return (
    <main className="dot-grid grid min-h-screen place-items-center bg-blush px-4 text-center">
      <div className="grid justify-items-center gap-5 text-plum">
        <Mark variant="full" className="size-40" />
        <p className="font-display text-5xl font-semibold tracking-[0.07em]">REETA</p>
        <p className="max-w-sm text-lg text-cocoa">Nuts, coated in chocolate. The store opens soon.</p>
      </div>
    </main>
  );
}
