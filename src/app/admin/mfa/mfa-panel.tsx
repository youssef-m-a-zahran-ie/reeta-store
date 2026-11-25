"use client";

import { useState, useTransition } from "react";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/form-bits";
import { signOut } from "../login/actions";
import { startEnrollment, verifyCode } from "./actions";

function CodeForm({ factorId, button }: { factorId: string; button: string }) {
  return (
    <ActionForm action={verifyCode} className="grid gap-4">
      {(state) => (
        <>
          <input type="hidden" name="factorId" value={factorId} />
          <label className="field">
            <span className="label">6-digit code</span>
            <input
              className="input text-center text-2xl tracking-[0.4em]"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              dir="ltr"
              autoFocus
              required
            />
            <FieldError state={state} name="code" />
          </label>
          <SubmitButton pending="Checking…">{button}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

function SignOutLink() {
  return (
    <form action={signOut} className="border-t border-line pt-4 text-sm">
      <button type="submit" className="text-muted underline-offset-4 hover:underline">
        Sign in with a different account
      </button>
    </form>
  );
}

/** The account already has 2FA: just ask for the code. */
export function VerifyPanel({ factorId }: { factorId: string }) {
  return (
    <div className="card grid gap-5 p-6 shadow-[0_24px_48px_-28px_rgb(58_36_32/.45)] md:p-7">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Enter your code</h1>
        <p className="text-sm text-muted">Open your authenticator app and type the 6-digit code for Reeta Admin.</p>
      </div>
      <CodeForm factorId={factorId} button="Continue" />
      <SignOutLink />
    </div>
  );
}

/** First time: connect an authenticator app, then confirm with a code. */
export function EnrollPanel() {
  const [pending, start] = useTransition();
  const [enrollment, setEnrollment] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function begin() {
    setError(null);
    start(async () => {
      const r = await startEnrollment();
      if ("error" in r) setError(r.error);
      else setEnrollment(r);
    });
  }

  return (
    <div className="card grid gap-5 p-6 shadow-[0_24px_48px_-28px_rgb(58_36_32/.45)] md:p-7">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Turn on 2-step sign in</h1>
        <p className="text-sm text-muted">
          Every sign in will also ask for a 6-digit code from your phone, so a stolen password isn&apos;t enough.
        </p>
      </div>

      {!enrollment ? (
        <div className="grid gap-4">
          <ol className="grid list-decimal gap-1.5 ps-5 text-sm text-cocoa">
            <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator or Authy).</li>
            <li>Tap the button below and scan the code with the app.</li>
            <li>Type the 6 digits the app shows.</li>
          </ol>
          {error && <p role="alert" className="rounded-xl bg-rose/12 px-3.5 py-2 text-sm font-medium text-[#a33a52]">{error}</p>}
          <button type="button" className="btn btn-primary" onClick={begin} disabled={pending}>
            {pending ? "Preparing…" : "Set up"}
          </button>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid justify-items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qr} alt="QR code to scan with your authenticator app" width={192} height={192} className="size-48 rounded-2xl border border-line bg-white p-2" />
            <details className="w-full text-sm">
              <summary className="cursor-pointer text-center text-muted underline-offset-4 hover:underline">Can&apos;t scan? Type the key instead</summary>
              <p className="mt-2 rounded-xl bg-page px-3 py-2 text-center font-mono text-sm break-all select-all" dir="ltr">{enrollment.secret}</p>
            </details>
          </div>
          <p className="rounded-xl bg-honey/25 px-3.5 py-2 text-sm font-medium text-cocoa">
            Add it to a second phone too if you can (scan this same code now). That&apos;s your backup if one phone is lost.
          </p>
          <CodeForm factorId={enrollment.factorId} button="Turn on and continue" />
        </div>
      )}
      <SignOutLink />
    </div>
  );
}
