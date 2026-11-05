/** Ecology のメソッド：炎（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import type { MapData } from '../mapgen';
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

/**
 * 炎の口元：体の中心（足元）から、向いている側へ前、画面の上へ上のマス数（絵の炎の柱の付け根に合わせる。src/creatureView.ts）。
 * 横向きの竜は頭が足元より上にあるので、口元も上へずらす（以前は足元の高さから吐いていたので、絵の炎は床の上を通るのに、
 * 一段下の行が燃え、壁ぎわでは扇のほとんどが壁にかかって消えていた）
 */
const MOUTH_YOUNG = { fwd: 1.5, up: 1 };
const MOUTH_SIDE = { fwd: 2.5, up: 2 };
const MOUTH_FRONT = { fwd: 1, up: 0 };
/**
 * 炎の先が生き物の更新1回に進むマス数（若い竜は吐く時間が短いので速く進む。炎の先は口元から、若い竜で約5マス、成竜で約7マス）と、
 * 口元での扇の半分の幅、1マス進むごとに広がる半分の幅（炎の先の幅は、若い竜で3マス、成竜で5マス）。描画（src/renderer.ts）も同じ形の扇に、燃える床と同じ炎を描く
 */
export const BREATH_STEP = 0.6;
export const BREATH_STEP_YOUNG = 0.8;
export const BREATH_HALF0 = 0.25;
export const BREATH_SPREAD = 0.25;
/** 燃える床の燃え続ける長さ（生き物の更新の回数。16〜28回。通常速度で3〜6秒） */
const BURN_MIN = 16;
const BURN_RANGE = 13;

/** ドラゴン c が炎を吐くときの向き（上下左右。若い竜は左右だけ）と口元、炎の先の進む速さ。breathe・breathCovers・forBreathFan で同じものを使う */
export function breathAxis(c: Cr, tx: number): { ux: number; uy: number; mx: number; my: number; young: boolean; dir: number; step: number } {
  const young = c.sp < 2 && c.elite !== 8;
  const dir = young ? (tx >= c.x ? 2 : 3) : c.dir;
  const ux = dir === 2 ? 1 : dir === 3 ? -1 : 0;
  const uy = ux ? 0 : dir === 1 ? -1 : 1;
  const mo = young ? MOUTH_YOUNG : ux ? MOUTH_SIDE : MOUTH_FRONT;
  return { ux, uy, mx: c.x + ux * mo.fwd * TILE, my: c.y + uy * mo.fwd * TILE - mo.up * TILE, young, dir, step: young ? BREATH_STEP_YOUNG : BREATH_STEP };
}

/** ドラゴン c が今の向きで炎を吐けば、(x, y) が炎の扇の中に入るか（吐き終わるまでに炎の先が届く範囲。若い竜は左右だけを向く） */
export function breathCovers(this: Ecology, c: Cr, x: number, y: number): boolean {
  const a = breathAxis(c, x);
  const d = ((x - a.mx) * a.ux + (y - a.my) * a.uy) / TILE;
  const w = Math.abs((x - a.mx) * -a.uy + (y - a.my) * a.ux) / TILE;
  const reach = 0.5 + (a.young ? 6 : 11) * a.step;
  return d >= -0.5 && d <= reach && w <= BREATH_HALF0 + Math.max(0, d) * BREATH_SPREAD + 0.5;
}

/**
 * 炎の扇の中の、口元からの遠さ d0 から炎の先までのマス（体の中心から見通せる床だけ）を、fn に順に渡す。
 * t は炎を吐きはじめてからの生き物の更新の回数（成竜は 0..11、若い竜は 0..6）。先へ行くほど広い。
 * シミュレーション（breathe）と描画（src/renderer.ts。炎を吐いている間、扇のマスに燃える床と同じ炎を描く）で同じ形を使う
 */
export function forBreathFan(m: MapData, c: Cr, tx: number, t: number, d0: number, fn: (k: number) => void): void {
  const { ux, uy, mx, my, step } = breathAxis(c, tx);
  const reach = 0.5 + t * step;
  // 見通しは口元から測る（口元が岩の中なら体の中心から）
  const mk = Math.floor(my / TILE) * m.w + Math.floor(mx / TILE);
  const inRock = mx < 0 || my < 0 || mx >= m.w * TILE || my >= m.h * TILE || m.solid[mk];
  const ox = inRock ? c.x : mx;
  const oy = inRock ? c.y : my;
  for (let d = d0; d <= reach; d += 0.5) {
    // 横のずれは、0 を中心に半マスずつ左右対称に（口元の近くは1マス幅の線になる。以前は片側へ寄って、体の横や下にも火がついていた）
    const hw = Math.floor((BREATH_HALF0 + d * BREATH_SPREAD) * 2) / 2;
    for (let w = -hw; w <= hw; w += 0.5) {
      const x = mx + (ux * d - uy * w) * TILE;
      const y = my + (uy * d + ux * w) * TILE;
      const tx0 = Math.floor(x / TILE);
      const ty0 = Math.floor(y / TILE);
      if (tx0 < 0 || ty0 < 0 || tx0 >= m.w || ty0 >= m.h) continue;
      const k = ty0 * m.w + tx0;
      if (m.solid[k]) continue;
      if (!lineOfSight(m, ox, oy, tx0 * TILE + 8, ty0 * TILE + 8)) continue;
      fn(k);
    }
  }
}

/**
 * 炎の吐息：口元から、向いている向きに沿って扇形に、手前から順に火をつける。
 * 向きは絵の向きに合わせる（若い竜は横向きの絵しかないので左右だけ、成竜は上下左右）。斜めに吐くと、絵の炎の柱と燃える場所がずれていた。
 * 扇は体の中心ではなく口元から始まる（以前は体の中心から1マス先で燃え始め、ドラゴンの足元や体の横から火が湧いたように見えていた）
 */
export function breathe(this: Ecology, c: Cr, tx: number, ty: number, t: number): void {
  const m = this.w.map;
  // 若い竜は、いつも獲物のいる側の左右を向く（絵の向きも合わせる）
  const ax = breathAxis(c, tx);
  c.dir = ax.dir;
  const reach = 0.5 + t * ax.step;
  const fan = (d0: number, fn: (k: number) => void) => forBreathFan(m, c, tx, t, d0, fn);
  // 床に火をつけるのは炎の先の帯だけ。炎が地面に届くのは口元の半マス先から（口元の真下の、ドラゴンの頭の下には火がつかない）
  fan(Math.max(0.5, reach - 1.2), (k) => this.ignite(k, BURN_MIN + (ih(k, this.step, 130) % BURN_RANGE)));
  // 扇の全体（口元から炎の先まで）にいる者は、炎を吐く間、生き物の更新ごとにドラゴンの強さの4〜8割の傷を負う（居続けると打ち合いの2〜3回分。逃げれば助かる）。
  // 飛んでいる者（コウモリ、ワイバーン、ウィスプ）は、床に燃え残った火では焼けないが、吐いている炎そのものには当たる。
  // （以前は、飛んでいる者は炎の先に当たるとその場で焼け死に、地面にいる者は燃えるマスに立つとその場で焼け死んでいた）
  const hit = new Set<Cr>();
  fan(0, (k) => {
    const kx = (k % m.w) * TILE + 8;
    const ky = Math.floor(k / m.w) * TILE + 8;
    this.nearby(kx, ky, 1, (o) => {
      if (o.dead || o.away || o === c || hit.has(o) || FIREPROOF.includes(o.k)) return;
      if (Math.abs(o.x - kx) < 9 && Math.abs(o.y - ky) < 9) {
        hit.add(o);
        this.burnHurt(o, this.str(c) * (BREATH_MIN + ((ih(c.id, o.id ^ this.step, 162) % 1000) / 1000) * BREATH_RANGE), Kind.Dragon);
      }
    });
  });
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
    breathCovers: typeof breathCovers;
    burnHurt: typeof burnHurt;
    scorchMoss: typeof scorchMoss;
    airborne: typeof airborne;
  }
}

Object.assign(Ecology.prototype, { ignite, updateFire, breathe, breathCovers, burnHurt, scorchMoss, airborne });
