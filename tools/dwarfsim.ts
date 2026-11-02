import { World, DAY_TICKS, timeLabel } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const days = +(process.argv[3] || 6);
let seen = 0, lastT = -1;
for (let i = 0; i < DAY_TICKS * days; i++) {
  w.step();
  if (i % 20 === 0) w.updateSeen();
  const ev = w.eco.events;
  for (const e of ev) if (e.t > lastT && /ドワーフ|{k:28}|鍛冶|ゴーレム/.test(e.m)) console.log(timeLabel(e.t), (e.t / DAY_TICKS).toFixed(2), e.m);
  if (ev.length) lastT = Math.max(lastT, ev[ev.length - 1].t);
  if (i % (DAY_TICKS / 2) === 0 && i > DAY_TICKS * 2) { const h = w.eco.hold; const d = w.eco.list.filter(c => c.k === 28 && !c.dead); console.log(`  d${(i / DAY_TICKS).toFixed(1)} 住みか ${h ? `段階${h.stage} 広間残${h.todo.length} 坑道${h.len} 鍛冶場${h.forge} ゴーレム${h.golem}` : 'なし'} ドワーフ${d.length} ランプ${w.eco.lamps.length} 金${w.eco.totalGold()}(入${w.eco.goldIn}出${w.eco.goldOut}) 山${w.eco.piles.map(p => p.gold).join(',')}`); }
}
