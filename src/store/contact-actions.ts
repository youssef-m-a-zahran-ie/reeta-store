"use server";

import { createClient as createSupabase } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export type ContactResult = { ok: true } | { ok: false; code: string };

export async function sendContact(input: { name: string; phone: string; email: string; body: string; lang: "en" | "ar"; website: string }): Promise<ContactResult> {
  const db = createSupabase<Database>(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.rpc("store_contact", {
    p: {
      name: String(input.name ?? "").slice(0, 80),
      phone: String(input.phone ?? "").slice(0, 30),
      email: String(input.email ?? "").slice(0, 120),
      body: String(input.body ?? "").slice(0, 2000),
      lang: input.lang === "ar" ? "ar" : "en",
      website: String(input.website ?? ""),
    },
  });
  if (error) return { ok: false, code: error.message || "generic" };
  return { ok: true };
}
