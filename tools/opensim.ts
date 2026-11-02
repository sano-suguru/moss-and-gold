import { World, DAY_TICKS, timeLabel } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const m = w.map;
const openCount = () => { let n = 0; for (let k = 0; k < m.w * m.h; k++) if (!m.solid[k] && !m.sealed[k] && !m.lava[k]) n++; return n; };
let seen = 0;
const days = +(process.argv[3] || 6);
for (let i = 0; i < DAY_TICKS * days; i++) {
  w.step();
  if (i % 20 === 0) w.updateSeen();
  const ev = w.eco.events;
  while (seen < ev.length) { const e = ev[seen++]; if (/掘り当て|崩れ/.test(e.m)) console.log(timeLabel(e.t), (e.t / DAY_TICKS).toFixed(2), e.m); }
  if (i % DAY_TICKS === DAY_TICKS - 1) console.log(`--- d${Math.round((i + 1) / DAY_TICKS)} 開いた床 ${openCount()} 瓦礫 ${m.rubble.reduce((a, v) => a + v, 0)} 持ち土 ${w.rockStock} ネズミ ${w.eco.list.filter(c => c.k === 2 && !c.dead).length} 巣穴 ${w.eco.burrows.map(b => b.len ?? 0).join(',')}`);
}
