import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
for (let i = 0; i < DAY_TICKS * 2.2; i++) w.step();
const e = w.eco;
console.log('entrance', w.map.entrance, 'burrows', e.burrows.map(b => [b.x, b.y]));
for (const c of e.list.filter(c => !c.dead && c.k >= 2)) console.log(c.k, c.id, Math.round(c.x), Math.round(c.y), 'home', c.hx, c.hy, 'st', c.st, 'food', c.food, 'ref', c.ref);
