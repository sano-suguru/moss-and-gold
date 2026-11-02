import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
let cam: any = null;
for (let i = 0; i < DAY_TICKS * 6; i++) {
  w.step(); if (i % 20 === 0) w.updateSeen();
  if (i % 50) continue;
  const p = w.eco.parties.find(p => (p.camp ?? -1) >= 0 && p.members.every(id => { const c = w.eco.list.find(o => o.id === id)!; return c && Math.hypot(c.x - ((p.camp! % w.map.w) * 16 + 8), c.y - (Math.floor(p.camp! / w.map.w) * 16 + 8)) < 24; }) && p.members.length >= 3);
  if (p) { cam = { x: (p.camp! % w.map.w) * 16 + 8, y: Math.floor(p.camp! / w.map.w) * 16 + 8, zoom: 4 }; break; }
}
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, cam, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log(JSON.stringify(cam));
