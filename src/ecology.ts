import { lineOfSight, TILE } from './mapgen';
import { JOB_NAMES } from './names';
/** ゲーム内の1日の tick 数（world.ts の DAY_TICKS と同じ） */
export const DAY_TICKS_ECO = 14400;
import type { World } from './world';
import type { Grave, Hero } from './eco/roster';

/** 生き物を更新する間隔（tick） */
export const CR_EVERY = 2;
/** 苔とキノコの更新（world.ts の MOSS_EVERY ＝ 40 tick ごと）1回で進める量の倍率（もとは20 tick ごとに1倍。確率と増減を MOSS_R 倍にする） */
export const MOSS_R = 2;

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
  /** 先頭が仲間を待っている長さ（生き物の更新の回数） */
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
  /** 疲れ、焚き火（タイル、なければ -1）、休み終わる step 番号、最後に休んだ step 番号 */
  fatigue?: number;
  camp?: number;
  campUntil?: number;
  lastCamp?: number;
  /**
   * 一行の目標（冒険者の作り直しの一歩目）：0 なし（探索）、1 宝、2 竜、3 大物、4 アンデッド、5 ゴブリン退治。
   * aimId は目指す相手（竜・大物の生き物、ゴブリンの集落の id。宝なら区画、アンデッドは 0）、aimX/aimY は目指す場所（px）、
   * aimKnown は場所を知っているか（0 なら噂の方角＝奥へ向かい、見つけたら 1）、aimAt は着いた step 番号（0 まだ）、aimEnd は終わり方（0 まだ、1 果たした、2 あきらめた）
   */
  aim?: number;
  aimId?: number;
  aimX?: number;
  aimY?: number;
  aimKnown?: number;
  aimAt?: number;
  aimEnd?: number;
  /** 場所を知らない目標の、当て推量の行き先（1：噂の場所か深部へ向かっている途中。着いたら 0 にして、まわりの奥を探す） */
  aimGuess?: number;
  aimGuessX?: number;
  aimGuessY?: number;
  /** 率いる者の名前 */
  name?: string;
  /** ゴブリンに荷物を盗まれた回数と、最後に盗まれた場所（生きて帰れば噂になる） */
  robbed?: number;
  /** ゴブリン退治：目指す集落のゴブリンを最後に見た歩（着いてから誰も見えないまま長く探せば引き返す） */
  gobSeen?: number;
  robX?: number;
  robY?: number;
  /** 身構えて止まっている期間の終わり（step 番号）、向く先、種類（1 目標に着いて構える、2 住処のそばで身構える） */
  braceT?: number;
  braceX?: number;
  braceY?: number;
  braceK?: number;
  /** 聞き耳：見えない所の物音に立ち止まって、音の方を向いている期間の終わり（step 番号）と、音の場所。前に出て構える前衛。方角（8方位）ごとの、次にその方角の音で止まれる step 番号 */
  listenT?: number;
  listenX?: number;
  listenY?: number;
  listenBy?: number;
  heardDir?: number[];
  /** 担いで持ち帰る戦利品（倒した目標にちなむもの。種の番号、担ぐ者） */
  trophy?: number;
  trophyBy?: number;
  /** そばを通って身構えた、目標でない住処・集落・縄張り（同じ所では一度だけ） */
  passed?: number[];
  /** 立ち止まった墓標（同じ墓標では一度だけ。src/eco/roster.ts） */
  mourned?: number[];
  /** 見かけた竜の場所（生きて帰れば噂になる） */
  dgx?: number;
  dgy?: number;
  /** 竜（ドラゴン）を見通しの利く所から見た：その者の番号と、見た者の立っていた所（歩いて行ける所。生きて帰れば、竜の寝床への道として町に知られる） */
  dgId?: number;
  dgvx?: number;
  dgvy?: number;
  /** 竜退治：知られた道をたどっている（見えるまでは、道の先＝見た所へ向かう） */
  aimWay?: number;
  /** 焚き火の見張りのうとうと：うとうとしている期間の終わり（step 番号。それまで、見張りは眠りの印を出して、忍び寄る者に気づかない）、次にうとうとしはじめる step 番号 */
  dozeT?: number;
  dozeNext?: number;
  /** 焚き火の夜（src/eco/night.ts）：起こされて構えている期間の終わり（step 番号。0 なら眠っている）、起きたときの人数、気づいた敵のいた所 */
  wakeT?: number;
  wakeN?: number;
  wakeX?: number;
  wakeY?: number;
  /** 焚き火を囲みはじめた step 番号（焚き火が細るのを決める。src/eco/night.ts の campFire） */
  campAt?: number;
  /** 最後に盗みを働いたゴブリンの集落（番号と、その時の場所）。生還者が町に伝える（盗みの噂）。robTold は伝えたか */
  robCamp?: number;
  robCX?: number;
  robCY?: number;
  robTold?: number;
  /** 物資の置き場（冒険者の作り直しの三歩目）：知っている置き場、たどり終えた置き場、たどった置き場の入口からの道のりの最大、いま向かっている置き場、自分たちが残した置き場 */
  cacheKnown?: number[];
  cacheVis?: number[];
  cacheD?: number;
  cacheGo?: number;
  cacheMine?: number[];
}

/**
 * 物資の置き場：深部の探索の一行が、引き返す所に残す木箱と寝具。食料（food）は養分の保存則に含まれる。
 * d は入口から歩いた道のり（マス、つながっていなければ -1）、at は置いた tick、by は置いた一行、rt は最後に魔物に荒らされた tick
 */
export interface SupplyCache {
  id: number;
  x: number;
  y: number;
  food: number;
  d: number;
  at: number;
  by: number;
  rt: number;
}

/** 外の世界の地図：生還者が持ち帰った、探した範囲、宝のあった区画、危ない区画 [区画, 強さ, tick] */
export interface Lore {
  explored: number[];
  gold: number[];
  danger: number[][];
  /** 生還者が見つけた、地表へ通じる別の横穴（mouths の番号） */
  mouths?: number[];
  /** 竜の寝床への道：[見た者の立っていた所 x, y（px）, 竜の番号, 持ち帰った tick]。前の一行が見つけて持ち帰ったときだけ、竜殺しは竜退治を目標にする */
  dragonWay?: number[];
  /** 生還者が町に伝えた物資の置き場（SupplyCache の番号） */
  caches?: number[];
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
  /** 倒れた冒険者の荷（背負い袋と寝具。姿だけ） */
  Pack = 11,
  /** 全滅した一行の戦利品（fuel に倒した相手の種の番号。姿だけ） */
  Trophy = 12,
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
  /** ゴブリンの盗み（生還者が持ち帰る。溜まるとゴブリン退治の一行が来る）と、最後に盗まれた場所 */
  goblin: number;
  goblinX: number;
  goblinY: number;
  /** 竜を見かけた場所（竜殺しの一行が目指す噂の方角。0,0 なら知らない） */
  dragonX: number;
  dragonY: number;
  /** 生還者が伝えた、ゴブリンの盗みの回数（2回でゴブリン退治の一行が来る。来たら0に戻す）と、最後に盗みを働いた集落（番号と場所） */
  goblinRobs: number;
  goblinCamp: number;
  goblinCampX: number;
  goblinCampY: number;
}

/** 金貨と宝石の山（量は整数で保存される） */
/**
 * 情報パネルのための、死骸・落とし物・金貨の山・石像・物資の置き場のいきさつ（src/eco/notes.ts）。
 * 見る人に「どうしてそこにあるか」を伝えるためだけの覚え書きで、シミュレーションの判断には使わない（セーブには入れる）。
 * t はできた tick、cause は死んだ理由（die の cause）、by は倒した相手の種、bn は倒した相手の名前、
 * who・job・name は持ち主（倒れた者、落とした者、置いた一行）の種・職業・名前
 */
export interface Note {
  t: number;
  cause?: string;
  by?: number;
  bn?: string;
  who?: number;
  job?: number;
  name?: string;
}

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
  /** ゴブリンの集落（住みつける仕組み）：蓄え（養分の保存則に含まれる）、1 なら暗がりに散って潜んでいる、近ごろ襲われた回数、蓄えが尽きた tick、1匹になった tick */
  store?: number;
  hide?: number;
  raids?: number;
  empty?: number;
  alone?: number;
  /** 従っているオークの縄張り（寝床の座標。0,0 なら従っていない）と、次に貢ぎ物を取り立てに来る tick */
  lx?: number;
  ly?: number;
  tribT?: number;
  /** 次に盗みに出られる tick（夜の盗み：src/eco/raid.ts） */
  raidT?: number;
  /** 次に通路での掠め取り（つける・待ち伏せ）に出られる tick。夜の盗みとは別に数える（src/eco/raid.ts） */
  snatchT?: number;
  /** 1 なら、食べ物の足りる場所が無く、貧しい場所に少ない群れで住みついた集落（`checkGoblinMouths`） */
  poor?: number;
}

/** 種ごとの強さ（戦いの勝ち負けの確率に使う） */
export const STR = [0, 1, 1, 5, 3, 2, 3, 0, 2, 1, 3, 4, 3, 10, 6, 20, 15, 8, 4, 12, 8, 30, 40, 25, 60, 5, 3, 18, 6];
/** ドワーフの強さ（坑夫、鍛冶屋、戦士） */
export const DWARF_STR = [5, 6, 10];
/**
 * 賢さの段階：0 本能だけ（傷ついても逃げない）、1 動物（体力が半分を切ると逃げる）、
 * 2 狡猾（不利なら退く。強い相手には仲間がいなければ挑まない）、3 知性（戦う前に見積もり、勝てない相手は避ける）
 */
export const TIER = [1, 1, 1, 1, 1, 0, 0, 0, 2, 1, 2, 1, 2, 2, 2, 2, 2, 1, 0, 3, 0, 0, 0, 1, 3, 3, 0, 3, 3];
export const FLEE_AT = [0, 0.5, 0.35, 0.4];
/** 血の色：0 赤、1 暗い赤（爬虫類・竜）、2 緑（虫）、3 石のかけら、-1 なし */
export const BLOOD = [-1, 0, 0, 1, 2, -1, -1, -1, -1, 2, 0, 1, 0, 0, 1, 0, 0, 1, 3, 0, -1, 3, 0, 1, 1, 0, -1, -1, 0];
/** 冒険者の強さ（職業）と、一行の格（駆け出し・手練れ・精鋭） */
export const JOB_STR = [8, 5, 4, 5, 3, 6, 20];
export const TIER_MUL = [0.7, 1.1, 1.6];
/** 運べる金貨の量（盗賊は身軽で多く運べる） */
export const GOLD_CAP = [30, 20, 60, 25, 20, 25, 40];
/** 松明一本の燃える長さ（生き物の更新の回数） */
export const TORCH_FUEL = 9000;

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
  /** 蓄え（養分。持ち主のいない食べ物として保存則の総量に数える） */
  store?: number;
  /** 1 なら群れは奥に隠れている */
  hide?: number;
  /** 近ごろ襲われた回数（少しずつ薄れる） */
  raids?: number;
  /** 蓄えが尽きた tick（尽きていなければ -1） */
  empty?: number;
  /** 1匹になった tick（2匹以上なら -1） */
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

export interface Spec {
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
export const SPEC: Spec[] = [
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
  // オーク：腹の減り方は七巡目から8割に（meta 45 → 56）
  { body: 60, cap: 120, meta: 56, starve: 5000, speed: 0.9, glowDecay: 1 },
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
  /** 体力（0 で倒れる）、最後に傷を受けた tick、最後に襲ってきた相手、逃げている残り */
  hp: number;
  hitAt: number;
  foe: number;
  flee: number;
  /** 歩き方の状態（本能だけの種が壁に引っかかったときの向き直り、ミノタウロスの突進後のよろめき） */
  gait: number;
  /** 生まれた tick（中で生まれた子は、しばらく小さな姿） */
  bornAt: number;
  /** 眠り：0 起きている、1 浅い眠り、2 深い眠り、3 半分だけ眠る。眠気（起きている間にたまり、眠ると減る） */
  sleep: number;
  drowsy: number;
  /** 光に寄る：狙っている冒険者と、潜みはじめた step 番号 */
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
  /** 最後に引っ越しを試みた tick */
  moved?: number;
  /** まわり（10マス）の食べられる苔で養える数（土地勘と同じタイミングで数え直す。セーブに入れる） */
  cap?: number;
  /** 掘り進めている巣穴の先と長さ */
  hk?: number;
  len?: number;
}

/** 狩りの獲物の種（呼ぶたびに配列を作らないように） */
export const HUNT0: Kind[] = [Kind.Rat, Kind.Ant];
export const HUNT1: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Goblin, Kind.Kobold, Kind.Ant, Kind.Adventurer, Kind.Dwarf];
/** オークの獲物：ゴブリンは従える相手なので獲物にしない */
export const HUNT_ORC: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Kobold, Kind.Ant, Kind.Adventurer, Kind.Dwarf];
export const HUNT2: Kind[] = [Kind.Rat, Kind.Ant, Kind.Kobold];
export const HUNT3: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Goblin, Kind.Kobold, Kind.Ant, Kind.Orc, Kind.Lizardman, Kind.Spider, Kind.Slime, Kind.Zombie, Kind.Adventurer];
export const HUNT4: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Goblin, Kind.Kobold, Kind.Ant, Kind.Lizardman, Kind.Orc, Kind.Slime, Kind.Zombie, Kind.Myconid, Kind.Adventurer];
export const HUNT5: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Ant, Kind.Kobold, Kind.Goblin];
export const HUNT6: Kind[] = [Kind.Rat];
/** 上下左右（呼ぶたびに配列を作らないように） */
export const NB4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** 16方向の単位ベクトル（三角関数を使わずに作る） */
export const DIR16: [number, number][] = [
  [16, 0], [15, 6], [11, 11], [6, 15], [0, 16], [-6, 15], [-11, 11], [-15, 6],
  [-16, 0], [-15, -6], [-11, -11], [-6, -15], [0, -16], [6, -15], [11, -11], [15, -6],
].map(([a, b]) => {
  const l = Math.sqrt(a * a + b * b);
  return [a / l, b / l] as [number, number];
});

export const sq = (a: number) => a * a;

export function ih(a: number, b: number, c = 0): number {
  let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

export const MAX_WISPS = 1400;
/** 群れを作りうる種（groupKeyRaw が null 以外を返しうる種） */
export const GROUPED: boolean[] = [];
for (const k of [Kind.Rat, Kind.Bat, Kind.Vampire, Kind.Orc, Kind.Ant, Kind.Kobold, Kind.Goblin, Kind.Lizardman, Kind.Adventurer, Kind.Dwarf]) GROUPED[k] = true;

export class Ecology {
  list: Cr[] = [];
  webs: Web[] = [];
  burrows: Burrow[] = [];
  nextId = 1;
  /** 外から持ち込まれた養分の合計 */
  imported = 0;
  /** 外へ持ち出された養分の合計 */
  exported = 0;
  /** 生き物の更新の通し番号（step 番号。CR_EVERY tick ごとに1増える。セーブに入れる） */
  step = 0;
  counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  /** ドワーフの住みか（一つまで）、坑道のランプ、外に伝わった話（1 = ゴーレムの宝物庫は危ない） */
  hold: Hold | null = null;
  lamps: number[] = [];
  dwarfLore = 0;
  lastDwarves = -1;
  /**
   * 分析用の記録（分析ツールが読んで空にする。ゲームでは古いものから捨てる）。
   * deaths：死んだ生き物（死因と、手を下した種）。births：現れた生き物（来た口か、生まれたか）。exits：外へ出ていった生き物
   */
  stats: {
    deaths: { t: number; k: number; cause: string; by: number; x: number; y: number }[];
    births: { t: number; k: number; origin: string; x: number; y: number }[];
    exits: { t: number; k: number; reason: string; x: number; y: number }[];
    /** 群れの引っ越し（大ネズミの巣穴など）：tick、種、何匹、元の場所と移った先（px） */
    moves: { t: number; k: number; n: number; x: number; y: number; tx: number; ty: number }[];
    /**
     * 住みつく群れの出来事（いまはコボルトの住処）：ev は found 作った（how：arrive 来て / move 移って / split 分かれて）、
     * abandon 捨てた（reason：food 蓄えが尽きた / raids 何度も襲われた / alone 1匹になった / dragon 竜を恐れた、to：leave 去った / move 移った）、
     * empty 誰もいなくなって消えた
     */
    settle: { t: number; k: number; id: number; ev: string; how?: string; reason?: string; to?: string; n?: number; x: number; y: number }[];
  } = { deaths: [], births: [], exits: [], moves: [], settle: [] };
  /** 次に生まれる生き物の由来（spawn の直前に設定し、spawn が読んで戻す） */
  originNext = '';
  /** 卵（クモの卵嚢、トカゲの卵）：産んだ tickと、孵る子の数、子の体になる養分 */
  eggs: { id: number; k: number; x: number; y: number; t: number; n: number; units: number }[] = [];
  /** 入口で食べ残しを落とす一行（入ってきた次の生き物の更新で落とす） */
  pendingScraps: number[] = [];
  parties: Party[] = [];
  lore: Lore = { explored: [], gold: [], danger: [] };
  /** 記録：目立つ出来事（tick、場所、一文。種の名前は {k:番号} で書き、表示のときに照らされたかどうかで置き換える） */
  events: { t: number; x: number; y: number; m: string }[] = [];
  /** 一度でも光に照らされた種 */
  discovered = new Uint8Array(32);
  gear: Item[] = [];
  rumors: Rumors = { light: 0, gold: 0, undead: 0, beast: 0, dragon: 0, beastKind: 0, beastX: 0, beastY: 0, goblin: 0, goblinX: 0, goblinY: 0, dragonX: 0, dragonY: 0, goblinRobs: 0, goblinCamp: 0, goblinCampX: 0, goblinCampY: 0 };
  /** 外との金貨の出入り */
  goldIn = 0;
  goldOut = 0;
  /** 帰った一行の数、倒れた冒険者の数 */
  returned = 0;
  fallen = 0;
  /** 燃えているマスの一覧 */
  burning: number[] = [];
  piles: Pile[] = [];
  /** 死骸・落とし物・金貨の山・石像・物資の置き場のいきさつ（物の番号ごと。情報パネル用で、判断には使わない） */
  notes = new Map<number, Note>();
  /** ワームの体がたどる跡（頭の過去の位置） */
  trails = new Map<number, number[]>();
  statues: Statue[] = [];
  statueAt = new Map<number, number>();
  camps: Camp[] = [];
  /** 物資の置き場（深部の探索の一行が残す） */
  caches: SupplyCache[] = [];
  /** 町の冒険者の名簿（12人）と、熟練以上の冒険者の墓標、名簿と墓標の番号の続き（src/eco/roster.ts） */
  roster: Hero[] = [];
  graves: Grave[] = [];
  nextHero = 1;
  /** 種ごとに、最後に群れが来た step 番号（立て続けに来ないように） */
  lastArrival: number[] = [];
  colonies: Colony[] = [];
  warrens: Warren[] = [];
  traps: Trap[] = [];
  /** 地図の横のマス数（描画用） */
  get mapW(): number {
    return this.w.map.w;
  }
  /** この tick までコボルトは来ない（住処が襲われて捨てられたという外の噂） */
  koboldShun = 0;
  /** この tick までゴブリンは来ない（集落が襲われて捨てられたという外の噂） */
  goblinShun = 0;
  /** 同時にダンジョンの中にいる冒険者の一行の数の上限（切り替えられる。既定 2） */
  static ADV_MAX_PARTIES = 2;
  /**
   * ウィスプ（光の精を除く）が判断して動く間隔（生き物の更新の何回に1回か）。数が多く（生き物の約6割）、漂うだけなので間引く。
   * 動く回に、間引いたぶん（WISP_EVERY 倍）動いて食べる。ほかの回は腹が減るだけ。描画は px から x へ WISP_EVERY 回ぶんの時間をかけて補間する（wispAlpha）
   */
  static WISP_EVERY = 4;
  /** 弱い生き物の害（pester）をなす種 */
  static PESTERS = new Set<number>([Kind.Rat, Kind.Bat, Kind.Ant, Kind.Wisp, Kind.Myconid, Kind.Salamander]);
  /** 苔を食べたなどで苔の場が変わった */
  mossTouched = false;
  lastPhase = 0;
  byId = new Map<number, Cr>();
  head: Int32Array;
  next: Int32Array = new Int32Array(0);
  items: Cr[] = [];
  /** 道筋（遠くへ行くとき）。miss は、目的地への道が見つからなかった探索が何回続いたか（0 なら道は見つかっている。そのときの path は、目的地にいちばん近づけるマスまでの道） */
  paths = new Map<number, { gx: number; gy: number; gk: number; at: number; path: number[]; pi: number; stall: number; miss: number }>();
  bq: Int32Array;
  bprev: Int32Array;
  bmark: Int32Array;
  bgen = 0;

  constructor(readonly w: World) {
    const N = w.map.w * w.map.h;
    this.head = new Int32Array(N);
    this.bq = new Int32Array(N);
    this.bprev = new Int32Array(N);
    this.bmark = new Int32Array(N);
  }

  /**
   * 土地勘：開いた場所にある、豊かな苔とキノコの群落（通常速度で1分ごとに書き出す）。
   * 近くで餌が見つからない生き物は、ここから近い群落を目指す
   */
  forage: number[] = [];
  /** 開いた場所（閉じた空洞の外）の苔とキノコの量。数の上限や来訪の条件に使う */
  openMoss = 0;
  openFungus = 0;
  /** 開いた床の、食べられる苔（20以上の群落の、根元12を除いた分）。土地勘と同じ時機に数える */
  edibleMoss = 0;
  /** 開いた場所のキノコのうち、コボルトの畑の外にあるもの（ゴブリンが来る条件に使う。土地勘と同じ時機に数える） */
  wildFungus = 0;

  /** 地図の横8マスごとの区切りに、いま何匹いるか（nearby で空の区切りを飛ばす。見る順番は変わらない） */
  blk = new Int32Array(0);
  usedTiles: number[] = [];

  day = 0;
  corpses: Cr[] = [];

  dayNow = 0;
  lastLogged: number[] = [];
  phaseNow = 0;

  deathMap = new Int32Array(24 * 18);
  /** 長く残る「死者の多さ」（冒険者や大物が倒れた所。ゆっくり薄れる） */
  graveMap = new Int32Array(24 * 18);
  /** 冒険者の亡骸の墓（区画ごと。ゲーム内の約6日残る） */
  advGrave = new Int32Array(24 * 18);

  /**
   * ゴブリンの集落の場所：暗く、人の気配が薄く、冒険者の通り道（気配の濃いマス）から歩いて15マス以上（40マスまでが望ましい：
   * 灯りを見張って盗みや待ち伏せに出られる近さ）。竜の寝床から30、トロールとバジリスクから15、コボルトの住処から15、
   * ほかの集落から30マス離れ、まわりにネズミとキノコ（食べ物）があり、出発点から歩いて行ける所（`pickGoblinCamp`）。
   * 外から来て集落を作るときは、まわり14〜16マスの食べ物（`campFood`）がこの値に満たない所は選ばない
   */
  static GOBLIN_MIN_FOOD = 1800;
  /** 食べ物の足りる場所がどの横穴の先にも無いとき、貧しい集落として住みつける場所の食べ物のしきい値（`campFood`）と、そのとき来る群れの数 */
  static GOBLIN_POOR_FOOD = 600;
  static GOBLIN_POOR_BAND = 3;
  /** オークが来る口：歩いて行ける範囲（ORC_REACH マス）に、従えられるゴブリンの集落がなければ、獲物（大ネズミ・大トカゲ・コボルト。いるオーク1匹あたり4匹を差し引く）がこの数以上いること（七巡目） */
  static ORC_MIN_PREY = 12;
  static ORC_REACH = 100;

  /** 口ごとに、そこからゴブリンが来られるか（コボルトの kobMouthOk と同じ。ゲーム内の約2時間ごとに調べ直し、セーブに入れる） */
  gobMouthOk: number[] = [];

  pendingDigs: number[] = [];

  lastDigCount = -1;
  /** 崩落の土ぼこり（描画専用。セーブしない） */
  effects: { x: number; y: number; t: number }[] = [];

  /** 血の跡（描画専用。ゲーム内の半日ほどで消える） */
  blood: { x: number; y: number; t: number; c: number; v: number }[] = [];

  /**
   * 群れの一覧（生き物の更新ごとに、生き物の状態から作り直す。セーブしなくても同じものが作り直せる）。
   * 群れの識別は、それぞれの種がもともと持っている仲間の覚え方を使う：
   * 大ネズミとオークは巣の場所、コウモリはねぐら（主のヴァンパイアがいればその群れ）、アリ・コボルト・ゴブリン・リザードマンは所属する巣、
   * 冒険者は一行、ドワーフは住みか、ヴァンパイアは自分が率いる群れ。それ以外の種は群れない。
   * type：0 巣を持つ群れ（集まる場所は巣）、1 旅する群れ（集まる場所は先頭）
   */
  groups = new Map<string, { key: string; k: number; type: number; hx: number; hy: number; members: Cr[] }>();
  /** 警戒：群れの仲間が襲われた（群れの識別キー → step 番号、襲ってきた相手、場所） */
  alarms = new Map<string, { t: number; foe: number; x: number; y: number }>();

  /** 群れの識別キーのキャッシュ（生き物の更新ごとに、群れの一覧を作るときに作り直す。更新の途中で変わった者はキャッシュを使わずに求める） */
  gkCache = new Map<number, string | null>();
  /** 群れの識別キーの文字列のキャッシュ（種と二つの数が同じなら同じ文字列。作り直しを減らすだけで、値は同じ） */
  gkMemo = new Map<number, [string, number, number, string]>();

  /** 縄張り：群れない種のうち縄張りを持つものは、同じ種が近づくと、強いほうが威嚇して弱いほうを退かせる（殺し合いにはしない） */
  static TERRITORY: Record<number, number> = { [Kind.Spider]: 6, [Kind.Lizard]: 6, [Kind.Troll]: 10, [Kind.Basilisk]: 10, [Kind.Minotaur]: 10, [Kind.Wyvern]: 12 };

  /**
   * 種ごとの眠り方。kind：none 眠らない、poly 何度も細かく眠る、mono まとまって眠る、half 半分だけ眠る、
   * irreg 不定期に眠る、drift 眠りながらゆっくり動く。when：day 昼、night 夜、any いつでも。
   * 眠気は起きている間に生き物の更新1回につき1ずつたまり、眠っている間は out ずつ減る。th を超えると眠りたくなる（時間帯の外では2倍まで我慢する）
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

  /** 体の大きさ（間合いの目安。px） */
  static bodySize(k: number): number {
    if (k === Kind.Dragon || k === Kind.Worm) return 40;
    if (k === Kind.Golem || k === Kind.Troll || k === Kind.Minotaur || k === Kind.Wyvern) return 18;
    if (k === Kind.Orc || k === Kind.Lizardman || k === Kind.Adventurer || k === Kind.Dwarf || k === Kind.Vampire || k === Kind.Skeleton || k === Kind.Lich || k === Kind.Basilisk || k === Kind.Lizard || k === Kind.Zombie) return 11;
    if (k === Kind.Rat || k === Kind.Ant || k === Kind.Bat || k === Kind.Kobold || k === Kind.Goblin || k === Kind.Spider || k === Kind.Myconid || k === Kind.Slime) return 8;
    return 0;
  }

  /**
   * 人の気配：区画（8×8マス）ごとの濃さ（0〜1）。入口から通路をたどった道のりが短いほど濃い（base）。
   * 冒険者とドワーフが通ると跡が残り、ゆっくり薄れる（trace）。焚き火とランプのまわりも濃い。
   * 強いモンスターは、住みかやうろつく先、休む場所を選ぶとき、強いほど気配の濃い所を避けやすい（獲物を追うときは気にしない）
   */
  presenceBase = new Float32Array(Math.ceil(192 / CELL) * Math.ceil(144 / CELL));
  presenceTrace = new Float32Array(Math.ceil(192 / CELL) * Math.ceil(144 / CELL));

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

  /** いまの tick に明るいマス（光源と、光る生き物の光が届く所。壁の遮りは見ない）。生き物の更新ごとに作り直す */
  litMap = new Uint8Array(0);
  litMapStep = -1;
  litMarked: number[] = [];
  litMapTick = -1;

  /** 火を怖がる野の獣 */
  /** クモの巣の大きさ（半径 px。2×2マスほど。通路をまたいでふさぐ） */
  static WEB_R = 32;
  static FEARS_FIRE = new Set<number>([Kind.Rat, Kind.Lizard, Kind.Spider, Kind.Bat, Kind.Ant, Kind.Troll, Kind.Basilisk, Kind.Minotaur]);

  fireList: [number, number, number][] = [];
  fireStep = -1;

  /** その場所の、いちばん近い火（怖さの届く中にあれば） */
  /** マスの中心のそばに火があるか（同じ回の生き物の更新のうちは、マスごとに一度だけ調べる。火の一覧は更新ごとに決まる） */
  fnStamp = new Int32Array(0);
  fnVal = new Uint8Array(0);

  /** 歩いてつながる洞窟の領域（地形が変わるたび＝地形変更ログ digs が増えるたびに作り直す。セーブしなくても同じものが作り直せる） */
  regionMap = new Int32Array(0);
  regionVer = -1;
  mainRegion = -1;
  mainPointCache = new Map<number, number>();

  /**
   * 上の端の横穴：始まりの洞窟との間の薄い岩壁が、3〜5日目のうちに崩れて通じる（自然の出来事）。
   * 横穴の空洞の床から、いちばん近い入口側の洞窟のマスまで、縦と横にまっすぐ掘る（溶岩、宝物庫、迷路は避ける）
   */
  wallBroken = false;

  /** 島で暮らしていた集落や住処が、入口側とつながったら記録に残す */
  islandIds = new Set<number>();

  /**
   * 攻撃の演出の記録（描画専用）。style は技の種類：slash 斬る、jag 荒い振り、stab 突く、smash 殴る、bite 噛む、claw 爪、
   * sting 刺す、arrow 矢、orb 魔法の弾、beam 光線、drain 吸う、chill 冷たい手、acid 溶かす、spore 胞子。
   * col は色（0 白、1 金、2 炎、3 毒、4 魔、5 血、6 石、7 霜）、size は大きさ（0〜2）。big は強い一撃、kill はとどめ
   */
  fxAttacks: { t: number; style: string; col: number; size: number; ax: number; ay: number; dx: number; dy: number; did: number; aid: number; big: boolean; kill: boolean }[] = [];
  /** 強い一撃があった tick（画面がほんの一瞬「ため」を入れるため。描画専用） */
  lastBigHit = -1;

  /** 特別な個体の名前と、種類ごとの最後に現れた tick */
  names = new Map<number, string>();
  lastElite: number[] = [];

  /** 幼竜が生まれた場所の卵の殻（ゲーム内の3日ほど残る） */
  dragonShell: { x: number; y: number; t: number } | null = null;

  /** 攻撃が当たった所（tick、場所、打った側の場所） */
  fxHits: { t: number; x: number; y: number; ax: number; ay: number; id: number }[] = [];
  /** 気づいた印：「！」（敵や獲物）か「？」（害のない相手） */
  fxMarks: { t: number; id: number; m: string }[] = [];
  /** マナから生まれた者（描画専用：生まれる場所にマナが集まって姿が現れる演出。セーブしない。シミュレーションの判断に使わない） */
  fxManaBorn: { id: number; t: number; k: number; x: number; y: number }[] = [];
  /**
   * 捕食の演出の記録（描画専用）：生きている獲物が食べられた瞬間ごとに、獲物（id、種 k、位置）と食べた者（by、種 bk）、
   * 打ち合いで仕留めてから食べたか（slain）。シミュレーションの判断には使わない（セーブには、映像のために直前の6秒分だけ残す）。src/creatureView.ts が、くわえて振る・繭・丸のみ・さらう・消え方を描く
   */
  /** 引き裂かれた巣の演出の記録（描画専用。破れた巣が垂れて消え、糸くずが舞う） */
  fxWebTears: { t: number; x: number; y: number; r: number }[] = [];
  fxEats: { t: number; id: number; k: number; sp: number; by: number; bk: number; x: number; y: number; slain: boolean }[] = [];
  /** 大ネズミの巣穴の引っ越し（描画専用：列の先頭が新しい巣穴に着くまで、古い場所に穴を描く。判断に使わない） */
  fxMarch: { t: number; x: number; y: number; tx: number; ty: number }[] = [];
  noticed = new Map<number, number>();

  /** デモの組：攻める側と受ける側 */
  demoPairs: [Cr, Cr][] = [];

  /** 物音（戦い、崩落、掘る音）。通常速度で数秒だけ残る */
  noises: { x: number; y: number; r: number; t: number; s?: number }[] = [];

  /** 職業ごとの道具 */
  static JOB_ITEMS: number[][] = [[ItemKind.Sword, ItemKind.Shield], [ItemKind.Staff], [ItemKind.Dagger], [ItemKind.Mace, ItemKind.Symbol], [ItemKind.Lute], [ItemKind.Bow], [ItemKind.Greatsword]];

  /** 大ネズミが来られる口と天井の裂け目（1 なら来られる。生き物の更新600回ごとに、決まった回で調べ直し、セーブに入れる） */
  ratMouthOk: number[] = [];
  ratShaftOk: number[] = [];
  /** 大ネズミの入り直し（七巡目）：地表の横穴が開いたあとでも、中の大ネズミが2匹以下になったら 1（天井の割れ目をまた使える）、3匹を超えたら 0。セーブに入れる */
  ratReentry = 0;
  /** オークが来られる口（1 なら来られる。歩いて行ける範囲に従えられるゴブリンの集落か十分な獲物がある。生き物の更新600回ごとに調べ直し、セーブに入れる） */
  orcMouthOk: number[] = [];
  /** 大ネズミが入り込む裂け目を、その回の更新の間だけ決めておく（来る群れが同じ裂け目から入るように。セーブしない） */
  forcedCrack: [number, number] | null = null;
  /**
   * 大ネズミが来るかどうかを決める範囲（道のり）。大ネズミが食べずに歩けるのは約20マスなので、それより内側にする
   * （四巡目は40マスで、天井の裂け目から来た大ネズミが苔にたどり着く前に飢えていた）
   */
  static RAT_DOOR_REACH = 18;

  /** マス k からの歩いた道のり（溶岩、閉じた空洞、岩は通らない。max マスまで。届かなければ -1） */
  /** 歩いた道のりを測る探索（walkDist）の待ち行列（毎回確保せずに使い回す） */
  wdQ = new Int32Array(0);

  /**
   * 住処の候補のまわりの食べ物：8マス以内の食べられる苔とキノコ（20以上の群落の、根元12を除いた分）と、10マス以内のネズミ1匹あたり100。
   * 来たばかりの群れ（4〜6匹）がゲーム内の2日ほど食べていける目安が KOBOLD_MIN_FOOD
   */
  static KOBOLD_MIN_FOOD = 1500;

  /**
   * 口ごとに、そこからコボルトが来られるか（歩いて行ける範囲に、住処の条件を満たし食べ物も足りる場所があるか）。
   * ゲーム内の約2時間（生き物の更新600回）ごとに、決まった回で調べ直し、セーブに入れる
   */
  kobMouthOk: number[] = [];

}
