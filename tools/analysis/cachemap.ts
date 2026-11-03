/**
 * 物資の置き場が奥へ伸びていく様子（冒険者の作り直しの三歩目）を、ログから表に並べ、マップに描く。
 *
 *   node tools/analysis/launch.mjs cachemap --runs runs/ab-x/new [--seeds abc,seed5] [--png build/img/cache-chain]
 *
 * 表：シードごとに、遠征（深部の探索・竜退治の一行）の順に、入った日、目標、たどった置き場、補った量、残した置き場の入口からの道のり、終わり方。
 * --png を付けると、シードごとにマップ（岩・床、入口、ドラゴン、置き場を残した順の番号）を <png>-<シード>.png に描く（SVG を Playwright でスクリーンショットする）。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { decodeState, readState } from './lib/state';
import { snapsOf } from './lib/runs';

const argv = process.argv.slice(2);
const opt = (k: string, d = '') => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const root = opt('runs');
const only = opt('seeds') ? new Set(opt('seeds').split(',')) : null;
const png = opt('png');
const DAY = 14400;
const AIMS = ['探索', '宝探し', '竜退治', '大物狩り', 'アンデッド祓い', 'ゴブリン退治', '深部の探索'];
const read = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

const dirs = existsSync(join(root, 'settle.jsonl')) ? [root] : readdirSync(root).filter((d) => existsSync(join(root, d, 'settle.jsonl'))).sort().map((d) => join(root, d));
const L: string[] = [];
const shots: { svg: string; out: string }[] = [];
for (const dir of dirs) {
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  if (only && !only.has(meta.seed)) continue;
  const s = read(join(dir, 'settle.jsonl'));
  const caches = s.filter((x) => x.k === 25 && x.ev === 'cache');
  if (!caches.length) continue;
  L.push(`### ${meta.seed}`, '', '| 遠征 | 入った日 | 目標 | たどって補った置き場（入口からの道のり：補った量） | 残した置き場（入口からの道のり） | 終わり方 |', '|---:|---:|---|---|---|---|');
  const parties = s.filter((x) => x.k === 25 && x.ev === 'enter' && (x.how === 6 || x.how === 2));
  let i = 0;
  for (const p of parties) {
    const sup = new Map<number, { d: number; n: number }>();
    for (const x of s.filter((q) => q.k === 25 && q.ev === 'supply' && q.id === p.id)) {
      const o = sup.get(x.to) ?? { d: x.how, n: 0 };
      o.n += x.n;
      sup.set(x.to, o);
    }
    const left = caches.filter((x) => x.id === p.id);
    const end = s.find((x) => x.k === 25 && x.ev === 'end' && x.id === p.id);
    const arr = s.find((x) => x.k === 25 && x.ev === 'arrive' && x.id === p.id);
    if (!sup.size && !left.length && p.how !== 2) continue;
    i++;
    L.push(`| ${i} | ${(p.t / DAY).toFixed(2)} | ${AIMS[p.how]}${p.how === 2 && p.to ? '（道を知って）' : ''} | ${[...sup.values()].map((o) => `${o.d}：${o.n}`).join('、') || '—'} | ${left.map((x) => `${x.how}${x.merged ? '（足した）' : ''}`).join('、') || '—'} | ${arr ? '着いた・' : ''}${end ? (end.reason === 'wiped' ? '全滅' : '生還') : '（途中）'} |`);
  }
  L.push('', `置き場の道のりの推移（新しく残した順）：${caches.filter((x) => !x.merged).map((x) => x.how).join(' → ')}（最大 ${Math.max(...caches.map((x) => x.how))}）`, '');
  if (png) {
    const snap = snapsOf(dir);
    const days = readdirSync(snap).map((f) => /^d(\d+)\.json\.gz$/.exec(f)).filter(Boolean).map((m) => +m![1]).sort((a, b) => b - a);
    const w = decodeState(readState(join(snap, `d${String(days[0]).padStart(3, '0')}.json.gz`)));
    const m = w.map;
    const T = 5;
    const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${m.w * T}" height="${m.h * T + 28}" font-family="sans-serif"><rect width="100%" height="100%" fill="#14110f"/>`];
    for (let y = 0; y < m.h; y++) {
      let x0 = -1;
      for (let x = 0; x <= m.w; x++) {
        const k = y * m.w + x;
        const open = x < m.w && !m.solid[k] && !m.sealed[k];
        if (open && x0 < 0) x0 = x;
        if (!open && x0 >= 0) {
          parts.push(`<rect x="${x0 * T}" y="${y * T}" width="${(x - x0) * T}" height="${T}" fill="#5b5148"/>`);
          x0 = -1;
        }
      }
    }
    for (let k = 0; k < m.solid.length; k++) if (m.lava[k]) parts.push(`<rect x="${(k % m.w) * T}" y="${Math.floor(k / m.w) * T}" width="${T}" height="${T}" fill="#c0461c"/>`);
    parts.push(`<rect x="${m.entrance.x * T - 4}" y="0" width="${T + 8}" height="${T * 2}" fill="#ffffff"/><text x="${m.entrance.x * T + 10}" y="14" fill="#fff" font-size="13">入口</text>`);
    for (const c of (w.eco as any).list) if (!c.dead && c.k === 24) parts.push(`<circle cx="${c.x / 16 * T}" cy="${c.y / 16 * T}" r="7" fill="#e03030" stroke="#fff"/><text x="${c.x / 16 * T + 9}" y="${c.y / 16 * T + 4}" fill="#ff8080" font-size="12">竜</text>`);
    const news = caches.filter((x) => !x.merged);
    news.forEach((x, j) => {
      const h = Math.round(200 - (160 * j) / Math.max(1, news.length - 1));
      parts.push(`<circle cx="${x.x / 16 * T}" cy="${x.y / 16 * T}" r="8" fill="hsl(${h},80%,55%)" stroke="#000"/><text x="${x.x / 16 * T}" y="${x.y / 16 * T + 4}" text-anchor="middle" fill="#000" font-size="11" font-weight="bold">${j + 1}</text>`);
    });
    parts.push(`<text x="6" y="${m.h * T + 20}" fill="#ddd" font-size="14">${meta.seed}：物資の置き場（番号は残した順、道のり ${news.map((x) => x.how).join(' → ')} マス）</text></svg>`);
    shots.push({ svg: parts.join(''), out: `${png}-${meta.seed}.png` });
  }
}
console.log(L.join('\n'));
if (opt('out')) writeFileSync(opt('out'), L.join('\n') + '\n');
if (shots.length) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require('playwright');
  (async () => {
    const b = await chromium.launch();
    const pg = await b.newPage();
    for (const sh of shots) {
      await pg.setContent(`<html><body style="margin:0;background:#000">${sh.svg}</body></html>`);
      const el = await pg.$('svg');
      await el.screenshot({ path: sh.out });
      console.log(`→ ${sh.out}`);
    }
    await b.close();
  })();
}
