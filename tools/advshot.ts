import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
const want = process.argv[3] || 'explore';
let best: any = null;
for (let i = 0; i < DAY_TICKS * 6; i++) {
  w.step(); if (i % 20 === 0) { if (i % 200 === 0) w.computeGlow(); w.updateSeen(); }
  if (i < DAY_TICKS * +(process.argv[4] || 1.5) || i % 50) continue;
  const e = w.eco;
  for (const p of e.parties) {
    const ms = p.members.map(id => e.list.find(c => c.id === id)!).filter(c => c && !c.dead);
    if (ms.length < 3) continue;
    const fighting = ms.some(c => c.act === 2);
    const deep = ms[0].y > 40 * 16;
    if (want === 'fight' ? fighting && deep : deep) { best = ms[0]; break; }
  }
  if (best) break;
}
const c = best;
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, cam: { x: Math.round(c.x), y: Math.round(c.y), zoom: 3 }, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log(Math.round(c.x / 16), Math.round(c.y / 16), (w.tick / DAY_TICKS).toFixed(2));
