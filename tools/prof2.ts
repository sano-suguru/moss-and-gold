import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
const W = w as any;
const timers: Record<string, number> = {};
const wrap = (obj: any, name: string, label: string) => { const f = obj[name].bind(obj); obj[name] = (...a: any[]) => { const t = performance.now(); const r = f(...a); timers[label] = (timers[label] ?? 0) + performance.now() - t; return r; }; };
wrap(W, 'waterStep', '水');
wrap(W, 'mossStep', '苔');
wrap(W, 'nutrientStep', '養分の元');
wrap(W, 'computeGlow', '光る苔の光');
wrap(W, 'checkCollapse', '崩落');
wrap(W.eco, 'update', '生き物');
wrap(W.eco, 'findPath', '道筋探し');
wrap(W.eco, 'rebuildGrid', '近所の表');
wrap(W, 'buildFloors', '地形の作り直し');
wrap(W, 'computeHeat', '熱');
wrap(W, 'computeLightBase', '光の筋');
const days = +(process.argv[2] || 3);
for (let d = 0; d < days; d++) {
  const t0 = performance.now();
  for (let i = 0; i < DAY_TICKS; i++) w.step();
  console.log(`d${d + 1}: ${((performance.now() - t0) / 1000).toFixed(1)}秒 生き物${w.eco.list.filter(c => !c.dead).length} 死骸${w.eco.list.filter(c => c.dead === 1).length} 掘った${w.digs.length}`);
}
const tot = Object.values(timers).reduce((a, b) => a + b, 0);
for (const [k, v] of Object.entries(timers).sort((a, b) => b[1] - a[1])) console.log(`  ${k}\t${(v / 1000).toFixed(1)}秒`);
