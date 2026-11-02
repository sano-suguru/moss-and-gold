import { writeFileSync } from 'fs';
import { World, DAY_TICKS } from '../src/world';
const w = new World(process.argv[2] || 'abc');
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const bits = (a: Uint8Array) => { const b = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7); return b64(b); };
const days = +(process.argv[3] || 10);
const phase = +(process.argv[5] || 0.35);
while (w.tick < DAY_TICKS * days || (w.tick % DAY_TICKS) / DAY_TICKS < phase) { w.step(); if (w.tick % 20 === 0) w.updateSeen(); }
const shots: Record<string, unknown> = {};
if (process.argv[4] === 'open') { w.map.sealed.fill(0); }
const m = w.map;
m.mouths.forEach((mo, i) => { shots['mouth' + i] = { x: mo.x * 16 + (mo.kind === 0 && mo.y > 0 ? (mo.x === 0 ? 70 : -70) : 8), y: mo.y * 16 + (mo.kind === 0 && mo.y === 0 ? 70 : 8), zoom: 3 }; });
const eg = w.eco.eggs[0]; if (eg) shots.egg = { x: eg.x, y: eg.y, zoom: 4 };
const pup = w.eco.list.find(c => c.k === 2 && !c.dead && w.tick - c.bornAt < DAY_TICKS / 4); if (pup) shots.pup = { x: Math.round(pup.x), y: Math.round(pup.y), zoom: 4 };
writeFileSync('build/save.json', JSON.stringify({ v: 3, seed: m.seed, tick: w.tick, cam: { x: 0, y: 0, zoom: 3 }, speed: 0, seen: bits(w.seen), water: b64(new Uint8Array(w.water.buffer)), nutr: b64(new Uint8Array(w.nutr.buffer)), moss: b64(w.moss), fungus: b64(w.fungus), burn: b64(w.burn), ash: b64(w.ash), mat: b64(w.mat), born: w.born, washed: w.washed, digs: w.digs.slice(), eco: w.eco.serialize() }));
writeFileSync('build/shots.json', JSON.stringify(shots));
console.log(JSON.stringify(m.mouths.map((mo, i) => [mo.kind, w.eco.mouthOpen(i)])), Object.keys(shots).join(','), (w.tick / DAY_TICKS).toFixed(2));
