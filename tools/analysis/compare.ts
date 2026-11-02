/**
 * いくつかの batch の結果を、コボルトと大ネズミの目安で並べる（住みつける仕組みの確かめ用）。
 *
 *   npm run compare -- --runs runs/batch-a,runs/batch-b --names "前,後" --out docs/compare.md
 *   npm run compare -- --runs ... --seeds "abc,かしたれ"     一部のシードだけ
 *   npm run compare -- --runs runs/ab-x/base,runs/ab-x/new --paired --since 10
 *       10日目より後の記録だけで比べ、シードごとの差の分布と、差がばらつきに埋もれていないかの目安の表を先頭に付ける（ab が使う）
 *
 * 各 batch のシードごとに：ゴブリンの集落（続いた日数、終わり方、冒険者・コボルトとの殺し合い）、コボルトの住処が続いた日数（中央値、地上の1/4日ごとの記録から）、冒険者に倒されたコボルト、
 * ドラゴンに焼かれたコボルト、コボルトの去り方（starving 一匹ずつ飢えて / abandoned 住処ごと）、大ネズミの飢え死に、
 * 大ネズミの来た数と去り方（dispersed）、大ネズミが最後に生きているか、四つの帳簿のずれ
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from './common';
import { DAY_TICKS } from '../../src/world';
import { generate } from '../../src/mapgen';
import { paired, pairedRow, PAIRED_HEAD, PAIRED_NOTE } from './lib/stats';

const args = parseArgs(process.argv.slice(2));
const runs = (args.runs || '').split(',').filter(Boolean);
const names = (args.names || runs.join(',')).split(',');
/** --since 日：その日より後の記録だけを使う（同じ途中の状態から続けた二つを比べるとき、分かれる前の同じ部分を除く） */
const sinceT = args.since ? +args.since * DAY_TICKS : -1;
const rd = (dir: string, f: string) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !(typeof r.t === 'number' && r.t <= sinceT && !(f === 'samples.jsonl' && r.t === sinceT))) : []);
const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const f1 = (v: number) => (isFinite(v) ? v.toFixed(1) : '—');

interface M { seed: string; warrens: number; dur: number[]; ended: number[]; advKob: number; fireKob: number; kobStarveExit: number; kobAbandon: number; kobStarveDeath: number; kobArr: number; kobBorn: number; kobLast: number; kobMed: number; ratStarve: number; ratArr: number; ratBorn: number; ratDisp: number; ratLast: number; ratMax: number; ratGone: boolean; drift: number; ratMoves: number; rich: number; ratNear: number; ratNearKnown: number; endFood: number; endAlone: number; endRaid: number; endDragon: number; gobArr: number; orcArr: number; camps: number; campDur: number[]; gobBorn: number; gobMax: number; gobLast: number; gobGone: boolean; gobEnd: Record<string, number>; gobAdv: number; gobByKob: number; kobByGob: number; advDeaths: number; gobStarveExit: number; gobAbandonExit: number; gobStarveDeath: number; gobByOrc: number; gobByOther: number; vassals: number; tributes: number; tributeFood: number; lairDur: number[]; ratShaftArr: number; ratMouthArr: number; ratStarveShaft: number; orcStarveExit: number; storeMean: number; storeMax: number; storePos: number; storeKnown: boolean }
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
  // 最後の記録まで残っていた住処は打ち切り。終わった住処だけの日数も見る
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
    // シードの豊かさ：5日目以降の記録の平均（口が開いていない記録は除く）
    rich: (() => { const v = S.filter((x) => x.day >= 5 && typeof x.rich === 'number').map((x) => x.rich as number); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : NaN; })(),
    // 飢え死にした大ネズミのうち、道のり10マス以内に食べられる苔があった数（記録に near があるものだけ）
    ratNear: D.filter((d) => d.k === 2 && d.cause === 'starve' && typeof d.near === 'number' && d.near >= 0 && d.near < 10).length,
    ratNearKnown: D.filter((d) => d.k === 2 && d.cause === 'starve' && typeof d.near === 'number').length,
    // 住処の終わり方：settle.jsonl（構造化した記録）があればそれを、なければ記録の文章から数える（古い回のため）
    ...(existsSync(join(dir, 'settle.jsonl'))
      ? (() => {
          const SE = rd(dir, 'settle.jsonl').filter((x) => x.k === 10 && x.ev === 'abandon');
          const r = (why: string) => SE.filter((x) => x.reason === why).length;
          return { endFood: r('food'), endAlone: r('alone'), endRaid: r('raids'), endDragon: r('dragon') };
        })()
      : { endFood: evc(/^\{k:10\}の一団が蓄えが尽きて/), endAlone: evc(/^\{k:10\}の一団が(数が減って|1匹になって)/), endRaid: evc(/^\{k:10\}の一団が何度も襲われて/), endDragon: evc(/^\{k:10\}の一団が竜を恐れて/) }),
    gobArr: cnt(B, 12, (b) => b.origin !== 'born'), orcArr: cnt(B, 13, (b) => b.origin !== 'born'),
    // ゴブリンの集落（地上の1/4日ごとの記録の settle.camp から。コボルトの住処と同じ数え方）
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
        // 天井の裂け目から15マス以内での大ネズミの飢え死に（裂け目の場所は地図から）
        ratStarveShaft: (() => {
          const m = generate(meta.seed);
          const sh = m.shafts.map((q) => [q.x * 16 + 8, q.y * 16 + 8]);
          return D.filter((d) => d.k === 2 && d.cause === 'starve' && sh.some(([x, y]) => Math.hypot(x - d.x, y - d.y) < 15 * 16)).length;
        })(),
        orcStarveExit: cnt(X, 13, (x) => x.reason === 'starving'),
        // 集落の蓄えの推移（samples の settle.campStore。六巡目から）：集落のあった記録での蓄えの合計の平均・最大と、蓄えが0でなかった記録の割合
        ...(() => {
          const v = S.filter((x) => (x.settle?.campStore ?? []).length).map((x) => (x.settle.campStore as number[]).reduce((a, b) => a + b, 0));
          return { storeKnown: S.some((x) => x.settle?.campStore), storeMean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, storeMax: Math.max(0, ...v), storePos: v.length ? (100 * v.filter((x) => x > 0).length) / v.length : 0 };
        })(),
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
 * metric は下の METRICS の名前（8シードまとめた値）。届いたかどうかを表にする
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
  // 豊かさで上半分（豊かなシード）と下半分（乏しいシード）に分けた目安
  richWarrenMedian: (ms) => median(halves(ms)[0].flatMap((m) => m.dur)),
  poorKobArr: (ms) => sum(halves(ms)[1], (m) => m.kobArr),
  poorEndFood: (ms) => sum(halves(ms)[1], (m) => m.endFood),
};
// 対にした比較（最初の回と最後の回の、同じシードどうしの差）
if (args.paired && all.length >= 2) {
  const A = all[0];
  const Bm = all[all.length - 1];
  const md = (a: number[]) => (a.length ? median(a) : NaN);
  const P: [string, (m: M) => number][] = [
    ['大ネズミ：飢え死に', (m) => m.ratStarve], ['大ネズミ：来た', (m) => m.ratArr], ['大ネズミ：中で生まれた', (m) => m.ratBorn], ['大ネズミ：群れで出ていった', (m) => m.ratDisp], ['大ネズミ：巣穴の引っ越し', (m) => m.ratMoves], ['大ネズミ：最後の数', (m) => m.ratLast],
    ['コボルト：来た', (m) => m.kobArr], ['コボルト：中で生まれた', (m) => m.kobBorn], ['コボルト：住処の数', (m) => m.warrens], ['コボルト：住処の日数の中央値', (m) => md(m.dur)], ['コボルト：飢え死に', (m) => m.kobStarveDeath], ['コボルト：一匹ずつ飢えて去った', (m) => m.kobStarveExit], ['コボルト：冒険者に倒された', (m) => m.advKob], ['コボルト：最後の数', (m) => m.kobLast],
    ['ゴブリン：来た', (m) => m.gobArr], ['ゴブリン：中で生まれた', (m) => m.gobBorn], ['ゴブリン：集落の数', (m) => m.camps], ['ゴブリン：集落の日数の中央値', (m) => md(m.campDur)], ['ゴブリン：最後の数', (m) => m.gobLast], ['ゴブリン：飢え死に', (m) => m.gobStarveDeath], ['ゴブリン：冒険者に倒された', (m) => m.gobAdv],
    ['ゴブリン：集落の蓄えの平均', (m) => (m.storeKnown ? m.storeMean : NaN)], ['ゴブリン：蓄えが0でなかった記録の割合（％）', (m) => (m.storeKnown && m.camps ? m.storePos : NaN)],
    ['オーク：来た', (m) => m.orcArr], ['オーク：従えた集落', (m) => m.vassals], ['オーク：取り立て（回）', (m) => m.tributes], ['オーク：取り立てた食べ物', (m) => m.tributeFood], ['オーク：飢えて去った', (m) => m.orcStarveExit],
    ['冒険者：死んだ', (m) => m.advDeaths], ['ゴブリンに倒されたコボルト', (m) => m.kobByGob], ['コボルトに倒されたゴブリン', (m) => m.gobByKob],
  ];
  const sd = A.map((m) => m.seed);
  const Bs = sd.map((s) => Bm.find((m) => m.seed === s));
  L.push(`## 対にした比較：${names[0]} → ${names[names.length - 1]}（${sd.length} シード${args.since ? `、${args.since}日目より後` : ''}）`, '', PAIRED_NOTE, '', ...PAIRED_HEAD);
  for (const [label, f] of P) {
    const pr = paired(A.map(f), Bs.map((m) => (m ? f(m) : NaN)), sd);
    if (pr.verdict === '差なし' && pr.sumA === 0) continue;
    L.push(pairedRow(label, pr));
  }
  const dr = Math.max(0, ...Bm.map((m) => m.drift));
  L.push('', `帳簿のずれ（${names[names.length - 1]}、最大）：${dr}${dr ? ' ⚠' : ''}`, '');
}
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
// シードの豊かさの順（最後に並べた回）
{
  const last = all[all.length - 1];
  if (last.some((m) => isFinite(m.rich))) {
    L.push(`## シードの豊かさの順（${names[names.length - 1]}）`, '', '豊かさ＝開いた地表の横穴から歩いて行ける範囲（道のり100マス）の床1マスあたりの、食べられる苔とキノコ（20以上の群落の、根元12を除いた分）。5日目以降の地上の1/4日ごとの記録の平均。', '', '| シード | 豊かさ | 住処の日数の中央値 / 最長 / できた数 | 来たコボルト / 中で生まれた | 終わり方：蓄え / 1匹 / 襲われた / 竜 |', '|---|---:|---:|---:|---:|');
    for (const m of [...last].sort((a, b) => (isFinite(b.rich) ? b.rich : -1) - (isFinite(a.rich) ? a.rich : -1))) L.push(`| ${m.seed} | ${f1(m.rich)} | ${f1(median(m.dur))} / ${f1(Math.max(0, ...m.dur))} / ${m.warrens} | ${m.kobArr} / ${m.kobBorn} | ${m.endFood} / ${m.endAlone} / ${m.endRaid} / ${m.endDragon} |`);
    L.push('');
  }
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
tbl('最多 / 最後の数（✝ は最後の2回の記録で0）', (m) => `${m.ratMax} / ${m.ratLast}${m.ratGone ? ' ✝' : ''}`, (ms) => `絶えた ${ms.filter((m) => m.ratGone).length} シード`);
L.push('## ゴブリン', '');
tbl('集落が続いた日数（中央値 / 最長 / できた数）', (m) => `${f1(median(m.campDur))} / ${f1(Math.max(0, ...m.campDur))} / ${m.camps}`, (ms) => `中央値 ${f1(median(ms.flatMap((m) => m.campDur)))}`);
tbl('5日以上続いた集落', (m) => `${m.campDur.filter((d) => d >= 5).length}/${m.camps}`, (ms) => `${sum(ms, (m) => m.campDur.filter((d) => d >= 5).length)}/${sum(ms, (m) => m.camps)}（${f1(METRICS.campShare5(ms))}％）`);
tbl('来た / 中で生まれた / 最多 / 最後の数（✝ は最後の2回の記録で0）', (m) => `${m.gobArr} / ${m.gobBorn} / ${m.gobMax} / ${m.gobLast}${m.gobGone ? ' ✝' : ''}`, (ms) => `${sum(ms, (m) => m.gobArr)} / ${sum(ms, (m) => m.gobBorn)}、絶えた ${ms.filter((m) => m.gobGone).length} シード`);
const ER = ['food', 'raids', 'alone', 'dragon', 'empty'];
tbl('集落の終わり方：蓄えが尽きた / 襲われた / 1匹 / 竜 / 皆いなくなった（settle.jsonl があるときだけ）', (m) => ER.map((r) => m.gobEnd[r] ?? 0).join(' / '), (ms) => ER.map((r) => sum(ms, (m) => m.gobEnd[r] ?? 0)).join(' / '));
tbl('去り方：一匹ずつ飢えて / 集落ごと群れで / 飢え死に', (m) => `${m.gobStarveExit} / ${m.gobAbandonExit} / ${m.gobStarveDeath}`, (ms) => `${sum(ms, (m) => m.gobStarveExit)} / ${sum(ms, (m) => m.gobAbandonExit)} / ${sum(ms, (m) => m.gobStarveDeath)}`);
tbl('ゴブリンを倒した種：冒険者 / オーク / コボルト / そのほか', (m) => `${m.gobAdv} / ${m.gobByOrc} / ${m.gobByKob} / ${m.gobByOther}`, (ms) => `${sum(ms, (m) => m.gobAdv)} / ${sum(ms, (m) => m.gobByOrc)} / ${sum(ms, (m) => m.gobByKob)} / ${sum(ms, (m) => m.gobByOther)}`);
tbl('集落の蓄え：平均 / 最大 / 0でなかった記録の割合（集落のあった記録だけ）', (m) => (m.storeKnown ? `${f1(m.storeMean)} / ${m.storeMax} / ${Math.round(m.storePos)}％` : '—'), (ms) => (ms.some((m) => m.storeKnown) ? `平均の中央値 ${f1(median(ms.filter((m) => m.storeKnown && m.camps).map((m) => m.storeMean)))}` : '—'));
L.push('## オーク', '');
tbl('従えた集落 / 取り立て（回）/ 取り立てた食べ物', (m) => `${m.vassals} / ${m.tributes} / ${m.tributeFood}`, (ms) => `${sum(ms, (m) => m.vassals)} / ${sum(ms, (m) => m.tributes)} / ${sum(ms, (m) => m.tributeFood)}`);
tbl('飢えて去ったオーク', (m) => m.orcStarveExit, (ms) => sum(ms, (m) => m.orcStarveExit));
tbl('縄張りが続いた日数（中央値 / 最長 / 数）', (m) => `${f1(median(m.lairDur))} / ${f1(Math.max(0, ...m.lairDur))} / ${m.lairDur.length}`, (ms) => `中央値 ${f1(median(ms.flatMap((m) => m.lairDur)))}`);
tbl('コボルトに倒されたゴブリン / ゴブリンに倒されたコボルト', (m) => `${m.gobByKob} / ${m.kobByGob}`, (ms) => `${sum(ms, (m) => m.gobByKob)} / ${sum(ms, (m) => m.kobByGob)}`);
L.push('## ほかの種', '');
tbl('死んだ冒険者', (m) => m.advDeaths, (ms) => sum(ms, (m) => m.advDeaths));
tbl('来たゴブリン / 来たオーク', (m) => `${m.gobArr} / ${m.orcArr}`, (ms) => `${sum(ms, (m) => m.gobArr)} / ${sum(ms, (m) => m.orcArr)}`);
L.push('## 帳簿', '');
tbl('四つの帳簿のずれ（最大）', (m) => m.drift, (ms) => Math.max(...ms.map((m) => m.drift)));
const outp = args.out;
if (outp) writeFileSync(outp, L.join('\n'));
console.log(L.join('\n'));
