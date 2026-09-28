import { requireAdmin } from "@/lib/admin/guard";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const { user, supabase } = await requireAdmin();
  const [{ count: orders }, { count: inbox }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <AdminNav email={user.email ?? ""} counts={{ orders: orders ?? 0, inbox: inbox ?? 0 }} />
      <main className="min-w-0 px-4 pt-6 pb-16 md:px-10 md:pt-10">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
