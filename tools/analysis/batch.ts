/**
 * 多くのシードの試運転を並べて回し、シードを横に並べた比較の表を作る。
 *
 *   npm run batch -- --seeds "abc,かしたれ,はじまりの洞窟,seed4" --days 25
 *   npm run batch -- --seeds 16 --days 25 --out runs/b16          （--seeds 8 / 16 は決まったシードの組。lib/seeds.ts）
 *   npm run batch -- --seeds 8 --days 18 --fork 10 --base HEAD     （前の版の10日目の状態から、いまの版で18日目まで）
 *   npm run batch -- --seeds 8 --days 25 --ref HEAD~1              （前の版で回す）
 *   npm run batch -- --out runs/batch-mine --summary               （回さずに表だけ作り直す）
 *
 * 回した結果は版ごとの保存庫（runs/.cache/run、lib/runs.ts）に置き、<out>/<番号>-<シード>/ にはそこから切り出して写す。
 * 同じ版・同じシードを前に回していれば回さずに使い、日数が足りなければ続きから回す（分けても結果は同じ）。
 * 同時に --jobs（既定は CPU の数）個、かかる時間の長いシードから回す。終わったら各フォルダに report.md を作り、<out>/summary.md を書く。
 */
import { cpus } from 'os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generate } from '../../src/mapgen';
import { DAY_TICKS } from '../../src/world';
import { KIND_NAMES, parseArgs } from './common';
import { defaultAdv, getBin } from './lib/runs';
import { dirName, finished, reports, runSets } from './lib/batchrun';
import { parseSeeds } from './lib/seeds';

const args = parseArgs(process.argv.slice(2));
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const out = args.out || `runs/batch-${stamp}`;
mkdirSync(out, { recursive: true });
const cfgPath = join(out, 'batch.json');
let cfg: { seeds: string[]; days: number; advMax?: number; ref?: string; fork?: { day: number; ref?: string } };
if (args.seeds) {
  cfg = { seeds: parseSeeds(args.seeds, []), days: +(args.days || 25) };
  if (args['adv-max'] !== undefined) cfg.advMax = +args['adv-max'];
  if (args.ref) cfg.ref = args.ref;
  if (args.fork) cfg.fork = { day: +args.fork, ref: args.base || 'HEAD' };
} else if (existsSync(cfgPath)) {
  cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  if (args.days) cfg.days = +args.days;
} else throw new Error('--seeds "a,b,c" を指定してください（表だけ作り直すなら --out に前のフォルダと --summary）');
const jobs = Math.max(1, +(args.jobs || cpus().length));
const dirOf = (i: number) => join(out, dirName(cfg.seeds, i));
const done = (dir: string) => finished(dir, cfg.days);

async function runAll() {
  const t0 = Date.now();
  const ver = await getBin('sim', cfg.ref || 'cur');
  const base = cfg.fork ? await getBin('sim', cfg.fork.ref || 'HEAD') : undefined;
  const adv = cfg.advMax ?? defaultAdv();
  console.log(`${cfg.seeds.length} シード × ${cfg.days} 日${cfg.fork ? `（${cfg.fork.ref} の ${cfg.fork.day} 日目の状態から）` : ''}、版 ${ver.simHash}、同時に ${jobs}（${out}）`);
  await runSets([{ seeds: cfg.seeds, days: cfg.days, adv, ver, fork: cfg.fork && base ? { day: cfg.fork.day, base } : undefined, out }], jobs);
  console.log(`回し終わり（${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
}

// ---------------- 比較の表 ----------------

const rd = (dir: string, f: string) =>
  existsSync(join(dir, f))
    ? readFileSync(join(dir, f), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
const name = (k: number) => KIND_NAMES[k] ?? `種${k}`;
const fx = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !isFinite(v) ? '—' : v.toFixed(d));
const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
/** 自然の口から来る種 */
const NATURAL = [2, 3, 4, 9, 10, 12, 13, 14, 19, 23];
const ARRIVE = new Set(['mouth', 'fissure', 'river', 'shaft']);
const ELITE_NAMES: Record<number, string> = { 1: '火の精', 2: '亡霊の騎士', 4: '大ネズミの王', 5: 'ゴブリンの頭', 6: '水の精', 7: '光の精', 8: '骨の竜', 9: 'キノコの主' };
const SETTLE_NAMES: [string, string][] = [['burrow', '大ネズミの巣穴'], ['warren', 'コボルトの住処'], ['colony', 'アリの巣'], ['camp', 'ゴブリンの集落'], ['village', 'リザードマンの村'], ['orc', 'オークの縄張り']];
const MOUTH_NAMES = ['地表の横穴', '地底の裂け目', '川の口'];

interface SeedSum {
  seed: string;
  days: number;
  alive: number;
  arrived: Map<number, number>;
  born: Map<number, number>;
  exits: Map<number, Map<string, number>>;
  deaths: Map<number, Map<string, number>>;
  /** 種ごとの、冒険者に倒された数、ドラゴンに焼かれた数 */
  byAdv: Map<number, number>;
  byDragonFire: Map<number, number>;
  series: Map<number, number[]>;
  sampleDays: number[];
  settle: Map<string, { n: number; dur: number[]; live: number }>;
  mouths: string[];
  dragon: (number | null)[];
  elites: Map<number, number>;
  drift: { nutr: number; gold: number; rock: number; mana: number };
  anomalies: string[];
}

function summarizeSeed(i: number): SeedSum | null {
  const dir = dirOf(i);
  const samples = rd(dir, 'samples.jsonl');
  if (!samples.length) return null;
  const births = rd(dir, 'births.jsonl');
  const deaths = rd(dir, 'deaths.jsonl');
  const exits = rd(dir, 'exits.jsonl');
  const inc = <K>(m: Map<K, number>, k: K, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
  const sub = <K>(m: Map<number, Map<K, number>>, k: number) => {
    if (!m.has(k)) m.set(k, new Map());
    return m.get(k) as Map<K, number>;
  };
  const s: SeedSum = {
    seed: cfg.seeds[i], days: samples[samples.length - 1].day, alive: 0, arrived: new Map(), born: new Map(), exits: new Map(), deaths: new Map(), byAdv: new Map(), byDragonFire: new Map(),
    series: new Map(), sampleDays: samples.map((x) => x.day), settle: new Map(), mouths: [], dragon: [null, null, null], elites: new Map(),
    drift: { nutr: 0, gold: 0, rock: 0, mana: 0 }, anomalies: [],
  };
  for (const b of births) {
    if (ARRIVE.has(b.origin)) inc(s.arrived, b.k);
    else if (b.origin === 'born') inc(s.born, b.k);
  }
  for (const e of exits) inc(sub(s.exits, e.k), e.reason);
  for (const d of deaths) {
    inc(sub(s.deaths, d.k), d.cause);
    if (d.by === 25) inc(s.byAdv, d.k);
    if (d.by === 24 && d.cause === 'burned') inc(s.byDragonFire, d.k);
  }
  const kinds = new Set<number>();
  for (const x of samples) for (const k of Object.keys(x.counts)) kinds.add(+k);
  for (const k of kinds) s.series.set(k, samples.map((x) => x.counts[k] ?? 0));
  const last = samples[samples.length - 1];
  s.alive = Object.values(last.counts as Record<string, number>).reduce((a, b) => a + b, 0);
  for (const x of samples) {
    s.drift.nutr = Math.max(s.drift.nutr, Math.abs(x.nutrientDrift ?? 0));
    s.drift.gold = Math.max(s.drift.gold, Math.abs(x.goldDrift ?? 0));
    s.drift.rock = Math.max(s.drift.rock, Math.abs(x.rockDrift ?? 0));
    s.drift.mana = Math.max(s.drift.mana, Math.abs(x.manaDrift ?? 0));
  }
  // 住みついた群れ：見えた最初と最後のサンプルの間を続いた日数とする
  for (const [key] of SETTLE_NAMES) {
    const first = new Map<string, number>();
    const lastSeen = new Map<string, number>();
    for (const x of samples) for (const id of x.settle?.[key] ?? []) {
      if (!first.has(String(id))) first.set(String(id), x.day);
      lastSeen.set(String(id), x.day);
    }
    const liveNow = new Set((last.settle?.[key] ?? []).map(String));
    s.settle.set(key, { n: first.size, dur: [...first].map(([id, d0]) => (lastSeen.get(id) as number) - d0 + 0.25), live: liveNow.size });
  }
  // 口が開いた日
  const nM = samples.find((x) => x.mouths)?.mouths.length ?? 0;
  const mouthKinds: number[] = readMouthKinds(cfg.seeds[i]);
  for (let j = 0; j < nM; j++) {
    const open0 = samples.find((x) => x.mouths && x.mouths[j]);
    s.mouths.push(`${MOUTH_NAMES[mouthKinds[j]] ?? '口'} ${open0 ? (open0 === samples[0] ? 'はじめから' : `${fx(open0.day, 2)}日`) : '閉じたまま'}`);
  }
  for (const x of samples) for (const sp of x.dragons ?? []) if (s.dragon[sp] === null) s.dragon[sp] = x.day;
  const seenElite = new Set<number>();
  for (const x of samples)
    for (const [id, el] of x.elites ?? []) {
      if (seenElite.has(id)) continue;
      seenElite.add(id);
      inc(s.elites, el);
    }
  if (existsSync(join(dir, 'report.md'))) {
    const rep = readFileSync(join(dir, 'report.md'), 'utf8');
    const sec = rep.split('## おかしな兆候')[1]?.split('\n## ')[0] ?? '';
    s.anomalies = sec.split('\n').filter((l) => l.startsWith('- ') && !l.includes('見つからなかった')).map((l) => l.slice(2));
  }
  return s;
}

/** 口の種類（地形はシードだけで決まるので作って読む） */
function readMouthKinds(seed: string): number[] {
  return generate(seed).mouths.map((m) => m.kind);
}

function goneDay(s: SeedSum, k: number): string {
  const ser = s.series.get(k);
  if (!ser || Math.max(...ser) === 0) return '—';
  if (ser[ser.length - 1] > 0) return '';
  let j = ser.length - 1;
  while (j > 0 && ser[j - 1] === 0) j--;
  return fx(s.sampleDays[j], 2);
}

function writeSummary() {
  const sums = cfg.seeds.map((_, i) => summarizeSeed(i)).filter(Boolean) as SeedSum[];
  const L: string[] = [];
  const head = (first: string) => [`| ${first} | ${sums.map((s) => s.seed).join(' | ')} |`, `|---|${sums.map(() => '---:').join('|')}|`];
  const row = (label: string, f: (s: SeedSum) => string | number) => `| ${label} | ${sums.map((s) => String(f(s))).join(' | ')} |`;
  L.push(`# 比較の表：${sums.length} シード × ${cfg.days} 日${cfg.advMax !== undefined ? `（冒険者の一行の上限 ${cfg.advMax}）` : ''}`, '', `作った日時：${new Date().toISOString()}。各シードの詳しい報告は ${out}/<番号>-<シード>/report.md。`, '');

  L.push('## 概要と帳簿', '', ...head('項目'));
  L.push(row('回した日数', (s) => fx(s.days, 2)));
  L.push(row('最後の生き物の数', (s) => s.alive));
  L.push(row('養分のずれ（最大）', (s) => s.drift.nutr));
  L.push(row('金貨のずれ（最大）', (s) => s.drift.gold));
  L.push(row('岩のずれ（最大）', (s) => s.drift.rock));
  L.push(row('マナのずれ（最大）', (s) => s.drift.mana));
  L.push(row('おかしな兆候の数', (s) => s.anomalies.length));
  L.push('');

  L.push('## 口が開いた日、ドラゴンの育ち、特別な個体', '', ...head('項目'));
  L.push(row('口', (s) => s.mouths.join('<br>') || '—'));
  L.push(row('幼竜が現れた日', (s) => fx(s.dragon[0], 2)));
  L.push(row('若い竜になった日', (s) => fx(s.dragon[1], 2)));
  L.push(row('成竜になった日', (s) => fx(s.dragon[2], 2)));
  const elKinds = [...new Set(sums.flatMap((s) => [...s.elites.keys()]))].sort((a, b) => a - b);
  for (const el of elKinds) L.push(row(`特別な個体：${ELITE_NAMES[el] ?? `特別${el}`}`, (s) => s.elites.get(el) ?? 0));
  if (!elKinds.length) L.push(row('特別な個体', () => 0));
  L.push('', '（日付は地上の1/4日ごとの記録で最初に見えた日。特別な個体は、記録に一度でも生きて現れた数）', '');

  L.push('## 自然の口から来た種', '', '来た＝地表の横穴・地底の裂け目・川の口・天井の裂け目から現れた数。去った・死んだはその種のすべて（中で生まれた個体を含む）。', '');
  for (const k of NATURAL) {
    if (!sums.some((s) => (s.arrived.get(k) ?? 0) + (s.born.get(k) ?? 0) > 0 || (s.series.get(k) ?? []).some((v) => v > 0))) {
      L.push(`### ${name(k)}`, '', '（どのシードにも現れなかった）', '');
      continue;
    }
    const ex = (s: SeedSum, r: string) => s.exits.get(k)?.get(r) ?? 0;
    const dc = (s: SeedSum, ...c: string[]) => c.reduce((a, x) => a + (s.deaths.get(k)?.get(x) ?? 0), 0);
    const dother = (s: SeedSum) => [...(s.deaths.get(k) ?? new Map<string, number>())].filter(([c]) => !['starve', 'eaten', 'fight'].includes(c)).reduce((a, [, n]) => a + n, 0);
    const ser = (s: SeedSum) => s.series.get(k) ?? [0];
    L.push(`### ${name(k)}`, '', ...head('項目'));
    L.push(row('来た', (s) => s.arrived.get(k) ?? 0));
    L.push(row('中で生まれた', (s) => s.born.get(k) ?? 0));
    L.push(row('去った：飢えて', (s) => ex(s, 'starving')));
    const otherReasons = [...new Set(sums.flatMap((s) => [...(s.exits.get(k)?.keys() ?? [])]))].filter((r) => r !== 'starving');
    for (const r of otherReasons) L.push(row(`去った：${EXIT_NAMES[r] ?? r}`, (s) => ex(s, r)));
    L.push(row('死んだ：飢え', (s) => dc(s, 'starve')));
    L.push(row('死んだ：食べられた', (s) => dc(s, 'eaten')));
    L.push(row('死んだ：戦い', (s) => dc(s, 'fight')));
    L.push(row('（死んだうち）冒険者に倒された', (s) => s.byAdv.get(k) ?? 0));
    L.push(row('（死んだうち）ドラゴンに焼かれた', (s) => s.byDragonFire.get(k) ?? 0));
    L.push(row('死んだ：そのほか', (s) => {
      const n = dother(s);
      if (!n) return 0;
      const parts = [...(s.deaths.get(k) ?? new Map<string, number>())].filter(([c]) => !['starve', 'eaten', 'fight'].includes(c)).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${CAUSE_SHORT[c] ?? c}${v}`);
      return `${n}（${parts.join('、')}）`;
    }));
    L.push(row('最多', (s) => Math.max(...ser(s))));
    L.push(row('中央値', (s) => median(ser(s))));
    L.push(row('最後の数', (s) => ser(s)[ser(s).length - 1]));
    L.push(row('絶えた日', (s) => goneDay(s, k) || '（生きている）'));
    L.push('');
  }

  L.push('## 住みついた群れが続いた日数', '', 'できた数 / 続いた日数の中央値・最長 / 最後に残っていた数。続いた日数は、地上の1/4日ごとの記録で見えた最初から最後まで（最後まで残ったものは打ち切り）。', '', ...head('群れ'));
  for (const [key, label] of SETTLE_NAMES)
    L.push(row(label, (s) => {
      const st = s.settle.get(key);
      if (!st || !st.n) return '—';
      return `${st.n}件 / 中央 ${fx(median(st.dur))}日・最長 ${fx(Math.max(...st.dur))}日 / 残 ${st.live}`;
    }));
  L.push('');

  L.push('## 種ごとの数の移り変わり', '', '最多 / 中央値 / 絶えた日（絶えて戻らなかった日。空欄は最後まで生きている、—は現れなかった）', '', ...head('種'));
  const allKinds = [...new Set(sums.flatMap((s) => [...s.series.keys()]))].sort((a, b) => a - b);
  for (const k of allKinds)
    L.push(row(name(k), (s) => {
      const ser = s.series.get(k);
      if (!ser || Math.max(...ser) === 0) return '—';
      const g = goneDay(s, k);
      return `${Math.max(...ser)} / ${median(ser)}${g ? ` / ✝${g}` : ''}`;
    }));
  L.push('');

  L.push('## おかしな兆候', '');
  for (const s of sums) {
    L.push(`### ${s.seed}`, '');
    if (!s.anomalies.length) L.push('- 見つからなかった');
    for (const a of s.anomalies) L.push(`- ${a}`);
    L.push('');
  }
  writeFileSync(join(out, 'summary.md'), L.join('\n'));
  console.log(`比較の表を書きました：${join(out, 'summary.md')}`);
}
const EXIT_NAMES: Record<string, string> = { returned: '生還', home: '満ちて帰った', abandoned: '住処を捨てて群れで', dispersed: '群れで出ていった' };
const CAUSE_SHORT: Record<string, string> = { crumbled: '朽', burned: '焼', crushed: '崩', petrified: '石', killed: '襲', dried: '乾', faded: '消', planted: '茸', other: '他' };

async function main() {
  if (!args.summary) await runAll();
  if (!args.summary || args.report) await reports(out, cfg.seeds, jobs);
  writeSummary();
  const unfinished = cfg.seeds.filter((_, i) => !done(dirOf(i)));
  if (unfinished.length) console.log(`まだ終わっていないシード：${unfinished.join('、')}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
