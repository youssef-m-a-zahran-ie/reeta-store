import { requireAdmin } from "@/lib/admin/guard";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireAdmin();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <AdminNav email={user.email ?? ""} />
      <main className="min-w-0 px-4 pt-6 pb-16 md:px-10 md:pt-10">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
