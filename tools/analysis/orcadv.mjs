/**
 * オークと冒険者の数を、batch / ab の実行結果同士で並べる（六歩目：オークの見極め）。
 *   node tools/analysis/orcadv.mjs runs/ab-x/base runs/ab-x/new
 * シードごとに：冒険者に倒されたオーク、オークのいる日数（ゲーム内の1/4日ごとのサンプルでオークが1匹以上）、ゴブリンの集落のある日数、冒険者の死者、オークの威嚇
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const runs = process.argv.slice(2);
const lines = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const stat = (dir) => {
  const d = lines(join(dir, 'deaths.jsonl'));
  const s = lines(join(dir, 'samples.jsonl'));
  const st = lines(join(dir, 'settle.jsonl'));
  const orcDays = s.filter((x) => (x.counts?.['13'] ?? 0) > 0).length / 4;
  // ゴブリンの集落：settle の found / abandon・empty から、1/4日ごとに数える
  const camps = new Map();
  const ev = st.filter((x) => x.k === 12 && ['found', 'abandon', 'empty'].includes(x.ev)).sort((a, b) => a.t - b.t);
  let campDays = 0;
  const end = s.length ? s[s.length - 1].t : 0;
  for (let t = 0; t <= end; t += 3600) {
    for (; ev.length && ev[0].t <= t; ) {
      const e = ev.shift();
      if (e.ev === 'found') camps.set(e.id, 1);
      else camps.delete(e.id);
    }
    if (camps.size) campDays += 0.25;
  }
  return {
    orcByAdv: d.filter((x) => x.k === 13 && x.by === 25).length,
    orcDays,
    campDays,
    advDead: d.filter((x) => x.k === 25).length,
    bluff: st.filter((x) => x.k === 13 && x.ev === 'bluff').length,
  };
};
const seeds = readdirSync(runs[0]).filter((f) => existsSync(join(runs[0], f, 'deaths.jsonl'))).sort();
const keys = [['orcByAdv', '冒険者に倒されたオーク'], ['orcDays', 'オークのいる日数'], ['campDays', 'ゴブリンの集落のある日数'], ['advDead', '冒険者の死者'], ['bluff', 'オークの威嚇']];
console.log(`| シード | ${keys.map(([, n]) => `${n}（${runs.map((_r, i) => (i ? '後' : '前')).join(' → ')}）`).join(' | ')} |`);
console.log(`|---|${keys.map(() => '---').join('|')}|`);
const tot = keys.map(() => runs.map(() => 0));
for (const sd of seeds) {
  const v = runs.map((r) => stat(join(r, sd)));
  console.log(`| ${sd} | ${keys.map(([k], i) => { v.forEach((x, j) => (tot[i][j] += x[k])); return v.map((x) => x[k]).join(' → '); }).join(' | ')} |`);
}
console.log(`| **合計** | ${tot.map((t) => t.map((x) => Math.round(x * 100) / 100).join(' → ')).join(' | ')} |`);
