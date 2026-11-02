/** Ecology のメソッド：大グモ（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function spider(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Spider];
  if (c.st === 0) {
    // 巣を張る場所を探す：明るく、壁が近く、飛ぶものが通る所
    const m = this.w.map;
    let ox = c.x;
    let oy = c.y;
    if (c.hungry > 0 || ih(c.id, this.step, 33) % 2 === 0) {
      if (m.shafts.length) {
        const sh = m.shafts[ih(c.id, this.step, 34) % m.shafts.length];
        ox = sh.x * TILE + 8;
        oy = sh.y * TILE + 8;
      }
    }
    const tx0 = Math.floor(ox / TILE);
    const ty0 = Math.floor(oy / TILE);
    let best = -1;
    let bv = 0;
    for (let i = 0; i < 40; i++) {
      const h = ih(c.id, this.step, 500 + i);
      const x = tx0 + ((h & 255) % 31) - 15;
      const y = ty0 + (((h >>> 8) & 255) % 31) - 15;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.lava[k]) continue;
      let walls = 0;
      for (const n of [k + 1, k - 1, k + m.w, k - m.w, k + m.w + 1, k - m.w - 1]) walls += m.solid[n];
      if (walls < 2) continue;
      let fly = 0;
      this.nearby(x * TILE + 8, y * TILE + 8, 2, (o) => {
        if ((o.k === Kind.Wisp || o.k === Kind.Bat) && !o.dead) fly++;
      });
      const v = fly + this.lit(k, Math.max(day, 0.5)) * 3;
      if (v > bv && !this.webs.some((w) => Math.abs(w.x - x * TILE) < 48 && Math.abs(w.y - y * TILE) < 48)) {
        bv = v;
        best = k;
      }
    }
    if (best >= 0) {
      c.tx = (best % m.w) * TILE + 8;
      c.ty = Math.floor(best / m.w) * TILE + 8;
      c.st = 1;
    } else {
      const j = DIR16[ih(c.id, this.step, 7) & 15];
      this.tryMove(c, j[0] * s.speed, j[1] * s.speed);
      c.act = 1;
    }
    return;
  }
  if (c.st === 1) {
    c.act = 1;
    if (this.goTo(c, c.tx, c.ty, s.speed)) {
      const web: Web = { id: this.nextId++, x: c.tx, y: c.ty, r: 18, owner: c.id, age: 0 };
      this.webs.push(web);
      c.ref = web.id;
      c.st = 2;
    }
    return;
  }
  // 巣で待ち、かかった獲物を食べる
  const web = this.webs.find((w) => w.id === c.ref);
  if (!web) {
    c.st = 0;
    return;
  }
  let prey: Cr | null = null;
  this.nearby(web.x, web.y, 2, (o) => {
    if (o.caught && o.ref === web.id && !o.dead) prey = o;
  });
  if (prey && c.food < s.cap * 0.7) {
    const p = prey as Cr;
    c.act = 1;
    if (this.moveToward(c, p.x, p.y, s.speed * 1.5)) this.eat(c, p);
  } else {
    if (this.moveToward(c, web.x, web.y, s.speed)) {
      if (c.act !== 2 || c.actT > 6) c.act = 0;
    } else c.act = 1;
  }
  if (c.sinceMeal > 2400) {
    web.owner = 0;
    c.st = 0;
    c.sinceMeal = 0;
  }
  if (c.food >= 60 && this.counts[Kind.Spider] < 14 && ih(c.id, this.step, 31) % 1500 === 0) {
    c.food -= 20;
    this.spawn(Kind.Spider, c.x, c.y, 20, 0);
  }
}

export function updateWebs(this: Ecology): void {
  for (const web of this.webs) {
    web.age++;
    this.nearby(web.x, web.y, 2, (o) => {
      if (o.dead || o.caught || o.away) return;
      if (o.k !== Kind.Wisp && o.k !== Kind.Bat) return;
      if (sq(o.x - web.x) + sq(o.y - web.y) > web.r * web.r) return;
      const chance = o.k === Kind.Wisp ? 8 : 25;
      if (ih(o.id, this.step, 61) % chance === 0) {
        o.caught = true;
        o.ref = web.id;
        o.vx = 0;
        o.vy = 0;
      }
    });
  }
  this.webs = this.webs.filter((w) => w.owner !== 0 || w.age < 3000);
}

declare module '../ecology' {
  interface Ecology {
    spider: typeof spider;
    updateWebs: typeof updateWebs;
  }
}

Object.assign(Ecology.prototype, { spider, updateWebs });
