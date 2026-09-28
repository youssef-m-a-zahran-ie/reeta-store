import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader, Section } from "@/components/admin/ui";
import { ActionForm, SubmitButton, Toggle } from "@/components/admin/form-bits";
import { DeliverySettings } from "./delivery-map";
import { TrackingForm } from "./tracking-form";
import { saveContact, saveNotifications, savePayments, saveStore } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data: s } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (!s) return null;

  return (
    <>
      <PageHeader eyebrow="Site" title="Settings" description="Delivery pricing, payment details, contact links and whether the store is taking orders." />

      <nav className="mb-6 flex flex-wrap gap-1.5 text-sm" aria-label="Settings sections">
        {[
          ["#delivery", "Delivery"],
          ["#payments", "Payments"],
          ["#store", "Store status"],
          ["#contact", "Contact"],
          ["#notifications", "Order emails"],
          ["#tracking", "Tracking"],
        ].map(([h, l]) => (
          <a key={h} href={h} className="rounded-full px-4 py-1.5 font-semibold text-plum hover:bg-blush">
            {l}
          </a>
        ))}
      </nav>

      <div className="grid gap-5">
        <Section
          title="Delivery pricing"
          description="Fee = distance from the store × price per km, rounded up, never below the minimum. Free-delivery offers come from Discounts."
        >
          <div id="delivery" className="scroll-mt-24" />
          <DeliverySettings
            initial={{
              lat: s.store_lat,
              lng: s.store_lng,
              perKm: s.fee_per_km,
              min: s.min_shipping_fee,
              factor: s.distance_factor,
              round: s.fee_round_to,
            }}
          />
        </Section>

        <Section title="Payments" description="Shown to customers who pick InstaPay, on their order page.">
          <div id="payments" className="scroll-mt-24" />
          <ActionForm action={savePayments} className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">InstaPay number or address</span>
              <input className="input" name="instapay_handle" defaultValue={s.instapay_handle ?? ""} dir="ltr" placeholder="+2010… or name@instapay" />
            </label>
            <label className="field">
              <span className="label">Name on the account (optional)</span>
              <input className="input" name="instapay_name" defaultValue={s.instapay_name ?? ""} />
              <span className="hint">Helps customers check they&apos;re sending to the right person.</span>
            </label>
            <label className="field sm:col-span-2">
              <span className="label">InstaPay payment link</span>
              <input className="input" name="instapay_link" defaultValue={s.instapay_link ?? ""} dir="ltr" placeholder="https://ipn.eg/S/…" />
              <span className="hint">Customers who pick InstaPay get a “Pay now” button that opens this link.</span>
            </label>
            <div className="sm:col-span-2">
              <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section title="Store status" description="Pause orders for holidays or busy days, and set the bar at the top of the site.">
          <div id="store" className="scroll-mt-24" />
          <ActionForm action={saveStore} className="grid gap-5">
            <div className="grid gap-3 rounded-2xl border border-line p-4">
              <Toggle name="orders_paused" defaultChecked={s.orders_paused} label="Pause orders (people can browse but not check out)" />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field">
                  <span className="hint">Message (English)</span>
                  <input className="input" name="paused_message_en" defaultValue={s.paused_message_en ?? ""} placeholder="We're back on Sunday." />
                </label>
                <label className="field">
                  <span className="hint">Message (Arabic)</span>
                  <input className="input" name="paused_message_ar" defaultValue={s.paused_message_ar ?? ""} dir="rtl" placeholder="راجعين يوم الأحد." />
                </label>
              </div>
            </div>
            <div className="grid gap-3 rounded-2xl border border-line p-4">
              <Toggle name="announcement_visible" defaultChecked={s.announcement_visible} label="Show the announcement bar" />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field">
                  <span className="hint">Announcement (English)</span>
                  <input className="input" name="announcement_en" defaultValue={s.announcement_en ?? ""} />
                </label>
                <label className="field">
                  <span className="hint">Announcement (Arabic)</span>
                  <input className="input" name="announcement_ar" defaultValue={s.announcement_ar ?? ""} dir="rtl" />
                </label>
              </div>
            </div>
            <div>
              <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section title="Contact and social" description="Used on the Contact page, the footer and the WhatsApp button.">
          <div id="contact" className="scroll-mt-24" />
          <ActionForm action={saveContact} className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">WhatsApp number</span>
              <input className="input" name="whatsapp_number" defaultValue={s.whatsapp_number ?? ""} dir="ltr" />
            </label>
            <div className="flex items-end pb-2">
              <Toggle name="whatsapp_button" defaultChecked={s.whatsapp_button} label="Floating WhatsApp button" />
            </div>
            <label className="field">
              <span className="label">Instagram link</span>
              <input className="input" name="instagram_url" defaultValue={s.instagram_url ?? ""} dir="ltr" />
            </label>
            <label className="field">
              <span className="label">TikTok link</span>
              <input className="input" name="tiktok_url" defaultValue={s.tiktok_url ?? ""} dir="ltr" />
            </label>
            <label className="field">
              <span className="label">Facebook link</span>
              <input className="input" name="facebook_url" defaultValue={s.facebook_url ?? ""} dir="ltr" />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section
          title="Order emails"
          description="Each new order is emailed here. On the free email plan, only the email that owns the Resend account receives them until the store has its own domain."
        >
          <div id="notifications" className="scroll-mt-24" />
          <ActionForm action={saveNotifications} className="grid gap-3">
            <label className="field">
              <span className="label">Send to</span>
              <input className="input" name="notify_emails" defaultValue={(s.notify_emails ?? []).join(", ")} dir="ltr" />
            </label>
            <div>
              <SubmitButton className="btn btn-primary btn-sm">Save</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section title="Tracking pixels" description="Connect Meta, TikTok and Google Analytics so ads can learn who buys.">
          <div id="tracking" className="scroll-mt-24" />
          <TrackingForm values={{ meta_pixel_id: s.meta_pixel_id, tiktok_pixel_id: s.tiktok_pixel_id, ga4_id: s.ga4_id }} />
        </Section>
      </div>
    </>
  );
}
