import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc'); const e = w.eco as any; const m = w.map;
for (const d of [5, 10, 15, 20]) {
  while (w.tick < d * DAY_TICKS) w.step();
  const vals: number[] = []; let lair = 0, lairMax = 0, vaultMax = 0, deepMax = 0;
  for (let k = 0; k < m.solid.length; k++) {
    if (m.solid[k] || m.sealed[k] || m.lava[k]) continue;
    const v = e.manaAround(k); vals.push(v);
    if (e.inLair((k % m.w) * 16 + 8, Math.floor(k / m.w) * 16 + 8)) { lair++; lairMax = Math.max(lairMax, v); }
    if (m.vault[k]) vaultMax = Math.max(vaultMax, v);
    if (Math.abs(k % m.w - m.deep.x) + Math.abs(Math.floor(k / m.w) - m.deep.y) < 12) deepMax = Math.max(deepMax, v);
  }
  vals.sort((a, b) => b - a);
  const cnt = (t: number) => vals.filter((v) => v >= t).length;
  console.log(`d${d} 開いた床 ${vals.length}マス 最大 ${vals[0].toFixed(0)} 上位1% ${vals[Math.floor(vals.length * 0.01)].toFixed(0)} ≥20:${cnt(20)} ≥50:${cnt(50)} ≥80:${cnt(80)} ≥120:${cnt(120)} 縄張りの最大 ${lairMax.toFixed(0)}(${lair}) 宝物庫 ${vaultMax.toFixed(0)} 深部 ${deepMax.toFixed(0)} 深部は閉じている? ${m.sealed[m.deep.y * m.w + m.deep.x]}`);
}
