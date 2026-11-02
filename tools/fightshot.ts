import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'abc'); const e = w.eco as any;
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
const want = process.argv[3] || 'hit';
let cam: any = null;
for (let i = 0; i < DAY_TICKS * 10 && !cam; i++) {
  w.step(); if (i % 20 === 0) w.updateSeen(); if (i < DAY_TICKS) continue;
  if (want === 'hit') { const h = e.fxHits[e.fxHits.length - 1]; if (h && w.tick - h.t === 1 && !w.map.sealed[Math.floor(h.y / 16) * w.map.w + Math.floor(h.x / 16)]) cam = { x: Math.round(h.x), y: Math.round(h.y), zoom: 4, q: '#lit' }; }
  if (want === 'feed') { const c = e.list.find((o: any) => !o.dead && o.feed && !w.map.sealed[Math.floor(o.y / 16) * w.map.w + Math.floor(o.x / 16)]); if (c) cam = { x: Math.round(c.x), y: Math.round(c.y), zoom: 4, q: '#lit' }; }
  if (want === 'mark') { const mk = e.fxMarks[e.fxMarks.length - 1]; if (mk && w.tick - mk.t === 2) { const c = e.list.find((o: any) => o.id === mk.id); if (c && !w.map.sealed[Math.floor(c.y / 16) * w.map.w + Math.floor(c.x / 16)]) cam = { x: Math.round(c.x), y: Math.round(c.y), zoom: 4, q: '#lit' }; } }
}
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, cam, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log(want, JSON.stringify(cam), (w.tick / DAY_TICKS).toFixed(2));
