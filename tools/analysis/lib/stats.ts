/**
 * 対にした比較（同じシードの、前といまの値の差）の分布と、差がばらつきに埋もれていないかの目安。
 *
 * 目安の考え方：展開は少しの違いで大きく分かれるので、シードごとの差は大きく揺れる。そこで
 *   - 差の平均の 90％ 区間（シードを選び直すブートストラップ、乱数は決まった種で毎回同じ）
 *   - 増えたシードと減ったシードの数（符号検定の両側 p 値が 0.1 未満。たとえば 5対0、6対0、7対1 は届き、4対0、6対1 は届かない）
 *   - いちばん差の大きい1シードを除いても、差の合計の向きが変わらないか（1シードの出来事に引っ張られていないか）
 * を並べ、三つともそろったときだけ「はっきり」とする。どれかが欠けたら「ばらつきの内」。
 */
export interface Paired {
  n: number;
  sumA: number;
  sumB: number;
  diffs: number[];
  mean: number;
  median: number;
  up: number;
  down: number;
  lo: number;
  hi: number;
  p: number;
  /** 差の絶対値の合計のうち、いちばん大きい1シードの割合 */
  top: number;
  topSeed: string;
  /** いちばん差の大きい1シードを除いても向きが同じ */
  robust: boolean;
  verdict: 'はっきり増' | 'はっきり減' | 'ばらつきの内' | '差なし';
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const med = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
function binomTwoSided(k: number, n: number): number {
  if (n === 0) return 1;
  const lc = (m: number, r: number) => {
    let s = 0;
    for (let i = 0; i < r; i++) s += Math.log(m - i) - Math.log(i + 1);
    return s;
  };
  const lo = Math.min(k, n - k);
  let p = 0;
  for (let i = 0; i <= lo; i++) p += Math.exp(lc(n, i) - n * Math.log(2));
  return Math.min(1, 2 * p);
}

/** a[i] と b[i] は同じシード（NaN のものは除く） */
export function paired(a: number[], b: number[], seeds: string[]): Paired {
  const idx = a.map((_, i) => i).filter((i) => isFinite(a[i]) && isFinite(b[i]));
  const d = idx.map((i) => b[i] - a[i]);
  const n = d.length;
  const mean = n ? d.reduce((x, y) => x + y, 0) / n : NaN;
  const r = rng(12345);
  const means: number[] = [];
  for (let k = 0; k < 2000 && n; k++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += d[Math.floor(r() * n)];
    means.push(s / n);
  }
  means.sort((x, y) => x - y);
  const lo = n ? means[Math.floor(0.05 * means.length)] : NaN;
  const hi = n ? means[Math.min(means.length - 1, Math.floor(0.95 * means.length))] : NaN;
  const up = d.filter((x) => x > 0).length;
  const down = d.filter((x) => x < 0).length;
  const p = binomTwoSided(up, up + down);
  const absSum = d.reduce((x, y) => x + Math.abs(y), 0);
  let ti = -1;
  for (let j = 0; j < n; j++) if (ti < 0 || Math.abs(d[j]) > Math.abs(d[ti])) ti = j;
  const top = absSum > 0 && ti >= 0 ? Math.abs(d[ti]) / absSum : 0;
  const total = d.reduce((x, y) => x + y, 0);
  const rest = ti >= 0 ? total - d[ti] : 0;
  const robust = Math.sign(rest) === Math.sign(total) && total !== 0;
  let verdict: Paired['verdict'] = 'ばらつきの内';
  if (!n || d.every((x) => x === 0)) verdict = '差なし';
  else if ((lo > 0 || hi < 0) && p < 0.1 && robust) verdict = lo > 0 ? 'はっきり増' : 'はっきり減';
  return {
    n, sumA: idx.reduce((s, i) => s + a[i], 0), sumB: idx.reduce((s, i) => s + b[i], 0), diffs: d, mean, median: med(d), up, down, lo, hi, p, top, topSeed: ti >= 0 ? seeds[idx[ti]] : '', robust, verdict,
  };
}

const f = (v: number, dg = 1) => (isFinite(v) ? (Number.isInteger(v) ? String(v) : v.toFixed(dg)) : '—');
/** 差の分布の小さな字の図（シードごとの差を小さい順に、0 の位置に |） */
export function strip(d: number[]): string {
  if (!d.length) return '';
  const s = [...d].sort((x, y) => x - y);
  const m = Math.max(1e-9, ...s.map(Math.abs));
  const W = 15;
  const cells: string[] = Array.from({ length: 2 * W + 1 }, (_, i) => (i === W ? '|' : '·'));
  for (const v of s) {
    const i = W + Math.round((v / m) * W);
    cells[i] = cells[i] === '·' || cells[i] === '|' ? '●' : cells[i] === '●' ? '◉' : cells[i];
  }
  return '`' + cells.join('') + '`';
}

/** 表の1行（指標の名前、前の合計、後の合計、…） */
export const PAIRED_HEAD = ['| 指標 | 前の合計 | 後の合計 | 差の平均（90％区間） | 差の中央値 | 増 / 減 | 1シードの寄与 | 差の分布（小さい順、\\| は0） | 目安 |', '|---|---:|---:|---|---:|---:|---|---|---|'];
export function pairedRow(label: string, p: Paired): string {
  return `| ${label} | ${f(p.sumA)} | ${f(p.sumB)} | ${f(p.mean, 2)}（${f(p.lo, 2)}〜${f(p.hi, 2)}） | ${f(p.median)} | ${p.up} / ${p.down} | ${p.top ? `${Math.round(p.top * 100)}％ ${p.topSeed}${p.robust ? '' : '（除くと向きが変わる）'}` : '—'} | ${strip(p.diffs)} | ${p.verdict === 'はっきり増' ? '**↑ はっきり**' : p.verdict === 'はっきり減' ? '**↓ はっきり**' : p.verdict} |`;
}
export const PAIRED_NOTE = '「目安」：差の平均の90％区間（シードを選び直すブートストラップ）が0をまたがず、増えたシードと減ったシードの数の偏り（符号検定の両側 p）が 0.1 未満で、いちばん差の大きい1シードを除いても差の合計の向きが変わらないときだけ「はっきり」。どれかが欠けたら「ばらつきの内」（その差は、展開の分かれ方で説明できる大きさ）。';
