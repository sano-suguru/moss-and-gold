/** Ecology のメソッド：石像（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** 生き物を、その瞬間の姿のまま石像に変える。by は石にした種（バジリスクの睨みなら17、トロールが光の筋を浴びたなら −1） */
export function petrify(this: Ecology, c: Cr, by = -1): void {
  // ゴーレムとワームは石にならない（体が石と土）
  if (c.k === Kind.Golem || c.k === Kind.Worm) return;
  const k = this.tileOf(c.x, c.y);
  const m = this.w.map;
  // 入口のそばでは石像にならない（入口をふさがないように）。死として扱い、持ち物と金貨は die が落とす
  // （以前は、ここへ来る前にも持ち物を落としていたので、二度落としていた。冒険者なら倒れた数も2つ増えた）
  const nearGate = Math.abs((k % m.w) - m.entrance.x) + Math.floor(k / m.w) < 10;
  if (k < 0 || this.statueAt.has(k) || nearGate) {
    this.die(c, 'petrified', by);
    return;
  }
  this.dropBelongings(c);
  if (c.gold > 0) {
    this.dropGold(c.x, c.y, c.gold, this.ownerNote(c, 'fell'));
    c.gold = 0;
  }
  this.record('deaths', { t: this.w.tick, id: c.id, k: c.k, cause: 'petrified', by, x: Math.round(c.x), y: Math.round(c.y) } as never);
  this.releaseMana(c);
  const st: Statue = { id: this.nextId++, x: Math.round(c.x), y: Math.round(c.y), k: c.k, sp: c.sp, dir: c.dir, act: c.act === 3 ? 0 : c.act, f: (this.step >> 2) & 3, units: c.body + c.food + c.units, age: 0 };
  this.statues.push(st);
  // 石像の覚え書き：誰が石になったかと、石にした種（情報パネルに出る）
  const n = this.ownerNote(c, 'petrified');
  if (by >= 0) n.by = by;
  this.note(st.id, n);
  if (STR[c.k] >= 5) this.log(c.x, c.y, `{k:${c.k}}が石になった`);
  // 石像のマスは、覚えておく位置（丸めた座標）で決める（ロードし直したときと同じマスになるように）
  const sk = this.tileOf(st.x, st.y);
  st.blocks = sk >= 0 && this.blocksAt(sk) ? 1 : 0;
  if (st.blocks) this.statueAt.set(sk, st.id);
  c.body = 0;
  c.food = 0;
  c.units = 0;
  c.dead = 2;
  this.addDeath(c.x, c.y, c.k);
}

export function rebuildStatueIndex(this: Ecology): void {
  this.statueAt.clear();
  for (const st of this.statues) {
    const k = this.tileOf(st.x, st.y);
    if (st.blocks === undefined) st.blocks = k >= 0 && this.blocksAt(k) ? 1 : 0;
    if (k >= 0 && st.blocks) this.statueAt.set(k, st.id);
  }
}

/** 石像が通り道をふさぐのは開けた場所だけ（細い通路では脇をすり抜けられる） */
export function blocksAt(this: Ecology, k: number): boolean {
  const m = this.w.map;
  let open = 0;
  for (const q of [k + 1, k - 1, k + m.w, k - m.w, k + m.w + 1, k + m.w - 1, k - m.w + 1, k - m.w - 1]) if (q >= 0 && q < m.solid.length && !m.solid[q] && !m.lava[q] && !this.statueAt.has(q)) open++;
  return open >= 6;
}

/** 風化と、暗がりでガーゴイルに変わること */
export function updateStatues(this: Ecology, day: number): void {
  let changed = false;
  for (const st of this.statues) {
    st.age += 50;
    if (st.age % 400 === 0 && st.units > 0) {
      st.units--;
      this.deposit(st.x, st.y, 1);
    }
    const k = this.tileOf(st.x, st.y);
    if (st.units > 8 && st.age > 4000 && k >= 0 && this.lit(k, day) < 0.15 && this.manaAround(k) >= 10 && this.counts[Kind.Gargoyle] < 6 && ih(st.id, this.step, 110) % 120 === 0) {
      const body = Math.min(30, st.units);
      this.originNext = 'mana';
      const g = this.spawn(Kind.Gargoyle, st.x, st.y, body, 0);
      this.takeMana(g, k, 70);
      this.deposit(st.x, st.y, st.units - body);
      g.st = 0;
      g.hx = st.x;
      g.hy = st.y;
      this.counts[Kind.Gargoyle]++;
      st.units = 0;
    }
    if (st.units <= 0) {
      st.id = -1;
      changed = true;
    }
  }
  if (changed) {
    this.statues = this.statues.filter((o) => o.id >= 0);
    this.rebuildStatueIndex();
  }
}

export function pickDark(this: Ecology, salt: number, R: number): number {
  const m = this.w.map;
  for (let i = 0; i < 120; i++) {
    const k = ih(this.step, i, 111 + salt) % (m.w * m.h);
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.inLair((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8)) continue;
    if (this.w.lightBase[k] > 0 || this.w.mossGlow[k] > 0.02 || this.w.lavaGlow[k] > 0.02) continue;
    const x = k % m.w;
    const y = Math.floor(k / m.w);
    if (Math.abs(x - m.entrance.x) + y < R * 0.3) continue;
    // 人の気配の濃い所は住みかにしにくい
    if ((ih(this.step, i, 208) % 100) / 100 < this.presenceAt(x * TILE + 8, y * TILE + 8) * 1.3) continue;
    return k;
  }
  return -1;
}

/** 日の光（光の筋）がそのマスに差しているか */
export function sunlit(this: Ecology, k: number, day: number): boolean {
  return k >= 0 && this.w.lightBase[k] * day > 200;
}

declare module '../ecology' {
  interface Ecology {
    petrify: typeof petrify;
    rebuildStatueIndex: typeof rebuildStatueIndex;
    blocksAt: typeof blocksAt;
    updateStatues: typeof updateStatues;
    pickDark: typeof pickDark;
    sunlit: typeof sunlit;
  }
}

Object.assign(Ecology.prototype, { petrify, rebuildStatueIndex, blocksAt, updateStatues, pickDark, sunlit });
