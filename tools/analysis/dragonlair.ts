import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc'); const e = w.eco as any; const m = w.map;
for (const d of [6, 10, 14, 18, 22]) {
  while (w.tick < d * DAY_TICKS) w.step();
  const dr = e.list.find((c: any) => c.k === 24 && !c.dead);
  if (!dr) { console.log(`d${d} ドラゴンなし`); continue; }
  const h = e.piles.find((p: any) => p.id === dr.ref);
  const g = e.list.find((c: any) => c.k === 21 && !c.dead);
  console.log(`d${d} 寝床 (${h ? Math.round(h.x / 16) + ',' + Math.round(h.y / 16) : '-'}) 金貨${h ? h.gold : '-'} 宝物庫?${h ? m.vault[Math.floor(h.y / 16) * m.w + Math.floor(h.x / 16)] : '-'} 持ち運び${dr.gold} ゴーレムとの距離${g ? Math.round(Math.hypot(g.x - dr.x, g.y - dr.y) / 16) : '-'}マス`);
}
