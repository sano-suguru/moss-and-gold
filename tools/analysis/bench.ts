/**
 * シミュレーションの実行速度を測る：固定のスナップショットから、シードを一つずつ（並列にせずに）進めて、ゲーム内の1日あたりの秒数を出す。
 *
 *   npm run bench                                       既定：seed4、かしたれ、seed7 を、HEAD の10日目のスナップショットから1日
 *   npm run bench -- --seeds abc,seed8 --from 15 --days 2
 *   npm run bench -- --warm 1 --days 2                  1日進めて JIT を落ち着かせてから2日を測る（A/B 比較のように長く進めるときの速さ）
 *
 * 状態は lib/open.ts の openAt で取得する（作業ツリーのスナップショットがなければ HEAD のスナップショットから）。状態を読む時間は数えない。
 * 読み込んだ直後の1日ほどは JIT の最適化が落ち着かず、落ち着いたあとより3割ほど遅い。--warm を付けると、--from の日からその日数だけ進めたあとの --days 日を測る。
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
const warm = +(a.warm ?? 0);

async function main() {
  let total = 0;
  const rows: string[] = [];
  for (const s of seeds) {
    let best = Infinity;
    let alive = 0;
    for (let r = 0; r < rep; r++) {
      const { w } = await openAt(s, from * DAY_TICKS, { quiet: r > 0, base: a.base });
      while (w.tick < (from + warm) * DAY_TICKS) tick(w);
      const t0 = performance.now();
      while (w.tick < (from + warm + days) * DAY_TICKS) tick(w);
      best = Math.min(best, (performance.now() - t0) / 1000);
      alive = w.eco.list.filter((c) => !c.dead).length;
    }
    total += best;
    rows.push(`${s}\t${(best / days).toFixed(2)} 秒/日\t（生き物 ${alive}）`);
  }
  console.log(rows.join('\n'));
  console.log(`合計 ${total.toFixed(2)} 秒（${seeds.length} シード × ${days} 日、${from}日目から${warm ? `${warm}日進めたあと` : ''}）`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
