/** Ecology のメソッド：群れ（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function groupKey(this: Ecology, c: Cr): string | null {
  const hit = this.gkCache.get(c.id);
  if (hit !== undefined) return hit;
  return this.groupKeyRaw(c);
}

export function memoKey(this: Ecology, c: Cr, p: string, a: number, b: number): string {
  const mm = this.gkMemo.get(c.id);
  if (mm && mm[0] === p && mm[1] === a && mm[2] === b) return mm[3];
  const key = `${p}${a},${b}`;
  this.gkMemo.set(c.id, [p, a, b, key]);
  return key;
}

export function groupKeyRaw(this: Ecology, c: Cr): string | null {
  switch (c.k) {
    case Kind.Rat:
      return c.hx || c.hy ? this.memoKey(c, 'r', c.hx, c.hy) : null;
    case Kind.Bat:
      return c.ref2 ? `v${c.ref2}` : c.tx || c.ty ? this.memoKey(c, 'b', c.tx, c.ty) : null;
    case Kind.Vampire:
      return `v${c.id}`;
    case Kind.Orc:
      return c.hx || c.hy ? this.memoKey(c, 'o', c.hx, c.hy) : null;
    case Kind.Ant:
    case Kind.Kobold:
    case Kind.Goblin:
    case Kind.Lizardman:
      return c.ref > 0 ? `${c.k}:${c.ref}` : null;
    case Kind.Adventurer:
      return c.party ? `p${c.party}` : null;
    case Kind.Dwarf:
      return this.hold ? 'd' : null;
    default:
      return null;
  }
}

export function buildGroups(this: Ecology): void {
  this.groups.clear();
  this.gkCache.clear();
  for (const c of this.list) {
    if (c.dead || c.away) continue;
    const key = this.groupKeyRaw(c);
    // 群れない種（groupKeyRaw がいつも null）は控えなくても groupKey が同じ null を返す
    if (key || GROUPED[c.k]) this.gkCache.set(c.id, key);
    if (!key) continue;
    let g = this.groups.get(key);
    if (!g) {
      const travel = c.k === Kind.Adventurer || c.k === Kind.Orc || key[0] === 'v';
      g = { key, k: c.k, type: travel ? 1 : 0, hx: c.hx, hy: c.hy, members: [] };
      this.groups.set(key, g);
    }
    g.members.push(c);
  }
  for (const g of this.groups.values()) {
    if (g.type === 1) {
      // 旅する群れの集まる場所は先頭（ヴァンパイアの群れはヴァンパイア）
      const lead = g.key[0] === 'v' ? g.members.find((c) => c.k === Kind.Vampire) ?? g.members[0] : g.members[0];
      g.hx = lead.x;
      g.hy = lead.y;
    }
  }
  for (const [key, a] of this.alarms) if (this.step - a.t > 80) this.alarms.delete(key);
}

/** 群れの仲間が襲われたら、群れに警戒を伝える */
export function raiseAlarm(this: Ecology, d: Cr, a: Cr): void {
  const key = this.groupKey(d);
  if (!key || this.groupKey(a) === key) return;
  this.alarms.set(key, { t: this.step, foe: a.id, x: Math.round(d.x), y: Math.round(d.y) });
}

/**
 * 警戒への反応（同調）：動物の群れは皆で逃げ、狡猾な種と知性ある種の群れは近くの仲間が駆けつけて加勢する。
 * true なら今は警戒に従っている
 */
export function heedAlarm(this: Ecology, c: Cr): boolean {
  if (!this.alarms.size) return false;
  const key = this.groupKey(c);
  if (!key) return false;
  const a = this.alarms.get(key);
  if (!a || c.flee > 0) return false;
  const foe = this.byId.get(a.foe);
  if (!foe || foe.dead || sq(a.x - c.x) + sq(a.y - c.y) > 10 * TILE * 10 * TILE) return false;
  const tier = TIER[c.k] ?? 1;
  // コボルトは、自分よりずっと強い相手には加勢せず、皆で逃げる
  if (tier <= 1 || (c.k === Kind.Kobold && this.str(foe) > this.str(c) * 2)) {
    c.flee = 60 + (ih(c.id, a.t, 198) % 40);
    c.foe = foe.id;
    return false;
  }
  // 加勢：冒険者とドワーフはもともと見えている敵と戦うので、ここでは扱わない
  if (c.k === Kind.Adventurer || c.k === Kind.Dwarf) return false;
  // 知性ある者は、かなわない相手には加勢しない
  if (tier >= 3 && this.str(foe) > this.str(c) * 2) return false;
  c.act = 1;
  if (sq(foe.x - c.x) + sq(foe.y - c.y) < 14 * 14) this.fight(c, foe);
  else this.goTo(c, foe.x, foe.y, SPEC[c.k].speed * 1.1);
  return true;
}

/** 群れの分家と合流（地上の時間で1分ごと） */
export function tendGroups(this: Ecology): void {
  const m = this.w.map;
  // 大ネズミ：巣穴が8匹を超えたら、若い3匹が新しい巣穴へ分かれる
  for (const b of this.burrows.slice()) {
    const res = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y);
    if (res.length <= 8 || this.burrows.length >= 24) continue;
    // 空きのある巣穴か、新しい巣穴
    const nb = this.pickBurrow();
    if (nb.x === b.x && nb.y === b.y) continue;
    for (const c of res.sort((p, q) => q.bornAt - p.bornAt).slice(0, 3)) {
      c.hx = nb.x;
      c.hy = nb.y;
    }
  }
  // まわりの苔が尽きてきた巣穴は、苔の豊かな所へ引っ越す（一匹あたり150に満たなければ）
  for (const b of this.burrows) {
    const n = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y).length;
    if (n > 0 && this.burrowFood(b.x, b.y) < n * 150) this.relocateBurrow(b);
  }
  // はぐれた大ネズミは、近くの空きのある巣穴に加わる
  for (const c of this.list) {
    if (c.dead || c.k !== Kind.Rat) continue;
    if ((c.hx || c.hy) && this.burrows.some((b) => b.x === c.hx && b.y === c.hy)) continue;
    let best: { x: number; y: number } | null = null;
    let bd = 30 * TILE * 30 * TILE;
    for (const b of this.burrows) {
      const d = sq(b.x - c.x) + sq(b.y - c.y);
      if (d < bd && this.list.filter((o) => o.k === Kind.Rat && !o.dead && o.hx === b.x && o.hy === b.y).length < 8) {
        bd = d;
        best = b;
      }
    }
    if (best) {
      c.hx = best.x;
      c.hy = best.y;
    }
  }
  // ゴブリンとリザードマン：集落を失った者は、近くの同じ種の集落に加わる。ゴブリンの集落が15を超えたら、5匹が新しい集落を作る（食べ物の足りる場所があるときだけ。蓄えは人数の割合で分ける）
  for (const c of this.list) {
    if (c.dead || (c.k !== Kind.Goblin && c.k !== Kind.Lizardman) || c.st === 9 || c.st === 10) continue;
    const kind = c.k === Kind.Goblin ? 0 : 1;
    if (this.camps.some((o) => o.id === c.ref && o.id >= 0)) continue;
    const cp = this.camps.filter((o) => o.id >= 0 && o.kind === kind).sort((p, q) => sq(p.x - c.x) + sq(p.y - c.y) - (sq(q.x - c.x) + sq(q.y - c.y)))[0];
    if (cp) c.ref = cp.id;
  }
  for (const cp of this.camps.slice()) {
    if (cp.id < 0 || cp.kind !== 0 || this.camps.filter((o) => o.id >= 0 && o.kind === 0).length >= 3) continue;
    const res = this.campMembers(cp);
    if (res.length <= 15) continue;
    const site = this.pickGoblinCamp(cp, [cp.x, cp.y], Ecology.GOBLIN_MIN_FOOD);
    if (site < 0) continue;
    const go = res.slice(-5);
    // 分かれる者は、人数の割合に応じて蓄えを分けて持っていく（七巡目。六巡目までは蓄えなしで始まり、短く終わっていた）
    const share = Math.floor(((cp.store ?? 0) * go.length) / res.length);
    cp.store = (cp.store ?? 0) - share;
    const nc = this.newCamp(site, 'split', share);
    for (const c of go) c.ref = nc.id;
    this.log(nc.x, nc.y, `{k:${Kind.Goblin}}の群れが分かれ、新しい集落を作った`);
  }
  // コボルト：住処を失った者は、近くの住処に加わる
  for (const c of this.list) {
    if (c.dead || c.k !== Kind.Kobold || c.st === 10) continue;
    if (this.warrens.some((o) => o.id === c.ref)) continue;
    const wr = this.warrens.slice().sort((p, q) => sq(p.x - c.x) + sq(p.y - c.y) - (sq(q.x - c.x) + sq(q.y - c.y)))[0];
    if (wr) c.ref = wr.id;
  }
}

export function territory(this: Ecology, c: Cr): boolean {
  const R = Ecology.TERRITORY[c.k];
  if (!R || c.flee > 0 || this.step % 10 !== c.id % 10) return false;
  let rival: Cr | null = null;
  this.nearby(c.x, c.y, R, (o) => {
    if (rival || o === c || o.dead || o.away || o.k !== c.k || o.flee > 0 || !this.canSense(c, o)) return;
    if (sq(o.x - c.x) + sq(o.y - c.y) < R * TILE * R * TILE) rival = o;
  });
  if (!rival) return false;
  const r = rival as Cr;
  const mine = this.str(c) * (c.hp > 0 ? c.hp / this.maxHp(c) : 1) + (c.id % 7) * 0.001;
  const theirs = this.str(r) * (r.hp > 0 ? r.hp / this.maxHp(r) : 1) + (r.id % 7) * 0.001;
  const [win, lose] = mine >= theirs ? [c, r] : [r, c];
  // 強いほうは相手の方を向いて威嚇し、弱いほうは離れる
  win.dir = Math.abs(lose.x - win.x) > Math.abs(lose.y - win.y) ? (lose.x > win.x ? 2 : 3) : lose.y > win.y ? 0 : 1;
  win.act = 2;
  win.actT = 0;
  lose.flee = 90 + (ih(lose.id, this.step, 199) % 60);
  lose.foe = win.id;
  return win === c;
}

declare module '../ecology' {
  interface Ecology {
    groupKey: typeof groupKey;
    memoKey: typeof memoKey;
    groupKeyRaw: typeof groupKeyRaw;
    buildGroups: typeof buildGroups;
    raiseAlarm: typeof raiseAlarm;
    heedAlarm: typeof heedAlarm;
    tendGroups: typeof tendGroups;
    territory: typeof territory;
  }
}

Object.assign(Ecology.prototype, { groupKey, memoKey, groupKeyRaw, buildGroups, raiseAlarm, heedAlarm, tendGroups, territory });
