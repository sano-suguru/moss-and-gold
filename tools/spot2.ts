import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
for (let i = 0; i < DAY_TICKS * 2.2; i++) w.step();
const alive = w.eco.list.filter(c => !c.dead && !c.away);
const lit = (c: any) => { const k = Math.floor(c.y / 16) * w.map.w + Math.floor(c.x / 16); return w.lightBase[k] / 1000 * 1 + w.moss[k] / 255; };
for (const kind of [2, 3, 4]) {
  let best: any = null, bv = -1;
  for (const c of alive.filter(c => c.k === kind)) { const v = lit(c) + alive.filter(o => o.k >= 2 && Math.abs(o.x - c.x) < 120 && Math.abs(o.y - c.y) < 80).length * 0.3; if (v > bv) { bv = v; best = c; } }
  console.log(kind, best && [Math.round(best.x), Math.round(best.y), lit(best).toFixed(2)]);
}
