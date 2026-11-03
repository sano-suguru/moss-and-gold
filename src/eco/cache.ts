/**
 * Ecology のメソッド：物資の置き場（冒険者の作り直しの三歩目）。
 *
 * 見せたい瞬間：深部の探索の一行が、行けた一番奥に木箱と寝具（物資の置き場）を残して引き返す。
 * 次の一行はそこで食料を補ってさらに奥へ進み、新しい置き場を残す。遠征を重ねるたびに置き場が奥へ伸び、
 * ついに竜退治の一行が置き場をたどって寝床に着く。置き場は大ネズミにあさられることがあり、空になった木箱は残骸として残る。
 *
 * 状態：Ecology.caches（SupplyCache、保存は SC）、町の知識 Lore.caches、一行の cacheKnown / cacheVis / cacheD / cacheGo / cacheMine。
 * 深部の探索の一行の者は、置き場に残す食料の荷（Cr.units）を背負って入ってくる（入るときに imported に足す。養分の帳簿に入る）。
 */
import { Cr, Ecology, Kind, Party, SPEC, SupplyCache, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 深部の探索の一行の者が背負ってくる、置き場に残す食料の荷 */
export const CACHE_PACK = 45;
/** これより入口に近い所（歩いて、マス）には置き場を残さない（荷は持ち帰る） */
const CACHE_MIN_D = 30;
/** 置き場の数の上限（超えたら、古い空の置き場から片づける） */
const CACHE_MAX = 14;
/** 置き場で食料を補う間合い（画素） */
const CACHE_R = 2.5 * TILE;

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

/** 次にたどる置き場：知っている置き場のうち、まだたどっていないもので、たどった所より奥の、いちばん入口に近いもの */
export function nextCache(this: Ecology, p: Party): SupplyCache | undefined {
  if (!followsCaches(p) || p.goal !== 0 || p.aimAt || p.aimEnd === 1) return undefined;
  let best: SupplyCache | undefined;
  for (const id of p.cacheKnown ?? []) {
    if ((p.cacheVis ?? []).includes(id)) continue;
    const o = this.caches.find((q) => q.id === id);
    if (!o || o.d < 0 || o.d < (p.cacheD ?? 0) - 10) continue;
    if (!best || o.d < best.d || (o.d === best.d && o.id < best.id)) best = o;
  }
  return best;
}

/** 行き先を次の置き場に（aimTarget の初め）。true なら決めた */
export function cacheTarget(this: Ecology, p: Party): boolean {
  const o = this.nextCache(p);
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
      }
    }
  }
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

declare module '../ecology' {
  interface Ecology {
    packForCaches: typeof packForCaches;
    nextCache: typeof nextCache;
    cacheTarget: typeof cacheTarget;
    cacheAhead: typeof cacheAhead;
    cacheStep: typeof cacheStep;
    dropCache: typeof dropCache;
    tellCaches: typeof tellCaches;
    ratRaidCache: typeof ratRaidCache;
  }
}

Object.assign(Ecology.prototype, { packForCaches, nextCache, cacheTarget, cacheAhead, cacheStep, dropCache, tellCaches, ratRaidCache });
