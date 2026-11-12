/**
 * 魔物の湧き方の表（src/eco/generate.ts の generate が見る）。
 *
 * 勇者のくせになまいきだ シリーズの構造に寄せて、野の魔物はダンジョンの中の資源（土の養分とマナ）から湧く。
 * 一行が一つの種の湧き方：どちらの資源から（side）、どの段か（tier）、いつ判定するか（every・phase・cool・minDay）、
 * 湧ける条件（ok・cap・chance。cap は無くてもよい）、どこに（site）、何匹（band）、体と胃とマナの量（body・food・mana。体と胃はすべて土の養分から取る）。
 * 種を足すときは、ここに一行足す。湧くかどうかは、資源の量と場所の条件（食べ物があるか）で決まる。
 */
import { Burrow, Camp, Colony, Cr, DAY_TICKS_ECO, Ecology, Kind, SPEC, Warren, ih } from '../ecology';
import { TILE } from '../mapgen';
import { BASILISK_MANA } from './basilisk';

export interface SpawnDef {
  k: Kind;
  /** 'nutr' 土の養分から湧く（origin 'soil'）／'mana' マナから湧く（origin 'mana'） */
  side: 'nutr' | 'mana';
  /** 段：1 下の種、2 中くらい、3 上の種（飢え死にの記憶 starveBlocks の重みに使う） */
  tier: 1 | 2 | 3;
  /** 判定する回：生き物の更新の通し番号 step について step % every === phase。every が 0 の行は generate では見ない（ほかの所から generateOne で呼ぶ） */
  every: number;
  phase: number;
  /** 前に湧いてから次に湧けるまでの、生き物の更新の回数（lastArrival[k] で見る。0 なら待たない） */
  cool: number;
  /** この日（ゲーム内の日数）より前は湧かない */
  minDay: number;
  /** 湧ける条件（住処がまだ無い、大ネズミが10匹以上など）。省略なら常に true */
  ok?(e: Ecology): boolean;
  /** ダンジョン全体の上限。無ければ上限なし（数は資源と、場所の条件にある縄張りの間隔で決まる） */
  cap?(e: Ecology): number;
  /** この回に湧くかのくじ。site より先に見る（site は重い） */
  chance?(e: Ecology): boolean;
  /** 湧く場所（タイル番号、なければ -1）。状態を書き換えてはいけない（巣穴を足すなどは before で） */
  site(e: Ecology): number;
  /** 一度に湧く数 */
  band(e: Ecology, site: number): number;
  /** 1匹あたりの体と胃（どちらも土の養分から）と、体に移すマナ */
  body: number;
  food: number;
  mana: number;
  /** 体と胃のほかに土から取る養分（巣・住処・集落の蓄え、従うコウモリなど。n は湧く数） */
  extra?(e: Ecology, n: number): number;
  /** 養分を集める半径（既定4）と、マナを集める半径（既定3） */
  nutrR?: number;
  manaR?: number;
  /** true なら、体のマナ（mana × 湧く数）を土から全部集められるときだけ湧く（養分と同じく全部か無しか。false ならあるだけ集める） */
  manaAll?: boolean;
  /** 湧く前の準備（住処・集落・巣・巣穴を作る）。extra で取った養分を第3引数で受け取る。戻り値は setup に渡す */
  before?(e: Ecology, site: number, extra: number): unknown;
  /** i 匹目を置くピクセル座標（既定は spotNear） */
  spot?(e: Ecology, site: number, i: number): [number, number];
  /** 1匹ずつの初期化（住みか、所属、bornAt など） */
  setup?(e: Ecology, c: Cr, site: number, i: number, ctx: unknown): void;
  /** 土ぼこりの演出を出すか（既定は side==='nutr'） */
  dust?: boolean;
  /** ゲーム内ログの文（{k:番号} は種の名前になる）。同じ種の文は生き物の更新3000回あける */
  log?: string;
  /**
   * false なら、飢え死にの記憶（src/eco/generate.ts の noteStarve・starveBlocks）を使わない：この種の飢え死にを記憶に足さず、記憶で湧きを止めない。
   * ねぐらで飢えて入れ替わるのがふつうの種（コウモリ）に付ける（その飢え死には場所の良し悪しの印にならず、同じ区画で湧く大物まで止めてしまう）
   */
  starveMemo?: false;
}

/** マナから湧く大物どうしが離れて湧くために見る、生きているトロール・バジリスク・ドラゴンの種と位置（ピクセル） */
type Big = { k: Kind; x: number; y: number };

/** 一覧 bigs の中に、種 kind が、マス k から R マスの内（縦と横の和）にいるか */
function near(e: Ecology, bigs: Big[], k: number, kind: Kind, R: number): boolean {
  const W = e.w.map.w;
  return bigs.some((c) => c.k === kind && Math.abs(c.x / TILE - (k % W)) + Math.abs(c.y / TILE - Math.floor(k / W)) < R);
}

/**
 * マナから湧く大物の場所：開いた床を40か所見て（どの種も同じ順に見る）、まわりのマナが2以上で want を満たし、
 * 4つに1つのくじに当たった最初のマス（以前の manaBirths と同じ見方と同じくじ）。
 * 生きているトロール・バジリスク・ドラゴンの位置は、候補のマスごとに生き物の一覧を見ずに済むよう、先に一度だけ集めて want に渡す
 */
function manaSite(e: Ecology, want: (k: number, mn: number, bigs: Big[]) => boolean): number {
  const m = e.w.map;
  const bigs: Big[] = [];
  for (const c of e.list) if (!c.dead && (c.k === Kind.Troll || c.k === Kind.Basilisk || c.k === Kind.Dragon)) bigs.push({ k: c.k, x: c.x, y: c.y });
  for (let i = 0; i < 40; i++) {
    const k = ih(e.step, i, 230) % (m.w * m.h);
    if (m.solid[k] || m.sealed[k] || m.lava[k] || e.w.water[k] > 40) continue;
    const mn = e.manaAround(k);
    if (mn < 2 || !want(k, mn, bigs)) continue;
    if (ih(k, e.step, 232) % 4 !== 0) continue;
    return k;
  }
  return -1;
}

/** 暗く、日の光が差さないマス */
const darkDeep = (e: Ecology, k: number) => e.w.lightBase[k] === 0 && e.lit(k, e.day) < 0.12;

/** 開いた床（岩・溶岩・閉じた空洞・水たまりでない） */
const openDry = (e: Ecology, k: number) => {
  const m = e.w.map;
  return !m.solid[k] && !m.sealed[k] && !m.lava[k] && e.w.water[k] <= 10;
};
const tileX = (e: Ecology, k: number) => (k % e.w.map.w) * TILE + 8;
const tileY = (e: Ecology, k: number) => Math.floor(k / e.w.map.w) * TILE + 8;

/** 群れが住みつく場所を探す出発点：苔やキノコの豊かな群落（forage）から一つ（塩 salt でくじを分ける）。歩いて100マスの内から住処を選ぶ */
function forageFrom(e: Ecology, salt: number): [number, number] | null {
  const f = e.forage;
  if (!f.length) return null;
  const a = f[ih(e.step, 5, salt) % f.length];
  return [tileX(e, a), tileY(e, a)];
}

/**
 * ゴブリンの湧く場所が、食べ物の乏しい所か。site は、まず食べ物の足りる所（campFood が GOBLIN_MIN_FOOD 以上）から選び、
 * なければ乏しい所から選ぶので、選んだ所の campFood が GOBLIN_MIN_FOOD 未満なら乏しい所（campFood は苔・キノコ・大ネズミ・死骸を数え、
 * 湧くときに土から取る養分では変わらない）
 */
const gobPoorAt = (e: Ecology, site: number) => e.campFood(site) < Ecology.GOBLIN_MIN_FOOD;

/** ゴブリンの集落（住みかの番号が0以上）と、コボルトの住処 */
const goblinCamps = (e: Ecology) => e.camps.filter((o) => o.kind === 0 && o.id >= 0);

/** いちばん大きなコウモリのねぐら（従っていないコウモリの、ねぐらの位置 tx, ty ごとの数。キーは ty*4096+tx、なければ -1） */
function bigRoost(e: Ecology): number {
  const roosts = new Map<number, number>();
  for (const b of e.list) if (b.k === Kind.Bat && !b.dead && b.tx > 0 && !b.ref2) roosts.set(b.ty * 4096 + b.tx, (roosts.get(b.ty * 4096 + b.tx) ?? 0) + 1);
  let best = -1;
  let bn = 0;
  for (const [key, cnt] of roosts) if (cnt > bn || (cnt === bn && key < best)) [best, bn] = [key, cnt];
  return best;
}

/** 大ネズミの湧く場所：苔やキノコの豊かな群落（forage）から最大6か所を見て、まわりで大ネズミをあと2匹以上養えるマス */
function ratSite(e: Ecology): number {
  const f = e.forage;
  if (!f.length) return -1;
  for (let i = 0; i < 6; i++) {
    const k = f[ih(e.step, i, 814) % f.length];
    if (e.ratRoomAt(tileX(e, k), tileY(e, k))) return k;
  }
  return -1;
}

/** 大トカゲの湧く場所：開いた床を60か所見て、12マスの内に大ネズミ（獲物）がいるマスのうち、いちばん暖かいマス */
function lizardSite(e: Ecology): number {
  const m = e.w.map;
  const rats = e.list.filter((c) => c.k === Kind.Rat && !c.dead && !c.away);
  if (!rats.length) return -1;
  let best = -1;
  let bh = -1;
  for (let i = 0; i < 60; i++) {
    const k = ih(e.step, i, 816) % (m.w * m.h);
    if (!openDry(e, k)) continue;
    const x = tileX(e, k);
    const y = tileY(e, k);
    if (!rats.some((r) => (r.x - x) ** 2 + (r.y - y) ** 2 < (12 * TILE) ** 2)) continue;
    if (e.w.heat[k] > bh) {
      bh = e.w.heat[k];
      best = k;
    }
  }
  return best;
}

/**
 * 大グモの湧く場所：飛ぶ獲物（ウィスプかコウモリ）を8匹まで選び、それぞれのまわり6マスの内を12か所見て、
 * 上下左右に岩がある（巣を張れる壁ぎわの）開いた床の最初のマス。
 * （地図全体から60か所を見るやり方では、獲物の近くに当たることが少なく、大グモが初めて現れるのが main より3日ほど遅れた）
 */
function spiderSite(e: Ecology): number {
  const m = e.w.map;
  const fly = e.list.filter((c) => (c.k === Kind.Wisp || c.k === Kind.Bat) && !c.dead && !c.away);
  if (!fly.length) return -1;
  for (let i = 0; i < 8; i++) {
    const o = fly[ih(e.step, i, 817) % fly.length];
    const ox = Math.floor(o.x / TILE);
    const oy = Math.floor(o.y / TILE);
    for (let j = 0; j < 12; j++) {
      const h = ih(e.step, i * 16 + j, 818);
      const x = ox + (h % 13) - 6;
      const y = oy + ((h >>> 8) % 13) - 6;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      if (!openDry(e, k)) continue;
      if (m.solid[k + 1] || m.solid[k - 1] || m.solid[k + m.w] || m.solid[k - m.w]) return k;
    }
  }
  return -1;
}

export const SPAWN_DEFS: SpawnDef[] = [
  // ---- 土の養分から湧く種（以前は外から来ていた） ----
  // コウモリ：夕暮れに、まわり（±10マス）に苔の豊かな縦穴のねぐらへ、2匹ずつ湧く（ねぐらごとに20匹まで）。生き物の更新ごとには見ず、
  // 夕暮れの出来事（src/eco/salamander.ts の onDayEvents）から、縦穴ごとに generateOne で呼ぶ。土ぼこりは出さない（天井のねぐらに現れる）。
  // コウモリは main でも死の8割が飢え死にで、ねぐらで飢えては湧いて入れ替わるので、飢え死にの記憶は使わない（starveMemo）
  {
    k: Kind.Bat, side: 'nutr', tier: 1, every: 0, phase: 0, cool: 0, minDay: 0, starveMemo: false,
    cap: () => 260,
    site: () => -1,
    band: () => 2,
    body: 10, food: 10, mana: 0, nutrR: 6,
    spot: (e, site, i) => {
      const m = e.w.map;
      const sx = site % m.w;
      const sy = Math.floor(site / m.w);
      void i;
      return e.roostSpot(sx * TILE + 8, sy * TILE + 8, sx * TILE + 8, sy * TILE - 20);
    },
    setup: (e, c, site) => {
      const m = e.w.map;
      e.homeBat(c, site % m.w, Math.floor(site / m.w));
    },
    dust: false,
  },
  // 大ネズミ：苔やキノコの豊かな群落のそばに、2匹ずつ湧く。まわりの巣穴に住みつく（いなければ巣穴を作る）。
  // ダンジョン全体の上限（ratCap。食べられる苔の量で決まる）を越えない。少ないうちは湧きやすく、増えると巣穴で殖えるのに任せる
  {
    k: Kind.Rat, side: 'nutr', tier: 1, every: 50, phase: 0, cool: 0, minDay: 0,
    cap: (e) => e.ratCap(),
    chance: (e) => ih(e.step, 1, 71) % (e.counts[Kind.Rat] < 4 ? 5 : 80) === 0,
    site: ratSite,
    band: () => 2,
    body: 16, food: 20, mana: 0,
    before: (e, site) => e.pickBurrowNear([tileX(e, site), tileY(e, site)]),
    setup: (e, c, _site, _i, ctx) => {
      const b = ctx as Burrow;
      c.hx = b.x;
      c.hy = b.y;
      // 湧いた大ネズミは、生まれて1日たった大人として扱う（群れの王になる条件や、殖えられる年に関わる）
      c.bornAt = e.w.tick - DAY_TICKS_ECO;
    },
  },
  // 大トカゲ：大ネズミが増えたら、獲物のいる所の、なるべく暖かい床に湧く
  {
    k: Kind.Lizard, side: 'nutr', tier: 2, every: 50, phase: 0, cool: 0, minDay: 3,
    ok: (e) => e.counts[Kind.Rat] >= 10,
    cap: (e) => Math.min(24, Math.floor(e.counts[Kind.Rat] / 6)),
    chance: (e) => ih(e.step, 2, 71) % (e.counts[Kind.Lizard] < 2 ? 8 : 120) === 0,
    site: lizardSite,
    band: () => 1,
    body: 60, food: 40, mana: 0,
    log: `獲物の増えた洞窟の土から、{k:${Kind.Lizard}}が這い出した`,
  },
  // 大グモ：飛ぶもの（ウィスプ・コウモリ）が増えたら、その近くの壁ぎわに湧く（巣は自分で張る）
  {
    k: Kind.Spider, side: 'nutr', tier: 2, every: 50, phase: 0, cool: 0, minDay: 1,
    ok: (e) => e.counts[Kind.Wisp] + e.counts[Kind.Bat] >= 30,
    cap: (e) => Math.min(14, Math.floor((e.counts[Kind.Wisp] + e.counts[Kind.Bat]) / 25)),
    chance: (e) => ih(e.step, 3, 71) % (e.counts[Kind.Spider] < 2 ? 10 : 150) === 0,
    site: spiderSite,
    band: () => 1,
    body: 30, food: 20, mana: 0,
  },
  // ジャイアントアント：キノコが増えたら、キノコの多い壁ぎわに、巣と女王と働きアリ5匹が湧く（巣の蓄え16と女王の30も土の養分から）
  {
    k: Kind.Ant, side: 'nutr', tier: 1, every: 50, phase: 0, cool: 0, minDay: 5,
    ok: (e) => e.openFungus > 2500 && e.colonies.length < 2,
    cap: () => 999,
    chance: (e) => ih(e.step, 4, 71) % 12 === 0,
    site: (e) => e.pickNest(),
    band: () => 5,
    body: 4, food: 12, mana: 0,
    extra: () => 46,
    before: (e, site) => {
      const col: Colony = { id: e.nextId++, x: tileX(e, site), y: tileY(e, site), store: 16, queen: 30, starve: 0 };
      e.colonies.push(col);
      return col;
    },
    setup: (e, c, _site, _i, ctx) => {
      const col = ctx as Colony;
      c.ref = col.id;
      c.hx = col.x;
      c.hy = col.y;
      c.st = 1;
    },
    log: `キノコの茂る洞窟の土から、{k:${Kind.Ant}}の巣が湧いた`,
  },
  // コボルト：大ネズミが6匹以上いるかキノコが増えたら、苔やキノコの豊かな所から歩いて行ける、食べ物の足りる壁ぎわに、4〜6匹の群れが住処ごと湧く
  // （住処の蓄えも土の養分から）。住処がすでにあれば湧かず、住処で生まれる子に任せる。住処が襲われて捨てられた直後はしばらく湧かない（koboldShun）
  {
    k: Kind.Kobold, side: 'nutr', tier: 2, every: 50, phase: 0, cool: 0, minDay: 4,
    ok: (e) => e.w.tick >= e.koboldShun && (e.counts[Kind.Rat] >= 6 || e.openFungus > 2500) && !e.warrens.some((o) => o.id >= 0),
    cap: () => 13,
    chance: (e) => ih(e.step, 5, 71) % 14 === 0,
    site: (e) => {
      const from = forageFrom(e, 813);
      return from ? e.pickWarren(undefined, from, Ecology.KOBOLD_MIN_FOOD) : -1;
    },
    band: (e) => 4 + (ih(e.step, 5, 73) % 3),
    body: 20, food: 30, mana: 0,
    extra: (_e, n) => 20 * n,
    before: (e, site, ex) => {
      const wr = e.newWarren(site, 'soil');
      wr.store = (wr.store ?? 0) + ex;
      return wr;
    },
    setup: (_e, c, _site, _i, ctx) => {
      c.ref = (ctx as Warren).id;
      c.st = 0;
    },
    log: `{k:${Kind.Kobold}}の群れが土から湧き、住処を掘りはじめた`,
  },
  // ゴブリン：集落がなければ、苔やキノコの豊かな所から歩いて行ける、集落の条件を満たし食べ物の足りる所に、5匹の群れが集落ごと湧く。
  // 食べ物の足りる所がなければ、貧しい所に3匹で（集落の蓄えも土の養分から）。集落が襲われて捨てられた直後はしばらく湧かない（goblinShun）
  {
    k: Kind.Goblin, side: 'nutr', tier: 2, every: 50, phase: 0, cool: 3600, minDay: 4,
    ok: (e) => e.w.tick >= e.goblinShun && !goblinCamps(e).length,
    cap: () => 15,
    chance: (e) => ih(e.step, 6, 71) % 14 === 0,
    site: (e) => {
      const from = forageFrom(e, 815);
      if (!from) return -1;
      const k = e.pickGoblinCamp(undefined, from, Ecology.GOBLIN_MIN_FOOD);
      return k >= 0 ? k : e.pickGoblinCamp(undefined, from, Ecology.GOBLIN_POOR_FOOD);
    },
    band: (e, site) => (gobPoorAt(e, site) ? Ecology.GOBLIN_POOR_BAND : 5),
    body: 20, food: 30, mana: 0,
    extra: (_e, n) => 15 * n,
    before: (e, site, ex) => e.newCamp(site, 'soil', ex, gobPoorAt(e, site)),
    setup: (e, c, _site, _i, ctx) => {
      c.ref = (ctx as Camp).id;
      // 湧いたゴブリンは、生まれて1日たった大人として扱う（集落の頭になる条件に関わる）
      c.bornAt = e.w.tick - DAY_TICKS_ECO;
    },
    log: `{k:${Kind.Goblin}}の群れが土から湧き、集落を作った`,
  },
  // オーク：ゴブリンかコボルトの集落があり、両方で8匹以上いれば、まだ誰にも従っていないゴブリンの集落（なければ、いちばん古い集落か住処）の
  // 12〜20マス先に、2〜3頭が縄張りごと湧く。従えられる集落がなければ、まわりの獲物（大ネズミ・大トカゲ・コボルト。オーク1頭あたり4匹を差し引く）が足りるときだけ
  {
    k: Kind.Orc, side: 'nutr', tier: 3, every: 50, phase: 0, cool: 3600, minDay: 4,
    ok: (e) => {
      const camps = goblinCamps(e);
      if (!(camps.length + e.warrens.length) || e.counts[Kind.Goblin] + e.counts[Kind.Kobold] < 8) return false;
      if (camps.some((o) => !(o.lx || o.ly))) return true;
      let prey = 0;
      let orcs = 0;
      for (const o of e.list) {
        if (o.dead || o.away) continue;
        if (o.k === Kind.Rat || o.k === Kind.Lizard || o.k === Kind.Kobold) prey++;
        else if (o.k === Kind.Orc) orcs++;
      }
      return prey - 4 * orcs >= Ecology.ORC_MIN_PREY;
    },
    cap: (e) => Math.min(6, (goblinCamps(e).length + e.warrens.length) * 3),
    chance: (e) => ih(e.step, 7, 71) % 30 === 0,
    site: (e) => {
      const camps = goblinCamps(e).sort((a, b) => a.id - b.id);
      const tgt = camps.find((o) => !(o.lx || o.ly)) ?? [...camps, ...e.warrens.filter((o) => o.id >= 0)].sort((a, b) => a.id - b.id)[0];
      return tgt ? e.pickLair(tgt) : -1;
    },
    band: (e) => 2 + (ih(e.step, 8, 71) & 1),
    body: 60, food: 80, mana: 0,
    setup: (e, c, site) => {
      c.hx = tileX(e, site);
      c.hy = tileY(e, site);
    },
    log: `{k:${Kind.Orc}}が土から湧き、縄張りを持った`,
  },
  // リザードマン：大ネズミが10匹以上いて、村がまだなければ、大きな水たまりのそばに3〜4匹が村ごと湧く
  {
    k: Kind.Lizardman, side: 'nutr', tier: 3, every: 50, phase: 0, cool: 3600, minDay: 9,
    ok: (e) => e.counts[Kind.Rat] >= 10 && !e.camps.some((o) => o.kind === 1),
    cap: () => 8,
    chance: (e) => ih(e.step, 9, 71) % 20 === 0,
    site: (e) => e.pickWaterSite(-1),
    band: (e) => 3 + (ih(e.step, 10, 71) & 1),
    body: 40, food: 80, mana: 0,
    before: (e, site) => {
      const v: Camp = { id: e.nextId++, kind: 1, x: tileX(e, site), y: tileY(e, site), dry: 0 };
      e.camps.push(v);
      return v;
    },
    setup: (_e, c, _site, _i, ctx) => {
      c.ref = (ctx as Camp).id;
    },
    log: `水辺の土から{k:${Kind.Lizardman}}の一族が湧き、村を作った`,
  },
  // ---- マナから湧く種 ----
  // ヴァンパイア：コウモリが15匹以上いれば、夜、いちばん大きなコウモリのねぐらに近い暗がりの壁ぎわ（vampLair）に、従うコウモリ5匹を連れて1体だけ湧く
  // （以前は地表の横穴から入ってきた。湧く時刻はマップごとにずらす）。従うコウモリの体も土の養分から。
  // （以前の来訪の条件は18匹以上。コウモリも縦穴のねぐらに湧くようになって少し減り、16シード×25日でヴァンパイアの湧く数が 64 → 51 に減ったので下げる）
  {
    k: Kind.Vampire, side: 'mana', tier: 2, every: 50, phase: 0, cool: 3600, minDay: 4,
    ok: (e) => e.counts[Kind.Bat] >= 15 && e.dayNow <= 0.05,
    cap: () => 1,
    chance: (e) => {
      const m = e.w.map;
      return ih(e.step, 15 + m.entrance.x * 131 + (m.shafts[0]?.y ?? 0), 71) % 40 === 0;
    },
    site: (e) => {
      const best = bigRoost(e);
      const lair = best >= 0 ? e.vampLair(best % 4096, Math.floor(best / 4096)) : -1;
      return lair >= 0 ? lair : e.pickDark(1, 80);
    },
    band: () => 1,
    body: 50, food: 80, mana: 120,
    extra: () => 5 * (10 + 20),
    before: (e) => bigRoost(e),
    setup: (e, v, site, _i, ctx) => {
      v.hx = tileX(e, site);
      v.hy = tileY(e, site);
      const best = ctx as number;
      for (let i = 0; i < 5; i++) {
        e.originNext = 'soil';
        const b = e.spawn(Kind.Bat, v.x + ((i % 3) - 1) * 6, v.y - 12 - (i % 2) * 6, 10, 20);
        b.ref2 = v.id;
        b.st = 1;
        if (best >= 0) {
          b.tx = best % 4096;
          b.ty = Math.floor(best / 4096);
        }
        e.counts[Kind.Bat]++;
      }
    },
    log: `コウモリの群れを従えて、{k:${Kind.Vampire}}が暗がりのマナから現れた`,
  },
  // ワーム：深部で眠る大物。最初からいて（src/eco/salamander.ts の seed）、倒されると、深部のまわりの土の養分からまた湧く
  // （生き物の更新600回ごとに4つに1つのくじ。前に湧いてから2日はあける）。
  // 以前は一度倒されると二度と現れず、冒険者が深部へ行く回数が増えると、ワームが画面から消える日が増えた
  {
    k: Kind.Worm, side: 'nutr', tier: 3, every: 600, phase: 413, cool: DAY_TICKS_ECO, minDay: 2,
    ok: (e) => e.w.map.deep.x >= 0,
    cap: () => 1,
    site: (e) => {
      const m = e.w.map;
      const k = m.deep.y * m.w + m.deep.x;
      return ih(e.step, 0, 819) % 4 === 0 ? k : -1;
    },
    band: () => 1,
    body: 200, food: 0, mana: 0, nutrR: 6,
    spot: (e) => [e.w.map.deep.x * TILE + 8 + 30, e.w.map.deep.y * TILE + 8 + 20],
    setup: (e, c) => {
      c.st = 0;
      c.dir = 0;
      // 眠っている体：頭の後ろにとぐろを巻くように（はじめのワームと同じ）
      const tr: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = i * 0.7;
        tr.push(Math.round(c.x + Math.sin(a) * (6 + i * 1.6)), Math.round(c.y - 6 - i * 5 + Math.cos(a) * 4));
      }
      e.trails.set(c.id, tr);
    },
    log: `深部の土が盛り上がり、{k:${Kind.Worm}}が目を覚ました`,
  },
  // ドラゴンの幼子：ダンジョンにドラゴンがいなければ、6日目以降、深部のまわり（20マス）でいちばんマナの濃い所が32以上なら、卵が孵る（通常速度で1分ごとに見る）。
  // （マナの湧き口を半分にしたとき、しきい値を決め直した：深部のまわりの最大の中央値が 197 → 91 になったので、70 → 32。
  //  ほかのしきい値も、開いた床のうち満たすマスの割合が以前と同じになる値にした。8シード×10〜25日目で測った）
  {
    k: Kind.Dragon, side: 'mana', tier: 3, every: 600, phase: 113, cool: 14400, minDay: 6,
    ok: (e) => !e.list.some((c) => c.k === Kind.Dragon && !c.dead),
    cap: () => 99,
    site: (e) => {
      const m = e.w.map;
      let bk = -1;
      let bv = 0;
      for (let dy = -20; dy <= 20; dy++)
        for (let dx = -20; dx <= 20; dx++) {
          const x = m.deep.x + dx;
          const y = m.deep.y + dy;
          if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
          const k = y * m.w + x;
          if (m.solid[k] || m.sealed[k] || m.lava[k] || e.w.lightBase[k] > 0 || e.w.water[k] > 40) continue;
          const v = e.manaAround(k);
          if (v > bv) {
            bv = v;
            bk = k;
          }
        }
      return bk >= 0 && bv >= 32 ? bk : -1;
    },
    band: () => 1,
    body: Math.round(SPEC[Kind.Dragon].body * 0.2), food: 60, mana: 600, nutrR: 5, manaR: 4,
    setup: (e, c) => {
      // 幼竜が卵を割って出てくると、地の底の揺れと咆哮が町にも伝わる（竜の噂。竜殺しが深部を探りに来る）
      const posted = e.questKeys();
      e.rumors.dragon += 0.6;
      e.postNewQuests(posted);
      c.sp = 0;
      c.st = 0;
      c.hx = c.x;
      c.hy = c.y;
      c.bornAt = e.w.tick;
      c.lureAt = e.step;
      e.dragonShell = { x: c.x, y: c.y + 4, t: e.w.tick };
    },
    log: `深部の濃いマナから、{k:${Kind.Dragon}}の幼子が生まれた`,
  },
  // バジリスク：マナがとても濃く（30〜。以前は60）、暗く、人の気配が濃すぎない所（0.3未満）。ほかのバジリスク（30マス）・トロール（12マス）・竜（12マス）のそばには湧かない。
  // 上限は置かない（以前は2頭）。数は、湧ける場所と縄張りの間隔と、湧くたびに払う体のマナ（全部か無しか）で決まる。
  // 竜から離れる距離は、以前は25マス。マナの濃い暗がりは竜の寝床のある深部に集まるので、25マスでは、かしたれ・seed40・seed41 で湧ける場所がほぼ無くなり、
  // 16シード×25日の10日目以降に0匹だった時間の多くがそれだった
  {
    k: Kind.Basilisk, side: 'mana', tier: 2, every: 50, phase: 13, cool: 0, minDay: 0,
    site: (e) =>
      manaSite(e, (k, mn, bigs) => {
        if (mn < BASILISK_MANA || !darkDeep(e, k)) return false;
        const m = e.w.map;
        // 人の気配は0.3未満なら湧く（以前は0.15。冒険者の通り道から離れすぎて、16シード×25日で冒険者と出会ったのは9シードだけだった）
        if (e.presenceAt((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8) >= 0.3) return false;
        return !near(e, bigs, k, Kind.Basilisk, 30) && !near(e, bigs, k, Kind.Troll, 12) && !near(e, bigs, k, Kind.Dragon, 12);
      }),
    band: () => 1,
    body: 60, food: 30, mana: 240, nutrR: 3, manaR: 3, manaAll: true,
    log: `濃いマナの暗がりから、{k:${Kind.Basilisk}}が湧いた`,
  },
  // トロール：マナが濃く（18〜。以前は40）、暗い所。ほかのトロール（25マス）・バジリスク（12マス）・竜（25マス）のそばには湧かない。
  // 4日目より前は湧かない（しきい値を決め直したら、序盤のマナでも届き、main より4日ほど早く現れたので、main の初めて現れる日に合わせる）
  {
    k: Kind.Troll, side: 'mana', tier: 2, every: 50, phase: 13, cool: 0, minDay: 4,
    cap: () => 2,
    site: (e) => manaSite(e, (k, mn, bigs) => mn >= 18 && darkDeep(e, k) && !near(e, bigs, k, Kind.Troll, 25) && !near(e, bigs, k, Kind.Basilisk, 12) && !near(e, bigs, k, Kind.Dragon, 25)),
    band: () => 1,
    body: 150, food: 40, mana: 160, nutrR: 3, manaR: 3,
    log: `濃いマナの暗がりから、{k:${Kind.Troll}}が湧いた`,
  },
  // ミノタウロス：縄張りは古い呪いの場所で、マナが薄くても、主がいなければ縄張りの中に湧く（2日目以降、前の一頭が湧いてから1日あける）。
  // 縄張りの床から一つ選んで見る（縄張りはせまく、ばらばらに見るだけではめったに当たらない）
  {
    k: Kind.Minotaur, side: 'mana', tier: 3, every: 50, phase: 13, cool: DAY_TICKS_ECO / 2, minDay: 2,
    cap: () => 1,
    site: (e) => {
      const m = e.w.map;
      const lt = e.lairTiles();
      if (!lt.length) return -1;
      const k = lt[ih(e.step, 0, 233) % lt.length];
      if (m.solid[k] || m.sealed[k] || m.lava[k] || e.w.water[k] > 40) return -1;
      if (!e.inLair((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8)) return -1;
      return ih(k, e.step, 232) % 4 === 0 ? k : -1;
    },
    band: () => 1,
    body: 120, food: 60, mana: 200, nutrR: 3, manaR: 3,
    setup: (e, c) => {
      const m = e.w.map;
      c.hx = m.lair.x * TILE + 8;
      c.hy = m.lair.y * TILE + 8;
    },
  },
];
