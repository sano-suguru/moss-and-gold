/** 眠りの様子：種ごとに、眠っている割合と、眠りの深さの内訳を、時刻ごとに数える */
import { DAY_TICKS, World } from '../../src/world';
import { KIND_NAMES, parseArgs } from './common';
const a = parseArgs(process.argv.slice(2));
const w = new World(a.seed || 'abc'); const e = w.eco as any;
const stat: Record<string, { n: number; s: number; day: number; night: number; dn: number; nn: number }> = {};
while (w.tick < +(a.days || 8) * DAY_TICKS) {
  w.step();
  if (w.tick % 300 || w.tick < DAY_TICKS) continue;
  const ph = (w.tick % DAY_TICKS) / DAY_TICKS; const night = ph > 0.79 || ph < 0.18;
  for (const c of e.list) { if (c.dead || c.away) continue; const k = KIND_NAMES[c.k]; const st = (stat[k] ??= { n: 0, s: 0, day: 0, night: 0, dn: 0, nn: 0 }); st.n++; if (c.sleep > 0) st.s++; if (night) { st.nn++; if (c.sleep > 0) st.night++; } else { st.dn++; if (c.sleep > 0) st.day++; } }
}
for (const [k, v] of Object.entries(stat).sort((p, q) => q[1].n - p[1].n)) if (v.s) console.log(`${k}\t眠り ${(v.s / v.n * 100).toFixed(0)}%\t昼 ${(v.day / Math.max(1, v.dn) * 100).toFixed(0)}%\t夜 ${(v.night / Math.max(1, v.nn) * 100).toFixed(0)}%`);
