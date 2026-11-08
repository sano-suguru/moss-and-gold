import { fxCrescent2, fxSlashHit, fxGreatBlade, fxHolyCross, fxMissileHead, fxMissileDisc, fxMissileSpark, fxMissileBurst, fxPoisonCloud, fxPoisonPuff, fxPoisonBubble, fxDustCloud, fxDustPuff, fxSnort, fxMinoSweep, fxMinoImpact, fxStunStar, fxQuakeCrack, fxRockSpike, fxGolemSlam, fxRuneGlow, vampMist, livingArmor, heroSprite, heroBed, graveMarker, prayLight, skeleton, lich, item, dust, dwarf, forge, wallLamp, blood, campfire, outside, outsideTop, gate, fissure, mote, inlet, eggSac, clutch, ratPup, zMark, halfEye, dragonSleep, batSleep, wormCoil, speck, halo, hoardArt, mark, slash, fxArc, fxJag, fxArrow, fxOrb, fxBite, fxClaw, fxBurst, fxSplash, fxCrack, fxStain, fxSlash2, fxClaw2, fxBite2, fxRing, fxBlast, fxOrb2, fxArrow2, fxBit, dragonling, dragonlingSleep, eggShell, manaMote, dragonEgg, fireSpirit, phantomKnight, crownS, chiefHelm, tributeSack, goldSack, trophyArt, packArt, waterSpirit, lightSpirit, mushroomLord, ant, anthill, basilisk, bat, corpse, dragon, fireBreath, gargoyle, ghost, golem, mimic, treasure, wormHead, wormSeg, wormBody, wormMouth, wormMound, wyvern, goblin, goblinCamp, kobold, lizard, lizardman, minotaur, myconid, orc, rat, reedHut, salamander, slime, spider, troll, vampire, wisp, zlizard, zrat, supplyCache, coffin } from './sprites';

/** 種の並び（シミュレーションの Kind と同じ順） */
export const SPECIES = ['wisp', 'bat', 'rat', 'lizard', 'spider'] as const;
export const DIRS = ['down', 'up', 'side'] as const;
export const ACTS = ['idle', 'move', 'attack', 'death'] as const;
/** 名簿の冒険者のます目の大きさ（px）と、区画の行数 */
const HERO_CELL = 48;
const HERO_ROWS = 12;

export interface FrameInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

interface RawFrame {
  W: number;
  H: number;
  px: Uint8ClampedArray;
  mat: (string | null)[];
  ax: number;
  ay: number;
}

export interface Atlas {
  width: number;
  height: number;
  /** RGBA。アルファは 255 = 体、254 = 輪郭など、253 = それ自体が光る（ウィスプ）、252 = 光を帯びたときに光る模様、251 = ゴースト（暗闇でもかすかに見える） */
  data: Uint8Array;
  frames: FrameInfo[];
  /** 種・向き・動作・コマ（ウィスプは明るさの段階も）からコマ番号を引く */
  index: (species: number, dir: number, act: number, f: number, bright?: number) => number;
  web: number;
  /** 大きなクモの巣（半径32px）と、引き裂かれた巣 */
  webBig: number;
  webTorn: number;
  burrow: number;
  anthill: number;
  /** コボルトの住処：罠（鉄の歯の板）、入口の骨の飾り柱、奥の寝床（わら）、キノコの畑（0 芽、1 育った）、暗がりで光る目（コマ 0〜3、3 はまばたき） */
  trap: number;
  totem: number;
  nest: number;
  /** オークに従う集落の旗 */
  banner: number;
  /** 蓄えの山（kind 0 コボルト、1 ゴブリン。tier 0〜2） */
  larder: (kind: number, tier: number) => number;
  /** 物資の置き場：0 空の残骸、1 減った、2 たっぷり */
  supply: (tier: number) => number;
  coffin: (open: boolean) => number;
  furrow: (grown: number) => number;
  eyes: (f: number) => number;
  redEyes: (f: number) => number;
  /** 眷属になった冒険者の赤い目（side は横向きの片目） */
  heroRedEyes: (side: boolean, f: number) => number;
  /** 宝の山（大きさ 0..2、きらめきのコマ） */
  treasure: (size: number, f: number) => number;
  wormSeg: (kind: number) => number;
  /** ワームの胴の一節（太さ r 3〜12、v 0 膨らみ / 1 くびれ） */
  wormBody: (r: number, v: number) => number;
  /** ワームの頭（進む向き d 0〜7、口の開き open 0〜3） */
  wormMouth: (d: number, open: number) => number;
  /** 岩の下を進むワームが押し上げた岩（形 v 0〜2、big は頭の上、hard はマスの岩の硬さ 0 柔らかい・1 ふつう・2 硬い） */
  wormMound: (v: number, big: boolean, hard: number) => number;
  /** ドラゴンの炎の柱（down = 正面向き） */
  breath: (down: boolean, f: number) => number;
  /** 若い竜の小さな炎（横向き） */
  breathYoung: (f: number) => number;
  /** 床に落ちた道具（ItemKind の順） */
  item: (kind: number, f: number) => number;
  dust: (f: number) => number;
  /** ヴァンパイアの黒い霧（f は薄れていく段） */
  mist: (f: number) => number;
  forge: (f: number) => number;
  campfire: (f: number) => number;
  /** 眠り：Z / z / eye（半分だけ眠る片目）/ dragon / bat / worm（冒険者の眠る姿は heroBed） */
  sleep: (key: string, f: number) => number;
  /** 見た目の粒：0 塵、1 火の粉、2 胞子、3 しずく。f は消えていく段 */
  speck: (kind: number, f: number) => number;
  /** 生き物のまわりの淡い暈（0 小、1 中、2 大） */
  halo: (z: number) => number;
  /** 幼竜が生まれた場所に残る卵の殻 */
  eggShell: () => number;
  /** マナの粒（0 小〜3 大）と、竜の卵（0 静か、1 筋が光る、2 ひび、3 割れかけ）。マナから生まれる者の出現の演出 */
  manaMote: (size: number) => number;
  dragonEgg: (v: number) => number;
  /** 大ネズミの王の冠、ゴブリンの頭の角兜 */
  crown: () => number;
  chiefHelm: () => number;
  sack: () => number;
  /** 冒険者が担ぐ金貨の袋（0 小〜2 大）と戦利品（絵の種類：fang / club / horn / eye / staff / skull / helm / axe / spear / hide） */
  goldSack: (size: number) => number;
  trophy: (type: string) => number;
  /** 攻撃の演出の部品（'arc:大きさ:色:段'、'arrow:向き' など） */
  fx: (key: string) => number;
  /** 気づいた印（'!' か '?'） */
  mark: (k: string) => number;
  /** 当たった印（0〜2） */
  slash: (f: number) => number;
  /** 宝：tier 0〜4、owner は '' / vault / goblin / dwarf / dragon */
  hoard: (tier: number, owner: string, f: number) => number;
  /** 外とつながる口と卵：day / night（横穴の外）、fissure、mote、inlet、sac（クモの卵嚢）、clutch（トカゲの卵） */
  mouth: (key: string, f: number) => number;
  blood: (c: number, v: number) => number;
  lamp: (f: number) => number;
  camp: number;
  hut: number;
  /** 段階4以降の生き物（名前、向き、動作、コマ、段階）からコマ番号を引く */
  named: (name: string, dir: number, act: number, f: number, v?: number) => number;
  /**
   * 名簿の冒険者のコマ（姿と位ごと）。はじめて要るときに作って、絵の下の決まった区画（HERO_CELL 四方のます目）に描き、dirty に書き足す。
   * ます目が埋まったら、いちばん長く使っていないものを描き替える。描画が dirty を見てテクスチャを部分的に送り直す
   */
  hero: (job: number, torch: boolean, look: number, rank: number, dir: number, act: number, f: number) => number;
  /** 名簿の冒険者の寝具（身につける色の毛布） */
  heroBed: (job: number, look: number, rank: number, f: number) => number;
  /** 祈りの光（墓標の上に立ちのぼる聖印。f 0〜3 で薄れる） */
  pray: (f: number) => number;
  /** 墓標（rank 1〜3、身につける色） */
  grave: (rank: number, color: number) => number;
  /** 書き足して、まだテクスチャへ送っていないます目（x, y, w, h） */
  dirty: [number, number, number, number][];
  /** 死骸（種の番号と段階 0 新しい、1 腐りかけ、2 骨） */
  corpse: (species: number, stage: number) => number;
}

const GEN = [
  (d: string, a: string, f: number, b: number) => wisp(d, a, f, b ? 1 : 0.2),
  (d: string, a: string, f: number) => bat(d, a, f),
  (d: string, a: string, f: number) => rat(d, a, f),
  (d: string, a: string, f: number) => lizard(d, a, f),
  (d: string, a: string, f: number) => spider(d, a, f),
];

/**
 * クモの巣：中心から放射する縦糸と、それを結ぶ横糸の輪。R は外側の縦糸の長さ（px）。
 * torn は引き裂かれた巣（縦糸の半分ほどと横糸の多くが切れ、残りが下へ垂れる）
 */
function makeWeb(R = 16, torn = false): RawFrame {
  const W = Math.ceil(R * 2 + 3);
  const H = W;
  const px = new Uint8ClampedArray(W * H * 4);
  const mat: (string | null)[] = new Array(W * H).fill(null);
  const c = Math.floor(W / 2);
  const put = (x: number, y: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    px[p * 4] = 206;
    px[p * 4 + 1] = 212;
    px[p * 4 + 2] = 224;
    px[p * 4 + 3] = 255;
    mat[p] = 'ol';
  };
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
  };
  const N = R > 20 ? 12 : 9;
  // 切れた糸は、外ほど下へ垂れる
  const sag = (r: number) => (torn ? (r / R) * (r / R) * R * 0.35 : 0);
  const pts = (r: number) => [...Array(N)].map((_, i) => [c + Math.cos((i / N) * 6.283 + 0.2) * r * 1.0, c + Math.sin((i / N) * 6.283 + 0.2) * r * 0.85 + sag(r)]);
  const outer = pts(R);
  const cut = (i: number) => torn && (i * 7) % 5 < 2;
  outer.forEach(([x, y], i) => {
    if (cut(i)) line(c, c, c + (x - c) * 0.35, c + (y - c) * 0.35);
    else line(c, c, x, y);
  });
  const rings = R > 20 ? [0.18, 0.34, 0.5, 0.66, 0.82, 0.95] : [0.25, 0.47, 0.69, 0.9];
  rings.forEach((f, j) => {
    const p = pts(R * f);
    for (let i = 0; i < N; i++) {
      if (torn && (cut(i) || cut((i + 1) % N) || (i + j * 3) % 4 === 0)) continue;
      line(p[i][0], p[i][1], p[(i + 1) % N][0], p[(i + 1) % N][1]);
    }
  });
  return { W, H, px, mat, ax: c, ay: c };
}

function makeBurrow(): RawFrame {
  const W = 14;
  const H = 8;
  const px = new Uint8ClampedArray(W * H * 4);
  const mat: (string | null)[] = new Array(W * H).fill(null);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - 7) / 6.5;
      const ny = (y + 0.5 - 4.5) / 3.4;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const p = y * W + x;
      const rim = d > 0.55;
      const col = rim ? (ny < 0 ? [92, 78, 70] : [60, 50, 46]) : [12, 9, 12];
      px[p * 4] = col[0];
      px[p * 4 + 1] = col[1];
      px[p * 4 + 2] = col[2];
      px[p * 4 + 3] = 255;
      mat[p] = 'ol';
    }
  return { W, H, px, mat, ax: 7, ay: 6 };
}

/**
 * 文字の並びから小さな絵を作る（pal：文字 → [r,g,b, 光るなら1]）。ax, ay は足もと
 */
function pattern(rows: string[], pal: Record<string, number[]>, ax: number, ay: number): RawFrame {
  const H = rows.length;
  const W = rows[0].length;
  const px = new Uint8ClampedArray(W * H * 4);
  const mat: (string | null)[] = new Array(W * H).fill(null);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = pal[rows[y][x]];
      if (!c) continue;
      const p = y * W + x;
      px[p * 4] = c[0];
      px[p * 4 + 1] = c[1];
      px[p * 4 + 2] = c[2];
      px[p * 4 + 3] = 255;
      mat[p] = c[3] ? 'wisp' : 'ol';
    }
  return { W, H, px, mat, ax, ay };
}

// コボルトの罠：錆びた鉄の板に、光をはじく歯が並ぶ（暗い床でも歯のきらめきで見える）
const TRAP = pattern(
  ['.S...S...S...S.', 'sSs.sSs.sSs.sSs', 'kRRRRRRRRRRRRRk', 'kRrRrRrRrRrRrRk', 'kRRRRRRRRRRRRRk', '.kkkkkkkkkkkkk.', '..c....c....c..'],
  { S: [240, 236, 214, 1], s: [176, 172, 160], k: [26, 20, 22], R: [176, 96, 44], r: [112, 58, 30], c: [96, 96, 104] },
  7,
  5,
);
// 住処の入口の飾り柱：骨のしゃれこうべと赤い布を下げた木の杭
const TOTEM = pattern(
  ['..bbbbb..', '.bbbbbbb.', '.bEbbbEb.', '.bbbbbbb.', '..bkbkb..', '...bbb...', '..rrwrr..', '.rr.w.rr.', '.r..w..r.', '....w....', '...gwg...', '....w....', '....w....', '....w....', '....w....', '...www...', '..wwwww..'],
  { b: [228, 220, 198], E: [255, 120, 60, 1], k: [24, 18, 20], r: [184, 44, 38], w: [128, 86, 52], g: [104, 150, 86] },
  4,
  16,
);
// 奥の寝床：わらと毛皮を敷いた浅いくぼみ
const NEST = pattern(
  ['....yYyYyYyY....', '..yYfffffffYyY..', '.YyffFffFffFfyY.', 'yYyfffffffffyYyY', '.yYyYyYyYyYyYyY.', '...yyyyyyyyyy...'],
  { y: [214, 178, 92], Y: [246, 216, 128], f: [140, 102, 68], F: [182, 140, 96] },
  8,
  4,
);
// キノコの畑：耕した畝に、植えたキノコが並ぶ（0 芽、1 育った傘。傘のふちがほのかに光る）
const FURROW = [
  pattern(
    ['..............', '..p...p...p...', '..s...s...s...', 'LLLLLLLLLLLLLL', 'DDDDDDDDDDDDDD'],
    { p: [214, 196, 236], s: [200, 186, 160], L: [150, 112, 74], D: [52, 34, 24] },
    7,
    4,
  ),
  pattern(
    ['.cCc...cCc....', 'cCgCc.cCgCc.c.', '..s.....s..cCc', '..s.....s...s.', 'LLLLLLLLLLLLLL', 'DDDDDDDDDDDDDD'],
    { c: [190, 170, 210], C: [236, 222, 248], g: [230, 200, 255, 1], s: [214, 200, 172], L: [150, 112, 74], D: [52, 34, 24] },
    7,
    5,
  ),
];
// 蓄えの山（描画専用。蓄えの目安に対する割合で三段階）：コボルトはキノコの傘を積んだ山、ゴブリンは肉の塊と骨とキノコ。縁を暗くして床から浮かせる
const LARDER_COL: Record<string, number[]> = { c: [150, 120, 186], C: [222, 204, 244], s: [214, 198, 166], m: [150, 44, 38], M: [214, 92, 74], b: [236, 228, 204], k: [30, 22, 22], d: [60, 42, 32] };
function heap(W: number, H: number, kind: number): RawFrame {
  const inside = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H - 1) return false;
    const u = (x + 0.5 - W / 2) / (W / 2);
    const v = (H - 1.5 - y) / (H - 1);
    return u * u + v * v * 1.15 <= 1;
  };
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      if (y === H - 1) {
        r += x > 0 && x < W - 1 ? 'd' : '.';
        continue;
      }
      if (!inside(x, y)) {
        r += '.';
        continue;
      }
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1)) {
        r += 'k';
        continue;
      }
      const h = (x * 7 + y * 13 + ((x * y) % 5)) % 11;
      r += kind === 0 ? (h < 4 ? 'C' : h < 9 ? 'c' : 's') : h < 3 ? 'M' : h < 6 ? 'm' : h < 8 ? 'b' : h < 10 ? 'c' : 'C';
    }
    rows.push(r);
  }
  return pattern(rows, LARDER_COL, Math.floor(W / 2), H - 1);
}
const LARDER = [0, 1].map((kind) => [heap(10, 6, kind), heap(15, 8, kind), heap(21, 10, kind)]);
// オークに従う集落の印：竿に下げた赤い布と、白い牙の印（描画専用。集落の小屋の後ろから突き出す）
const BANNER = pattern(
  ['.w.......', 'wwwwwwww.', '.wRRRRRRk', '.wRbRRbRk', '.wRbRRbRk', '.wRRbbRRk', '.wRRRRRRk', '.wRR.RR.k', '.wR...R..', '.w.......', '.w.......', '.w.......', '.w.......', '.w.......', '.w.......', '.w.......', '.w.......', '.w.......', 'www......'],
  { w: [118, 82, 50], R: [176, 40, 34], b: [240, 232, 206], k: [70, 20, 18] },
  1,
  18,
);
// 暗がりで光る目（二つの点。3 コマ目はまばたき）
const EYES = [0, 1, 2, 3].map((f) =>
  pattern(f === 3 ? ['.....', '.k.k.', '.....'] : ['.....', '.E.E.', '.....'], { E: f === 1 ? [255, 236, 150, 1] : [255, 214, 110, 1], k: [70, 60, 40] }, 2, 1),
);
// ヴァンパイアの眷属の赤く光る目（3 コマ目はまばたき）
const RED_EYES = [0, 1, 2, 3].map((f) =>
  pattern(f === 3 ? ['.....', '.k.k.', '.....'] : ['.....', '.E.E.', '.....'], { E: f === 1 ? [255, 90, 80, 1] : [235, 50, 44, 1], k: [70, 20, 20] }, 2, 1),
);
/** 眷属になった冒険者の赤い目：手描きの体の目の位置に重ねる（正面は足もとの中心から左へ2・右へ1、横向きは前へ2。src/sprites.ts の heroSprite） */
const HERO_RED_EYES = [0, 1, 2, 3].map((f) =>
  pattern(f === 3 ? ['......', '.k..k.', '......'] : ['......', '.E..E.', '......'], { E: f === 1 ? [255, 90, 80, 1] : [235, 50, 44, 1], k: [70, 20, 20] }, 3, 1),
);
const HERO_RED_EYE_SIDE = [0, 1, 2, 3].map((f) => pattern(f === 3 ? ['...', '.k.', '...'] : ['...', '.E.', '...'], { E: f === 1 ? [255, 90, 80, 1] : [235, 50, 44, 1], k: [70, 20, 20] }, 1, 1));

export function buildAtlas(): Atlas {
  const raws: RawFrame[] = [];
  // 骨の竜のための塗り替え（赤みの強い色を、明るさに応じて骨の段へ）
  const bone = [[52, 48, 44], [104, 98, 86], [156, 150, 134], [204, 198, 180], [236, 232, 214]];
  const recolor = (fr: RawFrame): RawFrame => {
      const px = new Uint8ClampedArray(fr.px);
      for (let i = 0; i < px.length; i += 4) {
        if (!px[i + 3]) continue;
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        if (r > g + 12 && r > b + 6) {
          const lum = (r + g + b) / 3;
          const c = bone[Math.min(4, Math.floor(lum / 34))];
          px[i] = c[0];
          px[i + 1] = c[1];
          px[i + 2] = c[2];
        }
      }
      return { ...fr, px };
    };

  const keyIndex = new Map<string, number>();
  for (let s = 0; s < SPECIES.length; s++)
    for (let d = 0; d < DIRS.length; d++)
      for (let a = 0; a < ACTS.length; a++)
        for (let f = 0; f < 4; f++)
          for (let b = 0; b < (s === 0 ? 2 : 1); b++) {
            keyIndex.set(`${s},${d},${a},${f},${b}`, raws.length);
            raws.push(GEN[s](DIRS[d], ACTS[a], f, b) as RawFrame);
          }
  const named = new Map<string, number>();
  const NAMED: [string, number, (d: string, a: string, f: number, v: number) => RawFrame][] = [
    ['zrat', 1, (d, a, f) => zrat(d, a, f) as RawFrame],
    ['zlizard', 1, (d, a, f) => zlizard(d, a, f) as RawFrame],
    ['slime', 3, (d, a, f, v) => slime(d, a, f, [0.55, 0.78, 1][v]) as RawFrame],
    ['ghost', 1, (d, a, f) => ghost(d, a, f) as RawFrame],
    ['myconid', 1, (d, a, f) => myconid(d, a, f) as RawFrame],
    ['ant', 2, (d, a, f, v) => ant(d, a, f, v === 1) as RawFrame],
    ['kobold', 1, (d, a, f) => kobold(d, a, f) as RawFrame],
    ['salamander', 1, (d, a, f) => salamander(d, a, f) as RawFrame],
    ['goblin', 3, (d, a, f, v) => goblin(d, a, f, v) as RawFrame],
    ['orc', 2, (d, a, f, v) => orc(d, a, f, v) as RawFrame],
    ['lizardman', 1, (d, a, f) => lizardman(d, a, f) as RawFrame],
    ['minotaur', 1, (d, a, f) => minotaur(d, a, f) as RawFrame],
    ['troll', 1, (d, a, f) => troll(d, a, f) as RawFrame],
    ['basilisk', 1, (d, a, f) => basilisk(d, a, f) as RawFrame],
    ['gargoyle', 1, (d, a, f) => gargoyle(d, a, f) as RawFrame],
    ['vampire', 1, (d, a, f) => vampire(d, a, f) as RawFrame],
    ['golem', 1, (d, a, f) => golem(d, a, f) as RawFrame],
    ['mimic', 1, (d, a, f) => mimic(d, a, f) as RawFrame],
    ['worm', 1, (d, a, f) => wormHead(d, a, f) as RawFrame],
    ['wyvern', 1, (d, a, f) => wyvern(d, a, f) as RawFrame],
    // 冒険者：v = 職業×2 + 松明を持つか
    // スケルトン：v = 0 素手、1 戦士、2 盗賊、3 僧侶、4 狩人、5 吟遊詩人、6 竜殺しの装備
    ['skel', 7, (d, a, f, v) => skeleton(['none', 'warrior', 'thief', 'priest', 'hunter', 'bard', 'slayer'][v], d, a, f) as RawFrame],
    ['lich', 1, (d, a, f) => lich(d, a, f) as RawFrame],
    // リビングアーマー：宙に浮く胸当てと冑（武具は描画のときに重ねる。src/creatureView.ts）
    ['armor', 1, (d, a, f) => livingArmor(d, a, f) as RawFrame],
    ['pup', 1, (d, a, f) => ratPup(d, a, f) as RawFrame],
    // ドワーフ：v = 0 坑夫、1 鍛冶屋、2 戦士
    ['dwarf', 3, (d, a, f, v) => dwarf(['miner', 'smith', 'warrior'][v], d, a, f) as RawFrame],
  ];
  for (const [name, nv, gen] of NAMED)
    for (let d = 0; d < DIRS.length; d++)
      for (let a = 0; a < ACTS.length; a++)
        for (let f = 0; f < 4; f++)
          for (let v = 0; v < nv; v++) {
            named.set(`${name},${d},${a},${f},${v}`, raws.length);
            raws.push(gen(DIRS[d], ACTS[a], f, v));
          }
  // ドラゴン：眠り（向きなし）、やられ（向きなし）、歩く・炎を吐く・飛ぶ（向きあり）。v=1 は飛ぶ姿
  for (let f = 0; f < 4; f++) {
    const idle = raws.length;
    raws.push(dragon('side', 'idle', f) as RawFrame);
    const death = raws.length;
    raws.push(dragon('side', 'death', f) as RawFrame);
    for (let d = 0; d < DIRS.length; d++) {
      named.set(`dragon,${d},0,${f},0`, idle);
      named.set(`dragon,${d},0,${f},1`, idle);
      named.set(`dragon,${d},3,${f},0`, death);
      named.set(`dragon,${d},3,${f},1`, death);
    }
  }
  for (let d = 0; d < DIRS.length; d++)
    for (let f = 0; f < 4; f++) {
      for (const [a, act] of [[1, 'move'], [2, 'attack']] as [number, string][]) {
        named.set(`dragon,${d},${a},${f},0`, raws.length);
        raws.push(dragon(DIRS[d], act, f) as RawFrame);
      }
      named.set(`dragon,${d},1,${f},1`, raws.length);
      named.set(`dragon,${d},2,${f},1`, raws.length);
      raws.push(dragon(DIRS[d], 'fly', f) as RawFrame);
    }
  // 幼竜と若い竜：成竜の絵を、ドット絵らしさを保つ縮め方で縮める（縮めたあとの1ピクセルごとに、もとの絵で一番多い色を選ぶ。縁取りの暗い色は残しやすく）
  const shrink = (fr: RawFrame, sc: number): RawFrame => {
    const W = Math.max(1, Math.round(fr.W * sc));
    const H = Math.max(1, Math.round(fr.H * sc));
    const px = new Uint8ClampedArray(W * H * 4);
    const mat: (string | null)[] = new Array(W * H).fill(null);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const x0 = Math.floor(x / sc);
        const x1 = Math.max(x0 + 1, Math.floor((x + 1) / sc));
        const y0 = Math.floor(y / sc);
        const y1 = Math.max(y0 + 1, Math.floor((y + 1) / sc));
        const votes = new Map<number, number>();
        const matOf = new Map<number, string | null>();
        let opaque = 0;
        let total = 0;
        for (let yy = y0; yy < Math.min(fr.H, y1); yy++)
          for (let xx = x0; xx < Math.min(fr.W, x1); xx++) {
            total++;
            const p = (yy * fr.W + xx) * 4;
            if (!fr.px[p + 3]) continue;
            opaque++;
            const key = (fr.px[p] << 16) | (fr.px[p + 1] << 8) | fr.px[p + 2];
            const lum = fr.px[p] + fr.px[p + 1] + fr.px[p + 2];
            votes.set(key, (votes.get(key) ?? 0) + (lum < 120 ? 1.4 : 1));
            if (!matOf.has(key)) matOf.set(key, fr.mat[yy * fr.W + xx]);
          }
        if (opaque * 2 < total) continue;
        let best = 0;
        let bv = -1;
        for (const [k, v] of votes) if (v > bv) {
          bv = v;
          best = k;
        }
        const q = (y * W + x) * 4;
        px[q] = best >> 16;
        px[q + 1] = (best >> 8) & 255;
        px[q + 2] = best & 255;
        px[q + 3] = 255;
        mat[y * W + x] = matOf.get(best) ?? null;
      }
    return { W, H, px, mat, ax: Math.round(fr.ax * sc), ay: Math.round(fr.ay * sc) } as RawFrame;
  };
  // 骨の竜：成竜の絵の鱗の色を、骨の色に塗り替える（赤みの強い色を明るさに応じて骨の段へ。光る目は青白く）
  {
    const cache = new Map<number, number>();
    for (const [key, idx] of [...named]) {
      if (!key.startsWith('dragon,')) continue;
      if (!cache.has(idx)) {
        cache.set(idx, raws.length);
        raws.push(recolor(raws[idx]));
      }
      named.set(key.replace('dragon,', 'dragonB,'), cache.get(idx) as number);
    }
  }
  // 幼竜と若い竜：描き起こした姿（どの向きも横向きの絵を使う。左向きは描くときに反転）
  for (const [nm, stg] of [['dragonH', 0], ['dragonY', 1]] as [string, number][])
    for (let f = 0; f < 4; f++) {
      const fr: Record<string, number> = {};
      for (const act of ['idle', 'move', 'attack', 'death', 'fly']) {
        fr[act] = raws.length;
        raws.push(dragonling(stg, act, f) as RawFrame);
      }
      for (let d = 0; d < DIRS.length; d++) {
        named.set(`${nm},${d},0,${f},0`, fr.idle);
        named.set(`${nm},${d},0,${f},1`, fr.idle);
        named.set(`${nm},${d},1,${f},0`, fr.move);
        named.set(`${nm},${d},1,${f},1`, stg === 1 ? fr.fly : fr.move);
        named.set(`${nm},${d},2,${f},0`, fr.attack);
        named.set(`${nm},${d},2,${f},1`, stg === 1 ? fr.fly : fr.attack);
        named.set(`${nm},${d},3,${f},0`, fr.death);
        named.set(`${nm},${d},3,${f},1`, fr.death);
      }
    }
  const eggShellFrame = raws.length;
  raws.push(eggShell(0) as RawFrame);
  const manaMoteFrames: number[] = [];
  const dragonEggFrames: number[] = [];
  for (let i = 0; i < 4; i++) {
    manaMoteFrames.push(raws.length);
    raws.push(manaMote(i) as RawFrame);
    dragonEggFrames.push(raws.length);
    raws.push(dragonEgg(i) as RawFrame);
  }
  // 特別な個体：火の精と亡霊の騎士（どの向きも同じ絵。左向きは反転）、冠と角兜
  for (const [nm, gen] of [['firespirit', fireSpirit], ['pknight', phantomKnight], ['wspirit', waterSpirit], ['lspirit', (_a: string, f: number) => lightSpirit(f)], ['mlord', mushroomLord]] as [string, (a: string, f: number) => unknown][])
    for (let f = 0; f < 4; f++) {
      const idle = raws.length;
      raws.push(gen('idle', f) as RawFrame);
      const atk = raws.length;
      raws.push(gen('attack', f) as RawFrame);
      for (let d = 0; d < DIRS.length; d++)
        for (let a = 0; a < 4; a++)
          for (let v = 0; v < 2; v++) named.set(`${nm},${d},${a},${f},${v}`, a === 2 ? atk : idle);
    }
  const crownFrame = raws.length;
  raws.push(crownS() as RawFrame);
  const helmFrame = raws.length;
  raws.push(chiefHelm() as RawFrame);
  const sackFrame = raws.length;
  raws.push(tributeSack() as RawFrame);
  const goldSackFrames: number[] = [];
  for (let z = 0; z < 3; z++) {
    goldSackFrames.push(raws.length);
    raws.push(goldSack(z) as RawFrame);
  }
  const trophyFrames = new Map<string, number>();
  for (const ty of ['fang', 'club', 'horn', 'eye', 'staff', 'skull', 'helm', 'axe', 'spear', 'hide']) {
    trophyFrames.set(ty, raws.length);
    raws.push(trophyArt(ty) as RawFrame);
  }
  const packFrame = raws.length;
  raws.push(packArt() as RawFrame);
  // ドラゴンの炎の柱（横向きと正面）
  const breathFrames: number[] = [];
  for (let f = 0; f < 4; f++) {
    breathFrames.push(raws.length);
    raws.push(fireBreath('side', f, 38, true) as RawFrame);
  }
  for (let f = 0; f < 4; f++) {
    breathFrames.push(raws.length);
    raws.push(fireBreath('down', f, 42, true) as RawFrame);
  }
  // 若い竜の炎：口が低いので、短く落として床に届かせる
  const breathYoungFrames: number[] = [];
  for (let f = 0; f < 4; f++) {
    breathYoungFrames.push(raws.length);
    raws.push(fireBreath('side', f, 20, true) as RawFrame);
  }
  // 床に落ちた道具
  const itemFrames: number[] = [];
  for (const kd of ['torch', 'stub', 'sword', 'shield', 'staff', 'mace', 'dagger', 'symbol', 'lute', 'bow', 'greatsword'])
    for (let f = 0; f < 4; f++) {
      itemFrames.push(raws.length);
      raws.push(item(kd, f) as RawFrame);
    }
  const bloodFrames: number[] = [];
  for (let c = 0; c < 4; c++)
    for (let v = 0; v < 4; v++) {
      bloodFrames.push(raws.length);
      raws.push(blood(c, v) as RawFrame);
    }
  const mouthFrames: Record<string, number[]> = { gateDay: [], gateNight: [], day: [], night: [], dayTop: [], nightTop: [], fissure: [], mote: [], inlet: [], sac: [], clutch: [] };
  for (let f = 0; f < 4; f++) {
    const push = (key: string, fr: RawFrame) => {
      mouthFrames[key].push(raws.length);
      raws.push(fr);
    };
    push('day', outside(0, f) as RawFrame);
    push('night', outside(1, f) as RawFrame);
    push('dayTop', outsideTop(0, f) as RawFrame);
    push('gateDay', gate(0, f) as RawFrame);
    push('gateNight', gate(1, f) as RawFrame);
    push('nightTop', outsideTop(1, f) as RawFrame);
    push('fissure', fissure(f) as RawFrame);
    push('mote', mote(f) as RawFrame);
    push('inlet', inlet(f) as RawFrame);
    push('sac', eggSac(f) as RawFrame);
    push('clutch', clutch(f) as RawFrame);
  }
  // 宝（五段階×持ち主×きらめき2コマ）
  const hoardFrames: Record<string, number> = {};
  for (const o of ['', 'vault', 'goblin', 'dwarf', 'dragon'])
    for (let t = 0; t < 5; t++)
      for (let f = 0; f < 2; f++) {
        hoardFrames[`${o}:${t}:${f}`] = raws.length;
        raws.push(hoardArt(t, o, f) as RawFrame);
      }
  // 攻撃の演出の部品（名前と引数から、コマの番号へ）
  const fxFrames = new Map<string, number>();
  const addFx = (key: string, fr: RawFrame) => {
    fxFrames.set(key, raws.length);
    raws.push(fr);
  };
  for (let col = 0; col < 8; col++)
    for (let f = 0; f < 3; f++) {
      for (let size = 0; size < 3; size++) addFx(`arc:${size}:${col}:${f}`, fxArc(size, col, f) as RawFrame);
      addFx(`jag:${col}:${f}`, fxJag(col, f) as RawFrame);
      addFx(`bite:0:${col}:${f}`, fxBite(0, col, f) as RawFrame);
      addFx(`bite:1:${col}:${f}`, fxBite(1, col, f) as RawFrame);
      addFx(`claw:${col}:${f}`, fxClaw(col, f) as RawFrame);
      addFx(`burst:${col}:${f}`, fxBurst(col, f) as RawFrame);
      addFx(`splash:${col}:${f}`, fxSplash(col, f) as RawFrame);
    }
  for (let col = 0; col < 8; col++) for (let f = 0; f < 2; f++) addFx(`orb:${col}:${f}`, fxOrb(col, f) as RawFrame);
  for (let d = 0; d < 8; d++) addFx(`arrow:${d}`, fxArrow(d) as RawFrame);
  // 作り込み版（6コマ）
  for (let f = 0; f < 6; f++) {
    for (let col = 0; col < 8; col++) {
      for (let size = 0; size < 3; size++) addFx(`slash2:${size}:${col}:${f}`, fxSlash2(size, col, f) as RawFrame);
      addFx(`claw2:${col}:${f}`, fxClaw2(col, f) as RawFrame);
      for (let size = 0; size < 3; size++) addFx(`ring:${size}:${col}:${f}`, fxRing(size, col, f) as RawFrame);
      for (let size = 0; size < 3; size++) if (col >= 2 && col !== 5 && col !== 6) addFx(`blast:${size}:${col}:${f}`, fxBlast(size, col, f) as RawFrame);
    }
    addFx(`blast:2:0:${f}`, fxBlast(2, 0, f) as RawFrame);
    addFx(`blast:1:0:${f}`, fxBlast(1, 0, f) as RawFrame);
    for (let size = 0; size < 2; size++) addFx(`bite2:${size}:${f}`, fxBite2(size, f) as RawFrame);
  }
  for (let col = 0; col < 8; col++) for (let f = 0; f < 4; f++) addFx(`orb2:${col}:${f}`, fxOrb2(col, f) as RawFrame);
  for (let d = 0; d < 8; d++) addFx(`arrow2:${d}`, fxArrow2(d) as RawFrame);
  // 戦士の飛ぶ斬撃（高品質版。16方向×8コマ）と、当たった瞬間の火花
  for (let d = 0; d < 16; d++) for (let f = 0; f < 8; f++) addFx(`crescent2:${d}:${f}`, fxCrescent2(d, f) as RawFrame);
  for (let f = 0; f < 4; f++) addFx(`slashhit:${f}`, fxSlashHit(f) as RawFrame);
  // 竜殺しの光の大剣の部品（16方向×3部品×4コマ）、僧侶の十字架（8コマ）、マジックミサイル（弾4コマ、尾の丸6段、こぼれる粒4コマ、弾け6コマ）、毒の煙（8コマ）・小さな煙・泡
  for (let d = 0; d < 16; d++) for (let part = 0; part < 3; part++) for (let f = 0; f < 4; f++) addFx(`gblade:${d}:${part}:${f}`, fxGreatBlade(d, part, f) as RawFrame);
  for (let f = 0; f < 8; f++) addFx(`holycross:${f}`, fxHolyCross(f) as RawFrame);
  for (let f = 0; f < 4; f++) addFx(`mmhead:${f}`, fxMissileHead(f) as RawFrame);
  for (let k = 0; k < 6; k++) addFx(`mmdisc:${k}`, fxMissileDisc(k) as RawFrame);
  for (let f = 0; f < 4; f++) addFx(`mmspark:${f}`, fxMissileSpark(f) as RawFrame);
  for (let f = 0; f < 6; f++) addFx(`mmburst:${f}`, fxMissileBurst(f) as RawFrame);
  for (let f = 0; f < 8; f++) addFx(`pcloud:${f}`, fxPoisonCloud(f) as RawFrame);
  for (let f = 0; f < 4; f++) addFx(`ppuff:${f}`, fxPoisonPuff(f) as RawFrame);
  for (let f = 0; f < 4; f++) addFx(`pbubble:${f}`, fxPoisonBubble(f) as RawFrame);
  // ミノタウロス：斧の薙ぎ払いの軌跡（16方向×6コマ）、突進の土ぼこり（8コマ）・小さな土ぼこり・鼻息、当たった所の衝撃（3種×6コマ）。怯みの星
  for (let d = 0; d < 16; d++) for (let f = 0; f < 6; f++) addFx(`msweep:${d}:${f}`, fxMinoSweep(d, f) as RawFrame);
  for (let f = 0; f < 8; f++) addFx(`dcloud:${f}`, fxDustCloud(f) as RawFrame);
  for (let f = 0; f < 4; f++) addFx(`dpuff:${f}`, fxDustPuff(f) as RawFrame);
  for (let f = 0; f < 4; f++) addFx(`snort:${f}`, fxSnort(f) as RawFrame);
  for (let k = 0; k < 3; k++) for (let f = 0; f < 6; f++) addFx(`mimpact:${k}:${f}`, fxMinoImpact(k, f) as RawFrame);
  for (let f = 0; f < 4; f++) addFx(`stunstar:${f}`, fxStunStar(f) as RawFrame);
  // ゴーレム：地割れの筋（16方向×4コマ）、岩の棘（6コマ）、振り下ろしの衝撃（6コマ）、符文（4種）
  for (let d = 0; d < 16; d++) for (let f = 0; f < 4; f++) addFx(`qcrack:${d}:${f}`, fxQuakeCrack(d, f) as RawFrame);
  for (let f = 0; f < 6; f++) addFx(`rspike:${f}`, fxRockSpike(f) as RawFrame);
  for (let f = 0; f < 6; f++) addFx(`gslam:${f}`, fxGolemSlam(f) as RawFrame);
  for (let f = 0; f < 4; f++) addFx(`rune:${f}`, fxRuneGlow(f) as RawFrame);
  for (let kind = 0; kind < 5; kind++) for (let col = 0; col < 8; col++) for (let f = 0; f < 4; f++) addFx(`bit:${kind}:${col}:${f}`, fxBit(kind, col, f) as RawFrame);
  for (let v = 0; v < 3; v++) addFx(`crack:${v}`, fxCrack(v) as RawFrame);
  // クモの糸の繭（クモの巣にかかった獲物を巻いたもの）：0 大、1 中、2 小（食べられて細っていく）
  {
    const silk = { W: [236, 232, 220], w: [170, 164, 154], o: [70, 66, 62] };
    const cocoons = [
      ['..ooo..', '.oWWWo.', 'oWwWwWo', 'oWWwWWo', 'oWwWwWo', 'oWWwWWo', 'oWwWwWo', '.oWWWo.', '..ooo..'],
      ['.ooo.', 'oWWWo', 'owWwo', 'oWWWo', 'owWwo', 'oWWWo', '.ooo.'],
      ['.o.', 'oWo', 'owo', 'oWo', '.o.'],
    ];
    cocoons.forEach((rows, v) => addFx(`cocoon:${v}`, pattern(rows, silk, rows[0].length >> 1, rows.length - 1)));
  }
  for (let k = 0; k < 3; k++) for (let v = 0; v < 3; v++) addFx(`stain:${k}:${v}`, fxStain(k, v) as RawFrame);
  // 気づいた印と、当たった印
  const markFrames: Record<string, number> = {};
  for (const k of ['!', '?']) {
    markFrames[k] = raws.length;
    raws.push(mark(k) as RawFrame);
  }
  const slashFrames: number[] = [];
  for (let f = 0; f < 3; f++) {
    slashFrames.push(raws.length);
    raws.push(slash(f) as RawFrame);
  }
  // 生き物のまわりの淡い暈
  const haloFrames: number[] = [];
  for (let z = 0; z < 3; z++) {
    haloFrames.push(raws.length);
    raws.push(halo(z) as RawFrame);
  }
  // 見た目の粒
  const speckFrames: number[] = [];
  for (let k = 0; k < 4; k++)
    for (let f = 0; f < 4; f++) {
      speckFrames.push(raws.length);
      raws.push(speck(k, f) as RawFrame);
    }
  // 眠り
  const sleepFrames: Record<string, number[]> = {};
  const addS = (key: string, fr: RawFrame) => {
    (sleepFrames[key] ??= []).push(raws.length);
    raws.push(fr);
  };
  for (let f = 0; f < 4; f++) {
    addS('Z', zMark(true, f) as RawFrame);
    addS('z', zMark(false, f) as RawFrame);
    addS('eye', halfEye(f) as RawFrame);
    addS('dragon', dragonSleep(f) as RawFrame);
    addS('dragonB', recolor(dragonSleep(f) as RawFrame));
    addS('dragonH', dragonlingSleep(0, f) as RawFrame);
    addS('dragonY', dragonlingSleep(1, f) as RawFrame);
    addS('bat', batSleep(f) as RawFrame);
    addS('worm', wormCoil(f) as RawFrame);
  }
  const fireFrames: number[] = [];
  for (let f = 0; f < 4; f++) {
    fireFrames.push(raws.length);
    raws.push(campfire(f) as RawFrame);
  }
  const forgeFrames: number[] = [];
  const lampFrames: number[] = [];
  for (let f = 0; f < 4; f++) {
    forgeFrames.push(raws.length);
    raws.push(forge(f) as RawFrame);
    lampFrames.push(raws.length);
    raws.push(wallLamp(f) as RawFrame);
  }
  const dustFrames: number[] = [];
  for (let f = 0; f < 4; f++) {
    dustFrames.push(raws.length);
    raws.push(dust(f) as RawFrame);
  }
  const mistFrames: number[] = [];
  for (let f = 0; f < 4; f++) {
    mistFrames.push(raws.length);
    raws.push(vampMist(f) as RawFrame);
  }
  const corpses = new Map<string, number>();
  const CSP: [number, string][] = [[1, 'bat'], [2, 'rat'], [3, 'lizard'], [4, 'spider'], [9, 'ant'], [10, 'kobold'], [11, 'salamander'], [12, 'goblin'], [13, 'orc'], [14, 'lizardman'], [15, 'minotaur'], [16, 'troll'], [17, 'basilisk'], [18, 'gargoyle'], [19, 'vampire'], [20, 'mimic'], [21, 'golem'], [23, 'wyvern'], [24, 'dragon'], [25, 'adventurer'], [26, 'skeleton'], [27, 'lich'], [28, 'dwarf']];
  for (const [si, name] of CSP)
    for (let st = 0; st < 3; st++) {
      corpses.set(`${si},${st}`, raws.length);
      raws.push(corpse(name, st) as RawFrame);
    }
  const anthillFrame = raws.length;
  raws.push(anthill() as RawFrame);
  const campFrame = raws.length;
  raws.push(goblinCamp() as RawFrame);
  const hutFrame = raws.length;
  raws.push(reedHut() as RawFrame);
  const coffinFrames = [raws.length, raws.length + 1];
  raws.push(coffin(false) as RawFrame, coffin(true) as RawFrame);
  const cacheFrames: number[] = [];
  for (let tier = 0; tier < 3; tier++) {
    cacheFrames.push(raws.length);
    raws.push(supplyCache(tier) as RawFrame);
  }
  const treasureFrames: number[] = [];
  for (let sz = 0; sz < 3; sz++) for (let f = 0; f < 4; f++) {
    treasureFrames.push(raws.length);
    raws.push(treasure(sz, f) as RawFrame);
  }
  const segFrames = [raws.length, raws.length + 1];
  raws.push(wormSeg(0, 0) as RawFrame, wormSeg(1, 0) as RawFrame);
  const bodyFrames: number[] = [];
  for (let r = 3; r <= 12; r++) for (let v = 0; v < 2; v++) {
    bodyFrames.push(raws.length);
    raws.push(wormBody(r, v) as RawFrame);
  }
  const wormMouthFrames: number[] = [];
  for (let d = 0; d < 8; d++) for (let o = 0; o < 4; o++) {
    wormMouthFrames.push(raws.length);
    raws.push(wormMouth(d, o) as RawFrame);
  }
  const moundFrames: number[] = [];
  for (let h = 0; h < 3; h++) for (let b = 0; b < 2; b++) for (let v = 0; v < 3; v++) {
    moundFrames.push(raws.length);
    raws.push(wormMound(v, b === 1, h) as RawFrame);
  }
  const web = raws.length;
  raws.push(makeWeb());
  const webBig = raws.length;
  raws.push(makeWeb(32));
  const webTorn = raws.length;
  raws.push(makeWeb(32, true));
  const burrow = raws.length;
  raws.push(makeBurrow());
  const trapFrame = raws.length;
  raws.push(TRAP);
  const totemFrame = raws.length;
  raws.push(TOTEM);
  const nestFrame = raws.length;
  raws.push(NEST);
  const furrowFrames = FURROW.map((f) => {
    raws.push(f);
    return raws.length - 1;
  });
  const bannerFrame = raws.length;
  raws.push(BANNER);
  const larderFrames = LARDER.map((set) =>
    set.map((f) => {
      raws.push(f);
      return raws.length - 1;
    }),
  );
  const eyeFrames = EYES.map((e) => {
    raws.push(e);
    return raws.length - 1;
  });
  const redEyeFrames = RED_EYES.map((e) => {
    raws.push(e);
    return raws.length - 1;
  });
  const heroRedEyeFrames = [...HERO_RED_EYES, ...HERO_RED_EYE_SIDE].map((e) => {
    raws.push(e);
    return raws.length - 1;
  });

  const prayFrames: number[] = [];
  for (let f = 0; f < 4; f++) {
    prayFrames.push(raws.length);
    raws.push(prayLight(f) as RawFrame);
  }
  const graveFrames: number[] = [];
  for (let r = 1; r <= 3; r++)
    for (let c = 0; c < 6; c++) {
      graveFrames.push(raws.length);
      raws.push(graveMarker(r, c) as RawFrame);
    }
  // 棚詰め
  // 高さの順に棚へ詰める（コマの番号はそのまま）
  const width = 2048;
  let x = 0;
  let y = 0;
  let rowH = 0;
  const frames: FrameInfo[] = new Array(raws.length);
  const order = raws.map((_, i) => i).sort((a, b) => raws[b].H - raws[a].H || a - b);
  for (const i of order) {
    const r = raws[i];
    if (x + r.W + 1 > width) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    frames[i] = { x, y, w: r.W, h: r.H, ax: r.ax, ay: r.ay };
    x += r.W + 1;
    rowH = Math.max(rowH, r.H);
  }
  // 名簿の冒険者のます目の区画（絵の下）
  const heroY0 = y + rowH + 1;
  const height = heroY0 + HERO_ROWS * HERO_CELL;
  const data = new Uint8Array(width * height * 4);
  raws.forEach((r, i) => {
    const fr = frames[i];
    for (let yy = 0; yy < r.H; yy++)
      for (let xx = 0; xx < r.W; xx++) {
        const p = yy * r.W + xx;
        if (!r.px[p * 4 + 3]) continue;
        const q = ((fr.y + yy) * width + fr.x + xx) * 4;
        data[q] = r.px[p * 4];
        data[q + 1] = r.px[p * 4 + 1];
        data[q + 2] = r.px[p * 4 + 2];
        const m = r.mat[p];
        data[q + 3] = m === 'wisp' ? 253 : m === 'glw' ? 252 : m === 'ghost' ? 251 : m === 'glint' ? 250 : m && m !== 'ol' ? 255 : 254;
      }
  });
  // 名簿の冒険者のコマ：ます目に作って描く（いちばん長く使っていないます目から描き替える）
  const dirty: [number, number, number, number][] = [];
  const cols = Math.floor(width / HERO_CELL);
  const nCells = cols * HERO_ROWS;
  const cellKey: string[] = new Array(nCells).fill('');
  const cellUsed = new Float64Array(nCells);
  const cellFrame = new Int32Array(nCells).fill(-1);
  const heroKeys = new Map<string, number>();
  let useT = 0;
  const JOBS = ['warrior', 'wizard', 'thief', 'priest', 'bard', 'hunter', 'slayer'];
  const heroFrame = (job: number, torch: boolean, look: number, rank: number, d: number, a: number, f: number): number => {
    const key = `${job},${torch ? 1 : 0},${look},${rank},${d},${a},${f & 3}`;
    useT++;
    const hit = heroKeys.get(key);
    if (hit !== undefined) {
      cellUsed[hit] = useT;
      return cellFrame[hit];
    }
    let cell = 0;
    for (let i = 1; i < nCells; i++) if (cellUsed[i] < cellUsed[cell]) cell = i;
    if (cellKey[cell]) heroKeys.delete(cellKey[cell]);
    const r = (a === 4 ? heroBed(JOBS[job] ?? 'warrior', look, rank, f & 3) : heroSprite(JOBS[job] ?? 'warrior', DIRS[d], ACTS[a], f & 3, torch, look, rank)) as RawFrame;
    const x0 = (cell % cols) * HERO_CELL;
    const y0 = heroY0 + Math.floor(cell / cols) * HERO_CELL;
    const W = Math.min(r.W, HERO_CELL);
    const H = Math.min(r.H, HERO_CELL);
    for (let yy = 0; yy < HERO_CELL; yy++)
      for (let xx = 0; xx < HERO_CELL; xx++) {
        const q = ((y0 + yy) * width + x0 + xx) * 4;
        if (xx >= W || yy >= H) {
          data[q + 3] = 0;
          continue;
        }
        const p = yy * r.W + xx;
        if (!r.px[p * 4 + 3]) {
          data[q + 3] = 0;
          continue;
        }
        data[q] = r.px[p * 4];
        data[q + 1] = r.px[p * 4 + 1];
        data[q + 2] = r.px[p * 4 + 2];
        const m = r.mat[p];
        data[q + 3] = m === 'wisp' ? 253 : m === 'glw' ? 252 : m === 'ghost' ? 251 : m === 'glint' ? 250 : m && m !== 'ol' ? 255 : 254;
      }
    const info = { x: x0, y: y0, w: W, h: H, ax: r.ax, ay: r.ay };
    if (cellFrame[cell] < 0) {
      cellFrame[cell] = frames.length;
      frames.push(info);
    } else frames[cellFrame[cell]] = info;
    cellKey[cell] = key;
    cellUsed[cell] = useT;
    heroKeys.set(key, cell);
    dirty.push([x0, y0, HERO_CELL, HERO_CELL]);
    return cellFrame[cell];
  };
  return {
    width,
    height,
    data,
    frames,
    web,
    webBig,
    webTorn,
    burrow,
    index: (s, d, a, f, b = 0) => keyIndex.get(`${s},${d},${a},${f & 3},${s === 0 ? b : 0}`) ?? 0,
    anthill: anthillFrame,
    trap: trapFrame,
    totem: totemFrame,
    nest: nestFrame,
    banner: bannerFrame,
    larder: (kind, tier) => larderFrames[kind][Math.max(0, Math.min(2, tier))],
    supply: (tier) => cacheFrames[Math.max(0, Math.min(2, tier))],
    coffin: (open) => coffinFrames[open ? 1 : 0],
    furrow: (g) => furrowFrames[g ? 1 : 0],
    eyes: (f) => eyeFrames[f & 3],
    redEyes: (f) => redEyeFrames[f & 3],
    heroRedEyes: (side, f) => heroRedEyeFrames[(side ? 4 : 0) + (f & 3)],
    treasure: (size, f) => treasureFrames[size * 4 + (f & 3)],
    wormSeg: (kind) => segFrames[kind],
    wormBody: (r, v) => bodyFrames[(Math.max(3, Math.min(12, Math.round(r))) - 3) * 2 + (v & 1)],
    wormMouth: (d, open) => wormMouthFrames[(d & 7) * 4 + Math.max(0, Math.min(3, open))],
    wormMound: (v, big, hard) => moundFrames[Math.max(0, Math.min(2, hard)) * 6 + (big ? 3 : 0) + (((v % 3) + 3) % 3)],
    breath: (down, f) => breathFrames[(down ? 4 : 0) + (f & 3)],
    breathYoung: (f) => breathYoungFrames[f & 3],
    item: (kind, f) => (kind === 11 ? packFrame : itemFrames[kind * 4 + (f & 3)] ?? itemFrames[0]),
    dust: (f) => dustFrames[f & 3],
    mist: (f) => mistFrames[f & 3],
    forge: (f) => forgeFrames[f & 3],
    campfire: (f) => fireFrames[f & 3],
    sleep: (key, f) => sleepFrames[key][f & 3],
    hoard: (tier, owner, f) => hoardFrames[`${owner}:${Math.min(4, Math.max(0, tier))}:${f & 1}`],
    fx: (key) => fxFrames.get(key) ?? 0,
    eggShell: () => eggShellFrame,
    manaMote: (z) => manaMoteFrames[Math.min(3, Math.max(0, z))],
    dragonEgg: (v) => dragonEggFrames[Math.min(3, Math.max(0, v))],
    crown: () => crownFrame,
    chiefHelm: () => helmFrame,
    sack: () => sackFrame,
    goldSack: (z) => goldSackFrames[Math.max(0, Math.min(2, z))],
    trophy: (ty) => trophyFrames.get(ty) ?? trophyFrames.get('fang')!,
    mark: (k) => markFrames[k] ?? markFrames['!'],
    slash: (f) => slashFrames[Math.min(2, Math.max(0, f))],
    halo: (z) => haloFrames[Math.min(2, Math.max(0, z))],
    speck: (kind, f) => speckFrames[(kind & 3) * 4 + Math.min(3, Math.max(0, f))],
    mouth: (key, f) => mouthFrames[key][f & 3],
    blood: (c, v) => bloodFrames[(c & 3) * 4 + (v & 3)],
    lamp: (f) => lampFrames[f & 3],
    camp: campFrame,
    hut: hutFrame,
    named: (name, d, a, f, v = 0) => named.get(`${name},${d},${a},${f & 3},${v}`) ?? 0,
    hero: (job, torch, look, rank, d, a, f) => heroFrame(job, torch, look, rank, d, a, f),
    heroBed: (job, look, rank, f) => heroFrame(job, false, look, rank, 0, 4, f),
    pray: (f) => prayFrames[Math.max(0, Math.min(3, f))],
    grave: (rank, color) => graveFrames[Math.max(0, Math.min(2, rank - 1)) * 6 + Math.max(0, Math.min(5, color))],
    dirty,
    corpse: (sp, st) => corpses.get(`${sp},${st}`) ?? 0,
  };
}
