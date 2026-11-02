import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const days = Number(process.argv[2] || 2.2);
const w = new World('かしたれ');
for (let i = 0; i < DAY_TICKS * days; i++) { w.step(); if (i % 20 === 0) { if (i % 200 === 0) w.computeGlow(); w.updateSeen(); } }
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
w.computeGlow(); w.updateSeen();
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: 'かしたれ', tick: w.tick, cam: { x: 0, y: 0, zoom: 3 }, speed: 0, seen: bits(w.seen),
  water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), eco: w.eco.serialize() }));
// 生き物が多く、明るい場所
const day = 1;
let best = 0, bx = 0, by = 0;
const alive = w.eco.list.filter(c => !c.dead && !c.away);
for (const c of alive) {
  let s = 0;
  for (const o of alive) if (Math.abs(o.x - c.x) < 160 && Math.abs(o.y - c.y) < 100) s += o.k === 0 ? 0.3 : 1 + o.k * 0.5;
  const k = Math.floor(c.y / 16) * w.map.w + Math.floor(c.x / 16);
  s *= 0.3 + w.lightBase[k] / 1000 + w.moss[k] / 255;
  if (s > best) { best = s; bx = c.x; by = c.y; }
}
const kinds = [0, 0, 0, 0, 0]; for (const o of alive) if (Math.abs(o.x - bx) < 160 && Math.abs(o.y - by) < 100) kinds[o.k]++;
console.log(JSON.stringify({ bx: Math.round(bx), by: Math.round(by), kinds, tick: w.tick, phase: (w.tick % DAY_TICKS) / DAY_TICKS }));
// 大トカゲと大グモの位置
const L = alive.find(c => c.k === 3), S = alive.find(c => c.k === 4);
console.log(JSON.stringify({ lizard: L && [Math.round(L.x), Math.round(L.y)], spider: S && [Math.round(S.x), Math.round(S.y)], webs: w.eco.webs.map(x => [x.x, x.y]) }));
