/**
 * 魔物の湧き方の表（src/eco/generate.ts の generate が見る）。
 *
 * 勇者のくせになまいきだ シリーズの構造に寄せて、野の魔物はダンジョンの中の資源（土の養分とマナ）から湧く。
 * 一行が一つの種の湧き方：どちらの資源から（side）、どの段か（tier）、いつ判定するか（every・phase・cool・minDay）、
 * 湧ける条件（ok・cap・chance）、どこに（site）、何匹（band）、体と胃とマナの量（body・food・mana。体と胃はすべて土の養分から取る）。
 * 種を足すときは、ここに一行足す。湧くかどうかは、資源の量と場所の条件（食べ物があるか）で決まる。
 */
import { Cr, DAY_TICKS_ECO, Ecology, Kind, SPEC, ih } from '../ecology';
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

export const SPAWN_DEFS: SpawnDef[] = [
  // ドラゴンの幼子：ダンジョンにドラゴンがいなければ、6日目以降、深部のまわり（20マス）でいちばんマナの濃い所が70以上なら、卵が孵る（通常速度で1分ごとに見る）
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
      return bk >= 0 && bv >= 70 ? bk : -1;
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
  // バジリスク：マナがとても濃く（60〜）、暗く、人の気配の薄い所。ほかのバジリスク（30マス）・トロール（12マス）・竜（25マス）のそばには湧かない
  {
    k: Kind.Basilisk, side: 'mana', tier: 2, every: 50, phase: 13, cool: 0, minDay: 0,
    cap: () => 2,
    site: (e) =>
      manaSite(e, (k, mn) => {
        if (mn < 60 || !darkDeep(e, k)) return false;
        const m = e.w.map;
        if (e.presenceAt((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8) >= 0.15) return false;
        return !near(e, k, Kind.Basilisk, 30) && !near(e, k, Kind.Troll, 12) && !near(e, k, Kind.Dragon, 25);
      }),
    band: () => 1,
    body: 60, food: 30, mana: 240, nutrR: 3, manaR: 3,
    log: `濃いマナの暗がりから、{k:${Kind.Basilisk}}が湧いた`,
  },
  // トロール：マナが濃く（40〜）、暗い所。ほかのトロール（25マス）・バジリスク（12マス）・竜（25マス）のそばには湧かない
  {
    k: Kind.Troll, side: 'mana', tier: 2, every: 50, phase: 13, cool: 0, minDay: 0,
    cap: () => 2,
    site: (e) => manaSite(e, (k, mn) => mn >= 40 && darkDeep(e, k) && !near(e, k, Kind.Troll, 25) && !near(e, k, Kind.Basilisk, 12) && !near(e, k, Kind.Dragon, 25)),
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
