import type { Unit } from "./format";

export type Schema = "sales" | "items" | "sessions";
type M = { label: string; unit: Unit; upIsGood?: boolean };

export const METRICS: Record<Schema, Record<string, M>> = {
  sales: {
    orders: { label: "Orders", unit: "count" },
    gross_sales: { label: "Gross sales", unit: "money" },
    discounts: { label: "Discounts", unit: "money", upIsGood: false },
    sales_reversals: { label: "Sales reversals", unit: "money", upIsGood: false },
    net_sales: { label: "Net sales", unit: "money" },
    shipping_charges: { label: "Delivery charges", unit: "money" },
    total_sales: { label: "Total sales", unit: "money" },
    average_order_value: { label: "Average order value", unit: "money" },
    items_ordered: { label: "Items ordered", unit: "count" },
    cost_of_goods: { label: "Cost of goods sold", unit: "money", upIsGood: false },
    gross_profit: { label: "Gross profit", unit: "money" },
    gross_margin: { label: "Gross margin", unit: "percent" },
    new_customers: { label: "New customers", unit: "count" },
    returning_orders: { label: "Returning customer orders", unit: "count" },
    returning_customer_rate: { label: "Returning customer rate", unit: "percent" },
    cancelled_orders: { label: "Cancelled orders", unit: "count", upIsGood: false },
    refused_orders: { label: "Refused orders", unit: "count", upIsGood: false },
    all_orders: { label: "All orders placed", unit: "count" },
    reversal_rate: { label: "Cancelled or refused rate", unit: "percent", upIsGood: false },
  },
  items: {
    items_sold: { label: "Items sold", unit: "count" },
    orders: { label: "Orders", unit: "count" },
    gross_sales: { label: "Gross sales", unit: "money" },
    discounts: { label: "Discounts", unit: "money", upIsGood: false },
    net_sales: { label: "Net sales", unit: "money" },
    cost_of_goods: { label: "Cost of goods sold", unit: "money", upIsGood: false },
    gross_profit: { label: "Gross profit", unit: "money" },
    grams_sold: { label: "Weight sold", unit: "grams" },
    items_reversed: { label: "Items cancelled or refused", unit: "count", upIsGood: false },
  },
  sessions: {
    sessions: { label: "Sessions", unit: "count" },
    visitors: { label: "Visitors", unit: "count" },
    pageviews: { label: "Page views", unit: "count" },
    cart_sessions: { label: "Added to cart", unit: "count" },
    checkout_sessions: { label: "Reached checkout", unit: "count" },
    completed_sessions: { label: "Completed checkout", unit: "count" },
    cart_rate: { label: "Added to cart rate", unit: "percent" },
    checkout_rate: { label: "Reached checkout rate", unit: "percent" },
    conversion_rate: { label: "Conversion rate", unit: "percent" },
    checkout_conversion_rate: { label: "Checkout conversion rate", unit: "percent" },
    bounce_rate: { label: "Bounce rate", unit: "percent", upIsGood: false },
  },
};

export const DIMENSIONS: Record<string, string> = {
  day: "Day", week: "Week", month: "Month", hour_of_day: "Hour", day_of_week: "Weekday",
  referrer_source: "Source", marketing_channel: "Marketing channel", payment_method: "Payment method",
  discount_code: "Discount code", customer_type: "Customer type", distance_bucket: "Distance from the store",
  order_name: "Order", order_status: "Order status", product: "Product", option: "Sauce and size",
  product_kind: "Type", product_option: "Product",
  device_type: "Device", country: "Country", region: "Region", city: "City", location: "Location",
  referrer: "Referrer", traffic_source: "Traffic source", landing_page: "Landing page", language: "Language",
};

const WEEKDAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const NAMES: Record<string, Record<string, string>> = {
  payment_method: { cod: "Cash on delivery", instapay: "InstaPay" },
  customer_type: { new: "New customers", returning: "Returning customers" },
  marketing_channel: { meta: "Meta ads", tiktok: "TikTok ads", google: "Google ads", snapchat: "Snapchat ads", direct: "Direct (no link)", "added by team": "Added by the team" },
  referrer_source: { direct: "Direct (no link)", meta: "Meta ads", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", google: "Google", whatsapp: "WhatsApp (added by team)", phone: "Phone (added by team)", other: "Other (added by team)" },
  traffic_source: { direct: "Direct", meta: "Meta ads", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", google: "Google" },
  device_type: { mobile: "Mobile", desktop: "Desktop", tablet: "Tablet" },
  order_status: { new: "New", confirmed: "Confirmed", preparing: "Preparing", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled", refused: "Refused" },
  product_kind: { product: "Products", bundle: "Bundles" },
  language: { en: "English", ar: "Arabic" },
  discount_code: { none: "No code" },
};

export function dimValue(dim: string, v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  if (dim === "day_of_week") return WEEKDAYS[Number(s)] ?? s;
  if (dim === "hour_of_day") return `${s.padStart(2, "0")}:00`;
  return NAMES[dim]?.[s] ?? s;
}
