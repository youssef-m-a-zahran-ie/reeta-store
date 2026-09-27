/** What every admin form action returns. */
export type ActionState = {
  ok: boolean;
  message?: string;
  /** Field name → error text */
  errors?: Record<string, string>;
  /** Bumped on each success so forms can reset. */
  at?: number;
} | null;

export const ok = (message?: string): ActionState => ({ ok: true, message, at: Date.now() });
export const fail = (message: string, errors?: Record<string, string>): ActionState => ({ ok: false, message, errors });

/** Turns a Postgres/PostgREST error into something an admin can act on. */
export function friendlyDbError(err: { code?: string; message?: string; details?: string } | null | undefined): string {
  if (!err) return "Something went wrong. Try again.";
  switch (err.code) {
    case "23505":
      if (err.message?.includes("slug")) return "That URL name is already used. Pick another one.";
      if (err.message?.includes("code")) return "That code already exists.";
      return "This already exists.";
    case "23503":
      return "It's still used somewhere else (products, orders or bundles). Archive or hide it instead.";
    case "23514":
      return "One of the values isn't allowed. Check the fields and try again.";
    case "42501":
      return "You don't have permission to do that. Sign in again.";
    default:
      return err.message || "Something went wrong. Try again.";
  }
}
