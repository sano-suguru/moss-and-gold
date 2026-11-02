import { World } from '../src/world';
const w = new World('abc');
for (let i = 0; i < 30000; i++) {
  w.step();
  if (i % 1500 === 0 && i > 6000) {
    const e = w.eco as any;
    const ks = e.list.filter((c: any) => c.k === 10 && !c.dead);
    console.log(i, e.warrens.map((o: any) => `${o.id}:t${o.target}p${o.prog}l${o.len}`).join(' '), '|', ks.map((c: any) => `${c.ref}h${c.hungry}f${c.food}s${c.st}a${c.act}m${c.sinceMeal}`).join(' '));
  }
}
