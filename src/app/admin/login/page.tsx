import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mark } from "@/components/brand/mark";
import { getAdmin } from "@/lib/admin/guard";
import { LoginPanel } from "./login-panel";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getAdmin()) redirect("/admin");
  const sp = await searchParams;
  const notice =
    sp.link === "expired"
      ? "That link has expired or was already used. Request a new one."
      : sp.denied
        ? "Sign in with an admin account to continue."
        : null;

  return (
    <main className="dot-grid grid min-h-screen place-items-center bg-blush px-4 py-10">
      <div className="grid w-full max-w-[420px] gap-6">
        <div className="grid justify-items-center gap-3 text-plum">
          <Mark className="size-20" />
          <p className="font-display text-3xl font-semibold tracking-[0.07em]">REETA</p>
          <span className="eyebrow">Admin</span>
        </div>
        <LoginPanel notice={notice} />
      </div>
    </main>
  );
}
