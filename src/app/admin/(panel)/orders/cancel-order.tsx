"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/admin/state";
import { Notice } from "@/components/admin/form-bits";
import { setOrderStatus } from "./actions";

const REASONS = ["Customer asked to cancel", "Couldn't reach the customer", "Out of stock", "Duplicate order", "Test order"];

/**
 * "Cancel order" with a confirmation dialog and an optional reason.
 * Cancelling puts the order's stock back (admin_set_order_status does it).
 */
export function CancelOrder({ id, number, compact = false }: { id: string; number: number; compact?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setOrderStatus, null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (state?.ok) dialog.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={compact ? "btn btn-ghost btn-sm text-[#a33a52] hover:bg-rose/10" : "btn border-2 border-rose/50 text-[#a33a52] hover:bg-rose/10"}
      >
        Cancel order
      </button>
      {state && !state.ok && <Notice state={state} />}

      <dialog
        ref={dialog}
        className="m-auto w-[min(92vw,420px)] rounded-[24px] text-start border border-line bg-white p-0 text-cocoa shadow-2xl backdrop:bg-cocoa/40"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <form action={action} className="grid gap-4 p-5">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="cancelled" />
          <div className="grid gap-1">
            <h2 className="font-sans text-lg font-semibold text-plum">Cancel order #{number}?</h2>
            <p className="text-sm text-muted">The items go back into stock. The order stays in the list under Cancelled.</p>
          </div>
          <label className="field">
            <span className="label">Reason (optional)</span>
            <input className="input" name="note" list={`cancel-reasons-${id}`} maxLength={300} placeholder="e.g. Customer asked to cancel" />
            <datalist id={`cancel-reasons-${id}`}>
              {REASONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => dialog.current?.close()}>
              Keep the order
            </button>
            <button type="submit" className="btn btn-danger btn-sm" disabled={pending}>
              {pending ? "Cancelling…" : "Yes, cancel it"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
