import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
let cam: any = null;
for (let i = 0; i < DAY_TICKS * 8 && !cam; i++) { w.step(); if (i % 20 === 0) w.updateSeen(); if (i % 300 === 0) { const c = w.eco.list.find((o) => o.k === 22 && !o.dead && o.sleep === 2); if (c && i > DAY_TICKS) cam = { x: Math.round(c.x), y: Math.round(c.y), zoom: 4, q: '#clean' }; } }
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, cam, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log(JSON.stringify(cam), (w.tick / DAY_TICKS).toFixed(2));
