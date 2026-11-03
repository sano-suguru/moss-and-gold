/** Ecology のメソッド：ミノタウロス、トロール、バジリスク、ガーゴイル、ミミック、ゴーレム、ワーム（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function mazeTiles(this: Ecology): number[] {
  const m = this.w.map;
  const out: number[] = [];
  for (let k = 0; k < m.w * m.h; k++) if (m.maze[k] && !m.solid[k]) out.push(k);
  return out;
}

export function minotaur(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Minotaur];
  if (this.leaveIfStarving(c)) return;
  if (c.act === 2 && c.actT < 5) return;
  const m = this.w.map;
  const k = this.tileOf(c.x, c.y);
  const inMaze = k >= 0 && m.maze[k] === 1;
  // 迷路の中か、迷路のすぐ外で、何でも襲う
  const nearMaze = inMaze || sq(c.x - c.hx) + sq(c.y - c.hy) < 16 * TILE * 16 * TILE;
  if (nearMaze && this.hunt(c, inMaze ? 5 : 3, HUNT3, s.speed * 1.3)) return;
  // 迷路の中を徘徊する
  c.act = 1;
  if (c.tx <= 0 || sq(c.tx - c.x) + sq(c.ty - c.y) < 10 * 10 || c.actT > 1200) {
    const mz = this.mazeTiles();
    if (!mz.length) return;
    const t = mz[ih(c.id, this.step, 101) % mz.length];
    c.tx = (t % m.w) * TILE + 8;
    c.ty = Math.floor(t / m.w) * TILE + 8;
    c.actT = 0;
  }
  this.goTo(c, c.tx, c.ty, s.speed);
}

export function troll(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Troll];
  const k = this.tileOf(c.x, c.y);
  // 光の筋を浴びると石になる
  if (this.sunlit(k, day)) {
    this.petrify(c);
    return;
  }
  if (this.leaveIfStarving(c)) return;
  if (c.act === 2 && c.actT < 5) return;
  if (day > 0.05) {
    // 昼は暗い寝床で眠る
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 12 * 12) {
      c.act = 1;
      this.goTo(c, c.hx, c.hy, s.speed);
    } else c.act = 0;
    return;
  }
  // 夜は何でも食う
  if (c.food < s.cap * 0.8) {
    if (this.hunt(c, 10, HUNT4, s.speed * 1.15)) return;
    let best: Cr | null = null;
    let bd = 10 * TILE * 10 * TILE;
    for (const o of this.corpses) {
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (best) {
      const b = best as Cr;
      c.act = 1;
      if (sq(b.x - c.x) + sq(b.y - c.y) < 10 * 10) {
        const t = Math.min(b.units, 20, s.cap - c.food);
        b.units -= t;
        c.food += t;
        c.sinceMeal = 0;
        c.act = 2;
        c.actT = 0;
        if (b.units <= 0) b.dead = 2;
      } else this.goTo(c, b.x, b.y, s.speed);
      return;
    }
  }
  c.act = 1;
  const j = DIR16[ih(c.id, this.step >> 5, 112) & 15];
  this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
}

export function basilisk(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Basilisk];
  if (this.leaveIfStarving(c)) return;
  if (c.act === 2 && c.actT < 6) return;
  // 自分より大きなものが近づくと睨みつけ、見通しの通っている相手を石に変える
  if (this.step % 10 === c.id % 10) {
    let target: Cr | null = null;
    this.nearby(c.x, c.y, 4, (o) => {
      if (target || o.dead || o.away || STR[o.k] < 6 || o.k === Kind.Basilisk || o.k === Kind.Gargoyle || o.k === Kind.Dragon) return;
      if (sq(o.x - c.x) + sq(o.y - c.y) > 4 * TILE * 4 * TILE) return;
      const m = this.w.map;
      if (!lineOfSight(m, c.x, c.y, o.x, o.y)) return;
      target = o;
    });
    if (target) {
      const t = target as Cr;
      c.act = 2;
      c.actT = 0;
      const dx = t.x - c.x;
      const dy = t.y - c.y;
      c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : dy > 0 ? 0 : 1;
      if (ih(c.id, t.id, this.step) % 24 === 0) this.petrify(t);
      return;
    }
  }
  if (c.hungry && this.hunt(c, 8, HUNT5, s.speed * 1.2)) return;
  // 入口から離れた暗がりを住みかにする
  const m = this.w.map;
  if (c.hx === c.x && c.hy === c.y) {
    const lair = this.pickDark(2, 80);
    if (lair >= 0) {
      c.hx = (lair % m.w) * TILE + 8;
      c.hy = Math.floor(lair / m.w) * TILE + 8;
    }
  }
  if (sq(c.hx - c.x) + sq(c.hy - c.y) > 10 * TILE * 10 * TILE) {
    c.act = 1;
    this.goTo(c, c.hx, c.hy, s.speed);
    return;
  }
  c.act = c.actT % 90 < 50 ? 0 : 1;
  if (c.act === 1) {
    const j = DIR16[ih(c.id, this.step >> 5, 113) & 15];
    this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
  }
}

export function gargoyle(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Gargoyle];
  if (c.act === 2 && c.actT < 4) return;
  // 近くを飛ぶコウモリを狩る
  let prey: Cr | null = null;
  let bd = 6 * TILE * 6 * TILE;
  if (c.food < s.cap * 0.7) {
    this.nearby(c.x, c.y, 6, (o) => {
      if (o.dead || o.away || o.k !== Kind.Bat || o.st === 0) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        prey = o;
      }
    });
  }
  if (prey) {
    const p = prey as Cr;
    c.act = 1;
    if (sq(p.x - c.x) + sq(p.y - c.y) < 10 * 10) this.eat(c, p);
    else this.moveToward(c, p.x, p.y, s.speed);
    return;
  }
  // 止まり木（壁際）に戻って、石像のふりをしてうずくまる
  if (sq(c.hx - c.x) + sq(c.hy - c.y) > 4 * 4) {
    c.act = 1;
    this.moveToward(c, c.hx, c.hy, s.speed);
    return;
  }
  c.x = c.hx;
  c.y = c.hy;
  c.act = 0;
  c.dir = 0;
}

export function mimic(this: Ecology, c: Cr): void {
  if (c.act === 2 && c.actT < 5) return;
  c.act = 0;
  // 食べたあとはしばらく消化していて、近づくものを襲わない（ゲーム内の3時間ほど）
  if (c.gait > 0) {
    c.gait--;
    return;
  }
  // 近づいたものを何でも食う
  let prey: Cr | null = null;
  let bd = 20 * 20;
  this.nearby(c.x, c.y, 1, (o) => {
    if (o === c || o.dead || o.away || [Kind.Mimic, Kind.Golem, Kind.Worm, Kind.Ghost, Kind.Wisp].includes(o.k)) return;
    if (o.k === Kind.Bat && o.st !== 0) return;
    // 振動で気づく：じっとしている者、眠っている者には気づかない
    if (!this.canSense(c, o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      prey = o;
    }
  });
  if (prey) {
    const p = prey as Cr;
    c.dir = Math.abs(p.x - c.x) > Math.abs(p.y - c.y) ? (p.x > c.x ? 2 : 3) : p.y > c.y ? 0 : 1;
    // 待ち伏せは半分ほどしか当たらない
    if (ih(c.id, p.id ^ this.step, 160) % 2 === 0) {
      if (STR[p.k] * 2 < STR[c.k]) this.eat(c, p);
      else this.fight(c, p);
      if (p.dead) c.gait = 900;
    }
    c.act = 2;
    c.actT = 0;
  }
}

/**
 * ゴーレム：宝物庫の入口の前に立ちはだかる番人。入口を通ろうとする者と、宝物庫の中で宝を抱えた者を殴る。
 * 入口から3マスより外へは追いかけない
 */
export function golem(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Golem];
  if (c.act === 2 && c.actT < 5) return;
  const m = this.w.map;
  // 見張る場所：宝物庫の中の、外とつながる入口のマス（はじめに一度だけ探す）
  if (c.tx <= 0) {
    let best = -1;
    let bd = 1e18;
    for (let k = 0; k < m.vault.length; k++) {
      if (!m.vault[k] || m.solid[k]) continue;
      let door = false;
      for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (!m.vault[q] && !m.solid[q]) door = true;
      if (!door) continue;
      const d = sq((k % m.w) * TILE + 8 - c.hx) + sq(Math.floor(k / m.w) * TILE + 8 - c.hy);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    c.tx = best >= 0 ? (best % m.w) * TILE + 8 : c.hx;
    c.ty = best >= 0 ? Math.floor(best / m.w) * TILE + 8 : c.hy;
  }
  const post2 = 3 * TILE * 3 * TILE;
  let foe: Cr | null = null;
  let fd = 1e18;
  this.nearby(c.tx, c.ty, 4, (o) => {
    if (o.dead || o.away || o === c || [Kind.Golem, Kind.Dragon, Kind.Worm, Kind.Ghost, Kind.Wisp, Kind.Mimic, Kind.Gargoyle].includes(o.k)) return;
    if ((o.k === Kind.Bat || o.k === Kind.Wyvern) && o.st !== 0) return;
    const k = this.tileOf(o.x, o.y);
    const atDoor = sq(o.x - c.tx) + sq(o.y - c.ty) < 2 * TILE * 2 * TILE && STR[o.k] >= 3;
    const thief = o.gold > 0 && k >= 0 && m.vault[k];
    if (!atDoor && !thief) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < fd) {
      fd = d;
      foe = o;
    }
  });
  if (foe) {
    const f = foe as Cr;
    c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
    if (fd < 16 * 16) this.fight(c, f);
    else if (sq(f.x - c.tx) + sq(f.y - c.ty) < post2) {
      c.act = 1;
      this.goTo(c, f.x, f.y, s.speed);
    }
    return;
  }
  if (sq(c.tx - c.x) + sq(c.ty - c.y) > 6 * 6) {
    c.act = 1;
    this.goTo(c, c.tx, c.ty, s.speed);
    return;
  }
  // 入口に立ち、外を向く
  c.act = 0;
  c.dir = 0;
}

export function worm(this: Ecology, c: Cr): void {
  const m = this.w.map;
  const D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  if (c.st === 0) {
    c.act = 0;
    if (this.step % 50 !== c.id % 50) return;
    // 大きな生き物が近くで騒ぐか、長い年月が経つと目覚める
    let disturbed = false;
    this.nearby(c.x, c.y, 5, (o) => {
      if (!o.dead && o.k !== Kind.Worm && o.k !== Kind.Golem && STR[o.k] >= 6) disturbed = true;
    });
    if ((disturbed && ih(c.id, this.step, 121) % 20 === 0) || ih(c.id, this.step, 122) % 500 === 0) {
      this.log(c.x, c.y, `{k:${Kind.Worm}}が目覚め、岩を掘り進みはじめた`);
      c.st = 1;
      c.ref2 = ih(c.id, this.step, 123) & 7;
      c.tx = 40 + (ih(c.id, this.step, 124) % 41);
      c.ty = 0;
      const k = this.tileOf(c.x, c.y);
      c.hx = k % m.w;
      c.hy = Math.floor(k / m.w);
    }
    return;
  }
  // 掘り進む：頭は次のマスの中心へ向かい、着いたら次のマスを決める
  c.act = 1;
  const gx = c.hx * TILE + 8;
  const gy = c.hy * TILE + 8;
  const dx = gx - c.x;
  const dy = gy - c.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const sp = 2;
  if (d > sp) {
    c.x += (dx / d) * sp;
    c.y += (dy / d) * sp;
  } else {
    c.x = gx;
    c.y = gy;
    // 次のマス：ときどき向きを変える。縁や溶岩や宝物庫は避ける
    let h = c.ref2;
    if (ih(c.id, this.step, 125) % 4 === 0) h = (h + (ih(c.id, this.step, 126) & 1 ? 1 : 7)) & 7;
    for (let i = 0; i < 8; i++) {
      const nx = c.hx + D8[h][0];
      const ny = c.hy + D8[h][1];
      const nk = ny * m.w + nx;
      let bad = nx < 4 || ny < 4 || nx >= m.w - 4 || ny >= m.h - 4 || m.vault[nk] === 1;
      if (!bad) for (const q of [nk, nk + 1, nk - 1, nk + m.w, nk - m.w]) if (m.lava[q]) bad = true;
      if (!bad) break;
      h = (h + 3) & 7;
    }
    c.ref2 = h;
    c.hx += D8[h][0];
    c.hy += D8[h][1];
    const nk = c.hy * m.w + c.hx;
    // 太いトンネル：頭のマスと、進む向きに対して横のマス
    const side = D8[(h + 2) & 7];
    this.pendingDigs.push(nk, nk + side[1] * m.w + side[0]);
    c.tx--;
    c.dir = Math.abs(D8[h][0]) >= Math.abs(D8[h][1]) ? (D8[h][0] > 0 ? 2 : 3) : D8[h][1] > 0 ? 0 : 1;
    if (c.tx <= 0) {
      c.st = 0;
      c.act = 0;
    }
  }
  if (this.pendingDigs.length >= 6 || (c.st === 0 && this.pendingDigs.length)) {
    this.w.digMany(this.pendingDigs);
    this.pendingDigs = [];
  }
  // 体の跡を記録する
  const tr = this.trails.get(c.id) ?? [];
  if (!tr.length || sq(tr[0] - c.x) + sq(tr[1] - c.y) >= 14 * 14) {
    tr.unshift(Math.round(c.x), Math.round(c.y));
    if (tr.length > 24) tr.length = 24;
    this.trails.set(c.id, tr);
  }
  // 通り道の生き物を飲み込む
  this.nearby(c.x, c.y, 1, (o) => {
    if (o === c || o.dead || o.away || o.k === Kind.Golem || o.k === Kind.Ghost || o.k === Kind.Worm || o.k === Kind.Dragon) return;
    if (sq(o.x - c.x) + sq(o.y - c.y) < 16 * 16) this.eat(c, o);
  });
}

declare module '../ecology' {
  interface Ecology {
    mazeTiles: typeof mazeTiles;
    minotaur: typeof minotaur;
    troll: typeof troll;
    basilisk: typeof basilisk;
    gargoyle: typeof gargoyle;
    mimic: typeof mimic;
    golem: typeof golem;
    worm: typeof worm;
  }
}

Object.assign(Ecology.prototype, { mazeTiles, minotaur, troll, basilisk, gargoyle, mimic, golem, worm });
