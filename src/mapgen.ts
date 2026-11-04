import { Rng, hashSeed } from './rng';

export const TILE = 16;
export const MAP_W = 192;
export const MAP_H = 144;

export interface Shaft {
  x: number;
  y: number;
}
export interface MossPatch {
  x: number;
  y: number;
  r: number;
}
export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface MapData {
  seed: string;
  w: number;
  h: number;
  /** 1 = 岩（壁）、0 = 床 */
  solid: Uint8Array;
  /** 苔の濃さ 0..255（マス単位） */
  moss: Uint8Array;
  /** 1 = 人の手で敷いた石畳（部屋・通路・入口）、0 = 自然の岩床 */
  paved: Uint8Array;
  shafts: Shaft[];
  patches: MossPatch[];
  rooms: Room[];
  entrance: { x: number; y: number };
  /** 床の見えない高さ 0..255（水は低い方へ流れる） */
  height: Uint8Array;
  /** 地の湿り気 0..255 */
  humidity: Uint8Array;
  /** 1 = 溶岩 */
  lava: Uint8Array;
  /** 湧き水（phase は水量の波の位相。単位は tick） */
  springs: { x: number; y: number; phase: number }[];
  /** 吸い込み穴（地下へ水が抜ける） */
  sinks: { x: number; y: number }[];
  /** はじめの養分（整数） */
  nutrients: Int32Array;
  /** 1 = 生き物が掘った床（崩れた岩のかけらが散らばる） */
  dug: Uint8Array;
  /** 1 = 宝物庫 */
  vault: Uint8Array;
  /** 宝物庫の宝の山の位置（なければ -1） */
  vaultCenter: { x: number; y: number };
  /** 未踏の深部（ワームが眠る場所、古い宝の山） */
  deep: { x: number; y: number };
  /** ミノタウロスの寝床：深部の暗い行き止まりの奥（なければ -1）。そのまわり LAIR_R マスが縄張り */
  lair: { x: number; y: number };
  /** 生成時の古い宝の山（タイル座標と金貨の量） */
  hoards: { x: number; y: number; gold: number }[];
  /** 1 = 岩の中に閉じた空洞の床（まだ掘り当てられていない） */
  sealed: Uint8Array;
  /** 1 = 瓦礫（通れないが掘り直しやすい土砂の山。solid も 1） */
  rubble: Uint8Array;
  /**
   * 外とつながる口（閉じた空洞の中にあり、掘り当てると開く）。
   * kind：0 地表へ通じる横穴（地図の左右の端）、1 地底へ通じる裂け目（深部）、2 地下の川が流れ込む口（湧き水の上の壁）。
   * x, y はタイル。横穴は端の開いたマス、裂け目は裂け目の真ん中のマス、川の口は湧き水のマス（その上の壁に口が開く）
   */
  mouths: { kind: number; x: number; y: number }[];
  /** 岩の硬さ：0 柔らかい（砂岩や粘土の層）、1 ふつう、2 硬い（花崗岩）。掘ったあとも元の硬さを覚えている */
  hard: Uint8Array;
}

/** 溶岩を除いた床がすべて入口から歩いて行けるか */
function walkableConnected(solid: Uint8Array, lava: Uint8Array, W: number, H: number, start: number): boolean {
  const seen = new Uint8Array(W * H);
  const q = new Int32Array(W * H);
  let qh = 0;
  let qt = 0;
  q[qt++] = start;
  seen[start] = 1;
  let n = 0;
  while (qh < qt) {
    const c = q[qh++];
    n++;
    const x = c % W;
    const y = (c / W) | 0;
    const ns = [x + 1 < W ? c + 1 : -1, x > 0 ? c - 1 : -1, y + 1 < H ? c + W : -1, y > 0 ? c - W : -1];
    for (const k of ns) {
      if (k < 0 || seen[k] || solid[k] || lava[k]) continue;
      seen[k] = 1;
      q[qt++] = k;
    }
  }
  let total = 0;
  for (let k = 0; k < W * H; k++) if (!solid[k] && !lava[k]) total++;
  return n === total;
}

/** 格子点の乱数を双線形補間するノイズ（整数演算のみ）。0..255 */
function valueNoise(rng: Rng, W: number, H: number, S: number): Uint8Array {
  const gw = Math.floor(W / S) + 2;
  const gh = Math.floor(H / S) + 2;
  const g = new Uint8Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng.int(256);
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gx = Math.floor(x / S);
      const gy = Math.floor(y / S);
      const fx = x - gx * S;
      const fy = y - gy * S;
      const a = g[gy * gw + gx];
      const b = g[gy * gw + gx + 1];
      const c = g[(gy + 1) * gw + gx];
      const d = g[(gy + 1) * gw + gx + 1];
      out[y * W + x] = Math.floor((a * (S - fx) * (S - fy) + b * fx * (S - fy) + c * (S - fx) * fy + d * fx * fy) / (S * S));
    }
  return out;
}

/**
 * シードからダンジョンを生成する。整数演算と平方根だけを使い、どの端末でも同じ結果になる。
 */
export function generate(seed: string): MapData {
  const rng = new Rng(hashSeed(seed));
  const W = MAP_W;
  const H = MAP_H;
  let solid = new Uint8Array(W * H);
  const id = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const S = (x: number, y: number) => (inb(x, y) ? solid[id(x, y)] : 1);
  const border = (x: number, y: number) => x < 2 || y < 2 || x >= W - 2 || y >= H - 2;

  // 1. 洞窟の種
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) solid[id(x, y)] = border(x, y) ? 1 : rng.chance(0.49) ? 1 : 0;

  // 2. セルオートマトンでなめらかな洞窟にする
  for (let it = 0; it < 5; it++) {
    const next = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (border(x, y)) {
          next[id(x, y)] = 1;
          continue;
        }
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += S(x + dx, y + dy);
        next[id(x, y)] = n > 4 ? 1 : n < 4 ? 0 : solid[id(x, y)];
      }
    solid = next;
  }

  const paved = new Uint8Array(W * H);
  const setFloor = (x: number, y: number) => {
    if (x >= 2 && y >= 2 && x < W - 2 && y < H - 2) {
      solid[id(x, y)] = 0;
      paved[id(x, y)] = 1;
    }
  };

  // 3. 石積みの部屋（柱つきのものもある）
  const rooms: Room[] = [];
  const nRooms = rng.range(8, 12);
  for (let k = 0; k < nRooms * 6 && rooms.length < nRooms; k++) {
    const rw = rng.range(8, 15);
    const rh = rng.range(7, 11);
    const rx = rng.range(4, W - rw - 5);
    const ry = rng.range(4, H - rh - 5);
    let ok = true;
    for (const r of rooms)
      if (rx < r.x + r.w + 4 && rx + rw + 4 > r.x && ry < r.y + r.h + 4 && ry + rh + 4 > r.y) ok = false;
    if (!ok) continue;
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) setFloor(x, y);
    rooms.push({ x: rx, y: ry, w: rw, h: rh });
  }

  // 4. 部屋どうしを通路でつなぐ
  const carve2 = (x: number, y: number) => {
    setFloor(x, y);
    setFloor(x + 1, y);
    setFloor(x, y + 1);
    setFloor(x + 1, y + 1);
  };
  const order = rooms
    .map((r, i) => ({ i, cx: r.x + (r.w >> 1) }))
    .sort((a, b) => a.cx - b.cx || a.i - b.i);
  for (let k = 1; k < order.length; k++) {
    const a = rooms[order[k - 1].i];
    const b = rooms[order[k].i];
    const ax = a.x + (a.w >> 1);
    const ay = a.y + (a.h >> 1);
    const bx = b.x + (b.w >> 1);
    const by = b.y + (b.h >> 1);
    if (rng.chance(0.5)) {
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) carve2(x, ay);
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) carve2(bx, y);
    } else {
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) carve2(ax, y);
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) carve2(x, by);
    }
  }

  // 柱（上面＋正面の2マス）を部屋に立てる。通路を掘ったあとに置く
  for (const r of rooms) {
    if (r.w < 10 || r.h < 8 || !rng.chance(0.65)) continue;
    const rowsY = r.h >= 10 ? [r.y + 2, r.y + r.h - 4] : [r.y + 2];
    for (const py of rowsY)
      for (let px = r.x + 2; px <= r.x + r.w - 3; px += 4) {
        solid[id(px, py)] = 1;
        solid[id(px, py + 1)] = 1;
      }
  }

  // 5. つながっていない空洞は埋める（一番大きな空洞だけ残す）
  const region = new Int32Array(W * H).fill(-1);
  const stack = new Int32Array(W * H);
  let best = -1;
  let bestSize = 0;
  let nReg = 0;
  for (let s = 0; s < W * H; s++) {
    if (solid[s] || region[s] >= 0) continue;
    let sp = 0;
    stack[sp++] = s;
    region[s] = nReg;
    let size = 0;
    while (sp > 0) {
      const c = stack[--sp];
      size++;
      const cx = c % W;
      const cy = (c / W) | 0;
      const nb = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (const [nx, ny] of nb) {
        if (!inb(nx, ny)) continue;
        const n = id(nx, ny);
        if (!solid[n] && region[n] < 0) {
          region[n] = nReg;
          stack[sp++] = n;
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = nReg;
    }
    nReg++;
  }
  for (let s = 0; s < W * H; s++) if (!solid[s] && region[s] !== best) solid[s] = 1;
  for (let s = 0; s < W * H; s++) if (solid[s]) paved[s] = 0;

  // 6. 孤立した1マスの岩は崩す
  for (let pass = 0; pass < 2; pass++)
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) {
        if (!solid[id(x, y)]) continue;
        const n = S(x + 1, y) + S(x - 1, y) + S(x, y + 1) + S(x, y - 1);
        if (n === 0) solid[id(x, y)] = 0;
      }

  // 7. 入口：地上（マップの上端）から一番近い所へ通路を掘る
  let ex = W >> 1;
  let ey = H;
  for (let x = W >> 2; x < (W * 3) >> 2; x++) {
    for (let y = 2; y < H - 2; y++)
      if (!solid[id(x, y)] && !solid[id(x + 1, y)]) {
        if (y < ey) {
          ey = y;
          ex = x;
        }
        break;
      }
  }
  for (let y = 0; y <= ey; y++) {
    solid[id(ex, y)] = 0;
    solid[id(ex + 1, y)] = 0;
    paved[id(ex, y)] = 1;
    paved[id(ex + 1, y)] = 1;
  }

  // 8. 天井の裂け目（光の筋が差す所）：開けた床から、間隔をあけて選ぶ
  const cands: number[] = [];
  for (let y = 6; y < H - 6; y++)
    for (let x = 6; x < W - 6; x++) {
      let open = true;
      for (let dy = -2; dy <= 2 && open; dy++)
        for (let dx = -2; dx <= 2; dx++)
          if (solid[id(x + dx, y + dy)]) {
            open = false;
            break;
          }
      if (open) cands.push(id(x, y));
    }
  rng.shuffle(cands);
  const shafts: Shaft[] = [];
  for (const c of cands) {
    if (shafts.length >= 11) break;
    const x = c % W;
    const y = (c / W) | 0;
    let far = true;
    for (const s of shafts) if ((s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < 18 * 18) far = false;
    if (far) shafts.push({ x, y });
  }

  // 9. 光る苔：光の筋の下に群落、ほかにも暗がりに点々と
  const patches: MossPatch[] = [];
  for (const s of shafts) {
    const n = rng.range(2, 3);
    for (let k = 0; k < n; k++) {
      const x = s.x + rng.range(-3, 3);
      const y = s.y + rng.range(-3, 3);
      if (!solid[id(x, y)]) patches.push({ x, y, r: rng.range(1, 3) });
    }
  }
  let tries = 0;
  let extra = 0;
  while (extra < 28 && tries++ < 400) {
    const x = rng.range(4, W - 5);
    const y = rng.range(4, H - 5);
    if (solid[id(x, y)]) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += solid[id(x + dx, y + dy)] ? 0 : 1;
    if (n < 7) continue;
    patches.push({ x, y, r: rng.range(1, 2) });
    extra++;
  }
  const moss = new Uint8Array(W * H);
  for (const p of patches) {
    const R = p.r + 1;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (!inb(x, y) || solid[id(x, y)]) continue;
        const v = 1 - Math.sqrt(dx * dx + dy * dy) / (p.r + 0.6);
        if (v <= 0) continue;
        const m = Math.round(Math.min(1, v) * 230);
        if (m > moss[id(x, y)]) moss[id(x, y)] = m;
      }
  }

  for (let s = 0; s < W * H; s++) if (solid[s]) paved[s] = 0;

  // ---- 段階2：高さ、湿り気、溶岩、湧き水、吸い込み穴、養分（地形とは別の乱数列で、地形は段階1と同じまま） ----
  const env = new Rng(hashSeed(seed + ':env'));
  const n1 = valueNoise(env, W, H, 16);
  const n2 = valueNoise(env, W, H, 6);
  const height = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) height[k] = Math.floor((n1[k] * 2 + n2[k]) / 3);
  // 部屋と通路はならして平らに近づける
  for (let k = 0; k < W * H; k++) if (paved[k]) height[k] = Math.floor((height[k] + 128) / 2);
  const n3 = valueNoise(env, W, H, 10);
  const humidity = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) humidity[k] = Math.min(255, ((255 - height[k]) >> 2) + Math.floor((n3[k] * 110) / 255));

  // 入口からの道のり（溶岩を奥に置くため）
  const dist = new Int32Array(W * H).fill(-1);
  {
    let qh = 0;
    let qt = 0;
    const q = new Int32Array(W * H);
    const e0 = id(ex, 0);
    dist[e0] = 0;
    q[qt++] = e0;
    while (qh < qt) {
      const c = q[qh++];
      const cx = c % W;
      const cy = (c / W) | 0;
      const nb = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (const [nx, ny] of nb) {
        if (!inb(nx, ny)) continue;
        const n = id(nx, ny);
        if (solid[n] || dist[n] >= 0) continue;
        dist[n] = dist[c] + 1;
        q[qt++] = n;
      }
    }
  }
  let maxD = 0;
  for (let k = 0; k < W * H; k++) if (dist[k] > maxD) maxD = dist[k];

  const lava = new Uint8Array(W * H);
  const lavaCands: number[] = [];
  for (let y = 6; y < H - 6; y++)
    for (let x = 6; x < W - 6; x++) {
      const k = id(x, y);
      if (dist[k] < (maxD * 7) / 10) continue;
      let open = true;
      for (let dy = -2; dy <= 2 && open; dy++)
        for (let dx = -2; dx <= 2; dx++)
          if (solid[id(x + dx, y + dy)]) {
            open = false;
            break;
          }
      if (!open) continue;
      let nearShaft = false;
      for (const s2 of shafts) if (Math.abs(s2.x - x) < 12 && Math.abs(s2.y - y) < 12) nearShaft = true;
      if (!nearShaft) lavaCands.push(k);
    }
  env.shuffle(lavaCands);
  const lavaCenters: number[] = [];
  const nLava = env.range(1, 2);
  for (const c of lavaCands) {
    if (lavaCenters.length >= nLava) break;
    const x = c % W;
    const y = (c / W) | 0;
    if (lavaCenters.some((o) => Math.abs((o % W) - x) < 24 && Math.abs(((o / W) | 0) - y) < 24)) continue;
    const r = env.range(2, 3);
    const placed: number[] = [];
    for (let dy = -r - 1; dy <= r + 1; dy++)
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const k = id(x + dx, y + dy);
        if (solid[k]) continue;
        const d = Math.sqrt(dx * dx + dy * dy) + (env.int(100) / 100) * 1.2;
        if (d <= r + 0.4 && !lava[k]) {
          lava[k] = 1;
          placed.push(k);
        }
      }
    // 溶岩が道を断ち切るなら置かない（歩く生き物にとって、ダンジョンは一続きのまま）
    if (!walkableConnected(solid, lava, W, H, id(ex, 0))) {
      for (const k of placed) lava[k] = 0;
      continue;
    }
    for (const k of placed) moss[k] = 0;
    lavaCenters.push(c);
  }

  // 湧き水：光の筋の近くの高い所
  const springs: { x: number; y: number; phase: number }[] = [];
  const nSprings = env.range(3, 4);
  for (let tries = 0; tries < 20 && springs.length < nSprings && shafts.length > 0; tries++) {
    const s2 = shafts[env.int(shafts.length)];
    let best = -1;
    let bh = -1;
    for (let dy = -7; dy <= 7; dy++)
      for (let dx = -7; dx <= 7; dx++) {
        const x = s2.x + dx;
        const y = s2.y + dy;
        if (!inb(x, y)) continue;
        const k = id(x, y);
        if (solid[k] || lava[k]) continue;
        if (height[k] > bh) {
          bh = height[k];
          best = k;
        }
      }
    if (best < 0) continue;
    const bx = best % W;
    const by = (best / W) | 0;
    if (springs.some((p) => Math.abs(p.x - bx) < 10 && Math.abs(p.y - by) < 10)) continue;
    springs.push({ x: bx, y: by, phase: env.int(1 << 20) });
  }

  // 吸い込み穴：低い所から、間隔をあけて
  const lows: number[] = [];
  for (let k = 0; k < W * H; k++) if (!solid[k] && !lava[k] && !paved[k]) lows.push(k);
  lows.sort((a, b) => height[a] - height[b] || a - b);
  const sinks: { x: number; y: number }[] = [];
  for (const k of lows) {
    if (sinks.length >= 6) break;
    const x = k % W;
    const y = (k / W) | 0;
    if (sinks.some((p) => Math.abs(p.x - x) < 22 && Math.abs(p.y - y) < 22)) continue;
    if (springs.some((p) => Math.abs(p.x - x) < 8 && Math.abs(p.y - y) < 8)) continue;
    sinks.push({ x, y });
  }

  // はじめの養分
  const n4 = valueNoise(env, W, H, 8);
  const nutrients = new Int32Array(W * H);
  for (let k = 0; k < W * H; k++) if (!solid[k] && !lava[k]) nutrients[k] = 28 + (n4[k] >> 3);

  // 宝物庫と未踏の深部（ほかの地形を変えないよう、最後に別の乱数で）
  const vault = new Uint8Array(W * H);
  const vaultCenter = carveVault(seed, W, H, solid, lava, paved, height, humidity, nutrients, vault);
  const deep = findDeep(W, H, solid, lava, vault, ex, shafts);
  const hoards: { x: number; y: number; gold: number }[] = [];
  if (vaultCenter.x >= 0) hoards.push({ x: vaultCenter.x, y: vaultCenter.y, gold: 400 });
  if (deep.x >= 0) hoards.push({ x: deep.x, y: deep.y, gold: 250 });

  const sealed = sealPockets(seed, W, H, solid, lava, vault, ex, shafts, springs, height, humidity);
  const mouths = placeMouths(seed, W, H, solid, sealed, lava, vault, deep, springs);
  const lair = findLair(W, H, solid, lava, paved, vault, ex, shafts, springs, deep, vaultCenter);
  const hard = rockHardness(seed, W, H);

  return {
    seed, w: W, h: H, solid, moss, paved, shafts, patches, rooms, entrance: { x: ex, y: 0 },
    height, humidity, lava, springs, sinks, nutrients, dug: new Uint8Array(W * H), vault, vaultCenter, deep, lair, hoards,
    sealed, rubble: new Uint8Array(W * H), mouths, hard,
  };
}

/**
 * 岩の硬さ。地層のように、ゆるく波打ちながら横に伸びる帯（柔らかい、ふつう、硬い）を重ね、
 * 硬い岩塊と、柔らかい割れ目の筋を散らす。整数演算だけで作る
 */
function rockHardness(seed: string, W: number, H: number): Uint8Array {
  const r = new Rng(hashSeed(seed + ':hard'));
  const warp = valueNoise(r, W, H, 24);
  const warp2 = valueNoise(r, W, H, 9);
  const blob = valueNoise(r, W, H, 11);
  const seam = valueNoise(r, W, H, 6);
  const layers = [0, 1, 1, 2, 1, 0, 1, 2, 2, 1];
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      // 帯の高さは7マスほど。ゆがみで波打つ
      const v = y * 256 + warp[k] * 18 + warp2[k] * 4;
      let h = layers[Math.floor(v / (7 * 256)) % layers.length];
      if (blob[k] > 205) h = 2;
      else if (blob[k] < 40) h = Math.min(h, 1);
      if (seam[k] > 236) h = 0;
      out[k] = h;
    }
  return out;
}

/**
 * 外とつながる口を置く。どれも閉じた空洞の中にあるので、掘り当てるまでは開かない。
 * 横穴：地図の左右それぞれ、端にいちばん近い閉じた空洞の床から、端までまっすぐ横に掘る（端のマスが口）。
 * 裂け目：深部にいちばん近い閉じた空洞の床。
 * 川の口：閉じた空洞の中の湧き水のうち、真上が岩のもの（なければ真上を岩にして口にする）。
 */
function placeMouths(seed: string, W: number, H: number, solid: Uint8Array, sealed: Uint8Array, lava: Uint8Array, vault: Uint8Array, deep: { x: number; y: number }, springs: { x: number; y: number }[]): { kind: number; x: number; y: number }[] {
  const r = new Rng(hashSeed(seed + ':mouths'));
  const out: { kind: number; x: number; y: number }[] = [];
  const ok = (k: number) => sealed[k] && !solid[k] && !lava[k] && !vault[k];
  // 一つ目の横穴：始まりの洞窟の近く（6〜14マス先）の閉じた空洞から、上の端へまっすぐ掘る。掘り手が数日で掘り当てる距離
  {
    const ex = Math.floor(W / 2);
    let best = -1;
    let bv = 1e9;
    for (let y = 3; y < 40; y++)
      for (let x = 6; x < W - 6; x++) {
        const k = y * W + x;
        if (!ok(k)) continue;
        let near = 99;
        for (let dy = -14; dy <= 14; dy++)
          for (let dx = -14; dx <= 14; dx++) {
            const q = (y + dy) * W + x + dx;
            if (q < 0 || q >= W * H || solid[q] || sealed[q] || lava[q]) continue;
            near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
          }
        if (near < 6 || near > 14) continue;
        // 上の端まで、開いた洞窟を横切らずに掘れること
        let clear = true;
        for (let yy = y - 1; yy >= 0 && clear; yy--) {
          const q = yy * W + x;
          if ((!solid[q] && !sealed[q]) || lava[q] || vault[q]) clear = false;
        }
        if (!clear) continue;
        const v = y * 4 + near + r.int(6) - Math.min(30, Math.abs(x - ex)) * 0.2;
        if (v < bv) {
          bv = v;
          best = k;
        }
      }
    if (best >= 0) {
      const x = best % W;
      const y0 = Math.floor(best / W);
      for (let y = y0; y >= 0; y--) {
        const wide = y <= 2;
        for (const dx of wide ? [-1, 0, 1] : [0]) {
          const k = y * W + x + dx;
          solid[k] = 0;
          sealed[k] = 1;
          lava[k] = 0;
        }
      }
      out.push({ kind: 0, x, y: 0 });
    }
  }
  // 二つ目の横穴：左右の端のうち、始まりの洞窟から遠い側
  for (const side of [0, 1]) {
    if (out.length && side === (out[0].x < W / 2 ? 0 : 1)) continue;
    let best = -1;
    let bd = 1e9;
    for (let y = 8; y < H - 8; y++)
      for (let x = 2; x < W - 2; x++) {
        const k = y * W + x;
        if (!ok(k)) continue;
        const d = side === 0 ? x : W - 1 - x;
        const v = d * 10 + r.int(8);
        if (v < bd) {
          bd = v;
          best = k;
        }
      }
    if (best < 0) continue;
    const y = Math.floor(best / W);
    const x0 = best % W;
    const step = side === 0 ? -1 : 1;
    for (let x = x0; side === 0 ? x >= 0 : x < W; x += step) {
      // 端の3マスは、口らしく3マスの高さに広げる
      const wide = side === 0 ? x <= 2 : x >= W - 3;
      for (const dy of wide ? [-1, 0, 1] : [0]) {
        const k = (y + dy) * W + x;
        solid[k] = 0;
        sealed[k] = 1;
        lava[k] = 0;
      }
    }
    out.push({ kind: 0, x: side === 0 ? 0 : W - 1, y });
  }
  {
    let best = -1;
    let bd = 1e9;
    for (let k = 0; k < W * H; k++) {
      if (!ok(k)) continue;
      const x = k % W;
      const y = Math.floor(k / W);
      // 裂け目のまわりにも床があるように
      let floor = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!solid[k + dy * W + dx]) floor++;
      if (floor < 16) continue;
      // 地表の横穴から離れた所に
      if (out.some((o) => Math.abs(o.x - x) + Math.abs(o.y - y) < 50)) continue;
      const d = Math.abs(x - deep.x) + Math.abs(y - deep.y);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    if (best >= 0) out.push({ kind: 1, x: best % W, y: Math.floor(best / W) });
  }
  {
    const cand = springs.filter((sp) => ok(sp.y * W + sp.x) && sp.y > 2);
    const sp = cand.find((q) => solid[(q.y - 1) * W + q.x]) ?? cand[0];
    if (sp) {
      solid[(sp.y - 1) * W + sp.x] = 1;
      out.push({ kind: 2, x: sp.x, y: sp.y });
    }
  }
  return out;
}

/** 開いた洞窟の広さ（地図の約12分の1） */
export const OPEN_AREA = Math.round((MAP_W * MAP_H) / 12);

/**
 * ダンジョンの大部分を、岩の中に閉じた空洞にする。
 * 入口から歩いて近い順に OPEN_AREA マスだけを開いた洞窟として残し、その外側に厚さ2マスの岩の帯を置いて隔てる。
 * 残りの床は、いくつかの空洞に分け（境目は厚さ1マスの岩）、すべて「閉じた空洞」とする。
 * 開いた洞窟には光の筋と湧き水を少なくとも一つずつ置く。
 */
function sealPockets(seed: string, W: number, H: number, solid: Uint8Array, lava: Uint8Array, vault: Uint8Array, ex: number, shafts: Shaft[], springs: { x: number; y: number; phase: number }[], height: Uint8Array, humidity: Uint8Array): Uint8Array {
  const r = new Rng(hashSeed(seed + ':seal'));
  const N = W * H;
  const dist = new Int32Array(N).fill(-1);
  const order: number[] = [];
  const q = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  const start = 1 * W + ex;
  dist[start] = 0;
  q[qt++] = start;
  while (qh < qt) {
    const c = q[qh++];
    order.push(c);
    const x = c % W;
    const y = (c / W) | 0;
    for (const n of [x + 1 < W ? c + 1 : -1, x > 0 ? c - 1 : -1, y + 1 < H ? c + W : -1, y > 0 ? c - W : -1]) {
      if (n < 0 || dist[n] >= 0 || solid[n] || lava[n]) continue;
      dist[n] = dist[c] + 1;
      q[qt++] = n;
    }
  }
  const nOpen = Math.min(OPEN_AREA, Math.floor(order.length * 0.3));
  const dMax = dist[order[Math.max(0, nOpen - 1)]];
  const sealed = new Uint8Array(N);
  // 開いた洞窟の外側に、厚さ2マスの岩の帯
  for (let k = 0; k < N; k++) {
    if (solid[k] || lava[k]) continue;
    if (dist[k] >= 0 && dist[k] <= dMax) continue;
    if (dist[k] > dMax && dist[k] <= dMax + 2 && !vault[k]) {
      solid[k] = 1;
      continue;
    }
    sealed[k] = 1;
  }
  // 閉じた床を、いくつかの空洞に分ける（種から広げて、ぶつかった所を岩にする）
  const cells: number[] = [];
  for (let k = 0; k < N; k++) if (sealed[k]) cells.push(k);
  // 小さめの空洞をたくさん（だんだん広がるように）
  const K = Math.min(40, Math.max(1, Math.floor(cells.length / 280)));
  const own = new Int32Array(N).fill(-1);
  const q2: number[] = [];
  for (let i = 0; i < K && cells.length; i++) {
    const k = cells[r.int(cells.length)];
    if (own[k] >= 0) continue;
    own[k] = i;
    q2.push(k);
  }
  for (let h = 0; h < q2.length; h++) {
    const c = q2[h];
    const x = c % W;
    const y = (c / W) | 0;
    for (const n of [x + 1 < W ? c + 1 : -1, x > 0 ? c - 1 : -1, y + 1 < H ? c + W : -1, y > 0 ? c - W : -1]) {
      if (n < 0 || own[n] >= 0 || !sealed[n]) continue;
      own[n] = own[c];
      q2.push(n);
    }
  }
  // 空洞どうしの境目は厚さ2マスの岩
  const wall = new Uint8Array(N);
  for (const k of cells) {
    if (vault[k] || own[k] < 0) continue;
    const x = k % W;
    for (const n of [x + 1 < W ? k + 1 : -1, k + W < N ? k + W : -1]) {
      if (n < 0 || !sealed[n] || own[n] < 0 || own[n] === own[k] || vault[n]) continue;
      wall[k] = 1;
      wall[n] = 1;
    }
  }
  for (let k = 0; k < N; k++) {
    if (!wall[k]) continue;
    solid[k] = 1;
    sealed[k] = 0;
  }
  // 岩の帯や境目に埋もれた光の筋と湧き水は取り除く
  for (let i = shafts.length - 1; i >= 0; i--) if (solid[shafts[i].y * W + shafts[i].x]) shafts.splice(i, 1);
  for (let i = springs.length - 1; i >= 0; i--) if (solid[springs[i].y * W + springs[i].x]) springs.splice(i, 1);
  // 開いた洞窟に光の筋と湧き水が少なくとも一つずつあるように
  const openFloor = order.filter((k) => dist[k] <= dMax && !solid[k]);
  const inOpen = (x: number, y: number) => {
    const k = y * W + x;
    return k >= 0 && k < N && !solid[k] && !sealed[k] && dist[k] >= 0 && dist[k] <= dMax;
  };
  if (!shafts.some((s) => inOpen(s.x, s.y))) {
    const far = openFloor.filter((k) => dist[k] > dMax * 0.5 && dist[k] < dMax - 2);
    const k = far.length ? far[r.int(far.length)] : openFloor[openFloor.length >> 1];
    shafts.push({ x: k % W, y: (k / W) | 0 });
  }
  if (!springs.some((s) => inOpen(s.x, s.y))) {
    const mid = openFloor.filter((k) => dist[k] > dMax * 0.3);
    const k = mid.length ? mid[r.int(mid.length)] : openFloor[openFloor.length >> 1];
    springs.push({ x: k % W, y: (k / W) | 0, phase: r.int(1000) / 1000 });
    height[k] = Math.min(255, height[k] + 10);
    humidity[k] = Math.max(humidity[k], 160);
  }
  return sealed;
}

/** 宝物庫：岩の中に掘った石畳の四角い部屋。細い通路一本で洞窟とつながる */
function carveVault(seed: string, W: number, H: number, solid: Uint8Array, lava: Uint8Array, paved: Uint8Array, height: Uint8Array, humidity: Uint8Array, nutrients: Int32Array, vault: Uint8Array): { x: number; y: number } {
  const r = new Rng(hashSeed(seed + ':vault'));
  const RW = 9;
  const RH = 7;
  const open = (k: number) => {
    solid[k] = 0;
    paved[k] = 1;
    height[k] = 110;
    humidity[k] = 60;
    nutrients[k] = 4;
  };
  for (let tries = 0; tries < 3000; tries++) {
    const x0 = 4 + r.int(W - RW - 8);
    const y0 = 24 + r.int(H - RH - 30);
    let ok = true;
    const mg = tries < 1500 ? 2 : 1;
    for (let y = y0 - mg; y < y0 + RH + mg && ok; y++)
      for (let x = x0 - mg; x < x0 + RW + mg; x++) {
        const k = y * W + x;
        if (!solid[k] || lava[k]) ok = false;
      }
    if (!ok) continue;
    // 入口の通路：部屋の縁の中央から外へまっすぐ、既存の床に届く方向を探す
    const cx = x0 + (RW >> 1);
    const cy = y0 + (RH >> 1);
    const dirs = [[0, -1, cx, y0 - 1], [0, 1, cx, y0 + RH], [-1, 0, x0 - 1, cy], [1, 0, x0 + RW, cy]];
    let link: number[] | null = null;
    for (let d = 0; d < 4 && !link; d++) {
      const [dx, dy, sx, sy] = dirs[(d + r.int(4)) % 4];
      const path: number[] = [];
      for (let s = 0; s < 18; s++) {
        const x = sx + dx * s;
        const y = sy + dy * s;
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) break;
        const k = y * W + x;
        if (lava[k]) break;
        if (!solid[k]) {
          link = path;
          break;
        }
        path.push(k);
      }
    }
    if (!link || link.length < 2) continue;
    for (let y = y0; y < y0 + RH; y++)
      for (let x = x0; x < x0 + RW; x++) {
        open(y * W + x);
        vault[y * W + x] = 1;
      }
    for (const k of link) open(k);
    return { x: cx, y: cy };
  }
  return { x: -1, y: -1 };
}

/** 未踏の深部：入口と光の筋からいちばん遠い床（歩いて行ける範囲で） */
function findDeep(W: number, H: number, solid: Uint8Array, lava: Uint8Array, vault: Uint8Array, ex: number, shafts: { x: number; y: number }[]): { x: number; y: number } {
  const dist = new Int32Array(W * H).fill(-1);
  const q = new Int32Array(W * H);
  let qh = 0;
  let qt = 0;
  const start = 1 * W + ex;
  dist[start] = 0;
  q[qt++] = start;
  while (qh < qt) {
    const c = q[qh++];
    const x = c % W;
    const y = (c / W) | 0;
    for (const n of [x + 1 < W ? c + 1 : -1, x > 0 ? c - 1 : -1, y + 1 < H ? c + W : -1, y > 0 ? c - W : -1]) {
      if (n < 0 || dist[n] >= 0 || solid[n] || lava[n]) continue;
      dist[n] = dist[c] + 1;
      q[qt++] = n;
    }
  }
  let best = -1;
  let bv = -1;
  for (let k = 0; k < W * H; k++) {
    if (dist[k] < 0 || vault[k]) continue;
    const x = k % W;
    const y = (k / W) | 0;
    let sd = 1e9;
    for (const s of shafts) sd = Math.min(sd, Math.abs(s.x - x) + Math.abs(s.y - y));
    if (sd < 22) continue;
    // 壁に囲まれすぎない、くぼみの奥
    let walls = 0;
    for (const n of [k + 1, k - 1, k + W, k - W]) if (solid[n]) walls++;
    if (walls > 1) continue;
    const v = dist[k] + Math.min(sd, 60);
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best < 0 ? { x: -1, y: -1 } : { x: best % W, y: (best / W) | 0 };
}

/** ミノタウロスの縄張りの半径（マス）。寝床からこの距離の内の床が縄張り */
export const LAIR_R = 8;

/**
 * ミノタウロスの寝床：入口から歩いて遠く、日の光（光の筋の照り返しは10マスほど届く）が届かず、
 * 地表から離れた深い所（上から30マスより下）にあり、宝物庫・深部の一点から離れた、行き止まりの奥の床。
 * 行き止まりの判定：その床から歩いて LAIR_REACH 歩の所に並ぶ床（外へ出る道の断面）が少なく（LAIR_EXIT マス以下）、ひとつながりで、
 * その内側にある程度の広さ（寝床の部屋）があること。入口からいちばん遠いものを選ぶ（部屋のいちばん奥になる）。
 * 見つからなければ、出口の条件をゆるめて探し直す
 */
function findLair(W: number, H: number, solid: Uint8Array, lava: Uint8Array, paved: Uint8Array, vault: Uint8Array, ex: number, shafts: Shaft[], springs: { x: number; y: number }[], deep: { x: number; y: number }, vaultCenter: { x: number; y: number }): { x: number; y: number } {
  const N = W * H;
  const dist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  dist[W + ex] = 0;
  q[qt++] = W + ex;
  const nb = (c: number) => {
    const x = c % W;
    const y = (c / W) | 0;
    return [x + 1 < W ? c + 1 : -1, x > 0 ? c - 1 : -1, y + 1 < H ? c + W : -1, y > 0 ? c - W : -1];
  };
  while (qh < qt) {
    const c = q[qh++];
    for (const n of nb(c)) {
      if (n < 0 || dist[n] >= 0 || solid[n] || lava[n]) continue;
      dist[n] = dist[c] + 1;
      q[qt++] = n;
    }
  }
  const LAIR_REACH = 9;
  const local = new Int32Array(N).fill(-1);
  const touched: number[] = [];
  const deadEnd = (k: number, maxExit: number): boolean => {
    for (const t of touched) local[t] = -1;
    touched.length = 0;
    let h = 0;
    const lq: number[] = [k];
    local[k] = 0;
    touched.push(k);
    const rim: number[] = [];
    let inner = 0;
    while (h < lq.length) {
      const c = lq[h++];
      if (local[c] === LAIR_REACH) {
        rim.push(c);
        continue;
      }
      inner++;
      for (const n of nb(c)) {
        if (n < 0 || local[n] >= 0 || solid[n] || lava[n]) continue;
        local[n] = local[c] + 1;
        touched.push(n);
        lq.push(n);
      }
    }
    if (!rim.length || rim.length > maxExit || inner < 18) return false;
    // 断面がひとつながりか（斜めのとなりも続きとみなす）
    const seen = new Set<number>([rim[0]]);
    const st = [rim[0]];
    while (st.length) {
      const c = st.pop() as number;
      for (const r of rim) if (!seen.has(r) && Math.abs((r % W) - (c % W)) <= 1 && Math.abs(((r / W) | 0) - ((c / W) | 0)) <= 1) {
        seen.add(r);
        st.push(r);
      }
    }
    return seen.size === rim.length;
  };
  for (const maxExit of [4, 7]) {
    let best = -1;
    let bv = -1;
    for (let k = 0; k < N; k++) {
      if (dist[k] < 60 || vault[k] || paved[k]) continue;
      const x = k % W;
      const y = (k / W) | 0;
      if (y < 30) continue;
      let sd = 1e9;
      for (const s of shafts) sd = Math.min(sd, Math.abs(s.x - x) + Math.abs(s.y - y));
      if (sd < 16) continue;
      if (deep.x >= 0 && Math.abs(deep.x - x) + Math.abs(deep.y - y) < 30) continue;
      if (vaultCenter.x >= 0 && Math.abs(vaultCenter.x - x) + Math.abs(vaultCenter.y - y) < 24) continue;
      if (springs.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 6)) continue;
      let hot = false;
      for (let dy = -4; dy <= 4 && !hot; dy++) for (let dx = -4; dx <= 4; dx++) if (lava[k + dy * W + dx]) hot = true;
      if (hot) continue;
      const v = dist[k] + Math.min(sd, 40);
      if (v <= bv || !deadEnd(k, maxExit)) continue;
      bv = v;
      best = k;
    }
    if (best >= 0) return { x: best % W, y: (best / W) | 0 };
  }
  return { x: -1, y: -1 };
}

export function lineOfSight(m: MapData, ax: number, ay: number, bx: number, by: number): boolean {
  const ta = Math.floor(ax / TILE) + Math.floor(ay / TILE) * 100000;
  const tbx = Math.floor(bx / TILE);
  const tby = Math.floor(by / TILE);
  const dx = bx - ax;
  const dy = by - ay;
  const n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 4));
  for (let s = 1; s < n; s++) {
    const x = Math.floor((ax + (dx * s) / n) / TILE);
    const y = Math.floor((ay + (dy * s) / n) / TILE);
    if ((x === tbx && y === tby) || x + y * 100000 === ta) continue;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    if (m.solid[y * m.w + x]) return false;
  }
  return true;
}
