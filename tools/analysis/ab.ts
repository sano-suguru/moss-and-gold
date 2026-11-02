/**
 * 前の版といまの版を比べる。
 *
 *   npm run ab -- --base HEAD~1 --seeds abc,seed5 --days 10
 *       前の版（git の参照）といまの版を同じシード・日数で回し、samples.jsonl と checkpoint.json が1バイトも違わないかを確かめる
 *       （整理や高速化など、展開を変えないはずの変更の確かめ）。違えば、最初に違う記録の日を示す
 *   npm run ab -- --resume-check 7 --seeds かしたれ --days 10
 *       いまの版で、通して回したものと、7日目で止めて続きから回したものの checkpoint が一致するかを確かめる
 *   npm run ab -- --base HEAD~1 --fork 5 --days 15 --seeds abc,かしたれ,seed4 --out runs/ab-x
 *       いまの版で5日目まで回した同じ途中の状態から、前の版といまの版を15日まで続けて回し、npm run compare で並べる
 *       （最初から回すより展開の分かれが小さく、短い日数で手直しの差が見える）
 *
 * --base を省くと HEAD（コミット前の変更と比べる）。--jobs 同時に回す数（既定は CPU の数）。
 */
import { execFileSync, spawn } from 'child_process';
import { cpus } from 'os';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'fs';
import { join, resolve } from 'path';
import { parseArgs } from './common';

const a = parseArgs(process.argv.slice(2));
const seeds = (a.seeds || 'abc').split(',').filter(Boolean);
const days = +(a.days || 10);
const jobs = +(a.jobs || cpus().length);
const ROOT = resolve('.');
const tag = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const out = a.out || `runs/ab-${tag}`;
mkdirSync(out, { recursive: true });

function bundleCurrent(): string {
  execFileSync('npx', ['esbuild', 'tools/analysis/sim.ts', '--bundle', '--platform=node', `--outfile=${out}/sim-new.js`, '--log-level=warning'], { stdio: 'inherit' });
  return `${out}/sim-new.js`;
}
/** 前の版の sim を、git worktree に取り出して組み立てる */
function bundleBase(ref: string): string {
  const wt = join(ROOT, 'build', 'ab-base');
  if (existsSync(wt)) execFileSync('git', ['worktree', 'remove', '--force', wt], { stdio: 'ignore' });
  execFileSync('git', ['worktree', 'add', '--detach', wt, ref], { stdio: 'ignore' });
  if (!existsSync(join(wt, 'node_modules'))) symlinkSync(join(ROOT, 'node_modules'), join(wt, 'node_modules'));
  execFileSync(join(ROOT, 'node_modules/.bin/esbuild'), ['tools/analysis/sim.ts', '--bundle', '--platform=node', `--outfile=${join(ROOT, out, 'sim-base.js')}`, '--log-level=warning'], { cwd: wt, stdio: 'inherit' });
  execFileSync('git', ['worktree', 'remove', '--force', wt], { stdio: 'ignore' });
  return `${out}/sim-base.js`;
}
const run = (args: string[]) =>
  new Promise<void>((res, rej) => {
    const p = spawn('node', args, { stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`失敗：node ${args.join(' ')}`))));
  });
async function pool(tasks: (() => Promise<void>)[]) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, tasks.length) }, async () => {
    while (i < tasks.length) await tasks[i++]();
  }));
}
const dirName = (i: number) => `${String(i + 1).padStart(2, '0')}-${seeds[i].replace(/[\\/:*?"<>|\s]/g, '_')}`;
const read = (f: string) => (existsSync(f) ? readFileSync(f) : Buffer.alloc(0));
function firstDiff(fa: string, fb: string): string {
  const A = read(fa).toString().split('\n');
  const B = read(fb).toString().split('\n');
  for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) {
    try { return `${JSON.parse(A[i] || B[i]).day} 日目の記録から違う`; } catch { return `${i + 1} 行目から違う`; }
  }
  return '';
}

async function main() {
  const B = ['--budget', '100000'];
  if (a['resume-check']) {
    const split = +a['resume-check'];
    const sim = bundleCurrent();
    await pool(seeds.flatMap((s, i) => [
      () => run([sim, '--seed', s, '--days', String(days), '--out', `${out}/full/${dirName(i)}`, ...B]),
      async () => {
        await run([sim, '--seed', s, '--days', String(split), '--out', `${out}/split/${dirName(i)}`, ...B]);
        await run([sim, '--resume', `${out}/split/${dirName(i)}`, '--days', String(days), ...B]);
      },
    ]));
    let ok = true;
    for (let i = 0; i < seeds.length; i++) {
      const same = read(`${out}/full/${dirName(i)}/checkpoint.json`).equals(read(`${out}/split/${dirName(i)}/checkpoint.json`));
      ok &&= same;
      console.log(`${seeds[i]}：${split}日目で分けて回した${days}日目の状態は、通しと${same ? '一致' : '一致しない'}`);
    }
    process.exit(ok ? 0 : 1);
  }
  const base = bundleBase(a.base || 'HEAD');
  const cur = bundleCurrent();
  if (a.fork) {
    const fork = +a.fork;
    // 同じ途中の状態を作り、二つの版で続ける
    await pool(seeds.map((s, i) => () => run([cur, '--seed', s, '--days', String(fork), '--out', `${out}/start/${dirName(i)}`, ...B])));
    for (const v of ['base', 'new']) for (let i = 0; i < seeds.length; i++) cpSync(`${out}/start/${dirName(i)}`, `${out}/${v}/${dirName(i)}`, { recursive: true });
    await pool(seeds.flatMap((_, i) => [
      () => run([base, '--resume', `${out}/base/${dirName(i)}`, '--days', String(days), ...B]),
      () => run([cur, '--resume', `${out}/new/${dirName(i)}`, '--days', String(days), ...B]),
    ]));
    rmSync(`${out}/start`, { recursive: true, force: true });
    execFileSync('npx', ['esbuild', 'tools/analysis/compare.ts', '--bundle', '--platform=node', '--outfile=build/compare.js', '--log-level=warning'], { stdio: 'inherit' });
    execFileSync('node', ['build/compare.js', '--runs', `${out}/base,${out}/new`, '--names', `前の版（${a.base || 'HEAD'}）,いまの版`, '--out', `${out}/compare.md`, ...(a.goals ? ['--goals', a.goals] : [])], { stdio: 'inherit' });
    console.log(`\n${fork}日目の同じ状態から${days}日目まで。比較：${out}/compare.md`);
    return;
  }
  await pool(seeds.flatMap((s, i) => [
    () => run([base, '--seed', s, '--days', String(days), '--out', `${out}/base/${dirName(i)}`, ...B]),
    () => run([cur, '--seed', s, '--days', String(days), '--out', `${out}/new/${dirName(i)}`, ...B]),
  ]));
  let same = true;
  for (let i = 0; i < seeds.length; i++) {
    const d = (f: string) => [`${out}/base/${dirName(i)}/${f}`, `${out}/new/${dirName(i)}/${f}`] as const;
    const sOk = read(d('samples.jsonl')[0]).equals(read(d('samples.jsonl')[1]));
    const cOk = read(d('checkpoint.json')[0]).equals(read(d('checkpoint.json')[1]));
    same &&= sOk && cOk;
    console.log(`${seeds[i]}：${sOk && cOk ? '同じ（samples と checkpoint が1バイトも違わない）' : `違う（${sOk ? 'samples は同じ' : firstDiff(...d('samples.jsonl'))}、checkpoint ${cOk ? '同じ' : '違う'}）`}`);
  }
  process.exit(same ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
