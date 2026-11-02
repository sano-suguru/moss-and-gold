// @ts-nocheck
import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc'); const e = w.eco as any;
const gold0 = e.totalGold();
const drift = () => e.totalGold() - gold0 - e.goldIn + e.goldOut;
while (w.tick < 18.9 * DAY_TICKS) w.step();
let d0 = drift();
const snap = () => new Map(e.list.filter((c: any) => c.gold > 0 || c.dead !== 2).map((c: any) => [c.id, `${c.k},${c.dead},${c.gold},${c.st}`]));
let prev = snap(); let pp = new Map(e.piles.map((p: any) => [p.id, p.gold]));
while (w.tick < 19.2 * DAY_TICKS) {
  w.step();
  const d = drift();
  if (d !== d0) {
    console.log('ずれ', (w.tick / DAY_TICKS).toFixed(4), d0, '→', d);
    for (const c of e.list) { const b = prev.get(c.id); const n = `${c.k},${c.dead},${c.gold},${c.st}`; if (b !== n && (c.gold > 0 || (b && b.split(',')[2] !== '0'))) console.log('  生き物', c.id, b, '→', n); }
    for (const [id, b] of prev) if (!e.list.some((c: any) => c.id === id) && b.split(',')[2] !== '0') console.log('  消えた', id, b);
    for (const p of e.piles) { const b = pp.get(p.id); if (b !== p.gold) console.log('  山', p.id, b, '→', p.gold); }
    for (const [id, g] of pp) if (!e.piles.some((p: any) => p.id === id)) console.log('  山が消えた', id, g);
    break;
  }
  d0 = d; prev = snap(); pp = new Map(e.piles.map((p: any) => [p.id, p.gold]));
}
