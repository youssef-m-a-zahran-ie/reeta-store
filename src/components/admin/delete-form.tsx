"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/admin/state";
import { Notice } from "./form-bits";

/** A delete button with an inline "are you sure" step. */
export function DeleteForm({
  action,
  id,
  label = "Delete",
  confirmText = "Yes, delete",
  question = "Delete this? It can't be undone.",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  id: string;
  label?: string;
  confirmText?: string;
  question?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="grid justify-items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <details className="relative">
        <summary className="btn btn-ghost btn-sm list-none text-rose [&::-webkit-details-marker]:hidden">{label}</summary>
        <div className="absolute end-0 z-20 mt-2 grid w-64 gap-2 rounded-2xl border border-line bg-white p-3 text-sm shadow-xl">
          <p className="text-cocoa">{question}</p>
          <button type="submit" className="btn btn-danger btn-sm" disabled={pending}>
            {pending ? "Deleting…" : confirmText}
          </button>
        </div>
      </details>
      {state && !state.ok && <Notice state={state} />}
    </form>
  );
}
