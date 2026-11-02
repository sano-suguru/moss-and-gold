import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
for (let d = 0; d < 6; d++) { for (let i = 0; i < DAY_TICKS; i++) w.step();
  console.log('d', d + 1, 'camps', JSON.stringify(w.eco.camps), 'gob', w.eco.list.filter(c => c.k === 12 && !c.dead).length, 'liz', w.eco.list.filter(c => c.k === 14 && !c.dead).length); }
