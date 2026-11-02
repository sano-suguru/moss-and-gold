/** 冒険者が動く範囲と、人に近い種が暮らす範囲を比べる（入口からの道のり） */
import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc'); const e = w.eco as any; const m = w.map;
const dist = () => { const N = m.w * m.h; const d = new Int32Array(N).fill(-1); const q: number[] = []; for (const x of [m.entrance.x, m.entrance.x + 1]) { const k = m.w + x; d[k] = 0; q.push(k); } for (let h = 0; h < q.length; h++) { const k = q[h]; for (const n of [k + 1, k - 1, k + m.w, k - m.w]) { if (n < 0 || n >= N || d[n] >= 0 || m.solid[n] || m.sealed[n]) continue; d[n] = d[k] + 1; q.push(n); } } return d; };
const adv: number[] = [], hum: number[] = [], unreach: Record<string, number> = {}; let campsInfo = '';
while (w.tick < 12 * DAY_TICKS) {
  w.step();
  if (w.tick % 1800 || w.tick < 2 * DAY_TICKS) continue;
  const d = dist();
  for (const c of e.list) {
    if (c.dead || c.away) continue;
    const k = Math.floor(c.y / 16) * m.w + Math.floor(c.x / 16);
    if (c.k === 25) adv.push(d[k]);
    if ([10, 12, 13].includes(c.k)) { if (d[k] < 0) unreach[c.k] = (unreach[c.k] ?? 0) + 1; else hum.push(d[k]); }
  }
  campsInfo = e.camps.filter((c: any) => c.id >= 0).map((c: any) => `集落${c.kind === 0 ? 'ゴブリン' : 'リザードマン'}:${d[Math.floor(c.y / 16) * m.w + Math.floor(c.x / 16)]}`).join(' ') + ' ' + e.warrens.map((r: any) => `住処:${d[Math.floor(r.y / 16) * m.w + Math.floor(r.x / 16)]}`).join(' ');
}
const q = (a: number[], p: number) => { const s = a.filter((v) => v >= 0).sort((x, y) => x - y); return s[Math.floor(s.length * p)] ?? -1; };
console.log('冒険者 入口からの道のり 中央', q(adv, 0.5), '9割', q(adv, 0.9), '最大', q(adv, 0.999));
console.log('人に近い種 中央', q(hum, 0.5), '1割', q(hum, 0.1), '最小', q(hum, 0), '入口からたどり着けない所にいた回数', JSON.stringify(unreach));
console.log('最後の集落と住処', campsInfo);
console.log('外の世界の地図の区画', e.lore.explored.length, '危ない区画', e.lore.danger.length, '宝の区画', e.lore.gold.length);
