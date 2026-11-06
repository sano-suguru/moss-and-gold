/** Ecology のメソッド：死の気配（ゴーストが現れる）、ゾンビ、ゴースト、スケルトンとリッチ（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function addDeath(this: Ecology, x: number, y: number, k: number = -1): void {
  // はかない種（ウィスプ、スライム）の死は、死者の多さに数えない
  if (k === Kind.Wisp || k === Kind.Slime) return;
  const cx = Math.min(23, Math.max(0, Math.floor(x / (TILE * 8))));
  const cy = Math.min(17, Math.max(0, Math.floor(y / (TILE * 8))));
  this.deathMap[cy * 24 + cx] += 100;
  this.graveMap[cy * 24 + cx] += 100;
  if (k === Kind.Adventurer) this.advGrave[cy * 24 + cx] += 100;
}

export function zombie(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Zombie];
  // 歩きながら腐り、養分を撒き散らす。体が尽きると崩れて骨になる
  if (this.step % 8 === c.id % 8 && c.body > 0) {
    c.body--;
    this.deposit(c.x, c.y, 1);
  }
  if (c.body <= Math.max(2, Math.floor(c.init * 0.3))) {
    c.k = c.sp;
    c.units = c.body;
    c.body = 0;
    c.dead = 1;
    c.act = 3;
    c.actT = 900;
    c.ref = 0;
    return;
  }
  // 近くの小さな生き物に噛みつく
  let prey: Cr | null = null;
  let bd = 40 * 40;
  this.nearby(c.x, c.y, 2, (o) => {
    if (o.dead || o.away || o.caught || (o.k !== Kind.Rat && !(o.k === Kind.Bat && o.st === 0))) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      prey = o;
    }
  });
  if (prey) {
    const p = prey as Cr;
    c.act = 1;
    if (this.moveToward(c, p.x, p.y, s.speed * 1.3) || sq(p.x - c.x) + sq(p.y - c.y) < 8 * 8) {
      this.die(p, 'killed', c.k);
      c.act = 2;
      c.actT = 0;
    }
    return;
  }
  if (c.act === 2 && c.actT < 4) return;
  c.act = 1;
  const j = DIR16[ih(c.id, this.step >> 4, 55) & 15];
  this.tryMove(c, j[0] * s.speed, j[1] * s.speed);
}

export function spawnGhosts(this: Ecology, day: number): void {
  if (this.counts[Kind.Ghost] >= 3) return;
  const m = this.w.map;
  for (let i = 0; i < this.graveMap.length; i++) {
    // 死者の多い暗がり（墓：ゲーム内のここ3日ほどの死）から、ゴーストが生まれる。冒険者の亡骸が多く眠る所では亡霊の騎士
    if (this.graveMap[i] < 600) continue;
    const cx = i % 24;
    const cy = Math.floor(i / 24);
    for (let tries = 0; tries < 12; tries++) {
      const h = ih(this.step, i, 56 + tries);
      const x = cx * 8 + (h % 8);
      const y = cy * 8 + ((h >>> 8) % 8);
      if (x >= m.w || y >= m.h) continue;
      const k = y * m.w + x;
      // ゴーストは死者の多さから生まれる（マナがあれば少し使う）
      if (m.solid[k] || m.lava[k] || this.lit(k, day) > 0.2) continue;
      const g = this.spawn(Kind.Ghost, x * TILE + 8, y * TILE + 8, 0, 0);
      this.takeMana(g, k, 20);
      g.st = 0;
      this.graveMap[i] -= 500;
      if (this.advGrave[i] >= 300 && this.manaAround(k) >= 6 && !this.list.some((o) => o.elite === 2 && !o.dead)) {
        g.elite = 2;
        g.hx = g.x;
        g.hy = g.y;
        this.advGrave[i] -= 300;
        this.nameOf(g);
        this.log(g.x, g.y, `冒険者の亡骸が眠る暗がりから、亡霊の騎士「${this.names.get(g.id)}」が立ち上がった`);
      }
      return;
    }
  }
}

export function ghost(this: Ecology, c: Cr, day: number): void {
  // 亡霊の騎士：眠る亡骸の墓（生まれた所）のまわり5マスを見回り、4マス以内に入った生きた者に斬りかかる
  if (c.elite === 2) {
    let foe: Cr | null = null;
    let bd = 4 * TILE * 4 * TILE;
    this.nearby(c.x, c.y, 4, (o) => {
      if (o.dead || o.away || [Kind.Ghost, Kind.Zombie, Kind.Skeleton, Kind.Lich, Kind.Wisp, Kind.Golem, Kind.Gargoyle, Kind.Armor].includes(o.k) || STR[o.k] < 2) return;
      if (sq(o.hx - c.hx) + sq(o.hy - c.hy) > 9 * TILE * 9 * TILE && sq(o.x - c.hx) + sq(o.y - c.hy) > 6 * TILE * 6 * TILE) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        foe = o;
      }
    });
    if (foe) {
      const f = foe as Cr;
      this.markNotice(c, f, '!');
      c.act = 1;
      if (bd < 16 * 16) this.fight(c, f);
      else this.goTo(c, f.x, f.y, SPEC[Kind.Ghost].speed * 1.2);
      return;
    }
    if (sq(c.x - c.hx) + sq(c.y - c.hy) > 5 * TILE * 5 * TILE || ih(c.id, this.step, 302) % 90 === 0) {
      const a = (ih(c.id, this.step >> 6, 303) % 628) / 100;
      c.act = 1;
      this.goTo(c, c.hx + Math.cos(a) * 3 * TILE, c.hy + Math.sin(a) * 2 * TILE, SPEC[Kind.Ghost].speed * 0.6);
    }
    return;
  }
  const s = SPEC[Kind.Ghost];
  if (c.actT > 2500) {
    this.die(c, 'faded');
    return;
  }
  // 光を嫌い、暗い方へ漂う
  const m = this.w.map;
  const k = this.tileOf(c.x, c.y);
  let best = k;
  let bl = this.lit(k, day);
  for (const n of [k + 1, k - 1, k + m.w, k - m.w]) {
    if (n < 0 || n >= m.solid.length || m.solid[n]) continue;
    const l = this.lit(n, day);
    if (l < bl - 0.02) {
      bl = l;
      best = n;
    }
  }
  const j = DIR16[ih(c.id, this.step >> 3, 57) & 15];
  let mx = j[0] * s.speed * 0.6;
  let my = j[1] * s.speed * 0.6;
  if (best !== k) {
    mx += (((best % m.w) * TILE + 8 - c.x) / 16) * s.speed;
    my += ((Math.floor(best / m.w) * TILE + 8 - c.y) / 16) * s.speed;
  }
  this.tryMove(c, mx, my);
  // 近くの松明を吹き消す
  if (this.step % 20 === c.id % 20) {
    this.nearby(c.x, c.y, 2, (o) => {
      if (o.dead || o.torch <= 0 || sq(o.x - c.x) + sq(o.y - c.y) > 30 * 30) return;
      if (ih(c.id, o.id ^ this.step, 142) % 3 !== 0) return;
      if (o.k === Kind.Adventurer) o.torch = 1;
      else o.torch = -1;
    });
  }
  // 近くの生き物を怯えさせる
  let near = false;
  this.nearby(c.x, c.y, 2, (o) => {
    if (!o.dead && o.k !== Kind.Ghost && o.k !== Kind.Zombie && o.k !== Kind.Slime && sq(o.x - c.x) + sq(o.y - c.y) < 34 * 34) near = true;
  });
  if (near) {
    if (c.act !== 2 || c.actT > 6) {
      c.act = 2;
      c.actT = 0;
    }
  } else if (c.act !== 2 || c.actT > 6) c.act = 1;
}

/** 手なずけられた大トカゲは、腹が満ちているあいだリザードマンのそばを付いて歩く */
export function followOwner(this: Ecology, c: Cr): boolean {
  if (!c.ref2 || c.hungry) return false;
  const o = this.byId.get(c.ref2);
  if (!o || o.dead || o.k !== Kind.Lizardman) {
    c.ref2 = 0;
    return false;
  }
  const d = sq(o.x - c.x) + sq(o.y - c.y);
  if (d < 28 * 28) {
    c.act = 0;
    return true;
  }
  c.act = 1;
  this.goTo(c, o.x, o.y, SPEC[Kind.Lizard].speed);
  return true;
}

export function deathsAt(this: Ecology, x: number, y: number): number {
  const cx = Math.min(23, Math.max(0, Math.floor(x / (TILE * 8))));
  const cy = Math.min(17, Math.max(0, Math.floor(y / (TILE * 8))));
  let n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x2 = cx + dx;
      const y2 = cy + dy;
      if (x2 >= 0 && y2 >= 0 && x2 < 24 && y2 < 18) n += this.graveMap[y2 * 24 + x2];
    }
  return n;
}

export function lichNear(this: Ecology, x: number, y: number): boolean {
  for (const o of this.list) if (o.k === Kind.Lich && !o.dead && sq(o.x - x) + sq(o.y - y) < 15 * TILE * 15 * TILE) return true;
  return false;
}

/**
 * 冒険者の亡骸が起き上がる：魔法使いは（死者がとても多ければ）リッチに、ほかはスケルトンに。
 * 骨は体の未練、鎧は道具の未練：スケルトンは足もとの装備を拾わず、素の骨のまま弱く起き上がる。
 * 装備とそこに宿る未練は床に残り、リビングアーマーの材料になる（src/eco/armor.ts）。僧侶の清めは亡骸（体）にだけ効くので、装備の未練は清めとは関わらない。
 * （以前は装備を拾って職業ごとの強さと姿になり、リビングアーマーと同じ装備を取り合っていた。古いセーブの、装備を持つスケルトン（init 1）はそのまま動く）
 */
export function raiseUndead(this: Ecology, c: Cr, manyDead: boolean): void {
  const asLich = c.sp === Job.Wizard && manyDead && this.counts[Kind.Lich] === 0 && !this.list.some((o) => o.k === Kind.Lich && !o.dead);
  c.k = asLich ? Kind.Lich : Kind.Skeleton;
  this.log(c.x, c.y, asLich ? `倒れた魔法使いの亡骸が{k:${Kind.Lich}}になった` : `冒険者の骨が{k:${Kind.Skeleton}}として起き上がった`);
  c.body = c.units;
  c.units = 0;
  c.food = 0;
  c.dead = 0;
  c.act = 0;
  c.actT = 0;
  c.hungry = 0;
  c.init = 0;
  c.party = 0;
  c.hx = c.x;
  c.hy = c.y;
  c.st = 0;
  this.counts[c.k]++;
}

export function skeleton(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Skeleton];
  if (c.act === 2 && c.actT < 4) return;
  // 骨はゆっくり崩れて土に返る
  if (this.step % 300 === c.id % 300) {
    c.body--;
    this.deposit(c.x, c.y, 1);
    if (c.body <= 0) {
      // 崩れて消えたことも、死として記録に残す（保存則の収支は、土へ返した分で合っている）
      this.record('deaths', { t: this.w.tick, id: c.id, k: c.k, cause: 'crumbled', by: -1, x: Math.round(c.x), y: Math.round(c.y) } as never);
      this.dropBelongings(c);
      this.releaseMana(c);
      c.dead = 2;
      return;
    }
  }
  // 食べずに、生きているものを襲う
  const foeKinds = [Kind.Rat, Kind.Goblin, Kind.Kobold, Kind.Adventurer, Kind.Lizardman, Kind.Orc, Kind.Lizard, Kind.Ant];
  let foe: Cr | null = null;
  let bd = 6 * TILE * 6 * TILE;
  this.nearby(c.x, c.y, 6, (o) => {
    if (o.dead || o.away || !foeKinds.includes(o.k)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      foe = o;
    }
  });
  if (foe) {
    const f = foe as Cr;
    c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
    if (bd < 14 * 14) this.fight(c, f);
    else {
      c.act = 1;
      this.goTo(c, f.x, f.y, s.speed);
    }
    return;
  }
  // 暗がりをさまよう（生まれた場所から離れすぎない）：120回のうち60回、ふつうに近い速さで歩き、残りは立ち止まる。
  // （以前はふつうの速さの0.6倍で歩き、脚を動かしながら3秒で半タイルも進まず、足踏みして見えていた）
  c.act = c.actT % 120 < 60 ? 1 : 0;
  if (c.act === 1) {
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 14 * TILE * 14 * TILE) this.goTo(c, c.hx, c.hy, s.speed);
    else {
      const j = DIR16[ih(c.id, this.step >> 5, 143) & 15];
      this.tryMove(c, j[0] * s.speed * 0.9, j[1] * s.speed * 0.9);
    }
  }
}

export function lich(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Lich];
  if (c.act === 2 && c.actT < 6) return;
  // 住みかに入ってきた生きものを、死の呪いで倒す
  let foe: Cr | null = null;
  this.nearby(c.x, c.y, 5, (o) => {
    if (foe || o.dead || o.away || ![Kind.Adventurer, Kind.Goblin, Kind.Kobold, Kind.Orc, Kind.Lizardman].includes(o.k)) return;
    foe = o;
  });
  if (foe) {
    const f = foe as Cr;
    c.act = 2;
    c.actT = 0;
    c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
    if (ih(c.id, f.id, this.step) % 2 === 0) this.fight(c, f);
    return;
  }
  c.act = c.actT % 200 < 40 ? 1 : 0;
  if (c.act === 1) {
    const a = (c.actT * 0.05 + c.id) % 6.283;
    this.moveToward(c, c.hx + Math.cos(a) * 24, c.hy + Math.sin(a) * 16, s.speed);
  }
}

/** ゴブリンとオーク：床の道具を拾う（武器、松明）。ゴブリンは燃えさしを熱いところで灯し直す */
export function scavenge(this: Ecology, c: Cr): boolean {
  if (c.k === Kind.Goblin && c.torch < 0) {
    const k = this.tileOf(c.x, c.y);
    if (k >= 0 && this.w.heat[k] > 120) c.torch = 6000;
  }
  if (c.torch > 0) {
    c.torch--;
    if (c.torch === 0) c.torch = -1;
  }
  const wantWeapon = !c.party;
  const wantTorch = c.k === Kind.Goblin && c.torch === 0;
  if (!wantWeapon && !wantTorch) return false;
  if (c.ref2 < 0) return false;
  if (this.step % 10 !== c.id % 10 && c.ref2 === 0) return false;
  let best: Item | null = null;
  let bd = 6 * TILE * 6 * TILE;
  for (const it of this.gear) {
    const weapon = it.kind === ItemKind.Sword || it.kind === ItemKind.Mace || it.kind === ItemKind.Dagger || it.kind === ItemKind.Greatsword;
    const torch = it.kind === ItemKind.Torch || it.kind === ItemKind.Stub;
    if (!((wantWeapon && weapon) || (wantTorch && torch))) continue;
    const d = sq(it.x - c.x) + sq(it.y - c.y);
    if (d < bd) {
      bd = d;
      best = it;
    }
  }
  if (!best) {
    c.ref2 = 0;
    return false;
  }
  const it = best as Item;
  c.ref2 = it.id;
  c.act = 1;
  if (bd < 10 * 10) {
    if (it.kind === ItemKind.Torch) c.torch = it.fuel;
    else if (it.kind === ItemKind.Stub) c.torch = -1;
    else c.party = it.kind;
    // 武器に宿っていた未練（マナ）は、拾った者の体へ移る（src/eco/armor.ts）
    this.takeRemnant(c, it);
    this.gear = this.gear.filter((o) => o !== it);
    c.ref2 = 0;
    c.act = 2;
    c.actT = 0;
  } else this.goTo(c, it.x, it.y, SPEC[c.k].speed);
  return true;
}

declare module '../ecology' {
  interface Ecology {
    addDeath: typeof addDeath;
    zombie: typeof zombie;
    spawnGhosts: typeof spawnGhosts;
    ghost: typeof ghost;
    followOwner: typeof followOwner;
    deathsAt: typeof deathsAt;
    lichNear: typeof lichNear;
    raiseUndead: typeof raiseUndead;
    skeleton: typeof skeleton;
    lich: typeof lich;
    scavenge: typeof scavenge;
  }
}

Object.assign(Ecology.prototype, { addDeath, zombie, spawnGhosts, ghost, followOwner, deathsAt, lichNear, raiseUndead, skeleton, lich, scavenge });
