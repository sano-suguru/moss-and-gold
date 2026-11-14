import { DAY_TICKS, World } from '../../src/world';
const w = new World('abc'); const e = w.eco as any;
while (w.tick < 5 * DAY_TICKS) w.step();
for (let i = 0; i < 6; i++) { for (let j = 0; j < 300; j++) w.step(); const d = e.list.find((c: any) => c.k === 24 && !c.dead); const p = e.paths.get(d.id); console.log(d.st, Math.round(d.x), Math.round(d.y), 'h', Math.round(d.hx), Math.round(d.hy), 'ref', d.ref, 'path', p ? p.path.length : '-', p?.stall, 'tile', Math.floor(d.y/16)*192+Math.floor(d.x/16), w.map.solid[Math.floor(d.hy/16)*192+Math.floor(d.hx/16)]); }
