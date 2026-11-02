import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
for (let i = 0; i < DAY_TICKS * 4.75; i++) { w.step(); if (i % 20 === 0) { if (i % 200 === 0) w.computeGlow(); w.updateSeen(); } }
const m = w.map; let best = 0, bx = 0, by = 0;
for (let y = 6; y < m.h - 6; y += 2) for (let x = 6; x < m.w - 6; x += 2) { let s = 0; for (let dy = -5; dy <= 5; dy++) for (let dx = -8; dx <= 8; dx++) s += w.fungus[(y + dy) * m.w + x + dx]; if (s > best) { best = s; bx = x; by = y; } }
const myc = w.eco.list.find(c => c.k === 8 && !c.dead);
console.log('fungus', bx, by, best, 'myconid', myc ? [Math.round(myc.x), Math.round(myc.y)] : '-', 'ants', w.eco.colonies.map(c => [c.x, c.y]));
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: m.seed, tick: w.tick, cam: { x: bx * 16, y: by * 16, zoom: 3 }, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), digs: w.digs, eco: w.eco.serialize() }));
