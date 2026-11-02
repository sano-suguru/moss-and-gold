import { World } from '../src/world';
const w = new World('かしたれ');
for (let i = 0; i < 40000; i++) {
  w.step();
  if (i % 2000 === 0 && i > 10000) {
    const e = w.eco as any; const m = w.map;
    for (const wr of e.warrens) {
      const ks = e.list.filter((c: any) => c.k === 10 && !c.dead && c.ref === wr.id);
      const tx = wr.target % m.w, ty = Math.floor(wr.target / m.w);
      console.log(i, 'warren', wr.id, 'home', Math.round(wr.x / 16), Math.round(wr.y / 16), 'target', tx, ty, 'prog', wr.prog, 'len', wr.len, 'stall', wr.stall, '|', ks.map((c: any) => `${Math.round(c.x / 16)},${Math.round(c.y / 16)} f${c.food} s${c.st} a${c.act}`).join(' '));
    }
  }
}
