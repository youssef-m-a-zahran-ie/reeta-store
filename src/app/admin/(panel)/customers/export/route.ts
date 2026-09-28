import { getAdmin } from "@/lib/admin/guard";
import { loadCustomers } from "@/lib/admin/customers";

function cell(v: string | number | boolean | null) {
  const s = v === null ? "" : String(v);
  // Quote everything; neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return new Response("Not allowed", { status: 403 });
  const rows = await loadCustomers(admin.supabase);
  const head = ["Name", "Phone", "Orders", "Spent (EGP)", "First order", "Last order", "Came from", "Refused", "Flagged", "Notes"];
  const lines = rows.map((r) =>
    [r.name, r.phone, r.orders, r.spend, r.first_order?.slice(0, 10) ?? null, r.last_order?.slice(0, 10) ?? null, r.source, r.refused_count, r.flagged ? "yes" : "no", r.notes]
      .map(cell)
      .join(","),
  );
  // BOM so Excel opens Arabic names correctly.
  const body = "﻿" + [head.map(cell).join(","), ...lines].join("\r\n");
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reeta-customers-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
