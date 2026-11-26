// 積み上げ表示（#stack）の物の立体：楕円体・箱・円柱の部品をボクセルに並べ、南から見る 3/4 の絵に焼く。
// 見え方は壁と同じで、高さ1層ごとに画面で1px上へずらす（上面と南の正面が見える）。描画だけに使い、シミュレーションには関わらない。
import { campfire, RAMP } from './sprites';

export interface RawFrame {
  W: number;
  H: number;
  px: Uint8ClampedArray;
  mat: (string | null)[];
  ax: number;
  ay: number;
}

type Rgb = readonly number[];
const RAMPS = RAMP as unknown as Record<string, Rgb[]>;

/** 面の向きと光から明るさの段（1〜4）を選ぶ。光は西の上から当て、平らな上面は 3、南の正面は一段暗い 2、光に向いた斜面だけ 4、東の面は 1 */
const LIGHT = (() => {
  const v = [-0.55, 0.2, 0.81];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((a) => a / n);
})();
function shadeStep(nx: number, ny: number, nz: number): number {
  const s = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  return s > 0.9 ? 4 : s > 0.5 ? 3 : s > 0 ? 2 : 1;
}

interface PartOpt {
  /** 陰影を付けず、この段で塗る */
  flat?: number;
  /** パレットを使わない色 */
  col?: Rgb;
  /** アトラスでの材質（'wisp' は光る、'glint' はきらめき） */
  as?: string;
  /** 明るさの段をボクセルごとにこの幅でばらつかせる（硬貨の山のざらつき） */
  rough?: number;
}

/** ボクセルの格子。x は東、y は南、z は上。足もとの基準点は平たい絵と同じ (ax, ay) で、格子の (x, y) は平たい絵の画素と同じ位置 */
export class Vox {
  readonly n: number;
  readonly mat: (string | null)[];
  readonly col: (Rgb | null)[];
  readonly step: Uint8Array;
  readonly as: (string | null)[];
  constructor(
    readonly W: number,
    readonly D: number,
    readonly L: number,
  ) {
    this.n = W * D * L;
    this.mat = new Array(this.n).fill(null);
    this.col = new Array(this.n).fill(null);
    this.step = new Uint8Array(this.n);
    this.as = new Array(this.n).fill(null);
  }
  idx(x: number, y: number, z: number): number {
    return x < 0 || y < 0 || z < 0 || x >= this.W || y >= this.D || z >= this.L ? -1 : (z * this.D + y) * this.W + x;
  }
  filled(x: number, y: number, z: number): boolean {
    const i = this.idx(x, y, z);
    return i >= 0 && this.mat[i] !== null;
  }
  private put(x: number, y: number, z: number, m: string, nx: number, ny: number, nz: number, o: PartOpt) {
    const i = this.idx(x, y, z);
    if (i < 0) return;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    this.mat[i] = m;
    this.col[i] = o.col ?? null;
    let st = o.flat ?? shadeStep(nx, ny, nz);
    if (o.rough) st = Math.max(1, Math.min(4, st + Math.round((h3(x, y * 64 + z, 7) - 0.5) * 2 * o.rough)));
    this.step[i] = st;
    this.as[i] = o.as ?? null;
  }
  /** 楕円体（中心と三つの半径） */
  ell(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, m: string, o: PartOpt = {}) {
    for (let z = Math.floor(cz - rz); z <= cz + rz; z++)
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          const a = (x + 0.5 - cx) / rx;
          const b = (y + 0.5 - cy) / ry;
          const c = (z + 0.5 - cz) / rz;
          if (a * a + b * b + c * c <= 1) this.put(x, y, z, m, a / rx, b / ry, c / rz, o);
        }
  }
  /** 箱（両端を含む整数の範囲） */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: string, o: PartOpt = {}) {
    const cx = (x0 + x1 + 1) / 2;
    const cy = (y0 + y1 + 1) / 2;
    const cz = (z0 + z1 + 1) / 2;
    const hx = (x1 - x0 + 1) / 2;
    const hy = (y1 - y0 + 1) / 2;
    const hz = (z1 - z0 + 1) / 2;
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          // いちばん近い面の向き
          const a = (x + 0.5 - cx) / hx;
          const b = (y + 0.5 - cy) / hy;
          const c = (z + 0.5 - cz) / hz;
          const A = Math.abs(a);
          const B = Math.abs(b);
          const C = Math.abs(c);
          if (C >= A && C >= B) this.put(x, y, z, m, 0, 0, Math.sign(c) || 1, o);
          else if (B >= A) this.put(x, y, z, m, 0, Math.sign(b), 0, o);
          else this.put(x, y, z, m, Math.sign(a), 0, 0, o);
        }
  }
  /** 縦の楕円柱（足もとの楕円と高さの範囲）。dome を付けると上面を丸める */
  cyl(cx: number, cy: number, rx: number, ry: number, z0: number, z1: number, m: string, o: PartOpt = {}) {
    for (let z = z0; z <= z1; z++)
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          const a = (x + 0.5 - cx) / rx;
          const b = (y + 0.5 - cy) / ry;
          if (a * a + b * b > 1) continue;
          if (z === z1) this.put(x, y, z, m, 0, 0, 1, o);
          else this.put(x, y, z, m, a, b, 0, o);
        }
  }
  /** 1点 */
  dot(x: number, y: number, z: number, m: string, o: PartOpt = {}) {
    this.put(Math.round(x), Math.round(y), Math.round(z), m, 0, 0, 1, o);
  }
}

/**
 * 南から見る 3/4 の絵に焼く。ボクセル (x, y, z) は画面の (x, y − z) の1画素になり、同じ画素では南で高いもの（y + z が大きい）が手前。
 * 輪郭は焼いた後の外形に1回だけ付ける（ボクセルごとに付けると内側に暗い点が出る）。
 */
export function bakeVox(v: Vox, ax: number, ay: number): RawFrame {
  const pad = 1;
  const W = v.W + pad * 2;
  const H = v.D + v.L + pad * 2;
  const oy = v.L + pad;
  const px = new Uint8ClampedArray(W * H * 4);
  const mat: (string | null)[] = new Array(W * H).fill(null);
  const depth = new Int32Array(W * H).fill(-1e9);
  for (let z = 0; z < v.L; z++)
    for (let y = 0; y < v.D; y++)
      for (let x = 0; x < v.W; x++) {
        const i = v.idx(x, y, z);
        const m = v.mat[i];
        if (m === null) continue;
        const sx = x + pad;
        const sy = y - z + oy;
        const p = sy * W + sx;
        if (y + z < depth[p]) continue;
        depth[p] = y + z;
        const c = v.col[i] ?? RAMPS[m]?.[v.step[i]] ?? [255, 0, 255];
        px.set([c[0], c[1], c[2], 255], p * 4);
        mat[p] = v.as[i] ?? m;
      }
  // 外形の外周に輪郭（隣の材質のいちばん暗い段）
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (mat[p] !== null) continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const X = x + dx;
        const Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const q = Y * W + X;
        const m = mat[q];
        if (m === null || m === 'ol') continue;
        const r = RAMPS[m];
        const c = r ? r[0] : [16, 12, 18];
        px.set([c[0], c[1], c[2], 255], p * 4);
        mat[p] = 'ol';
        break;
      }
    }
  return { W, H, px, mat, ax: ax + pad, ay: ay + oy };
}

/** 平たい絵のうち光る画素（炎など）を、焼いた絵の上へ lift 層ぶん持ち上げて重ねる */
function overlayGlow(out: RawFrame, flat: RawFrame, lift: number) {
  for (let y = 0; y < flat.H; y++)
    for (let x = 0; x < flat.W; x++) {
      const p = y * flat.W + x;
      if (flat.mat[p] !== 'wisp') continue;
      const X = x - flat.ax + out.ax;
      const Y = y - flat.ay + out.ay - lift;
      if (X < 0 || Y < 0 || X >= out.W || Y >= out.H) continue;
      const q = Y * out.W + X;
      out.px.set([flat.px[p * 4], flat.px[p * 4 + 1], flat.px[p * 4 + 2], 255], q * 4);
      out.mat[q] = 'wisp';
    }
}

/** 決定的な疑似乱数（0〜1）。描画専用 */
function h3(a: number, b: number, s: number): number {
  let n = (Math.imul(a + s * 31, 374761393) + Math.imul(b, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// ===== 物の立体 =====

/** 焚き火：石の輪（2層）と組んだ薪。炎は平たい絵のまま立てる */
export function campfire3(f: number): RawFrame {
  const v = new Vox(20, 16, 6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.283;
    v.ell(10 + Math.cos(a) * 7, 10.5 + Math.sin(a) * 4.2, 0.6, 1.7, 1.4, 1.5, 'iron');
  }
  v.box(5, 10, 0, 15, 11, 0, 'wood');
  v.box(9, 7, 1, 11, 14, 1, 'wood');
  const out = bakeVox(v, 10, 13);
  overlayGlow(out, campfire(f) as RawFrame, 2);
  return out;
}

/** ヴァンパイアの棺：頭の側が広い六角形の箱（4層）と、金の十字。open：蓋がずれて赤い内張りが見える */
export function coffin3(open: boolean): RawFrame {
  const v = new Vox(21, 25, 5);
  const half = (y: number) => (y < 7 ? 3 + (y - 2) * 0.6 : 6 - (y - 7) * (3 / 15));
  const lid = (dx: number, dy: number, m: string, z: number) => {
    for (let y = 2; y <= 22; y++) {
      const hw = half(y);
      v.box(Math.round(10 - hw + dx), y + dy, z, Math.round(10 + hw + dx) - 1, y + dy, z, m);
    }
  };
  for (let y = 2; y <= 22; y++) {
    const hw = half(y);
    v.box(Math.round(10 - hw), y, 0, Math.round(10 + hw) - 1, y, 2, 'cape');
  }
  if (open) {
    for (let y = 4; y <= 20; y++) {
      const hw = half(y) - 1.2;
      v.box(Math.round(10 - hw), y, 2, Math.round(10 + hw) - 1, y, 2, 'capeR', { flat: 1 });
    }
    lid(4, 2, 'cape', 3);
    v.box(13, 9, 4, 13, 16, 4, 'gold', { flat: 3 });
    v.box(11, 12, 4, 15, 12, 4, 'gold', { flat: 3 });
  } else {
    lid(0, 0, 'cape', 3);
    v.box(10, 5, 4, 10, 15, 4, 'gold', { flat: 3 });
    v.box(8, 9, 4, 12, 9, 4, 'gold', { flat: 3 });
  }
  return bakeVox(v, 10, 22);
}

/** 墓標：盛り土と、木の十字（rank 1）か石の墓石（rank 2〜3）。持ち主の色の布を巻く。rank 3 は剣を添える */
export function grave3(rank: number, color: number): RawFrame {
  const v = new Vox(16, 18, 12);
  const pc = `pc${Math.min(5, color)}`;
  v.ell(8, 14.5, 0, 6, 3, 1.6, 'soil');
  if (rank <= 1) {
    v.box(7, 14, 0, 8, 14, 10, 'wood');
    v.box(4, 14, 7, 11, 14, 8, 'wood');
    v.box(7, 15, 5, 8, 15, 6, pc);
  } else {
    v.box(4, 13, 0, 11, 15, 7, 'stone');
    v.ell(8, 14, 7.5, 3.5, 1.5, 2.5, 'stone');
    v.box(7, 16, 3, 8, 16, 6, 'stone', { flat: 1 });
    v.box(4, 16, 1, 11, 16, 1, pc);
    if (rank >= 3) {
      v.box(13, 14, 0, 13, 14, 11, 'mail');
      v.box(12, 14, 9, 14, 14, 9, 'goldT');
    }
  }
  return bakeVox(v, 8, 15);
}

/** 物資の置き場：木箱（7層）と巻いた毛布。tier 0 は空の残骸、1 は袋だけ、2 は袋と包みが載る */
export function supply3(tier: number): RawFrame {
  const v = new Vox(30, 23, 11);
  if (tier === 0) {
    v.box(8, 10, 0, 19, 18, 3, 'wood');
    v.box(9, 11, 1, 18, 17, 3, 'char', { flat: 1 });
    v.box(21, 15, 0, 28, 17, 0, 'wood');
    v.box(1, 17, 0, 6, 19, 0, 'wood');
    v.cyl(14, 21, 8, 1.2, 0, 0, 'leather');
    return bakeVox(v, 14, 21);
  }
  v.box(3, 11, 0, 16, 20, 6, 'wood');
  for (const z of [2, 4]) v.box(3, 20, z, 16, 20, z, 'wood', { flat: 1 });
  v.box(9, 20, 0, 9, 20, 6, 'wood', { flat: 1 });
  for (const [x, y] of [
    [3, 20],
    [16, 20],
  ])
    v.box(x, y, 0, x, y, 6, 'iron');
  // 毛布：横に寝かせた円柱
  for (let x = 17; x <= 28; x++) v.ell(x, 17.5, 2.5, 1, 3, 2.6, 'tabard');
  v.box(20, 14, 0, 20, 21, 5, 'leather');
  v.box(25, 14, 0, 25, 21, 5, 'leather');
  // 中身
  v.ell(10, 15, 8, 4, 3, 2.2, 'rag');
  if (tier === 2) {
    v.ell(6, 14, 7.6, 2.4, 2, 1.6, 'leather');
    v.ell(14, 16, 7.6, 2.2, 2, 1.6, 'rag');
  }
  return bakeVox(v, 12, 20);
}

/** 蟻塚：土のドーム（6層）と、てっぺんの穴 */
export function anthill3(): RawFrame {
  const v = new Vox(24, 15, 6);
  v.ell(12, 8.5, 0, 11, 5.5, 5, 'soil', { rough: 0.6 });
  v.cyl(12, 8.5, 1.6, 1.2, 4, 5, 'soil', { flat: 0 });
  for (const [x, y] of [
    [4, 10],
    [7, 11],
    [17, 11],
    [20, 9],
    [9, 6],
    [15, 5],
  ])
    for (let z = 5; z >= 0; z--)
      if (v.filled(x, y, z)) {
        v.dot(x, y, z, 'soil', { flat: 4 });
        break;
      }
  return bakeVox(v, 12, 14);
}

/** 金貨の山のドーム：表面に硬貨の明るい点と宝石を散らす */
function goldMound(v: Vox, cx: number, cy: number, rx: number, ry: number, rz: number, seed: number) {
  v.ell(cx, cy, 0, rx, ry, rz, 'gold', { rough: 1.2 });
  const n = Math.round(rx * ry * 0.8);
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx + (h3(i, seed, 1) - 0.5) * rx * 1.8);
    const y = Math.round(cy + (h3(i, seed, 2) - 0.5) * ry * 1.8);
    for (let z = v.L - 1; z >= 0; z--)
      if (v.filled(x, y, z)) {
        const g = i % 11 === 0 ? RAMPS.gemR[3] : i % 13 === 0 ? RAMPS.gemB[3] : i % 17 === 0 ? RAMPS.gemG[3] : RAMPS.gold[i % 2 ? 4 : 2];
        v.dot(x, y, z, 'gold', { col: g });
        break;
      }
  }
}
/** きらめき：表面の点を光らせる（コマごとに場所が変わる） */
function sparkle(v: Vox, n: number, q: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(h3(i, q + seed, 3) * v.W);
    const y = Math.floor(h3(i, q + seed, 4) * v.D);
    for (let z = v.L - 1; z >= 0; z--)
      if (v.filled(x, y, z)) {
        v.dot(x, y, z, 'gold', { col: [255, 250, 220], as: 'glint' });
        break;
      }
  }
}

/** 小さな宝（size 0〜2）：金貨のドーム（3〜5層） */
export function treasure3(size: number, f: number): RawFrame {
  const W = [16, 24, 32][size];
  const D = [10, 14, 18][size];
  const rz = [2.6, 4, 5.6][size];
  const v = new Vox(W, D, Math.ceil(rz) + 1);
  const ry = [3, 4.5, 6][size];
  goldMound(v, W / 2, D - 1 - ry, [5, 8, 11][size], ry, rz, size + 1);
  sparkle(v, 1 + size, f & 3, 50);
  return bakeVox(v, Math.round(W / 2), D - 1);
}

/** 箱（宝箱か石の箱）。open は蓋を開けて金貨が見える */
function chest3(v: Vox, x: number, y: number, stone: boolean, open: boolean) {
  const m = stone ? 'stone' : 'wood';
  v.box(x, y, 0, x + 8, y + 4, 4, m);
  if (!stone)
    for (const bx of [x + 2, x + 6]) {
      v.box(bx, y + 4, 0, bx, y + 4, 4, 'iron');
      v.box(bx, y, 4, bx, y + 4, 4, 'iron');
    }
  if (open) {
    v.box(x + 1, y + 1, 4, x + 7, y + 3, 4, 'gold', { flat: 4 });
    v.box(x, y - 1, 4, x + 8, y - 1, 8, m);
  }
}

/** 宝の山（tier 0〜4、持ち主ごと）：金貨のドームと宝箱。持ち主の飾りはまだ平たい絵に無いものを足さない */
export function hoard3(tier: number, owner: string, f: number): RawFrame {
  const big = owner === 'dragon' && tier >= 3;
  const W = [18, 24, 32, 44, big ? 64 : 56][tier];
  const D = [10, 16, 22, 32, big ? 50 : 42][tier];
  const rz = [1, 3, 5, 8, big ? 14 : 11][tier];
  const v = new Vox(W, D, rz + 10);
  const cx = W / 2;
  /** 山の奥行きの半径は幅の半分ほど。足もとの南の端を平たい絵の底にそろえる */
  const base = D - 2;
  const stone = owner === 'vault';
  if (tier === 0) {
    for (let i = 0; i < 5; i++) v.box(Math.round(3 + h3(i, 1, 43) * (W - 7)), Math.round(2 + h3(i, 2, 43) * (D - 4)), 0, Math.round(3 + h3(i, 1, 43) * (W - 7)) + 1, Math.round(2 + h3(i, 2, 43) * (D - 4)), 0, 'gold');
  } else if (tier === 1) goldMound(v, cx, base - 3.5, 6, 3.5, 3, 1);
  else if (tier === 2) {
    goldMound(v, cx - 2, base - 5, 9, 5, 5, 2);
    chest3(v, Math.round(cx + 2), base - 6, stone, false);
  } else if (tier === 3) {
    goldMound(v, cx - 3, base - 8, 15, 8, 8, 3);
    chest3(v, Math.round(cx + 5), base - 5, stone, true);
  } else {
    const rx = big ? 28 : 22;
    const ry = big ? 14 : 11;
    goldMound(v, cx, base - ry, rx, ry, rz, 4);
    chest3(v, Math.round(cx - rx + 2), base - 6, stone, true);
    chest3(v, Math.round(cx + rx - 12), base - 7, stone, false);
  }
  sparkle(v, 1 + tier, f & 1, 60 + tier * 3);
  return bakeVox(v, Math.round(cx), D - 2);
}



