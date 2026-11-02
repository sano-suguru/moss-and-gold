import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const a0 = w.availableNutrients();
let prev = a0;
const days = +(process.argv[3] || 10);
for (let d = 1; d <= days; d++) {
  for (let i = 0; i < DAY_TICKS; i++) w.step();
  const a = w.availableNutrients();
  let mats = 0; for (let k = 0; k < w.mat.length; k++) if (w.mat[k] > 50) mats++;
  let rub = 0; for (let k = 0; k < w.map.rubble.length; k++) rub += w.map.rubble[k];
  console.log(`d${d} 使える養分 ${a} (前日比 ${((a / prev - 1) * 100).toFixed(1)}%) 総量 ${w.totalNutrients()} 生まれた ${w.born} 流れ出た ${w.washed} 持ち込み ${w.eco.imported} 持ち出し ${w.eco.exported} 膜 ${mats} 瓦礫 ${rub} 風化 ${w.weathered} 生き物 ${w.eco.list.filter(c => !c.dead).length}`);
  prev = a;
}
