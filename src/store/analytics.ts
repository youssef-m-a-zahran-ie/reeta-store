/**
 * Sends shopping events to whichever pixels are installed (Meta, TikTok, Google Analytics).
 * Safe to call anywhere on the client: missing pixels are skipped.
 */
export type TrackItem = { id: string; name: string; price: number; qty: number; variant?: string | null };
type Event = "view_item" | "add_to_cart" | "begin_checkout" | "purchase";

type W = Window & {
  fbq?: (...a: unknown[]) => void;
  ttq?: { track: (e: string, p?: unknown, o?: unknown) => void };
  gtag?: (...a: unknown[]) => void;
};

const META: Record<Event, string> = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase" };
const TIKTOK: Record<Event, string> = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "CompletePayment" };

export function track(event: Event, data: { items: TrackItem[]; value?: number; orderId?: string; orderNumber?: number }) {
  if (typeof window === "undefined") return;
  const w = window as W;
  const value = data.value ?? data.items.reduce((s, i) => s + i.price * i.qty, 0);
  const ids = data.items.map((i) => i.id);
  try {
    w.fbq?.(
      "track",
      META[event],
      {
        content_ids: ids,
        content_type: "product",
        contents: data.items.map((i) => ({ id: i.id, quantity: i.qty, item_price: i.price })),
        num_items: data.items.reduce((s, i) => s + i.qty, 0),
        value,
        currency: "EGP",
      },
      data.orderId ? { eventID: data.orderId } : undefined,
    );
  } catch {}
  try {
    w.ttq?.track(
      TIKTOK[event],
      {
        contents: data.items.map((i) => ({ content_id: i.id, content_name: i.name, quantity: i.qty, price: i.price })),
        content_type: "product",
        value,
        currency: "EGP",
      },
      data.orderId ? { event_id: data.orderId } : undefined,
    );
  } catch {}
  try {
    w.gtag?.("event", event, {
      currency: "EGP",
      value,
      ...(data.orderNumber ? { transaction_id: String(data.orderNumber) } : {}),
      items: data.items.map((i) => ({ item_id: i.id, item_name: i.name, item_variant: i.variant ?? undefined, price: i.price, quantity: i.qty })),
    });
  } catch {}
}

/** Fires a purchase only once per order, even if the confirmation page is reopened. */
export function trackPurchaseOnce(orderId: string, fire: () => void) {
  const key = `reeta-purchase-${orderId}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage blocked: still send it; pixels dedupe by event id.
  }
  fire();
}
