/**
 * Ecology のメソッド：ゴーストの技（金切り声と冷たい手）と、刃のすり抜け。src/eco/undead.ts の ghost から、亡霊の騎士を除くゴーストの判断のはじめに呼ぶ。
 *
 * （以前のゴーストは強さが0で、打ち返さず、自分からも襲わなかった。近くに生き物が来ると攻撃の姿を取るが、相手には何も起きず、
 *  冒険者に倒されるのは、16シード×25日の504回すべてが僧侶の祈りによるお祓いだった。冷気の攻撃の演出も、ゲームの中では一度も描かれていなかった）
 *
 * 襲う相手：近く（4マス）にいる、起きている生きた者（冒険者・ドワーフ・人型・獣。骨・霊・鎧・眷属・ウィスプ・スライム・石の者・ミミック・ワーム・竜・飛んでいる者は除く）。
 *   打ってきた相手がいれば、その相手を先に。相手へ滑るように寄る（光を嫌って漂うのは、相手のいないときだけ）。
 * 金切り声：相手が近く（2.5マスの内）に来たら、体をふくらませて青白い冷気を口もとへ吸い集める溜め（およそ1.2秒）のあと、
 *   口から青白い音の波が幾重にも広がる。波の届く所（3マス、見通しが利く所）の生きた者は皆、冷気に打たれ（傷を負う）、
 *   倒れなかった者はおよそ1.6秒すくんで動けない（頭の上で星が回る。英雄は耐える）。持っている松明も消える。使ったあと20秒は叫ばない。
 * 冷たい手：相手が隣にいれば、青白い手を伸ばして打つ（ふつうの打ち合い。相手は打ち返す）。打たれた所に霜の結晶が弾ける。
 * 刃のすり抜け（src/eco/combat.ts の strike から ghostPhase）：魔法と聖なる攻撃（魔法使いと僧侶、リッチ・サラマンダー・竜・ウィスプ・ほかのゴースト）でない一打ちは、
 *   7割がすり抜ける。ゴーストの体が横へ揺らいで透け、元の所に青白い残像が残る（傷は受けない）。
 *
 * 状態：金切り声を溜めているあいだは run に −1、狙う相手は aim（どちらもセーブに入る）。
 */
import { Cr, Ecology, Job, Kind, SPEC, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import type { Skill } from './skill';

/** 金切り声：およそ1.2秒溜め、使ったあと20秒は叫ばない */
export const SKILL_GHOST_WAIL: Skill = { windup: 6, cool: 100 };
/** 金切り声の届く所（px）と、溜めはじめる相手の近さ（px） */
export const WAIL_R = 3 * TILE;
const WAIL_START = 2.5 * TILE;
/** 金切り声の打ちの強さ（ふつうの一打ちに対する倍率）と、すくむ長さ（生き物の更新の回数） */
const WAIL_MUL = 0.7;
const WAIL_STUN = 8;
/** 相手に気づいて寄る遠さ（px）と、冷たい手の届く間合い（px） */
const HUNT_R = 4 * TILE;
const TOUCH_D = 14;
/** 魔法と聖なる攻撃でない一打ちが、すり抜ける割合（百分率） */
export const PHASE_MISS = 70;

/** ゴーストが襲わない種（骨・霊・鎧・眷属、光と粘体、石の者、ミミック・ワーム・竜。コウモリとワイバーンは飛んでいるあいだ除く） */
const NOT_LIVING = new Set<number>([
  Kind.Ghost, Kind.Zombie, Kind.Skeleton, Kind.Lich, Kind.Armor, Kind.Thrall, Kind.Vampire,
  Kind.Wisp, Kind.Slime, Kind.Golem, Kind.Gargoyle, Kind.Mimic, Kind.Worm, Kind.Dragon,
]);

/** ゴーストが襲う生きた者か */
export function ghostPrey(this: Ecology, o: Cr): boolean {
  return !o.dead && !o.away && !o.caught && o.sleep <= 0 && !NOT_LIVING.has(o.k) && !this.airborne(o);
}

/** 魔法と聖なる攻撃か（ゴーストの体をすり抜けない） */
export function holyStrike(a: Cr): boolean {
  if (a.k === Kind.Adventurer) return a.sp === Job.Wizard || a.sp === Job.Priest;
  return a.k === Kind.Lich || a.k === Kind.Salamander || a.k === Kind.Dragon || a.k === Kind.Wisp || a.k === Kind.Ghost || a.elite === 6 || a.elite === 7;
}

/**
 * 刃のすり抜け（strike のはじめに呼ぶ）。すり抜けたら true（傷も、打たれた時刻も残さない。打った者の攻撃のエフェクトは出す）。
 * ゴーストは、打ってきた相手を覚える（打ち返しと、襲う相手を選ぶのに使う）
 */
export function ghostPhase(this: Ecology, a: Cr, d: Cr, fx: boolean): boolean {
  if (d.k !== Kind.Ghost || d.elite === 2 || holyStrike(a)) return false;
  if (ih(a.id, d.id ^ this.step, 463) % 100 >= PHASE_MISS) return false;
  d.foe = a.id;
  if (fx) this.pushAttackFx(a, d, false, false);
  this.fxAttacks.push({ t: this.w.tick, style: 'phase', col: 0, size: 1, ax: a.x, ay: a.y, dx: d.x, dy: d.y, did: d.id, aid: a.id, big: false, kill: false });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  this.record('settle', { t: this.w.tick, k: Kind.Ghost, ev: 'ghostPhase', id: d.id, n: a.k, x: Math.round(d.x), y: Math.round(d.y) } as never);
  return true;
}

/** 技の溜めと、相手を襲う動き（ゴーストの判断のはじめに呼ぶ）。true なら、この回はこれで終わり */
export function ghostSkill(this: Ecology, c: Cr): boolean {
  if (c.run < 0) {
    const sk = this.skillStep(c, SKILL_GHOST_WAIL);
    if (sk === 'charging') {
      const t = this.byId.get(c.aim);
      if (t && !t.dead) this.setDir(c, t.x - c.x, t.y - c.y);
      return true;
    }
    c.run = 0;
    if (sk === 'ready') {
      c.act = 2;
      c.actT = 0;
      this.ghostWail(c);
      return true;
    }
  }
  if (c.stun > 0) return false;
  const t = this.ghostTarget(c);
  if (!t) {
    c.aim = 0;
    return false;
  }
  c.aim = t.id;
  const d2 = sq(t.x - c.x) + sq(t.y - c.y);
  if (d2 < WAIL_START * WAIL_START && this.step % 2 === c.id % 2 && this.skillCanStart(c, SKILL_GHOST_WAIL)) {
    c.run = -1;
    this.setDir(c, t.x - c.x, t.y - c.y);
    this.skillStart(c, SKILL_GHOST_WAIL);
    return true;
  }
  if (d2 < TOUCH_D * TOUCH_D) {
    // 冷たい手：3回の更新に1回、手を伸ばして打つ（相手は打ち返す）
    this.setDir(c, t.x - c.x, t.y - c.y);
    if (this.step % 3 === c.id % 3) {
      const killed = this.fight(c, t);
      this.record('settle', { t: this.w.tick, k: Kind.Ghost, ev: 'ghostTouch', id: c.id, n: t.k, how: killed ? 1 : 0, x: Math.round(t.x), y: Math.round(t.y) } as never);
    } else if (c.act !== 2 || c.actT > 3) c.act = 0;
    return true;
  }
  // 相手へ滑るように寄る
  c.act = 1;
  this.moveToward(c, t.x, t.y, SPEC[Kind.Ghost].speed * 1.1);
  return true;
}

/** 襲う相手：打ってきた相手（近くにいれば）か、気づいている、見通しの利くいちばん近い生きた者（4マスの内） */
export function ghostTarget(this: Ecology, c: Cr): Cr | null {
  const m = this.w.map;
  const f = this.byId.get(c.foe);
  if (f && this.ghostPrey(f) && sq(f.x - c.x) + sq(f.y - c.y) < HUNT_R * HUNT_R && lineOfSight(m, c.x, c.y, f.x, f.y)) return f;
  let best: Cr | null = null;
  let bd = HUNT_R * HUNT_R;
  this.nearby(c.x, c.y, Math.ceil(HUNT_R / TILE) + 1, (o) => {
    if (o === c || !this.ghostPrey(o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d >= bd || !this.canSense(c, o) || !lineOfSight(m, c.x, c.y, o.x, o.y)) return;
    bd = d;
    best = o;
  });
  return best;
}

/** 金切り声：まわり（WAIL_R）の生きた者を冷気で打ち、倒れなかった者をすくませ、松明を消す */
export function ghostWail(this: Ecology, c: Cr): void {
  const m = this.w.map;
  this.fxAttacks.push({ t: this.w.tick, style: 'wail', col: 0, size: 2, ax: c.x, ay: c.y, dx: c.x, dy: c.y, did: -1, aid: c.id, big: true, kill: false, rad: WAIL_R });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  this.noise(c.x, c.y, 10);
  const hit = this.areaStrike(c, c.x, c.y, 1, 0, { kind: 'circle', r: WAIL_R }, WAIL_MUL, { style: '', col: 0 }, (o) => this.ghostPrey(o));
  // 倒れなかった者はすくみ、松明が消える（英雄は耐える）。打たれた冒険者の数は、分析用に記録する（倒れた者も数える）
  let adv = 0;
  this.nearby(c.x, c.y, Math.ceil(WAIL_R / TILE) + 1, (o) => {
    if (o.k === Kind.Adventurer && o.hitAt === this.w.tick && !o.away) adv++;
    if (o.dead || o.away || o.caught || NOT_LIVING.has(o.k) || this.airborne(o)) return;
    if (sq(o.x - c.x) + sq(o.y - c.y) > WAIL_R * WAIL_R || !lineOfSight(m, c.x, c.y, o.x, o.y)) return;
    if (o.torch > 0) o.torch = o.k === Kind.Adventurer ? 1 : -1;
    if (o.k === Kind.Adventurer && (this.heroOf(o)?.rank ?? 0) >= 3) return;
    o.stun = Math.max(o.stun, WAIL_STUN);
    if (o.act === 2 && o.actT < 0) o.act = 0;
  });
  this.record('settle', { t: this.w.tick, k: Kind.Ghost, ev: 'ghostWail', id: c.id, n: hit, how: adv, x: Math.round(c.x), y: Math.round(c.y) } as never);
}

declare module '../ecology' {
  interface Ecology {
    ghostPrey: typeof ghostPrey;
    ghostPhase: typeof ghostPhase;
    ghostSkill: typeof ghostSkill;
    ghostTarget: typeof ghostTarget;
    ghostWail: typeof ghostWail;
  }
}

Object.assign(Ecology.prototype, { ghostPrey, ghostPhase, ghostSkill, ghostTarget, ghostWail });
