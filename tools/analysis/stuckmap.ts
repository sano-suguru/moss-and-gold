/**
 * 動こうとしているのに進めない場所の地図（足止めの調査）。
 *
 *   npm run stuckmap -- --seed seed7 --days 12 --kind 2
 *   npm run stuckmap -- --seed かしたれ --days 10            （すべての種）
 *
 * 20刻みごとに、動こうとしている（act 1）生き物が、地上の20秒（200刻み）前から半マスも進んでいなければ「足止め」として、
 * そのマスに数える。書き出すもの（--out、既定 runs/stuckmap-<シード>-<種>）：
 *   stuck.png  地形の上に足止めの濃さ（黄→赤）を重ねた地図（1マス3画素）
 *   stuck.md   足止めの多いマス（上位20）：そのマスと上下左右の様子（# 岩、~ 深い水、. 床）、混み具合（そのとき3マス以内にいた数）、多い種と状態
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DAY_TICKS, World } from '../../src/world';
import { KIND_NAMES, encodePng, parseArgs } from './common';

const a = parseArgs(process.argv.slice(2));
const w = new World(a.seed || 'かしたれ');
const e = w.eco as any;
const m = w.map;
const kind = a.kind !== undefined ? +a.kind : -1;
const days = +(a.days || 10);
const out = a.out || `runs/stuckmap-${m.seed}-${kind >= 0 ? kind : 'all'}`;
mkdirSync(out, { recursive: true });
const T = 16;
const N = m.w * m.h;
const heat = new Float32Array(N);
const crowd = new Float32Array(N);
const who = new Map<number, Map<string, number>>();
const hist = new Map<number, [number, number][]>();
let total = 0;

while (w.tick < days * DAY_TICKS) {
  w.step();
  if (w.tick % 20) continue;
  for (const c of e.list) {
    if (c.dead || c.away || (kind >= 0 && c.k !== kind)) continue;
    const H = hist.get(c.id) ?? [];
    hist.set(c.id, H);
    H.push([c.x, c.y]);
    if (H.length > 11) H.shift();
    if (c.act !== 1 || H.length < 11) continue;
    const [ox, oy] = H[0];
    if (Math.hypot(c.x - ox, c.y - oy) >= T / 2) continue;
    const k = Math.floor(c.y / T) * m.w + Math.floor(c.x / T);
    if (k < 0 || k >= N) continue;
    heat[k]++;
    total++;
    let n = 0;
    e.nearby(c.x, c.y, 3, (o: any) => {
      if (o !== c && !o.dead && Math.hypot(o.x - c.x, o.y - c.y) < 3 * T) n++;
    });
    crowd[k] += n;
    const mm = who.get(k) ?? new Map<string, number>();
    who.set(k, mm);
    const key = `${KIND_NAMES[c.k]} st${c.st}`;
    mm.set(key, (mm.get(key) ?? 0) + 1);
  }
}

// 地図：地形（report と同じ色）に、足止めの濃さを重ねる
const S = 3;
const img = new Uint8Array(m.w * S * m.h * S * 4);
let mx = 1;
for (let k = 0; k < N; k++) mx = Math.max(mx, heat[k]);
for (let y = 0; y < m.h; y++)
  for (let x = 0; x < m.w; x++) {
    const k = y * m.w + x;
    let c = [12, 10, 16];
    if (m.rubble[k]) c = [80, 68, 56];
    else if (!m.solid[k]) c = m.lava[k] ? [170, 60, 20] : w.water[k] > 40 ? [40, 70, 110] : m.sealed[k] ? [24, 42, 46] : [70, 68, 80];
    if (heat[k] > 0) {
      const v = Math.min(1, Math.sqrt(heat[k] / mx));
      c = [255, Math.round(230 * (1 - v)), 40];
    }
    for (let yy = 0; yy < S; yy++)
      for (let xx = 0; xx < S; xx++) {
        const p = ((y * S + yy) * m.w * S + x * S + xx) * 4;
        img[p] = c[0];
        img[p + 1] = c[1];
        img[p + 2] = c[2];
        img[p + 3] = 255;
      }
  }
writeFileSync(join(out, 'stuck.png'), encodePng(m.w * S, m.h * S, img));

const cell = (q: number) => (q < 0 || q >= N ? '#' : m.solid[q] ? '#' : m.lava[q] ? '火' : w.water[q] > 40 ? '~' : '.');
const top = [...heat.keys()].filter((k) => heat[k] > 0).sort((p, q) => heat[q] - heat[p]).slice(0, 20);
const L = [
  `# 足止めの地図：${m.seed}、${days}日、${kind >= 0 ? KIND_NAMES[kind] : 'すべての種'}`,
  '',
  `動こうとして（act 1）地上の20秒進めなかった回数（20刻みごとに数える）：全${total}回。地図は stuck.png（黄→赤ほど多い）。`,
  '',
  '| マス | 回数 | 上・右・下・左（自分） | 混み具合（平均） | 多い種と状態 |',
  '|---|---:|---|---:|---|',
  ...top.map((k) => {
    const x = k % m.w;
    const y = Math.floor(k / m.w);
    const nb = [k - m.w, k + 1, k + m.w, k - 1].map(cell).join('') + `（${cell(k)}）`;
    const ws = [...(who.get(k) ?? new Map())].sort((p, q) => q[1] - p[1]).slice(0, 3).map(([s, n]) => `${s} ${n}`).join('、');
    return `| ${x},${y} | ${heat[k]} | ${nb} | ${(crowd[k] / heat[k]).toFixed(1)} | ${ws} |`;
  }),
];
writeFileSync(join(out, 'stuck.md'), L.join('\n'));
console.log(L.join('\n'));
console.log(`\n書き出した：${out}/stuck.png、${out}/stuck.md`);
