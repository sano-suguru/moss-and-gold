/**
 * Ecology のメソッド：大グモの技（糸吐き）。src/eco/step.ts から、大グモの判断のはじめに呼ぶ。
 *
 * 糸吐き：近づいてきた相手へ、腹を持ち上げて溜め（およそ1秒。腹の先に白い糸の玉が膨らむ）、白い糸の帯を吐く。
 *   帯は少したわみながら、吐いたときに相手がいた所へ伸び、届いた時にそこ（半径 SILK_R）にいる者を一人だけ縛る（動いていれば外れる）。
 *   縛られた者（Cr.bind）は、その場から動けずにもがくが、隣の相手は打てる（boundStep）。冒険者は刃物か松明で約2秒で糸を切って抜け、
 *   白い糸の切れ端が散る。
 *   吐いたクモは、縛った相手が動けないあいだに跳びかかって毒牙で噛みつく（倒しても冒険者は食べない。亡骸は残る）。噛まれた冒険者はクモに気づいて打ち返す。
 *   相手は、起きている冒険者（5マスの内）だけ。
 *   （はじめは巣で足を取られる強さの者すべてにしていたが、スライム・大トカゲ・マイコニドまで縛り、8シードの10〜18日目で843回と多すぎた。
 *    ゴブリン・コボルトにも吐くと412回で、コボルトの生まれる数が倍になった（65→135）。クモを打ってきたゴブリン・コボルトだけにすると、
 *    打ってくる相手はたいてい隣にいて近すぎるので、一度も吐かなかった）。
 *   使ったあと30秒は吐かない（一つの戦いにたいてい1回）。溜めの途中で打たれると止まる。
 *
 * 状態：溜めているあいだは run に −1、吐いたあと（糸が飛ぶ間と、噛みつきに行く間）は run に残りの回数、狙う相手は aim（どれもセーブに入る）。
 * 糸が届くのは、少し後で当たる攻撃（src/eco/attack.ts の queueVolley・resolveVolleys。Volley.bind）で扱う。
 */
import { CR_EVERY, Cr, Ecology, Kind, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import type { Skill } from './skill';

/** 糸吐き：およそ1秒溜め、使ったあと30秒は吐かない */
export const SKILL_SPIDER_SPIT: Skill = { windup: 5, cool: 150 };
/** 糸の届く遠さと、近すぎて吐かない遠さ（px） */
const SPIT_MAX = 5 * TILE;
const SPIT_MIN = 1.5 * TILE;
/** 糸の帯の伸びる速さ（生き物の更新1回あたりの px）と、届いた所で縛る丸の半径 */
const SILK_SPEED = 26;
const SILK_R = 10;
/** 縛る長さ（生き物の更新の回数）：冒険者は刃物か松明で約2秒で糸を切って抜ける */
export const BIND_ADV = 10;
/** 吐いたあと、縛った相手へ噛みつきに行く長さ（生き物の更新の回数）と、噛みつく間合い（px）、毒の長さ */
const POUNCE_N = 24;
const BITE_D = 12;
const BITE_POISON = 10;
/** 噛みつきに行くときの速さ（生き物の更新1回あたりの px） */
const LEAP_SPEED = 5;
/** 縛られた者が隣の相手を打つ間合い（px） */
const BOUND_REACH = 14;

/** 糸で縛れる相手か：起きている冒険者 */
export function silkOk(this: Ecology, o: Cr): boolean {
  return o.k === Kind.Adventurer && !o.dead && !o.away && !o.caught && o.bind <= 0 && o.sleep <= 0;
}

/** 技の溜めと、吐いたあとの噛みつき（大グモの判断のはじめに呼ぶ）。true なら、この回はこれで終わり */
export function spiderSkill(this: Ecology, c: Cr): boolean {
  if (c.run < 0) {
    const sk = this.skillStep(c, SKILL_SPIDER_SPIT);
    if (sk === 'charging') {
      const t = this.byId.get(c.aim);
      if (t && !t.dead) this.setDir(c, t.x - c.x, t.y - c.y);
      return true;
    }
    c.run = 0;
    if (sk !== 'ready') {
      c.aim = 0;
      return false;
    }
    c.act = 2;
    c.actT = 0;
    this.spiderSpit(c);
    return true;
  }
  if (c.run > 0) {
    c.run--;
    const t = this.byId.get(c.aim);
    const flying = c.run >= POUNCE_N;
    if (!t || t.dead || t.away || c.flee > 0 || (!flying && t.bind <= 0)) {
      c.run = 0;
      c.aim = 0;
      return false;
    }
    if (flying) {
      // 糸が飛んでいるあいだは、吐いた姿のまま相手を見る
      this.setDir(c, t.x - c.x, t.y - c.y);
      if (c.act !== 2 || c.actT > 3) c.act = 0;
      return true;
    }
    // 縛った相手へ駆け寄り、毒牙で噛みつく
    const d2 = sq(t.x - c.x) + sq(t.y - c.y);
    if (d2 > BITE_D * BITE_D) {
      // 跳びかかる姿で、一気に寄る（ふだんの「じっと待ってから跳ぶ」歩き方では、冒険者が縛られている2秒のあいだに届かなかった。
      // 歩き方の止まる番は、攻撃の姿のあいだは来ない。src/eco/move.ts の gaitOf）
      c.act = 2;
      c.actT = 0;
      this.moveToward(c, t.x, t.y, LEAP_SPEED);
    } else if (this.step % 3 === c.id % 3) this.spiderBite(c, t);
    else this.setDir(c, t.x - c.x, t.y - c.y);
    return true;
  }
  if (c.flee > 0 || c.sleep > 0 || c.caught || this.step % 2 !== c.id % 2 || !this.skillCanStart(c, SKILL_SPIDER_SPIT)) return false;
  const t = this.spitTarget(c);
  if (!t) return false;
  c.run = -1;
  c.aim = t.id;
  this.setDir(c, t.x - c.x, t.y - c.y);
  this.skillStart(c, SKILL_SPIDER_SPIT);
  return true;
}

/** 糸を吐く相手：見通しが利き、気づいている、いちばん近い冒険者（5マスの内。近すぎる相手には吐かない） */
export function spitTarget(this: Ecology, c: Cr): Cr | null {
  const m = this.w.map;
  let best: Cr | null = null;
  let bd = 1e18;
  this.nearby(c.x, c.y, Math.ceil(SPIT_MAX / TILE) + 1, (o) => {
    if (o === c || !this.silkOk(o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < SPIT_MIN * SPIT_MIN || d > SPIT_MAX * SPIT_MAX || d >= bd) return;
    if (!this.canSense(c, o) || !lineOfSight(m, c.x, c.y, o.x, o.y)) return;
    bd = d;
    best = o;
  });
  return best;
}

/** 糸を吐く：吐いたときに相手がいた所へ、白い糸の帯が伸びる。届いた時に、そこにいる者を一人縛る（resolveVolleys から silkLands） */
export function spiderSpit(this: Ecology, c: Cr): void {
  const t = this.byId.get(c.aim);
  if (!t || t.dead || t.away) {
    c.aim = 0;
    return;
  }
  const L = Math.sqrt(sq(t.x - c.x) + sq(t.y - c.y));
  if (L > SPIT_MAX + TILE || !lineOfSight(this.w.map, c.x, c.y, t.x, t.y)) {
    c.aim = 0;
    return;
  }
  const n = Math.max(2, Math.ceil(L / SILK_SPEED));
  this.queueVolley(c, { d: -1, x: t.x, y: t.y, r: SILK_R, mul: 0, poison: 0, tgt: t.id, bind: 1 }, n * CR_EVERY);
  this.fxAttacks.push({ t: this.w.tick, style: 'silk', col: 0, size: 1, ax: c.x, ay: c.y, dx: t.x, dy: t.y, did: t.id, aid: c.id, big: false, kill: false, fly: n * CR_EVERY });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  c.run = POUNCE_N + n;
  this.record('settle', { t: this.w.tick, k: Kind.Spider, ev: 'spit', id: c.id, n: t.k, x: Math.round(c.x), y: Math.round(c.y) } as never);
}

/** 糸が届いた（resolveVolleys から）：届いた所（半径 r）にいる、縛れる者のうち、いちばん近い一人を縛る */
export function silkLands(this: Ecology, a: Cr, v: { x: number; y: number; r: number; tgt?: number }): void {
  let best: Cr | null = null;
  let bd = v.r * v.r;
  this.nearby(v.x, v.y, Math.ceil(v.r / TILE) + 1, (o) => {
    if (!this.silkOk(o)) return;
    const d = sq(o.x - v.x) + sq(o.y - v.y) - (o.id === v.tgt ? 1 : 0);
    if (d > bd) return;
    bd = d;
    best = o;
  });
  const o = best as Cr | null;
  if (o) {
    o.bind = BIND_ADV;
    // （縛った相手に、このクモを打ってきた相手として覚えさせない：覚えさせると、縛られた冒険者が抜けたあとクモを狙って倒し、
    //  16シード×25日で冒険者に倒されるクモが642→903匹に増え、巣にかかった獲物を食べる場面が895→500回に減った。
    //  冒険者は噛みつかれた時に、打たれたときのふつうの仕組みでクモに気づく）
    o.sleep = 0;
    o.act = 0;
    o.actT = 0;
    if (a.aim !== o.id) a.aim = o.id;
    this.record('settle', { t: this.w.tick, k: Kind.Spider, ev: 'spiderBind', id: a.id, n: o.k, x: Math.round(o.x), y: Math.round(o.y) } as never);
  }
  // 届いた所：縛れば相手の足もとに糸が巻きつき（描画は Cr.bind から）、外れれば床に糸が貼りつく
  this.fxAttacks.push({ t: this.w.tick, style: 'silkhit', col: o ? 1 : 0, size: 1, ax: a.x, ay: a.y, dx: o ? o.x : v.x, dy: o ? o.y : v.y, did: o ? o.id : -1, aid: a.id, big: false, kill: false });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
}

/** 縛った相手に毒牙で噛みつく（倒しても、冒険者は食べない：亡骸が残る） */
export function spiderBite(this: Ecology, c: Cr, t: Cr): void {
  c.act = 2;
  c.actT = 0;
  this.setDir(c, t.x - c.x, t.y - c.y);
  if (c.hp <= 0) c.hp = this.maxHp(c);
  this.poisonOn(t, c.k, BITE_POISON);
  const killed = this.strike(c, t);
  this.record('settle', { t: this.w.tick, k: Kind.Spider, ev: 'spiderBite', id: c.id, n: t.k, how: killed ? 1 : 0, x: Math.round(t.x), y: Math.round(t.y) } as never);
  if (killed) this.slay(c, t, t.k !== Kind.Adventurer && t.k !== Kind.Dwarf);
}

/**
 * 糸に縛られている者の、生き物の更新ごとの進み（step.ts から、ほかの行いより先に）。true ならこの回はこれで終わり。
 * その場から動けずにもがき、打ってきた相手（foe）が隣にいれば打ち返す。抜けた時に糸の切れ端が散る（冒険者は糸を切った記録を残す）
 */
export function boundStep(this: Ecology, c: Cr): boolean {
  if (c.bind <= 0) return false;
  c.bind--;
  c.act = 0;
  const f = this.byId.get(c.foe);
  if (f && !f.dead && !f.away) {
    this.setDir(c, f.x - c.x, f.y - c.y);
    if (sq(f.x - c.x) + sq(f.y - c.y) < BOUND_REACH * BOUND_REACH && this.step % 3 === c.id % 3 && this.str(c) > 0) this.fight(c, f);
  }
  if (c.bind === 0) {
    this.fxAttacks.push({ t: this.w.tick, style: 'silkcut', col: c.k === Kind.Adventurer ? 1 : 0, size: 1, ax: c.x, ay: c.y, dx: c.x, dy: c.y, did: c.id, aid: c.id, big: false, kill: false });
    if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
    if (c.k === Kind.Adventurer) this.record('settle', { t: this.w.tick, k: Kind.Adventurer, ev: 'silkCut', id: c.id, n: c.sp, x: Math.round(c.x), y: Math.round(c.y) } as never);
  }
  return true;
}

declare module '../ecology' {
  interface Ecology {
    silkOk: typeof silkOk;
    spiderSkill: typeof spiderSkill;
    spitTarget: typeof spitTarget;
    spiderSpit: typeof spiderSpit;
    silkLands: typeof silkLands;
    spiderBite: typeof spiderBite;
    boundStep: typeof boundStep;
  }
}

Object.assign(Ecology.prototype, { silkOk, spiderSkill, spitTarget, spiderSpit, silkLands, spiderBite, boundStep });
