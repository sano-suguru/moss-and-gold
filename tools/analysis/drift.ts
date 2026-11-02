/** 帳簿のずれが起きた刻みを突き止める：--from 日目まで回し、そこから毎刻み帳簿を調べる */
import { DAY_TICKS, World } from '../../src/world';
import { parseArgs } from './common';
const a = parseArgs(process.argv.slice(2));
const w = new World(a.seed || 'かしたれ');
const t0 = w.totalNutrients();
const drift = () => w.totalNutrients() - t0 - w.eco.imported + w.eco.exported - w.born + w.washed;
const from = +(a.from || 14) * DAY_TICKS;
const to = +(a.to || 14.5) * DAY_TICKS;
while (w.tick < from) w.step();
let d0 = drift();
console.log('開始', (w.tick / DAY_TICKS).toFixed(3), 'ずれ', d0);
const before = new Map<number, string>();
const snap = () => { before.clear(); for (const c of w.eco.list) before.set(c.id, `${c.k},${c.dead},${c.body},${c.food},${c.units},${c.away ? 1 : 0}`); };
snap();
while (w.tick < to) {
  w.step();
  const d = drift();
  if (d !== d0) {
    console.log('刻み', w.tick, (w.tick / DAY_TICKS).toFixed(4), 'ずれ', d0, '→', d, '差', d - d0);
    for (const c of w.eco.list) { const b = before.get(c.id); const n = `${c.k},${c.dead},${c.body},${c.food},${c.units},${c.away ? 1 : 0}`; if (b !== n) console.log('  変化', c.id, b, '→', n); }
    for (const [id, b] of before) if (!w.eco.list.some((c) => c.id === id)) console.log('  消えた', id, b);
    console.log('  hold', JSON.stringify(w.eco.hold && { store: w.eco.hold.store }), 'camps', JSON.stringify(w.eco.camps.map((c) => [c.id, c.fuel])));
    d0 = d;
    if (a.once) break;
  }
  if (w.tick % 2 === 0) snap();
}
