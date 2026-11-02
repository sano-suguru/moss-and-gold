import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
let woke = -1;
for (let i = 0; i < DAY_TICKS * 8; i++) {
  w.step(); if (i % 20 === 0) { if (i % 200 === 0) w.computeGlow(); w.updateSeen(); }
  const wm = w.eco.list.find(c => c.k === 22 && !c.dead)!;
  if (wm.st === 1 && woke < 0) woke = i;
  if (woke >= 0 && i - woke > 300) break;
}
w.seen.fill(1);
const wm = w.eco.list.find(c => c.k === 22 && !c.dead)!;
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, cam: { x: Math.round(wm.x), y: Math.round(wm.y), zoom: 2 }, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log('woke at', woke, Math.round(wm.x), Math.round(wm.y), 'digs', w.digs.length);
