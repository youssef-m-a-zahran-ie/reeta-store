/**
 * Flat, cartoon-style nuts for the hero and empty states. One per nut we sell;
 * the key matches custom_bases.visual. Drawn on a 100 × 100 box with a cocoa outline.
 */
export const NUT_KINDS = ["cashew", "almond", "hazelnut", "macadamia"] as const;
export type NutKind = (typeof NUT_KINDS)[number];
export const isNutKind = (v: string | null | undefined): v is NutKind => !!v && (NUT_KINDS as readonly string[]).includes(v);

const LINE = "#5a3322";
const SW = 3.2;

export function NutArt({ kind, className, title }: { kind: NutKind; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {ART[kind]}
    </svg>
  );
}

const common = { stroke: LINE, strokeWidth: SW, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const ART: Record<NutKind, React.ReactNode> = {
  cashew: (
    <g transform="rotate(-10 50 50)">
      <path
        d="M40 15C20 15 9 38 13 58c4 20 24 32 46 30 16-2 29-12 29-24 0-10-12-14-18-8-6 6-16 10-24 6-10-5-14-16-10-26 3-6 8-8 10-13 2-6-1-8-6-8Z"
        fill="#efd3a3"
        {...common}
      />
      <path d="M19 60c4 13 15 23 33 24" fill="none" stroke="#d6b07a" strokeWidth="5" strokeLinecap="round" />
      <path d="M24 30c-4 5-6 11-6 18" fill="none" stroke="#fff6e6" strokeWidth="4.5" strokeLinecap="round" opacity=".85" />
      <circle cx="80" cy="66" r="1.7" fill={LINE} opacity=".35" />
    </g>
  ),
  almond: (
    <g transform="rotate(14 50 50)">
      <path d="M50 7c19 15 31 40 27 62-3 15-14 24-27 24S26 84 23 69C19 47 31 22 50 7Z" fill="#c4865a" {...common} />
      <path d="M62 30c7 13 9 28 6 40" fill="none" stroke="#a5683f" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 22c-2 18-2 40 0 58M40 30c-4 14-5 32-2 46M60 32c3 14 4 30 1 44" fill="none" stroke="#9e6139" strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
      <path d="M40 22c-5 7-8 14-9 22" fill="none" stroke="#f0c9a4" strokeWidth="4" strokeLinecap="round" opacity=".85" />
    </g>
  ),
  hazelnut: (
    <g>
      <path d="M50 8c6 6 33 16 35 46 2 25-14 38-35 38S13 79 15 54C17 24 44 14 50 8Z" fill="#b8763f" {...common} />
      <path
        d="M17 67q6-6 11 0t11 0 11 0 11 0 11 0 11 0c-2 15-16 25-33 25S19 82 17 67Z"
        fill="#e6cb9b"
        {...common}
      />
      <path d="M50 10v6" stroke={LINE} strokeWidth={SW} strokeLinecap="round" />
      <path d="M36 26c-7 6-12 14-13 24" fill="none" stroke="#e2a874" strokeWidth="4" strokeLinecap="round" opacity=".85" />
      <path d="M44 22c-3 12-3 26-1 40M58 22c3 12 4 26 2 40" fill="none" stroke="#8f5527" strokeWidth="1.8" strokeLinecap="round" opacity=".5" />
      <path d="M72 40c4 7 5 15 4 22" fill="none" stroke="#97592b" strokeWidth="5" strokeLinecap="round" />
    </g>
  ),
  macadamia: (
    <g>
      <circle cx="50" cy="52" r="37" fill="#f2dfb6" {...common} />
      <path d="M78 44c4 14 0 30-12 38" fill="none" stroke="#dcc08c" strokeWidth="6" strokeLinecap="round" />
      <path d="M30 30c-5 5-8 12-8 19" fill="none" stroke="#fffaf0" strokeWidth="5" strokeLinecap="round" opacity=".9" />
      <path d="M50 16c-6 10-6 22 0 32" fill="none" stroke="#cfae78" strokeWidth="1.8" strokeLinecap="round" opacity=".7" />
      <circle cx="50" cy="17" r="2.6" fill="#b88f55" />
    </g>
  ),
};
