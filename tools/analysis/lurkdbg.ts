import { DAY_TICKS, World } from '../../src/world';
const w = new World('abc'); const e = w.eco as any; const m = w.map;
let checks = 0, cands = 0, losOk = 0, near20 = 0;
while (w.tick < 12 * DAY_TICKS) {
  w.step();
  if (w.tick % 60) continue;
  for (const c of e.list) {
    if (c.dead || ![10, 12, 13].includes(c.k)) continue;
    checks++;
    for (const o of e.list) {
      if (o.dead || o.away || o.k !== 25) continue;
      const p = e.parties.find((q: any) => q.id === o.party);
      const bright = o.torch > 0 || (p && (p.camp ?? -1) >= 0);
      const d = Math.hypot(o.x - c.x, o.y - c.y) / 16;
      if (d < 20) near20++;
      if (!bright) continue; cands++;
      if (d < 20 && (await0())) {}
    }
  }
}
function await0() { return false; }
console.log({ checks, cands, near20 });
