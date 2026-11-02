/** コボルトとコウモリの重なりを、場面ごとに分けて数える */
import { DAY_TICKS, World } from '../../src/world';
const w = new World('abc'); const e = w.eco as any; const m = w.map;
const st: Record<string, { n: number; o: number }> = {};
const add = (k: string, o: boolean) => { const s = (st[k] ??= { n: 0, o: 0 }); s.n++; if (o) s.o++; };
while (w.tick < 6 * DAY_TICKS) {
  w.step();
  if (w.tick % 600 || w.tick < DAY_TICKS) continue;
  for (const g of e.groups.values()) {
    if (g.members.length < 2 || (g.k !== 10 && g.k !== 1)) continue;
    for (const c of g.members) {
      const ov = g.members.some((o: any) => o !== c && Math.abs(o.x - c.x) < 4 && Math.abs(o.y - c.y) < 4);
      const k = Math.floor(c.y / 16) * m.w + Math.floor(c.x / 16);
      if (g.k === 1) add(`コウモリ ${c.st === 0 ? 'ねぐら' : c.ref2 ? 'ヴァンパイアのそば' : '飛んでいる'}`, ov);
      else {
        const open = [k + 1, k - 1, k + m.w, k - m.w].filter((q) => !m.solid[q]).length;
        add(`コボルト ${open <= 2 ? '細い通路' : '広い所'} ${c.sleep ? '眠り' : c.act === 2 ? '作業' : c.act === 1 ? '移動' : '待機'}`, ov);
      }
    }
  }
}
for (const [k, v] of Object.entries(st).sort()) console.log(`${k}\t${(v.o / v.n * 100).toFixed(0)}%（${v.o}/${v.n}）`);
