/**
 * The real nut photos from the hero (public/menu, two angles each), used as decoration in place of
 * plain colored rounds. Pick one by number; the angle, size and tilt are up to the caller.
 */
const PHOTOS = [
  "cashew-1",
  "almond-1",
  "hazelnut-1",
  "macadamia-1",
  "cashew-2",
  "almond-2",
  "hazelnut-2",
  "macadamia-2",
] as const;

export function NutPhoto({ n, size, rot = 0, className = "" }: { n: number; size: number; rot?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/menu/hero-${PHOTOS[n % PHOTOS.length]}.webp`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`block object-contain drop-shadow-[0_6px_10px_rgba(90,51,34,.25)] ${className}`}
      style={{ width: size, height: size, rotate: `${rot}deg` }}
      aria-hidden="true"
    />
  );
}
