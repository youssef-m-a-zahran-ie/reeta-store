import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { EmptyState, PageHeader, Section, StatTile } from "@/components/admin/ui";
import { DeleteForm } from "@/components/admin/delete-form";
import { PLATFORM_LABEL } from "@/lib/admin/report";
import { fmtDay } from "@/lib/admin/period";
import { egp } from "@/lib/format";
import { deleteAdSpend } from "./actions";
import { AdSpendForm } from "./ad-spend-form";

export const metadata: Metadata = { title: "Ad spend" };

export default async function AdSpendPage() {
  const { supabase } = await requireAdmin();
  const { data: rows } = await supabase.from("ad_spend").select("*").order("period_start", { ascending: false }).limit(300);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  const month = today.slice(0, 7);

  // Spend per platform for this month (entries that start this month).
  const thisMonth = new Map<string, number>();
  for (const r of rows ?? []) if (r.period_start.startsWith(month)) thisMonth.set(r.platform, (thisMonth.get(r.platform) ?? 0) + r.amount);
  const monthTotal = [...thisMonth.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        eyebrow="Grow"
        title="Ad spend"
        description="Enter what you spent on ads, by day, week or campaign. Reports match it with sales from each platform's links to show the return."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="This month" value={egp(monthTotal)} />
        {["meta", "tiktok", "google"].map((p) => (
          <StatTile key={p} label={PLATFORM_LABEL[p]} value={egp(thisMonth.get(p) ?? 0)} hint="This month" />
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[380px_1fr]">
        <Section title="Add spend">
          <AdSpendForm today={today} />
        </Section>

        <Section title="Entries">
          {!rows?.length ? (
            <EmptyState title="No spend yet">Add what you spend on ads to see the return in Reports.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[15px]">
                <thead>
                  <tr className="text-sm">
                    {["Dates", "Platform", "Campaign", "Amount", ""].map((h, i) => (
                      <th key={i} className="py-2 pe-3 text-start font-display font-semibold text-plum">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="num py-2.5 pe-3 text-sm">
                        {r.period_start === r.period_end ? fmtDay(r.period_start, true) : `${fmtDay(r.period_start)} – ${fmtDay(r.period_end, true)}`}
                      </td>
                      <td className="py-2.5 pe-3">{PLATFORM_LABEL[r.platform] ?? r.platform}</td>
                      <td className="py-2.5 pe-3 text-sm text-muted">{r.campaign ?? "–"}</td>
                      <td className="num py-2.5 pe-3 font-semibold whitespace-nowrap">{egp(r.amount)}</td>
                      <td className="py-2.5">
                        <DeleteForm action={deleteAdSpend} id={r.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
