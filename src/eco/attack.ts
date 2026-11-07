/**
 * Ecology のメソッド：攻撃の形（扇・円）。形の中にいる相手すべてに、一打ちずつ当てる。
 *
 * これまでの攻撃は、どれも「相手1体に必ず当たる一打ち」で、届くのは体が触れるくらい（1マス弱）だった。
 * そのため、数の多い側（冒険者の一行）が1体を囲んで一方的に倒し、離れて撃つ側は打たれなかった。
 * 形のある攻撃は、固まった相手をまとめて打つので、囲む側にも危険がある（イニシエダンジョンの技の当たり方を参考にした）。
 *
 * 形：
 *   扇（fan）：打つ者から向きの方へ、半径 r、左右に half（ラジアン）の扇（竜殺しの大剣の薙ぎ払い）
 *   円（circle）：中心から半径 r の円（矢の雨の落ちた所）
 *   直線（line）：中心から向きの方へ長さ r、幅 2w の帯（戦士の飛ぶ斬撃。max 体まで貫く）
 *   十字（cross）：中心から縦横に腕 r、幅 2w（僧侶のハンマーの十字架の爆発）
 * 壁の向こうの者には当たらない（中心から見通しの利く者だけ）。
 * 画面には、形そのものを一つのエフェクトで出す（src/creatureView.ts の sweep と wave）。打たれた者それぞれには、ふつうの打たれた光（fxHits）が出る。
 */
import { BLOOD, CR_EVERY, Cr, Ecology, Kind, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';

export interface Area {
  kind: 'fan' | 'circle' | 'line' | 'cross';
  /** 半径、長さ、腕の長さ（px） */
  r: number;
  /** 扇の左右の広がり（ラジアン） */
  half?: number;
  /** 直線と十字の半分の幅（px） */
  w?: number;
  /** 当たる数の上限（近い者から） */
  max?: number;
}

/** 形の見せ方：エフェクトの種類（src/creatureView.ts の drawAttacks）と色。style が空なら、エフェクトを出さない（呼んだ側が別に出す） */
export interface AreaLook {
  style: string;
  col: number;
}

/** (dx, dy)（中心からの位置）が形の中か */
function inside(A: Area, dx: number, dy: number, ux: number, uy: number): boolean {
  const d2 = dx * dx + dy * dy;
  if (A.kind === 'circle') return d2 <= A.r * A.r;
  if (A.kind === 'fan') {
    if (d2 > A.r * A.r) return false;
    return d2 <= 64 || (dx * ux + dy * uy) / Math.sqrt(d2) >= Math.cos(A.half ?? Math.PI);
  }
  const w = A.w ?? 8;
  if (A.kind === 'line') {
    const along = dx * ux + dy * uy;
    return along >= -w && along <= A.r && Math.abs(dx * uy - dy * ux) <= w;
  }
  // 十字：縦か横の帯
  return (Math.abs(dx) <= A.r && Math.abs(dy) <= w) || (Math.abs(dy) <= A.r && Math.abs(dx) <= w);
}

/**
 * 形の中の相手に一打ちずつ当てる。中心は (cx, cy)、扇の向きは (ux, uy)（長さ1）。
 * who は当ててよい相手か（打つ者自身はもとから除く）。倒した数を返す。
 */
export function areaStrike(this: Ecology, a: Cr, cx: number, cy: number, ux: number, uy: number, A: Area, mul: number, look: AreaLook, who: (o: Cr) => boolean): number {
  const m = this.w.map;
  let hits: Cr[] = [];
  this.nearby(cx, cy, Math.ceil(A.r / TILE) + 1, (o) => {
    if (o === a || o.dead || o.away || o.caught || !who(o)) return;
    if (!inside(A, o.x - cx, o.y - cy, ux, uy)) return;
    if (!lineOfSight(m, cx, cy, o.x, o.y)) return;
    hits.push(o);
  });
  // 当てる順は近い者から（倒した者を食べる種は、いちばん近い獲物を食べる）
  hits.sort((p, q) => sq(p.x - cx) + sq(p.y - cy) - (sq(q.x - cx) + sq(q.y - cy)) || p.id - q.id);
  if (A.max) hits = hits.slice(0, A.max);
  if (look.style) {
    // 直線は、最後に当たった所（貫いて止まった所）までエフェクトが飛ぶ
    const len = A.kind === 'line' && A.max && hits.length >= A.max ? Math.max(TILE, (hits[hits.length - 1].x - cx) * ux + (hits[hits.length - 1].y - cy) * uy) : A.r;
    this.fxAttacks.push({ t: this.w.tick, style: look.style, col: look.col, size: 2, ax: cx, ay: cy, dx: cx + ux * len, dy: cy + uy * len, did: hits[0]?.id ?? -1, aid: a.id, big: true, kill: false, rad: A.kind === 'line' ? len : A.r, half: A.half ?? Math.PI });
    if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  }
  this.lastBigHit = this.w.tick;
  let kills = 0;
  let ate = false;
  for (const o of hits) {
    if (o.dead) continue;
    if (!this.strike(a, o, mul, false)) continue;
    kills++;
    ate = this.slay(a, o, !ate) || ate;
  }
  return kills;
}

/**
 * 倒した相手をどうするか（打ち合いでも、形のある攻撃でも同じ）：骨・石・人などは倒すだけ、ほかの種は食べる（canEat が false なら倒すだけ）。
 * 食べたら true
 */
export function slay(this: Ecology, a: Cr, d: Cr, canEat = true): boolean {
  let ate = false;
  if (a.k === Kind.Skeleton || a.k === Kind.Lich || a.k === Kind.Dwarf || a.k === Kind.Golem || a.k === Kind.Gargoyle || a.k === Kind.Armor || a.k === Kind.Thrall || (a.k === Kind.Adventurer && d.k !== Kind.Rat) || !canEat) this.die(d, 'fight', a.k);
  else {
    this.eat(a, d, true);
    ate = true;
  }
  // ヴァンパイアと、その眷属が倒した者は、眷属として起き上がることがある（src/eco/thrall.ts）
  if (a.k === Kind.Vampire) this.vampClaim(a, d);
  else if (a.k === Kind.Thrall) this.thrallClaim(a, d);
  return ate;
}

/** 毒の効かない者（血の通わない者：骨・石・霊・鎧・スライムなど） */
export function poisonable(c: Cr): boolean {
  return BLOOD[c.k] >= 0 && c.k !== Kind.Gargoyle && c.k !== Kind.Golem && c.k !== Kind.Dragon;
}

/** 毒にする（n 回の生き物の更新のあいだ。すでに毒なら長いほうに） */
export function poisonOn(this: Ecology, c: Cr, by: number, n: number): void {
  if (!poisonable(c) || c.dead) return;
  c.poison = Math.max(c.poison, n);
  c.poisonBy = by;
}

/**
 * 毒の進み（生き物の更新ごと）：体力の上限に比べて少しずつ減る（25回でおよそ3割）。毒で倒れたら、毒を与えた種が倒したことにする。倒れたら true
 */
export function poisonTick(this: Ecology, c: Cr): boolean {
  if (c.poison <= 0) return false;
  c.poison--;
  const mx = this.maxHp(c);
  if (c.hp <= 0) c.hp = mx;
  c.hp -= mx * 0.012;
  if (c.hp > 0) return false;
  c.poison = 0;
  this.die(c, 'fight', c.poisonBy);
  return true;
}

/** 少し後で当たる攻撃を積む（魔法の矢、矢の雨）。delay は tick */
export function queueVolley(this: Ecology, a: Cr, v: Omit<import('../ecology').Volley, 't' | 'a'>, delay: number): void {
  this.volleys.push({ t: this.w.tick + delay, a: a.id, ...v });
}

/**
 * 時刻の来た攻撃を当てる（生き物の更新のはじめに）。打った者がもういなければ（外へ出た、消えた）当たらない。
 * 魔法の矢（d が 0 以上）は、その相手が生きていれば必ず当たる。矢の雨（d が −1）は、落ちた所（半径 r）にそのときいる者に当たる（動いていれば避けられる）
 */
export function resolveVolleys(this: Ecology): void {
  if (!this.volleys.length) return;
  const now = this.w.tick;
  const due = this.volleys.filter((v) => v.t <= now);
  if (!due.length) return;
  this.volleys = this.volleys.filter((v) => v.t > now);
  for (const v of due) {
    const a = this.byId.get(v.a);
    if (!a || a.dead === 2) continue;
    if (v.d >= 0) {
      const d = this.byId.get(v.d);
      if (!d || d.dead || d.away) continue;
      if (this.strike(a, d, v.mul, false)) this.slay(a, d, false);
      continue;
    }
    // 矢の雨：打った者と同じ種には当たらない（冒険者の矢はドワーフにも当たらない）。霊とウィスプは矢がすり抜ける
    const who = (o: Cr) => o.k !== a.k && !(a.k === Kind.Adventurer && o.k === Kind.Dwarf) && o.k !== Kind.Ghost && o.k !== Kind.Wisp;
    let first = true;
    this.nearby(v.x, v.y, Math.ceil(v.r / TILE) + 1, (o) => {
      if (o.dead || o.away || o.caught || !who(o) || sq(o.x - v.x) + sq(o.y - v.y) > v.r * v.r) return;
      if (v.poison > 0) this.poisonOn(o, a.k, v.poison);
      if (this.strike(a, o, v.mul, false)) {
        this.slay(a, o, first);
        first = false;
      }
    });
  }
}

declare module '../ecology' {
  interface Ecology {
    areaStrike: typeof areaStrike;
    slay: typeof slay;
    poisonOn: typeof poisonOn;
    poisonTick: typeof poisonTick;
    queueVolley: typeof queueVolley;
    resolveVolleys: typeof resolveVolleys;
  }
}

Object.assign(Ecology.prototype, { areaStrike, slay, poisonOn, poisonTick, queueVolley, resolveVolleys });
