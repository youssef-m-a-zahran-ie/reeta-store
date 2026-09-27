"use client";

import { useCart } from "../cart";

export function Toast() {
  const { toastMsg } = useCart();
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 bottom-[calc(20px+env(safe-area-inset-bottom,0px))] z-[70] flex justify-center px-4 transition-[opacity,transform] duration-300 ${toastMsg ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[140%] opacity-0"}`}
    >
      <span className="rounded-full bg-cocoa px-5 py-2.5 text-center text-[15px] font-medium text-cream shadow-lg">{toastMsg}</span>
    </div>
  );
}
