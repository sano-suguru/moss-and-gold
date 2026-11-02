import { DAY_TICKS, World } from '../../src/world';
const w = new World('かしたれ'); const e = w.eco as any;
for (const d of [8, 12, 16, 20]) {
  while (w.tick < d * DAY_TICKS) w.step();
  const ds = e.list.filter((c: any) => c.k === 28 && !c.dead);
  const byst: Record<string, number> = {}; for (const c of ds) { const k = `st${c.st}act${c.act}`; byst[k] = (byst[k] ?? 0) + 1; }
  console.log(`d${d} ドワーフ${ds.length} hold=${e.hold ? e.hold.stage : 'なし'} ${JSON.stringify(byst)} 例: ${ds.slice(0, 4).map((c: any) => `(${(c.x / 16).toFixed(0)},${(c.y / 16).toFixed(0)}) 食${c.food} 飢${c.sinceMeal} flee${c.flee}`).join(' ')}`);
}
