/** 強いモンスターと弱い生き物が、どれくらい人の気配の濃い所にいるか（時間で平均） */
import { DAY_TICKS, World } from '../../src/world';
import { KIND_NAMES, parseArgs } from './common';
const a = parseArgs(process.argv.slice(2));
const w = new World(a.seed || 'abc'); const e = w.eco as any;
const st: Record<string, { n: number; p: number; near: number }> = {};
while (w.tick < +(a.days || 12) * DAY_TICKS) {
  w.step();
  if (w.tick % 600 || w.tick < DAY_TICKS) continue;
  for (const c of e.list) {
    if (c.dead || c.away || [0, 1, 5, 8].includes(c.k)) continue;
    const k = KIND_NAMES[c.k]; const s = (st[k] ??= { n: 0, p: 0, near: 0 });
    s.n++; const p = e.presenceAt(c.x, c.y); s.p += p; if (Math.abs(c.x / 16 - w.map.entrance.x) + c.y / 16 < 20) s.near++;
  }
}
for (const [k, v] of Object.entries(st).sort((x, y) => y[1].p / y[1].n - x[1].p / x[1].n)) console.log(`${k}\t気配の平均 ${(v.p / v.n).toFixed(2)}\t入口から20マス以内 ${(v.near / v.n * 100).toFixed(0)}%`);
