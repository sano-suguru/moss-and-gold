/**
 * 名簿の推移（冒険者の作り直しの五歩目）：回した結果の settle.jsonl から、シードごとに25日の間の名簿の様子を数える。
 *   node tools/analysis/rosterlog.mjs runs/ab-x/new [--days 5,10,15,20,25]
 * 各位の人数（日ごと）、英雄が生まれた日、倒れた数（位ごと）、新人の数、墓標、遠征の延べ人数と再訪。
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
const dir = process.argv[2];
const di = process.argv.indexOf('--days');
const days = (di > 0 ? process.argv[di + 1] : '5,10,15,20,25').split(',').map(Number);
const D = 14400;
const R = ['見', '熟', '歴', '英'];
const rows = [];
const tot = { fallen: [0, 0, 0, 0], recruit: 0, grave: 0, trips: 0, again: 0, hero: 0 };
for (const s of readdirSync(dir).filter((d) => /^\d\d-/.test(d)).sort()) {
  const f = join(dir, s, 'settle.jsonl');
  if (!existsSync(f)) continue;
  const S = readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.k === 25);
  const rank = new Map();
  let started = false;
  const snap = [];
  let di2 = 0;
  const fallen = [0, 0, 0, 0];
  let recruit = 0, grave = 0, trips = 0, again = 0, heroAt = -1;
  const count = () => { const c = [0, 0, 0, 0]; for (const r of rank.values()) c[r]++; return c; };
  for (const x of S) {
    while (di2 < days.length && x.t >= days[di2] * D) { snap.push(started ? count() : [12, 0, 0, 0]); di2++; }
    if (x.ev === 'hero') {
      if (!started) started = true;
      if (!rank.has(x.n)) rank.set(x.n, x.to ?? 0);
      trips++;
      if ((x.how ?? 0) >= 2) again++;
    } else if (x.ev === 'rank') {
      rank.set(x.n, x.how);
      if (x.how === 3 && heroAt < 0) heroAt = x.t / D;
    } else if (x.ev === 'fallen') {
      fallen[x.how ?? 0]++;
      rank.delete(x.n);
    } else if (x.ev === 'recruit') {
      recruit++;
      rank.set(x.n, 0);
    } else if (x.ev === 'grave') grave++;
  }
  // 一度も入っていない名簿の者（見習い）は数えないので、12人に足りない分は見習いとして足す
  const fix = (c) => { const n = c.reduce((a, v) => a + v, 0); c[0] += Math.max(0, 12 - n); return c; };
  while (snap.length < days.length) snap.push(started ? count() : [12, 0, 0, 0]);
  rows.push(`| ${s} | ${snap.map((c) => fix(c).map((v, i) => `${R[i]}${v}`).join(' ')).join(' | ')} | ${heroAt >= 0 ? heroAt.toFixed(1) + '日目' : '—'} | ${fallen.join(' / ')} | ${recruit} | ${grave} | ${trips}（再訪 ${again}） |`);
  fallen.forEach((v, i) => (tot.fallen[i] += v));
  tot.recruit += recruit; tot.grave += grave; tot.trips += trips; tot.again += again; if (heroAt >= 0) tot.hero++;
}
console.log(`| シード | ${days.map((d) => `${d}日目`).join(' | ')} | 初めての英雄 | 倒れた（見・熟・歴・英） | 新人 | 墓標 | 遠征の延べ人数 |`);
console.log(`|---|${days.map(() => '---').join('|')}|---|---|---:|---:|---|`);
for (const r of rows) console.log(r);
console.log(`| **合計** | ${days.map(() => '').join(' | ')} | 英雄の出たシード ${tot.hero} | ${tot.fallen.join(' / ')} | ${tot.recruit} | ${tot.grave} | ${tot.trips}（再訪 ${tot.again}） |`);
