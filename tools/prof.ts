import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
let t0 = Date.now();
for (let i = 0; i < DAY_TICKS * 3; i++) { w.step(); if (i % 5000 === 0 && i) { console.log(i, ((Date.now() - t0) / 5000).toFixed(3), 'ms/tick', 'alive', w.eco.list.filter(c => !c.dead).length); t0 = Date.now(); } }
