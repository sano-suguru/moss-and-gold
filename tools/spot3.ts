import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
let best = 0, bs: any = null;
for (let i = 0; i < DAY_TICKS * 3; i++) {
  w.step();
  if (i % 400 !== 0 || i < DAY_TICKS) continue;
  const p = (w.tick % DAY_TICKS) / DAY_TICKS; if (p < 0.3 || p > 0.65) continue;
  const alive = w.eco.list.filter(c => !c.dead && !c.away && c.k >= 2);
  for (const c of alive) {
    const k = Math.floor(c.y / 16) * w.map.w + Math.floor(c.x / 16);
    if (w.moss[k] < 60 && w.lightBase[k] < 300) continue;
    const n = alive.filter(o => Math.abs(o.x - c.x) < 110 && Math.abs(o.y - c.y) < 70).length;
    if (n > best) { best = n; w.computeGlow(); w.updateSeen(); bs = { x: Math.round(c.x), y: Math.round(c.y), n, tick: w.tick, save: JSON.stringify({ v: 3, seed: 'かしたれ', tick: w.tick, cam: { x: Math.round(c.x), y: Math.round(c.y), zoom: 3 }, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), eco: w.eco.serialize() }) }; }
  }
}
writeFileSync('build/save.json', bs.save);
console.log(bs.x, bs.y, bs.n, bs.tick);
