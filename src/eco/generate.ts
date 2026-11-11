/**
 * Ecology のメソッド：魔物がダンジョンの中の資源（土の養分とマナ）から湧く共通の仕組み。
 * 種ごとの湧き方は src/eco/spawndef.ts の表 SPAWN_DEFS。ここは表を見て、条件・場所・資源を確かめ、生き物を生む。
 * 体と胃の養分はすべて場所のまわりの土から取る（takeNutrients。全部取れなければ湧かない）ので、養分の保存則は自動で守られる。
 */
import { CELL, Cr, DAY_TICKS_ECO, Ecology, SPEC, ih } from '../ecology';
import { TILE } from '../mapgen';
import { SPAWN_DEFS, SpawnDef } from './spawndef';

/** 生き物の更新ごとに呼ぶ。表の各行を、その行の判定の回（step % every === phase）にだけ見る */
export function generate(this: Ecology): void {
  for (const d of SPAWN_DEFS) if (d.every > 0 && this.step % d.every === d.phase) this.generateOne(d);
}

/** 表の一行を見て、条件がそろえば湧かせる。湧いたら true。site を渡すと、表の site の代わりにその場所で湧かせる（コウモリの縦穴など） */
export function generateOne(this: Ecology, d: SpawnDef, at = -1): boolean {
  if (this.w.tick < d.minDay * DAY_TICKS_ECO) return false;
  if (d.ok && !d.ok(this)) return false;
  if (this.counts[d.k] >= d.cap(this)) return false;
  if (d.cool && this.step - (this.lastArrival[d.k] ?? -1e9) <= d.cool) return false;
  if (d.chance && !d.chance(this)) return false;
  const site = at >= 0 ? at : d.site(this);
  if (site < 0) return false;
  if (this.starveBlocks(d, site)) return false;
  const n = d.band(this, site);
  const ex = d.extra?.(this, n) ?? 0;
  // 体と胃と蓄えの養分を、一度にまとめて土から取る（全部か無し。片方だけ取れた状態を作らない）
  if (!this.takeNutrients(site, n * (d.body + d.food) + ex, d.nutrR ?? 4)) return false;
  const ctx = d.before?.(this, site, ex);
  const m = this.w.map;
  const sx = (site % m.w) * TILE + 8;
  const sy = Math.floor(site / m.w) * TILE + 8;
  for (let i = 0; i < n; i++) {
    this.originNext = d.side === 'nutr' ? 'soil' : 'mana';
    const [x, y] = d.spot?.(this, site, i) ?? this.spotNear(site, i);
    const c: Cr = this.spawn(d.k, x, y, d.body, d.food);
    if (d.mana) this.takeMana(c, site, d.mana, d.manaR ?? 3);
    d.setup?.(this, c, site, i, ctx);
    this.counts[d.k]++;
  }
  this.lastArrival[d.k] = this.step;
  this.record('settle', { t: this.w.tick, k: d.k, ev: 'gen', how: d.side, n, x: sx, y: sy } as never);
  if (d.dust ?? d.side === 'nutr') {
    this.fxSoilBirths = this.fxSoilBirths.filter((e) => this.w.tick - e.t < 200);
    this.fxSoilBirths.push({ t: this.w.tick, x: sx, y: sy });
  }
  if (d.log && this.step - (this.lastLogged[d.k] ?? -99999) > 3000) {
    this.lastLogged[d.k] = this.step;
    this.log(sx, sy, d.log);
  }
  return true;
}

/** 近い順に見る8方向 */
const AROUND: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

/**
 * i 匹目を置く場所（ピクセル）：0匹目は場所のマスの中心。1匹目からは、まわり8マスを (i−1) 番目の向きから順に見て、
 * 岩でも溶岩でも閉じた空洞でもなく、深い水でもなく、場所と同じ洞窟の領域にある最初のマスの中心。なければ場所のマスの中心
 */
export function spotNear(this: Ecology, site: number, i: number): [number, number] {
  const m = this.w.map;
  const cx = site % m.w;
  const cy = Math.floor(site / m.w);
  if (i > 0) {
    const reg = this.regionOf(site);
    for (let j = 0; j < 8; j++) {
      const [dx, dy] = AROUND[(i - 1 + j) % 8];
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const q = y * m.w + x;
      if (m.solid[q] || m.lava[q] || m.sealed[q] || this.w.water[q] > 40 || this.regionOf(q) !== reg) continue;
      return [x * TILE + 8, y * TILE + 8];
    }
  }
  return [cx * TILE + 8, cy * TILE + 8];
}

/** 湧く種（表にある種） */
const SPAWNED = new Set(SPAWN_DEFS.map((d) => d.k));

/** 飢え死にの記憶に足す：湧く種が飢え死にするか飢えて去ったら、その区画に体の大きさを足す（勇者のくせになまいきだ or2 の、飢え死にが多い所に合わせる考え方） */
export function noteStarve(this: Ecology, c: Cr): void {
  if (!SPAWNED.has(c.k)) return;
  const i = this.starveCell(c.x, c.y);
  if (i >= 0) this.starveMap[i] += SPEC[c.k].body;
}

/** ピクセルの位置の、飢え死にの記憶の区画（CELL タイル四方。24×18） */
export function starveCell(this: Ecology, x: number, y: number): number {
  const cx = Math.floor(x / TILE / CELL);
  const cy = Math.floor(y / TILE / CELL);
  return cx >= 0 && cy >= 0 && cx < 24 && cy < 18 ? cy * 24 + cx : -1;
}

/**
 * 飢え死にが続いた場所では湧きにくくする（結果を見て合わせる）。true なら、この回は湧かない。
 * 場所の区画とまわり8区画の記憶の合計を s、W = 4 × 体の大きさ × 段 として、W / (s + W) の割合でしか湧かない
 * （s が0なら必ず湧く。体の大きい上の段の種ほど、少しの飢え死にでは止まらない）
 */
export function starveBlocks(this: Ecology, d: SpawnDef, site: number): boolean {
  const m = this.w.map;
  const i = this.starveCell((site % m.w) * TILE + 8, Math.floor(site / m.w) * TILE + 8);
  if (i < 0) return false;
  const cx = i % 24;
  const cy = Math.floor(i / 24);
  let s = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && y >= 0 && x < 24 && y < 18) s += this.starveMap[y * 24 + x];
    }
  if (s <= 0) return false;
  const W = 4 * SPEC[d.k].body * d.tier;
  return ih(site, this.step, 811) % (s + W) >= W;
}

declare module '../ecology' {
  interface Ecology {
    generate: typeof generate;
    generateOne: typeof generateOne;
    spotNear: typeof spotNear;
    starveBlocks: typeof starveBlocks;
    noteStarve: typeof noteStarve;
    starveCell: typeof starveCell;
  }
}

Object.assign(Ecology.prototype, { generate, generateOne, spotNear, starveBlocks, noteStarve, starveCell });
