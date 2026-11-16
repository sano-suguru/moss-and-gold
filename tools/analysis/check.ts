/**
 * 短時間のチェック：大きな batch の前に、固定のスナップショットから2〜4シードを短く実行して、新しい挙動が実際に起きるかを見る（1〜2分）。
 *
 *   npm run check                     checks.ts のチェックをすべて
 *   npm run check -- --only 貢ぎ物     名前に「貢ぎ物」を含むものだけ
 *   npm run check -- --base HEAD~2    出発点のスナップショットを作るベース（既定 HEAD。そのコミットで0日目から from 日目まで実行した状態）
 *
 * チェックの中身は tools/analysis/checks.ts。目安に届かないものがあれば終了コードを 1 にする。
 *
 * CI では実行を複数の runner に分ける（.github/workflows/deploy.yml）。分けても判定は最後に一か所でまとめて行うので、出力は分けないときと同じ。
 *   --shard 2/4 --list <file>   実行を、シードごとに4つに分けたうちの2つめだけ行い、判定はしない。作った実行のフォルダを
 *                               runs/.cache からの相対パスで <file> に書く（CI はそれを固めて最後のジョブへ渡す）
 *   --cached-only               実行がすべてキャッシュにそろっていなければ、シミュレーションせずに落ちる（渡し損ねを、黙って1台で全部実行し直さないため）
 * 分け方は CHECKS の（シード、開始日、終了日）だけで決める。どの runner も同じ分け方を計算するので、キャッシュの有無や CPU の数で変わってはいけない。
 * 一つのシードの実行（ベースの0日目からの実行と、そこから分かれる実行）は同じフォルダやロックを共有するので、シードの途中では分けない。
 *
 * 地形の作り方（src/mapgen.ts と、それが使う src/rng.ts）がベースと作業ツリーで違うときは、ベースのスナップショットを使わず、
 * 作業ツリーで0日目から実行する。地形はセーブせずシードから作り直すので、ベースのスナップショットを新しい地形に載せると、
 * 生き物が岩の中に置かれるなど、ありえない状態から始まってしまうため（迷路をなくした変更で、埋まった生き物を床へ出すチェックが落ちた）。
 */
import { cpus } from 'node:os';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from './common';
import { CHECKS, type Recs } from './checks';
import { CACHE, dayName, defaultAdv, ensureRun, getBin, pool, readMeta, runDir } from './lib/runs';
import { DAY_TICKS } from './lib/engine';
import { readState } from './lib/state';

const a = parseArgs(process.argv.slice(2));
const jobs = +(a.jobs || cpus().length);
const rd = (dir: string, f: string, lo: number, hi: number) =>
  existsSync(join(dir, `${f}.jsonl`))
    ? readFileSync(join(dir, `${f}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => typeof r.t !== 'number' || (r.t > lo && r.t <= hi))
    : [];

async function main() {
  const t0 = Date.now();
  const checks = CHECKS.filter((c) => !a.only || c.name.includes(a.only));
  const ver = await getBin('sim');
  const base = await getBin('sim', a.base || 'HEAD');
  const adv = defaultAdv();
  // 地形の作り方が違えば、ベースのスナップショットからは始めない（上のコメント）
  let sameMap = true;
  try {
    execFileSync('git', ['diff', '--quiet', a.base || 'HEAD', '--', 'src/mapgen.ts', 'src/rng.ts'], { stdio: 'ignore' });
  } catch {
    sameMap = false;
  }
  if (!sameMap) console.log('地形の作り方（src/mapgen.ts・src/rng.ts）がベースと違うので、ベースのスナップショットを使わず、作業ツリーで0日目から実行する');
  const jobsMap = new Map<string, { seed: string; from: number; to: number }>();
  // 一つのチェックが見る実行：seeds の from〜to 日目と、more の組（ほかのチェックと同じ組なら実行を共有する）
  const windows = (c: (typeof checks)[number]) => [{ seeds: c.seeds, from: c.from, to: c.to }, ...(c.more ?? [])];
  for (const c of checks) for (const wd of windows(c)) for (const s of wd.seeds) jobsMap.set(`${s}|${wd.from}|${wd.to}`, { seed: s, from: wd.from, to: wd.to });
  console.log(`チェック ${checks.length} 件、実行するもの ${jobsMap.size}（ベース ${a.base || 'HEAD'}：${base.simHash}、作業ツリー：${ver.simHash}）`);
  // ベースのスナップショットから分かれず、作業ツリーで0日目から実行するか（ensureRun と同じ条件）
  const pure = !sameMap || base.simHash === ver.simHash;
  let todo = [...jobsMap];
  if (a.shard) {
    const [i, n] = a.shard.split('/').map(Number);
    if (!(n >= 1 && i >= 1 && i <= n)) throw new Error(`--shard は 1/4 のように書く：${a.shard}`);
    const mine = new Set(shardSeeds([...jobsMap.values()], n, pure)[i - 1]);
    todo = todo.filter(([, j]) => mine.has(j.seed));
    console.log(`分担 ${i}/${n}：シード ${[...mine].join('、') || 'なし'}（実行するもの ${todo.length}）`);
  }
  if (a['cached-only']) {
    const missing = todo.filter(([, j]) => {
      const dir = runDir(ver.binHash, adv, j.seed, pure ? '0' : `f${j.from}-${base.simHash}`);
      return (readMeta(dir)?.tick ?? -1) < j.to * DAY_TICKS;
    });
    if (missing.length) {
      console.error(`キャッシュにそろっていない実行がある（--cached-only なので実行しない）：${missing.map(([k]) => k).join('、')}`);
      process.exit(1);
    }
  }
  const dirs = new Map<string, string>();
  await pool(todo.map(([k, j]) => ({ w: j.to - j.from, f: async () => {
    dirs.set(k, await ensureRun({ seed: j.seed, days: j.to, adv, ver, fork: sameMap ? { day: j.from, base } : undefined }, (s) => console.log(s)));
  } })), jobs);
  if (a.shard) {
    if (a.list) writeFileSync(a.list, [...new Set(dirs.values())].map((d) => `${relative(CACHE, d)}\n`).sort().join(''));
    console.log(`\n（${((Date.now() - t0) / 1000).toFixed(0)}秒。判定は全部の分担がそろってから行う）`);
    return;
  }
  let bad = 0;
  console.log('');
  for (const c of checks) {
    const rs: Recs[] = windows(c).flatMap((wd) => wd.seeds.map((s) => {
      const dir = dirs.get(`${s}|${wd.from}|${wd.to}`)!;
      const lo = wd.from * DAY_TICKS;
      const hi = wd.to * DAY_TICKS;
      return {
        seed: s, from: wd.from, to: wd.to,
        samples: rd(dir, 'samples', lo - 1, hi), deaths: rd(dir, 'deaths', lo, hi), births: rd(dir, 'births', lo, hi), exits: rd(dir, 'exits', lo, hi), settle: rd(dir, 'settle', lo, hi), events: rd(dir, 'events', lo, hi), stuck: rd(dir, 'stuck', lo, hi), hitch: rd(dir, 'hitch', lo, hi),
        state: (d: number) => readState(join(dir, 'snap', dayName(d))),
      };
    }));
    const r = c.test(rs);
    if (!r.ok) bad++;
    console.log(`${r.ok ? '✅' : '❌'} ${c.name}：${r.value}`);
  }
  console.log(`\n（${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
  process.exit(bad ? 1 : 0);
}
/**
 * シードを n 組に分ける。シードの重さは、実行する日数の見積もり（分かれる実行の日数の合計と、その元になるベースの0日目からの日数。
 * 0日目から実行するときは最後の日まで）。重いシードから、いちばん軽い組に入れていく。
 */
function shardSeeds(jobs: { seed: string; from: number; to: number }[], n: number, pure: boolean): string[][] {
  const w = new Map<string, number>();
  for (const s of new Set(jobs.map((j) => j.seed))) {
    const js = jobs.filter((j) => j.seed === s);
    const last = Math.max(...js.map((j) => j.to));
    w.set(s, pure ? last : Math.max(...js.map((j) => j.from)) + js.reduce((x, j) => x + j.to - j.from, 0));
  }
  const groups = Array.from({ length: n }, () => ({ w: 0, seeds: [] as string[] }));
  for (const s of [...w.keys()].sort((x, y) => w.get(y)! - w.get(x)! || (x < y ? -1 : 1))) {
    const g = groups.reduce((m, g) => (g.w < m.w ? g : m));
    g.seeds.push(s);
    g.w += w.get(s)!;
  }
  return groups.map((g) => g.seeds);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
