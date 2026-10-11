/**
 * The Atelier stage: a nut that gets coated by a pouring stream, then a bowl that fills with coated pieces.
 * Framework-free; the React component owns the choices and calls setBase / setCoating / setTier.
 *
 * Coordinates inside the bowl "space" are in the bowl photo's own units (1600 wide); the space is scaled
 * to the stage. The bowl's look per size is visual only, so weights can change in the admin freely.
 */
import { atelierImg } from "./visuals";

export type Pour = { c1: string; c2: string; c3: string };
export type Tier = 1 | 2 | 3;

/* Bowl width relative to the frame: small→medium jumps more than medium→large, and large breaks the frame. */
const LOOK = { bowl: { 1: 0.56, 2: 0.9, 3: 1.18 } as Record<Tier, number>, heap: { 1: 0.5, 2: 1.0, 3: 1.6 } as Record<Tier, number>, piece: 0.17 };
const HEAD = 420;
const RIM = { cx: 800, cy: HEAD + 141, rx: 740, ry: 118 };
const FOOT = HEAD + 910;

type Sprite = { c: HTMLCanvasElement; w: number; h: number; pad: number; max: number };
type Shape = { W: number; H: number; x0: number; x1: number; y0: number; y1: number; cx: number; cy: number };
type Geo = { cx: number; cy: number; x0: number; x1: number; yb: number };
type Anim =
  | { type: "drop"; t0: number; dur: number; h: number; spin: number }
  | { type: "move"; t0: number; dur: number; fx: number; fy: number; fsz: number; frot: number }
  | { type: "out"; t0: number; dur: number }
  | { type: "swap"; t0: number; dur: number };
type Piece = {
  u: number; v: number; sx: number; sy: number; rot: number; flip: boolean; sz: number; h: number; level: number; key: number;
  base: string; spr: Sprite; prev: Sprite | null; old: Sprite | null; anim: Anim | null; dead?: boolean; deadAt?: number;
};
type PState = { x: number; y: number; sz: number; rot: number; alpha: number; mix: number; done: boolean; hidden?: false } | { hidden: true; done: false };
type Fallen = { spr: Sprite; next?: Sprite; sz: number; t0: number; dur: number; p0: P; p1: P; p2: P; leave: number };
type P = { x: number; y: number };

const now = () => performance.now();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = { out: (t: number) => 1 - Math.pow(1 - t, 3), inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) };
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const bez = (a: P, c: P, b: P, t: number): P => {
  const m = 1 - t;
  return { x: m * m * a.x + 2 * m * t * c.x + t * t * b.x, y: m * m * a.y + 2 * m * t * c.y + t * t * b.y };
};

/* ---------- shared caches (survive remounts) ---------- */
const imgCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImg(url: string) {
  let p = imgCache.get(url);
  if (!p) {
    p = new Promise((res, rej) => {
      const i = new Image();
      i.decoding = "async";
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    imgCache.set(url, p);
  }
  return p;
}

/* Silhouette of a photo: its bounds and the top point the coating lands on. */
const shapeCache = new Map<string, Shape>();
async function shapeOf(url: string): Promise<Shape> {
  const hit = shapeCache.get(url);
  if (hit) return hit;
  const img = await loadImg(url);
  const w = 240;
  const h = Math.round((img.naturalHeight * w) / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  const top = new Array<number>(w).fill(-1);
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++)
      if (d[(yy * w + xx) * 4 + 3] > 140) {
        if (xx < x0) x0 = xx;
        if (xx > x1) x1 = xx;
        if (yy < y0) y0 = yy;
        if (yy > y1) y1 = yy;
        if (top[xx] < 0) top[xx] = yy;
      }
  const mid = (x0 + x1) / 2;
  let cx = Math.round(mid), best = 1e9;
  for (let xx = Math.round(x0 + (x1 - x0) * 0.28); xx <= Math.round(x0 + (x1 - x0) * 0.72); xx++) {
    if (top[xx] < 0) continue;
    const score = top[xx] + Math.abs(xx - mid) * 0.25;
    if (score < best) {
      best = score;
      cx = xx;
    }
  }
  const s = img.naturalWidth / w;
  const info = { W: img.naturalWidth, H: img.naturalHeight, x0: x0 * s, x1: x1 * s, y0: y0 * s, y1: y1 * s, cx: cx * s, cy: (top[cx] + 3) * s };
  shapeCache.set(url, info);
  return info;
}

/* Heap pieces, pre-rendered with their drop shadow and three shade levels for depth. */
const spriteCache = new Map<string, Promise<Sprite>>();
function sprite(b: string, s: string, level: number, size: number): Promise<Sprite> {
  const key = `${b}|${s}|${level}|${size}`;
  let p = spriteCache.get(key);
  if (!p) {
    p = loadImg(atelierImg.piece(b, s)).then((img) => {
      const sc = size / Math.max(img.naturalWidth, img.naturalHeight);
      const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc), pad = Math.round(size * 0.16);
      const c = document.createElement("canvas");
      c.width = w + pad * 2;
      c.height = h + pad * 2;
      const x = c.getContext("2d")!;
      x.shadowColor = "rgba(48,22,16,.42)";
      x.shadowBlur = size * 0.07;
      x.shadowOffsetY = size * 0.045;
      x.drawImage(img, pad, pad, w, h);
      x.shadowColor = "transparent";
      const dark = [0, 0.12, 0.24][level];
      if (dark) {
        x.globalCompositeOperation = "source-atop";
        x.fillStyle = `rgba(42,18,12,${dark})`;
        x.fillRect(0, 0, c.width, c.height);
      }
      return { c, w, h, pad, max: Math.max(w, h) };
    });
    spriteCache.set(key, p);
  }
  return p;
}

/* ---------- the coating front ---------- */
/* Coated area at time t (0..1): a pool spreads from where the coating lands, then runs down the sides in
   rivulets that widen and merge. g is in the drawing's own units. */
function coatMask(ctx: CanvasRenderingContext2D, g: Geo, t: number, seed: number) {
  const r = rng(seed);
  const span = g.x1 - g.x0, depth = Math.max(10, g.yb - g.cy);
  const reach = Math.max(g.cx - g.x0, g.x1 - g.cx) * 1.06;
  ctx.fillStyle = "#fff";
  const ph1 = r() * 6, ph2 = r() * 6, ph3 = r() * 6;
  const q = clamp(t / 0.58), pt = q * q * (3 - 2 * q);
  const prx = reach * pt + span * 0.03, pry = depth * (0.07 + 0.17 * pt);
  const pcy = g.cy + pry * 0.6 + depth * 0.22 * t * t;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const k = 1 + 0.06 * Math.sin(5 * a + ph1 + t * 2) + 0.045 * Math.sin(9 * a + ph2) + 0.03 * Math.sin(14 * a + ph3);
    const x = g.cx + Math.cos(a) * prx * k, y = pcy + Math.sin(a) * pry * k;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.fill();
  const K = 15;
  for (let i = 0; i < K; i++) {
    const j1 = r(), j2 = r(), j3 = r(), j4 = r();
    const x = g.x0 + (span * (i + 0.5 + (j1 - 0.5) * 0.7)) / K;
    const start = (Math.abs(x - g.cx) / reach) * 0.5 + 0.12 + j2 * 0.1;
    const e = t - start;
    if (e <= 0) continue;
    const speed = 0.85 + j3 * 0.7;
    const w = span * (0.026 + j4 * 0.022) * (1 + 1.9 * e);
    const y0 = g.cy - depth * 0.02;
    const len = Math.min(depth * 1.25, depth * speed * e * 1.45);
    const rr = w / 2;
    ctx.beginPath();
    ctx.moveTo(x - rr, y0);
    ctx.lineTo(x + rr, y0);
    ctx.lineTo(x + rr * 0.92, y0 + len);
    ctx.lineTo(x - rr * 0.92, y0 + len);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y0 + len, rr * 1.12, rr * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (t > 0.87) {
    ctx.globalAlpha = clamp((t - 0.87) / 0.12);
    ctx.fillRect(g.x0 - span, g.cy - depth * 3, span * 3, depth * 6);
    ctx.globalAlpha = 1;
  }
}

export type StageEls = {
  stage: HTMLElement;
  space: HTMLElement;
  hero: HTMLElement;
  bob: HTMLElement;
  heap: HTMLCanvasElement;
  fx: HTMLCanvasElement;
  pour: HTMLCanvasElement;
  floorShadow: HTMLElement;
};

export class AtelierEngine {
  private el: StageEls;
  private hctx: CanvasRenderingContext2D;
  private fctx: CanvasRenderingContext2D;
  private pctx: CanvasRenderingContext2D;
  private reduce: boolean;
  private tmpMask = document.createElement("canvas");
  private tmpLayer = document.createElement("canvas");
  private ro: ResizeObserver;
  private resizeT: ReturnType<typeof setTimeout> | undefined;
  private dead = false;

  // choices (visual keys)
  private base = "";
  private piece = 1;
  private coat: string | null = null;
  private pourColors: Pour | null = null;
  private tier: Tier | null = null;

  private G = { W: 0, H: 0, F: 0, cx: 0, floor: 0, dpr: 1, kMax: 0, spriteSize: 160 };
  private pieces: Piece[] = [];
  private fallen: Fallen | null = null;
  private heapMeta: { pw: number; Hm: number; tier: Tier } | null = null;
  private heapCoat: { t0: number; dur: number; seed: number; g: Geo } | null = null;
  private heroCoat: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; fromImg: HTMLImageElement; toImg: HTMLImageElement; toUrl: string; s: number; ox: number; oy: number; t0: number; dur: number; seed: number; g: Geo } | null = null;
  private pourState: { x: number; y: number; s: Pour; t0: number; fall: number; flow: number; tail: number; contacted: boolean; onContact?: () => void } | null = null;
  private spaceAnim: { k0: number; k1: number; l0: number; o0: number; t0: number; dur: number; cur: number } | null = null;
  private raf = 0;
  private fillGen = 0;
  private swapGen = 0;

  constructor(el: StageEls, opts: { reduce: boolean }) {
    this.el = el;
    this.hctx = el.heap.getContext("2d")!;
    this.fctx = el.fx.getContext("2d")!;
    this.pctx = el.pour.getContext("2d")!;
    this.reduce = opts.reduce;
    this.layout();
    this.ro = new ResizeObserver(() => {
      clearTimeout(this.resizeT);
      this.resizeT = setTimeout(() => void this.onResize(), 60);
    });
    this.ro.observe(el.stage);
  }

  destroy() {
    this.dead = true;
    this.ro.disconnect();
    clearTimeout(this.resizeT);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /* ---------- public API ---------- */
  start(base: string, piece: number) {
    this.base = base;
    this.piece = piece;
    this.setHeroVisible(true);
    void this.showHeroBase();
  }

  /** Preload every photo for the choices on the page, lowest priority. */
  preload(bases: string[], coats: string[]) {
    bases.forEach((b) => {
      void loadImg(atelierImg.bare(b)).catch(() => {});
      coats.forEach((c) => {
        void loadImg(atelierImg.drip(b, c)).catch(() => {});
        void loadImg(atelierImg.piece(b, c)).catch(() => {});
      });
    });
  }

  setBase(base: string, piece: number) {
    if (this.base === base) return;
    this.base = base;
    this.piece = piece;
    if (this.tier && this.coat) {
      this.animateSpace(this.kFor(this.tier), 1);
      void this.fillBowl(this.tier, { replace: true });
    } else void this.showHeroBase();
  }

  setCoating(coat: string, colors: Pour) {
    if (this.coat === coat) return;
    const before = this.coat ? atelierImg.drip(this.base, this.coat) : atelierImg.bare(this.base);
    this.coat = coat;
    this.pourColors = colors;
    if (this.tier) void this.coatBowl();
    else void this.coatHero(before);
  }

  async setTier(tier: Tier | null) {
    if (this.tier === tier) return;
    if (tier === null || !this.coat) return this.backToHero();
    const first = !this.tier;
    this.tier = tier;
    if (first) {
      this.finishHeroCoat();
      this.stopPour();
      this.setHeroVisible(false);
      this.animateSpace(this.kFor(tier), 820, this.kFor(tier), 46, 0);
      await this.fillBowl(tier, { first: true });
    } else {
      this.stopPour();
      this.animateSpace(this.kFor(tier), 760);
      await this.fillBowl(tier);
    }
  }

  /** Empties the bowl and shows the single nut again (used when the chosen size goes away). */
  backToHero() {
    this.tier = null;
    this.fillGen++;
    this.swapGen++;
    this.heroCoat = null;
    this.heapCoat = null;
    this.stopPour();
    this.pieces = [];
    this.fallen = null;
    this.spaceAnim = null;
    this.heapMeta = null;
    this.el.space.style.opacity = "0";
    this.el.bob.replaceChildren();
    this.el.bob.style.animationPlayState = "running";
    this.setHeroVisible(true);
    void this.showHeroBase();
    this.startLoop();
  }

  reset(base: string, piece: number) {
    this.coat = null;
    this.pourColors = null;
    this.base = base;
    this.piece = piece;
    this.backToHero();
  }

  /* ---------- geometry ---------- */
  private layout() {
    const r = this.el.stage.getBoundingClientRect();
    const F = r.width * 0.64;
    const G = this.G;
    G.W = r.width;
    G.H = r.height;
    G.F = F;
    G.cx = r.width / 2;
    G.floor = r.height * 0.845;
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    G.kMax = (LOOK.bowl[3] * F) / 1600;
    this.el.heap.width = Math.max(1, Math.round(1600 * G.kMax * G.dpr));
    this.el.heap.height = Math.max(1, Math.round(1337 * G.kMax * G.dpr));
    this.el.fx.width = Math.max(1, Math.round(2400 * G.kMax * G.dpr));
    this.el.fx.height = Math.max(1, Math.round(1400 * G.kMax * G.dpr));
    this.el.pour.width = Math.max(1, Math.round(r.width * G.dpr));
    this.el.pour.height = Math.max(1, Math.round(r.height * G.dpr));
    G.spriteSize = Math.max(96, Math.min(360, Math.round(LOOK.piece * F * 1.25 * G.dpr)));
    this.el.floorShadow.style.top = `${G.floor}px`;
  }

  private async onResize() {
    if (this.dead) return;
    const prev = this.G.spriteSize;
    this.layout();
    if (this.tier && this.coat) {
      if (prev !== this.G.spriteSize) {
        const sp = await this.spritesFor(this.base, this.coat);
        this.pieces.forEach((p) => {
          p.spr = sp[p.level];
          p.old = null;
          p.prev = null;
        });
        this.heapCoat = null;
        if (this.fallen) this.fallen.spr = sp[0];
      }
      this.spaceAnim = null;
      this.placeSpace(this.kFor(this.tier));
    }
    this.startLoop();
  }

  private kFor(t: Tier) {
    return (LOOK.bowl[t] * this.G.F) / 1600;
  }
  private kNow() {
    return this.spaceAnim?.cur ?? (this.tier ? this.kFor(this.tier) : 0);
  }
  private placeSpace(k: number, lift = 0, opacity = 1) {
    this.el.space.style.transform = `translate(${this.G.cx - 800 * k}px, ${this.G.floor - FOOT * k + lift}px) scale(${k})`;
    this.el.space.style.opacity = String(opacity);
  }
  private spritesFor(b: string, s: string) {
    return Promise.all([0, 1, 2].map((l) => sprite(b, s, l, this.G.spriteSize)));
  }

  /* Old surface, a soft shadow just under the advancing coating (it has thickness), then the new surface inside the coated area. */
  private composeCoat(
    out: CanvasRenderingContext2D,
    w: number,
    h: number,
    drawOld: (o: CanvasRenderingContext2D) => void,
    drawNew: (o: CanvasRenderingContext2D) => void,
    drawMask: (o: CanvasRenderingContext2D) => void,
    shadow: number,
  ) {
    for (const c of [this.tmpMask, this.tmpLayer])
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
    const m = this.tmpMask.getContext("2d")!, l = this.tmpLayer.getContext("2d")!;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.clearRect(0, 0, w, h);
    drawMask(m);
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.filter = "none";
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, w, h);
    drawOld(out);
    out.setTransform(1, 0, 0, 1, 0, 0);
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = "source-over";
    l.clearRect(0, 0, w, h);
    l.drawImage(this.tmpMask, 0, shadow);
    l.globalCompositeOperation = "source-in";
    l.fillStyle = "rgba(38,14,8,.34)";
    l.fillRect(0, 0, w, h);
    out.globalCompositeOperation = "source-atop";
    out.drawImage(this.tmpLayer, 0, 0);
    out.globalCompositeOperation = "source-over";
    l.globalCompositeOperation = "source-over";
    l.clearRect(0, 0, w, h);
    drawNew(l);
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = "destination-in";
    l.drawImage(this.tmpMask, 0, 0);
    l.globalCompositeOperation = "source-over";
    out.drawImage(this.tmpLayer, 0, 0);
  }

  /* ---------- the stream ---------- */
  private startPour(o: { x: number; y: number; sauce: Pour; flow?: number; onContact?: () => void }) {
    this.pourState = { x: o.x, y: o.y, s: o.sauce, t0: now(), fall: 380, flow: o.flow ?? 1150, tail: 420, contacted: false, onContact: o.onContact };
    this.startLoop();
  }
  private stopPour() {
    if (this.pourState && !this.pourState.contacted) this.pourState.onContact?.();
    this.pourState = null;
    this.pctx.setTransform(1, 0, 0, 1, 0, 0);
    this.pctx.clearRect(0, 0, this.el.pour.width, this.el.pour.height);
  }
  private drawPour(t: number) {
    const P = this.pourState, pctx = this.pctx, G = this.G;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, this.el.pour.width, this.el.pour.height);
    if (!P) return false;
    pctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    const e = t - P.t0, w0 = Math.max(7, G.W * 0.017);
    let yTop = -12, yBot: number, thin = 1;
    if (e < P.fall) {
      const q = e / P.fall;
      yBot = -12 + (P.y + 12) * q * q;
    } else {
      yBot = P.y;
      if (!P.contacted) {
        P.contacted = true;
        P.onContact?.();
      }
    }
    const tailStart = P.fall + P.flow;
    if (e > tailStart) {
      const q = clamp((e - tailStart) / P.tail);
      yTop = -12 + (P.y + 12) * q * q;
      thin = 1 - 0.5 * q;
      if (q >= 1) {
        this.pourState = null;
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.clearRect(0, 0, this.el.pour.width, this.el.pour.height);
        return false;
      }
    }
    const w = w0 * thin, L = Math.max(1, yBot - yTop), S2 = P.s;
    const grad = pctx.createLinearGradient(P.x - w, 0, P.x + w, 0);
    grad.addColorStop(0, S2.c1);
    grad.addColorStop(0.32, S2.c2);
    grad.addColorStop(0.44, S2.c3);
    grad.addColorStop(0.62, S2.c2);
    grad.addColorStop(1, S2.c1);
    pctx.fillStyle = grad;
    // the column narrows as it falls and swells where it lands
    const N = 28;
    const edge = (i: number) => {
      const yy = yTop + (L * i) / N, f = i / N;
      return { yy, half: (w / 2) * (1.12 - 0.22 * f + (f > 0.9 ? (f - 0.9) * 7 : 0)), wob: Math.sin(yy * 0.05 + e * 0.012) * w * 0.07 };
    };
    pctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const p = edge(i);
      pctx.lineTo(P.x - p.half + p.wob, p.yy);
    }
    for (let i = N; i >= 0; i--) {
      const p = edge(i);
      pctx.lineTo(P.x + p.half + p.wob, p.yy);
    }
    pctx.closePath();
    pctx.fill();
    pctx.beginPath();
    if (e < P.fall) pctx.ellipse(P.x, yBot, w * 0.62, w * 0.78, 0, 0, Math.PI * 2);
    else pctx.ellipse(P.x, yBot + w * 0.1, w * (1.1 + 0.25 * Math.sin(e * 0.01)), w * 0.42, 0, 0, Math.PI * 2);
    pctx.fill();
    if (e > tailStart) {
      pctx.beginPath();
      pctx.ellipse(P.x, yTop, w * 0.5, w * 0.7, 0, 0, Math.PI * 2);
      pctx.fill();
    }
    // light travelling down the stream so it reads as flowing
    pctx.fillStyle = "rgba(255,255,255,.28)";
    for (let i = 0; i < 7; i++) {
      const yy = yTop + ((e * 1.1 + (i * L) / 7) % L);
      pctx.beginPath();
      pctx.ellipse(P.x - w * 0.16 + Math.sin(yy * 0.05 + e * 0.012) * w * 0.07, yy, w * 0.08, Math.min(w * 1.4, L * 0.08), 0, 0, Math.PI * 2);
      pctx.fill();
    }
    pctx.fillStyle = "rgba(255,255,255,.18)";
    pctx.fillRect(P.x - w * 0.2, yTop, w * 0.07, L);
    return true;
  }

  /* ---------- hero (before a size is picked) ---------- */
  private heroImg(url: string) {
    const i = new Image();
    i.src = url;
    i.alt = "";
    i.decoding = "async";
    return i;
  }
  private setHeroVisible(on: boolean) {
    const hero = this.el.hero;
    hero.style.transition = "opacity .5s, transform .7s cubic-bezier(.2,.8,.2,1)";
    hero.style.opacity = on ? "1" : "0";
    hero.style.transform = on ? "translate(-50%, -50%)" : "translate(-50%, 4%) scale(.42)";
    this.el.floorShadow.style.opacity = on ? "1" : "0";
  }
  private finishHeroCoat() {
    if (!this.heroCoat) return;
    const hc = this.heroCoat;
    this.heroCoat = null;
    this.el.bob.replaceChildren(this.heroImg(hc.toUrl));
    this.el.bob.style.animationPlayState = "running";
  }
  private async showHeroBase() {
    this.finishHeroCoat();
    this.stopPour();
    const url = this.coat ? atelierImg.drip(this.base, this.coat) : atelierImg.bare(this.base);
    try {
      await loadImg(url);
    } catch {
      return;
    }
    if (this.dead || this.tier) return;
    const want = this.coat ? atelierImg.drip(this.base, this.coat) : atelierImg.bare(this.base);
    if (want !== url) return;
    const bob = this.el.bob;
    [...bob.children].forEach((el) => {
      const h = el as HTMLElement;
      h.style.transition = "opacity .25s, filter .3s";
      h.style.opacity = "0";
      h.style.filter = "blur(6px)";
      setTimeout(() => h.remove(), 320);
    });
    const img = this.heroImg(url);
    img.style.opacity = "0";
    img.style.filter = "blur(8px)";
    img.style.translate = "0 5%";
    bob.appendChild(img);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        img.style.transition = "opacity .55s ease, filter .6s ease, translate .7s cubic-bezier(.2,.8,.2,1)";
        img.style.opacity = "1";
        img.style.filter = "none";
        img.style.translate = "0 0";
      }),
    );
  }
  /* The coating pours onto the nut's highest point, pools, and runs down until the whole nut is coated. */
  private async coatHero(fromUrl: string) {
    this.finishHeroCoat();
    this.stopPour();
    if (!this.coat || !this.pourColors) return;
    const toUrl = atelierImg.drip(this.base, this.coat), sauce = this.pourColors;
    let fromImg: HTMLImageElement, toImg: HTMLImageElement, info: Shape;
    try {
      [fromImg, toImg, info] = await Promise.all([loadImg(fromUrl), loadImg(toUrl), shapeOf(toUrl)]);
    } catch {
      return;
    }
    if (this.dead || atelierImg.drip(this.base, this.coat) !== toUrl || this.tier) return;
    const bob = this.el.bob;
    if (this.reduce) {
      bob.replaceChildren(this.heroImg(toUrl));
      return;
    }
    bob.style.animationPlayState = "paused";
    const box = bob.getBoundingClientRect(), sr = this.el.stage.getBoundingClientRect(), G = this.G;
    const s = Math.min(box.width / info.W, box.height / info.H), ox = (box.width - info.W * s) / 2, oy = (box.height - info.H * s) / 2;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(box.width * G.dpr));
    c.height = Math.max(1, Math.round(box.height * G.dpr));
    const ctx = c.getContext("2d")!;
    ctx.setTransform(G.dpr * s, 0, 0, G.dpr * s, G.dpr * ox, G.dpr * oy);
    ctx.drawImage(fromImg, 0, 0);
    bob.replaceChildren(c);
    const hc = (this.heroCoat = {
      c, ctx, fromImg, toImg, toUrl, s, ox, oy, t0: Infinity, dur: 2700, seed: Math.floor(Math.random() * 1e6),
      g: { cx: info.cx, cy: info.cy, x0: info.x0, x1: info.x1, yb: info.y1 },
    });
    this.startPour({ x: box.left - sr.left + ox + info.cx * s, y: box.top - sr.top + oy + info.cy * s, sauce, flow: 2000, onContact: () => (hc.t0 = now()) });
  }
  private drawHeroCoat(t: number) {
    const hc = this.heroCoat;
    if (!hc) return false;
    if (t < hc.t0) return true;
    const p = clamp((t - hc.t0) / hc.dur), d = this.G.dpr;
    const M: [number, number, number, number, number, number] = [d * hc.s, 0, 0, d * hc.s, d * hc.ox, d * hc.oy];
    this.composeCoat(
      hc.ctx,
      hc.c.width,
      hc.c.height,
      (o) => {
        o.setTransform(...M);
        o.globalAlpha = p > 0.9 ? 1 - (p - 0.9) / 0.1 : 1;
        o.drawImage(hc.fromImg, 0, 0);
        o.globalAlpha = 1;
      },
      (o) => {
        o.setTransform(...M);
        o.drawImage(hc.toImg, 0, 0);
      },
      (o) => {
        o.setTransform(...M);
        o.filter = `blur(${2.2 * d}px)`;
        coatMask(o, hc.g, p, hc.seed);
        o.filter = "none";
      },
      Math.round(4 * d),
    );
    if (p >= 1) {
      this.finishHeroCoat();
      return false;
    }
    return true;
  }

  /* ---------- heap ---------- */
  /* Pieces are placed until the visible surface of the heap is fully covered: the emptiest spot is measured
     and the next piece goes there, so there are no holes. */
  private genHeap(tier: Tier, baseId: string, spr: Sprite) {
    const r = rng(tier * 7919 + baseId.charCodeAt(0) * 31 + 13);
    const pw = ((LOOK.piece * 1600) / LOOK.bowl[tier]) * this.piece;
    const Hm = LOOK.heap[tier] * pw;
    const GS = 1 / 6, GW = Math.ceil(1600 * GS), GH = Math.ceil((RIM.cy + RIM.ry + 40) * GS);
    const target = new Int32Array(GW * GH).fill(-1);
    const samples: { u: number; v: number; x: number; y: number; h: number; hn: number }[] = [];
    for (let iu = -100; iu <= 100; iu++)
      for (let iv = -100; iv <= 100; iv++) {
        const u = iu / 100, v = iv / 100, rad = Math.hypot(u, v);
        if (rad > 1) continue;
        const x = RIM.cx + u * RIM.rx * 0.97, y = RIM.cy + v * RIM.ry;
        const hn = Math.pow(Math.max(0, 1 - (rad * rad) / 0.95), 0.7), h = Hm * hn, sy = y - h;
        const lip = RIM.cy + RIM.ry * Math.sqrt(Math.max(0, 1 - ((x - RIM.cx) / RIM.rx) ** 2));
        if (sy > lip - 1) continue;
        const gx = Math.floor(x * GS), gy = Math.floor(sy * GS);
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        const i = gy * GW + gx, prev = target[i];
        if (prev < 0 || samples[prev].v < v) {
          target[i] = samples.length;
          samples.push({ u, v, x, y, h, hn });
        }
      }
    const cells: number[] = [];
    target.forEach((s, i) => {
      if (s >= 0) cells.push(i);
    });
    const cv = document.createElement("canvas");
    cv.width = GW;
    cv.height = GH;
    const cx = cv.getContext("2d", { willReadFrequently: true })!;
    const pts: Omit<Piece, "base" | "spr" | "prev" | "old" | "anim">[] = [];
    for (let it = 0; it < 320; it++) {
      const d = cx.getImageData(0, 0, GW, GH).data;
      const open = cells.filter((i) => d[i * 4 + 3] < 200);
      if (open.length <= cells.length * 0.0008) break;
      const smp = samples[target[open[Math.floor(r() * open.length)]]];
      const p = {
        u: smp.u, v: smp.v,
        sx: smp.x + (r() - 0.5) * pw * 0.1, sy: smp.y - smp.h + (r() - 0.5) * pw * 0.12,
        rot: (r() - 0.5) * 1.3, flip: r() < 0.5, sz: pw * (0.9 + r() * 0.18), h: smp.h,
        level: smp.hn > 0.5 || smp.v > 0.4 ? 0 : smp.hn > 0.18 ? 1 : 2,
        key: smp.y + smp.h * 0.2,
      };
      pts.push(p);
      cx.setTransform(GS, 0, 0, GS, 0, 0);
      this.blit(cx, spr, p.sx, p.sy, p.sz, p.rot, p.flip, 1);
    }
    pts.sort((a, b) => a.key - b.key);
    return { pts, pw, Hm };
  }

  private startLoop() {
    if (!this.raf && !this.dead) this.raf = requestAnimationFrame(this.frame);
  }
  private animateSpace(toK: number, dur: number, fromK?: number, fromLift = 0, fromOp = 1) {
    const k0 = fromK ?? this.spaceAnim?.cur ?? toK;
    this.spaceAnim = { k0, k1: toK, l0: fromLift, o0: fromOp, t0: now(), dur: this.reduce ? 1 : dur, cur: k0 };
    this.startLoop();
  }

  private frame = () => {
    this.raf = 0;
    if (this.dead) return;
    const t = now(), G = this.G;
    let busy = false;
    const sa = this.spaceAnim;
    if (sa) {
      const p = clamp((t - sa.t0) / sa.dur), e = ease.out(p);
      sa.cur = sa.k0 + (sa.k1 - sa.k0) * e;
      this.placeSpace(sa.cur, sa.l0 * (1 - e), sa.o0 + (1 - sa.o0) * e);
      if (p < 1) busy = true;
    }
    const d = G.kMax * G.dpr;
    this.pieces = this.pieces.filter((pc) => !(pc.dead && t > (pc.deadAt ?? 0)));
    const hctx = this.hctx, heapC = this.el.heap;
    const hcoat = this.heapCoat;
    if (hcoat && t >= hcoat.t0) {
      const p = clamp((t - hcoat.t0) / hcoat.dur);
      this.composeCoat(
        hctx,
        heapC.width,
        heapC.height,
        (o) => {
          o.setTransform(d, 0, 0, d, 0, 0);
          for (const pc of this.pieces) this.drawPiece(o, pc, t, "old");
        },
        (o) => {
          o.setTransform(d, 0, 0, d, 0, 0);
          for (const pc of this.pieces) this.drawPiece(o, pc, t, "new");
        },
        (o) => {
          o.setTransform(d, 0, 0, d, 0, 0);
          o.filter = `blur(${2.5 * G.dpr}px)`;
          coatMask(o, hcoat.g, p, hcoat.seed);
          o.filter = "none";
        },
        Math.round(4 * G.dpr),
      );
      if (this.fallen && p > 0.7) this.fallen.spr = this.fallen.next || this.fallen.spr;
      if (p >= 1) {
        this.heapCoat = null;
        this.pieces.forEach((pc) => (pc.old = null));
      }
      busy = true;
    } else {
      hctx.setTransform(1, 0, 0, 1, 0, 0);
      hctx.clearRect(0, 0, heapC.width, heapC.height);
      hctx.setTransform(d, 0, 0, d, 0, 0);
      for (const pc of this.pieces) if (this.drawPiece(hctx, pc, t, hcoat ? "old" : "mix")) busy = true;
      if (hcoat) busy = true;
    }
    const fctx = this.fctx;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, this.el.fx.width, this.el.fx.height);
    fctx.setTransform(d, 0, 0, d, 400 * d, 0);
    if (this.fallen && this.drawFallen(fctx, this.fallen, t)) busy = true;
    if (this.drawHeroCoat(t)) busy = true;
    if (this.drawPour(t)) busy = true;
    if (busy) this.startLoop();
  };

  private pieceState(pc: Piece, t: number): PState {
    const a = pc.anim;
    let x = pc.sx, y = pc.sy, sz = pc.sz, rot = pc.rot, alpha = 1, mix = 1;
    if (!a) return { x, y, sz, rot, alpha, mix, done: true };
    const p = clamp((t - a.t0) / a.dur);
    if (t < a.t0) {
      if (a.type === "drop") return { hidden: true, done: false };
      if (a.type === "move") return { x: a.fx, y: a.fy, sz: a.fsz, rot: a.frot, alpha, mix: 1, done: false };
      if (a.type === "swap") return { x, y, sz, rot, alpha, mix: 0, done: false };
    }
    if (a.type === "drop") {
      const fall = 0.72;
      if (p < fall) {
        const q = p / fall;
        y = pc.sy - a.h * (1 - q * q);
        rot = pc.rot + a.spin * (1 - q);
        alpha = Math.min(1, q * 10);
      } else {
        const q = (p - fall) / (1 - fall);
        y = pc.sy - Math.sin(q * Math.PI) * pc.sz * 0.07 * (1 - q);
      }
    } else if (a.type === "move") {
      const e = ease.inOut(p);
      x = a.fx + (pc.sx - a.fx) * e;
      y = a.fy + (pc.sy - a.fy) * e;
      sz = a.fsz + (pc.sz - a.fsz) * e;
      rot = a.frot + (pc.rot - a.frot) * e;
    } else if (a.type === "out") {
      const e = ease.out(p);
      y = pc.sy - pc.sz * 0.5 * e;
      alpha = 1 - e;
    } else if (a.type === "swap") {
      mix = p;
      sz = pc.sz * (1 - Math.sin(p * Math.PI) * 0.16);
    }
    if (p >= 1) {
      if (a.type === "swap") pc.prev = null;
      pc.anim = null;
    }
    return { x, y, sz, rot, alpha, mix, done: p >= 1 };
  }
  private blit(ctx: CanvasRenderingContext2D, spr: Sprite | null, x: number, y: number, sz: number, rot: number, flip: boolean, alpha: number) {
    if (!spr || alpha <= 0) return;
    const s = sz / spr.max;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(spr.c, (-spr.c.width * s) / 2, (-spr.c.height * s) / 2, spr.c.width * s, spr.c.height * s);
    ctx.restore();
  }
  private drawPiece(ctx: CanvasRenderingContext2D, pc: Piece, t: number, mode: "old" | "new" | "mix") {
    const st = this.pieceState(pc, t);
    if (st.hidden) return true;
    if (mode === "old") {
      this.blit(ctx, pc.old || pc.spr, st.x, st.y, st.sz, st.rot, pc.flip, st.alpha);
      return !st.done;
    }
    if (mode === "new") {
      this.blit(ctx, pc.spr, st.x, st.y, st.sz, st.rot, pc.flip, st.alpha);
      return !st.done;
    }
    if (pc.prev && st.mix < 1) this.blit(ctx, pc.prev, st.x, st.y, st.sz, st.rot, pc.flip, st.alpha * (1 - st.mix));
    this.blit(ctx, pc.spr, st.x, st.y, st.sz, st.rot, pc.flip, st.alpha * (pc.prev ? st.mix : 1));
    return !st.done;
  }

  /* Fill or refill the bowl. Pieces already in the bowl glide to their new place; the rest drop in, lowest first. */
  private async fillBowl(tier: Tier, { first = false, replace = false } = {}) {
    const gen = ++this.fillGen;
    this.finishHeapCoat();
    if (!this.coat) return;
    let sp: Sprite[];
    try {
      sp = await this.spritesFor(this.base, this.coat);
    } catch {
      return;
    }
    if (this.dead || gen !== this.fillGen || tier !== this.tier) return;
    const { pts, pw, Hm } = this.genHeap(tier, this.base, sp[0]);
    this.heapMeta = { pw, Hm, tier };
    const tNow = now(), t0 = tNow + (first ? 380 : 120);
    const old = this.pieces.filter((p) => !p.dead), used = new Set<Piece>(), next: Piece[] = [], drops: Piece[] = [];
    pts.forEach((p) => {
      let best: Piece | null = null, bd = 0.22;
      if (!first && !replace)
        for (const o of old) {
          if (used.has(o) || o.flip !== p.flip || o.base !== this.base) continue;
          const dd = Math.hypot(o.u - p.u, o.v - p.v);
          if (dd < bd) {
            bd = dd;
            best = o;
          }
        }
      const pc: Piece = { ...p, base: this.base, spr: sp[p.level], prev: null, old: null, anim: null };
      if (best) {
        used.add(best);
        const cs = this.pieceState(best, tNow);
        const at = cs.hidden ? best : cs;
        const sx = "x" in at ? at.x : best.sx, sy = "y" in at ? at.y : best.sy;
        pc.anim = { type: "move", t0: tNow, dur: 720, fx: sx, fy: sy, fsz: "sz" in at ? at.sz : best.sz, frot: "rot" in at ? at.rot : best.rot };
      } else drops.push(pc);
      next.push(pc);
    });
    drops.sort((a, b) => a.h - b.h || b.v - a.v);
    const gap = Math.min(first ? 22 : 18, 1500 / Math.max(1, drops.length));
    drops.forEach((pc, i) => {
      pc.anim = { type: "drop", t0: t0 + i * gap, dur: 520, h: Math.max(pw * 0.4, Math.min(260 + Hm + pw, pc.sy - pw * 0.6)), spin: (Math.random() - 0.5) * 1.6 };
    });
    if (this.reduce) next.forEach((pc) => (pc.anim = null));
    old.forEach((o) => {
      if (used.has(o)) return;
      const cs = this.pieceState(o, tNow);
      if (!cs.hidden) {
        o.sx = cs.x;
        o.sy = cs.y;
      }
      o.dead = true;
      o.anim = { type: "out", t0: tNow + (replace ? (o.sx / 1600) * 180 : 0), dur: 320 };
      o.deadAt = o.anim.t0 + 330;
      next.push(o);
    });
    next.sort((a, b) => a.key - b.key);
    this.pieces = next;
    this.updateFallen(tier, sp, t0 - tNow + drops.length * gap + 520);
    this.startLoop();
  }

  /* On the large size one piece rolls off the heap and lands beside the bowl. */
  private updateFallen(tier: Tier, sp: Sprite[], delay: number) {
    if (tier !== 3) {
      if (this.fallen) {
        this.fallen.leave = now();
        this.startLoop();
      }
      return;
    }
    if (this.fallen && !this.fallen.leave) {
      this.fallen.spr = sp[0];
      return;
    }
    const pw = this.heapMeta!.pw * 1.02;
    this.fallen = {
      spr: sp[0], sz: pw, t0: now() + (this.reduce ? 0 : Math.max(250, delay - 120)), dur: this.reduce ? 1 : 1300,
      p0: { x: RIM.cx + RIM.rx * 0.5, y: RIM.cy - this.heapMeta!.Hm * 0.62 }, p1: { x: RIM.cx + RIM.rx * 1.02, y: RIM.cy - 70 },
      p2: { x: 1700, y: FOOT - pw * 0.2 }, leave: 0,
    };
  }
  private drawFallen(ctx: CanvasRenderingContext2D, f: Fallen, t: number) {
    const p = clamp((t - f.t0) / f.dur);
    if (t < f.t0) return true;
    let pos: P, rot: number, alpha = 1;
    if (p < 0.3) {
      const q = ease.inOut(p / 0.3);
      pos = bez(f.p0, { x: f.p0.x + 260, y: f.p0.y - 40 }, f.p1, q);
      rot = q * 1.4;
    } else if (p < 0.78) {
      const q = (p - 0.3) / 0.48;
      pos = bez(f.p1, { x: f.p1.x + 140, y: f.p1.y - 30 }, f.p2, q * q);
      rot = 1.4 + q * 3.2;
    } else {
      const q = (p - 0.78) / 0.22;
      pos = { x: f.p2.x + q * 46, y: f.p2.y - Math.sin(q * Math.PI) * f.sz * 0.16 * (1 - q * 0.5) };
      rot = 4.6 + q * 0.7;
    }
    if (f.leave) {
      const q = clamp((t - f.leave) / 260);
      alpha = 1 - q;
      if (q >= 1) {
        this.fallen = null;
        return false;
      }
    }
    const near = clamp(1 - (FOOT - pos.y - f.sz * 0.3) / 420);
    ctx.save();
    ctx.globalAlpha = alpha * near * 0.55;
    ctx.fillStyle = "rgba(48,22,16,1)";
    ctx.filter = "blur(10px)";
    ctx.beginPath();
    ctx.ellipse(pos.x, FOOT - 6, f.sz * 0.42 * (0.6 + near * 0.4), f.sz * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.blit(ctx, f.spr, pos.x, pos.y, f.sz, rot, false, alpha);
    return p < 1 || !!f.leave;
  }

  private finishHeapCoat() {
    if (this.heapCoat) {
      this.heapCoat = null;
      this.pieces.forEach((pc) => (pc.old = null));
      if (this.fallen?.next) this.fallen.spr = this.fallen.next;
    }
  }

  /* A new coating on a full bowl: it pours onto the top of the heap and runs over every piece. */
  private async coatBowl() {
    const gen = ++this.swapGen;
    this.finishHeapCoat();
    this.stopPour();
    if (!this.coat || !this.pourColors) return;
    let sp: Sprite[];
    try {
      sp = await this.spritesFor(this.base, this.coat);
    } catch {
      return;
    }
    if (this.dead || gen !== this.swapGen || !this.heapMeta) return;
    if (this.reduce) {
      this.pieces.forEach((pc) => (pc.spr = sp[pc.level]));
      if (this.fallen) this.fallen.spr = sp[0];
      this.startLoop();
      return;
    }
    const tNow = now();
    this.pieces.forEach((pc) => {
      if (pc.dead) return;
      const cs = this.pieceState(pc, tNow);
      if (!cs.hidden) {
        pc.sx = cs.x;
        pc.sy = cs.y;
        pc.sz = cs.sz;
        pc.rot = cs.rot;
      }
      pc.anim = null;
      pc.old = pc.spr;
      pc.prev = null;
      pc.spr = sp[pc.level];
    });
    if (this.fallen) this.fallen.next = sp[0];
    const topY = RIM.cy - this.heapMeta.Hm - this.heapMeta.pw * 0.18;
    const hc = (this.heapCoat = {
      t0: Infinity, dur: 2600, seed: Math.floor(Math.random() * 1e6),
      g: { cx: RIM.cx, cy: topY, x0: RIM.cx - RIM.rx * 1.02, x1: RIM.cx + RIM.rx * 1.02, yb: RIM.cy + RIM.ry + 20 },
    });
    const k = this.kNow();
    this.startPour({ x: this.G.cx, y: this.G.floor - FOOT * k + topY * k, sauce: this.pourColors, flow: 2000, onContact: () => (hc.t0 = now()) });
  }
}
