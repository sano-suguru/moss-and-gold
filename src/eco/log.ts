/** Ecology のメソッド：記録（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** 目立つ出来事を記録に残す（新しい順に60件まで） */
export function log(this: Ecology, x: number, y: number, m: string): void {
  this.events.push({ t: this.w.tick, x: Math.round(x), y: Math.round(y), m });
  if (this.events.length > 60) this.events.shift();
}

/** 種が初めて照らされた */
export function discover(this: Ecology, k: number, x: number, y: number): void {
  if (this.discovered[k]) return;
  this.discovered[k] = 1;
  this.log(x, y, `初めて光の中に姿を見せた：{k:${k}}`);
}

declare module '../ecology' {
  interface Ecology {
    log: typeof log;
    discover: typeof discover;
  }
}

Object.assign(Ecology.prototype, { log, discover });
