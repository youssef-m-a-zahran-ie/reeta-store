type Variant = "full" | "inner" | "arcA" | "arcB";

/** The Reeta mark, drawn from the brand PNG layers and colored with currentColor. */
export function Mark({ variant = "full", className = "" }: { variant?: Variant; className?: string }) {
  return <span aria-hidden="true" className={`mark mark-${variant} ${className}`} />;
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-plum ${className}`}>
      <Mark className="size-9" />
      <span className="font-display text-[21px] font-semibold leading-none tracking-[0.07em]">REETA</span>
    </span>
  );
}
