/**
 * Ecology のメソッド：オークの技（雄叫びと、鎖のついた投げ斧）。src/eco/step.ts から、オークの判断のはじめに呼ぶ。
 *
 * 雄叫び：斧を掲げて胸を反らし、口を開けて吠える構え（およそ1秒）のあと、口から赤橙の音の波が三重に広がる。
 *   波の届く所（5マス、見通しが利く所）では：
 *     小物（大ネズミ・大トカゲ・コボルト・アリ・クモ・サラマンダー、従っていないゴブリン）は、踵を返してオークから逃げる。
 *     冒険者の後衛（魔法使い・狩人・吟遊詩人・盗賊）は、怖んでおよそ1.2秒その場で足が止まる（頭の上で星が回る）。前衛と英雄は耐える。
 *     眠っていても目を覚ます。
 *   そして、このオークに従う集落のゴブリンは、オークの相手に向かって駆けつけて打ちかかる（群れの警戒の仕組みに乗せる。src/eco/groups.ts の heedAlarm）。
 *   使うのは戦いの始まり：冒険者の一行とのにらみ合いの決着の時、打たれて戦いが始まった時、腹を空かせてコボルトの住処を襲う時。使ったあと30秒は吠えない。
 * 投げ斧：3〜7マス先の相手へ、斧を肩の後ろへ振りかぶって（およそ0.8秒）投げる。斧は鎖でオークの手とつながっていて、
 *   回りながら、投げたときに相手がいた所へまっすぐ飛ぶ（通り道にほかの者がいれば、その者の所で止まる）。
 *   届いた時にそこ（半径10px）にいる者に当たり（動いていれば外れる）、オークは鎖をたぐって斧を手元へ引き戻す。
 *   斧が出ているあいだ（多くて1.4秒）、オークはその場で鎖を握って立つ（素手の姿）。使ったあと5秒は投げない。
 *   狙うのは、戦っている冒険者の一行の、離れた所にいる者（後衛を先に）と、従う集落を守るときに追い払うコボルト。腹を空かせた狩りの獲物には投げない（遠くで倒しても食べられない）。
 *
 * 状態：溜めているあいだは run に技の番号（−1 雄叫び、−2 投げ斧）、斧が出ているあいだは run に残りの回数（正の数）、投げ斧で狙う相手の番号は aim に持つ（どれもセーブに入る）。
 * 斧が当たるのは、少し後で当たる攻撃（src/eco/attack.ts の queueVolley・resolveVolleys）で扱う。
 */
import { CR_EVERY, Cr, Ecology, Job, Kind, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import type { Skill } from './skill';

/** 雄叫び：およそ1秒吠える構え、使ったあと30秒は吠えない */
export const SKILL_ORC_ROAR: Skill = { windup: 5, cool: 150 };
/** 投げ斧：およそ0.8秒振りかぶり、使ったあと5秒は投げない */
export const SKILL_ORC_THROW: Skill = { windup: 4, cool: 25 };

/** 雄叫びの届く所（px）、後衛が怖む長さと、小物が逃げる長さ（どちらも生き物の更新の回数） */
export const ROAR_R = 5 * TILE;
const ROAR_STUN = 6;
const ROAR_FLEE = 50;
/** 雄叫びで加勢するゴブリンの届く所（オークから。群れの警戒は、警戒の出た所から10マスの内の仲間が応じる） */
const RALLY_R = 10 * TILE;
/** 投げ斧の届く遠さ（px）、飛ぶ速さと戻る速さ（生き物の更新1回あたりの px）、当たる丸の半径、打ちの強さ */
const THROW_MIN = 3 * TILE;
const THROW_MAX = 7 * TILE;
const AXE_OUT = 28;
const AXE_BACK = 40;
const AXE_R = 10;
const THROW_MUL = 0.9;
/** 斧が通り道の者に止められる幅（px） */
const AXE_W = 7;

/** 雄叫びで逃げる小物 */
const SCARED = new Set<number>([Kind.Rat, Kind.Lizard, Kind.Kobold, Kind.Ant, Kind.Spider, Kind.Salamander]);
/** 雄叫びで怖む冒険者の後衛と、投げ斧で先に狙う職業 */
const REAR = new Set<number>([Job.Wizard, Job.Hunter, Job.Bard, Job.Thief]);

/** オーク c に従う集落のゴブリンか */
function vassalGoblin(this: Ecology, c: Cr, o: Cr): boolean {
  return o.k === Kind.Goblin && !o.party && this.vassalsOf(c).some((cp) => cp.id === o.ref);
}

/** 投げ斧の当たってよい者（オーク自身の群れと、従う集落のゴブリンには当たらない。霊とウィスプはすり抜ける） */
export function axeHits(this: Ecology, a: Cr, o: Cr): boolean {
  return o.k !== Kind.Orc && o.k !== Kind.Ghost && o.k !== Kind.Wisp && !(o.k === Kind.Goblin && !o.party);
}

/** 技の溜めと、出ている斧の進み（オークの判断のはじめに呼ぶ）。true なら、この回はこれで終わり */
export function orcSkill(this: Ecology, c: Cr): boolean {
  if (c.run > 0) {
    // 斧が出ている：鎖を握ってその場に立つ
    c.run--;
    c.act = 0;
    return true;
  }
  if (c.run < 0) {
    const spec = c.run === -1 ? SKILL_ORC_ROAR : SKILL_ORC_THROW;
    const sk = this.skillStep(c, spec, false);
    if (sk === 'charging') {
      if (c.run === -2) {
        const t = this.byId.get(c.aim);
        if (t && !t.dead) this.setDir(c, t.x - c.x, t.y - c.y);
      }
      return true;
    }
    const which = c.run;
    c.run = 0;
    if (sk !== 'ready') return false;
    c.act = 2;
    c.actT = 0;
    if (which === -1) this.orcRoar(c);
    else this.orcThrow(c);
    return true;
  }
  if (c.party || c.flee > 0 || c.st === 5 || c.st === 6 || c.sleep > 0) return false;
  // 雄叫び：打たれて戦いが始まった時（相手がまだ近くにいる）か、腹を空かせてコボルトの住処に近づいた時
  if (this.skillCanStart(c, SKILL_ORC_ROAR)) {
    const foe = this.byId.get(c.foe);
    const struck = this.w.tick - c.hitAt < 30 && !!foe && !foe.dead && !foe.away && foe.k !== Kind.Orc && sq(foe.x - c.x) + sq(foe.y - c.y) < ROAR_R * ROAR_R;
    const raid = c.hungry && this.step % 4 === c.id % 4 && this.warrens.some((w) => w.id >= 0 && sq(w.x - c.x) + sq(w.y - c.y) < 6 * TILE * 6 * TILE) && this.roarScares(c) > 0;
    if (struck || raid) {
      this.orcStartRoar(c);
      return true;
    }
  }
  // 投げ斧
  if (this.step % 2 === c.id % 2 && this.skillCanStart(c, SKILL_ORC_THROW)) {
    const t = this.axeTarget(c);
    if (t) {
      c.run = -2;
      c.aim = t.id;
      this.setDir(c, t.x - c.x, t.y - c.y);
      this.skillStart(c, SKILL_ORC_THROW);
      return true;
    }
  }
  return false;
}

/** 雄叫びを溜めはじめる（にらみ合いの決着の時にも、src/eco/orc.ts の orcWary から呼ぶ） */
export function orcStartRoar(this: Ecology, c: Cr): void {
  c.run = -1;
  this.skillStart(c, SKILL_ORC_ROAR);
  this.noise(c.x, c.y, 6);
}

/** 雄叫びで逃げるか怖む者の数（腹を空かせて住処を襲うときに、吠える意味があるか） */
export function roarScares(this: Ecology, c: Cr): number {
  let n = 0;
  this.nearby(c.x, c.y, Math.ceil(ROAR_R / TILE) + 1, (o) => {
    if (o.dead || o.away || o.caught || !SCARED.has(o.k) || sq(o.x - c.x) + sq(o.y - c.y) > ROAR_R * ROAR_R) return;
    n++;
  });
  return n;
}

/** 雄叫びを放つ：まわりの小物を逃がし、冒険者の後衛を怖ませ、従うゴブリンを相手へ駆けつけさせる */
export function orcRoar(this: Ecology, c: Cr): void {
  const m = this.w.map;
  this.fxAttacks.push({ t: this.w.tick, style: 'roar', col: 0, size: 2, ax: c.x, ay: c.y, dx: c.x + (c.dir === 2 ? 1 : c.dir === 3 ? -1 : 0), dy: c.y + (c.dir === 0 ? 1 : c.dir === 1 ? -1 : 0), did: -1, aid: c.id, big: true, kill: false, rad: ROAR_R });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  this.noise(c.x, c.y, 12);
  // 加勢させる相手：にらみ合いのあとなら一行のいちばん近い者、そうでなければ打ってきた相手（小物は逃げるので、加勢の相手にしない）
  let foe: Cr | null = null;
  const f0 = this.byId.get(c.foe);
  if (f0 && !f0.dead && !f0.away && f0.k !== Kind.Orc && f0.k !== Kind.Goblin && this.w.tick - c.hitAt < 200 && sq(f0.x - c.x) + sq(f0.y - c.y) < RALLY_R * RALLY_R) foe = f0;
  let scared = 0;
  let stunned = 0;
  let bd = 1e18;
  this.nearby(c.x, c.y, Math.ceil(ROAR_R / TILE) + 1, (o) => {
    if (o === c || o.dead || o.away || o.caught) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d > ROAR_R * ROAR_R || !lineOfSight(m, c.x, c.y, o.x, o.y)) return;
    if (c.ref && o.k === Kind.Adventurer && o.party === c.ref && d < bd) {
      bd = d;
      foe = o;
    }
    if (SCARED.has(o.k) || (o.k === Kind.Goblin && !o.party && !vassalGoblin.call(this, c, o))) {
      o.sleep = 0;
      o.flee = Math.max(o.flee, ROAR_FLEE + (o.id % 20));
      o.foe = c.id;
      if (o.act === 2 && o.actT < 0) o.act = 0;
      scared++;
      return;
    }
    if (o.k === Kind.Adventurer && REAR.has(o.sp) && (this.heroOf(o)?.rank ?? 0) < 3) {
      o.sleep = 0;
      o.stun = Math.max(o.stun, ROAR_STUN);
      stunned++;
    }
  });
  // 加勢：従う集落のゴブリンに、相手への警戒を出す（10マスの内の者が駆けつける）。眠っている者も起きる
  let rallied = 0;
  const target = foe as Cr | null;
  if (target && !SCARED.has(target.k)) {
    for (const cp of this.vassalsOf(c)) {
      let near = 0;
      this.nearby(c.x, c.y, Math.ceil(RALLY_R / TILE) + 1, (o) => {
        if (o.dead || o.away || o.k !== Kind.Goblin || o.party || o.ref !== cp.id || sq(o.x - c.x) + sq(o.y - c.y) > RALLY_R * RALLY_R) return;
        near++;
        o.sleep = 0;
        this.markNotice(o, target, '!');
      });
      if (!near) continue;
      this.alarms.set(`${Kind.Goblin}:${cp.id}`, { t: this.step, foe: target.id, x: Math.round(c.x), y: Math.round(c.y) });
      rallied += near;
    }
  }
  this.record('settle', { t: this.w.tick, k: Kind.Orc, ev: 'orcRoar', id: c.id, n: scared + stunned, how: rallied, x: Math.round(c.x), y: Math.round(c.y) } as never);
}

/**
 * 投げ斧の狙い：3〜7マス先で、見通しが利き、気づいている相手。
 * 戦っている冒険者の一行（にらみ合いのあと襲いかかっているか、打たれて間もない）の者（後衛を先に、近い者から）か、従う集落のそばのコボルト（腹を空かせていないとき）
 */
export function axeTarget(this: Ecology, c: Cr): Cr | null {
  const m = this.w.map;
  const foe = this.byId.get(c.foe);
  const fighting = c.st === 22 || (this.w.tick - c.hitAt < 200 && !!foe && !foe.dead && (foe.k === Kind.Adventurer || foe.k === Kind.Dwarf));
  const partyId = c.st === 22 ? c.ref : foe && foe.k === Kind.Adventurer ? foe.party : -1;
  const camps = c.hungry ? [] : this.vassalsOf(c).filter((cp) => sq(cp.x - c.x) + sq(cp.y - c.y) < 25 * TILE * 25 * TILE);
  if (!fighting && !camps.length) return null;
  let best: Cr | null = null;
  let bs = 1e18;
  this.nearby(c.x, c.y, Math.ceil(THROW_MAX / TILE) + 1, (o) => {
    if (o.dead || o.away || o.caught) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < THROW_MIN * THROW_MIN || d > THROW_MAX * THROW_MAX) return;
    let score: number;
    if (fighting && o.k === Kind.Adventurer && o.party === partyId) score = d * (REAR.has(o.sp) ? 0.4 : 1);
    else if (fighting && o.k === Kind.Dwarf && foe?.k === Kind.Dwarf) score = d;
    else if (o.k === Kind.Kobold && camps.some((cp) => sq(cp.x - o.x) + sq(cp.y - o.y) < 8 * TILE * 8 * TILE)) score = d * 1.5;
    else return;
    if (score >= bs || !this.canSense(c, o) || !lineOfSight(m, c.x, c.y, o.x, o.y)) return;
    bs = score;
    best = o;
  });
  return best;
}

/** 斧を投げる：投げたときに相手がいた所（通り道にほかの者がいればその所）へ。届いた時に当たり、鎖でたぐって戻す */
export function orcThrow(this: Ecology, c: Cr): void {
  const t = this.byId.get(c.aim);
  c.aim = 0;
  if (!t || t.dead || t.away) return;
  let tx = t.x;
  let ty = t.y;
  const dx = tx - c.x;
  const dy = ty - c.y;
  const L = Math.sqrt(dx * dx + dy * dy) || 1;
  if (L > THROW_MAX + TILE || !lineOfSight(this.w.map, c.x, c.y, tx, ty)) return;
  const ux = dx / L;
  const uy = dy / L;
  // 通り道の者：斧の通る帯（幅 AXE_W）の中で、いちばん手前の者の所で止まる
  let stop = L;
  this.nearby(c.x + dx / 2, c.y + dy / 2, Math.ceil(L / 2 / TILE) + 1, (o) => {
    if (o === c || o === t || o.dead || o.away || o.caught || !this.axeHits(c, o)) return;
    const along = (o.x - c.x) * ux + (o.y - c.y) * uy;
    if (along < TILE * 0.8 || along >= stop) return;
    if (Math.abs((o.x - c.x) * uy - (o.y - c.y) * ux) > AXE_W) return;
    stop = along;
  });
  tx = c.x + ux * stop;
  ty = c.y + uy * stop;
  const nOut = Math.max(2, Math.ceil(stop / AXE_OUT));
  const nBack = Math.max(2, Math.ceil(stop / AXE_BACK));
  this.queueVolley(c, { d: -1, x: tx, y: ty, r: AXE_R, mul: THROW_MUL, poison: 0, tgt: t.id }, nOut * CR_EVERY);
  this.fxAttacks.push({ t: this.w.tick, style: 'axethrow', col: 0, size: 1, ax: c.x, ay: c.y, dx: tx, dy: ty, did: t.id, aid: c.id, big: false, kill: false, fly: nOut * CR_EVERY, n: nBack * CR_EVERY });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  c.run = nOut + nBack;
  this.noise(c.x, c.y, 5);
}

declare module '../ecology' {
  interface Ecology {
    orcSkill: typeof orcSkill;
    orcStartRoar: typeof orcStartRoar;
    roarScares: typeof roarScares;
    orcRoar: typeof orcRoar;
    axeTarget: typeof axeTarget;
    orcThrow: typeof orcThrow;
    axeHits: typeof axeHits;
  }
}

Object.assign(Ecology.prototype, { orcSkill, orcStartRoar, roarScares, orcRoar, axeTarget, orcThrow, axeHits });
