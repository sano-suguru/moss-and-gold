/** Ecology のメソッド：セーブとロード（シリアライズと復元。src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Note, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function serialize(this: Ecology): object {
  const L: number[] = [];
  for (const c of this.list) {
    if (c.dead === 2) continue;
    L.push(c.id, c.k, c.x, c.y, c.vx, c.vy, c.dir, c.act, c.actT, c.body, c.food, c.glow, c.hungry, c.sinceMeal, c.st, c.hx, c.hy, c.tx, c.ty, c.dead, c.units, c.away ? 1 : 0, c.caught ? 1 : 0, c.ref, c.sp, c.init, c.ref2, c.gold, c.party, c.torch, c.hp, c.hitAt, c.foe, c.flee, c.gait, c.bornAt, c.sleep, c.drowsy, c.lure, c.lureAt, c.feed, c.mana, c.elite, c.cast, c.poison, c.poisonBy, c.stun, c.kb, c.kbx, c.kby, c.run, c.aim, c.bind, c.doze, c.sporeAt, c.stone, c.avert);
  }
  const P: number[][] = [];
  for (const [id, p] of this.paths) if (this.byId.get(id)?.dead === 0) P.push([id, p.gx, p.gy, p.pi, p.stall, p.gk, p.at, p.miss, ...p.path]);
  return { V: 57, VL: this.volleys.map((v) => [v.t, v.a, v.d, v.x, v.y, v.r, v.mul, v.poison, v.stun ?? 0, v.tgt ?? 0, v.bind ?? 0]), PV: 3, G: Array.from(this.deathMap), GV: Array.from(this.graveMap), SV: Array.from(this.starveMap), AG: Array.from(this.advGrave), NM: [...this.names], LE: this.lastElite.map((v) => v ?? null), AC: this.colonies.map((o) => [o.id, o.x, o.y, o.store, o.queen, o.starve, o.hk ?? -1, o.len ?? 0]), KW: this.warrens.map((o) => [o.id, o.x, o.y, o.target, o.prog, o.len, o.stall ?? 0, o.lastProg ?? 0, o.door ?? -1, o.dir ?? -1, o.tun ?? 0, o.store ?? 0, o.hide ?? 0, o.raids ?? 0, o.empty ?? -1, o.alone ?? -1]), KT: this.traps.map((o) => [o.id, o.k, o.w]), KS: this.koboldShun, GC: this.camps.map((o) => [o.id, o.kind, o.x, o.y, o.dry, o.fuel ?? 0, o.store ?? 0, o.hide ?? 0, o.raids ?? 0, o.empty ?? -1, o.alone ?? -1, o.lx ?? 0, o.ly ?? 0, o.tribT ?? 0, o.raidT ?? 0, o.snatchT ?? 0, o.poor ?? 0, o.cacheT ?? 0]), GS: this.goblinShun, LA: this.lastArrival.map((v) => v ?? null), ST: this.statues.map((o) => [o.id, o.x, o.y, o.k, o.sp, o.dir, o.act, o.f, o.units, o.age, o.blocks ?? -1]), TP: this.piles.map((o) => [o.id, o.x, o.y, o.gold, o.age]), TR: [...this.trails].map(([id, t]) => [id, ...t]), PD: this.pendingDigs, BN: this.burning, PT2: this.parties, LO: this.lore, IT: this.gear.map((o) => [o.id, o.x, o.y, o.kind, o.fuel]), AK: [...this.armorKit].map(([id, kit]) => [id, ...kit]), AF: this.armorFalls, NT: [...this.notes].map(([id, n]) => [id, n.t, n.cause ?? '', n.by ?? -1, n.bn ?? '', n.who ?? -1, n.job ?? -1, n.name ?? '']), RU: [this.rumors.light, this.rumors.gold, this.rumors.undead, 0, this.rumors.dragon, 0, 0, 0, this.rumors.goblin, this.rumors.goblinX, this.rumors.goblinY, this.rumors.dragonX, this.rumors.dragonY, this.rumors.goblinRobs, this.rumors.goblinCamp, this.rumors.goblinCampX, this.rumors.goblinCampY], RB: this.rumors.beasts, SC: this.caches.map((o) => [o.id, o.x, o.y, o.food, o.d, o.at, o.by, o.rt]), RS: this.roster.map((h) => [h.id, h.name, h.job, h.look, h.rank, h.ret, h.trips, h.cid, h.last ?? 0, h.low ?? 100, h.rest ?? 0]), GR: this.graves.map((g) => [g.id, g.x, g.y, g.name, g.job, g.rank, g.ret, g.t, g.look]), NH: this.nextHero, GL: [this.goldIn, this.goldOut, this.returned, this.fallen], EV: this.events.map((e) => [e.t, e.x, e.y, e.m]), HD2: this.hold, LP: this.lamps, EG: this.eggs, DSH: this.dragonShell, FX: [this.fxHits.filter((h) => this.w.tick - h.t < 10), this.fxMarks.filter((m) => this.w.tick - m.t < 20), this.fxAttacks.filter((m) => this.w.tick - m.t < (m.style === 'bless' ? 44 : m.style === 'silk' || m.style === 'silkcut' ? 34 : m.style === 'sporecloud' ? 30 : m.style === 'wail' ? 24 : 20)), this.fxManaBorn.filter((m) => this.w.tick - m.t < 100), this.fxMarch.filter((m) => this.w.tick - m.t < DAY_TICKS_ECO / 4), this.fxEats.filter((m) => this.w.tick - m.t < 60), this.fxWebTears.filter((m) => this.w.tick - m.t < 60), this.fxArmorRise.filter((m) => this.w.tick - m.t < 100), this.fxVampMist.filter((m) => this.w.tick - m.t < 40), this.fxBurns.filter((m) => this.w.tick - m.t < 40), this.fxSoilBirths.filter((m) => this.w.tick - m.t < 100), this.fxManaRise.filter((m) => this.w.tick - m.t < 60)], IS: [...this.islandIds], WB: this.wallBroken, PS: this.pendingScraps, PRB: Array.from(this.presenceBase), PRT: Array.from(this.presenceTrace), AL: [...this.alarms.entries()], FG: this.forage, OM: [this.openMoss, this.openFungus, this.edibleMoss, this.wildFungus], DL: [this.dwarfLore, this.lastDwarves], LL: this.lastLogged.map((v) => v ?? null), NZ: this.noises, LD: this.lastDigCount, DS: Array.from(this.discovered), L, P, RET: [...this.retreats].filter(([id]) => this.byId.get(id)?.dead === 0).map(([id, r]) => [id, Number.isNaN(r[0]) ? -1 : r[0], Number.isNaN(r[1]) ? -1 : r[1], r[2], r[3]]), W: this.webs.map((w) => [w.id, w.x, w.y, w.r, w.owner, w.age]), B: this.burrows.map((b) => [b.x, b.y, b.hk ?? -1, b.len ?? 0, b.moved ?? -1e9, b.cap ?? -1]), n: this.nextId, i: this.imported, e: this.exported, s: this.step };
}

export function restore(this: Ecology, o: any): void {
  this.list = [];
  this.byId.clear();
  const L: number[] = o.L || [];
  const V = o.V || 24;
  if (o.G) this.deathMap.set(o.G);
  if (o.GV) this.graveMap.set(o.GV);
  if (o.SV) this.starveMap.set(o.SV);
  if (o.AG) this.advGrave.set(o.AG);
  this.names = new Map(o.NM ?? []);
  this.lastElite = (o.LE ?? []).map((v: number | null) => (v === null ? undefined : v)) as number[];
  this.roster = (o.RS || []).map((a: (number | string)[]) => ({ id: a[0] as number, name: a[1] as string, job: a[2] as number, look: a[3] as number, rank: a[4] as number, ret: a[5] as number, trips: a[6] as number, cid: a[7] as number, last: (a[8] as number) ?? 0, low: (a[9] as number) ?? 100, rest: (a[10] as number) ?? 0 }));
  this.graves = (o.GR || []).map((a: (number | string)[]) => ({ id: a[0] as number, x: a[1] as number, y: a[2] as number, name: a[3] as string, job: a[4] as number, rank: a[5] as number, ret: a[6] as number, t: a[7] as number, look: (a[8] as number) ?? 0 }));
  this.nextHero = o.NH ?? 1;
  this.colonies = (o.AC || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], store: a[3], queen: a[4], starve: a[5] ?? 0, hk: a[6] ?? -1, len: a[7] ?? 0 }));
  this.warrens = (o.KW || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], target: a[3], prog: a[4], len: a[5], stall: a[6] ?? 0, lastProg: a[7] ?? 0, door: a[8] ?? -1, dir: a[9] ?? -1, tun: a[10] ?? 0, store: a[11] ?? 0, hide: a[12] ?? 0, raids: a[13] ?? 0, empty: a[14] ?? -1, alone: a[15] ?? -1 }));
  this.traps = (o.KT || []).map((a: number[]) => ({ id: a[0], k: a[1], w: a[2] }));
  this.koboldShun = o.KS ?? 0;
  this.camps = (o.GC || []).map((a: number[]) => ({ id: a[0], kind: a[1], x: a[2], y: a[3], dry: a[4], fuel: a[5] ?? 0, store: a[6] ?? 0, hide: a[7] ?? 0, raids: a[8] ?? 0, empty: a[9] ?? -1, alone: a[10] ?? -1, lx: a[11] ?? 0, ly: a[12] ?? 0, tribT: a[13] ?? 0, raidT: a[14] ?? 0, snatchT: a[15] ?? 0, poor: a[16] ?? 0, cacheT: a[17] ?? 0 }));
  this.goblinShun = o.GS ?? 0;
  this.lastArrival = (o.LA || []).map((v: number | null) => (v === null ? undefined : v)) as number[];
  this.statues = (o.ST || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], k: a[3], sp: a[4], dir: a[5], act: a[6], f: a[7], units: a[8], age: a[9], blocks: a[10] === undefined || a[10] < 0 ? undefined : a[10] }));
  this.rebuildStatueIndex();
  this.piles = (o.TP || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], gold: a[3], age: a[4] }));
  this.trails = new Map((o.TR || []).map((a: number[]) => [a[0], a.slice(1)] as [number, number[]]));
  this.pendingDigs = o.PD || [];
  this.burning = o.BN || [];
  this.parties = o.PT2 ? JSON.parse(JSON.stringify(o.PT2)) : (o.PT || []).map((a: number[]) => ({ id: a[0], goal: a[1], tx: a[2], ty: a[3], since: a[4], tier: a[5], initial: a[6], saw: a[7], targetAt: a[8], waitT: a[9], bk: a[10], bx: a[11], by: a[12], members: a.slice(13) }));
  // 古いセーブの一行：見つめの被害（bsHit・bsId・bsX・bsY）と、見かけた大物（bk・bx・by）を、種ごとの形（hurt・seenB）に直す
  for (const q of this.parties as (Party & { bsHit?: number; bsId?: number; bsX?: number; bsY?: number; bk?: number; bx?: number; by?: number })[]) {
    if (q.bsHit) q.hurt = [[Kind.Basilisk, q.bsHit, q.bsX ?? 0, q.bsY ?? 0, q.bsId ?? -1]];
    if (q.bk) q.seenB = [[q.bk, q.bx ?? 0, q.by ?? 0]];
    delete q.bsHit;
    delete q.bsId;
    delete q.bsX;
    delete q.bsY;
    delete q.bk;
    delete q.bx;
    delete q.by;
  }
  this.lore = o.LO ? JSON.parse(JSON.stringify(o.LO)) : { explored: [], gold: [], danger: [] };
  this.gear = (o.IT || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], kind: a[3], fuel: a[4] }));
  this.armorKit = new Map((o.AK || []).map((a: number[]) => [a[0], a.slice(1)] as [number, number[]]));
  this.armorFalls = o.AF || [];
  // いきさつの覚え書き（情報パネル用）。空の値は持たせない
  this.notes = new Map(
    (o.NT || []).map((a: (number | string)[]) => {
      const n: Note = { t: a[1] as number };
      if (a[2]) n.cause = a[2] as string;
      if ((a[3] as number) >= 0) n.by = a[3] as number;
      if (a[4]) n.bn = a[4] as string;
      if ((a[5] as number) >= 0) n.who = a[5] as number;
      if ((a[6] as number) >= 0) n.job = a[6] as number;
      if (a[7]) n.name = a[7] as string;
      return [a[0] as number, n] as [number, Note];
    }),
  );
  const ru = o.RU || [0, 0, 0, 0, 0];
  // 魔物の噂は種ごと（RB）。RB の無い古いセーブは、1種類だけ覚えていた噂（強さ ru[3]、種 ru[5]、場所 ru[6], ru[7]）を1件に直す
  const rb: number[][] = o.RB ? (o.RB as number[][]).map((b) => b.slice()) : ru[5] && ru[3] > 0 ? [[ru[5], ru[3], ru[6] ?? 0, ru[7] ?? 0]] : [];
  this.rumors = { light: ru[0], gold: ru[1], undead: ru[2], dragon: ru[4], beasts: rb.sort((a, b) => a[0] - b[0]), goblin: ru[8] ?? 0, goblinX: ru[9] ?? 0, goblinY: ru[10] ?? 0, dragonX: ru[11] ?? 0, dragonY: ru[12] ?? 0, goblinRobs: ru[13] ?? 0, goblinCamp: ru[14] ?? 0, goblinCampX: ru[15] ?? 0, goblinCampY: ru[16] ?? 0 };
  this.caches = (o.SC || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], food: a[3], d: a[4], at: a[5], by: a[6], rt: a[7] ?? -1e9 }));
  this.events = (o.EV || []).map((a: [number, number, number, string]) => ({ t: a[0], x: a[1], y: a[2], m: a[3] }));
  if (o.DS) this.discovered.set(o.DS);
  const hd = o.HD as number[] | null | undefined;
  this.hold = o.HD2 !== undefined ? (o.HD2 ? JSON.parse(JSON.stringify(o.HD2)) : null) : hd ? { stage: hd[0], sx: hd[1], sy: hd[2], dx: hd[3], dy: hd[4], hk: hd[5], target: hd[6], head: hd[7], len: hd[8], forge: hd[9], golem: hd[10], since: hd[11], store: hd[12], farm: hd.slice(14, 14 + hd[13]), todo: hd.slice(14 + hd[13]) } : null;
  this.lamps = o.LP || [];
  this.eggs = o.EG ? JSON.parse(JSON.stringify(o.EG)) : [];
  this.dragonShell = o.DSH ? { ...o.DSH } : null;
  // 見た目のための印（描画専用）
  if (o.FX) {
    this.fxHits = JSON.parse(JSON.stringify(o.FX[0]));
    this.fxMarks = JSON.parse(JSON.stringify(o.FX[1]));
    if (o.FX[2]) this.fxAttacks = JSON.parse(JSON.stringify(o.FX[2]));
    this.fxManaBorn = o.FX[3] ? JSON.parse(JSON.stringify(o.FX[3])) : [];
    this.fxMarch = o.FX[4] ? JSON.parse(JSON.stringify(o.FX[4])) : [];
    this.fxEats = o.FX[5] ? JSON.parse(JSON.stringify(o.FX[5])) : [];
    this.fxWebTears = o.FX[6] ? JSON.parse(JSON.stringify(o.FX[6])) : [];
    this.fxArmorRise = o.FX[7] ? JSON.parse(JSON.stringify(o.FX[7])) : [];
    this.fxVampMist = o.FX[8] ? JSON.parse(JSON.stringify(o.FX[8])) : [];
    this.fxBurns = o.FX[9] ? JSON.parse(JSON.stringify(o.FX[9])) : [];
    this.fxSoilBirths = o.FX[10] ? JSON.parse(JSON.stringify(o.FX[10])) : [];
    this.fxManaRise = o.FX[11] ? JSON.parse(JSON.stringify(o.FX[11])) : [];
  }
  this.islandIds = new Set(o.IS ?? []);
  this.wallBroken = !!o.WB;
  this.pendingScraps = o.PS ? o.PS.slice() : [];
  if (o.PRB) this.presenceBase = Float32Array.from(o.PRB);
  if (o.PRT) this.presenceTrace = Float32Array.from(o.PRT);
  this.alarms = new Map((o.AL ?? []).map((e: [string, { t: number; foe: number; x: number; y: number }]) => [e[0], { ...e[1] }]));
  this.forage = o.FG ? o.FG.slice() : [];
  [this.openMoss, this.openFungus] = o.OM ?? [0, 0];
  this.edibleMoss = o.OM?.[2] ?? 0;
  this.wildFungus = o.OM?.[3] ?? this.openFungus;
  this.lastLogged = (o.LL || []).map((v: number | null) => (v === null ? undefined : v)) as number[];
  this.noises = o.NZ ? JSON.parse(JSON.stringify(o.NZ)) : [];
  this.lastDigCount = o.LD ?? -1;
  const dl = o.DL || [0, -1];
  this.dwarfLore = dl[0];
  this.lastDwarves = dl[1];
  const gl = o.GL || [0, 0, 0, 0];
  this.goldIn = gl[0];
  this.goldOut = gl[1];
  this.returned = gl[2];
  this.fallen = gl[3];
  for (let i = 0; i + V - 1 < L.length; i += V) {
    const c: Cr = {
      id: L[i], k: L[i + 1], x: L[i + 2], y: L[i + 3], px: L[i + 2], py: L[i + 3], vx: L[i + 4], vy: L[i + 5], dir: L[i + 6], act: L[i + 7], actT: L[i + 8],
      body: L[i + 9], food: L[i + 10], glow: L[i + 11], hungry: L[i + 12], sinceMeal: L[i + 13], st: L[i + 14], hx: L[i + 15], hy: L[i + 16], tx: L[i + 17], ty: L[i + 18],
      dead: L[i + 19], units: L[i + 20], away: !!L[i + 21], caught: !!L[i + 22], ref: L[i + 23],
      sp: V > 24 ? L[i + 24] : L[i + 1], init: V > 25 ? L[i + 25] : L[i + 20], ref2: V > 26 ? L[i + 26] : 0, gold: V > 27 ? L[i + 27] : 0, party: V > 28 ? L[i + 28] : 0, torch: V > 28 ? L[i + 29] : 0, hp: V > 30 ? L[i + 30] : -1, hitAt: V > 31 ? L[i + 31] : -99, foe: V > 32 ? L[i + 32] : 0, flee: V > 33 ? L[i + 33] : 0, gait: V > 34 ? L[i + 34] : 0, bornAt: V > 35 ? L[i + 35] : -1e9, sleep: V > 36 ? L[i + 36] : 0, drowsy: V > 37 ? L[i + 37] : 0, lure: V > 38 ? L[i + 38] : 0, lureAt: V > 39 ? L[i + 39] : 0, feed: V > 40 ? L[i + 40] : 0, mana: V > 41 ? L[i + 41] : 0, elite: V > 42 ? L[i + 42] : 0, cast: V > 43 ? L[i + 43] : -1e9, poison: V > 44 ? L[i + 44] : 0, poisonBy: V > 45 ? L[i + 45] : -1, stun: V > 46 ? L[i + 46] : 0, kb: V > 47 ? L[i + 47] : 0, kbx: V > 48 ? L[i + 48] : 0, kby: V > 49 ? L[i + 49] : 0, run: V > 50 ? L[i + 50] : 0, aim: V > 51 ? L[i + 51] : 0, bind: V > 52 ? L[i + 52] : 0, doze: V > 53 ? L[i + 53] : 0, sporeAt: V > 54 ? L[i + 54] : -1e9, stone: V > 55 ? L[i + 55] : 0, avert: V > 56 ? L[i + 56] : 0,
    };
    this.list.push(c);
    this.byId.set(c.id, c);
  }
  this.volleys = ((o.VL ?? []) as number[][]).map((a) => ({ t: a[0], a: a[1], d: a[2], x: a[3], y: a[4], r: a[5], mul: a[6], poison: a[7], stun: a[8] ?? 0, tgt: a[9] ?? 0, bind: a[10] ?? 0 }));
  this.paths.clear();
  for (const a of (o.P || []) as number[][]) {
    if ((o.PV || 1) >= 3) this.paths.set(a[0], { gx: a[1], gy: a[2], pi: a[3], stall: a[4], gk: a[5], at: a[6], miss: a[7], path: a.slice(8) });
    else if ((o.PV || 1) >= 2) this.paths.set(a[0], { gx: a[1], gy: a[2], pi: a[3], stall: a[4], gk: a[5], at: a[6], miss: 0, path: a.slice(7) });
    else this.paths.set(a[0], { gx: a[1], gy: a[2], pi: a[3], stall: a[4], gk: this.tileOf(a[1], a[2]), at: 0, miss: 0, path: a.slice(5) });
  }
  // 休みの記録は x を NaN で持つ（JSON に NaN は書けないので、セーブでは -1 にしている）
  this.retreats = new Map(((o.RET ?? []) as number[][]).map((a) => [a[0], [a[1] < 0 ? NaN : a[1], a[2] < 0 ? NaN : a[2], a[3], a[4] ?? 0] as [number, number, number, number]]));
  this.webs = (o.W || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], r: a[3], owner: a[4], age: a[5] }));
  this.burrows = (o.B || []).map((a: number[]) => ({ x: a[0], y: a[1], hk: a[2] ?? -1, len: a[3] ?? 0, moved: a[4] ?? -1e9, cap: a[5] ?? -1 }));
  this.nextId = o.n || 1;
  this.imported = o.i || 0;
  this.exported = o.e || 0;
  this.step = o.s || 0;
}

declare module '../ecology' {
  interface Ecology {
    serialize: typeof serialize;
    restore: typeof restore;
  }
}

Object.assign(Ecology.prototype, { serialize, restore });
