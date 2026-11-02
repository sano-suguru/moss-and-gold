import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'abc');
const b64 = (u: Uint8Array) => Buffer.from(u.buffer, u.byteOffset, u.byteLength).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
while (w.tick < DAY_TICKS * +(process.argv[3] || 12)) { w.step(); if (w.tick % 20 === 0) w.updateSeen(); }
const m = w.map;
// マナの濃い開いた床と、薄い開いた床の場所
let hi = -1, hv = 0, mid = -1;
for (let k = 0; k < w.mana.length; k++) { if (m.solid[k] || m.sealed[k] || k % m.w < 14 || k % m.w > m.w - 14) continue; if (w.mana[k] > hv) { hv = w.mana[k]; hi = k; } if (mid < 0 && w.mana[k] > 12 && w.mana[k] < 20) mid = k; }
const cams = { hi: { x: (hi % m.w) * 16, y: Math.floor(hi / m.w) * 16, zoom: 3, q: '#clean' }, mid: { x: (mid % m.w) * 16, y: Math.floor(mid / m.w) * 16, zoom: 3, q: '#clean' } };
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: m.seed, tick: w.tick, cam: cams.hi, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), born: w.born, washed: w.washed, mana: b64(new Uint8Array(w.mana.buffer)), manaBorn: w.manaBorn, manaLeaked: w.manaLeaked, manaFaded: w.manaFaded, digs: w.digs.slice(), eco: w.eco.serialize() }));
writeFileSync('build/manacams.json', JSON.stringify(cams));
console.log('濃い', hv, JSON.stringify(cams));
