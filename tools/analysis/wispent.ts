import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc'); const e = w.eco as any; const m = w.map;
for (const d of [2, 4, 6, 8, 12, 16, 20]) {
  while (w.tick < d * DAY_TICKS) w.step();
  const all = e.list.filter((c: any) => c.k === 0 && !c.dead);
  const near = all.filter((c: any) => Math.abs(c.x / 16 - m.entrance.x) + c.y / 16 < 20);
  let moss = 0; for (let y = 0; y < 14; y++) for (let x = m.entrance.x - 10; x <= m.entrance.x + 11; x++) moss += w.moss[y * m.w + x];
  console.log(`d${d} ウィスプ ${all.length} 入口から20マス以内 ${near.length} 入口のまわりの苔 ${moss}`);
}
