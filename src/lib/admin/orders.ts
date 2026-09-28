export const ORDER_STATUSES = ["new", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled", "refused"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-honey text-cocoa" },
  confirmed: { label: "Confirmed", className: "bg-blush text-cocoa" },
  preparing: { label: "Preparing", className: "bg-plum text-blush" },
  out_for_delivery: { label: "Out for delivery", className: "bg-toffee text-white" },
  delivered: { label: "Delivered", className: "bg-sage text-white" },
  cancelled: { label: "Cancelled", className: "bg-rose text-white" },
  refused: { label: "Refused at door", className: "bg-cocoa text-cream ring-[1.5px] ring-rose" },
};

/** The usual next step for each status. */
export const NEXT_STEP: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "confirmed",
  confirmed: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "delivered",
};

export const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  new: "Confirm order",
  confirmed: "Start preparing",
  preparing: "Send out for delivery",
  out_for_delivery: "Mark delivered",
};
