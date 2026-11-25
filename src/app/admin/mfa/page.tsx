import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mark } from "@/components/brand/mark";
import { getAdmin, getAdminCandidate } from "@/lib/admin/guard";
import { EnrollPanel, VerifyPanel } from "./mfa-panel";

export const metadata: Metadata = { title: "Verify it's you", robots: { index: false } };

export default async function MfaPage() {
  if (await getAdmin()) redirect("/admin");
  const candidate = await getAdminCandidate();
  if (!candidate) redirect("/admin/login");

  const { data } = await candidate.supabase.auth.mfa.listFactors();
  const factor = data?.totp?.[0];

  return (
    <main className="dot-grid grid min-h-screen place-items-center bg-blush px-4 py-10">
      <div className="grid w-full max-w-[420px] gap-6">
        <div className="grid justify-items-center gap-3 text-plum">
          <Mark className="size-20" />
          <p className="font-wordmark text-3xl font-semibold tracking-[0.07em]">REETA</p>
          <span className="eyebrow">Admin</span>
        </div>
        {factor ? <VerifyPanel factorId={factor.id} /> : <EnrollPanel />}
      </div>
    </main>
  );
}
