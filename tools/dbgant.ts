import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
let shown = 0;
for (let i = 0; i < DAY_TICKS * 4; i++) {
  w.step();
  const e = w.eco as any;
  if (e.colonies.length && i % 500 === 0 && shown < 30) {
    shown++;
    const col = e.colonies[0];
    const ants = e.list.filter((c: any) => c.k === 9 && !c.dead && c.ref === col.id);
    console.log(i, 'col', col.id, Math.round(col.x / 16), Math.round(col.y / 16), 'store', col.store, 'starve', col.starve, 'ants', ants.map((a: any) => `${a.st}/${a.units}/${a.food}/${a.ref2}@${Math.round(a.x / 16)},${Math.round(a.y / 16)}`).join(' '));
  }
}
