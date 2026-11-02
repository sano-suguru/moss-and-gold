import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
const t0 = w.totalNutrients();
for (let d = 1; d <= 10; d++) {
  for (let i = 0; i < DAY_TICKS; i++) w.step();
  const e = w.eco;
  console.log(`d${d} 総量 ${w.totalNutrients()} (はじめ比 ${((w.totalNutrients() / t0 - 1) * 100).toFixed(2)}%) 持ち込み ${e.imported} 持ち出し ${e.exported} 掘ったマス ${w.digs.length}`);
}
