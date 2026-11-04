/** Ecology のメソッド：大トカゲ（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function lizard(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Lizard];
  if (c.st === 2) {
    const prey = this.byId.get(c.ref);
    if (!prey || prey.dead || prey.away) {
      c.st = 1;
    } else {
      c.act = 1;
      if (this.moveToward(c, prey.x, prey.y, 2.4)) {
        // 飛びかかって打ち合い、仕留めたら待ち伏せに戻る
        if (this.fight(c, prey)) c.st = 1;
      } else if (sq(prey.x - c.x) + sq(prey.y - c.y) > 70 * 70) c.st = 1;
      return;
    }
  }
  if (c.st === 0 || c.sinceMeal % 1500 === 1499) {
    // 待ち伏せの場所を探す：暗い所で、隣が明るく、近くにネズミの気配がある
    let spot = this.findAmbush(c, day, c.x, c.y);
    if (spot < 0 && this.burrows.length) {
      const b = this.burrows[ih(c.id, this.step, 22) % this.burrows.length];
      spot = this.findAmbush(c, day, b.x, b.y);
    }
    if (spot >= 0) {
      c.tx = (spot % this.w.map.w) * TILE + 8;
      c.ty = Math.floor(spot / this.w.map.w) * TILE + 8;
    } else {
      const b = this.burrows.length ? this.burrows[ih(c.id, this.step) % this.burrows.length] : null;
      c.tx = b ? b.x + 24 : c.x;
      c.ty = b ? b.y : c.y;
    }
    c.st = 3;
  }
  if (c.st === 3) {
    c.act = 1;
    if (this.goTo(c, c.tx, c.ty, s.speed)) c.st = 1;
    return;
  }
  // 待つ
  if (c.act !== 2 || c.actT > 6) c.act = 0;
  let target: Cr | null = null;
  let bd = 30 * 30;
  this.nearby(c.x, c.y, 2, (o) => {
    if (o.k !== Kind.Rat || o.dead) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      target = o;
    }
  });
  // 腹が満ちている間は狩らない
  if (target && c.food < SPEC[Kind.Lizard].cap * 0.6) {
    c.st = 2;
    c.ref = (target as Cr).id;
  }
  if (c.food >= 100 && this.counts[Kind.Lizard] < 24 && ih(c.id, this.step, 21) % 2000 === 0) {
    c.food -= 40;
    const j = this.spawn(Kind.Lizard, c.x + 6, c.y, 40, 0);
    j.st = 0;
  }
}

export function findAmbush(this: Ecology, c: Cr, day: number, cx: number, cy: number): number {
  const m = this.w.map;
  const tx0 = Math.floor(cx / TILE);
  const ty0 = Math.floor(cy / TILE);
  let best = -1;
  let bv = 0;
  for (let i = 0; i < 40; i++) {
    const h = ih(c.id, this.step, 300 + i);
    const x = tx0 + ((h & 255) % 25) - 12;
    const y = ty0 + (((h >>> 8) & 255) % 25) - 12;
    if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
    const k = y * m.w + x;
    if (m.solid[k] || m.lava[k] || this.lit(k, day) > 0.18) continue;
    let edge = 0;
    for (const n of [k + 1, k - 1, k + m.w, k - m.w]) if (!m.solid[n] && this.lit(n, day) > 0.3) edge = 1;
    if (!edge) continue;
    let rats = 0;
    this.nearby(x * TILE + 8, y * TILE + 8, 3, (o) => {
      if (o.k === Kind.Rat && !o.dead) rats++;
    });
    const v = rats * 2 + 1 - (Math.abs(x - tx0) + Math.abs(y - ty0)) * 0.05;
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}

declare module '../ecology' {
  interface Ecology {
    lizard: typeof lizard;
    findAmbush: typeof findAmbush;
  }
}

Object.assign(Ecology.prototype, { lizard, findAmbush });
