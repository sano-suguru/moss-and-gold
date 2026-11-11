/** Ecology のメソッド：宝（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Note, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** 金貨をその場に落とす（近くに山があればそこに積む）。n は情報パネルに出すいきさつ（落とした者。判断には使わない） */
export function dropGold(this: Ecology, x: number, y: number, g: number, n?: Note): void {
  for (const p of this.piles) {
    if (sq(p.x - x) + sq(p.y - y) < 20 * 20) {
      p.gold += g;
      if (n) this.note(p.id, n);
      return;
    }
  }
  const k = this.tileOf(x, y);
  const m = this.w.map;
  if (n) this.note(this.nextId, n);
  this.piles.push({ id: this.nextId++, x: k >= 0 ? (k % m.w) * TILE + 8 : Math.round(x), y: k >= 0 ? Math.floor(k / m.w) * TILE + 8 : Math.round(y), gold: g, age: 0 });
}

/** 暗闇に長く置かれた宝の山から、その一部がミミックになる */
export function updateTreasure(this: Ecology, day: number): void {
  const m = this.w.map;
  for (const p of this.piles) {
    p.age += 50;
    const k = this.tileOf(p.x, p.y);
    if (p.gold < 30 || p.age < 6000 || k < 0 || this.lit(k, day) > 0.1 || this.counts[Kind.Mimic] >= 3) continue;
    // 外とつながる口や正面の入口のそばには潜まない（入ってきたばかりの者の罠にならないように）
    const px = p.x / TILE;
    const py = p.y / TILE;
    if (Math.abs(px - m.entrance.x) + py < 16 || m.mouths.some((mo) => Math.abs(mo.x - px) + Math.abs(mo.y - py) < 16)) continue;
    if (ih(p.id, this.step, 120) % 60 !== 0) continue;
    // 山の隣の空いた床
    let spot = -1;
    for (const q of [k + 1, k - 1, k + m.w, k - m.w, k + m.w + 1, k + m.w - 1]) if (q >= 0 && q < m.solid.length && !m.solid[q] && !m.lava[q] && !this.statueAt.has(q)) spot = q;
    if (spot < 0 || this.manaAround(spot) < 8) continue;
    // 体は、まわり（7×7マス）の土の養分から作る
    const body = this.takeNutrients(spot, 10, 3);
    if (body < 10) continue;
    this.originNext = 'mana';
    const c = this.spawn(Kind.Mimic, (spot % m.w) * TILE + 8, Math.floor(spot / m.w) * TILE + 8, body, 0);
    this.takeMana(c, spot, 50);
    // 宝の山から取り込むのは、山にある分まで（40枚まで）
    c.gold = Math.min(40, p.gold);
    p.gold -= c.gold;
    c.dir = 0;
    c.hx = c.x;
    c.hy = c.y;
    this.counts[Kind.Mimic]++;
  }
  this.piles = this.piles.filter((o) => o.gold > 0);
}

declare module '../ecology' {
  interface Ecology {
    dropGold: typeof dropGold;
    updateTreasure: typeof updateTreasure;
  }
}

Object.assign(Ecology.prototype, { dropGold, updateTreasure });
