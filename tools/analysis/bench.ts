/**
 * シミュレーションの実行速度を測る：固定のスナップショットから、シードを一つずつ（並列にせずに）進めて、ゲーム内の1日あたりの秒数を出す。
 *
 *   npm run bench                                       既定：seed4、かしたれ、seed7 を、HEAD の10日目のスナップショットから1日
 *   npm run bench -- --seeds abc,seed8 --from 15 --days 2
 *
 * 状態は lib/open.ts の openAt で取得する（作業ツリーのスナップショットがなければ HEAD のスナップショットから）。状態を読む時間は数えない。
 * 同じマシンでも数％は揺れるので、変更の前後は続けて測る（--repeat 2 で2回ずつ測り、速いほうを使う）。
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
