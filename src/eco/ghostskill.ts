/**
 * Ecology のメソッド：ゴーストの技（金切り声と冷たい手）と、刃のすり抜け。src/eco/undead.ts の ghost から、亡霊の騎士を除くゴーストの判断のはじめに呼ぶ。
 *
 * （以前のゴーストは強さが0で、打ち返さず、自分からも襲わなかった。近くに生き物が来ると攻撃の姿を取るが、相手には何も起きず、
 *  冒険者に倒されるのは、16シード×25日の504回すべてが僧侶の祈りによるお祓いだった。冷気の攻撃の演出も、ゲームの中では一度も描かれていなかった）
 *
 * 命のやりとりは人（冒険者とドワーフ）とだけ。モンスターは追い払うだけで、モンスターもゴーストに止めを刺せない。
 * （はじめはモンスターとも命を取り合ったが、16シード×25日で、ゴーストが大ネズミ337匹・大グモ266匹・ゴブリン125匹などを倒し、
 *  ゴブリンの集落があった日数が127.6→99.8日に減った（ゴブリンを襲わないようにすると121.4日に戻った）。
 *  クモが巣の獲物を食べる場面も768→518回に減り、ゴースト自身も倒されて、画面にいる時間が83%→45%に減った）
 *
 * 襲う相手：近く（4マス）にいる、起きている人と、すぐそば（1.5マス）に来た、逃げていない中くらいまでのモンスター（強さ10未満の人型と獣。追いかけはしない）。
 *   骨・霊・鎧・眷属・ウィスプ・スライム・石の者・ミミック・ワーム・竜・飛んでいる者は除く。
 *   打ってきた相手がいれば、その相手を先に。相手へ滑るように寄る（光を嫌って漂うのは、相手のいないときだけ）。
 * 金切り声：人が近く（2.5マスの内）に来たら、体をふくらませて青白い冷気を口もとへ吸い集める溜め（およそ1.2秒）のあと、
 *   口から青白い音の波が幾重にも広がる。波の届く所（3マス、見通しが利く所）では：
 *     人は冷気に打たれ（傷を負う）、倒れなかった者はおよそ1.6秒すくんで動けない（頭の上で星が回る。英雄は耐える）。持っている松明も消える。
 *     モンスターは、傷は負わずに踵を返してゴーストから逃げる。
 *   使ったあと20秒は叫ばない。
 * 冷たい手：相手が隣にいれば、青白い手を伸ばす（打たれた所に霜の結晶が弾ける）。人には、ふつうの打ち合い（相手は打ち返す）。
 *   モンスターは、傷は負わずに逃げ出す。
 * 刃のすり抜け（src/eco/combat.ts の strike から ghostPhase）：魔法と聖なる攻撃（魔法使いと僧侶、リッチ・サラマンダー・竜・ウィスプ・ほかのゴースト）でない一打ちは、
 *   人のものなら7割、モンスターのものならすべてすり抜ける。ゴーストの体が横へ揺らいで透け、元の所に青白い残像が残る（傷は受けない）。
 *
 * 状態：金切り声を溜めているあいだは run に −1、狙う相手は aim（どちらもセーブに入る）。
 */
import { type Cr, Ecology, Job, Kind, SPEC, STR, ih, sq } from '../ecology';
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
/** 追い払われたモンスターが逃げる長さ（生き物の更新の回数） */
const SCARE_FLEE = 30;
/**
 * モンスターを追い払う近さ（px）：ゴーストはモンスターを追わず、この近さまで来た者だけを追い払う。
 * （4マスの内のモンスターを追いかけて追い払うと、16シード×25日で3万5千回になり、大ネズミの飢え死にが309→611匹、
 *  逃げ場のない獣が噛みつき返す場面が64→891回に増え、コボルトのいる時間が70%→58%に減った）
 */
const SCARE_R = 1.5 * TILE;
/** 追い払われない、住みかのそばの広さ（px） */
const HOME_R = 6 * TILE;
/** 襲う・追い払うモンスターの強さの上限（これより強い大物は相手にしない） */
const SCARE_STR = 10;
/** 魔法と聖なる攻撃でない一打ちが、すり抜ける割合（百分率） */
export const PHASE_MISS = 70;

/** ゴーストが襲わない種（骨・霊・鎧・眷属、光と粘体、石の者、ミミック・ワーム・竜。コウモリとワイバーンは飛んでいるあいだ除く） */
const NOT_LIVING = new Set<number>([
  Kind.Ghost, Kind.Zombie, Kind.Skeleton, Kind.Lich, Kind.Armor, Kind.Thrall, Kind.Vampire,
  Kind.Wisp, Kind.Slime, Kind.Golem, Kind.Gargoyle, Kind.Mimic, Kind.Worm, Kind.Dragon,
]);

/** ゴーストが襲う生きた者か */
export function ghostPrey(this: Ecology, o: Cr): boolean {
  if (o.dead || o.away || o.caught || o.sleep > 0 || NOT_LIVING.has(o.k) || this.airborne(o)) return false;
  return isPerson(o) || (STR[o.k] < SCARE_STR && o.flee <= 0 && !nearHome(o));
}

/**
 * 住処・集落・巣のそば（HOME_R の内）にいるモンスターは、ゴーストに追い払われない（自分の住みかでは踏みとどまる）。
 * （住みかのそばでも追い払うと、逃げては住みかへ戻り、また追い払われるのを繰り返し、
 *  15シードの10〜18日目で、ぶらつくゴブリンの引っかかりが main の2975回から5144回に増えた）
 */
function nearHome(o: Cr): boolean {
  return (o.hx !== 0 || o.hy !== 0) && sq(o.hx - o.x) + sq(o.hy - o.y) < HOME_R * HOME_R;
}

/** 命のやりとりをする相手（人：冒険者とドワーフ） */
function isPerson(o: Cr): boolean {
  return o.k === Kind.Adventurer || o.k === Kind.Dwarf;
}

/** モンスターを追い払う（傷は負わせない）：踵を返してゴーストから逃げる */
function scareOff(c: Cr, o: Cr): void {
  o.sleep = 0;
  o.flee = Math.max(o.flee, SCARE_FLEE + (o.id % 20));
  o.foe = c.id;
  if (o.act === 2 && o.actT < 0) o.act = 0;
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
  if (isPerson(a) && ih(a.id, d.id ^ this.step, 463) % 100 >= PHASE_MISS) return false;
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
  // 金切り声は人に向けてだけ上げる（そばのモンスターは、巻き込まれて逃げる）。
  // （モンスターにも上げると、集落の外で餌を集めるゴブリンが何度も追い払われ、16シード×25日で集落の蓄えの平均が 1286→757、
  //  中で生まれたゴブリンが 604→420 匹に減った）
  if (isPerson(t) && d2 < WAIL_START * WAIL_START && this.step % 2 === c.id % 2 && this.skillCanStart(c, SKILL_GHOST_WAIL)) {
    c.run = -1;
    this.setDir(c, t.x - c.x, t.y - c.y);
    this.skillStart(c, SKILL_GHOST_WAIL);
    return true;
  }
  if (d2 < TOUCH_D * TOUCH_D) {
    // 冷たい手：3回の更新に1回、手を伸ばして打つ（相手は打ち返す）
    this.setDir(c, t.x - c.x, t.y - c.y);
    if (this.step % 3 === c.id % 3) {
      if (isPerson(t)) {
        const killed = this.fight(c, t);
        this.record('settle', { t: this.w.tick, k: Kind.Ghost, ev: 'ghostTouch', id: c.id, n: t.k, how: killed ? 1 : 0, x: Math.round(t.x), y: Math.round(t.y) } as never);
      } else {
        // モンスターには、手を伸ばして触れるだけ（霜は弾けるが傷は負わせない）。相手は逃げ出す
        c.act = 2;
        c.actT = 0;
        this.pushAttackFx(c, t, false, false);
        scareOff(c, t);
        this.record('settle', { t: this.w.tick, k: Kind.Ghost, ev: 'ghostScare', id: c.id, n: t.k, how: 1, x: Math.round(t.x), y: Math.round(t.y) } as never);
      }
    } else if (c.act !== 2 || c.actT > 3) c.act = 0;
    return true;
  }
  // 人へは滑るように寄る（モンスターは追わない：すぐそばに来た者を追い払うだけ）
  if (!isPerson(t)) return false;
  c.act = 1;
  this.moveToward(c, t.x, t.y, SPEC[Kind.Ghost].speed * 1.1);
  return true;
}

/** 襲う相手：打ってきた相手（近くにいれば）か、気づいている、見通しの利くいちばん近い生きた者（4マスの内） */
export function ghostTarget(this: Ecology, c: Cr): Cr | null {
  const m = this.w.map;
  const f = this.byId.get(c.foe);
  const reach = (o: Cr) => (isPerson(o) ? HUNT_R : SCARE_R);
  if (f && this.ghostPrey(f) && sq(f.x - c.x) + sq(f.y - c.y) < sq(reach(f)) && lineOfSight(m, c.x, c.y, f.x, f.y)) return f;
  let best: Cr | null = null;
  let bd = HUNT_R * HUNT_R;
  this.nearby(c.x, c.y, Math.ceil(HUNT_R / TILE) + 1, (o) => {
    if (o === c || !this.ghostPrey(o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d >= bd || d >= sq(reach(o)) || !this.canSense(c, o) || !lineOfSight(m, c.x, c.y, o.x, o.y)) return;
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
  // 人だけが冷気に打たれる。モンスターは逃げる（下）
  const hit = this.areaStrike(c, c.x, c.y, 1, 0, { kind: 'circle', r: WAIL_R }, WAIL_MUL, { style: '', col: 0 }, (o) => isPerson(o) && this.ghostPrey(o));
  // 倒れなかった人はすくみ、松明が消える（英雄は耐える）。打たれた冒険者の数は、分析用に記録する（倒れた者も数える）
  let adv = 0;
  let scared = 0;
  this.nearby(c.x, c.y, Math.ceil(WAIL_R / TILE) + 1, (o) => {
    if (o.k === Kind.Adventurer && o.hitAt === this.w.tick && !o.away) adv++;
    if (o.dead || o.away || o.caught || NOT_LIVING.has(o.k) || this.airborne(o)) return;
    if (sq(o.x - c.x) + sq(o.y - c.y) > WAIL_R * WAIL_R || !lineOfSight(m, c.x, c.y, o.x, o.y)) return;
    if (o.torch > 0) o.torch = o.k === Kind.Adventurer ? 1 : -1;
    if (!isPerson(o)) {
      if (STR[o.k] < SCARE_STR && !nearHome(o)) {
        scareOff(c, o);
        scared++;
      }
      return;
    }
    if (o.k === Kind.Adventurer && (this.heroOf(o)?.rank ?? 0) >= 3) return;
    o.stun = Math.max(o.stun, WAIL_STUN);
    if (o.act === 2 && o.actT < 0) o.act = 0;
  });
  this.record('settle', { t: this.w.tick, k: Kind.Ghost, ev: 'ghostWail', id: c.id, n: hit, how: adv, to: scared, x: Math.round(c.x), y: Math.round(c.y) } as never);
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
