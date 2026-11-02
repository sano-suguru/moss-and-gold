import { World, DAY_TICKS } from '../src/world';
const fnv = (u: ArrayLike<number>) => { let h = 2166136261; for (let i = 0; i < u.length; i++) { h ^= u[i] & 255; h = Math.imul(h, 16777619); } return h >>> 0; };
const a = new World('かしたれ');
for (let i = 0; i < DAY_TICKS * 6.0; i++) a.step();
const b = new World('かしたれ', { tick: a.tick, seen: Uint8Array.from(a.seen), water: Int32Array.from(a.water), nutr: Int32Array.from(a.nutr), moss: Uint8Array.from(a.moss), fungus: Uint8Array.from(a.fungus), burn: Uint8Array.from(a.burn), ash: Uint8Array.from(a.ash), mat: Uint8Array.from(a.mat), born: a.born, washed: a.washed, mana: Int32Array.from(a.mana), manaBorn: a.manaBorn, manaLeaked: a.manaLeaked, manaFaded: a.manaFaded, digs: a.digs.slice(), eco: JSON.parse(JSON.stringify(a.eco.serialize())) } as any);
const cmp = (tag: string) => { const r = { moss: fnv(a.moss) === fnv(b.moss), fungus: fnv(a.fungus) === fnv(b.fungus), nutr: fnv(new Uint8Array(a.nutr.buffer)) === fnv(new Uint8Array(b.nutr.buffer)), water: fnv(new Uint8Array(a.water.buffer)) === fnv(new Uint8Array(b.water.buffer)), mat: fnv(a.mat) === fnv(b.mat), digs: a.digs.join() === b.digs.join(), solid: fnv(a.map.solid) === fnv(b.map.solid), sealed: fnv(a.map.sealed) === fnv(b.map.sealed), paved: fnv(a.map.paved) === fnv(b.map.paved), heat: fnv(a.heat) === fnv(b.heat), light: fnv(new Uint8Array(a.lightBase.buffer)) === fnv(new Uint8Array(b.lightBase.buffer)), stock: a.rockStock === b.rockStock }; const bad = Object.entries(r).filter(([, v]) => !v).map(([k]) => k); if (bad.length) { console.log(tag, 'mismatch', bad.join(',')); return true; } return false; };
if (cmp('start')) process.exit();
for (let i = 0; i < DAY_TICKS * 0.8; i++) { a.step(); b.step(); if (i % 50 === 0 && cmp('step ' + i)) break; }
console.log('end');
