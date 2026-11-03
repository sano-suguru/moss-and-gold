/** 群れの仲間どうしが、どれくらい重なって見えるかを数える（中心が4px以内なら重なり） */
import { DAY_TICKS, World } from '../../src/world';
import { KIND_NAMES } from './common';
const w = new World('abc'); const e = w.eco as any;
const st: Record<string, { n: number; o: number }> = {};
while (w.tick < 6 * DAY_TICKS) {
  w.step();
  if (w.tick % 600 || w.tick < DAY_TICKS) continue;
  for (const g of e.groups.values()) {
    if (g.members.length < 2) continue;
    for (const c of g.members) {
      const k = KIND_NAMES[c.k]; const s = (st[k] ??= { n: 0, o: 0 }); s.n++;
      if (g.members.some((o: any) => o !== c && Math.abs(o.x - c.x) < 4 && Math.abs(o.y - c.y) < 4)) s.o++;
    }
  }
}
for (const [k, v] of Object.entries(st)) console.log(`${k}\t重なっている割合 ${(v.o / v.n * 100).toFixed(0)}%（${v.n}）`);
