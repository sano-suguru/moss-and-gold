import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
let cam: any = null;
for (let i = 0; i < DAY_TICKS * 4; i++) {
  w.step(); if (i % 20 === 0) w.updateSeen();
  if (i < DAY_TICKS * 1.2 || i % 10) continue;
  const c = w.eco.list.find(c => !c.dead && w.tick - c.hitAt < 3 && c.hp > 0 && c.hp < w.eco.maxHp(c) * 0.6 && [2,3,10,12,13,25,28].includes(c.k) && !w.map.sealed[Math.floor(c.y/16)*w.map.w+Math.floor(c.x/16)]);
  if (c) { const nb = w.eco.blood.filter(b => Math.abs(b.x - c.x) < 120 && Math.abs(b.y - c.y) < 80).length; if (nb >= 6) { cam = { x: Math.round(c.x), y: Math.round(c.y), zoom: 4 }; console.log('kind', c.k, 'hp', c.hp.toFixed(1), '/', w.eco.maxHp(c), 'blood near', nb); break; } }
}
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: w.map.seed, tick: w.tick, cam, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() }));
