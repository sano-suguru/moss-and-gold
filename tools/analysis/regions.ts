/** 歩いてつながっている洞窟（開いた床のまとまり）ごとに、大きさと、入口や口や生き物がどれに属するかを調べる */
import { DAY_TICKS, World } from '../../src/world';
const w = new World(process.argv[2] || 'abc'); const e = w.eco as any; const m = w.map;
const day = +(process.argv[3] || 8);
while (w.tick < day * DAY_TICKS) w.step();
const N = m.w * m.h; const reg = new Int32Array(N).fill(-1); const sizes: number[] = [];
for (let s = 0; s < N; s++) {
  if (reg[s] >= 0 || m.solid[s] || m.sealed[s]) continue;
  const id = sizes.length; let n = 0; const q = [s]; reg[s] = id;
  for (let h = 0; h < q.length; h++) { const k = q[h]; n++; for (const nb of [k + 1, k - 1, k + m.w, k - m.w]) { if (nb < 0 || nb >= N || reg[nb] >= 0 || m.solid[nb] || m.sealed[nb]) continue; reg[nb] = id; q.push(nb); } }
  sizes.push(n);
}
const at = (x: number, y: number) => reg[Math.floor(y / 16) * m.w + Math.floor(x / 16)];
const ent = reg[m.w + m.entrance.x];
console.log('洞窟のまとまり', sizes.length, '入口のまとまりの大きさ', sizes[ent]);
m.mouths.forEach((mo: any, i: number) => { const [x, y] = e.mouthSpot(i); console.log('口', ['横穴', '裂け目', '川'][mo.kind], mo.x, mo.y, e.mouthOpen(i) ? '開' : '閉', 'まとまり', at(x, y), '大きさ', sizes[at(x, y)] ?? '-', at(x, y) === ent ? '（入口とつながる）' : ''); });
const by: Record<string, Record<string, number>> = {};
for (const c of e.list) { if (c.dead || c.away || ![10, 12, 13, 2, 25].includes(c.k)) continue; const r = at(c.x, c.y); const key = r === ent ? '入口側' : r < 0 ? '岩/閉' : `別${r}`; (by[c.k] ??= {})[key] = (by[c.k][key] ?? 0) + 1; }
console.log(JSON.stringify(by));
