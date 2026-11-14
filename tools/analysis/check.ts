/**
 * 短時間のチェック：大きな batch の前に、固定のスナップショットから2〜4シードを短く実行して、新しい挙動が実際に起きるかを見る（1〜2分）。
 *
 *   npm run check                     checks.ts のチェックをすべて
 *   npm run check -- --only 貢ぎ物     名前に「貢ぎ物」を含むものだけ
 *   npm run check -- --base HEAD~2    出発点のスナップショットを作るベース（既定 HEAD。そのコミットで0日目から from 日目まで実行した状態）
 *
 * チェックの中身は tools/analysis/checks.ts。目安に届かないものがあれば終了コードを 1 にする。
 *
 * 地形の作り方（src/mapgen.ts と、それが使う src/rng.ts）がベースと作業ツリーで違うときは、ベースのスナップショットを使わず、
 * 作業ツリーで0日目から実行する。地形はセーブせずシードから作り直すので、ベースのスナップショットを新しい地形に載せると、
 * 生き物が岩の中に置かれるなど、ありえない状態から始まってしまうため（迷路をなくした変更で、埋まった生き物を床へ出すチェックが落ちた）。
 */
import { cpus } from 'node:os';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './common';
import { CHECKS, type Recs } from './checks';
import { dayName, defaultAdv, ensureRun, getBin, pool } from './lib/runs';
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
  for (const c of checks) for (const s of c.seeds) jobsMap.set(`${s}|${c.from}|${c.to}`, { seed: s, from: c.from, to: c.to });
  console.log(`チェック ${checks.length} 件、実行するもの ${jobsMap.size}（ベース ${a.base || 'HEAD'}：${base.simHash}、作業ツリー：${ver.simHash}）`);
  const dirs = new Map<string, string>();
  await pool([...jobsMap].map(([k, j]) => ({ w: j.to - j.from, f: async () => {
    dirs.set(k, await ensureRun({ seed: j.seed, days: j.to, adv, ver, fork: sameMap ? { day: j.from, base } : undefined }, (s) => console.log(s)));
  } })), jobs);
  let bad = 0;
  console.log('');
  for (const c of checks) {
    const rs: Recs[] = c.seeds.map((s) => {
      const dir = dirs.get(`${s}|${c.from}|${c.to}`)!;
      const lo = c.from * DAY_TICKS;
      const hi = c.to * DAY_TICKS;
      return {
        seed: s, from: c.from, to: c.to,
        samples: rd(dir, 'samples', lo - 1, hi), deaths: rd(dir, 'deaths', lo, hi), births: rd(dir, 'births', lo, hi), exits: rd(dir, 'exits', lo, hi), settle: rd(dir, 'settle', lo, hi), events: rd(dir, 'events', lo, hi), stuck: rd(dir, 'stuck', lo, hi), hitch: rd(dir, 'hitch', lo, hi),
        state: (d: number) => readState(join(dir, 'snap', dayName(d))),
      };
    });
    const r = c.test(rs);
    if (!r.ok) bad++;
    console.log(`${r.ok ? '✅' : '❌'} ${c.name}：${r.value}`);
  }
  console.log(`\n（${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
  process.exit(bad ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
