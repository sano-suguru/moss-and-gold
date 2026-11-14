import { DAY_TICKS, World } from '../../src/world';
const w = new World('かしたれ'); const e = w.eco as any; const m = w.map;
while (w.tick < 8 * DAY_TICKS) w.step();
const ex = m.entrance.x;
for (let y = 0; y < 7; y++) { let r = ''; for (let x = ex - 4; x <= ex + 4; x++) { const k = y * m.w + x; r += m.rubble[k] ? 'R' : m.solid[k] ? '#' : e.statueAt.has(k) ? 'S' : w.water[k] > 40 ? '~' : '.'; } console.log(y, r); }
const ds = e.list.filter((c: any) => c.k === 28 && !c.dead && c.st === 9);
for (const c of ds.slice(0, 3)) { const p = e.paths.get(c.id); console.log(c.id, (c.x).toFixed(1), (c.y).toFixed(1), 'path', p ? p.path.length : 'なし', 'goal', p?.gk, 'ex', ex * 16 + 16, 24); }
