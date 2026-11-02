import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || "abc"); const e = w.eco as any;
const drift = () => w.totalMana() - w.manaBorn + w.manaLeaked + w.manaFaded;
let d0 = drift(); let first = true;
const snap = () => new Map(e.list.map((c: any) => [c.id, `${c.k},${c.dead},${c.mana}`]));
let prev = snap();
while (w.tick < +(process.argv[3] || 3) * DAY_TICKS) {
  w.step();
  const d = drift();
  if (d !== d0 && first) {
    console.log('ずれ', (w.tick / DAY_TICKS).toFixed(3), d0, '→', d);
    for (const c of e.list) { const b = prev.get(c.id); const n = `${c.k},${c.dead},${c.mana}`; if (b !== n) console.log('  変化', c.id, b, '→', n); }
    for (const [id, b] of prev) if (!e.list.some((c: any) => c.id === id)) console.log('  消えた', id, b);
    first = false;
  }
  d0 = d; prev = snap();
}
let maxv = 0, sum = 0, n = 0; for (let k = 0; k < w.mana.length; k++) { if (w.mana[k] > maxv) maxv = w.mana[k]; if (w.mana[k] > 0) { sum += w.mana[k]; n++; } }
console.log('終わり', (w.tick / DAY_TICKS).toFixed(2), 'ずれ', drift(), '土', w.soilMana(), '生き物', e.heldMana(), '湧いた', w.manaBorn, '逃げた', w.manaLeaked, '薄れた', w.manaFaded, '最大', maxv, 'マナのあるマス', n);
// 入口からの道のり別の、土のマナの平均
{
  const m = w.map; const N = m.w * m.h; const dist = new Int32Array(N).fill(-1); const q: number[] = [];
  for (const x of [m.entrance.x, m.entrance.x + 1]) { const k = m.w + x; dist[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) { const k = q[h]; for (const nb of [k + 1, k - 1, k + m.w, k - m.w]) { if (nb < 0 || nb >= N || dist[nb] >= 0 || m.solid[nb] || m.sealed[nb]) continue; dist[nb] = dist[k] + 1; q.push(nb); } }
  const bands: number[][] = []; for (let k = 0; k < N; k++) { if (dist[k] < 0) continue; const b = Math.min(9, Math.floor(dist[k] / 25)); (bands[b] ??= []).push(w.mana[k]); }
  console.log('入口からの道のり（25マスごと）の平均マナ', bands.map((a, i) => `${i * 25}-:${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}`).join(' '));
  const wis = e.list.filter((c: any) => c.k === 0 && !c.dead); console.log('ウィスプ', wis.length, 'マナを持つ', wis.filter((c: any) => c.mana > 0).length);
}
