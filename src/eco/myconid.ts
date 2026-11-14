/** Ecology のメソッド：マイコニド（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { MOSS_R, Cr, DAY_TICKS_ECO, Ecology, Kind, SPEC, ih } from '../ecology';
import { TILE } from '../mapgen';

export function maybeSpawnMyconid(this: Ecology, k: number, step: number): void {
  if (this.counts[Kind.Myconid] >= 6 || ih(k, step, 61) % 800 >= MOSS_R) return;
  const m = this.w.map;
  this.w.fungus[k] -= 20;
  this.originNext = 'soil';
  const c = this.spawn(Kind.Myconid, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 20, 0);
  c.tx = -1;
  this.counts[Kind.Myconid]++;
  // 養分とキノコとマナがどれも極めて濃い所では、キノコの主になる（二つの系統を併せ持つ）
  if (this.w.fungus[k] >= 200 && this.w.nutr[k] >= 40 && this.manaAround(k) >= 6 && !this.list.some((o) => o.elite === 9 && !o.dead) && this.w.tick - (this.lastElite[9] ?? -1e9) > DAY_TICKS_ECO * 2) {
    c.elite = 9;
    this.lastElite[9] = this.w.tick;
    this.takeMana(c, k, 40);
    this.nameOf(c);
    this.log(c.x, c.y, `豊かなキノコと養分と濃いマナから、キノコの主「${this.names.get(c.id)}」が生まれた`);
  }
}

/** マイコニドが目的地を決めてから根を下ろすまでの、生き物の更新の回数の下限（着いたあとは佇んで待つ） */
const MYC_LINGER = 1500;

export function myconid(this: Ecology, c: Cr): void {
  const m = this.w.map;
  const s = SPEC[Kind.Myconid];
  if (c.tx < 0) {
    // 暗く湿った、まだキノコのない場所を探す
    const x0 = Math.floor(c.x / TILE);
    const y0 = Math.floor(c.y / TILE);
    let best = -1;
    let bv = -1;
    // 壁で隔てられた別の洞窟は選ばない（たどり着けない場所へ向かって、壁際で足踏みし続けないように）
    const home = this.regionOf(this.tileOf(c.x, c.y));
    for (let i = 0; i < 40; i++) {
      const h = ih(c.id, this.step, 62 + i);
      const x = x0 + ((h & 255) % 41) - 20;
      const y = y0 + (((h >>> 8) & 255) % 41) - 20;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.lava[k] || this.w.fungus[k] || this.w.lightBase[k] > 80 || this.w.moist[k] < 80 || this.regionOf(k) !== home) continue;
      const d = Math.abs(x - x0) + Math.abs(y - y0);
      if (d < 8) continue;
      const v = this.w.nutr[k] + this.w.moist[k] - d;
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    if (best < 0) {
      c.act = 0;
      if (c.actT > 300) this.plant(c);
      return;
    }
    c.tx = (best % m.w) * TILE + 8;
    c.ty = Math.floor(best / m.w) * TILE + 8;
    c.actT = 0;
    // ref 1：着いて佇んでいる
    c.ref = 0;
  }
  // 着いたら（または、溶岩や水にはばまれて近づけるだけ近づいたら）、その場に佇み、目的地を決めてから生き物の更新 MYC_LINGER 回たってから根を下ろす。
  // 着くまでの道のりの長さにかかわらず、一生の長さがおおよそそろう（すぐ根を下ろすと、生まれては根を下ろすのが倍ほど速くなり、キノコと養分の巡りが変わる）
  if (c.ref === 1 || c.actT > 2400) {
    c.act = 0;
    if (c.actT > MYC_LINGER) this.plant(c);
    return;
  }
  c.act = 1;
  if (this.goTo(c, c.tx, c.ty, s.speed) || this.unreachable(c) >= 2) {
    c.ref = 1;
    c.act = 0;
  }
}

/** 座り込んで、体をそのまま新しいキノコの群落にする */
export function plant(this: Ecology, c: Cr): void {
  const k = this.tileOf(c.x, c.y);
  if (k >= 0 && !this.w.map.lava[k]) {
    const room = 255 - this.w.fungus[k];
    const t = Math.min(room, c.body);
    this.w.fungus[k] += t;
    c.body -= t;
    this.mossTouched = true;
  }
  this.die(c, 'planted');
}

declare module '../ecology' {
  interface Ecology {
    maybeSpawnMyconid: typeof maybeSpawnMyconid;
    myconid: typeof myconid;
    plant: typeof plant;
  }
}

Object.assign(Ecology.prototype, { maybeSpawnMyconid, myconid, plant });
