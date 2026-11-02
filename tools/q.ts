import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
for (let i = 0; i < 34500; i++) w.step();
const m = w.map;
for (let y = 56; y <= 68; y++) { let r = ''; for (let x = 112; x <= 128; x++) { const k = y * m.w + x; r += m.solid[k] ? '#' : m.lava[k] ? 'L' : w.water[k] > 40 ? '~' : w.water[k] > 10 ? ',' : '.'; } console.log(y, r); }
