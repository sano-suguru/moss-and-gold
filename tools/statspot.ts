import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
let best: any = null, bs = -1;
for (let i = 0; i < DAY_TICKS * 6; i++) {
  w.step(); if (i % 20 === 0) { if (i % 200 === 0) w.computeGlow(); w.updateSeen(); }
  if (i % 600 !== 0) continue;
  const e = w.eco;
  for (const st of e.statues) {
    const k = Math.floor(st.y / 16) * w.map.w + Math.floor(st.x / 16);
    const L = w.lightBase[k] + w.mossGlow[k] * 3000;
    let sc = L > 150 ? 3 : 0; for (const o of e.statues) if (Math.abs(o.x - st.x) < 150 && Math.abs(o.y - st.y) < 100) sc += 1;
    for (const c of e.list) if (!c.dead && (c.k === 16 || c.k === 17 || c.k === 18 || c.k === 19) && Math.abs(c.x - st.x) < 150 && Math.abs(c.y - st.y) < 100) sc += 2;
    if (sc > bs) { bs = sc; best = { x: st.x, y: st.y, save: JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, cam: { x: st.x, y: st.y, zoom: 3 }, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), digs: w.digs.slice(), eco: w.eco.serialize() }) }; }
  }
}
writeFileSync('build/save.json', best.save); console.log(best.x, best.y, bs);
