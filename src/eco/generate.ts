/**
 * Ecology のメソッド：魔物がダンジョンの中の資源（土の養分とマナ）から湧く共通の仕組み。
 * 種ごとの湧き方は src/eco/spawndef.ts の表 SPAWN_DEFS。ここは表を見て、条件・場所・資源を確かめ、生き物を生む。
 * 体と胃の養分はすべて場所のまわりの土から取る（takeNutrients。全部取れなければ湧かない）ので、養分の保存則は自動で守られる。
 * 体のマナも場所のまわりの土から移す（takeMana）。表の行に manaAll があれば、マナも全部集められるときだけ湧く（いまはバジリスク）。
 */
import { type Cr, DAY_TICKS_ECO, Ecology } from '../ecology';
import { TILE } from '../mapgen';
import { SPAWN_DEFS, type SpawnDef } from './spawndef';

/** 生き物の更新ごとに呼ぶ。表の各行を、その行の判定の回（step % every === phase）にだけ見る */
export function generate(this: Ecology): void {
  for (const d of SPAWN_DEFS) if (d.every > 0 && this.step % d.every === d.phase) this.generateOne(d);
}

/** 表の一行を見て、条件がそろえば湧かせる。湧いたら true。site を渡すと、表の site の代わりにその場所で湧かせる（コウモリの縦穴など） */
export function generateOne(this: Ecology, d: SpawnDef, at = -1): boolean {
  if (this.w.tick < d.minDay * DAY_TICKS_ECO) return false;
  if (d.ok && !d.ok(this)) return false;
  if (d.cap && this.counts[d.k] >= d.cap(this)) return false;
  if (d.cool && this.step - (this.lastArrival[d.k] ?? -1e9) <= d.cool) return false;
  if (d.chance && !d.chance(this)) return false;
  const site = at >= 0 ? at : d.site(this);
  if (site < 0) return false;
  const n = d.band(this, site);
  // 体のマナを全部か無しかで払う種（manaAll）は、土から集めきれなければ湧かない（湧くたびにその場のマナが減り、続けては湧きにくくなる）
  if (d.manaAll && d.mana && !this.manaObtainable(site, n * d.mana, d.manaR ?? 3)) {
    this.record('settle', { t: this.w.tick, k: d.k, ev: 'manaShort', x: (site % this.w.map.w) * TILE + 8, y: Math.floor(site / this.w.map.w) * TILE + 8 } as never);
    return false;
  }
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

declare module '../ecology' {
  interface Ecology {
    generate: typeof generate;
    generateOne: typeof generateOne;
    spotNear: typeof spotNear;
  }
}

Object.assign(Ecology.prototype, { generate, generateOne, spotNear });
