import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
let ts = 0;
const t0 = performance.now();
for (let i = 0; i < DAY_TICKS * 2; i++) { w.step(); if (i % 20 === 0) { const t = performance.now(); w.updateSeen(); ts += performance.now() - t; } }
console.log('2日', ((performance.now() - t0) / 1000).toFixed(1), '秒 うち「照らされた範囲」の更新', (ts / 1000).toFixed(1), '秒');
