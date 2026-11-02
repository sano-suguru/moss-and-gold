/** 飢えて死んだ大ネズミの最後の様子を集計する：目指していた苔のマスが閉じた空洞か、たどり着けるか、巣穴からの距離など */
import { DAY_TICKS, World } from '../../src/world';
import { parseArgs } from './common';
const a = parseArgs(process.argv.slice(2));
const w = new World(a.seed || 'かしたれ');
const e = w.eco as any;
const m = w.map;
const days = +(a.days || 6);
const stats = { forage: 0, openMoss: 0, born: 0, arrived: 0, starved: 0, targetSealed: 0, targetSolid: 0, noTarget: 0, stuck: 0, atHome: 0, fleeing: 0, st: [0, 0, 0, 0] as number[] };
const last = new Map<number, { x: number; y: number; moved: number }>();
while (w.tick < days * DAY_TICKS) {
  w.step();
  if (w.tick % 20) continue;
  for (const c of e.list) {
    if (c.k !== 2 || c.dead) continue;
    const L = last.get(c.id) ?? { x: c.x, y: c.y, moved: 0 };
    L.moved = Math.abs(c.x - L.x) + Math.abs(c.y - L.y) > 4 ? 0 : L.moved + 20;
    L.x = c.x; L.y = c.y;
    last.set(c.id, L);
  }
  for (const b of e.stats.births.splice(0)) if (b.k === 2) { if (b.origin === 'born') stats.born++; else stats.arrived++; }
  for (const d of e.stats.deaths.splice(0)) {
    if (d.k !== 2 || d.cause !== 'starve') continue;
    stats.starved++;
    // 死骸になった同じ場所の大ネズミを探す
    const c = e.list.find((o: any) => o.k === 2 && o.dead && Math.round(o.x) === d.x && Math.round(o.y) === d.y);
    if (!c) continue;
    stats.st[c.st] = (stats.st[c.st] ?? 0) + 1;
    if (c.ref > 0) { const t = c.ref - 1; if (m.sealed[t]) stats.targetSealed++; if (m.solid[t]) stats.targetSolid++; } else stats.noTarget++;
    if ((last.get(c.id)?.moved ?? 0) > 400) stats.stuck++;
    if (Math.hypot(c.x - c.hx, c.y - c.hy) < 30) stats.atHome++;
    if (c.flee > 0) stats.fleeing++;
    (stats as any).lifeH = ((stats as any).lifeH ?? 0) + (w.tick - (c.bornAt > 0 ? c.bornAt : 0)) / 600;
    const fk = e.nearestForage(c.x, c.y, 200);
    (stats as any).forageDist = ((stats as any).forageDist ?? 0) + (fk >= 0 ? Math.hypot((fk % m.w) - c.x / 16, Math.floor(fk / m.w) - c.y / 16) : 999);
  }
}
stats.forage = e.forage.length; stats.openMoss = e.openMoss;
const ages: number[] = [];
console.log(JSON.stringify(stats));
