import { getAdmin } from "@/lib/admin/guard";
import { runReport } from "@/lib/analytics/engine";
import { DIMENSIONS, dimValue, METRICS } from "@/lib/analytics/metrics";
import { reportBySlug } from "@/lib/analytics/registry";
import { resolveRange } from "@/lib/analytics/range";

function cell(v: string | number | null | undefined) {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // keep spreadsheets from running a typed formula
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: Request, ctx: RouteContext<"/admin/analytics/reports/[slug]/export">) {
  const admin = await getAdmin();
  if (!admin) return new Response("Not allowed", { status: 403 });
  const def = reportBySlug((await ctx.params).slug);
  if (!def || def.chart === "cohort") return new Response("Not found", { status: 404 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const range = resolveRange(sp, "30d");
  const res = await runReport(admin.supabase, { ...def, limit: 1000 }, { ...range, cmp: "none", prevFrom: null, prevTo: null });

  const dims = res.timeDim ? [res.timeDim, ...def.dims.slice(1)] : def.dims;
  const M = METRICS[def.schema];
  const head = [...dims.map((d) => DIMENSIONS[d] ?? d), ...def.metrics.map((m) => M[m]?.label ?? m)];
  const rows = res.cur.rows.map((r) => [
    ...dims.map((d) => (["day", "week", "month"].includes(d) ? r[d] : dimValue(d, r[d]))),
    ...def.metrics.map((m) => r[m]),
  ]);
  const body = "﻿" + [head.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${def.slug}-${range.from}-to-${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
