import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc');
for (let d = 1; d <= +(process.argv[3] || 20); d++) { while (w.tick < d * DAY_TICKS) w.step(); if (d % 4 === 0) console.log(`d${d} 土のマナ ${w.soilMana()} 生き物 ${w.eco.heldMana()} ずれ ${w.totalMana() - w.manaBorn + w.manaLeaked + w.manaFaded}`); }
