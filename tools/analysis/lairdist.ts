/** 竜の寝床・深部・置き場の、入口から歩いた道のり（三歩目の調べ物）。node tools/analysis/launch.mjs lairdist --runs runs/ab-x/new --day 25 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { decodeState, readState } from './lib/state';
import { snapsOf } from './lib/runs';
const argv = process.argv.slice(2);
const opt = (k: string, d = '') => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const root = opt('runs');
const day = +opt('day', '25');
for (const d of readdirSync(root).filter((x) => existsSync(join(root, x, 'meta.json'))).sort()) {
  const p = join(snapsOf(join(root, d)), `d${String(day).padStart(3, '0')}.json.gz`);
  if (!existsSync(p)) continue;
  const w = decodeState(readState(p));
  const e = w.eco as any;
  const m = w.map;
  const dist = e.walkDist(1 * m.w + m.entrance.x, 2000);
  const at = (x: number, y: number) => dist[Math.floor(y / 16) * m.w + Math.floor(x / 16)];
  const dr = e.list.filter((c: any) => !c.dead && !c.away && c.k === 24).map((c: any) => `${['幼', '若', '成'][c.sp]}${at(c.x, c.y)}`);
  console.log(`${d}: 竜 ${dr.join(' ') || 'なし'}　深部 ${dist[m.deep.y * m.w + m.deep.x]}　置き場 ${e.caches.map((o: any) => `${o.d}(${o.food})`).join(' ')}`);
}
