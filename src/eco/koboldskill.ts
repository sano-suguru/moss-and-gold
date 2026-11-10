/**
 * Ecology のメソッド：コボルトの技（スリングの投石）。
 *
 * コボルトは、近づいた冒険者の一行がずっと強いと見ると、戦わずに逃げる（src/eco/kobold.ts）。そのとき、逃げ出す前に一度だけ振り向いて、
 * 頭の上で革ひものスリングを回し（およそ0.8秒）、小石を山なりに投げてから踵を返す。
 *   狙うのは、見通しが利く2〜8マス先の、起きている冒険者。技を溜めている者（呪文を唱える魔法使いなど）がいれば、その者を先に狙う。
 *   小石は、投げたときに相手がいた所へ飛び、届いたときにそこ（半径12px）にいる冒険者に当たる（その間に離れていれば外れて、床で跳ねる。
 *   ただ、一行は気づいたコボルトの方を向いて足を止めることが多く、外れるのは千回に1回ほど）。
 *   当たった者はかすり傷を負い（小石だけでは体力を上限の8割より下げない）、技を溜めていれば、その溜めが止まる（魔法使いの呪文は散って消える）。
 *   当たった冒険者には「打ってきた相手」として覚えさせない（逃げるコボルトを追いかけて倒すようにならないように）。
 *   使ったあと30秒は投げない（そのあいだに一行に出会えば、今までどおり、すぐに逃げる）。焚き火で野営している一行には投げない。
 *   投げるのも当たるのも静かで、物音は立てない
 *   （物音を立てると、16シード×25日で、一行が物音に立ち止まる場面が1695→1877回に、冒険者に倒されるゴブリンが238→292匹に増えた）。
 * （以前のコボルトは、一行に気づくと何もせずに逃げるだけで、冒険者との関わりは画面にほとんど出なかった。
 *  main の16シード×3〜25日で、冒険者に気づいて逃げ出したのは14シードの7千回ほど、その時の距離はほとんどが4〜8マスで、見通しはすべて利いていた）
 *
 * 状態：溜めているあいだは run に −1、狙う相手は aim（どちらもセーブに入る）。小石が当たるのは、少し後で当たる攻撃（src/eco/attack.ts の queueVolley・resolveVolleys）で扱う。
 */
import { Cr, Ecology, Job, Kind, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import type { Skill } from './skill';

/** スリングの投石：およそ0.8秒回し、使ったあと30秒は投げない */
export const SKILL_KOBOLD_SLING: Skill = { windup: 4, cool: 150 };
/** 投げる相手の近さ（px） */
const SLING_MIN = 2 * TILE;
const SLING_MAX = 8 * TILE;
/** 小石の飛ぶ速さ（tick あたりの px）、当たる丸の半径（px）、打ちの強さ（ふつうの一打ちに対する倍率） */
const STONE_SPEED = 10;
export const STONE_R = 12;
const STONE_MUL = 0.8;
/**
 * 小石が体力を削れる下限（体力の上限に対する割合）。
 * （下限を置かずに削らせると、16シード×25日で当たるのが3千回ほどあり、コボルトが画面にいる割合が63.9→59.5%、最後の数が219→193匹に減った。
 *  傷を0にするか、この下限を置くと、main と同じほどに戻った）
 */
const STONE_FLOOR = 0.8;

/** 逃げ出す（kobold.ts で一行に気づいたときと同じ） */
function bolt(this: Ecology, c: Cr, a: Cr | undefined): void {
  c.flee = 90 + (ih(c.id, this.step, 232) % 40);
  if (a) c.foe = a.id;
  c.lure = 0;
}

/**
 * 一行に気づいて逃げ出す前に、投石を溜めはじめる（溜めはじめたら true）。a は気づいた冒険者
 */
export function koboldSlingStart(this: Ecology, c: Cr, a: Cr): boolean {
  if (c.caught || c.bind > 0 || !this.skillCanStart(c, SKILL_KOBOLD_SLING)) return false;
  // 住処に身をひそめている者は、隠れたまま逃げる（姿を出して投げない。投げたうちの2割余りがこの形だった）
  if (this.isHidden(c)) return false;
  const p = this.parties.find((q) => q.id === a.party);
  // 焚き火で野営している一行には投げない（住処のそばで野営されると、出入りのたびに逃げては戻って投げ、一行が小石を浴び続けていた）
  if (p && (p.camp ?? -1) >= 0) return false;
  let best: Cr | null = null;
  let bs = -1;
  for (const id of p ? p.members : [a.id]) {
    const o = this.byId.get(id);
    if (!o || o.dead || o.away || o.sleep > 0 || o.k !== Kind.Adventurer) continue;
    const d2 = sq(o.x - c.x) + sq(o.y - c.y);
    if (d2 < SLING_MIN * SLING_MIN || d2 > SLING_MAX * SLING_MAX || !lineOfSight(this.w.map, c.x, c.y, o.x, o.y)) continue;
    // 技を溜めている者を先に、そのほかは近い者を先に
    const s = (o.act === 2 && o.actT < 0 ? 1e6 : 0) + 1e5 - d2;
    if (s > bs) {
      bs = s;
      best = o;
    }
  }
  if (!best) return false;
  c.run = -1;
  c.aim = best.id;
  this.setDir(c, best.x - c.x, best.y - c.y);
  this.skillStart(c, SKILL_KOBOLD_SLING);
  return true;
}

/** 投石の溜めと、投げたあとに逃げ出すまで（src/eco/step.ts から、溜めているコボルトの判断のはじめに呼ぶ）。今の回を使ったら true */
export function koboldSkill(this: Ecology, c: Cr): boolean {
  if (c.run !== -1) return false;
  const sk = this.skillStep(c, SKILL_KOBOLD_SLING);
  const t = this.byId.get(c.aim);
  if (sk === 'charging') {
    if (t && !t.dead) this.setDir(c, t.x - c.x, t.y - c.y);
    return true;
  }
  c.run = 0;
  c.aim = 0;
  // 溜めの途中でほかの処理（打たれて逃げるなど）に移っていた：溜めは消えたので、ふだんの判断に戻る
  if (sk === '') return false;
  if (sk === 'ready' && t && !t.dead && !t.away) {
    c.act = 2;
    c.actT = 0;
    this.koboldSling(c, t);
  }
  // 投げても、溜めが止まっても、そのまま逃げ出す
  bolt.call(this, c, t && !t.dead ? t : undefined);
  return true;
}

/** 小石を投げる：投げたときに相手がいた所へ、山なりに飛ぶ */
export function koboldSling(this: Ecology, c: Cr, t: Cr): void {
  const L = Math.hypot(t.x - c.x, t.y - c.y);
  if (L > SLING_MAX + TILE || !lineOfSight(this.w.map, c.x, c.y, t.x, t.y)) return;
  const fly = Math.max(4, Math.round(L / STONE_SPEED));
  this.queueVolley(c, { d: -1, x: t.x, y: t.y, r: STONE_R, mul: STONE_MUL, poison: 0, tgt: t.id }, fly);
  this.fxAttacks.push({ t: this.w.tick, style: 'sling', col: 0, size: 1, ax: c.x, ay: c.y, dx: t.x, dy: t.y, did: t.id, aid: c.id, big: false, kill: false, fly });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  this.record('settle', { t: this.w.tick, k: Kind.Kobold, ev: 'sling', id: c.id, n: t.sp, x: Math.round(c.x), y: Math.round(c.y) } as never);
}

/**
 * 小石が届いた（src/eco/attack.ts の resolveVolleys から）。届いた所（半径 r）にいる冒険者のうち、狙った者を先に、なければいちばん近い者に当たる。
 * 傷は小さく、倒れはしない。打ってきた相手としては覚えさせない（foe と hitAt は変えない）。技を溜めていれば止まる
 */
export function stoneLands(this: Ecology, a: Cr, v: { x: number; y: number; r: number; mul: number; tgt?: number }): void {
  let hit: Cr | null = null;
  let bd = v.r * v.r;
  this.nearby(v.x, v.y, 1, (o) => {
    if (o.dead || o.away || o.k !== Kind.Adventurer) return;
    const d = sq(o.x - v.x) + sq(o.y - v.y);
    if (d > v.r * v.r) return;
    // 狙った者は距離を −1 として、いちばん先に選ぶ
    const s = o.id === v.tgt ? -1 : d;
    if (s < bd || !hit) {
      bd = s;
      hit = o;
    }
  });
  let how = 0;
  if (hit) {
    const o = hit as Cr;
    const mx = this.maxHp(o);
    if (o.hp <= 0) o.hp = mx;
    const dmg = this.str(a) * (1.2 + (ih(a.id, o.id ^ this.step, 163) % 1000) / 1000 * 1.2) * v.mul;
    // 小石の傷はかすり傷で、体力を上限の8割より下げない（すでに8割を切っていれば、傷は増えない）
    o.hp = Math.max(Math.min(o.hp, mx * STONE_FLOOR), o.hp - dmg);
    o.sleep = 0;
    // 溜めていた技が止まる（src/eco/adventurer.ts で、溜めの途中で打たれたときと同じ。魔法使いの呪文は散って消える）
    if (o.act === 2 && o.actT < 0) {
      o.act = 0;
      o.actT = 0;
      how = 1;
      if (o.sp === Job.Wizard) this.fxAttacks.push({ t: this.w.tick, style: 'puff', col: 2, size: 0, ax: o.x, ay: o.y, dx: o.x, dy: o.y - 14, did: -1, aid: o.id, big: false, kill: false });
    }
    this.fxHits.push({ t: this.w.tick, x: o.x, y: o.y, ax: a.x, ay: a.y, id: o.id });
    if (this.fxHits.length > 120) this.fxHits.splice(0, 40);
    this.record('settle', { t: this.w.tick, k: Kind.Kobold, ev: 'stoneHit', id: a.id, n: o.sp, how, x: Math.round(o.x), y: Math.round(o.y) } as never);
  }
  // 届いた所：当たれば小石が砕けて散り、外れれば床で跳ねて土ぼこりが立つ（src/creatureView.ts の slinghit）
  const at = hit as Cr | null;
  this.fxAttacks.push({ t: this.w.tick, style: 'slinghit', col: at ? 1 : 0, size: 1, ax: a.x, ay: a.y, dx: at ? at.x : v.x, dy: at ? at.y : v.y, did: at ? at.id : -1, aid: a.id, big: false, kill: false });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
}

declare module '../ecology' {
  interface Ecology {
    koboldSlingStart: typeof koboldSlingStart;
    koboldSkill: typeof koboldSkill;
    koboldSling: typeof koboldSling;
    stoneLands: typeof stoneLands;
  }
}

Object.assign(Ecology.prototype, { koboldSlingStart, koboldSkill, koboldSling, stoneLands });
