import { CR_EVERY, Ecology } from './ecology';
import { MapData, TILE, generate, lineOfSight } from './mapgen';

export const TICKS_PER_SEC = 10;
/** 地上の一日（通常速度で24分、仮） */
export const DAY_TICKS = 24 * 60 * TICKS_PER_SEC;
/** 水を流す間隔（刻み） */
export const WATER_EVERY = 5;
/** 苔を育てる間隔（刻み） */
export const MOSS_EVERY = 20;

/** 高さ1あたりの水の量（水面の高さ = 高さ×HS + 水量） */
const HS = 2;
/** 湧き水の基本量（1回の水の刻みあたり） */
const SPRING_BASE = 80;
/** 吸い込み穴が1回に吸う量 */
const SINK_RATE = 70;
/** 水量の変化の周期（地上の3日） */
const SPRING_PERIOD = DAY_TICKS * 3;
/** 苔が育つ湿り気 */
const MOIST_GROW = 110;
/** これを下回ると苔が枯れ始める */
const MOIST_DRY = 90;
/** はじめに水を流しておく回数 */
const WARMUP_WATER_STEPS = 900;

export type LightKind = 'shaft' | 'bounce' | 'entrance' | 'torch';
export interface Light {
  kind: LightKind;
  x: number;
  y: number;
  r: number;
  i: number;
  c: [number, number, number];
  occ: boolean;
}

const SHAFT_COLOR: [number, number, number] = [1, 0.9, 0.72];
const BOUNCE_COLOR: [number, number, number] = [0.86, 0.86, 0.96];
const ENTRANCE_COLOR: [number, number, number] = [1, 0.95, 0.86];

export function dayIntensity(tick: number): number {
  const p = (tick % DAY_TICKS) / DAY_TICKS;
  if (p < 0.2) return 0;
  if (p < 0.28) return (p - 0.2) / 0.08;
  if (p < 0.7) return 1;
  if (p < 0.78) return 1 - (p - 0.7) / 0.08;
  return 0;
}

export function timeLabel(tick: number): string {
  const p = (tick % DAY_TICKS) / DAY_TICKS;
  const day = Math.floor(tick / DAY_TICKS) + 1;
  const part = p < 0.2 ? '夜' : p < 0.28 ? '夜明け' : p < 0.45 ? '朝' : p < 0.62 ? '昼' : p < 0.78 ? '夕暮れ' : '夜';
  return `${day}日目　${part}`;
}

/** 整数のハッシュ（偶然の判定に使う。どの端末でも同じ） */
function ih(a: number, b: number): number {
  let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** 光源の形（見た目と苔の生育で共通） */
function lightShape(m: MapData): Light[] {
  const out: Light[] = [];
  for (const s of m.shafts) {
    const x = s.x * TILE + 8;
    const y = s.y * TILE + 8;
    out.push({ kind: 'shaft', x, y, r: 72, i: 1.05, c: SHAFT_COLOR, occ: false });
    out.push({ kind: 'bounce', x, y, r: 160, i: 0.34, c: BOUNCE_COLOR, occ: true });
  }
  const e = m.entrance;
  out.push({ kind: 'entrance', x: e.x * TILE + 16, y: e.y * TILE + 4, r: 120, i: 1.15, c: ENTRANCE_COLOR, occ: true });
  // 地表の横穴から差し込む日の光（閉じた空洞の中にある間は、光が通っても苔の育つ所は閉じたまま）
  for (const mo of m.mouths) {
    if (mo.kind !== 0) continue;
    const tx = mo.y === 0 ? mo.x : mo.x === 0 ? 1 : mo.x - 1;
    const ty = mo.y === 0 ? 1 : mo.y;
    out.push({ kind: 'entrance', x: tx * TILE + 8, y: ty * TILE + 8, r: 130, i: 1.05, c: [1.0, 0.9, 0.74], occ: true });
  }
  return out;
}

export interface WorldState {
  tick: number;
  water: Int32Array;
  nutr: Int32Array;
  moss: Uint8Array;
  seen: Uint8Array;
  eco: unknown;
  fungus: Uint8Array;
  /** 掘られたマスの順番 */
  digs: number[];
  burn: Uint8Array;
  ash: Uint8Array;
  /** 微生物の膜 */
  mat?: Uint8Array;
  /** 生まれた養分と、水に溶けて流れ出た養分の帳簿 */
  born?: number;
  washed?: number;
  /** マナと、その帳簿（湧いた、外へ逃げた、薄れて消えた） */
  mana?: Int32Array;
  manaBorn?: number;
  manaLeaked?: number;
  manaFaded?: number;
}

export class World {
  readonly map: MapData;
  tick: number;
  readonly seen: Uint8Array;
  /** 水量（整数） */
  readonly water: Int32Array;
  /** 土の養分（整数。苔に取り込まれた分と合わせて総量が保存される） */
  readonly nutr: Int32Array;
  /** 苔の量 0..255（取り込んだ養分の量そのもの） */
  readonly moss: Uint8Array;
  /** 熱 0..255（溶岩からの距離で決まる） */
  readonly heat: Uint8Array;
  /** 真昼の光の強さ 0..1000（光の筋と入口から。昼夜で増減させて使う） */
  readonly lightBase: Uint16Array;
  /** 湿り気（苔の刻みごとに計算） */
  readonly moist: Uint8Array;
  /** 見た目用：苔と溶岩の光のにじみ（マス単位） */
  readonly mossGlow: Float32Array;
  readonly lavaGlow: Float32Array;
  /** キノコの量 0..255（取り込んだ養分の量そのもの） */
  readonly fungus: Uint8Array;
  /** 見た目用：キノコの淡い光のにじみ */
  readonly fungusGlow: Float32Array;
  totalFungus = 0;
  /** 掘られたマス（順番に記録し、保存と再現に使う） */
  readonly digs: number[] = [];
  /** 地形が変わった（描画側で地図を送り直す） */
  terrainDirty = false;
  /** 燃えているマス（残りの刻み）と、焼け跡（濃さ、ゆっくり薄れる） */
  readonly burn: Uint8Array;
  readonly ash: Uint8Array;
  fxDirty = true;

  fieldsDirty = true;
  glowDirty = true;
  /** 生き物たち */
  readonly eco: Ecology;
  /** 苔の総量（苔の刻みごとに数える） */
  totalMoss = 0;
  private prevPhase = 0;

  private floors: Int32Array = new Int32Array(0);
  /** 床マスごとの上下左右の隣（なければ -1）。floors と同じ並び */
  private nb: Int32Array = new Int32Array(0);
  private readonly dW: Int32Array;
  private readonly dN: Int32Array;
  private readonly wetNear: Int32Array;
  private readonly tmp: Int32Array;
  private readonly lightList: Light[];

  constructor(seed: string, state?: Partial<WorldState>) {
    const m = (this.map = generate(seed));
    const N = m.w * m.h;
    this.tick = state?.tick ?? Math.floor(DAY_TICKS * 0.3);
    this.seen = state?.seen && state.seen.length === N ? state.seen : new Uint8Array(N);
    this.water = state?.water && state.water.length === N ? state.water : new Int32Array(N);
    this.nutr = state?.nutr && state.nutr.length === N ? state.nutr : Int32Array.from(m.nutrients);
    this.moss = state?.moss && state.moss.length === N ? state.moss : Uint8Array.from(m.moss);
    this.heat = new Uint8Array(N);
    this.lightBase = new Uint16Array(N);
    this.moist = new Uint8Array(N);
    this.mossGlow = new Float32Array(N);
    this.lavaGlow = new Float32Array(N);
    this.dW = new Int32Array(N);
    this.dN = new Int32Array(N);
    this.wetNear = new Int32Array(N);
    this.tmp = new Int32Array(N);
    this.lightList = lightShape(m);
    this.fungus = state?.fungus && state.fungus.length === N ? state.fungus : new Uint8Array(N);
    this.fungusGlow = new Float32Array(N);
    this.burn = state?.burn && state.burn.length === N ? state.burn : new Uint8Array(N);
    this.ash = state?.ash && state.ash.length === N ? state.ash : new Uint8Array(N);
    this.mat = state?.mat && state.mat.length === N ? state.mat : new Uint8Array(N);
    this.mana = state?.mana && state.mana.length === N ? state.mana : new Int32Array(N);
    this.manaBorn = state?.manaBorn ?? 0;
    this.manaLeaked = state?.manaLeaked ?? 0;
    this.manaFaded = state?.manaFaded ?? 0;
    this.manaTmp = new Int32Array(N);
    this.born = state?.born ?? 0;
    this.washed = state?.washed ?? 0;
    // 保存されていた掘削をやり直して、地形を復元する
    this.initialRock = 0;
    for (let k = 0; k < this.map.solid.length; k++) if (this.map.solid[k]) this.initialRock++;
    // 地形の変化を順に再生する（掘る、瓦礫を置く、崩落）。空洞が開くのも同じ順で起きる
    for (const op of state?.digs ?? []) this.replayOp(op);
    this.openedQueue.length = 0;
    this.collapseQueue.length = 0;

    this.buildFloors();
    this.computeHeat();
    this.computeLightBase();
    this.computeLavaGlow();
    // 新しいダンジョンは、湧き水がすでに流れ出した状態から始める
    if (!state?.water) for (let i = 0; i < WARMUP_WATER_STEPS; i++) this.waterStep();
    this.computeMoist();
    for (let k = 0; k < N; k++) {
      this.totalMoss += this.moss[k];
      this.totalFungus += this.fungus[k];
    }
    this.eco = new Ecology(this);
    if (state?.eco) this.eco.restore(state.eco);
    else this.eco.seed();
    this.prevPhase = (this.tick % DAY_TICKS) / DAY_TICKS;
    // 光る苔とキノコの光は状態から決まる。作った直後に一度計算する（保存から読み込んでも同じ光になる）
    this.computeGlow();
  }

  // ---------- 地形と、地形から決まる場 ----------

  private buildFloors(): void {
    const m = this.map;
    const fl: number[] = [];
    for (let k = 0; k < m.w * m.h; k++) if (!m.solid[k]) fl.push(k);
    this.floors = Int32Array.from(fl);
    this.nb = new Int32Array(fl.length * 4).fill(-1);
    for (let i = 0; i < fl.length; i++) {
      const k = fl[i];
      const x = k % m.w;
      const y = (k / m.w) | 0;
      const cand = [x + 1 < m.w ? k + 1 : -1, x > 0 ? k - 1 : -1, y + 1 < m.h ? k + m.w : -1, y > 0 ? k - m.w : -1];
      for (let d = 0; d < 4; d++) if (cand[d] >= 0 && !m.solid[cand[d]]) this.nb[i * 4 + d] = cand[d];
    }
  }

  // ---------- マナ ----------

  /**
   * マナ：養分とは別の魔力の流れ（マスごとの量）。深部、地底の裂け目、溶岩のそば、宝物庫から湧き、
   * 開いた床を伝って隣へ少しずつ広がり、正面の入口と開いた地表の横穴から外へ逃げ、どこでもごくわずかずつ薄れて消える。
   * 生き物は体にマナを溜め（ウィスプが土から吸い、食べた者へ受け渡され）、死ぬとその場の土に還る（ecology）。
   * 帳簿：マナの総量（土＋生き物） ＝ 湧いた − 逃げた − 薄れた
   */
  mana: Int32Array;
  manaBorn: number;
  manaLeaked: number;
  manaFaded: number;
  private manaTmp: Int32Array;

  /** マナの湧く所（タイルと、地上の時間で5秒ごとの湧く量） */
  private manaSources(): [number, number][] {
    if (this.manaSrcCache) return this.manaSrcCache;
    const m = this.map;
    const out: [number, number][] = [];
    // 深部：中心のまわり（床でなくてもよい。岩の中に湧いたマナは、そこが開くまで溜まる）
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push([(m.deep.y + dy) * m.w + m.deep.x + dx, 1]);
    // 地底の裂け目
    for (const mo of m.mouths) if (mo.kind === 1) out.push([mo.y * m.w + mo.x, 6]);
    // 宝物庫（古い魔法）
    let vk = -1;
    for (let k = 0; k < m.vault.length; k++) if (m.vault[k] && !m.solid[k]) { vk = k; break; }
    if (vk >= 0) out.push([vk, 2]);
    // 溶岩のそばの床（8つに1つ）
    for (let k = m.w; k < m.solid.length - m.w; k++) {
      if (!m.lava[k] || ih(k, 31) % 8 !== 0) continue;
      for (const n of [k + 1, k - 1, k + m.w, k - m.w]) if (!m.lava[n]) { out.push([n, 1]); break; }
    }
    this.manaSrcCache = out;
    return out;
  }
  private manaSrcCache: [number, number][] | null = null;

  /** マナの刻み（地上の時間で5秒ごと）：湧く、隣へ広がる、外へ逃げる、薄れる */
  private manaStep(): void {
    const m = this.map;
    const M = this.mana;
    const T = this.manaTmp;
    for (const [k, n] of this.manaSources()) {
      M[k] += n * 2;
      this.manaBorn += n * 2;
    }
    // 岩盤からのしみ出し：深い所（地図の下のほう）ほど、あちこちからわずかずつ湧く
    {
      const step = (this.tick / 50) | 0;
      for (let i = 0; i < 60; i++) {
        const r1 = ih(step * 61 + i, 401) / 4294967296;
        const r2 = ih(step * 61 + i, 402) / 4294967296;
        const y = Math.min(m.h - 2, 1 + Math.floor(m.h * (0.25 + 0.75 * Math.sqrt(r1))));
        const x = 1 + Math.floor(r2 * (m.w - 2));
        const k = y * m.w + x;
        M[k] += 2;
        this.manaBorn += 2;
      }
    }
    // 広がる：隣のマスへ、差に応じて少しずつ。開いた床どうしは速く（差の6分の1）、岩を通るときはゆっくり（差の16分の1）。
    // マナは魔力なので岩にも染みとおり、深部から湧いたマナが地図全体へじわじわ広がる
    T.fill(0);
    const W = m.w;
    const H = m.h;
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const k = y * W + x;
        const v = M[k];
        if (v < 2) continue;
        for (const n of [k + 1, k + W]) {
          const d = v - M[n];
          const rock = m.solid[k] || m.solid[n];
          // 差が小さくても少しずつは流れる（岩は差が4以上のときだけ）
          if (d >= (rock ? 4 : 2)) {
            const f = Math.max(1, (d / (rock ? 16 : 6)) | 0);
            T[k] -= f;
            T[n] += f;
          }
        }
        for (const n of [k - 1, k - W]) {
          const d = v - M[n];
          const rock = m.solid[k] || m.solid[n];
          // 差が小さくても少しずつは流れる（岩は差が4以上のときだけ）
          if (d >= (rock ? 4 : 2)) {
            const f = Math.max(1, (d / (rock ? 16 : 6)) | 0);
            T[k] -= f;
            T[n] += f;
          }
        }
      }
    for (let k = 0; k < M.length; k++) if (T[k]) M[k] += T[k];
    // 外へ逃げる：正面の入口と、開いた地表の横穴
    const leak = (k: number) => {
      const f = M[k] >> 2;
      if (f > 0) {
        M[k] -= f;
        this.manaLeaked += f;
      }
    };
    for (let y = 0; y <= 2; y++) for (let x = m.entrance.x - 1; x <= m.entrance.x + 2; x++) leak(y * W + x);
    for (const mo of m.mouths) {
      if (mo.kind !== 0) continue;
      const tx = mo.y === 0 ? mo.x : mo.x === 0 ? 1 : mo.x - 1;
      const ty = mo.y === 0 ? 1 : mo.y;
      if (!m.sealed[ty * W + tx]) leak(ty * W + tx);
    }
    // 薄れる：どこでもごくわずかずつ（地上の1日でおよそ8％。端数は刻みごとの揺らぎで丸める）。湧く量と釣り合う所で落ち着く
    {
      const step = (this.tick / 50) | 0;
      for (let k = 0; k < M.length; k++) {
        const v = M[k];
        if (v <= 0) continue;
        const f = ((v + (ih(k, step) % 3600)) / 3600) | 0;
        if (f > 0) {
          M[k] -= f;
          this.manaFaded += f;
        }
      }
    }
    this.fieldsDirty = true;
  }

  /** 土のマナの合計 */
  soilMana(): number {
    let s = 0;
    for (let k = 0; k < this.mana.length; k++) s += this.mana[k];
    return s;
  }

  /** マナの総量（土＋生き物） */
  totalMana(): number {
    return this.soilMana() + this.eco.heldMana();
  }

  // ---------- 養分の生まれる元と、流れ出る先 ----------

  /** 微生物の膜（溶岩や熱い所のそばに育つ。0〜220） */
  mat: Uint8Array;
  /** 生まれた養分（光合成、化学合成、岩の風化、湧き水）と、吸い込み穴から流れ出た養分 */
  born = 0;
  washed = 0;
  /** 瓦礫が風化して土に返った数（岩の帳簿） */
  weathered = 0;

  /**
   * 養分の生まれる元（地上の時間で10秒ごと）。どれも頭打ちがあり、吸い込み穴から流れ出る分とつり合う。
   * 光合成：昼、光の筋の下の苔のマスで、土が痩せていれば新しい養分が生まれる。
   * 化学合成：熱い所の微生物の膜が育って広がり、厚い膜の下の土に養分が生まれる。
   * 岩の風化：新しく掘った床ほど養分が染み出し、瓦礫はゆっくり崩れて土に返る。
   * 湧き水：溶けた養分を少しずつ運び込む。
   */
  private nutrientStep(): void {
    const m = this.map;
    const Nu = this.nutr;
    const fl = this.floors;
    const step = (this.tick / 100) | 0;
    const day = dayIntensity(this.tick);
    let terrain = false;
    let matChanged = false;
    for (let i = 0; i < fl.length; i++) {
      const k = fl[i];
      if (m.lava[k]) continue;
      // 光合成
      if (day > 0.3 && this.lightBase[k] * day > 60 && this.moss[k] > 40 && Nu[k] < 30 && ih(k * 13 + 301, step) % 6 === 0) {
        Nu[k]++;
        this.born++;
      }
      // 化学合成：熱い所に膜が生まれ、隣へ広がる
      const h = this.heat[k];
      if (h > 90 && this.water[k] < 30) {
        let seed = this.mat[k] > 0;
        if (!seed) for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (m.lava[q] || this.mat[q] > 60) seed = true;
        if (seed && this.mat[k] < 220 && ih(k * 13 + 302, step) % 3 === 0) {
          this.mat[k] = Math.min(220, this.mat[k] + 3);
          matChanged = true;
        }
        if (this.mat[k] > 100 && Nu[k] < 30 && ih(k * 13 + 303, step) % 5 === 0) {
          Nu[k]++;
          this.born++;
        }
      } else if (this.mat[k] > 0 && (h < 60 || this.water[k] > 60) && ih(k * 13 + 304, step) % 4 === 0) {
        // 冷えたり水に浸かったりすると膜は弱る（養分は土へ）
        const d = Math.min(this.mat[k], 4);
        this.mat[k] -= d;
        matChanged = true;
      }
    }
    // 豊かすぎる土の養分は、地下水に溶けて少しずつ深みへ流れ去る（つり合いの元）
    for (let i = 0; i < fl.length; i++) {
      const k = fl[i];
      if (Nu[k] > 70 && ih(k * 13 + 308, step) % 3 === 0) {
        Nu[k]--;
        this.washed++;
      }
    }
    // 岩の風化：新しく掘ったマス（最近の300マス）から養分が染み出す
    let seenOps = 0;
    for (let i = this.digs.length - 1; i >= 0 && seenOps < 300; i--) {
      const op = this.digs[i];
      if ((op & 7) !== 0) continue;
      seenOps++;
      const k = op >> 3;
      if (m.solid[k] || Nu[k] >= 40) continue;
      if (ih(k * 13 + 305, step) % 8 === 0) {
        Nu[k]++;
        this.born++;
      }
    }
    // 瓦礫は長い時間をかけて崩れ、土に返る（地上でおよそ6日）
    for (let k = 0; k < m.rubble.length; k++) {
      if (!m.rubble[k] || ih(k * 13 + 306, step) % 864 !== 0) continue;
      this.applyWeather(k);
      terrain = true;
    }
    // 湧き水が溶けた養分を運び込む
    for (const sp of m.springs) {
      const k = sp.y * m.w + sp.x;
      if (m.solid[k] || ih(k * 13 + 307, step) % 2 !== 0) continue;
      Nu[k]++;
      this.born++;
    }
    // 吸い込み穴：水に溶けた養分が外へ流れ出る
    for (const sk of m.sinks) {
      const k = sk.y * m.w + sk.x;
      if (m.sealed[k] && !this.water[k]) continue;
      const w = Math.min(Nu[k], 4);
      Nu[k] -= w;
      this.washed += w;
    }
    if (terrain) {
      this.buildFloors();
      this.computeHeat();
      this.computeLightBase();
      this.terrainDirty = true;
    }
    if (matChanged) this.fieldsDirty = true;
  }

  /** 石畳を敷く（ドワーフの広間）。地形の変化として記録する */
  pave(k: number): void {
    this.applyPave(k);
    this.terrainDirty = true;
  }
  private applyPave(k: number): void {
    if (this.map.solid[k]) return;
    this.map.paved[k] = 1;
    this.digs.push(k * 8 + 4);
  }

  /** 瓦礫が土に返る：通れる床になり、養分が少し生まれる */
  private applyWeather(k: number, replay = false): void {
    const m = this.map;
    if (!m.rubble[k]) return;
    m.rubble[k] = 0;
    m.solid[k] = 0;
    m.dug[k] = 1;
    this.weathered++;
    // 読み込み時の再生では、養分はすでに保存された土の中にある
    if (!replay) {
      this.nutr[k] += 15;
      this.born += 15;
    }
    this.digs.push(k * 8 + 3);
  }

  /** 生き物が使える養分（開いた場所の土、苔、キノコ、膜の下の分を含む）。閉じた空洞の中は数えない */
  availableNutrients(): number {
    const m = this.map;
    let s = 0;
    for (let k = 0; k < this.nutr.length; k++) if (!m.sealed[k]) s += this.nutr[k] + this.moss[k] + this.fungus[k];
    return s + this.eco.heldNutrients(true);
  }

  // ---------- 岩、瓦礫、閉じた空洞 ----------

  /** はじめの岩の量（岩と瓦礫と掘り出した土と崩落の帳簿の基準） */
  initialRock = 0;
  /** 掘り出して、まだ瓦礫として置いていない土 */
  rockStock = 0;
  /** 崩落で天井から落ちてきた瓦礫の数 */
  collapsed = 0;
  /** 掘り当てた空洞（eco が記録に残す） */
  readonly openedQueue: { k: number; n: number }[] = [];
  /** 崩落（eco が下にいた生き物を押しつぶす） */
  readonly collapseQueue: { k: number; n: number }[] = [];

  private replayOp(op: number): void {
    const k = op >> 3;
    const t = op & 7;
    if (t === 0) this.applyDig(k);
    else if (t === 1) this.applyRubble(k, false);
    else if (t === 2) this.applyRubble(k, true);
    else if (t === 3) this.applyWeather(k, true);
    else this.applyPave(k);
  }

  /** 瓦礫を置く（ceiling = 崩落で天井から落ちた） */
  private applyRubble(k: number, ceiling: boolean): void {
    const m = this.map;
    if (m.solid[k]) return;
    m.solid[k] = 1;
    m.rubble[k] = 1;
    m.sealed[k] = 0;
    if (ceiling) this.collapsed++;
    else this.rockStock--;
    this.digs.push(k * 8 + (ceiling ? 2 : 1));
  }

  /** 岩と瓦礫の帳簿：岩＋瓦礫＋掘り出した土−崩落 ＝ はじめの岩 */
  rockLedger(): number {
    const m = this.map;
    let n = 0;
    for (let k = 0; k < m.solid.length; k++) if (m.solid[k]) n++;
    return n + this.rockStock - this.collapsed + this.weathered;
  }

  /** 近くの閉じた空洞の床（なければ -1）。掘り手が「空洞の気配」を感じる */
  nearestSealed(x: number, y: number, R: number): number {
    const m = this.map;
    for (let r = 1; r <= R; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 2 || yy < 2 || xx >= m.w - 2 || yy >= m.h - 2) continue;
          const k = yy * m.w + xx;
          if (m.sealed[k] && !m.solid[k]) return k;
        }
    return -1;
  }

  /** 掘り出した土を、近くの通り道をふさがない窪みに瓦礫として置く（置けなければ持っておく） */
  private dumpSpoil(near: number): void {
    const m = this.map;
    if (this.rockStock <= 0) return;
    const x0 = near % m.w;
    const y0 = (near / m.w) | 0;
    for (let r = 2; r <= 4 && this.rockStock > 0; r++)
      for (let dy = -r; dy <= r && this.rockStock > 0; dy++)
        for (let dx = -r; dx <= r && this.rockStock > 0; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = x0 + dx;
          const y = y0 + dy;
          if (x < 3 || y < 4 || x >= m.w - 3 || y >= m.h - 3) continue;
          const k = y * m.w + x;
          if (m.solid[k] || m.lava[k] || this.water[k] > 20 || m.paved[k]) continue;
          const o = [k - m.w, k + 1, k + m.w, k - 1].map((q) => !m.solid[q]);
          const n4 = o.filter(Boolean).length;
          let ok = n4 <= 1;
          // 角の窪み：開いた二辺が直角で、その間の斜めも開いていれば、ふさいでも道は切れない
          if (n4 === 2) {
            for (let i = 0; i < 4; i++) {
              const a = i;
              const b = (i + 1) % 4;
              if (!o[a] || !o[b]) continue;
              const dxs = [0, 1, 0, -1];
              const dys = [-1, 0, 1, 0];
              const dg = k + (dys[a] + dys[b]) * m.w + dxs[a] + dxs[b];
              if (!m.solid[dg]) ok = true;
            }
          }
          if (n4 === 0) ok = false;
          if (!ok) continue;
          this.applyRubble(k, false);
        }
  }

  /** 支えのない広すぎる、掘って広げた空間は崩れる（半径2の範囲がすべて開いていたら） */
  private checkCollapse(): void {
    const m = this.map;
    for (let i = this.digs.length - 1; i >= 0; i--) {
      const op = this.digs[i];
      if ((op & 7) !== 0) continue;
      const k = op >> 3;
      if (m.solid[k] || !m.dug[k]) continue;
      const x = k % m.w;
      const y = (k / m.w) | 0;
      // 柔らかい層は崩れやすい：支えが一つしかなくても崩れる
      let supports = 0;
      const allow = m.hard[k] === 0 ? 1 : 0;
      for (let dy = -2; dy <= 2 && supports <= allow; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const q = (y + dy) * m.w + x + dx;
          if (m.solid[q] || m.lava[q]) supports++;
        }
      const open = supports <= allow;
      if (!open) continue;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const q = (y + dy) * m.w + x + dx;
          if (!m.dug[q] || m.solid[q]) continue;
          if (((q * 2654435761) >>> 0) % 10 < 7 || (dx === 0 && dy === 0)) {
            this.applyRubble(q, true);
            n++;
          }
        }
      if (n) {
        this.collapseQueue.push({ k, n });
        this.buildFloors();
        this.computeHeat();
        this.computeLightBase();
        this.terrainDirty = true;
        this.fieldsDirty = true;
        return;
      }
    }
  }

  private applyDig(k: number): void {
    const m = this.map;
    if (!m.solid[k]) return;
    m.solid[k] = 0;
    m.dug[k] = 1;
    m.paved[k] = 0;
    // 掘り出した岩（または瓦礫）は土になる
    m.rubble[k] = 0;
    this.rockStock++;
    // 開いた床に面していれば、この床も開いた側。面している閉じた空洞は掘り当てられて開く
    {
      let openN = false;
      const sealedN: number[] = [];
      for (const q of [k + 1, k - 1, k + m.w, k - m.w]) {
        if (q < 0 || q >= m.solid.length || m.solid[q] || m.lava[q]) continue;
        if (m.sealed[q]) sealedN.push(q);
        else openN = true;
      }
      if (openN) {
        m.sealed[k] = 0;
        for (const q of sealedN) {
          if (!m.sealed[q]) continue;
          let n = 0;
          const st = [q];
          m.sealed[q] = 0;
          while (st.length) {
            const c = st.pop() as number;
            n++;
            for (const r of [c + 1, c - 1, c + m.w, c - m.w]) {
              if (r < 0 || r >= m.solid.length || m.solid[r] || !m.sealed[r]) continue;
              m.sealed[r] = 0;
              st.push(r);
            }
          }
          this.openedQueue.push({ k: q, n });
        }
      } else if (sealedN.length) m.sealed[k] = 1;
    }
    // 高さと湿り気は、まわりの床にならう
    const x = k % m.w;
    const y = (k / m.w) | 0;
    let hs = 0;
    let us = 0;
    let n = 0;
    for (const q of [k + 1, k - 1, k + m.w, k - m.w]) {
      const qx = q % m.w;
      const qy = (q / m.w) | 0;
      if (q < 0 || q >= m.solid.length || Math.abs(qx - x) + Math.abs(qy - y) !== 1 || m.solid[q]) continue;
      hs += m.height[q];
      us += m.humidity[q];
      n++;
    }
    if (n) {
      m.height[k] = Math.floor(hs / n);
      m.humidity[k] = Math.floor(us / n);
    }
    this.digs.push(k * 8);
  }

  /** いくつものマスをまとめて掘る（ワーム）。計算し直しは一度だけ */
  digMany(ks: number[]): number {
    const m = this.map;
    let n = 0;
    for (const k of ks) {
      const x = k % m.w;
      const y = (k / m.w) | 0;
      if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2 || !m.solid[k]) continue;
      this.applyDig(k);
      n++;
    }
    if (n) this.dumpSpoil(ks[ks.length - 1]);
    if (n) {
      this.buildFloors();
      this.computeHeat();
      this.computeLightBase();
      this.computeLavaGlow();
      this.terrainDirty = true;
      this.fieldsDirty = true;
      this.glowDirty = true;
    }
    return n;
  }

  /** 岩のマスを掘って床にする（コボルトやワームが使う）。水の流れ、熱、光の届き方を計算し直す */
  dig(k: number): boolean {
    const m = this.map;
    const x = k % m.w;
    const y = (k / m.w) | 0;
    if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2 || !m.solid[k]) return false;
    this.applyDig(k);
    this.dumpSpoil(k);
    this.buildFloors();
    this.computeHeat();
    this.computeLightBase();
    this.computeLavaGlow();
    this.terrainDirty = true;
    this.fieldsDirty = true;
    this.glowDirty = true;
    return true;
  }

  // ---------- 静的な場 ----------

  private computeHeat(): void {
    this.heat.fill(0);
    const m = this.map;
    const N = m.w * m.h;
    const d = new Int32Array(N).fill(-1);
    const q = new Int32Array(N);
    let qh = 0;
    let qt = 0;
    for (let k = 0; k < N; k++)
      if (m.lava[k]) {
        d[k] = 0;
        q[qt++] = k;
      }
    while (qh < qt) {
      const c = q[qh++];
      if (d[c] >= 7) continue;
      const cx = c % m.w;
      const cy = (c / m.w) | 0;
      const ns = [cx + 1 < m.w ? c + 1 : -1, cx > 0 ? c - 1 : -1, cy + 1 < m.h ? c + m.w : -1, cy > 0 ? c - m.w : -1];
      for (const n of ns) {
        if (n < 0 || m.solid[n] || d[n] >= 0) continue;
        d[n] = d[c] + 1;
        q[qt++] = n;
      }
    }
    for (let k = 0; k < N; k++) this.heat[k] = d[k] < 0 ? 0 : Math.max(0, 255 - d[k] * 36);
  }

  private computeLightBase(): void {
    const m = this.map;
    const acc = new Float64Array(m.w * m.h);
    this.lightBase.fill(0);
    for (const l of this.lightList) {
      const R = Math.ceil(l.r / TILE) + 1;
      const lx = Math.floor(l.x / TILE);
      const ly = Math.floor(l.y / TILE);
      for (let ty = ly - R; ty <= ly + R; ty++)
        for (let tx = lx - R; tx <= lx + R; tx++) {
          if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
          const cx = tx * TILE + 8;
          const cy = ty * TILE + 8;
          const dx = cx - l.x;
          const dy = cy - l.y;
          const dd = Math.sqrt(dx * dx + dy * dy);
          if (dd >= l.r) continue;
          const f = 1 - dd / l.r;
          if (l.occ && !lineOfSight(m, l.x, l.y, cx, cy)) continue;
          acc[ty * m.w + tx] += f * (0.45 + 0.55 * f) * l.i;
        }
    }
    for (let k = 0; k < acc.length; k++) this.lightBase[k] = Math.min(1000, Math.round(acc[k] * 1000));
  }

  private spreadGlow(out: Float32Array, k: number, v: number, R: number): void {
    const m = this.map;
    const x = k % m.w;
    const y = (k / m.w) | 0;
    const cx = x * TILE + 8;
    const cy = y * TILE + 8;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > R + 0.2) continue;
        const f = 1 - d / (R + 0.4);
        if (d > 1.1 && !lineOfSight(m, cx, cy, nx * TILE + 8, ny * TILE + 8)) continue;
        out[ny * m.w + nx] += v * f * f;
      }
  }

  private computeLavaGlow(): void {
    this.lavaGlow.fill(0);
    for (let k = 0; k < this.lavaGlow.length; k++) if (this.map.lava[k]) this.spreadGlow(this.lavaGlow, k, 0.35, 5);
  }

  /** 見た目用：苔の光のにじみ（シミュレーションには使わない） */
  computeGlow(): void {
    this.mossGlow.fill(0);
    // 豊かな所ほど強く光る：苔やキノコの量に、まわりの土の豊かさを掛け合わせる
    const rich = (k: number) => {
      const w = this.map.w;
      const n = this.nutr[k] + this.nutr[k + 1] + this.nutr[k - 1] + this.nutr[k + w] + this.nutr[k - w];
      return 0.75 + Math.min(1, n / 200) * 0.9;
    };
    for (const k of this.floors) if (this.moss[k] >= 24) this.spreadGlow(this.mossGlow, k, (this.moss[k] / 255) * 0.13 * rich(k), 3);
    this.fungusGlow.fill(0);
    for (const k of this.floors) if (this.fungus[k] >= 30) this.spreadGlow(this.fungusGlow, k, (this.fungus[k] / 255) * 0.1 * rich(k), 2);
    this.glowDirty = false;
  }

  /** 湿り気 = 地の湿り気 + 近くの水 - 熱 */
  private computeMoist(): void {
    const m = this.map;
    const W = m.w;
    const t = this.tmp;
    const w = this.wetNear;
    // 5×5 の最大の水量（横、縦の順に）
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < W; x++) {
        let mx = 0;
        for (let d = -2; d <= 2; d++) {
          const xx = x + d;
          if (xx >= 0 && xx < W) {
            const v = this.water[y * W + xx];
            if (v > mx) mx = v;
          }
        }
        t[y * W + x] = mx;
      }
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < W; x++) {
        let mx = 0;
        for (let d = -2; d <= 2; d++) {
          const yy = y + d;
          if (yy >= 0 && yy < m.h) {
            const v = t[yy * W + x];
            if (v > mx) mx = v;
          }
        }
        w[y * W + x] = mx;
      }
    for (const k of this.floors) {
      const v = m.humidity[k] + Math.min(150, w[k] * 3) - this.heat[k] + this.dewAt(k);
      this.moist[k] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }

  /** 夜露と雨の湿り気の地図（地上の時間で1分ごと、または地形が変わったときに作り直す） */
  private dewMap = new Uint8Array(0);
  private dewTiles: number[] = [];
  private dewTick = -1e9;
  private dewAt(k: number): number {
    // 地形が変わったとき（地形の変化の記録が増えたとき）だけ作り直す。読み込み直しても同じ地図になる
    if (this.dewMap.length !== this.map.w * this.map.h || this.dewTick !== this.digs.length) {
      if (this.dewMap.length !== this.map.w * this.map.h) this.dewMap = new Uint8Array(this.map.w * this.map.h);
      for (let q = 0; q < this.dewMap.length; q++) this.dewMap[q] = 0;
      this.dewTiles = [];
      for (let q = 0; q < this.dewMap.length; q++)
        if (!this.map.solid[q]) {
          this.dewMap[q] = this.dewAtSlow(q);
          if (this.dewMap[q] > 0) this.dewTiles.push(q);
        }
      this.dewTick = this.digs.length;
    }
    return this.dewMap[k];
  }

  /** 外とつながる口（正面の入口と、開いた地表の横穴）から入り込む夜露と雨の湿り気（口から6マスで消える） */
  private dewAtSlow(k: number): number {
    const m = this.map;
    const x = k % m.w;
    const y = Math.floor(k / m.w);
    let best = 0;
    const add = (ox: number, oy: number) => {
      const d = Math.abs(x - ox) + Math.abs(y - oy);
      if (d < 6) best = Math.max(best, (6 - d) * 22);
    };
    add(m.entrance.x, 1);
    add(m.entrance.x + 1, 1);
    for (const mo of m.mouths) {
      if (mo.kind !== 0) continue;
      const tx = mo.y === 0 ? mo.x : mo.x === 0 ? 1 : mo.x - 1;
      const ty = mo.y === 0 ? 1 : mo.y;
      if (!m.sealed[ty * m.w + tx]) add(tx, ty);
    }
    return best;
  }

  // ---------- 時間の刻み ----------

  /** 光る苔とキノコの光が計算し直された回数（描画側が送り直す合図） */
  glowVersion = 0;

  step(): void {
    this.tick++;
    this.stepInner();
    if (this.tick % 200 === 100) this.checkCollapse();
    if (this.tick % 100 === 50) this.nutrientStep();
    if (this.tick % 50 === 25) this.manaStep();
    // 光る苔とキノコの光は、決まった刻みごとに計算し直す（速度や画面の更新に左右されないように）
    if (this.tick % 200 === 0 && this.glowDirty) {
      this.computeGlow();
      this.glowVersion++;
    }
  }

  private stepInner(): void {
    if (this.tick % WATER_EVERY === 0) this.waterStep();
    if (this.tick % MOSS_EVERY === 0) this.mossStep();
    if (this.tick % CR_EVERY === 0) {
      const phase = (this.tick % DAY_TICKS) / DAY_TICKS;
      this.eco.update(this.tick, dayIntensity(this.tick), phase);
      this.eco.onDayEvents(this.prevPhase, phase);
      this.prevPhase = phase;
      if (this.eco.mossTouched) {
        this.eco.mossTouched = false;
        this.fieldsDirty = true;
        this.glowDirty = true;
      }
    }
  }

  private springRate(phase: number): number {
    const p = ((this.tick + phase) % SPRING_PERIOD) / SPRING_PERIOD;
    const tri = p < 0.5 ? p * 2 : 2 - p * 2;
    return Math.round(SPRING_BASE * (0.35 + 0.65 * tri));
  }

  private waterStep(): void {
    const m = this.map;
    const Wt = this.water;
    const Nu = this.nutr;
    const Hg = m.height;
    const dW = this.dW;
    const dN = this.dN;
    const fl = this.floors;
    const nb = this.nb;
    const step = (this.tick / WATER_EVERY) | 0;

    for (const s of m.springs) Wt[s.y * m.w + s.x] += this.springRate(s.phase);

    dW.fill(0);
    dN.fill(0);
    const outs = [0, 0, 0, 0];
    for (let i = 0; i < fl.length; i++) {
      const k = fl[i];
      const wk = Wt[k];
      // ごく薄い水は表面張力で留まる（細い流れと水たまりを保つ）
      if (wk < 4) continue;
      const sk = Hg[k] * HS + wk;
      let tot = 0;
      for (let d = 0; d < 4; d++) {
        const n = nb[i * 4 + d];
        outs[d] = 0;
        if (n < 0) continue;
        const diff = sk - (Hg[n] * HS + Wt[n]);
        if (diff > 1) {
          outs[d] = diff >> 2;
          tot += outs[d];
        }
      }
      if (tot === 0) continue;
      for (let d = 0; d < 4; d++) {
        let o = outs[d];
        if (o === 0) continue;
        if (tot > wk) o = Math.floor((o * wk) / tot);
        if (o <= 0) continue;
        const n = nb[i * 4 + d];
        dW[k] -= o;
        dW[n] += o;
        const nm = Math.floor((Nu[k] * o) / (wk * 4));
        if (nm > 0) {
          dN[k] -= nm;
          dN[n] += nm;
        }
      }
    }
    for (let i = 0; i < fl.length; i++) {
      const k = fl[i];
      Wt[k] += dW[k];
      Nu[k] += dN[k];
    }
    for (const s of m.sinks) {
      const k = s.y * m.w + s.x;
      const before = Wt[k];
      Wt[k] = Math.max(0, Wt[k] - SINK_RATE);
      // 吸い込まれる水に溶けた養分も一緒に外へ流れ出る
      if (before > 0) {
        const w = Math.floor((Nu[k] * (before - Wt[k])) / before);
        if (w > 0) {
          Nu[k] -= w;
          this.washed += w;
        }
      }
    }
    for (let i = 0; i < fl.length; i++) {
      const k = fl[i];
      if (Wt[k] <= 0) continue;
      if (m.lava[k]) {
        Wt[k] = 0;
        continue;
      }
      const loss = (Wt[k] < 8 || (ih(k, step) & 3) === 0 ? 1 : 0) + (this.heat[k] >> 5);
      Wt[k] = Math.max(0, Wt[k] - loss);
    }
    this.fieldsDirty = true;
  }

  /** 苔のマスへ、自分と隣の土から養分を取り込む。取り込めた量を返す */
  private take(i: number, k: number, want: number): number {
    let got = 0;
    const own = Math.min(want, this.nutr[k]);
    this.nutr[k] -= own;
    got += own;
    for (let d = 0; d < 4 && got < want; d++) {
      const n = this.nb[i * 4 + d];
      if (n < 0 || this.map.lava[n]) continue;
      const t = Math.min(1, this.nutr[n], want - got);
      this.nutr[n] -= t;
      got += t;
    }
    return got;
  }

  private mossStep(): void {
    const m = this.map;
    const mo = this.moss;
    const Nu = this.nutr;
    const fl = this.floors;
    const nb = this.nb;
    const step = (this.tick / MOSS_EVERY) | 0;
    const day = dayIntensity(this.tick);
    this.computeMoist();
    const moist = this.moist;
    let changed = false;

    // 外から風で運ばれた胞子：日の光の差す口のそば（光の地図が強く、湿り気が足りる所）に、ときどき苔が芽吹く
    if (day > 0.3) {
      this.dewAt(0);
      for (const k of this.dewTiles) {
        if (m.solid[k] || mo[k] || m.lava[k] || this.lightBase[k] * day < 250 || moist[k] < MOIST_GROW || Nu[k] < 2 || ih(k, step + 29) % 60 !== 0) continue;
        Nu[k] -= 2;
        mo[k] = 2;
        changed = true;
      }
    }
    for (let i = 0; i < fl.length; i++) {
      const k = fl[i];
      const v = mo[k];
      if (v === 0 || m.lava[k]) continue;
      const h = this.heat[k];
      // 乾き、または熱で枯れる
      if (moist[k] < MOIST_DRY || h > 100) {
        const dec = Math.min(v, 2 + (h >> 5));
        mo[k] = v - dec;
        Nu[k] += dec;
        changed = true;
        continue;
      }
      // 古い群落の一部が枯れて、養分が土へ戻る（入れ替わり）
      if (v > 200 && ih(k, step) % 50 === 0) {
        mo[k] = v - 20;
        Nu[k] += 20;
        changed = true;
        continue;
      }
      // 育つ：光の筋の下では速く、暗がりではゆっくり
      if (moist[k] >= MOIST_GROW && h < 60 && v < 255) {
        const L = this.lightBase[k] * day;
        const want = L > 50 ? 1 + Math.floor(L / 300) : (ih(k, step + 7) & 3) === 0 ? 1 : 0;
        const g = this.take(i, k, Math.min(want, 255 - v));
        if (g > 0) {
          mo[k] = v + g;
          changed = true;
        }
      }
      // 隣へじわじわ広がる
      if (mo[k] >= 100 && moist[k] >= MOIST_GROW && ih(k, step + 13) % 16 === 0) {
        const n = nb[i * 4 + (ih(k, step + 17) & 3)];
        if (n >= 0 && !m.lava[n] && mo[n] === 0 && moist[n] >= MOIST_GROW && Nu[n] >= 2) {
          Nu[n] -= 2;
          mo[n] = 2;
          changed = true;
        }
      }
      // 外から風で運ばれた胞子が、外の光の差す口のそばに芽吹く（苔のない所でも）
      // （この下の、苔のあるマスの処理とは別に、口のまわりだけを見る）
      // 水の流れに乗った胞子が下流に新しい群落を作る
      if (mo[k] >= 160 && ih(k, step + 23) % 400 === 0) {
        const n = this.downstream(k);
        if (n !== k && !m.lava[n] && mo[n] === 0 && moist[n] >= MOIST_GROW && Nu[n] >= 2) {
          Nu[n] -= 2;
          mo[n] = 2;
          changed = true;
        }
      }
    }
    if (this.fungusStep(step, day)) changed = true;
    let tm = 0;
    let tf = 0;
    for (let i = 0; i < fl.length; i++) {
      const k = fl[i];
      tm += mo[k];
      tf += this.fungus[k];
      if (mo[k] >= 200) this.eco.maybeSpawnWisp(k, step);
    }
    this.totalMoss = tm;
    this.totalFungus = tf;
    if (changed) {
      this.fieldsDirty = true;
      this.glowDirty = true;
    }
  }

  /** キノコ：光を嫌い、暗く湿った所で養分を吸って育つ */
  private fungusStep(step: number, day: number): boolean {
    const m = this.map;
    const fu = this.fungus;
    const Nu = this.nutr;
    const fl = this.floors;
    const nb = this.nb;
    const moist = this.moist;
    let changed = false;
    // 天井の裂け目から吹き込む風に乗った胞子が、まれに近くの暗がりに落ちる
    if (m.shafts.length && ih(step, 3) % 30 === 0) {
      const sh = m.shafts[ih(step, 4) % m.shafts.length];
      for (let i = 0; i < 12; i++) {
        const h = ih(step, 5 + i);
        const x = sh.x + ((h & 255) % 21) - 10;
        const y = sh.y + (((h >>> 8) & 255) % 21) - 10;
        if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
        const k = y * m.w + x;
        if (m.solid[k] || m.lava[k] || fu[k] || this.moss[k] || this.lightBase[k] > 100 || moist[k] < 70 || Nu[k] < 2) continue;
        Nu[k] -= 2;
        fu[k] = 2;
        changed = true;
        break;
      }
    }
    for (let i = 0; i < fl.length; i++) {
      const k = fl[i];
      const v = fu[k];
      if (v === 0) continue;
      const L = this.lightBase[k] * day + this.moss[k] * 2;
      if (m.lava[k] || L > 250 || this.heat[k] > 60) {
        const dec = Math.min(v, 2);
        fu[k] = v - dec;
        Nu[k] += dec;
        changed = true;
        continue;
      }
      if (moist[k] < 70) {
        if (ih(k, step + 31) % 3 === 0) {
          fu[k] = v - 1;
          Nu[k] += 1;
          changed = true;
        }
        continue;
      }
      if (v > 90 && ih(k, step + 33) % 15 === 0) {
        fu[k] = v - 20;
        Nu[k] += 20;
        changed = true;
        continue;
      }
      if (v < 130 && moist[k] >= 90 && (ih(k, step + 35) & 3) === 0) {
        const g = this.take(i, k, 1);
        if (g > 0) {
          fu[k] = v + g;
          changed = true;
        }
      }
      if (fu[k] >= 100 && this.totalFungus < 30000 && ih(k, step + 37) % 48 === 0) {
        const n = nb[i * 4 + (ih(k, step + 39) & 3)];
        if (n >= 0 && !m.lava[n] && fu[n] === 0 && moist[n] >= 90 && this.lightBase[n] * day < 150 && Nu[n] >= 30) {
          Nu[n] -= 2;
          fu[n] = 2;
          changed = true;
        }
      }
      // 豊かなキノコの群落からマイコニドが生まれる（数の上限は eco 側。キノコが多すぎても止めない）
      if (fu[k] >= 90) this.eco.maybeSpawnMyconid(k, step);
    }
    return changed;
  }

  /** 水の流れを下ってたどり着く先 */
  private downstream(k: number): number {
    const m = this.map;
    let cur = k;
    for (let s = 0; s < 24; s++) {
      const x = cur % m.w;
      const y = (cur / m.w) | 0;
      const sc = m.height[cur] * HS + this.water[cur];
      let best = -1;
      let bs = sc;
      const ns = [x + 1 < m.w ? cur + 1 : -1, x > 0 ? cur - 1 : -1, y + 1 < m.h ? cur + m.w : -1, y > 0 ? cur - m.w : -1];
      for (const n of ns) {
        if (n < 0 || m.solid[n] || this.water[n] <= 0) continue;
        const sn = m.height[n] * HS + this.water[n];
        if (sn < bs) {
          bs = sn;
          best = n;
        }
      }
      if (best < 0) break;
      cur = best;
    }
    return cur;
  }

  // ---------- 見た目と記録 ----------

  /** 今の時刻の光源（見た目用） */
  /** いまの昼の明るさ（0 夜〜1 昼） */
  dayNow(): number {
    return dayIntensity(this.tick);
  }

  lights(): Light[] {
    const d = dayIntensity(this.tick);
    const out: Light[] = d <= 0 ? [] : this.lightList.map((l) => ({ ...l, i: l.i * d }));
    // 冒険者の松明と光の呪文（壁に遮られる）
    for (const l of this.eco.lightSources()) out.push({ kind: 'torch', x: l.x, y: l.y, r: l.r, i: l.i, c: l.c, occ: true });
    // 正面の入口の両脇のかがり火（昼も夜も燃える）
    {
      const gx = this.map.entrance.x * TILE + 16;
      for (const dx of [-29, 28]) out.push({ kind: 'torch', x: gx + dx, y: 32, r: 96, i: 1.0, c: [1.0, 0.62, 0.3], occ: true });
    }
    // 外とつながる口の光：地表の横穴から差し込む日の光（夜は月明かり）、地底の裂け目の紫の光
    for (const mo of this.map.mouths) {
      // 地表の横穴の昼の光は lightList にある。夜は月明かりだけを足す
      if (mo.kind === 0 && d <= 0.2) out.push({ kind: 'entrance', x: (mo.y === 0 ? mo.x : mo.x === 0 ? 1 : mo.x - 1) * TILE + 8, y: (mo.y === 0 ? 1 : mo.y) * TILE + 8, r: 150, i: 0.25, c: [0.55, 0.65, 1.0], occ: true });
      else if (mo.kind === 1) out.push({ kind: 'torch', x: mo.x * TILE + 8, y: mo.y * TILE + 8, r: 90, i: 0.75, c: [0.75, 0.45, 1.0], occ: true });
    }
    return out;
  }

  /** 光の届いたマスを「見た」として記録する。変化があれば true */
  updateSeen(): boolean {
    const d = dayIntensity(this.tick);
    let changed = false;
    for (let k = 0; k < this.seen.length; k++) {
      if (this.seen[k]) continue;
      if (this.lightBase[k] * d > 60 || this.mossGlow[k] > 0.08 || this.lavaGlow[k] > 0.08 || this.fungusGlow[k] > 0.06) {
        this.seen[k] = 1;
        changed = true;
      }
    }
    const m = this.map;
    // 松明や光の呪文に照らされた所も記憶に残る
    for (const l of this.eco.lightSources()) {
      const tx = Math.floor(l.x / TILE);
      const ty = Math.floor(l.y / TILE);
      const R = Math.floor(l.r / TILE) - 1;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const x = tx + dx;
          const y = ty + dy;
          if (x < 0 || y < 0 || x >= m.w || y >= m.h || dx * dx + dy * dy > R * R) continue;
          const k = y * m.w + x;
          if (this.seen[k] || !lineOfSight(m, tx, ty, x, y)) continue;
          this.seen[k] = 1;
          changed = true;
        }
    }
    // 種の発見：光の中にいる（または自ら光を放つ）生き物の種は、名前と記録がわかる
    const srcs = this.eco.lightSources();
    for (const c of this.eco.list) {
      if (c.dead || c.away || this.eco.discovered[c.k]) continue;
      const k = Math.floor(c.y / TILE) * m.w + Math.floor(c.x / TILE);
      let lit = c.glow > 60 || c.k === 0 || c.k === 11 || c.k === 27 || this.lightBase[k] * d > 60 || this.mossGlow[k] > 0.1 || this.lavaGlow[k] > 0.1 || this.fungusGlow[k] > 0.08 || this.burn[k] > 0;
      if (!lit)
        for (const l of srcs)
          if ((l.x - c.x) ** 2 + (l.y - c.y) ** 2 < l.r * l.r * 0.5 && lineOfSight(m, l.x, l.y, c.x, c.y)) {
            lit = true;
            break;
          }
      if (lit) this.eco.discover(c.k, c.x, c.y);
    }
    // 光を帯びた生き物が通った所も記憶に残る（ダンジョンのつながりが少しずつ描かれる）
    for (const c of this.eco.list) {
      if (c.dead || c.away) continue;
      const g = c.k === 0 ? 70 + c.glow : c.glow;
      if (g < 20) continue;
      const R = g > 150 ? 2 : 1;
      const tx = Math.floor(c.x / TILE);
      const ty = Math.floor(c.y / TILE);
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const x = tx + dx;
          const y = ty + dy;
          if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
          if (dx * dx + dy * dy > R * R + 1) continue;
          const k = y * m.w + x;
          if (!this.seen[k]) {
            this.seen[k] = 1;
            changed = true;
          }
        }
    }
    if (changed) this.fieldsDirty = true;
    return changed;
  }

  /** 養分の総量（土＋苔）。保存則の確認用 */
  totalNutrients(): number {
    let s = 0;
    for (let k = 0; k < this.nutr.length; k++) s += this.nutr[k] + this.moss[k] + this.fungus[k];
    return s + this.eco.heldNutrients();
  }
}
