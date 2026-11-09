/** Ecology のメソッド：オーク（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';
import { SKILL_ORC_ROAR } from './orcskill';

export function pickLair(this: Ecology, near?: { x: number; y: number }): number {
  const m = this.w.map;
  const targets = [...this.camps.filter((o) => o.kind === 0), ...this.warrens];
  if (!near && !targets.length) return -1;
  const t = near ?? targets[ih(this.step, 1, 95) % targets.length];
  for (let i = 0; i < 80; i++) {
    const h = ih(this.step, i, 96);
    const x = Math.floor(t.x / TILE) + ((h & 63) % 41) - 20;
    const y = Math.floor(t.y / TILE) + (((h >>> 6) & 63) % 41) - 20;
    if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
    const k = y * m.w + x;
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 20 || this.inLair(x * TILE + 8, y * TILE + 8)) continue;
    if (Math.abs(x - t.x / TILE) + Math.abs(y - t.y / TILE) < 12) continue;
    if ((ih(this.step, i, 209) % 100) / 100 < this.presenceAt(x * TILE + 8, y * TILE + 8) * 1.3) continue;
    return k;
  }
  return -1;
}

export function orc(this: Ecology, c: Cr): void {
  if (!c.hungry && c.act !== 2 && c.st < 5 && this.scavenge(c)) return;
  const s = SPEC[Kind.Orc];
  // 貢ぎ物の取り立て（st 5：従う集落へ向かう、st 6：袋を担いで縄張りへ帰る）。飢えて去るより先に
  if (c.st === 5 || c.st === 6) {
    if (c.act === 2 && c.actT < 4) return;
    this.collectTribute(c);
    return;
  }
  // 腹を空かせたら（腹の半分を切ったら）、従う集落へ取り立てに行く（七巡目：決まった間隔ではなく、腹に合わせて）。飢えて去る途中（st 9）でも行く
  if ((c.st === 0 || c.st === 9) && this.step % 10 === c.id % 10 && this.goCollect(c)) return;
  if (this.leaveIfStarving(c)) return;
  if (c.act === 2 && c.actT < 4) return;
  if (c.hungry) {
    if (this.hunt(c, 10, HUNT_ORC, s.speed * 1.2)) return;
    // 近くのコボルトの住処を襲いに行く（ゴブリンの集落は襲わない：従える相手）
    const targets = [...this.warrens.filter((o) => o.id >= 0)];
    let best: { x: number; y: number } | null = null;
    let bd = 40 * TILE * 40 * TILE;
    for (const t of targets) {
      const d = sq(t.x - c.x) + sq(t.y - c.y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    if (best) {
      c.act = 1;
      this.goTo(c, best.x, best.y, s.speed);
      return;
    }
  }
  // 用心棒：従う集落のそば（8マス）に来たコボルトを追い払う（縄張りから25マスまで）
  if (this.guardVassals(c)) return;
  if (sq(c.hx - c.x) + sq(c.hy - c.y) > 5 * TILE * 5 * TILE) {
    c.act = 1;
    this.goTo(c, c.hx, c.hy, s.speed);
  } else {
    // 住みかのそばでは、たいてい立ち止まり、ときどき数歩うろつく。
    // （以前は80回のうち30回、ふつうの速さの0.4倍で歩き、脚を動かしながら3秒で半タイルも進まず、群れごと足踏みして見えていた）
    c.act = c.actT % 80 < 60 ? 0 : 1;
    if (c.act === 1) {
      const j = DIR16[ih(c.id, this.step >> 4, 97) & 15];
      this.tryMove(c, j[0] * s.speed * 0.8, j[1] * s.speed * 0.8);
    }
  }
}

/**
 * オークの見極め（にらみ合い）：冒険者の一行に気づき（7マス、見通しが利く）、一行の強さ（英雄のいる一行はそれだけ強く見積もる）が
 * 自分たち（6マスの内のオーク）よりはっきり上（1.5倍）なら、すぐには襲わずにその場で唸って武器を打ち鳴らす（st 20：一行の方を向いて
 * 武器を振る動きを3回、ORC_BLUFF 回の更新）。そのあと、一行が前に出れば一行が打ちかかり、一行がひるめばオークが襲いかかる（st 22）。
 * どちらになるかは強さの差と乱数で決まる。勝ち目があれば今までどおり。
 * （st 21 の縄張りの奥へ退く動きは、以前のセーブから続く分だけ残している。威嚇しているオークを、目標でない一行は追わない（orcYields））。
 * 状態は st と ref（一行）と lureAt（始めた step 番号）。step.ts の判断のはじめ（潜む・縄張り・狩りより先）に呼ぶ
 */
export const ORC_BLUFF = 24;
const ORC_WITHDRAW = 600;
export function orcWary(this: Ecology, c: Cr): boolean {
  const s = SPEC[Kind.Orc];
  // にらみ合いのあと、ひるんだ一行へ襲いかかる（st 22）：いちばん近い者へ向かって打ちかかる。一行がいなくなるか、生き物の更新400回たったら、ふだんに戻る
  if (c.st === 22) {
    const p = this.parties.find((q) => q.id === c.ref);
    let near: Cr | null = null;
    let bd = 1e18;
    if (p)
      for (const id of p.members) {
        const o = this.byId.get(id);
        if (!o || o.dead || o.away) continue;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          near = o;
        }
      }
    if (!near || bd > 12 * TILE * 12 * TILE || this.step - c.lureAt > 400 || c.flee > 0) {
      c.st = 0;
      c.ref = 0;
      return false;
    }
    const n = near as Cr;
    this.setDir(c, n.x - c.x, n.y - c.y);
    if (bd < 12 * 12) this.fight(c, n);
    else {
      c.act = 1;
      this.goTo(c, n.x, n.y, s.speed * 1.2);
    }
    return true;
  }
  if (c.st === 20 || c.st === 21) {
    const p = this.parties.find((q) => q.id === c.ref);
    // 一行に打たれたら、打ち返す（今までどおり）
    const struck = this.w.tick - c.hitAt < 150 && !!p && p.members.includes(c.foe);
    if (!p || struck) {
      c.st = 0;
      c.ref = 0;
      return false;
    }
    let near: Cr | null = null;
    let bd = 1e18;
    for (const id of p.members) {
      const o = this.byId.get(id);
      if (!o || o.dead || o.away) continue;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        near = o;
      }
    }
    const el = this.step - c.lureAt;
    if (c.st === 20) {
      // 唸って武器を打ち鳴らす：一行の方を向き、武器を振る動きを生き物の更新8回ごとに
      if (near) c.dir = Math.abs(near.x - c.x) > Math.abs(near.y - c.y) ? (near.x > c.x ? 2 : 3) : near.y > c.y ? 0 : 1;
      // 威嚇の間は武器を振る動きを続け（生き物の更新8回ごとに振り直す）、唸り声を上げる。頭の上の「！」は描画（creatureView）が st 20 を見て出す
      c.act = 2;
      if (el % 8 === 0) {
        c.actT = 0;
        this.noise(c.x, c.y, 7);
      }
      if (el >= ORC_BLUFF) {
        // にらみ合いの決着：一行が前に出れば一行が打ちかかり、一行がひるめばオークが襲いかかる。どちらになるかは強さの差と乱数で決まる
        // （以前は威嚇したあと縄張りの奥へ退き、一行も追わなかったので、出会っても戦わずに別れていた）
        const might = this.partyMight(p);
        const mine = Math.max(1, this.str(c));
        const advance = (ih(c.id, p.id ^ this.step, 402) % 100) < Math.max(20, Math.min(80, 50 + ((might - mine) / mine) * 25));
        c.st = advance ? 0 : 22;
        c.lureAt = this.step;
        if (advance) {
          p.engage = c.id;
          p.engageN = p.members.filter((id) => !this.byId.get(id)?.dead).length;
        }
        this.record('settle', { t: this.w.tick, k: Kind.Orc, ev: 'orcClash', id: c.id, how: advance ? 1 : 2, n: p.id, x: Math.round(c.x), y: Math.round(c.y) } as never);
        // 決着の時に吠える：従う集落のゴブリンを呼び、一行の後衛を怖ませる（src/eco/orcskill.ts の雄叫び。ref は一行のまま残す）
        if (!c.party && this.skillCanStart(c, SKILL_ORC_ROAR)) {
          this.orcStartRoar(c);
          return true;
        }
        return advance ? false : true;
      }
      return true;
    }
    // 退く：縄張りの奥（住みかの印）へ。着いて一行が10マスより遠ければ、ふだんに戻る
    const far = !near || bd > 10 * TILE * 10 * TILE;
    const home = c.hx || c.hy;
    if (el > ORC_WITHDRAW || (far && (!home || sq(c.hx - c.x) + sq(c.hy - c.y) < 3 * TILE * 3 * TILE))) {
      c.st = 0;
      c.ref = 0;
      return false;
    }
    c.act = 1;
    // 一行が近いうちは、まず一行から離れる方（tx, ty）へ下がる。離れたら縄張りの奥（住みかの印）へ
    const back = !far && bd < 9 * TILE * 9 * TILE && sq(c.tx - c.x) + sq(c.ty - c.y) > TILE * TILE;
    if (back) this.goTo(c, c.tx, c.ty, s.speed * 1.1);
    else if (home && sq(c.hx - c.x) + sq(c.hy - c.y) >= 2 * TILE * 2 * TILE && (far || bd >= 9 * TILE * 9 * TILE)) this.goTo(c, c.hx, c.hy, s.speed * 1.1);
    else if (near) {
      const dx = c.x - near.x;
      const dy = c.y - near.y;
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      this.tryMove(c, (dx / l) * s.speed, (dy / l) * s.speed);
    } else c.act = 0;
    return true;
  }
  // 担いだ貢ぎ物を運ぶ途中、戦いの中、逃げている間は見極めない
  if (c.st === 6 || c.flee > 0 || (c.act === 2 && this.w.tick - c.hitAt < 150) || this.step % 4 !== c.id % 4 || !this.parties.length) return false;
  const m = this.w.map;
  let seen: Cr | null = null;
  let bd = 7 * TILE * 7 * TILE;
  for (const p of this.parties)
    for (const id of p.members) {
      const o = this.byId.get(id);
      if (!o || o.dead || o.away) continue;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d >= bd || !this.canSense(c, o) || !lineOfSight(m, c.x, c.y, o.x, o.y)) continue;
      bd = d;
      seen = o;
    }
  if (!seen) return false;
  const p = this.parties.find((q) => q.id === (seen as Cr).party);
  if (!p) return false;
  // 眠る一行に忍び寄っている間は唸らない（起こされた一行には、ふだんどおり見極める。src/eco/night.ts）
  if (c.lure && (p.camp ?? -1) >= 0 && !this.campAwake(p) && p.members.includes(c.lure)) return false;
  // 一行に打たれたばかりなら、見極めずに打ち返す
  if (this.w.tick - c.hitAt < 150 && p.members.includes(c.foe)) return false;
  // 焚き火で眠る一行は、起きている者の分だけの強さに見える（src/eco/night.ts の campMight）
  const theirs = this.campMight(p);
  let ours = 0;
  this.nearby(c.x, c.y, 6, (o) => {
    if (o.dead || o.away || o.k !== Kind.Orc || sq(o.x - c.x) + sq(o.y - c.y) > 6 * TILE * 6 * TILE) return;
    ours += this.str(o) * (o.hp > 0 ? o.hp / this.maxHp(o) : 1);
  });
  if (theirs <= ours * 1.5) return false;
  c.st = 20;
  c.ref = p.id;
  c.lure = 0;
  c.lureAt = this.step;
  c.act = 2;
  c.actT = 0;
  this.markNotice(c, seen as Cr, '!');
  this.noise(c.x, c.y, 7);
  this.record('settle', { t: this.w.tick, k: Kind.Orc, id: p.id, ev: 'bluff', n: c.id, how: Math.round((theirs / Math.max(1, ours)) * 10), x: Math.round(c.x), y: Math.round(c.y) } as never);
  return true;
}

/** 一行の強さの見積もり（オークの見極め）：体力を加味した強さの和に、英雄一人ごとに2割を足す */
export function partyMight(this: Ecology, p: Party): number {
  let heroes = 0;
  for (const id of p.members) {
    const o = this.byId.get(id);
    if (!o || o.dead) continue;
    const h = this.heroOf(o);
    if (h && h.rank >= 3) heroes++;
  }
  return this.partyStr(p) * (1 + 0.2 * heroes);
}

/** 威嚇して退いているオークを、一行は追わない（どの一行も。大物退治の目標がオークのときは除く） */
export function orcYields(this: Ecology, p: Party, o: Cr): boolean {
  if (o.k !== Kind.Orc || (o.st !== 20 && o.st !== 21)) return false;
  if (p.aim === 3 && !p.aimEnd && this.rumors.beastKind === Kind.Orc) return false;
  return true;
}

/** オーク c の縄張りに従う集落 */
export function vassalsOf(this: Ecology, c: Cr): Camp[] {
  if (!c.hx && !c.hy) return [];
  return this.camps.filter((o) => o.id >= 0 && o.kind === 0 && o.lx === c.hx && o.ly === c.hy);
}

/** 用心棒：従う集落のそばに来たコボルトを追い払う。true なら今はそのために動いている */
export function guardVassals(this: Ecology, c: Cr): boolean {
  if (c.hungry || c.flee > 0) return false;
  for (const cp of this.vassalsOf(c)) {
    if (sq(cp.x - c.x) + sq(cp.y - c.y) > 25 * TILE * 25 * TILE) continue;
    let foe: Cr | null = null;
    let bd = 8 * TILE * 8 * TILE;
    this.nearby(cp.x, cp.y, 8, (o) => {
      if (o.dead || o.away || o.k !== Kind.Kobold) return;
      const d = sq(o.x - cp.x) + sq(o.y - cp.y);
      if (d < bd) {
        bd = d;
        foe = o;
      }
    });
    if (!foe) continue;
    const f = foe as Cr;
    c.act = 1;
    if (sq(f.x - c.x) + sq(f.y - c.y) < 11 * 11) this.fight(c, f);
    else this.goTo(c, f.x, f.y, SPEC[c.k].speed * 1.2);
    return true;
  }
  return false;
}

/** 貢ぎ物の取り立て：従う集落へ行き、要る分（蓄えの半分まで）を袋に詰めて（units）縄張りへ持ち帰り、食べる */
export function collectTribute(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Orc];
  c.act = 1;
  if (c.st === 5) {
    const cp = this.camps.find((o) => o.id === c.ref && o.id >= 0);
    if (!cp || cp.lx !== c.hx || cp.ly !== c.hy) {
      c.st = 0;
      c.ref = 0;
      return;
    }
    if (sq(cp.x - c.x) + sq(cp.y - c.y) < 1.5 * TILE * 1.5 * TILE || this.goTo(c, cp.x, cp.y, s.speed)) {
      // 取り立てる量：そのオークが腹を満たすのに要る分を目安に、蓄えの半分まで（七巡目。六巡目は蓄えの3割で、1回あたり約50だった）
      // ただし集落の取り分（蓄えの目安の半分＝1匹あたり15）は残す
      const keep = Math.floor(this.campStoreGoal(cp) / 2);
      const amt = Math.max(0, Math.min(s.cap - c.food, Math.floor((cp.store ?? 0) / 2), (cp.store ?? 0) - keep));
      if (amt <= 0) {
        // 着いたら蓄えが空だった（またはもう腹が満ちていた）：取り立てずに戻る
        c.st = 0;
        c.ref = 0;
        return;
      }
      cp.store = (cp.store ?? 0) - amt;
      c.units += amt;
      c.st = 6;
      c.ref = 0;
      c.act = 2;
      c.actT = 0;
      this.record('settle', { t: this.w.tick, k: Kind.Orc, id: cp.id, ev: 'tribute', n: amt, x: Math.round(cp.x), y: Math.round(cp.y) } as never);
    }
    return;
  }
  // 袋を担いで縄張りへ帰り、食べる（食べきれない分は縄張りの土へ）
  if (sq(c.hx - c.x) + sq(c.hy - c.y) < 2 * TILE * 2 * TILE || this.goTo(c, c.hx, c.hy, s.speed)) {
    const t = Math.min(c.units, s.cap - c.food);
    c.food += t;
    c.units -= t;
    if (t > 0) c.sinceMeal = 0;
    if (c.units > 0) this.deposit(c.x, c.y, c.units);
    c.units = 0;
    c.st = 0;
    c.act = 2;
    c.actT = 0;
  }
}

/**
 * 従う集落：オークの縄張り（寝床）から20マス以内のゴブリンの集落は、いちばん近い縄張りのオークに従う。
 * そのオークは、腹を空かせたら取り立てに来る（goCollect。同じ集落へはゲーム内の1/3日あける）
 */
export function updateVassals(this: Ecology): void {
  for (const cp of this.camps) {
    if (cp.id < 0 || cp.kind !== 0) continue;
    let lx = 0;
    let ly = 0;
    let bd = 20 * TILE * 20 * TILE;
    for (const o of this.list) {
      if (o.k !== Kind.Orc || o.dead || o.away || (!o.hx && !o.hy)) continue;
      const d = sq(o.hx - cp.x) + sq(o.hy - cp.y);
      if (d < bd || (d === bd && (o.hx < lx || (o.hx === lx && o.hy < ly)))) {
        bd = d;
        lx = o.hx;
        ly = o.hy;
      }
    }
    if (lx !== (cp.lx ?? 0) || ly !== (cp.ly ?? 0)) {
      cp.lx = lx;
      cp.ly = ly;
      if (lx || ly) {
        cp.tribT = this.w.tick + Math.floor(DAY_TICKS_ECO / 3);
        this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'vassal', x: Math.round(cp.x), y: Math.round(cp.y) } as never);
        this.log(cp.x, cp.y, `{k:${Kind.Goblin}}の集落が、近くに縄張りを持つ{k:${Kind.Orc}}に従った`);
      }
    }
  }
}

/**
 * 腹を空かせたオーク c を、従う集落のうち、取り立てからゲーム内の1/3日たち蓄えのあるいちばん近い所へ送る（七巡目）。
 * 送ったら true（同じ集落へは tribT まで行かない）
 */
export function goCollect(this: Ecology, c: Cr): boolean {
  const s = SPEC[Kind.Orc];
  if (c.food >= s.cap * 0.5 || c.flee > 0 || c.units > 0) return false;
  let best: Camp | null = null;
  let bd = 1e18;
  for (const cp of this.vassalsOf(c)) {
    if (this.w.tick < (cp.tribT ?? 0) || (cp.store ?? 0) < 10 + Math.floor(this.campStoreGoal(cp) / 2)) continue;
    const d = sq(cp.x - c.x) + sq(cp.y - c.y);
    if (d < bd) {
      bd = d;
      best = cp;
    }
  }
  if (!best) return false;
  c.st = 5;
  c.ref = best.id;
  best.tribT = this.w.tick + Math.floor(DAY_TICKS_ECO / 3);
  return true;
}

/**
 * オークが来られる口（七巡目）：開いた地表の横穴から歩いて ORC_REACH マス以内に、まだ誰にも従っていないゴブリンの集落があるか、
 * 獲物（大ネズミ・大トカゲ・コボルト。いるオーク1匹あたり4匹を差し引く）が ORC_MIN_PREY 以上いれば 1
 */
export function checkOrcMouths(this: Ecology): void {
  const m = this.w.map;
  this.orcMouthOk = m.mouths.map((mo, i) => {
    if (mo.kind !== 0 || !this.mouthOpen(i)) return 0;
    const d = this.walkDist(this.tileOf(...this.mouthSpot(i)), Ecology.ORC_REACH);
    if (this.camps.some((o) => o.id >= 0 && o.kind === 0 && !(o.lx || o.ly) && d[this.tileOf(o.x, o.y)] >= 0)) return 1;
    // 獲物は、オークが実際に食べてゆける大ネズミ・大トカゲ・コボルト（アリ、冒険者、ドワーフは数えない）。すでにいるオーク1匹あたり4匹を差し引く
    let prey = 0;
    let orcs = 0;
    for (const o of this.list) {
      if (o.dead || o.away || d[this.tileOf(o.x, o.y)] < 0) continue;
      if (o.k === Kind.Rat || o.k === Kind.Lizard || o.k === Kind.Kobold) prey++;
      else if (o.k === Kind.Orc) orcs++;
    }
    return prey - 4 * orcs >= Ecology.ORC_MIN_PREY ? 1 : 0;
  });
}

/** 口 door から歩いて行ける、まだ従っていないゴブリンの集落（なければ歩いて行ける集落か住処。なければ null）：来たオークが縄張りを持つ目当て */
export function orcTargetFrom(this: Ecology, door: number): { x: number; y: number } | null {
  if (door < 0) return null;
  const d = this.walkDist(this.tileOf(...this.mouthSpot(door)), Ecology.ORC_REACH);
  const ok = (o: { x: number; y: number }) => d[this.tileOf(o.x, o.y)] >= 0;
  const free = this.camps.filter((o) => o.id >= 0 && o.kind === 0 && !(o.lx || o.ly) && ok(o));
  if (free.length) return free[ih(this.step, 3, 95) % free.length];
  const any = [...this.camps.filter((o) => o.id >= 0 && o.kind === 0 && ok(o)), ...this.warrens.filter((o) => o.id >= 0 && ok(o))];
  if (any.length) return any[ih(this.step, 4, 95) % any.length];
  return null;
}

declare module '../ecology' {
  interface Ecology {
    pickLair: typeof pickLair;
    orc: typeof orc;
    vassalsOf: typeof vassalsOf;
    guardVassals: typeof guardVassals;
    collectTribute: typeof collectTribute;
    updateVassals: typeof updateVassals;
    goCollect: typeof goCollect;
    checkOrcMouths: typeof checkOrcMouths;
    orcTargetFrom: typeof orcTargetFrom;
    orcWary: typeof orcWary;
    partyMight: typeof partyMight;
    orcYields: typeof orcYields;
  }
}

Object.assign(Ecology.prototype, { pickLair, orc, vassalsOf, guardVassals, collectTribute, updateVassals, goCollect, checkOrcMouths, orcTargetFrom, orcWary, partyMight, orcYields });
