/**
 * Ecology のメソッド：攻撃の形（扇・円）。形の中にいる相手すべてに、一打ちずつ当てる。
 *
 * これまでの攻撃は、どれも「相手1体に必ず当たる一打ち」で、届くのは体が触れるくらい（1マス弱）だった。
 * そのため、数の多い側（冒険者の一行）が1体を囲んで一方的に倒し、離れて撃つ側は打たれなかった。
 * 形のある攻撃は、固まった相手をまとめて打つので、囲む側にも危険がある（イニシエダンジョンの技の当たり方を参考にした）。
 *
 * 形：
 *   扇（fan）：打つ者から向きの方へ、半径 r、左右に half（ラジアン）の扇
 *   円（circle）：中心から半径 r の円（打つ者のまわりの衝撃波、着弾した火球の爆ぜ）
 * 壁の向こうの者には当たらない（中心から見通しの利く者だけ）。
 * 画面には、形そのものを一つのエフェクトで出す（src/creatureView.ts の sweep と wave）。打たれた者それぞれには、ふつうの打たれた光（fxHits）が出る。
 */
import { Cr, Ecology, Kind, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';

export interface Area {
  kind: 'fan' | 'circle';
  /** 半径（px） */
  r: number;
  /** 扇の左右の広がり（ラジアン） */
  half?: number;
}

/** 形の見せ方：エフェクトの種類（sweep 扇の薙ぎ払い、wave 円の衝撃波）と色 */
export interface AreaLook {
  style: 'sweep' | 'wave';
  col: number;
}

/**
 * 形の中の相手に一打ちずつ当てる。中心は (cx, cy)、扇の向きは (ux, uy)（長さ1）。
 * who は当ててよい相手か（打つ者自身はもとから除く）。倒した数を返す。
 */
export function areaStrike(this: Ecology, a: Cr, cx: number, cy: number, ux: number, uy: number, A: Area, mul: number, look: AreaLook, who: (o: Cr) => boolean): number {
  const m = this.w.map;
  const cosHalf = Math.cos(A.half ?? Math.PI);
  const hits: Cr[] = [];
  this.nearby(cx, cy, Math.ceil(A.r / TILE) + 1, (o) => {
    if (o === a || o.dead || o.away || o.caught || !who(o)) return;
    const dx = o.x - cx;
    const dy = o.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > A.r * A.r) return;
    if (A.kind === 'fan' && d2 > 64) {
      const d = Math.sqrt(d2);
      if ((dx * ux + dy * uy) / d < cosHalf) return;
    }
    if (!lineOfSight(m, cx, cy, o.x, o.y)) return;
    hits.push(o);
  });
  // 当てる順は近い者から（倒した者を食べる種は、いちばん近い獲物を食べる）
  hits.sort((p, q) => sq(p.x - cx) + sq(p.y - cy) - (sq(q.x - cx) + sq(q.y - cy)) || p.id - q.id);
  this.fxAttacks.push({ t: this.w.tick, style: look.style, col: look.col, size: 2, ax: cx, ay: cy, dx: cx + ux * A.r, dy: cy + uy * A.r, did: hits[0]?.id ?? -1, aid: a.id, big: true, kill: false, rad: A.r, half: A.half ?? Math.PI });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
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

declare module '../ecology' {
  interface Ecology {
    areaStrike: typeof areaStrike;
    slay: typeof slay;
  }
}

Object.assign(Ecology.prototype, { areaStrike, slay });
