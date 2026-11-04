/**
 * 再実行せずに値を計算する：実行結果の日次スナップショット（snap/）を読み直して、式の値を日ごとに出す。
 * ログ（samples.jsonl など）に無い値が後から必要になっても、sim のログ出力を書き足して再実行しなくてよい。
 *
 *   npm run metric -- --runs runs/b16 --name campStore
 *   npm run metric -- --runs runs/ab-x/base,runs/ab-x/new --expr "e.warrens.length" --days 10-18
 *   npm run metric -- --runs runs/b8 --expr "s.eco.n" --raw          （--raw：World を作らずセーブの JSON（s）のまま。速い）
 *
 * 式の中で使える名前：w（World）、e（生き物たち、Ecology）、m（マップ）、s（セーブの JSON）、K（種の名前→番号）。
 * 定義済みの名前（--name）は下の NAMED。--agg mean（既定）/ max / last / sum で、シードごとの値のまとめ方を選ぶ。
 * 二つの実行結果（--runs a,b）を渡すと、同じシード同士の差の分布とばらつきの目安（compare --paired と同じ）も付ける。
 * スナップショットを一つ読むのに約0.3秒（--raw なら約0.01秒）。シードごとに別のプロセスで並列に計算する（--jobs）。
 */
import { cpus } from 'os';
import { spawn } from 'child_process';
import { existsSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs, KIND_NAMES } from './common';
import { decodeState, readState } from './lib/state';
import { pool, readMeta, snapsOf } from './lib/runs';
import { paired, pairedRow, PAIRED_HEAD, PAIRED_NOTE } from './lib/stats';

export const NAMED: Record<string, { expr: string; label: string; raw?: boolean }> = {
  campStore: { label: 'ゴブリンの集落の蓄えの合計', expr: 'e.camps.filter((c) => c.kind === 0 && c.id >= 0).reduce((a, c) => a + (c.store ?? 0), 0)' },
  camps: { label: 'ゴブリンの集落の数', expr: 'e.camps.filter((c) => c.kind === 0 && c.id >= 0).length' },
  gobMouth: { label: 'ゴブリンが新しく集落を作りに入れる地表の横穴があった日の割合（％。横穴が開いていて竜が近くになく、近くに住める場所がある。600回の更新ごとの判定 gobMouthOk の 1 か 2）', expr: '(s.eco.GM ?? []).some((v) => v >= 1) ? 100 : 0', raw: true },
  gobMouthRich: { label: 'そのうち、食べ物の足りる場所のある横穴があった日の割合（％。gobMouthOk が 1）', expr: '(s.eco.GM ?? []).some((v) => v === 1) ? 100 : 0', raw: true },
  campDays: { label: 'ゴブリンの集落があった日の割合（％。日次スナップショットの時点で一つ以上）', expr: 'e.camps.some((c) => c.kind === 0 && c.id >= 0) ? 100 : 0' },
  goblins: { label: '生きているゴブリンの数', expr: 'e.list.filter((c) => c.k === 12 && !c.dead).length' },
  vassalCamps: { label: 'オークに従う集落の数', expr: 'e.camps.filter((c) => c.kind === 0 && (c.lx || c.ly)).length' },
  warrenStore: { label: 'コボルトの住処の蓄えの合計', expr: 'e.warrens.reduce((a, v) => a + (v.store ?? 0), 0)' },
  warrens: { label: 'コボルトの住処の数', expr: 'e.warrens.length' },
  burrows: { label: '大ネズミの巣穴の数', expr: 'e.burrows.length' },
  hungryRats: { label: '腹を空かせた大ネズミの割合（％）', expr: '(() => { const r = e.list.filter((c) => c.k === 2 && !c.dead); return r.length ? 100 * r.filter((c) => c.hungry).length / r.length : NaN; })()' },
  monsterKinds: { label: '同時にいるモンスターの種の数（にぎわい。冒険者・ドワーフを除き、1匹以上いれば数える）', expr: 'new Set(e.list.filter((c) => !c.dead && c.k !== K[\'冒険者\'] && c.k !== K[\'ドワーフ\']).map((c) => c.k)).size' },
  alive: { label: '生きている生き物の数', expr: 'e.list.filter((c) => !c.dead).length' },
  nextId: { label: '生き物の番号（これまでに現れた数）', expr: 's.eco.n', raw: true },
};

const a = parseArgs(process.argv.slice(2));

/** 一つの実行結果のフォルダについて、日ごとの値を計算して JSON で書き出す（子プロセス） */
function one(dir: string, expr: string, raw: boolean, d0: number, d1: number) {
  const K: Record<string, number> = {};
  KIND_NAMES.forEach((n, i) => (K[n] = i));
  const f = new Function('w', 'e', 'm', 's', 'K', `return (${expr});`);
  const sd = snapsOf(dir);
  const days = existsSync(sd) ? readdirSync(sd).map((x) => /^d(\d+)\.json\.gz$/.exec(x)).filter(Boolean).map((x) => +x![1]).filter((d) => d >= d0 && d <= d1 && d <= (readMeta(dir)?.days ?? 1e9)).sort((p, q) => p - q) : [];
  const out: [number, number][] = [];
  for (const d of days) {
    const s = readState(join(sd, `d${String(d).padStart(3, '0')}.json.gz`));
    const w = raw ? null : decodeState(s);
    out.push([d, +f(w, w?.eco, w?.map, s, K)]);
  }
  process.stdout.write(JSON.stringify({ seed: readMeta(dir)?.seed, out }));
}

async function main() {
  const named = a.name ? NAMED[a.name] : undefined;
  if (a.name && !named) throw new Error(`知らない名前：${a.name}（${Object.keys(NAMED).join(', ')}）`);
  const expr = named?.expr ?? a.expr;
  if (!expr) throw new Error('--name か --expr を指定してください');
  const raw = !!(a.raw || named?.raw);
  const [d0, d1] = (a.days || '0-9999').split('-').map(Number);
  if (a.one) return one(a.one, expr, raw, d0, d1);
  const runs = (a.runs || '').split(',').filter(Boolean);
  const agg = a.agg || 'mean';
  const t0 = Date.now();
  const res: { seed: string; out: [number, number][] }[][] = [];
  for (const r of runs) {
    const dirs = existsSync(join(r, 'meta.json')) ? [r] : readdirSync(r).filter((d) => /^\d\d-/.test(d)).sort().map((d) => join(r, d));
    res.push(await pool(dirs.map((d) => ({ w: 1, f: () => new Promise<{ seed: string; out: [number, number][] }>((ok, ng) => {
      let txt = '';
      const p = spawn(process.execPath, [process.argv[1], '--one', d, '--expr', expr, '--days', `${d0}-${d1}`, ...(raw ? ['--raw'] : [])], { stdio: ['ignore', 'pipe', 'inherit'] });
      p.stdout.on('data', (b) => (txt += b));
      p.on('exit', (c) => (c === 0 ? ok(JSON.parse(txt)) : ng(new Error(`失敗：${d}`))));
    }) })), +(a.jobs || cpus().length)));
  }
  const A = (v: number[]) => (!v.length ? NaN : agg === 'max' ? Math.max(...v) : agg === 'last' ? v[v.length - 1] : agg === 'sum' ? v.reduce((x, y) => x + y, 0) : v.reduce((x, y) => x + y, 0) / v.length);
  const fx = (v: number) => (isFinite(v) ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : '—');
  const L = [`# ${named?.label ?? expr}`, '', `式：\`${expr}\`、${d0}〜${d1 === 9999 ? '' : d1}日目、シードごとのまとめ：${agg}`, ''];
  L.push(`| シード | ${runs.map((r) => `${r}（${agg}）`).join(' | ')} | ${runs.map((r) => `${r}（日ごと）`).join(' | ')} |`, `|---|${runs.map(() => '---:').join('|')}|${runs.map(() => '---').join('|')}|`);
  const seeds = res[0].map((x) => x.seed);
  for (const s of seeds) {
    const rows = res.map((rr) => rr.find((x) => x.seed === s));
    L.push(`| ${s} | ${rows.map((x) => fx(A(x?.out.map((p) => p[1]) ?? []))).join(' | ')} | ${rows.map((x) => (x?.out ?? []).map((p) => fx(p[1])).join(' ')).join(' | ')} |`);
  }
  if (res.length >= 2) {
    const va = seeds.map((s) => A(res[0].find((x) => x.seed === s)?.out.map((p) => p[1]) ?? []));
    const vb = seeds.map((s) => A(res[res.length - 1].find((x) => x.seed === s)?.out.map((p) => p[1]) ?? []));
    L.push('', `## A/B 比較（同じシード同士）：${runs[0]} → ${runs[runs.length - 1]}`, '', PAIRED_NOTE, '', ...PAIRED_HEAD, pairedRow(named?.label ?? expr, paired(va, vb, seeds)));
  }
  L.push('', `（${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
  console.log(L.join('\n'));
  if (a.out) writeFileSync(a.out, L.join('\n'));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
