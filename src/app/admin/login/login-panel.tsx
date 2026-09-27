"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/form-bits";
import { createAdminAccount, sendPasswordReset, signIn } from "./actions";

type Mode = "signin" | "setup" | "reset";

export function LoginPanel({ notice }: { notice: string | null }) {
  const [mode, setMode] = useState<Mode>("signin");

  return (
    <div className="card grid gap-5 p-6 shadow-[0_24px_48px_-28px_rgb(58_36_32/.45)] md:p-7">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">
          {mode === "signin" ? "Sign in" : mode === "setup" ? "Set up your admin account" : "Reset your password"}
        </h1>
        <p className="text-sm text-muted">
          {mode === "signin"
            ? "Manage products, stock and orders."
            : mode === "setup"
              ? "First time here? Choose a password. We'll email you a link to confirm."
              : "We'll email you a link to choose a new password."}
        </p>
      </div>

      {notice && mode === "signin" && (
        <p className="rounded-xl bg-honey/25 px-3.5 py-2 text-sm font-medium text-cocoa">{notice}</p>
      )}

      {mode === "signin" && (
        <ActionForm action={signIn} className="grid gap-4">
          {(state) => (
            <>
              <label className="field">
                <span className="label">Email</span>
                <input className="input" type="email" name="email" autoComplete="email" required />
                <FieldError state={state} name="email" />
              </label>
              <label className="field">
                <span className="label">Password</span>
                <input className="input" type="password" name="password" autoComplete="current-password" required />
                <FieldError state={state} name="password" />
              </label>
              <SubmitButton pending="Signing in…">Sign in</SubmitButton>
            </>
          )}
        </ActionForm>
      )}

      {mode === "setup" && (
        <ActionForm action={createAdminAccount} className="grid gap-4">
          {(state) => (
            <>
              <label className="field">
                <span className="label">Admin email</span>
                <input className="input" type="email" name="email" autoComplete="email" required />
                <FieldError state={state} name="email" />
              </label>
              <label className="field">
                <span className="label">Password</span>
                <input className="input" type="password" name="password" autoComplete="new-password" minLength={10} required />
                <span className="hint">At least 10 characters.</span>
                <FieldError state={state} name="password" />
              </label>
              <label className="field">
                <span className="label">Repeat password</span>
                <input className="input" type="password" name="confirm" autoComplete="new-password" required />
                <FieldError state={state} name="confirm" />
              </label>
              <SubmitButton pending="Creating…">Create account</SubmitButton>
            </>
          )}
        </ActionForm>
      )}

      {mode === "reset" && (
        <ActionForm action={sendPasswordReset} className="grid gap-4">
          {(state) => (
            <>
              <label className="field">
                <span className="label">Admin email</span>
                <input className="input" type="email" name="email" autoComplete="email" required />
                <FieldError state={state} name="email" />
              </label>
              <SubmitButton pending="Sending…">Send reset link</SubmitButton>
            </>
          )}
        </ActionForm>
      )}

      <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4 text-sm">
        {mode !== "signin" ? (
          <button type="button" className="font-semibold text-plum underline-offset-4 hover:underline" onClick={() => setMode("signin")}>
            Back to sign in
          </button>
        ) : (
          <>
            <button type="button" className="font-semibold text-plum underline-offset-4 hover:underline" onClick={() => setMode("setup")}>
              First time? Set up account
            </button>
            <button type="button" className="text-muted underline-offset-4 hover:underline" onClick={() => setMode("reset")}>
              Forgot password
            </button>
          </>
        )}
      </div>
    </div>
  );
}
