import { World, DAY_TICKS, timeLabel } from '../src/world';
const w = new World(process.argv[2] || 'かしたれ');
const days = +(process.argv[3] || 6);
let lastT = -1; const cnt: Record<string, number> = {};
for (let i = 0; i < DAY_TICKS * days; i++) {
  w.step(); if (i % 20 === 0) w.updateSeen();
  for (const e of w.eco.events) if (e.t > lastT) { const key = e.m.replace(/（.*?）/g, '').replace(/\{k:\d+\}/g, '◯').replace(/\d+/g, 'N'); if (/冒険者/.test(key)) cnt[key] = (cnt[key] ?? 0) + 1; }
  if (w.eco.events.length) lastT = Math.max(lastT, w.eco.events[w.eco.events.length - 1].t);
}
console.log(Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}\t${k}`).join('\n'));
const lo = w.eco.lore; console.log('外の地図: 探した区画', lo.explored.length, '/', 24 * 18, '宝の区画', lo.gold.length, '危ない区画', lo.danger.length, '帰還', w.eco.returned, '倒れた', w.eco.fallen);
