/** 長く動かない大ネズミのまわりを調べる */
import { DAY_TICKS, World } from '../../src/world';
import { parseArgs } from './common';
const a = parseArgs(process.argv.slice(2));
const w = new World(a.seed || 'abc');
const e = w.eco as any; const m = w.map;
const last = new Map<number, { x: number; y: number; since: number }>();
let reported = 0;
while (w.tick < +(a.days || 8) * DAY_TICKS && reported < 8) {
  w.step(); if (w.tick % 20) continue;
  for (const c of e.list) {
    if (c.k !== 2 || c.dead) continue;
    const L = last.get(c.id);
    if (!L || Math.abs(c.x - L.x) + Math.abs(c.y - L.y) > 6) { last.set(c.id, { x: c.x, y: c.y, since: w.tick }); continue; }
    if (w.tick - L.since === 1200 && c.st === 1) {
      reported++;
      const tx = Math.floor(c.x / 16), ty = Math.floor(c.y / 16), k = ty * m.w + tx;
      const nb = [k - m.w, k + 1, k + m.w, k - 1].map((q) => (m.solid[q] ? (m.rubble[q] ? 'R' : '#') : w.water[q] > 40 ? '~' : '.')).join('');
      const t = c.ref - 1;
      console.log(`id${c.id} tick${w.tick} (${tx},${ty}) 水${w.water[k]} 上右下左[${nb}] 食${c.food} 飢${c.hungry} 目標${t >= 0 ? `(${t % m.w},${Math.floor(t / m.w)}) 苔${w.moss[t]} 閉${m.sealed[t]}` : 'なし'} 巣(${Math.floor(c.hx / 16)},${Math.floor(c.hy / 16)}) act${c.act} gait${c.gait} hp${c.hp.toFixed(0)}`);
    }
  }
}
