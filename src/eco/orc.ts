/** Ecology のメソッド：オーク（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function pickLair(this: Ecology): number {
  const m = this.w.map;
  const targets = [...this.camps.filter((o) => o.kind === 0), ...this.warrens];
  if (!targets.length) return -1;
  const t = targets[ih(this.step, 1, 95) % targets.length];
  for (let i = 0; i < 80; i++) {
    const h = ih(this.step, i, 96);
    const x = Math.floor(t.x / TILE) + ((h & 63) % 41) - 20;
    const y = Math.floor(t.y / TILE) + (((h >>> 6) & 63) % 41) - 20;
    if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
    const k = y * m.w + x;
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 20 || m.maze[k]) continue;
    if (Math.abs(x - t.x / TILE) + Math.abs(y - t.y / TILE) < 12) continue;
    if ((ih(this.step, i, 209) % 100) / 100 < this.presenceAt(x * TILE + 8, y * TILE + 8) * 1.3) continue;
    return k;
  }
  return -1;
}

export function orc(this: Ecology, c: Cr): void {
  if (!c.hungry && c.act !== 2 && c.st < 5 && this.scavenge(c)) return;
  const s = SPEC[Kind.Orc];
  // 貢ぎ物の取り立て（st 5：従う集落へ向かう、st 6：袋を担いで縄張りへ帰る）。飢えて去るより先に
  if (c.st === 5 || c.st === 6) {
    if (c.act === 2 && c.actT < 4) return;
    this.collectTribute(c);
    return;
  }
  if (this.leaveIfStarving(c)) return;
  if (c.act === 2 && c.actT < 4) return;
  if (c.hungry) {
    if (this.hunt(c, 10, HUNT_ORC, s.speed * 1.2)) return;
    // 近くのコボルトの住処を襲いに行く（ゴブリンの集落は襲わない：従える相手）
    const targets = [...this.warrens.filter((o) => o.id >= 0)];
    let best: { x: number; y: number } | null = null;
    let bd = 40 * TILE * 40 * TILE;
    for (const t of targets) {
      const d = sq(t.x - c.x) + sq(t.y - c.y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    if (best) {
      c.act = 1;
      this.goTo(c, best.x, best.y, s.speed);
      return;
    }
  }
  // 用心棒：従う集落のそば（8マス）に来たコボルトを追い払う（縄張りから25マスまで）
  if (this.guardVassals(c)) return;
  if (sq(c.hx - c.x) + sq(c.hy - c.y) > 5 * TILE * 5 * TILE) {
    c.act = 1;
    this.goTo(c, c.hx, c.hy, s.speed);
  } else {
    c.act = c.actT % 80 < 50 ? 0 : 1;
    if (c.act === 1) {
      const j = DIR16[ih(c.id, this.step >> 4, 97) & 15];
      this.tryMove(c, j[0] * s.speed * 0.4, j[1] * s.speed * 0.4);
    }
  }
}

/** オーク c の縄張りに従う集落 */
export function vassalsOf(this: Ecology, c: Cr): Camp[] {
  if (!c.hx && !c.hy) return [];
  return this.camps.filter((o) => o.id >= 0 && o.kind === 0 && o.lx === c.hx && o.ly === c.hy);
}

/** 用心棒：従う集落のそばに来たコボルトを追い払う。true なら今はそのために動いている */
export function guardVassals(this: Ecology, c: Cr): boolean {
  if (c.hungry || c.flee > 0) return false;
  for (const cp of this.vassalsOf(c)) {
    if (sq(cp.x - c.x) + sq(cp.y - c.y) > 25 * TILE * 25 * TILE) continue;
    let foe: Cr | null = null;
    let bd = 8 * TILE * 8 * TILE;
    this.nearby(cp.x, cp.y, 8, (o) => {
      if (o.dead || o.away || o.k !== Kind.Kobold) return;
      const d = sq(o.x - cp.x) + sq(o.y - cp.y);
      if (d < bd) {
        bd = d;
        foe = o;
      }
    });
    if (!foe) continue;
    const f = foe as Cr;
    c.act = 1;
    if (sq(f.x - c.x) + sq(f.y - c.y) < 11 * 11) this.fight(c, f);
    else this.goTo(c, f.x, f.y, SPEC[c.k].speed * 1.2);
    return true;
  }
  return false;
}

/** 貢ぎ物の取り立て：従う集落へ行き、蓄えの3割を袋に詰めて（units）縄張りへ持ち帰り、食べる */
export function collectTribute(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Orc];
  c.act = 1;
  if (c.st === 5) {
    const cp = this.camps.find((o) => o.id === c.ref && o.id >= 0);
    if (!cp || cp.lx !== c.hx || cp.ly !== c.hy) {
      c.st = 0;
      c.ref = 0;
      return;
    }
    if (sq(cp.x - c.x) + sq(cp.y - c.y) < 1.5 * TILE * 1.5 * TILE || this.goTo(c, cp.x, cp.y, s.speed)) {
      const amt = Math.floor((cp.store ?? 0) * 0.3);
      cp.store = (cp.store ?? 0) - amt;
      c.units += amt;
      c.st = 6;
      c.ref = 0;
      c.act = 2;
      c.actT = 0;
      this.record('settle', { t: this.w.tick, k: Kind.Orc, id: cp.id, ev: 'tribute', n: amt, x: Math.round(cp.x), y: Math.round(cp.y) } as never);
      this.log(cp.x, cp.y, `{k:${Kind.Orc}}が{k:${Kind.Goblin}}の集落から貢ぎ物を取り立てた`);
    }
    return;
  }
  // 袋を担いで縄張りへ帰り、食べる（食べきれない分は縄張りの土へ）
  if (sq(c.hx - c.x) + sq(c.hy - c.y) < 2 * TILE * 2 * TILE || this.goTo(c, c.hx, c.hy, s.speed)) {
    const t = Math.min(c.units, s.cap - c.food);
    c.food += t;
    c.units -= t;
    if (t > 0) c.sinceMeal = 0;
    if (c.units > 0) this.deposit(c.x, c.y, c.units);
    c.units = 0;
    c.st = 0;
    c.act = 2;
    c.actT = 0;
  }
}

/**
 * 従う集落：オークの縄張り（寝床）から20マス以内のゴブリンの集落は、いちばん近い縄張りのオークに従う。
 * 地上の約1日ごとに、そのオークのうち一匹が来て、蓄えの3割を取り立てる
 */
export function updateVassals(this: Ecology): void {
  for (const cp of this.camps) {
    if (cp.id < 0 || cp.kind !== 0) continue;
    let lx = 0;
    let ly = 0;
    let bd = 20 * TILE * 20 * TILE;
    for (const o of this.list) {
      if (o.k !== Kind.Orc || o.dead || o.away || (!o.hx && !o.hy)) continue;
      const d = sq(o.hx - cp.x) + sq(o.hy - cp.y);
      if (d < bd || (d === bd && (o.hx < lx || (o.hx === lx && o.hy < ly)))) {
        bd = d;
        lx = o.hx;
        ly = o.hy;
      }
    }
    if (lx !== (cp.lx ?? 0) || ly !== (cp.ly ?? 0)) {
      cp.lx = lx;
      cp.ly = ly;
      if (lx || ly) {
        cp.tribT = this.w.tick + DAY_TICKS_ECO / 2 + (ih(cp.id, this.step, 234) % (DAY_TICKS_ECO / 2));
        this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'vassal', x: Math.round(cp.x), y: Math.round(cp.y) } as never);
        this.log(cp.x, cp.y, `{k:${Kind.Goblin}}の集落が、近くに縄張りを持つ{k:${Kind.Orc}}に従った`);
      }
    }
  }
}

/** 取り立ての時が来た集落へ、縄張りのオークを一匹送る */
export function sendCollectors(this: Ecology): void {
  for (const cp of this.camps) {
    if (cp.id < 0 || cp.kind !== 0 || !(cp.lx || cp.ly) || this.w.tick < (cp.tribT ?? 0)) continue;
    if ((cp.store ?? 0) < 10) {
      cp.tribT = this.w.tick + 600;
      continue;
    }
    // 腹を空かせたオークも行く（腹を空かせているからこそ取り立てる。五巡目は腹ぺこのオークを送らず、取り立ての時が来ても縄張りのオークが皆腹ぺこで、ほとんど取り立てられなかった）
    // 飢えて去ろうとしている（st 9）オークも行く：貢ぎ物で腹を満たせば、去らずにとどまる
    const o = this.list.find((x) => x.k === Kind.Orc && !x.dead && !x.away && x.hx === cp.lx && x.hy === cp.ly && (x.st === 0 || x.st === 9) && x.flee <= 0 && x.units === 0);
    if (!o) {
      cp.tribT = this.w.tick + 600;
      continue;
    }
    o.st = 5;
    o.ref = cp.id;
    cp.tribT = this.w.tick + Math.floor(DAY_TICKS_ECO * 0.8) + (ih(cp.id, this.step, 235) % Math.floor(DAY_TICKS_ECO * 0.4));
  }
}

declare module '../ecology' {
  interface Ecology {
    pickLair: typeof pickLair;
    orc: typeof orc;
    vassalsOf: typeof vassalsOf;
    guardVassals: typeof guardVassals;
    collectTribute: typeof collectTribute;
    updateVassals: typeof updateVassals;
    sendCollectors: typeof sendCollectors;
  }
}

Object.assign(Ecology.prototype, { pickLair, orc, vassalsOf, guardVassals, collectTribute, updateVassals, sendCollectors });
