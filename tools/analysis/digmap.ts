/** 掘られたマスと岩の硬さのマップを PNG に描く（ドワーフの坑道の形を確認する） */
import { writeFileSync } from 'fs';
import { DAY_TICKS, World } from '../../src/world';
import { encodePng, parseArgs } from './common';
const a = parseArgs(process.argv.slice(2));
const w = new World(a.seed || 'abc');
while (w.tick < +(a.days || 8) * DAY_TICKS) w.step();
const m = w.map, S = 4;
const img = new Uint8Array(m.w * S * m.h * S * 4);
const lamps = new Set(w.eco.lamps);
for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
  const k = y * m.w + x;
  let c: number[];
  if (m.solid[k]) c = m.rubble[k] ? [110, 90, 70] : [[96, 78, 60], [52, 50, 60], [30, 34, 58]][m.hard[k]];
  else if (m.paved[k]) c = [230, 200, 120];
  else if (m.dug[k]) c = [240, 120, 60];
  else c = m.sealed[k] ? [40, 70, 72] : [150, 148, 160];
  if (lamps.has(k)) c = [255, 255, 140];
  for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { const p = ((y * S + yy) * m.w * S + x * S + xx) * 4; img[p] = c[0]; img[p + 1] = c[1]; img[p + 2] = c[2]; img[p + 3] = 255; }
}
writeFileSync(a.out || 'build/digmap.png', encodePng(m.w * S, m.h * S, img));
console.log('hold', JSON.stringify(w.eco.hold && { stage: w.eco.hold.stage, len: w.eco.hold.len, plan: w.eco.hold.plan?.length, drift: w.eco.hold.drift?.length }), 'lamps', w.eco.lamps.length);
