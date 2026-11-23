/**
 * Ecology のメソッド：大ガエル（Kind.Frog）。
 *
 * 見せたい場面：
 *  1. 水場（waterholes）の水際にじっと座り、水を飲みに来た大ネズミや、低く飛ぶコウモリを待つ（住みかは hx, hy）。
 *  2. 獲物が舌の届く所（FROG_TONGUE マス、見通しの利く所）に来ると、舌を伸ばして捕まえ（演出 tongue）、口元へ引き寄せて丸のみにする
 *     （仕留めた獲物の死骸を口元へ動かし、feeding が骨ごと一口で食べる。SWALLOW）。
 *  3. 腹が満ちていると舌を伸ばさない。よく食べると、水際に子が生まれる。
 * 湧き方は src/eco/spawndef.ts の表（水場のそばに一匹ずつ）。リザードマンの獲物になる。
 */
import { type Cr, DIR16, Ecology, Kind, SPEC, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';

/** 舌の届く距離（マス） */
export const FROG_TONGUE = 4;
/** 舌で捕まえる獲物 */
const FROG_PREY = new Set<number>([Kind.Rat, Kind.Bat, Kind.Ant, Kind.RustBeetle]);
/** ダンジョン全体の数の上限（子を産むのはこれより少ないときだけ） */
export const FROG_CAP = 8;
/** 舌を伸ばす腹の減り具合（食べた物が胃の大きさのこの割合を切ったら） */
const FROG_HUNGRY = 0.7;

export function frog(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Frog];
  if (c.act === 2 && c.actT < 6) return;
  // 舌を伸ばす：舌の届く所に獲物がいて、見通しが利けば、生き物の更新4回に1回のくじで
  if (c.food < s.cap * FROG_HUNGRY && this.step % 4 === c.id % 4) {
    let prey: Cr | null = null;
    let bd = FROG_TONGUE * TILE * FROG_TONGUE * TILE;
    this.nearby(c.x, c.y, FROG_TONGUE, (o) => {
      if (o.dead || o.away || !FROG_PREY.has(o.k) || (o.k === Kind.Bat && o.st === 0)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        prey = o;
      }
    });
    const p = prey as Cr | null;
    if (p && lineOfSight(this.w.map, c.x, c.y, p.x, p.y) && ih(c.id, this.step, 331) % 2 === 0) {
      this.frogTongue(c, p);
      return;
    }
  }
  // 住みかの水際へ戻り、ときどき跳ねて向きを変える
  if (sq(c.hx - c.x) + sq(c.hy - c.y) > 2 * TILE * 2 * TILE) {
    c.act = 1;
    this.goTo(c, c.hx, c.hy, s.speed);
    return;
  }
  if (ih(c.id, this.step >> 6, 332) % 5 === 0) {
    const j = DIR16[ih(c.id, this.step >> 6, 333) & 15];
    c.act = 1;
    this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
  } else c.act = 0;
  // よく食べたら、水際に子を産む（体は親の胃から）
  if (c.food >= s.cap * 0.9 && this.counts[Kind.Frog] < FROG_CAP && ih(c.id, this.step, 334) % 1500 === 0) {
    c.food -= 25;
    const j = this.spawn(Kind.Frog, c.x + 6, c.y + 2, 25, 0);
    j.hx = c.hx;
    j.hy = c.hy;
    this.counts[Kind.Frog]++;
  }
}

/** 舌を伸ばして獲物を捕まえ、口元へ引き寄せる（死骸を口元へ動かし、feeding が丸のみにする） */
export function frogTongue(this: Ecology, c: Cr, p: Cr): void {
  c.dir = Math.abs(p.x - c.x) > Math.abs(p.y - c.y) ? (p.x > c.x ? 2 : 3) : p.y > c.y ? 0 : 1;
  c.act = 2;
  c.actT = 0;
  this.fxAttacks.push({ t: this.w.tick, style: 'tongue', col: 5, size: 1, ax: c.x, ay: c.y, dx: p.x, dy: p.y, did: p.id, aid: c.id, big: false, kill: true });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  this.record('settle', { t: this.w.tick, k: Kind.Frog, ev: 'tongue', id: c.id, n: p.k, x: Math.round(p.x), y: Math.round(p.y) } as never);
  this.eat(c, p);
  // 獲物の死骸が残ったら（丸のみの一口の前に）、口元まで引き寄せる
  if (c.feed === p.id && p.dead === 1) {
    const fx = c.dir === 2 ? 5 : c.dir === 3 ? -5 : 0;
    const fy = c.dir === 0 ? 4 : c.dir === 1 ? -4 : 0;
    const k = this.tileOf(c.x + fx, c.y + fy);
    if (k >= 0 && !this.w.map.solid[k]) {
      p.x = c.x + fx;
      p.y = c.y + fy;
    } else {
      p.x = c.x;
      p.y = c.y;
    }
  }
}

/** 大ガエルが湧く場所（タイル番号、なければ -1）：水場のうち、大ネズミかコウモリが近くにいるものの、水際の床（水が浅く、隣に深い水がある） */
export function frogSite(this: Ecology): number {
  const m = this.w.map;
  const holes = this.waterholes;
  if (!holes.length) return -1;
  for (let i = 0; i < holes.length; i++) {
    const h = holes[(ih(this.step, i, 335) >>> 0) % holes.length];
    if (this.list.some((o) => o.k === Kind.Frog && !o.dead && sq(o.hx - h.x) + sq(o.hy - h.y) < 6 * TILE * 6 * TILE)) continue;
    let prey = 0;
    this.nearby(h.x, h.y, 8, (o) => {
      if (!o.dead && (o.k === Kind.Rat || o.k === Kind.Bat)) prey++;
    });
    if (prey < 2) continue;
    const hx = Math.floor(h.x / TILE);
    const hy = Math.floor(h.y / TILE);
    for (let r = 0; r <= 3; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = hx + dx;
          const y = hy + dy;
          if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
          const k = y * m.w + x;
          if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 40) continue;
          if ([k + 1, k - 1, k + m.w, k - m.w].some((q) => this.w.water[q] > 40)) return k;
        }
  }
  return -1;
}

declare module '../ecology' {
  interface Ecology {
    frog: typeof frog;
    frogTongue: typeof frogTongue;
    frogSite: typeof frogSite;
  }
}
Object.assign(Ecology.prototype, { frog, frogTongue, frogSite });
