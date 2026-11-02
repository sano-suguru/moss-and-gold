import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc'); const e = w.eco as any; const m = w.map;
for (const d of [6, 10, 14, 18, 22]) {
  while (w.tick < d * DAY_TICKS) w.step();
  let best = 0, bestAny = 0, open = 0, sealedN = 0, solidN = 0;
  for (let dy = -20; dy <= 20; dy++) for (let dx = -20; dx <= 20; dx++) {
    const x = m.deep.x + dx, y = m.deep.y + dy; if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
    const k = y * m.w + x; const v = e.manaAround(k);
    if (m.solid[k]) { solidN++; continue; } if (m.sealed[k]) { sealedN++; bestAny = Math.max(bestAny, v); continue; }
    open++; bestAny = Math.max(bestAny, v);
    if (!m.lava[k] && w.lightBase[k] === 0 && w.water[k] <= 40) best = Math.max(best, v);
  }
  console.log(`d${d} 深部のまわり 開いた床${open} 閉じた床${sealedN} 岩${solidN} 条件を満たす床の最大 ${best.toFixed(0)} 何でもよい最大 ${bestAny.toFixed(0)} 深部の中心のマナ ${w.mana[m.deep.y * m.w + m.deep.x]}`);
}
