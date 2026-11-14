/**
 * ベース（HEAD など）と作業ツリーを比べる。実行結果はシミュレーションのソースのハッシュごとのキャッシュ（runs/.cache、lib/runs.ts）から再利用するので、ベースはふつう再実行しない。
 *
 *   npm run ab -- --preset quick
 *       変更の効果を見る標準：8シード、HEAD の10日目のスナップショットから、HEAD と作業ツリーのそれぞれで18日目まで続けて、A/B 比較する
 *       （HEAD の続きはキャッシュにあれば実行しない。作業ツリーは8日分×8シードだけ）
 *   npm run ab -- --preset final
 *       最終確認：16シード×25日、0日目から
 *   npm run ab -- --base HEAD~1 --fork 5 --days 15 --seeds abc,かしたれ,seed4
 *       ベースの5日目のスナップショットから、ベースと作業ツリーを15日目まで続けて、npm run compare で並べる
 *   npm run ab -- --base HEAD~1 --seeds abc,seed5 --days 10
 *       0日目から同じ日数を実行し、samples.jsonl と checkpoint.json が1バイトも違わないかを確かめる
 *       （リファクタリングや高速化など、展開を変えないはずの変更のチェック）。違えば、最初に違うログの日を示し、終了コードを 1 にする
 *   npm run ab -- --resume-check 7 --seeds かしたれ --days 10
 *       作業ツリーで、通しで実行したものと、7日目で止めて再開したものの、ログと状態が一致するかを確かめる（キャッシュは使わない）
 *
 * --base を省くと HEAD（コミット前の変更と比べる）。--seeds 8 / 16 は固定のシードの組。--jobs は並列に実行する数（既定は CPU の数）。
 * 比較は <out>/compare.md（シードごとの差と、その分布・ばらつきの目安。compare.ts の --paired）。
 */
import { cpus } from 'node:os';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { parseArgs } from './common';
import { defaultAdv, getBin, pool } from './lib/runs';
import { dirName, runSets } from './lib/batchrun';
import { parseSeeds, PRESETS } from './lib/seeds';

const a = parseArgs(process.argv.slice(2));
const preset = a.preset ? PRESETS[a.preset] : undefined;
if (a.preset && !preset) throw new Error(`知らない preset：${a.preset}（${Object.keys(PRESETS).join(', ')}）`);
const seeds = parseSeeds(a.seeds, preset?.seeds ?? ['abc']);
const days = +(a.days || preset?.days || 10);
const fork = a.fork ? +a.fork : preset?.fork;
const jobs = +(a.jobs || cpus().length);
const tag = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const out = a.out || `runs/ab-${a.preset ? a.preset + '-' : ''}${tag}`;
mkdirSync(out, { recursive: true });
const baseRef = a.base || 'HEAD';

const run = (args: string[], quiet = true) =>
  new Promise<void>((res, rej) => {
    const p = spawn(process.execPath, args, { stdio: ['ignore', quiet ? 'ignore' : 'inherit', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`失敗：node ${args.join(' ')}`))));
  });
const read = (f: string) => (existsSync(f) ? readFileSync(f) : Buffer.alloc(0));
function firstDiff(fa: string, fb: string): string {
  const A = read(fa).toString().split('\n');
  const B = read(fb).toString().split('\n');
  for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) {
    try { return `${JSON.parse(A[i] || B[i]).day} 日目のログから違う`; } catch { return `${i + 1} 行目から違う`; }
  }
  return '';
}

async function main() {
  const t0 = Date.now();
  if (a['resume-check']) {
    const split = +a['resume-check'];
    const sim = (await getBin('sim')).path;
    const B = ['--budget', '1e9'];
    rmSync(join(out, 'full'), { recursive: true, force: true });
    rmSync(join(out, 'split'), { recursive: true, force: true });
    await pool(seeds.flatMap((s, i) => [
      { w: days, f: () => run([sim, '--seed', s, '--days', String(days), '--out', `${out}/full/${dirName(seeds, i)}`, ...B]) },
      { w: days, f: async () => {
        await run([sim, '--seed', s, '--days', String(split), '--out', `${out}/split/${dirName(seeds, i)}`, ...B]);
        await run([sim, '--resume', `${out}/split/${dirName(seeds, i)}`, '--days', String(days), ...B]);
      } },
    ]), jobs);
    let ok = true;
    for (let i = 0; i < seeds.length; i++) {
      const f = (x: string, n: string) => `${out}/${x}/${dirName(seeds, i)}/${n}`;
      const files = ['checkpoint.json', 'samples.jsonl', 'deaths.jsonl', 'births.jsonl', 'settle.jsonl', 'events.jsonl'];
      const bad = files.filter((n) => !read(f('full', n)).equals(read(f('split', n))));
      ok &&= !bad.length;
      console.log(`${seeds[i]}：${split}日目で中断・再開した${days}日目の状態とログは、通しと${bad.length ? `一致しない（${bad.join('、')}）` : '一致'}`);
    }
    process.exit(ok ? 0 : 1);
  }
  const base = await getBin('sim', baseRef);
  const cur = await getBin('sim');
  const adv = a['adv-max'] !== undefined ? +a['adv-max'] : defaultAdv();
  console.log(`ベース ${baseRef}（${base.simHash}）と作業ツリー（${cur.simHash}）${base.simHash === cur.simHash ? '：シミュレーションのソースは同じ' : ''}、${seeds.length} シード、${fork ? `ベースの${fork}日目のスナップショットから` : '0日目から'}${days}日目まで（${out}）`);
  await runSets([
    { seeds, days, adv, ver: base, out: join(out, 'base') },
    { seeds, days, adv, ver: cur, fork: fork ? { day: fork, base } : undefined, out: join(out, 'new') },
  ], jobs);
  console.log(`実行終わり（${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
  let same = true;
  if (!fork) {
    for (let i = 0; i < seeds.length; i++) {
      const d = (f: string) => [`${out}/base/${dirName(seeds, i)}/${f}`, `${out}/new/${dirName(seeds, i)}/${f}`] as const;
      const sOk = read(d('samples.jsonl')[0]).equals(read(d('samples.jsonl')[1]));
      const cOk = read(d('checkpoint.json')[0]).equals(read(d('checkpoint.json')[1]));
      same &&= sOk && cOk;
      console.log(`${seeds[i]}：${sOk && cOk ? '同じ（samples と checkpoint が1バイトも違わない）' : `違う（${sOk ? 'samples は同じ' : firstDiff(...d('samples.jsonl'))}、checkpoint ${cOk ? '同じ' : '違う'}）`}`);
    }
  }
  if (!same || fork || a.preset || a.compare) {
    const cmp = await getBin('compare');
    await run([cmp.path, '--runs', `${out}/base,${out}/new`, '--names', `ベース（${baseRef}）,作業ツリー`, '--out', `${out}/compare.md`, '--paired', ...(fork ? ['--since', String(fork)] : []), ...(a.goals ? ['--goals', a.goals] : [])]);
    console.log(`比較：${out}/compare.md（${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
  }
  if (!fork && !a.preset) process.exit(same ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
