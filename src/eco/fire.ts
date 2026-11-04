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

/** マスの苔とキノコを焼く（燃える床は作らない。焼けた分は土の養分に返る。魔法使いの炎の呪文から） */
export function scorchMoss(this: Ecology, k: number): void {
  if (k < 0 || k >= this.w.map.solid.length) return;
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
}

/** 燃える床の上にいる者が受けるダメージ（生き物の更新4回ごとに、最大の体力のこの割合。逃げ遅れると数回で倒れる） */
const FLOOR_BURN = 0.2;
/** ドラゴンの炎の扇の中にいる者が、炎を吐く間に生き物の更新ごとに受けるダメージ（ドラゴンの強さに対する割合の幅。居続けると打ち合いの2〜3回分） */
const BREATH_MIN = 0.4;
const BREATH_RANGE = 0.4;
/** 焼かれた記録（settle.jsonl の burn）を新しく残すまでの、前に傷を受けてからの間（tick。生き物の更新100回） */
const BURN_EPISODE = 200;
/** 炎に焼かれない者 */
const FIREPROOF = [Kind.Dragon, Kind.Golem, Kind.Worm, Kind.Ghost, Kind.Salamander];

/**
 * 炎で傷を負う（燃える床とドラゴンの炎から）。体力が尽きれば焼け死ぬ（手を下した種は by）。
 * やられそうになったヴァンパイアは、ばらけられるならコウモリの群れにばらけて逃げる（src/eco/vampire.ts の vampCanScatter）
 */
export function burnHurt(this: Ecology, o: Cr, dmg: number, by: number): void {
  if (o.hp <= 0) o.hp = this.maxHp(o);
  // 分析用：焼かれた（前に傷を受けてから生き物の更新100回より後の、最初の一回だけ。続けて焼かれても1回。lib/moments.ts が、その後に生き延びたかを数える）
  if (this.w.tick - o.hitAt > BURN_EPISODE) this.record('settle', { t: this.w.tick, k: by, ev: 'burn', id: o.id, n: o.k, x: Math.round(o.x), y: Math.round(o.y) } as never);
  o.hp -= dmg;
  o.hitAt = this.w.tick;
  o.sleep = 0;
  this.fxHits.push({ t: this.w.tick, x: o.x, y: o.y, ax: o.x, ay: o.y + 8, id: o.id });
  if (this.fxHits.length > 120) this.fxHits.splice(0, 40);
  // 焼かれている者に炎がまとわりつく（描画専用。src/creatureView.ts）
  this.fxBurns.push({ t: this.w.tick, id: o.id });
  if (this.fxBurns.length > 120) this.fxBurns.splice(0, 40);
  if (o.k === Kind.Vampire && o.hp < this.maxHp(o) * 0.35 && this.vampCanScatter(o)) {
    o.hp = Math.max(1, o.hp);
    this.vampScatter(o);
    return;
  }
  if (o.hp <= 0) this.die(o, 'burned', by);
  else if (o.k === Kind.Adventurer) this.heroHurt(o);
}

/**
 * 燃えているマス：苔とキノコは灰になって土に返り、上にいる生き物は少しずつ焼かれ（生き物の更新4回ごとに最大の体力の20％。FLOOR_BURN）、巣は燃え落ちる。
 * 火が消えると焼け跡が残る。燃える床を作るのはドラゴンの炎だけ（以前は魔法使いの呪文も作り、そばで打ち合う仲間を焼いていた）。
 * 以前は、燃えるマスの上にいる者は強さにかかわらずその場で焼け死んでいた
 */
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
        if (o.dead || o.away || FIREPROOF.includes(o.k)) return;
        if (this.airborne(o)) return;
        if (Math.abs(o.x - x) < 9 && Math.abs(o.y - y) < 9) this.burnHurt(o, Math.max(2, this.maxHp(o) * FLOOR_BURN), Kind.Dragon);
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
  // t は 0 から（成竜は 0..11、若い竜は 0..6）。先へ行くほど広く
  const reach = 1 + t * 0.6;
  const half = 0.6 + t * 0.25;
  const lit: number[] = [];
  for (let s2 = Math.max(1, reach - 1.2); s2 <= reach; s2 += 0.5)
    for (let w = -half; w <= half; w += 0.5) {
      const x = c.x + (ux * s2 - uy * w) * TILE;
      const y = c.y + (uy * s2 + ux * w) * TILE;
      const k = this.tileOf(x, y);
      if (k < 0 || m.solid[k]) continue;
      if (!lineOfSight(m, c.x, c.y, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8)) continue;
      this.ignite(k, 30 + (ih(k, this.step, 130) % 20));
      if (!lit.includes(k)) lit.push(k);
    }
  // 扇の全体（口元から炎の先まで）にいる者は、炎を吐く間、生き物の更新ごとにドラゴンの強さの4〜8割の傷を負う（居続けると打ち合いの2〜3回分。逃げれば助かる）。
  // 飛んでいる者（コウモリ、ワイバーン、ウィスプ）は、床に燃え残った火では焼けないが、吐いている炎そのものには当たる。床に火をつけるのは炎の先だけ（上の lit）。
  // （以前は、飛んでいる者は炎の先に当たるとその場で焼け死に、地面にいる者は燃えるマスに立つとその場で焼け死んでいた）
  const hit = new Set<Cr>();
  for (let s2 = 1; s2 <= reach; s2 += 0.5) {
    const hw = 0.6 + ((s2 - 1) / 0.6) * 0.25;
    for (let w = -hw; w <= hw; w += 0.5) {
      const k = this.tileOf(c.x + (ux * s2 - uy * w) * TILE, c.y + (uy * s2 + ux * w) * TILE);
      if (k < 0 || m.solid[k]) continue;
      const kx = (k % m.w) * TILE + 8;
      const ky = Math.floor(k / m.w) * TILE + 8;
      if (!lineOfSight(m, c.x, c.y, kx, ky)) continue;
      this.nearby(kx, ky, 1, (o) => {
        if (o.dead || o.away || o === c || hit.has(o) || FIREPROOF.includes(o.k)) return;
        if (Math.abs(o.x - kx) < 9 && Math.abs(o.y - ky) < 9) {
          hit.add(o);
          this.burnHurt(o, this.str(c) * (BREATH_MIN + ((ih(c.id, o.id ^ this.step, 162) % 1000) / 1000) * BREATH_RANGE), Kind.Dragon);
        }
      });
    }
  }
}

/** 宙にいて、床に燃え残った火では焼けない者（飛んでいるコウモリ、ワイバーン、ウィスプ） */
export function airborne(this: Ecology, o: Cr): boolean {
  return (o.k === Kind.Bat || o.k === Kind.Wyvern || o.k === Kind.Wisp) && o.st !== 0;
}

declare module '../ecology' {
  interface Ecology {
    ignite: typeof ignite;
    updateFire: typeof updateFire;
    breathe: typeof breathe;
    burnHurt: typeof burnHurt;
    scorchMoss: typeof scorchMoss;
    airborne: typeof airborne;
  }
}

Object.assign(Ecology.prototype, { ignite, updateFire, breathe, burnHurt, scorchMoss, airborne });
