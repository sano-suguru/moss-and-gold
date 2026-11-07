/**
 * Ecology のメソッド：物資の置き場（冒険者の作り直しの三歩目）。
 *
 * 見せたい瞬間：深部の探索の一行が、行けた一番奥に木箱と寝具（物資の置き場）を残して引き返す。
 * 次の一行はそこで食料を補ってさらに奥へ進み、新しい置き場を残す。遠征を重ねるたびに置き場が奥へ伸び、
 * ついに竜退治の一行が置き場をたどって寝床に着く。置き場は大ネズミにあさられることがあり、空になった木箱は残骸として残る。
 * 蓄えの乏しいゴブリンの集落からは、歩いて行ける所にある置き場へ、1〜2匹が暗がりづたいに食料を取りに出る。
 * 木箱をあさって袋に詰め、集落へ持ち帰る（人がそばにいれば手を出さずに帰る）。
 *
 * 状態：Ecology.caches（SupplyCache。セーブデータでは SC）、町の知識 Lore.caches、一行の cacheKnown / cacheVis / cacheD / cacheGo / cacheMine。
 * 深部の探索の一行の者は、置き場に残す食料の荷（Cr.units）を背負って入ってくる（入るときに imported に足す。養分の保存則に含まれる）。
 */
import { Cr, DAY_TICKS_ECO, Ecology, Kind, Party, SPEC, SupplyCache, ih, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 深部の探索の一行の者が背負ってくる、置き場に残す食料の荷 */
export const CACHE_PACK = 60;
/** これより入口に近い所（歩いて、マス）には置き場を残さない（荷は持ち帰る） */
const CACHE_MIN_D = 30;
/** 置き場の数の上限（超えたら、古い空の置き場から片づける） */
const CACHE_MAX = 14;
/** 置き場で食料を補う間合い（px） */
const CACHE_R = 3.5 * TILE;

/** 置き場へ食料を取りに出る集落の、蓄えの乏しさ（蓄えの目安に対する割合） */
const CRAID_STORE = 0.9;
/** 置き場へ食料を取りに出る遠さ（集落から歩いて、マス） */
const CRAID_R = 70;
/** 置かれてから、ゴブリンに嗅ぎつけられるまで（tick）。そのあいだは置いた一行のあとの一行が先に使える */
const CRAID_AGE = DAY_TICKS_ECO / 4;
/** 置き場で食料を取りに出た者があきらめて帰るまで（出てからの生き物の更新の回数） */
const CRAID_GIVEUP = 3000;
/** 木箱をあさる長さ（生き物の更新の回数。1回に3ずつ袋に詰める） */
const CRAID_DIG = 12;

/** 置き場をたどる一行：深部の探索と竜退治 */
function followsCaches(p: Party): boolean {
  return p.aim === 6 || p.aim === 2;
}

/** 一行が入ってくるとき（chooseAim のあと）：町の知っている置き場を覚え、深部の探索なら荷を背負う */
export function packForCaches(this: Ecology, p: Party): void {
  p.cacheKnown = (this.lore.caches ?? []).filter((id) => this.caches.some((o) => o.id === id));
  p.cacheVis = [];
  p.cacheD = 0;
  p.cacheGo = 0;
  p.cacheMine = [];
  if (p.aim !== 6) return;
  for (const id of p.members) {
    const c = this.byId.get(id);
    if (!c || c.dead) continue;
    c.units = CACHE_PACK;
    this.imported += CACHE_PACK;
  }
}

/**
 * 次にたどる置き場：目指す所（竜退治なら道の先か竜を見かけた噂の場所、深部の探索なら深部）にいちばん近い、まだたどっていない知った置き場。
 * いまいる所より目指す所に近いものだけ（遠征を重ねて奥へ伸びた置き場の、いちばん奥へまっすぐ向かう。途中の置き場は、そばを通れば補う）
 */
export function nextCache(this: Ecology, p: Party, from?: Cr): SupplyCache | undefined {
  if (!followsCaches(p) || p.goal !== 0 || p.aimAt || p.aimEnd === 1) return undefined;
  const lead = from ?? this.byId.get(p.members[0]);
  if (!lead) return undefined;
  const m = this.w.map;
  const r = this.rumors;
  const [gx, gy] = p.aim === 2 && p.aimKnown ? [p.aimX ?? 0, p.aimY ?? 0] : p.aim === 2 && (r.dragonX || r.dragonY) ? [r.dragonX, r.dragonY] : [m.deep.x * TILE + 8, m.deep.y * TILE + 8];
  let best: SupplyCache | undefined;
  let bd = sq(gx - lead.x) + sq(gy - lead.y) - 8 * TILE * 8 * TILE;
  for (const id of p.cacheKnown ?? []) {
    if ((p.cacheVis ?? []).includes(id)) continue;
    const o = this.caches.find((q) => q.id === id);
    if (!o || o.d < 0) continue;
    const d = sq(gx - o.x) + sq(gy - o.y);
    if (d < bd || (d === bd && best && o.id < best.id)) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/** 行き先を次の置き場に（aimTarget の初め）。true なら決めた */
export function cacheTarget(this: Ecology, p: Party, from?: Cr): boolean {
  const o = p.cacheGo ? this.caches.find((q) => q.id === p.cacheGo && !(p.cacheVis ?? []).includes(q.id)) ?? this.nextCache(p, from) : this.nextCache(p, from);
  p.cacheGo = o ? o.id : 0;
  if (!o) return false;
  p.tx = o.x;
  p.ty = o.y;
  p.targetAt = this.step;
  return true;
}

/** 引き返すのを少し待つか：食料の乏しい一行も、食料の残る置き場へ向かう途中でそこが近ければ（30マス）、着いて補ってから決める */
export function cacheAhead(this: Ecology, p: Party, lead: Cr, foodAvg: number): boolean {
  if (!p.cacheGo || foodAvg < 0.3) return false;
  const o = this.caches.find((q) => q.id === p.cacheGo);
  return !!o && o.food >= 10 && sq(o.x - lead.x) + sq(o.y - lead.y) < 30 * TILE * 30 * TILE;
}

/**
 * 置き場まわりの一行の動き（updateParties から、毎歩）：
 * 置き場のそばの者は食料を補う（奥へ向かう間は腹いっぱいまで、帰り道は乏しいときだけ半分まで）、先頭が着いたらたどり終える、
 * 引き返しはじめた深部の探索の一行は、その場に荷を下ろして置き場を残す
 */
export function cacheStep(this: Ecology, p: Party, alive: Cr[]): void {
  const lead = alive[0];
  if (p.goal !== 0 && p.aim === 6 && !(p.cacheMine ?? []).includes(-1) && alive.some((c) => c.units > 0)) this.dropCache(p, alive);
  if (!this.caches.length || this.step % 3 !== p.id % 3) return;
  const cap = SPEC[Kind.Adventurer].cap;
  for (const o of this.caches) {
    if (!(p.cacheKnown ?? []).includes(o.id)) continue;
    const dl = sq(o.x - lead.x) + sq(o.y - lead.y);
    if (o.food > 0) {
      let got = 0;
      for (const c of alive) {
        if (sq(o.x - c.x) + sq(o.y - c.y) > CACHE_R * CACHE_R) continue;
        const want = p.goal === 0 ? cap - c.food : c.food < cap * 0.4 ? cap * 0.6 - c.food : 0;
        const take = Math.max(0, Math.min(Math.floor(want), o.food));
        if (take <= 0) continue;
        o.food -= take;
        c.food += take;
        c.hungry = 0;
        c.act = 2;
        c.actT = 0;
        got += take;
      }
      if (got > 0) {
        this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'supply', n: got, to: o.id, how: o.d, left: o.food, back: p.goal, x: Math.round(o.x), y: Math.round(o.y) } as never);
        if (this.step - (this.lastLogged[984] ?? -99999) > 1500) {
          this.lastLogged[984] = this.step;
          this.log(o.x, o.y, o.food > 0 ? `${p.name ?? ''}の一行が物資の置き場で食料を補った` : `${p.name ?? ''}の一行が物資の置き場の食料を食べ尽くした。木箱は空になった`);
        }
      }
    }
    // 先頭が着いたら（あるいは歩いて行けなければ）、たどり終えて次へ
    if (p.cacheGo === o.id) {
      const pp = this.paths.get(lead.id);
      const stuck = !!pp && pp.path.length === 0 && pp.gk === this.tileOf(o.x, o.y) && dl > 3 * TILE * 3 * TILE;
      if (dl < 1.5 * TILE * 1.5 * TILE || stuck) {
        (p.cacheVis ??= []).push(o.id);
        if (!stuck) p.cacheD = Math.max(p.cacheD ?? 0, o.d);
        p.cacheGo = 0;
        p.targetAt = 0;
        // 着いたら、木箱のそばで焚き火を囲んで休む（休むあいだも置き場の食料で腹を満たすので、発つときには腹いっぱい）
        // （竜や手強い相手のそば、目標のすぐ手前の置き場では休まない）
        if (!stuck && p.goal === 0 && (p.camp ?? -1) < 0 && o.food > 0 && ((p.fatigue ?? 0) > 800 || this.isNight()) && !this.cacheUnsafe(p, o)) this.startCamp(p, lead, o);
      }
    }
  }
}

/** 置き場で休むには危ないか：竜（12マス）か、一行の強さの7割を超える相手（8マス）がそばにいるか、目指す相手が15マスより近い */
export function cacheUnsafe(this: Ecology, p: Party, o: SupplyCache): boolean {
  if (p.aimKnown && sq((p.aimX ?? 0) - o.x) + sq((p.aimY ?? 0) - o.y) < 15 * TILE * 15 * TILE) return true;
  const ps = this.partyStr(p);
  let bad = false;
  this.nearby(o.x, o.y, 12, (q) => {
    if (bad || q.dead || q.away || q.k === Kind.Adventurer || q.k === Kind.Dwarf) return;
    const d = sq(q.x - o.x) + sq(q.y - o.y);
    if ((q.k === Kind.Dragon || q.k === Kind.Wyvern) && d < 12 * TILE * 12 * TILE) bad = true;
    else if (d < 8 * TILE * 8 * TILE && this.str(q) > ps * 0.7) bad = true;
  });
  return bad;
}

/** 引き返す所に荷を下ろして、置き場を残す（近くに置き場があれば、そこに足す） */
export function dropCache(this: Ecology, p: Party, alive: Cr[]): void {
  const m = this.w.map;
  const lead = alive[0];
  let food = 0;
  for (const c of alive) food += c.units;
  if (food <= 0) return;
  // 置く所：先頭のまわりの、壁ぎわの開いた床
  const hx = Math.floor(lead.x / TILE);
  const hy = Math.floor(lead.y / TILE);
  let k = -1;
  let bv = -1e9;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = hx + dx;
      const y = hy + dy;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const q = y * m.w + x;
      if (m.solid[q] || m.sealed[q] || m.lava[q] || this.w.water[q] > 10) continue;
      const walls = m.solid[q - 1] + m.solid[q + 1] + m.solid[q - m.w] + m.solid[q + m.w];
      const v = (walls > 0 && walls < 3 ? 3 : 0) - Math.abs(dx) - Math.abs(dy);
      if (v > bv) {
        bv = v;
        k = q;
      }
    }
  if (k < 0) return;
  const ent = 1 * m.w + m.entrance.x;
  const d = this.walkDist(k, 900)[ent];
  // 入口のそばでは置かない（荷はそのまま持ち帰る）
  if (d >= 0 && d < CACHE_MIN_D) {
    (p.cacheMine ??= []).push(-1);
    return;
  }
  for (const c of alive) c.units = 0;
  const x = (k % m.w) * TILE + 8;
  const y = Math.floor(k / m.w) * TILE + 8;
  let o = this.caches.find((q) => sq(q.x - x) + sq(q.y - y) < 6 * TILE * 6 * TILE);
  const merged = !!o;
  if (o) o.food += food;
  else {
    o = { id: this.nextId++, x, y, food, d, at: this.w.tick, by: p.id, rt: -1e9 };
    this.caches.push(o);
    this.note(o.id, this.partyNote(p));
    // 多すぎれば、古い空の置き場（残骸）から片づける
    while (this.caches.length > CACHE_MAX) {
      const i = this.caches.findIndex((q) => q.food <= 0);
      if (i < 0) break;
      this.caches.splice(i, 1);
    }
  }
  (p.cacheMine ??= []).push(o.id);
  if (!(p.cacheKnown ??= []).includes(o.id)) p.cacheKnown.push(o.id);
  if (!(p.cacheVis ??= []).includes(o.id)) p.cacheVis.push(o.id);
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'cache', n: food, to: o.id, how: o.d, merged: merged ? 1 : 0, x: Math.round(o.x), y: Math.round(o.y) } as never);
  this.log(o.x, o.y, `${p.name ?? ''}の一行が、行けた一番奥に物資の置き場（木箱と寝具）を残して引き返した`);
}

/** 生きて帰った一行が、残した置き場を町に伝える（leaveDungeon から） */
export function tellCaches(this: Ecology, p: Party): void {
  const lo = this.lore;
  for (const id of p.cacheMine ?? []) if (!(lo.caches ??= []).includes(id)) lo.caches.push(id);
  if (lo.caches) lo.caches = lo.caches.filter((id) => this.caches.some((o) => o.id === id));
}

/** 腹を空かせた大ネズミは、近く（6マス）の置き場の食料をあさる。true ならそうしている */
export function ratRaidCache(this: Ecology, c: Cr): boolean {
  if (!this.caches.length || c.food >= SPEC[Kind.Rat].cap * 0.5) return false;
  let o: SupplyCache | undefined;
  let bd = 6 * TILE * 6 * TILE;
  for (const q of this.caches) {
    if (q.food <= 0) continue;
    const d = sq(q.x - c.x) + sq(q.y - c.y);
    if (d < bd) {
      bd = d;
      o = q;
    }
  }
  if (!o) return false;
  // 人のそば（4マス）の置き場には近寄らない
  let people = false;
  this.nearby(o.x, o.y, 4, (q) => {
    if (!q.dead && !q.away && (q.k === Kind.Adventurer || q.k === Kind.Dwarf)) people = true;
  });
  if (people) return false;
  if (bd > 10 * 10) {
    c.act = 1;
    this.goTo(c, o.x + ((c.id % 3) - 1) * 6, o.y + 4, SPEC[Kind.Rat].speed);
    return true;
  }
  const take = Math.min(2, o.food, SPEC[Kind.Rat].cap - c.food);
  if (take <= 0) return false;
  o.food -= take;
  c.food += take;
  c.hungry = 0;
  c.sinceMeal = 0;
  c.act = 2;
  c.actT = 0;
  c.dir = o.x > c.x ? 2 : 3;
  if (this.w.tick - o.rt > 600) this.record('settle', { t: this.w.tick, k: Kind.Rat, id: c.id, ev: 'cache', n: o.food, to: o.id, x: Math.round(o.x), y: Math.round(o.y) } as never);
  if (this.w.tick - o.rt > 3000 && this.step - (this.lastLogged[983] ?? -99999) > 1500) {
    this.lastLogged[983] = this.step;
    this.log(o.x, o.y, `{k:${Kind.Rat}}が冒険者の物資の置き場をあさっている`);
  }
  o.rt = this.w.tick;
  return true;
}

/** 置き場のそば（R マス）に、生きている冒険者かドワーフがいるか */
function peopleNear(eco: Ecology, o: SupplyCache, R: number): boolean {
  let people = false;
  eco.nearby(o.x, o.y, R, (q) => {
    if (!q.dead && !q.away && (q.k === Kind.Adventurer || q.k === Kind.Dwarf)) people = true;
  });
  return people;
}

/**
 * 置き場へ食料を取りに出る（生き物の更新50回ごと。昼も夜も）：蓄えが目安の9割に足りない集落から、歩いて70マスの内に
 * 置かれてゲーム内の1/4日より古い、食料の残る置き場があれば（そばに人がいなければ）、1匹（ときどき2匹）が取りに出る。
 * 出た者が戻るまでと、出てからゲーム内の1/3日は、次は出ない。行ける置き場がなければ、ゲーム内の1/8日は探し直さない
 */
export function planCacheRaids(this: Ecology): void {
  if (!this.caches.some((o) => o.food >= 10)) return;
  const s = SPEC[Kind.Goblin];
  for (const cp of this.camps) {
    if (cp.id < 0 || cp.kind !== 0 || cp.hide || (cp.cacheT ?? 0) > this.w.tick) continue;
    if ((cp.store ?? 0) >= this.campStoreGoal(cp) * CRAID_STORE) continue;
    const members = this.campMembers(cp);
    if (!members.length || members.some((c) => c.st >= 15 && c.st <= 18)) continue;
    const ready = members.filter((c) => c.flee <= 0 && c.sleep === 0 && !c.away && (c.st === 0 || c.st === 3 || c.st === 4) && c.hungry < s.starve * 0.6 && c.units < 10);
    if (!ready.length) continue;
    const wd = this.walkDist(this.tileOf(cp.x, cp.y), CRAID_R);
    let o: SupplyCache | undefined;
    let bd = 1e9;
    for (const q of this.caches) {
      if (q.food < 10 || this.w.tick - q.at < CRAID_AGE) continue;
      const d = wd[this.tileOf(q.x, q.y)];
      if (d < 0 || d > bd || (d === bd && o && q.id > o.id) || peopleNear(this, q, 6)) continue;
      bd = d;
      o = q;
    }
    if (!o) {
      cp.cacheT = this.w.tick + DAY_TICKS_ECO / 8;
      continue;
    }
    const tgt = o;
    ready.sort((a, b) => sq(a.x - tgt.x) + sq(a.y - tgt.y) - (sq(b.x - tgt.x) + sq(b.y - tgt.y)) || a.id - b.id);
    const n = Math.min(ready.length, ih(cp.id, this.step, 300) % 3 === 0 ? 2 : 1);
    for (let i = 0; i < n; i++) {
      const c = ready[i];
      c.st = 18;
      c.lure = tgt.id;
      c.lureAt = this.step;
      c.gait = 0;
      c.ref2 = 0;
    }
    cp.cacheT = this.w.tick + DAY_TICKS_ECO / 3;
    this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'cacheGo', n, to: tgt.id, how: bd, x: Math.round(tgt.x), y: Math.round(tgt.y) } as never);
    if (this.step - (this.lastLogged[979] ?? -99999) > 1500) {
      this.lastLogged[979] = this.step;
      this.log(cp.x, cp.y, `蓄えの乏しい集落の{k:${Kind.Goblin}}が、冒険者の残した物資の置き場へ、食料を取りに暗がりを出ていった`);
    }
  }
}

/**
 * 置き場へ食料を取りに出たゴブリン（st 18。lure は置き場の番号、gait はあさった回数、ref2 は袋に詰めた分）。true なら、この回の更新はこれで終わり。
 * 暗がりを選んで置き場へ行き、木箱をあさって袋（40まで）に詰め、集落へ逃げ帰る（st 16。持ち帰った分は蓄えに）。
 * 置き場のそば（5マス）に人がいるか、空になっていたか、長くかかりすぎたら、手ぶら（か、それまでに詰めた分だけ）で帰る
 */
export function goblinCacheRaid(this: Ecology, c: Cr): boolean {
  const s = SPEC[Kind.Goblin];
  const cp = this.campOf(c);
  if (!cp || cp.kind !== 0) {
    c.st = 0;
    c.lure = 0;
    return false;
  }
  const o = this.caches.find((q) => q.id === c.lure);
  const back = () => {
    if (o && c.ref2 > 0) {
      this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'cacheLoot', n: c.ref2, to: o.id, how: o.food, x: Math.round(o.x), y: Math.round(o.y) } as never);
      if (this.step - (this.lastLogged[978] ?? -99999) > 1500) {
        this.lastLogged[978] = this.step;
        this.log(o.x, o.y, o.food > 0 ? `{k:${Kind.Goblin}}が冒険者の物資の置き場の木箱をあさり、食料を袋に詰めて集落へ持ち帰った` : `{k:${Kind.Goblin}}が冒険者の物資の置き場の食料を持ち去った。木箱は空になった`);
      }
    }
    c.st = 16;
    c.lure = 0;
    c.gait = 0;
    return this.goblinRaid(c);
  };
  if (!o || o.food <= 0 || this.step - c.lureAt > CRAID_GIVEUP || c.hungry > s.starve * 0.8 || peopleNear(this, o, 5)) return back();
  const d2 = sq(o.x - c.x) + sq(o.y - c.y);
  if (d2 > 12 * 12) {
    c.act = 1;
    this.goTo(c, o.x + ((c.id % 3) - 1) * 6, o.y + 4, s.speed * 1.1);
    return true;
  }
  // 木箱をあさって、袋に詰める
  const take = Math.min(3, o.food, 40 - c.units);
  if (take > 0) {
    o.food -= take;
    c.units += take;
    c.ref2 += take;
  }
  o.rt = this.w.tick;
  c.act = 2;
  c.actT = 0;
  c.dir = o.x > c.x ? 2 : 3;
  if (take <= 0 || c.units >= 40 || o.food <= 0 || ++c.gait >= CRAID_DIG) return back();
  return true;
}

declare module '../ecology' {
  interface Ecology {
    packForCaches: typeof packForCaches;
    nextCache: typeof nextCache;
    cacheTarget: typeof cacheTarget;
    cacheAhead: typeof cacheAhead;
    cacheStep: typeof cacheStep;
    dropCache: typeof dropCache;
    cacheUnsafe: typeof cacheUnsafe;
    tellCaches: typeof tellCaches;
    ratRaidCache: typeof ratRaidCache;
    planCacheRaids: typeof planCacheRaids;
    goblinCacheRaid: typeof goblinCacheRaid;
  }
}

Object.assign(Ecology.prototype, { packForCaches, nextCache, cacheTarget, cacheAhead, cacheStep, dropCache, cacheUnsafe, tellCaches, ratRaidCache, planCacheRaids, goblinCacheRaid });
