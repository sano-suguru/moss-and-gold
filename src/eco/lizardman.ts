/** Ecology のメソッド：リザードマン（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function waterNear(this: Ecology, x0: number, y0: number, R: number): number {
  const m = this.w.map;
  let w = 0;
  for (let y = y0 - R; y <= y0 + R; y++) for (let x = x0 - R; x <= x0 + R; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) w += this.w.water[y * m.w + x];
  return w;
}

export function pickWaterSite(this: Ecology, exclude: number): number {
  const m = this.w.map;
  let best = -1;
  let bv = 1500;
  for (let i = 0; i < 160; i++) {
    const k = ih(this.step, i, 98) % (m.w * m.h);
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 20 || this.inLair((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8)) continue;
    const x = k % m.w;
    const y = Math.floor(k / m.w);
    if (this.camps.some((o) => o.id !== exclude && Math.abs(o.x / TILE - x) + Math.abs(o.y / TILE - y) < 20)) continue;
    const v = this.waterNear(x, y, 6);
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}

export function lizardman(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Lizardman];
  if (this.leaveIfStarving(c)) return;
  if (c.act === 2 && c.actT < 4) return;
  const cp = this.campOf(c);
  // 近くの大トカゲを手なずける
  if (cp && this.step % 20 === c.id % 20) {
    this.nearby(c.x, c.y, 3, (o) => {
      if (o.k === Kind.Lizard && !o.dead && o.ref2 === 0 && sq(o.x - c.x) + sq(o.y - c.y) < 48 * 48) o.ref2 = c.id;
    });
  }
  if (cp && this.defend(c, cp.x, cp.y, [Kind.Orc, Kind.Goblin])) return;
  if (c.hungry) {
    if (this.hunt(c, 10, HUNT2, s.speed * 1.2)) return;
  }
  // 村のない者は、立ち止まっては、ふつうに近い速さで少し歩く（src/eco/move.ts の stroll）
  if (!cp) {
    this.stroll(c, 4, 99, 0.9);
    return;
  }
  // 水辺で待ち伏せ、または村のそばで休む
  const R = c.hungry ? 7 : 4;
  if (sq(cp.x - c.x) + sq(cp.y - c.y) > R * TILE * R * TILE) {
    c.act = 1;
    this.goTo(c, cp.x, cp.y, s.speed);
  } else {
    // たいてい立ち止まり、ときどき、ふつうに近い速さで数歩うろつく。
    // （以前は70回のうち25回、ふつうの速さの0.45倍で歩き、脚を動かしながら3秒で半タイルも進まず、足踏みして見えていた）
    c.act = c.actT % 70 < 45 ? 0 : 1;
    if (c.act === 1) {
      const j = DIR16[ih(c.id, this.step >> 4, 100) & 15];
      this.tryMove(c, j[0] * s.speed * 0.85, j[1] * s.speed * 0.85);
    }
  }
}

declare module '../ecology' {
  interface Ecology {
    waterNear: typeof waterNear;
    pickWaterSite: typeof pickWaterSite;
    lizardman: typeof lizardman;
  }
}

Object.assign(Ecology.prototype, { waterNear, pickWaterSite, lizardman });
