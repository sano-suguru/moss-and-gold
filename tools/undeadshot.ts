import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
let t: any = null;
for (let i = 0; i < DAY_TICKS * 8; i++) {
  w.step(); if (i % 20 === 0) w.updateSeen();
  if (i % 100) continue;
  t = w.eco.list.find(c => (c.k === 27 || (c.k === 26 && c.init)) && !c.dead);
  if (t) break;
}
w.seen.fill(1);
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, cam: { x: Math.round(t.x), y: Math.round(t.y), zoom: 4 }, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log('kind', t.k, 'init', t.init, 'sp', t.sp, (w.tick / DAY_TICKS).toFixed(2));
