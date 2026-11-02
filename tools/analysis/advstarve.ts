import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'かしたれ'); const e = w.eco as any; const m = w.map;
let n = 0;
while (w.tick < 14 * DAY_TICKS && n < 8) {
  w.step();
  for (const d of e.stats.deaths.splice(0)) {
    if (d.k !== 25 || d.cause !== 'starve') continue;
    const c = e.list.find((o: any) => o.k === 25 && o.dead && Math.round(o.x) === d.x && Math.round(o.y) === d.y);
    const p = c && e.parties.find((q: any) => q.id === c.party);
    const k = Math.floor(d.y / 16) * m.w + Math.floor(d.x / 16);
    console.log(`${(d.t / DAY_TICKS).toFixed(2)} (${Math.floor(d.x / 16)},${Math.floor(d.y / 16)}) 一行 ${p ? `goal${p.goal} 人数${p.members.filter((id: number) => !e.byId.get(id)?.dead).length} 入って${((e.step - p.since) / 7200).toFixed(2)}日 camp${p.camp}` : 'なし'} 島?${e.onIsland(d.x, d.y)} 閉?${m.sealed[k]} 入口からの道のり?`);
    n++;
  }
  e.stats.births.length = 0; e.stats.exits.length = 0;
}
