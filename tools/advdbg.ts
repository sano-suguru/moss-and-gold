import { World, DAY_TICKS } from '../src/world';
const w = new World('かしたれ');
for (let i = 0; i < DAY_TICKS * 5; i++) w.step();
const e = w.eco as any;
console.log('entrance', w.map.entrance);
for (const p of e.parties) {
  console.log('party', p.id, 'goal', p.goal, 'tx', p.tx >> 4, p.ty >> 4, 'since', p.since, 'targetAt', p.targetAt, 'step', e.step);
  for (const id of p.members) { const c = e.byId.get(id); console.log('  m', c.id, 'job', c.sp, 'tile', c.x >> 4, c.y >> 4, 'act', c.act, 'food', c.food, 'gold', c.gold, 'torch', c.torch); }
}
