"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

export type CartItem = {
  key: string;
  kind: "variant" | "bundle";
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  label_en: string | null;
  label_ar: string | null;
  price: number;
  color: string | null;
  image: string | null;
  qty: number;
};

/* ---------- a tiny external store backed by localStorage ---------- */
const KEY = "reeta-cart-v1";
const EMPTY: CartItem[] = [];
let items: CartItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    items = Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.price === "number" && i.qty > 0) : [];
  } catch {
    items = [];
  }
}

function save(next: CartItem[]) {
  items = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or blocked storage: the cart still works for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      loaded = false;
      load();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot() {
  load();
  return items;
}

/* ---------- context ---------- */
type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "qty">, qty?: number, from?: Element | null) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  cartButton: React.RefObject<HTMLButtonElement | null>;
  toast: (msg: string) => void;
  toastMsg: string | null;
  bump: number;
};

const Ctx = createContext<CartCtx | null>(null);

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A coated round flies from the product to the cart ring. */
function fly(from: Element, to: Element, color: string, onDone: () => void) {
  if (reducedMotion()) return onDone();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const x0 = a.left + a.width / 2;
  const y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2;
  const y1 = b.top + b.height / 2;
  const cx = (x0 + x1) / 2;
  const cy = Math.min(y0, y1) - 160;
  const d = document.createElement("div");
  d.setAttribute("aria-hidden", "true");
  Object.assign(d.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    background: color,
    zIndex: "60",
    pointerEvents: "none",
    boxShadow: "inset -3px -4px 0 rgb(0 0 0 / .13), 0 6px 12px rgb(58 36 32 / .25)",
  });
  document.body.appendChild(d);
  const t0 = performance.now();
  const dur = 620;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x1;
    const y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y1;
    d.style.transform = `translate(${x - 12}px, ${y - 12}px) scale(${1 - 0.55 * e})`;
    if (k < 1) requestAnimationFrame(step);
    else {
      d.remove();
      onDone();
    }
  };
  requestAnimationFrame(step);
}

export function CartProvider({
  children,
  freeOver = null,
  freeMessage = "",
}: {
  children: ReactNode;
  freeOver?: number | null;
  freeMessage?: string;
}) {
  const list = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const [open, setOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  const cartButton = useRef<HTMLButtonElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2400);
  }, []);

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1, from?: Element | null) => {
    const commit = () => {
      const cur = snapshot();
      const before = cur.reduce((s, i) => s + i.qty * i.price, 0);
      const found = cur.find((i) => i.key === item.key);
      const next = found
        ? cur.map((i) => (i.key === item.key ? { ...i, ...item, qty: Math.min(99, i.qty + qty) } : i))
        : [...cur, { ...item, qty }];
      save(next);
      setBump((b) => b + 1);
      const after = next.reduce((s, i) => s + i.qty * i.price, 0);
      if (freeOver !== null && before < freeOver && after >= freeOver) setTimeout(() => toast(freeMessage), 1200);
    };
    if (from && cartButton.current) fly(from, cartButton.current, item.color ?? "#5b4659", commit);
    else commit();
  }, [freeOver, freeMessage, toast]);

  const setQty = useCallback((key: string, qty: number) => {
    const cur = snapshot();
    save(qty <= 0 ? cur.filter((i) => i.key !== key) : cur.map((i) => (i.key === key ? { ...i, qty: Math.min(99, qty) } : i)));
  }, []);

  const clear = useCallback(() => save([]), []);

  const value = useMemo<CartCtx>(() => {
    const count = list.reduce((s, i) => s + i.qty, 0);
    const subtotal = list.reduce((s, i) => s + i.qty * i.price, 0);
    return { items: list, count, subtotal, add, setQty, clear, open, setOpen, cartButton, toast, toastMsg, bump };
  }, [list, add, setQty, clear, open, toast, toastMsg, bump]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
