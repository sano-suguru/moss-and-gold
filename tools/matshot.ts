import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
for (let i = 0; i < DAY_TICKS * +(process.argv[3] || 2.5); i++) { w.step(); if (i % 20 === 0) w.updateSeen(); }
const m = w.map; let best = -1, bs = -1;
for (let k = 0; k < w.mat.length; k++) { if (w.mat[k] < 100) continue; const sc = (m.sealed[k] ? 0 : 1000) + w.mat[k]; if (sc > bs) { bs = sc; best = k; } }
const cam = { x: (best % m.w) * 16 + 8, y: Math.floor(best / m.w) * 16 + 8, zoom: 3 };
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: m.seed, tick: w.tick, cam, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log(JSON.stringify(cam), m.sealed[best]);
