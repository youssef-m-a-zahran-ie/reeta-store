"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/form-bits";
import { changePassword } from "./actions";

export function PasswordForm() {
  return (
    <ActionForm action={changePassword} resetOnSuccess className="grid gap-4">
      {(state) => (
        <>
          <label className="field">
            <span className="label">New password</span>
            <input className="input" type="password" name="password" autoComplete="new-password" minLength={10} required />
            <span className="hint">At least 10 characters.</span>
            <FieldError state={state} name="password" />
          </label>
          <label className="field">
            <span className="label">Repeat new password</span>
            <input className="input" type="password" name="confirm" autoComplete="new-password" required />
            <FieldError state={state} name="confirm" />
          </label>
          <div>
            <SubmitButton pending="Changing…">Change password</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
