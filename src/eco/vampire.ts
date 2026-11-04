/** Ecology のメソッド：ヴァンパイア（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function vampire(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Vampire];
  if (this.leaveIfStarving(c)) return;
  const m = this.w.map;
  const k = this.tileOf(c.x, c.y);
  // 近くのコウモリを従える
  if (this.step % 25 === c.id % 25) {
    this.nearby(c.x, c.y, 12, (o) => {
      if (o.k === Kind.Bat && !o.dead && !o.away && o.ref2 === 0) o.ref2 = c.id;
    });
  }
  if (c.act === 2 && c.actT < 4) return;
  // 光を嫌う：明るい所にいたら暗い方へ
  const lightAt = (q: number) => (q < 0 ? 0 : this.w.lightBase[q] * day + this.w.mossGlow[q] * 1500 + this.w.lavaGlow[q] * 1500);
  if (lightAt(k) > 60) {
    let best = k;
    for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (q >= 0 && q < m.solid.length && !m.solid[q] && lightAt(q) < lightAt(best)) best = q;
    c.act = 1;
    this.moveToward(c, (best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, s.speed * 1.3);
    return;
  }
  if (day > 0.05) {
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 12 * 12) {
      c.act = 1;
      const x0 = c.x;
      const y0 = c.y;
      this.goTo(c, c.hx, c.hy, s.speed);
      // 帰り道の次の一歩が明るい所なら、進まずに暗がりで日が落ちるのを待つ
      // （以前は明るい所へ一歩出ては光を嫌って戻り、その場で行ったり来たりしていた）
      if (lightAt(this.tileOf(c.x, c.y)) > 60) {
        c.x = x0;
        c.y = y0;
        c.act = 0;
      }
    } else c.act = 0;
    return;
  }
  // 夜は暗がりを歩いて、温かい血の生き物を狩る
  if (c.food < s.cap * 0.7) {
    let prey: Cr | null = null;
    let bd = 10 * TILE * 10 * TILE;
    this.nearby(c.x, c.y, 10, (o) => {
      if (o.dead || o.away || ![Kind.Rat, Kind.Goblin, Kind.Kobold, Kind.Lizardman, Kind.Adventurer].includes(o.k)) return;
      if (lightAt(this.tileOf(o.x, o.y)) > 60) return;
      // 焚き火で眠っている冒険者は、近くにいるものとして好んで狙う（src/eco/night.ts）
      const d = (sq(o.x - c.x) + sq(o.y - c.y)) * (this.campSleeper(o) ? 0.25 : 1);
      if (d < bd) {
        bd = d;
        prey = o;
      }
    });
    if (prey) {
      const p = prey as Cr;
      c.act = 1;
      if (sq(p.x - c.x) + sq(p.y - c.y) < 11 * 11) {
        // 一口では食べず、打ち合って仕留める（src/eco/combat.ts の hunt と同じ）
        const won = this.fight(c, p);
        // 獲物の分け前を、従うコウモリに与える
        if (won) {
          this.nearby(c.x, c.y, 6, (b) => {
            if (b.k !== Kind.Bat || b.dead || b.ref2 !== c.id || c.food <= 20) return;
            const t = Math.min(6, SPEC[Kind.Bat].cap - b.food, c.food - 20);
            if (t > 0) {
              b.food += t;
              c.food -= t;
              b.sinceMeal = 0;
            }
          });
        }
      } else {
        const nk = this.tileOf(p.x, p.y);
        if (lightAt(nk) <= 60) this.goTo(c, p.x, p.y, s.speed * 1.2);
      }
      return;
    }
  }
  c.act = 1;
  const j = DIR16[ih(c.id, this.step >> 5, 114) & 15];
  const nk = this.tileOf(c.x + j[0] * 10, c.y + j[1] * 10);
  if (lightAt(nk) <= 60) this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
  else c.act = 0;
}

declare module '../ecology' {
  interface Ecology {
    vampire: typeof vampire;
  }
}

Object.assign(Ecology.prototype, { vampire });
