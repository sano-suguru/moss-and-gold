import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
let cam: any = null, lit = 0;
for (let i = 0; i < DAY_TICKS * 8; i++) {
  w.step(); if (i % 20 === 0) w.updateSeen();
  if (i % 200) continue;
  lit = Math.max(lit, w.eco.camps.filter(c => c.id >= 0 && (c.fuel ?? 0) > 0).length);
  const cp = w.eco.camps.find(c => c.id >= 0 && (c.fuel ?? 0) > 0);
  if (cp && i > DAY_TICKS * 1) { cam = { x: cp.x, y: cp.y, zoom: 3 }; break; }
}
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, cam, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log(JSON.stringify(cam), 'max lit camps', lit, (w.tick / DAY_TICKS).toFixed(2));
