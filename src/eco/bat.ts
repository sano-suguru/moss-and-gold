/** Ecology のメソッド：コウモリ（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function bat(this: Ecology, c: Cr, day: number, phase: number): void {
  const night = day <= 0 && (phase > 0.79 || phase < 0.18);
  const s = SPEC[Kind.Bat];
  if (!night) {
    if (c.away) {
      // 外から戻る
      c.away = false;
      c.x = c.tx;
      c.y = c.ty;
      const add = Math.min(25, s.cap - c.food);
      c.food += add;
      this.imported += add;
    }
    // ヴァンパイアに従うコウモリは、主の住処の天井にぶら下がる（主の眠る所の真上に、黒い房のように）
    const lord0 = c.ref2 ? this.byId.get(c.ref2) : undefined;
    if (lord0 && !lord0.dead && lord0.k === Kind.Vampire && (lord0.hx || lord0.hy)) {
      if (this.step % 20 === c.id % 20) {
        const g = this.groups.get(`v${lord0.id}`);
        const mates = (g ? g.members : [c]).filter((o) => o.k === Kind.Bat).sort((a, b) => a.id - b.id);
        const i = Math.max(0, mates.indexOf(c));
        // 主の左右に交互に、天井ぎわ（住処のマスの上端）に並ぶ。壁の中になるなら主の真上へ寄せる
        const side = i % 2 ? 1 : -1;
        const x = lord0.hx + side * (12 + Math.floor(i / 2) * 7) + ((c.id % 3) - 1);
        const y = lord0.hy - 7 + (Math.floor(i / 2) % 2) * 2;
        const ok = this.tilePassable(c, this.tileOf(x, y));
        c.hx = ok ? x : lord0.hx + side * 3;
        c.hy = ok ? y : lord0.hy - 7;
      }
    }
    // ぶら下がる場所は、いまねぐらにいる仲間の並び順で決め直す（同じ場所に重ならないように）
    else {
      const g = this.groups.get(this.groupKey(c) ?? '');
      if (g && this.step % 20 === c.id % 20) {
        const mates = g.members.filter((o) => o.k === Kind.Bat && !o.ref2).sort((a, b) => a.id - b.id);
        const i = Math.max(0, mates.indexOf(c));
        c.hx = c.tx + ((i % 6) - 2.5) * 7 + ((c.id % 3) - 1);
        c.hy = c.ty - 26 - Math.floor(i / 6) * 8;
      }
    }
    if (c.st !== 0) {
      c.act = 1;
      if (this.goTo(c, c.hx, c.hy, s.speed)) {
        c.st = 0;
        c.x = c.hx;
        c.y = c.hy;
      }
    } else {
      c.act = 0;
      // 居場所が変わったら、ぶら下がったまま少しずつ寄る
      c.x += (c.hx - c.x) * 0.1;
      c.y += (c.hy - c.y) * 0.1;
    }
    return;
  }
  // ヴァンパイアに従うコウモリは外へ出ず、その周りに群れる
  const lord = c.ref2 ? this.byId.get(c.ref2) : undefined;
  if (lord && !lord.dead && lord.k === Kind.Vampire && !c.away) {
    if (c.st === 0 || c.st === 2) c.st = 1;
    c.act = 1;
    // 主が獲物を決めていれば、その上を旋回して居場所を示し（偵察）、主が近づくと獲物に群がる（足止め。src/eco/vampire.ts の batPinned）。
    // 決めていなければ、主の周りを回る
    const prey = lord.ref ? this.byId.get(lord.ref) : undefined;
    const x0 = c.x;
    const y0 = c.y;
    let cx = lord.x;
    let cy = lord.y;
    if (prey && !prey.dead && sq(prey.x - lord.x) + sq(prey.y - lord.y) < sq(40 * TILE)) {
      const close = sq(prey.x - lord.x) + sq(prey.y - lord.y) < sq(6 * TILE);
      const a = (this.step * (close ? 0.09 : 0.05) + c.id * 1.7) % 6.283;
      const r = close ? 7 + (c.id % 3) * 3 : 16 + (c.id % 3) * 6;
      cx = prey.x;
      cy = prey.y;
      this.moveToward(c, prey.x + Math.cos(a) * r, prey.y - (close ? 4 : 14) + Math.sin(a) * r * 0.6, s.speed * 1.2);
    } else {
      const a = (this.step * 0.02 + c.id * 1.7) % 6.283;
      const r = 20 + (c.id % 3) * 8;
      this.moveToward(c, lord.x + Math.cos(a) * r, lord.y - 10 + Math.sin(a) * r * 0.6, s.speed);
    }
    // 回る点が壁の向こうで進めなければ、道を探して中心（主か獲物）へ寄る（壁に押しつけられて止まらないように）
    if (c.x === x0 && c.y === y0 && sq(cx - c.x) + sq(cy - c.y) > sq(TILE)) this.goTo(c, cx, cy, s.speed);
    const k0 = this.tileOf(c.x, c.y);
    if (c.food < s.cap && k0 >= 0 && this.w.moss[k0] > 20) this.eatMoss(c, 2);
    return;
  } else if (c.ref2) c.ref2 = 0;
  if (c.st === 0) c.st = ih(c.id, Math.floor(this.step / 3000), 9) % 10 < 4 ? 2 : 1;
  if (c.st === 2) {
    c.act = 1;
    if (this.goTo(c, c.tx, c.ty, s.speed)) {
      c.st = 3;
      c.away = true;
    }
    return;
  }
  if (c.st === 3) return;
  // ダンジョンの中で苔を食べる
  c.act = 1;
  const k = this.tileOf(c.x, c.y);
  if (c.food < s.cap && k >= 0 && this.w.moss[k] > 20) {
    if (this.eatMoss(c, 2)) {
      c.act = 2;
      c.actT = 0;
    }
    const j = DIR16[ih(c.id, this.step, 3) & 15];
    this.tryMove(c, j[0] * 0.5, j[1] * 0.5);
    return;
  }
  if (c.ref === 0 || ih(c.id, this.step, 4) % 40 === 0) {
    const t = this.findMoss(c, c.hx, c.hy, 12, 100);
    if (t >= 0) {
      c.ref = t + 1;
    } else c.ref = 0;
  }
  if (c.ref > 0) {
    const t = c.ref - 1;
    const gx = (t % this.w.map.w) * TILE + 8;
    const gy = Math.floor(t / this.w.map.w) * TILE + 8;
    if (this.goTo(c, gx, gy, s.speed)) c.ref = 0;
  } else {
    const j = DIR16[ih(c.id, this.step, 6) & 15];
    this.tryMove(c, j[0] * s.speed, j[1] * s.speed);
  }
}

declare module '../ecology' {
  interface Ecology {
    bat: typeof bat;
  }
}

Object.assign(Ecology.prototype, { bat });
