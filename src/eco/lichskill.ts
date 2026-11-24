/**
 * Ecology のメソッド：リッチの死の呪い（詠唱の溜めと、受けた側の反応）。
 *
 * 見せたい場面：住みかに入ってきた者に、リッチが杖を掲げて詠唱する（およそ3秒）。狙われた者の足もとに紫の魔法陣が広がり、
 * 詠唱が終わると、紫の呪いが相手を打つ（重い一打ち）。狙われた冒険者は「!」を出してリッチの方を向き、職業ごとに応じる（advLich）：
 *   盗賊・狩人・魔法使い・吟遊詩人は、すぐそばの壁や柱の陰へ走り込む（陰が無ければリッチから離れる向きへ下がる）。陰へ出れば、呪いは散ってリッチの頭に「?」。
 *   戦士と竜殺しは、狙われた仲間の1マス手前へ走り込み、呪いを代わりに受ける（傷は軽い）。
 *   僧侶は、祓いの光で詠唱を打ち消す（位が高いほど早く、よく効く）。魔法使いと僧侶の一打ちが当たっても、詠唱は止まる（strike から lichWardHit）。
 * 詠唱の合間は、すぐそばの相手だけを杖で打つ。
 * 襲う相手は、5マスの内の見通しの利く冒険者・ゴブリン・コボルト・オーク・リザードマン。冒険者のほかは呪いに応じない。
 *
 * 状態：詠唱しているあいだは run に −1、狙う相手は aim（どちらもセーブに入る）。
 */
import { CR_EVERY, type Cr, Ecology, Job, Kind, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { holyStrike } from './ghostskill';
import type { Skill } from './skill';
import { SKILL_PRIEST_HAMMER } from './skill';

/** 死の呪い：およそ3秒詠唱し、使ったあと2秒は詠唱し直さない（詠唱が短いと、冒険者が応じる前に放たれる） */
export const SKILL_LICH_CURSE: Skill = { windup: 16, cool: 10 };
/** 詠唱を始める相手の遠さと、放つときに呪いが届く遠さ（px） */
const CURSE_START = 5 * TILE;
const CURSE_R = 6 * TILE;
/** 呪いの重さ（ふつうの一打ちに対する倍率）と、前衛が代わりに受けたときの倍率 */
const CURSE_MUL = 1.8;
const GUARD_MUL = 0.6;
/** 詠唱の合間に杖で打つ間合い（px） */
const STAFF_D = 1.5 * TILE;
/** 応じる冒険者の走る速さ（px／生き物の更新。ふつうに歩く速さの2倍） */
const DASH = 2;
/** 呪いを受ける種 */
const PREY = new Set<number>([Kind.Adventurer, Kind.Goblin, Kind.Kobold, Kind.Orc, Kind.Lizardman]);

/** 16方向の単位ベクトル（陰を探す向き） */
const DIR_X = Array.from({ length: 16 }, (_, i) => Math.cos((i * Math.PI) / 8));
const DIR_Y = Array.from({ length: 16 }, (_, i) => Math.sin((i * Math.PI) / 8));

const frontLine = (c: Cr) => c.sp === Job.Warrior || c.sp === Job.Slayer || c.sp === Job.Priest;

/** 詠唱の溜めと、相手を襲う動き（lich の判断のはじめに呼ぶ）。true なら、この回はこれで終わり */
export function lichSkill(this: Ecology, c: Cr): boolean {
  if (c.run < 0) {
    const sk = this.skillStep(c, SKILL_LICH_CURSE, false);
    if (sk === 'charging') {
      const t = this.byId.get(c.aim);
      if (t && !t.dead) this.setDir(c, t.x - c.x, t.y - c.y);
      return true;
    }
    c.run = 0;
    if (sk === 'ready') {
      c.act = 2;
      c.actT = 0;
      this.lichCurse(c);
      return true;
    }
  }
  if (c.act === 2 && c.actT < 6) return true;
  const m = this.w.map;
  let t: Cr | null = null;
  let bd = CURSE_START * CURSE_START;
  this.nearby(c.x, c.y, Math.ceil(CURSE_START / TILE), (o) => {
    if (o.dead || o.away || !PREY.has(o.k)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d >= bd || !lineOfSight(m, c.x, c.y, o.x, o.y)) return;
    bd = d;
    t = o;
  });
  if (!t) return false;
  const f = t as Cr;
  this.setDir(c, f.x - c.x, f.y - c.y);
  if (this.skillCanStart(c, SKILL_LICH_CURSE)) {
    c.run = -1;
    c.aim = f.id;
    this.skillStart(c, SKILL_LICH_CURSE);
    // 狙われた冒険者は気づいて、リッチの方を向く
    if (f.k === Kind.Adventurer) {
      this.markNotice(f, c, '!');
      this.setDir(f, c.x - f.x, c.y - f.y);
    }
    this.record('settle', { t: this.w.tick, k: Kind.Lich, ev: 'curseStart', id: c.id, n: f.k, x: Math.round(f.x), y: Math.round(f.y) } as never);
    return true;
  }
  // 詠唱の合間：すぐそばの相手だけを杖で打つ（5回の更新に1回）
  if (bd < STAFF_D * STAFF_D && this.step % 5 === c.id % 5) this.fight(c, f);
  else if (c.act !== 2) c.act = 0;
  return true;
}

/** 詠唱が終わった：相手が届く所に見えていれば呪いで打つ（あいだに前衛が入っていれば、その者が受ける）。見失っていれば散る */
export function lichCurse(this: Ecology, c: Cr): void {
  const m = this.w.map;
  const t = this.byId.get(c.aim);
  if (!t || t.dead || t.away || sq(t.x - c.x) + sq(t.y - c.y) > CURSE_R * CURSE_R || !lineOfSight(m, c.x, c.y, t.x, t.y)) {
    this.fxAttacks.push({ t: this.w.tick, style: 'puff', col: 4, size: 0, ax: c.x, ay: c.y, dx: c.x, dy: c.y - 16, did: -1, aid: c.id, big: false, kill: false });
    this.fxMarks.push({ t: this.w.tick, id: c.id, m: '?' });
    this.record('settle', { t: this.w.tick, k: Kind.Lich, ev: 'curseLost', id: c.id, n: t?.k ?? -1, x: Math.round(c.x), y: Math.round(c.y) } as never);
    return;
  }
  // 前衛の代わり受け：リッチと相手を結ぶ線の上（線から10px の内、相手より手前）にいる、同じ一行の戦士・竜殺し・僧侶
  const L = Math.sqrt(sq(t.x - c.x) + sq(t.y - c.y)) || 1;
  const ux = (t.x - c.x) / L;
  const uy = (t.y - c.y) / L;
  let guard: Cr | null = null;
  let ga = L;
  if (t.k === Kind.Adventurer && t.party)
    this.nearby(c.x, c.y, Math.ceil(L / TILE) + 1, (o) => {
      if (o === t || o.dead || o.k !== Kind.Adventurer || o.party !== t.party || !frontLine(o)) return;
      const along = (o.x - c.x) * ux + (o.y - c.y) * uy;
      const side = Math.abs((o.x - c.x) * uy - (o.y - c.y) * ux);
      if (along < 8 || along >= ga || side > 12) return;
      ga = along;
      guard = o;
    });
  const d = (guard as Cr | null) ?? t;
  this.fxAttacks.push({ t: this.w.tick, style: 'curse', col: 4, size: 2, ax: c.x, ay: c.y, dx: d.x, dy: d.y, did: d.id, aid: c.id, big: true, kill: false });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  const killed = this.strike(c, d, d === t ? CURSE_MUL : GUARD_MUL, false);
  if (killed) this.slay(c, d);
  this.record('settle', { t: this.w.tick, k: Kind.Lich, ev: 'curse', id: c.id, n: d.k, how: d !== t ? 'guard' : killed ? 'kill' : 'hit', x: Math.round(d.x), y: Math.round(d.y) } as never);
}

/** 詠唱しているリッチが、魔法か聖なる一打ちを受けた（strike から）：詠唱が止まる */
export function lichWardHit(this: Ecology, a: Cr, d: Cr): void {
  if (d.k !== Kind.Lich || d.run !== -1 || d.act !== 2 || d.actT >= 0 || d.hp <= 0 || !holyStrike(a)) return;
  this.breakWindup(d);
}

/**
 * 冒険者の応じ方（adventurer の判断のはじめ、ミノタウロスの突進への備えと同じ所で呼ぶ）。true なら、この回はこれで終わり。
 * 応じはじめるのは詠唱が始まってから少し後（盗賊と狩人はすぐ、ほかは生き物の更新2〜4回後。位の高い者ほど早い）
 */
export function advLich(this: Ecology, c: Cr): boolean {
  let lich: Cr | null = null;
  this.nearby(c.x, c.y, 7, (o) => {
    if (!lich && o.k === Kind.Lich && !o.dead && o.run === -1 && o.act === 2 && o.actT < 0) lich = o;
  });
  if (!lich) return false;
  const l = lich as Cr;
  const t = this.byId.get(l.aim);
  if (!t || t.dead) return false;
  const rank = this.heroOf(c)?.rank ?? 0;
  const delay = Math.max(0, (c.sp === Job.Thief || c.sp === Job.Hunter ? 0 : c.sp === Job.Priest ? 3 : 4) - rank);
  if ((this.w.tick - l.cast) / CR_EVERY < delay) return false;
  // 僧侶：見通しの利く5マスの内なら、祓いの光で詠唱を打ち消す（技の溜めと同じく、使ったあとの間が明けていれば。位が高いほどよく効く）
  if (c.sp === Job.Priest && sq(l.x - c.x) + sq(l.y - c.y) < 5 * TILE * 5 * TILE && this.skillCanStart(c, SKILL_PRIEST_HAMMER) && lineOfSight(this.w.map, c.x, c.y, l.x, l.y)) {
    c.act = 2;
    c.actT = 0;
    c.cast = this.w.tick;
    this.setDir(c, l.x - c.x, l.y - c.y);
    const ok = ih(c.id, l.id ^ this.step, 471) % 100 < 55 + rank * 15;
    this.fxAttacks.push({ t: this.w.tick, style: 'cross', col: 1, size: 1, ax: c.x, ay: c.y, dx: l.x, dy: l.y, did: l.id, aid: c.id, big: false, kill: false });
    if (ok) this.breakWindup(l);
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, ev: 'curseWard', id: c.id, n: Kind.Lich, how: ok ? 1 : 0, x: Math.round(c.x), y: Math.round(c.y) } as never);
    return true;
  }
  // 前衛（戦士・竜殺し）：狙われた仲間とリッチのあいだへ入って構える
  if ((c.sp === Job.Warrior || c.sp === Job.Slayer) && t !== c && t.k === Kind.Adventurer && t.party === c.party && sq(t.x - c.x) + sq(t.y - c.y) < 6 * TILE * 6 * TILE) {
    const L = Math.sqrt(sq(t.x - l.x) + sq(t.y - l.y)) || 1;
    const k = Math.min(TILE, L * 0.5) / L;
    const bx = t.x + (l.x - t.x) * k;
    const by = t.y + (l.y - t.y) * k;
    if (sq(bx - c.x) + sq(by - c.y) > 9) {
      c.act = 1;
      this.goTo(c, bx, by, DASH);
    } else c.act = 0;
    this.setDir(c, l.x - c.x, l.y - c.y);
    return true;
  }
  // 狙われた後衛：すぐそば（2マスの内）の、リッチから見えない所へ走り込む。無ければリッチから離れる向きへ下がる
  if (t === c && !frontLine(c)) {
    const m = this.w.map;
    let bx = 0;
    let by = 0;
    let bd = Infinity;
    for (let i = 0; i < 16; i++)
      for (const r of [12, 20, 28]) {
        const x = c.x + DIR_X[i] * r;
        const y = c.y + DIR_Y[i] * r;
        const k = this.tileOf(x, y);
        if (k < 0 || !this.tilePassable(c, k) || !lineOfSight(m, c.x, c.y, x, y) || lineOfSight(m, l.x, l.y, x, y)) continue;
        if (r < bd) {
          bd = r;
          bx = x;
          by = y;
        }
        break;
      }
    c.act = 1;
    if (bd < Infinity) this.goTo(c, bx, by, DASH);
    else {
      const dx = c.x - l.x;
      const dy = c.y - l.y;
      const L = Math.sqrt(dx * dx + dy * dy) || 1;
      this.goTo(c, c.x + (dx / L) * 3 * TILE, c.y + (dy / L) * 3 * TILE, DASH);
    }
    this.setDir(c, l.x - c.x, l.y - c.y);
    return true;
  }
  return false;
}

declare module '../ecology' {
  interface Ecology {
    lichSkill: typeof lichSkill;
    lichCurse: typeof lichCurse;
    lichWardHit: typeof lichWardHit;
    advLich: typeof advLich;
  }
}

Object.assign(Ecology.prototype, { lichSkill, lichCurse, lichWardHit, advLich });
