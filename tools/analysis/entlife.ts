import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc'); const m = w.map;
for (const d of [6, 12, 18, 24]) {
  while (w.tick < d * DAY_TICKS) w.step();
  let moss = 0, fung = 0; for (let y = 0; y < 14; y++) for (let x = m.entrance.x - 10; x <= m.entrance.x + 11; x++) { const k = y * m.w + x; moss += w.moss[k]; fung += w.fungus[k]; }
  const near = w.eco.list.filter((c) => !c.dead && Math.abs(c.x / 16 - m.entrance.x) + c.y / 16 < 28 && c.k !== 25).map((c) => c.k);
  console.log(`d${d} 入口のまわりの苔 ${moss} キノコ ${fung} 生き物 ${near.length}（${[...new Set(near)].join(',')}）`);
}
