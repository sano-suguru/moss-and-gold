/** Ecology のメソッド：冒険者（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import { RANK_NAMES, heroTitle } from './roster';
import type { World } from '../world';

/** 噂の総量（評判） */
export function reputation(this: Ecology): number {
  const r = this.rumors;
  return r.light + r.gold * 2 + r.undead + r.beast + r.dragon * 2;
}

export function maybeParty(this: Ecology): void {
  const rep = this.reputation();
  const chance = Math.min(500, 30 + rep * 40);
  if (ih(this.step, 201, 7) % 1000 >= chance) return;
  const m = this.w.map;
  const r = this.rumors;
  const want = Math.min(5, 2 + (ih(this.step, 202, 7) % 3) + (rep > 3 ? 1 : 0));
  const tier = rep < 2 ? 0 : rep < 6 ? 1 : 2;
  // ゴブリンの盗みの噂が溜まっていれば、ゴブリン退治の一行（戦士が多い）
  const gobHunt = this.goblinHuntReady();
  // 噂の中身で顔ぶれが変わる：金貨なら盗賊、アンデッドなら僧侶、大物や竜なら戦士
  const wts = [3 + 3 * (r.beast + r.dragon) + (gobHunt ? 6 : 0), 2, 1 + 3 * r.gold, 2 + 3 * r.undead, 1, r.beastKind ? 3 * r.beast : 0, 0];
  const jobs: number[] = [];
  for (let i = 0; i < want; i++) {
    const tot = wts.reduce((a, b) => a + b, 0);
    let v = (ih(this.step, 203 + i, 7) % 1000) / 1000 * tot;
    let j = 0;
    while (j < wts.length - 1 && v >= wts[j]) v -= wts[j++];
    jobs.push(j);
  }
  // 竜の噂があれば、竜殺しが一行を率いる
  if (r.dragon > 0.3 && !gobHunt) jobs[0] = Job.Slayer;
  if (gobHunt) jobs[0] = Job.Warrior;
  // 光がなければ進めない：魔法使いも僧侶もいなければ、戦士が一人松明を持つ。戦士もいなければ一人を戦士に
  if (!jobs.includes(Job.Wizard) && !jobs.includes(Job.Priest) && !jobs.includes(Job.Warrior)) jobs[jobs.length - 1] = Job.Warrior;
  // 顔ぶれは町の名簿から（中にいる者は選ばない。その職業がいなければ別の職業の者で埋める。src/eco/roster.ts）
  const heroes = this.pickHeroes(jobs, this.step);
  if (!heroes) return;
  jobs.length = heroes.length;
  heroes.forEach((h, i) => (jobs[i] = h.job));
  const size = heroes.length;
  const pid = this.nextId++;
  // 入る口：正面の入口か、外の世界の地図に載った地表の横穴（開いているもの）
  const known = (this.lore.mouths ?? []).filter((i) => this.mouthOpen(i));
  const pick = ih(this.step, 205, 7) % (1 + known.length);
  const door = pick === 0 ? -1 : known[pick - 1];
  const party: Party = { id: pid, members: [], goal: 0, tx: m.entrance.x * TILE + 8, ty: 3 * TILE, since: this.step, tier, initial: size, saw: 0, targetAt: 0, waitT: 0, bk: 0, bx: 0, by: 0, door, mouths: [], explored: this.lore.explored.slice(), goldCells: this.lore.gold.slice(), goneGold: [], danger: this.lore.danger.filter((d) => this.w.tick - d[2] < DAY_TICKS_ECO * 3).map((d) => [d[0], d[1]]), fatigue: 0, camp: -1, campUntil: 0, lastCamp: this.step };
  let torchGiven = false;
  for (let i = 0; i < size; i++) {
    const j = jobs[i];
    const body = SPEC[Kind.Adventurer].body;
    const food = SPEC[Kind.Adventurer].cap;
    this.imported += body + food;
    this.originNext = 'entrance';
    const [dx0, dy0] = door < 0 ? [m.entrance.x * TILE + 8, TILE + 8] : this.mouthSpot(door);
    if (door >= 0) this.originNext = 'mouth';
    const c = this.spawn(Kind.Adventurer, dx0 + ((i % 3) - 1) * 8, dy0 + Math.floor(i / 3) * 8, body, food);
    c.sp = j;
    c.init = tier;
    c.party = pid;
    c.dir = 0;
    // 懐の金貨（持ち込み）
    const purse = ih(this.step, 210 + i, 7) % 8;
    c.gold = purse;
    this.goldIn += purse;
    // 僧侶は松明を掲げ、ほかに光がなければ戦士が一人松明を持つ。予備の松明を一本ずつ
    if (j === Job.Priest || (j === Job.Warrior && !torchGiven && !jobs.includes(Job.Wizard) && !jobs.includes(Job.Priest))) {
      c.torch = TORCH_FUEL;
      c.ref2 = 1;
      torchGiven = true;
    }
    party.members.push(c.id);
    this.counts[Kind.Adventurer]++;
    this.heroEnter(heroes[i], c, party);
  }
  party.name = heroes[0].name;
  this.parties.push(party);
  // 目標を一つ決める（噂と職業の役目から）
  this.chooseAim(party, jobs, gobHunt);
  // 町の知っている物資の置き場を覚え、深部の探索なら置き場に残す荷を背負う
  this.packForCaches(party);
  const names = heroes.map((h) => `${JOB_NAMES[h.job]}${h.name}${h.trips > 1 ? `（${RANK_NAMES[h.rank]}、${h.trips}度目）` : ''}`).join('・');
  const aim = this.aimPhrase(party);
  // 引退の前の最後の遠征：英雄が見習いを連れて入る
  const old = heroes.find((h) => h.last && h.rank >= 3);
  const ap = old ? (heroes.find((h) => h.rank === 0 && h.trips === 1 && h.job === old.job) ?? heroes.find((h) => h.rank === 0 && h.trips === 1)) : undefined;
  const farewell = old ? `英雄${old.name}の最後の遠征${ap ? `、見習いの${JOB_NAMES[ap.job]}${ap.name}を連れて` : ''}。` : '';
  if (old) this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: pid, ev: 'farewell', n: old.id, how: ap ? ap.id : 0, x: 0, y: 0 } as never);
  const who = `${farewell}${heroTitle(heroes[0])}の一行（${names}）が、${aim ? aim + '、' : ''}`;
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: pid, ev: 'enter', how: party.aim ?? 0, n: party.aimId ?? 0, to: party.aimKnown ?? 0, x: 0, y: 0 } as never);
  // 入口で身支度をして、食べ残しを少し落としていく
  if (door < 0) this.pendingScraps.push(pid);
  if (door < 0) this.log(m.entrance.x * TILE + 8, TILE + 8, `${who}入口から入ってきた`);
  else this.log(this.mouthSpot(door)[0], this.mouthSpot(door)[1], `${who}地表の横穴から入ってきた`);
}

/** 冒険者の一行の光（松明と光の呪文） */
export function partyLights(this: Ecology, p: Party): Cr[] {
  const out: Cr[] = [];
  for (const id of p.members) {
    const c = this.byId.get(id);
    if (c && !c.dead && (c.torch > 0 || c.sp === Job.Wizard)) out.push(c);
  }
  return out;
}

/** その者から見えるか：一行の光の中か、日の光や光る苔に照らされているか。盗賊は夜目が利く */
export function seenBy(this: Ecology, c: Cr, lights: Cr[], o: Cr): boolean {
  if ((o.st === 7 || o.st === 12) && this.isHidden(o) && !this.atDoorOf(c, o) && !this.searchesCamp(c, o)) return false;
  if (c.sp === Job.Thief && sq(o.x - c.x) + sq(o.y - c.y) < 3 * TILE * 3 * TILE) return true;
  for (const l of lights) if (sq(o.x - l.x) + sq(o.y - l.y) < 5.5 * TILE * 5.5 * TILE) return true;
  return this.isLit(o);
}

export function updateParties(this: Ecology): void {
  const m = this.w.map;
  this.rosterStep();
  for (const p of this.parties) {
    const alive = p.members.map((id) => this.byId.get(id)).filter((c): c is Cr => !!c && !c.dead);
    if (!alive.length && p.members.length) {
      const last = this.byId.get(p.members[p.members.length - 1]);
      if (!(p.saw & 16)) this.log(last?.x ?? 0, last?.y ?? 0, `${p.name ? p.name + 'の' : ''}冒険者の一行が全滅した`);
      // 担いでいた戦利品は、倒れた所に残る
      this.dropTrophy(p, last);
      // 一行の終わり：目標、着いたか、果たしたか、生きて帰ったか
      this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'end', how: p.aim ?? 0, reason: p.saw & 16 ? 'returned' : 'wiped', to: p.aimEnd ?? 0, n: p.aimId ?? 0, arrived: p.aimAt ? 1 : 0, x: Math.round(last?.x ?? 0), y: Math.round(last?.y ?? 0) } as never);
    }
    p.members = alive.map((c) => c.id);
    if (!alive.length) continue;
    this.aimStep(p, alive);
    this.cacheStep(p, alive);
    this.listenStep(p, alive);
    this.carryTrophy(p, alive);
    if (p.goal !== 0 && (p.camp ?? -1) >= 0) this.endCamp(p);
    if (p.goal === 0) {
      const lights = this.partyLights(p);
      let cap = 0;
      let held = 0;
      let hungry = false;
      for (const c of alive) {
        cap += GOLD_CAP[c.sp];
        held += c.gold;
        if (c.food < SPEC[Kind.Adventurer].cap * 0.25) hungry = true;
      }
      // 置き場をたどった一行は、そのぶん長く奥にいられる
      const tooLong = this.step - p.since > 10800 + 2500 * (p.cacheVis?.length ?? 0);
      const fewer = alive.length * 2 < p.initial;
      const dark = !lights.length;
      const slayer = alive.some((c) => c.sp === Job.Slayer);
      // 傷と疲れ：深手なら引き返し、疲れたか手傷を負ったら焚き火を囲んで休む
      let hpSum = 0;
      let worst = 1;
      for (const c of alive) {
        const r = c.hp > 0 ? c.hp / this.maxHp(c) : 1;
        hpSum += r;
        worst = Math.min(worst, r);
      }
      const avgHp = hpSum / alive.length;
      p.fatigue = (p.fatigue ?? 0) + 1;
      // 食料が乏しくなったら、早めに引き返す（帰り道の分を残す）
      const foodAvg = alive.reduce((a2, o) => a2 + o.food / SPEC[Kind.Adventurer].cap, 0) / alive.length;
      // 食料の残る置き場がすぐ先にあれば、着いて補ってから決める（引き返す判断は、置き場で補ったあとの量で）
      const ahead = this.cacheAhead(p, alive[0], foodAvg);
      if (hungry && ahead) hungry = false;
      if (foodAvg < 0.45 && p.goal === 0 && !ahead) {
        p.goal = 1;
        p.camp = -1;
        this.setExit(p);
        this.log(alive[0].x, alive[0].y, `冒険者の一行が食料が乏しくなり、引き返した`);
        continue;
      }
      if (avgHp < 0.35 && p.goal === 0) {
        p.goal = 1;
        p.camp = -1;
        this.setExit(p);
        this.log(alive[0].x, alive[0].y, `冒険者の一行が深手を負って引き返した`);
        continue;
      }
      // 地上が夜なら、早めに休む（夜は焚き火を囲む）
      // 休むのは、探索中で食料に余裕があるときだけ（帰り道では休まずに出口を目指す。目標に着いて果たすまでの間も休まない）
      // 置き場へ向かう途中と、場所を知った集落へ退治に向かう途中は休まない（置き場に着いてから、木箱のそばで休む。cacheStep）
      if (p.goal === 0 && foodAvg >= 0.5 && (p.camp ?? -1) < 0 && !(p.aimAt && !p.aimEnd) && !((p.cacheGo || (p.aim === 5 && p.aimKnown && !p.aimAt && !p.aimEnd)) && worst >= 0.5) && this.step - (p.lastCamp ?? 0) > 2500 && ((p.fatigue ?? 0) > 3600 || worst < 0.5 || (this.isNight() && (p.fatigue ?? 0) > 1200))) this.startCamp(p, alive[0]);
      if ((p.camp ?? -1) >= 0 && (p.goal !== 0 || foodAvg < 0.3)) this.endCamp(p);
      if ((p.camp ?? -1) >= 0 && this.step >= (p.campUntil ?? 0)) this.endCamp(p);
      if ((p.camp ?? -1) >= 0) this.watchDoze(p);
      if (held >= cap * 0.7 || hungry || tooLong || fewer || dark || ((p.saw & 8) !== 0 && !slayer)) {
        p.goal = 1;
        if ((p.camp ?? -1) >= 0) this.endCamp(p);
        this.setExit(p);
      }
    }
  }
  // 全滅した一行、出ていった一行を片づける
  this.parties = this.parties.filter((p) => p.members.length > 0);
}

export function cellOf(this: Ecology, x: number, y: number): number {
  const m = this.w.map;
  const cw = Math.ceil(m.w / CELL);
  return Math.floor(y / TILE / CELL) * cw + Math.floor(x / TILE / CELL);
}

/** 区画の中の、開いていて歩ける床（中心に近いもの）。なければ -1 */
export function cellFloor(this: Ecology, cell: number): number {
  const m = this.w.map;
  const cw = Math.ceil(m.w / CELL);
  const cx = (cell % cw) * CELL + CELL / 2;
  const cy = Math.floor(cell / cw) * CELL + CELL / 2;
  let best = -1;
  let bd = 1e9;
  for (let dy = -CELL / 2; dy < CELL / 2; dy++)
    for (let dx = -CELL / 2; dx < CELL / 2; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 40) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
  return best;
}

/** 一行の強さ（いまの体力を考えた合計） */
export function partyStr(this: Ecology, p: Party): number {
  let s = 0;
  for (const id of p.members) {
    const c = this.byId.get(id);
    if (c && !c.dead) s += this.str(c) * (c.hp > 0 ? c.hp / this.maxHp(c) : 1);
  }
  return s;
}

/**
 * 一行の行き先：
 * 1. 知っている宝の区画（自分たちが見たか、外の世界の地図にあるもの）
 * 2. まだ探していない区画のうち、探した区画に接する所（危ない区画は、一行が十分に強くなければ避ける）
 * 3. どれもなければ、入口から離れる向きのでたらめな所
 */
export function pickTarget(this: Ecology, p: Party, from: Cr): void {
  if (this.aimTarget(p, from)) return;
  // 場所を知らない目標（竜・アンデッド・集落など）は、知っている宝に寄り道せず、奥（深部）へ寄せて探す
  const deep = this.aimDeep(p);
  const m = this.w.map;
  const cw = Math.ceil(m.w / CELL);
  const ch = Math.ceil(m.h / CELL);
  const here = this.cellOf(from.x, from.y);
  const hx = here % cw;
  const hy = Math.floor(here / cw);
  const strength = this.partyStr(p);
  const danger = new Map<number, number>();
  for (const d of p.danger ?? []) danger.set(d[0], Math.max(danger.get(d[0]) ?? 0, d[1]));
  const risky = (cell: number) => (danger.get(cell) ?? 0) > strength * 0.7;
  if (p.goal === 0) {
    // 知っている宝
    let gbest = -1;
    let gd = 1e9;
    if (deep && p.aim !== 1) gd = -1;
    for (const g of p.goldCells ?? []) {
      if ((p.goneGold ?? []).includes(g) || risky(g)) continue;
      const d = Math.abs((g % cw) - hx) + Math.abs(Math.floor(g / cw) - hy);
      if (d < gd) {
        gd = d;
        gbest = g;
      }
    }
    if (gbest >= 0) {
      const k = this.cellFloor(gbest);
      if (k >= 0) {
        p.tx = (k % m.w) * TILE + 8;
        p.ty = Math.floor(k / m.w) * TILE + 8;
        p.targetAt = this.step;
        return;
      }
    }
    // まだ探していない区画
    const ex = new Set(p.explored ?? []);
    let best = -1;
    let bv = -1e9;
    for (let cy = 0; cy < ch; cy++)
      for (let cx = 0; cx < cw; cx++) {
        const cell = cy * cw + cx;
        if (ex.has(cell) || risky(cell)) continue;
        let edge = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (ex.has((cy + dy) * cw + cx + dx) && cx + dx >= 0 && cx + dx < cw) edge = true;
        if (!edge && ex.size) continue;
        const v = -(Math.abs(cx - hx) + Math.abs(cy - hy)) * 3 + (deep ? -(Math.abs(cx * CELL - m.deep.x) + Math.abs(cy * CELL - m.deep.y)) / CELL * 2 : cy * 0.5) + (ih(p.id, cell, 230) % 4);
        if (v <= bv) continue;
        if (this.cellFloor(cell) < 0) continue;
        bv = v;
        best = cell;
      }
    if (best >= 0) {
      const k = this.cellFloor(best);
      p.tx = (k % m.w) * TILE + 8;
      p.ty = Math.floor(k / m.w) * TILE + 8;
      p.targetAt = this.step;
      return;
    }
  }
  this.pickTargetRandom(p, from);
}

export function pickTargetRandom(this: Ecology, p: Party, from: Cr): void {
  const m = this.w.map;
  for (let i = 0; i < 40; i++) {
    const a = (ih(p.id, this.step, 220 + i) % 628) / 100;
    const r = (14 + (ih(p.id, this.step, 240 + i) % 22)) * TILE;
    const x = from.x + Math.cos(a) * r;
    const y = from.y + Math.sin(a) * r;
    const k = this.tileOf(x, y);
    if (k < 0 || m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 40) continue;
    // 入口から離れる向きを好む
    const dEnt = Math.abs(x / TILE - m.entrance.x) + y / TILE;
    const dNow = Math.abs(from.x / TILE - m.entrance.x) + from.y / TILE;
    if (dEnt < dNow - 4 && i < 30) continue;
    p.tx = (k % m.w) * TILE + 8;
    p.ty = Math.floor(k / m.w) * TILE + 8;
    p.targetAt = this.step;
    return;
  }
}

export function adventurer(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Adventurer];
  const m = this.w.map;
  let p = this.parties.find((q) => q.id === c.party);
  if (!p) {
    // 一行を失った（ほかの者が先に外へ出た）：一人の一行として、近い出口から外へ出る
    p = { id: this.nextId++, members: [c.id], goal: 1, tx: 0, ty: 0, since: this.step, tier: 0, initial: 1, saw: 16, targetAt: this.step, waitT: 0, bk: 0, bx: 0, by: 0, door: -1, mouths: [], explored: [], goldCells: [], goneGold: [], danger: [], fatigue: 0, camp: -1, campUntil: 0, lastCamp: this.step } as Party;
    this.parties.push(p);
    c.party = p.id;
    this.setExit(p);
  }
  // 松明が燃え尽きたら、燃えさしを捨てて予備に火をつける
  if (c.torch > 0) {
    c.torch--;
    if (c.torch === 0) {
      this.dropItem(c.x, c.y, ItemKind.Stub, 0);
      if (c.ref2 > 0) {
        c.ref2--;
        c.torch = TORCH_FUEL;
      }
    }
  }
  if (c.act === 2 && c.actT < 4) return;
  const lights = this.partyLights(p);
  const leader = this.byId.get(p.members[0]);
  // 探した範囲と、見かけた宝と、地表への別の横穴を覚える
  if (this.step % 20 === c.id % 20) {
    for (let i = 0; i < m.mouths.length; i++) {
      if (m.mouths[i].kind !== 0 || !this.mouthOpen(i) || (p.mouths ??= []).includes(i)) continue;
      const [mx, my] = this.mouthSpot(i);
      if (sq(mx - c.x) + sq(my - c.y) < 6 * TILE * 6 * TILE) p.mouths.push(i);
    }
    const cell = this.cellOf(c.x, c.y);
    if (!(p.explored ??= []).includes(cell)) p.explored.push(cell);
    for (const pl of this.piles) {
      if (sq(pl.x - c.x) + sq(pl.y - c.y) > 6 * TILE * 6 * TILE) continue;
      const gc = this.cellOf(pl.x, pl.y);
      if (!(p.goldCells ??= []).includes(gc)) p.goldCells.push(gc);
    }
    // 集落のかがり火は遠くから見える。見通しが利けば15マス先の集落を、宝のありそうな所として覚える
    for (const cp of this.camps) {
      if (cp.id < 0 || !(cp.fuel ?? 0)) continue;
      if (sq(cp.x - c.x) + sq(cp.y - c.y) > 15 * TILE * 15 * TILE || !lineOfSight(m, c.x, c.y, cp.x, cp.y)) continue;
      const cc = this.cellOf(cp.x, cp.y);
      if (!(p.goldCells ??= []).includes(cc)) p.goldCells.push(cc);
    }
    // 知っている宝の区画に来たのに宝がなければ、もうないと覚える
    if ((p.goldCells ?? []).includes(cell) && !this.piles.some((pl) => this.cellOf(pl.x, pl.y) === cell) && !(p.goneGold ??= []).includes(cell)) p.goneGold.push(cell);
  }
  // 見たものを噂の種に
  if (this.step % 20 === c.id % 20) {
    this.nearby(c.x, c.y, 6, (o) => {
      if (o.dead || o === c || !this.seenBy(c, lights, o)) return;
      if (o.k === Kind.Zombie || o.k === Kind.Ghost) p.saw |= 2;
      if (STR[o.k] >= 10 && o.k !== Kind.Adventurer && o.k !== Kind.Dragon && o.k !== Kind.Wyvern && o.k !== Kind.Worm && o.k !== Kind.Golem) {
        p.saw |= 4;
        if (STR[o.k] >= STR[p.bk] || !p.bk) {
          p.bk = o.k;
          p.bx = Math.round(o.x);
          p.by = Math.round(o.y);
        }
      }
      if (o.k === Kind.Skeleton || o.k === Kind.Lich) p.saw |= 2;
      // 危ない相手：一行より強そうなら区画を覚え、勝てそうになければ引き返す
      if (o.k !== Kind.Adventurer && STR[o.k] >= 6 && TIER[o.k] !== undefined) {
        const os = this.str(o) * (o.hp > 0 ? o.hp / this.maxHp(o) : 1);
        const ps = this.partyStr(p);
        if (os > ps * 0.7) {
          const dc = this.cellOf(o.x, o.y);
          const ex = (p.danger ??= []).find((d) => d[0] === dc);
          if (ex) ex[1] = Math.max(ex[1], Math.round(os));
          else p.danger.push([dc, Math.round(os)]);
          if (p.danger.length > 30) p.danger.shift();
          const slayerHunt = (o.k === Kind.Dragon || o.k === Kind.Wyvern || o.k === Kind.Worm) && p.members.some((id) => this.byId.get(id)?.sp === Job.Slayer);
          if (os > ps * 1.2 && !slayerHunt && p.goal === 0) {
            p.goal = 1;
            p.camp = -1;
            this.setExit(p);
            this.log(c.x, c.y, `冒険者の一行が{k:${o.k}}を見て、かなわないと引き返した`);
          }
        }
      }
      if (o.k === Kind.Dragon || o.k === Kind.Wyvern || o.k === Kind.Worm) {
        p.saw |= 8;
        p.dgx = Math.round(o.x);
        p.dgy = Math.round(o.y);
        // 寝床のドラゴンを、見通しの利く所から見た：そこまでの道が分かった（生きて帰れば町に知られる）
        if (o.k === Kind.Dragon && !p.dgId && lineOfSight(m, c.x, c.y, o.x, o.y)) {
          p.dgId = o.id;
          p.dgvx = Math.round(c.x);
          p.dgvy = Math.round(c.y);
        }
      }
    });
  }
  // 僧侶は足もとの死骸を清める（アンデッドとして起き上がらない）
  if (c.sp === Job.Priest && this.step % 10 === c.id % 10) {
    for (const o of this.corpses) if (o.st !== 99 && sq(o.x - c.x) + sq(o.y - c.y) < 20 * 20) o.st = 99;
  }
  // 戦う：三段階。気づく距離は灯りの届く範囲（5.5マス、光の中に見えている相手）。
  //  雑魚（大ネズミ、コウモリ、アリ、ウィスプ、マイコニド、サラマンダー、トカゲ、クモ、スライム）は、近く（2マス）に来たか、自分に害をなしたときに、通りがかりの一人が払う。
  //  手強い敵は、気づいた者が一行に知らせ、一行が皆で向かう。かなわない相手は避ける（引き返す）。
  //  盗賊はミミックを見破る以外は自分から戦わず、吟遊詩人は戦わない（どちらも襲われれば打ち返す）
  // 身構えて止まる（目標に着いたとき、目標でない住みかのそばを通るとき）。襲われている者は構えずに打ち返す
  if ((p.braceT ?? 0) > this.step && (p.camp ?? -1) < 0 && !(c.foe && this.w.tick - c.hitAt < 150)) {
    c.act = 0;
    const bx = p.braceX ?? c.x;
    const by = p.braceY ?? c.y;
    c.dir = Math.abs(bx - c.x) > Math.abs(by - c.y) ? (bx > c.x ? 2 : 3) : by > c.y ? 0 : 1;
    return;
  }
  const ENEMY = [Kind.Goblin, Kind.Kobold, Kind.Orc, Kind.Lizardman, Kind.Minotaur, Kind.Troll, Kind.Vampire, Kind.Zombie, Kind.Basilisk, Kind.Skeleton, Kind.Lich];
  // ウィスプは剣では払えない光なので、雑魚に含めない（誘われても追いかけて迷うだけ。魔法使いは瓶に捕まえる）
  const MINOR = [Kind.Rat, Kind.Bat, Kind.Ant, Kind.Myconid, Kind.Salamander, Kind.Lizard, Kind.Spider, Kind.Slime];
  if (c.sp === Job.Slayer) ENEMY.push(Kind.Dragon, Kind.Wyvern, Kind.Worm);
  let foe: Cr | null = null;
  let bd = 5.5 * TILE * 5.5 * TILE;
  // 一行で向かっている手強い敵がいれば、まずそれ
  if (p.engage) {
    const e = this.byId.get(p.engage);
    const runner = e && ((e.flee > 0 && STR[e.k] <= 3) || this.orcYields(p, e)) && !(e.id === c.foe && this.w.tick - c.hitAt < 150);
    if (e && !e.dead && !e.away && !runner && sq(e.x - c.x) + sq(e.y - c.y) < 10 * TILE * 10 * TILE && c.sp !== Job.Bard && c.sp !== Job.Thief) foe = e;
    else if (!e || e.dead || e.away || runner) p.engage = 0;
  }
  if (!foe)
    this.nearby(c.x, c.y, 6, (o) => {
      if (o.dead || o.away) return;
      const attacked = o.id === c.foe && this.w.tick - c.hitAt < 150;
      // 目標でない住民（住処・集落・村・縄張りの者）には、自分たちから戦いを始めない
      // 威嚇して退くオーク（src/eco/orc.ts の orcWary）も追わない
      const enemy = (ENEMY.includes(o.k) && !this.spareResident(p, c, o) && !this.orcYields(p, o)) || (o.k === Kind.Gargoyle && o.act !== 0) || (o.k === Kind.Mimic && c.sp === Job.Thief) || (c.sp === Job.Hunter && o.k === this.rumors.beastKind);
      const minor = MINOR.includes(o.k) && (o.k !== Kind.Bat || o.st === 0 || o.foe === c.id);
      if (!enemy && !minor && !attacked) return;
      if (!attacked && (c.sp === Job.Bard || (c.sp === Job.Thief && o.k !== Kind.Mimic))) return;
      if (!this.seenBy(c, lights, o)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      // 雑魚は、近く（2マス）に来たときか、自分に害をなしたときだけ払う
      if (minor && !enemy && !attacked && o.foe !== c.id && d > 2 * TILE * 2 * TILE) return;
      // 逃げていく弱い者（コボルトなど）は、追いかけて倒しには行かない
      if (!attacked && o.flee > 0 && STR[o.k] <= 3 && d > 1.5 * TILE * 1.5 * TILE) return;
      if (d < bd) {
        bd = d;
        foe = o;
      }
    });
  // 手強い敵に気づいたら、一行に知らせる（かなわない相手は、見張りの判断で引き返す）
  if (foe && !MINOR.includes((foe as Cr).k) && !p.engage && this.str(foe as Cr) <= this.partyStr(p) * 1.2) p.engage = (foe as Cr).id;
  // 逃げていく弱い者（コボルトなど）は、すぐそばにいなければ追わない（射かけもしない）
  if (foe && (foe as Cr).flee > 0 && STR[(foe as Cr).k] <= 3 && sq((foe as Cr).x - c.x) + sq((foe as Cr).y - c.y) > 14 * 14) {
    if (p.engage === (foe as Cr).id) p.engage = 0;
    foe = null;
  }
  if (foe) {
    const f = foe as Cr;
    this.markNotice(c, f, '!');
    c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
    if (c.sp === Job.Wizard) {
      // 炎の呪文：敵を焼き、足もとの苔も焼いてしまう
      c.act = 2;
      c.actT = 0;
      this.ignite(this.tileOf(f.x, f.y), 14);
      if (ih(c.id, f.id, this.step) % 3 === 0 && this.strike(c, f, 0.8)) this.die(f, 'fight', c.k);
      return;
    }
    if (c.sp === Job.Hunter) {
      // 弓：離れたところから射る（反撃を受けにくい）
      c.act = 2;
      c.actT = 0;
      if (ih(c.id, f.id, this.step) % 3 === 0 && this.strike(c, f, 0.9)) this.die(f, 'fight', c.k);
      return;
    }
    if (sq(f.x - c.x) + sq(f.y - c.y) < 14 * 14) {
      this.fight(c, f);
      return;
    }
    c.act = 1;
    this.goTo(c, f.x, f.y, s.speed);
    return;
  }
  // 見えない所の物音に耳を澄ましている（src/eco/listen.ts）：音の方を向いて止まり、前衛が前に出て構える
  if (this.listening(c, p)) return;
  // 害のない相手への、職業ごとの関わり方（気づいたら「？」）
  if (this.advInteract(c, p, lights)) return;
  // 金貨を拾う：見えている山（行きだけ）
  if (p.goal === 0 && c.gold < GOLD_CAP[c.sp]) {
    let pile: Pile | null = null;
    let pd = 7 * TILE * 7 * TILE;
    for (const o of this.piles) {
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d >= pd) continue;
      const k = this.tileOf(o.x, o.y);
      let vis = c.sp === Job.Thief && d < 4 * TILE * 4 * TILE;
      for (const l of lights) if (sq(o.x - l.x) + sq(o.y - l.y) < 5.5 * TILE * 5.5 * TILE) vis = true;
      if (!vis && !(k >= 0 && this.lit(k, day) > 0.35)) continue;
      pd = d;
      pile = o;
    }
    if (pile) {
      const pl = pile as Pile;
      p.saw |= 1;
      c.act = 1;
      if (sq(pl.x - c.x) + sq(pl.y - c.y) < 12 * 12) {
        const t = Math.min(pl.gold, GOLD_CAP[c.sp] - c.gold);
        pl.gold -= t;
        c.gold += t;
        // ドワーフの広間の宝の山なら、ドワーフに盗みが知れる
        if (this.hold && sq(pl.x - ((this.hold.hk % m.w) * TILE + 8)) + sq(pl.y - (Math.floor(this.hold.hk / m.w) * TILE + 8)) < 5 * TILE * 5 * TILE) {
          this.alarms.set('d', { t: this.step, foe: c.id, x: Math.round(pl.x), y: Math.round(pl.y) });
          if (this.step - (this.lastLogged[999] ?? -99999) > 1500) {
            this.lastLogged[999] = this.step;
            this.log(c.x, c.y, `冒険者が{k:${Kind.Dwarf}}の広間の宝を盗み、ドワーフが気づいた`);
          }
        }
        c.act = 2;
        c.actT = 0;
        this.piles = this.piles.filter((o) => o.gold > 0);
      } else this.goTo(c, pl.x, pl.y, s.speed);
      return;
    }
  }
  // 焚き火を囲んで休む：焚き火のまわりに座り、僧侶が皆を癒やす。見張りは外を向く
  if ((p.camp ?? -1) >= 0) {
    const fx = ((p.camp as number) % m.w) * TILE + 8;
    const fy = Math.floor((p.camp as number) / m.w) * TILE + 8;
    const idx = p.members.indexOf(c.id);
    let a = (idx / Math.max(1, p.members.length)) * 6.283;
    let sx = fx + Math.cos(a) * 14;
    let sy = fy + Math.sin(a) * 10;
    // 席が壁の中や溶岩の上なら、焚き火のまわりを少しずつ回って、座れる床を探す（壁際の焚き火では席の半分が壁にかかる）。
    // どこにも座れる床がなければ、焚き火のマスのそばに座る
    if (!this.campSeatOk(c, p.camp as number, sx, sy)) {
      let found = false;
      for (let j = 1; j < 24 && !found; j++) {
        const a2 = a + (j & 1 ? 1 : -1) * Math.ceil(j / 2) * 0.524;
        for (const r of [1, 0.6]) {
          const x2 = fx + Math.cos(a2) * 14 * r;
          const y2 = fy + Math.sin(a2) * 10 * r;
          if (this.campSeatOk(c, p.camp as number, x2, y2)) {
            a = a2;
            sx = x2;
            sy = y2;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        sx = fx + (idx % 3) - 1;
        sy = fy + 5;
      }
    }
    c.hx = fx;
    c.hy = fy;
    if (sq(sx - c.x) + sq(sy - c.y) > 8 * 8) {
      c.act = 1;
      this.goTo(c, sx, sy, s.speed);
      return;
    }
    c.act = 0;
    const watch = idx === 0;
    c.dir = watch ? (Math.cos(a) > 0 ? 2 : 3) : Math.abs(fx - c.x) > Math.abs(fy - c.y) ? (fx > c.x ? 2 : 3) : fy > c.y ? 0 : 1;
    if (c.sp === Job.Priest && this.step % 15 === c.id % 15) {
      for (const id of p.members) {
        const o = this.byId.get(id);
        if (o && !o.dead && sq(o.x - fx) + sq(o.y - fy) < 40 * 40) o.hp = Math.min(this.maxHp(o), (o.hp > 0 ? o.hp : this.maxHp(o)) + this.maxHp(o) / 20);
      }
      c.act = 2;
      c.actT = 0;
    }
    return;
  }
  // 引き返す一行は入口から外へ
  if (p.goal === 1 && ((Math.floor(c.y / TILE) <= 1 && Math.abs(Math.floor(c.x / TILE) - m.entrance.x) <= 2) || (p.tx !== m.entrance.x * TILE + 8 && sq(p.tx - c.x) + sq(p.ty - c.y) < 20 * 20))) {
    this.leaveDungeon(c, p);
    return;
  }
  // 進む：先頭は行き先へ、ほかは先頭について行く
  if (!leader || leader === c) {
    if (p.goal === 0 && (p.targetAt === 0 || this.step - p.targetAt > 900 || sq(p.tx - c.x) + sq(p.ty - c.y) < 20 * 20)) this.pickTarget(p, c);
    c.act = 1;
    // 光の外へは急がない（一行がそろうのを待つ）
    let far = false;
    for (const id of p.members) {
      const o = this.byId.get(id);
      if (o && !o.dead && sq(o.x - c.x) + sq(o.y - c.y) > 70 * 70) far = true;
    }
    if (far && p.waitT < 120) {
      p.waitT++;
      c.act = 0;
      return;
    }
    if (!far) p.waitT = 0;
    this.goTo(c, p.tx, p.ty, s.speed * 0.8);
    return;
  }
  const idx = p.members.indexOf(c.id);
  // 先頭の後ろに、少し間をあけて並ぶ
  const ox = [0, -14, 14, -8, 8][idx % 5];
  const oy = -[0, 10, 10, 22, 22][idx % 5];
  if (sq(leader.x + ox - c.x) + sq(leader.y + oy - c.y) > 22 * 22) {
    c.act = 1;
    this.goTo(c, leader.x + ox, leader.y + oy, s.speed);
  } else {
    c.act = leader.act === 1 ? 1 : 0;
    c.dir = leader.dir;
    if (leader.act === 1) this.moveToward(c, leader.x + ox, leader.y + oy, s.speed * 0.8);
  }
}

/** 引き返す先：正面の入口か、入ってきた口か、見つけた地表の横穴のうち、先頭にいちばん近いもの */
export function setExit(this: Ecology, p: Party): void {
  const m = this.w.map;
  const lead = this.byId.get(p.members[0]);
  const cands: [number, number][] = [[m.entrance.x * TILE + 8, TILE + 8]];
  for (const i of new Set([...(p.mouths ?? []), ...(p.door !== undefined && p.door >= 0 ? [p.door] : [])])) if (this.mouthOpen(i)) cands.push(this.mouthSpot(i));
  let best = cands[0];
  if (lead) {
    let bd = 1e18;
    for (const c of cands) {
      const d = sq(c[0] - lead.x) + sq(c[1] - lead.y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
  }
  p.tx = best[0];
  p.ty = best[1];
}

/** 焚き火の場所：近くの、壁に囲まれた所（袋小路や角）。水辺なら少し好む */
export function startCamp(this: Ecology, p: Party, leader: Cr, near?: { x: number; y: number }): void {
  const m = this.w.map;
  const hx = Math.floor((near ?? leader).x / TILE);
  const hy = Math.floor((near ?? leader).y / TILE);
  const R = near ? 2 : 8;
  let best = -1;
  let bv = -1e9;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const x = hx + dx;
      const y = hy + dy;
      if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.burn[k]) continue;
      // 置き場のそばで休むときは、木箱のマスそのものには焚き火を置かない
      if (near && k === this.tileOf(near.x, near.y)) continue;
      let walls = 0;
      let water = 0;
      for (let yy = -1; yy <= 1; yy++)
        for (let xx = -1; xx <= 1; xx++) {
          const q = k + yy * m.w + xx;
          if (m.solid[q]) walls++;
          if (this.w.water[q] > 20) water = 1;
        }
      if (walls > 5) continue;
      const v = walls * 3 + water * 4 - (Math.abs(dx) + Math.abs(dy)) * 0.5;
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
  if (best < 0) return;
  p.camp = best;
  // 夜は長めに休む（ゲーム内の夜のあいだ焚き火を囲む）
  p.campUntil = this.step + (this.isNight() ? 2400 : 1500);
  p.dozeT = 0;
  p.dozeNext = 0;
  this.log((best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, `冒険者の一行が焚き火を囲んで休みはじめた`);
}

/** 焚き火のまわりの席 (x, y) に座れるか：立てる床で、焚き火のマスか、その隣のマス（壁を隔てた向こうではない） */
export function campSeatOk(this: Ecology, c: Cr, fire: number, x: number, y: number): boolean {
  const k = this.tileOf(x, y);
  if (k < 0 || !this.tilePassable(c, k)) return false;
  const m = this.w.map;
  const dx = (k % m.w) - (fire % m.w);
  const dy = Math.floor(k / m.w) - Math.floor(fire / m.w);
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;
  // 斜めの隣は、間の二つのマスの少なくとも一つが床でないと、角をはさんで向こう側になる
  if (dx !== 0 && dy !== 0 && m.solid[fire + dx] && m.solid[fire + dy * m.w]) return false;
  return true;
}

export function endCamp(this: Ecology, p: Party): void {
  const k = p.camp ?? -1;
  // 焚き火の跡に灰が残る。食べ残しも少し落ちる
  if (k >= 0) {
    this.w.ash[k] = Math.max(this.w.ash[k], 200);
    this.dropScraps(p, (k % this.w.map.w) * TILE + 8, Math.floor(k / this.w.map.w) * TILE + 8, 3);
  }
  p.camp = -1;
  p.fatigue = 0;
  p.lastCamp = this.step;
}

/** 冒険者の食べ残し：一行の食料から少しずつ、その場所のまわりの土に落とす（キノコが生えやすくなる） */
export function dropScraps(this: Ecology, p: Party, x: number, y: number, per: number): void {
  for (const id of p.members) {
    const o = this.byId.get(id);
    if (!o || o.dead || o.food < per + 10) continue;
    o.food -= per;
    this.deposit(x + ((id % 5) - 2) * 6, y + ((id % 3) - 1) * 6, per);
  }
}

/** 入口から外へ出ていく：持ち出した金貨と養分を保存則の収支に計上し、見たものを噂に */
export function leaveDungeon(this: Ecology, c: Cr, p: Party): void {
  if (c.food > 12) {
    c.food -= 2;
    this.deposit(c.x, c.y + 10, 2);
  }
  this.record('exits', { t: this.w.tick, k: c.k, reason: 'returned', x: Math.round(c.x), y: Math.round(c.y) } as never);
  this.heroHome(c, true);
  this.w.manaLeaked += c.mana;
  c.mana = 0;
  // 生きて帰った者が、探した範囲と宝と危ない場所を、外の世界の地図に加える
  const lo = this.lore;
  for (const i of p.mouths ?? []) if (!(lo.mouths ??= []).includes(i)) lo.mouths.push(i);
  for (const e of p.explored ?? []) if (!lo.explored.includes(e)) lo.explored.push(e);
  for (const g of p.goldCells ?? []) if (!lo.gold.includes(g) && !(p.goneGold ?? []).includes(g)) lo.gold.push(g);
  lo.gold = lo.gold.filter((g) => !(p.goneGold ?? []).includes(g));
  for (const d of p.danger ?? []) {
    const ex = lo.danger.find((e) => e[0] === d[0]);
    if (ex) {
      ex[1] = d[1];
      ex[2] = this.w.tick;
    } else lo.danger.push([d[0], d[1], this.w.tick]);
  }
  lo.danger = lo.danger.filter((d) => this.w.tick - d[2] < DAY_TICKS_ECO * 3).slice(-60);
  p.saw |= 16;
  if (c.gold > 0) this.log(c.x, c.y, `冒険者（${JOB_NAMES[c.sp]}）が金貨${c.gold}枚を持って生きて帰った`);
  else if (p.members[0] === c.id) this.log(c.x, c.y, `冒険者の一行が引き返して外へ出た`);
  // 背負ってきた置き場の荷が残っていれば、それも持ち帰る
  this.exported += c.body + c.food + c.units;
  c.units = 0;
  this.goldOut += c.gold;
  this.tellCaches(p);
  this.bringTrophy(c, p);
  // 生きて帰った者が噂を持ち帰る
  const r = this.rumors;
  // 吟遊詩人が生きて帰れば噂は何倍にも広まり、吟遊詩人を失った一行の噂は細る
  let bard = 1;
  for (const id of p.members) {
    const o = this.byId.get(id);
    if (o && !o.dead && o.sp === Job.Bard) bard = 3;
  }
  if (c.sp === Job.Bard) bard = 3;
  const mul = bard;
  if (c.gold > 0 || p.saw & 1) r.gold += (0.15 + c.gold / 150) * mul;
  if (p.saw & 2) r.undead += 0.2 * mul;
  if (p.saw & 4) {
    r.beast += 0.2 * mul;
    if (p.bk) {
      r.beastKind = p.bk;
      r.beastX = p.bx;
      r.beastY = p.by;
    }
  }
  if (p.saw & 8) {
    r.dragon += 0.25 * mul;
    if (p.dgx || p.dgy) {
      r.dragonX = p.dgx ?? 0;
      r.dragonY = p.dgy ?? 0;
    }
  }
  // 竜の寝床への道（見通しの利く所から寝床のドラゴンを見た一行が持ち帰る）
  if (p.dgId && !(lo.dragonWay && lo.dragonWay[2] === p.dgId)) {
    lo.dragonWay = [p.dgvx ?? 0, p.dgvy ?? 0, p.dgId, this.w.tick];
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'way', n: p.dgId, x: p.dgvx ?? 0, y: p.dgvy ?? 0 } as never);
    this.log(c.x, c.y, `生きて帰った冒険者が、深部の{k:${Kind.Dragon}}の寝床への道を町に伝えた`);
  }
  // ゴブリンに荷物を盗まれた話（溜まると、ゴブリン退治の一行が来る）
  if (p.robbed) {
    r.goblin += 0.12 * Math.min(3, p.robbed) * mul;
    r.goblinX = p.robX ?? 0;
    r.goblinY = p.robY ?? 0;
    // 盗まれた回数と、盗みを働いた集落（一行で一度だけ伝える）。2回でゴブリン退治の一行が来る
    if (!p.robTold) {
      p.robTold = 1;
      r.goblinRobs += p.robbed;
      if (p.robCamp) {
        r.goblinCamp = p.robCamp;
        r.goblinCampX = p.robCX ?? 0;
        r.goblinCampY = p.robCY ?? 0;
      }
    }
  }
  c.body = 0;
  c.food = 0;
  c.gold = 0;
  c.dead = 2;
  this.returned++;
}

/** 倒れた者の持ち物を床に落とす（冒険者の道具） */
export function dropBelongings(this: Ecology, c: Cr): void {
  if (c.k === Kind.Skeleton && c.init) {
    this.dropJobItems(c);
    c.init = 0;
    return;
  }
  if (c.k === Kind.Goblin || c.k === Kind.Orc) {
    if (c.party) this.dropItem(c.x, c.y, c.party, 0);
    if (c.torch > 0) this.dropItem(c.x + 3, c.y, ItemKind.Torch, c.torch);
    else if (c.torch < 0) this.dropItem(c.x + 3, c.y, ItemKind.Stub, 0);
    c.party = 0;
    c.torch = 0;
    return;
  }
  if (c.k !== Kind.Adventurer) return;
  this.fallen++;
  this.log(c.x, c.y, `冒険者（${JOB_NAMES[c.sp]}）が倒れた`);
  const x = c.x;
  const y = c.y;
  if (c.torch > 0) this.dropItem(x + 4, y + 2, ItemKind.Torch, c.torch);
  c.torch = 0;
  this.dropJobItems(c);
  // 背負っていた荷（背負い袋と寝具）も、倒れた所に残る
  this.dropItem(x - 6, y - 3, ItemKind.Pack, 0);
  c.party = 0;
}

export function dropJobItems(this: Ecology, c: Cr): void {
  Ecology.JOB_ITEMS[c.sp].forEach((kd, i) => this.dropItem(c.x - 4 + i * 7, c.y + 3 - i * 2, kd, 0));
}

export function dropItem(this: Ecology, x: number, y: number, kind: number, fuel: number): void {
  this.gear.push({ id: this.nextId++, x: Math.round(x), y: Math.round(y), kind, fuel });
  // 古い燃えさしから片づける（道具が増えすぎないように）
  if (this.gear.length > 160) {
    const i = this.gear.findIndex((o) => o.kind === ItemKind.Stub);
    this.gear.splice(i >= 0 ? i : 0, 1);
  }
}

/** 床に落ちた松明は燃え続け、燃え尽きると燃えさしになる */
export function updateItems(this: Ecology): void {
  for (const it of this.gear) {
    if (it.kind !== ItemKind.Torch) continue;
    it.fuel--;
    if (it.fuel <= 0) it.kind = ItemKind.Stub;
  }
}

/** 光源（松明、光の呪文、床で燃える松明）。描画と「見たマス」の記録に使う */
/** 光源を順に（lightSources と同じ順・同じ値。配列や物を作らない） */
export function eachLight(this: Ecology, fn: (x: number, y: number, r: number, i: number, cr: number, cg: number, cb: number) => void): void {
  for (const c of this.list) {
    if (c.dead) continue;
    if (c.k === Kind.Goblin && c.torch > 0) fn(c.x, c.y - 12, 80, 1.0, 1.0, 0.6, 0.28);
    if (c.k === Kind.Lich) fn(c.x, c.y - 16, 56, 0.6, 0.7, 0.45, 1.0);
    // もともと光る種：自分のまわり2〜3マスを、本当に照らす
    if (c.elite === 1) fn(c.x, c.y - 12, 64, 0.8, 1.0, 0.55, 0.22);
    else if (c.elite === 2) fn(c.x, c.y - 14, 40, 0.4, 0.6, 0.8, 1.0);
    else if (c.elite === 6) fn(c.x, c.y - 10, 44, 0.4, 0.5, 0.8, 1.0);
    else if (c.elite === 7) fn(c.x, c.y - 12, 72, 0.7, 1.0, 0.95, 0.8);
    else if (c.elite === 9) fn(c.x, c.y - 14, 52, 0.45, 0.6, 1.0, 0.55);
    else if (c.k === Kind.Wisp) fn(c.x, c.y - 10, 40, 0.55, 0.55, 1.0, 0.8);
    else if (c.k === Kind.Myconid) fn(c.x, c.y - 8, 36, 0.45, 0.7, 1.0, 0.6);
    else if (c.k === Kind.Slime) fn(c.x, c.y - 4, 30, 0.4, 0.55, 1.0, 0.5);
    else if (c.k === Kind.Ghost) fn(c.x, c.y - 12, 44, 0.5, 0.7, 0.85, 1.0);
    if (c.k === Kind.Dwarf && c.sp === 0) fn(c.x, c.y - 10, 52, 0.75, 1.0, 0.82, 0.5);
    if (c.k !== Kind.Adventurer) continue;
    if (c.torch > 0) fn(c.x, c.y - 14, 92, 1.1, 1.0, 0.62, 0.3);
    else if (c.sp === Job.Wizard) fn(c.x, c.y - 18, 80, 0.9, 0.72, 0.86, 1.0);
  }
  // 鍛冶場の火と坑道のランプ、冒険者の焚き火
  const mw = this.w.map.w;
  for (const cp of this.camps) if (cp.id >= 0 && (cp.fuel ?? 0) > 0) fn(cp.x, cp.y + 6, 140, 1.25, 1.0, 0.58, 0.26);
  for (const p of this.parties) if ((p.camp ?? -1) >= 0) fn(((p.camp as number) % mw) * TILE + 8, Math.floor((p.camp as number) / mw) * TILE + 4, 120, 1.25, 1.0, 0.6, 0.28);
  if (this.hold && this.hold.forge >= 0) fn((this.hold.forge % mw) * TILE + 8, Math.floor(this.hold.forge / mw) * TILE + 2, 130, 1.3, 1.0, 0.55, 0.22);
  for (const k of this.lamps) fn((k % mw) * TILE + 8, Math.floor(k / mw) * TILE + 2, 64, 0.8, 1.0, 0.85, 0.55);
  for (const it of this.gear) if (it.kind === ItemKind.Torch) fn(it.x, it.y - 4, 52, 0.7, 1.0, 0.6, 0.28);
}

export function lightSources(this: Ecology): { x: number; y: number; r: number; i: number; c: [number, number, number] }[] {
  const out: { x: number; y: number; r: number; i: number; c: [number, number, number] }[] = [];
  this.eachLight((x, y, r, i, cr, cg, cb) => out.push({ x, y, r, i, c: [cr, cg, cb] }));
  return out;
}

declare module '../ecology' {
  interface Ecology {
    reputation: typeof reputation;
    maybeParty: typeof maybeParty;
    partyLights: typeof partyLights;
    seenBy: typeof seenBy;
    updateParties: typeof updateParties;
    cellOf: typeof cellOf;
    cellFloor: typeof cellFloor;
    partyStr: typeof partyStr;
    pickTarget: typeof pickTarget;
    pickTargetRandom: typeof pickTargetRandom;
    adventurer: typeof adventurer;
    setExit: typeof setExit;
    startCamp: typeof startCamp;
    endCamp: typeof endCamp;
    campSeatOk: typeof campSeatOk;
    dropScraps: typeof dropScraps;
    leaveDungeon: typeof leaveDungeon;
    dropBelongings: typeof dropBelongings;
    dropJobItems: typeof dropJobItems;
    dropItem: typeof dropItem;
    updateItems: typeof updateItems;
    eachLight: typeof eachLight;
    lightSources: typeof lightSources;
  }
}

Object.assign(Ecology.prototype, { reputation, maybeParty, partyLights, seenBy, updateParties, cellOf, cellFloor, partyStr, pickTarget, pickTargetRandom, adventurer, setExit, startCamp, endCamp, campSeatOk, dropScraps, leaveDungeon, dropBelongings, dropJobItems, dropItem, updateItems, eachLight, lightSources });
