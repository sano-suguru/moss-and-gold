/** 群れの仕組みがどれくらい働いているかを数える（警戒で逃げた・加勢した、縄張りで退かせた、分家） */
import { DAY_TICKS, World } from '../../src/world';
import { KIND_NAMES, parseArgs } from './common';
const a = parseArgs(process.argv.slice(2));
const w = new World(a.seed || 'abc'); const e = w.eco as any;
const cnt: Record<string, number> = {};
const inc = (k: string) => (cnt[k] = (cnt[k] ?? 0) + 1);
const heed = e.heedAlarm.bind(e);
e.heedAlarm = (c: any) => { const f0 = c.flee; const r = heed(c); if (r) inc(`加勢:${KIND_NAMES[c.k]}`); else if (c.flee > 0 && f0 <= 0) inc(`皆で逃げた:${KIND_NAMES[c.k]}`); return r; };
const terr = e.territory.bind(e);
e.territory = (c: any) => { const before = e.list.filter((o: any) => o.k === c.k && o.flee > 0).length; const r = terr(c); const after = e.list.filter((o: any) => o.k === c.k && o.flee > 0).length; if (after > before) inc(`縄張りで退かせた:${KIND_NAMES[c.k]}`); return r; };
let groups = 0, sizes: Record<string, number[]> = {};
while (w.tick < +(a.days || 10) * DAY_TICKS) { w.step(); if (w.tick % 7200 === 0) { for (const g of e.groups.values()) (sizes[KIND_NAMES[g.k]] ??= []).push(g.members.length); groups++; } }
console.log(Object.entries(cnt).sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k} ${v}`).join('\n'));
console.log('群れの大きさ（平均）', Object.entries(sizes).map(([k, v]) => `${k}:${(v.reduce((x, y) => x + y, 0) / v.length).toFixed(1)}（${v.length}）`).join(' '));
