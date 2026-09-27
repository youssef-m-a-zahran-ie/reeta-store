"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/admin/state";
import { BRAND_COLORS } from "./ui";

/** Pending state of the surrounding ActionForm (it submits manually, so useFormStatus alone isn't enough). */
const PendingContext = createContext(false);

export function SubmitButton({
  children,
  pending,
  className = "btn btn-primary",
  name,
  value,
}: {
  children: ReactNode;
  pending?: ReactNode;
  className?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const ctxPending = useContext(PendingContext);
  const isPending = status.pending || ctxPending;
  return (
    <button type="submit" className={className} disabled={isPending} name={name} value={value}>
      {isPending ? (pending ?? "Saving…") : children}
    </button>
  );
}

export function Notice({ state }: { state: ActionState }) {
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-xl px-3.5 py-2 text-sm font-medium ${state.ok ? "bg-sage/15 text-[#4d5a33]" : "bg-rose/12 text-[#a33a52]"}`}
    >
      {state.message}
    </p>
  );
}

/**
 * A form bound to a server action, with a status message.
 * `resetOnSuccess` clears the fields after a successful save (for "add" forms).
 */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
  hideNotice = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  hideNotice?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  // Submit manually so React doesn't clear the fields when the save fails.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(fd));
  }
  return (
    <PendingContext.Provider value={pending}>
      <form ref={ref} onSubmit={onSubmit} className={className} aria-busy={pending}>
        {typeof children === "function" ? children(state) : children}
        {!hideNotice && <Notice state={state} />}
      </form>
    </PendingContext.Provider>
  );
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const msg = state?.errors?.[name];
  if (!msg) return null;
  return <span className="text-xs font-medium text-[#a33a52]">{msg}</span>;
}

/** Palette-only color picker (brand rule: no colors outside the palette). */
export function ColorPicker({
  name,
  defaultValue,
  allowNone = false,
  noneLabel = "None",
}: {
  name: string;
  defaultValue?: string | null;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {allowNone && (
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-plum has-[:checked]:bg-blush">
          <input type="radio" name={name} value="" defaultChecked={!defaultValue} className="sr-only" />
          <span className="size-5 rounded-full border-[1.5px] border-dashed border-plum/40" />
          {noneLabel}
        </label>
      )}
      {BRAND_COLORS.map((c) => (
        <label
          key={c.value}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-plum has-[:checked]:bg-blush has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rose"
        >
          <input type="radio" name={name} value={c.value} defaultChecked={defaultValue === c.value} className="sr-only" />
          <span className="size-5 rounded-full" style={{ background: c.value, boxShadow: "inset -2px -3px 0 rgb(0 0 0 / .13)" }} />
          {c.name}
        </label>
      ))}
    </div>
  );
}

/** Styled checkbox switch. */
export function Toggle({ name, defaultChecked, label }: { name: string; defaultChecked?: boolean; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-cocoa">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative h-6 w-11 rounded-full bg-cocoa/15 transition peer-checked:bg-plum peer-focus-visible:ring-2 peer-focus-visible:ring-rose after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
      {label}
    </label>
  );
}

/** Button that asks for confirmation inline before submitting. */
export function ConfirmButton({
  children,
  confirmText = "Yes, do it",
  className = "btn btn-danger btn-sm",
  formAction,
}: {
  children: ReactNode;
  confirmText?: string;
  className?: string;
  formAction?: (fd: FormData) => void | Promise<void>;
}) {
  return (
    <details className="group relative inline-block">
      <summary className={`${className} list-none [&::-webkit-details-marker]:hidden`}>{children}</summary>
      <div className="absolute end-0 z-20 mt-2 grid w-60 gap-2 rounded-2xl border border-line bg-white p-3 text-sm shadow-xl">
        <p className="text-cocoa">Are you sure? This can&apos;t be undone.</p>
        <button type="submit" formAction={formAction} className="btn btn-danger btn-sm">
          {confirmText}
        </button>
      </div>
    </details>
  );
}
