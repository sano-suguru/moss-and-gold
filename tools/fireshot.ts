import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
const target = process.argv[2] || 'fire';
let found = false;
for (let i = 0; i < DAY_TICKS * 12; i++) {
  w.step(); if (i % 20 === 0) { if (i % 200 === 0) w.computeGlow(); w.updateSeen(); }
  const d = w.eco.list.find(c => c.k === 24 && !c.dead);
  if (target === 'fire' && d && d.act === 2 && d.ref2 > 0 && d.ref2 < 5 && w.eco.burning.length > 10) { found = true; break; }
  if (target === 'sleep' && d && d.st === 0 && i % 500 === 0 && d.actT > 2000) { found = true; break; }
  if (target === 'wyvern' && w.eco.list.some(c => c.k === 23 && !c.dead && c.act === 2)) { found = true; break; }
}
w.seen.fill(1);
const d = w.eco.list.find(c => (target === 'wyvern' ? c.k === 23 : c.k === 24) && !c.dead)!;
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, cam: { x: Math.round(d.x), y: Math.round(d.y), zoom: 2 }, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log(found, Math.round(d.x), Math.round(d.y), 'dir', d.dir, 'act', d.act, 'st', d.st, 'burning', w.eco.burning.length, (w.tick / DAY_TICKS).toFixed(2));
