import { World, DAY_TICKS } from '../src/world';
const a = new World('かしたれ');
for (let i = 0; i < DAY_TICKS * 6.0; i++) a.step();
const b = new World('かしたれ', { tick: a.tick, seen: Uint8Array.from(a.seen), water: Int32Array.from(a.water), nutr: Int32Array.from(a.nutr), moss: Uint8Array.from(a.moss), fungus: Uint8Array.from(a.fungus), burn: Uint8Array.from(a.burn), ash: Uint8Array.from(a.ash), mat: Uint8Array.from(a.mat), born: a.born, washed: a.washed, mana: Int32Array.from(a.mana), manaBorn: a.manaBorn, manaLeaked: a.manaLeaked, manaFaded: a.manaFaded, digs: a.digs.slice(), eco: JSON.parse(JSON.stringify(a.eco.serialize())) } as any);
for (let s = 0; s < 320; s++) {
  a.step(); b.step();
  const sa = a.eco.serialize() as any, sb = b.eco.serialize() as any;
  let bad = false; for (const k of Object.keys(sa)) { const x = JSON.stringify(sa[k]), y = JSON.stringify(sb[k]); if (x !== y) { let i = 0; while (x[i] === y[i]) i++; console.log("step", s, "key", k, x.slice(Math.max(0, i - 60), i + 30), "\n   vs", y.slice(Math.max(0, i - 60), i + 30)); bad = true; } } if (bad) break;
}
const ca = a.eco.list.find((c: any) => c.id === 915) as any, cb = b.eco.list.find((c: any) => c.id === 915) as any;
console.log('915', ca && [ca.k, ca.x, ca.y, ca.st, ca.act, ca.tx, ca.ty], cb && [cb.k, cb.x, cb.y, cb.st, cb.act, cb.tx, cb.ty]);
console.log((a.eco as any).paths.get(915), (b.eco as any).paths.get(915));
