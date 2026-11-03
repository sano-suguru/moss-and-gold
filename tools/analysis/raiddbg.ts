/** 夜の盗みに出られない理由を数える（三歩目の調べ物）。node tools/analysis/launch.mjs raiddbg --seed かしたれ --from 10 --to 14 */
import { DAY_TICKS, tick } from './lib/engine';
import { openAt } from './lib/open';
import { TILE } from '../../src/mapgen';
const argv = process.argv.slice(2);
const opt = (k: string, d = '') => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
(async () => {
  const { w } = await openAt(opt('seed', 'かしたれ'), +opt('from', '10') * DAY_TICKS, {});
  const e = w.eco as any;
  const R: Record<string, number> = {};
  const add = (k: string) => (R[k] = (R[k] ?? 0) + 1);
  const end = +opt('to', '14') * DAY_TICKS;
  while (w.tick < end) {
    tick(w);
    if (w.tick % 100 !== 0) continue;
    const night = e.isNight();
    for (const p of e.parties) {
      if ((p.camp ?? -1) < 0) { add(night ? '夜・一行は焚き火なし' : '昼'); continue; }
      if (!night) { add('昼の焚き火'); continue; }
      const fx = (p.camp % w.map.w) * TILE + 8, fy = Math.floor(p.camp / w.map.w) * TILE + 8;
      const camps = e.camps.filter((c: any) => c.id >= 0 && c.kind === 0);
      if (!camps.length) { add('夜の焚き火・集落なし'); continue; }
      const d = Math.min(...camps.map((c: any) => Math.hypot(c.x - fx, c.y - fy) / TILE));
      const cp = camps.find((c: any) => Math.hypot(c.x - fx, c.y - fy) / TILE === d);
      add(d < 10 ? '夜の焚き火・集落が10マス未満' : d < 50 ? `夜の焚き火・集落10〜50マス（蓄え${(cp.store ?? 0) < e.campStoreGoal(cp) * 0.7 ? '乏しい' : '十分'}、残り${(p.campUntil - e.step) > d * 25 + 150 ? '足りる' : '足りない'}）` : d < 80 ? '夜の焚き火・集落50〜80マス' : '夜の焚き火・集落80マスより遠い');
    }
  }
  console.log(R);
})();
