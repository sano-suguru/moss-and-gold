/** Ecology のメソッド：スライム（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** 一つの死骸に群がって食べられるスライムの数 */
const SLIME_SHARE = 3;
/** 床から養分を吸って溜められる食べた物の上限（体が育つのは食べた物が20を超えたときなので、それより少なくする） */
const SLIME_SIP = 16;
/** 水たまりが無くても、スライムが生まれられる床の湿り気の下限（world.moist。とても湿った床だけ） */
const SLIME_DAMP = 180;

export function slime(this: Ecology, c: Cr): void {
  // 水の精：生まれた水辺のまわり6マスを漂い、3マス以内に入った生きた者を冷たい水で打つ。飢えない
  if (c.elite === 6) {
    c.sinceMeal = 0;
    let foe: Cr | null = null;
    this.nearby(c.x, c.y, 3, (o) => {
      if (!foe && !o.dead && !o.away && o !== c && STR[o.k] >= 2 && ![Kind.Slime, Kind.Wisp, Kind.Ghost].includes(o.k) && sq(o.x - c.x) + sq(o.y - c.y) < 3 * TILE * 3 * TILE) foe = o;
    });
    if (foe) {
      c.act = 1;
      if (sq((foe as Cr).x - c.x) + sq((foe as Cr).y - c.y) < 16 * 16) this.fight(c, foe as Cr);
      else this.goTo(c, (foe as Cr).x, (foe as Cr).y, SPEC[Kind.Slime].speed * 1.5);
      return;
    }
    if (ih(c.id, this.step >> 5, 307) % 4 === 0) {
      const a = (ih(c.id, this.step >> 6, 308) % 628) / 100;
      c.act = 1;
      this.goTo(c, c.hx + Math.cos(a) * 4 * TILE, c.hy + Math.sin(a) * 3 * TILE, SPEC[Kind.Slime].speed);
    } else c.act = 0;
    return;
  }
  const s = SPEC[Kind.Slime];
  const k = this.tileOf(c.x, c.y);
  // 乾くと縮む。湿った方へ這う
  if (k >= 0 && this.w.moist[k] < 90) {
    if (this.step % 25 === c.id % 25) {
      c.body--;
      this.deposit(c.x, c.y, 1);
      if (c.body < 4) {
        this.die(c, 'dried');
        return;
      }
    }
    const m = this.w.map;
    let best = k;
    for (const n of [k + 1, k - 1, k + m.w, k - m.w]) if (n >= 0 && n < m.solid.length && !m.solid[n] && !m.lava[n] && this.w.moist[n] > this.w.moist[best]) best = n;
    if (best !== k) {
      this.moveToward(c, (best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, s.speed);
      c.act = 1;
      return;
    }
  }
  // 死骸の匂いをたどる
  let target: Cr | null = this.byId.get(c.ref) ?? null;
  if (!target || target.dead !== 1 || target.units <= 0) {
    target = null;
    let bd = 160 * 160;
    for (const o of this.corpses) {
      const ok = this.tileOf(o.x, o.y);
      if (ok < 0 || this.w.moist[ok] < 60) continue;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d >= bd) continue;
      // 一つの死骸には、生きているスライムが3匹まで群がる（それより多いと、残りはほかの死骸を探す）。
      // 以前は死骸の ref に1匹だけ予約を書いていた。その予約は、予約したスライムが死んでも消えなかった。
      // そのうえ、生きていたときの番号（集落や巣穴など）も死骸に残っていたので、どのスライムも食べられない死骸ができた。
      // 新しいスライムは死骸の近くで生まれるので、食べられない死骸のそばで生まれては飢え死にする、を繰り返していた
      let eaters = 0;
      this.nearby(o.x, o.y, 11, (q) => {
        if (q !== c && q.k === Kind.Slime && !q.dead && q.ref === o.id) eaters++;
      });
      if (eaters >= SLIME_SHARE) continue;
      bd = d;
      target = o;
    }
    c.ref = target ? target.id : 0;
  }
  if (target) {
    if (sq(target.x - c.x) + sq(target.y - c.y) < 7 * 7) {
      // 包み込んで溶かす
      const t = Math.min(2, target.units, s.cap - c.food);
      if (t > 0) {
        target.units -= t;
        c.food += t;
        c.sinceMeal = 0;
        c.act = 2;
        if (c.actT > 4) c.actT = 0;
        if (target.units <= 0) {
          target.dead = 2;
          c.ref = 0;
        }
      } else c.act = 0;
    } else {
      c.act = 1;
      this.goTo(c, target.x, target.y, s.speed);
    }
  } else {
    // 死骸がなければ、湿って養分の溜まった床から養分を少しずつ吸って生きる（生き物の更新10回ごとに1。床の養分が体に移るだけなので、養分の総量は変わらない）。
    // 吸うだけでは、食べた物は SLIME_SIP までしか溜まらず、体は育たない。育って二つに分かれるには死骸を食べる。
    // 以前は食べ物が死骸だけで、死骸を食べ尽くすと続かず、スライムが画面から消えている時間が長かった
    if (k >= 0 && c.food < SLIME_SIP && this.w.nutr[k] >= 20 && this.step % 10 === c.id % 10) {
      this.w.nutr[k]--;
      c.food++;
    }
    c.act = c.actT % 40 < 20 ? 0 : 1;
    if (c.act === 1) {
      const j = DIR16[ih(c.id, this.step >> 3, 52) & 15];
      this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
    }
  }
  // 育ったら二つに分かれる
  if (c.body + c.food >= 70 && c.food >= 30 && this.counts[Kind.Slime] < 40) {
    c.food -= 15;
    const ch = this.spawn(Kind.Slime, c.x + 6, c.y, 15, 0);
    ch.ref = 0;
    // 分かれた場面の記録（分析用のログだけ。シミュレーションの判断には使わない）
    this.record('settle', { t: this.w.tick, k: Kind.Slime, id: c.id, ev: 'split', n: ch.id, x: Math.round(c.x), y: Math.round(c.y) } as never);
    this.counts[Kind.Slime]++;
  }
  // 食べた分は体になる
  if (c.food > 20 && c.body < 40 && this.step % 20 === c.id % 20) {
    c.food--;
    c.body++;
  }
}

/** スライムの大きさの段階（0 小、1 中、2 大） */
export function slimeSize(this: Ecology, c: Cr): number {
  const m = c.body + c.food;
  return m < 20 ? 0 : m < 45 ? 1 : 2;
}

/** 水と養分の溜まった所からスライムが生まれる（死骸が多いほど生まれやすい）。水たまりか、とても湿った床（SLIME_DAMP 以上）で生まれる */
export function spawnSlimes(this: Ecology): void {
  const n = this.counts[Kind.Slime];
  if (n >= 40 || n > 3 + this.corpses.length) return;
  if (ih(this.step, 1, 53) % 3 !== 0) return;
  const m = this.w.map;
  // 腐ったもの（死骸）の近く（6マス以内）の、湿って養分の溜まった開いた床だけで生まれる。
  // 以前は水たまり（water 30 以上）だけで、水たまりのそばに死骸の無いシード（seed4・seed6 など）では、ほとんど生まれなかった
  const near = new Uint8Array(m.w * m.h);
  for (const d of this.corpses) {
    const cx = Math.floor(d.x / TILE);
    const cy = Math.floor(d.y / TILE);
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const x = cx + dx; const y = cy + dy; if (x >= 0 && y >= 0 && x < m.w && y < m.h) near[y * m.w + x] = 1; }
  }
  const cands: number[] = [];
  for (let k = 0; k < m.w * m.h; k++) if (near[k] && !m.solid[k] && !m.sealed[k] && !m.lava[k] && (this.w.water[k] >= 30 || this.w.moist[k] >= SLIME_DAMP) && this.w.nutr[k] >= 30) cands.push(k);
  if (!cands.length) return;
  const k = cands[ih(this.step, 2, 54) % cands.length];
  this.w.nutr[k] -= 12;
  this.spawn(Kind.Slime, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 12, 0);
}

declare module '../ecology' {
  interface Ecology {
    slime: typeof slime;
    slimeSize: typeof slimeSize;
    spawnSlimes: typeof spawnSlimes;
  }
}

Object.assign(Ecology.prototype, { slime, slimeSize, spawnSlimes });
