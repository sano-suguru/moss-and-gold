/**
 * シミュレーションの速さを測る：決まった途中の状態から、シードを一つずつ（同時に回さずに）進めて、地上1日あたりの秒数を出す。
 *
 *   npm run bench                                       既定：seed4、かしたれ、seed7 を、前の版（HEAD）の10日目の状態から1日
 *   npm run bench -- --seeds abc,seed8 --from 15 --days 2
 *
 * 状態は lib/open.ts の openAt で手に入れる（いまの版の状態がなければ前の版の状態から）。状態を読む時間は数えない。
 * 同じ機械でも数％は揺れるので、手直しの前後は続けて測る（--repeat 2 で2回ずつ測り、速いほうを使う）。
 */
import { DAY_TICKS, tick } from './lib/engine';
import { openAt } from './lib/open';
import { parseArgs } from './common';

const a = parseArgs(process.argv.slice(2));
const seeds = (a.seeds || 'seed4,かしたれ,seed7').split(',');
const from = +(a.from ?? 10);
const days = +(a.days ?? 1);
const rep = +(a.repeat ?? 1);

async function main() {
  let total = 0;
  const rows: string[] = [];
  for (const s of seeds) {
    let best = Infinity;
    let alive = 0;
    for (let r = 0; r < rep; r++) {
      const { w } = await openAt(s, from * DAY_TICKS, { quiet: r > 0, base: a.base });
      const t0 = performance.now();
      while (w.tick < (from + days) * DAY_TICKS) tick(w);
      best = Math.min(best, (performance.now() - t0) / 1000);
      alive = w.eco.list.filter((c) => !c.dead).length;
    }
    total += best;
    rows.push(`${s}\t${(best / days).toFixed(2)} 秒/日\t（生き物 ${alive}）`);
  }
  console.log(rows.join('\n'));
  console.log(`合計 ${total.toFixed(2)} 秒（${seeds.length} シード × ${days} 日、${from}日目から）`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
