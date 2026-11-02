import { World, DAY_TICKS } from '../src/world';
const a = new World('かしたれ');
for (let i = 0; i < DAY_TICKS * 6.0; i++) a.step();
const b = new World('かしたれ', { tick: a.tick, seen: Uint8Array.from(a.seen), water: Int32Array.from(a.water), nutr: Int32Array.from(a.nutr), moss: Uint8Array.from(a.moss), fungus: Uint8Array.from(a.fungus), burn: Uint8Array.from(a.burn), ash: Uint8Array.from(a.ash), mat: Uint8Array.from(a.mat), born: a.born, washed: a.washed, mana: Int32Array.from(a.mana), manaBorn: a.manaBorn, manaLeaked: a.manaLeaked, manaFaded: a.manaFaded, digs: a.digs.slice(), eco: JSON.parse(JSON.stringify(a.eco.serialize())) } as any);
const ea = a.eco as any, eb = b.eco as any;
for (const k of [1414, 1415, 1606, 1607]) console.log(k, a.map.solid[k], b.map.solid[k], a.water[k], b.water[k], ea.statueAt.has(k), eb.statueAt.has(k), a.map.lava[k], b.map.lava[k]);
console.log('bgen', ea.bgen, eb.bgen, 'statues', ea.statues.length, eb.statues.length, ea.statueAt.size, eb.statueAt.size);
console.log(JSON.stringify(ea.statues), JSON.stringify(eb.statues), [...ea.statueAt.entries()], [...eb.statueAt.entries()]);
