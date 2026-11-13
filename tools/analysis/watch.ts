/** 指定した種の個体を見張り、一定時間ごとの位置・状態と、まわりにいる相手を書き出す */
import { DAY_TICKS, World } from '../../src/world';
import { KIND_NAMES, parseArgs } from './common';
const a = parseArgs(process.argv.slice(2));
const w = new World(a.seed || 'abc');
const e = w.eco as any;
const kind = +(a.kind ?? 24);
const from = +(a.from || 5) * DAY_TICKS, to = +(a.to || 5.3) * DAY_TICKS, every = +(a.every || 100);
while (w.tick < from) w.step();
const c0 = e.list.find((c: any) => c.k === kind && !c.dead);
if (!c0) { console.log('いない'); process.exit(); }
let lx = c0.x, ly = c0.y, moved = 0;
while (w.tick < to) {
  w.step();
  const c = e.list.find((o: any) => o.id === c0.id);
  if (!c || c.dead) { console.log('倒れた', w.tick); break; }
  const d = Math.hypot(c.x - lx, c.y - ly); moved += d; lx = c.x; ly = c.y;
  if (w.tick % every === 0) {
    const near: string[] = [];
    e.nearby(c.x, c.y, 8, (o: any) => { if (o !== c && !o.dead && [25, 28, 21, 24].includes(o.k)) near.push(`${KIND_NAMES[o.k]}${Math.round(Math.hypot(o.x - c.x, o.y - c.y) / 16)}`); });
    console.log(`${(w.tick / DAY_TICKS).toFixed(3)} (${(c.x / 16).toFixed(1)},${(c.y / 16).toFixed(1)}) st${c.st} act${c.act} 食${c.food} 体${Math.round(c.hp)} 移動${moved.toFixed(0)}px 近く[${near.join(' ')}]`);
    moved = 0;
  }
}
