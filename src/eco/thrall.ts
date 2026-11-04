/**
 * Ecology のメソッド：ヴァンパイアの眷属（src/ecology.ts のクラスに、prototype で足す）。
 *
 * 見せたい場面：ヴァンパイアが仕留めた獲物の血を短く吸って離れると、少しして亡骸が青白い姿で起き上がり、主の後ろを付いて歩く。
 * 倒れた冒険者も、生前の姿のまま青白くなって主に従う（冒険者のしくみから見れば、ただ死んだだけ。名簿・墓標・一行には手を入れない）。
 *
 * 起き上がる流れ：ヴァンパイアが血の通った獲物（THRALL_KINDS）を倒すと、連れている眷属の強さの合計に空きがあれば、
 * 亡骸に主の番号（lure）と印を付けた時刻（lureAt）を覚えさせる（vampClaim）。ヴァンパイアは血を短く吸うだけで離れ（生き物の更新15回）、
 * 印から生き物の更新30回たつと、亡骸が眷属として起き上がる（raiseThrall。亡骸の残りの養分がそのまま体になる）。
 * 眷属が倒した者も、主が倒したのと同じく印が付く（thrallClaim）。冒険者は、ヴァンパイアが倒した者でなくても、骨になる前の亡骸に
 * ヴァンパイアがかがみ込んで印を付ける（src/eco/vampire.ts の vampRaiseFallen）。冒険者の眷属は、枠に空きがなければ、冒険者でない眷属を崩して枠を空ける。
 * 眷属の持ち物：sp に元の種、ref2 に主の番号、lure に元の冒険者の職業＋1（冒険者でなければ 0）、lureAt に起き上がった時刻（step）。
 * 終わり方：主が死ぬか、起き上がってからゲーム内の2日たつと崩れて、ふたたび亡骸になる（die。養分は亡骸へ戻る）。
 */
import { CR_EVERY, Cr, DAY_TICKS_ECO, Ecology, JOB_STR, Kind, STR, SPEC, sq } from '../ecology';
import { TILE } from '../mapgen';
import { NAMES, UNKNOWN } from '../names';
import { whoName } from './inspect';
import { VAMP_SCATTER } from './vampire';

/** 眷属になれる種（血の通った生き物。虫、炎の体、石化の目、地中の巨体、すでに不死のもの、竜の仲間は除く） */
export const THRALL_KINDS = new Set<number>([Kind.Rat, Kind.Lizard, Kind.Kobold, Kind.Goblin, Kind.Orc, Kind.Lizardman, Kind.Minotaur, Kind.Troll, Kind.Dwarf, Kind.Adventurer]);
/** 連れていられる眷属の強さの合計（元の種の強さ）と、数の上限 */
const THRALL_STR_CAP = 12;
const THRALL_MAX = 4;
/** 眷属が崩れるまで（生き物の更新の回数。ゲーム内の2日） */
const THRALL_LIFE = (2 * DAY_TICKS_ECO) / CR_EVERY;

/** 元の種の強さ（冒険者は職業の強さ） */
function origStr(c: Cr): number {
  return c.sp === Kind.Adventurer ? JOB_STR[Math.max(0, c.lure - 1)] ?? 5 : STR[c.sp] ?? 3;
}

/** 主 v が連れている眷属（起き上がる前の印の付いた亡骸も数える）の強さの合計と数 */
function thrallLoad(e: Ecology, v: Cr): [number, number] {
  let s = 0;
  let n = 0;
  for (const o of e.list) {
    if (o.k === Kind.Thrall && !o.dead && o.ref2 === v.id) {
      s += origStr(o);
      n++;
    } else if (o.dead === 1 && o.lure === v.id && THRALL_KINDS.has(o.k)) {
      s += o.k === Kind.Adventurer ? JOB_STR[o.sp] ?? 5 : STR[o.k];
      n++;
    }
  }
  return [s, n];
}

/**
 * ヴァンパイア v の亡骸 d に、眷属として起き上がる印を付ける（付けたら true）。v が倒した者のほか、倒れたばかりの冒険者の亡骸にも使う（vampRaiseFallen）。
 * 冒険者は、枠（強さの合計と数）に空きがなければ、冒険者でない眷属のうち弱いものから崩して枠を空ける（冒険者の眷属は見せたい場面なので、
 * 大ネズミやコボルトの眷属で枠が埋まっていても起き上がれるように）
 */
export function vampClaim(this: Ecology, v: Cr, d: Cr): boolean {
  if (v.k !== Kind.Vampire || d.dead !== 1 || !THRALL_KINDS.has(d.k)) return false;
  const add = d.k === Kind.Adventurer ? JOB_STR[d.sp] ?? 5 : STR[d.k];
  let [s, n] = thrallLoad(this, v);
  while (d.k === Kind.Adventurer && (n >= THRALL_MAX || s + add > THRALL_STR_CAP)) {
    let weak: Cr | null = null;
    for (const o of this.list) if (o.k === Kind.Thrall && !o.dead && o.ref2 === v.id && o.sp !== Kind.Adventurer && (!weak || origStr(o) < origStr(weak) || (origStr(o) === origStr(weak) && o.id < weak.id))) weak = o;
    if (!weak) break;
    this.crumbleThrall(weak);
    [s, n] = thrallLoad(this, v);
  }
  if (n >= THRALL_MAX || s + add > THRALL_STR_CAP) return false;
  d.lure = v.id;
  d.lureAt = this.step;
  return true;
}

/** 眷属 t が倒した者 d を、主の眷属として起き上がらせる印を付ける（主のヴァンパイアが倒したのと同じ扱い） */
export function thrallClaim(this: Ecology, t: Cr, d: Cr): boolean {
  const lord = this.byId.get(t.ref2);
  return !!lord && !lord.dead && this.vampClaim(lord, d);
}

/** ヴァンパイア v が、冒険者の亡骸 d を眷属にできるか（冒険者でない眷属を崩せば枠が空くなら true） */
export function thrallRoomForAdv(this: Ecology, v: Cr, d: Cr): boolean {
  let s = 0;
  let n = 0;
  for (const o of this.list) {
    if (o.k === Kind.Thrall && !o.dead && o.ref2 === v.id && o.sp === Kind.Adventurer) {
      s += origStr(o);
      n++;
    } else if (o.dead === 1 && o.lure === v.id && o.k === Kind.Adventurer) {
      s += JOB_STR[o.sp] ?? 5;
      n++;
    }
  }
  return n < THRALL_MAX && s + (JOB_STR[d.sp] ?? 5) <= THRALL_STR_CAP;
}

/** 眷属が崩れ落ちて、元の種の亡骸に戻る（ふつうの亡骸として朽ち、食べられる） */
export function crumbleThrall(this: Ecology, c: Cr): void {
  this.log(c.x, c.y, `{k:${Kind.Thrall}}が崩れ落ちた`);
  this.die(c, 'crumble', Kind.Vampire);
  const orig = c.sp;
  c.sp = orig === Kind.Adventurer ? Math.max(0, c.lure - 1) : orig;
  c.k = orig;
  c.lure = 0;
  c.ref2 = 0;
}

/** 印の付いた亡骸を、眷属として起き上がらせる（src/eco/step.ts の decay から。起き上がったら true） */
export function raiseThrall(this: Ecology, c: Cr): boolean {
  if (c.dead !== 1 || !c.lure || !THRALL_KINDS.has(c.k) || this.step - c.lureAt < 30) return false;
  const v = this.byId.get(c.lure);
  if (!v || v.dead || v.k !== Kind.Vampire || c.units < 6) {
    c.lure = 0;
    return false;
  }
  const orig = c.k;
  const job = c.sp;
  this.record('births', { t: this.w.tick, k: Kind.Thrall, origin: 'raised', from: orig, x: Math.round(c.x), y: Math.round(c.y) } as never);
  c.k = Kind.Thrall;
  c.sp = orig;
  c.lure = orig === Kind.Adventurer ? job + 1 : 0;
  c.lureAt = this.step;
  c.ref2 = v.id;
  c.ref = 0;
  c.body = c.units;
  c.init = c.units;
  c.units = 0;
  c.food = 0;
  c.dead = 0;
  c.act = 0;
  c.actT = 0;
  c.hungry = 0;
  c.sinceMeal = 0;
  c.st = 0;
  c.party = 0;
  c.torch = 0;
  c.flee = 0;
  c.foe = 0;
  c.sleep = 0;
  c.drowsy = 0;
  c.feed = 0;
  c.elite = 0;
  c.caught = false;
  c.hp = this.maxHp(c);
  this.paths.delete(c.id);
  this.log(c.x, c.y, `${this.thrallOrigin(c)}が、{k:${Kind.Vampire}}の眷属として起き上がった`);
  return true;
}

/** 眷属の強さ：元の種の8割 */
export function thrallStr(c: Cr): number {
  return origStr(c) * 0.8;
}

/** 眷属の元の姿の呼び方（「熟練の戦士ヨハン」「ゴブリン」など。死んだときの覚え書きから） */
export function thrallOrigin(this: Ecology, c: Cr): string {
  const n = this.notes.get(c.id);
  if (n && n.who !== undefined) return whoName(this, n) || NAMES[c.sp];
  return this.discovered[c.sp] ? NAMES[c.sp] : UNKNOWN;
}

/** 眷属の一回の行い：主の後ろを付いて歩き、主の敵と主の獲物に打ちかかる。主が死ぬか、2日たつと崩れる */
export function thrall(this: Ecology, c: Cr): void {
  const lord = this.byId.get(c.ref2);
  if (!lord || lord.dead || lord.k !== Kind.Vampire || this.step - c.lureAt > THRALL_LIFE) {
    this.crumbleThrall(c);
    return;
  }
  const s = SPEC[Kind.Thrall];
  // 打ちかかる相手：主を襲った者（6マス以内）、なければ主が決めた獲物（主が5マス以内まで近づいていれば）
  let foe = lord.foe && this.w.tick - lord.hitAt < 200 ? this.byId.get(lord.foe) : undefined;
  if (foe && (foe.dead || foe.away || foe.k === Kind.Thrall || sq(foe.x - c.x) + sq(foe.y - c.y) > sq(6 * TILE))) foe = undefined;
  if (!foe && lord.ref) {
    const p = this.byId.get(lord.ref);
    if (p && !p.dead && !p.away && sq(p.x - lord.x) + sq(p.y - lord.y) < sq(5 * TILE)) foe = p;
  }
  if (!foe && c.foe && this.w.tick - c.hitAt < 120) {
    const a = this.byId.get(c.foe);
    if (a && !a.dead && !a.away && sq(a.x - c.x) + sq(a.y - c.y) < sq(4 * TILE)) foe = a;
  }
  if (foe) {
    c.act = 1;
    if (sq(foe.x - c.x) + sq(foe.y - c.y) < 11 * 11) this.fight(c, foe);
    else this.goTo(c, foe.x, foe.y, s.speed * 1.2);
    return;
  }
  // 付いて歩く：主がばらけて飛んでいれば住処へ。そうでなければ主の後ろ（1.5〜3マス）
  const gx = lord.st === VAMP_SCATTER ? lord.hx : lord.x;
  const gy = lord.st === VAMP_SCATTER ? lord.hy : lord.y;
  const d2 = sq(gx - c.x) + sq(gy - c.y);
  if (d2 > sq(3 * TILE)) {
    c.act = 1;
    this.goTo(c, gx, gy, s.speed * (d2 > sq(8 * TILE) ? 1.3 : 1));
  } else c.act = 0;
}

declare module '../ecology' {
  interface Ecology {
    vampClaim: typeof vampClaim;
    crumbleThrall: typeof crumbleThrall;
    thrallRoomForAdv: typeof thrallRoomForAdv;
    thrallClaim: typeof thrallClaim;
    raiseThrall: typeof raiseThrall;
    thrallOrigin: typeof thrallOrigin;
    thrall: typeof thrall;
  }
}

Object.assign(Ecology.prototype, { vampClaim, crumbleThrall, thrallRoomForAdv, thrallClaim, raiseThrall, thrallOrigin, thrall });
