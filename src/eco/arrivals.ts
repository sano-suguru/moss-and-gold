/** Ecology のメソッド：外から来るもの（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** 口が開いているか（閉じた空洞の外にあるか） */
export function mouthOpen(this: Ecology, i: number): boolean {
  const m = this.w.map;
  const mo = m.mouths[i];
  if (!mo) return false;
  const [x, y] = this.mouthTile(i);
  const k = y * m.w + x;
  return !m.sealed[k] && !m.solid[k];
}

/** 口の内側のマス（上の端の横穴はその一つ下、左右の端の横穴は一つ内側） */
export function mouthTile(this: Ecology, i: number): [number, number] {
  const m = this.w.map;
  const mo = m.mouths[i];
  if (mo.kind !== 0) return [mo.x, mo.y];
  if (mo.y === 0) return [mo.x, 1];
  return [mo.x === 0 ? 1 : mo.x - 1, mo.y];
}

/** 口の中の、生き物が現れる場所 */
export function mouthSpot(this: Ecology, i: number): [number, number] {
  const [x, y] = this.mouthTile(i);
  return [x * TILE + 8, y * TILE + 8];
}

/** 口のまわり（道のり RAT_DOOR_REACH マス）で、大ネズミをあと2匹以上養えるか（食べられる苔を、一匹がゲーム内の1日に食べる量で割った数と、いまいる数を比べる） */
export function ratRoomAt(this: Ecology, x: number, y: number): boolean {
  const d = this.walkDist(this.tileOf(x, y), Ecology.RAT_DOOR_REACH);
  let food = 0;
  for (let q = 0; q < d.length; q++) {
    if (d[q] < 0) continue;
    const v = Math.max(this.w.moss[q], this.w.fungus[q]);
    if (v >= 20) food += v - 12;
  }
  let rats = 0;
  for (const c of this.list) if (c.k === Kind.Rat && !c.dead && !c.away) { const k = this.tileOf(c.x, c.y); if (k >= 0 && d[k] >= 0) rats++; }
  return rats + 2 <= Math.floor(food / 600);
}

/** 入ってきた所から道のり RAT_DOOR_REACH マス以内の巣穴（空きのあるもの）か、その範囲の新しい巣穴 */
export function pickBurrowNear(this: Ecology, spot: [number, number]): Burrow {
  const m = this.w.map;
  const d = this.walkDist(this.tileOf(spot[0], spot[1]), Ecology.RAT_DOOR_REACH);
  for (const b of this.burrows) {
    const k = this.tileOf(b.x, b.y - 3);
    if (k < 0 || d[k] < 0) continue;
    const n = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y).length;
    if (n > 0 && n < 8) return b;
  }
  const reach: number[] = [];
  for (let q = 0; q < d.length; q++) if (d[q] >= 0) reach.push(q);
  let best = -1;
  let bv = -1e9;
  for (let i = 0; i < 80 && reach.length; i++) {
    const k = reach[ih(this.step, i, 81) % reach.length];
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 0) continue;
    let walls = 0;
    for (const nn of [k + 1, k - 1, k - m.w]) walls += m.solid[nn];
    if (!walls) continue;
    const x = (k % m.w) * TILE + 8;
    const y = Math.floor(k / m.w) * TILE + 11;
    if (this.fireNear(x, y)) continue;
    if (this.burrows.some((b) => Math.abs(b.x - x) < 6 * TILE && Math.abs(b.y - y) < 6 * TILE)) continue;
    const v = this.burrowFood(x, y);
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  if (best < 0) return this.pickBurrow();
  const b: Burrow = { x: (best % m.w) * TILE + 8, y: Math.floor(best / m.w) * TILE + 11 };
  b.cap = this.burrowCap(b);
  this.burrows.push(b);
  return b;
}

/**
 * 外から来るもの（生き物の更新50回ごと）：冒険者の一行、ドワーフの一団、空から狩りに来るワイバーンだけ。
 * 野の生き物は外から来ず、ダンジョンの中の土の養分とマナから湧く（src/eco/spawndef.ts の表と、src/eco/generate.ts）
 */
export function arrivals(this: Ecology, day: number): void {
  void day;
  const m = this.w.map;
  const n = this.counts;
  // 大ネズミ・大トカゲ・大グモ・ジャイアントアントは外から来ない（土の養分から湧く：src/eco/spawndef.ts）
  // ゴブリン・オーク・リザードマン・コボルトは外から来ない（土の養分から湧く：src/eco/spawndef.ts）。トロールとバジリスクはマナから湧く
  const cool = (k: Kind) => this.step - (this.lastArrival[k] ?? -1e9) > 3600;
  // ヴァンパイアは外から来ない（マナから湧く：src/eco/spawndef.ts）
  // ワイバーン：コウモリやガーゴイルが増えると、夕暮れに裂け目から降りてくる
  const dusk = this.phaseNow > 0.74 && this.phaseNow < 0.86;
  if (dusk && (n[Kind.Bat] >= 20 || n[Kind.Gargoyle] >= 2) && n[Kind.Wyvern] === 0 && m.shafts.length && cool(Kind.Wyvern) && ih(this.step, 16, 71) % 20 === 0) {
    this.lastArrival[Kind.Wyvern] = this.step;
    const sh = m.shafts[ih(this.step, 17, 71) % m.shafts.length];
    this.imported += SPEC[Kind.Wyvern].body;
    this.originNext = 'shaft';
    const wv = this.spawn(Kind.Wyvern, sh.x * TILE + 8, sh.y * TILE + 8, SPEC[Kind.Wyvern].body, 0);
    this.log(wv.x, wv.y, `天井の裂け目から{k:${Kind.Wyvern}}が舞い降りた`);
    wv.hx = wv.x;
    wv.hy = wv.y;
    wv.st = 1;
  }
  // ドラゴンは外から来ない（深部の濃いマナから幼子が生まれ、育つ：manaBirths）
  // ドワーフ：2日目以降、岩の奥に古い宝がある限り、一団が来て住み着く（いなくなれば、しばらくして次の一団）
  if (this.step % 600 === 300 && !this.hold && this.w.tick > DAY_TICKS_ECO * 2 && (this.lastDwarves < 0 || this.w.tick - this.lastDwarves > DAY_TICKS_ECO)) this.maybeDwarves();
  // 冒険者：噂（明るさ、金貨、アンデッド、大物、竜）に惹かれて一行がやって来る
  if (this.step % 300 === 150 && this.parties.length < Ecology.ADV_MAX_PARTIES) this.maybeParty();
}

declare module '../ecology' {
  interface Ecology {
    mouthOpen: typeof mouthOpen;
    mouthTile: typeof mouthTile;
    mouthSpot: typeof mouthSpot;
    ratRoomAt: typeof ratRoomAt;
    pickBurrowNear: typeof pickBurrowNear;
    arrivals: typeof arrivals;
  }
}

Object.assign(Ecology.prototype, { mouthOpen, mouthTile, mouthSpot, ratRoomAt, pickBurrowNear, arrivals });
