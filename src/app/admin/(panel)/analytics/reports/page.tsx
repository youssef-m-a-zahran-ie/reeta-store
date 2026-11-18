import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { CATEGORIES, REPORTS } from "@/lib/analytics/registry";

export const metadata: Metadata = { title: "Analytics reports" };

export default async function ReportsListPage({ searchParams }: PageProps<"/admin/analytics/reports">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const cat = typeof sp.category === "string" ? sp.category : "";
  const list = REPORTS.filter((r) => (!q || r.title.toLowerCase().includes(q)) && (!cat || r.category === cat));

  return (
    <>
      <PageHeader eyebrow="Grow" title="Reports" description="Every report behind the Analytics page. Open one to change the dates, pick a number to chart, or download it as CSV." actions={<Link href="/admin/analytics" className="btn btn-secondary">Back to Analytics</Link>} />
      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <div className="grid gap-1">
          <label htmlFor="rq" className="sr-only">Search reports</label>
          <input id="rq" name="q" defaultValue={q} placeholder="Search reports" className="input w-64" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="rc" className="sr-only">Category</label>
          <select id="rc" name="category" defaultValue={cat} className="input w-auto">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary">Search</button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-[14px]">
          <thead className="bg-cream text-left">
            <tr><th scope="col" className="px-4 py-2.5 font-semibold">Name</th><th scope="col" className="px-4 py-2.5 font-semibold">Category</th></tr>
          </thead>
          <tbody>
            {CATEGORIES.flatMap((c) => list.filter((r) => r.category === c)).map((r) => (
              <tr key={r.slug} className="border-t border-line/70 hover:bg-page/70">
                <td className="px-4 py-2.5"><Link href={`/admin/analytics/reports/${r.slug}`} className="font-medium text-plum underline-offset-4 hover:underline">{r.title}</Link></td>
                <td className="px-4 py-2.5 text-muted">{r.category}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={2} className="px-4 py-8 text-center text-muted">No report matches that search.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">{list.length} of {REPORTS.length} reports. Ad spend and return on ads are in <Link href="/admin/reports" className="underline underline-offset-2">Reports under Grow</Link>.</p>
    </>
  );
}
