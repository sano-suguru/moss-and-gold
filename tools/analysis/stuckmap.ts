/**
 * 動こうとしているのに進めない場所のマップ（npm run probe -- stuck の別名）。
 *
 *   npm run stuckmap -- --seed seed7 --days 12 --kind 2          0〜12日目
 *   npm run stuckmap -- --seed seed7 --from 10 --to 12 --kind 2  キャッシュにあるスナップショットから
 */
import { main } from './probe';
const argv = process.argv.slice(2);
const i = argv.indexOf('--days');
if (i >= 0 && !argv.includes('--to')) argv.splice(i, 2, '--to', argv[i + 1], ...(argv.includes('--from') ? [] : ['--from', '0']));
main(['stuck', ...argv]).catch((err) => {
  console.error(err);
  process.exit(1);
});
