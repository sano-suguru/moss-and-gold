/** Ecology のメソッド：強さと戦い、飢えて去ること、傷と戦い（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** 攻める側の勝つ確率は、近くの仲間を含めた強さの比で決まる。負けた側は死ぬことがある */
/** 強さ：冒険者は職業と一行の格で決まる */
export function str(this: Ecology, c: Cr): number {
  if (c.k === Kind.Adventurer) return JOB_STR[c.sp] * TIER_MUL[c.init] * this.rankMul(c) * (c.sp === Job.Thief && c.act === 2 ? 1.6 : 1);
  // スケルトンは生前の装備で強さが決まる。武器を拾ったゴブリンとオークは強くなる
  if (c.k === Kind.Skeleton) return c.init ? JOB_STR[c.sp] * 1.2 : 3;
  if (c.k === Kind.Dwarf) return DWARF_STR[c.sp];
  if ((c.k === Kind.Goblin || c.k === Kind.Orc) && c.party) return STR[c.k] * 1.6;
  // 特別な個体
  if (c.elite === 1) return 12;
  if (c.elite === 2) return 10;
  if (c.elite === 6) return 8;
  if (c.elite === 7) return 3;
  if (c.elite === 8) return STR[Kind.Dragon] * 0.8;
  if (c.elite === 9) return 9;
  if (c.elite === 4) return STR[c.k] * 3;
  if (c.elite === 5) return STR[c.k] * 2.5;
  // ドラゴンは育ち具合で強さが変わる（幼竜、若い竜、成竜）
  if (c.k === Kind.Dragon) return STR[c.k] * [0.25, 0.6, 1][Math.min(2, c.sp)];
  return STR[c.k];
}

/** 縄張りの中に敵が来たら追い払う（戦う） */
export function defend(this: Ecology, c: Cr, hx: number, hy: number, enemies: Kind[]): boolean {
  if (sq(c.x - hx) + sq(c.y - hy) > 12 * TILE * 12 * TILE) return false;
  let foe: Cr | null = null;
  let bd = 3 * TILE * 3 * TILE;
  this.nearby(c.x, c.y, 3, (o) => {
    if (o.dead || o.away || !enemies.includes(o.k) || !this.canSense(c, o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      foe = o;
    }
  });
  if (!foe) return false;
  const f = foe as Cr;
  c.act = 1;
  if (sq(f.x - c.x) + sq(f.y - c.y) < 11 * 11) this.fight(c, f);
  else this.goTo(c, f.x, f.y, SPEC[c.k].speed * 1.2);
  return true;
}

/** 食べ物にありつけないまま長く経った大物は、入口から出ていく */
export function leaveIfStarving(this: Ecology, c: Cr): boolean {
  const s = SPEC[c.k];
  if (c.st !== 9 && c.sinceMeal < s.starve * 0.6) return false;
  c.st = 9;
  c.act = 1;
  const m = this.w.map;
  // 出ていく口：人（ドワーフなど）は正面の入口。野の生き物は、自分の種に合う開いた自然の口のうちいちばん近いもの。
  // 野の生き物に開いた口がなければ、出ていけずに中で飢える
  const people = c.k === Kind.Dwarf || c.k === Kind.Adventurer;
  let ex = people ? m.entrance.x * TILE + 16 : -1;
  let ey = TILE + 8;
  if (!people) {
    const want = c.k === Kind.Basilisk || c.k === Kind.Minotaur ? 1 : c.k === Kind.Lizardman ? 2 : 0;
    let bd = 1e18;
    for (let i = 0; i < m.mouths.length; i++) {
      if (m.mouths[i].kind !== want || !this.mouthOpen(i)) continue;
      const [mx, my] = this.mouthSpot(i);
      const d = sq(mx - c.x) + sq(my - c.y);
      if (d < bd) {
        bd = d;
        ex = mx;
        ey = my;
      }
    }
    if (ex < 0) {
      c.st = c.st === 9 ? 0 : c.st;
      return false;
    }
  }
  if (this.goTo(c, ex, ey, s.speed) || sq(ex - c.x) + sq(ey - c.y) < 30 * 30) {
    if (c.k === Kind.Adventurer) this.heroHome(c, false);
    this.record('exits', { t: this.w.tick, k: c.k, reason: 'starving', x: Math.round(c.x), y: Math.round(c.y) } as never);
    this.w.manaLeaked += c.mana;
    c.mana = 0;
    this.exported += c.body + c.food + c.units;
    if (c.gold > 0) {
      this.goldOut += c.gold;
      c.gold = 0;
    }
    if (c.k === Kind.Dwarf) {
      // 生きて外へ出たドワーフが、ゴーレムの話を伝える
      if (this.hold?.golem) this.dwarfLore |= 1;
      this.log(c.x, c.y, `{k:${Kind.Dwarf}}が住みかを捨てて外へ出ていった`);
    }
    c.body = 0;
    c.food = 0;
    c.units = 0;
    this.w.manaLeaked += c.mana;
    c.mana = 0;
    c.dead = 2;
  }
  return true;
}

export function hunt(this: Ecology, c: Cr, R: number, kinds: Kind[], speed: number): boolean {
  let prey: Cr | null = null;
  let bd = R * TILE * R * TILE;
  const tier = TIER[c.k] ?? 1;
  const me = this.str(c);
  this.nearby(c.x, c.y, R, (o) => {
    if (o.dead || o.away || o.caught || !kinds.includes(o.k) || o.k === Kind.Dragon) return;
    if (o.k === Kind.Bat && o.st !== 0) return;
    // 気づけない相手と、（火を怖がる者にとって）火のそばの獲物は狙わない
    if (!this.canSense(c, o)) return;
    // ゴブリンはコボルトの縄張りの中の獲物を追わない
    if (c.k === Kind.Goblin && this.inKoboldLand(o.x, o.y)) return;
    if (Ecology.FEARS_FIRE.has(c.k) && c.sinceMeal < SPEC[c.k].starve * 0.85 && this.fireNear(o.x, o.y)) return;
    // 知性ある者は勝てない相手を避け、狡猾な者は自分より強い相手には挑まない
    const ts = this.str(o) * (o.hp > 0 ? o.hp / this.maxHp(o) : 1);
    if (tier >= 3 && ts > me * 1.1) return;
    if (tier === 2 && ts > me * 1.6) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      prey = o;
    }
  });
  if (!prey) return false;
  const p = prey as Cr;
  this.markNotice(c, p, '!');
  c.act = 1;
  const d2 = sq(p.x - c.x) + sq(p.y - c.y);
  if (d2 < 11 * 11) {
    if (STR[p.k] * 2 < STR[c.k]) this.eat(c, p);
    else this.fight(c, p);
  } else if (c.k === Kind.Minotaur && d2 > 2 * TILE * 2 * TILE) {
    // 一直線に突進し、壁にぶつかると一瞬よろめく
    const x0 = c.x;
    const y0 = c.y;
    this.moveToward(c, p.x, p.y, speed * 1.8);
    if (Math.abs(c.x - x0) + Math.abs(c.y - y0) < speed * 0.5) c.gait = 14;
  } else if (TIER[c.k] === 2 && d2 > 2 * TILE * 2 * TILE) {
    // 狡猾な種は、仲間がいれば回り込んで別々の方向から近づく
    let allies = 0;
    this.nearby(c.x, c.y, 4, (o) => {
      if (o !== c && !o.dead && o.k === c.k) allies++;
    });
    if (allies) {
      const a = ((c.id * 2.3999) % 6.283) - 3.14;
      const r = Math.min(Math.sqrt(d2) * 0.6, 2.5 * TILE);
      this.goTo(c, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, speed);
    } else this.goTo(c, p.x, p.y, speed);
  } else this.goTo(c, p.x, p.y, speed);
  return true;
}

/** 体力の上限（強さに比例） */
export function maxHp(this: Ecology, c: Cr): number {
  return Math.round(4 + this.str(c) * 5);
}

export function bleed(this: Ecology, c: Cr, n: number): void {
  const col = BLOOD[c.k];
  if (col < 0) return;
  for (let i = 0; i < n; i++) {
    this.blood.push({ x: Math.round(c.x + ((ih(c.id, this.step, 160 + i) % 9) - 4)), y: Math.round(c.y + ((ih(c.id, this.step, 170 + i) % 5) - 1)), t: this.w.tick, c: col, v: ih(c.id, this.step, 180 + i) & 3 });
  }
  if (this.blood.length > 400) this.blood.splice(0, this.blood.length - 400);
}

/** 一打ち：強さと仲間の数で傷を与える。倒せば true */
export function strike(this: Ecology, a: Cr, d: Cr, mul = 1): boolean {
  const allies = (c: Cr) => {
    let n = 0;
    this.nearby(c.x, c.y, 2, (o) => {
      if (o !== c && !o.dead && o.k === c.k && sq(o.x - c.x) + sq(o.y - c.y) < 40 * 40) n++;
    });
    return Math.min(3, n);
  };
  if (d.hp <= 0) d.hp = this.maxHp(d);
  const sa = this.str(a) * (1 + 0.4 * allies(a));
  const dmg = sa * (1.2 + (ih(a.id, d.id ^ this.step, 161) % 1000) / 1000 * 1.2) * mul;
  d.hp -= dmg;
  if (d.k === Kind.Adventurer && d.hp > 0) this.heroHurt(d);
  d.hitAt = this.w.tick;
  d.foe = a.id;
  d.sleep = 0;
  // 焚き火で休む冒険者が打たれた：手強い敵なら一行が飛び起きる（src/eco/night.ts）
  if (d.k === Kind.Adventurer) this.campHit(d, a);
  this.fxHits.push({ t: this.w.tick, x: d.x, y: d.y, ax: a.x, ay: a.y, id: d.id });
  if (this.fxHits.length > 120) this.fxHits.splice(0, 40);
  this.pushAttackFx(a, d, dmg > this.maxHp(d) * 0.4, d.hp <= 0);
  this.raiseAlarm(d, a);
  this.bleed(d, 1);
  // 焚き火のそばの小物との小競り合い（コウモリに血を吸われて払うなど）は、一行の皆を起こすほどの音を立てない
  if (!this.campPetty(a, d)) this.noise(d.x, d.y, 9);
  return d.hp <= 0;
}

/**
 * 戦い：打ち合い。攻める側が一打ち、守る側が打ち返す。体力が尽きた方が倒れる。
 * 勝てば（攻める側が）食べるか倒すかする。打ち合いは数回で決まる（通常速度で1〜2秒）
 */
export function fight(this: Ecology, a: Cr, d: Cr): boolean {
  a.act = 2;
  a.actT = 0;
  if (a.hp <= 0) a.hp = this.maxHp(a);
  if (this.strike(a, d)) {
    if (a.k === Kind.Skeleton || a.k === Kind.Lich || a.k === Kind.Dwarf || a.k === Kind.Golem || a.k === Kind.Gargoyle || (a.k === Kind.Adventurer && d.k !== Kind.Rat)) this.die(d, 'fight', a.k);
    else this.eat(a, d);
    return true;
  }
  // 打ち返し（逃げている者は打ち返さない）
  if (d.flee <= 0 && this.str(d) > 0) {
    d.act = 2;
    d.actT = 0;
    if (this.strike(d, a, 0.8)) {
      this.die(a, 'fight', d.k);
      return false;
    }
  }
  return false;
}

/** 体力の回復と、逃げる判断。true なら今は逃げている（ほかの行いをしない） */
export function woundsAndFlight(this: Ecology, c: Cr): boolean {
  const mx = this.maxHp(c);
  if (c.hp <= 0 || c.hp > mx) c.hp = mx;
  // 回復：ゆっくり。住みかや巣、食べたばかりなら早く。トロールは見る間にふさがる（炎の傷は除く）。骨と石は自分では治らない
  if (c.hp < mx && c.k !== Kind.Skeleton && c.k !== Kind.Golem && c.k !== Kind.Gargoyle) {
    const home = sq(c.hx - c.x) + sq(c.hy - c.y) < 3 * TILE * 3 * TILE && (c.hx || c.hy);
    const every = c.k === Kind.Troll ? 8 : c.sleep > 0 ? 12 : home || c.sinceMeal < 200 ? 20 : 60;
    if (this.step % every === c.id % every) {
      const k = this.tileOf(c.x, c.y);
      const burnt = k >= 0 && this.w.ash[k] > 0 && c.k === Kind.Troll;
      if (!burnt) c.hp = Math.min(mx, c.hp + Math.max(1, mx / 40));
    }
  }
  // 深手の者は血の跡を点々と残す
  if (c.hp < mx * 0.5 && c.act === 1 && this.step % 18 === c.id % 18) this.bleed(c, 1);
  // 逃げる判断
  const tier = TIER[c.k] ?? 1;
  if (c.flee > 0) c.flee--;
  else if (tier > 0 && c.hp < mx * FLEE_AT[tier] && this.w.tick - c.hitAt < 60 && c.k !== Kind.Adventurer && c.k !== Kind.Dwarf) c.flee = 120 + (ih(c.id, this.step, 162) % 80);
  if (c.flee <= 0) return false;
  const f = this.byId.get(c.foe);
  c.act = 1;
  const sp = SPEC[c.k].speed * 1.2;
  // コボルトは、追っ手がすぐそば（6マス）にいるあいだは住処へ向かわず、まず追っ手から離れる（追っ手の脇をすり抜けて帰ろうとしない）
  const closeFoe = c.k === Kind.Kobold && f && !f.dead && sq(f.x - c.x) + sq(f.y - c.y) < 6 * TILE * 6 * TILE;
  if ((c.hx || c.hy) && !closeFoe) {
    // 巣や住みかへ逃げ帰る
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 20 * 20) {
      this.goTo(c, c.hx, c.hy, sp);
      return true;
    }
  }
  if (f && !f.dead) {
    const dx = c.x - f.x;
    const dy = c.y - f.y;
    const L = Math.sqrt(dx * dx + dy * dy) || 1;
    this.tryMove(c, (dx / L) * sp, (dy / L) * sp);
  } else c.flee = 0;
  return true;
}

/** 深手を負った者は足を引きずって遅くなる */
export function limp(this: Ecology, c: Cr): number {
  if (c.hp <= 0) return 1;
  const r = c.hp / this.maxHp(c);
  return r < 0.35 ? 0.6 : 1;
}

declare module '../ecology' {
  interface Ecology {
    str: typeof str;
    defend: typeof defend;
    leaveIfStarving: typeof leaveIfStarving;
    hunt: typeof hunt;
    maxHp: typeof maxHp;
    bleed: typeof bleed;
    strike: typeof strike;
    fight: typeof fight;
    woundsAndFlight: typeof woundsAndFlight;
    limp: typeof limp;
  }
}

Object.assign(Ecology.prototype, { str, defend, leaveIfStarving, hunt, maxHp, bleed, strike, fight, woundsAndFlight, limp });
