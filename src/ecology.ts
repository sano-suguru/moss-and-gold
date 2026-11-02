import { lineOfSight, TILE } from './mapgen';
import { JOB_NAMES } from './names';
/** 地上の一日の刻み（world と同じ） */
const DAY_TICKS_ECO = 14400;
import type { World } from './world';

/** 生き物を動かす間隔（刻み） */
export const CR_EVERY = 2;

export const enum Kind {
  Wisp = 0,
  Bat = 1,
  Rat = 2,
  Lizard = 3,
  Spider = 4,
  Slime = 5,
  Zombie = 6,
  Ghost = 7,
  Myconid = 8,
  Ant = 9,
  Kobold = 10,
  Salamander = 11,
  Goblin = 12,
  Orc = 13,
  Lizardman = 14,
  Minotaur = 15,
  Troll = 16,
  Basilisk = 17,
  Gargoyle = 18,
  Vampire = 19,
  Mimic = 20,
  Golem = 21,
  Worm = 22,
  Wyvern = 23,
  Dragon = 24,
  Adventurer = 25,
  Skeleton = 26,
  Lich = 27,
  Dwarf = 28,
}

/** ドワーフの住みか */
export interface Hold {
  /** 0 住む場所へ向かう、1 広間を掘る、2 坑道を掘る、3 宝を運ぶ、4 次の宝を探す */
  stage: number;
  /** 広間の入口（開いた床）と、掘る向き */
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  /** 広間の中心（タイル） */
  hk: number;
  /** 掘る予定の広間のマス */
  todo: number[];
  /** 目指す宝の山と、坑道の先、長さ */
  target: number;
  head: number;
  len: number;
  /** 鍛冶場（タイル、なければ -1） */
  forge: number;
  /** ゴーレムに敗れたのを見た（宝物庫を避ける） */
  golem: number;
  since: number;
  /** 背負ってきた食料の蓄え、キノコの畑のマス */
  store: number;
  farm: number[];
  /** 坑道の道筋（タイル）と、それを決めた宝の山。試し掘りの枝坑道で掘る予定のマス */
  plan?: number[];
  planFor?: number;
  drift?: number[];
}

/** 冒険者の職業 */
export const enum Job {
  Warrior = 0,
  Wizard = 1,
  Thief = 2,
  Priest = 3,
  Bard = 4,
  Hunter = 5,
  Slayer = 6,
}

/** 冒険者の一行 */
export interface Party {
  id: number;
  members: number[];
  /** 0 = 奥へ進む、1 = 引き返す */
  goal: number;
  tx: number;
  ty: number;
  since: number;
  tier: number;
  initial: number;
  /** 見たもの：1 金貨、2 アンデッド、4 大物、8 竜 */
  saw: number;
  targetAt: number;
  /** 先頭が仲間を待っている刻み */
  waitT: number;
  /** 見かけた大物（種と場所） */
  bk: number;
  bx: number;
  by: number;
  /** 探した範囲（8×8マスの区画の番号）、知っている宝の区画、宝がなかった区画、危ない区画 [区画, 強さ] */
  explored?: number[];
  goldCells?: number[];
  goneGold?: number[];
  danger?: number[][];
  /** 一行で向かっている手強い敵 */
  engage?: number;
  /** 入ってきた口（-1 正面の入口、それ以外は mouths の番号）と、見つけた別の横穴 */
  door?: number;
  mouths?: number[];
  /** 疲れ、焚き火（タイル、なければ -1）、休み終わる刻み、最後に休んだ刻み */
  fatigue?: number;
  camp?: number;
  campUntil?: number;
  lastCamp?: number;
}

/** 外の世界の地図：生還者が持ち帰った、探した範囲、宝のあった区画、危ない区画 [区画, 強さ, 刻み] */
export interface Lore {
  explored: number[];
  gold: number[];
  danger: number[][];
  /** 生還者が見つけた、地表へ通じる別の横穴（mouths の番号） */
  mouths?: number[];
}
/** 地図の区画の大きさ（マス） */
export const CELL = 8;

/** 床に落ちた道具 */
export const enum ItemKind {
  Torch = 0,
  Stub = 1,
  Sword = 2,
  Shield = 3,
  Staff = 4,
  Mace = 5,
  Dagger = 6,
  Symbol = 7,
  Lute = 8,
  Bow = 9,
  Greatsword = 10,
}
export interface Item {
  id: number;
  x: number;
  y: number;
  kind: number;
  fuel: number;
}

/** 外の世界の噂（日ごとに薄れる） */
export interface Rumors {
  light: number;
  gold: number;
  undead: number;
  beast: number;
  dragon: number;
  /** 噂になった大物の種と、見かけた場所（狩人が狙う） */
  beastKind: number;
  beastX: number;
  beastY: number;
}

/** 金貨と宝石の山（量は整数で保存される） */
export interface Pile {
  id: number;
  x: number;
  y: number;
  gold: number;
  age: number;
}

/** 石像：石になった瞬間の姿のまま残り、通り道をふさぐ。体の養分を閉じ込めたまま、ゆっくり風化する */
export interface Statue {
  id: number;
  x: number;
  y: number;
  /** 石になった生き物の種、元の種、向き、動作、コマ */
  k: number;
  sp: number;
  dir: number;
  act: number;
  f: number;
  units: number;
  age: number;
  /** 通り道をふさぐか（石になった時の地形で決めて、覚えておく） */
  blocks?: number;
}

/** ゴブリンの集落、リザードマンの村 */
export interface Camp {
  id: number;
  /** 0 ゴブリン、1 リザードマン */
  kind: number;
  x: number;
  y: number;
  /** リザードマン：水が涸れている時間 */
  dry: number;
  /** かがり火の燃料（枯れたキノコの軸）。0 なら火は消えている */
  fuel?: number;
  /** ゴブリンの集落（住みつける仕組み）：蓄え（養分の帳簿に入る）、1 なら暗がりに散って潜んでいる、近ごろ襲われた回数、蓄えが尽きた刻み、1匹になった刻み */
  store?: number;
  hide?: number;
  raids?: number;
  empty?: number;
  alone?: number;
  /** 従っているオークの縄張り（寝床の座標。0,0 なら従っていない）と、次に貢ぎ物を取り立てに来る刻み */
  lx?: number;
  ly?: number;
  tribT?: number;
}

/** 種ごとの強さ（戦いの勝ち負けの確率に使う） */
const STR = [0, 1, 1, 5, 3, 2, 3, 0, 2, 1, 3, 4, 3, 10, 6, 20, 15, 8, 4, 12, 8, 30, 40, 25, 60, 5, 3, 18, 6];
/** ドワーフの強さ（坑夫、鍛冶屋、戦士） */
const DWARF_STR = [5, 6, 10];
/**
 * 賢さの段階：0 本能だけ（傷ついても逃げない）、1 動物（体力が半分を切ると逃げる）、
 * 2 狡猾（不利なら退く。強い相手には仲間がいなければ挑まない）、3 知性（戦う前に見積もり、勝てない相手は避ける）
 */
export const TIER = [1, 1, 1, 1, 1, 0, 0, 0, 2, 1, 2, 1, 2, 2, 2, 2, 2, 1, 0, 3, 0, 0, 0, 1, 3, 3, 0, 3, 3];
const FLEE_AT = [0, 0.5, 0.35, 0.4];
/** 血の色：0 赤、1 暗い赤（爬虫類・竜）、2 緑（虫）、3 石のかけら、-1 なし */
const BLOOD = [-1, 0, 0, 1, 2, -1, -1, -1, -1, 2, 0, 1, 0, 0, 1, 0, 0, 1, 3, 0, -1, 3, 0, 1, 1, 0, -1, -1, 0];
/** 冒険者の強さ（職業）と、一行の格（駆け出し・手練れ・精鋭） */
const JOB_STR = [8, 5, 4, 5, 3, 6, 20];
const TIER_MUL = [0.7, 1.1, 1.6];
/** 運べる金貨の量（盗賊は身軽で多く運べる） */
export const GOLD_CAP = [30, 20, 60, 25, 20, 25, 40];
/** 松明一本の燃える長さ（刻み） */
const TORCH_FUEL = 9000;

/** アリの巣（女王は巣の中にいて見えない） */
export interface Colony {
  id: number;
  x: number;
  y: number;
  /** 蓄えた食べ物 */
  store: number;
  /** 女王の体 */
  queen: number;
  starve: number;
  /** 巣を広げて掘っている通路の先と長さ */
  hk?: number;
  len?: number;
}

/** コボルトの住処と、いま掘っている岩 */
export interface Warren {
  id: number;
  x: number;
  y: number;
  target: number;
  prog: number;
  len: number;
  /** 掘り進められないまま経った時間（届かない岩はあきらめる） */
  stall?: number;
  lastProg?: number;
  /** 住処の入口のマス。岩壁に掘り込む横穴の向き（0 右、1 左、2 下、3 上、-1 なし）と、掘った深さ。x, y は横穴の奥（住処の中心） */
  door?: number;
  dir?: number;
  tun?: number;
  /** 蓄え（養分。持ち主のいない食べ物として帳簿に数える） */
  store?: number;
  /** 1 なら群れは奥に隠れている */
  hide?: number;
  /** 近ごろ襲われた回数（少しずつ薄れる） */
  raids?: number;
  /** 蓄えが尽きた刻み（尽きていなければ -1） */
  empty?: number;
  /** 1匹になった刻み（2匹以上なら -1） */
  alone?: number;
}

/** コボルトの罠（住処の入口のまわり。最初に踏んだ冒険者が傷を負い、罠は消える） */
export interface Trap {
  id: number;
  /** マス */
  k: number;
  /** 仕掛けた住処 */
  w: number;
}

interface Spec {
  /** 体をつくる養分 */
  body: number;
  /** 胃に入る量 */
  cap: number;
  /** 何歩ごとに1単位を糞として土に返すか */
  meta: number;
  /** 何歩飢えると死ぬか */
  starve: number;
  speed: number;
  glowDecay: number;
}
const SPEC: Spec[] = [
  { body: 4, cap: 8, meta: 14, starve: 400, speed: 0.6, glowDecay: 2 },
  { body: 10, cap: 40, meta: 14, starve: 3000, speed: 1.7, glowDecay: 1 },
  { body: 16, cap: 40, meta: 12, starve: 900, speed: 1.0, glowDecay: 1 },
  { body: 60, cap: 120, meta: 60, starve: 4000, speed: 0.7, glowDecay: 1 },
  { body: 30, cap: 80, meta: 40, starve: 4000, speed: 0.6, glowDecay: 1 },
  { body: 12, cap: 60, meta: 5, starve: 1e9, speed: 0.35, glowDecay: 1 },
  { body: 0, cap: 0, meta: 1e9, starve: 1e9, speed: 0.4, glowDecay: 1 },
  { body: 0, cap: 0, meta: 1e9, starve: 1e9, speed: 0.5, glowDecay: 1 },
  { body: 20, cap: 0, meta: 1e9, starve: 1e9, speed: 0.4, glowDecay: 1 },
  { body: 4, cap: 12, meta: 40, starve: 3000, speed: 1.1, glowDecay: 1 },
  { body: 20, cap: 60, meta: 45, starve: 3000, speed: 0.8, glowDecay: 1 },
  { body: 12, cap: 30, meta: 60, starve: 1e9, speed: 0.7, glowDecay: 1 },
  // ゴブリン：腹の減り方は五巡目から7割に（meta 40 → 57）
  { body: 20, cap: 50, meta: 57, starve: 3000, speed: 0.9, glowDecay: 1 },
  { body: 60, cap: 120, meta: 45, starve: 5000, speed: 0.9, glowDecay: 1 },
  { body: 40, cap: 80, meta: 60, starve: 6000, speed: 0.85, glowDecay: 1 },
  { body: 120, cap: 200, meta: 50, starve: 6000, speed: 0.8, glowDecay: 1 },
  { body: 150, cap: 250, meta: 40, starve: 6000, speed: 0.85, glowDecay: 1 },
  { body: 60, cap: 100, meta: 50, starve: 5000, speed: 0.5, glowDecay: 1 },
  { body: 20, cap: 40, meta: 200, starve: 20000, speed: 1.6, glowDecay: 1 },
  { body: 50, cap: 100, meta: 50, starve: 6000, speed: 0.9, glowDecay: 1 },
  { body: 10, cap: 60, meta: 120, starve: 40000, speed: 0.4, glowDecay: 1 },
  { body: 0, cap: 0, meta: 1e9, starve: 1e9, speed: 0.6, glowDecay: 1 },
  { body: 300, cap: 300, meta: 400, starve: 1e9, speed: 2, glowDecay: 1 },
  { body: 80, cap: 120, meta: 60, starve: 1e9, speed: 1.8, glowDecay: 1 },
  { body: 400, cap: 300, meta: 300, starve: 1e9, speed: 0.9, glowDecay: 1 },
  { body: 60, cap: 150, meta: 60, starve: 2500, speed: 1.0, glowDecay: 1 },
  { body: 30, cap: 0, meta: 1e9, starve: 1e9, speed: 0.7, glowDecay: 1 },
  { body: 60, cap: 0, meta: 1e9, starve: 1e9, speed: 0.5, glowDecay: 1 },
  { body: 50, cap: 80, meta: 90, starve: 30000, speed: 0.8, glowDecay: 1 },
];

export interface Cr {
  id: number;
  k: Kind;
  x: number;
  y: number;
  /** 前の歩の位置（描画の補間用） */
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** 0 下, 1 上, 2 右, 3 左 */
  dir: number;
  /** 0 待機, 1 移動, 2 攻撃・食べる, 3 やられ */
  act: number;
  actT: number;
  body: number;
  food: number;
  glow: number;
  hungry: number;
  sinceMeal: number;
  st: number;
  hx: number;
  hy: number;
  tx: number;
  ty: number;
  /** 0 生きている, 1 死骸, 2 消えた */
  dead: number;
  /** 死骸に残る養分 */
  units: number;
  away: boolean;
  caught: boolean;
  /** 狙っている獲物、かかっている巣などの番号 */
  ref: number;
  /** 元の種（ゾンビや死骸が何の体だったか） */
  sp: number;
  /** 二つめの参照（アリが運ぼうとしている物など） */
  ref2: number;
  /** 抱えている金貨（ミミックなど） */
  gold: number;
  /** 冒険者：一行の番号と、松明の残り */
  party: number;
  torch: number;
  /** 体力（0 で倒れる）、最後に傷を受けた刻み、最後に襲ってきた相手、逃げている残り */
  hp: number;
  hitAt: number;
  foe: number;
  flee: number;
  /** 歩き方の状態（本能だけの種が壁に引っかかったときの向き直り、ミノタウロスの突進後のよろめき） */
  gait: number;
  /** 生まれた刻み（中で生まれた子は、しばらく小さな姿） */
  bornAt: number;
  /** 眠り：0 起きている、1 浅い眠り、2 深い眠り、3 半分だけ眠る。眠気（起きている間にたまり、眠ると減る） */
  sleep: number;
  drowsy: number;
  /** 光に寄る：狙っている冒険者と、潜みはじめた刻み */
  lure: number;
  lureAt: number;
  /** 食べている死骸（倒した獲物を数秒かけて食べる） */
  feed: number;
  /** 体に溜めたマナ（ウィスプは土から吸い、食べた者へ受け渡され、死ぬとその場の土に還る） */
  mana: number;
  /** 特別な個体：0 ふつう、1 火の精（サラマンダー）、2 亡霊の騎士（ゴースト）、4 大ネズミの王、5 ゴブリンの頭、6 水の精（スライム）、7 光の精（ウィスプ）、8 骨の竜（ドラゴン）、9 キノコの主（マイコニド） */
  elite: number;
  /** 死骸ができたときの養分（腐り具合の目安） */
  init: number;
}

export interface Web {
  id: number;
  x: number;
  y: number;
  r: number;
  owner: number;
  age: number;
}
export interface Burrow {
  x: number;
  y: number;
  /** 最後に引っ越しを試みた刻み */
  moved?: number;
  /** まわり（10マス）の食べられる苔で養える数（土地勘と同じ時機に数え直す。保存する） */
  cap?: number;
  /** 掘り進めている巣穴の先と長さ */
  hk?: number;
  len?: number;
}

/** 狩りの獲物の種（毎刻み配列を作らないように） */
const HUNT0: Kind[] = [Kind.Rat, Kind.Ant];
const HUNT1: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Goblin, Kind.Kobold, Kind.Ant, Kind.Adventurer, Kind.Dwarf];
/** オークの獲物：ゴブリンは従える相手なので獲物にしない */
const HUNT_ORC: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Kobold, Kind.Ant, Kind.Adventurer, Kind.Dwarf];
const HUNT2: Kind[] = [Kind.Rat, Kind.Ant, Kind.Kobold];
const HUNT3: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Goblin, Kind.Kobold, Kind.Ant, Kind.Orc, Kind.Lizardman, Kind.Spider, Kind.Slime, Kind.Zombie, Kind.Adventurer];
const HUNT4: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Goblin, Kind.Kobold, Kind.Ant, Kind.Lizardman, Kind.Orc, Kind.Slime, Kind.Zombie, Kind.Myconid, Kind.Adventurer];
const HUNT5: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Ant, Kind.Kobold, Kind.Goblin];
const HUNT6: Kind[] = [Kind.Rat];
/** 上下左右（毎刻み配列を作らないように） */
const NB4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** 16方向の単位ベクトル（三角関数を使わずに作る） */
const DIR16: [number, number][] = [
  [16, 0], [15, 6], [11, 11], [6, 15], [0, 16], [-6, 15], [-11, 11], [-15, 6],
  [-16, 0], [-15, -6], [-11, -11], [-6, -15], [0, -16], [6, -15], [11, -11], [15, -6],
].map(([a, b]) => {
  const l = Math.sqrt(a * a + b * b);
  return [a / l, b / l] as [number, number];
});

const sq = (a: number) => a * a;

function ih(a: number, b: number, c = 0): number {
  let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

const MAX_WISPS = 1400;

export class Ecology {
  list: Cr[] = [];
  webs: Web[] = [];
  burrows: Burrow[] = [];
  nextId = 1;
  /** 外から持ち込まれた養分の合計 */
  imported = 0;
  /** 外へ持ち出された養分の合計 */
  exported = 0;
  step = 0;
  counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  /** ドワーフの住みか（一つまで）、坑道のランプ、外に伝わった話（1 = ゴーレムの宝物庫は危ない） */
  hold: Hold | null = null;
  lamps: number[] = [];
  dwarfLore = 0;
  lastDwarves = -1;
  /**
   * 分析用の記録（シミュレーションの道具が読んで空にする。ゲームでは古いものから捨てる）。
   * deaths：死んだ生き物（死因と、手を下した種）。births：現れた生き物（来た口か、生まれたか）。exits：外へ出ていった生き物
   */
  stats: {
    deaths: { t: number; k: number; cause: string; by: number; x: number; y: number }[];
    births: { t: number; k: number; origin: string; x: number; y: number }[];
    exits: { t: number; k: number; reason: string; x: number; y: number }[];
    /** 群れの引っ越し（大ネズミの巣穴など）：刻み、種、何匹、元の場所と移った先（画素） */
    moves: { t: number; k: number; n: number; x: number; y: number; tx: number; ty: number }[];
    /**
     * 住みつく群れの出来事（いまはコボルトの住処）：ev は found 作った（how：arrive 来て / move 移って / split 分かれて）、
     * abandon 捨てた（reason：food 蓄えが尽きた / raids 何度も襲われた / alone 1匹になった / dragon 竜を恐れた、to：leave 去った / move 移った）、
     * empty 誰もいなくなって消えた
     */
    settle: { t: number; k: number; id: number; ev: string; how?: string; reason?: string; to?: string; n?: number; x: number; y: number }[];
  } = { deaths: [], births: [], exits: [], moves: [], settle: [] };
  /** 次に生まれる生き物の由来（spawn の直前に設定し、spawn が読んで戻す） */
  private originNext = '';
  private record(kind: 'deaths' | 'births' | 'exits' | 'moves' | 'settle', e: never): void {
    const a = this.stats[kind] as unknown[];
    a.push(e);
    if (a.length > 5000) a.splice(0, a.length - 4000);
  }
  /** 卵（クモの卵嚢、トカゲの卵）：産んだ刻みと、孵る子の数、子の体になる養分 */
  eggs: { id: number; k: number; x: number; y: number; t: number; n: number; units: number }[] = [];
  /** 入口で食べ残しを落とす一行（入ってきた次の刻みに落とす） */
  private pendingScraps: number[] = [];
  parties: Party[] = [];
  lore: Lore = { explored: [], gold: [], danger: [] };
  /** 記録：目立つ出来事（刻み、場所、一文。種の名前は {k:番号} で書き、表示のときに照らされたかどうかで置き換える） */
  events: { t: number; x: number; y: number; m: string }[] = [];
  /** 一度でも光に照らされた種 */
  discovered = new Uint8Array(32);
  gear: Item[] = [];
  rumors: Rumors = { light: 0, gold: 0, undead: 0, beast: 0, dragon: 0, beastKind: 0, beastX: 0, beastY: 0 };
  /** 外との金貨の出入り */
  goldIn = 0;
  goldOut = 0;
  /** 帰った一行の数、倒れた冒険者の数 */
  returned = 0;
  fallen = 0;
  /** 燃えているマスの一覧 */
  burning: number[] = [];
  piles: Pile[] = [];
  /** ワームの体がたどる跡（頭の過去の位置） */
  trails = new Map<number, number[]>();
  statues: Statue[] = [];
  private statueAt = new Map<number, number>();
  camps: Camp[] = [];
  /** 種ごとに、最後に群れが来た刻み（立て続けに来ないように） */
  lastArrival: number[] = [];
  colonies: Colony[] = [];
  warrens: Warren[] = [];
  traps: Trap[] = [];
  /** 地図の横のマス数（描画用） */
  get mapW(): number {
    return this.w.map.w;
  }
  /** この刻みまでコボルトは来ない（住処が襲われて捨てられたという外の噂） */
  koboldShun = 0;
  /** この刻みまでゴブリンは来ない（集落が襲われて捨てられたという外の噂） */
  goblinShun = 0;
  /** 同時にダンジョンの中にいる冒険者の一行の数の上限（切り替えられる。既定 1。段階13までは 2） */
  static ADV_MAX_PARTIES = 1;
  /** 弱い生き物の害（pester）をなす種 */
  static PESTERS = new Set<number>([Kind.Rat, Kind.Bat, Kind.Ant, Kind.Wisp, Kind.Myconid, Kind.Salamander]);
  /** 苔を食べたなどで苔の場が変わった */
  mossTouched = false;
  private lastPhase = 0;
  private byId = new Map<number, Cr>();
  private head: Int32Array;
  private next: Int32Array = new Int32Array(0);
  private items: Cr[] = [];
  /** 道筋（遠くへ行くとき） */
  private paths = new Map<number, { gx: number; gy: number; gk: number; at: number; path: number[]; pi: number; stall: number }>();
  private bq: Int32Array;
  private bprev: Int32Array;
  private bmark: Int32Array;
  private bgen = 0;

  constructor(readonly w: World) {
    const N = w.map.w * w.map.h;
    this.head = new Int32Array(N);
    this.bq = new Int32Array(N);
    this.bprev = new Int32Array(N);
    this.bmark = new Int32Array(N);
  }

  private tilePassable(c: Cr, k: number): boolean {
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
  private findPath(c: Cr, from: number, to: number): number[] | null {
    // ゴブリンは、コボルトの縄張りをできるだけ横切らない（縄張りを通らない道筋を先に探し、なければふつうに探す）
    if (c.k === Kind.Goblin && from >= 0 && to >= 0 && this.warrens.some((o) => o.id >= 0)) {
      const m = this.w.map;
      const land = (k: number) => this.inKoboldLand((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8);
      if (!land(from) && !land(to)) {
        const p = this.findPathAvoid(c, from, to, land);
        if (p) return p;
      }
    }
    return this.findPathAvoid(c, from, to, null);
  }

  private findPathAvoid(c: Cr, from: number, to: number, avoid: ((k: number) => boolean) | null): number[] | null {
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
  private goTo(c: Cr, tx: number, ty: number, speed: number): boolean {
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

  // ---------- 小道具 ----------

  private tileOf(x: number, y: number): number {
    const m = this.w.map;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return -1;
    return ty * m.w + tx;
  }

  /** そのマスに立てるか（地を歩くものは深い水を渡れない） */
  /** 大ネズミがいま浅い所（深さ40以下）に立っているか */
  private ratOnDry(c: Cr): boolean {
    const here = this.tileOf(c.x, c.y);
    return here < 0 || this.w.water[here] <= 40;
  }

  private passable(c: Cr, x: number, y: number): boolean {
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
  private litW(k: number, day: number): number {
    if (k < 0) return 0;
    const m = this.w.map;
    let v = this.w.moss[k] / 255 + this.w.fungus[k] / 400 + Math.min(1, this.w.mana[k] / 40) * 0.6;
    v -= (this.w.lightBase[k] * day) / 600;
    if (this.fireNearTile(k)) v -= 1;
    return v;
  }

  /** シミュレーション用の明るさ（決定的な量だけで計算する） */
  lit(k: number, day: number): number {
    if (k < 0) return 0;
    return (this.w.lightBase[k] * day) / 1000 + this.w.moss[k] / 510 + (this.w.map.lava[k] ? 0.8 : 0);
  }

  private spawn(k: Kind, x: number, y: number, body: number, food: number): Cr {
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

  private deposit(x: number, y: number, n: number): void {
    if (n <= 0) return;
    let k = this.tileOf(x, y);
    if (k < 0 || this.w.map.solid[k]) k = this.nearestFloor(x, y);
    this.w.nutr[k] += n;
  }

  private nearestFloor(x: number, y: number): number {
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

  private setDir(c: Cr, dx: number, dy: number): void {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
    c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : dy > 0 ? 0 : 1;
  }

  /** 目標へ向かって一歩。壁にぶつかったら軸ごとに滑らせ、それでも駄目なら向きを変える */
  private moveToward(c: Cr, tx: number, ty: number, speed: number): boolean {
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
  private gaitOf(c: Cr): [number, number] {
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

  private tryMove(c: Cr, mx: number, my: number): void {
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
  private findMoss(c: Cr, cx: number, cy: number, R: number, salt: number, seedStep = this.step): number {
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

  /**
   * 土地勘：開いた場所にある、豊かな苔とキノコの群落（地上の時間で1分ごとに書き出す）。
   * 近くで餌が見つからない生き物は、ここから近い群落を目指す
   */
  private forage: number[] = [];
  /** 開いた場所（閉じた空洞の外）の苔とキノコの量。数の上限や来訪の条件に使う */
  openMoss = 0;
  openFungus = 0;
  /** 開いた床の、食べられる苔（20以上の群落の、根元12を除いた分）。土地勘と同じ時機に数える */
  edibleMoss = 0;
  /** 開いた場所のキノコのうち、コボルトの畑の外にあるもの（ゴブリンが来る条件に使う。土地勘と同じ時機に数える） */
  wildFungus = 0;
  private updateForage(): void {
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
  private nearestForage(x: number, y: number, R: number, avoid = -1): number {
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

  private eatMoss(c: Cr, n: number): boolean {
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
  private eat(pred: Cr, prey: Cr): void {
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

  private die(c: Cr, cause = '', by = -1): void {
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

  // ---------- 生き物の格子（近くの相手を探す） ----------

  /** 地図の横8マスごとの区切りに、いま何匹いるか（nearby で空の区切りを飛ばす。見る順番は変わらない） */
  private blk = new Int32Array(0);
  private usedTiles: number[] = [];

  private rebuildGrid(): void {
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

  private nearby(x: number, y: number, R: number, fn: (c: Cr) => void): void {
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

  // ---------- 1歩 ----------

  private day = 0;
  private corpses: Cr[] = [];

  private dayNow = 0;
  private lastLogged: number[] = [];
  private phaseNow = 0;

  update(tick: number, day: number, phase: number): void {
    this.step++;
    this.day = day;
    this.dayNow = day;
    this.phaseNow = phase;
    this.rebuildGrid();
    this.buildGroups();
    this.buildLitMap();
    this.corpses = this.list.filter((c) => c.dead === 1 && c.units > 0 && c.k !== Kind.Wisp && c.k !== Kind.Slime && c.k !== Kind.Myconid);
    this.counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const c of this.list) if (!c.dead) this.counts[c.k]++;

    for (const c of this.list) {
      if (c.dead === 2) continue;
      c.px = c.x;
      c.py = c.y;
      c.actT++;
      if (c.dead === 1) {
        this.decay(c);
        continue;
      }
      if (c.caught) {
        c.act = 1;
        if (ih(c.id, this.step, 41) % (c.k === Kind.Bat ? 70 : 160) === 0) c.caught = false;
        this.metabolism(c);
        continue;
      }
      if (STR[c.k] > 0 && this.woundsAndFlight(c)) {
        this.metabolism(c);
        continue;
      }
      if (c.k === Kind.Minotaur && c.gait > 0) c.gait--;
      if (c.sleep > 0 && this.alarms.size && this.alarms.has(this.groupKey(c) ?? '')) c.sleep = 0;
      // ウィスプは土からマナを吸う（4刻みごとに少しずつ、体に40まで）
      if (c.k === Kind.Wisp && this.step % 4 === c.id % 4 && c.mana < 40) {
        const k = this.tileOf(c.x, c.y);
        if (k >= 0 && this.w.mana[k] >= 3) {
          const t = Math.min(2, this.w.mana[k] - 1, 40 - c.mana);
          this.w.mana[k] -= t;
          c.mana += t;
        }
      }
      if (Ecology.PESTERS.has(c.k) && this.pester(c)) {
        this.metabolism(c);
        continue;
      }
      if (this.feeding(c)) {
        this.metabolism(c);
        continue;
      }
      if (this.doSleep(c, day, this.phaseNow)) {
        this.metabolism(c);
        continue;
      }
      if (this.heedAlarm(c) || this.fearFire(c) || this.lurk(c) || this.territory(c) || this.shyOfPeople(c)) {
        this.metabolism(c);
        continue;
      }
      if (this.hear(c)) {
        this.metabolism(c);
        continue;
      }
      switch (c.k) {
        case Kind.Wisp: this.wisp(c, day); break;
        case Kind.Bat: this.bat(c, day, phase); break;
        case Kind.Rat: this.rat(c, day); break;
        case Kind.Lizard: if (!this.followOwner(c)) this.lizard(c, day); break;
        case Kind.Spider: this.spider(c, day); break;
        case Kind.Slime: this.slime(c); break;
        case Kind.Zombie: this.zombie(c); break;
        case Kind.Ghost: this.ghost(c, day); break;
        case Kind.Myconid: this.myconid(c); break;
        case Kind.Ant: this.ant(c); break;
        case Kind.Kobold: this.kobold(c); break;
        case Kind.Salamander: this.salamander(c); break;
        case Kind.Goblin: this.goblin(c); break;
        case Kind.Orc: this.orc(c); break;
        case Kind.Lizardman: this.lizardman(c); break;
        case Kind.Minotaur: this.minotaur(c); break;
        case Kind.Troll: this.troll(c, day); break;
        case Kind.Basilisk: this.basilisk(c); break;
        case Kind.Gargoyle: this.gargoyle(c); break;
        case Kind.Vampire: this.vampire(c, day); break;
        case Kind.Mimic: this.mimic(c); break;
        case Kind.Golem: this.golem(c); break;
        case Kind.Worm: this.worm(c); break;
        case Kind.Wyvern: this.wyvern(c); break;
        case Kind.Dragon: this.dragon(c, day); break;
        case Kind.Adventurer: this.adventurer(c, day); break;
        case Kind.Skeleton: this.skeleton(c, day); break;
        case Kind.Lich: this.lich(c, day); break;
        case Kind.Dwarf: this.dwarf(c); break;
      }
      if (!c.dead) this.metabolism(c);
    }
    this.updateWebs();
    if (this.step % 50 === 0) this.arrivals(day);
    if (this.step % 10 === 0) for (let i = 0; i < this.deathMap.length; i++) if (this.deathMap[i] > 0) this.deathMap[i]--;
    if (this.step % 200 === 0) for (let i = 0; i < this.graveMap.length; i++) if (this.graveMap[i] > 0) this.graveMap[i]--;
    if (this.step % 400 === 0) for (let i = 0; i < this.advGrave.length; i++) if (this.advGrave[i] > 0) this.advGrave[i]--;
    if (this.step % 50 === 25) this.spawnGhosts(day);
    if (this.step % 40 === 20) this.spawnSlimes();
    if (this.step % 10 === 5) this.updateColonies();
    if (this.step % 600 === 85) this.checkKoboldMouths();
    if (this.step % 600 === 95) this.checkRatDoors();
    if (this.step % 50 === 35) this.updateWarrens();
    if (this.step % 10 === 3) this.watchWarrens();
    if (this.step % 10 === 7) this.watchCamps();
    if (this.step % 600 === 115) this.updateVassals();
    if (this.step % 50 === 25) this.sendCollectors();
    if (this.step % 600 === 105) this.checkGoblinMouths();
    this.checkTraps();
    if (this.step % 200 === 100) this.spawnSalamanders();
    if (this.step % 50 === 15) this.updateCamps();
    if (this.step % 50 === 45) this.updateStatues(day);
    if (this.step % 50 === 30) this.updateTreasure(day);
    this.updateFire();
    this.updateDigging();
    if (this.step % 100 === 41) this.checkJoined();
    if (this.step % 50 === 13) this.manaBirths(this.day);
    if (this.step % 300 === 77) this.riseLeaders();
    if (this.step % 100 === 43) this.breakTopWall();
    for (const pid of this.pendingScraps.splice(0)) {
      const p = this.parties.find((q) => q.id === pid);
      if (p) this.dropScraps(p, this.w.map.entrance.x * TILE + 16, 3 * TILE + 8, 2);
    }
    if (this.step % 600 === 310 || this.presenceBase.every((v) => v === 0)) this.updatePresenceBase();
    this.updatePresenceTrace();
    this.syncLongSleep();
    this.personalSpace();
    this.wakeByNoise();
    this.breed();
    if (this.step % 300 === 211) this.tendGroups();
    if (this.step % 300 === 7 || !this.forage.length) this.updateForage();
    this.updateParties();
    this.updateHold();
    this.updateItems();
    if (this.step % 40 === 10) for (let k = 0; k < this.w.ash.length; k++) if (this.w.ash[k] > 0) { this.w.ash[k]--; if ((this.w.ash[k] & 15) === 0) this.w.fxDirty = true; }
    this.lastPhase = phase;
    if (this.step % 10 === 0 || this.list.length > 4000) {
      const keep = this.list.filter((c) => c.dead !== 2);
      if (keep.length !== this.list.length) {
        for (const c of this.list)
          if (c.dead === 2) {
            this.byId.delete(c.id);
            this.paths.delete(c.id);
            this.gkMemo.delete(c.id);
          }
        this.list = keep;
      }
    }
  }

  private metabolism(c: Cr): void {
    // 水の精と光の精は、マナで体を保つので腹が減らない（食べ物も体も減らない）
    if (c.elite === 6 || c.elite === 7) return;
    if (c.k === Kind.Zombie || c.k === Kind.Ghost) return;
    const s = SPEC[c.k];
    if (c.k === Kind.Slime && c.food === 0 && this.step % 80 === c.id % 80) {
      // 食べるものがないスライムは少しずつ縮む
      c.body--;
      this.deposit(c.x, c.y, 1);
      if (c.body < 4) this.die(c, 'starve');
      return;
    }
    if (c.glow > 0) c.glow = Math.max(0, c.glow - s.glowDecay);
    // 眠っている間は腹が減りにくい（二刻みに一度だけ）
    if (c.sleep > 0 && this.step % 2 === 0) return;
    c.sinceMeal++;
    // ねぐらで眠るコウモリは代謝を落とす
    const meta = c.k === Kind.Bat && c.st === 0 ? s.meta * 5 : s.meta;
    if (c.k === Kind.Bat && c.st === 0 && this.step % 5 !== 0) {
      if (c.food === 0) return;
    }
    if (this.step % meta === (c.id % meta)) {
      if (c.food > 0) {
        c.food--;
        if (c.away) this.exported++;
        else this.deposit(c.x, c.y, 1);
        c.hungry = 0;
      }
    }
    if (c.food === 0) c.hungry++;
    if (c.hungry > s.starve) this.die(c, 'starve');
  }

  /** 死骸の段階：0 新しい、1 腐りかけ、2 骨 */
  corpseStage(c: Cr): number {
    if (c.units <= Math.max(2, Math.floor(c.init * 0.3))) return 2;
    if (c.actT > 900 || c.units < c.init * 0.75) return 1;
    return 0;
  }

  private decay(c: Cr): void {
    if (c.k === Kind.Wisp || c.k === Kind.Slime || c.k === Kind.Ghost || c.k === Kind.Myconid) {
      if (c.actT > 8) c.dead = 2;
      return;
    }
    // 何もされなければ、死骸はとてもゆっくり朽ちて土に返る。骨はさらに長く残る
    const stage = this.corpseStage(c);
    const every = stage === 2 ? 400 : 60;
    if (c.units > 0 && this.step % every === c.id % every) {
      c.units--;
      this.deposit(c.x, c.y, 1);
    }
    if (c.units <= 0) {
      c.dead = 2;
      return;
    }
    // 清められていない冒険者の亡骸は、骨になったあと、多くが死んだ暗い所で起き上がる
    if (c.k === Kind.Adventurer && c.st !== 99 && c.actT > 1500 && this.step % 50 === c.id % 50) {
      const k = this.tileOf(c.x, c.y);
      const deaths = this.deathsAt(c.x, c.y);
      const lichNear = this.lichNear(c.x, c.y);
      if (k >= 0 && this.lit(k, this.day) < 0.15 && this.manaAround(k) >= 6 && (deaths >= 300 || lichNear) && ih(c.id, this.step, 140) % (lichNear ? 6 : 30) === 0) {
        this.raiseUndead(c, deaths >= 600 && this.manaAround(k) >= 20);
        return;
      }
    }
    // 暗く湿った所で、スライムに見つからずに残った死骸は、ゾンビとして起き上がることがある（リッチのそばではずっと起き上がりやすい）
    // 骨の竜：成竜の亡骸が、マナの濃い暗がりで地上の半日ほど眠ったあと、骨の竜として起き上がる
    if (c.k === Kind.Dragon && c.sp >= 2 && c.elite !== 8 && c.actT > DAY_TICKS_ECO / 4 && this.step % 50 === c.id % 50) {
      const k = this.tileOf(c.x, c.y);
      if (k >= 0 && this.manaAround(k) >= 25 && this.lit(k, this.day) < 0.2) {
        c.dead = 0;
        c.elite = 8;
        c.body = c.units;
        c.init = c.units;
        c.units = 0;
        c.hp = this.maxHp(c);
        c.st = 1;
        c.act = 0;
        c.food = 0;
        this.takeMana(c, k, 200, 3);
        this.nameOf(c);
        this.log(c.x, c.y, `ダンジョンの主の亡骸が、骨の竜「${this.names.get(c.id)}」として起き上がった`);
        return;
      }
    }
    if ((c.k === Kind.Rat || c.k === Kind.Lizard) && stage < 2 && c.actT > 500 && c.ref === 0 && c.st !== 99) {
      const k = this.tileOf(c.x, c.y);
      const boost = this.step % 50 === c.id % 50 && this.lichNear(c.x, c.y);
      if (k >= 0 && this.lit(k, this.day) < 0.15 && this.manaAround(k) >= 10 && (this.w.moist[k] >= 70 || boost) && ih(c.id, this.step, 51) % (boost ? 8 : 800) === 0) {
        c.sp = c.k;
        c.k = Kind.Zombie;
        c.body = c.units;
        c.init = c.units;
        c.units = 0;
        c.dead = 0;
        c.act = 0;
        c.actT = 0;
        c.hungry = 0;
        c.glow = 0;
      }
    }
  }

  // ---------- 死の気配（ゴーストが現れる） ----------
  private deathMap = new Int32Array(24 * 18);
  /** 長く残る「死者の多さ」（冒険者や大物が倒れた所。ゆっくり薄れる） */
  private graveMap = new Int32Array(24 * 18);
  /** 冒険者の亡骸の墓（区画ごと。地上の約6日残る） */
  private advGrave = new Int32Array(24 * 18);
  private addDeath(x: number, y: number, k: number = -1): void {
    // はかない種（ウィスプ、スライム）の死は、死者の多さに数えない
    if (k === Kind.Wisp || k === Kind.Slime) return;
    const cx = Math.min(23, Math.max(0, Math.floor(x / (TILE * 8))));
    const cy = Math.min(17, Math.max(0, Math.floor(y / (TILE * 8))));
    this.deathMap[cy * 24 + cx] += 100;
    this.graveMap[cy * 24 + cx] += 100;
    if (k === Kind.Adventurer) this.advGrave[cy * 24 + cx] += 100;
  }

  // ---------- ウィスプ ----------
  private wisp(c: Cr, day: number): void {
    // 光の精：生まれた光の筋のまわり5マスをゆっくり漂う。飢えない。襲われたときだけ、まぶしい光線で打ち返す
    if (c.elite === 7) {
      c.sinceMeal = 0;
      if (c.foe && this.w.tick - c.hitAt < 120) {
        const f = this.byId.get(c.foe);
        if (f && !f.dead && sq(f.x - c.x) + sq(f.y - c.y) < 5 * TILE * 5 * TILE) {
          c.act = 2;
          if (this.step % 20 === c.id % 20) this.fight(c, f);
          return;
        }
      }
      const a = (ih(c.id, this.step >> 6, 309) % 628) / 100;
      c.act = 1;
      this.goTo(c, c.hx + Math.cos(a) * 3 * TILE, c.hy + Math.sin(a) * 2 * TILE, SPEC[Kind.Wisp].speed * 0.5);
      return;
    }
    const m = this.w.map;
    const k = this.tileOf(c.x, c.y);
    // 光に寄る：自分と上下左右のマスで一番明るい方へ
    let best = this.litW(k, day);
    let bx = 0;
    let by = 0;
    const tx = Math.floor(c.x / TILE);
    const ty = Math.floor(c.y / TILE);
    const nb = NB4;
    for (const [dx, dy] of nb) {
      const xx = tx + dx;
      const yy = ty + dy;
      if (xx < 0 || yy < 0 || xx >= m.w || yy >= m.h) continue;
      const l = this.litW(yy * m.w + xx, day);
      if (l > best + 0.02) {
        best = l;
        bx = dx;
        by = dy;
      }
    }
    c.vx += bx * 0.08;
    c.vy += by * 0.08;
    // 水の流れに乗る
    if (k >= 0 && this.w.water[k] > 20) {
      const sc = m.height[k] * 2 + this.w.water[k];
      for (const [dx, dy] of nb) {
        const n = k + dx + dy * m.w;
        if (n < 0 || n >= m.solid.length || m.solid[n]) continue;
        if (m.height[n] * 2 + this.w.water[n] < sc - 2) {
          c.vx += dx * 0.05;
          c.vy += dy * 0.05;
          break;
        }
      }
    }
    const j = DIR16[ih(c.id, this.step, 1) & 15];
    c.vx = (c.vx + j[0] * 0.18) * 0.86;
    c.vy = (c.vy + j[1] * 0.18) * 0.86;
    const sp = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
    const max = SPEC[Kind.Wisp].speed;
    if (sp > max) {
      c.vx = (c.vx / sp) * max;
      c.vy = (c.vy / sp) * max;
    }
    this.tryMove(c, c.vx, c.vy);
    if (!(c.act === 2 && c.actT < 4)) c.act = sp > 0.15 ? 1 : 0;
    if (ih(c.id, this.step, 2) % 2 === 0 && c.food < SPEC[Kind.Wisp].cap && this.eatMoss(c, 1)) {
      c.act = 2;
      c.actT = 0;
    }
  }

  // ---------- コウモリ ----------
  private bat(c: Cr, day: number, phase: number): void {
    const night = day <= 0 && (phase > 0.79 || phase < 0.18);
    const s = SPEC[Kind.Bat];
    if (!night) {
      if (c.away) {
        // 外から戻る
        c.away = false;
        c.x = c.tx;
        c.y = c.ty;
        const add = Math.min(25, s.cap - c.food);
        c.food += add;
        this.imported += add;
      }
      // ぶら下がる場所は、いまねぐらにいる仲間の並び順で決め直す（同じ場所に重ならないように）
      {
        const g = this.groups.get(this.groupKey(c) ?? '');
        if (g && this.step % 20 === c.id % 20) {
          const mates = g.members.filter((o) => o.k === Kind.Bat && !o.ref2).sort((a, b) => a.id - b.id);
          const i = Math.max(0, mates.indexOf(c));
          c.hx = c.tx + ((i % 6) - 2.5) * 7 + ((c.id % 3) - 1);
          c.hy = c.ty - 26 - Math.floor(i / 6) * 8;
        }
      }
      if (c.st !== 0) {
        c.act = 1;
        if (this.goTo(c, c.hx, c.hy, s.speed)) {
          c.st = 0;
          c.x = c.hx;
          c.y = c.hy;
        }
      } else {
        c.act = 0;
        // 居場所が変わったら、ぶら下がったまま少しずつ寄る
        c.x += (c.hx - c.x) * 0.1;
        c.y += (c.hy - c.y) * 0.1;
      }
      return;
    }
    // ヴァンパイアに従うコウモリは外へ出ず、その周りに群れる
    const lord = c.ref2 ? this.byId.get(c.ref2) : undefined;
    if (lord && !lord.dead && lord.k === Kind.Vampire && !c.away) {
      if (c.st === 0 || c.st === 2) c.st = 1;
      c.act = 1;
      const a = (this.step * 0.02 + c.id * 1.7) % 6.283;
      const r = 20 + (c.id % 3) * 8;
      this.moveToward(c, lord.x + Math.cos(a) * r, lord.y - 10 + Math.sin(a) * r * 0.6, s.speed);
      const k0 = this.tileOf(c.x, c.y);
      if (c.food < s.cap && k0 >= 0 && this.w.moss[k0] > 20) this.eatMoss(c, 2);
      return;
    } else if (c.ref2) c.ref2 = 0;
    if (c.st === 0) c.st = ih(c.id, Math.floor(this.step / 3000), 9) % 10 < 4 ? 2 : 1;
    if (c.st === 2) {
      c.act = 1;
      if (this.goTo(c, c.tx, c.ty, s.speed)) {
        c.st = 3;
        c.away = true;
      }
      return;
    }
    if (c.st === 3) return;
    // ダンジョンの中で苔を食べる
    c.act = 1;
    const k = this.tileOf(c.x, c.y);
    if (c.food < s.cap && k >= 0 && this.w.moss[k] > 20) {
      if (this.eatMoss(c, 2)) {
        c.act = 2;
        c.actT = 0;
      }
      const j = DIR16[ih(c.id, this.step, 3) & 15];
      this.tryMove(c, j[0] * 0.5, j[1] * 0.5);
      return;
    }
    if (c.ref === 0 || ih(c.id, this.step, 4) % 40 === 0) {
      const t = this.findMoss(c, c.hx, c.hy, 12, 100);
      if (t >= 0) {
        c.ref = t + 1;
      } else c.ref = 0;
    }
    if (c.ref > 0) {
      const t = c.ref - 1;
      const gx = (t % this.w.map.w) * TILE + 8;
      const gy = Math.floor(t / this.w.map.w) * TILE + 8;
      if (this.goTo(c, gx, gy, s.speed)) c.ref = 0;
    } else {
      const j = DIR16[ih(c.id, this.step, 6) & 15];
      this.tryMove(c, j[0] * s.speed, j[1] * s.speed);
    }
  }

  // ---------- 大ネズミ ----------
  private rat(c: Cr, day: number): void {
    const s = SPEC[Kind.Rat];
    // 動いている大トカゲに気づいたら逃げる
    let threat: Cr | null = null;
    this.nearby(c.x, c.y, 2, (o) => {
      if (o.dead) return;
      const scary = (o.k === Kind.Lizard && o.act !== 0) || (o.k === Kind.Zombie && o.act !== 0) || o.k === Kind.Ghost || ((o.k === Kind.Kobold || o.k === Kind.Goblin || o.k === Kind.Lizardman || o.k === Kind.Orc || o.k === Kind.Minotaur) && o.hungry > 0);
      if (!scary) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < (o.k === Kind.Ghost ? 34 * 34 : 26 * 26)) threat = o;
    });
    if (threat) {
      const t = threat as Cr;
      const dx = c.x - t.x;
      const dy = c.y - t.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      this.tryMove(c, (dx / d) * s.speed * 1.4, (dy / d) * s.speed * 1.4);
      c.act = 1;
      c.st = 0;
      // 目当ての苔へ向かう途中でおびえたら、その苔はあきらめて別の苔を探す
      // （以前は、細い通路にいるゴーストやクモにおびえては同じ苔へ戻り、を繰り返して苔のそばで飢えていた）
      if (c.ref > 0) {
        c.gait = c.ref;
        c.ref = 0;
      }
      return;
    }
    // 群れで外へ出ていくところ
    if (c.st === 8) {
      c.act = 1;
      const open = this.w.map.mouths.some((mo, i) => mo.kind === 0 && this.mouthOpen(i));
      const here = this.tileOf(c.x, c.y);
      // 口まで行き着けないまま飢えが進んだら、あきらめて近くで食べ物を探す
      if (!open || c.hungry > s.starve * 0.7) c.st = 1;
      // 道すがら食べられる苔があれば、少し食べてから進む
      else if (here >= 0 && c.food < s.cap * 0.5 && Math.max(this.w.moss[here], this.w.fungus[here]) >= 20 && this.eatMoss(c, 2)) c.act = 2;
      else if (this.goTo(c, c.tx, c.ty, s.speed) || sq(c.tx - c.x) + sq(c.ty - c.y) < 30 * 30) this.exitCreature(c, 'dispersed');
      return;
    }
    // 腹を空かせて食べ物が見つからなければ、行き詰まる前に去る
    if (c.hungry > 150 && this.step % 20 === c.id % 20 && this.ratDisperse(c)) return;
    if (c.st === 0) {
      // 巣穴への道筋が見つからない（遠すぎる、ふさがった）なら、はぐれ者になって食べ物を探す。
      // 近くの巣穴には、群れの見直し（tendGroups）で加わる（以前は、届かない巣穴へまっすぐ歩いては壁に当たり続けていた）
      // 巣穴へ帰る・休む（巣穴のまわりに散らばって）
      const ox = ((c.id % 5) - 2) * 6;
      const oy = (((c.id >> 3) % 3) - 1) * 5;
      const hx = this.passable(c, c.hx + ox, c.hy + oy) ? c.hx + ox : c.hx;
      const hy = this.passable(c, c.hx + ox, c.hy + oy) ? c.hy + oy : c.hy;
      const hp0 = this.paths.get(c.id);
      if (!(c.hx || c.hy) || (hp0 && hp0.path.length === 0 && hp0.gk === this.tileOf(hx, hy) && sq(hx - c.x) + sq(hy - c.y) > 3 * TILE * 3 * TILE)) {
        c.hx = 0;
        c.hy = 0;
        c.st = 1;
        return;
      }
      if (this.goTo(c, hx, hy, s.speed)) {
        c.act = 0;
        // 殖えるかどうかは、巣穴のまわりで養える数で決める（全体の目安も超えない）
        if (c.food >= 24 && this.counts[Kind.Rat] < Math.min(this.ratCap(), this.ratFoodCap()) && ih(c.id, this.step, 11) % 45 === 0 && this.burrowResidents(c) < this.burrowCapOf(c)) {
          c.food -= 12;
          const pup = this.spawn(Kind.Rat, c.x, c.y, 12, 0);
          pup.hx = c.hx;
          pup.hy = c.hy;
        }
      } else c.act = 1;
      if (c.food < s.cap / 2 && ih(c.id, this.step, 12) % 6 === 0) c.st = 1;
      return;
    }
    if (c.st === 1) {
      // 足もとに食べられる苔かキノコがあれば、遠くの目当てまで行かずにここで食べる（目当てに道筋が通らないまま、苔の上で飢えないように）
      const here = this.tileOf(c.x, c.y);
      if (here >= 0 && c.food < s.cap * 0.8 && Math.max(this.w.moss[here], this.w.fungus[here]) >= 20) {
        c.st = 2;
        return;
      }
      // 目指す苔が食べ尽くされていたら、すぐに選び直す。道筋が見つからなかった所は避ける
      const cur = c.ref - 1;
      // 道筋の見つからなかった目当てはあきらめる（以前は、道筋を探した直後の4刻みしか見ておらず、その間ほかのことをしていると、
      // 届かない目当てへまっすぐ歩いて壁に当たり続け、そばの苔に気づかずに飢えていた）
      const pp = this.paths.get(c.id);
      const noPath = !!pp && pp.path.length === 0 && cur >= 0 && pp.gk === cur;
      if (cur >= 0 && (Math.max(this.w.moss[cur], this.w.fungus[cur]) < 20 || noPath)) {
        if (noPath) c.gait = cur + 1;
        c.ref = 0;
      }
      if (c.ref === 0 || (ih(c.id, this.step, 13) % 50 === 0 && !(c.hungry > 0 && cur >= 0 && Math.max(this.w.moss[cur], this.w.fungus[cur]) >= 20))) {
        // 腹を空かせていれば、歩いて12マス以内でいちばん近い食べられる苔かキノコを目当てにする
        // （いくつかの点を選んで調べるやり方では、まばらな苔を見落として、ずっと遠くの群落を目指して途中で飢えていた）
        let t = c.hungry > 0 ? this.nearestEdible(c, 12) : -1;
        if (t < 0) t = this.findMoss(c, c.x, c.y, 9, 200);
        if (t < 0) t = this.findMoss(c, c.hx, c.hy, 10, 230);
        // 近くになければ、土地勘から豊かな群落を目指す（腹が減るほど遠くまで）
        if (t < 0) t = this.nearestForage(c.x, c.y, 30 + Math.min(60, c.hungry / 10), c.gait - 1);
        if (t < 0 && this.w.map.shafts.length) {
          const sh = this.w.map.shafts[ih(c.id, this.step, 15) % this.w.map.shafts.length];
          t = this.findMoss(c, sh.x * TILE + 8, sh.y * TILE + 8, 6, 260);
        }
        c.ref = t >= 0 ? t + 1 : 0;
        if (t < 0) {
          const j = DIR16[ih(c.id, this.step, 14) & 15];
          this.tryMove(c, j[0] * s.speed, j[1] * s.speed);
          c.act = 1;
          return;
        }
      }
      const t = c.ref - 1;
      const gx = (t % this.w.map.w) * TILE + 2 + (ih(c.id, 1) % 13);
      const gy = Math.floor(t / this.w.map.w) * TILE + 2 + (ih(c.id, 2) % 13);
      c.act = 1;
      if (this.goTo(c, gx, gy, s.speed)) c.st = 2;
      return;
    }
    // 食べる
    if (this.eatMoss(c, 2)) {
      c.act = 2;
      if (c.actT > 4) c.actT = 0;
    } else {
      c.ref = 0;
      c.st = c.food >= s.cap * 0.8 ? 0 : 1;
    }
    if (c.food >= s.cap * 0.9) c.st = 0;
  }

  private ratCap(): number {
    return Math.min(90, Math.floor(this.openMoss / 300));
  }

  /** 中の食べ物で養える大ネズミの数の目安：開いた床の、食べられる苔（20以上の群落の、根元12を除いた分）を、一匹が地上の2日に食べる量で割る */
  private ratFoodCap(): number {
    return Math.floor(this.edibleMoss / 1200);
  }

  /** 巣穴のまわり（10マス）の食べられる苔とキノコ（20以上の群落の、根元12を除いた分） */
  private burrowFood(x: number, y: number): number {
    const m = this.w.map;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    let f = 0;
    for (let yy = Math.max(1, ty - 10); yy <= Math.min(m.h - 2, ty + 10); yy++)
      for (let xx = Math.max(1, tx - 10); xx <= Math.min(m.w - 2, tx + 10); xx++) {
        const k = yy * m.w + xx;
        if (m.solid[k] || m.sealed[k]) continue;
        const v = Math.max(this.w.moss[k], this.w.fungus[k]);
        if (v >= 20) f += v - 12;
      }
    return f;
  }

  /**
   * 巣穴の引っ越し：まわりの苔が尽きてきた巣穴は、歩いて行ける（道のり120マスまで）苔の豊かな所へ群れごと移る。
   * 地上の1/4日に一度まで試す。移った先が見つかれば true
   */
  private relocateBurrow(b: Burrow, fromFire = false): boolean {
    if (this.w.tick - (b.moved ?? -1e9) < DAY_TICKS_ECO / 4) return false;
    b.moved = this.w.tick;
    const m = this.w.map;
    const res = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y);
    if (!res.length) return false;
    const here = this.burrowFood(b.x, b.y);
    const dist = this.walkDist(this.tileOf(b.x, b.y - 3), 120);
    const reach: number[] = [];
    for (let q = 0; q < dist.length; q++) if (dist[q] >= 8) reach.push(q);
    if (!reach.length) return false;
    let best = -1;
    // 火のそばから逃げるときは、まわりに食べ物が足りれば十分（今より豊かでなくてもよい）
    let bv = fromFire ? Math.max(res.length * 150, 300) : Math.max(here * 2, res.length * 300, 600);
    for (let i = 0; i < 80; i++) {
      const k = reach[ih(this.step, i, 233) % reach.length];
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 0) continue;
      let walls = 0;
      for (const nn of [k + 1, k - 1, k - m.w]) walls += m.solid[nn];
      if (!walls) continue;
      const x = (k % m.w) * TILE + 8;
      const y = Math.floor(k / m.w) * TILE + 11;
      if (this.burrows.some((o) => o !== b && Math.abs(o.x - x) < 6 * TILE && Math.abs(o.y - y) < 6 * TILE)) continue;
      // 火のそば（怖くて近寄れない所）には巣穴を作らない
      if (this.fireNear(x, y)) continue;
      const v = this.burrowFood(x, y) - dist[k] * 4;
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    if (best < 0) return false;
    const nx = (best % m.w) * TILE + 8;
    const ny = Math.floor(best / m.w) * TILE + 11;
    for (const c of res) {
      c.hx = nx;
      c.hy = ny;
      if (c.st === 8) c.st = 0;
    }
    this.record('moves', { t: this.w.tick, k: Kind.Rat, n: res.length, x: Math.round(b.x), y: Math.round(b.y), tx: nx, ty: ny } as never);
    b.x = nx;
    b.y = ny;
    b.hk = -1;
    b.len = 0;
    b.cap = this.burrowCap(b);
    if (this.step - (this.lastLogged[993] ?? -99999) > 1500) {
      this.lastLogged[993] = this.step;
      this.log(nx, ny, `{k:${Kind.Rat}}の群れ（${res.length}匹）が、苔の尽きた巣穴を捨てて、苔の豊かな所へ巣穴を移した`);
    }
    return true;
  }

  /**
   * 巣穴のまわり（10マス）の食べられる苔で養える数：いまある量を、一匹が地上の1日に食べる量（約600）で割る。
   * 苔はそのあいだにも育つので、いまある量だけで2日分（全体の目安と同じ割り方）とすると少なすぎた（巣穴ごとに2〜5匹、ダンジョン全体で数匹になった）
   */
  private burrowCap(b: Burrow): number {
    return Math.floor(this.burrowFood(b.x, b.y) / 600);
  }

  private burrowCapOf(c: Cr): number {
    const b = this.burrows.find((o) => o.x === c.hx && o.y === c.hy);
    return b ? b.cap ?? this.burrowCap(b) : 0;
  }

  private burrowResidents(c: Cr): number {
    let n = 0;
    for (const o of this.list) if (o.k === Kind.Rat && !o.dead && o.hx === c.hx && o.hy === c.hy) n++;
    return n;
  }

  private hungryRats(): number {
    let h = 0;
    for (const c of this.list) if (c.k === Kind.Rat && !c.dead && c.hungry > 0) h++;
    return h;
  }

  /**
   * 行き詰まる前に動く：腹を空かせ、近くに苔がなければ、まず巣穴ごと苔の豊かな所へ引っ越す。移れる所がなく、
   * 開いた地表の横穴まで飢え死にする前に歩いて着ければ（道のり150マスまで）、巣穴の仲間のうち腹を空かせた者と連れ立って（数匹の群れで）外へ出ていく。
   * どちらもできなければ、今までどおり中で飢える
   */
  /** 歩いて max マス以内でいちばん近い、食べられる苔かキノコ（20以上）のマス（避けたい目当て gait は除く）。なければ -1 */
  private nearestEdible(c: Cr, max: number): number {
    const d = this.walkDist(this.tileOf(c.x, c.y), max);
    let best = -1;
    for (let q = 0; q < d.length; q++) {
      // 立てないマス（大ネズミにとっての深い水）の苔は選ばない
      if (d[q] < 0 || q === c.gait - 1 || Math.max(this.w.moss[q], this.w.fungus[q]) < 20 || !this.tilePassable(c, q)) continue;
      if (best < 0 || d[q] < d[best]) best = q;
    }
    return best;
  }

  private ratDisperse(c: Cr): boolean {
    const m = this.w.map;
    // 出ていく途中で飢えが7割を越えたらあきらめる（st 8）ので、すでに越えている者は出ていこうとしない
    // （以前は出ていこうとしては次の刻みにあきらめ、そのたびに目当ての苔を忘れて選び直し、苔のそばで行ったり来たりして飢えていた）
    if (c.hungry > SPEC[Kind.Rat].starve * 0.7) return false;
    // 歩いて10マス以内に食べられる苔かキノコがあれば出ていかない（いくつかの点を選んで調べるやり方では、まばらな苔を見落としていた）
    {
      const d = this.walkDist(this.tileOf(c.x, c.y), 10);
      for (let q = 0; q < d.length; q++) if (d[q] >= 0 && Math.max(this.w.moss[q], this.w.fungus[q]) >= 20) return false;
    }
    if (this.findMoss(c, c.hx, c.hy, 10, 231) >= 0) return false;
    // まず中での引っ越しを試す（巣穴のまわりの苔が尽きていれば、苔の豊かな所へ群れごと移る）
    const b = this.burrows.find((o) => o.x === c.hx && o.y === c.hy);
    if (b && this.relocateBurrow(b)) {
      c.st = 0;
      return true;
    }
    // 移れる所がなければ外へ：飢え死にする前に歩いて着ける（残りの辛抱の8割で歩ける道のりまで）開いた地表の横穴のうち、いちばん近いもの
    const reachTiles = Math.min(150, Math.floor(((SPEC[Kind.Rat].starve - c.hungry) * 0.8 * SPEC[Kind.Rat].speed) / TILE));
    if (reachTiles < 4) return false;
    const dist = this.walkDist(this.tileOf(c.x, c.y), reachTiles);
    let ex = -1;
    let ey = -1;
    let bd = 1e9;
    for (let i = 0; i < m.mouths.length; i++) {
      if (m.mouths[i].kind !== 0 || !this.mouthOpen(i)) continue;
      const [mx, my] = this.mouthSpot(i);
      const d = dist[this.tileOf(mx, my)];
      if (d >= 0 && d < bd) {
        bd = d;
        ex = mx;
        ey = my;
      }
    }
    // 着ける口がなければ出ていかない（以前は口がなくても出ていく群れにして、目当てを忘れさせていた）
    if (ex < 0) return false;
    const group: Cr[] = [c];
    this.nearby(c.x, c.y, 12, (o) => {
      if (group.length >= 5 || o === c || o.dead || o.away || o.k !== Kind.Rat || o.st === 8 || o.hx !== c.hx || o.hy !== c.hy) return;
      if (o.hungry > 0 || o.food < 8) group.push(o);
    });
    for (const o of group) {
      o.st = 8;
      o.tx = ex;
      o.ty = ey;
      o.ref = 0;
    }
    if (this.step - (this.lastLogged[994] ?? -99999) > 1500) {
      this.lastLogged[994] = this.step;
      this.log(c.x, c.y, group.length > 1 ? `腹を空かせた{k:${Kind.Rat}}の群れ（${group.length}匹）が、地表の横穴から外へ出ていった` : `腹を空かせた{k:${Kind.Rat}}が、地表の横穴から外へ出ていった`);
    }
    return true;
  }

  // ---------- 大トカゲ ----------
  private lizard(c: Cr, day: number): void {
    const s = SPEC[Kind.Lizard];
    if (c.st === 2) {
      const prey = this.byId.get(c.ref);
      if (!prey || prey.dead || prey.away) {
        c.st = 1;
      } else {
        c.act = 1;
        if (this.moveToward(c, prey.x, prey.y, 2.4)) {
          this.eat(c, prey);
          c.st = 1;
        } else if (sq(prey.x - c.x) + sq(prey.y - c.y) > 70 * 70) c.st = 1;
        return;
      }
    }
    if (c.st === 0 || c.sinceMeal % 1500 === 1499) {
      // 待ち伏せの場所を探す：暗い所で、隣が明るく、近くにネズミの気配がある
      let spot = this.findAmbush(c, day, c.x, c.y);
      if (spot < 0 && this.burrows.length) {
        const b = this.burrows[ih(c.id, this.step, 22) % this.burrows.length];
        spot = this.findAmbush(c, day, b.x, b.y);
      }
      if (spot >= 0) {
        c.tx = (spot % this.w.map.w) * TILE + 8;
        c.ty = Math.floor(spot / this.w.map.w) * TILE + 8;
      } else {
        const b = this.burrows.length ? this.burrows[ih(c.id, this.step) % this.burrows.length] : null;
        c.tx = b ? b.x + 24 : c.x;
        c.ty = b ? b.y : c.y;
      }
      c.st = 3;
    }
    if (c.st === 3) {
      c.act = 1;
      if (this.goTo(c, c.tx, c.ty, s.speed)) c.st = 1;
      return;
    }
    // 待つ
    if (c.act !== 2 || c.actT > 6) c.act = 0;
    let target: Cr | null = null;
    let bd = 30 * 30;
    this.nearby(c.x, c.y, 2, (o) => {
      if (o.k !== Kind.Rat || o.dead) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        target = o;
      }
    });
    // 腹が満ちている間は狩らない
    if (target && c.food < SPEC[Kind.Lizard].cap * 0.6) {
      c.st = 2;
      c.ref = (target as Cr).id;
    }
    if (c.food >= 100 && this.counts[Kind.Lizard] < 24 && ih(c.id, this.step, 21) % 2000 === 0) {
      c.food -= 40;
      const j = this.spawn(Kind.Lizard, c.x + 6, c.y, 40, 0);
      j.st = 0;
    }
  }

  private findAmbush(c: Cr, day: number, cx: number, cy: number): number {
    const m = this.w.map;
    const tx0 = Math.floor(cx / TILE);
    const ty0 = Math.floor(cy / TILE);
    let best = -1;
    let bv = 0;
    for (let i = 0; i < 40; i++) {
      const h = ih(c.id, this.step, 300 + i);
      const x = tx0 + ((h & 255) % 25) - 12;
      const y = ty0 + (((h >>> 8) & 255) % 25) - 12;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.lava[k] || this.lit(k, day) > 0.18) continue;
      let edge = 0;
      for (const n of [k + 1, k - 1, k + m.w, k - m.w]) if (!m.solid[n] && this.lit(n, day) > 0.3) edge = 1;
      if (!edge) continue;
      let rats = 0;
      this.nearby(x * TILE + 8, y * TILE + 8, 3, (o) => {
        if (o.k === Kind.Rat && !o.dead) rats++;
      });
      const v = rats * 2 + 1 - (Math.abs(x - tx0) + Math.abs(y - ty0)) * 0.05;
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    return best;
  }

  // ---------- 大グモ ----------
  private spider(c: Cr, day: number): void {
    const s = SPEC[Kind.Spider];
    if (c.st === 0) {
      // 巣を張る場所を探す：明るく、壁が近く、飛ぶものが通る所
      const m = this.w.map;
      let ox = c.x;
      let oy = c.y;
      if (c.hungry > 0 || ih(c.id, this.step, 33) % 2 === 0) {
        if (m.shafts.length) {
          const sh = m.shafts[ih(c.id, this.step, 34) % m.shafts.length];
          ox = sh.x * TILE + 8;
          oy = sh.y * TILE + 8;
        }
      }
      const tx0 = Math.floor(ox / TILE);
      const ty0 = Math.floor(oy / TILE);
      let best = -1;
      let bv = 0;
      for (let i = 0; i < 40; i++) {
        const h = ih(c.id, this.step, 500 + i);
        const x = tx0 + ((h & 255) % 31) - 15;
        const y = ty0 + (((h >>> 8) & 255) % 31) - 15;
        if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
        const k = y * m.w + x;
        if (m.solid[k] || m.lava[k]) continue;
        let walls = 0;
        for (const n of [k + 1, k - 1, k + m.w, k - m.w, k + m.w + 1, k - m.w - 1]) walls += m.solid[n];
        if (walls < 2) continue;
        let fly = 0;
        this.nearby(x * TILE + 8, y * TILE + 8, 2, (o) => {
          if ((o.k === Kind.Wisp || o.k === Kind.Bat) && !o.dead) fly++;
        });
        const v = fly + this.lit(k, Math.max(day, 0.5)) * 3;
        if (v > bv && !this.webs.some((w) => Math.abs(w.x - x * TILE) < 48 && Math.abs(w.y - y * TILE) < 48)) {
          bv = v;
          best = k;
        }
      }
      if (best >= 0) {
        c.tx = (best % m.w) * TILE + 8;
        c.ty = Math.floor(best / m.w) * TILE + 8;
        c.st = 1;
      } else {
        const j = DIR16[ih(c.id, this.step, 7) & 15];
        this.tryMove(c, j[0] * s.speed, j[1] * s.speed);
        c.act = 1;
      }
      return;
    }
    if (c.st === 1) {
      c.act = 1;
      if (this.goTo(c, c.tx, c.ty, s.speed)) {
        const web: Web = { id: this.nextId++, x: c.tx, y: c.ty, r: 18, owner: c.id, age: 0 };
        this.webs.push(web);
        c.ref = web.id;
        c.st = 2;
      }
      return;
    }
    // 巣で待ち、かかった獲物を食べる
    const web = this.webs.find((w) => w.id === c.ref);
    if (!web) {
      c.st = 0;
      return;
    }
    let prey: Cr | null = null;
    this.nearby(web.x, web.y, 2, (o) => {
      if (o.caught && o.ref === web.id && !o.dead) prey = o;
    });
    if (prey && c.food < s.cap * 0.7) {
      const p = prey as Cr;
      c.act = 1;
      if (this.moveToward(c, p.x, p.y, s.speed * 1.5)) this.eat(c, p);
    } else {
      if (this.moveToward(c, web.x, web.y, s.speed)) {
        if (c.act !== 2 || c.actT > 6) c.act = 0;
      } else c.act = 1;
    }
    if (c.sinceMeal > 2400) {
      web.owner = 0;
      c.st = 0;
      c.sinceMeal = 0;
    }
    if (c.food >= 60 && this.counts[Kind.Spider] < 14 && ih(c.id, this.step, 31) % 1500 === 0) {
      c.food -= 20;
      this.spawn(Kind.Spider, c.x, c.y, 20, 0);
    }
  }

  private updateWebs(): void {
    for (const web of this.webs) {
      web.age++;
      this.nearby(web.x, web.y, 2, (o) => {
        if (o.dead || o.caught || o.away) return;
        if (o.k !== Kind.Wisp && o.k !== Kind.Bat) return;
        if (sq(o.x - web.x) + sq(o.y - web.y) > web.r * web.r) return;
        const chance = o.k === Kind.Wisp ? 8 : 25;
        if (ih(o.id, this.step, 61) % chance === 0) {
          o.caught = true;
          o.ref = web.id;
          o.vx = 0;
          o.vy = 0;
        }
      });
    }
    this.webs = this.webs.filter((w) => w.owner !== 0 || w.age < 3000);
  }

  // ---------- スライム ----------
  private slime(c: Cr): void {
    // 水の精：生まれた水辺のまわり6マスを漂い、3マス以内に入った生きた者を冷たい水で打つ。飢えない
    if (c.elite === 6) {
      c.sinceMeal = 0;
      let foe: Cr | null = null;
      this.nearby(c.x, c.y, 3, (o) => {
        if (!foe && !o.dead && !o.away && o !== c && STR[o.k] >= 2 && ![Kind.Slime, Kind.Wisp, Kind.Ghost].includes(o.k) && sq(o.x - c.x) + sq(o.y - c.y) < 3 * TILE * 3 * TILE) foe = o;
      });
      if (foe) {
        c.act = 1;
        if (sq((foe as Cr).x - c.x) + sq((foe as Cr).y - c.y) < 16 * 16) this.fight(c, foe as Cr);
        else this.goTo(c, (foe as Cr).x, (foe as Cr).y, SPEC[Kind.Slime].speed * 1.5);
        return;
      }
      if (ih(c.id, this.step >> 5, 307) % 4 === 0) {
        const a = (ih(c.id, this.step >> 6, 308) % 628) / 100;
        c.act = 1;
        this.goTo(c, c.hx + Math.cos(a) * 4 * TILE, c.hy + Math.sin(a) * 3 * TILE, SPEC[Kind.Slime].speed);
      } else c.act = 0;
      return;
    }
    const s = SPEC[Kind.Slime];
    const k = this.tileOf(c.x, c.y);
    // 乾くと縮む。湿った方へ這う
    if (k >= 0 && this.w.moist[k] < 90) {
      if (this.step % 25 === c.id % 25) {
        c.body--;
        this.deposit(c.x, c.y, 1);
        if (c.body < 4) {
          this.die(c, 'dried');
          return;
        }
      }
      const m = this.w.map;
      let best = k;
      for (const n of [k + 1, k - 1, k + m.w, k - m.w]) if (n >= 0 && n < m.solid.length && !m.solid[n] && !m.lava[n] && this.w.moist[n] > this.w.moist[best]) best = n;
      if (best !== k) {
        this.moveToward(c, (best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, s.speed);
        c.act = 1;
        return;
      }
    }
    // 死骸の匂いをたどる
    let target: Cr | null = this.byId.get(c.ref) ?? null;
    if (!target || target.dead !== 1 || target.units <= 0) {
      target = null;
      let bd = 160 * 160;
      for (const o of this.corpses) {
        if (o.ref !== 0 && o.ref !== c.id) continue;
        const ok = this.tileOf(o.x, o.y);
        if (ok < 0 || this.w.moist[ok] < 60) continue;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          target = o;
        }
      }
      c.ref = target ? target.id : 0;
      if (target) target.ref = c.id;
    }
    if (target) {
      if (sq(target.x - c.x) + sq(target.y - c.y) < 7 * 7) {
        // 包み込んで溶かす
        const t = Math.min(2, target.units, s.cap - c.food);
        if (t > 0) {
          target.units -= t;
          c.food += t;
          c.sinceMeal = 0;
          c.act = 2;
          if (c.actT > 4) c.actT = 0;
          if (target.units <= 0) {
            target.dead = 2;
            c.ref = 0;
          }
        } else c.act = 0;
      } else {
        c.act = 1;
        this.goTo(c, target.x, target.y, s.speed);
      }
    } else {
      c.act = c.actT % 40 < 20 ? 0 : 1;
      if (c.act === 1) {
        const j = DIR16[ih(c.id, this.step >> 3, 52) & 15];
        this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
      }
    }
    // 育ったら二つに分かれる
    if (c.body + c.food >= 70 && c.food >= 30 && this.counts[Kind.Slime] < 40) {
      c.food -= 15;
      const ch = this.spawn(Kind.Slime, c.x + 6, c.y, 15, 0);
      ch.ref = 0;
      this.counts[Kind.Slime]++;
    }
    // 食べた分は体になる
    if (c.food > 20 && c.body < 40 && this.step % 20 === c.id % 20) {
      c.food--;
      c.body++;
    }
  }

  /** スライムの大きさの段階（0 小、1 中、2 大） */
  slimeSize(c: Cr): number {
    const m = c.body + c.food;
    return m < 20 ? 0 : m < 45 ? 1 : 2;
  }

  /** 水と養分の溜まった所からスライムが生まれる（死骸が多いほど生まれやすい） */
  private spawnSlimes(): void {
    const n = this.counts[Kind.Slime];
    if (n >= 40 || n > 3 + this.corpses.length) return;
    if (ih(this.step, 1, 53) % 3 !== 0) return;
    const m = this.w.map;
    // 腐ったもの（死骸）の近く（6マス以内）の、湿って養分の溜まった開いた床だけで生まれる
    const near = new Uint8Array(m.w * m.h);
    for (const d of this.corpses) {
      const cx = Math.floor(d.x / TILE);
      const cy = Math.floor(d.y / TILE);
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const x = cx + dx; const y = cy + dy; if (x >= 0 && y >= 0 && x < m.w && y < m.h) near[y * m.w + x] = 1; }
    }
    const cands: number[] = [];
    for (let k = 0; k < m.w * m.h; k++) if (near[k] && !m.solid[k] && !m.sealed[k] && !m.lava[k] && this.w.water[k] >= 30 && this.w.nutr[k] >= 30) cands.push(k);
    if (!cands.length) return;
    const k = cands[ih(this.step, 2, 54) % cands.length];
    this.w.nutr[k] -= 12;
    this.spawn(Kind.Slime, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 12, 0);
  }

  // ---------- ゾンビ ----------
  private zombie(c: Cr): void {
    const s = SPEC[Kind.Zombie];
    // 歩きながら腐り、養分を撒き散らす。体が尽きると崩れて骨になる
    if (this.step % 8 === c.id % 8 && c.body > 0) {
      c.body--;
      this.deposit(c.x, c.y, 1);
    }
    if (c.body <= Math.max(2, Math.floor(c.init * 0.3))) {
      c.k = c.sp;
      c.units = c.body;
      c.body = 0;
      c.dead = 1;
      c.act = 3;
      c.actT = 900;
      c.ref = 0;
      return;
    }
    // 近くの小さな生き物に噛みつく
    let prey: Cr | null = null;
    let bd = 40 * 40;
    this.nearby(c.x, c.y, 2, (o) => {
      if (o.dead || o.away || o.caught || (o.k !== Kind.Rat && !(o.k === Kind.Bat && o.st === 0))) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        prey = o;
      }
    });
    if (prey) {
      const p = prey as Cr;
      c.act = 1;
      if (this.moveToward(c, p.x, p.y, s.speed * 1.3) || sq(p.x - c.x) + sq(p.y - c.y) < 8 * 8) {
        this.die(p, 'killed', c.k);
        c.act = 2;
        c.actT = 0;
      }
      return;
    }
    if (c.act === 2 && c.actT < 4) return;
    c.act = 1;
    const j = DIR16[ih(c.id, this.step >> 4, 55) & 15];
    this.tryMove(c, j[0] * s.speed, j[1] * s.speed);
  }

  // ---------- ゴースト ----------
  private spawnGhosts(day: number): void {
    if (this.counts[Kind.Ghost] >= 3) return;
    const m = this.w.map;
    for (let i = 0; i < this.graveMap.length; i++) {
      // 死者の多い暗がり（墓：この地上の3日ほどの死）から、ゴーストが生まれる。冒険者の亡骸が多く眠る所では亡霊の騎士
      if (this.graveMap[i] < 600) continue;
      const cx = i % 24;
      const cy = Math.floor(i / 24);
      for (let tries = 0; tries < 12; tries++) {
        const h = ih(this.step, i, 56 + tries);
        const x = cx * 8 + (h % 8);
        const y = cy * 8 + ((h >>> 8) % 8);
        if (x >= m.w || y >= m.h) continue;
        const k = y * m.w + x;
        // ゴーストは死者の多さから生まれる（マナがあれば少し使う）
        if (m.solid[k] || m.lava[k] || this.lit(k, day) > 0.2) continue;
        const g = this.spawn(Kind.Ghost, x * TILE + 8, y * TILE + 8, 0, 0);
        this.takeMana(g, k, 20);
        g.st = 0;
        this.graveMap[i] -= 500;
        if (this.advGrave[i] >= 300 && this.manaAround(k) >= 6 && !this.list.some((o) => o.elite === 2 && !o.dead)) {
          g.elite = 2;
          g.hx = g.x;
          g.hy = g.y;
          this.advGrave[i] -= 300;
          this.nameOf(g);
          this.log(g.x, g.y, `冒険者の亡骸が眠る暗がりから、亡霊の騎士「${this.names.get(g.id)}」が立ち上がった`);
        }
        return;
      }
    }
  }

  private ghost(c: Cr, day: number): void {
    // 亡霊の騎士：眠る亡骸の墓（生まれた所）のまわり5マスを見回り、4マス以内に入った生きた者に斬りかかる
    if (c.elite === 2) {
      let foe: Cr | null = null;
      let bd = 4 * TILE * 4 * TILE;
      this.nearby(c.x, c.y, 4, (o) => {
        if (o.dead || o.away || [Kind.Ghost, Kind.Zombie, Kind.Skeleton, Kind.Lich, Kind.Wisp, Kind.Golem, Kind.Gargoyle].includes(o.k) || STR[o.k] < 2) return;
        if (sq(o.hx - c.hx) + sq(o.hy - c.hy) > 9 * TILE * 9 * TILE && sq(o.x - c.hx) + sq(o.y - c.hy) > 6 * TILE * 6 * TILE) return;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          foe = o;
        }
      });
      if (foe) {
        const f = foe as Cr;
        this.markNotice(c, f, '!');
        c.act = 1;
        if (bd < 16 * 16) this.fight(c, f);
        else this.goTo(c, f.x, f.y, SPEC[Kind.Ghost].speed * 1.2);
        return;
      }
      if (sq(c.x - c.hx) + sq(c.y - c.hy) > 5 * TILE * 5 * TILE || ih(c.id, this.step, 302) % 90 === 0) {
        const a = (ih(c.id, this.step >> 6, 303) % 628) / 100;
        c.act = 1;
        this.goTo(c, c.hx + Math.cos(a) * 3 * TILE, c.hy + Math.sin(a) * 2 * TILE, SPEC[Kind.Ghost].speed * 0.6);
      }
      return;
    }
    const s = SPEC[Kind.Ghost];
    if (c.actT > 2500) {
      this.die(c, 'faded');
      return;
    }
    // 光を嫌い、暗い方へ漂う
    const m = this.w.map;
    const k = this.tileOf(c.x, c.y);
    let best = k;
    let bl = this.lit(k, day);
    for (const n of [k + 1, k - 1, k + m.w, k - m.w]) {
      if (n < 0 || n >= m.solid.length || m.solid[n]) continue;
      const l = this.lit(n, day);
      if (l < bl - 0.02) {
        bl = l;
        best = n;
      }
    }
    const j = DIR16[ih(c.id, this.step >> 3, 57) & 15];
    let mx = j[0] * s.speed * 0.6;
    let my = j[1] * s.speed * 0.6;
    if (best !== k) {
      mx += (((best % m.w) * TILE + 8 - c.x) / 16) * s.speed;
      my += ((Math.floor(best / m.w) * TILE + 8 - c.y) / 16) * s.speed;
    }
    this.tryMove(c, mx, my);
    // 近くの松明を吹き消す
    if (this.step % 20 === c.id % 20) {
      this.nearby(c.x, c.y, 2, (o) => {
        if (o.dead || o.torch <= 0 || sq(o.x - c.x) + sq(o.y - c.y) > 30 * 30) return;
        if (ih(c.id, o.id ^ this.step, 142) % 3 !== 0) return;
        if (o.k === Kind.Adventurer) o.torch = 1;
        else o.torch = -1;
      });
    }
    // 近くの生き物を怯えさせる
    let near = false;
    this.nearby(c.x, c.y, 2, (o) => {
      if (!o.dead && o.k !== Kind.Ghost && o.k !== Kind.Zombie && o.k !== Kind.Slime && sq(o.x - c.x) + sq(o.y - c.y) < 34 * 34) near = true;
    });
    if (near) {
      if (c.act !== 2 || c.actT > 6) {
        c.act = 2;
        c.actT = 0;
      }
    } else if (c.act !== 2 || c.actT > 6) c.act = 1;
  }

  /** 手なずけられた大トカゲは、腹が満ちているあいだリザードマンのそばを付いて歩く */
  private followOwner(c: Cr): boolean {
    if (!c.ref2 || c.hungry) return false;
    const o = this.byId.get(c.ref2);
    if (!o || o.dead || o.k !== Kind.Lizardman) {
      c.ref2 = 0;
      return false;
    }
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < 28 * 28) {
      c.act = 0;
      return true;
    }
    c.act = 1;
    this.goTo(c, o.x, o.y, SPEC[Kind.Lizard].speed);
    return true;
  }

  // ---------- 強さと戦い、飢えて去ること ----------

  /** 攻める側の勝つ確率は、近くの仲間を含めた強さの比で決まる。負けた側は死ぬことがある */
  /** 強さ：冒険者は職業と一行の格で決まる */
  private str(c: Cr): number {
    if (c.k === Kind.Adventurer) return JOB_STR[c.sp] * TIER_MUL[c.init] * (c.sp === Job.Thief && c.act === 2 ? 1.6 : 1);
    // スケルトンは生前の装備で強さが決まる。武器を拾ったゴブリンとオークは強くなる
    if (c.k === Kind.Skeleton) return c.init ? JOB_STR[c.sp] * 1.2 : 3;
    if (c.k === Kind.Dwarf) return DWARF_STR[c.sp];
    if ((c.k === Kind.Goblin || c.k === Kind.Orc) && c.party) return STR[c.k] * 1.6;
    // 特別な個体
    if (c.elite === 1) return 12;
    if (c.elite === 2) return 10;
    if (c.elite === 6) return 8;
    if (c.elite === 7) return 3;
    if (c.elite === 8) return STR[Kind.Dragon] * 0.8;
    if (c.elite === 9) return 9;
    if (c.elite === 4) return STR[c.k] * 3;
    if (c.elite === 5) return STR[c.k] * 2.5;
    // ドラゴンは育ち具合で強さが変わる（幼竜、若い竜、成竜）
    if (c.k === Kind.Dragon) return STR[c.k] * [0.25, 0.6, 1][Math.min(2, c.sp)];
    return STR[c.k];
  }

  /** 縄張りの中に敵が来たら追い払う（戦う） */
  private defend(c: Cr, hx: number, hy: number, enemies: Kind[]): boolean {
    if (sq(c.x - hx) + sq(c.y - hy) > 12 * TILE * 12 * TILE) return false;
    let foe: Cr | null = null;
    let bd = 3 * TILE * 3 * TILE;
    this.nearby(c.x, c.y, 3, (o) => {
      if (o.dead || o.away || !enemies.includes(o.k) || !this.canSense(c, o)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        foe = o;
      }
    });
    if (!foe) return false;
    const f = foe as Cr;
    c.act = 1;
    if (sq(f.x - c.x) + sq(f.y - c.y) < 11 * 11) this.fight(c, f);
    else this.goTo(c, f.x, f.y, SPEC[c.k].speed * 1.2);
    return true;
  }

  /** 食べ物にありつけないまま長く経った大物は、入口から出ていく */
  private leaveIfStarving(c: Cr): boolean {
    const s = SPEC[c.k];
    if (c.st !== 9 && c.sinceMeal < s.starve * 0.6) return false;
    c.st = 9;
    c.act = 1;
    const m = this.w.map;
    // 出ていく口：人（ドワーフなど）は正面の入口。野の生き物は、自分の種に合う開いた自然の口のうちいちばん近いもの。
    // 野の生き物に開いた口がなければ、出ていけずに中で飢える
    const people = c.k === Kind.Dwarf || c.k === Kind.Adventurer;
    let ex = people ? m.entrance.x * TILE + 16 : -1;
    let ey = TILE + 8;
    if (!people) {
      const want = c.k === Kind.Basilisk || c.k === Kind.Minotaur ? 1 : c.k === Kind.Lizardman ? 2 : 0;
      let bd = 1e18;
      for (let i = 0; i < m.mouths.length; i++) {
        if (m.mouths[i].kind !== want || !this.mouthOpen(i)) continue;
        const [mx, my] = this.mouthSpot(i);
        const d = sq(mx - c.x) + sq(my - c.y);
        if (d < bd) {
          bd = d;
          ex = mx;
          ey = my;
        }
      }
      if (ex < 0) {
        c.st = c.st === 9 ? 0 : c.st;
        return false;
      }
    }
    if (this.goTo(c, ex, ey, s.speed) || sq(ex - c.x) + sq(ey - c.y) < 30 * 30) {
      this.record('exits', { t: this.w.tick, k: c.k, reason: 'starving', x: Math.round(c.x), y: Math.round(c.y) } as never);
      this.w.manaLeaked += c.mana;
      c.mana = 0;
      this.exported += c.body + c.food + c.units;
      if (c.gold > 0) {
        this.goldOut += c.gold;
        c.gold = 0;
      }
      if (c.k === Kind.Dwarf) {
        // 生きて外へ出たドワーフが、ゴーレムの話を伝える
        if (this.hold?.golem) this.dwarfLore |= 1;
        this.log(c.x, c.y, `{k:${Kind.Dwarf}}が住みかを捨てて外へ出ていった`);
      }
      c.body = 0;
      c.food = 0;
      c.units = 0;
      this.w.manaLeaked += c.mana;
      c.mana = 0;
      c.dead = 2;
    }
    return true;
  }

  private hunt(c: Cr, R: number, kinds: Kind[], speed: number): boolean {
    let prey: Cr | null = null;
    let bd = R * TILE * R * TILE;
    const tier = TIER[c.k] ?? 1;
    const me = this.str(c);
    this.nearby(c.x, c.y, R, (o) => {
      if (o.dead || o.away || o.caught || !kinds.includes(o.k) || o.k === Kind.Dragon) return;
      if (o.k === Kind.Bat && o.st !== 0) return;
      // 気づけない相手と、（火を怖がる者にとって）火のそばの獲物は狙わない
      if (!this.canSense(c, o)) return;
      // ゴブリンはコボルトの縄張りの中の獲物を追わない
      if (c.k === Kind.Goblin && this.inKoboldLand(o.x, o.y)) return;
      if (Ecology.FEARS_FIRE.has(c.k) && c.sinceMeal < SPEC[c.k].starve * 0.85 && this.fireNear(o.x, o.y)) return;
      // 知性ある者は勝てない相手を避け、狡猾な者は自分より強い相手には挑まない
      const ts = this.str(o) * (o.hp > 0 ? o.hp / this.maxHp(o) : 1);
      if (tier >= 3 && ts > me * 1.1) return;
      if (tier === 2 && ts > me * 1.6) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        prey = o;
      }
    });
    if (!prey) return false;
    const p = prey as Cr;
    this.markNotice(c, p, '!');
    c.act = 1;
    const d2 = sq(p.x - c.x) + sq(p.y - c.y);
    if (d2 < 11 * 11) {
      if (STR[p.k] * 2 < STR[c.k]) this.eat(c, p);
      else this.fight(c, p);
    } else if (c.k === Kind.Minotaur && d2 > 2 * TILE * 2 * TILE) {
      // 一直線に突進し、壁にぶつかると一瞬よろめく
      const x0 = c.x;
      const y0 = c.y;
      this.moveToward(c, p.x, p.y, speed * 1.8);
      if (Math.abs(c.x - x0) + Math.abs(c.y - y0) < speed * 0.5) c.gait = 14;
    } else if (TIER[c.k] === 2 && d2 > 2 * TILE * 2 * TILE) {
      // 狡猾な種は、仲間がいれば回り込んで別々の方向から近づく
      let allies = 0;
      this.nearby(c.x, c.y, 4, (o) => {
        if (o !== c && !o.dead && o.k === c.k) allies++;
      });
      if (allies) {
        const a = ((c.id * 2.3999) % 6.283) - 3.14;
        const r = Math.min(Math.sqrt(d2) * 0.6, 2.5 * TILE);
        this.goTo(c, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, speed);
      } else this.goTo(c, p.x, p.y, speed);
    } else this.goTo(c, p.x, p.y, speed);
    return true;
  }

  // ---------- ゴブリン ----------
  /**
   * ゴブリンの集落の場所：暗く、人の気配が薄く、冒険者の通り道（気配の濃いマス）から歩いて15マス以上（40マスまでが望ましい：
   * 灯りを見張って盗みや待ち伏せに出られる近さ）。竜の寝床から30、トロールとバジリスクから15、コボルトの住処から10、
   * ほかの集落から30マス離れ、まわりにネズミとキノコ（食べ物）があり、出発点から歩いて行ける所。
   * minFood を指定すれば、まわり8マスの食べ物（warrenFood）がそれに満たない所は選ばない
   */
  static GOBLIN_MIN_FOOD = 1800;
  /**
   * 集落の候補のまわりの食べ物。ゴブリンは狩りと死骸あさりで広く動くので、コボルト（8マス）より広く数える：
   * 14マス以内の食べられる苔とキノコ（20以上の群落の、根元12を除いた分）の半分、16マス以内のネズミ1匹あたり100、死骸の残り
   */
  private campFood(k: number): number {
    const m = this.w.map;
    const x0 = k % m.w;
    const y0 = Math.floor(k / m.w);
    let f = 0;
    for (let y = Math.max(1, y0 - 14); y <= Math.min(m.h - 2, y0 + 14); y++)
      for (let x = Math.max(1, x0 - 14); x <= Math.min(m.w - 2, x0 + 14); x++) {
        const q = y * m.w + x;
        if (m.solid[q] || m.sealed[q]) continue;
        const v = Math.max(this.w.moss[q], this.w.fungus[q]);
        if (v >= 20) f += (v - 12) >> 1;
      }
    this.nearby(x0 * TILE + 8, y0 * TILE + 8, 16, (o) => {
      if (o.k === Kind.Rat && !o.dead) f += 100;
      else if (o.dead === 1 && o.units > 0) f += o.units;
    });
    return f;
  }
  private pickGoblinCamp(avoid?: Camp, from?: [number, number], minFood = 0): number {
    const m = this.w.map;
    let best = -1;
    let bv = -1e9;
    const par = from ? new Int32Array(m.w * m.h) : null;
    const dist = from ? this.walkDist(this.tileOf(from[0], from[1]), 100, par as Int32Array) : null;
    const reach: number[] = [];
    if (dist) for (let q = 0; q < dist.length; q++) if (dist[q] >= 0) reach.push(q);
    if (dist && !reach.length) return -1;
    const route = this.routeDist(45);
    const danger: [number, number, number][] = [];
    for (const o of this.list) {
      if (o.dead || o.away) continue;
      if (o.k === Kind.Dragon) danger.push([o.hx || o.x, o.hy || o.y, 30]);
      else if (o.k === Kind.Troll || o.k === Kind.Basilisk) danger.push([o.hx || o.x, o.hy || o.y, 15]);
    }
    if (this.dragonShell) danger.push([this.dragonShell.x, this.dragonShell.y, 30]);
    // 安く調べられる条件で先に絞り、残った候補から選ぶ（条件を満たす所が少なくても取りこぼさないように）
    const cand: number[] = [];
    const pool = dist ? reach.length : 2000;
    for (let i = 0; i < pool; i++) {
      const k = dist ? reach[i] : ih(this.step, i, 90) % (m.w * m.h);
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.lightBase[k] > 60 || m.maze[k]) continue;
      const x = k % m.w;
      const y = Math.floor(k / m.w);
      if (Math.abs(x - m.entrance.x) + y < 15) continue;
      // 通り道から15マスより近い所には住まない（40マスより遠い所は点を下げる）
      if (route[k] >= 0 && route[k] < 15) continue;
      // コボルトの住処から15マス（コボルトが住処を守る範囲12マスの外に集落の真ん中を置く。10マスでは集落ごと縄張りの中に入り、群れで食べられていた）
      if (this.warrens.some((o) => o.id >= 0 && Math.abs(o.x / TILE - x) + Math.abs(o.y / TILE - y) < 15)) continue;
      if (this.camps.some((o) => o.id >= 0 && o !== avoid && Math.abs(o.x / TILE - x) + Math.abs(o.y / TILE - y) < 30)) continue;
      if (avoid && Math.abs(avoid.x / TILE - x) + Math.abs(avoid.y / TILE - y) < 20) continue;
      const px = x * TILE + 8;
      const py = y * TILE + 8;
      if (danger.some(([dx, dy, r]) => sq(dx - px) + sq(dy - py) < r * TILE * r * TILE)) continue;
      if (this.presenceAt(px, py) > 0.5) continue;
      cand.push(k);
    }
    if (!cand.length) return -1;
    for (let i = 0; i < Math.min(160, cand.length); i++) {
      const k = cand.length <= 160 ? cand[i] : cand[ih(this.step, i, 91) % cand.length];
      const x = k % m.w;
      const y = Math.floor(k / m.w);
      const px = x * TILE + 8;
      const py = y * TILE + 8;
      const rd = route[k];
      if (minFood > 0 && this.campFood(k) < minFood) continue;
      const pres = this.presenceAt(px, py);
      // 出発点からの道筋の人の気配（コボルトと同じ）
      let busy = 0;
      if (par) for (let q = k, n = 0; q >= 0 && n < 200; q = par[q], n++) if (this.presenceAt((q % m.w) * TILE + 8, Math.floor(q / m.w) * TILE + 8) > 0.5) busy++;
      let f = 0;
      for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) f += this.w.fungus[yy * m.w + xx] + (this.w.moss[yy * m.w + xx] >> 2);
      }
      let rats = 0;
      this.nearby(px, py, 10, (o) => {
        if (!o.dead && o.k === Kind.Rat) rats++;
      });
      const v = f + rats * 80 - pres * 1500 - busy * 60 - (rd < 0 || rd > 40 ? 400 : 0) - this.w.lightBase[k] * 4 + (ih(k, 2, 90) % 200);
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    return best;
  }

  /** 冒険者の通り道（人の気配が0.5より濃い区画の床）から歩いた道のり（max マスまで。届かなければ -1） */
  private routeDist(max: number): Int32Array {
    const m = this.w.map;
    const N = m.w * m.h;
    const dist = new Int32Array(N).fill(-1);
    if (this.wdQ.length !== N) this.wdQ = new Int32Array(N);
    const q = this.wdQ;
    let h = 0;
    let t = 0;
    for (let k = 0; k < N; k++) {
      if (m.solid[k] || m.lava[k] || m.sealed[k]) continue;
      if (this.presenceAt((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8) > 0.5) {
        dist[k] = 0;
        q[t++] = k;
      }
    }
    while (h < t) {
      const c = q[h++];
      if (dist[c] >= max) continue;
      for (let d = 0; d < 4; d++) {
        const n = d === 0 ? c + 1 : d === 1 ? c - 1 : d === 2 ? c + m.w : c - m.w;
        if (n < 0 || n >= N || dist[n] >= 0 || m.solid[n] || m.lava[n] || m.sealed[n]) continue;
        dist[n] = dist[c] + 1;
        q[t++] = n;
      }
    }
    return dist;
  }

  /** 口ごとに、そこからゴブリンが来られるか（コボルトの kobMouthOk と同じ。地上の約2時間ごとに調べ直し、保存する） */
  gobMouthOk: number[] = [];
  private checkGoblinMouths(): void {
    const m = this.w.map;
    this.gobMouthOk = m.mouths.map((mo, i) => (mo.kind === 0 && this.mouthOpen(i) && !this.dragonNearMouth(i) && this.pickGoblinCamp(undefined, this.mouthSpot(i), Ecology.GOBLIN_MIN_FOOD) >= 0 ? 1 : 0));
  }

  private newCamp(k: number, how: string): Camp {
    const m = this.w.map;
    const x = (k % m.w) * TILE + 8;
    const y = Math.floor(k / m.w) * TILE + 8;
    this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: this.nextId, ev: 'found', how, x, y } as never);
    const cp: Camp = { id: this.nextId++, kind: 0, x, y, dry: 0, fuel: 0, store: 0, hide: 0, raids: 0, empty: -1, alone: -1 };
    this.camps.push(cp);
    return cp;
  }

  /** 集落の仲間（去っていく途中の者は除く） */
  private campMembers(cp: Camp): Cr[] {
    return this.list.filter((c) => c.k === Kind.Goblin && !c.dead && c.ref === cp.id && c.st !== 9 && c.st !== 10);
  }

  /** 集落にゴブリンの頭がいるか */
  private campChief(cp: Camp): boolean {
    return this.list.some((c) => c.k === Kind.Goblin && c.elite === 5 && !c.dead && c.ref === cp.id);
  }

  /** 蓄えの目安（群れの数に応じて） */
  private campStoreGoal(cp: Camp): number {
    return Math.min(300, 30 * Math.max(2, this.campMembers(cp).length));
  }

  /** 散って隠れているゴブリン（集落のまわりの暗がりで身をひそめている。灯りに照らされず、すぐそばまで来られない限り、誰にも気づかれない） */
  private goblinHidden(o: Cr): boolean {
    if (o.dead || o.st !== 7) return false;
    const cp = this.campOf(o);
    if (!cp || cp.kind !== 0 || cp.hide !== 1) return false;
    if (sq(o.x - cp.x) + sq(o.y - cp.y) > 9 * TILE * 9 * TILE) return false;
    return !this.isLit(o);
  }

  /** 隠れ場所：集落から4〜7マスの、暗い床（ひとりずつ違う所。見つからなければ集落の真ん中） */
  private hideSpot(cp: Camp, c: Cr): [number, number] {
    const m = this.w.map;
    for (let i = 0; i < 8; i++) {
      const a = ((c.id * 2.399 + i * 0.785) % 6.283);
      const r = 4 + ((c.id + i) % 4);
      const x = Math.floor(cp.x / TILE + Math.cos(a) * r);
      const y = Math.floor(cp.y / TILE + Math.sin(a) * r);
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.lava[k] || m.sealed[k] || this.w.water[k] > 20 || this.w.lightBase[k] > 40) continue;
      return [x * TILE + 8, y * TILE + 8];
    }
    return [cp.x, cp.y];
  }

  /**
   * 集落を捨てる（群れの出来事）。開いた地表の横穴があれば群れごと外へ去り、なければ中の別の場所へ移る。
   * reason：0 蓄えが尽きた、1 何度も襲われた、2 数が減った、3 竜が近くに住みついた
   */
  private abandonCamp(cp: Camp, reason: number): boolean {
    const m = this.w.map;
    const members = this.campMembers(cp);
    const why = ['蓄えが尽きて', '何度も襲われて', '1匹になって', '竜を恐れて'][reason];
    const open = m.mouths.some((mo, i) => mo.kind === 0 && this.mouthOpen(i));
    const rec = (to: string) => this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'abandon', reason: ['food', 'raids', 'alone', 'dragon'][reason], to, n: members.length, x: Math.round(cp.x), y: Math.round(cp.y) } as never);
    if (reason === 1 || reason === 3) this.goblinShun = Math.max(this.goblinShun, this.w.tick + DAY_TICKS_ECO * 2);
    if (!open) {
      const site = this.pickGoblinCamp(cp, [cp.x, cp.y], Ecology.GOBLIN_MIN_FOOD);
      if (site < 0) return false;
      rec('move');
      const nc = this.newCamp(site, 'move');
      nc.store = cp.store ?? 0;
      cp.store = 0;
      for (const c of members) {
        c.ref = nc.id;
        c.st = 0;
      }
      this.log(nc.x, nc.y, `{k:${Kind.Goblin}}の一団が${why}集落を捨て、別の場所へ移った`);
    } else {
      let st = cp.store ?? 0;
      for (const c of members) {
        const t = Math.min(st, SPEC[Kind.Goblin].cap - c.food);
        c.food += t;
        st -= t;
        c.st = 10;
        c.ref = 0;
        c.flee = 0;
        c.lure = 0;
      }
      this.deposit(cp.x, cp.y, st);
      cp.store = 0;
      rec('leave');
      this.log(cp.x, cp.y, `{k:${Kind.Goblin}}の一団が${why}集落を捨てて去った`);
    }
    if ((cp.fuel ?? 0) > 0) this.deposit(cp.x, cp.y + 10, cp.fuel as number);
    cp.fuel = 0;
    cp.id = -1;
    return true;
  }

  /**
   * 集落の見張り（10刻みごと）：冒険者の一行、若い竜と成竜、トロール、ミノタウロスが近づくと、
   * 群れより明らかに強ければ暗がりに散って隠れ（hide 1）、一行が弱ければ暗がりで待ち伏せる（hide 2）。
   * 隠れているのを見つかったり、待ち伏せで負けそうになったら、皆で深い方へ逃げ散る（一行が去れば戻る）
   */
  private watchCamps(): void {
    for (const cp of this.camps) {
      if (cp.id < 0 || cp.kind !== 0) continue;
      let near: Cr | null = null;
      let nd = 1e18;
      let threat = 0;
      let party = false;
      for (const p of this.parties)
        for (const id of p.members) {
          const a = this.byId.get(id);
          if (!a || a.dead || a.away) continue;
          const d = sq(a.x - cp.x) + sq(a.y - cp.y);
          if (d < nd) {
            nd = d;
            near = a;
            threat = this.partyStr(p);
            party = true;
          }
        }
      this.nearby(cp.x, cp.y, 14, (o) => {
        if (o.dead || o.away || !((o.k === Kind.Dragon && o.sp >= 1) || o.k === Kind.Troll || o.k === Kind.Minotaur)) return;
        const d = sq(o.x - cp.x) + sq(o.y - cp.y);
        if (d < nd) {
          nd = d;
          near = o;
          threat = this.str(o);
          party = false;
        }
      });
      if (!near || nd > 18 * TILE * 18 * TILE) {
        cp.hide = 0;
        continue;
      }
      const a = near as Cr;
      const members = this.campMembers(cp);
      const mine = members.reduce((s, c) => s + (c.flee > 0 ? 0 : this.str(c)), 0);
      const bold = this.campChief(cp);
      // 待ち伏せのさなかに負けそうになったら、皆で逃げ散る
      if (cp.hide === 2 && threat > mine * (bold ? 2 : 1.5)) {
        this.scatterCamp(cp, members, a, `待ち伏せていた{k:${Kind.Goblin}}たちが劣勢になり、奥へ逃げ散った`);
        continue;
      }
      if (cp.hide === 1) {
        const found = members.some((c) => c.st === 7 && this.goblinHidden(c) === false && sq(c.x - cp.x) + sq(c.y - cp.y) < 9 * TILE * 9 * TILE && sq(c.x - a.x) + sq(c.y - a.y) < 3 * TILE * 3 * TILE) || members.some((c) => c.st === 7 && this.goblinHidden(c) && this.atDoorOf(a, c));
        if (found) this.scatterCamp(cp, members, a, `隠れていた{k:${Kind.Goblin}}たちが見つかり、奥へ逃げ散った`);
        continue;
      }
      if (nd > 13 * TILE * 13 * TILE) continue;
      if (threat > mine * (bold ? 2 : 1.5)) {
        cp.hide = 1;
        if (this.step - (this.lastLogged[989] ?? -99999) > 3000) {
          this.lastLogged[989] = this.step;
          this.log(cp.x, cp.y, a.k === Kind.Adventurer ? `{k:${Kind.Goblin}}たちが冒険者の気配に、集落のまわりの暗がりへ散って隠れた` : `{k:${Kind.Goblin}}たちが{k:${a.k}}の気配に、暗がりへ散って隠れた`);
        }
      } else if (party && cp.hide !== 2 && threat <= mine * (bold ? 1.3 : 1)) {
        // 一行が弱ければ、灯りのまわりの暗がりに潜んで、集落に踏み込むのを待つ
        cp.hide = 2;
        for (const c of members) {
          if (c.flee > 0 || c.sleep > 0 || c.st === 7) continue;
          c.lure = a.id;
          c.lureAt = this.step;
        }
        if (this.step - (this.lastLogged[988] ?? -99999) > 3000) {
          this.lastLogged[988] = this.step;
          this.log(cp.x, cp.y, `{k:${Kind.Goblin}}たちが、近づく冒険者を暗がりで待ち伏せている`);
        }
      }
    }
  }

  /** 集落の皆が、相手から離れる方（深い方）へ逃げ散る。近ごろ襲われた回数に数える */
  private scatterCamp(cp: Camp, members: Cr[], a: Cr, msg: string): void {
    cp.hide = 0;
    cp.raids = (cp.raids ?? 0) + 1;
    for (const c of members) {
      c.st = 0;
      c.lure = 0;
      c.flee = 150 + (ih(c.id, this.step, 233) % 60);
      c.foe = a.id;
      c.hx = 0;
      c.hy = 0;
    }
    this.log(cp.x, cp.y, msg);
  }

  /** コボルトの住処の縄張り（住処から12マス、コボルトが住処を守る範囲）の中か。ゴブリンは食べ物を探すとき、ここを目当てにしない */
  inKoboldLand(x: number, y: number): boolean {
    for (const wr of this.warrens) if (wr.id >= 0 && sq(wr.x - x) + sq(wr.y - y) < 12 * TILE * 12 * TILE) return true;
    return false;
  }

  /** ゴブリンの死骸あさり：R マス以内の死骸（コボルトの縄張りの外）へ行き、その場で食べ、余りを持つ（eat の食べ残し units）。true なら今そうしている */
  private goblinCarrion(c: Cr, R: number): boolean {
    let best: Cr | null = null;
    let bd = R * TILE * R * TILE;
    for (const o of this.corpses) {
      if (o.dead !== 1 || o.units <= 0 || o.k === Kind.Goblin) continue;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d >= bd || this.inKoboldLand(o.x, o.y) || this.fireNear(o.x, o.y)) continue;
      bd = d;
      best = o;
    }
    if (!best) return false;
    const o = best as Cr;
    c.act = 1;
    if (bd < 11 * 11) {
      this.eat(c, o);
      c.act = 2;
      c.actT = 0;
    } else this.goTo(c, o.x, o.y, SPEC[c.k].speed);
    return true;
  }

  /** 集落のまわり（R マス四方）で、ゴブリン c がいちばん行きやすい、食べられる苔かキノコ（20以上）のマス。なければ -1 */
  private goblinForage(c: Cr, cx: number, cy: number, R: number): number {
    const m = this.w.map;
    const x0 = Math.floor(cx / TILE);
    const y0 = Math.floor(cy / TILE);
    const gx = c.x / TILE;
    const gy = c.y / TILE;
    let best = -1;
    let bv = -1e9;
    for (let y = Math.max(1, y0 - R); y <= Math.min(m.h - 2, y0 + R); y++)
      for (let x = Math.max(1, x0 - R); x <= Math.min(m.w - 2, x0 + R); x++) {
        const k = y * m.w + x;
        if (m.solid[k] || m.lava[k] || m.sealed[k]) continue;
        const f = Math.max(this.w.moss[k], this.w.fungus[k]);
        if (f < 20 || this.inKoboldLand(x * TILE + 8, y * TILE + 8)) continue;
        const v = Math.min(30, f - 12) - (Math.abs(x - gx) + Math.abs(y - gy)) * 4;
        if (v > bv) {
          bv = v;
          best = k;
        }
      }
    return best;
  }

  private campOf(c: Cr): Camp | undefined {
    return this.camps.find((o) => o.id === c.ref);
  }

  private goblin(c: Cr): void {
    const s = SPEC[Kind.Goblin];
    if (c.st === 10) {
      this.leaveWithGroup(c);
      return;
    }
    const camp = this.campOf(c);
    // 集落のある者は一匹で見切りをつけない（集落ごと捨てるのは群れの出来事：updateCamps）。集落のない者だけが飢えて去る
    if (!camp && this.leaveIfStarving(c)) return;
    if (c.act === 2 && c.actT < 4) return;
    if (camp) {
      // 散って隠れる：集落のまわりの暗がりで身をひそめる（蓄えから食べる。蓄えが尽きて飢えれば、こっそり食べ物を探しに出る）
      const d2 = sq(camp.x - c.x) + sq(camp.y - c.y);
      if (camp.hide === 1 && c.hungry && (camp.store ?? 0) > 0 && d2 < 10 * TILE * 10 * TILE) {
        const t = Math.min(camp.store ?? 0, Math.floor(s.cap * 0.7) - c.food);
        camp.store = (camp.store ?? 0) - t;
        c.food += t;
        c.hungry = 0;
        c.sinceMeal = 0;
      }
      if (camp.hide === 1 && !(c.hungry > 300 && (camp.store ?? 0) <= 0) && (c.st === 7 || d2 < 10 * TILE * 10 * TILE)) {
        c.st = 7;
        const [hx, hy] = this.hideSpot(camp, c);
        if (sq(hx - c.x) + sq(hy - c.y) > 0.6 * TILE * 0.6 * TILE) {
          c.act = 1;
          this.goTo(c, hx, hy, s.speed * 1.2);
        } else c.act = 0;
        return;
      }
      if (c.st === 7) c.st = 0;
      // 腹を空かせた者は、集落の蓄えから食べる
      if ((camp.store ?? 0) > 0 && (c.hungry || c.food < s.cap * 0.15)) {
        if (d2 < 2 * TILE * 2 * TILE) {
          const t = Math.min(camp.store ?? 0, Math.floor(s.cap * 0.7) - c.food);
          if (t > 0) {
            camp.store = (camp.store ?? 0) - t;
            c.food += t;
            c.hungry = 0;
            c.sinceMeal = 0;
            c.act = 2;
            c.actT = 0;
            c.st = 0;
            return;
          }
        } else if (d2 < 30 * TILE * 30 * TILE) {
          c.act = 1;
          this.goTo(c, camp.x, camp.y, s.speed);
          return;
        }
      }
      // 蓄えを運び込む：腹が満ちた者（狩った獲物、拾った死骸、盗んだ食料）は、余りと持ち帰った食べ残しを集落に置く
      if ((c.food > s.cap * 0.75 || c.units > 0) && d2 < 2 * TILE * 2 * TILE && (camp.store ?? 0) < this.campStoreGoal(camp)) {
        const t = Math.max(0, c.food - Math.floor(s.cap * 0.5)) + c.units;
        c.food -= t - c.units;
        c.units = 0;
        camp.store = (camp.store ?? 0) + t;
        c.act = 2;
        c.actT = 0;
        if (c.st === 4) c.st = 0;
        return;
      }
      // 腹いっぱいの者と、食べ残しを持っている者は、蓄えが足りなければ集落へ持ち帰る
      if ((c.food > s.cap * 0.75 || (c.units >= 6 && c.st !== 4) || c.units >= 20) && d2 < 30 * TILE * 30 * TILE && (camp.store ?? 0) < this.campStoreGoal(camp) && c.gold <= 0) {
        c.act = 1;
        this.goTo(c, camp.x, camp.y, s.speed);
        return;
      }
      // 食べ物を集めに出る：蓄えが足りなければ、何匹かが交代で狩りと死骸あさりに出て、腹いっぱいにして帰る
      if (c.st === 0 && !c.hungry && c.units === 0 && (camp.store ?? 0) < this.campStoreGoal(camp) && ih(c.id, this.step >> 7, 77) % 3 === 0) c.st = 4;
    }
    if ((!c.hungry || c.st === 4) && this.scavenge(c)) return;
    // 見つけた金貨を集落へ持ち帰って山にする
    if (camp && !c.hungry && c.st !== 4) {
      if (c.gold > 0) {
        c.act = 1;
        if (sq(camp.x - c.x) + sq(camp.y - c.y) < 18 * 18 || this.goTo(c, camp.x + 12, camp.y + 8, s.speed)) {
          this.dropGold(camp.x + 12, camp.y + 8, c.gold);
          c.gold = 0;
        }
        return;
      }
      if (this.step % 20 === c.id % 20) {
        const m = this.w.map;
        const pile = this.piles.find((p) => sq(p.x - c.x) + sq(p.y - c.y) < 5 * TILE * 5 * TILE && !m.vault[this.tileOf(p.x, p.y)] && sq(p.x - camp.x - 12) + sq(p.y - camp.y - 8) > 30 * 30);
        if (pile) c.ref2 = -pile.id;
      }
      if (c.ref2 < 0) {
        const pile = this.piles.find((p) => p.id === -c.ref2);
        if (!pile) c.ref2 = 0;
        else {
          c.act = 1;
          if (sq(pile.x - c.x) + sq(pile.y - c.y) < 12 * 12) {
            const t = Math.min(10, pile.gold);
            pile.gold -= t;
            c.gold += t;
            c.ref2 = 0;
            this.piles = this.piles.filter((o) => o.gold > 0);
          } else this.goTo(c, pile.x, pile.y, s.speed);
          return;
        }
      }
    }
    const cp = this.campOf(c);
    // 縄張りを守る：コボルト、畑に来たアリ（オークは従う相手なので襲わない）
    if (cp && this.defend(c, cp.x, cp.y, [Kind.Kobold, Kind.Ant, Kind.Dwarf])) return;
    if (c.st === 3 && c.food >= s.cap * 0.7) c.st = 0;
    if (c.hungry || c.st === 3 || c.st === 4) {
      // 狩りに出た者も、腹を空かせたら自分が食べるほうを先にする（苔とキノコも食べる）
      if (c.hungry) c.st = 3;
      // 食べ物の主は、集落のまわりのキノコと苔（集めに出た者 st 4 が持ち帰って蓄えにする）。
      // 近くに獲物がいれば狩り、死骸があれば拾う（足し）。長く食べていなければ、遠くまで探す
      const R = c.sinceMeal > 1200 ? 20 : c.sinceMeal > 600 ? 16 : 12;
      if (this.hunt(c, c.st === 4 ? 8 : R, HUNT0, s.speed * 1.15)) return;
      if (this.goblinCarrion(c, c.st === 4 ? 8 : R)) return;
      // 集めに出た者（st 4）：集落のまわり（14マス、コボルトの縄張りの外）のキノコと苔を摘んで袋（units、20まで）に入れる。いっぱいになったら持ち帰る
      if (c.st === 4) {
        const k = cp && c.units < 20 ? this.goblinForage(c, cp.x, cp.y, 14) : -1;
        if (k < 0) {
          c.st = 0;
        } else {
          const m = this.w.map;
          c.act = 1;
          if (this.goTo(c, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === k) {
            const tf = Math.min(4, this.w.fungus[k] - 12, 20 - c.units);
            if (tf > 0) {
              this.w.fungus[k] -= tf;
              c.units += tf;
            } else {
              const tm = Math.min(4, this.w.moss[k] - 12, 20 - c.units);
              if (tm > 0) {
                this.w.moss[k] -= tm;
                c.units += tm;
              }
            }
            this.mossTouched = true;
            c.act = 2;
            if (c.actT > 4) c.actT = 0;
          }
          return;
        }
      }
      // 腹を空かせた者は、その場で苔かキノコを食べる
      const kk = cp ? this.goblinForage(c, cp.x, cp.y, R) : (() => {
        const k = this.findMoss(c, c.x, c.y, R, 91, this.step >> 7);
        return k >= 0 ? k : this.findFungus(c.x, c.y, R, c.id);
      })();
      if (kk >= 0) {
        const m = this.w.map;
        c.act = 1;
        if (this.goTo(c, (kk % m.w) * TILE + 8, Math.floor(kk / m.w) * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === kk) {
          let t = Math.min(4, this.w.fungus[kk] - 12, s.cap - c.food);
          if (t > 0) {
            this.w.fungus[kk] -= t;
            c.food += t;
            c.sinceMeal = 0;
            this.mossTouched = true;
          } else this.eatMoss(c, 4);
        }
        return;
      }
      if (c.st === 4) c.st = 0;
      if (!c.hungry) c.st = 0;
    }
    // 集落のない者と、近くに食べ物の見つからない腹ぺこの者は、あてもなく歩いて探す
    if (!cp || c.hungry > 0) {
      c.act = 1;
      const j = DIR16[ih(c.id, this.step >> 4, 92) & 15];
      this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
      return;
    }
    // 食べ残しを畑へ運んでキノコを育てる
    if (c.units > 0) {
      const m = this.w.map;
      const h = ih(c.id, this.step >> 6, 93);
      const fx = Math.floor(cp.x / TILE) + ((h & 7) % 7) - 3;
      const fy = Math.floor(cp.y / TILE) + (((h >>> 3) & 7) % 7) - 3;
      const fk = fy * m.w + fx;
      if (fx > 0 && fy > 0 && fx < m.w - 1 && fy < m.h - 1 && !m.solid[fk] && !m.lava[fk]) {
        c.act = 1;
        if (this.goTo(c, fx * TILE + 8, fy * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === fk) {
          const t = Math.min(c.units, 200 - this.w.fungus[fk]);
          if (t > 0) {
            this.w.fungus[fk] += t;
            c.units -= t;
            this.mossTouched = true;
          }
          if (c.units > 0) {
            this.deposit(c.x, c.y, c.units);
            c.units = 0;
          }
          c.act = 2;
          c.actT = 0;
        }
        return;
      }
      this.deposit(c.x, c.y, c.units);
      c.units = 0;
    }
    // 集落のそばでたむろする
    if (sq(cp.x - c.x) + sq(cp.y - c.y) > 4 * TILE * 4 * TILE) {
      c.act = 1;
      this.goTo(c, cp.x, cp.y, s.speed);
    } else {
      c.act = c.actT % 60 < 36 ? 0 : 1;
      if (c.act === 1) {
        const j = DIR16[ih(c.id, this.step >> 4, 94) & 15];
        this.tryMove(c, j[0] * s.speed * 0.4, j[1] * s.speed * 0.4);
      }
    }
  }

  /** 集落：ゴブリンは数を増やし、リザードマンの村は水が涸れると移る。誰もいない所は消える */
  private updateCamps(): void {
    for (const cp of this.camps) {
      if (cp.id < 0) continue;
      const kind = cp.kind === 0 ? Kind.Goblin : Kind.Lizardman;
      const members = cp.kind === 0 ? this.campMembers(cp) : this.list.filter((c) => c.k === kind && !c.dead && c.ref === cp.id && c.st !== 9);
      if (!members.length) {
        // 誰もいなくなった集落の火は消え、燃え残りは灰になる
        if ((cp.fuel ?? 0) > 0) this.deposit(cp.x, cp.y + 10, cp.fuel as number);
        cp.fuel = 0;
        if (cp.kind === 0) {
          this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'empty', x: Math.round(cp.x), y: Math.round(cp.y) } as never);
          this.deposit(cp.x, cp.y, cp.store ?? 0);
          cp.store = 0;
        }
        cp.id = -1;
        continue;
      }
      if (cp.kind === 0) {
        // 襲われた記憶は少しずつ薄れる
        if (this.step % 600 === 45 && (cp.raids ?? 0) > 0) cp.raids = (cp.raids ?? 0) - 1;
        if ((cp.store ?? 0) > 0) cp.empty = -1;
        else if ((cp.empty ?? -1) < 0) cp.empty = this.w.tick;
        if (members.length >= 2) cp.alone = -1;
        else if ((cp.alone ?? -1) < 0) cp.alone = this.w.tick;
        let dragonNear = false;
        for (const o of this.list) if (o.k === Kind.Dragon && !o.dead && o.sp >= 1 && sq((o.hx || o.x) - cp.x) + sq((o.hy || o.y) - cp.y) < 30 * TILE * 30 * TILE) dragonNear = true;
        const lonely = members.length < 2 && this.w.tick - (cp.alone as number) > DAY_TICKS_ECO;
        // 蓄えが残っているうちは、食べ物のことでは捨てない。尽きて地上の1/3日たち、皆が腹を空かせているか、飢え死にしかけている者がいるとき
        // （ゴブリンは腹を空かせてから地上の約0.4日で飢え死にするので、コボルトのように1日は待てない）
        const starving = members.every((c) => c.hungry > 0 || c.food < 10) || members.some((c) => c.hungry > SPEC[Kind.Goblin].starve * 0.5);
        const reason = (cp.raids ?? 0) >= 4 ? 1 : dragonNear ? 3 : lonely ? 2 : (cp.empty ?? -1) >= 0 && this.w.tick - (cp.empty as number) > DAY_TICKS_ECO / 3 && starving ? 0 : -1;
        if (reason >= 0 && cp.hide !== 1 && this.abandonCamp(cp, reason)) continue;
      }
      // かがり火：まわりの枯れかけたキノコの軸を集めて燃やし続ける。燃えた分は灰になって土に返る（地上の時間で20秒ごと）
      if (this.step % 100 === 65) {
        if ((cp.fuel ?? 0) < 12) {
          const m = this.w.map;
          const cx = Math.floor(cp.x / TILE);
          const cy = Math.floor(cp.y / TILE);
          let got = 0;
          for (let dy = -6; dy <= 6 && got < 4; dy++)
            for (let dx = -6; dx <= 6 && got < 4; dx++) {
              const k = (cy + dy) * m.w + cx + dx;
              if (k < 0 || k >= m.solid.length || m.solid[k]) continue;
              // 枯れたキノコの軸か、乾いた苔を燃やす
              if (this.w.fungus[k] >= 40) {
                const t = Math.min(2, this.w.fungus[k] - 30, 4 - got);
                this.w.fungus[k] -= t;
                got += t;
              } else if (this.w.moss[k] >= 80) {
                const t = Math.min(2, this.w.moss[k] - 60, 4 - got);
                this.w.moss[k] -= t;
                got += t;
              }
            }
          if (got) {
            cp.fuel = (cp.fuel ?? 0) + got;
            this.mossTouched = true;
          }
        }
        if ((cp.fuel ?? 0) > 0) {
          cp.fuel = (cp.fuel as number) - 1;
          this.deposit(cp.x, cp.y + 10, 1);
          if (cp.fuel === 0) this.log(cp.x, cp.y, `{k:${kind}}の集落のかがり火が消えた`);
        }
      }
      // ゴブリンは、集落の蓄えが目安の3割以上あるときだけ子を産む（蓄えから産む）
      if (cp.kind === 0 && this.step % 600 === 15 && members.length >= 2 && this.counts[kind] < 20 && (cp.store ?? 0) >= Math.max(20, this.campStoreGoal(cp) * 0.3)) {
        const b = SPEC[kind].body;
        cp.store = (cp.store ?? 0) - b;
        this.spawn(kind, members[0].x, members[0].y, b, 0).ref = cp.id;
      }
      if (cp.kind === 1 && this.step % 600 === 15 && members.length >= 2) {
        const cap = 8;
        const p = members.find((c) => c.food >= SPEC[kind].cap * 0.6);
        if (p && this.counts[kind] < cap) {
          const b = SPEC[kind].body;
          p.food -= b;
          this.spawn(kind, p.x, p.y, b, 0).ref = cp.id;
        }
      }
      if (cp.kind === 1 && this.step % 600 === 315) {
        if (this.waterNear(Math.floor(cp.x / TILE), Math.floor(cp.y / TILE), 6) < 600) cp.dry++;
        else cp.dry = 0;
        if (cp.dry >= 5) {
          const site = this.pickWaterSite(cp.id);
          if (site >= 0) {
            const m = this.w.map;
            cp.x = (site % m.w) * TILE + 8;
            cp.y = Math.floor(site / m.w) * TILE + 8;
            cp.dry = 0;
          }
        }
      }
    }
    this.camps = this.camps.filter((o) => o.id >= 0);
  }

  // ---------- オーク ----------
  private pickLair(): number {
    const m = this.w.map;
    const targets = [...this.camps.filter((o) => o.kind === 0), ...this.warrens];
    if (!targets.length) return -1;
    const t = targets[ih(this.step, 1, 95) % targets.length];
    for (let i = 0; i < 80; i++) {
      const h = ih(this.step, i, 96);
      const x = Math.floor(t.x / TILE) + ((h & 63) % 41) - 20;
      const y = Math.floor(t.y / TILE) + (((h >>> 6) & 63) % 41) - 20;
      if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 20 || m.maze[k]) continue;
      if (Math.abs(x - t.x / TILE) + Math.abs(y - t.y / TILE) < 12) continue;
      if ((ih(this.step, i, 209) % 100) / 100 < this.presenceAt(x * TILE + 8, y * TILE + 8) * 1.3) continue;
      return k;
    }
    return -1;
  }

  private orc(c: Cr): void {
    if (!c.hungry && c.act !== 2 && c.st < 5 && this.scavenge(c)) return;
    const s = SPEC[Kind.Orc];
    // 貢ぎ物の取り立て（st 5：従う集落へ向かう、st 6：袋を担いで縄張りへ帰る）。飢えて去るより先に
    if (c.st === 5 || c.st === 6) {
      if (c.act === 2 && c.actT < 4) return;
      this.collectTribute(c);
      return;
    }
    if (this.leaveIfStarving(c)) return;
    if (c.act === 2 && c.actT < 4) return;
    if (c.hungry) {
      if (this.hunt(c, 10, HUNT_ORC, s.speed * 1.2)) return;
      // 近くのコボルトの住処を襲いに行く（ゴブリンの集落は襲わない：従える相手）
      const targets = [...this.warrens.filter((o) => o.id >= 0)];
      let best: { x: number; y: number } | null = null;
      let bd = 40 * TILE * 40 * TILE;
      for (const t of targets) {
        const d = sq(t.x - c.x) + sq(t.y - c.y);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      if (best) {
        c.act = 1;
        this.goTo(c, best.x, best.y, s.speed);
        return;
      }
    }
    // 用心棒：従う集落のそば（8マス）に来たコボルトを追い払う（縄張りから25マスまで）
    if (this.guardVassals(c)) return;
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 5 * TILE * 5 * TILE) {
      c.act = 1;
      this.goTo(c, c.hx, c.hy, s.speed);
    } else {
      c.act = c.actT % 80 < 50 ? 0 : 1;
      if (c.act === 1) {
        const j = DIR16[ih(c.id, this.step >> 4, 97) & 15];
        this.tryMove(c, j[0] * s.speed * 0.4, j[1] * s.speed * 0.4);
      }
    }
  }

  /** オーク c の縄張りに従う集落 */
  private vassalsOf(c: Cr): Camp[] {
    if (!c.hx && !c.hy) return [];
    return this.camps.filter((o) => o.id >= 0 && o.kind === 0 && o.lx === c.hx && o.ly === c.hy);
  }

  /** 用心棒：従う集落のそばに来たコボルトを追い払う。true なら今はそのために動いている */
  private guardVassals(c: Cr): boolean {
    if (c.hungry || c.flee > 0) return false;
    for (const cp of this.vassalsOf(c)) {
      if (sq(cp.x - c.x) + sq(cp.y - c.y) > 25 * TILE * 25 * TILE) continue;
      let foe: Cr | null = null;
      let bd = 8 * TILE * 8 * TILE;
      this.nearby(cp.x, cp.y, 8, (o) => {
        if (o.dead || o.away || o.k !== Kind.Kobold) return;
        const d = sq(o.x - cp.x) + sq(o.y - cp.y);
        if (d < bd) {
          bd = d;
          foe = o;
        }
      });
      if (!foe) continue;
      const f = foe as Cr;
      c.act = 1;
      if (sq(f.x - c.x) + sq(f.y - c.y) < 11 * 11) this.fight(c, f);
      else this.goTo(c, f.x, f.y, SPEC[c.k].speed * 1.2);
      return true;
    }
    return false;
  }

  /** 貢ぎ物の取り立て：従う集落へ行き、蓄えの3割を袋に詰めて（units）縄張りへ持ち帰り、食べる */
  private collectTribute(c: Cr): void {
    const s = SPEC[Kind.Orc];
    c.act = 1;
    if (c.st === 5) {
      const cp = this.camps.find((o) => o.id === c.ref && o.id >= 0);
      if (!cp || cp.lx !== c.hx || cp.ly !== c.hy) {
        c.st = 0;
        c.ref = 0;
        return;
      }
      if (sq(cp.x - c.x) + sq(cp.y - c.y) < 1.5 * TILE * 1.5 * TILE || this.goTo(c, cp.x, cp.y, s.speed)) {
        const amt = Math.floor((cp.store ?? 0) * 0.3);
        cp.store = (cp.store ?? 0) - amt;
        c.units += amt;
        c.st = 6;
        c.ref = 0;
        c.act = 2;
        c.actT = 0;
        this.record('settle', { t: this.w.tick, k: Kind.Orc, id: cp.id, ev: 'tribute', n: amt, x: Math.round(cp.x), y: Math.round(cp.y) } as never);
        this.log(cp.x, cp.y, `{k:${Kind.Orc}}が{k:${Kind.Goblin}}の集落から貢ぎ物を取り立てた`);
      }
      return;
    }
    // 袋を担いで縄張りへ帰り、食べる（食べきれない分は縄張りの土へ）
    if (sq(c.hx - c.x) + sq(c.hy - c.y) < 2 * TILE * 2 * TILE || this.goTo(c, c.hx, c.hy, s.speed)) {
      const t = Math.min(c.units, s.cap - c.food);
      c.food += t;
      c.units -= t;
      if (t > 0) c.sinceMeal = 0;
      if (c.units > 0) this.deposit(c.x, c.y, c.units);
      c.units = 0;
      c.st = 0;
      c.act = 2;
      c.actT = 0;
    }
  }

  /**
   * 従う集落：オークの縄張り（寝床）から20マス以内のゴブリンの集落は、いちばん近い縄張りのオークに従う。
   * 地上の約1日ごとに、そのオークのうち一匹が来て、蓄えの3割を取り立てる
   */
  private updateVassals(): void {
    for (const cp of this.camps) {
      if (cp.id < 0 || cp.kind !== 0) continue;
      let lx = 0;
      let ly = 0;
      let bd = 20 * TILE * 20 * TILE;
      for (const o of this.list) {
        if (o.k !== Kind.Orc || o.dead || o.away || (!o.hx && !o.hy)) continue;
        const d = sq(o.hx - cp.x) + sq(o.hy - cp.y);
        if (d < bd || (d === bd && (o.hx < lx || (o.hx === lx && o.hy < ly)))) {
          bd = d;
          lx = o.hx;
          ly = o.hy;
        }
      }
      if (lx !== (cp.lx ?? 0) || ly !== (cp.ly ?? 0)) {
        cp.lx = lx;
        cp.ly = ly;
        if (lx || ly) {
          cp.tribT = this.w.tick + DAY_TICKS_ECO / 2 + (ih(cp.id, this.step, 234) % (DAY_TICKS_ECO / 2));
          this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'vassal', x: Math.round(cp.x), y: Math.round(cp.y) } as never);
          this.log(cp.x, cp.y, `{k:${Kind.Goblin}}の集落が、近くに縄張りを持つ{k:${Kind.Orc}}に従った`);
        }
      }
    }
  }

  /** 取り立ての時が来た集落へ、縄張りのオークを一匹送る */
  private sendCollectors(): void {
    for (const cp of this.camps) {
      if (cp.id < 0 || cp.kind !== 0 || !(cp.lx || cp.ly) || this.w.tick < (cp.tribT ?? 0)) continue;
      if ((cp.store ?? 0) < 10) {
        cp.tribT = this.w.tick + 600;
        continue;
      }
      // 腹を空かせたオークも行く（腹を空かせているからこそ取り立てる。五巡目は腹ぺこのオークを送らず、取り立ての時が来ても縄張りのオークが皆腹ぺこで、ほとんど取り立てられなかった）
      // 飢えて去ろうとしている（st 9）オークも行く：貢ぎ物で腹を満たせば、去らずにとどまる
      const o = this.list.find((x) => x.k === Kind.Orc && !x.dead && !x.away && x.hx === cp.lx && x.hy === cp.ly && (x.st === 0 || x.st === 9) && x.flee <= 0 && x.units === 0);
      if (!o) {
        cp.tribT = this.w.tick + 600;
        continue;
      }
      o.st = 5;
      o.ref = cp.id;
      cp.tribT = this.w.tick + Math.floor(DAY_TICKS_ECO * 0.8) + (ih(cp.id, this.step, 235) % Math.floor(DAY_TICKS_ECO * 0.4));
    }
  }

  // ---------- リザードマン ----------
  private waterNear(x0: number, y0: number, R: number): number {
    const m = this.w.map;
    let w = 0;
    for (let y = y0 - R; y <= y0 + R; y++) for (let x = x0 - R; x <= x0 + R; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) w += this.w.water[y * m.w + x];
    return w;
  }

  private pickWaterSite(exclude: number): number {
    const m = this.w.map;
    let best = -1;
    let bv = 1500;
    for (let i = 0; i < 160; i++) {
      const k = ih(this.step, i, 98) % (m.w * m.h);
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 20 || m.maze[k]) continue;
      const x = k % m.w;
      const y = Math.floor(k / m.w);
      if (this.camps.some((o) => o.id !== exclude && Math.abs(o.x / TILE - x) + Math.abs(o.y / TILE - y) < 20)) continue;
      const v = this.waterNear(x, y, 6);
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    return best;
  }

  private lizardman(c: Cr): void {
    const s = SPEC[Kind.Lizardman];
    if (this.leaveIfStarving(c)) return;
    if (c.act === 2 && c.actT < 4) return;
    const cp = this.campOf(c);
    // 近くの大トカゲを手なずける
    if (cp && this.step % 20 === c.id % 20) {
      this.nearby(c.x, c.y, 3, (o) => {
        if (o.k === Kind.Lizard && !o.dead && o.ref2 === 0 && sq(o.x - c.x) + sq(o.y - c.y) < 48 * 48) o.ref2 = c.id;
      });
    }
    if (cp && this.defend(c, cp.x, cp.y, [Kind.Orc, Kind.Goblin])) return;
    if (c.hungry) {
      if (this.hunt(c, 10, HUNT2, s.speed * 1.2)) return;
    }
    if (!cp) {
      c.act = 1;
      const j = DIR16[ih(c.id, this.step >> 4, 99) & 15];
      this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
      return;
    }
    // 水辺で待ち伏せ、または村のそばで休む
    const R = c.hungry ? 7 : 4;
    if (sq(cp.x - c.x) + sq(cp.y - c.y) > R * TILE * R * TILE) {
      c.act = 1;
      this.goTo(c, cp.x, cp.y, s.speed);
    } else {
      c.act = c.actT % 70 < 45 ? 0 : 1;
      if (c.act === 1) {
        const j = DIR16[ih(c.id, this.step >> 4, 100) & 15];
        this.tryMove(c, j[0] * s.speed * 0.45, j[1] * s.speed * 0.45);
      }
    }
  }

  // ---------- ミノタウロス ----------
  private mazeTiles(): number[] {
    const m = this.w.map;
    const out: number[] = [];
    for (let k = 0; k < m.w * m.h; k++) if (m.maze[k] && !m.solid[k]) out.push(k);
    return out;
  }

  private minotaur(c: Cr): void {
    const s = SPEC[Kind.Minotaur];
    if (this.leaveIfStarving(c)) return;
    if (c.act === 2 && c.actT < 5) return;
    const m = this.w.map;
    const k = this.tileOf(c.x, c.y);
    const inMaze = k >= 0 && m.maze[k] === 1;
    // 迷路の中か、迷路のすぐ外で、何でも襲う
    const nearMaze = inMaze || sq(c.x - c.hx) + sq(c.y - c.hy) < 16 * TILE * 16 * TILE;
    if (nearMaze && this.hunt(c, inMaze ? 5 : 3, HUNT3, s.speed * 1.3)) return;
    // 迷路の中を徘徊する
    c.act = 1;
    if (c.tx <= 0 || sq(c.tx - c.x) + sq(c.ty - c.y) < 10 * 10 || c.actT > 1200) {
      const mz = this.mazeTiles();
      if (!mz.length) return;
      const t = mz[ih(c.id, this.step, 101) % mz.length];
      c.tx = (t % m.w) * TILE + 8;
      c.ty = Math.floor(t / m.w) * TILE + 8;
      c.actT = 0;
    }
    this.goTo(c, c.tx, c.ty, s.speed);
  }

  // ---------- 石像 ----------

  /** 生き物を、その瞬間の姿のまま石像に変える */
  petrify(c: Cr): void {
    this.dropBelongings(c);
    if (c.gold > 0) {
      this.dropGold(c.x, c.y, c.gold);
      c.gold = 0;
    }
    if (c.k === Kind.Golem || c.k === Kind.Worm) return;
    const k = this.tileOf(c.x, c.y);
    const m = this.w.map;
    // 入口のそばでは石像にならない（入口をふさがないように）
    const nearGate = Math.abs((k % m.w) - m.entrance.x) + Math.floor(k / m.w) < 10;
    if (k < 0 || this.statueAt.has(k) || nearGate) {
      this.die(c, 'petrified');
      return;
    }
    this.record('deaths', { t: this.w.tick, k: c.k, cause: 'petrified', by: -1, x: Math.round(c.x), y: Math.round(c.y) } as never);
    this.releaseMana(c);
    const st: Statue = { id: this.nextId++, x: Math.round(c.x), y: Math.round(c.y), k: c.k, sp: c.sp, dir: c.dir, act: c.act === 3 ? 0 : c.act, f: (this.step >> 2) & 3, units: c.body + c.food + c.units, age: 0 };
    this.statues.push(st);
    if (STR[c.k] >= 5) this.log(c.x, c.y, `{k:${c.k}}が石になった`);
    // 石像のマスは、覚えておく位置（丸めた座標）で決める（読み込み直したときと同じマスになるように）
    const sk = this.tileOf(st.x, st.y);
    st.blocks = sk >= 0 && this.blocksAt(sk) ? 1 : 0;
    if (st.blocks) this.statueAt.set(sk, st.id);
    c.body = 0;
    c.food = 0;
    c.units = 0;
    c.dead = 2;
    this.addDeath(c.x, c.y, c.k);
  }

  private rebuildStatueIndex(): void {
    this.statueAt.clear();
    for (const st of this.statues) {
      const k = this.tileOf(st.x, st.y);
      if (st.blocks === undefined) st.blocks = k >= 0 && this.blocksAt(k) ? 1 : 0;
      if (k >= 0 && st.blocks) this.statueAt.set(k, st.id);
    }
  }

  /** 石像が通り道をふさぐのは開けた場所だけ（細い通路では脇をすり抜けられる） */
  private blocksAt(k: number): boolean {
    const m = this.w.map;
    let open = 0;
    for (const q of [k + 1, k - 1, k + m.w, k - m.w, k + m.w + 1, k + m.w - 1, k - m.w + 1, k - m.w - 1]) if (q >= 0 && q < m.solid.length && !m.solid[q] && !m.lava[q] && !this.statueAt.has(q)) open++;
    return open >= 6;
  }

  /** 風化と、暗がりでガーゴイルに変わること */
  private updateStatues(day: number): void {
    let changed = false;
    for (const st of this.statues) {
      st.age += 50;
      if (st.age % 400 === 0 && st.units > 0) {
        st.units--;
        this.deposit(st.x, st.y, 1);
      }
      const k = this.tileOf(st.x, st.y);
      if (st.units > 8 && st.age > 4000 && k >= 0 && this.lit(k, day) < 0.15 && this.manaAround(k) >= 20 && this.counts[Kind.Gargoyle] < 6 && ih(st.id, this.step, 110) % 120 === 0) {
        const body = Math.min(30, st.units);
        const g = this.spawn(Kind.Gargoyle, st.x, st.y, body, 0);
        this.takeMana(g, k, 70);
        this.deposit(st.x, st.y, st.units - body);
        g.st = 0;
        g.hx = st.x;
        g.hy = st.y;
        this.counts[Kind.Gargoyle]++;
        st.units = 0;
      }
      if (st.units <= 0) {
        st.id = -1;
        changed = true;
      }
    }
    if (changed) {
      this.statues = this.statues.filter((o) => o.id >= 0);
      this.rebuildStatueIndex();
    }
  }

  private pickDark(salt: number, R: number): number {
    const m = this.w.map;
    for (let i = 0; i < 120; i++) {
      const k = ih(this.step, i, 111 + salt) % (m.w * m.h);
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || m.maze[k]) continue;
      if (this.w.lightBase[k] > 0 || this.w.mossGlow[k] > 0.02 || this.w.lavaGlow[k] > 0.02) continue;
      const x = k % m.w;
      const y = Math.floor(k / m.w);
      if (Math.abs(x - m.entrance.x) + y < R * 0.3) continue;
      // 人の気配の濃い所は住みかにしにくい
      if ((ih(this.step, i, 208) % 100) / 100 < this.presenceAt(x * TILE + 8, y * TILE + 8) * 1.3) continue;
      return k;
    }
    return -1;
  }

  /** 日の光（光の筋）がそのマスに差しているか */
  private sunlit(k: number, day: number): boolean {
    return k >= 0 && this.w.lightBase[k] * day > 200;
  }

  // ---------- トロール ----------
  private troll(c: Cr, day: number): void {
    const s = SPEC[Kind.Troll];
    const k = this.tileOf(c.x, c.y);
    // 光の筋を浴びると石になる
    if (this.sunlit(k, day)) {
      this.petrify(c);
      return;
    }
    if (this.leaveIfStarving(c)) return;
    if (c.act === 2 && c.actT < 5) return;
    if (day > 0.05) {
      // 昼は暗い寝床で眠る
      if (sq(c.hx - c.x) + sq(c.hy - c.y) > 12 * 12) {
        c.act = 1;
        this.goTo(c, c.hx, c.hy, s.speed);
      } else c.act = 0;
      return;
    }
    // 夜は何でも食う
    if (c.food < s.cap * 0.8) {
      if (this.hunt(c, 10, HUNT4, s.speed * 1.15)) return;
      let best: Cr | null = null;
      let bd = 10 * TILE * 10 * TILE;
      for (const o of this.corpses) {
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      if (best) {
        const b = best as Cr;
        c.act = 1;
        if (sq(b.x - c.x) + sq(b.y - c.y) < 10 * 10) {
          const t = Math.min(b.units, 20, s.cap - c.food);
          b.units -= t;
          c.food += t;
          c.sinceMeal = 0;
          c.act = 2;
          c.actT = 0;
          if (b.units <= 0) b.dead = 2;
        } else this.goTo(c, b.x, b.y, s.speed);
        return;
      }
    }
    c.act = 1;
    const j = DIR16[ih(c.id, this.step >> 5, 112) & 15];
    this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
  }

  // ---------- バジリスク ----------
  private basilisk(c: Cr): void {
    const s = SPEC[Kind.Basilisk];
    if (this.leaveIfStarving(c)) return;
    if (c.act === 2 && c.actT < 6) return;
    // 自分より大きなものが近づくと睨みつけ、見通しの通っている相手を石に変える
    if (this.step % 10 === c.id % 10) {
      let target: Cr | null = null;
      this.nearby(c.x, c.y, 4, (o) => {
        if (target || o.dead || o.away || STR[o.k] < 6 || o.k === Kind.Basilisk || o.k === Kind.Gargoyle || o.k === Kind.Dragon) return;
        if (sq(o.x - c.x) + sq(o.y - c.y) > 4 * TILE * 4 * TILE) return;
        const m = this.w.map;
        if (!lineOfSight(m, c.x, c.y, o.x, o.y)) return;
        target = o;
      });
      if (target) {
        const t = target as Cr;
        c.act = 2;
        c.actT = 0;
        const dx = t.x - c.x;
        const dy = t.y - c.y;
        c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : dy > 0 ? 0 : 1;
        if (ih(c.id, t.id, this.step) % 24 === 0) this.petrify(t);
        return;
      }
    }
    if (c.hungry && this.hunt(c, 8, HUNT5, s.speed * 1.2)) return;
    // 入口から離れた暗がりを住みかにする
    const m = this.w.map;
    if (c.hx === c.x && c.hy === c.y) {
      const lair = this.pickDark(2, 80);
      if (lair >= 0) {
        c.hx = (lair % m.w) * TILE + 8;
        c.hy = Math.floor(lair / m.w) * TILE + 8;
      }
    }
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 10 * TILE * 10 * TILE) {
      c.act = 1;
      this.goTo(c, c.hx, c.hy, s.speed);
      return;
    }
    c.act = c.actT % 90 < 50 ? 0 : 1;
    if (c.act === 1) {
      const j = DIR16[ih(c.id, this.step >> 5, 113) & 15];
      this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
    }
  }

  // ---------- ガーゴイル ----------
  private gargoyle(c: Cr): void {
    const s = SPEC[Kind.Gargoyle];
    if (c.act === 2 && c.actT < 4) return;
    // 近くを飛ぶコウモリを狩る
    let prey: Cr | null = null;
    let bd = 6 * TILE * 6 * TILE;
    if (c.food < s.cap * 0.7) {
      this.nearby(c.x, c.y, 6, (o) => {
        if (o.dead || o.away || o.k !== Kind.Bat || o.st === 0) return;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          prey = o;
        }
      });
    }
    if (prey) {
      const p = prey as Cr;
      c.act = 1;
      if (sq(p.x - c.x) + sq(p.y - c.y) < 10 * 10) this.eat(c, p);
      else this.moveToward(c, p.x, p.y, s.speed);
      return;
    }
    // 止まり木（壁際）に戻って、石像のふりをしてうずくまる
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 4 * 4) {
      c.act = 1;
      this.moveToward(c, c.hx, c.hy, s.speed);
      return;
    }
    c.x = c.hx;
    c.y = c.hy;
    c.act = 0;
    c.dir = 0;
  }

  // ---------- ヴァンパイア ----------
  private vampire(c: Cr, day: number): void {
    const s = SPEC[Kind.Vampire];
    if (this.leaveIfStarving(c)) return;
    const m = this.w.map;
    const k = this.tileOf(c.x, c.y);
    // 近くのコウモリを従える
    if (this.step % 25 === c.id % 25) {
      this.nearby(c.x, c.y, 12, (o) => {
        if (o.k === Kind.Bat && !o.dead && !o.away && o.ref2 === 0) o.ref2 = c.id;
      });
    }
    if (c.act === 2 && c.actT < 4) return;
    // 光を嫌う：明るい所にいたら暗い方へ
    const lightAt = (q: number) => (q < 0 ? 0 : this.w.lightBase[q] * day + this.w.mossGlow[q] * 1500 + this.w.lavaGlow[q] * 1500);
    if (lightAt(k) > 60) {
      let best = k;
      for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (q >= 0 && q < m.solid.length && !m.solid[q] && lightAt(q) < lightAt(best)) best = q;
      c.act = 1;
      this.moveToward(c, (best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, s.speed * 1.3);
      return;
    }
    if (day > 0.05) {
      if (sq(c.hx - c.x) + sq(c.hy - c.y) > 12 * 12) {
        c.act = 1;
        this.goTo(c, c.hx, c.hy, s.speed);
      } else c.act = 0;
      return;
    }
    // 夜は暗がりを歩いて、温かい血の生き物を狩る
    if (c.food < s.cap * 0.7) {
      let prey: Cr | null = null;
      let bd = 10 * TILE * 10 * TILE;
      this.nearby(c.x, c.y, 10, (o) => {
        if (o.dead || o.away || ![Kind.Rat, Kind.Goblin, Kind.Kobold, Kind.Lizardman, Kind.Adventurer].includes(o.k)) return;
        if (lightAt(this.tileOf(o.x, o.y)) > 60) return;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          prey = o;
        }
      });
      if (prey) {
        const p = prey as Cr;
        c.act = 1;
        if (sq(p.x - c.x) + sq(p.y - c.y) < 11 * 11) {
          const won = STR[p.k] * 2 < STR[c.k] ? (this.eat(c, p), true) : this.fight(c, p);
          // 獲物の分け前を、従うコウモリに与える
          if (won) {
            this.nearby(c.x, c.y, 6, (b) => {
              if (b.k !== Kind.Bat || b.dead || b.ref2 !== c.id || c.food <= 20) return;
              const t = Math.min(6, SPEC[Kind.Bat].cap - b.food, c.food - 20);
              if (t > 0) {
                b.food += t;
                c.food -= t;
                b.sinceMeal = 0;
              }
            });
          }
        } else {
          const nk = this.tileOf(p.x, p.y);
          if (lightAt(nk) <= 60) this.goTo(c, p.x, p.y, s.speed * 1.2);
        }
        return;
      }
    }
    c.act = 1;
    const j = DIR16[ih(c.id, this.step >> 5, 114) & 15];
    const nk = this.tileOf(c.x + j[0] * 10, c.y + j[1] * 10);
    if (lightAt(nk) <= 60) this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
    else c.act = 0;
  }

  // ---------- 宝 ----------

  /** 金貨をその場に落とす（近くに山があればそこに積む） */
  private dropGold(x: number, y: number, g: number): void {
    for (const p of this.piles) {
      if (sq(p.x - x) + sq(p.y - y) < 20 * 20) {
        p.gold += g;
        return;
      }
    }
    const k = this.tileOf(x, y);
    const m = this.w.map;
    this.piles.push({ id: this.nextId++, x: k >= 0 ? (k % m.w) * TILE + 8 : Math.round(x), y: k >= 0 ? Math.floor(k / m.w) * TILE + 8 : Math.round(y), gold: g, age: 0 });
  }

  /** 暗闇に長く置かれた宝の山から、その一部がミミックになる */
  private updateTreasure(day: number): void {
    const m = this.w.map;
    for (const p of this.piles) {
      p.age += 50;
      const k = this.tileOf(p.x, p.y);
      if (p.gold < 30 || p.age < 6000 || k < 0 || this.lit(k, day) > 0.1 || this.counts[Kind.Mimic] >= 3) continue;
      // 外とつながる口や正面の入口のそばには潜まない（入ってきたばかりの者の罠にならないように）
      const px = p.x / TILE;
      const py = p.y / TILE;
      if (Math.abs(px - m.entrance.x) + py < 16 || m.mouths.some((mo) => Math.abs(mo.x - px) + Math.abs(mo.y - py) < 16)) continue;
      if (ih(p.id, this.step, 120) % 60 !== 0) continue;
      // 山の隣の空いた床
      let spot = -1;
      for (const q of [k + 1, k - 1, k + m.w, k - m.w, k + m.w + 1, k + m.w - 1]) if (q >= 0 && q < m.solid.length && !m.solid[q] && !m.lava[q] && !this.statueAt.has(q)) spot = q;
      if (spot < 0 || this.manaAround(spot) < 8) continue;
      // 体は、まわり（7×7マス）の土の養分から作る
      const body = this.takeNutrients(spot, 10, 3);
      if (body < 10) continue;
      const c = this.spawn(Kind.Mimic, (spot % m.w) * TILE + 8, Math.floor(spot / m.w) * TILE + 8, body, 0);
      this.takeMana(c, spot, 50);
      // 宝の山から取り込むのは、山にある分まで（40枚まで）
      c.gold = Math.min(40, p.gold);
      p.gold -= c.gold;
      c.dir = 0;
      c.hx = c.x;
      c.hy = c.y;
      this.counts[Kind.Mimic]++;
    }
    this.piles = this.piles.filter((o) => o.gold > 0);
  }

  // ---------- ミミック ----------
  private mimic(c: Cr): void {
    if (c.act === 2 && c.actT < 5) return;
    c.act = 0;
    // 食べたあとはしばらく消化していて、近づくものを襲わない（地上の時間で3時間ほど）
    if (c.gait > 0) {
      c.gait--;
      return;
    }
    // 近づいたものを何でも食う
    let prey: Cr | null = null;
    let bd = 20 * 20;
    this.nearby(c.x, c.y, 1, (o) => {
      if (o === c || o.dead || o.away || [Kind.Mimic, Kind.Golem, Kind.Worm, Kind.Ghost, Kind.Wisp].includes(o.k)) return;
      if (o.k === Kind.Bat && o.st !== 0) return;
      // 振動で気づく：じっとしている者、眠っている者には気づかない
      if (!this.canSense(c, o)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        prey = o;
      }
    });
    if (prey) {
      const p = prey as Cr;
      c.dir = Math.abs(p.x - c.x) > Math.abs(p.y - c.y) ? (p.x > c.x ? 2 : 3) : p.y > c.y ? 0 : 1;
      // 待ち伏せは半分ほどしか当たらない
      if (ih(c.id, p.id ^ this.step, 160) % 2 === 0) {
        if (STR[p.k] * 2 < STR[c.k]) this.eat(c, p);
        else this.fight(c, p);
        if (p.dead) c.gait = 900;
      }
      c.act = 2;
      c.actT = 0;
    }
  }

  // ---------- ゴーレム ----------
  /**
   * ゴーレム：宝物庫の入口の前に立ちはだかる番人。入口を通ろうとする者と、宝物庫の中で宝を抱えた者を殴る。
   * 入口から3マスより外へは追いかけない
   */
  private golem(c: Cr): void {
    const s = SPEC[Kind.Golem];
    if (c.act === 2 && c.actT < 5) return;
    const m = this.w.map;
    // 見張る場所：宝物庫の中の、外とつながる入口のマス（はじめに一度だけ探す）
    if (c.tx <= 0) {
      let best = -1;
      let bd = 1e18;
      for (let k = 0; k < m.vault.length; k++) {
        if (!m.vault[k] || m.solid[k]) continue;
        let door = false;
        for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (!m.vault[q] && !m.solid[q]) door = true;
        if (!door) continue;
        const d = sq((k % m.w) * TILE + 8 - c.hx) + sq(Math.floor(k / m.w) * TILE + 8 - c.hy);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      c.tx = best >= 0 ? (best % m.w) * TILE + 8 : c.hx;
      c.ty = best >= 0 ? Math.floor(best / m.w) * TILE + 8 : c.hy;
    }
    const post2 = 3 * TILE * 3 * TILE;
    let foe: Cr | null = null;
    let fd = 1e18;
    this.nearby(c.tx, c.ty, 4, (o) => {
      if (o.dead || o.away || o === c || [Kind.Golem, Kind.Dragon, Kind.Worm, Kind.Ghost, Kind.Wisp, Kind.Mimic, Kind.Gargoyle].includes(o.k)) return;
      if ((o.k === Kind.Bat || o.k === Kind.Wyvern) && o.st !== 0) return;
      const k = this.tileOf(o.x, o.y);
      const atDoor = sq(o.x - c.tx) + sq(o.y - c.ty) < 2 * TILE * 2 * TILE && STR[o.k] >= 3;
      const thief = o.gold > 0 && k >= 0 && m.vault[k];
      if (!atDoor && !thief) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < fd) {
        fd = d;
        foe = o;
      }
    });
    if (foe) {
      const f = foe as Cr;
      c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
      if (fd < 16 * 16) this.fight(c, f);
      else if (sq(f.x - c.tx) + sq(f.y - c.ty) < post2) {
        c.act = 1;
        this.goTo(c, f.x, f.y, s.speed);
      }
      return;
    }
    if (sq(c.tx - c.x) + sq(c.ty - c.y) > 6 * 6) {
      c.act = 1;
      this.goTo(c, c.tx, c.ty, s.speed);
      return;
    }
    // 入口に立ち、外を向く
    c.act = 0;
    c.dir = 0;
  }

  // ---------- ワーム ----------
  private worm(c: Cr): void {
    const m = this.w.map;
    const D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    if (c.st === 0) {
      c.act = 0;
      if (this.step % 50 !== c.id % 50) return;
      // 大きな生き物が近くで騒ぐか、長い年月が経つと目覚める
      let disturbed = false;
      this.nearby(c.x, c.y, 5, (o) => {
        if (!o.dead && o.k !== Kind.Worm && o.k !== Kind.Golem && STR[o.k] >= 6) disturbed = true;
      });
      if ((disturbed && ih(c.id, this.step, 121) % 20 === 0) || ih(c.id, this.step, 122) % 500 === 0) {
        this.log(c.x, c.y, `{k:${Kind.Worm}}が目覚め、岩を掘り進みはじめた`);
        c.st = 1;
        c.ref2 = ih(c.id, this.step, 123) & 7;
        c.tx = 40 + (ih(c.id, this.step, 124) % 41);
        c.ty = 0;
        const k = this.tileOf(c.x, c.y);
        c.hx = k % m.w;
        c.hy = Math.floor(k / m.w);
      }
      return;
    }
    // 掘り進む：頭は次のマスの中心へ向かい、着いたら次のマスを決める
    c.act = 1;
    const gx = c.hx * TILE + 8;
    const gy = c.hy * TILE + 8;
    const dx = gx - c.x;
    const dy = gy - c.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const sp = 2;
    if (d > sp) {
      c.x += (dx / d) * sp;
      c.y += (dy / d) * sp;
    } else {
      c.x = gx;
      c.y = gy;
      // 次のマス：ときどき向きを変える。縁や溶岩や宝物庫は避ける
      let h = c.ref2;
      if (ih(c.id, this.step, 125) % 4 === 0) h = (h + (ih(c.id, this.step, 126) & 1 ? 1 : 7)) & 7;
      for (let i = 0; i < 8; i++) {
        const nx = c.hx + D8[h][0];
        const ny = c.hy + D8[h][1];
        const nk = ny * m.w + nx;
        let bad = nx < 4 || ny < 4 || nx >= m.w - 4 || ny >= m.h - 4 || m.vault[nk] === 1;
        if (!bad) for (const q of [nk, nk + 1, nk - 1, nk + m.w, nk - m.w]) if (m.lava[q]) bad = true;
        if (!bad) break;
        h = (h + 3) & 7;
      }
      c.ref2 = h;
      c.hx += D8[h][0];
      c.hy += D8[h][1];
      const nk = c.hy * m.w + c.hx;
      // 太いトンネル：頭のマスと、進む向きに対して横のマス
      const side = D8[(h + 2) & 7];
      this.pendingDigs.push(nk, nk + side[1] * m.w + side[0]);
      c.tx--;
      c.dir = Math.abs(D8[h][0]) >= Math.abs(D8[h][1]) ? (D8[h][0] > 0 ? 2 : 3) : D8[h][1] > 0 ? 0 : 1;
      if (c.tx <= 0) {
        c.st = 0;
        c.act = 0;
      }
    }
    if (this.pendingDigs.length >= 6 || (c.st === 0 && this.pendingDigs.length)) {
      this.w.digMany(this.pendingDigs);
      this.pendingDigs = [];
    }
    // 体の跡を記録する
    const tr = this.trails.get(c.id) ?? [];
    if (!tr.length || sq(tr[0] - c.x) + sq(tr[1] - c.y) >= 14 * 14) {
      tr.unshift(Math.round(c.x), Math.round(c.y));
      if (tr.length > 24) tr.length = 24;
      this.trails.set(c.id, tr);
    }
    // 通り道の生き物を飲み込む
    this.nearby(c.x, c.y, 1, (o) => {
      if (o === c || o.dead || o.away || o.k === Kind.Golem || o.k === Kind.Ghost || o.k === Kind.Worm || o.k === Kind.Dragon) return;
      if (sq(o.x - c.x) + sq(o.y - c.y) < 16 * 16) this.eat(c, o);
    });
  }
  private pendingDigs: number[] = [];

  // ---------- 掘ることと、空洞と崩落 ----------

  /** 巣穴やアリの通路を、空洞の気配の方へ一マスずつ掘り進める */
  private tunnelToward(head: number, home: number, R: number): number {
    const m = this.w.map;
    const hx = home % m.w;
    const hy = Math.floor(home / m.w);
    // 外の風：まだ閉じている地表の横穴の空洞が近くにあれば、その風の吹く方へ掘りたがる
    const tk = this.windTarget(hx, hy, R * 2) ?? this.w.nearestSealed(hx, hy, R);
    if (tk < 0) return -1;
    const tx = tk % m.w;
    const ty = Math.floor(tk / m.w);
    let h = head >= 0 && !m.solid[head] ? head : home;
    // 開いた床のうちは先へ進む
    for (let guard = 0; guard < 20; guard++) {
      const x = h % m.w;
      const y = Math.floor(h / m.w);
      let best = -1;
      const here = Math.abs(tx - x) + Math.abs(ty - y);
      let bd = here + 1;
      // 硬い岩は掘れない（向きを変える）。遠回りは一マスまで
      for (const q of [h + 1, h - 1, h + m.w, h - m.w]) {
        const d = Math.abs(tx - (q % m.w)) + Math.abs(ty - Math.floor(q / m.w));
        if (m.lava[q] || (m.solid[q] && !m.rubble[q] && m.hard[q] === 2)) continue;
        if (d < bd || (d === bd && best >= 0 && m.solid[best] && !m.solid[q])) {
          bd = d;
          best = q;
        }
      }
      if (best < 0 || bd > here) return -1;
      if (m.solid[best]) {
        if (this.w.dig(best)) return best;
        return -1;
      }
      h = best;
    }
    return -1;
  }

  // ---------- 中で殖える ----------

  /**
   * 大ネズミは巣穴で子を産み（親の蓄えから子の体を作る）、クモは巣に卵嚢を、トカゲは暖かい所に卵を残す。
   * 卵は地上の半日ほどで孵る。数は、これまでの上限（餌の量で決まる）を超えない
   */
  private breed(): void {
    const m = this.w.map;
    const n = this.counts;
    // 大ネズミ：巣穴に2匹以上いて、蓄えのある親がいれば2匹産む
    // ダンジョン全体で一度に一腹まで。数が上限に近いほど産まれにくい（食べ物が豊かでも、ゆっくり増える）
    const cap = this.ratCap();
    if (this.step % 300 === 140 && n[Kind.Rat] < cap && ih(this.step, 305) % 100 >= (100 * n[Kind.Rat]) / Math.max(1, cap)) {
      let litters = 0;
      for (const b of this.burrows) {
        if (litters >= 1) break;
        // 一つの巣穴が子を産むのは、地上の約4時間に1回まで（食べ物が豊かでも、一気には増えない）
        if (ih(b.x, b.y * 7 + Math.floor(this.step / 300), 304) % 4 !== 0) continue;
        const res = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y);
        // 巣穴のまわりで養える数を超えるなら産まない（移った先で殖えすぎてまた飢えないように）
        if (res.length < 2 || res.length >= 8 || res.length + 2 > (b.cap ?? 0)) continue;
        const mom = res.find((c) => c.food >= 30 && this.w.tick - c.bornAt > DAY_TICKS_ECO / 2);
        if (!mom) continue;
        for (let i = 0; i < 2; i++) {
          mom.food -= 12;
          this.originNext = 'born';
          if (i === 0) litters++;
          const pup = this.spawn(Kind.Rat, b.x + (i ? 4 : -4), b.y + 2, 8, 4);
          pup.hx = b.x;
          pup.hy = b.y;
          pup.bornAt = this.w.tick;
        }
      }
    }
    // クモ：腹が満ちて巣を持っていれば、巣に卵嚢を残す
    if (this.step % 450 === 220 && n[Kind.Spider] < Math.min(14, Math.floor((n[Kind.Wisp] + n[Kind.Bat]) / 25))) {
      for (const c of this.list) {
        if (c.dead || c.k !== Kind.Spider || c.food < 60 || this.eggs.filter((e) => e.k === Kind.Spider).length >= 4) continue;
        const web = this.webs.find((w) => w.owner === c.id);
        if (!web) continue;
        c.food -= 30;
        this.eggs.push({ id: this.nextId++, k: Kind.Spider, x: web.x + 4, y: web.y + 4, t: this.w.tick, n: 2, units: 30 });
      }
    }
    // 大トカゲ：腹が満ちていれば、近くの暖かい所（なければ足もと）に卵を埋める
    if (this.step % 450 === 330 && n[Kind.Lizard] < Math.min(24, Math.floor(n[Kind.Rat] / 6))) {
      for (const c of this.list) {
        if (c.dead || c.k !== Kind.Lizard || c.food < 90 || this.eggs.filter((e) => e.k === Kind.Lizard).length >= 3) continue;
        let spot = this.tileOf(c.x, c.y);
        let bh = -1;
        const x0 = Math.floor(c.x / TILE);
        const y0 = Math.floor(c.y / TILE);
        for (let dy = -5; dy <= 5; dy++)
          for (let dx = -5; dx <= 5; dx++) {
            const k = (y0 + dy) * m.w + x0 + dx;
            if (k < 0 || k >= m.solid.length || m.solid[k] || m.lava[k] || this.w.water[k] > 10 || this.w.heat[k] > 150) continue;
            if (this.w.heat[k] > bh) {
              bh = this.w.heat[k];
              spot = k;
            }
          }
        c.food -= 40;
        this.eggs.push({ id: this.nextId++, k: Kind.Lizard, x: (spot % m.w) * TILE + 8, y: Math.floor(spot / m.w) * TILE + 9, t: this.w.tick, n: 2, units: 40 });
      }
    }
    // 孵る（地上の半日ほど）
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const e = this.eggs[i];
      if (this.w.tick - e.t < DAY_TICKS_ECO / 2) continue;
      this.eggs.splice(i, 1);
      const k = this.tileOf(e.x, e.y);
      if (k < 0 || m.solid[k]) {
        this.deposit(e.x, e.y, e.units);
        continue;
      }
      for (let j = 0; j < e.n; j++) {
        this.originNext = 'born';
        const c = this.spawn(e.k, e.x + (j ? 5 : -5), e.y, Math.floor(e.units / e.n), 0);
        c.bornAt = this.w.tick;
        const extra = e.units - Math.floor(e.units / e.n) * e.n;
        if (j === 0 && extra) c.food += extra;
      }
    }
  }

  private updateDigging(): void {
    const m = this.w.map;
    // 大ネズミは巣穴を掘り進める（短く細い穴）
    if (this.step % 300 === 77) {
      for (const b of this.burrows) {
        if ((b.len ?? 0) >= 10) continue;
        if (!this.list.some((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y)) continue;
        const home = this.tileOf(b.x, b.y);
        const k = this.tunnelToward(b.hk ?? -1, home, 10);
        if (k >= 0) {
          b.hk = k;
          b.len = (b.len ?? 0) + 1;
        }
      }
    }
    // アリは巣を広げて、小部屋と細い通路を掘る
    if (this.step % 500 === 123) {
      for (const c of this.colonies) {
        if (c.store < 10 || (c.len ?? 0) >= 40) continue;
        const home = this.tileOf(c.x, c.y);
        const k = this.tunnelToward(c.hk ?? -1, home, 18);
        if (k >= 0) {
          c.hk = k;
          c.len = (c.len ?? 0) + 1;
          // 五マスごとに小部屋
          if (c.len % 5 === 0) for (const q of [k + 1, k + m.w, k + m.w + 1]) if (m.solid[q] && !m.lava[q]) this.w.dig(q);
        }
      }
    }
    // 掘り当てた空洞と崩落を記録に残す。崩落の下にいた生き物は押しつぶされる
    // 掘る音：この刻みに掘られたマス
    for (let i = Math.max(0, this.lastDigCount); i < this.w.digs.length; i++) {
      const op = this.w.digs[i];
      if ((op & 7) !== 0) continue;
      const k = op >> 3;
      this.noise((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 7);
    }
    this.lastDigCount = this.w.digs.length;
    while (this.w.openedQueue.length) {
      const o = this.w.openedQueue.shift() as { k: number; n: number };
      this.log((o.k % m.w) * TILE + 8, Math.floor(o.k / m.w) * TILE + 8, `岩の向こうの空洞を掘り当てた（${o.n}マス）`);
    }
    while (this.w.collapseQueue.length) {
      const o = this.w.collapseQueue.shift() as { k: number; n: number };
      const x = (o.k % m.w) * TILE + 8;
      const y = Math.floor(o.k / m.w) * TILE + 8;
      this.log(x, y, `天井が崩れ落ちた`);
      this.noise(x, y, 22);
      this.effects.push({ x, y, t: this.w.tick });
      this.nearby(x, y, 3, (c) => {
        if (c.dead || c.away || [Kind.Worm, Kind.Golem, Kind.Ghost, Kind.Wisp].includes(c.k)) return;
        if ((c.k === Kind.Bat || c.k === Kind.Wyvern) && c.st !== 0) return;
        const k = this.tileOf(c.x, c.y);
        if (k >= 0 && m.solid[k]) this.die(c, 'crushed');
      });
    }
    if (this.effects.length && this.w.tick - this.effects[0].t > 200) this.effects.shift();
    while (this.blood.length && this.w.tick - this.blood[0].t > DAY_TICKS_ECO / 2) this.blood.shift();
  }

  private lastDigCount = -1;
  /** 崩落の土ぼこり（描画だけに使う、保存しない） */
  effects: { x: number; y: number; t: number }[] = [];

  // ---------- 傷と戦い ----------

  /** 体力の上限（強さに比例） */
  maxHp(c: Cr): number {
    return Math.round(4 + this.str(c) * 5);
  }

  /** 血の跡（描画だけに使う。地上の半日ほどで消える） */
  blood: { x: number; y: number; t: number; c: number; v: number }[] = [];
  private bleed(c: Cr, n: number): void {
    const col = BLOOD[c.k];
    if (col < 0) return;
    for (let i = 0; i < n; i++) {
      this.blood.push({ x: Math.round(c.x + ((ih(c.id, this.step, 160 + i) % 9) - 4)), y: Math.round(c.y + ((ih(c.id, this.step, 170 + i) % 5) - 1)), t: this.w.tick, c: col, v: ih(c.id, this.step, 180 + i) & 3 });
    }
    if (this.blood.length > 400) this.blood.splice(0, this.blood.length - 400);
  }

  /** 一打ち：強さと仲間の数で傷を与える。倒せば true */
  private strike(a: Cr, d: Cr, mul = 1): boolean {
    const allies = (c: Cr) => {
      let n = 0;
      this.nearby(c.x, c.y, 2, (o) => {
        if (o !== c && !o.dead && o.k === c.k && sq(o.x - c.x) + sq(o.y - c.y) < 40 * 40) n++;
      });
      return Math.min(3, n);
    };
    if (d.hp <= 0) d.hp = this.maxHp(d);
    const sa = this.str(a) * (1 + 0.4 * allies(a));
    const dmg = sa * (1.2 + (ih(a.id, d.id ^ this.step, 161) % 1000) / 1000 * 1.2) * mul;
    d.hp -= dmg;
    d.hitAt = this.w.tick;
    d.foe = a.id;
    d.sleep = 0;
    this.fxHits.push({ t: this.w.tick, x: d.x, y: d.y, ax: a.x, ay: a.y, id: d.id });
    if (this.fxHits.length > 120) this.fxHits.splice(0, 40);
    this.pushAttackFx(a, d, dmg > this.maxHp(d) * 0.4, d.hp <= 0);
    this.raiseAlarm(d, a);
    this.bleed(d, 1);
    this.noise(d.x, d.y, 9);
    return d.hp <= 0;
  }

  /**
   * 戦い：打ち合い。攻める側が一打ち、守る側が打ち返す。体力が尽きた方が倒れる。
   * 勝てば（攻める側が）食べるか倒すかする。打ち合いは数回で決まる（通常速度で1〜2秒）
   */
  private fight(a: Cr, d: Cr): boolean {
    a.act = 2;
    a.actT = 0;
    if (a.hp <= 0) a.hp = this.maxHp(a);
    if (this.strike(a, d)) {
      if (a.k === Kind.Skeleton || a.k === Kind.Lich || a.k === Kind.Dwarf || a.k === Kind.Golem || a.k === Kind.Gargoyle || (a.k === Kind.Adventurer && d.k !== Kind.Rat)) this.die(d, 'fight', a.k);
      else this.eat(a, d);
      return true;
    }
    // 打ち返し（逃げている者は打ち返さない）
    if (d.flee <= 0 && this.str(d) > 0) {
      d.act = 2;
      d.actT = 0;
      if (this.strike(d, a, 0.8)) {
        this.die(a, 'fight', d.k);
        return false;
      }
    }
    return false;
  }

  /** 体力の回復と、逃げる判断。true なら今は逃げている（ほかの行いをしない） */
  private woundsAndFlight(c: Cr): boolean {
    const mx = this.maxHp(c);
    if (c.hp <= 0 || c.hp > mx) c.hp = mx;
    // 回復：ゆっくり。住みかや巣、食べたばかりなら早く。トロールは見る間にふさがる（炎の傷は除く）。骨と石は自分では治らない
    if (c.hp < mx && c.k !== Kind.Skeleton && c.k !== Kind.Golem && c.k !== Kind.Gargoyle) {
      const home = sq(c.hx - c.x) + sq(c.hy - c.y) < 3 * TILE * 3 * TILE && (c.hx || c.hy);
      const every = c.k === Kind.Troll ? 8 : c.sleep > 0 ? 12 : home || c.sinceMeal < 200 ? 20 : 60;
      if (this.step % every === c.id % every) {
        const k = this.tileOf(c.x, c.y);
        const burnt = k >= 0 && this.w.ash[k] > 0 && c.k === Kind.Troll;
        if (!burnt) c.hp = Math.min(mx, c.hp + Math.max(1, mx / 40));
      }
    }
    // 深手の者は血の跡を点々と残す
    if (c.hp < mx * 0.5 && c.act === 1 && this.step % 18 === c.id % 18) this.bleed(c, 1);
    // 逃げる判断
    const tier = TIER[c.k] ?? 1;
    if (c.flee > 0) c.flee--;
    else if (tier > 0 && c.hp < mx * FLEE_AT[tier] && this.w.tick - c.hitAt < 60 && c.k !== Kind.Adventurer && c.k !== Kind.Dwarf) c.flee = 120 + (ih(c.id, this.step, 162) % 80);
    if (c.flee <= 0) return false;
    const f = this.byId.get(c.foe);
    c.act = 1;
    const sp = SPEC[c.k].speed * 1.2;
    // コボルトは、追っ手がすぐそば（6マス）にいるあいだは住処へ向かわず、まず追っ手から離れる（追っ手の脇をすり抜けて帰ろうとしない）
    const closeFoe = c.k === Kind.Kobold && f && !f.dead && sq(f.x - c.x) + sq(f.y - c.y) < 6 * TILE * 6 * TILE;
    if ((c.hx || c.hy) && !closeFoe) {
      // 巣や住みかへ逃げ帰る
      if (sq(c.hx - c.x) + sq(c.hy - c.y) > 20 * 20) {
        this.goTo(c, c.hx, c.hy, sp);
        return true;
      }
    }
    if (f && !f.dead) {
      const dx = c.x - f.x;
      const dy = c.y - f.y;
      const L = Math.sqrt(dx * dx + dy * dy) || 1;
      this.tryMove(c, (dx / L) * sp, (dy / L) * sp);
    } else c.flee = 0;
    return true;
  }

  /** 深手を負った者は足を引きずって遅くなる */
  private limp(c: Cr): number {
    if (c.hp <= 0) return 1;
    const r = c.hp / this.maxHp(c);
    return r < 0.35 ? 0.6 : 1;
  }

  // ---------- 群れ ----------

  /**
   * 群れの一覧（毎刻み、生き物の状態から作り直す。保存しなくても同じものができる）。
   * 群れの身元は、それぞれの種がもともと持っている仲間の覚え方を使う：
   * 大ネズミとオークは巣の場所、コウモリはねぐら（主のヴァンパイアがいればその群れ）、アリ・コボルト・ゴブリン・リザードマンは所属する巣、
   * 冒険者は一行、ドワーフは住みか、ヴァンパイアは自分が率いる群れ。それ以外の種は群れない。
   * type：0 巣を持つ群れ（集まる場所は巣）、1 旅する群れ（集まる場所は先頭）
   */
  groups = new Map<string, { key: string; k: number; type: number; hx: number; hy: number; members: Cr[] }>();
  /** 警戒：群れの仲間が襲われた（群れの身元 → 刻み、襲ってきた相手、場所） */
  private alarms = new Map<string, { t: number; foe: number; x: number; y: number }>();

  /** 群れの身元の控え（毎刻み、群れの一覧を作るときに作り直す。刻みの途中で変わった者は控えを使わずに求める） */
  private gkCache = new Map<number, string | null>();
  groupKey(c: Cr): string | null {
    const hit = this.gkCache.get(c.id);
    if (hit !== undefined) return hit;
    return this.groupKeyRaw(c);
  }
  /** 群れの身元の文字列の控え（種と二つの数が同じなら同じ文字列。作り直しを減らすだけで、値は同じ） */
  private gkMemo = new Map<number, [string, number, number, string]>();
  private memoKey(c: Cr, p: string, a: number, b: number): string {
    const mm = this.gkMemo.get(c.id);
    if (mm && mm[0] === p && mm[1] === a && mm[2] === b) return mm[3];
    const key = `${p}${a},${b}`;
    this.gkMemo.set(c.id, [p, a, b, key]);
    return key;
  }
  private groupKeyRaw(c: Cr): string | null {
    switch (c.k) {
      case Kind.Rat:
        return c.hx || c.hy ? this.memoKey(c, 'r', c.hx, c.hy) : null;
      case Kind.Bat:
        return c.ref2 ? `v${c.ref2}` : c.tx || c.ty ? this.memoKey(c, 'b', c.tx, c.ty) : null;
      case Kind.Vampire:
        return `v${c.id}`;
      case Kind.Orc:
        return c.hx || c.hy ? this.memoKey(c, 'o', c.hx, c.hy) : null;
      case Kind.Ant:
      case Kind.Kobold:
      case Kind.Goblin:
      case Kind.Lizardman:
        return c.ref > 0 ? `${c.k}:${c.ref}` : null;
      case Kind.Adventurer:
        return c.party ? `p${c.party}` : null;
      case Kind.Dwarf:
        return this.hold ? 'd' : null;
      default:
        return null;
    }
  }

  private buildGroups(): void {
    this.groups.clear();
    this.gkCache.clear();
    for (const c of this.list) {
      if (c.dead || c.away) continue;
      const key = this.groupKeyRaw(c);
      this.gkCache.set(c.id, key);
      if (!key) continue;
      let g = this.groups.get(key);
      if (!g) {
        const travel = c.k === Kind.Adventurer || c.k === Kind.Orc || key[0] === 'v';
        g = { key, k: c.k, type: travel ? 1 : 0, hx: c.hx, hy: c.hy, members: [] };
        this.groups.set(key, g);
      }
      g.members.push(c);
    }
    for (const g of this.groups.values()) {
      if (g.type === 1) {
        // 旅する群れの集まる場所は先頭（ヴァンパイアの群れはヴァンパイア）
        const lead = g.key[0] === 'v' ? g.members.find((c) => c.k === Kind.Vampire) ?? g.members[0] : g.members[0];
        g.hx = lead.x;
        g.hy = lead.y;
      }
    }
    for (const [key, a] of this.alarms) if (this.step - a.t > 80) this.alarms.delete(key);
  }

  /** 群れの仲間が襲われたら、群れに警戒を伝える */
  private raiseAlarm(d: Cr, a: Cr): void {
    const key = this.groupKey(d);
    if (!key || this.groupKey(a) === key) return;
    this.alarms.set(key, { t: this.step, foe: a.id, x: Math.round(d.x), y: Math.round(d.y) });
  }

  /**
   * 警戒への反応（同調）：動物の群れは皆で逃げ、狡猾な種と知性ある種の群れは近くの仲間が駆けつけて加勢する。
   * true なら今は警戒に従っている
   */
  private heedAlarm(c: Cr): boolean {
    if (!this.alarms.size) return false;
    const key = this.groupKey(c);
    if (!key) return false;
    const a = this.alarms.get(key);
    if (!a || c.flee > 0) return false;
    const foe = this.byId.get(a.foe);
    if (!foe || foe.dead || sq(a.x - c.x) + sq(a.y - c.y) > 10 * TILE * 10 * TILE) return false;
    const tier = TIER[c.k] ?? 1;
    // コボルトは、自分よりずっと強い相手には加勢せず、皆で逃げる
    if (tier <= 1 || (c.k === Kind.Kobold && this.str(foe) > this.str(c) * 2)) {
      c.flee = 60 + (ih(c.id, a.t, 198) % 40);
      c.foe = foe.id;
      return false;
    }
    // 加勢：冒険者とドワーフはもともと見えている敵と戦うので、ここでは扱わない
    if (c.k === Kind.Adventurer || c.k === Kind.Dwarf) return false;
    // 知性ある者は、かなわない相手には加勢しない
    if (tier >= 3 && this.str(foe) > this.str(c) * 2) return false;
    c.act = 1;
    if (sq(foe.x - c.x) + sq(foe.y - c.y) < 14 * 14) this.fight(c, foe);
    else this.goTo(c, foe.x, foe.y, SPEC[c.k].speed * 1.1);
    return true;
  }

  /** 群れの分家と合流（地上の時間で1分ごと） */
  private tendGroups(): void {
    const m = this.w.map;
    // 大ネズミ：巣穴が8匹を超えたら、若い3匹が新しい巣穴へ分かれる
    for (const b of this.burrows.slice()) {
      const res = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y);
      if (res.length <= 8 || this.burrows.length >= 24) continue;
      // 空きのある巣穴か、新しい巣穴
      const nb = this.pickBurrow();
      if (nb.x === b.x && nb.y === b.y) continue;
      for (const c of res.sort((p, q) => q.bornAt - p.bornAt).slice(0, 3)) {
        c.hx = nb.x;
        c.hy = nb.y;
      }
    }
    // まわりの苔が尽きてきた巣穴は、苔の豊かな所へ引っ越す（一匹あたり150に満たなければ）
    for (const b of this.burrows) {
      const n = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y).length;
      if (n > 0 && this.burrowFood(b.x, b.y) < n * 150) this.relocateBurrow(b);
    }
    // はぐれた大ネズミは、近くの空きのある巣穴に加わる
    for (const c of this.list) {
      if (c.dead || c.k !== Kind.Rat) continue;
      if ((c.hx || c.hy) && this.burrows.some((b) => b.x === c.hx && b.y === c.hy)) continue;
      let best: { x: number; y: number } | null = null;
      let bd = 30 * TILE * 30 * TILE;
      for (const b of this.burrows) {
        const d = sq(b.x - c.x) + sq(b.y - c.y);
        if (d < bd && this.list.filter((o) => o.k === Kind.Rat && !o.dead && o.hx === b.x && o.hy === b.y).length < 8) {
          bd = d;
          best = b;
        }
      }
      if (best) {
        c.hx = best.x;
        c.hy = best.y;
      }
    }
    // ゴブリンとリザードマン：集落を失った者は、近くの同じ種の集落に加わる。ゴブリンの集落が15を超えたら、5匹が新しい集落を作る
    for (const c of this.list) {
      if (c.dead || (c.k !== Kind.Goblin && c.k !== Kind.Lizardman) || c.st === 9 || c.st === 10) continue;
      const kind = c.k === Kind.Goblin ? 0 : 1;
      if (this.camps.some((o) => o.id === c.ref && o.id >= 0)) continue;
      const cp = this.camps.filter((o) => o.id >= 0 && o.kind === kind).sort((p, q) => sq(p.x - c.x) + sq(p.y - c.y) - (sq(q.x - c.x) + sq(q.y - c.y)))[0];
      if (cp) c.ref = cp.id;
    }
    for (const cp of this.camps.slice()) {
      if (cp.id < 0 || cp.kind !== 0 || this.camps.filter((o) => o.id >= 0 && o.kind === 0).length >= 3) continue;
      const res = this.campMembers(cp);
      if (res.length <= 15) continue;
      const site = this.pickGoblinCamp(cp, [cp.x, cp.y], Ecology.GOBLIN_MIN_FOOD);
      if (site < 0) continue;
      const nc = this.newCamp(site, 'split');
      for (const c of res.slice(-5)) c.ref = nc.id;
      this.log(nc.x, nc.y, `{k:${Kind.Goblin}}の群れが分かれ、新しい集落を作った`);
    }
    // コボルト：住処を失った者は、近くの住処に加わる
    for (const c of this.list) {
      if (c.dead || c.k !== Kind.Kobold || c.st === 10) continue;
      if (this.warrens.some((o) => o.id === c.ref)) continue;
      const wr = this.warrens.slice().sort((p, q) => sq(p.x - c.x) + sq(p.y - c.y) - (sq(q.x - c.x) + sq(q.y - c.y)))[0];
      if (wr) c.ref = wr.id;
    }
  }

  /** 縄張り：群れない種のうち縄張りを持つものは、同じ種が近づくと、強いほうが威嚇して弱いほうを退かせる（殺し合いにはしない） */
  static TERRITORY: Record<number, number> = { [Kind.Spider]: 6, [Kind.Lizard]: 6, [Kind.Troll]: 10, [Kind.Basilisk]: 10, [Kind.Minotaur]: 10, [Kind.Wyvern]: 12 };
  private territory(c: Cr): boolean {
    const R = Ecology.TERRITORY[c.k];
    if (!R || c.flee > 0 || this.step % 10 !== c.id % 10) return false;
    let rival: Cr | null = null;
    this.nearby(c.x, c.y, R, (o) => {
      if (rival || o === c || o.dead || o.away || o.k !== c.k || o.flee > 0 || !this.canSense(c, o)) return;
      if (sq(o.x - c.x) + sq(o.y - c.y) < R * TILE * R * TILE) rival = o;
    });
    if (!rival) return false;
    const r = rival as Cr;
    const mine = this.str(c) * (c.hp > 0 ? c.hp / this.maxHp(c) : 1) + (c.id % 7) * 0.001;
    const theirs = this.str(r) * (r.hp > 0 ? r.hp / this.maxHp(r) : 1) + (r.id % 7) * 0.001;
    const [win, lose] = mine >= theirs ? [c, r] : [r, c];
    // 強いほうは相手の方を向いて威嚇し、弱いほうは離れる
    win.dir = Math.abs(lose.x - win.x) > Math.abs(lose.y - win.y) ? (lose.x > win.x ? 2 : 3) : lose.y > win.y ? 0 : 1;
    win.act = 2;
    win.actT = 0;
    lose.flee = 90 + (ih(lose.id, this.step, 199) % 60);
    lose.foe = win.id;
    return win === c;
  }

  // ---------- 眠り ----------

  /**
   * 種ごとの眠り方。kind：none 眠らない、poly 何度も細かく眠る、mono まとまって眠る、half 半分だけ眠る、
   * irreg 不定期に眠る、drift 眠りながらゆっくり動く。when：day 昼、night 夜、any いつでも。
   * 眠気は起きている間に1刻み1ずつたまり、眠っている間は out ずつ減る。th を超えると眠りたくなる（時間帯の外では2倍まで我慢する）
   */
  static SLEEP: Record<number, { kind: string; when: string; th: number; out: number }> = {
    [Kind.Rat]: { kind: 'poly', when: 'any', th: 1800, out: 6 },
    [Kind.Lizard]: { kind: 'poly', when: 'any', th: 1800, out: 6 },
    [Kind.Ant]: { kind: 'poly', when: 'any', th: 1500, out: 6 },
    [Kind.Kobold]: { kind: 'poly', when: 'any', th: 1800, out: 6 },
    [Kind.Wyvern]: { kind: 'half', when: 'night', th: 1500, out: 2 },
    [Kind.Spider]: { kind: 'drift', when: 'any', th: 1500, out: 4 },
    [Kind.Myconid]: { kind: 'drift', when: 'any', th: 1500, out: 4 },
    [Kind.Slime]: { kind: 'drift', when: 'any', th: 1500, out: 4 },
    [Kind.Goblin]: { kind: 'mono', when: 'day', th: 1500, out: 2 },
    [Kind.Orc]: { kind: 'mono', when: 'day', th: 1500, out: 2 },
    [Kind.Dwarf]: { kind: 'mono', when: 'night', th: 1500, out: 2 },
    [Kind.Lizardman]: { kind: 'half', when: 'night', th: 1500, out: 2 },
    [Kind.Troll]: { kind: 'irreg', when: 'any', th: 2600, out: 2.5 },
    [Kind.Minotaur]: { kind: 'irreg', when: 'any', th: 2600, out: 2.5 },
    [Kind.Basilisk]: { kind: 'irreg', when: 'any', th: 2600, out: 2.5 },
    [Kind.Vampire]: { kind: 'mono', when: 'day', th: 1500, out: 2 },
  };

  /** 見張り：群れが休む間、一匹は起きている。地上の2時間ごとに交代する（群れの中で順番に） */
  isSentry(c: Cr, key: string): boolean {
    const g = this.groups.get(key);
    if (!g || g.members.length < 3) return false;
    const shift = Math.floor(this.w.tick / (DAY_TICKS_ECO / 12));
    const awake = g.members.filter((o) => o.flee <= 0);
    return awake.length > 0 && awake[shift % awake.length] === c;
  }

  /**
   * 眠り。眠気がたまり、時間帯が合えば、群れの集まる場所（巣があれば巣、旅する群れは先頭のそば）で眠る。
   * 群れない種は、その場で眠る。まわりの仲間の半分以上が眠っていると眠くなりやすい（同調）。
   * true なら今は眠っている（ふだんの行いをしない。眠りながら動く種は除く）
   */
  private doSleep(c: Cr, day: number, phase: number): boolean {
    const sp = Ecology.SLEEP[c.k];
    if (!sp) {
      c.sleep = 0;
      if (c.drowsy > 0) c.drowsy--;
      return false;
    }
    const night = phase > 0.79 || phase < 0.18;
    const inWindow = sp.when === 'any' || (sp.when === 'night' ? night : !night);
    const key = this.groupKey(c);
    // 大ネズミとコボルトは、ひどく腹が減ると眠っていられない（眠ったまま飢えない）
    const starving = (c.k === Kind.Rat || c.k === Kind.Kobold) && c.hungry > SPEC[c.k].starve * 0.25;
    if (c.sleep > 0) {
      if (starving) {
        c.sleep = 0;
        return false;
      }
      c.drowsy = Math.max(0, c.drowsy - sp.out);
      // 目覚める：眠気が抜けた、時間帯が終わって眠気が半分を切った
      if (c.drowsy <= 0 || (!inWindow && c.drowsy < sp.th / 2) || c.flee > 0 || this.w.tick - c.hitAt < 4) {
        c.sleep = 0;
        return false;
      }
      c.act = 0;
      if (sp.kind === 'drift') return false;
      return true;
    }
    // 起きている：眠気がたまる。仲間の半分以上が眠っていると早くたまる
    let gain = 1;
    if (key && this.step % 10 === c.id % 10) {
      const g = this.groups.get(key);
      if (g && g.members.length >= 2) {
        let near = 0;
        let asleep = 0;
        for (const o of g.members) {
          if (o === c || sq(o.x - c.x) + sq(o.y - c.y) > 6 * TILE * 6 * TILE) continue;
          near++;
          if (o.sleep > 0) asleep++;
        }
        if (near && asleep * 2 >= near) c.drowsy += 20;
      }
    }
    if (sp.kind === 'irreg') gain = 0.5 + (ih(c.id, this.step >> 8, 300) % 100) / 100;
    c.drowsy += gain;
    const th = sp.kind === 'irreg' ? sp.th * (0.6 + (ih(c.id, Math.floor(this.w.tick / DAY_TICKS_ECO), 301) % 80) / 100) : sp.th;
    if (c.drowsy < th || (!inWindow && c.drowsy < th * 2)) return false;
    if (c.act === 2 || c.flee > 0 || this.w.tick - c.hitAt < 60 || starving) return false;
    // 見張りは眠らない
    if (key && this.isSentry(c, key)) return false;
    // 眠る場所：群れの集まる場所へ（遠すぎなければ）。我慢の限界ならその場で
    const g = key ? this.groups.get(key) : undefined;
    if (g && c.drowsy < th * 2.5 && sp.kind !== 'drift') {
      const [sx, sy] = this.slotOf(c, g);
      const d2 = sq(sx - c.x) + sq(sy - c.y);
      if (d2 > 5 * 5 && sq(g.hx - c.x) + sq(g.hy - c.y) < 30 * TILE * 30 * TILE) {
        c.act = 1;
        this.goTo(c, sx, sy, SPEC[c.k].speed);
        if (d2 > 3 * TILE * 3 * TILE) return true;
      }
    }
    c.sleep = sp.kind === 'poly' || sp.kind === 'drift' ? 1 : sp.kind === 'half' ? 3 : 2;
    c.act = 0;
    return true;
  }

  /**
   * もとから眠りにあたる状態を持つ種の眠りを、眠りの印として揃える（見た目と、寝込みを襲われることのため）：
   * 宝の上のドラゴン、目覚める前のワーム、ねぐらのコウモリ、焚き火を囲む冒険者（見張りを除く）は深い眠り
   */
  private syncLongSleep(): void {
    for (const c of this.list) {
      if (c.dead || Ecology.SLEEP[c.k]) continue;
      let z = 0;
      if (c.k === Kind.Dragon && c.st === 0) z = this.dragonLightSleep(c) ? 1 : 2;
      else if (c.k === Kind.Worm && c.st === 0) z = 2;
      else if (c.k === Kind.Bat && c.st === 0 && !c.away) z = 2;
      else if (c.k === Kind.Adventurer) {
        const p = this.parties.find((q) => q.id === c.party);
        if (p && (p.camp ?? -1) >= 0 && p.members[0] !== c.id && c.act === 0) z = 2;
      }
      c.sleep = z;
    }
  }

  /**
   * 群れの集まる場所での、一匹ずつの居場所（整列させず、揺らぎを持たせる）。
   * 大ネズミは巣穴の口に身を寄せ合い、それ以外は集まる場所のまわりに散らばる
   */
  private slotOf(c: Cr, g: { hx: number; hy: number; members: Cr[] }): [number, number] {
    const i = Math.max(0, g.members.indexOf(c));
    const huddle = c.k === Kind.Rat || c.k === Kind.Ant;
    const gap = huddle ? 6 : Ecology.bodySize(c.k) * 1.1;
    const a = i * 2.39996 + (c.id % 13) * 0.21;
    const r = i === 0 ? 0 : gap * (0.7 + Math.sqrt(i) * 0.9);
    const jx = ((c.id * 37) % 7) - 3;
    const jy = ((c.id * 53) % 5) - 2;
    return [g.hx + Math.cos(a) * r + jx, g.hy + Math.sin(a) * r * 0.75 + jy];
  }

  /** 体の大きさ（間合いの目安。画素） */
  static bodySize(k: number): number {
    if (k === Kind.Dragon || k === Kind.Worm) return 40;
    if (k === Kind.Golem || k === Kind.Troll || k === Kind.Minotaur || k === Kind.Wyvern) return 18;
    if (k === Kind.Orc || k === Kind.Lizardman || k === Kind.Adventurer || k === Kind.Dwarf || k === Kind.Vampire || k === Kind.Skeleton || k === Kind.Lich || k === Kind.Basilisk || k === Kind.Lizard || k === Kind.Zombie) return 11;
    if (k === Kind.Rat || k === Kind.Ant || k === Kind.Bat || k === Kind.Kobold || k === Kind.Goblin || k === Kind.Spider || k === Kind.Myconid || k === Kind.Slime) return 8;
    return 0;
  }

  /**
   * やわらかい間合い：近すぎる者どうしは、毎刻み少しだけ離れる。止まっている者どうしほど強く、
   * 歩いている者どうしはごく弱く（すれ違いや交差はそのままできる）。動きを止めたり向きを変えさせたりはしない。
   * 群れで寄り添う種（大ネズミ、アリ、コウモリ）は間合いが小さい
   */
  private personalSpace(): void {
    for (const c of this.list) {
      if (c.dead || c.away) continue;
      const sa = Ecology.bodySize(c.k);
      if (!sa) continue;
      if (c.k === Kind.Bat && c.st !== 0) continue;
      const stillA = c.act === 0 || c.sleep > 0;
      this.nearby(c.x, c.y, 2, (o) => {
        if (o === c || o.dead || o.away || o.id < c.id) return;
        const sb = Ecology.bodySize(o.k);
        if (!sb || (o.k === Kind.Bat && o.st !== 0)) return;
        const huddle = (c.k === o.k && (c.k === Kind.Rat || c.k === Kind.Ant || c.k === Kind.Bat)) ? 0.65 : 1;
        const r = ((sa + sb) / 2) * huddle;
        const dx = o.x - c.x;
        const dy = (o.y - c.y) * 1.3;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) return;
        const stillB = o.act === 0 || o.sleep > 0;
        const k = stillA && stillB ? 0.25 : stillA || stillB ? 0.08 : 0.03;
        let d = Math.sqrt(d2);
        let ux = dx;
        let uy = dy;
        if (d < 0.01) {
          const a = ((c.id * 7919 + o.id * 104729) % 628) / 100;
          ux = Math.cos(a);
          uy = Math.sin(a);
          d = 1;
        }
        const push = Math.min(1.2, (r - d) * k);
        const px = (ux / d) * push;
        const py = (uy / d) * push * 0.77;
        // 大きいほうは動きにくい
        const wa = sb / (sa + sb);
        const wb = sa / (sa + sb);
        if (this.passable(c, c.x - px * wa, c.y - py * wa)) {
          c.x -= px * wa;
          c.y -= py * wa;
        }
        if (this.passable(o, o.x + px * wb, o.y + py * wb)) {
          o.x += px * wb;
          o.y += py * wb;
        }
      });
    }
  }

  /** 物音や、すぐそばの気配で目覚める（深い眠りは近い音だけ） */
  private wakeByNoise(): void {
    for (const n of this.noises) {
      if (this.step - n.t > 2) continue;
      this.nearby(n.x, n.y, n.r, (c) => {
        if (c.sleep <= 0) return;
        const r = c.sleep === 2 ? n.r * 0.4 : c.sleep === 3 ? n.r * 1.2 : n.r * 0.8;
        if (sq(c.x - n.x) + sq(c.y - n.y) < r * TILE * r * TILE) c.sleep = 0;
      });
    }
  }

  // ---------- 生き物の様子（画面の札のため。シミュレーションには関わらない） ----------

  /** 触れた場所のいちばん近い生き物（死骸は除く） */
  pick(wx: number, wy: number): Cr | null {
    let best: Cr | null = null;
    let bd = 1e18;
    for (const c of this.list) {
      if (c.dead || c.away) continue;
      const r = c.k === Kind.Dragon || c.k === Kind.Worm ? 40 : c.k === Kind.Wyvern || c.k === Kind.Golem || c.k === Kind.Troll || c.k === Kind.Minotaur ? 22 : 14;
      const d = sq(c.x - wx) + sq(c.y - 8 - wy);
      if (d < r * r && d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  /** 生き物の名前と、いまの様子と、属する群れを、短い言葉で */
  describe(c: Cr, names: string[], jobs: string[]): { title: string; lines: string[] } {
    const known = !!this.discovered[c.k];
    let title = known ? names[c.k] : '見知らぬ影';
    if (c.elite) {
      const nm = this.names.get(c.id) ?? '';
      title = [`${title}`, `火の精「${nm}」`, `亡霊の騎士「${nm}」`, title, `大ネズミの王「${nm}」`, `ゴブリンの頭「${nm}」`, `水の精「${nm}」`, `光の精「${nm}」`, `骨の竜「${nm}」`, `キノコの主「${nm}」`][c.elite] ?? title;
    }
    if (known && c.k === Kind.Adventurer) title += `（${jobs[c.sp]}）`;
    if (known && c.k === Kind.Dwarf) title += `（${['坑夫', '鍛冶屋', '戦士'][c.sp]}）`;
    if (c.k === Kind.Rat && this.w.tick - c.bornAt < DAY_TICKS_ECO / 4) title += '（子）';
    const lines: string[] = [];
    const key = this.groupKey(c);
    const party = c.k === Kind.Adventurer ? this.parties.find((p) => p.id === c.party) : undefined;
    let state = '';
    if (c.sleep === 2) state = 'ぐっすり眠っている';
    else if (c.sleep === 1) state = Ecology.SLEEP[c.k]?.kind === 'drift' ? '眠りながらゆっくり動いている' : 'うとうと眠っている';
    else if (c.sleep === 3) state = '半分だけ眠っている（片目を開けたまま）';
    else if (c.flee > 0) state = '逃げている';
    else if (c.act === 2 && this.w.tick - c.hitAt < 120) state = '戦っている';
    else if (c.k === Kind.Golem) state = '宝物庫の入口を見張っている';
    else if (c.k === Kind.Dragon) state = c.st === 2 ? '飛んでいる' : c.foe ? '宝を盗った者を追っている' : '目を覚まして獲物を探している';
    else if (party && (party.camp ?? -1) >= 0) state = party.members[0] === c.id ? '焚き火のそばで見張りをしている' : '焚き火で休んでいる';
    else if (party && party.goal === 1) state = '引き返している';
    else if (key && this.isSentry(c, key) && this.groups.get(key)!.members.some((o) => o.sleep > 0)) state = '群れの見張りをしている';
    else if (c.act === 2) state = '何かをしている';
    else if (c.hungry) state = '腹をすかせて餌を探している';
    else if (c.act === 1) state = '歩き回っている';
    else state = 'じっとしている';
    lines.push(state);
    if (c.hp > 0) {
      const r = c.hp / this.maxHp(c);
      if (r < 0.35) lines.push('深手を負っている');
      else if (r < 0.7) lines.push('傷ついている');
    }
    const sp = Ecology.SLEEP[c.k];
    if (sp && c.sleep === 0 && c.drowsy > sp.th) lines.push('眠そうにしている');
    if (key) {
      const g = this.groups.get(key);
      const n = g ? g.members.length : 1;
      if (c.k === Kind.Adventurer) lines.push(`冒険者の一行（${n}人）`);
      else if (c.k === Kind.Dwarf) lines.push(`ドワーフの一団（${n}人）`);
      else if (n > 1) lines.push(`${known ? names[c.k] : '見知らぬ影'}の群れ（${n}匹）`);
      else lines.push('群れからはぐれている');
    } else if (Ecology.TERRITORY[c.k]) lines.push('一匹で縄張りを持って暮らしている');
    return { title, lines };
  }

  // ---------- 人の気配（危険の勾配） ----------

  /**
   * 人の気配：区画（8×8マス）ごとの濃さ（0〜1）。入口から通路をたどった道のりが短いほど濃い（base）。
   * 冒険者とドワーフが通ると跡が残り、ゆっくり薄れる（trace）。焚き火とランプのまわりも濃い。
   * 強いモンスターは、住みかやうろつく先、休む場所を選ぶとき、強いほど気配の濃い所を避けやすい（獲物を追うときは気にしない）
   */
  presenceBase = new Float32Array(Math.ceil(192 / CELL) * Math.ceil(144 / CELL));
  presenceTrace = new Float32Array(Math.ceil(192 / CELL) * Math.ceil(144 / CELL));

  private updatePresenceBase(): void {
    const m = this.w.map;
    const N = m.w * m.h;
    const dist = new Int32Array(N).fill(-1);
    const q = new Int32Array(N);
    let h = 0;
    let t = 0;
    for (let x = m.entrance.x; x <= m.entrance.x + 1; x++) {
      const k = 1 * m.w + x;
      if (!m.solid[k]) {
        dist[k] = 0;
        q[t++] = k;
      }
    }
    while (h < t) {
      const k = q[h++];
      for (const n of [k + 1, k - 1, k + m.w, k - m.w]) {
        if (n < 0 || n >= N || dist[n] >= 0 || m.solid[n] || m.sealed[n]) continue;
        dist[n] = dist[k] + 1;
        q[t++] = n;
      }
    }
    const cw = Math.ceil(m.w / CELL);
    const best = new Int32Array(this.presenceBase.length).fill(1 << 30);
    for (let k = 0; k < N; k++) {
      if (dist[k] < 0) continue;
      const c = Math.floor(Math.floor(k / m.w) / CELL) * cw + Math.floor((k % m.w) / CELL);
      if (dist[k] < best[c]) best[c] = dist[k];
    }
    for (let c = 0; c < best.length; c++) this.presenceBase[c] = best[c] === 1 << 30 ? 0 : Math.exp(-best[c] / 45);
  }

  private updatePresenceTrace(): void {
    if (this.step % 10 === 3) {
      for (const c of this.list) {
        if (c.dead || c.away || (c.k !== Kind.Adventurer && c.k !== Kind.Dwarf)) continue;
        const cell = this.cellOf(c.x, c.y);
        if (cell >= 0 && cell < this.presenceTrace.length) this.presenceTrace[cell] = Math.min(1, this.presenceTrace[cell] + 0.02);
      }
    }
    if (this.step % 50 === 17) for (let i = 0; i < this.presenceTrace.length; i++) this.presenceTrace[i] *= 0.996;
  }

  /** その場所の人の気配の濃さ（0〜1） */
  presenceAt(x: number, y: number): number {
    const cell = this.cellOf(x, y);
    if (cell < 0 || cell >= this.presenceBase.length) return 0;
    let p = this.presenceBase[cell] + this.presenceTrace[cell];
    for (const pt of this.parties) if ((pt.camp ?? -1) >= 0 && this.cellOf(((pt.camp as number) % this.w.map.w) * TILE, Math.floor((pt.camp as number) / this.w.map.w) * TILE) === cell) p += 0.4;
    return Math.min(1, p);
  }

  /** 強いモンスターは、気配の濃い所から少しずつ離れる（追っているとき、戦っているとき、逃げているときは気にしない） */
  private shyOfPeople(c: Cr): boolean {
    if (STR[c.k] < 7 || [Kind.Adventurer, Kind.Dwarf, Kind.Golem, Kind.Dragon, Kind.Worm, Kind.Mimic, Kind.Gargoyle, Kind.Lich].includes(c.k)) return false;
    const st = this.str(c);
    if (st < 10 || c.act === 2 || c.flee > 0 || c.sleep > 0 || this.w.tick - c.hitAt < 300) return false;
    const p = this.presenceAt(c.x, c.y);
    const excess = p - Math.max(0.2, 0.9 - st * 0.02);
    if (excess <= 0 || ih(c.id, this.step, 207) % 100 >= excess * 120) return false;
    // 気配の薄いほうへ一歩
    let bx = 0;
    let by = 0;
    let bp = p;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const pp = this.presenceAt(c.x + dx * CELL * TILE, c.y + dy * CELL * TILE);
      if (pp < bp) {
        bp = pp;
        bx = dx;
        by = dy;
      }
    }
    if (!bx && !by) return false;
    c.act = 1;
    this.tryMove(c, bx * SPEC[c.k].speed, by * SPEC[c.k].speed);
    return true;
  }

  // ---------- 気づき方、火を怖がる、光に寄る ----------

  /**
   * 種ごとの気づき方：eye 光に頼る目、night 夜目、smell 匂い、vib 振動、echo 反響、magic 魔法の感知。
   * 書かれていない種は夜目と同じ
   */
  static SENSE: Record<number, string> = {
    [Kind.Adventurer]: 'eye', [Kind.Lizard]: 'eye', [Kind.Lizardman]: 'eye', [Kind.Basilisk]: 'eye', [Kind.Wyvern]: 'eye',
    [Kind.Goblin]: 'night', [Kind.Kobold]: 'night', [Kind.Orc]: 'night', [Kind.Dwarf]: 'night', [Kind.Vampire]: 'night', [Kind.Dragon]: 'night',
    [Kind.Rat]: 'smell', [Kind.Ant]: 'smell', [Kind.Troll]: 'smell', [Kind.Zombie]: 'smell', [Kind.Minotaur]: 'smell', [Kind.Slime]: 'smell',
    [Kind.Spider]: 'vib', [Kind.Worm]: 'vib', [Kind.Mimic]: 'vib',
    [Kind.Bat]: 'echo',
    [Kind.Ghost]: 'magic', [Kind.Lich]: 'magic', [Kind.Wisp]: 'magic', [Kind.Gargoyle]: 'magic', [Kind.Golem]: 'magic', [Kind.Skeleton]: 'magic', [Kind.Salamander]: 'magic',
  };

  /** その刻みに明るいマス（光源と、光る生き物の光が届く所。壁の遮りは見ない）。毎刻み作り直す */
  private litMap = new Uint8Array(0);
  private litMapStep = -1;
  private litMarked: number[] = [];
  private buildLitMap(): void {
    const m = this.w.map;
    if (this.litMap.length !== m.w * m.h) this.litMap = new Uint8Array(m.w * m.h);
    else for (const k of this.litMarked) this.litMap[k] = 0;
    this.litMarked = [];
    this.eachLight((lx, ly, lr) => {
      const R = Math.floor((lr * 0.7) / TILE);
      const cx = Math.floor(lx / TILE);
      const cy = Math.floor(ly / TILE);
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && y >= 0 && x < m.w && y < m.h && !this.litMap[y * m.w + x]) {
            this.litMap[y * m.w + x] = 1;
            this.litMarked.push(y * m.w + x);
          }
        }
    });
    this.litMapStep = this.step;
    this.litMapTick = this.w.tick;
  }
  private litMapTick = -1;

  /** その者が明るい所にいるか（目で見る者から見える明るさ） */
  isLit(o: Cr): boolean {
    // 明るさの地図は、毎刻みの初めに作り直してある（読み込み直しても同じになるように）
    if (this.litMapTick !== this.w.tick) this.buildLitMap();
    const k = this.tileOf(o.x, o.y);
    return k >= 0 && (this.litMap[k] === 1 || this.lit(k, this.day) > 0.35);
  }

  /** c が o に気づけるか（種ごとの気づき方） */
  canSense(c: Cr, o: Cr): boolean {
    if ((o.st === 7 || o.st === 12) && this.isHidden(o) && !this.atDoorOf(c, o)) return false;
    const d2 = sq(o.x - c.x) + sq(o.y - c.y);
    const T2 = TILE * TILE;
    const sense = Ecology.SENSE[c.k] ?? 'night';
    const los = () => lineOfSight(this.w.map, c.x, c.y, o.x, o.y);
    switch (sense) {
      case 'eye':
        if (d2 < 1.5 * 1.5 * T2) return true;
        return d2 < 64 * T2 && this.isLit(o) && los();
      case 'smell':
        return d2 < 36 * T2;
      case 'vib':
        return d2 < 49 * T2 && o.act === 1 && o.sleep === 0;
      case 'echo':
        return d2 < 36 * T2 && los();
      case 'magic':
        return d2 < 64 * T2 && ![Kind.Zombie, Kind.Skeleton, Kind.Ghost, Kind.Lich, Kind.Golem, Kind.Gargoyle, Kind.Wisp].includes(o.k);
      default:
        if (d2 < 25 * T2) return los();
        return d2 < 64 * T2 && this.isLit(o) && los();
    }
  }

  /** 火を怖がる野の獣 */
  static FEARS_FIRE = new Set<number>([Kind.Rat, Kind.Lizard, Kind.Spider, Kind.Bat, Kind.Ant, Kind.Troll, Kind.Basilisk, Kind.Minotaur]);

  /** 火のある所（焚き火、集落のかがり火、入口のかがり火、鍛冶場、松明、燃えているマス）と、その怖さの届く半径（画素） */
  private fires(): [number, number, number][] {
    if (this.fireStep === this.step) return this.fireList;
    const m = this.w.map;
    const out: [number, number, number][] = [];
    for (const p of this.parties) if ((p.camp ?? -1) >= 0) out.push([((p.camp as number) % m.w) * TILE + 8, Math.floor((p.camp as number) / m.w) * TILE + 8, 4 * TILE]);
    for (const cp of this.camps) if (cp.id >= 0 && (cp.fuel ?? 0) > 0) out.push([cp.x, cp.y + 10, 4 * TILE]);
    const gx = m.entrance.x * TILE + 16;
    out.push([gx - 29, 40, 4 * TILE], [gx + 28, 40, 4 * TILE]);
    if (this.hold && this.hold.forge >= 0) out.push([(this.hold.forge % m.w) * TILE + 8, Math.floor(this.hold.forge / m.w) * TILE + 8, 4 * TILE]);
    for (const c of this.list) if (!c.dead && c.torch > 0 && (c.k === Kind.Adventurer || c.k === Kind.Goblin)) out.push([c.x, c.y, 2.5 * TILE]);
    for (const k of this.burning) out.push([(k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 2 * TILE]);
    this.fireList = out;
    this.fireStep = this.step;
    return out;
  }
  private fireList: [number, number, number][] = [];
  private fireStep = -1;

  /** その場所の、いちばん近い火（怖さの届く中にあれば） */
  /** マスの中心のそばに火があるか（同じ刻みのうちは、マスごとに一度だけ調べる。火の一覧は刻みごとに決まる） */
  private fnStamp = new Int32Array(0);
  private fnVal = new Uint8Array(0);
  private fireNearTile(k: number): boolean {
    const m = this.w.map;
    if (this.fnStamp.length !== m.w * m.h) {
      this.fnStamp = new Int32Array(m.w * m.h).fill(-1);
      this.fnVal = new Uint8Array(m.w * m.h);
    }
    // fires() は刻みごとに作り直すので、刻みの番号で控えを見分ける（fires を先に呼んで、その刻みの一覧を確定させる）
    const fl = this.fires();
    if (this.fnStamp[k] !== this.step) {
      const x = (k % m.w) * TILE + 8;
      const y = Math.floor(k / m.w) * TILE + 8;
      let hit = 0;
      for (const f of fl) if (sq(f[0] - x) + sq(f[1] - y) < f[2] * f[2]) { hit = 1; break; }
      this.fnVal[k] = hit;
      this.fnStamp[k] = this.step;
    }
    return this.fnVal[k] === 1;
  }

  private fireNear(x: number, y: number): [number, number, number] | null {
    for (const f of this.fires()) if (sq(f[0] - x) + sq(f[1] - y) < f[2] * f[2]) return f;
    return null;
  }

  /** 火を怖がる獣は、火のそばから離れる（飢え死にしそうなとき、襲われて打ち返すときは別） */
  private fearFire(c: Cr): boolean {
    if (!Ecology.FEARS_FIRE.has(c.k) || c.sleep > 0 || this.w.tick - c.hitAt < 120) return false;
    // 腹をすかせた大ネズミとコウモリは、眠っている者の食料や血の匂いに惹かれて、火のそばにも忍び寄る
    if ((c.k === Kind.Rat || c.k === Kind.Bat) && c.hungry) return false;
    if (c.sinceMeal > SPEC[c.k].starve * 0.85) return false;
    if (c.k === Kind.Bat && c.st !== 0 && c.st !== 1) return false;
    const f = this.fireNear(c.x, c.y);
    if (!f) return false;
    const dx = c.x - f[0];
    const dy = c.y - f[1];
    const L = Math.sqrt(dx * dx + dy * dy) || 1;
    c.act = 1;
    this.tryMove(c, (dx / L) * SPEC[c.k].speed * 1.2, (dy / L) * SPEC[c.k].speed * 1.2);
    // 大ネズミ：火のそばにある目当ての苔はあきらめ（避ける印をつけて選び直す）、巣穴そのものが火のそばなら群れで移る
    // （以前は、目当てや巣穴へ向かっては火に追い返され、その間を行ったり来たりして先へ進めなかった）
    if (c.k === Kind.Rat) {
      const r2 = f[2] * f[2];
      const t = c.ref - 1;
      if (t >= 0 && sq((t % this.w.map.w) * TILE + 8 - f[0]) + sq(Math.floor(t / this.w.map.w) * TILE + 8 - f[1]) < r2) {
        c.gait = c.ref;
        c.ref = 0;
      }
      if ((c.hx || c.hy) && sq(c.hx - f[0]) + sq(c.hy - f[1]) < r2) {
        const b = this.burrows.find((o) => o.x === c.hx && o.y === c.hy);
        if (b) this.relocateBurrow(b, true);
      }
    }
    return true;
  }

  /**
   * 光に寄る：狡猾な種（ゴブリン、オーク、コボルト）は、冒険者の松明や焚き火を、見通しが利けば20マス先から見つける。
   * 腹が減っているか、ときどき（宝を狙って）、光の届かない暗がりの縁まで近づいて潜み、
   * 冒険者がはぐれたり眠ったりした隙に襲う。潜むのは地上の時間でおよそ4時間まで
   */
  private lurk(c: Cr): boolean {
    if (c.k !== Kind.Goblin && c.k !== Kind.Orc && c.k !== Kind.Kobold) return false;
    // 住処を持つコボルトの群れは、冒険者の灯りに自分から寄っていかない
    if (c.k === Kind.Kobold && (this.warrenOf(c) || c.st === 10)) {
      c.lure = 0;
      return false;
    }
    if (c.flee > 0 || c.sleep > 0 || this.w.tick - c.hitAt < 60) {
      c.lure = 0;
      return false;
    }
    // 集落のゴブリン：散って隠れているあいだと、群れで去る道中は潜まない
    const gcp = c.k === Kind.Goblin ? this.campOf(c) : undefined;
    const camp = gcp && gcp.kind === 0 ? gcp : undefined;
    if (camp && (camp.hide === 1 || c.st === 7)) {
      c.lure = 0;
      return false;
    }
    if (c.st === 10) return false;
    // 頭（ゴブリンの頭）のいる集落は大胆になる
    const bold = !!camp && this.campChief(camp);
    const m = this.w.map;
    // 狙いを探す
    if (!c.lure) {
      // 腹をすかせたゴブリンは、人の食べ物を求めて人の気配の濃い浅い所へ寄っていく
      if (c.k === Kind.Goblin && c.hungry && ih(c.id, this.step, 211) % 4 === 0) {
        const p0 = this.presenceAt(c.x, c.y);
        let bx = 0;
        let by = 0;
        let bp = p0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const pp = this.presenceAt(c.x + dx * CELL * TILE, c.y + dy * CELL * TILE);
          if (pp > bp) {
            bp = pp;
            bx = dx;
            by = dy;
          }
        }
        if (bx || by) {
          c.act = 1;
          this.tryMove(c, bx * SPEC[c.k].speed, by * SPEC[c.k].speed);
        }
      }
      if (this.step % 30 !== c.id % 30 || (!c.hungry && !bold && ih(c.id, this.step, 210) % 3 !== 0)) return false;
      let best: Cr | null = null;
      let bd = 20 * TILE * 20 * TILE;
      for (const o of this.list) {
        if (o.dead || o.away || o.k !== Kind.Adventurer) continue;
        const p = this.parties.find((q) => q.id === o.party);
        const bright = o.torch > 0 || (p && (p.camp ?? -1) >= 0);
        if (!bright) continue;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d >= bd || !lineOfSight(m, c.x, c.y, o.x, o.y)) continue;
        bd = d;
        best = o;
      }
      if (!best) return false;
      c.lure = (best as Cr).id;
      c.lureAt = this.step;
      if (this.step - (this.lastLogged[998] ?? -99999) > 3000) {
        this.lastLogged[998] = this.step;
        this.log(c.x, c.y, `{k:${c.k}}が冒険者の灯りを見つけ、暗がりに潜んだ`);
      }
    }
    const t = this.byId.get(c.lure);
    if (!t || t.dead || t.away || this.step - c.lureAt > 2400) {
      c.lure = 0;
      return false;
    }
    // 隙：まわりに仲間がいない（はぐれた）か、眠っている
    const alone = !this.list.some((o) => o !== t && !o.dead && o.k === Kind.Adventurer && o.party === t.party && sq(o.x - t.x) + sq(o.y - t.y) < 4 * TILE * 4 * TILE);
    // 集落の待ち伏せ：弱い一行が集落のそば（9マス）に踏み込んだら、暗がりから群れで襲いかかる
    const ambush = !!camp && camp.hide === 2 && sq(t.x - camp.x) + sq(t.y - camp.y) < 9 * TILE * 9 * TILE;
    if (alone || t.sleep > 0 || ambush) {
      c.act = 1;
      if (sq(t.x - c.x) + sq(t.y - c.y) < 14 * 14) {
        // はぐれた者には、仲間が2匹以上そばにいるか頭がいれば、盗むのではなく襲いかかる（集落の者だけ）
        let allies = 0;
        if (camp && !ambush) this.nearby(c.x, c.y, 5, (o) => {
          if (o !== c && !o.dead && o.k === Kind.Goblin && o.ref === camp.id && o.flee <= 0) allies++;
        });
        if (c.k === Kind.Goblin && !ambush && !(camp && alone && (allies >= 2 || bold))) {
          // ゴブリンは襲わずに、食料と松明を盗んで逃げる（頭のいる集落は多めに盗る）
          const take = Math.min(bold ? 30 : 20, Math.max(0, t.food - 5), SPEC[Kind.Goblin].cap - c.food);
          t.food -= take;
          c.food += take;
          if (t.torch > 0 && c.torch <= 0) {
            c.torch = t.torch;
            t.torch = 0;
          }
          c.flee = 120;
          c.foe = t.id;
          c.lure = 0;
          if (this.step - (this.lastLogged[997] ?? -99999) > 3000) {
            this.lastLogged[997] = this.step;
            this.log(c.x, c.y, `{k:${Kind.Goblin}}が冒険者の荷物を盗んで逃げた`);
          }
        } else this.fight(c, t);
      } else this.goTo(c, t.x, t.y, SPEC[c.k].speed * 1.2);
      return true;
    }
    // 暗がりの縁（灯りから6〜8マス、明るくない所）に潜む
    const d = Math.sqrt(sq(t.x - c.x) + sq(t.y - c.y));
    if (d > 8 * TILE || this.isLit(c)) {
      const a = ((c.id * 2.399) % 6.283);
      const sx = t.x + Math.cos(a) * 7 * TILE;
      const sy = t.y + Math.sin(a) * 7 * TILE;
      c.act = 1;
      this.goTo(c, sx, sy, SPEC[c.k].speed);
    } else {
      c.act = 0;
      c.dir = Math.abs(t.x - c.x) > Math.abs(t.y - c.y) ? (t.x > c.x ? 2 : 3) : t.y > c.y ? 0 : 1;
    }
    return true;
  }

  // ---------- 島（入口側の洞窟とつながっていない洞窟） ----------

  /** 歩いてつながる洞窟のまとまり（地形が変わるたび＝地形の変化の記録が増えるたびに作り直す。保存しなくても同じものができる） */
  private regionMap = new Int32Array(0);
  private regionVer = -1;
  private mainRegion = -1;
  private mainPointCache = new Map<number, number>();
  regionOf(k: number): number {
    const m = this.w.map;
    if (this.regionVer !== this.w.digs.length || this.regionMap.length !== m.w * m.h) {
      const N = m.w * m.h;
      if (this.regionMap.length !== N) this.regionMap = new Int32Array(N);
      this.regionMap.fill(-1);
      let id = 0;
      const q = new Int32Array(N);
      for (let s0 = 0; s0 < N; s0++) {
        if (this.regionMap[s0] >= 0 || m.solid[s0] || m.sealed[s0]) continue;
        let h = 0;
        let t = 0;
        q[t++] = s0;
        this.regionMap[s0] = id;
        while (h < t) {
          const k2 = q[h++];
          for (const n of [k2 + 1, k2 - 1, k2 + m.w, k2 - m.w]) {
            if (n < 0 || n >= N || this.regionMap[n] >= 0 || m.solid[n] || m.sealed[n]) continue;
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
  onIsland(x: number, y: number): boolean {
    const r = this.regionOf(this.tileOf(x, y));
    return r >= 0 && r !== this.mainRegion;
  }

  /** 島から見て、いちばん近い入口側の洞窟のマス（なければ -1） */
  private nearestMain(tx: number, ty: number): number {
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
  private windTarget(hx: number, hy: number, D: number): number | null {
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

  /**
   * 上の端の横穴：始まりの洞窟との間の薄い岩壁が、3〜5日目のうちに崩れて通じる（自然の出来事）。
   * 横穴の空洞の床から、いちばん近い入口側の洞窟のマスまで、縦と横にまっすぐ掘る（溶岩、宝物庫、迷路は避ける）
   */
  private wallBroken = false;
  private breakTopWall(): void {
    if (this.wallBroken) return;
    const m = this.w.map;
    const i = m.mouths.findIndex((mo) => mo.kind === 0 && mo.y === 0);
    if (i < 0) {
      this.wallBroken = true;
      return;
    }
    const due = DAY_TICKS_ECO * 3 + (ih(m.mouths[i].x, 5, 212) % (DAY_TICKS_ECO * 2));
    if (this.w.tick < due) return;
    this.wallBroken = true;
    if (this.mouthOpen(i)) return;
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
    if (path.some((k) => m.lava[k] || m.vault[k] || m.maze[k])) return;
    for (const k of path) if (m.solid[k]) this.w.dig(k);
    this.log(mx * TILE + 8, py * TILE, '岩壁が崩れ、上の横穴から外の風が吹き込んだ');
    this.noise(mx * TILE + 8, py * TILE, 22);
    void from;
  }

  /** 島で暮らしていた集落や住処が、入口側とつながったら記録に残す */
  private islandIds = new Set<number>();
  private checkJoined(): void {
    const m = this.w.map;
    const homes: [number, number, number, number][] = [
      ...this.camps.filter((c) => c.id >= 0).map((c) => [c.id, c.x, c.y, c.kind === 0 ? Kind.Goblin : Kind.Lizardman] as [number, number, number, number]),
      ...this.warrens.map((w) => [w.id, w.x, w.y, Kind.Kobold] as [number, number, number, number]),
      ...this.colonies.map((c) => [c.id, c.x, c.y, Kind.Ant] as [number, number, number, number]),
    ];
    for (const [id, x, y, k] of homes) {
      const island = this.onIsland(x, y);
      if (island) this.islandIds.add(id);
      else if (this.islandIds.has(id) && this.regionOf(this.tileOf(x, y)) === this.mainRegion) {
        this.islandIds.delete(id);
        this.log(x, y, `{k:${k}}の暮らす洞窟が、入口側の洞窟とつながった`);
      }
    }
    void m;
  }

  // ---------- 見た目のための印（描画だけに使う。シミュレーションの判断には使わない） ----------

  /**
   * 攻撃の演出の記録（描画だけ）。style は技の種類：slash 斬る、jag 荒い振り、stab 突く、smash 殴る、bite 噛む、claw 爪、
   * sting 刺す、arrow 矢、orb 魔法の弾、beam 光線、drain 吸う、chill 冷たい手、acid 溶かす、spore 胞子。
   * col は色（0 白、1 金、2 炎、3 毒、4 魔、5 血、6 石、7 霜）、size は大きさ（0〜2）。big は強い一撃、kill はとどめ
   */
  fxAttacks: { t: number; style: string; col: number; size: number; ax: number; ay: number; dx: number; dy: number; did: number; aid: number; big: boolean; kill: boolean }[] = [];
  /** 強い一撃があった刻み（画面がほんの一瞬「ため」を入れるため。描画だけ） */
  lastBigHit = -1;

  /** 種と職業と武器から、技の種類と色と大きさを決める */
  attackStyle(c: Cr): { style: string; col: number; size: number } {
    if (c.elite === 1) return { style: 'orb', col: 2, size: 2 };
    if (c.elite === 2) return { style: 'slash', col: 7, size: 2 };
    if (c.elite === 6) return { style: 'chill', col: 7, size: 2 };
    if (c.elite === 7) return { style: 'beam', col: 1, size: 1 };
    if (c.elite === 8) return { style: 'bite', col: 6, size: 2 };
    if (c.elite === 9) return { style: 'spore', col: 3, size: 2 };
    if (c.elite === 4) return { style: 'bite', col: 1, size: 1 };
    if (c.elite === 5) return { style: 'slash', col: 1, size: 1 };
    switch (c.k) {
      case Kind.Adventurer:
        return [
          { style: 'slash', col: 0, size: 1 },
          { style: 'orb', col: 2, size: 1 },
          { style: 'stab', col: 0, size: 0 },
          { style: 'smash', col: 1, size: 1 },
          { style: 'stab', col: 0, size: 0 },
          { style: 'arrow', col: 0, size: 0 },
          { style: 'slash', col: 1, size: 2 },
        ][c.sp] ?? { style: 'slash', col: 0, size: 1 };
      case Kind.Rat:
      case Kind.Lizard:
        return { style: 'bite', col: 0, size: 0 };
      case Kind.Worm:
        return { style: 'bite', col: 6, size: 1 };
      case Kind.Mimic:
        return { style: 'mimic', col: 1, size: 1 };
      case Kind.Spider:
        return { style: 'sting', col: 3, size: 0 };
      case Kind.Ant:
        return { style: 'sting', col: 3, size: 0 };
      case Kind.Kobold:
      case Kind.Skeleton:
        return { style: 'stab', col: 0, size: 0 };
      case Kind.Goblin:
        return c.party ? { style: 'slash', col: 0, size: 0 } : { style: 'claw', col: 0, size: 0 };
      case Kind.Orc:
        return { style: 'jag', col: 6, size: 1 };
      case Kind.Wyvern:
        return { style: 'sting', col: 3, size: 1 };
      case Kind.Lizardman:
      case Kind.Zombie:
        return { style: 'claw', col: c.k === Kind.Zombie ? 6 : 0, size: 1 };
      case Kind.Minotaur:
        return { style: 'charge', col: 6, size: 2 };
      case Kind.Golem:
        return { style: 'rune', col: 4, size: 2 };
      case Kind.Troll:
      case Kind.Gargoyle:
        return { style: 'smash', col: 6, size: 2 };
      case Kind.Dwarf:
        return { style: 'slash', col: 1, size: 1 };
      case Kind.Basilisk:
        return { style: 'beam', col: 6, size: 1 };
      case Kind.Vampire:
        return { style: 'bats', col: 5, size: 1 };
      case Kind.Bat:
        return { style: 'drain', col: 5, size: 0 };
      case Kind.Lich:
        return { style: 'orb', col: 4, size: 1 };
      case Kind.Salamander:
        return { style: 'orb', col: 2, size: 0 };
      case Kind.Ghost:
        return { style: 'chill', col: 7, size: 1 };
      case Kind.Slime:
        return { style: 'acid', col: 3, size: 1 };
      case Kind.Myconid:
        return { style: 'spore', col: 3, size: 0 };
      default:
        return { style: 'claw', col: 0, size: 1 };
    }
  }

  /** 特別な個体の名前と、種類ごとの最後に現れた刻み */
  names = new Map<number, string>();
  lastElite: number[] = [];
  nameOf(c: Cr): string {
    const got = this.names.get(c.id);
    if (got) return got;
    const A = ['グ', 'ザ', 'ガ', 'ド', 'ヴァ', 'ル', 'ク', 'モ', 'ネ', 'ス', 'ト', 'バ', 'リ', 'オ', 'ギ', 'ハ'];
    const B = ['ロ', 'ル', 'ラ', 'ム', 'ズ', 'ナ', 'リ', 'ガ', 'ド', 'キ', 'ン', 'レ', 'ゴ', 'ミ'];
    const C = ['ム', 'ス', 'ク', 'ン', 'ド', 'ル', 'グ', 'ト', '', '', ''];
    const h = ih(c.id, 7, 301);
    const nm = A[h % A.length] + B[(h >>> 5) % B.length] + C[(h >>> 10) % C.length];
    this.names.set(c.id, nm);
    return nm;
  }

  /**
   * 個体が育って特別になる（地上の1分ごとに見る）：
   * 大ネズミの王 … 6匹以上の巣穴の群れで、王のいない群れの、生まれて4日以上たったいちばん年長の大ネズミ。
   * ゴブリンの頭 … 5匹以上の集落で、頭のいない集落の、来て4日以上たったいちばん年長のゴブリン。
   */
  private riseLeaders(): void {
    for (const [key, g] of this.groups) {
      const k0 = g.members[0]?.k;
      if (k0 !== Kind.Rat && k0 !== Kind.Goblin) continue;
      const need = k0 === Kind.Rat ? 8 : 5;
      const el = k0 === Kind.Rat ? 4 : 5;
      // ダンジョン全体で同時に一体まで。前の王（頭）が現れてから地上の2日はあける
      if (g.members.length < need || this.list.some((o) => o.elite === el && !o.dead)) continue;
      if (this.w.tick - (this.lastElite[el] ?? -1e9) < DAY_TICKS_ECO * 2) continue;
      let old: Cr | null = null;
      for (const o of g.members) if (!o.dead && this.w.tick - o.bornAt > DAY_TICKS_ECO * 5 && (!old || o.bornAt < old.bornAt)) old = o;
      if (!old) continue;
      const c = old as Cr;
      c.elite = el;
      this.lastElite[el] = this.w.tick;
      this.nameOf(c);
      this.log(c.x, c.y, k0 === Kind.Rat ? `大ネズミ「${this.names.get(c.id)}」が群れの王になった` : `ゴブリン「${this.names.get(c.id)}」が集落の頭になった`);
      void key;
    }
  }

  /** 竜が育った瞬間の演出（古い鱗がはがれ落ち、マナの光が集まる） */
  private pushGrowFx(c: Cr): void {
    this.fxAttacks.push({ t: this.w.tick, style: 'grow', col: 4, size: 2, ax: c.x, ay: c.y, dx: c.x, dy: c.y, did: c.id, aid: c.id, big: true, kill: false });
  }

  /** 幼竜が生まれた場所の卵の殻（地上の3日ほど残る） */
  dragonShell: { x: number; y: number; t: number } | null = null;

  /** 演出の記録を残す（デモからも呼ぶ） */
  pushAttackFx(a: Cr, d: Cr, big: boolean, kill: boolean): void {
    const st = this.attackStyle(a);
    // 体の大きな者ほど、演出も大きく
    const size = Math.min(2, st.size + (Ecology.bodySize(a.k) >= 18 ? 1 : 0));
    this.fxAttacks.push({ t: this.w.tick, style: st.style, col: st.col, size, ax: a.x, ay: a.y, dx: d.x, dy: d.y, did: d.id, aid: a.id, big, kill });
    if (big || kill) this.lastBigHit = this.w.tick;
    if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  }

  /** 攻撃が当たった所（刻み、場所、打った側の場所） */
  fxHits: { t: number; x: number; y: number; ax: number; ay: number; id: number }[] = [];
  /** 気づいた印：「！」（敵や獲物）か「？」（害のない相手） */
  fxMarks: { t: number; id: number; m: string }[] = [];
  private noticed = new Map<number, number>();
  private markNotice(c: Cr, target: Cr, m: string): void {
    if (this.noticed.get(c.id) === target.id) return;
    this.noticed.set(c.id, target.id);
    this.fxMarks.push({ t: this.w.tick, id: c.id, m });
    if (this.fxMarks.length > 120) this.fxMarks.splice(0, 40);
  }

  /**
   * 冒険者が害のない相手に気づいたときの関わり方：
   * 魔法使いはウィスプを瓶に捕まえて灯りにする、狩人は一行の食料が乏しければ大ネズミやコウモリを狩る、
   * 僧侶はゴーストを祓う、吟遊詩人は獣を歌でなだめて道を開けさせる。ほかの者は「？」と見るだけ。true なら今は関わっている
   */
  private advInteract(c: Cr, p: Party, lights: Cr[]): boolean {
    const s = SPEC[Kind.Adventurer];
    // 職業ごとの関わりは、探索中で、食料に余裕があるときだけ（引き返す一行は寄り道しない）
    if (p.goal !== 0 || c.food < s.cap * 0.3) return false;
    let target: Cr | null = null;
    let bd = 6 * TILE * 6 * TILE;
    this.nearby(c.x, c.y, 6, (o) => {
      if (o.dead || o.away || o === c || ![Kind.Wisp, Kind.Bat, Kind.Rat, Kind.Ant, Kind.Myconid, Kind.Ghost, Kind.Salamander, Kind.Lizard, Kind.Spider].includes(o.k)) return;
      if (!this.seenBy(c, lights, o)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        target = o;
      }
    });
    if (!target) return false;
    const t = target as Cr;
    const want =
      (c.sp === Job.Wizard && t.k === Kind.Wisp && c.glow < 120) ||
      (c.sp === Job.Hunter && (t.k === Kind.Rat || (t.k === Kind.Bat && t.st === 0)) && c.food < s.cap * 0.5) ||
      (c.sp === Job.Priest && t.k === Kind.Ghost) ||
      (c.sp === Job.Bard && TIER[t.k] === 1 && t.flee <= 0 && bd < 4 * TILE * 4 * TILE && this.step - c.lureAt > 200);
    this.markNotice(c, t, want ? '!' : '?');
    if (!want) return false;
    c.dir = Math.abs(t.x - c.x) > Math.abs(t.y - c.y) ? (t.x > c.x ? 2 : 3) : t.y > c.y ? 0 : 1;
    const close = bd < 14 * 14;
    if (c.sp === Job.Bard) {
      // 歌でなだめる：まわりの獣は吟遊詩人から離れて道を開ける（次に歌うまで、地上の時間で40秒あける）
      c.lureAt = this.step;
      c.act = 2;
      c.actT = 0;
      this.nearby(c.x, c.y, 4, (o) => {
        if (o.dead || TIER[o.k] !== 1 || o.k === Kind.Wisp) return;
        o.flee = Math.max(o.flee, 60);
        o.foe = c.id;
      });
      if (this.step - (this.lastLogged[995] ?? -99999) > 3000) {
        this.lastLogged[995] = this.step;
        this.log(c.x, c.y, '冒険者（吟遊詩人）が歌で獣をなだめ、道を開けさせた');
      }
      return true;
    }
    if (!close) {
      c.act = 1;
      this.goTo(c, t.x, t.y, s.speed);
      return true;
    }
    c.act = 2;
    c.actT = 0;
    if (c.sp === Job.Wizard) {
      // ウィスプを瓶に捕まえる：魔法使いはしばらく淡く光る（ウィスプの体は魔法使いの荷に入る）
      const into = Math.min(s.cap - c.food, t.body + t.food);
      c.food += into;
      this.deposit(t.x, t.y, t.body + t.food - into);
      t.body = 0;
      t.food = 0;
      c.mana += t.mana;
      t.mana = 0;
      t.dead = 2;
      c.glow = 255;
      if (this.step - (this.lastLogged[994] ?? -99999) > 3000) {
        this.lastLogged[994] = this.step;
        this.log(c.x, c.y, '冒険者（魔法使い）がウィスプを瓶に捕まえた');
      }
    } else if (c.sp === Job.Priest) {
      this.die(t, 'fight', c.k);
      if (this.step - (this.lastLogged[993] ?? -99999) > 3000) {
        this.lastLogged[993] = this.step;
        this.log(c.x, c.y, '冒険者（僧侶）がゴーストを祓った');
      }
    } else if (c.sp === Job.Hunter) {
      if (this.strike(c, t)) this.eat(c, t);
    }
    return true;
  }

  // ---------- 弱い生き物の害 ----------

  /**
   * 弱い生き物が冒険者やドワーフに与える害（地上の時間で数秒ごとに）：
   * 大ネズミは眠っている者の荷をあさって食料をかじる、コウモリは眠っている者の血を吸う（小さな傷）、
   * アリは巣に近づいた者に群れで噛みつく、ウィスプは冒険者を誘って一行の行き先を暗がりへ逸らす、
   * マイコニドは胞子で近くの者の足を鈍らせる、サラマンダーは近づいた者に火傷を負わせる。true なら今は害をなしている
   */
  private pester(c: Cr): boolean {
    if (this.step % 6 !== c.id % 6 || c.sleep > 0 || c.flee > 0) return false;
    const people = (o: Cr) => !o.dead && !o.away && (o.k === Kind.Adventurer || o.k === Kind.Dwarf);
    let t: Cr | null = null;
    let bd = 1e18;
    const R = c.k === Kind.Wisp ? 6 : c.k === Kind.Ant ? 3 : 2;
    this.nearby(c.x, c.y, Math.ceil(R), (o) => {
      if (!people(o)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd && d < R * TILE * R * TILE) {
        bd = d;
        t = o;
      }
    });
    if (!t) return false;
    const o = t as Cr;
    const near = bd < 14 * 14;
    switch (c.k) {
      case Kind.Rat:
        if (o.sleep <= 0 || !c.hungry) return false;
        if (!near) { c.act = 1; this.goTo(c, o.x, o.y, SPEC[c.k].speed); return true; }
        { const take = Math.min(3, o.food, SPEC[c.k].cap - c.food); o.food -= take; c.food += take; c.sinceMeal = 0; c.act = 2; c.actT = 0; c.foe = o.id; }
        return true;
      case Kind.Bat:
        if (o.sleep <= 0 || !c.hungry) return false;
        if (!near) { c.act = 1; this.goTo(c, o.x, o.y, SPEC[c.k].speed); return true; }
        if (this.strike(c, o, 0.3) && o.hp <= 0) this.die(o, 'killed', c.k);
        { const take = Math.min(2, SPEC[c.k].cap - c.food); if (take > 0 && o.food >= take) { o.food -= take; c.food += take; } c.sinceMeal = 0; c.foe = o.id; }
        return true;
      case Kind.Ant: {
        const col = this.colonies.find((q) => q.id === c.ref);
        if (!col || sq(col.x - o.x) + sq(col.y - o.y) > 5 * TILE * 5 * TILE) return false;
        if (!near) { c.act = 1; this.goTo(c, o.x, o.y, SPEC[c.k].speed * 1.2); return true; }
        if (this.strike(c, o, 1) && o.hp <= 0) this.die(o, 'fight', c.k);
        c.foe = o.id;
        return true;
      }
      case Kind.Wisp:
        // 冒険者を誘う：冒険者から少し離れ、一行の行き先を自分の方へ向けさせる（魔法使いのいる一行は誘われにくい）
        if (o.k !== Kind.Adventurer) return false;
        {
          const p = this.parties.find((q) => q.id === o.party);
          if (!p || p.goal !== 0 || (p.camp ?? -1) >= 0 || p.engage) return false;
          if (p.members.some((id) => this.byId.get(id)?.sp === Job.Wizard) && ih(c.id, this.step, 215) % 3 !== 0) return false;
          if (ih(c.id, o.id ^ (this.step >> 6), 216) % 8 !== 0) return false;
          p.tx = c.x;
          p.ty = c.y;
          p.targetAt = this.step;
          c.foe = o.id;
          const dx = c.x - o.x;
          const dy = c.y - o.y;
          const L = Math.hypot(dx, dy) || 1;
          c.act = 1;
          this.tryMove(c, (dx / L) * SPEC[c.k].speed * 2, (dy / L) * SPEC[c.k].speed * 2);
          if (this.step - (this.lastLogged[992] ?? -99999) > 4000) {
            this.lastLogged[992] = this.step;
            this.log(c.x, c.y, `冒険者の一行が{k:${Kind.Wisp}}の光に誘われた`);
          }
        }
        return true;
      case Kind.Myconid:
        // 胞子：近くの冒険者の足を鈍らせる（地上の時間で1分ほど。ドワーフは眠気として効く）
        o.drowsy = Math.max(o.drowsy, o.k === Kind.Adventurer ? 300 : o.drowsy + 200);
        c.act = 2;
        c.actT = 0;
        c.foe = o.id;
        return false;
      case Kind.Salamander:
        if (!near) return false;
        if (this.strike(c, o, 0.6) && o.hp <= 0) this.die(o, 'burned', c.k);
        c.foe = o.id;
        return true;
    }
    return false;
  }

  // ---------- 演出のデモ（#fxdemo。シミュレーションは回さない） ----------

  /** デモの組：攻める側と受ける側 */
  demoPairs: [Cr, Cr][] = [];
  /** 明るい広い所に、技の見本の組を並べる */
  demoSetup(cx: number, cy: number): void {
    for (const c of this.list) if (Math.abs(c.x - cx) < 200 && Math.abs(c.y - cy) < 120) c.dead = 2;
    const pairs: [Kind, number, Kind, number, number][] = [
      // 攻める種、職業、受ける種、職業、間合い（画素）
      [Kind.Adventurer, 0, Kind.Goblin, 0, 18],
      [Kind.Adventurer, 5, Kind.Rat, 0, 70],
      [Kind.Adventurer, 1, Kind.Orc, 0, 70],
      [Kind.Rat, 0, Kind.Lizard, 0, 16],
      [Kind.Troll, 0, Kind.Adventurer, 0, 22],
      [Kind.Lich, 0, Kind.Adventurer, 3, 70],
      [Kind.Slime, 0, Kind.Rat, 0, 16],
      [Kind.Basilisk, 0, Kind.Adventurer, 2, 60],
      [Kind.Ghost, 0, Kind.Adventurer, 4, 18],
      [Kind.Minotaur, 0, Kind.Adventurer, 0, 40],
      [Kind.Vampire, 0, Kind.Adventurer, 1, 50],
      [Kind.Golem, 0, Kind.Goblin, 0, 24],
    ];
    this.demoPairs = [];
    pairs.forEach(([ka, sa, kd, sd, gap], i) => {
      const x = cx - 120 + (i % 3) * 120;
      const y = cy - 72 + Math.floor(i / 3) * 48;
      this.lamps.push(this.tileOf(x, y - 10));
      const a = this.spawn(ka, x - gap / 2, y, SPEC[ka].body || 10, 0);
      const d = this.spawn(kd, x + gap / 2, y, SPEC[kd].body || 10, 0);
      a.sp = sa;
      d.sp = sd;
      a.dir = 2;
      d.dir = 3;
      a.act = 0;
      d.act = 0;
      a.party = 0;
      d.party = 0;
      a.torch = ka === Kind.Adventurer ? 1 : 0;
      this.demoPairs.push([a, d]);
    });
  }
  /** デモの1刻み：組ごとに順番に技を出す（傷は与えない。4回に1回は強い一撃、6回に1回はとどめの見せ方） */
  demoTick(): void {
    const t = this.w.tick;
    this.demoPairs.forEach(([a, d], i) => {
      if ((t + i * 5) % 16 === 0) {
        a.act = 2;
        a.actT = 0;
        const n = Math.floor((t + i * 5) / 16);
        this.pushAttackFx(a, d, n % 4 === 1, n % 6 === 3);
        this.fxHits.push({ t, x: d.x, y: d.y, ax: a.x, ay: a.y, id: d.id });
        d.hitAt = t;
      }
      a.actT++;
      if (a.act === 2 && a.actT > 6) a.act = 0;
    });
  }

  // ---------- 食べる時間 ----------

  /** 倒した獲物の死骸を、数秒かけて食べる（4刻みごとに一口）。襲われたら食べるのをやめる。true なら今は食べている */
  private feeding(c: Cr): boolean {
    if (!c.feed) return false;
    const d = this.byId.get(c.feed);
    const s = SPEC[c.k];
    if (!d || d.dead !== 1 || d.units <= 0 || c.food >= s.cap || this.w.tick - c.hitAt < 30 || sq(d.x - c.x) + sq(d.y - c.y) > 18 * 18) {
      c.feed = 0;
      return false;
    }
    c.dir = Math.abs(d.x - c.x) > Math.abs(d.y - c.y) ? (d.x > c.x ? 2 : 3) : d.y > c.y ? 0 : 1;
    if (this.step % 4 === c.id % 4) {
      const t = Math.min(5, d.units, s.cap - c.food);
      d.units -= t;
      c.food += t;
      c.glow = Math.max(c.glow, d.glow);
      c.sinceMeal = 0;
      if (c.hp > 0) c.hp = Math.min(this.maxHp(c), c.hp + this.maxHp(c) / 30);
      c.act = 2;
      c.actT = 0;
      if (d.units <= 0) {
        d.dead = 2;
        c.feed = 0;
      }
    }
    return true;
  }

  // ---------- 物音 ----------

  /** 物音（戦い、崩落、掘る音）。地上の時間で数秒だけ残る */
  noises: { x: number; y: number; r: number; t: number }[] = [];
  noise(x: number, y: number, r: number): void {
    const last = this.noises[this.noises.length - 1];
    // 同じ所の続く音はまとめる
    if (last && this.step - last.t < 10 && sq(last.x - x) + sq(last.y - y) < 32 * 32) {
      last.t = this.step;
      last.r = Math.max(last.r, r);
      return;
    }
    this.noises.push({ x: Math.round(x), y: Math.round(y), r, t: this.step });
    if (this.noises.length > 40) this.noises.shift();
  }

  /**
   * 物音への反応。捕食者（動物と一部の狡猾な種）は、腹が満ちていなければ音の方へ寄る。
   * 小さな獲物（大ネズミ、アリ）は巣へ逃げ帰る。true なら今は音に従っている
   */
  private hear(c: Cr): boolean {
    if (!this.noises.length || c.act === 2) return false;
    const attract = c.k === Kind.Lizard || c.k === Kind.Spider || c.k === Kind.Basilisk || c.k === Kind.Wyvern || c.k === Kind.Orc || c.k === Kind.Troll || c.k === Kind.Minotaur;
    const flee = c.k === Kind.Rat || c.k === Kind.Ant;
    if (!attract && !flee) return false;
    let best: { x: number; y: number; r: number; t: number } | null = null;
    let bd = 1e18;
    for (const n of this.noises) {
      if (this.step - n.t > 40) continue;
      const d = sq(n.x - c.x) + sq(n.y - c.y);
      if (d > sq(n.r * TILE) || d >= bd) continue;
      bd = d;
      best = n;
    }
    if (!best) return false;
    const n = best as { x: number; y: number; r: number; t: number };
    if (flee) {
      if (c.flee <= 0 && (c.hx || c.hy) && ih(c.id, n.t, 194) % 2 === 0) {
        c.flee = 50;
        c.foe = 0;
      }
      return false;
    }
    // 腹が満ちているか、もう近くにいれば寄らない
    if (c.food >= SPEC[c.k].cap * 0.8 || bd < 3 * TILE * 3 * TILE || ih(c.id, n.t, 195) % 3 === 0) return false;
    c.act = 1;
    this.goTo(c, n.x, n.y, SPEC[c.k].speed);
    return true;
  }

  // ---------- 記録 ----------

  /** 目立つ出来事を記録に残す（新しい順に60件まで） */
  log(x: number, y: number, m: string): void {
    this.events.push({ t: this.w.tick, x: Math.round(x), y: Math.round(y), m });
    if (this.events.length > 60) this.events.shift();
  }

  /** 種が初めて照らされた */
  discover(k: number, x: number, y: number): void {
    if (this.discovered[k]) return;
    this.discovered[k] = 1;
    this.log(x, y, `初めて光の中に姿を見せた：{k:${k}}`);
  }

  // ---------- 炎 ----------

  /** マスに火をつける（燃えている刻み数） */
  ignite(k: number, dur: number): void {
    const m = this.w.map;
    if (k < 0 || k >= m.solid.length || m.solid[k]) return;
    if (this.w.burn[k] === 0) this.burning.push(k);
    this.w.burn[k] = Math.max(this.w.burn[k], dur);
    this.w.fxDirty = true;
  }

  /** 燃えているマス：苔とキノコは灰になって土に返り、上にいる生き物は焼け死に、巣は燃え落ちる。火が消えると焼け跡が残る */
  private updateFire(): void {
    if (!this.burning.length) return;
    const m = this.w.map;
    const next: number[] = [];
    for (const k of this.burning) {
      const b = this.w.burn[k];
      if (b === 0) continue;
      if (this.w.moss[k]) {
        this.w.nutr[k] += this.w.moss[k];
        this.w.moss[k] = 0;
        this.mossTouched = true;
      }
      if (this.w.fungus[k]) {
        this.w.nutr[k] += this.w.fungus[k];
        this.w.fungus[k] = 0;
        this.mossTouched = true;
      }
      if (b % 4 === 0) {
        const x = (k % m.w) * TILE + 8;
        const y = Math.floor(k / m.w) * TILE + 8;
        this.nearby(x, y, 1, (o) => {
          if (o.dead || o.away || [Kind.Dragon, Kind.Golem, Kind.Worm, Kind.Ghost, Kind.Salamander].includes(o.k)) return;
          if ((o.k === Kind.Bat || o.k === Kind.Wyvern || o.k === Kind.Wisp) && o.st !== 0) return;
          if (Math.abs(o.x - x) < 9 && Math.abs(o.y - y) < 9) this.die(o, 'burned', Kind.Dragon);
        });
        this.webs = this.webs.filter((wb) => Math.abs(wb.x - x) > 10 || Math.abs(wb.y - y) > 10);
      }
      this.w.burn[k] = b - 1;
      if (b - 1 === 0) {
        this.w.ash[k] = 255;
        this.w.fxDirty = true;
      } else next.push(k);
    }
    this.burning = next;
    if (this.step % 4 === 0) this.w.fxDirty = true;
  }

  /** 炎の吐息：口元から向きに沿って扇形に、手前から順に火をつける */
  private breathe(c: Cr, tx: number, ty: number, t: number): void {
    const m = this.w.map;
    const dx = tx - c.x;
    const dy = ty - c.y;
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const ux = dx / d;
    const uy = dy / d;
    // t は 0..11。先へ行くほど広く
    const reach = 1 + t * 0.6;
    const half = 0.6 + t * 0.25;
    for (let s2 = Math.max(1, reach - 1.2); s2 <= reach; s2 += 0.5)
      for (let w = -half; w <= half; w += 0.5) {
        const x = c.x + (ux * s2 - uy * w) * TILE;
        const y = c.y + (uy * s2 + ux * w) * TILE;
        const k = this.tileOf(x, y);
        if (k < 0 || m.solid[k]) continue;
        if (!lineOfSight(m, c.x, c.y, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8)) continue;
        this.ignite(k, 30 + (ih(k, this.step, 130) % 20));
      }
  }

  // ---------- ワイバーン ----------
  private wyvern(c: Cr): void {
    const s = SPEC[Kind.Wyvern];
    c.act = 1;
    // 腹が満ちたか、長く居すぎたら、裂け目から帰る
    if (c.st === 1 && (c.food >= s.cap * 0.8 || c.actT > 2400)) c.st = 9;
    if (c.st === 9) {
      if (this.goTo(c, c.hx, c.hy, s.speed) || sq(c.hx - c.x) + sq(c.hy - c.y) < 10 * 10) {
        this.record('exits', { t: this.w.tick, k: c.k, reason: 'home', x: Math.round(c.x), y: Math.round(c.y) } as never);
        this.exported += c.body + c.food;
        c.body = 0;
        c.food = 0;
        this.w.manaLeaked += c.mana;
        c.mana = 0;
        c.dead = 2;
      }
      return;
    }
    let prey: Cr | null = null;
    let bd = 12 * TILE * 12 * TILE;
    this.nearby(c.x, c.y, 12, (o) => {
      if (o.dead || o.away) return;
      if (!((o.k === Kind.Bat && o.st !== 0) || o.k === Kind.Gargoyle)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        prey = o;
      }
    });
    if (prey) {
      const p = prey as Cr;
      if (sq(p.x - c.x) + sq(p.y - c.y) < 12 * 12) {
        this.eat(c, p);
        c.act = 2;
        c.actT = 0;
      } else this.goTo(c, p.x, p.y, s.speed);
      return;
    }
    // 裂け目のまわりを旋回する
    const a = (this.step * 0.01 + c.id) % 6.283;
    this.moveToward(c, c.hx + Math.cos(a) * 6 * TILE, c.hy + Math.sin(a) * 4 * TILE, s.speed * 0.8);
  }

  // ---------- ドラゴン ----------
  /**
   * ドラゴンの寝床にする宝の山：宝物庫（ゴーレムの持ち場）とドワーフの広間の宝は選ばない。
   * 金貨が多く、人の気配が薄く、深い所ほど好む（深部の古い宝が自然な寝床になる）
   */
  private pickDragonHoard(minGold: number): Pile | null {
    const m = this.w.map;
    let best: Pile | null = null;
    let bv = -1e9;
    for (const p of this.piles) {
      const k = this.tileOf(p.x, p.y);
      if (p.gold < minGold || k < 0 || m.vault[k]) continue;
      if (this.hold && sq(p.x - ((this.hold.hk % m.w) * TILE + 8)) + sq(p.y - (Math.floor(this.hold.hk / m.w) * TILE + 8)) < 6 * TILE * 6 * TILE) continue;
      if (this.camps.some((cp) => cp.id >= 0 && sq(cp.x - p.x) + sq(cp.y - p.y) < 6 * TILE * 6 * TILE)) continue;
      const v = p.gold - this.presenceAt(p.x, p.y) * 300 + (Math.abs(p.x / TILE - m.deep.x) + Math.abs(p.y / TILE - m.deep.y) < 12 ? 200 : 0);
      if (v > bv) {
        bv = v;
        best = p;
      }
    }
    return best;
  }

  /** 宝の山の持ち主（見た目の飾りのため）：宝物庫、ゴブリンの集落、ドワーフの広間、ドラゴンの寝床、ほか */
  pileOwner(p: Pile): string {
    const m = this.w.map;
    const k = this.tileOf(p.x, p.y);
    if (k >= 0 && m.vault[k]) return 'vault';
    if (this.list.some((c) => c.k === Kind.Dragon && !c.dead && c.ref === p.id)) return 'dragon';
    if (this.hold && sq(p.x - ((this.hold.hk % m.w) * TILE + 8)) + sq(p.y - (Math.floor(this.hold.hk / m.w) * TILE + 8)) < 6 * TILE * 6 * TILE) return 'dwarf';
    if (this.camps.some((c) => c.id >= 0 && c.kind === 0 && sq(c.x - p.x) + sq(c.y - p.y) < 4 * TILE * 4 * TILE)) return 'goblin';
    return '';
  }

  /** ドラゴンの浅い眠りの時間か（眠りについてから、地上の1時間ごとに15分ほど） */
  private dragonLightSleep(c: Cr): boolean {
    return c.st === 0 && ((this.step - c.lureAt) % 600) < 150;
  }

  /** ドラゴンは宝の山の、番人のゴーレムから遠い側で眠る（重なって見えないように） */
  private dragonSide(hoard: Pile): number {
    const g = this.list.find((o) => o.k === Kind.Golem && !o.dead && sq(o.hx - hoard.x) + sq(o.hy - hoard.y) < 20 * TILE * 20 * TILE);
    if (!g) return 1;
    const gx = g.tx > 0 ? g.tx : g.x;
    return gx > hoard.x ? -1 : 1;
  }

  private dragon(c: Cr, day: number): void {
    const s = SPEC[Kind.Dragon];
    const m = this.w.map;
    // 幼竜の遊び：起きていて腹が満ちていれば、近くのコウモリやウィスプを追いかけ、ときどき煙の息を吐く練習をする
    if (c.sp === 0 && c.st === 1 && !c.foe && c.food >= s.cap * 0.5 && c.act !== 2) {
      if (this.step % 240 === c.id % 240) {
        c.act = 2;
        c.actT = 0;
        this.fxAttacks.push({ t: this.w.tick, style: 'puff', col: 6, size: 0, ax: c.x, ay: c.y, dx: c.x + (c.dir === 3 ? -14 : 14), dy: c.y - 4, did: -1, aid: c.id, big: false, kill: false });
        return;
      }
      let toy: Cr | null = null;
      this.nearby(c.x, c.y, 6, (o) => {
        if (!toy && !o.dead && (o.k === Kind.Wisp || (o.k === Kind.Bat && o.st !== 0)) && sq(o.x - c.x) + sq(o.y - c.y) < 6 * TILE * 6 * TILE) toy = o;
      });
      if (toy && sq(c.hx - c.x) + sq(c.hy - c.y) < 10 * TILE * 10 * TILE) {
        c.act = 1;
        this.goTo(c, (toy as Cr).x, (toy as Cr).y, s.speed * 0.8);
        return;
      }
    }
    // 幼竜は、自分より強い者が近く（5マス）にいれば、寝床から離れる方へ逃げる（眠っていれば目を覚まして）
    if (c.sp === 0 && !c.away && this.step % 3 === c.id % 3) {
      let threat: Cr | null = null;
      this.nearby(c.x, c.y, 5, (o) => {
        if (threat || o.dead || o.away || o === c || o.k === Kind.Wisp || this.str(o) <= this.str(c)) return;
        if (sq(o.x - c.x) + sq(o.y - c.y) < 5 * TILE * 5 * TILE && this.canSense(c, o)) threat = o;
      });
      if (threat) {
        const t = threat as Cr;
        c.st = 1;
        c.act = 1;
        const dx = c.x - t.x;
        const dy = c.y - t.y;
        const L = Math.hypot(dx, dy) || 1;
        this.tryMove(c, (dx / L) * s.speed * 1.3, (dy / L) * s.speed * 1.3);
        return;
      }
    }
    // 育つ：幼竜は寝床（生まれた所）で眠るあいだ、まわりの土からマナを吸い、食べた獲物のマナも溜める。
    // 溜めたマナと、生まれてからの日数（と、成竜になるには寝床の宝）で、若い竜、成竜へ育つ
    if (c.sp < 2 && !c.away) {
      if (c.st === 0 && this.step % 8 === c.id % 8) {
        const k = this.tileOf(c.x, c.y);
        for (const q of [k, k + 1, k - 1, k + m.w, k - m.w]) {
          if (q < 0 || q >= this.w.mana.length || this.w.mana[q] < 4) continue;
          const t = Math.min(1, this.w.mana[q] - 2);
          this.w.mana[q] -= t;
          c.mana += t;
        }
      }
      // 生まれてからの日数（地上の日）
      const days = (this.w.tick - c.bornAt) / DAY_TICKS_ECO;
      const hoard = this.piles.find((p) => p.id === c.ref);
      // マナが濃いほど早く育つ（深部のマナが薄いダンジョンでも、日数がたてば育つ）
      if (c.sp === 0 && days > 4 && (c.mana >= 1500 || days > 7)) {
        c.sp = 1;
        this.pushGrowFx(c);
        this.log(c.x, c.y, `{k:${Kind.Dragon}}の幼子が育ち、若い竜になった`);
      } else if (c.sp === 1 && days > 13 && (hoard?.gold ?? 0) >= 60 && (c.mana >= 5000 || days > 18)) {
        c.sp = 2;
        this.pushGrowFx(c);
        this.log(c.x, c.y, `若い{k:${Kind.Dragon}}が成竜となり、ダンジョンの主になった`);
      }
    }
    // 2 = 飛んでいる（裂け目から宝の山へ、または外へ）、3 = 外へ狩りに出ている、0 = 宝の山の上で眠る、1 = 起きている
    if (c.st === 3) {
      c.away = true;
      if (c.actT > 3000) {
        c.away = false;
        const add = s.cap - c.food;
        c.food += add;
        this.imported += add;
        c.st = 2;
        c.actT = 0;
      }
      return;
    }
    if (c.st === 2) {
      c.act = 1;
      const goingOut = c.food < s.cap * 0.3 && c.ref === -1;
      const gx = goingOut ? c.tx : c.hx;
      const gy = goingOut ? c.ty : c.hy;
      // 飛んでいる：岩の上も越えて、まっすぐ目的地へ（道筋は探さない）
      {
        const dx = gx - c.x;
        const dy = gy - c.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        const v = s.speed * 1.6;
        if (L > v) {
          c.x += (dx / L) * v;
          c.y += (dy / L) * v;
          c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : dy > 0 ? 0 : 1;
        } else {
          c.x = gx;
          c.y = gy;
        }
        this.paths.delete(c.id);
      }
      if (sq(gx - c.x) + sq(gy - c.y) < 8 * 8) {
        if (goingOut) {
          c.st = 3;
          c.actT = 0;
        } else {
          c.st = 0;
          c.act = 0;
          c.actT = 0;
          c.lureAt = this.step;
          // 宝の山を覚え直す（宝物庫とドワーフの広間は選ばない）
          const hoard = this.piles.find((p) => p.id === c.ref) ?? this.pickDragonHoard(1);
          if (hoard) c.ref = hoard.id;
        }
      }
      return;
    }
    if (c.st === 0) {
      c.act = 0;
      c.dir = 2;
      if (this.step % 25 !== c.id % 25) return;
      // 宝の山から金貨を盗られたら、必ず目覚めて盗った者を追う
      const hoardNow = this.piles.find((p) => p.id === c.ref);
      if (hoardNow && c.gait > 0 && hoardNow.gold < c.gait) {
        let thief: Cr | null = null;
        let td = 12 * TILE * 12 * TILE;
        this.nearby(c.x, c.y, 12, (o) => {
          if (o.dead || o === c || o.gold <= 0 || o.k === Kind.Mimic) return;
          const d = sq(o.x - c.x) + sq(o.y - c.y);
          if (d < td) {
            td = d;
            thief = o;
          }
        });
        c.gait = hoardNow.gold;
        c.st = 1;
        c.actT = 0;
        if (thief) {
          c.foe = (thief as Cr).id;
          this.log(c.x, c.y, `宝を盗られた{k:${Kind.Dragon}}が目を覚ました`);
        }
        return;
      }
      if (hoardNow) c.gait = hoardNow.gold;
      // 腹が減るか、強い者（その者の実際の強さで見る）が近くで騒ぐか、近くで戦いの物音がすると目覚める
      let disturbed = false;
      this.nearby(c.x, c.y, 5, (o) => {
        if (!o.dead && o !== c && o.k !== Kind.Golem && this.str(o) >= 9) disturbed = true;
      });
      for (const n of this.noises) if (this.step - n.t < 30 && sq(n.x - c.x) + sq(n.y - c.y) < 6 * TILE * 6 * TILE) disturbed = true;
      // 眠りの周期：眠りについてから地上の1〜2日たつと、自然に目を覚ます
      const slept = this.step - c.lureAt;
      const nap = DAY_TICKS_ECO / 2 + (ih(c.id, c.lureAt, 213) % (DAY_TICKS_ECO / 2));
      // 浅い眠りの時間（地上の1時間のうち15分ほど）は、寝床に近づく者に気づきやすい（盗賊は忍び足で気づかれにくい）
      if (this.dragonLightSleep(c)) {
        let intruder: Cr | null = null;
        this.nearby(c.x, c.y, 5, (o) => {
          if (intruder || o.dead || o.away || o === c || STR[o.k] < 3 || o.k === Kind.Golem) return;
          if (sq(o.x - c.x) + sq(o.y - c.y) > 5 * TILE * 5 * TILE) return;
          const chance = o.k === Kind.Adventurer && o.sp === Job.Thief ? 10 : 3;
          if (ih(c.id, o.id ^ this.step, 214) % chance === 0) intruder = o;
        });
        if (intruder) {
          c.st = 1;
          c.actT = 0;
          c.foe = (intruder as Cr).id;
          if (this.step - (this.lastLogged[996] ?? -99999) > 2000) {
            this.lastLogged[996] = this.step;
            this.log(c.x, c.y, `{k:${Kind.Dragon}}が寝床に近づく気配に目を覚ました`);
          }
          return;
        }
      }
      if (c.food < s.cap * 0.7 || slept > nap || (disturbed && ih(c.id, this.step, 131) % 4 === 0)) {
        c.st = 1;
        c.actT = 0;
      }
      return;
    }
    // 起きている：炎を吐いている途中
    if (c.act === 2 && c.ref2 > 0) {
      const t = 12 - c.ref2;
      this.breathe(c, c.tx, c.ty, t);
      c.ref2--;
      if (c.ref2 === 0) c.actT = 0;
      return;
    }
    // 宝を盗った者を追い、近ければ炎を吐く（金貨を落とすか倒れるまで）
    if (c.foe) {
      const f = this.byId.get(c.foe);
      const nearLair = f && sq(f.x - c.hx) + sq(f.y - c.hy) < 10 * TILE * 10 * TILE;
      if (!f || f.dead || (f.gold <= 0 && !nearLair) || sq(f.x - c.x) + sq(f.y - c.y) > 30 * TILE * 30 * TILE) c.foe = 0;
      else {
        const d = Math.sqrt(sq(f.x - c.x) + sq(f.y - c.y));
        c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
        if (c.sp === 0 && d < 16) {
          // 幼竜はまだ炎を吐けず、噛みつく
          this.fight(c, f);
        } else if (c.sp > 0 && d < (c.sp === 1 ? 4 : 6) * TILE && lineOfSight(m, c.x, c.y, f.x, f.y)) {
          c.act = 2;
          c.actT = 0;
          c.ref2 = c.sp === 1 ? 7 : 12;
          c.tx = f.x;
          c.ty = f.y;
        } else {
          c.act = 1;
          this.goTo(c, f.x, f.y, s.speed * 1.2);
        }
        return;
      }
    }
    // 腹が満ちていれば、まわりの宝の山（宝物庫、ドワーフの広間、自分の寝床のものは除く）から金貨を集めて寝床へ運ぶ
    const carry = [0, 10, 80][Math.min(2, c.sp)];
    if (c.food >= s.cap * (c.sp === 1 ? 0.4 : 0.7) && c.gold < carry) {
      let tgt: Pile | null = null;
      let td = (c.sp === 1 ? 15 : 50) * TILE * (c.sp === 1 ? 15 : 50) * TILE;
      for (const p of this.piles) {
        if (p.id === c.ref || p.gold <= 0) continue;
        const own = this.pileOwner(p);
        if (own === 'vault' || own === 'dwarf' || own === 'dragon') continue;
        const d = sq(p.x - c.x) + sq(p.y - c.y);
        if (d < td) {
          td = d;
          tgt = p;
        }
      }
      if (tgt) {
        const t = tgt as Pile;
        c.act = 1;
        if (sq(t.x - c.x) + sq(t.y - c.y) < 20 * 20) {
          const g = Math.min(t.gold, carry - c.gold);
          t.gold -= g;
          c.gold += g;
          if (c.sp === 1 && this.step - (this.lastLogged[991] ?? -99999) > 4000) {
            this.lastLogged[991] = this.step;
            this.log(c.x, c.y, `若い{k:${Kind.Dragon}}が光る金貨をくわえて寝床へ運んでいる`);
          }
        } else this.goTo(c, t.x, t.y, s.speed);
        return;
      }
    }
    // 焼けた獲物を食べる
    if (c.food < s.cap * 0.9) {
      let best: Cr | null = null;
      let bd = 8 * TILE * 8 * TILE;
      for (const o of this.corpses) {
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      if (best) {
        const b = best as Cr;
        c.act = 1;
        if (sq(b.x - c.x) + sq(b.y - c.y) < 16 * 16) {
          const t = Math.min(b.units, 40, s.cap - c.food);
          b.units -= t;
          c.food += t;
          c.sinceMeal = 0;
          if (b.units <= 0) b.dead = 2;
        } else this.goTo(c, b.x, b.y, s.speed);
        return;
      }
    }
    // 獲物を探して（遠くまで）、近ければ炎を吐く
    if (c.food < s.cap * 0.7) {
      let prey: Cr | null = null;
      // 幼竜は寝床の近く（12マス）で小さな獲物だけを狩る。若い竜は自分より弱い相手まで
      const R2 = c.sp === 0 ? 12 : 30;
      let bd = R2 * TILE * R2 * TILE;
      this.nearby(c.x, c.y, R2, (o) => {
        if (o.dead || o.away || o === c || [Kind.Golem, Kind.Worm, Kind.Ghost, Kind.Wisp, Kind.Salamander].includes(o.k)) return;
        if (c.sp === 0 && ![Kind.Rat, Kind.Bat, Kind.Lizard, Kind.Ant, Kind.Spider, Kind.Slime].includes(o.k)) return;
        if (c.sp === 1 && this.str(o) > this.str(c) * 0.8) return;
        if ((o.st === 7 || o.st === 12) && this.isHidden(o) && !this.atDoorOf(c, o)) return;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          prey = o;
        }
      });
      if (prey) {
        const p = prey as Cr;
        const d = Math.sqrt(sq(p.x - c.x) + sq(p.y - c.y));
        c.dir = Math.abs(p.x - c.x) > Math.abs(p.y - c.y) ? (p.x > c.x ? 2 : 3) : p.y > c.y ? 0 : 1;
        if (c.sp === 0 && d < 16) {
          this.fight(c, p);
        } else if (c.sp > 0 && d < (c.sp === 1 ? 4 : 6) * TILE && lineOfSight(m, c.x, c.y, p.x, p.y)) {
          if (this.step - (this.lastLogged[Kind.Dragon] ?? -99999) > 2000) {
            this.lastLogged[Kind.Dragon] = this.step;
            this.log(c.x, c.y, `{k:${Kind.Dragon}}が炎を吐き、あたりが燃え上がった`);
          }
          c.act = 2;
          c.actT = 0;
          c.ref2 = c.sp === 1 ? 7 : 12;
          c.tx = p.x;
          c.ty = p.y;
        } else {
          c.act = 1;
          this.goTo(c, p.x, p.y, s.speed);
        }
        return;
      }
    }
    // 腹が満ちたか、何も見つからないまま時間が経ったら：満ちていれば宝の山へ戻って眠り、飢えていれば外へ狩りに出る
    if (c.food >= s.cap * 0.7 || c.actT > 1500) {
      if (c.food < s.cap * 0.3 && (c.sp === 2 || (c.sp === 1 && this.dayNow < 0.1))) {
        const sh = m.shafts[0];
        c.tx = sh.x * TILE + 8;
        c.ty = sh.y * TILE + 8;
        c.ref = -1;
        c.st = 2;
        return;
      }
      // 寝床の場所は覚えている。山が尽きていても、そこへ戻って集めてきた金貨を積み直す
      const hoard = this.piles.find((p) => p.id === c.ref && p.gold > 0);
      if (hoard) {
        c.hx = hoard.x + this.dragonSide(hoard) * 18;
        c.hy = hoard.y - 4;
        if (c.gold > 0 && sq(hoard.x - c.x) + sq(hoard.y - c.y) < 30 * 30) {
          hoard.gold += c.gold;
          c.gold = 0;
        }
      } else if (c.gold > 0 && sq(c.hx - c.x) + sq(c.hy - c.y) < 30 * 30) {
        const before = this.piles.length;
        this.dropGold(c.hx - 18, c.hy + 4, c.gold);
        c.gold = 0;
        const np = this.piles.length > before ? this.piles[this.piles.length - 1] : this.piles.reduce((b: Pile | null, p) => (sq(p.x - c.hx) + sq(p.y - c.hy) < 40 * 40 && (!b || p.gold > b.gold) ? p : b), null);
        if (np) c.ref = np.id;
      }
      if (this.goTo(c, c.hx, c.hy, s.speed) || sq(c.hx - c.x) + sq(c.hy - c.y) < 12 * 12) {
        c.st = 0;
        c.act = 0;
        // 眠りについた刻み（眠りの周期のため）
        c.lureAt = this.step;
      } else c.act = 1;
      return;
    }
    c.act = 1;
    const j = DIR16[ih(c.id, this.step >> 5, 132) & 15];
    this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
  }

  // ---------- 冒険者 ----------

  /** 噂の総量（評判） */
  reputation(): number {
    const r = this.rumors;
    return r.light + r.gold * 2 + r.undead + r.beast + r.dragon * 2;
  }

  private maybeParty(): void {
    const rep = this.reputation();
    const chance = Math.min(500, 30 + rep * 40);
    if (ih(this.step, 201, 7) % 1000 >= chance) return;
    const m = this.w.map;
    const r = this.rumors;
    const size = Math.min(5, 2 + (ih(this.step, 202, 7) % 3) + (rep > 3 ? 1 : 0));
    const tier = rep < 2 ? 0 : rep < 6 ? 1 : 2;
    // 噂の中身で顔ぶれが変わる：金貨なら盗賊、アンデッドなら僧侶、大物や竜なら戦士
    const wts = [3 + 3 * (r.beast + r.dragon), 2, 1 + 3 * r.gold, 2 + 3 * r.undead, 1, r.beastKind ? 3 * r.beast : 0, 0];
    const jobs: number[] = [];
    for (let i = 0; i < size; i++) {
      const tot = wts.reduce((a, b) => a + b, 0);
      let v = (ih(this.step, 203 + i, 7) % 1000) / 1000 * tot;
      let j = 0;
      while (j < wts.length - 1 && v >= wts[j]) v -= wts[j++];
      jobs.push(j);
    }
    // 竜の噂があれば、竜殺しが一行を率いる
    if (r.dragon > 0.3) jobs[0] = Job.Slayer;
    // 光がなければ進めない：魔法使いも僧侶もいなければ、戦士が一人松明を持つ。戦士もいなければ一人を戦士に
    if (!jobs.includes(Job.Wizard) && !jobs.includes(Job.Priest) && !jobs.includes(Job.Warrior)) jobs[jobs.length - 1] = Job.Warrior;
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
    }
    this.parties.push(party);
    const names = jobs.map((j) => JOB_NAMES[j]).join('・');
    // 入口で身支度をして、食べ残しを少し落としていく
    if (door < 0) this.pendingScraps.push(pid);
    if (door < 0) this.log(m.entrance.x * TILE + 8, TILE + 8, `冒険者の一行（${names}）が入口から入ってきた`);
    else this.log(this.mouthSpot(door)[0], this.mouthSpot(door)[1], `冒険者の一行（${names}）が地表の横穴から入ってきた`);
  }

  /** 冒険者の一行の光（松明と光の呪文） */
  private partyLights(p: Party): Cr[] {
    const out: Cr[] = [];
    for (const id of p.members) {
      const c = this.byId.get(id);
      if (c && !c.dead && (c.torch > 0 || c.sp === Job.Wizard)) out.push(c);
    }
    return out;
  }

  /** その者から見えるか：一行の光の中か、日の光や光る苔に照らされているか。盗賊は夜目が利く */
  private seenBy(c: Cr, lights: Cr[], o: Cr): boolean {
    if ((o.st === 7 || o.st === 12) && this.isHidden(o) && !this.atDoorOf(c, o)) return false;
    if (c.sp === Job.Thief && sq(o.x - c.x) + sq(o.y - c.y) < 3 * TILE * 3 * TILE) return true;
    for (const l of lights) if (sq(o.x - l.x) + sq(o.y - l.y) < 5.5 * TILE * 5.5 * TILE) return true;
    return this.isLit(o);
  }

  private updateParties(): void {
    const m = this.w.map;
    for (const p of this.parties) {
      const alive = p.members.map((id) => this.byId.get(id)).filter((c): c is Cr => !!c && !c.dead);
      if (!alive.length && p.members.length) {
        const last = this.byId.get(p.members[p.members.length - 1]);
        if (!(p.saw & 16)) this.log(last?.x ?? 0, last?.y ?? 0, `冒険者の一行が全滅した`);
      }
      p.members = alive.map((c) => c.id);
      if (!alive.length) continue;
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
        const tooLong = this.step - p.since > 10800;
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
        if (foodAvg < 0.45 && p.goal === 0) {
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
        // 休むのは、探索中で食料に余裕があるときだけ（帰り道では休まずに出口を目指す）
        if (p.goal === 0 && foodAvg >= 0.5 && (p.camp ?? -1) < 0 && this.step - (p.lastCamp ?? 0) > 2500 && ((p.fatigue ?? 0) > 3600 || worst < 0.5)) this.startCamp(p, alive[0]);
        if ((p.camp ?? -1) >= 0 && (p.goal !== 0 || foodAvg < 0.3)) this.endCamp(p);
        if ((p.camp ?? -1) >= 0 && this.step >= (p.campUntil ?? 0)) this.endCamp(p);
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

  private cellOf(x: number, y: number): number {
    const m = this.w.map;
    const cw = Math.ceil(m.w / CELL);
    return Math.floor(y / TILE / CELL) * cw + Math.floor(x / TILE / CELL);
  }

  /** 区画の中の、開いていて歩ける床（中心に近いもの）。なければ -1 */
  private cellFloor(cell: number): number {
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
  private partyStr(p: Party): number {
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
  private pickTarget(p: Party, from: Cr): void {
    if (this.pickQuarry(p)) return;
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
          const v = -(Math.abs(cx - hx) + Math.abs(cy - hy)) * 3 + cy * 0.5 + (ih(p.id, cell, 230) % 4);
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

  /** 竜殺しの一行は竜へ、狩人の一行は噂の大物を見かけた場所へ */
  private pickQuarry(p: Party): boolean {
    const jobs = p.members.map((id) => this.byId.get(id)).filter((c): c is Cr => !!c && !c.dead).map((c) => c.sp);
    if (jobs.includes(Job.Slayer)) {
      const d = this.list.find((o) => !o.dead && !o.away && (o.k === Kind.Dragon || o.k === Kind.Wyvern || o.k === Kind.Worm));
      if (d) {
        p.tx = d.x;
        p.ty = d.y + 20;
        p.targetAt = this.step;
        return true;
      }
    }
    if (jobs.includes(Job.Hunter) && this.rumors.beastKind && this.step - p.since < 3000) {
      p.tx = this.rumors.beastX;
      p.ty = this.rumors.beastY;
      p.targetAt = this.step;
      return true;
    }
    return false;
  }

  private pickTargetRandom(p: Party, from: Cr): void {
    const m = this.w.map;
    const jobs = p.members.map((id) => this.byId.get(id)).filter((c): c is Cr => !!c && !c.dead).map((c) => c.sp);
    // 竜殺しの一行は竜へ、狩人の一行は噂の大物を見かけた場所へ
    if (jobs.includes(Job.Slayer)) {
      const d = this.list.find((o) => !o.dead && !o.away && (o.k === Kind.Dragon || o.k === Kind.Wyvern || o.k === Kind.Worm));
      if (d) {
        p.tx = d.x;
        p.ty = d.y + 20;
        p.targetAt = this.step;
        return;
      }
    }
    if (jobs.includes(Job.Hunter) && this.rumors.beastKind && this.step - p.since < 3000) {
      p.tx = this.rumors.beastX;
      p.ty = this.rumors.beastY;
      p.targetAt = this.step;
      return;
    }
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

  private adventurer(c: Cr, day: number): void {
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
        if (o.k === Kind.Dragon || o.k === Kind.Wyvern || o.k === Kind.Worm) p.saw |= 8;
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
    const ENEMY = [Kind.Goblin, Kind.Kobold, Kind.Orc, Kind.Lizardman, Kind.Minotaur, Kind.Troll, Kind.Vampire, Kind.Zombie, Kind.Basilisk, Kind.Skeleton, Kind.Lich];
    // ウィスプは剣では払えない光なので、雑魚に含めない（誘われても追いかけて迷うだけ。魔法使いは瓶に捕まえる）
    const MINOR = [Kind.Rat, Kind.Bat, Kind.Ant, Kind.Myconid, Kind.Salamander, Kind.Lizard, Kind.Spider, Kind.Slime];
    if (c.sp === Job.Slayer) ENEMY.push(Kind.Dragon, Kind.Wyvern, Kind.Worm);
    let foe: Cr | null = null;
    let bd = 5.5 * TILE * 5.5 * TILE;
    // 一行で向かっている手強い敵がいれば、まずそれ
    if (p.engage) {
      const e = this.byId.get(p.engage);
      const runner = e && e.flee > 0 && STR[e.k] <= 3 && !(e.id === c.foe && this.w.tick - c.hitAt < 150);
      if (e && !e.dead && !e.away && !runner && sq(e.x - c.x) + sq(e.y - c.y) < 10 * TILE * 10 * TILE && c.sp !== Job.Bard && c.sp !== Job.Thief) foe = e;
      else if (!e || e.dead || e.away || runner) p.engage = 0;
    }
    if (!foe)
      this.nearby(c.x, c.y, 6, (o) => {
        if (o.dead || o.away) return;
        const attacked = o.id === c.foe && this.w.tick - c.hitAt < 150;
        const enemy = ENEMY.includes(o.k) || (o.k === Kind.Gargoyle && o.act !== 0) || (o.k === Kind.Mimic && c.sp === Job.Thief) || (c.sp === Job.Hunter && o.k === this.rumors.beastKind);
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
      const a = (idx / Math.max(1, p.members.length)) * 6.283;
      const sx = fx + Math.cos(a) * 14;
      const sy = fy + Math.sin(a) * 10;
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
  private setExit(p: Party): void {
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
  private startCamp(p: Party, leader: Cr): void {
    const m = this.w.map;
    const hx = Math.floor(leader.x / TILE);
    const hy = Math.floor(leader.y / TILE);
    let best = -1;
    let bv = -1e9;
    for (let dy = -8; dy <= 8; dy++)
      for (let dx = -8; dx <= 8; dx++) {
        const x = hx + dx;
        const y = hy + dy;
        if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
        const k = y * m.w + x;
        if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.burn[k]) continue;
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
    p.campUntil = this.step + 1500;
    this.log((best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, `冒険者の一行が焚き火を囲んで休みはじめた`);
  }

  private endCamp(p: Party): void {
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
  private dropScraps(p: Party, x: number, y: number, per: number): void {
    for (const id of p.members) {
      const o = this.byId.get(id);
      if (!o || o.dead || o.food < per + 10) continue;
      o.food -= per;
      this.deposit(x + ((id % 5) - 2) * 6, y + ((id % 3) - 1) * 6, per);
    }
  }

  /** 入口から外へ出ていく：持ち出した金貨と養分を帳簿へ、見たものを噂に */
  private leaveDungeon(c: Cr, p: Party): void {
    if (c.food > 12) {
      c.food -= 2;
      this.deposit(c.x, c.y + 10, 2);
    }
    this.record('exits', { t: this.w.tick, k: c.k, reason: 'returned', x: Math.round(c.x), y: Math.round(c.y) } as never);
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
    this.exported += c.body + c.food;
    this.goldOut += c.gold;
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
    if (p.saw & 8) r.dragon += 0.25 * mul;
    c.body = 0;
    c.food = 0;
    c.gold = 0;
    c.dead = 2;
    this.returned++;
  }

  /** 倒れた者の持ち物を床に落とす（冒険者の道具） */
  private dropBelongings(c: Cr): void {
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
    c.party = 0;
  }

  /** 職業ごとの道具 */
  private static JOB_ITEMS: number[][] = [[ItemKind.Sword, ItemKind.Shield], [ItemKind.Staff], [ItemKind.Dagger], [ItemKind.Mace, ItemKind.Symbol], [ItemKind.Lute], [ItemKind.Bow], [ItemKind.Greatsword]];
  private dropJobItems(c: Cr): void {
    Ecology.JOB_ITEMS[c.sp].forEach((kd, i) => this.dropItem(c.x - 4 + i * 7, c.y + 3 - i * 2, kd, 0));
  }

  private dropItem(x: number, y: number, kind: number, fuel: number): void {
    this.gear.push({ id: this.nextId++, x: Math.round(x), y: Math.round(y), kind, fuel });
    // 古い燃えさしから片づける（道具が増えすぎないように）
    if (this.gear.length > 160) {
      const i = this.gear.findIndex((o) => o.kind === ItemKind.Stub);
      this.gear.splice(i >= 0 ? i : 0, 1);
    }
  }

  /** 床に落ちた松明は燃え続け、燃え尽きると燃えさしになる */
  private updateItems(): void {
    for (const it of this.gear) {
      if (it.kind !== ItemKind.Torch) continue;
      it.fuel--;
      if (it.fuel <= 0) it.kind = ItemKind.Stub;
    }
  }

  /** 光源（松明、光の呪文、床で燃える松明）。描画と「見たマス」の記録に使う */
  /** 光源を順に（lightSources と同じ順・同じ値。配列や物を作らない） */
  private eachLight(fn: (x: number, y: number, r: number, i: number, cr: number, cg: number, cb: number) => void): void {
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

  lightSources(): { x: number; y: number; r: number; i: number; c: [number, number, number] }[] {
    const out: { x: number; y: number; r: number; i: number; c: [number, number, number] }[] = [];
    this.eachLight((x, y, r, i, cr, cg, cb) => out.push({ x, y, r, i, c: [cr, cg, cb] }));
    return out;
  }

  // ---------- スケルトンとリッチ ----------

  private deathsAt(x: number, y: number): number {
    const cx = Math.min(23, Math.max(0, Math.floor(x / (TILE * 8))));
    const cy = Math.min(17, Math.max(0, Math.floor(y / (TILE * 8))));
    let n = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x2 = cx + dx;
        const y2 = cy + dy;
        if (x2 >= 0 && y2 >= 0 && x2 < 24 && y2 < 18) n += this.graveMap[y2 * 24 + x2];
      }
    return n;
  }

  private lichNear(x: number, y: number): boolean {
    for (const o of this.list) if (o.k === Kind.Lich && !o.dead && sq(o.x - x) + sq(o.y - y) < 15 * TILE * 15 * TILE) return true;
    return false;
  }

  /** 冒険者の亡骸が起き上がる：魔法使いは（死者がとても多ければ）リッチに、ほかはスケルトンに。足もとの装備を拾う */
  private raiseUndead(c: Cr, manyDead: boolean): void {
    const asLich = c.sp === Job.Wizard && manyDead && this.counts[Kind.Lich] === 0 && !this.list.some((o) => o.k === Kind.Lich && !o.dead);
    const kinds = Ecology.JOB_ITEMS[c.sp];
    let found = false;
    if (!asLich && c.sp !== Job.Wizard) {
      const near = this.gear.filter((it) => kinds.includes(it.kind) && sq(it.x - c.x) + sq(it.y - c.y) < 24 * 24);
      if (near.length) {
        found = true;
        const ids = new Set(near.map((it) => it.id));
        this.gear = this.gear.filter((it) => !ids.has(it.id));
      }
    }
    c.k = asLich ? Kind.Lich : Kind.Skeleton;
    this.log(c.x, c.y, asLich ? `倒れた魔法使いの亡骸が{k:${Kind.Lich}}になった` : `冒険者の骨が{k:${Kind.Skeleton}}として起き上がった`);
    c.body = c.units;
    c.units = 0;
    c.food = 0;
    c.dead = 0;
    c.act = 0;
    c.actT = 0;
    c.hungry = 0;
    c.init = found ? 1 : 0;
    c.party = 0;
    c.hx = c.x;
    c.hy = c.y;
    c.st = 0;
    this.counts[c.k]++;
  }

  private skeleton(c: Cr, day: number): void {
    const s = SPEC[Kind.Skeleton];
    if (c.act === 2 && c.actT < 4) return;
    // 骨はゆっくり崩れて土に返る
    if (this.step % 300 === c.id % 300) {
      c.body--;
      this.deposit(c.x, c.y, 1);
      if (c.body <= 0) {
        // 崩れて消えたことも、死として記録に残す（帳簿は土へ返した分で合っている）
        this.record('deaths', { t: this.w.tick, k: c.k, cause: 'crumbled', by: -1, x: Math.round(c.x), y: Math.round(c.y) } as never);
        this.dropBelongings(c);
        this.releaseMana(c);
        c.dead = 2;
        return;
      }
    }
    // 食べずに、生きているものを襲う
    const foeKinds = [Kind.Rat, Kind.Goblin, Kind.Kobold, Kind.Adventurer, Kind.Lizardman, Kind.Orc, Kind.Lizard, Kind.Ant];
    let foe: Cr | null = null;
    let bd = 6 * TILE * 6 * TILE;
    this.nearby(c.x, c.y, 6, (o) => {
      if (o.dead || o.away || !foeKinds.includes(o.k)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        foe = o;
      }
    });
    if (foe) {
      const f = foe as Cr;
      c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
      if (bd < 14 * 14) this.fight(c, f);
      else {
        c.act = 1;
        this.goTo(c, f.x, f.y, s.speed);
      }
      return;
    }
    // 暗がりをさまよう（生まれた場所から離れすぎない）
    c.act = c.actT % 120 < 60 ? 1 : 0;
    if (c.act === 1) {
      if (sq(c.hx - c.x) + sq(c.hy - c.y) > 14 * TILE * 14 * TILE) this.goTo(c, c.hx, c.hy, s.speed);
      else {
        const j = DIR16[ih(c.id, this.step >> 5, 143) & 15];
        this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
      }
    }
  }

  private lich(c: Cr, day: number): void {
    const s = SPEC[Kind.Lich];
    if (c.act === 2 && c.actT < 6) return;
    // 住みかに入ってきた生きものを、死の呪いで倒す
    let foe: Cr | null = null;
    this.nearby(c.x, c.y, 5, (o) => {
      if (foe || o.dead || o.away || ![Kind.Adventurer, Kind.Goblin, Kind.Kobold, Kind.Orc, Kind.Lizardman].includes(o.k)) return;
      foe = o;
    });
    if (foe) {
      const f = foe as Cr;
      c.act = 2;
      c.actT = 0;
      c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
      if (ih(c.id, f.id, this.step) % 2 === 0) this.fight(c, f);
      return;
    }
    c.act = c.actT % 200 < 40 ? 1 : 0;
    if (c.act === 1) {
      const a = (c.actT * 0.05 + c.id) % 6.283;
      this.moveToward(c, c.hx + Math.cos(a) * 24, c.hy + Math.sin(a) * 16, s.speed);
    }
  }

  /** ゴブリンとオーク：床の道具を拾う（武器、松明）。ゴブリンは燃えさしを熱いところで灯し直す */
  private scavenge(c: Cr): boolean {
    if (c.k === Kind.Goblin && c.torch < 0) {
      const k = this.tileOf(c.x, c.y);
      if (k >= 0 && this.w.heat[k] > 120) c.torch = 6000;
    }
    if (c.torch > 0) {
      c.torch--;
      if (c.torch === 0) c.torch = -1;
    }
    const wantWeapon = !c.party;
    const wantTorch = c.k === Kind.Goblin && c.torch === 0;
    if (!wantWeapon && !wantTorch) return false;
    if (c.ref2 < 0) return false;
    if (this.step % 10 !== c.id % 10 && c.ref2 === 0) return false;
    let best: Item | null = null;
    let bd = 6 * TILE * 6 * TILE;
    for (const it of this.gear) {
      const weapon = it.kind === ItemKind.Sword || it.kind === ItemKind.Mace || it.kind === ItemKind.Dagger || it.kind === ItemKind.Greatsword;
      const torch = it.kind === ItemKind.Torch || it.kind === ItemKind.Stub;
      if (!((wantWeapon && weapon) || (wantTorch && torch))) continue;
      const d = sq(it.x - c.x) + sq(it.y - c.y);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    if (!best) {
      c.ref2 = 0;
      return false;
    }
    const it = best as Item;
    c.ref2 = it.id;
    c.act = 1;
    if (bd < 10 * 10) {
      if (it.kind === ItemKind.Torch) c.torch = it.fuel;
      else if (it.kind === ItemKind.Stub) c.torch = -1;
      else c.party = it.kind;
      this.gear = this.gear.filter((o) => o !== it);
      c.ref2 = 0;
      c.act = 2;
      c.actT = 0;
    } else this.goTo(c, it.x, it.y, SPEC[c.k].speed);
    return true;
  }

  // ---------- ドワーフ ----------

  /** ドワーフが嗅ぎつける宝：まだ誰のものでもない、閉じた空洞や奥にある古い宝の山 */
  private dwarfTarget(): number {
    const m = this.w.map;
    const h = this.hold;
    let best = -1;
    let bv = -1e9;
    for (const p of this.piles) {
      const k = this.tileOf(p.x, p.y);
      if (k < 0) continue;
      if (m.vault[k] && ((h && h.golem) || this.dwarfLore & 1)) continue;
      if (h && sq(p.x - (h.hk % m.w) * TILE) + sq(p.y - Math.floor(h.hk / m.w) * TILE) < 6 * TILE * 6 * TILE) continue;
      const v = p.gold - (h ? Math.abs(p.x / TILE - (h.hk % m.w)) + Math.abs(p.y / TILE - Math.floor(h.hk / m.w)) : 0) * 2;
      if (v > bv) {
        bv = v;
        best = p.id;
      }
    }
    return best;
  }

  private maybeDwarves(): void {
    const m = this.w.map;
    const tid = this.dwarfTarget();
    if (tid < 0) return;
    const tp = this.piles.find((p) => p.id === tid) as Pile;
    // 住む場所：入口から歩いて行ける床のうち、岩に面し、宝にいちばん近い所
    const reach = new Uint8Array(m.w * m.h);
    const st = [m.w + m.entrance.x];
    reach[st[0]] = 1;
    while (st.length) {
      const c = st.pop() as number;
      for (const q of [c + 1, c - 1, c + m.w, c - m.w]) {
        if (q < 0 || q >= reach.length || reach[q] || m.solid[q] || m.lava[q]) continue;
        reach[q] = 1;
        st.push(q);
      }
    }
    let site = -1;
    let bd = 1e9;
    let dir = [0, 1];
    for (let k = 0; k < m.w * m.h; k += 1) {
      if (!reach[k] || m.solid[k] || m.sealed[k] || m.lava[k] || m.paved[k] || this.w.water[k] > 10) continue;
      const x = k % m.w;
      const y = Math.floor(k / m.w);
      if (x < 6 || y < 6 || x >= m.w - 6 || y >= m.h - 6) continue;
      for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!m.solid[k + ddx + ddy * m.w] || m.rubble[k + ddx + ddy * m.w]) continue;
        const d = Math.abs(x + ddx * 4 - tp.x / TILE) + Math.abs(y + ddy * 4 - tp.y / TILE);
        if (d < bd) {
          bd = d;
          site = k;
          dir = [ddx, ddy];
        }
      }
    }
    if (site < 0) return;
    const sx = site % m.w;
    const sy = Math.floor(site / m.w);
    const [ddx, ddy] = dir;
    // 広間：奥行き5、幅7。柱を二本残す
    const todo: number[] = [];
    for (let d = 1; d <= 5; d++)
      for (let l = -3; l <= 3; l++) {
        if (d === 3 && Math.abs(l) === 2) continue;
        const x = sx + ddx * d + (ddy !== 0 ? l : 0);
        const y = sy + ddy * d + (ddx !== 0 ? l : 0);
        if (x < 3 || y < 3 || x >= m.w - 3 || y >= m.h - 3) continue;
        todo.push(y * m.w + x);
      }
    const hk = (sy + ddy * 3) * m.w + sx + ddx * 3;
    // 背負ってきた食料（持ち込み）
    this.imported += 300;
    // 広間の奥の隅をキノコの畑にする
    const farm: number[] = [];
    for (const l of [-3, -2, 2, 3]) {
      const x = sx + ddx * 5 + (ddy !== 0 ? l : 0);
      const y = sy + ddy * 5 + (ddx !== 0 ? l : 0);
      farm.push(y * m.w + x);
    }
    this.hold = { stage: 0, sx, sy, dx: ddx, dy: ddy, hk, todo, target: tid, head: hk, len: 0, forge: -1, golem: 0, since: this.w.tick, store: 300, farm };
    const roles = [0, 0, 1, 2, 2];
    for (let i = 0; i < roles.length; i++) {
      const body = SPEC[Kind.Dwarf].body;
      const food = SPEC[Kind.Dwarf].cap;
      this.imported += body + food;
      this.originNext = 'entrance';
      const c = this.spawn(Kind.Dwarf, m.entrance.x * TILE + 8 + ((i % 3) - 1) * 8, TILE + 8, body, food);
      c.sp = roles[i];
      c.hx = sx * TILE + 8;
      c.hy = sy * TILE + 8;
      this.counts[Kind.Dwarf]++;
    }
    this.log(m.entrance.x * TILE + 8, TILE + 8, `{k:${Kind.Dwarf}}の一団が入口から入ってきた`);
  }

  private updateHold(): void {
    const h = this.hold;
    if (!h) return;
    const m = this.w.map;
    const members = this.list.filter((c) => c.k === Kind.Dwarf && !c.dead);
    if (!members.length) {
      // 残った食料は広間で朽ちて土に返る
      if (h.store > 0) this.deposit((h.hk % m.w) * TILE + 8, Math.floor(h.hk / m.w) * TILE + 8, h.store);
      h.store = 0;
      this.log((h.hk % m.w) * TILE + 8, Math.floor(h.hk / m.w) * TILE + 8, `{k:${Kind.Dwarf}}の住みかが空になった`);
      this.hold = null;
      this.lastDwarves = this.w.tick;
      return;
    }
    if (h.stage === 1 && !h.todo.length) {
      h.stage = 2;
      this.log((h.hk % m.w) * TILE + 8, Math.floor(h.hk / m.w) * TILE + 8, `{k:${Kind.Dwarf}}が柱のある広間を掘り上げた`);
    }
    // キノコの畑：まわりの土の養分を集めてキノコを育てる（広間ができてから）
    if (h.stage >= 2 && this.step % 300 === 120) {
      for (const k of h.farm) {
        if (m.solid[k] || this.w.fungus[k] >= 160) continue;
        const x = k % m.w;
        const y = Math.floor(k / m.w);
        let got = 0;
        for (let dy = -2; dy <= 2 && got < 8; dy++)
          for (let dx = -2; dx <= 2 && got < 8; dx++) {
            const q = (y + dy) * m.w + x + dx;
            const t = Math.min(this.w.nutr[q], 8 - got, 2);
            if (t > 0) {
              this.w.nutr[q] -= t;
              got += t;
            }
          }
        this.w.fungus[k] = Math.min(255, this.w.fungus[k] + got);
        this.mossTouched = true;
      }
    }
    // 鍛冶場：溶岩が住みかの近くに開いたら、そのそばに構える
    if (h.forge < 0 && this.step % 200 === 50) {
      const hx = h.hk % m.w;
      const hy = Math.floor(h.hk / m.w);
      let best = -1;
      let bd = 1e9;
      for (let dy = -14; dy <= 14; dy++)
        for (let dx = -14; dx <= 14; dx++) {
          const k = (hy + dy) * m.w + hx + dx;
          if (k < 0 || k >= m.solid.length || m.solid[k] || m.sealed[k] || m.lava[k]) continue;
          let lava = false;
          for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (m.lava[q]) lava = true;
          if (!lava) continue;
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
      if (best >= 0) {
        h.forge = best;
        this.log((best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, `{k:${Kind.Dwarf}}が溶岩のそばに鍛冶場を構え、火を灯した`);
      }
    }
    // 目指す宝がなくなったら、次の宝を探す
    if (h.stage >= 2 && !this.piles.some((p) => p.id === h.target)) {
      const t = this.dwarfTarget();
      if (t >= 0) {
        h.target = t;
        h.stage = 2;
        h.head = h.hk;
        h.len = 0;
        h.plan = [];
      } else h.stage = 4;
    }
    // 宝物庫を避けると決めたら、宝物庫の宝は狙わない
    const tp = this.piles.find((p) => p.id === h.target);
    if (tp && h.golem && m.vault[this.tileOf(tp.x, tp.y)]) {
      const t = this.dwarfTarget();
      h.target = t;
      h.stage = t >= 0 ? 2 : 4;
      h.head = h.hk;
      h.len = 0;
    }
  }

  /**
   * 坑道の道筋：広間から宝まで、手間の少ない道（柔らかい層に沿い、硬い岩塊を回り込む）。
   * 上下左右だけに進み、曲がるたびに手間を足すので、まっすぐな区間を直角につないだ形になる
   */
  private planShaft(h: Hold, tp: Pile): void {
    const m = this.w.map;
    const sx = h.head % m.w;
    const sy = Math.floor(h.head / m.w);
    const tx = Math.floor(tp.x / TILE);
    const ty = Math.floor(tp.y / TILE);
    const x0 = Math.max(2, Math.min(sx, tx) - 16);
    const x1 = Math.min(m.w - 3, Math.max(sx, tx) + 16);
    const y0 = Math.max(2, Math.min(sy, ty) - 16);
    const y1 = Math.min(m.h - 3, Math.max(sy, ty) + 16);
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const N = bw * bh * 4;
    const dist = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const cost = (k: number) => {
      if (m.lava[k]) return Infinity;
      if (!m.solid[k]) return 1;
      if (m.rubble[k]) return 2;
      return [3, 6, 16][m.hard[k]];
    };
    const DX = [1, 0, -1, 0];
    const DY = [0, 1, 0, -1];
    // 小さな二分ヒープ
    const heap: number[] = [];
    const hd: number[] = [];
    const push = (st: number, d: number) => {
      heap.push(st);
      hd.push(d);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hd[p] <= hd[i]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        [hd[p], hd[i]] = [hd[i], hd[p]];
        i = p;
      }
    };
    const pop = () => {
      const st = heap[0];
      const lastS = heap.pop() as number;
      const lastD = hd.pop() as number;
      if (heap.length) {
        heap[0] = lastS;
        hd[0] = lastD;
        let i = 0;
        for (;;) {
          const a = i * 2 + 1;
          const b = a + 1;
          let mi = i;
          if (a < heap.length && hd[a] < hd[mi]) mi = a;
          if (b < heap.length && hd[b] < hd[mi]) mi = b;
          if (mi === i) break;
          [heap[mi], heap[i]] = [heap[i], heap[mi]];
          [hd[mi], hd[i]] = [hd[i], hd[mi]];
          i = mi;
        }
      }
      return st;
    };
    const idx = (x: number, y: number) => (y - y0) * bw + (x - x0);
    for (let d = 0; d < 4; d++) {
      const st = idx(sx, sy) * 4 + d;
      dist[st] = 0;
      push(st, 0);
    }
    let goal = -1;
    while (heap.length) {
      const st = pop();
      const cell = st >> 2;
      const dir = st & 3;
      const cx = (cell % bw) + x0;
      const cy = Math.floor(cell / bw) + y0;
      const dcur = dist[st];
      if (cx === tx && cy === ty) {
        goal = st;
        break;
      }
      for (let nd = 0; nd < 4; nd++) {
        const nx = cx + DX[nd];
        const ny = cy + DY[nd];
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
        const c = cost(ny * m.w + nx);
        if (c === Infinity) continue;
        const nst = idx(nx, ny) * 4 + nd;
        const d = dcur + c + (nd !== dir ? 5 : 0);
        if (d < dist[nst]) {
          dist[nst] = d;
          prev[nst] = st;
          push(nst, d);
        }
      }
    }
    const plan: number[] = [];
    for (let st = goal; st >= 0; st = prev[st]) {
      const cell = st >> 2;
      plan.push((Math.floor(cell / bw) + y0) * m.w + (cell % bw) + x0);
    }
    plan.reverse();
    h.plan = plan;
    h.planFor = tp.id;
  }

  /** 坑道の次のマス：道筋に沿って、まだ岩のままの最初のマス */
  private shaftNext(h: Hold, tp: Pile): number {
    const m = this.w.map;
    if (h.planFor !== tp.id || !h.plan || !h.plan.length) this.planShaft(h, tp);
    const plan = h.plan ?? [];
    for (let i = 0; i < plan.length; i++) {
      const k = plan[i];
      if (m.lava[k]) {
        h.plan = [];
        return -1;
      }
      if (m.solid[k]) return k;
      h.head = k;
    }
    return -1;
  }

  private dwarf(c: Cr): void {
    const s = SPEC[Kind.Dwarf];
    const h = this.hold;
    const m = this.w.map;
    if (this.leaveIfStarving(c)) return;
    if (c.act === 2 && c.actT < 4) return;
    if (!h) {
      c.st = 9;
      return;
    }
    const hx = (h.hk % m.w) * TILE + 8;
    const hy = Math.floor(h.hk / m.w) * TILE + 8;
    // 宝を盗んだ者を追う（戦士と坑夫）。金貨を落とすか、住みかから遠く離れるまで
    {
      const a = this.alarms.get('d');
      if (a && c.sp !== 1) {
        const f = this.byId.get(a.foe);
        if (f && !f.dead && f.gold > 0 && sq(f.x - hx) + sq(f.y - hy) < 25 * TILE * 25 * TILE) {
          this.alarms.set('d', { ...a, t: this.step });
          c.act = 1;
          if (sq(f.x - c.x) + sq(f.y - c.y) < 14 * 14) this.fight(c, f);
          else this.goTo(c, f.x, f.y, s.speed * 1.1);
          return;
        }
      }
    }
    // 住みかを守る：ゴブリン、オーク、コボルト、トロール
    if (c.sp === 2 && this.defend(c, hx, hy, [Kind.Goblin, Kind.Orc, Kind.Kobold, Kind.Troll, Kind.Skeleton])) return;
    // 腹が減ったら、まず広間の蓄えを食べる。なければキノコ（畑のものも）か苔を食べ、大ネズミを狩る
    if ((c.hungry || c.food < s.cap * 0.3) && h.store > 0) {
      c.act = 1;
      if (sq(hx - c.x) + sq(hy - c.y) < 24 * 24 || this.goTo(c, hx, hy, s.speed)) {
        const t = Math.min(h.store, 20, s.cap - c.food);
        h.store -= t;
        c.food += t;
        c.sinceMeal = 0;
        c.hungry = 0;
      }
      return;
    }
    if (c.hungry) {
      if (this.hunt(c, 7, HUNT6, s.speed * 1.1)) return;
      const k = this.findFungus(c.x, c.y, 10, c.id);
      if (k >= 0) {
        c.act = 1;
        if (this.goTo(c, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === k) {
          const t = Math.min(4, this.w.fungus[k] - 12, s.cap - c.food);
          if (t > 0) {
            this.w.fungus[k] -= t;
            c.food += t;
            c.sinceMeal = 0;
            this.mossTouched = true;
          } else this.eatMoss(c, 4);
        }
        return;
      }
      if (this.eatMoss(c, 3)) return;
    }
    // 宝を抱えていたら広間へ運んで山にする
    if (c.gold > 0) {
      c.act = 1;
      if (sq(hx - c.x) + sq(hy - c.y) < 20 * 20 || this.goTo(c, hx, hy, s.speed)) {
        this.dropGold(hx, hy, c.gold);
        c.gold = 0;
      }
      return;
    }
    // 住む場所へ
    if (h.stage === 0) {
      c.act = 1;
      if (this.goTo(c, h.sx * TILE + 8, h.sy * TILE + 8, s.speed) || sq(h.sx * TILE + 8 - c.x) + sq(h.sy * TILE + 8 - c.y) < 20 * 20) h.stage = 1;
      // たどり着けないまま時間が経ったら、住む場所を探し直す
      if (this.w.tick - h.since > DAY_TICKS_ECO / 3) {
        // 背負ってきた食料は持ったまま外へ出ていく
        this.exported += h.store;
        h.store = 0;
        this.hold = null;
        this.lastDwarves = -1;
        for (const o of this.list) if (o.k === Kind.Dwarf && !o.dead) o.st = 9;
      }
      return;
    }
    // 鍛冶屋は鍛冶場で槌を振るう（鍛冶場がなければ広間で）
    if (c.sp === 1) {
      const fk = h.forge >= 0 ? h.forge : h.hk;
      const fx = (fk % m.w) * TILE + 8;
      const fy = Math.floor(fk / m.w) * TILE + 10;
      if (sq(fx + 14 - c.x) + sq(fy - c.y) > 14 * 14) {
        c.act = 1;
        this.goTo(c, fx + 14, fy, s.speed);
      } else {
        c.dir = 3;
        if (h.stage === 1 && h.todo.length && this.step % 4 === 0) {
          // 広間を掘るのを手伝う
        }
        if (c.actT > 30 && h.forge >= 0) {
          c.act = 2;
          c.actT = 0;
        } else if (c.act !== 2) c.act = 0;
      }
      return;
    }
    // 坑夫：広間を掘り、坑道を掘り進める（坑夫がいなければ、ほかの者が代わりに掘る）
    const digger = c.sp === 0 || (c.sp !== 1 && !this.list.some((o) => o.k === Kind.Dwarf && !o.dead && o.sp === 0));
    if (digger && (h.stage === 1 || h.stage === 2)) {
      let k = -1;
      if (h.stage === 1) {
        while (h.todo.length && !m.solid[h.todo[0]]) h.todo.shift();
        // 開いた床に面したマスから順に
        const i = h.todo.findIndex((q) => [q + 1, q - 1, q + m.w, q - m.w].some((n) => !m.solid[n]));
        if (i >= 0) k = h.todo[i];
        else if (h.todo.length) h.todo.length = 0;
      } else {
        // 試し掘りの枝坑道を、ときどき先に
        while (h.drift && h.drift.length && !m.solid[h.drift[0]]) h.drift.shift();
        if (h.drift && h.drift.length && (c.id & 1) === 1 && [h.drift[0] + 1, h.drift[0] - 1, h.drift[0] + m.w, h.drift[0] - m.w].some((n) => !m.solid[n])) k = h.drift[0];
        else {
          const tp = this.piles.find((p) => p.id === h.target);
          if (tp) k = this.shaftNext(h, tp);
          if (k < 0 && tp) h.stage = 3;
        }
      }
      if (k < 0) return;
      const kx = (k % m.w) * TILE + 8;
      const ky = Math.floor(k / m.w) * TILE + 8;
      // 掘るマスの手前の床まで行って、つるはしを振るう
      let stand = -1;
      for (const n of [k + 1, k - 1, k + m.w, k - m.w]) if (!m.solid[n] && !m.sealed[n]) stand = n;
      if (stand < 0) return;
      const sxp = (stand % m.w) * TILE + 8;
      const syp = Math.floor(stand / m.w) * TILE + 8;
      if (sq(sxp - c.x) + sq(syp - c.y) > 12 * 12) {
        c.act = 1;
        this.goTo(c, sxp, syp, s.speed);
        return;
      }
      c.dir = Math.abs(kx - c.x) > Math.abs(ky - c.y) ? (kx > c.x ? 2 : 3) : ky > c.y ? 0 : 1;
      c.act = 2;
      c.actT = 0;
      if (ih(c.id, this.step, 150) % (m.rubble[k] ? 12 : [18, 30, 60][m.hard[k]]) === 0 && this.w.dig(k)) {
        if (h.stage === 1) {
          const i = h.todo.indexOf(k);
          if (i >= 0) h.todo.splice(i, 1);
          this.w.pave(k);
        } else if (h.drift && h.drift[0] === k) {
          h.drift.shift();
        } else {
          h.head = k;
          h.len++;
          // 坑道には数マスおきに壁掛けのランプを残す
          if (h.len % 6 === 0) this.lamps.push(k);
          // ときどき脇へ短い試し掘りの枝坑道（3マス、硬い岩には掘らない）
          if (h.len % 9 === 4) {
            const prevK = (h.plan ?? [])[(h.plan ?? []).indexOf(k) - 1] ?? k;
            const along = Math.abs(k - prevK) === 1 ? 'x' : 'y';
            const side = ih(h.len, this.step, 152) & 1 ? 1 : -1;
            const stepK = along === 'x' ? side * m.w : side;
            const drift: number[] = [];
            for (let i = 1; i <= 3; i++) {
              const q = k + stepK * i;
              if (!m.solid[q] || m.hard[q] === 2 || m.lava[q]) break;
              drift.push(q);
            }
            (h.drift ??= []).push(...drift);
          }
        }
      }
      return;
    }
    // 宝を運ぶ（坑夫と戦士）
    if (h.stage === 3) {
      const tp = this.piles.find((p) => p.id === h.target);
      if (tp) {
        const k = this.tileOf(tp.x, tp.y);
        if (k >= 0 && !m.sealed[k]) {
          c.act = 1;
          if (sq(tp.x - c.x) + sq(tp.y - c.y) < 12 * 12) {
            const t = Math.min(20, tp.gold);
            tp.gold -= t;
            c.gold += t;
            this.piles = this.piles.filter((o) => o.gold > 0);
          } else this.goTo(c, tp.x, tp.y, s.speed);
          return;
        }
      }
    }
    // 広間のまわりで過ごす
    c.act = c.actT % 160 < 50 ? 1 : 0;
    if (c.act === 1) {
      const a = ih(c.id, this.step >> 6, 151) % 7;
      this.moveToward(c, hx + (a - 3) * 6, hy + ((a * 5) % 5 - 2) * 5, s.speed * 0.6);
    }
  }

  // ---------- 外から来るもの ----------

  /** 口が開いているか（閉じた空洞の外にあるか） */
  mouthOpen(i: number): boolean {
    const m = this.w.map;
    const mo = m.mouths[i];
    if (!mo) return false;
    const [x, y] = this.mouthTile(i);
    const k = y * m.w + x;
    return !m.sealed[k] && !m.solid[k];
  }

  /** 口の内側のマス（上の端の横穴はその一つ下、左右の端の横穴は一つ内側） */
  mouthTile(i: number): [number, number] {
    const m = this.w.map;
    const mo = m.mouths[i];
    if (mo.kind !== 0) return [mo.x, mo.y];
    if (mo.y === 0) return [mo.x, 1];
    return [mo.x === 0 ? 1 : mo.x - 1, mo.y];
  }

  /** 口の中の、生き物が現れる場所 */
  mouthSpot(i: number): [number, number] {
    const [x, y] = this.mouthTile(i);
    return [x * TILE + 8, y * TILE + 8];
  }

  /**
   * 外から来る生き物の入り口：種に合う口のうち、開いているものから選ぶ。
   * 地表の生き物は正面の入口か地表の横穴、深い所の生き物は地底の裂け目、水辺の生き物は川の口（開いていなければ正面の入口）
   */
  /**
   * 入り口：正面の入口は人の道（冒険者とドワーフだけ）。野の生き物は自然の口から来る：
   * 地表の生き物は開いた地表の横穴、深い所の生き物は地底の裂け目、リザードマンは川の口。
   * 地表の横穴がまだ開いていなければ、小さな生き物（大ネズミ、トカゲ、クモ、アリ）は天井の裂け目の割れ目から入り込む。
   * 戻り値：mouths の番号、-2 天井の割れ目、-3 入れる所がない
   */
  private pickDoor(k: Kind, salt: number): number {
    const m = this.w.map;
    const want = k === Kind.Basilisk || k === Kind.Minotaur ? 1 : k === Kind.Lizardman ? 2 : 0;
    let open = m.mouths.map((mo, i) => (mo.kind === want && this.mouthOpen(i) ? i : -1)).filter((i) => i >= 0);
    // 狡猾なコボルトは、竜の寝床のそば（20マス以内）の口からは入ってこない
    if (k === Kind.Kobold) {
      // 竜の寝床のそばの口、まわりに住めて食べ物の足りる場所のない口からは来ない
      // （住処がまだないとき。すでにあれば、来る者はその住処に加わるので、口のまわりに新しい場所は要らない）
      const founding = !this.warrens.some((o) => o.id >= 0);
      open = open.filter((i) => !this.dragonNearMouth(i) && (!founding || this.kobMouthOk[i] === 1));
      // 人の気配の薄い口があれば、そちらを選ぶ
      const quiet = open.filter((i) => this.presenceAt(...this.mouthSpot(i)) < 0.5);
      if (quiet.length) open = quiet;
    }
    // ゴブリンも、集落がまだないときは、歩いて行ける範囲に集落の条件を満たし食べ物の足りる場所のある口からだけ来る
    if (k === Kind.Goblin) {
      const founding = !this.camps.some((o) => o.id >= 0 && o.kind === 0);
      open = open.filter((i) => !this.dragonNearMouth(i) && (!founding || this.gobMouthOk[i] === 1));
    }
    // 大ネズミは、まわり（道のり RAT_DOOR_REACH マス）で養える数に余裕のある口か天井の裂け目からだけ来る（裂け目からは、地表の横穴が一つも開いていない間だけ）
    if (k === Kind.Rat) {
      // 天井の割れ目は、地表の横穴が開くまでの序盤の入口（六巡目に戻した。四・五巡目は横穴が開いたあとも割れ目から来て、割れ目のそばで飢えていた）
      const opts = [...open.filter((i) => this.ratMouthOk[i] === 1), ...(!open.length && this.ratShaftOk.some((v) => v === 1) && this.crackSpot(Kind.Rat) ? [-2] : [])];
      return opts.length ? opts[ih(this.step, salt, 196) % opts.length] : -3;
    }
    if (open.length) return open[ih(this.step, salt, 196) % open.length];
    if (k === Kind.Kobold || k === Kind.Goblin) return -3;
    const small = k === Kind.Lizard || k === Kind.Spider || k === Kind.Ant;
    return small && want === 0 ? -2 : -3;
  }

  /** 口 i のそば（20マス以内）に竜の寝床（または卵の殻）があるか */
  private dragonNearMouth(i: number): boolean {
    const [mx, my] = this.mouthSpot(i);
    const R2 = 20 * TILE * 20 * TILE;
    if (this.dragonShell && sq(this.dragonShell.x - mx) + sq(this.dragonShell.y - my) < R2) return true;
    for (const o of this.list) if (o.k === Kind.Dragon && !o.dead && sq((o.hx || o.x) - mx) + sq((o.hy || o.y) - my) < R2) return true;
    return false;
  }

  /** その種が、いま入ってこられる所があるか */
  private canEnter(k: Kind): boolean {
    const d = this.pickDoor(k, k);
    return d >= 0 || (d === -2 && this.crackSpot(k) !== null);
  }

  /** 大ネズミが来られる口と天井の裂け目（1 なら来られる。600刻みごとに決まった刻みで調べ直し、保存する） */
  ratMouthOk: number[] = [];
  ratShaftOk: number[] = [];
  /** 大ネズミが入り込む裂け目を、その刻みだけ決めておく（来る群れが同じ裂け目から入るように。保存しない） */
  private forcedCrack: [number, number] | null = null;
  /**
   * 大ネズミが来るかどうかを決める範囲（道のり）。大ネズミが食べずに歩けるのは約20マスなので、それより内側にする
   * （四巡目は40マスで、天井の裂け目から来た大ネズミが苔にたどり着く前に飢えていた）
   */
  static RAT_DOOR_REACH = 18;
  /** 口のまわり（道のり RAT_DOOR_REACH マス）で、大ネズミをあと2匹以上養えるか（食べられる苔を、一匹が地上の1日に食べる量で割った数と、いまいる数を比べる） */
  private ratRoomAt(x: number, y: number): boolean {
    const d = this.walkDist(this.tileOf(x, y), Ecology.RAT_DOOR_REACH);
    let food = 0;
    for (let q = 0; q < d.length; q++) {
      if (d[q] < 0) continue;
      const v = Math.max(this.w.moss[q], this.w.fungus[q]);
      if (v >= 20) food += v - 12;
    }
    let rats = 0;
    for (const c of this.list) if (c.k === Kind.Rat && !c.dead && !c.away) { const k = this.tileOf(c.x, c.y); if (k >= 0 && d[k] >= 0) rats++; }
    return rats + 2 <= Math.floor(food / 600);
  }
  private checkRatDoors(): void {
    const m = this.w.map;
    this.ratMouthOk = m.mouths.map((mo, i) => (mo.kind === 0 && this.mouthOpen(i) && this.ratRoomAt(...this.mouthSpot(i)) ? 1 : 0));
    this.ratShaftOk = m.shafts.map((q) => (!m.sealed[q.y * m.w + q.x] && !m.solid[q.y * m.w + q.x] && this.ratRoomAt(q.x * TILE + 8, q.y * TILE + 8) ? 1 : 0));
  }
  /** 入ってきた所から道のり RAT_DOOR_REACH マス以内の巣穴（空きのあるもの）か、その範囲の新しい巣穴 */
  private pickBurrowNear(spot: [number, number]): Burrow {
    const m = this.w.map;
    const d = this.walkDist(this.tileOf(spot[0], spot[1]), Ecology.RAT_DOOR_REACH);
    for (const b of this.burrows) {
      const k = this.tileOf(b.x, b.y - 3);
      if (k < 0 || d[k] < 0) continue;
      const n = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y).length;
      if (n > 0 && n < 8) return b;
    }
    const reach: number[] = [];
    for (let q = 0; q < d.length; q++) if (d[q] >= 0) reach.push(q);
    let best = -1;
    let bv = -1e9;
    for (let i = 0; i < 80 && reach.length; i++) {
      const k = reach[ih(this.step, i, 81) % reach.length];
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 0) continue;
      let walls = 0;
      for (const nn of [k + 1, k - 1, k - m.w]) walls += m.solid[nn];
      if (!walls) continue;
      const x = (k % m.w) * TILE + 8;
      const y = Math.floor(k / m.w) * TILE + 11;
      if (this.fireNear(x, y)) continue;
      if (this.burrows.some((b) => Math.abs(b.x - x) < 6 * TILE && Math.abs(b.y - y) < 6 * TILE)) continue;
      const v = this.burrowFood(x, y);
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    if (best < 0) return this.pickBurrow();
    const b: Burrow = { x: (best % m.w) * TILE + 8, y: Math.floor(best / m.w) * TILE + 11 };
    b.cap = this.burrowCap(b);
    this.burrows.push(b);
    return b;
  }

  /** 天井の裂け目のうち、開いた洞窟にあるもの（小さな生き物が入り込む場所） */
  private crackSpot(salt: number): [number, number] | null {
    const m = this.w.map;
    let sh = m.shafts.filter((q) => !m.sealed[q.y * m.w + q.x] && !m.solid[q.y * m.w + q.x]);
    // 大ネズミは、まわりで養える数に余裕のある裂け目からだけ入り込む
    if (salt === Kind.Rat) sh = sh.filter((q) => this.ratShaftOk[m.shafts.indexOf(q)] === 1);
    if (!sh.length) return null;
    const q = sh[ih(this.step, salt, 199) % sh.length];
    return [q.x * TILE + 8, q.y * TILE + 8];
  }

  private arrivals(day: number): void {
    const m = this.w.map;
    const n = this.counts;
    const moss = this.openMoss;
    // 同じ刻みに来る群れは同じ口から
    let door = -9;
    const enter = (k: Kind, body: number, food: number): Cr => {
      this.imported += body + food;
      if (door === -9) door = this.pickDoor(k, k);
      // 呼ぶ側は canEnter で入れる所があることを確かめてから呼ぶ（念のため、なければ正面の入口）
      const spot: [number, number] = (door >= 0 ? this.mouthSpot(door) : door === -2 ? this.forcedCrack ?? this.crackSpot(k) : null) ?? [m.entrance.x * TILE + 16, 1 * TILE + 8];
      const [x, y] = spot;
      const kind = door < 0 ? -1 : m.mouths[door].kind;
      this.originNext = door === -2 ? 'shaft' : ['mouth', 'fissure', 'river'][kind];
      const c = this.spawn(k, x + (this.list.length % 5) - 2, y, body, food);
      if ([Kind.Orc, Kind.Minotaur, Kind.Troll, Kind.Basilisk, Kind.Vampire, Kind.Lizardman, Kind.Goblin, Kind.Kobold, Kind.Salamander].includes(k) && this.step - (this.lastLogged[k] ?? -99999) > 3000) {
        this.lastLogged[k] = this.step;
        this.log(c.x, c.y, kind < 0 ? `{k:${k}}が天井の割れ目から入り込んだ` : kind === 0 ? `{k:${k}}が地表の横穴から入ってきた` : kind === 1 ? `{k:${k}}が地底の裂け目から現れた` : `{k:${k}}が川の口から上がってきた`);
      }
      return c;
    };
    const next = () => {
      door = -9;
    };
    // 大ネズミ：苔が十分に広がったら
    // 住み着いたあとは巣穴で殖える。外からは、いないかごく少ないとき（開拓者）と、ときどきの新顔だけ
    // 中の食べ物に合わせる：食べられる苔（20以上の群落の、根元を除いた分）に対して大ネズミがすでに多いか、腹を空かせた者が多ければ来ない
    // 来るかどうかは、口や裂け目ごとに、まわり（道のり40マス）の食べられる苔と、そこにいる大ネズミの数で決める（ratMouthOk / ratShaftOk）。
    // ダンジョン全体の上限（ratCap）は越えない
    if (this.canEnter(Kind.Rat) && n[Kind.Rat] < this.ratCap() && ih(this.step, 1, 71) % (n[Kind.Rat] < 4 ? 5 : 80) === 0) {
      next();
      // 入ってきた口や裂け目のまわり（道のり40マス）に巣穴を決める
      door = this.pickDoor(Kind.Rat, Kind.Rat);
      const spot = door >= 0 ? this.mouthSpot(door) : this.crackSpot(Kind.Rat);
      if (door === -2 && spot) this.forcedCrack = spot;
      const home = spot ? this.pickBurrowNear(spot) : this.pickBurrow();
      for (let i = 0; i < 2; i++) {
        const r = enter(Kind.Rat, 16, 20);
        r.hx = home.x;
        r.hy = home.y;
      }
      this.forcedCrack = null;
    }
    // 大トカゲ：ネズミが増えたら
    if (this.canEnter(Kind.Lizard) && n[Kind.Rat] >= 10 && n[Kind.Lizard] < Math.min(24, Math.floor(n[Kind.Rat] / 6)) && ih(this.step, 2, 71) % (n[Kind.Lizard] < 2 ? 8 : 120) === 0) {
      next();
      enter(Kind.Lizard, 60, 40);
    }
    // 大グモ：飛ぶものが増えたら
    const fly = n[Kind.Wisp] + n[Kind.Bat];
    if (this.canEnter(Kind.Spider) && fly >= 30 && n[Kind.Spider] < Math.min(14, Math.floor(fly / 25)) && ih(this.step, 3, 71) % (n[Kind.Spider] < 2 ? 10 : 150) === 0) {
      next();
      enter(Kind.Spider, 30, 20);
    }
    // ジャイアントアント：キノコが増えたら、女王と働きアリが巣を作りに来る
    if (this.canEnter(Kind.Ant) && this.openFungus > 2500 && this.colonies.length < 2 && ih(this.step, 4, 71) % 12 === 0) {
      next();
      const site = this.pickNest();
      if (site >= 0) {
        const col: Colony = { id: this.nextId++, x: (site % m.w) * TILE + 8, y: Math.floor(site / m.w) * TILE + 8, store: 16, queen: 30, starve: 0 };
        this.imported += 46;
        this.colonies.push(col);
        for (let i = 0; i < 5; i++) {
          const a = enter(Kind.Ant, 4, 12);
          a.ref = col.id;
          a.st = 1;
        }
      }
    }
    // ゴブリン：口ごとに、歩いて行ける範囲に集落の条件を満たし食べ物（苔・キノコとネズミ）の足りる場所があれば、群れで集落を作りに来る。
    // 集落がすでにあれば、新しく来た者はいちばん小さな集落に加わる。集落が襲われて捨てられた直後は、外の噂でしばらく来ない
    const gcamps = this.camps.filter((o) => o.kind === 0 && o.id >= 0);
    const cool = (k: Kind) => this.step - (this.lastArrival[k] ?? -1e9) > 3600;
    if (this.canEnter(Kind.Goblin) && this.w.tick >= this.goblinShun && n[Kind.Goblin] < 15 && cool(Kind.Goblin) && ih(this.step, 6, 71) % 14 === 0) {
      if (!gcamps.length) {
        next();
        door = this.pickDoor(Kind.Goblin, Kind.Goblin);
        const site = door >= 0 ? this.pickGoblinCamp(undefined, this.mouthSpot(door), Ecology.GOBLIN_MIN_FOOD) : -1;
        if (site >= 0) {
          this.lastArrival[Kind.Goblin] = this.step;
          const cp = this.newCamp(site, 'arrive');
          for (let i = 0; i < 5; i++) {
            const g = enter(Kind.Goblin, 20, 45);
            g.ref = cp.id;
            // 持ってきた食べ物の一部を、集落の蓄えにする
            g.food -= 15;
            cp.store = (cp.store ?? 0) + 15;
          }
        }
      } else if (ih(this.step, 6, 72) % 3 === 0) {
        const sizes = gcamps.map((o) => [o, this.campMembers(o).length] as [Camp, number]).sort((a, b) => a[1] - b[1] || a[0].id - b[0].id);
        const [cp, sz] = sizes[0];
        if (sz < 10) {
          next();
          this.lastArrival[Kind.Goblin] = this.step;
          for (let i = 0; i < 2; i++) enter(Kind.Goblin, 20, 45).ref = cp.id;
        }
      }
    }
    // オーク：ゴブリンかコボルトの集落があると、縄張りを持ちに来る
    const settlements = gcamps.length + this.warrens.length;
    if (this.canEnter(Kind.Orc) && settlements > 0 && n[Kind.Goblin] + n[Kind.Kobold] >= 8 && n[Kind.Orc] < Math.min(6, settlements * 3) && cool(Kind.Orc) && ih(this.step, 7, 71) % 30 === 0) {
      next();
      this.lastArrival[Kind.Orc] = this.step;
      const home = this.pickLair();
      if (home >= 0) {
        const k = 2 + (ih(this.step, 8, 71) & 1);
        for (let i = 0; i < k; i++) {
          const o = enter(Kind.Orc, 60, 80);
          o.hx = (home % m.w) * TILE + 8;
          o.hy = Math.floor(home / m.w) * TILE + 8;
        }
      }
    }
    // リザードマン：大きな水たまりがあり、獲物がいると、水辺に村を作りに来る
    if (this.canEnter(Kind.Lizardman) && n[Kind.Rat] >= 10 && !this.camps.some((o) => o.kind === 1) && n[Kind.Lizardman] < 8 && cool(Kind.Lizardman) && ih(this.step, 9, 71) % 20 === 0) {
      next();
      this.lastArrival[Kind.Lizardman] = this.step;
      const site = this.pickWaterSite(-1);
      if (site >= 0) {
        const v: Camp = { id: this.nextId++, kind: 1, x: (site % m.w) * TILE + 8, y: Math.floor(site / m.w) * TILE + 8, dry: 0 };
        this.camps.push(v);
        const k = 3 + (ih(this.step, 10, 71) & 1);
        for (let i = 0; i < k; i++) enter(Kind.Lizardman, 40, 80).ref = v.id;
      }
    }
    // ミノタウロス：迷路があり獲物が十分いると、1頭だけ住み着きに来る
    if (false && this.canEnter(Kind.Minotaur) && n[Kind.Minotaur] === 0 && n[Kind.Rat] + n[Kind.Goblin] + n[Kind.Kobold] >= 12 && ih(this.step, 11, 71) % 60 === 0) {
      next();
      const mz = this.mazeTiles();
      if (mz.length) {
        const k = mz[ih(this.step, 12, 71) % mz.length];
        const t = enter(Kind.Minotaur, 120, 150);
        t.hx = (k % m.w) * TILE + 8;
        t.hy = Math.floor(k / m.w) * TILE + 8;
      }
    }
    // トロール：食べ物が豊富になると、夜に迷い込む
    const night = this.dayNow < 0.05;
    const food = n[Kind.Rat] + n[Kind.Goblin] + n[Kind.Kobold] + this.corpses.length;
    if (false && this.canEnter(Kind.Troll) && night && food >= 20 && n[Kind.Troll] < 2 && cool(Kind.Troll) && ih(this.step, 13, 71) % 40 === 0) {
      next();
      this.lastArrival[Kind.Troll] = this.step;
      const t = enter(Kind.Troll, 150, 200);
      const lair = this.pickDark(0, 60);
      if (lair >= 0) {
        t.hx = (lair % m.w) * TILE + 8;
        t.hy = Math.floor(lair / m.w) * TILE + 8;
      }
    }
    // バジリスク：ネズミや大トカゲが十分いると
    if (false && this.canEnter(Kind.Basilisk) && (n[Kind.Rat] >= 10 || n[Kind.Lizard] >= 3) && n[Kind.Basilisk] < 2 && cool(Kind.Basilisk) && ih(this.step, 14, 71) % 40 === 0) {
      next();
      this.lastArrival[Kind.Basilisk] = this.step;
      enter(Kind.Basilisk, 60, 60);
    }
    // ヴァンパイア：コウモリが十分に増えると、1体だけ
    if (this.canEnter(Kind.Vampire) && n[Kind.Bat] >= 18 && n[Kind.Vampire] === 0 && cool(Kind.Vampire) && ih(this.step, 15, 71) % 40 === 0) {
      next();
      this.lastArrival[Kind.Vampire] = this.step;
      const v = enter(Kind.Vampire, 50, 80);
      const lair = this.pickDark(1, 80);
      if (lair >= 0) {
        v.hx = (lair % m.w) * TILE + 8;
        v.hy = Math.floor(lair / m.w) * TILE + 8;
      }
    }
    // ワイバーン：コウモリやガーゴイルが増えると、夕暮れに裂け目から降りてくる
    const dusk = this.phaseNow > 0.74 && this.phaseNow < 0.86;
    if (dusk && (n[Kind.Bat] >= 20 || n[Kind.Gargoyle] >= 2) && n[Kind.Wyvern] === 0 && m.shafts.length && cool(Kind.Wyvern) && ih(this.step, 16, 71) % 20 === 0) {
      this.lastArrival[Kind.Wyvern] = this.step;
      const sh = m.shafts[ih(this.step, 17, 71) % m.shafts.length];
      this.imported += SPEC[Kind.Wyvern].body;
      this.originNext = 'shaft';
      const wv = this.spawn(Kind.Wyvern, sh.x * TILE + 8, sh.y * TILE + 8, SPEC[Kind.Wyvern].body, 0);
      this.log(wv.x, wv.y, `天井の裂け目から{k:${Kind.Wyvern}}が舞い降りた`);
      wv.hx = wv.x;
      wv.hy = wv.y;
      wv.st = 1;
    }
    // ドラゴンは外から来ない（深部の濃いマナから幼子が生まれ、育つ：manaBirths）
    // ドワーフ：2日目以降、岩の奥に古い宝がある限り、一団が来て住み着く（いなくなれば、しばらくして次の一団）
    if (this.step % 600 === 300 && !this.hold && this.w.tick > DAY_TICKS_ECO * 2 && (this.lastDwarves < 0 || this.w.tick - this.lastDwarves > DAY_TICKS_ECO)) this.maybeDwarves();
    // 冒険者：噂（明るさ、金貨、アンデッド、大物、竜）に惹かれて一行がやって来る
    if (this.step % 300 === 150 && this.parties.length < Ecology.ADV_MAX_PARTIES) this.maybeParty();
    // コボルト：キノコかネズミが十分いると、群れで住処を掘りに来る。住処がすでにあれば、新しく来た者はそこに加わる。
    // 住処が襲われて捨てられた直後は、外の噂でしばらく来ない
    if (this.canEnter(Kind.Kobold) && this.w.tick >= this.koboldShun && (n[Kind.Rat] >= 6 || this.openFungus > 2500) && n[Kind.Kobold] < 13 && ih(this.step, 5, 71) % 14 === 0) {
      const live = this.warrens.filter((o) => o.id >= 0);
      if (!live.length) {
        next();
        door = this.pickDoor(Kind.Kobold, Kind.Kobold);
        const home = door >= 0 ? this.pickWarren(undefined, this.mouthSpot(door), Ecology.KOBOLD_MIN_FOOD) : -1;
        if (home >= 0) {
          const wr = this.newWarren(home);
          // 4〜6匹の群れで来る。住処に着くまでは「道中」（冒険者が近ければ隠れて待つ）
          const size = 4 + (ih(this.step, 5, 73) % 3);
          for (let i = 0; i < size; i++) {
            const k = enter(Kind.Kobold, 20, 50);
            k.ref = wr.id;
            k.st = 11;
            // 持ってきた食べ物の一部を、住処の蓄えにする
            k.food -= 20;
            wr.store = (wr.store ?? 0) + 20;
          }
        }
      } else if (ih(this.step, 5, 72) % 3 === 0) {
        const sizes = live.map((o) => [o, this.warrenMembers(o).length] as [Warren, number]).sort((a, b) => a[1] - b[1] || a[0].id - b[0].id);
        const [wr, sz] = sizes[0];
        if (sz < 8) {
          next();
          for (let i = 0; i < 2; i++) {
            const k = enter(Kind.Kobold, 20, 50);
            k.ref = wr.id;
            k.st = 11;
          }
        }
      }
    }
  }

  // ---------- マイコニド ----------
  maybeSpawnMyconid(k: number, step: number): void {
    if (this.counts[Kind.Myconid] >= 6 || ih(k, step, 61) % 800 !== 0) return;
    const m = this.w.map;
    this.w.fungus[k] -= 20;
    const c = this.spawn(Kind.Myconid, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 20, 0);
    c.tx = -1;
    this.counts[Kind.Myconid]++;
    // 養分とキノコとマナがどれも極めて濃い所では、キノコの主になる（二つの系統を併せ持つ）
    if (this.w.fungus[k] >= 200 && this.w.nutr[k] >= 40 && this.manaAround(k) >= 12 && !this.list.some((o) => o.elite === 9 && !o.dead) && this.w.tick - (this.lastElite[9] ?? -1e9) > DAY_TICKS_ECO * 2) {
      c.elite = 9;
      this.lastElite[9] = this.w.tick;
      this.takeMana(c, k, 40);
      this.nameOf(c);
      this.log(c.x, c.y, `豊かなキノコと養分と濃いマナから、キノコの主「${this.names.get(c.id)}」が生まれた`);
    }
  }

  private myconid(c: Cr): void {
    const m = this.w.map;
    const s = SPEC[Kind.Myconid];
    if (c.tx < 0) {
      // 暗く湿った、まだキノコのない場所を探す
      const x0 = Math.floor(c.x / TILE);
      const y0 = Math.floor(c.y / TILE);
      let best = -1;
      let bv = -1;
      for (let i = 0; i < 40; i++) {
        const h = ih(c.id, this.step, 62 + i);
        const x = x0 + ((h & 255) % 41) - 20;
        const y = y0 + (((h >>> 8) & 255) % 41) - 20;
        if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
        const k = y * m.w + x;
        if (m.solid[k] || m.lava[k] || this.w.fungus[k] || this.w.lightBase[k] > 80 || this.w.moist[k] < 80) continue;
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
    }
    c.act = 1;
    if (this.goTo(c, c.tx, c.ty, s.speed) || c.actT > 2400) this.plant(c);
  }

  /** 座り込んで、体をそのまま新しいキノコの群落にする */
  private plant(c: Cr): void {
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

  // ---------- ジャイアントアント ----------
  private pickNest(): number {
    const m = this.w.map;
    let best = -1;
    let bv = -1e9;
    for (let i = 0; i < 200; i++) {
      const k = ih(this.step, i, 63) % (m.w * m.h);
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.moist[k] > 120) continue;
      let walls = 0;
      for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (m.solid[q]) walls++;
      if (walls === 0) continue;
      // 近くのキノコの量
      let f = 0;
      const x = k % m.w;
      const y = Math.floor(k / m.w);
      for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) f += this.w.fungus[yy * m.w + xx];
      }
      if (f < 200) continue;
      if (this.colonies.some((o) => Math.abs(o.x - x * TILE) + Math.abs(o.y - y * TILE) < 30 * TILE)) continue;
      const v = f - walls * 10;
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    return best;
  }

  private colonyOf(c: Cr): Colony | undefined {
    return this.colonies.find((o) => o.id === c.ref);
  }

  private ant(c: Cr): void {
    const s = SPEC[Kind.Ant];
    const col = this.colonyOf(c);
    if (!col) {
      // 巣を失ったアリはさまよう
      c.act = 1;
      const j = DIR16[ih(c.id, this.step >> 3, 64) & 15];
      this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
      return;
    }
    // 腹が減ったら、運んでいる物を少し食べる。何もなければ巣に戻って蓄えを食べる
    if (c.hungry && c.units > 0 && c.food < 3) {
      const t = Math.min(c.units, s.cap - c.food);
      c.units -= t;
      c.food += t;
      c.sinceMeal = 0;
    }
    if (c.hungry && c.st === 0 && c.units === 0 && col.store > 0) c.st = 1;
    if (c.st === 1) {
      c.act = 1;
      if (this.goTo(c, col.x, col.y, s.speed) || sq(col.x - c.x) + sq(col.y - c.y) < 10 * 10) {
        col.store += c.units;
        c.units = 0;
        if (c.food < 4 && col.store > 0) {
          const t = Math.min(4, col.store, s.cap - c.food);
          col.store -= t;
          c.food += t;
          c.sinceMeal = 0;
        }
        c.st = 0;
        c.ref2 = 0;
      }
      return;
    }
    // 蓄えが十分なら巣のそばで休む
    if (col.store > 120 && c.units === 0) {
      c.act = sq(col.x - c.x) + sq(col.y - c.y) > 3 * TILE * 3 * TILE ? 1 : 0;
      if (c.act === 1) this.goTo(c, col.x, col.y, s.speed);
      return;
    }
    // 運ぶ物を探す：巣に近い死骸、なければキノコや苔
    let target = this.byId.get(c.ref2) ?? null;
    if (target && (target.dead !== 1 || target.units <= 0)) target = null;
    if (!target && c.ref2 === 0) {
      let bd = 14 * TILE * 14 * TILE;
      for (const o of this.corpses) {
        const d = sq(o.x - col.x) + sq(o.y - col.y);
        if (d < bd) {
          bd = d;
          target = o;
        }
      }
      if (target) c.ref2 = target.id;
      else {
        const k = this.findMoss(c, col.x, col.y, 8, 65);
        const kk = k >= 0 ? k : this.findFungus(col.x, col.y, 8, c.id);
        if (kk >= 0) {
          c.ref2 = -1 - kk;
        } else {
          c.act = 1;
          const j = DIR16[ih(c.id, this.step >> 4, 66) & 15];
          this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
          return;
        }
      }
    }
    c.act = 1;
    if (target) {
      if (sq(target.x - c.x) + sq(target.y - c.y) < 8 * 8) {
        const t = Math.min(2, target.units, 4 - c.units);
        target.units -= t;
        c.units += t;
        if (target.units <= 0) target.dead = 2;
        if (c.units >= 4 || target.dead === 2) c.st = 1;
      } else this.goTo(c, target.x, target.y, s.speed);
      return;
    }
    if (c.ref2 < 0) {
      const k = -1 - c.ref2;
      const m = this.w.map;
      const tx = (k % m.w) * TILE + 8;
      const ty = Math.floor(k / m.w) * TILE + 8;
      if (this.goTo(c, tx, ty, s.speed) || sq(tx - c.x) + sq(ty - c.y) < 8 * 8) {
        let t = Math.min(2, Math.max(0, this.w.fungus[k] - 12), 4 - c.units);
        if (t > 0) this.w.fungus[k] -= t;
        else {
          t = Math.min(2, Math.max(0, this.w.moss[k] - 12), 4 - c.units);
          this.w.moss[k] -= t;
        }
        if (t > 0) this.mossTouched = true;
        c.units += t;
        if (c.units >= 4 || t === 0) c.st = 1;
      }
    }
  }

  private findFungus(cx: number, cy: number, R: number, salt: number): number {
    const m = this.w.map;
    const tx0 = Math.floor(cx / TILE);
    const ty0 = Math.floor(cy / TILE);
    let best = -1;
    let bv = 24;
    for (let i = 0; i < 28; i++) {
      const h = ih(salt, this.step, 67 + i);
      const x = tx0 + ((h & 255) % (2 * R + 1)) - R;
      const y = ty0 + (((h >>> 8) & 255) % (2 * R + 1)) - R;
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.lava[k]) continue;
      if (this.w.fungus[k] > bv) {
        bv = this.w.fungus[k];
        best = k;
      }
    }
    return best;
  }

  /** 巣：蓄えでキノコ畑を育て、女王が働きアリを産む。食べ物が尽きると衰えて消える */
  private updateColonies(): void {
    const m = this.w.map;
    for (const col of this.colonies) {
      const workers = this.list.filter((c) => c.k === Kind.Ant && !c.dead && c.ref === col.id).length;
      // 女王の暮らし
      if (this.step % 200 === 5) {
        if (col.store > 0) {
          col.store--;
          this.deposit(col.x, col.y, 1);
          col.starve = 0;
        } else col.starve++;
      }
      // キノコ畑
      for (let g = 0; g < Math.min(6, Math.floor(col.store / 24)) && this.step % 50 === 5 && (workers >= 30 || col.store > 60) && this.w.totalFungus < 30000; g++) {
        const h = ih(col.id, this.step, 68 + g);
        const x = Math.floor(col.x / TILE) + ((h & 7) % 7) - 3;
        const y = Math.floor(col.y / TILE) + (((h >>> 4) & 7) % 7) - 3;
        if (x > 0 && y > 0 && x < m.w - 1 && y < m.h - 1) {
          const k = y * m.w + x;
          if (!m.solid[k] && !m.lava[k] && this.w.fungus[k] < 200) {
            this.w.fungus[k] += 4;
            col.store -= 4;
            this.mossTouched = true;
          }
        }
      }
      // 産卵
      if (this.step % 100 === 5 && col.store >= 10 && workers < Math.min(40, 6 + Math.floor(col.store / 3))) {
        col.store -= 4;
        const a = this.spawn(Kind.Ant, col.x, col.y, 4, 0);
        a.ref = col.id;
        a.st = 0;
      }
      // 衰えて消える
      if (col.starve > 15 && workers === 0) {
        this.deposit(col.x, col.y, col.queen + col.store);
        col.queen = 0;
        col.store = 0;
        col.id = -1;
      }
    }
    this.colonies = this.colonies.filter((o) => o.id >= 0);
  }

  // ---------- コボルト ----------
  /**
   * 新しい住処の場所：人の気配が薄く（正面の入口や冒険者のよく通る道から離れ）、竜の寝床から30マス、
   * トロールとバジリスクの住みかから15マス離れ、食べ物（キノコ、苔、ネズミ）が近い所。岩壁に面していれば横穴を掘り込める所を好む。
   * avoid の住処からも離れる（住処を捨てて移るとき）
   */
  private pickWarren(avoid?: Warren, from?: [number, number], minFood = 0): number {
    const m = this.w.map;
    let best = -1;
    let bv = -1e9;
    // 歩いて行ける所だけ（出発点からの道のりが100マス以内。道筋を探す広さに収まるように）。その中から選ぶ
    const par = from ? new Int32Array(m.w * m.h) : null;
    const dist = from ? this.walkDist(this.tileOf(from[0], from[1]), 100, par as Int32Array) : null;
    const reach: number[] = [];
    if (dist) for (let q = 0; q < dist.length; q++) if (dist[q] >= 0) reach.push(q);
    if (dist && !reach.length) return -1;
    const danger: [number, number, number][] = [];
    for (const o of this.list) {
      if (o.dead || o.away) continue;
      if (o.k === Kind.Dragon) danger.push([o.hx || o.x, o.hy || o.y, 30]);
      else if (o.k === Kind.Troll || o.k === Kind.Basilisk) danger.push([o.hx || o.x, o.hy || o.y, 15]);
    }
    if (this.dragonShell) danger.push([this.dragonShell.x, this.dragonShell.y, 30]);
    for (let i = 0; i < 260; i++) {
      const k = dist ? reach[ih(this.step, i, 69) % reach.length] : ih(this.step, i, 69) % (m.w * m.h);
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.lightBase[k] > 60) continue;
      const x = k % m.w;
      const y = Math.floor(k / m.w);
      if (Math.abs(x - m.entrance.x) + y < 30) continue;
      let walls = 0;
      for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (m.solid[q]) walls++;
      if (walls < 2) continue;
      if (this.warrens.some((o) => Math.abs(o.x - x * TILE) + Math.abs(o.y - y * TILE) < 30 * TILE)) continue;
      if (avoid && Math.abs(avoid.x - x * TILE) + Math.abs(avoid.y - y * TILE) < 30 * TILE) continue;
      // ゴブリンの集落からも15マス離す（ゴブリンの集落の場所選びと同じ間合い。片方だけでは、集落のすぐそばに住処ができて殺し合っていた）
      if (this.camps.some((o) => o.id >= 0 && o.kind === 0 && Math.abs(o.x / TILE - x) + Math.abs(o.y / TILE - y) < 15)) continue;
      const px = x * TILE + 8;
      const py = y * TILE + 8;
      if (danger.some(([dx, dy, r]) => sq(dx - px) + sq(dy - py) < r * TILE * r * TILE)) continue;
      // 食べ物が足りない所には住まない（minFood を指定したとき）
      if (minFood > 0 && this.warrenFood(k) < minFood) continue;
      const pres = this.presenceAt(px, py);
      if (pres > 0.6) continue;
      // 出発点からの道筋の人の気配：気配の濃いマス（0.5より上）が多い候補ほど避ける（道中で冒険者に出会わないように）。
      // 口が入口のそばにあると、どの道筋も気配の濃い所を通るので、選ばないのではなく点を下げる
      let busy = 0;
      if (par) for (let q = k, n = 0; q >= 0 && n < 200; q = par[q], n++) if (this.presenceAt((q % m.w) * TILE + 8, Math.floor(q / m.w) * TILE + 8) > 0.5) busy++;
      let f = 0;
      for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) f += this.w.fungus[yy * m.w + xx] + (this.w.moss[yy * m.w + xx] >> 2);
      }
      let rats = 0;
      this.nearby(px, py, 10, (o) => {
        if (!o.dead && o.k === Kind.Rat) rats++;
      });
      const v = f + rats * 60 - pres * 1500 - busy * 60 + (this.tunnelDir(k) >= 0 ? 300 : 0) + (ih(k, 1, 70) % 200);
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    return best;
  }

  /** マス k からの歩いた道のり（溶岩、閉じた空洞、岩は通らない。max マスまで。届かなければ -1） */
  /** walkDist の待ち行列（使い回す） */
  private wdQ = new Int32Array(0);
  private walkDist(k: number, max: number, par?: Int32Array): Int32Array {
    const m = this.w.map;
    const N = m.w * m.h;
    const dist = new Int32Array(N).fill(-1);
    if (k < 0) return dist;
    if (par) par[k] = -1;
    if (this.wdQ.length !== N) this.wdQ = new Int32Array(N);
    const q = this.wdQ;
    let h = 0;
    let t = 0;
    dist[k] = 0;
    q[t++] = k;
    const W = m.w;
    while (h < t) {
      const c = q[h++];
      if (dist[c] >= max) continue;
      for (let d = 0; d < 4; d++) {
        const n = d === 0 ? c + 1 : d === 1 ? c - 1 : d === 2 ? c + W : c - W;
        if (n < 0 || n >= N || dist[n] >= 0 || m.solid[n] || m.lava[n] || m.sealed[n]) continue;
        dist[n] = dist[c] + 1;
        if (par) par[n] = c;
        q[t++] = n;
      }
    }
    return dist;
  }

  /**
   * 住処の候補のまわりの食べ物：8マス以内の食べられる苔とキノコ（20以上の群落の、根元12を除いた分）と、10マス以内のネズミ1匹あたり100。
   * 来たばかりの群れ（4〜6匹）が地上の2日ほど食べていける目安が KOBOLD_MIN_FOOD
   */
  static KOBOLD_MIN_FOOD = 1500;
  private warrenFood(k: number): number {
    const m = this.w.map;
    const x0 = k % m.w;
    const y0 = Math.floor(k / m.w);
    let f = 0;
    for (let y = Math.max(1, y0 - 8); y <= Math.min(m.h - 2, y0 + 8); y++)
      for (let x = Math.max(1, x0 - 8); x <= Math.min(m.w - 2, x0 + 8); x++) {
        const q = y * m.w + x;
        if (m.solid[q] || m.sealed[q]) continue;
        const v = Math.max(this.w.moss[q], this.w.fungus[q]);
        if (v >= 20) f += v - 12;
      }
    this.nearby(x0 * TILE + 8, y0 * TILE + 8, 10, (o) => {
      if (!o.dead && o.k === Kind.Rat) f += 100;
    });
    return f;
  }

  /**
   * 口ごとに、そこからコボルトが来られるか（歩いて行ける範囲に、住処の条件を満たし食べ物も足りる場所があるか）。
   * 地上の約2時間（600刻み）ごとに決まった刻みで調べ直し、保存する
   */
  kobMouthOk: number[] = [];
  private checkKoboldMouths(): void {
    const m = this.w.map;
    this.kobMouthOk = m.mouths.map((mo, i) => (mo.kind === 0 && this.mouthOpen(i) && !this.dragonNearMouth(i) && this.pickWarren(undefined, this.mouthSpot(i), Ecology.KOBOLD_MIN_FOOD) >= 0 ? 1 : 0));
  }

  /** 床のマス k から、岩壁へまっすぐ4マス掘り込める向き（なければ -1） */
  private tunnelDir(k: number): number {
    const m = this.w.map;
    const steps = [1, -1, m.w, -m.w];
    for (let d = 0; d < 4; d++) {
      let ok = true;
      for (let i = 1; i <= 4 && ok; i++) {
        const q = k + steps[d] * i;
        const x = q % m.w;
        const y = Math.floor(q / m.w);
        if (x < 3 || y < 3 || x >= m.w - 3 || y >= m.h - 3 || !m.solid[q] || m.lava[q]) ok = false;
        else for (const r of [q + 1, q - 1, q + m.w, q - m.w]) if (m.lava[r] || (m.sealed[r] && !m.solid[r])) ok = false;
        // 横穴の横は岩であること（すぐ隣の洞窟に抜けない）
        if (ok && i > 1) {
          const side = d < 2 ? m.w : 1;
          if (!m.solid[q + side] || !m.solid[q - side]) ok = false;
        }
      }
      if (ok) return d;
    }
    return -1;
  }

  /** 新しい住処を作る（door は入口の床のマス） */
  private newWarren(door: number, how = 'arrive'): Warren {
    const m = this.w.map;
    this.record('settle', { t: this.w.tick, k: Kind.Kobold, id: this.nextId, ev: 'found', how, x: (door % m.w) * TILE + 8, y: Math.floor(door / m.w) * TILE + 8 } as never);
    const wr: Warren = { id: this.nextId++, x: (door % m.w) * TILE + 8, y: Math.floor(door / m.w) * TILE + 8, target: -1, prog: 0, len: 0, door, dir: this.tunnelDir(door), tun: 0, store: 0, hide: 0, raids: 0, empty: -1 };
    this.warrens.push(wr);
    return wr;
  }

  private warrenMembers(wr: Warren): Cr[] {
    return this.list.filter((c) => c.k === Kind.Kobold && !c.dead && c.ref === wr.id && c.st !== 10);
  }

  /** 隠れているコボルト（住処の奥に身をひそめている。入口に踏み込まれない限り、誰にも気づかれない） */
  isHidden(o: Cr): boolean {
    if (o.k === Kind.Goblin) return this.goblinHidden(o);
    if (o.k !== Kind.Kobold || o.dead) return false;
    // 住処へ向かう道中で、冒険者をやり過ごすために身をひそめている
    if (o.st === 12) return true;
    if (o.st !== 7) return false;
    const wr = this.warrenOf(o);
    return !!wr && wr.hide === 1 && sq(o.x - wr.x) + sq(o.y - wr.y) < 1.5 * TILE * 1.5 * TILE;
  }

  /** 見る者 c が、隠れている o の住処の入口に踏み込んでいるか（すぐそばまで来ているか） */
  private atDoorOf(c: Cr, o: Cr): boolean {
    if (o.st === 12 || o.k === Kind.Goblin) return sq(o.x - c.x) + sq(o.y - c.y) < 1.2 * TILE * 1.2 * TILE;
    const wr = this.warrenOf(o);
    if (!wr) return true;
    const m = this.w.map;
    const d = wr.door ?? -1;
    if (d >= 0 && sq((d % m.w) * TILE + 8 - c.x) + sq(Math.floor(d / m.w) * TILE + 8 - c.y) < 1.2 * TILE * 1.2 * TILE) return true;
    return sq(o.x - c.x) + sq(o.y - c.y) < 1.2 * TILE * 1.2 * TILE;
  }

  private warrenOf(c: Cr): Warren | undefined {
    return this.warrens.find((o) => o.id === c.ref);
  }

  private kobold(c: Cr): void {
    const s = SPEC[Kind.Kobold];
    // 住処へ向かう道中：冒険者が近くにいる間は身をひそめて待ち、離れてから進む
    if ((c.st === 11 || c.st === 12) && this.koboldTransit(c)) return;
    // 冒険者に気づいたら、一行がずっと強ければ戦わずに逃げる（追いかけてはこない）
    if (c.flee <= 0 && this.step % 4 === c.id % 4) {
      let adv: Cr | null = null;
      this.nearby(c.x, c.y, 8, (o) => {
        if (adv || o.dead || o.away || o.k !== Kind.Adventurer || sq(o.x - c.x) + sq(o.y - c.y) > 8 * TILE * 8 * TILE || !this.canSense(c, o)) return;
        adv = o;
      });
      if (adv) {
        const a = adv as Cr;
        const p = this.parties.find((q) => q.id === a.party);
        if ((p ? this.partyStr(p) : this.str(a)) > this.str(c) * 2) {
          c.flee = 90 + (ih(c.id, this.step, 232) % 40);
          c.foe = a.id;
          c.lure = 0;
          return;
        }
      }
    }
    if (c.st === 10) {
      this.leaveWithGroup(c);
      return;
    }
    const wr = this.warrenOf(c);
    // 住みか（逃げ帰る先）は住処。来たときの口ではない
    if (wr && c.flee <= 0) {
      c.hx = wr.x;
      c.hy = wr.y;
    }
    // 住処のある者は一匹で見切りをつけない（住処ごと捨てるのは群れの出来事：updateWarrens）。住処のない者だけが飢えて去る
    if (!wr && this.leaveIfStarving(c)) return;
    if (c.act === 2 && c.actT < 4 && c.st !== 2) return;
    // 隠れる：一行が群れより明らかに強いあいだは、住処の奥で身をひそめる（蓄えから食べる。蓄えが尽きて飢えれば、こっそり食べ物を探しに出る）
    if (wr && wr.hide === 1 && c.hungry && (wr.store ?? 0) > 0) {
      const t = Math.min(wr.store ?? 0, Math.floor(s.cap * 0.7) - c.food);
      wr.store = (wr.store ?? 0) - t;
      c.food += t;
      c.hungry = 0;
      c.sinceMeal = 0;
    }
    if (wr && wr.hide === 1 && !(c.hungry > 300 && (wr.store ?? 0) <= 0) && (c.st === 7 || sq(wr.x - c.x) + sq(wr.y - c.y) < 8 * TILE * 8 * TILE)) {
      c.st = 7;
      if (sq(wr.x - c.x) + sq(wr.y - c.y) > 0.6 * TILE * 0.6 * TILE) {
        c.act = 1;
        this.goTo(c, wr.x, wr.y, s.speed * 1.2);
      } else c.act = 0;
      return;
    }
    if (c.st === 7) c.st = 0;
    if (wr && this.defend(c, wr.x, wr.y, [Kind.Goblin])) return;
    const home = wr ? sq(wr.x - c.x) + sq(wr.y - c.y) : 1e18;
    // 腹を空かせた者は、住処の蓄えから食べる
    if (wr && (wr.store ?? 0) > 0 && (c.hungry || c.food < s.cap * 0.15)) {
      if (home < 2 * TILE * 2 * TILE) {
        const t = Math.min(wr.store ?? 0, Math.floor(s.cap * 0.7) - c.food);
        if (t > 0) {
          wr.store = (wr.store ?? 0) - t;
          c.food += t;
          c.hungry = 0;
          c.sinceMeal = 0;
          c.act = 2;
          c.actT = 0;
          c.st = 0;
          return;
        }
      } else if (home < 30 * TILE * 30 * TILE) {
        c.act = 1;
        this.goTo(c, wr.x, wr.y, s.speed);
        return;
      }
    }
    // 蓄えを運び込む：腹が満ちた者は、余りを住処に置く
    if (wr && c.food > s.cap * 0.75 && home < 2 * TILE * 2 * TILE && (wr.store ?? 0) < this.storeGoal(wr)) {
      const t = c.food - Math.floor(s.cap * 0.5);
      c.food -= t;
      wr.store = (wr.store ?? 0) + t;
      c.act = 2;
      c.actT = 0;
      if (c.st === 4) c.st = 0;
      return;
    }
    // 食べ物を集めに出る：蓄えが足りなければ、群れのうち何匹かが交代で狩りに出て、腹いっぱいにして帰る
    if (wr && c.st === 0 && !c.hungry && (wr.store ?? 0) < this.storeGoal(wr) && c.food < s.cap * 0.85 && ih(c.id, this.step >> 7, 76) % 3 === 0) c.st = 4;
    if (c.st === 4 && c.food >= s.cap * 0.95) {
      c.st = 0;
      if (wr) {
        c.act = 1;
        this.goTo(c, wr.x, wr.y, s.speed);
        return;
      }
    }
    // 腹が減ったら、ネズミを狩るか、キノコを食べる（食べ始めたら腹が満ちるまで食べる）
    if (c.st === 3 && c.food >= s.cap * 0.7) c.st = 0;
    if (c.hungry || c.st === 3 || c.st === 4) {
      if (c.hungry && c.st !== 4) c.st = 3;
      let prey: Cr | null = null;
      let bd = 8 * TILE * 8 * TILE;
      this.nearby(c.x, c.y, 8, (o) => {
        if (o.dead || o.away || o.k !== Kind.Rat) return;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          prey = o;
        }
      });
      if (prey) {
        const p = prey as Cr;
        c.act = 1;
        if (sq(p.x - c.x) + sq(p.y - c.y) < 10 * 10) {
          this.eat(c, p);
          return;
        }
        this.goTo(c, p.x, p.y, s.speed * 1.2);
        return;
      }
      const k0 = this.findMoss(c, c.x, c.y, c.sinceMeal > 600 ? 14 : 8, 72);
      const k = k0 >= 0 ? k0 : this.findFungus(c.x, c.y, c.sinceMeal > 600 ? 14 : 8, c.id + this.step);
      if (k >= 0) {
        const m = this.w.map;
        c.act = 1;
        if (this.goTo(c, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, s.speed) || this.tileOf(c.x, c.y) === k) {
          if (!this.eatMoss(c, 4) && c.hungry === 0 && c.st !== 4) c.st = 0;
        }
        return;
      }
      if (c.st === 4) c.st = 0;
      if (!c.hungry) c.st = 0;
    }
    if (!wr) {
      c.act = 1;
      const j = DIR16[ih(c.id, this.step >> 4, 73) & 15];
      this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
      return;
    }
    // 掘る：住処のまわりの岩を少しずつ崩してトンネルを延ばす
    if (wr.target >= 0 && this.w.map.solid[wr.target]) {
      const m = this.w.map;
      const tx = (wr.target % m.w) * TILE + 8;
      const ty = Math.floor(wr.target / m.w) * TILE + 8;
      if (sq(tx - c.x) + sq(ty - c.y) < 20 * 20) {
        c.st = 2;
        c.act = 2;
        if (c.actT > 4) c.actT = 0;
        c.dir = Math.abs(tx - c.x) > Math.abs(ty - c.y) ? (tx > c.x ? 2 : 3) : ty > c.y ? 0 : 1;
        wr.prog++;
        if (wr.prog >= [500, 900, 2400][m.rubble[wr.target] ? 0 : m.hard[wr.target]]) {
          if (this.w.dig(wr.target)) {
            wr.len++;
            // 横穴を掘り込んでいるなら、住処の中心を奥へ移す
            if ((wr.dir ?? -1) >= 0 && wr.target === this.tunnelNext(wr)) {
              wr.tun = (wr.tun ?? 0) + 1;
              wr.x = (wr.target % m.w) * TILE + 8;
              wr.y = Math.floor(wr.target / m.w) * TILE + 8;
              if ((wr.tun ?? 0) >= 4) wr.dir = -1;
            }
          }
          wr.target = -1;
          wr.prog = 0;
          c.st = 0;
        }
        return;
      }
      c.act = 1;
      // 岩の手前の床まで行く
      const fl = this.floorNear(wr.target);
      if (fl >= 0) this.goTo(c, (fl % m.w) * TILE + 8, Math.floor(fl / m.w) * TILE + 8, s.speed);
      else wr.target = -1;
      return;
    }
    c.st = 0;
    // 住処のそばでくつろぐ
    if (sq(wr.x - c.x) + sq(wr.y - c.y) > 4 * TILE * 4 * TILE) {
      c.act = 1;
      this.goTo(c, wr.x, wr.y, s.speed);
    } else {
      c.act = c.actT % 60 < 40 ? 0 : 1;
      if (c.act === 1) {
        const j = DIR16[ih(c.id, this.step >> 4, 74) & 15];
        this.tryMove(c, j[0] * s.speed * 0.4, j[1] * s.speed * 0.4);
      }
    }
  }

  private floorNear(k: number): number {
    const m = this.w.map;
    for (const q of [k + m.w, k - m.w, k + 1, k - 1]) if (q >= 0 && q < m.solid.length && !m.solid[q] && !m.lava[q]) return q;
    return -1;
  }

  /** 横穴の次に掘るマス（掘り込んでいなければ -1） */
  private tunnelNext(wr: Warren): number {
    const m = this.w.map;
    const d = wr.dir ?? -1;
    if (d < 0 || (wr.door ?? -1) < 0) return -1;
    return (wr.door as number) + [1, -1, m.w, -m.w][d] * ((wr.tun ?? 0) + 1);
  }

  /** 蓄えの目安（群れの数に応じて） */
  private storeGoal(wr: Warren): number {
    return Math.min(300, 40 * Math.max(2, this.warrenMembers(wr).length));
  }

  /** 群れごと住処を捨てて、開いた自然の口へ向かう者 */
  private leaveWithGroup(c: Cr): void {
    const s = SPEC[c.k];
    c.act = 1;
    const m = this.w.map;
    let ex = -1;
    let ey = -1;
    let bd = 1e18;
    for (let i = 0; i < m.mouths.length; i++) {
      if (m.mouths[i].kind !== 0 || !this.mouthOpen(i)) continue;
      const [mx, my] = this.mouthSpot(i);
      const d = sq(mx - c.x) + sq(my - c.y);
      if (d < bd) {
        bd = d;
        ex = mx;
        ey = my;
      }
    }
    // 口がふさがってしまったら、中にとどまる（近くの住処に加わる）
    if (ex < 0) {
      c.st = 0;
      return;
    }
    if (this.goTo(c, ex, ey, s.speed) || sq(ex - c.x) + sq(ey - c.y) < 30 * 30) this.exitCreature(c, 'abandoned');
  }

  /** 生きたまま外へ出ていく（帳簿と記録） */
  private exitCreature(c: Cr, reason: string): void {
    this.record('exits', { t: this.w.tick, k: c.k, reason, x: Math.round(c.x), y: Math.round(c.y) } as never);
    this.w.manaLeaked += c.mana;
    c.mana = 0;
    this.exported += c.body + c.food + c.units;
    if (c.gold > 0) {
      this.goldOut += c.gold;
      c.gold = 0;
    }
    this.dropBelongings(c);
    c.body = 0;
    c.food = 0;
    c.units = 0;
    this.paths.delete(c.id);
    c.dead = 2;
  }

  /**
   * 住処を捨てる（群れの出来事）。開いた地表の横穴があれば群れごと外へ去り、なければ中の別の場所へ移る。
   * reason：0 蓄えが尽きた、1 何度も襲われた、2 数が減った、3 竜が近くに住みついた
   */
  private abandonWarren(wr: Warren, reason: number): boolean {
    const m = this.w.map;
    const members = this.warrenMembers(wr);
    const why = ['蓄えが尽きて', '何度も襲われて', '1匹になって', '竜を恐れて'][reason];
    const open = m.mouths.some((mo, i) => mo.kind === 0 && this.mouthOpen(i));
    const rec = (to: string) => this.record('settle', { t: this.w.tick, k: Kind.Kobold, id: wr.id, ev: 'abandon', reason: ['food', 'raids', 'alone', 'dragon'][reason], to, n: members.length, x: Math.round(wr.x), y: Math.round(wr.y) } as never);
    if (reason === 1 || reason === 3) this.koboldShun = Math.max(this.koboldShun, this.w.tick + DAY_TICKS_ECO * 2);
    if (!open) {
      const site = this.pickWarren(wr, [wr.x, wr.y], Ecology.KOBOLD_MIN_FOOD);
      if (site < 0) return false;
      rec('move');
      const nw = this.newWarren(site, 'move');
      nw.store = wr.store ?? 0;
      wr.store = 0;
      for (const c of members) {
        c.ref = nw.id;
        c.st = 0;
        c.hx = nw.x;
        c.hy = nw.y;
      }
      this.log(nw.x, nw.y, `{k:${Kind.Kobold}}の一団が${why}住処を捨て、別の場所へ移った`);
    } else {
      // 蓄えは皆で持てるだけ持って出る（持ちきれない分はその場の土へ）
      let st = wr.store ?? 0;
      for (const c of members) {
        const t = Math.min(st, SPEC[Kind.Kobold].cap - c.food);
        c.food += t;
        st -= t;
        c.st = 10;
        c.ref = 0;
        c.flee = 0;
      }
      this.deposit(wr.x, wr.y, st);
      wr.store = 0;
      rec('leave');
      this.log(wr.x, wr.y, `{k:${Kind.Kobold}}の一団が${why}住処を捨てて去った`);
    }
    this.traps = this.traps.filter((t) => t.w !== wr.id);
    wr.id = -1;
    return true;
  }

  /** 住処ごとに、次に掘る岩を決め、群れが増えたら子を産む。誰もいない住処は消える。立ち行かなくなった住処は捨てる */
  private updateWarrens(): void {
    const m = this.w.map;
    for (const wr of this.warrens) {
      if (wr.id < 0) continue;
      const members = this.warrenMembers(wr);
      if (!members.length) {
        this.record('settle', { t: this.w.tick, k: Kind.Kobold, id: wr.id, ev: 'empty', x: Math.round(wr.x), y: Math.round(wr.y) } as never);
        this.deposit(wr.x, wr.y, wr.store ?? 0);
        wr.store = 0;
        this.traps = this.traps.filter((t) => t.w !== wr.id);
        wr.id = -1;
        continue;
      }
      // 襲われた記憶は少しずつ薄れる
      if (this.step % 600 === 35 && (wr.raids ?? 0) > 0) wr.raids = (wr.raids ?? 0) - 1;
      // 蓄えが尽きた時を覚える
      if ((wr.store ?? 0) > 0) wr.empty = -1;
      else if ((wr.empty ?? -1) < 0) wr.empty = this.w.tick;
      // 立ち行かなくなったら、群れごと住処を捨てる
      let dragonNear = false;
      for (const o of this.list) if (o.k === Kind.Dragon && !o.dead && o.sp >= 1 && sq((o.hx || o.x) - wr.x) + sq((o.hy || o.y) - wr.y) < 30 * TILE * 30 * TILE) dragonNear = true;
      if (members.length >= 2) wr.alone = -1;
      else if ((wr.alone ?? -1) < 0) wr.alone = this.w.tick;
      // 1匹になっても、地上の1日は新しく来る仲間を待つ（来る者はいちばん小さな住処に加わる）
      const lonely = members.length < 2 && this.w.tick - (wr.alone as number) > DAY_TICKS_ECO;
      const reason = (wr.raids ?? 0) >= 4 ? 1 : dragonNear ? 3 : lonely ? 2 : (wr.empty ?? -1) >= 0 && this.w.tick - (wr.empty as number) > DAY_TICKS_ECO && members.every((c) => c.hungry > 0 || c.food < 10) ? 0 : -1;
      if (reason >= 0 && wr.hide !== 1 && this.abandonWarren(wr, reason)) continue;
      if (wr.target >= 0) {
        if (wr.prog === (wr.lastProg ?? 0)) wr.stall = (wr.stall ?? 0) + 50;
        else wr.stall = 0;
        wr.lastProg = wr.prog;
        if ((wr.stall ?? 0) > ((wr.dir ?? -1) >= 0 ? 6000 : 1500)) {
          wr.target = -1;
          wr.stall = 0;
          wr.dir = -1;
        }
      }
      // まず岩壁に横穴を掘り込み、その奥を住処にする
      const tn = this.tunnelNext(wr);
      if (wr.target < 0 && tn >= 0) {
        if (m.solid[tn] && !m.lava[tn]) {
          wr.target = tn;
          wr.prog = 0;
        } else wr.dir = -1;
      }
      if (wr.target < 0 && (wr.len < 30 || (this.onIsland(wr.x, wr.y) && wr.len < 90))) {
        const hx = Math.floor(wr.x / TILE);
        const hy = Math.floor(wr.y / TILE);
        const R = 3 + (wr.len >> 1);
        // 空洞の気配：近くに閉じた空洞があれば、その方へ掘りたがる
        const sk = this.windTarget(hx, hy, 50) ?? this.w.nearestSealed(hx, hy, 25);
        const mainPt = this.onIsland(wr.x, wr.y) ? this.nearestMain(hx, hy) : -1;
        let best = -1;
        let bv = -1e9;
        for (let i = 0; i < 60; i++) {
          const h = ih(wr.id, this.step, 75 + i);
          const x = hx + ((h & 255) % (2 * R + 1)) - R;
          const y = hy + (((h >>> 8) & 255) % (2 * R + 1)) - R;
          if (x < 3 || y < 3 || x >= m.w - 3 || y >= m.h - 3) continue;
          const k = y * m.w + x;
          if (!m.solid[k] || this.floorNear(k) < 0) continue;
          // 溶岩には掘り当てない
          let lavaNear = false;
          for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (m.lava[q]) lavaNear = true;
          if (lavaNear) continue;
          let v = -(Math.abs(x - hx) + Math.abs(y - hy)) * 3 + (h >>> 16) % 20;
          // 島の住処は、入口側の洞窟の気配（物音や風）の方へ掘りたがる
          if (mainPt >= 0) v -= (Math.abs(x - (mainPt % m.w)) + Math.abs(y - Math.floor(mainPt / m.w))) * 6;
          else if (sk >= 0) v -= (Math.abs(x - (sk % m.w)) + Math.abs(y - Math.floor(sk / m.w))) * 4;
          if (v > bv) {
            bv = v;
            best = k;
          }
        }
        wr.target = best;
        wr.prog = 0;
      }
      // 住処のそばでキノコを育てる（土の養分をキノコに移す。養分の総量は変わらない）
      if (this.step % 50 === 35 && members.length >= 2) this.farmFungus(wr);
      // 入口のまわりに罠を仕掛ける（2つまで。横穴を掘り終えてから）
      if ((wr.dir ?? -1) < 0 && this.step % 300 === 35 + (wr.id % 5) * 50 && this.traps.filter((t) => t.w === wr.id).length < 2) this.placeTrap(wr);
      // 子を産む：蓄えが目安の3割以上あるときだけ（増えてから飢えるのではなく、食べ物に合わせて増える）
      if (this.step % 600 === 35 && members.length >= 2 && this.counts[Kind.Kobold] < 16 && (wr.store ?? 0) >= Math.max(20, this.storeGoal(wr) * 0.3)) {
        const p = members[0];
        wr.store = (wr.store ?? 0) - 20;
        const ch = this.spawn(Kind.Kobold, p.x, p.y, 20, 0);
        ch.ref = wr.id;
      }
      // 増えすぎたら、若い者が分かれて中の別の場所に新しい住処を作る
      if (this.step % 600 === 335 && members.length >= 12 && (wr.store ?? 0) >= 40 && this.warrens.filter((o) => o.id >= 0).length < 3) {
        const site = this.pickWarren(undefined, [wr.x, wr.y], Ecology.KOBOLD_MIN_FOOD);
        if (site >= 0) {
          const nw = this.newWarren(site, 'split');
          const young = members.slice().sort((p, q) => q.id - p.id).slice(0, 4);
          for (const c of young) {
            c.ref = nw.id;
            c.st = 0;
          }
          const share = Math.floor((wr.store ?? 0) / 3);
          wr.store = (wr.store ?? 0) - share;
          nw.store = share;
          this.log(nw.x, nw.y, `{k:${Kind.Kobold}}の群れが分かれ、新しい住処を作った`);
        }
      }
    }
    this.warrens = this.warrens.filter((o) => o.id >= 0);
  }

  /** 住処のそばの暗く湿った床（決まった数マスの畑）で、土の養分をキノコに移して育てる */
  /** 住処の畑のマス（住処のそばの決まった数マス：暗く、湿っているか横穴の中。最大3マス）。描画でも使う */
  farmTiles(wr: Warren): number[] {
    const m = this.w.map;
    const hx = Math.floor(wr.x / TILE);
    const hy = Math.floor(wr.y / TILE);
    const out: number[] = [];
    for (let i = 0; i < 24 && out.length < 3; i++) {
      const h = ih(wr.id, i, 230);
      const x = hx + (h % 9) - 4;
      const y = hy + ((h >>> 8) % 9) - 4;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.lava[k] || m.sealed[k] || this.w.water[k] > 30 || this.w.lightBase[k] > 100) continue;
      // 掘った横穴の中と入口のまわりは、地中の湿り気がある扱い（湿り気の値は書き換えない）
      if (this.w.moist[k] < 40 && !this.underground(wr, k)) continue;
      out.push(k);
    }
    return out;
  }

  /** 住処のそばの畑で、土の養分をキノコに移して育てる */
  private farmFungus(wr: Warren): void {
    const m = this.w.map;
    for (const k of this.farmTiles(wr)) {
      if (this.w.fungus[k] >= 160) continue;
      let got = 0;
      for (const q of [k, k + 1, k - 1, k + m.w, k - m.w, k + 2, k - 2, k + 2 * m.w, k - 2 * m.w]) {
        if (got >= 6 || q < 0 || q >= m.solid.length || m.solid[q] || m.lava[q]) continue;
        const t = Math.min(6 - got, this.w.nutr[q]);
        this.w.nutr[q] -= t;
        got += t;
      }
      if (got > 0) {
        this.w.fungus[k] = Math.min(255, this.w.fungus[k] + got);
        this.mossTouched = true;
      }
    }
  }

  /**
   * 住処へ向かう道中（st 11）：冒険者が8マス以内にいれば、その場の暗がりに身をひそめて待つ（st 12。すぐそばまで来られない限り気づかれない）。
   * 10マスより離れたら進む。住処に着いたら（3マス）ふだんの暮らしへ。ひどく腹が減ったら道中をやめて食べ物を探す。true なら今は道中
   */
  private koboldTransit(c: Cr): boolean {
    const wr = this.warrenOf(c);
    if (!wr || c.hungry > 600 || sq(wr.x - c.x) + sq(wr.y - c.y) < 3 * TILE * 3 * TILE) {
      c.st = 0;
      return false;
    }
    let nd = 1e18;
    this.nearby(c.x, c.y, 10, (o) => {
      if (o.dead || o.away || o.k !== Kind.Adventurer) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < nd) nd = d;
    });
    if (nd < 8 * TILE * 8 * TILE || (c.st === 12 && nd < 10 * TILE * 10 * TILE)) {
      // すぐそばまで来られたら、隠れていられない（ふだんの逃げ方に任せる）
      if (nd < 1.5 * TILE * 1.5 * TILE) {
        c.st = 11;
        return false;
      }
      c.st = 12;
      c.act = 0;
      return true;
    }
    c.st = 11;
    c.act = 1;
    this.goTo(c, wr.x, wr.y, SPEC[Kind.Kobold].speed);
    return true;
  }

  /** 住処の横穴の中（掘ったマス）か、入口から2マス以内か */
  private underground(wr: Warren, k: number): boolean {
    const m = this.w.map;
    const d = wr.door ?? -1;
    if (d >= 0 && Math.abs((k % m.w) - (d % m.w)) + Math.abs(Math.floor(k / m.w) - Math.floor(d / m.w)) <= 2) return true;
    return m.dug[k] === 1 && sq((k % m.w) * TILE + 8 - wr.x) + sq(Math.floor(k / m.w) * TILE + 8 - wr.y) < 6 * TILE * 6 * TILE;
  }

  /** 住処の入口から2〜3マスの、横穴の外の床に罠を仕掛ける */
  private placeTrap(wr: Warren): void {
    const m = this.w.map;
    const d = wr.door ?? -1;
    if (d < 0) return;
    const dx0 = d % m.w;
    const dy0 = Math.floor(d / m.w);
    for (let i = 0; i < 12; i++) {
      const h = ih(wr.id, this.step, 240 + i);
      const x = dx0 + (h % 7) - 3;
      const y = dy0 + ((h >>> 8) % 7) - 3;
      const r = Math.abs(x - dx0) + Math.abs(y - dy0);
      if (r < 2 || r > 3 || x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      // 横穴の中（掘ったマス）には置かず、入口の外の床に置く
      if (m.solid[k] || m.lava[k] || m.sealed[k] || m.dug[k] || this.w.water[k] > 20 || this.traps.some((t) => t.k === k)) continue;
      this.traps.push({ id: this.nextId++, k, w: wr.id });
      return;
    }
  }

  /** 罠：冒険者が踏むと傷を負い、罠は消える（毎刻み） */
  private checkTraps(): void {
    if (!this.traps.length) return;
    const m = this.w.map;
    for (const t of this.traps) {
      const x = (t.k % m.w) * TILE + 8;
      const y = Math.floor(t.k / m.w) * TILE + 8;
      let hit: Cr | null = null;
      this.nearby(x, y, 0, (o) => {
        if (!hit && !o.dead && o.k === Kind.Adventurer) hit = o;
      });
      if (!hit) continue;
      const c = hit as Cr;
      const mx = this.maxHp(c);
      if (c.hp <= 0) c.hp = mx;
      c.hp = Math.max(1, c.hp - mx * 0.35);
      c.hitAt = this.w.tick;
      this.bleed(c, 2);
      this.noise(x, y, 7);
      this.markNotice(c, c, '!');
      if (this.step - (this.lastLogged[996] ?? -99999) > 1500) {
        this.lastLogged[996] = this.step;
        this.log(x, y, `冒険者が{k:${Kind.Kobold}}の罠を踏んで傷を負った`);
      }
      t.id = -1;
    }
    this.traps = this.traps.filter((t) => t.id >= 0);
  }

  /**
   * 住処の見張り（10刻みごと）：冒険者の一行が近づき、群れより明らかに強ければ奥に隠れる。
   * 隠れているところを見つかったら（入口に踏み込まれたら）、皆で深い方へ逃げる。一行が離れたら隠れるのをやめる
   */
  private watchWarrens(): void {
    for (const wr of this.warrens) {
      if (wr.id < 0) continue;
      // 近づいてくる強い相手：冒険者の一行、若い竜と成竜、トロール、ミノタウロス
      let near: Cr | null = null;
      let nd = 1e18;
      let threat = 0;
      for (const p of this.parties)
        for (const id of p.members) {
          const a = this.byId.get(id);
          if (!a || a.dead || a.away) continue;
          const d = sq(a.x - wr.x) + sq(a.y - wr.y);
          if (d < nd) {
            nd = d;
            near = a;
            threat = this.partyStr(p);
          }
        }
      this.nearby(wr.x, wr.y, 14, (o) => {
        if (o.dead || o.away || !((o.k === Kind.Dragon && o.sp >= 1) || o.k === Kind.Troll || o.k === Kind.Minotaur)) return;
        const d = sq(o.x - wr.x) + sq(o.y - wr.y);
        if (d < nd) {
          nd = d;
          near = o;
          threat = this.str(o);
        }
      });
      if (!near || nd > 16 * TILE * 16 * TILE) {
        wr.hide = 0;
        continue;
      }
      const members = this.warrenMembers(wr);
      const mine = members.reduce((a, c) => a + this.str(c), 0);
      if (wr.hide !== 1 && nd < 12 * TILE * 12 * TILE && threat > mine * 1.5) {
        wr.hide = 1;
        if (this.step - (this.lastLogged[995] ?? -99999) > 3000) {
          this.lastLogged[995] = this.step;
          this.log(wr.x, wr.y, (near as Cr).k === Kind.Adventurer ? `{k:${Kind.Kobold}}たちが冒険者の気配に、住処の奥へ身をひそめた` : `{k:${Kind.Kobold}}たちが{k:${(near as Cr).k}}の気配に、住処の奥へ身をひそめた`);
        }
        continue;
      }
      if (wr.hide === 1) {
        const a = near as Cr;
        const found = members.some((c) => c.st === 7 && this.isHidden(c) && this.atDoorOf(a, c));
        if (found) {
          wr.hide = 0;
          wr.raids = (wr.raids ?? 0) + 1;
          for (const c of members) {
            c.st = 0;
            c.flee = 150 + (ih(c.id, this.step, 231) % 60);
            c.foe = a.id;
            // 住みかへ逃げ帰らず、相手から離れる方へ（深い方へ）
            c.hx = 0;
            c.hy = 0;
          }
          this.log(wr.x, wr.y, `隠れていた{k:${Kind.Kobold}}たちが見つかり、奥へ逃げ散った`);
        }
      }
    }
  }

  // ---------- サラマンダー ----------
  private spawnSalamanders(): void {
    const m = this.w.map;
    let lava = 0;
    for (let k = 0; k < m.w * m.h; k++) if (m.lava[k]) lava++;
    const want = Math.min(4, Math.floor(lava / 15));
    if (this.counts[Kind.Salamander] >= want) return;
    for (let i = 0; i < 60; i++) {
      const k = ih(this.step, i, 76) % (m.w * m.h);
      if (m.solid[k] || m.lava[k] || this.w.heat[k] < 150 || this.w.nutr[k] < 12 || this.manaAround(k) < 8) continue;
      this.w.nutr[k] -= 12;
      const sal = this.spawn(Kind.Salamander, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 12, 0);
      this.takeMana(sal, k, 30);
      // 溶岩の熱と濃いマナが重なると、火の精になる（ダンジョンに一体だけ）
      if (this.manaAround(k) >= 12 && this.w.heat[k] >= 170 && !this.list.some((o) => o.elite === 1 && !o.dead) && this.w.tick - (this.lastElite[1] ?? -1e9) > DAY_TICKS_ECO * 2) {
        this.lastElite[1] = this.w.tick;
        sal.elite = 1;
        this.takeMana(sal, k, 60);
        this.nameOf(sal);
        this.log(sal.x, sal.y, `溶岩の熱と濃いマナから、火の精「${this.names.get(sal.id)}」が生まれた`);
      }
      return;
    }
  }

  private salamander(c: Cr): void {
    const s = SPEC[Kind.Salamander];
    const m = this.w.map;
    const k = this.tileOf(c.x, c.y);
    if (c.act === 2 && c.actT < 4) return;
    // 熱の外には長くいられない：熱い方へ戻る
    if (k >= 0 && this.w.heat[k] < 80) {
      let best = k;
      for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (q >= 0 && q < m.solid.length && !m.solid[q] && !m.lava[q] && this.w.heat[q] > this.w.heat[best]) best = q;
      c.act = 1;
      this.moveToward(c, (best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, s.speed);
      return;
    }
    // 熱の区域に迷い込んだネズミやアリを捕まえる
    let prey: Cr | null = null;
    let bd = 34 * 34;
    this.nearby(c.x, c.y, 2, (o) => {
      if (o.dead || o.away || (o.k !== Kind.Rat && o.k !== Kind.Ant)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        prey = o;
      }
    });
    if (prey) {
      const p = prey as Cr;
      c.act = 1;
      if (this.moveToward(c, p.x, p.y, s.speed * 1.4) || sq(p.x - c.x) + sq(p.y - c.y) < 9 * 9) this.eat(c, p);
      return;
    }
    // 熱の中を這い回る
    c.act = c.actT % 50 < 30 ? 1 : 0;
    if (c.act === 1) {
      const j = DIR16[ih(c.id, this.step >> 4, 77) & 15];
      const nx = c.x + j[0] * 8;
      const ny = c.y + j[1] * 8;
      const nk = this.tileOf(nx, ny);
      if (nk >= 0 && !m.solid[nk] && !m.lava[nk] && this.w.heat[nk] >= 80) this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
      else c.act = 0;
    }
  }

  /** 空きのある巣穴を使い、なければ壁際の乾いた床で苔に近い所に新しく作る */
  private pickBurrow(): Burrow {
    const m = this.w.map;
    const residents = this.burrows.map((b) => this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y).length);
    // 誰も住んでいない巣穴は崩れて消える（見つけやすさのため数を抑える）
    if (this.burrows.length > 12) {
      const keep = this.burrows.filter((_, i) => residents[i] > 0);
      this.burrows = keep;
      return this.pickBurrow();
    }
    for (let i = 0; i < this.burrows.length; i++) if (residents[i] > 0 && residents[i] < 8) return this.burrows[i];
    let best = -1;
    let bv = -1e9;
    for (let i = 0; i < 160; i++) {
      const h = ih(this.step, i, 81);
      const x = 2 + (h % (m.w - 4));
      const y = 2 + ((h >>> 12) % (m.h - 4));
      const k = y * m.w + x;
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 0) continue;
      let walls = 0;
      for (const nn of [k + 1, k - 1, k - m.w]) walls += m.solid[nn];
      if (!walls) continue;
      // 火のそば（入口のかがり火など）には巣穴を作らない
      if (this.fireNear(x * TILE + 8, y * TILE + 11)) continue;
      let moss = 0;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) moss += this.w.moss[yy * m.w + xx];
        }
      // 岩の向こうに空洞の気配がある所を好む（巣穴を掘り進めて掘り当てる）
      const near = this.w.nearestSealed(x, y, 8);
      const v = moss - this.burrows.filter((b) => Math.abs(b.x / TILE - x) < 6 && Math.abs(b.y / TILE - y) < 6).length * 3000 + (near >= 0 ? 20000 : 0);
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    if (best < 0) best = this.nearestFloor(m.entrance.x * TILE + 16, 40);
    const b: Burrow = { x: (best % m.w) * TILE + 8, y: Math.floor(best / m.w) * TILE + 11 };
    b.cap = this.burrowCap(b);
    this.burrows.push(b);
    return b;
  }

  /** 夕暮れにコウモリが裂け目から入ってくる、夜明けに増える */
  onDayEvents(prevPhase: number, phase: number): void {
    const m = this.w.map;
    const crossed = (p: number) => (prevPhase < p && phase >= p) || (prevPhase > phase && (phase >= p || prevPhase < p));
    // 噂は日ごとに薄れる。明るさの噂は、入口のまわりから漏れる光で決まる
    if (crossed(0.5)) {
      const r = this.rumors;
      r.gold *= 0.8;
      r.undead *= 0.8;
      r.beast *= 0.8;
      r.dragon *= 0.85;
      let glow = 0;
      for (let y = 0; y < Math.min(m.h, 30); y++)
        for (let x = Math.max(0, m.entrance.x - 30); x < Math.min(m.w, m.entrance.x + 30); x++) {
          const k = y * m.w + x;
          if (this.w.mossGlow[k] > 0.08 || this.w.fungusGlow[k] > 0.06) glow++;
        }
      r.light = Math.min(3, glow / 120);
    }
    if (crossed(0.74)) {
      for (let si = 0; si < m.shafts.length; si++) {
        const s = m.shafts[si];
        const col = this.list.filter((c) => c.k === Kind.Bat && !c.dead && c.tx === s.x * TILE + 8 && c.ty === s.y * TILE + 8).length;
        let moss = 0;
        for (let dy = -10; dy <= 10; dy++)
          for (let dx = -10; dx <= 10; dx++) {
            const x = s.x + dx;
            const y = s.y + dy;
            if (x >= 0 && y >= 0 && x < m.w && y < m.h) moss += this.w.moss[y * m.w + x];
          }
        if (col < 20 && moss > 2500) {
          for (let i = 0; i < 2; i++) {
            this.imported += 10 + 10;
            this.originNext = "shaft";
            const b = this.spawn(Kind.Bat, s.x * TILE + 8, s.y * TILE - 20, 10, 10);
            this.homeBat(b, s.x, s.y);
          }
        }
      }
    }
    if (crossed(0.24)) {
      // 夜明けのねぐらで、よく食べた群れに子が生まれる
      const bats = this.list.filter((c) => c.k === Kind.Bat && !c.dead && c.st === 0 && c.food >= 30);
      for (const b of bats) {
        if (this.counts[Kind.Bat] >= 260 || ih(b.id, this.step, 91) % 3 !== 0) continue;
        b.food -= 10;
        const n = this.spawn(Kind.Bat, b.x, b.y, 10, 0);
        n.hx = b.hx;
        n.hy = b.hy;
        n.tx = b.tx;
        n.ty = b.ty;
      }
    }
  }

  private homeBat(b: Cr, sx: number, sy: number): void {
    // ねぐらの天井に、仲間と少しずつ間をあけてぶら下がる（ねぐらの何匹目かで場所を決める）
    const i = this.list.filter((o) => o !== b && o.k === Kind.Bat && !o.dead && o.tx === sx * TILE + 8 && o.ty === sy * TILE + 8).length;
    b.hx = sx * TILE + 8 + ((i % 6) - 2.5) * 7 + ((b.id % 3) - 1);
    b.hy = sy * TILE - 18 - Math.floor(i / 6) * 8;
    b.tx = sx * TILE + 8;
    b.ty = sy * TILE + 8;
    b.st = 4;
  }

  /** はじめのウィスプ（苔の濃い所に少し） */
  seed(): void {
    const m = this.w.map;
    // 古い宝の山、宝物庫のゴーレム、深部で眠るワーム
    for (const h of m.hoards) this.piles.push({ id: this.nextId++, x: h.x * TILE + 8, y: h.y * TILE + 8, gold: h.gold, age: 0 });
    if (m.vaultCenter.x >= 0) {
      const g = this.spawn(Kind.Golem, (m.vaultCenter.x + 3) * TILE + 8, (m.vaultCenter.y + 1) * TILE + 8, 0, 0);
      g.dir = 0;
    }
    if (m.deep.x >= 0) {
      // ワームの体は、まわりの土の養分から
      let body = 0;
      for (let dy = -6; dy <= 6 && body < 300; dy++)
        for (let dx = -6; dx <= 6 && body < 300; dx++) {
          const k = (m.deep.y + dy) * m.w + m.deep.x + dx;
          if (k < 0 || k >= m.solid.length || m.solid[k]) continue;
          const t = Math.min(this.w.nutr[k] - 4, 300 - body);
          if (t > 0) {
            this.w.nutr[k] -= t;
            body += t;
          }
        }
      const wm = this.spawn(Kind.Worm, m.deep.x * TILE + 8 + 30, m.deep.y * TILE + 8 + 20, body, 0);
      wm.st = 0;
      wm.dir = 0;
      // 眠っている体：頭の後ろにとぐろを巻くように
      const tr: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = i * 0.7;
        tr.push(Math.round(wm.x + Math.sin(a) * (6 + i * 1.6)), Math.round(wm.y - 6 - i * 5 + Math.cos(a) * 4));
      }
      this.trails.set(wm.id, tr);
    }
    let n = 0;
    for (let k = 0; k < m.w * m.h && n < 40; k += 7) {
      if (this.w.moss[k] >= 200 && ih(k, 7) % 3 === 0) {
        this.w.moss[k] -= 4;
        this.spawn(Kind.Wisp, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 4, 0);
        n++;
      }
    }
  }

  /** 苔からウィスプが生まれる（苔の刻みから呼ばれる） */
  maybeSpawnWisp(k: number, step: number): void {
    if (this.counts[Kind.Wisp] >= MAX_WISPS) return;
    if (this.w.moss[k] < 200 || ih(k, step, 99) % 45 !== 0 || this.w.mana[k] < 2) return;
    this.w.moss[k] -= 4;
    this.counts[Kind.Wisp]++;
    const m = this.w.map;
    const wi = this.spawn(Kind.Wisp, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 4, 0);
    this.takeMana(wi, k, 2, 0);
    // 光の筋の日の光とマナが重なる所では、光の精になる
    if (this.w.lightBase[k] * this.day >= 250 && this.manaAround(k) >= 4 && !this.list.some((o) => o.elite === 7 && !o.dead) && this.w.tick - (this.lastElite[7] ?? -1e9) > DAY_TICKS_ECO * 2) {
      wi.elite = 7;
      wi.hx = wi.x;
      wi.hy = wi.y;
      this.lastElite[7] = this.w.tick;
      this.takeMana(wi, k, 20, 2);
      this.nameOf(wi);
      this.log(wi.x, wi.y, `日の光とマナが重なり、光の精「${this.names.get(wi.id)}」が生まれた`);
    }
  }

  /** 金貨の総量（山と、生き物が抱えている分） */
  totalGold(): number {
    let g = 0;
    for (const p of this.piles) g += p.gold;
    for (const c of this.list) g += c.gold;
    return g;
  }

  /** 生き物と死骸が抱えている養分の合計 */
  /** まわり3×3マスのマナの平均 */
  manaAround(k: number): number {
    const m = this.w.map;
    if (k < 0) return 0;
    let s2 = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const q = k + dy * m.w + dx;
      if (q >= 0 && q < this.w.mana.length) s2 += this.w.mana[q];
    }
    return s2 / 9;
  }

  /** まわり（半径 r マス）の土からマナを集めて、生まれる者の体に移す（足りなければ集められた分だけ） */
  private takeMana(c: Cr, k: number, want: number, r = 2): void {
    const m = this.w.map;
    let got = 0;
    for (let pass = 0; pass < 4 && got < want; pass++)
      for (let dy = -r; dy <= r && got < want; dy++)
        for (let dx = -r; dx <= r && got < want; dx++) {
          const q = k + dy * m.w + dx;
          if (q < 0 || q >= this.w.mana.length) continue;
          const t = Math.min(this.w.mana[q] >> 1, want - got);
          if (t <= 0) continue;
          this.w.mana[q] -= t;
          got += t;
        }
    c.mana += got;
  }

  /** まわり（半径 r マス）の土から養分を集める（体を作るため）。集められた量を返す。足りなければ何も取らない */
  private takeNutrients(k: number, want: number, r = 3): number {
    const m = this.w.map;
    let have = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const q = k + dy * m.w + dx;
      if (q >= 0 && q < this.w.nutr.length && !m.solid[q]) have += Math.max(0, this.w.nutr[q] - 2);
    }
    if (have < want) return 0;
    let got = 0;
    for (let dy = -r; dy <= r && got < want; dy++) for (let dx = -r; dx <= r && got < want; dx++) {
      const q = k + dy * m.w + dx;
      if (q < 0 || q >= this.w.nutr.length || m.solid[q]) continue;
      const t = Math.min(Math.max(0, this.w.nutr[q] - 2), want - got);
      this.w.nutr[q] -= t;
      got += t;
    }
    return got;
  }

  /**
   * マナから上位の魔物が生まれる（地上の時間で5秒ごと）：開いた床を数十か所見て、まわりのマナが濃く、条件の揃った所から、
   * トロール（60〜、暗がり）、ミノタウロス（50〜、迷路）、バジリスク（80〜、暗がり、人の気配が薄い）、
   * ドラゴンの幼子（120〜、ダンジョンにドラゴンがいない）が生まれる。生まれるとき、まわりのマナと土の養分を使う
   */
  private manaBirths(day: number): void {
    const m = this.w.map;
    const n = this.counts;
    const dragons = this.list.some((c) => c.k === Kind.Dragon && !c.dead);
    // 水の精：深い水とマナが重なる所から（地上の1分ごとに数か所を見る。ダンジョンに一体まで）
    if (this.step % 600 === 223 && !this.list.some((o) => o.elite === 6 && !o.dead) && this.w.tick - (this.lastElite[6] ?? -1e9) > DAY_TICKS_ECO * 2) {
      for (let i = 0; i < 80; i++) {
        const k = ih(this.step, i, 306) % (m.w * m.h);
        if (m.solid[k] || m.sealed[k] || this.w.water[k] < 150 || this.manaAround(k) < 12) continue;
        const got = this.takeNutrients(k, 20, 3);
        if (!got) continue;
        this.originNext = 'mana';
        const c = this.spawn(Kind.Slime, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, got, 0);
        c.elite = 6;
        c.hx = c.x;
        c.hy = c.y;
        this.lastElite[6] = this.w.tick;
        this.takeMana(c, k, 40);
        this.nameOf(c);
        this.log(c.x, c.y, `深い水と濃いマナから、水の精「${this.names.get(c.id)}」が生まれた`);
        break;
      }
    }
    // ドラゴンの幼子：ダンジョンにドラゴンがいなければ、6日目以降、深部のまわり（20マス）でいちばん濃い所を探し、70以上なら生まれる（地上の1分ごと）
    if (!dragons && this.step % 600 === 113 && this.w.tick > DAY_TICKS_ECO * 6 && this.w.tick - (this.lastArrival[Kind.Dragon] ?? -1e9) * 2 > DAY_TICKS_ECO * 2) {
      let bk = -1;
      let bv = 0;
      for (let dy = -20; dy <= 20; dy++)
        for (let dx = -20; dx <= 20; dx++) {
          const x = m.deep.x + dx;
          const y = m.deep.y + dy;
          if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
          const k = y * m.w + x;
          if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.lightBase[k] > 0 || this.w.water[k] > 40) continue;
          const v = this.manaAround(k);
          if (v > bv) {
            bv = v;
            bk = k;
          }
        }
      if (bk >= 0 && bv >= 70) {
        const got = this.takeNutrients(bk, Math.round(SPEC[Kind.Dragon].body * 0.2), 5);
        if (got) {
          const x = (bk % m.w) * TILE + 8;
          const y = Math.floor(bk / m.w) * TILE + 8;
          this.originNext = 'mana';
          const c = this.spawn(Kind.Dragon, x, y, got, 60);
          this.imported += 60;
          this.takeMana(c, bk, 600, 4);
          c.sp = 0;
          c.st = 0;
          c.hx = x;
          c.hy = y;
          c.bornAt = this.w.tick;
          c.lureAt = this.step;
          this.lastArrival[Kind.Dragon] = this.step;
          this.dragonShell = { x, y: y + 4, t: this.w.tick };
          this.log(x, y, `深部の濃いマナから、{k:${Kind.Dragon}}の幼子が生まれた`);
        }
      }
    }
    const near = (k: number, kind: Kind, R: number) => this.list.some((c) => c.k === kind && !c.dead && Math.abs(c.x / TILE - (k % m.w)) + Math.abs(c.y / TILE - Math.floor(k / m.w)) < R);
    for (let i = 0; i < 40; i++) {
      const k = ih(this.step, i, 230) % (m.w * m.h);
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 40) continue;
      const mn = this.manaAround(k);
      if (mn < 2 && !m.maze[k]) continue;
      const noSun = this.w.lightBase[k] === 0;
      const dark = this.lit(k, day) < 0.12;
      const x = (k % m.w) * TILE + 8;
      const y = Math.floor(k / m.w) * TILE + 8;
      let kind: Kind | -1 = -1;
      let cost = 0;
      let body = 0;
      if (mn >= 60 && dark && noSun && n[Kind.Basilisk] < 2 && this.presenceAt(x, y) < 0.15 && !near(k, Kind.Basilisk, 30) && !near(k, Kind.Troll, 12) && !near(k, Kind.Dragon, 25)) {
        kind = Kind.Basilisk;
        cost = 240;
        body = 60;
      } else if (mn >= 40 && dark && noSun && n[Kind.Troll] < 2 && !near(k, Kind.Troll, 25) && !near(k, Kind.Basilisk, 12) && !near(k, Kind.Dragon, 25)) {
        kind = Kind.Troll;
        cost = 160;
        body = 150;
      } else if (m.maze[k] && n[Kind.Minotaur] === 0 && this.w.tick > DAY_TICKS_ECO * 2) {
        // 迷路は古い呪いの場所：マナが薄くても、迷路の中なら主が生まれる
        kind = Kind.Minotaur;
        cost = 20;
        body = 120;
      }
      if (kind === -1 || ih(k, this.step, 232) % 4 !== 0) continue;
      const got = this.takeNutrients(k, body, 3);
      if (!got) continue;
      this.originNext = 'mana';
      const c = this.spawn(kind, x, y, got, 0);
      this.takeMana(c, k, cost, 3);
      c.hx = x;
      c.hy = y;
      this.log(x, y, `濃いマナから{k:${kind}}が生まれた`);
      return;
    }
  }

  /** 生き物が体に溜めているマナの合計 */
  heldMana(): number {
    let s = 0;
    for (const c of this.list) if (c.dead !== 2) s += c.mana;
    return s;
  }

  /** マナをその場の土へ還す */
  private releaseMana(c: Cr): void {
    if (c.mana <= 0) return;
    const k = this.tileOf(c.x, c.y);
    if (k >= 0) this.w.mana[k] += c.mana;
    else this.w.manaFaded += c.mana;
    c.mana = 0;
  }

  /** 生き物と巣と石像が抱えている養分。openOnly なら閉じた空洞の中のものは数えない */
  heldNutrients(openOnly = false): number {
    const m = this.w.map;
    const ok = (x: number, y: number) => {
      if (!openOnly) return true;
      const k = this.tileOf(x, y);
      return k < 0 || !m.sealed[k];
    };
    let s = 0;
    for (const c of this.list) if (ok(c.x, c.y)) s += c.body + c.food + c.units;
    for (const o of this.colonies) if (ok(o.x, o.y)) s += o.store + o.queen;
    for (const o of this.warrens) if (o.id >= 0 && ok(o.x, o.y)) s += o.store ?? 0;
    for (const o of this.statues) if (ok(o.x, o.y)) s += o.units;
    if (this.hold) s += this.hold.store;
    for (const cp of this.camps) if (cp.id >= 0 && ok(cp.x, cp.y)) s += (cp.fuel ?? 0) + (cp.store ?? 0);
    for (const e of this.eggs) if (ok(e.x, e.y)) s += e.units;
    return s;
  }

  // ---------- 保存 ----------
  serialize(): object {
    const L: number[] = [];
    for (const c of this.list) {
      if (c.dead === 2) continue;
      L.push(c.id, c.k, c.x, c.y, c.vx, c.vy, c.dir, c.act, c.actT, c.body, c.food, c.glow, c.hungry, c.sinceMeal, c.st, c.hx, c.hy, c.tx, c.ty, c.dead, c.units, c.away ? 1 : 0, c.caught ? 1 : 0, c.ref, c.sp, c.init, c.ref2, c.gold, c.party, c.torch, c.hp, c.hitAt, c.foe, c.flee, c.gait, c.bornAt, c.sleep, c.drowsy, c.lure, c.lureAt, c.feed, c.mana, c.elite);
    }
    const P: number[][] = [];
    for (const [id, p] of this.paths) if (this.byId.get(id)?.dead === 0) P.push([id, p.gx, p.gy, p.pi, p.stall, p.gk, p.at, ...p.path]);
    return { V: 43, PV: 2, G: Array.from(this.deathMap), GV: Array.from(this.graveMap), AG: Array.from(this.advGrave), NM: [...this.names], LE: this.lastElite.map((v) => v ?? null), AC: this.colonies.map((o) => [o.id, o.x, o.y, o.store, o.queen, o.starve, o.hk ?? -1, o.len ?? 0]), KW: this.warrens.map((o) => [o.id, o.x, o.y, o.target, o.prog, o.len, o.stall ?? 0, o.lastProg ?? 0, o.door ?? -1, o.dir ?? -1, o.tun ?? 0, o.store ?? 0, o.hide ?? 0, o.raids ?? 0, o.empty ?? -1, o.alone ?? -1]), KT: this.traps.map((o) => [o.id, o.k, o.w]), KS: this.koboldShun, KM: this.kobMouthOk, RM: [this.ratMouthOk, this.ratShaftOk], GC: this.camps.map((o) => [o.id, o.kind, o.x, o.y, o.dry, o.fuel ?? 0, o.store ?? 0, o.hide ?? 0, o.raids ?? 0, o.empty ?? -1, o.alone ?? -1, o.lx ?? 0, o.ly ?? 0, o.tribT ?? 0]), GS: this.goblinShun, GM: this.gobMouthOk, LA: this.lastArrival.map((v) => v ?? null), ST: this.statues.map((o) => [o.id, o.x, o.y, o.k, o.sp, o.dir, o.act, o.f, o.units, o.age, o.blocks ?? -1]), TP: this.piles.map((o) => [o.id, o.x, o.y, o.gold, o.age]), TR: [...this.trails].map(([id, t]) => [id, ...t]), PD: this.pendingDigs, BN: this.burning, PT2: this.parties, LO: this.lore, IT: this.gear.map((o) => [o.id, o.x, o.y, o.kind, o.fuel]), RU: [this.rumors.light, this.rumors.gold, this.rumors.undead, this.rumors.beast, this.rumors.dragon, this.rumors.beastKind, this.rumors.beastX, this.rumors.beastY], GL: [this.goldIn, this.goldOut, this.returned, this.fallen], EV: this.events.map((e) => [e.t, e.x, e.y, e.m]), HD2: this.hold, LP: this.lamps, EG: this.eggs, DSH: this.dragonShell, FX: [this.fxHits.filter((h) => this.w.tick - h.t < 10), this.fxMarks.filter((m) => this.w.tick - m.t < 20), this.fxAttacks.filter((m) => this.w.tick - m.t < 20)], IS: [...this.islandIds], WB: this.wallBroken, PS: this.pendingScraps, PRB: Array.from(this.presenceBase), PRT: Array.from(this.presenceTrace), AL: [...this.alarms.entries()], FG: this.forage, OM: [this.openMoss, this.openFungus, this.edibleMoss, this.wildFungus], DL: [this.dwarfLore, this.lastDwarves], LL: this.lastLogged.map((v) => v ?? null), NZ: this.noises, LD: this.lastDigCount, DS: Array.from(this.discovered), L, P, W: this.webs.map((w) => [w.id, w.x, w.y, w.r, w.owner, w.age]), B: this.burrows.map((b) => [b.x, b.y, b.hk ?? -1, b.len ?? 0, b.moved ?? -1e9, b.cap ?? -1]), n: this.nextId, i: this.imported, e: this.exported, s: this.step };
  }

  restore(o: any): void {
    this.list = [];
    this.byId.clear();
    const L: number[] = o.L || [];
    const V = o.V || 24;
    if (o.G) this.deathMap.set(o.G);
    if (o.GV) this.graveMap.set(o.GV);
    if (o.AG) this.advGrave.set(o.AG);
    this.names = new Map(o.NM ?? []);
    this.lastElite = (o.LE ?? []).map((v: number | null) => (v === null ? undefined : v)) as number[];
    this.colonies = (o.AC || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], store: a[3], queen: a[4], starve: a[5] ?? 0, hk: a[6] ?? -1, len: a[7] ?? 0 }));
    this.warrens = (o.KW || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], target: a[3], prog: a[4], len: a[5], stall: a[6] ?? 0, lastProg: a[7] ?? 0, door: a[8] ?? -1, dir: a[9] ?? -1, tun: a[10] ?? 0, store: a[11] ?? 0, hide: a[12] ?? 0, raids: a[13] ?? 0, empty: a[14] ?? -1, alone: a[15] ?? -1 }));
    this.traps = (o.KT || []).map((a: number[]) => ({ id: a[0], k: a[1], w: a[2] }));
    this.koboldShun = o.KS ?? 0;
    this.kobMouthOk = o.KM ?? [];
    [this.ratMouthOk, this.ratShaftOk] = o.RM ?? [[], []];
    this.camps = (o.GC || []).map((a: number[]) => ({ id: a[0], kind: a[1], x: a[2], y: a[3], dry: a[4], fuel: a[5] ?? 0, store: a[6] ?? 0, hide: a[7] ?? 0, raids: a[8] ?? 0, empty: a[9] ?? -1, alone: a[10] ?? -1, lx: a[11] ?? 0, ly: a[12] ?? 0, tribT: a[13] ?? 0 }));
    this.goblinShun = o.GS ?? 0;
    this.gobMouthOk = o.GM ?? [];
    this.lastArrival = (o.LA || []).map((v: number | null) => (v === null ? undefined : v)) as number[];
    this.statues = (o.ST || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], k: a[3], sp: a[4], dir: a[5], act: a[6], f: a[7], units: a[8], age: a[9], blocks: a[10] === undefined || a[10] < 0 ? undefined : a[10] }));
    this.rebuildStatueIndex();
    this.piles = (o.TP || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], gold: a[3], age: a[4] }));
    this.trails = new Map((o.TR || []).map((a: number[]) => [a[0], a.slice(1)] as [number, number[]]));
    this.pendingDigs = o.PD || [];
    this.burning = o.BN || [];
    this.parties = o.PT2 ? JSON.parse(JSON.stringify(o.PT2)) : (o.PT || []).map((a: number[]) => ({ id: a[0], goal: a[1], tx: a[2], ty: a[3], since: a[4], tier: a[5], initial: a[6], saw: a[7], targetAt: a[8], waitT: a[9], bk: a[10], bx: a[11], by: a[12], members: a.slice(13) }));
    this.lore = o.LO ? JSON.parse(JSON.stringify(o.LO)) : { explored: [], gold: [], danger: [] };
    this.gear = (o.IT || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], kind: a[3], fuel: a[4] }));
    const ru = o.RU || [0, 0, 0, 0, 0];
    this.rumors = { light: ru[0], gold: ru[1], undead: ru[2], beast: ru[3], dragon: ru[4], beastKind: ru[5] ?? 0, beastX: ru[6] ?? 0, beastY: ru[7] ?? 0 };
    this.events = (o.EV || []).map((a: [number, number, number, string]) => ({ t: a[0], x: a[1], y: a[2], m: a[3] }));
    if (o.DS) this.discovered.set(o.DS);
    const hd = o.HD as number[] | null | undefined;
    this.hold = o.HD2 !== undefined ? (o.HD2 ? JSON.parse(JSON.stringify(o.HD2)) : null) : hd ? { stage: hd[0], sx: hd[1], sy: hd[2], dx: hd[3], dy: hd[4], hk: hd[5], target: hd[6], head: hd[7], len: hd[8], forge: hd[9], golem: hd[10], since: hd[11], store: hd[12], farm: hd.slice(14, 14 + hd[13]), todo: hd.slice(14 + hd[13]) } : null;
    this.lamps = o.LP || [];
    this.eggs = o.EG ? JSON.parse(JSON.stringify(o.EG)) : [];
    this.dragonShell = o.DSH ? { ...o.DSH } : null;
    // 見た目のための印（描画だけ）
    if (o.FX) {
      this.fxHits = JSON.parse(JSON.stringify(o.FX[0]));
      this.fxMarks = JSON.parse(JSON.stringify(o.FX[1]));
      if (o.FX[2]) this.fxAttacks = JSON.parse(JSON.stringify(o.FX[2]));
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
        sp: V > 24 ? L[i + 24] : L[i + 1], init: V > 25 ? L[i + 25] : L[i + 20], ref2: V > 26 ? L[i + 26] : 0, gold: V > 27 ? L[i + 27] : 0, party: V > 28 ? L[i + 28] : 0, torch: V > 28 ? L[i + 29] : 0, hp: V > 30 ? L[i + 30] : -1, hitAt: V > 31 ? L[i + 31] : -99, foe: V > 32 ? L[i + 32] : 0, flee: V > 33 ? L[i + 33] : 0, gait: V > 34 ? L[i + 34] : 0, bornAt: V > 35 ? L[i + 35] : -1e9, sleep: V > 36 ? L[i + 36] : 0, drowsy: V > 37 ? L[i + 37] : 0, lure: V > 38 ? L[i + 38] : 0, lureAt: V > 39 ? L[i + 39] : 0, feed: V > 40 ? L[i + 40] : 0, mana: V > 41 ? L[i + 41] : 0, elite: V > 42 ? L[i + 42] : 0,
      };
      this.list.push(c);
      this.byId.set(c.id, c);
    }
    this.paths.clear();
    for (const a of (o.P || []) as number[][]) {
      if ((o.PV || 1) >= 2) this.paths.set(a[0], { gx: a[1], gy: a[2], pi: a[3], stall: a[4], gk: a[5], at: a[6], path: a.slice(7) });
      else this.paths.set(a[0], { gx: a[1], gy: a[2], pi: a[3], stall: a[4], gk: this.tileOf(a[1], a[2]), at: 0, path: a.slice(5) });
    }
    this.webs = (o.W || []).map((a: number[]) => ({ id: a[0], x: a[1], y: a[2], r: a[3], owner: a[4], age: a[5] }));
    this.burrows = (o.B || []).map((a: number[]) => ({ x: a[0], y: a[1], hk: a[2] ?? -1, len: a[3] ?? 0, moved: a[4] ?? -1e9, cap: a[5] ?? -1 }));
    this.nextId = o.n || 1;
    this.imported = o.i || 0;
    this.exported = o.e || 0;
    this.step = o.s || 0;
  }
}
