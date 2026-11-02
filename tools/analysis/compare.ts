/**
 * いくつかの batch の結果を、コボルトと大ネズミの目安で並べる（住みつける仕組みの確かめ用）。
 *
 *   npm run compare -- --runs runs/batch-a,runs/batch-b --names "前,後" --out docs/compare.md
 *
 * 各 batch のシードごとに：コボルトの住処が続いた日数（中央値、地上の1/4日ごとの記録から）、冒険者に倒されたコボルト、
 * ドラゴンに焼かれたコボルト、コボルトの去り方（starving 一匹ずつ飢えて / abandoned 住処ごと）、大ネズミの飢え死に、
 * 大ネズミの来た数と去り方（dispersed）、大ネズミが最後に生きているか、四つの帳簿のずれ
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from './common';

const args = parseArgs(process.argv.slice(2));
const runs = (args.runs || '').split(',').filter(Boolean);
const names = (args.names || runs.join(',')).split(',');
const rd = (dir: string, f: string) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const f1 = (v: number) => (isFinite(v) ? v.toFixed(1) : '—');

interface M { seed: string; warrens: number; dur: number[]; ended: number[]; advKob: number; fireKob: number; kobStarveExit: number; kobAbandon: number; kobStarveDeath: number; kobArr: number; kobBorn: number; kobLast: number; kobMed: number; ratStarve: number; ratArr: number; ratBorn: number; ratDisp: number; ratLast: number; ratMax: number; ratGone: boolean; drift: number; ratMoves: number; endFood: number; endAlone: number; endRaid: number; endDragon: number; gobArr: number; orcArr: number }
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
    endFood: evc(/^\{k:10\}の一団が蓄えが尽きて/), endAlone: evc(/^\{k:10\}の一団が(数が減って|1匹になって)/), endRaid: evc(/^\{k:10\}の一団が何度も襲われて/), endDragon: evc(/^\{k:10\}の一団が竜を恐れて/),
    gobArr: cnt(B, 12, (b) => b.origin !== 'born'), orcArr: cnt(B, 13, (b) => b.origin !== 'born'),
  };
}

const all = runs.map((r) => readdirSync(r).filter((d) => /^\d\d-/.test(d)).sort().map((d) => measure(join(r, d))));
const L: string[] = [];
const seeds = all[0].map((m) => m.seed);
const tbl = (title: string, f: (m: M) => string | number, total?: (ms: M[]) => string | number) => {
  L.push(`### ${title}`, '', `| シード | ${names.join(' | ')} |`, `|---|${names.map(() => '---:').join('|')}|`);
  for (let i = 0; i < seeds.length; i++) L.push(`| ${seeds[i]} | ${all.map((ms) => (ms[i] ? f(ms[i]) : '—')).join(' | ')} |`);
  if (total) L.push(`| **8シード** | ${all.map((ms) => `**${total(ms)}**`).join(' | ')} |`);
  L.push('');
};
const sum = (ms: M[], f: (m: M) => number) => ms.reduce((a, m) => a + f(m), 0);
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
tbl('来た / 中で生まれた / 群れで出ていった（dispersed）', (m) => `${m.ratArr} / ${m.ratBorn} / ${m.ratDisp}`, (ms) => `${sum(ms, (m) => m.ratArr)} / ${sum(ms, (m) => m.ratBorn)} / ${sum(ms, (m) => m.ratDisp)}`);
tbl('巣穴の引っ越し', (m) => m.ratMoves, (ms) => sum(ms, (m) => m.ratMoves));
tbl('最多 / 最後の数（✝ は最後の2回の記録で0）', (m) => `${m.ratMax} / ${m.ratLast}${m.ratGone ? ' ✝' : ''}`, (ms) => `絶えた ${ms.filter((m) => m.ratGone).length} シード`);
L.push('## ほかの種', '');
tbl('来たゴブリン / 来たオーク', (m) => `${m.gobArr} / ${m.orcArr}`, (ms) => `${sum(ms, (m) => m.gobArr)} / ${sum(ms, (m) => m.orcArr)}`);
L.push('## 帳簿', '');
tbl('四つの帳簿のずれ（最大）', (m) => m.drift, (ms) => Math.max(...ms.map((m) => m.drift)));
const outp = args.out;
if (outp) writeFileSync(outp, L.join('\n'));
console.log(L.join('\n'));
