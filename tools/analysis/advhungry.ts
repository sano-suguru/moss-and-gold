import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc'); const e = w.eco as any;
const seen = new Set<number>();
while (w.tick < 22 * DAY_TICKS) {
  w.step();
  if (w.tick % 200) continue;
  for (const c of e.list) {
    if (c.k !== 25 || c.dead || seen.has(c.id)) continue;
    const st = e.constructor ? 0 : 0;
    if (c.hungry > 1500) {
      seen.add(c.id);
      const p = e.parties.find((q: any) => q.id === c.party);
      console.log((w.tick / DAY_TICKS).toFixed(2), 'id', c.id, '職', c.sp, '位置', Math.floor(c.x / 16), Math.floor(c.y / 16), '食', c.food, '飢', c.hungry, 'st', c.st, 'act', c.act, '一行', p ? `goal${p.goal} 人${p.members.length} tx${Math.floor(p.tx/16)},${Math.floor(p.ty/16)} camp${p.camp} engage${p.engage ?? 0} wait${p.waitT}` : 'なし', 'feed', c.feed, 'sleep', c.sleep, 'flee', c.flee);
    }
  }
}
