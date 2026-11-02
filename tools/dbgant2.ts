import { World } from '../src/world';
const w = new World('かしたれ');
for (let i = 0; i < 38500; i++) w.step();
const e = w.eco as any;
const col = e.colonies[0];
const a = e.list.find((c: any) => c.k === 9 && !c.dead && c.ref === col.id && c.st === 1);
console.log('col', col.x, col.y, 'ant', a.id, a.x, a.y, a.st, a.units, a.hungry);
for (let i = 0; i < 400; i++) { w.step(); if (i % 20 === 0) { const p = e.paths.get(a.id); console.log(i, a.x.toFixed(0), a.y.toFixed(0), 'st', a.st, 'u', a.units, 'act', a.act, 'path', p ? `${p.gx},${p.gy} ${p.pi}/${p.path.length}` : '-', 'dead', a.dead); } }
