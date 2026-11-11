/**
 * 魔物の湧き方の表（src/eco/generate.ts の generate が見る）。
 *
 * 勇者のくせになまいきだ シリーズの構造に寄せて、野の魔物はダンジョンの中の資源（土の養分とマナ）から湧く。
 * 一行が一つの種の湧き方：どちらの資源から（side）、どの段か（tier）、いつ判定するか（every・phase・cool・minDay）、
 * 湧ける条件（ok・cap・chance）、どこに（site）、何匹（band）、体と胃とマナの量（body・food・mana。体と胃はすべて土の養分から取る）。
 * 種を足すときは、ここに一行足す。湧くかどうかは、資源の量と場所の条件（食べ物があるか）で決まる。
 */
import { Burrow, Colony, Cr, DAY_TICKS_ECO, Ecology, Kind, SPEC, ih } from '../ecology';
import { TILE } from '../mapgen';

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
  /** ダンジョン全体の上限 */
  cap(e: Ecology): number;
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
  /** マナ側：場所のまわりのマナ（manaAround）がこれ以上でないと湧かない */
  manaNeed?: number;
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
}

/** 種 kind が、マス k から R マスの内（縦と横の和）にいるか */
function near(e: Ecology, k: number, kind: Kind, R: number): boolean {
  const W = e.w.map.w;
  return e.list.some((c) => c.k === kind && !c.dead && Math.abs(c.x / TILE - (k % W)) + Math.abs(c.y / TILE - Math.floor(k / W)) < R);
}

/**
 * マナから湧く大物の場所：開いた床を40か所見て（どの種も同じ順に見る）、まわりのマナが2以上で want を満たし、
 * 4つに1つのくじに当たった最初のマス（以前の manaBirths と同じ見方と同じくじ）
 */
function manaSite(e: Ecology, want: (k: number, mn: number) => boolean): number {
  const m = e.w.map;
  for (let i = 0; i < 40; i++) {
    const k = ih(e.step, i, 230) % (m.w * m.h);
    if (m.solid[k] || m.sealed[k] || m.lava[k] || e.w.water[k] > 40) continue;
    const mn = e.manaAround(k);
    if (mn < 2 || !want(k, mn)) continue;
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

/** 大グモの湧く場所：開いた床を60か所見て、上下左右に岩があり（巣を張れる壁ぎわ）、8マスの内に飛ぶ獲物（ウィスプかコウモリ）がいる最初のマス */
function spiderSite(e: Ecology): number {
  const m = e.w.map;
  const fly = e.list.filter((c) => (c.k === Kind.Wisp || c.k === Kind.Bat) && !c.dead && !c.away);
  if (!fly.length) return -1;
  for (let i = 0; i < 60; i++) {
    const k = ih(e.step, i, 817) % (m.w * m.h);
    if (!openDry(e, k)) continue;
    if (!(m.solid[k + 1] || m.solid[k - 1] || m.solid[k + m.w] || m.solid[k - m.w])) continue;
    const x = tileX(e, k);
    const y = tileY(e, k);
    if (fly.some((o) => (o.x - x) ** 2 + (o.y - y) ** 2 < (8 * TILE) ** 2)) return k;
  }
  return -1;
}

export const SPAWN_DEFS: SpawnDef[] = [
  // ---- 土の養分から湧く種（以前は外から来ていた） ----
  // コウモリ：夕暮れに、まわり（±10マス）に苔の豊かな縦穴のねぐらへ、2匹ずつ湧く（ねぐらごとに20匹まで）。生き物の更新ごとには見ず、
  // 夕暮れの出来事（src/eco/salamander.ts の onDayEvents）から、縦穴ごとに generateOne で呼ぶ。土ぼこりは出さない（天井のねぐらに現れる）
  {
    k: Kind.Bat, side: 'nutr', tier: 1, every: 0, phase: 0, cool: 0, minDay: 0,
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
      e.rumors.dragon += 0.6;
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
  // バジリスク：マナがとても濃く（30〜。以前は60）、暗く、人の気配の薄い所。ほかのバジリスク（30マス）・トロール（12マス）・竜（25マス）のそばには湧かない
  {
    k: Kind.Basilisk, side: 'mana', tier: 2, every: 50, phase: 13, cool: 0, minDay: 0,
    cap: () => 2,
    site: (e) =>
      manaSite(e, (k, mn) => {
        if (mn < 30 || !darkDeep(e, k)) return false;
        const m = e.w.map;
        if (e.presenceAt((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8) >= 0.15) return false;
        return !near(e, k, Kind.Basilisk, 30) && !near(e, k, Kind.Troll, 12) && !near(e, k, Kind.Dragon, 25);
      }),
    band: () => 1,
    body: 60, food: 30, mana: 240, nutrR: 3, manaR: 3,
    log: `濃いマナの暗がりから、{k:${Kind.Basilisk}}が湧いた`,
  },
  // トロール：マナが濃く（18〜。以前は40）、暗い所。ほかのトロール（25マス）・バジリスク（12マス）・竜（25マス）のそばには湧かない
  {
    k: Kind.Troll, side: 'mana', tier: 2, every: 50, phase: 13, cool: 0, minDay: 0,
    cap: () => 2,
    site: (e) => manaSite(e, (k, mn) => mn >= 18 && darkDeep(e, k) && !near(e, k, Kind.Troll, 25) && !near(e, k, Kind.Basilisk, 12) && !near(e, k, Kind.Dragon, 25)),
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
