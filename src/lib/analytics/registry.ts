import type { Schema } from "./metrics";

export const CATEGORIES = ["Sales", "Customers", "Behavior", "Marketing", "Finances", "Orders"] as const;
export type Category = (typeof CATEGORIES)[number];
export type ChartType = "line" | "bar" | "donut" | "heatmap" | "table" | "list" | "funnel" | "cohort" | "breakdown";

export type ReportDef = {
  slug: string;
  title: string;
  category: Category;
  schema: Schema;
  metrics: string[];
  dims: string[];
  chart: ChartType;
  /** the metric the chart draws (first of `metrics` when omitted) */
  primary?: string;
  order?: string;
  dir?: "asc" | "desc";
  limit?: number;
  /** the table shows every metric; the chart only the primary one */
  note?: string;
  /** profit and margin need a cost on every product */
  needsCost?: boolean;
};

const SALES_COLS = ["orders", "gross_sales", "discounts", "sales_reversals", "net_sales", "shipping_charges", "total_sales"];
const series = (slug: string, title: string, category: Category, schema: Schema, metric: string, extra: Partial<ReportDef> = {}): ReportDef => ({
  slug, title, category, schema, metrics: [metric, ...(extra.metrics ?? [])], dims: ["day"], chart: "line", ...extra,
});

export const REPORTS: ReportDef[] = [
  // ---- Sales
  { slug: "total-sales-over-time", title: "Total sales over time", category: "Sales", schema: "sales", metrics: ["total_sales", ...SALES_COLS.filter((m) => m !== "total_sales")], dims: ["day"], chart: "line" },
  series("gross-sales-over-time", "Gross sales over time", "Sales", "sales", "gross_sales"),
  series("net-sales-over-time", "Net sales over time", "Sales", "sales", "net_sales"),
  series("orders-over-time", "Orders over time", "Sales", "sales", "orders", { metrics: ["items_ordered", "average_order_value"] }),
  series("average-order-value-over-time", "Average order value over time", "Sales", "sales", "average_order_value", { metrics: ["orders"] }),
  series("items-ordered-over-time", "Items ordered over time", "Sales", "sales", "items_ordered"),
  series("sales-reversals-over-time", "Cancelled and refused sales over time", "Sales", "sales", "sales_reversals", { metrics: ["cancelled_orders", "refused_orders", "reversal_rate"], note: "Orders that were cancelled or refused. They never count as sales." }),
  { slug: "total-sales-breakdown", title: "Total sales breakdown", category: "Sales", schema: "sales", metrics: ["gross_sales", "discounts", "sales_reversals", "net_sales", "shipping_charges", "total_sales"], dims: [], chart: "breakdown" },
  { slug: "total-sales-by-product", title: "Total sales by product", category: "Sales", schema: "items", metrics: ["net_sales", "items_sold", "orders", "gross_sales", "discounts", "grams_sold"], dims: ["product"], chart: "bar", limit: 50, note: "An order's discount is shared between its items by value." },
  { slug: "total-sales-by-product-option", title: "Total sales by sauce and size", category: "Sales", schema: "items", metrics: ["net_sales", "items_sold", "orders", "gross_sales", "discounts", "grams_sold"], dims: ["product_option"], chart: "bar", limit: 50 },
  { slug: "units-sold-by-product", title: "Items sold by product", category: "Sales", schema: "items", metrics: ["items_sold", "net_sales", "grams_sold"], dims: ["product"], chart: "bar", limit: 50 },
  { slug: "sales-by-product-type", title: "Sales: bundles and single products", category: "Sales", schema: "items", metrics: ["net_sales", "items_sold", "orders"], dims: ["product_kind"], chart: "donut" },
  { slug: "total-sales-by-marketing-channel", title: "Total sales by marketing channel", category: "Marketing", schema: "sales", metrics: ["total_sales", "orders", "average_order_value", "new_customers"], dims: ["marketing_channel"], chart: "donut", note: "Ad platforms are matched from the link tags (utm_source) on each order." },
  { slug: "total-sales-by-source", title: "Total sales by source", category: "Marketing", schema: "sales", metrics: ["total_sales", "orders", "average_order_value"], dims: ["referrer_source"], chart: "bar", limit: 30 },
  { slug: "sales-by-discount-code", title: "Sales by discount code", category: "Sales", schema: "sales", metrics: ["orders", "discounts", "net_sales", "total_sales"], dims: ["discount_code"], chart: "bar", order: "orders", limit: 30 },
  { slug: "sales-by-payment-method", title: "Sales by payment method", category: "Finances", schema: "sales", metrics: ["total_sales", "orders", "average_order_value"], dims: ["payment_method"], chart: "donut" },
  { slug: "sales-by-distance", title: "Sales by distance from the store", category: "Orders", schema: "sales", metrics: ["orders", "total_sales", "shipping_charges", "average_order_value"], dims: ["distance_bucket"], chart: "bar" },
  { slug: "weekly-sales-patterns", title: "Weekly sales patterns", category: "Sales", schema: "sales", metrics: ["orders"], dims: ["day_of_week", "hour_of_day"], chart: "heatmap", limit: 200, note: "Orders by weekday and hour, Cairo time." },
  { slug: "sales-by-order", title: "Total sales by order", category: "Orders", schema: "sales", metrics: ["total_sales", "gross_sales", "discounts", "shipping_charges"], dims: ["day", "order_name", "order_status"], chart: "table", order: "day", dir: "desc", limit: 500 },
  { slug: "orders-by-status", title: "Orders by status", category: "Orders", schema: "sales", metrics: ["all_orders", "total_sales"], dims: ["order_status"], chart: "bar", order: "all_orders" },
  // ---- Customers
  series("new-customers-over-time", "New customers over time", "Customers", "sales", "new_customers", { metrics: ["returning_orders"] }),
  { slug: "new-vs-returning-customers", title: "New vs returning customers", category: "Customers", schema: "sales", metrics: ["orders", "total_sales", "average_order_value"], dims: ["customer_type"], chart: "donut" },
  series("returning-customer-rate-over-time", "Returning customer rate over time", "Customers", "sales", "returning_customer_rate", { metrics: ["orders", "returning_orders"] }),
  { slug: "customer-cohort-analysis", title: "Customer cohort analysis", category: "Customers", schema: "sales", metrics: ["orders"], dims: [], chart: "cohort", note: "Of the customers who first ordered in a month, how many ordered again. Month 0 is the same month." },
  // ---- Behavior
  series("sessions-over-time", "Sessions over time", "Behavior", "sessions", "sessions", { metrics: ["visitors", "pageviews", "bounce_rate"] }),
  series("visitors-over-time", "Visitors over time", "Behavior", "sessions", "visitors"),
  series("bounce-rate-over-time", "Bounce rate over time", "Behavior", "sessions", "bounce_rate", { metrics: ["sessions"], note: "A bounce is a visit that looked at one page only." }),
  series("conversion-rate-over-time", "Conversion rate over time", "Behavior", "sessions", "conversion_rate", { metrics: ["sessions", "completed_sessions"] }),
  series("checkout-conversion-rate-over-time", "Checkout conversion rate over time", "Behavior", "sessions", "checkout_conversion_rate", { metrics: ["checkout_sessions", "completed_sessions"] }),
  { slug: "conversion-rate-breakdown", title: "Conversion rate breakdown", category: "Behavior", schema: "sessions", metrics: ["sessions", "cart_sessions", "checkout_sessions", "completed_sessions"], dims: [], chart: "funnel" },
  { slug: "sessions-by-device-type", title: "Sessions by device type", category: "Behavior", schema: "sessions", metrics: ["sessions", "conversion_rate", "bounce_rate"], dims: ["device_type"], chart: "donut" },
  { slug: "sessions-by-location", title: "Sessions by location", category: "Behavior", schema: "sessions", metrics: ["sessions", "conversion_rate", "bounce_rate"], dims: ["location"], chart: "bar", limit: 30 },
  { slug: "sessions-by-source", title: "Sessions by traffic source", category: "Acquisition" as Category, schema: "sessions", metrics: ["sessions", "cart_rate", "conversion_rate"], dims: ["traffic_source"], chart: "bar", limit: 30 },
  { slug: "sessions-by-landing-page", title: "Sessions by landing page", category: "Behavior", schema: "sessions", metrics: ["sessions", "bounce_rate", "conversion_rate"], dims: ["landing_page"], chart: "list", limit: 30 },
  { slug: "sessions-by-language", title: "Sessions by language", category: "Behavior", schema: "sessions", metrics: ["sessions", "conversion_rate"], dims: ["language"], chart: "donut" },
  // ---- Finances
  series("gross-profit-over-time", "Gross profit over time", "Finances", "sales", "gross_profit", { metrics: ["net_sales", "cost_of_goods", "gross_margin"], needsCost: true }),
  { slug: "gross-profit-by-product", title: "Gross profit by product", category: "Finances", schema: "items", metrics: ["gross_profit", "net_sales", "cost_of_goods", "items_sold"], dims: ["product"], chart: "bar", limit: 50, needsCost: true },
];

// "Acquisition" is a Shopify category with one report here; fold it into Marketing so the list stays tidy.
for (const r of REPORTS) if ((r.category as string) === "Acquisition") r.category = "Marketing";

export const reportBySlug = (slug: string) => REPORTS.find((r) => r.slug === slug);
