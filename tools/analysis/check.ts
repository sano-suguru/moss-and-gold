/**
 * 早めの確かめ：大きな batch の前に、決まった途中の状態から2〜4シードを短く回して、新しい流れが実際に起きるかを見る（1〜2分）。
 *
 *   npm run check                     checks.ts の確かめをすべて
 *   npm run check -- --only 貢ぎ物     名前に「貢ぎ物」を含むものだけ
 *   npm run check -- --base HEAD~2    出発点の状態を作る版（既定 HEAD。その版で最初から from 日目まで回した状態）
 *
 * 確かめの中身は tools/analysis/checks.ts。届かないものがあれば終わりの値を 1 にする。
 */
import { cpus } from 'os';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from './common';
import { CHECKS, Recs } from './checks';
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
  const jobsMap = new Map<string, { seed: string; from: number; to: number }>();
  for (const c of checks) for (const s of c.seeds) jobsMap.set(`${s}|${c.from}|${c.to}`, { seed: s, from: c.from, to: c.to });
  console.log(`確かめ ${checks.length} 件、回すもの ${jobsMap.size}（前の版 ${a.base || 'HEAD'}：${base.simHash}、いまの版：${ver.simHash}）`);
  const dirs = new Map<string, string>();
  await pool([...jobsMap].map(([k, j]) => ({ w: j.to - j.from, f: async () => {
    dirs.set(k, await ensureRun({ seed: j.seed, days: j.to, adv, ver, fork: { day: j.from, base } }, (s) => console.log(s)));
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
        samples: rd(dir, 'samples', lo - 1, hi), deaths: rd(dir, 'deaths', lo, hi), births: rd(dir, 'births', lo, hi), exits: rd(dir, 'exits', lo, hi), settle: rd(dir, 'settle', lo, hi), events: rd(dir, 'events', lo, hi),
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
