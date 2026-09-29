import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/form-bits";
import { DeleteForm } from "@/components/admin/delete-form";
import { dateTime } from "@/lib/format";
import { deleteMessage, markAllRead, markReplied, setMessageRead } from "./actions";

export const metadata: Metadata = { title: "Inbox" };

function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (/^01[0125]\d{8}$/.test(d)) return `2${d}`;
  return d;
}

export default async function InboxPage({ searchParams }: PageProps<"/admin/inbox">) {
  const sp = await searchParams;
  const show = sp.show === "all" ? "all" : "unread";
  const { supabase } = await requireAdmin();
  let q = supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(200);
  if (show === "unread") q = q.eq("is_read", false);
  const [{ data: messages }, { count: unread }] = await Promise.all([
    q,
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Site"
        title="Inbox"
        description="Messages from the Contact page. Each one is also emailed to the order-email list."
        actions={
          (unread ?? 0) > 0 ? (
            <ActionForm action={markAllRead} hideNotice>
              <SubmitButton className="btn btn-secondary" pending="Marking…">
                Mark all read
              </SubmitButton>
            </ActionForm>
          ) : undefined
        }
      />
      <nav className="mb-5 flex gap-1.5" aria-label="Filter">
        {(
          [
            ["unread", `Unread · ${unread ?? 0}`],
            ["all", "All"],
          ] as const
        ).map(([k, l]) => (
          <Link
            key={k}
            href={`/admin/inbox?show=${k}`}
            aria-current={k === show ? "page" : undefined}
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-plum hover:bg-blush aria-[current=page]:bg-plum aria-[current=page]:text-blush"
          >
            {l}
          </Link>
        ))}
      </nav>

      {!messages?.length ? (
        <EmptyState title={show === "unread" ? "Nothing new" : "No messages yet"}>
          {show === "unread" ? "You're all caught up." : "When someone writes from the Contact page, it shows up here."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {messages.map((m) => {
            const firstName = m.name.split(" ")[0];
            const reply =
              m.lang === "ar" ? `أهلًا ${firstName}، معاك ريتا 💜 بخصوص رسالتك: ` : `Hi ${firstName}, this is Reeta, about your message: `;
            return (
              <li key={m.id} className={`card grid gap-3 p-5 ${m.is_read ? "" : "border-plum/40 shadow-[inset_4px_0_0_var(--plum)]"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-medium text-plum">{m.name}</span>
                      {!m.is_read && <span className="chip bg-honey text-cocoa">New</span>}
                      {m.replied_at && <span className="chip bg-sage/15 text-[#56633a]">Replied</span>}
                      <span className="chip bg-cream text-cocoa">{m.lang === "ar" ? "Arabic" : "English"}</span>
                    </span>
                    <span className="num text-sm text-muted" dir="ltr">
                      {[m.phone, m.email].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <span className="num text-xs text-muted">{dateTime.format(new Date(m.created_at))}</span>
                </div>
                <p className="whitespace-pre-line text-[15px] leading-relaxed" dir="auto">
                  {m.body}
                </p>
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {m.phone && (
                    <a
                      href={`https://wa.me/${waNumber(m.phone)}?text=${encodeURIComponent(reply)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm border-2 border-sage text-[#56633a] hover:bg-sage hover:text-white"
                    >
                      Reply on WhatsApp
                    </a>
                  )}
                  {m.email && (
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent("Reeta")}`} className="btn btn-secondary btn-sm">
                      Reply by email
                    </a>
                  )}
                  {!m.replied_at && (
                    <ActionForm action={markReplied} hideNotice>
                      <input type="hidden" name="id" value={m.id} />
                      <SubmitButton className="btn btn-ghost btn-sm">Mark replied</SubmitButton>
                    </ActionForm>
                  )}
                  <ActionForm action={setMessageRead} hideNotice>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="read" value={m.is_read ? "0" : "1"} />
                    <SubmitButton className="btn btn-ghost btn-sm">{m.is_read ? "Mark unread" : "Mark read"}</SubmitButton>
                  </ActionForm>
                  <div className="ms-auto">
                    <DeleteForm action={deleteMessage} id={m.id} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
