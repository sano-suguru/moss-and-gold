import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
const days = +(process.argv[2] || 0.3);
for (let i = 0; i < DAY_TICKS * days; i++) { w.step(); if (i % 20 === 0) { if (i % 200 === 0) w.computeGlow(); w.updateSeen(); } }
w.seen.fill(1);
const m = w.map; const tgt = process.argv[3] === 'vault' ? m.vaultCenter : m.deep;
const wm = w.eco.list.find(c => c.k === 22 && !c.dead)!;
const cam = process.argv[3] === 'worm' ? { x: Math.round(wm.x), y: Math.round(wm.y), zoom: 2 } : { x: tgt.x * 16 + 8, y: tgt.y * 16 + 8, zoom: 3 };
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: m.seed, tick: w.tick, cam, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log(JSON.stringify(cam), 'worm st', wm.st);
