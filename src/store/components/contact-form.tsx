"use client";

import { useState, useTransition } from "react";
import { dict, type Lang } from "../i18n";
import { sendContact } from "../contact-actions";

type Field = "name" | "contact" | "email" | "phone" | "body";

export function ContactForm({ lang }: { lang: Lang }) {
  const t = dict[lang].contact;
  const [f, setF] = useState({ name: "", phone: "", email: "", body: "", website: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<"idle" | "sent" | string>("idle");
  const [pending, start] = useTransition();

  const set = (k: keyof typeof f, v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined, ...(k === "phone" || k === "email" ? { contact: undefined } : {}) }));
  };

  function validate() {
    const e: Partial<Record<Field, string>> = {};
    if (f.name.trim().length < 2) e.name = t.errName;
    if (!f.phone.trim() && !f.email.trim()) e.contact = t.errContact;
    if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = t.errEmail;
    if (f.phone.trim() && f.phone.replace(/\D/g, "").length < 8) e.phone = t.errPhone;
    if (f.body.trim().length < 5) e.body = t.errBody;
    return e;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    start(async () => {
      const res = await sendContact({ ...f, lang });
      if (res.ok) {
        setStatus("sent");
        setF({ name: "", phone: "", email: "", body: "", website: "" });
      } else {
        const map: Record<string, string> = {
          invalid_name: t.errName,
          needs_contact: t.errContact,
          invalid_email: t.errEmail,
          invalid_phone: t.errPhone,
          invalid_body: t.errBody,
          too_many_messages: t.errMany,
        };
        setStatus(map[res.code] ?? t.errGeneric);
      }
    });
  }

  const err = (m?: string) => (m ? <span className="text-sm font-medium text-[#a33a52]">{m}</span> : null);

  if (status === "sent")
    return (
      <div className="grid justify-items-center gap-3 rounded-[28px] bg-blush px-6 py-12 text-center" role="status">
        <span className="mark mark-full size-14 text-plum" aria-hidden="true" />
        <p className="font-display text-2xl font-semibold text-plum">{t.sent}</p>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-[28px] border border-plum/10 bg-white/70 p-5 md:p-7">
      <div className="grid gap-1">
        <h2 className="text-2xl font-semibold">{t.formTitle}</h2>
        <p className="text-cocoa/75">{t.formText}</p>
      </div>
      {/* Hidden from people; bots fill it. */}
      <input type="text" name="website" value={f.website} onChange={(e) => set("website", e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="field">
        <span className="label">{t.name}</span>
        <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={80} aria-invalid={Boolean(errors.name)} />
        {err(errors.name)}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span className="label">{t.phone}</span>
          <input
            className="input"
            value={f.phone}
            onChange={(e) => set("phone", e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            dir="ltr"
            maxLength={30}
            aria-invalid={Boolean(errors.phone || errors.contact)}
          />
          {err(errors.phone)}
        </label>
        <label className="field">
          <span className="label">{t.email}</span>
          <input
            className="input"
            type="email"
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
            dir="ltr"
            maxLength={120}
            aria-invalid={Boolean(errors.email || errors.contact)}
          />
          {err(errors.email)}
        </label>
      </div>
      {errors.contact ? err(errors.contact) : <span className="hint -mt-2">{t.orOne}</span>}
      <label className="field">
        <span className="label">{t.message}</span>
        <textarea className="input" value={f.body} onChange={(e) => set("body", e.target.value)} rows={5} maxLength={2000} aria-invalid={Boolean(errors.body)} />
        {err(errors.body)}
      </label>
      {status !== "idle" && (
        <p role="alert" className="rounded-xl bg-rose/12 px-3.5 py-2 text-sm font-medium text-[#a33a52]">
          {status}
        </p>
      )}
      <button className="btn btn-primary justify-self-start px-7 py-3 text-[17px]" disabled={pending}>
        {pending ? t.sending : t.send}
      </button>
    </form>
  );
}
