/** Ecology のメソッド：島（入口側と切り離された洞窟。入口側の洞窟と歩いてつながっていない領域のこと。説明では「入口側と切り離された住処」と書く）（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { DAY_TICKS_ECO, Ecology, Kind, ih } from '../ecology';
import { TILE } from '../mapgen';

/**
 * マス k が属する、つながった洞窟の領域の番号（歩いて行き来できる床のひとかたまり。岩・閉じた空洞・溶岩のマスは -1）。
 * 溶岩も壁とみなす：歩く生き物は溶岩を渡れない（move.ts の tilePassable）。通れる床として扱うと、溶岩でつながっているだけの
 * 場所が入口側と同じ領域になり、そこにあるコボルトの住処が島とみなされず、入口側へ横穴を掘ってつなげに行かない
 * （入口から来たコボルトが、溶岩の向こうの住処を目指して溶岩の手前で立ち往生していた）
 */
export function regionOf(this: Ecology, k: number): number {
  const m = this.w.map;
  if (this.regionVer !== this.w.digs.length || this.regionMap.length !== m.w * m.h) {
    const N = m.w * m.h;
    if (this.regionMap.length !== N) this.regionMap = new Int32Array(N);
    this.regionMap.fill(-1);
    let id = 0;
    const q = new Int32Array(N);
    for (let s0 = 0; s0 < N; s0++) {
      if (this.regionMap[s0] >= 0 || m.solid[s0] || m.sealed[s0] || m.lava[s0]) continue;
      let h = 0;
      let t = 0;
      q[t++] = s0;
      this.regionMap[s0] = id;
      while (h < t) {
        const k2 = q[h++];
        for (const n of [k2 + 1, k2 - 1, k2 + m.w, k2 - m.w]) {
          if (n < 0 || n >= N || this.regionMap[n] >= 0 || m.solid[n] || m.sealed[n] || m.lava[n]) continue;
          this.regionMap[n] = id;
          q[t++] = n;
        }
      }
      id++;
    }
    this.mainRegion = this.regionMap[1 * m.w + m.entrance.x];
    this.regionVer = this.w.digs.length;
    this.mainPointCache.clear();
  }
  return k >= 0 && k < this.regionMap.length ? this.regionMap[k] : -1;
}

/** その場所が島（入口側の洞窟とつながっていない開いた洞窟）か */
export function onIsland(this: Ecology, x: number, y: number): boolean {
  const r = this.regionOf(this.tileOf(x, y));
  return r >= 0 && r !== this.mainRegion;
}

/** 島から見て、いちばん近い入口側の洞窟のマス（なければ -1） */
export function nearestMain(this: Ecology, tx: number, ty: number): number {
  const m = this.w.map;
  const key = ty * m.w + tx;
  this.regionOf(key);
  const hit = this.mainPointCache.get(key);
  if (hit !== undefined) return hit;
  let best = -1;
  for (let r = 1; r <= 80 && best < 0; r++)
    for (let dy = -r; dy <= r && best < 0; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
        const k = y * m.w + x;
        if (this.regionMap[k] === this.mainRegion) {
          best = k;
          break;
        }
      }
  this.mainPointCache.set(key, best);
  return best;
}

/** 外の風の吹いてくる所：まだ閉じている地表の横穴の内側のマスのうち、D マス以内でいちばん近いもの（なければ null） */
export function windTarget(this: Ecology, hx: number, hy: number, D: number): number | null {
  const m = this.w.map;
  let best: number | null = null;
  let bd = D + 1;
  for (let i = 0; i < m.mouths.length; i++) {
    if (m.mouths[i].kind !== 0 || this.mouthOpen(i)) continue;
    const [x, y] = this.mouthTile(i);
    // 横穴に通じる空洞のうち、近い所を目指す（口の内側から空洞までの道は、閉じた空洞の床が続いている）
    const d = Math.abs(x - hx) + Math.abs(y - hy);
    if (d < bd) {
      bd = d;
      best = y * m.w + x;
    }
  }
  if (best === null) return null;
  // 口の真下の通路をたどって、空洞の床（いちばん近い閉じた床）を返す
  const near = this.w.nearestSealed(hx, hy, Math.min(40, D));
  if (near >= 0) {
    const bx = best % m.w;
    const by = Math.floor(best / m.w);
    const nx = near % m.w;
    const ny = Math.floor(near / m.w);
    if (Math.abs(nx - bx) + Math.abs(ny - by) < 20) return near;
  }
  return best;
}

export function breakTopWall(this: Ecology): void {
  if (this.wallBroken) return;
  const m = this.w.map;
  const i = m.mouths.findIndex((mo) => mo.kind === 0 && mo.y === 0);
  if (i < 0) {
    this.wallBroken = true;
    return;
  }
  const due = DAY_TICKS_ECO * 3 + (ih(m.mouths[i].x, 5, 212) % (DAY_TICKS_ECO * 2));
  if (this.w.tick < due) return;
  // 掘った通路の出口が、掘った土（dumpSpoil）で埋まって、横穴が開かないことがある（abc で、冒険者の一行の数を変えると起きた）。
  // 開くまでゲーム内の1日のあいだ、生き物の更新100回ごとに掘り直す（それでも開かなければあきらめる）
  if (this.mouthOpen(i) || this.w.tick > due + DAY_TICKS_ECO) {
    this.wallBroken = true;
    return;
  }
  // 横穴の通路を下へたどって、空洞の床を探す
  const mx = m.mouths[i].x;
  let py = 1;
  while (py < m.h - 2 && !m.solid[py * m.w + mx] && m.sealed[py * m.w + mx]) py++;
  const from = (py - 1) * m.w + mx;
  // いちばん近い入口側の洞窟のマス
  let best = -1;
  let bd = 1e9;
  this.regionOf(0);
  for (let k = 0; k < m.w * m.h; k++) {
    if (this.regionMap[k] !== this.mainRegion) continue;
    const d = Math.abs((k % m.w) - mx) + Math.abs(Math.floor(k / m.w) - (py - 1));
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  if (best < 0) return;
  const tx = best % m.w;
  const ty = Math.floor(best / m.w);
  const path: number[] = [];
  let x = mx;
  let y = py - 1;
  while (x !== tx) {
    x += Math.sign(tx - x);
    path.push(y * m.w + x);
  }
  while (y !== ty) {
    y += Math.sign(ty - y);
    path.push(y * m.w + x);
  }
  if (path.some((k) => m.lava[k] || m.vault[k])) return;
  for (const k of path) if (m.solid[k]) this.w.dig(k);
  this.noise(mx * TILE + 8, py * TILE, 22);
  void from;
  if (!this.mouthOpen(i)) return;
  this.wallBroken = true;
  this.log(mx * TILE + 8, py * TILE, '岩壁が崩れ、上の横穴から外の風が吹き込んだ');
}

export function checkJoined(this: Ecology): void {
  const m = this.w.map;
  const homes: [number, number, number, number][] = [
    ...this.camps.filter((c) => c.id >= 0).map((c) => [c.id, c.x, c.y, c.kind === 0 ? Kind.Goblin : Kind.Lizardman] as [number, number, number, number]),
    ...this.warrens.map((w) => [w.id, w.x, w.y, Kind.Kobold] as [number, number, number, number]),
    ...this.colonies.map((c) => [c.id, c.x, c.y, Kind.Ant] as [number, number, number, number]),
  ];
  for (const [id, x, y, k] of homes) {
    const island = this.onIsland(x, y);
    if (island) this.islandIds.add(id);
    else if (this.islandIds.has(id) && this.regionOf(this.tileOf(x, y)) === this.mainRegion) this.markJoined(id, x, y, k, 0);
  }
  void m;
}

/**
 * 入口側と切り離されていた住みかが、入口側の洞窟とつながった：ゲーム内ログに出し、settle.jsonl に joined を記録する。
 * how は 1 なら住処のコボルトが内側から掘ってつないだ（kobold.ts の掘る処理から呼ぶ）、0 ならそれ以外（瓦礫の風化、ほかの者の掘削など。checkJoined から）
 */
export function markJoined(this: Ecology, id: number, x: number, y: number, k: number, how: number): void {
  this.islandIds.delete(id);
  this.log(x, y, `{k:${k}}の暮らす洞窟が、入口側の洞窟とつながった`);
  this.record('settle', { t: this.w.tick, k, id, ev: 'joined', how, x: Math.round(x), y: Math.round(y) } as never);
}

declare module '../ecology' {
  interface Ecology {
    regionOf: typeof regionOf;
    onIsland: typeof onIsland;
    nearestMain: typeof nearestMain;
    windTarget: typeof windTarget;
    breakTopWall: typeof breakTopWall;
    checkJoined: typeof checkJoined;
    markJoined: typeof markJoined;
  }
}

Object.assign(Ecology.prototype, { regionOf, onIsland, nearestMain, windTarget, breakTopWall, checkJoined, markJoined });
