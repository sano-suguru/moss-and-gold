import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
let best = 0, bs: any = null;
for (let i = 0; i < DAY_TICKS * (+(process.env.DAYS || 6)); i++) {
  w.step();
  if (i % 20 === 0) { if (i % 200 === 0) w.computeGlow(); w.updateSeen(); }
  if (i % 300 !== 0 || i < DAY_TICKS * 0.5) continue;
  const lit = (x: number, y: number) => { const k = Math.floor(y / 16) * w.map.w + Math.floor(x / 16); return w.lightBase[k] * 1 + w.moss[k] * 3 + w.mossGlow[k] * 600; };
  for (const c of w.eco.list) {
    const KS = (process.env.KS || '5,6,7').split(',').map(Number); if (c.dead === 2 || !KS.includes(c.k)) continue;
    if (lit(c.x, c.y) < +(process.env.LIT || 200)) continue;
    let sc = c.k === 6 ? 6 : c.k === 7 ? 3 : 2;
    for (const o of w.eco.list) if (o !== c && o.dead !== 2 && Math.abs(o.x - c.x) < 90 && Math.abs(o.y - c.y) < 60) sc += o.dead === 1 ? 1.5 : o.k >= 5 ? 2 : 0.3;
    if (sc > best) { best = sc; bs = { x: Math.round(c.x), y: Math.round(c.y), k: c.k, tick: w.tick, save: JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, fungus: b64(w.fungus), digs: w.digs.slice(), cam: { x: Math.round(c.x), y: Math.round(c.y), zoom: 3 }, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), eco: w.eco.serialize() }) }; }
  }
}
writeFileSync('build/save.json', bs.save);
console.log(bs.x, bs.y, 'kind', bs.k, 'score', best.toFixed(1), 'tick', bs.tick);
