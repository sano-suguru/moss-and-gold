// 同じシードから同じダンジョンと同じ展開が得られることを確かめる
import { generate, MAP_W, MAP_H } from '../src/mapgen';
import { World, DAY_TICKS } from '../src/world';

function fnv(a: ArrayLike<number>): number {
  let h = 2166136261;
  for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function check(cond: boolean, msg: string) { if (!cond) { console.error('NG: ' + msg); process.exitCode = 1; } else console.log('OK: ' + msg); }

for (const seed of ['かしたれ', 'abc', 'はじまりの洞窟']) {
  const a = generate(seed), b = generate(seed);
  check(fnv(a.solid) === fnv(b.solid) && fnv(a.moss) === fnv(b.moss), `${seed}: 地形と苔が一致`);
  const floor = a.solid.reduce((s, v) => s + (v ? 0 : 1), 0);
  console.log(`   床 ${(floor / (MAP_W * MAP_H) * 100).toFixed(1)}%  部屋 ${a.rooms.length}  光の筋 ${a.shafts.length}  苔 ${a.patches.length}  入口 x=${a.entrance.x}  hash=${fnv(a.solid).toString(16)}`);
  check(a.shafts.every(s => !a.solid[s.y * MAP_W + s.x]), `${seed}: 光の筋はすべて床の上`);
  check(!a.solid[a.entrance.x] && !a.solid[MAP_W + a.entrance.x], `${seed}: 入口が開いている`);
}
check(fnv(generate('かしたれ').solid) !== fnv(generate('abc').solid), '別のシードでは別の地形');
{
  // 30個のシードで、溶岩を除いた床がすべて入口から歩いて行けること
  let bad = 0;
  for (let i = 0; i < 30; i++) {
    const m = generate('seed' + i);
    const seen = new Uint8Array(m.w * m.h); const st = [m.entrance.x]; seen[m.entrance.x] = 1; let n = 0;
    while (st.length) { const c = st.pop()!; n++; const x = c % m.w, y = (c / m.w) | 0;
      for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) { if (nx<0||ny<0||nx>=m.w||ny>=m.h) continue; const q = ny*m.w+nx; if (!seen[q] && !m.solid[q] && !m.lava[q]) { seen[q] = 1; st.push(q); } } }
    let total = 0; for (let k = 0; k < m.w * m.h; k++) if (!m.solid[k] && !m.lava[k] && !m.sealed[k]) total++;
    if (n !== total) bad++;
    // 入口から歩けるのは開いた洞窟だけで、閉じた空洞へは歩いて行けない
    for (let k = 0; k < m.w * m.h; k++) if (seen[k] && m.sealed[k]) { bad++; break; }
  }
  check(bad === 0, `30個のシードすべてで、入口から開いた床すべてへ歩いて行け、閉じた空洞へは行けない`);
  // 開いた洞窟の広さ、光の筋と湧き水、すぐそばの閉じた空洞
  let badOpen = 0;
  for (let i = 0; i < 30; i++) {
    const m = generate('seed' + i);
    let open = 0;
    let nearPocket = false;
    for (let k = 0; k < m.w * m.h; k++) {
      if (m.solid[k] || m.lava[k] || m.sealed[k]) continue;
      open++;
      const x = k % m.w, y = (k / m.w) | 0;
      for (let dy = -3; dy <= 3 && !nearPocket; dy++) for (let dx = -3; dx <= 3; dx++) { const q = (y + dy) * m.w + x + dx; if (q >= 0 && q < m.w * m.h && m.sealed[q] && !m.solid[q]) { nearPocket = true; break; } }
    }
    const sh = m.shafts.some((p) => !m.solid[p.y * m.w + p.x] && !m.sealed[p.y * m.w + p.x]);
    const sp = m.springs.some((p) => !m.solid[p.y * m.w + p.x] && !m.sealed[p.y * m.w + p.x]);
    if (open < 1200 || open > 3200 || !sh || !sp || !nearPocket) badOpen++;
  }
  check(badOpen === 0, `30個のシードすべてで、開いた洞窟は地図の約12分の1、光の筋と湧き水があり、3マス以内に閉じた空洞がある`);
  let mz = 0;
  for (let i = 0; i < 30; i++) if (generate('seed' + i).maze.some((v) => v)) mz++;
  check(mz >= 27, `30個のシードのうち ${mz} 個に迷路の区画がある`);
  let vs = 0;
  for (let i = 0; i < 30; i++) if (generate('seed' + i).vaultCenter.x >= 0) vs++;
  check(vs >= 28, `30個のシードのうち ${vs} 個に宝物庫がある`);
}

let lastGold = { ok: false, g: 0 };
let lastRock = { ok: false, dug: 0, rub: 0 };
const run = () => {
  const w = new World('かしたれ');
  const total0 = w.totalNutrients();
  const gold0 = w.eco.totalGold();
  let conserved = true;
  let goldOk = gold0 > 0;
  let rockOk = true;
  for (let i = 0; i < DAY_TICKS * 1.5; i++) {
    w.step();
    if (i % 20 === 0) { w.computeGlow(); w.updateSeen(); }
    if (i % 1000 === 0 && w.totalNutrients() - w.eco.imported + w.eco.exported - w.born + w.washed !== total0) conserved = false;
    if (i % 1000 === 0 && w.totalMana() - w.manaBorn + w.manaLeaked + w.manaFaded !== 0) conserved = false;
    if (i % 1000 === 0 && w.eco.totalGold() !== gold0 + w.eco.goldIn - w.eco.goldOut) goldOk = false;
    if (i % 1000 === 0 && w.rockLedger() !== w.initialRock) rockOk = false;
  }
  goldOk = goldOk && w.eco.totalGold() === gold0 + w.eco.goldIn - w.eco.goldOut;
  lastGold = { ok: goldOk, g: gold0 };
  lastRock = { ok: rockOk && w.rockLedger() === w.initialRock, dug: w.digs.filter((o) => (o & 7) === 0).length, rub: w.digs.filter((o) => (o & 7) === 1 || (o & 7) === 2).length };
  const eco = JSON.stringify(w.eco.serialize());
  return { seen: fnv(w.seen), n: w.seen.reduce((s, v) => s + v, 0), water: fnv(new Uint8Array(w.water.buffer)), nutr: fnv(new Uint8Array(w.nutr.buffer)), moss: fnv(w.moss), eco: fnv(new TextEncoder().encode(eco)), alive: w.eco.list.filter(c => !c.dead).length, conserved: conserved && w.totalNutrients() - w.eco.imported + w.eco.exported - w.born + w.washed === total0, total: total0 };
};
const r1 = run(), r2 = run();
check(r1.seen === r2.seen, `1日半進めた「見たマス」が一致（${r1.n} マス）`);
check(r1.water === r2.water && r1.nutr === r2.nutr && r1.moss === r2.moss, '1日半進めた水・養分・苔が一致');
check(r1.eco === r2.eco, `1日半進めた生き物の状態が一致（${r1.alive} 匹）`);
check(r1.conserved, `養分の総量（土＋苔＋生き物）が、外との出入りと生まれた分・流れ出た分を除いて常に一定（${r1.total}）`);
check(lastRock.ok, `岩の帳簿（岩＋瓦礫＋掘り出した土−崩落）が常にはじめの岩と一致（掘った ${lastRock.dug}、瓦礫と崩落 ${lastRock.rub}）`);
check(lastGold.ok, `金貨の総量（山＋抱えている分）が、外との出入りを除いて常に一定（${lastGold.g}）`);
// 保存して読み込み直しても、続きの展開が変わらない
{
  const a = new World('かしたれ');
  for (let i = 0; i < DAY_TICKS * 6.0; i++) a.step();
  const b = new World('かしたれ', { tick: a.tick, seen: Uint8Array.from(a.seen), water: Int32Array.from(a.water), nutr: Int32Array.from(a.nutr), moss: Uint8Array.from(a.moss), fungus: Uint8Array.from(a.fungus), burn: Uint8Array.from(a.burn), ash: Uint8Array.from(a.ash), mat: Uint8Array.from(a.mat), born: a.born, washed: a.washed, mana: Int32Array.from(a.mana), manaBorn: a.manaBorn, manaLeaked: a.manaLeaked, manaFaded: a.manaFaded, digs: a.digs.slice(), eco: JSON.parse(JSON.stringify(a.eco.serialize())) });
  const digs0 = a.digs.length;
  for (let i = 0; i < DAY_TICKS * 0.8; i++) { a.step(); b.step(); }
  check(JSON.stringify(a.eco.serialize()) === JSON.stringify(b.eco.serialize()) && fnv(a.moss) === fnv(b.moss) && fnv(a.fungus) === fnv(b.fungus) && a.digs.join() === b.digs.join() && fnv(a.ash) === fnv(b.ash), `保存から読み込み直しても続きの展開が一致（掘られた岩 ${digs0}→${a.digs.length} マス、キノコ ${a.totalFungus}）`);
}

// 縮小した地図を表示（# 岩、. 床、* 光の筋、E 入口）
const m = generate('かしたれ');
const lines: string[] = [];
for (let y = 0; y < MAP_H; y += 3) {
  let s = '';
  for (let x = 0; x < MAP_W; x += 2) {
    let ch = m.solid[y * MAP_W + x] ? '#' : '.';
    if (m.shafts.some(q => Math.abs(q.x - x) <= 1 && Math.abs(q.y - y) <= 1)) ch = '*';
    if (y === 0 && Math.abs(x - m.entrance.x) <= 1) ch = 'E';
    s += ch;
  }
  lines.push(s);
}
console.log(lines.join('\n'));
