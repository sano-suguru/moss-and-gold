/** Ecology のメソッド：ジャイアントアント（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function pickNest(this: Ecology): number {
  const m = this.w.map;
  let best = -1;
  let bv = -1e9;
  for (let i = 0; i < 200; i++) {
    const k = ih(this.step, i, 63) % (m.w * m.h);
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.moist[k] > 120) continue;
    let walls = 0;
    for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (m.solid[q]) walls++;
    if (walls === 0) continue;
    // 近くのキノコの量
    let f = 0;
    const x = k % m.w;
    const y = Math.floor(k / m.w);
    for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) f += this.w.fungus[yy * m.w + xx];
    }
    if (f < 200) continue;
    if (this.colonies.some((o) => Math.abs(o.x - x * TILE) + Math.abs(o.y - y * TILE) < 30 * TILE)) continue;
    const v = f - walls * 10;
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}

/** 同じ所へ向かうアリが、個体ごとに少しずつずれて取りつく点（中心からのずれ。半径 r の円の上、個体の番号で決まる） */
function antSpot(c: Cr, r: number): [number, number] {
  const a = (c.id * 2.39996) % 6.2832;
  return [Math.cos(a) * r, Math.sin(a) * r * 0.75];
}

export function colonyOf(this: Ecology, c: Cr): Colony | undefined {
  return this.colonies.find((o) => o.id === c.ref);
}

export function ant(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Ant];
  const col = this.colonyOf(c);
  if (!col) {
    // 巣を失ったアリはさまよう
    c.act = 1;
    const j = DIR16[ih(c.id, this.step >> 3, 64) & 15];
    this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
    return;
  }
  // 腹が減ったら、運んでいる物を少し食べる。何もなければ巣に戻って蓄えを食べる
  if (c.hungry && c.units > 0 && c.food < 3) {
    const t = Math.min(c.units, s.cap - c.food);
    c.units -= t;
    c.food += t;
    c.sinceMeal = 0;
  }
  if (c.hungry && c.st === 0 && c.units === 0 && col.store > 0) c.st = 1;
  if (c.st === 1) {
    c.act = 1;
    // 巣の口のまわりに、個体ごとに少しずれた所を目指し、巣から1.5マスの内に入れば納める
    // （以前はみな巣の真ん中の一点から10px の内に入ろうとして、十数匹が一点に集まり、
    //  列の間合いで歩みをゆるめ合って入れず、巣のまわりで押し合いながら足踏みしていた。16シードの12日目で引っかかりの3割）
    const [ox, oy] = antSpot(c, 10);
    if (this.goTo(c, col.x + ox, col.y + oy, s.speed) || sq(col.x - c.x) + sq(col.y - c.y) < 24 * 24) {
      col.store += c.units;
      c.units = 0;
      if (c.food < 4 && col.store > 0) {
        const t = Math.min(4, col.store, s.cap - c.food);
        col.store -= t;
        c.food += t;
        c.sinceMeal = 0;
      }
      c.st = 0;
      c.ref2 = 0;
    }
    return;
  }
  // 蓄えが十分なら巣のそばで休む
  if (col.store > 120 && c.units === 0) {
    c.act = sq(col.x - c.x) + sq(col.y - c.y) > 3 * TILE * 3 * TILE ? 1 : 0;
    if (c.act === 1) this.goTo(c, col.x, col.y, s.speed);
    return;
  }
  // 運ぶ物を探す：巣に近い死骸、なければキノコや苔
  let target = this.byId.get(c.ref2) ?? null;
  if (target && (target.dead !== 1 || target.units <= 0)) target = null;
  // 目当ての死骸が無くなっていたら（ほかの者に食べられた、朽ちた）、覚えた番号を消して探し直す
  // （以前は番号が残ったまま探し直さず、何もしないまま歩く姿でその場に立ち続けていた）
  if (!target && c.ref2 > 0) c.ref2 = 0;
  if (!target && c.ref2 === 0) {
    let bd = 14 * TILE * 14 * TILE;
    for (const o of this.corpses) {
      const d = sq(o.x - col.x) + sq(o.y - col.y);
      if (d < bd) {
        bd = d;
        target = o;
      }
    }
    if (target) c.ref2 = target.id;
    else {
      const k = this.findMoss(c, col.x, col.y, 8, 65);
      const kk = k >= 0 ? k : this.findFungus(col.x, col.y, 8, c.id);
      if (kk >= 0) {
        c.ref2 = -1 - kk;
      } else {
        c.act = 1;
        const j = DIR16[ih(c.id, this.step >> 4, 66) & 15];
        this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
        return;
      }
    }
  }
  c.act = 1;
  if (target) {
    // 死骸のまわりに、個体ごとに少しずれて取りつく（一点に集まって押し合わないように）
    if (sq(target.x - c.x) + sq(target.y - c.y) < 14 * 14) {
      const t = Math.min(2, target.units, 4 - c.units);
      target.units -= t;
      c.units += t;
      if (target.units <= 0) target.dead = 2;
      if (c.units >= 4 || target.dead === 2) c.st = 1;
    } else {
      const [ox, oy] = antSpot(c, 7);
      this.goTo(c, target.x + ox, target.y + oy, s.speed);
    }
    return;
  }
  if (c.ref2 < 0) {
    const k = -1 - c.ref2;
    const m = this.w.map;
    // マスの中で、個体ごとに少しずれた所を目指し、そのマスに乗るか10px の内に入れば取る
    const [ox, oy] = antSpot(c, 5);
    const tx = (k % m.w) * TILE + 8 + ox;
    const ty = Math.floor(k / m.w) * TILE + 8 + oy;
    if (this.goTo(c, tx, ty, s.speed) || this.tileOf(c.x, c.y) === k || sq(tx - c.x) + sq(ty - c.y) < 10 * 10) {
      let t = Math.min(2, Math.max(0, this.w.fungus[k] - 12), 4 - c.units);
      if (t > 0) this.w.fungus[k] -= t;
      else {
        t = Math.min(2, Math.max(0, this.w.moss[k] - 12), 4 - c.units);
        this.w.moss[k] -= t;
      }
      if (t > 0) this.mossTouched = true;
      c.units += t;
      if (c.units >= 4 || t === 0) c.st = 1;
    }
  }
}

export function findFungus(this: Ecology, cx: number, cy: number, R: number, salt: number): number {
  const m = this.w.map;
  const tx0 = Math.floor(cx / TILE);
  const ty0 = Math.floor(cy / TILE);
  let best = -1;
  let bv = 24;
  for (let i = 0; i < 28; i++) {
    const h = ih(salt, this.step, 67 + i);
    const x = tx0 + ((h & 255) % (2 * R + 1)) - R;
    const y = ty0 + (((h >>> 8) & 255) % (2 * R + 1)) - R;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
    const k = y * m.w + x;
    if (m.solid[k] || m.lava[k]) continue;
    if (this.w.fungus[k] > bv) {
      bv = this.w.fungus[k];
      best = k;
    }
  }
  return best;
}

/** 巣：蓄えでキノコ畑を育て、女王が働きアリを産む。食べ物が尽きると衰えて消える */
export function updateColonies(this: Ecology): void {
  const m = this.w.map;
  for (const col of this.colonies) {
    const workers = this.list.filter((c) => c.k === Kind.Ant && !c.dead && c.ref === col.id).length;
    // 女王の暮らし
    if (this.step % 200 === 5) {
      if (col.store > 0) {
        col.store--;
        this.deposit(col.x, col.y, 1);
        col.starve = 0;
      } else col.starve++;
    }
    // キノコ畑
    for (let g = 0; g < Math.min(6, Math.floor(col.store / 24)) && this.step % 50 === 5 && (workers >= 30 || col.store > 60) && this.w.totalFungus < 30000; g++) {
      const h = ih(col.id, this.step, 68 + g);
      const x = Math.floor(col.x / TILE) + ((h & 7) % 7) - 3;
      const y = Math.floor(col.y / TILE) + (((h >>> 4) & 7) % 7) - 3;
      if (x > 0 && y > 0 && x < m.w - 1 && y < m.h - 1) {
        const k = y * m.w + x;
        if (!m.solid[k] && !m.lava[k] && this.w.fungus[k] < 200) {
          this.w.fungus[k] += 4;
          col.store -= 4;
          this.mossTouched = true;
        }
      }
    }
    // 産卵
    if (this.step % 100 === 5 && col.store >= 10 && workers < Math.min(40, 6 + Math.floor(col.store / 3))) {
      col.store -= 4;
      const a = this.spawn(Kind.Ant, col.x, col.y, 4, 0);
      a.ref = col.id;
      a.st = 0;
    }
    // 衰えて消える
    if (col.starve > 15 && workers === 0) {
      this.deposit(col.x, col.y, col.queen + col.store);
      col.queen = 0;
      col.store = 0;
      col.id = -1;
    }
  }
  this.colonies = this.colonies.filter((o) => o.id >= 0);
}

declare module '../ecology' {
  interface Ecology {
    pickNest: typeof pickNest;
    colonyOf: typeof colonyOf;
    ant: typeof ant;
    findFungus: typeof findFungus;
    updateColonies: typeof updateColonies;
  }
}

Object.assign(Ecology.prototype, { pickNest, colonyOf, ant, findFungus, updateColonies });
