import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { LiveView, type Live } from "./live-view";

export const metadata: Metadata = { title: "Live view" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("analytics_live");
  return (
    <>
      <PageHeader
        eyebrow="Grow"
        title="Live view"
        description="What is happening on the store right now. This page refreshes itself every few seconds."
        actions={<Link href="/admin/analytics" className="btn btn-secondary">Back to Analytics</Link>}
      />
      {data ? <LiveView data={data as unknown as Live} /> : <p className="text-muted">Couldn&apos;t load the live numbers. Refresh the page.</p>}
    </>
  );
}
