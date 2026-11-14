/** 住みつくはずの種（コボルト、ゴブリン、ドワーフ）が、来てから去るまでの様子を一匹ずつ追う */
import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc'); const e = w.eco as any;
const info = new Map<number, any>();
const out: any[] = [];
while (w.tick < 12 * DAY_TICKS) {
  w.step();
  for (const c of e.list) {
    if (![10, 12, 28].includes(c.k)) continue;
    let r = info.get(c.id);
    if (!r && !c.dead) { r = { k: c.k, t0: w.tick, home: false, fed: 0, n: 0, st9: -1, island: e.onIsland(c.x, c.y) }; info.set(c.id, r); }
    if (!r || r.done) continue;
    if (c.dead) { r.done = true; r.t1 = w.tick; r.dead = c.dead; out.push(r); continue; }
    if (w.tick % 100 === 0) { r.n++; r.fed += c.food; const hasHome = c.k === 10 ? e.warrens.some((q: any) => q.id === c.ref) : c.k === 12 ? e.camps.some((q: any) => q.id === c.ref && q.id >= 0) : !!e.hold && e.hold.stage >= 1; if (hasHome) r.home = true; if (c.st === 9 && r.st9 < 0) { r.st9 = w.tick; r.foodAt9 = c.food; r.hungry9 = c.hungry; r.holdStage = e.hold ? e.hold.stage : -1; } }
  }
}
const names: any = { 10: 'コボルト', 12: 'ゴブリン', 28: 'ドワーフ' };
for (const k of [10, 12, 28]) {
  const rs = out.filter((r) => r.k === k && r.st9 >= 0);
  const stay = rs.map((r) => (r.st9 - r.t0) / DAY_TICKS).sort((a, b) => a - b);
  console.log(names[k], '去った', rs.length, '住みかがあった', rs.filter((r) => r.home).length, '島', rs.filter((r) => r.island).length, '滞在（中央）', stay.length ? stay[Math.floor(stay.length / 2)].toFixed(2) + '日' : '-', '去る時の食料（平均）', rs.length ? (rs.reduce((a, r) => a + r.foodAt9, 0) / rs.length).toFixed(0) : '-', '飢え（平均）', rs.length ? (rs.reduce((a, r) => a + r.hungry9, 0) / rs.length).toFixed(0) : '-', k === 28 ? '住みかの段階' + JSON.stringify(rs.map((r) => r.holdStage).reduce((a: any, s: number) => { a[s] = (a[s] ?? 0) + 1; return a; }, {})) : '');
}
