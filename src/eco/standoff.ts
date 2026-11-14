/**
 * Ecology のメソッド：住民（コボルト・ゴブリン）が、住処のそばを通る冒険者の一行に立ちふさがる。
 *
 * 住民は、住処のそば（住みかの印から7マスの内）に一行が来ると、体力のある者の半分ほど（個体と一行の番号で決まる）が前に出て、
 * 一行の手前（住処から5マスまで）で立ちふさがり、武器を振って威嚇する（st 40。ref に一行、lureAt に始めた step 番号）。残りと弱った者は今までどおり（隠れる・逃げる）。
 * 冒険者は、立ちふさがった者とは戦う（src/eco/aim.ts の spareResident が見逃さない）が、住処の中までは攻め込まない。
 * 一行が住処から離れるか、体力が4割を切るか、生き物の更新300回たったら、ふだんに戻る。すぐそばに来た冒険者には打ちかかる。
 * （以前は、目標でない住処のそばを一行が身構えて通りすぎ、住民も何もしないので、互いに無視しているように見えた）
 */
import { type Cr, Ecology, Kind, ih, sq } from '../ecology';
import { TILE } from '../mapgen';

export const ST_STAND = 40;

export function residentStand(this: Ecology, c: Cr): boolean {
  if (c.k !== Kind.Kobold && c.k !== Kind.Goblin) return false;
  const home = c.hx || c.hy;
  if (c.st === ST_STAND) {
    const p = this.parties.find((q) => q.id === c.ref);
    let near: Cr | null = null;
    let bd = 1e18;
    if (p)
      for (const id of p.members) {
        const o = this.byId.get(id);
        if (!o || o.dead || o.away) continue;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          near = o;
        }
      }
    const gone = !near || (home && sq(near.x - c.hx) + sq(near.y - c.hy) > 10 * TILE * 10 * TILE);
    if (gone || (c.hp > 0 && c.hp < this.maxHp(c) * 0.4) || this.step - c.lureAt > 300 || c.flee > 0) {
      c.st = 0;
      c.ref = 0;
      return false;
    }
    const n = near as Cr;
    this.setDir(c, n.x - c.x, n.y - c.y);
    if (bd < 12 * 12) {
      this.fight(c, n);
      return true;
    }
    // 一行の手前（2マス）まで出る。ただし住処から5マスより外へは出ない
    if (bd > 2 * TILE * 2 * TILE) {
      const L = Math.sqrt(bd);
      const tx = c.x + ((n.x - c.x) / L) * (L - 2 * TILE);
      const ty = c.y + ((n.y - c.y) / L) * (L - 2 * TILE);
      if (!home || sq(tx - c.hx) + sq(ty - c.hy) < 5 * TILE * 5 * TILE) {
        c.act = 1;
        this.goTo(c, tx, ty, 1);
        return true;
      }
    }
    // 立ちふさがって、武器を振って威嚇する
    const el = this.step - c.lureAt;
    c.act = 2;
    if (el % 8 === 0) {
      c.actT = 0;
      this.noise(c.x, c.y, 6);
    }
    return true;
  }
  if (this.step % 10 !== c.id % 10 || !home || this.homeKey(c) === null) return false;
  if (c.st !== 0 && c.st !== 4 && c.st !== 13) return false;
  if (c.flee > 0 || (c.hp > 0 && c.hp < this.maxHp(c) * 0.7)) return false;
  for (const p of this.parties) {
    if (ih(c.id, p.id, 401) % 2) continue;
    for (const id of p.members) {
      const o = this.byId.get(id);
      if (!o || o.dead || o.away || sq(o.x - c.hx) + sq(o.y - c.hy) > 7 * TILE * 7 * TILE || !this.canSense(c, o)) continue;
      c.st = ST_STAND;
      c.ref = p.id;
      c.lureAt = this.step;
      this.markNotice(c, o, '!');
      this.record('settle', { t: this.w.tick, k: c.k, ev: 'standoff', id: c.id, n: p.id, x: Math.round(c.x), y: Math.round(c.y) } as never);
      return true;
    }
  }
  return false;
}

declare module '../ecology' {
  interface Ecology {
    residentStand: typeof residentStand;
  }
}

Object.assign(Ecology.prototype, { residentStand });
