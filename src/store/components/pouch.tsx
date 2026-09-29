import { inkOn } from "../colors";

/** The Reeta pouch drawn in CSS, used until a product has its own photo. */
export function Pouch({
  color,
  line,
  name,
  caps,
  className = "",
}: {
  color: string | null;
  line?: string;
  name?: string;
  caps?: string;
  className?: string;
}) {
  const c = color ?? "#f5ead8";
  return (
    <div
      className={`relative grid aspect-[228/312] w-full grid-rows-[auto_1fr_auto] rounded-[26px] bg-blush px-[5%] pt-[6%] pb-[4%] shadow-[0_18px_30px_-18px_rgb(58_36_32/.45)] ${className}`}
      aria-hidden="true"
    >
      <div className="mx-[4%] h-[3px] bg-[radial-gradient(circle,rgb(91_70_89/.45)_1px,transparent_1.4px)] bg-[length:6px_3px]" />
      <div className="grid content-center justify-items-center gap-2 text-plum">
        <span className="mark mark-full size-[28%] min-w-10" />
        <span className="font-wordmark text-[clamp(12px,1.4vw,17px)] font-semibold tracking-[0.07em]" dir="ltr">
          REETA
        </span>
      </div>
      {name && (
        <div className="grid gap-px rounded-[20px] px-[7%] py-[6%]" style={{ background: c, color: inkOn(c) }}>
          {line && <span className="text-[11px] opacity-80">{line}</span>}
          <span className="text-[clamp(14px,1.6vw,19px)] leading-tight font-medium">{name}</span>
          {caps && <span className="justify-self-end text-[10px] font-semibold tracking-[0.1em] uppercase opacity-85">{caps}</span>}
        </div>
      )}
    </div>
  );
}
