import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
const days = +(process.argv[2] || 0.3);
for (let i = 0; i < DAY_TICKS * days; i++) { w.step(); if (i % 20 === 0) w.updateSeen(); }
const m = w.map;
// 瓦礫か閉じた空洞の縁の近くを探す
let best = -1, bs = -1;
for (let k = 0; k < m.w * m.h; k += 7) {
  const x = k % m.w, y = (k / m.w) | 0; if (x < 20 || y < 12 || x > m.w - 20 || y > m.h - 12) continue;
  let sc = 0; for (let dy = -10; dy <= 10; dy += 2) for (let dx = -16; dx <= 16; dx += 2) { const q = (y + dy) * m.w + x + dx; if (m.rubble[q]) sc += 6; if (m.sealed[q] && !m.solid[q]) sc += 1; if (!m.solid[q] && !m.sealed[q]) sc += 1; }
  if (sc > bs) { bs = sc; best = k; }
}
const cam = { x: (best % m.w) * 16, y: Math.floor(best / m.w) * 16, zoom: 2 };
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: m.seed, tick: w.tick, cam, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), digs: w.digs.slice(), eco: w.eco.serialize() }));
console.log(JSON.stringify(cam));
