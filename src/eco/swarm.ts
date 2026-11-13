/**
 * Ecology のメソッド：底の層（粒スライムと光る胞子）。
 *
 * どちらも1匹ずつの生き物にはせず、区画（SWARM_CELL タイル四方。192×144 のマップで 48×36 区画）ごとの密度として持つ。
 * 密度の1は養分の1で、保存則では生き物が持つ養分（heldNutrients）に数える。セーブに入れる（Ecology.serialize の BG・BS）。
 * 描画では、密度に合わせて区画の床に粒を出して動かす（src/creatureView.ts。粒の位置や動きは描画だけのもので、判断には使わない）。
 *
 * - 粒スライム（grains）：苔の群落で増え、育ちきった苔（MOSS_TOP を超えた分）だけを食べる。育ちきった苔はそれ以上伸びず、いずれ一部が枯れて土に戻る分なので、
 *   大ネズミなどが食べる苔は減らさない（根元12まで食べさせると、暗がりの苔は育ち直しが遅く、食べられる苔が10分の1になって大ネズミが減った）。湿った隣の区画へじわじわ広がり、乾いた区画では減る。
 *   減った分と、暮らしに使った分は、その区画の土の養分に戻る。濃く集まった湿った区画では、寄り集まって大きいスライムが1匹生まれる。
 *   大ネズミ・大トカゲ・大きいスライムが食べる（ゴブリンとコボルトにも食べさせると、main の10日目から比べて、ゴブリンが5シードで絶えたり、
 *   コボルトに倒されるゴブリンが倍以上になって同時にいる種の数が減ったりしたので、外した）。
 * - 光る胞子（spores）：育ちきったキノコ（FUNGUS_TOP を超えた分。いずれ一部が枯れて土に戻る分）から舞い上がる（夜は昼の3倍。
 *   育ちきっていない分まで取ると、アリの畑のキノコが減ってアリが減った）。まわりの区画へ漂って薄く広がり、時間がたつと消えて土に戻る。
 *   コウモリ・ウィスプ・マイコニドが食べる。大グモは、自分の巣のある区画の胞子（巣にかかった分）を食べる。
 *
 * 密度を動かすのは生き物の更新 SWARM_EVERY 回に1回（苔と同じ40 tick ごと）。食べるのは生き物ごとの更新の中（graze）。
 */
import { Cr, Ecology, Kind, SPEC, ih } from '../ecology';
import { TILE } from '../mapgen';

/** 区画の大きさ（タイル） */
export const SWARM_CELL = 4;
/** 密度を動かす間隔（生き物の更新の回数） */
const SWARM_EVERY = 20;
/** 粒スライムが食べるのは、苔がこれを超えた分だけ */
const MOSS_TOP = 150;
/** 光る胞子が舞い上がるのは、キノコがこれを超えた分から */
const FUNGUS_TOP = 90;
/** 区画あたりの密度の上限 */
const GRAIN_MAX = 240;
const SPORE_MAX = 150;
/** 粒スライムを食べる種と、光る胞子を食べる種 */
const GRAIN_EATERS = new Set<Kind>([Kind.Rat, Kind.Lizard, Kind.Slime]);
const SPORE_EATERS = new Set<Kind>([Kind.Bat, Kind.Wisp, Kind.Myconid]);

/** 区画の数（横・縦） */
export function swarmDims(this: Ecology): [number, number] {
  return [Math.ceil(this.w.map.w / SWARM_CELL), Math.ceil(this.w.map.h / SWARM_CELL)];
}

/** 密度の配列を、マップの大きさに合わせて用意する */
export function ensureSwarm(this: Ecology): void {
  const [gw, gh] = this.swarmDims();
  if (this.grains.length !== gw * gh) this.grains = new Int32Array(gw * gh);
  if (this.spores.length !== gw * gh) this.spores = new Int32Array(gw * gh);
}

/** ピクセルの位置の区画（なければ -1） */
export function swarmCell(this: Ecology, x: number, y: number): number {
  const [gw, gh] = this.swarmDims();
  const cx = Math.floor(x / TILE / SWARM_CELL);
  const cy = Math.floor(y / TILE / SWARM_CELL);
  return cx >= 0 && cy >= 0 && cx < gw && cy < gh ? cy * gw + cx : -1;
}

/** 区画の中のマスを順に渡す（マップの外は飛ばす） */
function eachTile(e: Ecology, cell: number, fn: (k: number) => void): void {
  const m = e.w.map;
  const gw = Math.ceil(m.w / SWARM_CELL);
  const x0 = (cell % gw) * SWARM_CELL;
  const y0 = Math.floor(cell / gw) * SWARM_CELL;
  for (let y = y0; y < y0 + SWARM_CELL && y < m.h; y++) for (let x = x0; x < x0 + SWARM_CELL && x < m.w; x++) fn(y * m.w + x);
}

/** 区画の中の、養分を返せる床（岩でも溶岩でも閉じた空洞でもないマス）を一つ（区画の番号と塩のハッシュで決まる最初のもの。なければ -1） */
function floorIn(e: Ecology, cell: number, salt: number): number {
  const m = e.w.map;
  const tiles: number[] = [];
  eachTile(e, cell, (k) => {
    if (!m.solid[k] && !m.sealed[k] && !m.lava[k]) tiles.push(k);
  });
  return tiles.length ? tiles[ih(cell, salt, 0x5a3) % tiles.length] : -1;
}

/** 区画の密度の一部を、その区画の床の土へ返す（返せる床がなければ返さずに残す）。返した量を返す */
function giveBack(e: Ecology, arr: Int32Array, cell: number, n: number, salt: number): number {
  if (n <= 0) return 0;
  const k = floorIn(e, cell, salt);
  if (k < 0) return 0;
  arr[cell] -= n;
  e.w.nutr[k] += n;
  return n;
}

/** 新しいダンジョンの始まり：苔のある区画に粒スライムを、キノコのある区画に光る胞子を、少し置いておく（苔とキノコから移す） */
export function seedSwarm(this: Ecology): void {
  this.ensureSwarm();
  const w = this.w;
  for (let c = 0; c < this.grains.length; c++) {
    let g = 0;
    eachTile(this, c, (k) => {
      if (w.map.sealed[k] || w.moss[k] <= MOSS_TOP || g >= 16) return;
      const t = Math.min(4, w.moss[k] - MOSS_TOP, 16 - g);
      w.moss[k] -= t;
      g += t;
    });
    this.grains[c] = g;
    let s = 0;
    eachTile(this, c, (k) => {
      if (w.map.sealed[k] || w.fungus[k] <= FUNGUS_TOP || s >= 12) return;
      const t = Math.min(3, w.fungus[k] - FUNGUS_TOP, 12 - s);
      w.fungus[k] -= t;
      s += t;
    });
    this.spores[c] = s;
  }
}

/** 密度を動かす（生き物の更新 SWARM_EVERY 回に1回） */
export function swarmStep(this: Ecology): void {
  if (this.step % SWARM_EVERY !== 7) return;
  this.ensureSwarm();
  const w = this.w;
  const m = w.map;
  const [gw, gh] = this.swarmDims();
  const G = this.grains;
  const S = this.spores;
  const N = G.length;
  const step = this.step;
  // 区画ごとの、食べられる苔・湿った床・キノコの群落の数
  const edible = new Int32Array(N);
  const wet = new Int32Array(N);
  const floor = new Int32Array(N);
  const fung = new Int32Array(N);
  for (let c = 0; c < N; c++)
    eachTile(this, c, (k) => {
      if (m.solid[k] || m.sealed[k] || m.lava[k]) return;
      floor[c]++;
      if (w.moss[k] > MOSS_TOP) edible[c] += w.moss[k] - MOSS_TOP;
      if (w.moist[k] >= 90) wet[c]++;
      if (w.fungus[k] > FUNGUS_TOP) fung[c]++;
    });
  const night = this.day < 0.3;
  // 粒スライム
  for (let c = 0; c < N; c++) {
    if (!floor[c]) continue;
    let g = G[c];
    if (g === 0) {
      // 苔の豊かな湿った区画に、まれに芽生える
      if (edible[c] >= 20 && wet[c] >= 2 && ih(c, step, 0x5a1) % 8 === 0) g = 2 - takeMoss(this, c, 2);
      G[c] = g;
      continue;
    }
    // 育ちきった苔を食べて増える（その分の4分の1まで）
    const want = Math.min(4, 1 + (g >> 3), edible[c] >> 2, GRAIN_MAX - g);
    if (want > 0) G[c] += want - takeMoss(this, c, want);
    // 暮らしに使った分と、乾いた区画で干からびた分は、土へ返る
    let loss = (G[c] >> 7) + (ih(c, step, 0x5a2) % 8 === 0 ? 1 : 0);
    if (wet[c] === 0) loss += Math.max(1, G[c] >> 2);
    giveBack(this, G, c, Math.min(G[c], loss), step);
    // 湿った隣の区画へ広がる
    if (G[c] >= 30) {
      const d = ih(c, step, 0x5a4) & 3;
      const cx = c % gw;
      const cy = Math.floor(c / gw);
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx >= 0 && ny >= 0 && nx < gw && ny < gh) {
        const n = ny * gw + nx;
        if (wet[n] >= 2 && G[n] < GRAIN_MAX) {
          const mv = Math.min(G[c] >> 3, GRAIN_MAX - G[n]);
          G[c] -= mv;
          G[n] += mv;
        }
      }
    }
    // 濃く集まった湿った区画では、寄り集まって大きいスライムが生まれる
    if (G[c] >= 160 && wet[c] >= 4 && this.counts[Kind.Slime] < 40 && ih(c, step, 0x5a5) % 6 === 0) {
      const k = floorIn(this, c, step + 1);
      if (k >= 0 && w.moist[k] >= 90) {
        G[c] -= 20;
        this.originNext = 'grain';
        const sl = this.spawn(Kind.Slime, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 12, 8);
        this.originNext = '';
        this.counts[Kind.Slime]++;
        this.record('settle', { t: w.tick, k: Kind.Slime, id: sl.id, ev: 'grainSlime', x: Math.round(sl.x), y: Math.round(sl.y) } as never);
      }
    }
  }
  // 光る胞子：舞い上がる、漂って広がる、消えて土へ返る
  const out = new Int32Array(N);
  for (let c = 0; c < N; c++) {
    if (!floor[c]) continue;
    if (fung[c] > 0 && S[c] < SPORE_MAX) {
      let em = Math.min(SPORE_MAX - S[c], (fung[c] * (night ? 3 : 1) + 1) >> 1);
      eachTile(this, c, (k) => {
        if (em <= 0 || m.sealed[k] || w.fungus[k] <= FUNGUS_TOP) return;
        w.fungus[k]--;
        S[c]++;
        em--;
      });
    }
    const s = S[c];
    if (s <= 0) continue;
    giveBack(this, S, c, (s >> 5) + (ih(c, step, 0x5a6) % 4 === 0 ? 1 : 0), step + 2);
    out[c] = S[c] >> 2;
  }
  for (let c = 0; c < N; c++) {
    if (!out[c]) continue;
    const cx = c % gw;
    const cy = Math.floor(c / gw);
    const each = out[c] >> 2;
    if (!each) continue;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const n = ny * gw + nx;
      if (!floor[n] || S[n] >= SPORE_MAX) continue;
      S[c] -= each;
      S[n] += each;
    }
  }
}

/** 区画の苔を、MOSS_TOP を残して want まで食べる（多いマスから順に1ずつ）。食べきれなかった量を返す */
function takeMoss(e: Ecology, cell: number, want: number): number {
  const w = e.w;
  const tiles: number[] = [];
  eachTile(e, cell, (k) => {
    if (!w.map.sealed[k] && w.moss[k] > MOSS_TOP) tiles.push(k);
  });
  tiles.sort((a, b) => w.moss[b] - w.moss[a] || a - b);
  let left = want;
  for (let pass = 0; pass < 6 && left > 0; pass++)
    for (const k of tiles) {
      if (left <= 0) break;
      if (w.moss[k] <= MOSS_TOP) continue;
      w.moss[k]--;
      left--;
    }
  return left;
}

/**
 * 底の層を食べる：腹が7割より空いていて、戦っていない生き物が、いる区画の粒スライムか光る胞子が濃ければ、ときどき少し食べる。
 * 歩きながら・飛びながら食べ、その回の行動は飛ばさない（false を返す。立ち止まらせると、大ネズミが巣穴へ帰って子を産む流れが途切れ、生まれる数が4割減った）。
 * 大グモは、自分の巣のそばにいて、巣のある区画に胞子があれば、巣にかかった胞子を食べ、その回は巣にとどまる（true を返す）
 */
export function graze(this: Ecology, c: Cr): boolean {
  if (c.away || c.flee > 0 || c.feed || this.w.tick - c.hitAt < 60) return false;
  const s = SPEC[c.k];
  if (c.food >= s.cap * 0.7) return false;
  const grain = GRAIN_EATERS.has(c.k);
  let x = c.x;
  let y = c.y;
  if (c.k === Kind.Spider) {
    const web = this.webs.find((o) => o.owner === c.id && (o.x - c.x) ** 2 + (o.y - c.y) ** 2 < (2 * TILE) ** 2);
    if (!web) return false;
    x = web.x;
    y = web.y;
  } else if (!grain && !SPORE_EATERS.has(c.k)) return false;
  if (this.grains.length === 0) return false;
  const cell = this.swarmCell(x, y);
  if (cell < 0) return false;
  const arr = grain ? this.grains : this.spores;
  // 胞子を食べる種（とくに数の多いウィスプ）は、粒スライムを食べる種の半分の頻度にする（同じにすると、胞子が漂う間もなく食べ尽くされた）
  if (arr[cell] < (grain ? 6 : 4) || ih(c.id, this.step, 0x5a7) % (grain ? 6 : 12) !== 0) return false;
  const n = Math.min(3, arr[cell], s.cap - c.food);
  if (n <= 0) return false;
  arr[cell] -= n;
  c.food += n;
  c.sinceMeal = 0;
  this.fxGraze.push({ t: this.w.tick, x: Math.round(c.x), y: Math.round(c.y), k: grain ? 0 : 1, by: c.id });
  if (this.fxGraze.length > 60) this.fxGraze.splice(0, 20);
  // 分析用（4回に1回だけ記録する）：n 0 粒スライム / 1 光る胞子 / 2 巣にかかった胞子
  if (ih(c.id, this.step, 0x5a8) % 4 === 0) this.record('settle', { t: this.w.tick, k: c.k, id: c.id, ev: 'graze', n: grain ? 0 : c.k === Kind.Spider ? 2 : 1, x: Math.round(c.x), y: Math.round(c.y) } as never);
  if (c.k === Kind.Spider) {
    c.act = 0;
    return true;
  }
  return false;
}

/** 保存則：底の層が持つ養分の合計 */
export function swarmNutrients(this: Ecology): number {
  let s = 0;
  for (let i = 0; i < this.grains.length; i++) s += this.grains[i] + this.spores[i];
  return s;
}

declare module '../ecology' {
  interface Ecology {
    swarmDims: typeof swarmDims;
    ensureSwarm: typeof ensureSwarm;
    swarmCell: typeof swarmCell;
    seedSwarm: typeof seedSwarm;
    swarmStep: typeof swarmStep;
    graze: typeof graze;
    swarmNutrients: typeof swarmNutrients;
  }
}

Object.assign(Ecology.prototype, { swarmDims, ensureSwarm, swarmCell, seedSwarm, swarmStep, graze, swarmNutrients });
