/**
 * Ecology のメソッド：ヴァンパイアの技（src/eco/vampire.ts から呼ぶ）。
 *
 * 三つの技を持つ。どれも溜め（src/eco/skill.ts）のあいだに打たれると止まる（ヴァンパイアは大物ではないので、軽い一撃でも止まる）。
 *   血吸い：手をかざして構え、5.5マス先までの相手から、血の玉を自分へ吸い寄せる。吸うあいだ（生き物の更新10回）は動かず、
 *           相手は少しずつ弱り、ヴァンパイアは吸った分だけ傷が癒え、相手の血（養分）が腹に入る。相手が6.5マスより離れるか、壁の陰に入るか、ヴァンパイアが打たれると切れる。
 *   コウモリの群れ：従えるコウモリが2匹以上いれば、両腕を広げて構え、相手の方へ黒いコウモリの群れを6マスまで突っ込ませる。
 *           群れの通り道（1マスおきの丸い範囲）に、群れが届いた時にいる者を少し打って、怯ませる（動いていれば避けられる）。
 *           噛みついたコウモリは、吸った血をくわえてヴァンパイアのもとへ戻り、その分（打った分の6割）だけヴァンパイアの傷が癒え、血（養分）が腹に入る（src/eco/attack.ts の resolveVolleys）。
 *   霧の歩み：黒い霧になって消え、一行の後ろにいる後衛（魔法使い・狩人・僧侶・吟遊詩人）の背後に現れて、重い一撃を打つ。
 *           打ったら、また霧になって消え、元いた暗がりへ戻る（打って消える）。大きな火（焚き火、かがり火、炉、入口の灯り）の明かりの中へは出ない。
 *           （以前は打ったあとも一行の真ん中に残り、14〜40 tick で倒されていた）
 *
 * 状態：溜めているあいだは run に技の番号（−1 血吸い、−2 コウモリの群れ、−3 霧の歩み。−4 は霧の歩みの一撃のあと、元いた所（tx, ty）へ戻るのを待っている）、血を吸っているあいだは run に残りの回数（正の数）、
 * 狙う相手の番号は aim に持つ（どちらもセーブに入る）。技を溜めはじめた時刻は cast（使ったあとの間に使う。三つの技で共通）。
 */
import { CR_EVERY, type Cr, Ecology, Job, Kind, SPEC, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import type { Skill } from './skill';

/** 血吸い：およそ0.8秒手をかざして構え、使ったあと4秒は構え直さない */
export const SKILL_VAMP_DRAIN: Skill = { windup: 4, cool: 20 };
/** コウモリの群れ：およそ1秒両腕を広げて構え（まわりにコウモリが集まる）、使ったあと6秒は構え直さない */
export const SKILL_VAMP_SWARM: Skill = { windup: 5, cool: 30 };
/** 霧の歩み：およそ0.6秒、体が黒い霧に崩れていき、使ったあと8秒は使わない */
export const SKILL_VAMP_MIST: Skill = { windup: 3, cool: 40 };

/**
 * 血吸いを始められる遠さ、続けられる遠さ（px）。松明を持つ冒険者の明かりの輪の2マス外（4.5マス）より遠くから届くようにする
 * （3.5マスでは、一行の松明の明かりの手前までしか近づけないヴァンパイアは、冒険者にほとんど使えなかった）
 */
const DRAIN_R = 5.5 * TILE;
const DRAIN_KEEP = 6.5 * TILE;
/** 血を吸う長さ（生き物の更新の回数）と、1回ごとの打ちの強さ（ふつうの一打ちに対する倍率） */
export const DRAIN_N = 10;
const DRAIN_MUL = 0.12;
/** コウモリの群れの届く長さ（px）、当たる所の数と、それぞれの丸い範囲の半径（px）、打ちの強さ、怯む長さ（生き物の更新の回数） */
const SWARM_LEN = 6 * TILE;
export const SWARM_N = 6;
const SWARM_R = 0.9 * TILE;
const SWARM_MUL = 0.3;
const SWARM_STUN = 4;
/** 群れが当たる所から次の所へ飛ぶ間（tick） */
export const SWARM_DT = 2;
/** 霧の歩みで狙える遠さ（px）と、背後に現れる位置の、相手からの離れ（px）と、その一撃の強さ */
const MIST_R = 8 * TILE;
const MIST_BACK = 14;
const MIST_MUL = 1.3;
/** 霧の歩みの一撃のあと、元の暗がりへ戻るのを待っているときの run の値 */
const MIST_BACK_RUN = -4;

/** 霧の歩みで狙う後衛の職業 */
const REAR = new Set<number>([Job.Wizard, Job.Hunter, Job.Priest, Job.Bard]);

/** その者に従っていて、近く（8マス）にいるコウモリの数 */
function retinueNear(this: Ecology, c: Cr): number {
  let n = 0;
  this.nearby(c.x, c.y, 8, (o) => {
    if (o.k === Kind.Bat && !o.dead && !o.away && o.ref2 === c.id) n++;
  });
  return n;
}

/** ヴァンパイアが出られる暗さか：日の光が当たらず、大きな火（松明より大きい明かり）の輪の2マス外より外 */
function darkFor(this: Ecology, x: number, y: number): boolean {
  const k = this.tileOf(x, y);
  if (k < 0 || this.w.lightBase[k] * this.dayNow > 60) return false;
  for (const f of this.fires()) if (f[2] > 3 * TILE && !this.weakCampAt(f[0], f[1]) && sq(x - f[0]) + sq(y - f[1]) < sq(f[2] + 2 * TILE)) return false;
  return true;
}

/** 血吸い1回分と、群れのコウモリが持ち帰る血1回分で、ヴァンパイアの腹に入る養分の上限 */
export const DRAIN_SIP = 6;
export const SWARM_SIP = 8;

/**
 * 相手 d の血（腹の中の物、なければ体）から n まで、ヴァンパイア c の腹へ移す（養分は移るだけで、増えも減りもしない）。
 * 吸った血で腹が満ちれば、ヴァンパイアは狩りを終えて住処へ帰る（技で打つだけでは腹が満ちず、空腹のまま一行にかかりきりになっていた）
 */
export function vampSip(this: Ecology, c: Cr, d: Cr, n: number): void {
  let want = Math.min(n, SPEC[Kind.Vampire].cap - c.food);
  if (want <= 0) return;
  const f = Math.min(want, Math.max(0, d.food));
  d.food -= f;
  want -= f;
  const b = Math.min(want, Math.max(0, d.body - 1));
  d.body -= b;
  if (f + b > 0) {
    c.food += f + b;
    c.sinceMeal = 0;
  }
}

/** 技の溜めと血吸いの進み（ヴァンパイアの更新のはじめに呼ぶ）。true なら、この回はこれで終わり */
export function vampSkill(this: Ecology, c: Cr): boolean {
  if (c.run > 0) {
    drainTick.call(this, c);
    return true;
  }
  // 霧の歩みの一撃のあと：次の生き物の更新で、また霧になって消え、元いた暗がり（tx, ty）に戻る
  if (c.run === MIST_BACK_RUN) {
    if (this.w.tick - c.cast < (SKILL_VAMP_MIST.windup + 1) * CR_EVERY) {
      c.act = 2;
      c.actT = 0;
      return true;
    }
    c.run = 0;
    if (c.tx || c.ty) {
      this.vampMistFx(c.x, c.y, 2);
      this.fxAttacks.push({ t: this.w.tick, style: 'miststep', col: 0, size: 1, ax: c.x, ay: c.y, dx: c.tx, dy: c.ty, did: -1, aid: c.id, big: false, kill: false });
      c.x = c.tx;
      c.y = c.ty;
      c.px = c.x;
      c.py = c.y;
      this.paths.delete(c.id);
      this.vampMistFx(c.x, c.y, 3);
      c.tx = 0;
      c.ty = 0;
    }
    c.act = 0;
    c.actT = 0;
    return true;
  }
  if (c.run >= 0) return false;
  const code = c.run;
  const spec = code === -1 ? SKILL_VAMP_DRAIN : code === -2 ? SKILL_VAMP_SWARM : SKILL_VAMP_MIST;
  const sk = this.skillStep(c, spec);
  const t = this.byId.get(c.aim);
  if (sk === 'charging') {
    if (t && !t.dead) this.setDir(c, t.x - c.x, t.y - c.y);
    return true;
  }
  c.run = 0;
  if (sk !== 'ready' || !t || t.dead || t.away) {
    c.aim = 0;
    return false;
  }
  c.act = 2;
  c.actT = 0;
  if (code === -1) {
    if (sq(t.x - c.x) + sq(t.y - c.y) > DRAIN_KEEP * DRAIN_KEEP || !lineOfSight(this.w.map, c.x, c.y, t.x, t.y)) {
      c.aim = 0;
      return true;
    }
    c.run = DRAIN_N;
    this.fxAttacks.push({ t: this.w.tick, style: 'drain', col: 0, size: 1, ax: c.x, ay: c.y, dx: t.x, dy: t.y, did: t.id, aid: c.id, big: false, kill: false, fly: DRAIN_N * CR_EVERY });
    this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'drain', id: c.id, n: t.k, x: Math.round(t.x), y: Math.round(t.y) } as never);
    return true;
  }
  if (code === -2) {
    swarmRelease.call(this, c, t);
    c.aim = 0;
    return true;
  }
  mistRelease.call(this, c, t);
  c.aim = 0;
  return true;
}

/** 血を吸う1回分。切れたら run を 0 に戻す */
function drainTick(this: Ecology, c: Cr): void {
  const t = this.byId.get(c.aim);
  // 起きている冒険者が2.5マスまで詰め寄ってきたら、吸うのをやめて退く（吸っているあいだは動けないので、そのまま囲まれて倒されていた）
  let close = false;
  this.nearby(c.x, c.y, 3, (o) => {
    if (!close && o.k === Kind.Adventurer && !o.dead && !o.away && o.sleep === 0 && sq(o.x - c.x) + sq(o.y - c.y) < sq(2.5 * TILE)) close = true;
  });
  const ok =
    !close && !!t && !t.dead && !t.away && c.stun <= 0 && this.w.tick - c.hitAt >= CR_EVERY && sq(t.x - c.x) + sq(t.y - c.y) <= DRAIN_KEEP * DRAIN_KEEP && lineOfSight(this.w.map, c.x, c.y, t.x, t.y);
  if (!ok) {
    c.run = 0;
    c.aim = 0;
    c.act = 0;
    c.actT = 0;
    return;
  }
  const d = t as Cr;
  this.setDir(c, d.x - c.x, d.y - c.y);
  const hp0 = d.hp > 0 ? d.hp : this.maxHp(d);
  const killed = this.strike(c, d, DRAIN_MUL, false);
  // 吸った分（相手の減った体力）だけ傷が癒え、相手の血がヴァンパイアの腹に入る
  c.hp = Math.min(this.maxHp(c), c.hp + Math.max(0, hp0 - Math.max(0, d.hp)));
  if (!killed) this.vampSip(c, d, DRAIN_SIP);
  c.act = 2;
  c.actT = 0;
  c.run--;
  if (killed) {
    this.slay(c, d);
    c.run = 0;
  }
  if (c.run <= 0) {
    c.run = 0;
    c.aim = 0;
  }
}

/** コウモリの群れを放つ：相手の方へ、1マスおきに6か所、群れが届いた時にそこにいる者を打つ */
function swarmRelease(this: Ecology, c: Cr, t: Cr): void {
  const dx = t.x - c.x;
  const dy = t.y - c.y;
  const L = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const m = this.w.map;
  let n = 0;
  for (let i = 1; i <= SWARM_N; i++) {
    const x = c.x + ux * (SWARM_LEN * i) / SWARM_N;
    const y = c.y + uy * (SWARM_LEN * i) / SWARM_N;
    // 壁に当たったら、そこで群れは散る
    if (!lineOfSight(m, c.x, c.y, x, y)) break;
    this.queueVolley(c, { d: -1, x, y, r: SWARM_R, mul: SWARM_MUL, poison: 0, stun: SWARM_STUN }, i * SWARM_DT);
    n = i;
  }
  if (!n) return;
  const bats = retinueNear.call(this, c);
  this.fxAttacks.push({ t: this.w.tick, style: 'batswarm', col: 0, size: 1, ax: c.x, ay: c.y, dx: c.x + ux * (SWARM_LEN * n) / SWARM_N, dy: c.y + uy * (SWARM_LEN * n) / SWARM_N, did: -1, aid: c.id, big: false, kill: false, n: Math.min(12, 4 + bats * 2), fly: n * SWARM_DT });
  this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'swarm', id: c.id, n: t.k, x: Math.round(t.x), y: Math.round(t.y) } as never);
}

/** 霧の歩み：相手の背後（一行の真ん中から見て、相手の向こう側）に現れて、重い一撃を打つ */
function mistRelease(this: Ecology, c: Cr, t: Cr): void {
  if (sq(t.x - c.x) + sq(t.y - c.y) > sq(MIST_R + 2 * TILE)) return;
  // 一行の真ん中（相手を除く）
  let mx = 0;
  let my = 0;
  let k = 0;
  const p = t.k === Kind.Adventurer ? this.parties.find((q) => q.id === t.party) : undefined;
  if (p)
    for (const id of p.members) {
      const o = this.byId.get(id);
      if (!o || o === t || o.dead || o.away) continue;
      mx += o.x;
      my += o.y;
      k++;
    }
  let bx = k ? t.x - mx / k : t.x - c.x;
  let by = k ? t.y - my / k : t.y - c.y;
  let L = Math.sqrt(bx * bx + by * by);
  if (L < 1) {
    bx = t.x - c.x;
    by = t.y - c.y;
    L = Math.sqrt(bx * bx + by * by) || 1;
  }
  bx /= L;
  by /= L;
  const m = this.w.map;
  let at: [number, number] | null = null;
  for (const [ox, oy] of [[bx, by], [-by, bx], [by, -bx], [(t.x - c.x) / (Math.hypot(t.x - c.x, t.y - c.y) || 1), (t.y - c.y) / (Math.hypot(t.x - c.x, t.y - c.y) || 1)]]) {
    const x = t.x + ox * MIST_BACK;
    const y = t.y + oy * MIST_BACK;
    if (this.passable(c, x, y) && lineOfSight(m, t.x, t.y, x, y) && darkFor.call(this, x, y)) {
      at = [x, y];
      break;
    }
  }
  if (!at) return;
  // 元いた所（一撃のあと、霧になって戻る先）
  c.tx = c.x;
  c.ty = c.y;
  this.vampMistFx(c.x, c.y, 2);
  this.fxAttacks.push({ t: this.w.tick, style: 'miststep', col: 0, size: 1, ax: c.x, ay: c.y, dx: at[0], dy: at[1], did: t.id, aid: c.id, big: false, kill: false });
  c.x = at[0];
  c.y = at[1];
  c.px = c.x;
  c.py = c.y;
  this.paths.delete(c.id);
  this.vampMistFx(c.x, c.y, 3);
  this.setDir(c, t.x - c.x, t.y - c.y);
  this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'mistStep', id: c.id, n: t.sp, x: Math.round(t.x), y: Math.round(t.y) } as never);
  if (this.strike(c, t, MIST_MUL)) this.slay(c, t);
  c.run = MIST_BACK_RUN;
}

/**
 * 技を使うか決める。foes は近くの起きている冒険者（一行から退く前に呼ぶ）、prey は追っている獲物（どちらか一方）。
 * 溜めはじめたら true。霧の歩み（体力が半分以上あるとき）→ コウモリの群れ → 血吸い の順に選ぶ
 */
export function vampEngage(this: Ecology, c: Cr, foes: Cr[], prey: Cr | null): boolean {
  if (c.stun > 0 || c.run !== 0 || (c.act === 2 && c.actT < 0)) return false;
  const m = this.w.map;
  const d2 = (o: Cr) => sq(o.x - c.x) + sq(o.y - c.y);
  const seen = (o: Cr) => lineOfSight(m, c.x, c.y, o.x, o.y);
  const start = (s: Skill, code: number, o: Cr) => {
    this.skillStart(c, s);
    c.run = code;
    c.aim = o.id;
    this.setDir(c, o.x - c.x, o.y - c.y);
    return true;
  };
  const list = foes.length ? foes : prey ? [prey] : [];
  if (!list.length) return false;
  if (foes.length && c.hp >= this.maxHp(c) * 0.5 && this.skillCanStart(c, SKILL_VAMP_MIST)) {
    let best: Cr | null = null;
    let bd = MIST_R * MIST_R;
    for (const o of foes) if (REAR.has(o.sp) && d2(o) < bd && seen(o)) {
      bd = d2(o);
      best = o;
    }
    if (best) return start(SKILL_VAMP_MIST, -3, best);
  }
  // いちばん近い、見えている相手
  let near: Cr | null = null;
  let nd = 1e18;
  for (const o of list) if (d2(o) < nd && seen(o)) {
    nd = d2(o);
    near = o;
  }
  if (!near) return false;
  const bats = retinueNear.call(this, c);
  const canSwarm = (foes.length || near.k === Kind.Adventurer) && nd <= SWARM_LEN * SWARM_LEN && nd > sq(1.5 * TILE) && bats >= 2 && this.skillCanStart(c, SKILL_VAMP_SWARM);
  // 血吸いは冒険者（近づけば打ち返されて危ない相手）にだけ使う。大ネズミやコボルトのような獲物には、これまでどおり歩いて近づき、
  // その間に従えたコウモリに群がらせて足止めしてから打ちかかる（獲物にも血吸いを使うと、離れたまま仕留めてしまい、
  // コウモリが獲物に群がって足止めする場面が16シード×25日で80回から41回に減った。コウモリを連れていないときだけ獲物に使っても56回）
  const canDrain = near.k === Kind.Adventurer && nd <= DRAIN_R * DRAIN_R && nd > sq(1.2 * TILE) && this.skillCanStart(c, SKILL_VAMP_DRAIN);
  // 傷を負っていれば（体力が85％を切っていれば）血吸いを先に、そうでなければコウモリの群れを先に使う
  if (canDrain && (c.hp < this.maxHp(c) * 0.85 || !canSwarm)) return start(SKILL_VAMP_DRAIN, -1, near);
  if (canSwarm) return start(SKILL_VAMP_SWARM, -2, near);
  return false;
}

declare module '../ecology' {
  interface Ecology {
    vampSkill: typeof vampSkill;
    vampEngage: typeof vampEngage;
    vampSip: typeof vampSip;
  }
}

Object.assign(Ecology.prototype, { vampSkill, vampEngage, vampSip });
