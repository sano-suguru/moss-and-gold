import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
const m = w.map;
const total0 = w.totalNutrients();
console.log('springs', m.springs.length, 'sinks', m.sinks.length, 'lava tiles', m.lava.reduce((a, b) => a + b, 0), 'nutrients', total0);
const t0 = Date.now();
for (let day = 0; day < 4; day++) {
  for (let q = 0; q < 4; q++) {
    for (let i = 0; i < DAY_TICKS / 4; i++) w.step();
    let wet = 0, deep = 0, mossT = 0, mossSum = 0, wsum = 0;
    for (let k = 0; k < w.water.length; k++) { if (w.water[k] > 4) wet++; if (w.water[k] > 120) deep++; wsum += w.water[k]; if (w.moss[k] > 20) { mossT++; } mossSum += w.moss[k]; }
    console.log(`day ${day + 1}.${q}: wet ${wet} deep ${deep} water ${wsum} mossTiles ${mossT} mossSum ${mossSum} total ${w.totalNutrients()} ${w.totalNutrients() === total0 ? 'OK' : 'NG'}`);
  }
}
console.log('ms', Date.now() - t0);
let moistOK = 0, floors = 0;
for (let k = 0; k < w.moist.length; k++) if (!m.solid[k]) { floors++; if (w.moist[k] >= 110) moistOK++; }
console.log('moist>=110', moistOK, '/', floors);
