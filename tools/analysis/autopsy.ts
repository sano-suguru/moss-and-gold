/**
 * 死んだときの様子を集める（npm run probe -- deaths の別名。日数の指定のしかただけが違う）。
 *
 *   npm run autopsy -- --seed seed7 --days 25 --kind 2 --cause starve       0〜25日目
 *   npm run autopsy -- --seed seed7 --from 18 --to 20 --kind 2 --cause starve
 *
 * 途中の状態の保存庫から始める（lib/open.ts）。詳しくは probe.ts。
 */
import { main } from './probe';
const argv = process.argv.slice(2);
const i = argv.indexOf('--days');
if (i >= 0 && !argv.includes('--to')) argv.splice(i, 2, '--to', argv[i + 1], ...(argv.includes('--from') || argv.includes('--day') ? [] : ['--from', '0']));
main(['deaths', ...argv]).catch((err) => {
  console.error(err);
  process.exit(1);
});
