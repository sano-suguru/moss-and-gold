/** Ecology のメソッド：炎（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** マスに火をつける（dur は燃え続ける長さ。生き物の更新の回数） */
export function ignite(this: Ecology, k: number, dur: number): void {
  const m = this.w.map;
  if (k < 0 || k >= m.solid.length || m.solid[k]) return;
  if (this.w.burn[k] === 0) this.burning.push(k);
  this.w.burn[k] = Math.max(this.w.burn[k], dur);
  this.w.fxDirty = true;
}

/** 燃えているマス：苔とキノコは灰になって土に返り、上にいる生き物は焼け死に、巣は燃え落ちる。火が消えると焼け跡が残る */
export function updateFire(this: Ecology): void {
  if (!this.burning.length) return;
  const m = this.w.map;
  const next: number[] = [];
  for (const k of this.burning) {
    const b = this.w.burn[k];
    if (b === 0) continue;
    if (this.w.moss[k]) {
      this.w.nutr[k] += this.w.moss[k];
      this.w.moss[k] = 0;
      this.mossTouched = true;
    }
    if (this.w.fungus[k]) {
      this.w.nutr[k] += this.w.fungus[k];
      this.w.fungus[k] = 0;
      this.mossTouched = true;
    }
    if (b % 4 === 0) {
      const x = (k % m.w) * TILE + 8;
      const y = Math.floor(k / m.w) * TILE + 8;
      this.nearby(x, y, 1, (o) => {
        if (o.dead || o.away || [Kind.Dragon, Kind.Golem, Kind.Worm, Kind.Ghost, Kind.Salamander].includes(o.k)) return;
        if ((o.k === Kind.Bat || o.k === Kind.Wyvern || o.k === Kind.Wisp) && o.st !== 0) return;
        if (Math.abs(o.x - x) < 9 && Math.abs(o.y - y) < 9) this.die(o, 'burned', Kind.Dragon);
      });
      this.webs = this.webs.filter((wb) => Math.abs(wb.x - x) > 10 || Math.abs(wb.y - y) > 10);
    }
    this.w.burn[k] = b - 1;
    if (b - 1 === 0) {
      this.w.ash[k] = 255;
      this.w.fxDirty = true;
    } else next.push(k);
  }
  this.burning = next;
  if (this.step % 4 === 0) this.w.fxDirty = true;
}

/** 炎の吐息：口元から向きに沿って扇形に、手前から順に火をつける */
export function breathe(this: Ecology, c: Cr, tx: number, ty: number, t: number): void {
  const m = this.w.map;
  const dx = tx - c.x;
  const dy = ty - c.y;
  const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const ux = dx / d;
  const uy = dy / d;
  // t は 0..11。先へ行くほど広く
  const reach = 1 + t * 0.6;
  const half = 0.6 + t * 0.25;
  for (let s2 = Math.max(1, reach - 1.2); s2 <= reach; s2 += 0.5)
    for (let w = -half; w <= half; w += 0.5) {
      const x = c.x + (ux * s2 - uy * w) * TILE;
      const y = c.y + (uy * s2 + ux * w) * TILE;
      const k = this.tileOf(x, y);
      if (k < 0 || m.solid[k]) continue;
      if (!lineOfSight(m, c.x, c.y, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8)) continue;
      this.ignite(k, 30 + (ih(k, this.step, 130) % 20));
    }
}

declare module '../ecology' {
  interface Ecology {
    ignite: typeof ignite;
    updateFire: typeof updateFire;
    breathe: typeof breathe;
  }
}

Object.assign(Ecology.prototype, { ignite, updateFire, breathe });
