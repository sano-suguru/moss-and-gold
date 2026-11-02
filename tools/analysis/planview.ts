/** ドワーフの坑道の道筋を、岩の硬さの上に文字で描く（計画だけ。掘りはしない） */
import { DAY_TICKS, World } from '../../src/world';
import { parseArgs } from './common';
const a = parseArgs(process.argv.slice(2));
const w = new World(a.seed || 'abc');
const e = w.eco as any; const m = w.map;
while (!e.hold && w.tick < 6 * DAY_TICKS) w.step();
if (!e.hold) { console.log('ドワーフが来なかった'); process.exit(); }
const h = e.hold;
// 閉じた空洞の中の宝の山を、遠い順に二つ試す
const piles = e.piles.filter((p: any) => m.sealed[Math.floor(p.y / 16) * m.w + Math.floor(p.x / 16)]).sort((p: any, q: any) => Math.hypot(q.x - h.sx * 16, q.y - h.sy * 16) - Math.hypot(p.x - h.sx * 16, p.y - h.sy * 16));
for (const tp of piles.slice(0, 2)) {
  h.head = h.hk; e.planShaft(h, tp);
  const plan = new Set<number>(h.plan);
  const xs = h.plan.map((k: number) => k % m.w), ys = h.plan.map((k: number) => Math.floor(k / m.w));
  const x0 = Math.max(0, Math.min(...xs) - 3), x1 = Math.min(m.w - 1, Math.max(...xs) + 3), y0 = Math.max(0, Math.min(...ys) - 2), y1 = Math.min(m.h - 1, Math.max(...ys) + 2);
  let turns = 0, rock = 0; for (let i = 2; i < h.plan.length; i++) { const d1 = h.plan[i - 1] - h.plan[i - 2], d2 = h.plan[i] - h.plan[i - 1]; if (d1 !== d2) turns++; if (m.solid[h.plan[i]]) rock++; }
  console.log(`宝(${Math.floor(tp.x / 16)},${Math.floor(tp.y / 16)}) 道筋${h.plan.length}マス、うち岩${rock}、曲がり${turns}`);
  for (let y = y0; y <= y1; y += 1) { let r = ''; for (let x = x0; x <= x1; x++) { const k = y * m.w + x; r += plan.has(k) ? (m.solid[k] ? '*' : 'o') : m.solid[k] ? '░▒█'[m.hard[k]] : m.sealed[k] ? '·' : ' '; } if (y % 1 === 0) console.log(r); }
}
