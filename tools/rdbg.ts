import { World, DAY_TICKS } from '../src/world';
const a = new World('かしたれ');
for (let i = 0; i < DAY_TICKS * 6.0; i++) a.step();
const b = new World('かしたれ', { tick: a.tick, seen: Uint8Array.from(a.seen), water: Int32Array.from(a.water), nutr: Int32Array.from(a.nutr), moss: Uint8Array.from(a.moss), fungus: Uint8Array.from(a.fungus), burn: Uint8Array.from(a.burn), ash: Uint8Array.from(a.ash), mat: Uint8Array.from(a.mat), born: a.born, washed: a.washed, digs: a.digs.slice(), eco: JSON.parse(JSON.stringify(a.eco.serialize())) } as any);
const sa = JSON.stringify(a.eco.serialize()), sb = JSON.stringify(b.eco.serialize());
console.log('immediate equal', sa === sb);
if (sa !== sb) { for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) { console.log(sa.slice(i - 200, i + 80)); console.log(sb.slice(i - 200, i + 80)); break; } }
for (let s = 0; s < 4000; s++) { a.step(); b.step(); const x = JSON.stringify(a.eco.serialize()), y = JSON.stringify(b.eco.serialize()); if (x !== y) { console.log('diverge at', s); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) { console.log(x.slice(i - 300, i + 60)); console.log('---'); console.log(y.slice(i - 300, i + 60)); break; } break; } }
