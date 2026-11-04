/**
 * いくつかの batch の結果を、コボルトと大ネズミの目安で並べる（住みつける仕組みのチェック用）。
 *
 *   npm run compare -- --runs runs/batch-a,runs/batch-b --names "前,後" --out runs/compare.md
 *   npm run compare -- --runs ... --seeds "abc,かしたれ"     一部のシードだけ
 *   npm run compare -- --runs runs/ab-x/base,runs/ab-x/new --paired --since 10
 *       10日目より後のログだけで比べ、シードごとの差の分布と、差がばらつきに埋もれていないかの目安の表を先頭に付ける（ab が使う）
 *
 * 各 batch のシードごとに：にぎわい（同時にいるモンスターの種の数とその内訳）、関わり（どの種がどの種に何をしたかの組み合わせの数とその内訳）、ゴブリンの集落（続いた日数、終わり方、冒険者・コボルトとの殺し合い）、コボルトの住処が続いた日数（中央値、ゲーム内の1/4日ごとのサンプルから）、冒険者に倒されたコボルト、
 * ドラゴンに焼かれたコボルト、コボルトの去り方（starving 一匹ずつ飢えて / abandoned 住処ごと）、大ネズミの飢え死に、
 * 大ネズミの来た数と去り方（dispersed）、大ネズミが最後に生きているか、四つの保存則のずれ
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs, KIND_NAMES, countsAsStuck } from './common';
import { DAY_TICKS } from '../../src/world';
import { generate } from '../../src/mapgen';
import { paired, pairedRow, PAIRED_HEAD, PAIRED_NOTE } from './lib/stats';
import { MOMENTS, countMoments, momentTable } from './lib/moments';

const args = parseArgs(process.argv.slice(2));
const runs = (args.runs || '').split(',').filter(Boolean);
const names = (args.names || runs.join(',')).split(',');
/** --since 日：その日より後のログだけを使う（同じスナップショットから続けた二つを比べるとき、分岐する前の共通の部分を除く） */
const sinceT = args.since ? +args.since * DAY_TICKS : -1;
const rd = (dir: string, f: string) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !(typeof r.t === 'number' && r.t <= sinceT && !(f === 'samples.jsonl' && r.t === sinceT))) : []);
const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const f1 = (v: number) => (isFinite(v) ? v.toFixed(1) : '—');

interface M { seed: string; warrens: number; dur: number[]; ended: number[]; advKob: number; fireKob: number; kobStarveExit: number; kobAbandon: number; kobStarveDeath: number; kobArr: number; kobBorn: number; kobLast: number; kobMed: number; ratStarve: number; ratArr: number; ratBorn: number; ratDisp: number; ratLast: number; ratMax: number; ratGone: boolean; drift: number; ratMoves: number; rich: number; ratNear: number; ratNearKnown: number; endFood: number; endAlone: number; endRaid: number; endDragon: number; gobArr: number; orcArr: number; camps: number; campDur: number[]; gobBorn: number; gobMax: number; gobLast: number; gobGone: boolean; gobEnd: Record<string, number>; gobAdv: number; gobByKob: number; kobByGob: number; advDeaths: number; gobStarveExit: number; gobAbandonExit: number; gobStarveDeath: number; gobByOrc: number; gobByOther: number; vassals: number; tributes: number; tributeFood: number; lairDur: number[]; ratShaftArr: number; ratMouthArr: number; ratStarveShaft: number; orcStarveExit: number; storeMean: number; storeMax: number; storePos: number; storeKnown: boolean; ratReenter: number; ratZero: number; splitDur: number[]; splitStore: number; stuck: number; stuckNoPath: number; stuckAdv: number; unbury: number; mo: Record<string, number>; kindsMean: number; kindsMin: number; kindShare: number[]; links: Map<string, number> }
/** にぎわいで数えない種：冒険者とドワーフ（人の側。来訪の多さに数字が引っ張られないよう、モンスターと分ける） */
const NOT_MONSTER = new Set([25, 28]);
const MONSTER_KINDS = KIND_NAMES.map((_, k) => k).filter((k) => !NOT_MONSTER.has(k));
/**
 * にぎわい：ダンジョンに同時に何種類のモンスターがいるか。5日目以降のゲーム内の1/4日ごとのサンプル（samples.jsonl の種ごとの数）で、
 * 1匹以上いる種を数え、その平均と最小を出す。あわせて、種ごとに「いたサンプルの割合（％）」を出す（どの種が消えやすいかの内訳）
 */
function nigiwai(S: any[]): { kindsMean: number; kindsMin: number; kindShare: number[] } {
  const v = S.filter((x) => x.day >= 5 && x.counts);
  const share = KIND_NAMES.map(() => 0);
  if (!v.length) return { kindsMean: NaN, kindsMin: NaN, kindShare: share.map(() => NaN) };
  const n = v.map((x) => MONSTER_KINDS.filter((k) => (x.counts[k] ?? 0) > 0).length);
  for (const x of v) for (const k of MONSTER_KINDS) if ((x.counts[k] ?? 0) > 0) share[k]++;
  return { kindsMean: n.reduce((a, b) => a + b, 0) / n.length, kindsMin: Math.min(...n), kindShare: share.map((c, k) => (NOT_MONSTER.has(k) ? NaN : (100 * c) / v.length)) };
}

/** 関わりの種類（組み合わせの名前の後ろに付ける）。命のやりとりは「倒した」だけ、残りは命を取らない関わり */
const KILL = '倒した';
/**
 * 関わり：どの種がどの種に何をしたかの組み合わせ（向きあり、同じ種どうしは除く）を、範囲内のログから集めて回数を数える。
 * 数えるのは、画面で結果が見えた関わりだけ：誰かが倒れる、物が移る、寝ている一行が起こされる・打たれる。
 * 試みの始まり（夜に忍び寄る raid、通路でつける stalk、待ち伏せにつく ambush）と、避ける・退く・逃げる（オークがにらんで退く bluff など）は数えない。
 * 命のやりとりは deaths.jsonl の「手を下した種 → 倒れた種」（死因は分けない）。命を取らない関わりは settle.jsonl から：
 * ゴブリンが冒険者から盗んだ（rob）、オークがゴブリンの集落から取り立てた・従えた、焚き火で眠る一行に夜襲した
 * （寝込みを打った種、起こされたときの相手の種）、大ネズミが冒険者の物資の置き場をあさった
 */
function links(D: any[], SE: any[]): Map<string, number> {
  const L = new Map<string, number>();
  const add = (a: number, b: number, rel: string) => {
    if (a < 0 || b < 0 || a === b) return;
    const key = `${a}>${b}>${rel}`;
    L.set(key, (L.get(key) ?? 0) + 1);
  };
  for (const d of D) add(d.by ?? -1, d.k, KILL);
  for (const x of SE) {
    if (x.k === 12 && x.ev === 'rob') add(12, 25, '盗んだ');
    else if ((x.k === 13 && x.ev === 'tribute') || (x.k === 12 && x.ev === 'vassal')) add(13, 12, '取り立てた・従えた');
    else if (x.k === 25 && (x.ev === 'nightHit' || x.ev === 'wake')) add(x.n ?? -1, 25, '夜襲した');
    else if (x.k === 2 && x.ev === 'cache') add(2, 25, 'あさった');
  }
  return L;
}
/** 関わりの組み合わせの数（kill：true 命のやりとりだけ / false 命を取らないものだけ / undefined 全部。min：その回数以上起きたものだけ） */
const linkCount = (m: M, kill?: boolean, min = 1) => [...m.links].filter(([key, n]) => n >= min && (kill === undefined || key.endsWith(`>${KILL}`) === kill)).length;
const linkName = (key: string) => {
  const [a, b, rel] = key.split('>');
  return `${KIND_NAMES[+a]}→${KIND_NAMES[+b]}：${rel}`;
};

/**
 * 内訳の印：最初と最後の実行結果で、その種がいた（その関わりが起きた）シードの数が大きく変わったか。
 * にぎわいの平均は、もともとまれな種が1種消えても、シードごとのばらつきに埋もれて「はっきり」にならない（大トカゲが来なくなる実験で確かめた）。
 * それを補うため、シードの数が「3以上かつ元の半分以上」減った、または3シード以上から0になったものに「⚠ 減」を付ける（増えたほうも同じ条件で「✚ 増」）。
 * 2シードほどの出入りは、展開のばらつきでも珍しい組み合わせによく起きるので数えない
 */
function seedShift(a: number, b: number): string {
  if ((a - b >= 3 && a - b >= a / 2) || (a >= 3 && b === 0)) return '⚠ 減';
  if ((b - a >= 3 && b - a >= b / 2) || (b >= 3 && a === 0)) return '✚ 増';
  return '';
}
/** 種がいたシードの数（一度でもいれば） */
const kindSeeds = (ms: M[], k: number) => ms.filter((m) => m.kindShare[k] > 0).length;
/** 関わりの組み合わせが起きたシードの数 */
const linkSeeds = (ms: M[], key: string) => ms.filter((m) => m.links.has(key)).length;

function measure(dir: string): M {
  const S = rd(dir, 'samples.jsonl');
  const D = rd(dir, 'deaths.jsonl');
  const B = rd(dir, 'births.jsonl');
  const X = rd(dir, 'exits.jsonl');
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const MV = rd(dir, 'moves.jsonl');
  const EV = rd(dir, 'events.jsonl').map((e) => String(e.m));
  const evc = (re: RegExp) => EV.filter((m) => re.test(m)).length;
  const first = new Map<number, number>();
  const last = new Map<number, number>();
  for (const s of S) for (const id of s.settle?.warren ?? []) {
    if (!first.has(id)) first.set(id, s.day);
    last.set(id, s.day);
  }
  const dur = [...first].map(([id, d]) => (last.get(id) as number) - d + 0.25);
  // 最後のサンプルまで残っていた住処は打ち切り。終わった住処だけの日数も見る
  const endDay = S.length ? S[S.length - 1].day : 0;
  const ended = [...first].filter(([id]) => (last.get(id) as number) < endDay).map(([id, d]) => (last.get(id) as number) - d + 0.25);
  const cnt = (a: { k: number }[], k: number, f: (x: any) => boolean = () => true) => a.filter((x) => x.k === k && f(x)).length;
  const ser = (k: number) => S.map((s) => s.counts[k] ?? 0);
  const rs = ser(2);
  let drift = 0;
  for (const s of S) drift = Math.max(drift, Math.abs(s.nutrientDrift), Math.abs(s.goldDrift), Math.abs(s.rockDrift), Math.abs(s.manaDrift ?? 0));
  return {
    seed: meta.seed, warrens: first.size, dur, ended,
    advKob: cnt(D, 10, (d) => d.by === 25), fireKob: cnt(D, 10, (d) => d.by === 24 && d.cause === 'burned'),
    kobStarveExit: cnt(X, 10, (x) => x.reason === 'starving'), kobAbandon: cnt(X, 10, (x) => x.reason === 'abandoned'), kobStarveDeath: cnt(D, 10, (d) => d.cause === 'starve'),
    kobArr: cnt(B, 10, (b) => b.origin !== 'born'), kobBorn: cnt(B, 10, (b) => b.origin === 'born'), kobLast: ser(10)[S.length - 1] ?? 0, kobMed: median(ser(10)),
    ratStarve: cnt(D, 2, (d) => d.cause === 'starve'), ratArr: cnt(B, 2, (b) => b.origin !== 'born'), ratBorn: cnt(B, 2, (b) => b.origin === 'born'), ratDisp: cnt(X, 2, (x) => x.reason === 'dispersed'),
    ratLast: rs[rs.length - 1] ?? 0, ratMax: Math.max(0, ...rs), ratGone: (rs[rs.length - 1] ?? 0) === 0 && (rs[rs.length - 2] ?? 0) === 0, drift,
    ratMoves: MV.filter((x) => x.k === 2).length,
    ...nigiwai(S),
    links: links(D, rd(dir, 'settle.jsonl')),
    // シードの豊かさ：5日目以降のサンプルの平均（口が開いていないサンプルは除く）
    rich: (() => { const v = S.filter((x) => x.day >= 5 && typeof x.rich === 'number').map((x) => x.rich as number); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : NaN; })(),
    // 飢え死にした大ネズミのうち、道のり10マス以内に食べられる苔があった数（ログに near があるものだけ）
    ratNear: D.filter((d) => d.k === 2 && d.cause === 'starve' && typeof d.near === 'number' && d.near >= 0 && d.near < 10).length,
    ratNearKnown: D.filter((d) => d.k === 2 && d.cause === 'starve' && typeof d.near === 'number').length,
    // 住処の終わり方：settle.jsonl（構造化したログ）があればそれを、なければゲーム内ログの文章から数える（古い実行結果のため）
    ...(existsSync(join(dir, 'settle.jsonl'))
      ? (() => {
          const SE = rd(dir, 'settle.jsonl').filter((x) => x.k === 10 && x.ev === 'abandon');
          const r = (why: string) => SE.filter((x) => x.reason === why).length;
          return { endFood: r('food'), endAlone: r('alone'), endRaid: r('raids'), endDragon: r('dragon') };
        })()
      : { endFood: evc(/^\{k:10\}の一団が蓄えが尽きて/), endAlone: evc(/^\{k:10\}の一団が(数が減って|1匹になって)/), endRaid: evc(/^\{k:10\}の一団が何度も襲われて/), endDragon: evc(/^\{k:10\}の一団が竜を恐れて/) }),
    gobArr: cnt(B, 12, (b) => b.origin !== 'born'), orcArr: cnt(B, 13, (b) => b.origin !== 'born'),
    // ゴブリンの集落（ゲーム内の1/4日ごとのサンプルの settle.camp から。コボルトの住処と同じ数え方）
    ...(() => {
      const f = new Map<number, number>();
      const l = new Map<number, number>();
      for (const s of S) for (const id of s.settle?.camp ?? []) {
        if (!f.has(id)) f.set(id, s.day);
        l.set(id, s.day);
      }
      const gs = ser(12);
      const SE = rd(dir, 'settle.jsonl').filter((x) => x.k === 12 && x.ev !== 'found');
      const gobEnd: Record<string, number> = {};
      for (const x of SE) {
        const r = x.ev === 'empty' ? 'empty' : x.reason;
        gobEnd[r] = (gobEnd[r] ?? 0) + 1;
      }
      return {
        camps: f.size, campDur: [...f].map(([id, d]) => (l.get(id) as number) - d + 0.25),
        gobBorn: cnt(B, 12, (b) => b.origin === 'born'), gobMax: Math.max(0, ...gs), gobLast: gs[gs.length - 1] ?? 0,
        gobGone: Math.max(0, ...gs) > 0 && (gs[gs.length - 1] ?? 0) === 0 && (gs[gs.length - 2] ?? 0) === 0,
        gobEnd, gobAdv: cnt(D, 12, (d) => d.by === 25), gobByKob: cnt(D, 12, (d) => d.by === 10), kobByGob: cnt(D, 10, (d) => d.by === 12),
        gobByOrc: cnt(D, 12, (d) => d.by === 13), gobByOther: cnt(D, 12, (d) => d.by >= 0 && d.by !== 25 && d.by !== 13 && d.by !== 10 && d.cause !== 'starve'),
        vassals: rd(dir, 'settle.jsonl').filter((x) => x.k === 12 && x.ev === 'vassal').length,
        tributes: rd(dir, 'settle.jsonl').filter((x) => x.k === 13 && x.ev === 'tribute').length,
        tributeFood: rd(dir, 'settle.jsonl').filter((x) => x.k === 13 && x.ev === 'tribute').reduce((a, x) => a + (x.n ?? 0), 0),
        lairDur: (() => {
          const f = new Map<string, number>();
          const l = new Map<string, number>();
          for (const s of S) for (const id of s.settle?.orc ?? []) {
            if (!f.has(id)) f.set(id, s.day);
            l.set(id, s.day);
          }
          return [...f].map(([id, d]) => (l.get(id) as number) - d + 0.25);
        })(),
        ratShaftArr: cnt(B, 2, (b) => b.origin === 'shaft'), ratMouthArr: cnt(B, 2, (b) => b.origin === 'mouth'),
        // 天井の裂け目から15マス以内での大ネズミの飢え死に（裂け目の場所は生成したマップから）
        ratStarveShaft: (() => {
          const m = generate(meta.seed);
          const sh = m.shafts.map((q) => [q.x * 16 + 8, q.y * 16 + 8]);
          return D.filter((d) => d.k === 2 && d.cause === 'starve' && sh.some(([x, y]) => Math.hypot(x - d.x, y - d.y) < 15 * 16)).length;
        })(),
        orcStarveExit: cnt(X, 13, (x) => x.reason === 'starving'),
        // 七巡目：大ネズミの入り直し（地表の横穴が開いたあと、天井の割れ目から）、分かれてできた集落の続いた日数と、分けて持たせた蓄え
        ratReenter: rd(dir, 'settle.jsonl').filter((x) => x.k === 2 && x.ev === 'reenter').length,
        // 5日目より後のゲーム内の1/4日ごとのサンプルのうち、大ネズミが0匹だったサンプルの数
        ratZero: S.filter((x) => x.day > 5 && (x.counts[2] ?? 0) === 0).length,
        splitDur: (() => {
          const ids = new Set(rd(dir, 'settle.jsonl').filter((x) => x.k === 12 && x.ev === 'found' && x.how === 'split').map((x) => x.id));
          return [...f].filter(([id]) => ids.has(id)).map(([id, d]) => (l.get(id) as number) - d + 0.25);
        })(),
        splitStore: rd(dir, 'settle.jsonl').filter((x) => x.k === 12 && x.ev === 'found' && x.how === 'split').reduce((a, x) => a + (x.store ?? 0), 0),
        // 集落の蓄えの推移（samples の settle.campStore。六巡目から）：集落のあったサンプルでの蓄えの合計の平均・最大と、蓄えが0でなかったサンプルの割合
        ...(() => {
          const v = S.filter((x) => (x.settle?.campStore ?? []).length).map((x) => (x.settle.campStore as number[]).reduce((a, b) => a + b, 0));
          return { storeKnown: S.some((x) => x.settle?.campStore), storeMean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, storeMax: Math.max(0, ...v), storePos: v.length ? (100 * v.filter((x) => x > 0).length) / v.length : 0 };
        })(),
        // 足踏み（sim.ts の stuck.jsonl）：起きて歩く姿のまま2分以上ほぼ同じ場所にいた回数、そのうち道が見つからないまま（壁に押しつけて）、冒険者。
        // その場で漂う種と、巣に捕まってもがいていた者は数えない（common.ts の countsAsStuck）
        ...(() => {
          const T = rd(dir, 'stuck.jsonl').filter(countsAsStuck);
          // 壁や瓦礫に埋まっていて、安全策で床へ出た回数（settle.jsonl の unbury）
          const U = rd(dir, 'settle.jsonl').filter((x) => x.ev === 'unbury').length;
          return { stuck: T.length, stuckNoPath: T.filter((x) => x.nopath >= 0.5).length, stuckAdv: T.filter((x) => x.k === 25).length, unbury: U };
        })(),
        // 見せたい瞬間の回数（lib/moments.ts）
        mo: countMoments(dir, sinceT),
        advDeaths: cnt(D, 25), gobStarveExit: cnt(X, 12, (x) => x.reason === 'starving'), gobAbandonExit: cnt(X, 12, (x) => x.reason === 'abandoned'), gobStarveDeath: cnt(D, 12, (d) => d.cause === 'starve'),
      };
    })(),
  };
}

// --seeds "abc,seed4" で一部のシードだけを比べる（16シードのうち、前回までの8シードだけを見るときなど）
const only = args.seeds ? new Set(args.seeds.split(',')) : null;
const all = runs.map((r) => readdirSync(r).filter((d) => /^\d\d-/.test(d)).sort().map((d) => measure(join(r, d))).filter((m) => !only || only.has(m.seed)));
const L: string[] = [];
const seeds = all[0].map((m) => m.seed);
const tbl = (title: string, f: (m: M) => string | number, total?: (ms: M[]) => string | number) => {
  L.push(`### ${title}`, '', `| シード | ${names.join(' | ')} |`, `|---|${names.map(() => '---:').join('|')}|`);
  for (let i = 0; i < seeds.length; i++) L.push(`| ${seeds[i]} | ${all.map((ms) => (ms[i] ? f(ms[i]) : '—')).join(' | ')} |`);
  if (total) L.push(`| **${seeds.length}シード** | ${all.map((ms) => `**${total(ms)}**`).join(' | ')} |`);
  L.push('');
};
const sum = (ms: M[], f: (m: M) => number) => ms.reduce((a, m) => a + f(m), 0);

/**
 * 目安（--goals goals.json）：[{ "label": "住処の日数の中央値", "metric": "warrenMedian", "op": ">=", "value": 5 }, ...]
 * metric は下の METRICS の名前（8シードまとめた値）。目安に届いたかどうかを表にする
 */
const halves = (ms: M[]): [M[], M[]] => {
  const o = [...ms].sort((a, b) => (isFinite(b.rich) ? b.rich : -1) - (isFinite(a.rich) ? a.rich : -1));
  return [o.slice(0, Math.ceil(o.length / 2)), o.slice(Math.ceil(o.length / 2))];
};
const METRICS: Record<string, (ms: M[]) => number> = {
  warrenMedian: (ms) => median(ms.flatMap((m) => m.dur)),
  warrenSeedMedian: (ms) => median(ms.filter((m) => m.dur.length).map((m) => median(m.dur))),
  warrenShare5: (ms) => (100 * sum(ms, (m) => m.dur.filter((d) => d >= 5).length)) / Math.max(1, sum(ms, (m) => m.warrens)),
  warrens: (ms) => sum(ms, (m) => m.warrens),
  advKob: (ms) => sum(ms, (m) => m.advKob),
  fireKob: (ms) => sum(ms, (m) => m.fireKob),
  kobStarveExit: (ms) => sum(ms, (m) => m.kobStarveExit),
  kobAbandon: (ms) => sum(ms, (m) => m.kobAbandon),
  kobStarveDeath: (ms) => sum(ms, (m) => m.kobStarveDeath),
  kobArr: (ms) => sum(ms, (m) => m.kobArr),
  kobBorn: (ms) => sum(ms, (m) => m.kobBorn),
  endFood: (ms) => sum(ms, (m) => m.endFood),
  endAlone: (ms) => sum(ms, (m) => m.endAlone),
  endRaid: (ms) => sum(ms, (m) => m.endRaid),
  ratStarve: (ms) => sum(ms, (m) => m.ratStarve),
  ratArr: (ms) => sum(ms, (m) => m.ratArr),
  ratBorn: (ms) => sum(ms, (m) => m.ratBorn),
  ratDisp: (ms) => sum(ms, (m) => m.ratDisp),
  ratMoves: (ms) => sum(ms, (m) => m.ratMoves),
  ratNearShare: (ms) => (100 * sum(ms, (m) => m.ratNear)) / Math.max(1, sum(ms, (m) => m.ratNearKnown)),
  ratGoneSeeds: (ms) => ms.filter((m) => m.ratGone).length,
  gobArr: (ms) => sum(ms, (m) => m.gobArr),
  orcArr: (ms) => sum(ms, (m) => m.orcArr),
  drift: (ms) => Math.max(0, ...ms.map((m) => m.drift)),
  campMedian: (ms) => median(ms.flatMap((m) => m.campDur)),
  campShare5: (ms) => (100 * sum(ms, (m) => m.campDur.filter((d) => d >= 5).length)) / Math.max(1, sum(ms, (m) => m.camps)),
  richCampMedian: (ms) => median(halves(ms)[0].flatMap((m) => m.campDur)),
  camps: (ms) => sum(ms, (m) => m.camps),
  gobBorn: (ms) => sum(ms, (m) => m.gobBorn),
  gobGoneSeeds: (ms) => ms.filter((m) => m.gobGone).length,
  gobAdv: (ms) => sum(ms, (m) => m.gobAdv),
  gobByKob: (ms) => sum(ms, (m) => m.gobByKob),
  kobByGob: (ms) => sum(ms, (m) => m.kobByGob),
  advDeaths: (ms) => sum(ms, (m) => m.advDeaths),
  tributes: (ms) => sum(ms, (m) => m.tributes),
  ratStarveShaft: (ms) => sum(ms, (m) => m.ratStarveShaft),
  ratReenter: (ms) => sum(ms, (m) => m.ratReenter),
  ratZeroDays: (ms) => sum(ms, (m) => m.ratZero) / 4,
  ratStarveAll: (ms) => sum(ms, (m) => m.ratStarve),
  orcStarveExit: (ms) => sum(ms, (m) => m.orcStarveExit),
  lairMedian: (ms) => median(ms.flatMap((m) => m.lairDur)),
  tributeFood: (ms) => sum(ms, (m) => m.tributeFood),
  tributeMean: (ms) => sum(ms, (m) => m.tributeFood) / Math.max(1, sum(ms, (m) => m.tributes)),
  vassals: (ms) => sum(ms, (m) => m.vassals),
  splitCamps: (ms) => sum(ms, (m) => m.splitDur.length),
  splitMedian: (ms) => median(ms.flatMap((m) => m.splitDur)),
  gobStarveDeath: (ms) => sum(ms, (m) => m.gobStarveDeath),
  gobByOrc: (ms) => sum(ms, (m) => m.gobByOrc),
  gobByOther: (ms) => sum(ms, (m) => m.gobByOther),
  // 豊かさで上半分（豊かなシード）と下半分（乏しいシード）に分けた目安
  richWarrenMedian: (ms) => median(halves(ms)[0].flatMap((m) => m.dur)),
  poorKobArr: (ms) => sum(halves(ms)[1], (m) => m.kobArr),
  poorEndFood: (ms) => sum(halves(ms)[1], (m) => m.endFood),
  kindsMean: (ms) => median(ms.map((m) => m.kindsMean).filter(isFinite)),
  kindsMin: (ms) => Math.min(...ms.map((m) => m.kindsMin).filter(isFinite)),
  links: (ms) => median(ms.map((m) => linkCount(m))),
  links2: (ms) => median(ms.map((m) => linkCount(m, undefined, 2))),
};
// A/B 比較（最初の実行結果と最後の実行結果の、同じシード同士の差）
if (args.paired && all.length >= 2) {
  const A = all[0];
  const Bm = all[all.length - 1];
  const md = (a: number[]) => (a.length ? median(a) : NaN);
  const P: [string, (m: M) => number][] = [
    ['にぎわい：同時にいるモンスターの種の数（平均）', (m) => m.kindsMean], ['にぎわい：同時にいるモンスターの種の数（最小）', (m) => m.kindsMin],
    ['関わり：起きた組み合わせの数', (m) => linkCount(m)], ['関わり：そのうち2回以上起きたもの', (m) => linkCount(m, undefined, 2)],
    ['関わり：命のやりとりの組み合わせ', (m) => linkCount(m, true)], ['関わり：命のやりとりで2回以上', (m) => linkCount(m, true, 2)],
    ['関わり：命を取らない組み合わせ', (m) => linkCount(m, false)], ['関わり：命を取らないもので2回以上', (m) => linkCount(m, false, 2)],
    ['大ネズミ：飢え死に', (m) => m.ratStarve], ['大ネズミ：来た', (m) => m.ratArr], ['大ネズミ：中で生まれた', (m) => m.ratBorn], ['大ネズミ：群れで出ていった', (m) => m.ratDisp], ['大ネズミ：巣穴の引っ越し', (m) => m.ratMoves], ['大ネズミ：最後の数', (m) => m.ratLast],
    ['コボルト：来た', (m) => m.kobArr], ['コボルト：中で生まれた', (m) => m.kobBorn], ['コボルト：住処の数', (m) => m.warrens], ['コボルト：住処の日数の中央値', (m) => md(m.dur)], ['コボルト：飢え死に', (m) => m.kobStarveDeath], ['コボルト：一匹ずつ飢えて去った', (m) => m.kobStarveExit], ['コボルト：冒険者に倒された', (m) => m.advKob], ['コボルト：最後の数', (m) => m.kobLast],
    ['ゴブリン：来た', (m) => m.gobArr], ['ゴブリン：中で生まれた', (m) => m.gobBorn], ['ゴブリン：集落の数', (m) => m.camps], ['ゴブリン：集落の日数の中央値', (m) => md(m.campDur)], ['ゴブリン：最後の数', (m) => m.gobLast], ['ゴブリン：飢え死に', (m) => m.gobStarveDeath], ['ゴブリン：冒険者に倒された', (m) => m.gobAdv],
    ['ゴブリン：集落の蓄えの平均', (m) => (m.storeKnown ? m.storeMean : NaN)], ['ゴブリン：蓄えが0でなかったサンプルの割合（％）', (m) => (m.storeKnown && m.camps ? m.storePos : NaN)],
    ['オーク：来た', (m) => m.orcArr], ['オーク：従えた集落', (m) => m.vassals], ['オーク：取り立て（回）', (m) => m.tributes], ['オーク：取り立てた食べ物', (m) => m.tributeFood], ['オーク：飢えて去った', (m) => m.orcStarveExit],
    ['大ネズミ：入り直し（回）', (m) => m.ratReenter], ['大ネズミ：絶えた（1＝最後の2回のサンプルで0）', (m) => (m.ratGone ? 1 : 0)], ['大ネズミ：0匹だった日数（5日目より後）', (m) => m.ratZero / 4],
    ['オーク：縄張りの日数の中央値', (m) => md(m.lairDur)], ['ゴブリン：5日以上続いた集落の割合（％）', (m) => (m.camps ? (100 * m.campDur.filter((d) => d >= 5).length) / m.camps : NaN)],
    ['ゴブリン：分かれてできた集落', (m) => m.splitDur.length], ['ゴブリン：分かれた集落の日数の中央値', (m) => md(m.splitDur)], ['ゴブリン：絶えた（1）', (m) => (m.gobGone ? 1 : 0)],
    ['ゴブリン：オークに倒された', (m) => m.gobByOrc], ['ゴブリン：コボルト・冒険者・オーク以外に倒された', (m) => m.gobByOther],
    ['足踏み：起きて歩く姿のまま2分以上ほぼ動かない（漂う種と、巣に捕まった者を除く）', (m) => m.stuck], ['足踏み：そのうち道が見つからないまま', (m) => m.stuckNoPath], ['足踏み：冒険者', (m) => m.stuckAdv], ['壁や瓦礫に埋まっていて床へ出た', (m) => m.unbury],
    ['冒険者：死んだ', (m) => m.advDeaths], ['ゴブリンに倒されたコボルト', (m) => m.kobByGob], ['コボルトに倒されたゴブリン', (m) => m.gobByKob],
  ];
  for (const mo of MOMENTS) P.push([`瞬間：${mo.label}`, (m) => m.mo[mo.key] ?? 0]);
  const sd = A.map((m) => m.seed);
  const Bs = sd.map((s) => Bm.find((m) => m.seed === s));
  L.push(`## A/B 比較（同じシード同士）：${names[0]} → ${names[names.length - 1]}（${sd.length} シード${args.since ? `、${args.since}日目より後` : ''}）`, '', PAIRED_NOTE, '', ...PAIRED_HEAD);
  for (const [label, f] of P) {
    const pr = paired(A.map(f), Bs.map((m) => (m ? f(m) : NaN)), sd);
    if (pr.verdict === '差なし' && pr.sumA === 0) continue;
    L.push(pairedRow(label, pr));
  }
  // 内訳の印（seedShift）が付いた種と関わりを、ここにもまとめて出す（表の後ろのほうまで読まなくても気づけるように）
  const flagged: string[] = [];
  for (const k of MONSTER_KINDS) {
    const a = kindSeeds(A, k);
    const b = kindSeeds(Bm, k);
    const f = seedShift(a, b);
    if (f) flagged.push(`- ${f}　にぎわい：${KIND_NAMES[k]}がいたシード ${a} → ${b}`);
  }
  for (const key of [...new Set([...A, ...Bm].flatMap((m) => [...m.links.keys()]))].sort()) {
    const a = linkSeeds(A, key);
    const b = linkSeeds(Bm, key);
    const f = seedShift(a, b);
    if (f) flagged.push(`- ${f}　関わり：「${linkName(key)}」が起きたシード ${a} → ${b}`);
  }
  if (flagged.length) L.push('', '**いた種・起きた関わりのシードの数が大きく変わったもの**（3以上かつ元の半分以上減った・増えた、または3シード以上から0になった・0から3シード以上になった）：', '', ...flagged);
  const dr = Math.max(0, ...Bm.map((m) => m.drift));
  L.push('', `保存則のずれ（${names[names.length - 1]}、最大）：${dr}${dr ? ' ⚠' : ''}`, '');
}
L.push(...momentTable(names, all.map((ms) => ms.map((m) => m.mo))));
if (args.goals) {
  const goals: { label: string; metric: string; op: string; value: number }[] = JSON.parse(readFileSync(args.goals, 'utf8'));
  const ok = (v: number, op: string, x: number) => (op === '>=' ? v >= x : op === '<=' ? v <= x : op === '>' ? v > x : op === '<' ? v < x : v === x);
  L.push('## 目安', '', `| 目安 | ${names.join(' | ')} |`, `|---|${names.map(() => '---:').join('|')}|`);
  for (const g of goals) {
    const f = METRICS[g.metric];
    if (!f) throw new Error(`知らない metric：${g.metric}（使えるもの：${Object.keys(METRICS).join(', ')}）`);
    L.push(`| ${g.label}（${g.op} ${g.value}） | ${all.map((ms) => { const v = f(ms); return `${ok(v, g.op, g.value) ? '✅' : '❌'} ${Number.isInteger(v) ? v : v.toFixed(1)}`; }).join(' | ')} |`);
  }
  L.push('');
}
// シードの豊かさの順（最後に並べた実行結果）
{
  const last = all[all.length - 1];
  if (last.some((m) => isFinite(m.rich))) {
    L.push(`## シードの豊かさの順（${names[names.length - 1]}）`, '', '豊かさ＝開いた地表の横穴から歩いて行ける範囲（道のり100マス）の床1マスあたりの、食べられる苔とキノコ（20以上の群落の、根元12を除いた分）。5日目以降のゲーム内の1/4日ごとのサンプルの平均。', '', '| シード | 豊かさ | 住処の日数の中央値 / 最長 / できた数 | 来たコボルト / 中で生まれた | 終わり方：蓄え / 1匹 / 襲われた / 竜 |', '|---|---:|---:|---:|---:|');
    for (const m of [...last].sort((a, b) => (isFinite(b.rich) ? b.rich : -1) - (isFinite(a.rich) ? a.rich : -1))) L.push(`| ${m.seed} | ${f1(m.rich)} | ${f1(median(m.dur))} / ${f1(Math.max(0, ...m.dur))} / ${m.warrens} | ${m.kobArr} / ${m.kobBorn} | ${m.endFood} / ${m.endAlone} / ${m.endRaid} / ${m.endDragon} |`);
    L.push('');
  }
}
L.push('## にぎわい', '', '同時にいるモンスターの種の数（冒険者・ドワーフを除く。1匹以上いれば数える）。5日目以降のゲーム内の1/4日ごとのサンプルで数える。', '');
tbl('同時にいるモンスターの種の数（平均 / 最小）', (m) => `${f1(m.kindsMean)} / ${isFinite(m.kindsMin) ? m.kindsMin : '—'}`, (ms) => `平均の中央値 ${f1(METRICS.kindsMean(ms))} / 最小 ${isFinite(METRICS.kindsMin(ms)) ? METRICS.kindsMin(ms) : '—'}`);
{
  // にぎわいの内訳：種ごとに、いたサンプルの割合（全シードの平均％）と、一度でもいたシードの数
  L.push('### にぎわいの内訳：種ごとに、いたサンプルの割合', '', `各列は「全シードの平均（％） / 一度でもいたシードの数」。${all.length >= 2 ? '「⚠ 減」「✚ 増」は、最初と最後の実行結果で、いたシードの数が大きく変わった種（3以上かつ元の半分以上）。' : ''}`, '', `| 種 | ${names.join(' | ')} |`, `|---|${names.map(() => '---:').join('|')}|`);
  for (const k of MONSTER_KINDS) {
    const cell = (ms: M[]) => {
      const v = ms.map((m) => m.kindShare[k]).filter(isFinite);
      return v.length ? `${f1(v.reduce((a, b) => a + b, 0) / v.length)} / ${v.filter((x) => x > 0).length}` : '—';
    };
    const f = all.length >= 2 ? seedShift(kindSeeds(all[0], k), kindSeeds(all[all.length - 1], k)) : '';
    L.push(`| ${KIND_NAMES[k]}${f ? ` ${f}` : ''} | ${all.map(cell).join(' | ')} |`);
  }
  L.push('');
}
L.push('## 関わり', '', 'どの種がどの種に何をしたかの組み合わせ（向きあり、同じ種どうしは除く）。命のやりとり（倒した。死因は分けない）と、命を取らない関わり（盗んだ・取り立てた・従えた・夜襲した・あさった）。画面で結果が見えたものだけを、範囲内のログすべてから数える（忍び寄る・つける・待ち伏せにつくといった試みの始まりや、避ける・退くは数えない）。', '');
tbl('起きた組み合わせの数：全部 / 命のやりとり / 命を取らない（括弧内は2回以上起きたもの）', (m) => `${linkCount(m)}（${linkCount(m, undefined, 2)}） / ${linkCount(m, true)}（${linkCount(m, true, 2)}） / ${linkCount(m, false)}（${linkCount(m, false, 2)}）`, (ms) => `中央値 ${f1(METRICS.links(ms))}（${f1(METRICS.links2(ms))}）`);
{
  // 関わりの内訳：組み合わせごとに、起きたシードの数と回数の合計。起きたシードの数の多い順（最後の実行結果、次に最初の実行結果）
  const keys = [...new Set(all.flatMap((ms) => ms.flatMap((m) => [...m.links.keys()])))];
  const total = (ms: M[], k: string) => sum(ms, (m) => m.links.get(k) ?? 0);
  keys.sort((p, q) => linkSeeds(all[all.length - 1], q) - linkSeeds(all[all.length - 1], p) || linkSeeds(all[0], q) - linkSeeds(all[0], p) || total(all[all.length - 1], q) - total(all[all.length - 1], p));
  L.push('### 関わりの内訳：組み合わせごとに、起きたシードの数 / 回数の合計', '', ...(all.length >= 2 ? ['「⚠ 減」「✚ 増」は、最初と最後の実行結果で、起きたシードの数が大きく変わった組み合わせ（にぎわいの内訳と同じ条件）。', ''] : []), `| 組み合わせ | ${names.join(' | ')} |`, `|---|${names.map(() => '---:').join('|')}|`);
  for (const k of keys) L.push(`| ${linkName(k)}${(() => { const f = all.length >= 2 ? seedShift(linkSeeds(all[0], k), linkSeeds(all[all.length - 1], k)) : ''; return f ? ` ${f}` : ''; })()} | ${all.map((ms) => `${linkSeeds(ms, k)} / ${total(ms, k)}`).join(' | ')} |`);
  L.push('');
}
L.push('## コボルト', '');
tbl('住処が続いた日数（中央値 / 最長 / できた数）', (m) => `${f1(median(m.dur))} / ${f1(Math.max(0, ...m.dur))} / ${m.warrens}`, (ms) => `中央値 ${f1(median(ms.flatMap((m) => m.dur)))}（シードごとの中央値の中央値 ${f1(median(ms.filter((m) => m.dur.length).map((m) => median(m.dur))))}）`);
tbl('5日以上続いた住処 / 終わった住処の日数の中央値', (m) => `${m.dur.filter((d) => d >= 5).length}/${m.warrens} / ${f1(median(m.ended))}`, (ms) => `${ms.reduce((a, m) => a + m.dur.filter((d) => d >= 5).length, 0)}/${ms.reduce((a, m) => a + m.warrens, 0)}（${f1((100 * ms.reduce((a, m) => a + m.dur.filter((d) => d >= 5).length, 0)) / Math.max(1, ms.reduce((a, m) => a + m.warrens, 0)))}％） / ${f1(median(ms.flatMap((m) => m.ended)))}`);
tbl('住処の終わり方：蓄えが尽きた / 1匹になった（前回は「2匹を切った」） / 何度も襲われた / 竜を恐れた', (m) => `${m.endFood} / ${m.endAlone} / ${m.endRaid} / ${m.endDragon}`, (ms) => `${sum(ms, (m) => m.endFood)} / ${sum(ms, (m) => m.endAlone)} / ${sum(ms, (m) => m.endRaid)} / ${sum(ms, (m) => m.endDragon)}`);
tbl('冒険者に倒されたコボルト', (m) => m.advKob, (ms) => sum(ms, (m) => m.advKob));
tbl('ドラゴンに焼かれたコボルト', (m) => m.fireKob, (ms) => sum(ms, (m) => m.fireKob));
tbl('去り方：一匹ずつ飢えて（starving） / 住処ごと群れで（abandoned）', (m) => `${m.kobStarveExit} / ${m.kobAbandon}`, (ms) => `${sum(ms, (m) => m.kobStarveExit)} / ${sum(ms, (m) => m.kobAbandon)}`);
tbl('飢え死にしたコボルト', (m) => m.kobStarveDeath, (ms) => sum(ms, (m) => m.kobStarveDeath));
tbl('来た / 中で生まれた / 数の中央値 / 最後の数', (m) => `${m.kobArr} / ${m.kobBorn} / ${m.kobMed} / ${m.kobLast}`, (ms) => `${sum(ms, (m) => m.kobArr)} / ${sum(ms, (m) => m.kobBorn)}`);
L.push('## 大ネズミ', '');
tbl('飢え死に', (m) => m.ratStarve, (ms) => sum(ms, (m) => m.ratStarve));
tbl('飢え死にのうち、道のり10マス以内に食べられる苔があった割合', (m) => (m.ratNearKnown ? `${Math.round((100 * m.ratNear) / m.ratNearKnown)}％（${m.ratNear}/${m.ratNearKnown}）` : '—'), (ms) => { const k = sum(ms, (m) => m.ratNearKnown); return k ? `${Math.round((100 * sum(ms, (m) => m.ratNear)) / k)}％` : '—'; });
tbl('来た / 中で生まれた / 群れで出ていった（dispersed）', (m) => `${m.ratArr} / ${m.ratBorn} / ${m.ratDisp}`, (ms) => `${sum(ms, (m) => m.ratArr)} / ${sum(ms, (m) => m.ratBorn)} / ${sum(ms, (m) => m.ratDisp)}`);
tbl('来た：地表の横穴 / 天井の裂け目', (m) => `${m.ratMouthArr} / ${m.ratShaftArr}`, (ms) => `${sum(ms, (m) => m.ratMouthArr)} / ${sum(ms, (m) => m.ratShaftArr)}`);
tbl('天井の裂け目から15マス以内での飢え死に', (m) => m.ratStarveShaft, (ms) => sum(ms, (m) => m.ratStarveShaft));
tbl('巣穴の引っ越し', (m) => m.ratMoves, (ms) => sum(ms, (m) => m.ratMoves));
tbl('入り直し（地表の横穴が開いたあと、天井の割れ目から。回） / 0匹だった日数（5日目より後）', (m) => `${m.ratReenter} / ${m.ratZero / 4}`, (ms) => `${sum(ms, (m) => m.ratReenter)} / ${sum(ms, (m) => m.ratZero) / 4}`);
tbl('最多 / 最後の数（✝ は最後の2回のサンプルで0）', (m) => `${m.ratMax} / ${m.ratLast}${m.ratGone ? ' ✝' : ''}`, (ms) => `絶えた ${ms.filter((m) => m.ratGone).length} シード`);
L.push('## ゴブリン', '');
tbl('集落が続いた日数（中央値 / 最長 / できた数）', (m) => `${f1(median(m.campDur))} / ${f1(Math.max(0, ...m.campDur))} / ${m.camps}`, (ms) => `中央値 ${f1(median(ms.flatMap((m) => m.campDur)))}`);
tbl('5日以上続いた集落', (m) => `${m.campDur.filter((d) => d >= 5).length}/${m.camps}`, (ms) => `${sum(ms, (m) => m.campDur.filter((d) => d >= 5).length)}/${sum(ms, (m) => m.camps)}（${f1(METRICS.campShare5(ms))}％）`);
tbl('来た / 中で生まれた / 最多 / 最後の数（✝ は最後の2回のサンプルで0）', (m) => `${m.gobArr} / ${m.gobBorn} / ${m.gobMax} / ${m.gobLast}${m.gobGone ? ' ✝' : ''}`, (ms) => `${sum(ms, (m) => m.gobArr)} / ${sum(ms, (m) => m.gobBorn)}、絶えた ${ms.filter((m) => m.gobGone).length} シード`);
tbl('分かれてできた集落：続いた日数（中央値 / 数）/ 分けて持たせた蓄え', (m) => `${f1(median(m.splitDur))} / ${m.splitDur.length} / ${m.splitStore}`, (ms) => `中央値 ${f1(median(ms.flatMap((m) => m.splitDur)))} / ${sum(ms, (m) => m.splitDur.length)} / ${sum(ms, (m) => m.splitStore)}`);
const ER = ['food', 'raids', 'alone', 'dragon', 'empty'];
tbl('集落の終わり方：蓄えが尽きた / 襲われた / 1匹 / 竜 / 皆いなくなった（settle.jsonl があるときだけ）', (m) => ER.map((r) => m.gobEnd[r] ?? 0).join(' / '), (ms) => ER.map((r) => sum(ms, (m) => m.gobEnd[r] ?? 0)).join(' / '));
tbl('去り方：一匹ずつ飢えて / 集落ごと群れで / 飢え死に', (m) => `${m.gobStarveExit} / ${m.gobAbandonExit} / ${m.gobStarveDeath}`, (ms) => `${sum(ms, (m) => m.gobStarveExit)} / ${sum(ms, (m) => m.gobAbandonExit)} / ${sum(ms, (m) => m.gobStarveDeath)}`);
tbl('ゴブリンを倒した種：冒険者 / オーク / コボルト / そのほか', (m) => `${m.gobAdv} / ${m.gobByOrc} / ${m.gobByKob} / ${m.gobByOther}`, (ms) => `${sum(ms, (m) => m.gobAdv)} / ${sum(ms, (m) => m.gobByOrc)} / ${sum(ms, (m) => m.gobByKob)} / ${sum(ms, (m) => m.gobByOther)}`);
tbl('集落の蓄え：平均 / 最大 / 0でなかったサンプルの割合（集落のあったサンプルだけ）', (m) => (m.storeKnown ? `${f1(m.storeMean)} / ${m.storeMax} / ${Math.round(m.storePos)}％` : '—'), (ms) => (ms.some((m) => m.storeKnown) ? `平均の中央値 ${f1(median(ms.filter((m) => m.storeKnown && m.camps).map((m) => m.storeMean)))}` : '—'));
L.push('## オーク', '');
tbl('従えた集落 / 取り立て（回）/ 取り立てた食べ物', (m) => `${m.vassals} / ${m.tributes} / ${m.tributeFood}`, (ms) => `${sum(ms, (m) => m.vassals)} / ${sum(ms, (m) => m.tributes)} / ${sum(ms, (m) => m.tributeFood)}`);
tbl('飢えて去ったオーク', (m) => m.orcStarveExit, (ms) => sum(ms, (m) => m.orcStarveExit));
tbl('縄張りが続いた日数（中央値 / 最長 / 数）', (m) => `${f1(median(m.lairDur))} / ${f1(Math.max(0, ...m.lairDur))} / ${m.lairDur.length}`, (ms) => `中央値 ${f1(median(ms.flatMap((m) => m.lairDur)))}`);
tbl('コボルトに倒されたゴブリン / ゴブリンに倒されたコボルト', (m) => `${m.gobByKob} / ${m.kobByGob}`, (ms) => `${sum(ms, (m) => m.gobByKob)} / ${sum(ms, (m) => m.kobByGob)}`);
L.push('## ほかの種', '');
tbl('死んだ冒険者', (m) => m.advDeaths, (ms) => sum(ms, (m) => m.advDeaths));
tbl('来たゴブリン / 来たオーク', (m) => `${m.gobArr} / ${m.orcArr}`, (ms) => `${sum(ms, (m) => m.gobArr)} / ${sum(ms, (m) => m.orcArr)}`);
L.push('## 保存則', '');
tbl('四つの保存則のずれ（最大）', (m) => m.drift, (ms) => Math.max(...ms.map((m) => m.drift)));
const outp = args.out;
if (outp) writeFileSync(outp, L.join('\n'));
console.log(L.join('\n'));
