/** Ecology のメソッド：小道具、生き物の格子（近くの相手を探す）（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

export function record(this: Ecology, kind: 'deaths' | 'births' | 'exits' | 'moves' | 'settle', e: never): void {
  const a = this.stats[kind] as unknown[];
  a.push(e);
  if (a.length > 5000) a.splice(0, a.length - 4000);
}

export function tilePassable(this: Ecology, c: Cr, k: number): boolean {
  const m = this.w.map;
  if (c.k === Kind.Worm) return true;
  if (m.solid[k]) return false;
  // トロールは昼のあいだ、光の筋の差すマスを通らない（石にならないように）
  if (c.k === Kind.Troll && this.dayNow > 0.05 && this.w.lightBase[k] * this.dayNow > 150) return false;
  if (c.k === Kind.Wisp || c.k === Kind.Bat || c.k === Kind.Ghost || c.k === Kind.Wyvern || (c.k === Kind.Gargoyle && c.act !== 0) || (c.k === Kind.Dragon && c.st === 2)) return true;
  if (m.lava[k]) return false;
  if (this.statueAt.has(k) && this.tileOf(c.x, c.y) !== k) return false;
  // 大ネズミは深い水に入らない。ただし、水かさが増して深い水に取り残されたら、泳いで抜け出せる
  if (c.k === Kind.Rat && this.w.water[k] > 40 && this.ratOnDry(c)) return false;
  return true;
}

/** マス単位の幅優先探索で道筋を作る（見つからなければ null） */
export function findPath(this: Ecology, c: Cr, from: number, to: number): number[] | null {
  // ゴブリンは、コボルトの縄張りをできるだけ横切らない（縄張りを通らない道筋を先に探し、なければふつうに探す）
  if (c.k === Kind.Goblin && from >= 0 && to >= 0 && this.warrens.some((o) => o.id >= 0)) {
    const m = this.w.map;
    const land = (k: number) => this.inKoboldLand((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8);
    if (!land(from) && !land(to)) {
      const p = this.findPathAvoid(c, from, to, land);
      if (p) return p;
    }
  }
  // 冒険者は、目標でない住処・集落・縄張りのまわりをできるだけ避ける（避けては行けないときだけ通る）
  if (c.k === Kind.Adventurer && from >= 0 && to >= 0) {
    const p = this.advPath(c, from, to);
    if (p) return p;
  }
  return this.findPathAvoid(c, from, to, null);
}

export function findPathAvoid(this: Ecology, c: Cr, from: number, to: number, avoid: ((k: number) => boolean) | null): number[] | null {
  const m = this.w.map;
  if (from < 0 || to < 0 || !this.tilePassable(c, to)) return null;
  const g = ++this.bgen;
  const q = this.bq;
  let qh = 0;
  let qt = 0;
  q[qt++] = from;
  this.bmark[from] = g;
  this.bprev[from] = -1;
  // 探す広さに上限をつける（届かない目的地のために地図じゅうを探さない）
  // 冒険者は入口から深部まで歩くので、地図全体を探せるようにする
  // 冒険者とドラゴンとドワーフ、外へ去ろうとしている者は、地図全体を探す
  const limit = c.k === Kind.Adventurer || c.k === Kind.Dragon || c.k === Kind.Dwarf || c.st === 9 || (c.k === Kind.Kobold && c.st === 10) || (c.k === Kind.Rat && c.st === 8) ? 40000 : c.k === Kind.Rat || c.k === Kind.Kobold ? 15000 : 6000;
  while (qh < qt && qh < limit) {
    const cur = q[qh++];
    if (cur === to) break;
    const x = cur % m.w;
    const y = (cur / m.w) | 0;
    for (let d = 0; d < 4; d++) {
      const n = d === 0 ? (x + 1 < m.w ? cur + 1 : -1) : d === 1 ? (x > 0 ? cur - 1 : -1) : d === 2 ? (y + 1 < m.h ? cur + m.w : -1) : y > 0 ? cur - m.w : -1;
      if (n < 0 || this.bmark[n] === g || !this.tilePassable(c, n) || (avoid && avoid(n))) continue;
      this.bmark[n] = g;
      this.bprev[n] = cur;
      q[qt++] = n;
    }
  }
  if (this.bmark[to] !== g) return null;
  const path: number[] = [];
  for (let k = to; k !== -1 && k !== from; k = this.bprev[k]) path.push(k);
  path.reverse();
  return path;
}

/** 道筋をたどって目的地へ。着いたら true */
export function goTo(this: Ecology, c: Cr, tx: number, ty: number, speed: number): boolean {
  // 本能だけの種は道筋を探さず、まっすぐ向かう。壁に引っかかったら、しばらく別の向きへ歩いてから向き直る
  if (TIER[c.k] === 0 && c.k !== Kind.Worm && c.k !== Kind.Golem) {
    if (c.gait > 0) {
      const v = DIR16[c.gait & 15];
      const x0 = c.x;
      const y0 = c.y;
      this.tryMove(c, v[0] * speed, v[1] * speed);
      c.gait = c.x === x0 && c.y === y0 ? 0 : c.gait - 16;
      if (c.gait < 16) c.gait = 0;
      return false;
    }
    const x0 = c.x;
    const y0 = c.y;
    const r = this.moveToward(c, tx, ty, speed);
    if (!r && Math.abs(c.x - x0) + Math.abs(c.y - y0) < speed * 0.3 && ih(c.id, this.step, 190) % 6 === 0) c.gait = (30 + (ih(c.id, this.step, 191) % 30)) * 16 + (ih(c.id, this.step, 192) & 15);
    return r;
  }
  if (sq(tx - c.x) + sq(ty - c.y) <= speed * speed) {
    if (this.passable(c, tx, ty)) {
      c.x = tx;
      c.y = ty;
    }
    this.paths.delete(c.id);
    return true;
  }
  // 近ければ道筋を探さずにまっすぐ向かう
  if (sq(tx - c.x) + sq(ty - c.y) < 24 * 24) return this.moveToward(c, tx, ty, speed);
  let p = this.paths.get(c.id);
  const gk = this.tileOf(tx, ty);
  // 目的地のマスが変わったとき、または行き詰まったときだけ探し直す（動く獲物を追うたびに探さない）
  if (!p || (p.gk !== gk && (p.path.length === 0 || this.step - p.at > 8)) || p.stall > 60) {
    if (p && p.path.length === 0 && p.gk === gk && this.step - p.at < 40) return this.moveToward(c, tx, ty, speed);
    const path = this.findPath(c, this.tileOf(c.x, c.y), gk);
    if (!path) {
      this.paths.set(c.id, { gx: tx, gy: ty, gk, at: this.step, path: [], pi: 0, stall: 0 });
      return this.moveToward(c, tx, ty, speed);
    }
    p = { gx: tx, gy: ty, gk, at: this.step, path, pi: 0, stall: 0 };
    this.paths.set(c.id, p);
  }
  if (p.path.length === 0) return this.moveToward(c, tx, ty, speed);
  if (p.pi >= p.path.length) return this.moveToward(c, tx, ty, speed);
  const k = p.path[p.pi];
  const m = this.w.map;
  const jx = (c.id % 7) - 3;
  const jy = ((c.id >> 3) % 7) - 3;
  const wx = (k % m.w) * TILE + 8 + jx;
  const wy = Math.floor(k / m.w) * TILE + 8 + jy;
  if (this.moveToward(c, wx, wy, speed)) {
    p.pi++;
    p.stall = 0;
  } else p.stall++;
  return false;
}

export function tileOf(this: Ecology, x: number, y: number): number {
  const m = this.w.map;
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return -1;
  return ty * m.w + tx;
}

/** そのマスに立てるか（地を歩くものは深い水を渡れない） */
/** 大ネズミがいま浅い所（深さ40以下）に立っているか */
export function ratOnDry(this: Ecology, c: Cr): boolean {
  const here = this.tileOf(c.x, c.y);
  return here < 0 || this.w.water[here] <= 40;
}

export function passable(this: Ecology, c: Cr, x: number, y: number): boolean {
  const k = this.tileOf(x, y);
  if (k < 0) return false;
  const m = this.w.map;
  if (m.solid[k]) return false;
  if (c.k === Kind.Wisp || c.k === Kind.Bat) return true;
  if (m.lava[k]) return false;
  // 大ネズミは深い水に入らない。ただし、水かさが増して深い水に取り残されたら、泳いで抜け出せる
  if (c.k === Kind.Rat && this.w.water[k] > 40 && this.ratOnDry(c)) return false;
  return true;
}

/** ウィスプが寄っていく明るさ（苔の光を強く好む） */
/**
 * ウィスプの寄る先：光る苔とキノコ、マナの濃い所。日の光の差す所と、火のそば（かがり火、焚き火、松明）は避ける
 * （これまでは日の光にも寄り、日の光とかがり火で一番明るい正面の入口に集まって眩しくなっていた）
 */
export function litW(this: Ecology, k: number, day: number): number {
  if (k < 0) return 0;
  const m = this.w.map;
  let v = this.w.moss[k] / 255 + this.w.fungus[k] / 400 + Math.min(1, this.w.mana[k] / 40) * 0.6;
  v -= (this.w.lightBase[k] * day) / 600;
  if (this.fireNearTile(k)) v -= 1;
  return v;
}

/** シミュレーション用の明るさ（決定的な量だけで計算する） */
export function lit(this: Ecology, k: number, day: number): number {
  if (k < 0) return 0;
  return (this.w.lightBase[k] * day) / 1000 + this.w.moss[k] / 510 + (this.w.map.lava[k] ? 0.8 : 0);
}

export function spawn(this: Ecology, k: Kind, x: number, y: number, body: number, food: number): Cr {
  this.record('births', { t: this.w ? this.w.tick : 0, k, origin: this.originNext || 'born', x: Math.round(x), y: Math.round(y) } as never);
  this.originNext = '';
  const c: Cr = {
    id: this.nextId++, k, x, y, px: x, py: y, vx: 0, vy: 0, dir: 0, act: 0, actT: 0,
    body, food, glow: 0, hungry: 0, sinceMeal: 0, st: 0, hx: x, hy: y, tx: x, ty: y,
    dead: 0, units: 0, away: false, caught: false, ref: 0, sp: k, init: 0, ref2: 0, gold: 0, party: 0, torch: 0, hp: 0, hitAt: -99, foe: 0, flee: 0, gait: 0, bornAt: -1e9, sleep: 0, drowsy: 0, lure: 0, lureAt: 0, feed: 0, mana: 0, elite: 0,
  };
  this.list.push(c);
  this.byId.set(c.id, c);
  return c;
}

export function deposit(this: Ecology, x: number, y: number, n: number): void {
  if (n <= 0) return;
  let k = this.tileOf(x, y);
  if (k < 0 || this.w.map.solid[k]) k = this.nearestFloor(x, y);
  this.w.nutr[k] += n;
}

export function nearestFloor(this: Ecology, x: number, y: number): number {
  const m = this.w.map;
  const tx = Math.max(0, Math.min(m.w - 1, Math.floor(x / TILE)));
  const ty = Math.max(0, Math.min(m.h - 1, Math.floor(y / TILE)));
  for (let r = 0; r < 8; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const xx = tx + dx;
        const yy = ty + dy;
        if (xx < 0 || yy < 0 || xx >= m.w || yy >= m.h) continue;
        const k = yy * m.w + xx;
        if (!m.solid[k]) return k;
      }
  return m.entrance.x;
}

export function setDir(this: Ecology, c: Cr, dx: number, dy: number): void {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
  c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : dy > 0 ? 0 : 1;
}

/** 目標へ向かって一歩。壁にぶつかったら軸ごとに滑らせ、それでも駄目なら向きを変える */
export function moveToward(this: Ecology, c: Cr, tx: number, ty: number, speed: number): boolean {
  const dx = tx - c.x;
  const dy = ty - c.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < speed) {
    if (this.passable(c, tx, ty)) {
      c.x = tx;
      c.y = ty;
    }
    return true;
  }
  this.tryMove(c, (dx / d) * speed, (dy / d) * speed);
  return false;
}

/** 種ごとの歩き方（速さの倍率と、進む向きに直交する揺れ）。逃げているときは癖を出さない */
export function gaitOf(this: Ecology, c: Cr): [number, number] {
  if (c.flee > 0 || c.act === 2) return [1, 0];
  const t = this.step + (c.id % 97) * 7;
  switch (c.k) {
    case Kind.Rat: {
      // 小刻みに走っては止まり、あたりをうかがう
      const q = t % 36;
      return q < 22 ? [1.5, 0] : [0, 0];
    }
    case Kind.Lizard: {
      // 止まっては進む
      const q = t % 70;
      return q < 30 ? [1.3, 0] : [0, 0];
    }
    case Kind.Spider: {
      // じっと待ってから、一気に跳ぶ
      const q = t % 50;
      return q < 32 ? [0, 0] : [2.6, 0];
    }
    case Kind.Bat:
      // 不規則にひらひら舞う
      return [1, Math.sin(t * 0.9) * 0.9 + Math.sin(t * 0.37) * 0.6];
    case Kind.Zombie:
      // 左右によろめく
      return [0.7 + 0.3 * Math.abs(Math.sin(t * 0.21)), Math.sin(t * 0.21) * 0.7];
    case Kind.Slime:
      // 伸び縮みしながら這う
      return [Math.max(0, Math.sin(t * 0.18)) * 1.6, 0];
    case Kind.Goblin:
    case Kind.Kobold:
      // ちょこまか
      return [1.1, ((ih(c.id, t >> 2, 193) % 5) - 2) * 0.25];
    case Kind.Minotaur:
      // 突進の後のよろめき
      if (c.gait > 0) return [0, 0];
      return [1, 0];
    case Kind.Dwarf:
      return [0.9, 0];
    case Kind.Adventurer: {
      // 先頭は立ち止まってあたりを見回してから進む
      const p = this.parties.find((q) => q.id === c.party);
      if (p && p.members[0] === c.id && t % 150 < 18) return [0, 0];
      return [1, 0];
    }
    default:
      return [1, 0];
  }
}

export function tryMove(this: Ecology, c: Cr, mx: number, my: number): void {
  if (c.hp > 0 && c.hp < this.maxHp(c) * 0.35) {
    mx *= 0.6;
    my *= 0.6;
  }
  // 列の間合い：同じ群れの仲間がすぐ前にいれば歩みをゆるめる（細い通路で一列になっても重ならない）
  if (mx || my) {
    const key = this.groupKey(c);
    if (key) {
      const L = Math.sqrt(mx * mx + my * my) || 1;
      const hx = mx / L;
      const hy = my / L;
      const gap = Ecology.bodySize(c.k) * 0.9;
      let slow = 1;
      // 前で止まっている仲間（休む、食べる、眠る）は、列ではなく障害物：ゆるめずに脇へよけて追い越す
      // （以前は止まっている仲間の後ろでも歩みをゆるめ続け、やわらかい間合いで押し返されて、広い床でも先へ進めなかった）
      let sidestep = 0;
      this.nearby(c.x, c.y, 1, (o) => {
        if (o === c || o.dead || slow < 1 || sidestep || this.groupKey(o) !== key) return;
        const dx = o.x - c.x;
        const dy = o.y - c.y;
        const ahead = dx * hx + dy * hy;
        const cross = dx * hy - dy * hx;
        const side = Math.abs(cross);
        if (!(ahead > 0 && ahead < gap && side < gap * 0.6)) return;
        // 前の仲間がこちらへ向かってくる（向きが逆）なら、列ではなくすれ違い：ゆるめずに脇へよける
        // （以前は向かい合った二匹が互いにゆるめ合い、細い通路で押し戻し合って進めず、苔のそばで飢えていた）
        const od = o.dir === 0 ? [0, 1] : o.dir === 1 ? [0, -1] : o.dir === 2 ? [1, 0] : [-1, 0];
        const oncoming = od[0] * hx + od[1] * hy < -0.3;
        if (o.act === 1 && o.sleep <= 0 && !oncoming) slow = ahead < gap * 0.5 ? 0.15 : 0.5;
        else sidestep = cross > 0 ? -1 : cross < 0 ? 1 : c.id % 2 ? 1 : -1;
      });
      if (sidestep) {
        // 進む向きに対して横（仲間のいない側）へ半分、前へ半分
        const px = hy * sidestep;
        const py = -hx * sidestep;
        mx = (hx * 0.6 + px * 0.8) * L;
        my = (hy * 0.6 + py * 0.8) * L;
      }
      mx *= slow;
      my *= slow;
    }
  }
  // マイコニドの胞子を吸った人は、しばらく足が鈍る
  if (c.k === Kind.Adventurer && c.drowsy > 0) {
    mx *= 0.6;
    my *= 0.6;
  }
  // 眠りながら動く種はゆっくり。眠気がたまりすぎると動きが鈍る
  if (c.sleep > 0) {
    mx *= 0.35;
    my *= 0.35;
  } else {
    const sp = Ecology.SLEEP[c.k];
    if (sp && c.drowsy > sp.th * 2.5) {
      mx *= 0.8;
      my *= 0.8;
    }
  }
  {
    const [f, side] = this.gaitOf(c);
    if (f === 0 && side === 0) {
      if (c.act === 1) c.act = 0;
      this.setDir(c, mx, my);
      return;
    }
    const L = Math.sqrt(mx * mx + my * my) || 1;
    const nx = mx;
    mx = mx * f - (my / L) * side * L;
    my = my * f + (nx / L) * side * L;
  }
  if (this.passable(c, c.x + mx, c.y + my)) {
    c.x += mx;
    c.y += my;
  } else if (this.passable(c, c.x + mx, c.y)) c.x += mx;
  else if (this.passable(c, c.x, c.y + my)) c.y += my;
  else {
    const v = DIR16[ih(c.id, this.step, 5) & 15];
    if (this.passable(c, c.x + v[0] * 2, c.y + v[1] * 2)) {
      c.x += v[0] * 2;
      c.y += v[1] * 2;
    }
  }
  this.setDir(c, mx, my);
}

/** 近くで苔の多いマスを探す（何か所か試して一番よい所） */
export function findMoss(this: Ecology, c: Cr, cx: number, cy: number, R: number, salt: number, seedStep = this.step): number {
  const m = this.w.map;
  const tx0 = Math.floor(cx / TILE);
  const ty0 = Math.floor(cy / TILE);
  let best = -1;
  // 腹を空かせた大ネズミとコボルトとゴブリンは、えり好みしない（薄い群落でも、近ければ食べに行く。キノコも探す）
  const needy = (c.k === Kind.Rat || c.k === Kind.Kobold || c.k === Kind.Goblin) && c.hungry > 0;
  let bv = needy ? 0 : 24;
  const per = 4;
  for (let i = 0; i < (needy ? 40 : 28); i++) {
    const h = ih(c.id, seedStep, salt + i);
    const dx = ((h & 255) % (2 * R + 1)) - R;
    const dy = (((h >>> 8) & 255) % (2 * R + 1)) - R;
    const x = tx0 + dx;
    const y = ty0 + dy;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
    const k = y * m.w + x;
    if (m.solid[k] || m.lava[k] || m.sealed[k]) continue;
    if (c.k === Kind.Rat && this.w.water[k] > 40) continue;
    const food = c.k === Kind.Rat || c.k === Kind.Kobold || (c.k === Kind.Goblin && needy) ? Math.max(this.w.moss[k], this.w.fungus[k]) : this.w.moss[k];
    if (needy && food < 20) continue;
    // 腹を空かせた者は、豊かさより近さ（豊かさは30で頭打ち）
    const v = (needy ? Math.min(30, food - 12) : food - 12) - (Math.abs(dx) + Math.abs(dy)) * per;
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}

export function updateForage(this: Ecology): void {
  const m = this.w.map;
  const out: number[] = [];
  let mo = 0;
  let fu = 0;
  let ed = 0;
  for (let k = 0; k < m.solid.length; k++) {
    if (m.sealed[k]) continue;
    mo += this.w.moss[k];
    fu += this.w.fungus[k];
    if (this.w.moss[k] >= 20 && !m.solid[k]) ed += this.w.moss[k] - 12;
  }
  this.openMoss = mo;
  this.openFungus = fu;
  this.edibleMoss = ed;
  // 巣穴ごとの養える数も、同じ時機に数え直す（読み込み直しても同じ値になるように、決まった刻みで）
  for (const b of this.burrows) b.cap = this.burrowCap(b);
  // 畑の外のキノコ（ゴブリンは、コボルトの畑に引き寄せられては来ない）
  let farm = 0;
  const counted = new Set<number>();
  for (const wr of this.warrens) if (wr.id >= 0) for (const k of this.farmTiles(wr)) if (!counted.has(k) && !m.sealed[k]) {
    counted.add(k);
    farm += this.w.fungus[k];
  }
  this.wildFungus = fu - farm;
  for (let y = 2; y < m.h - 2; y += 3)
    for (let x = 2; x < m.w - 2; x += 3) {
      let best = -1;
      let bv = 80;
      for (let dy = 0; dy < 3; dy++)
        for (let dx = 0; dx < 3; dx++) {
          const k = (y + dy) * m.w + x + dx;
          if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 40) continue;
          const v = Math.max(this.w.moss[k], this.w.fungus[k]);
          if (v > bv) {
            bv = v;
            best = k;
          }
        }
      if (best >= 0) out.push(best);
    }
  this.forage = out;
}

/** 土地勘から、いちばん近い豊かな群落（R マス以内、なければ -1） */
export function nearestForage(this: Ecology, x: number, y: number, R: number, avoid = -1): number {
  const m = this.w.map;
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  let best = -1;
  let bd = R * R;
  // 歩いてつながっていない洞窟の群落は選ばない（以前は、飢えた大ネズミが道筋の通らない遠くの群落を目指し続けて、そばの薄い苔に戻れなかった）
  const r0 = this.regionOf(ty * m.w + tx);
  for (const k of this.forage) {
    const d = sq((k % m.w) - tx) + sq(Math.floor(k / m.w) - ty);
    if (d < bd && k !== avoid && Math.max(this.w.moss[k], this.w.fungus[k]) > 40 && (r0 < 0 || this.regionOf(k) === r0)) {
      bd = d;
      best = k;
    }
  }
  return best;
}

export function eatMoss(this: Ecology, c: Cr, n: number): boolean {
  const k = this.tileOf(c.x, c.y);
  if (k < 0) return false;
  const s = SPEC[c.k];
  // 根元は食べ残す（群落が食べ尽くされて消えないように）
  const t = Math.min(n, this.w.moss[k] - 12, s.cap - c.food);
  if (t <= 0) {
    // 苔がなければキノコを食べる（光は帯びない）
    const tf = c.k === Kind.Rat || c.k === Kind.Kobold ? Math.min(n, this.w.fungus[k] - 12, s.cap - c.food) : 0;
    if (tf <= 0) return false;
    this.w.fungus[k] -= tf;
    c.food += tf;
    c.sinceMeal = 0;
    this.mossTouched = true;
    return true;
  }
  this.w.moss[k] -= t;
  c.food += t;
  c.glow = Math.min(255, c.glow + t * (c.k === Kind.Wisp ? 30 : 12));
  c.sinceMeal = 0;
  this.mossTouched = true;
  return true;
}

/** 捕食：獲物の体と胃の中身をすべて取り込む（入りきらない分は食べ残しとして土へ） */
export function eat(this: Ecology, pred: Cr, prey: Cr): void {
  const s = SPEC[pred.k];
  const total = prey.body + prey.food + prey.units;
  // 倒した獲物は、まず死骸になり、捕食者がその上で数秒かけて食べる（食べ残しは死骸として残る）。
  // はかない種（ウィスプ、スライム、ゴースト、マイコニド）と、ゴブリン、ワーム、すでに死骸のものは、これまでどおりその場で食べる
  // 獲物の体のマナは、食べた者へ受け渡される（食物連鎖で濃くなる）
  pred.mana += prey.mana;
  prey.mana = 0;
  const quick = prey.dead !== 0 || [Kind.Wisp, Kind.Slime, Kind.Ghost, Kind.Myconid].includes(prey.k) || pred.k === Kind.Goblin || pred.k === Kind.Worm || pred.k === Kind.Mimic || total <= 4;
  if (!quick) {
    this.record('deaths', { t: this.w.tick, k: prey.k, cause: 'eaten', by: pred.k, x: Math.round(prey.x), y: Math.round(prey.y) } as never);
    this.raiseAlarm(prey, pred);
    this.paths.delete(prey.id);
    if (prey.k === Kind.Dwarf && this.hold && pred.k === Kind.Golem && this.list.some((o) => o.k === Kind.Dwarf && !o.dead && o !== prey)) this.hold.golem = 1;
    this.dropBelongings(prey);
    if (prey.gold > 0) {
      this.dropGold(prey.x, prey.y, prey.gold);
      prey.gold = 0;
    }
    prey.units = total;
    prey.init = total;
    prey.body = 0;
    prey.food = 0;
    prey.dead = 1;
    prey.act = 3;
    prey.actT = 0;
    prey.caught = false;
    this.addDeath(prey.x, prey.y, prey.k);
    pred.feed = prey.id;
    pred.sinceMeal = 0;
    pred.act = 2;
    pred.actT = 0;
    return;
  }
  prey.units = 0;
  if (!prey.dead) {
    this.record('deaths', { t: this.w.tick, k: prey.k, cause: 'eaten', by: pred.k, x: Math.round(prey.x), y: Math.round(prey.y) } as never);
    // 仲間が食べられたら、群れに警戒が伝わる
    this.raiseAlarm(prey, pred);
  }
  this.paths.delete(prey.id);
  if (prey.k === Kind.Dwarf && this.hold && pred.k === Kind.Golem && this.list.some((o) => o.k === Kind.Dwarf && !o.dead && o !== prey)) this.hold.golem = 1;
  this.dropBelongings(prey);
  if (prey.gold > 0) {
    this.dropGold(prey.x, prey.y, prey.gold);
    prey.gold = 0;
  }
  const take = Math.min(total, s.cap - pred.food);
  pred.food += take;
  // ゴブリンは食べ残しを持ち帰って畑の肥やしにする
  if (pred.k === Kind.Goblin) {
    const keep = Math.min(total - take, 12 - pred.units);
    pred.units += keep;
    this.deposit(prey.x, prey.y, total - take - keep);
  } else this.deposit(prey.x, prey.y, total - take);
  pred.glow = Math.max(pred.glow, prey.glow);
  pred.sinceMeal = 0;
  if (pred.hp > 0) pred.hp = Math.min(this.maxHp(pred), pred.hp + this.maxHp(pred) / 4);
  pred.act = 2;
  pred.actT = 0;
  prey.body = 0;
  prey.food = 0;
  prey.dead = 2;
  this.addDeath(prey.x, prey.y, prey.k);
  if (prey.caught) {
    prey.caught = false;
  }
}

export function die(this: Ecology, c: Cr, cause = '', by = -1): void {
  this.releaseMana(c);
  if (!c.dead) {
    if (!cause) cause = c.hungry > SPEC[c.k].starve ? 'starve' : 'other';
    // 分析用：飢え死にした大ネズミは、食べられる苔・キノコ（20以上）までの歩いた道のり（60マスまで。なければ -1）も残す
    let near: number | undefined;
    if (c.k === Kind.Rat && cause === 'starve') {
      const d = this.walkDist(this.tileOf(c.x, c.y), 60);
      near = -1;
      for (let q = 0; q < d.length; q++) if (d[q] >= 0 && Math.max(this.w.moss[q], this.w.fungus[q]) >= 20 && (near < 0 || d[q] < near)) near = d[q];
    }
    this.record('deaths', { t: this.w.tick, k: c.k, cause, by, x: Math.round(c.x), y: Math.round(c.y), ...(near !== undefined ? { near } : {}) } as never);
    // 住処の仲間が襲われて倒れたら、群れは覚えている（何度も続けば住処を捨てる）
    if (c.k === Kind.Kobold && by >= 0 && by !== Kind.Kobold && cause !== 'starve') {
      const wr = this.warrenOf(c);
      if (wr) wr.raids = (wr.raids ?? 0) + 1;
    }
    if (c.k === Kind.Goblin && by >= 0 && by !== Kind.Goblin && cause !== 'starve') {
      const cp = this.campOf(c);
      if (cp && cp.kind === 0) cp.raids = (cp.raids ?? 0) + 1;
    }
  }
  if (c.k === Kind.Dwarf && this.hold && this.list.some((o) => o.k === Kind.Golem && !o.dead && sq(o.x - c.x) + sq(o.y - c.y) < 40 * 40)) {
    // 仲間がゴーレムに倒されるのを見た一団は、宝物庫を避ける
    if (this.list.some((o) => o.k === Kind.Dwarf && !o.dead && o !== c)) this.hold.golem = 1;
  }
  // 倒れた者の道筋の記憶は捨てる（保存されないので、起き上がったときに保存の前後で食い違わないように）
  this.paths.delete(c.id);
  this.dropBelongings(c);
  if (c.gold > 0) {
    this.dropGold(c.x, c.y, c.gold);
    c.gold = 0;
  }
  if (c.away) {
    // 外で死んだものは、外へ持ち出されたことになる
    this.exported += c.body + c.food;
    c.body = 0;
    c.food = 0;
    c.units = 0;
    this.w.manaLeaked += c.mana;
    c.mana = 0;
    c.dead = 2;
    return;
  }
  if (c.k === Kind.Wisp || c.k === Kind.Slime || c.k === Kind.Ghost || c.k === Kind.Myconid) {
    // ウィスプは光の粒としてほどけ、スライムは乾いて崩れ、養分はその場の土へ
    this.deposit(c.x, c.y, c.body + c.food + c.units);
    c.body = 0;
    c.food = 0;
    c.units = 0;
  } else {
    c.units = c.body + c.food + c.units;
    c.init = c.units;
    c.body = 0;
    c.food = 0;
    this.addDeath(c.x, c.y, c.k);
  }
  c.dead = 1;
  c.act = 3;
  c.actT = 0;
  c.caught = false;
  c.ref = 0;
  c.vx = 0;
  c.vy = 0;
}

export function rebuildGrid(this: Ecology): void {
  const m = this.w.map;
  const BW = (m.w + 7) >> 3;
  if (this.blk.length !== BW * m.h) {
    this.blk = new Int32Array(BW * m.h);
    this.head.fill(-1);
    this.usedTiles.length = 0;
  }
  for (const k of this.usedTiles) {
    this.head[k] = -1;
    this.blk[((k / m.w) | 0) * BW + ((k % m.w) >> 3)] = 0;
  }
  this.usedTiles.length = 0;
  this.items = this.list;
  if (this.next.length < this.list.length) this.next = new Int32Array(this.list.length * 2);
  for (let i = 0; i < this.list.length; i++) {
    const c = this.list[i];
    if (c.dead || c.away) continue;
    const k = this.tileOf(c.x, c.y);
    if (k < 0) continue;
    if (this.head[k] < 0) this.usedTiles.push(k);
    this.next[i] = this.head[k];
    this.head[k] = i;
    this.blk[((k / m.w) | 0) * BW + ((k % m.w) >> 3)]++;
  }
}

export function nearby(this: Ecology, x: number, y: number, R: number, fn: (c: Cr) => void): void {
  const m = this.w.map;
  const W = m.w;
  const BW = (W + 7) >> 3;
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const y0 = Math.max(0, ty - R);
  const y1 = Math.min(m.h - 1, ty + R);
  const x0 = Math.max(0, tx - R);
  const x1 = Math.min(W - 1, tx + R);
  const head = this.head;
  const blk = this.blk;
  for (let yy = y0; yy <= y1; yy++) {
    const row = yy * W;
    const brow = yy * BW;
    for (let xx = x0; xx <= x1; ) {
      if (blk[brow + (xx >> 3)] === 0) {
        xx = (xx | 7) + 1;
        continue;
      }
      for (let i = head[row + xx]; i >= 0; i = this.next[i]) fn(this.items[i]);
      xx++;
    }
  }
}

declare module '../ecology' {
  interface Ecology {
    record: typeof record;
    tilePassable: typeof tilePassable;
    findPath: typeof findPath;
    findPathAvoid: typeof findPathAvoid;
    goTo: typeof goTo;
    tileOf: typeof tileOf;
    ratOnDry: typeof ratOnDry;
    passable: typeof passable;
    litW: typeof litW;
    lit: typeof lit;
    spawn: typeof spawn;
    deposit: typeof deposit;
    nearestFloor: typeof nearestFloor;
    setDir: typeof setDir;
    moveToward: typeof moveToward;
    gaitOf: typeof gaitOf;
    tryMove: typeof tryMove;
    findMoss: typeof findMoss;
    updateForage: typeof updateForage;
    nearestForage: typeof nearestForage;
    eatMoss: typeof eatMoss;
    eat: typeof eat;
    die: typeof die;
    rebuildGrid: typeof rebuildGrid;
    nearby: typeof nearby;
  }
}

Object.assign(Ecology.prototype, { record, tilePassable, findPath, findPathAvoid, goTo, tileOf, ratOnDry, passable, litW, lit, spawn, deposit, nearestFloor, setDir, moveToward, gaitOf, tryMove, findMoss, updateForage, nearestForage, eatMoss, eat, die, rebuildGrid, nearby });
