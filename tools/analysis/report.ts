/**
 * sim のログから、レポート（report.md）とマップの画像を作る。
 *
 *   npm run report -- --run runs/kashitare
 *
 * 作るもの（同じフォルダ）：
 *   report.md     種ごとの数の移り変わり、死因と手を下した種、生き物の由来、死に場所の偏り、保存則、おかしな兆候
 *   deaths.png    地形の上に、死んだ場所の濃さ（赤）を重ねたマップ（1マス3px）
 *   mana.png      地形の上に、マナの濃さ（紫）を重ねたマップ
 *   births.png    地形の上に、生き物が現れた場所（入口・裂け目・中で生まれた）を重ねたマップ
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DAY_TICKS, World } from '../../src/world';
import { CAUSE_NAMES, KIND_NAMES, ORIGIN_NAMES, encodePng, parseArgs } from './common';

const args = parseArgs(process.argv.slice(2));
const run = args.run;
if (!run) throw new Error('--run <フォルダ> を指定してください');
const rd = (f: string) =>
  readFileSync(join(run, f), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
const samples = rd('samples.jsonl');
const deaths = rd('deaths.jsonl');
const births = rd('births.jsonl');
const exits = rd('exits.jsonl');
const events = rd('events.jsonl');
// 足踏みのログは、記録を始める前のバージョンの実行結果には無い
const stuck = existsSync(join(run, 'stuck.jsonl')) ? rd('stuck.jsonl') : [];
const meta = JSON.parse(readFileSync(join(run, 'meta.json'), 'utf8'));
const cp = JSON.parse(readFileSync(join(run, 'checkpoint.json'), 'utf8'));
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));
const w = new World(cp.seed, { tick: cp.tick, seen: new Uint8Array(cp.n), water: new Int32Array(unb64(cp.water).buffer), nutr: new Int32Array(unb64(cp.nutr).buffer), moss: unb64(cp.moss), fungus: unb64(cp.fungus), burn: unb64(cp.burn), ash: unb64(cp.ash), mat: unb64(cp.mat), born: cp.born, washed: cp.washed, mana: cp.mana ? new Int32Array(unb64(cp.mana).buffer) : undefined, manaBorn: cp.manaBorn, manaLeaked: cp.manaLeaked, manaFaded: cp.manaFaded, digs: cp.digs, eco: cp.eco });
const m = w.map;
const name = (k: number) => (k >= 0 ? KIND_NAMES[k] ?? `種${k}` : '—');
const days = samples.length ? samples[samples.length - 1].day : 0;
const L: string[] = [];
L.push(`# シミュレーションのレポート：シード「${meta.seed}」、${days.toFixed(2)}日`, '');

// ---- 種ごとの数 ----
const kinds = new Set<number>();
for (const s of samples) for (const k of Object.keys(s.counts)) kinds.add(+k);
const daysMarks = [0, 0.25, 0.5, 0.75, 1].map((f) => samples[Math.min(samples.length - 1, Math.floor((samples.length - 1) * f))]);
L.push('## 種ごとの数', '', `| 種 | ${daysMarks.map((s) => `${s.day.toFixed(1)}日`).join(' | ')} | 最少 | 最多 | 絶えた日 |`, `|---|${daysMarks.map(() => '---:').join('|')}|---:|---:|---|`);
const anomalies: string[] = [];
for (const k of [...kinds].sort((a, b) => a - b)) {
  const series = samples.map((s) => s.counts[k] ?? 0);
  const mx = Math.max(...series);
  const mn = Math.min(...series);
  let gone = '';
  const lastAlive = series.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  if (mx >= 5 && lastAlive < series.length - 1) {
    gone = `${samples[lastAlive + 1].day.toFixed(2)}`;
    if (series.slice(lastAlive + 1).every((v) => v === 0) && series.length - lastAlive > 8) anomalies.push(`${name(k)}が${gone}日目に絶え、その後戻っていない（最多${mx}）`);
  }
  const med = [...series].sort((a, b) => a - b)[Math.floor(series.length / 2)];
  if (med >= 5 && mx > med * 4) anomalies.push(`${name(k)}が一時的に増えすぎた（中央値${med}に対し最多${mx}）`);
  L.push(`| ${name(k)} | ${daysMarks.map((s) => s.counts[k] ?? 0).join(' | ')} | ${mn} | ${mx} | ${gone} |`);
}
L.push('');

// ---- 死因 ----
const byCause = new Map<string, number>();
const byKindCause = new Map<number, Map<string, number>>();
const killers = new Map<string, number>();
for (const d of deaths) {
  byCause.set(d.cause, (byCause.get(d.cause) ?? 0) + 1);
  if (!byKindCause.has(d.k)) byKindCause.set(d.k, new Map());
  const mm = byKindCause.get(d.k) as Map<string, number>;
  mm.set(d.cause, (mm.get(d.cause) ?? 0) + 1);
  if (d.by >= 0) {
    const key = `${name(d.by)} → ${name(d.k)}`;
    killers.set(key, (killers.get(key) ?? 0) + 1);
  }
}
L.push(`## 死因（全${deaths.length}件）`, '');
for (const [c, n] of [...byCause].sort((a, b) => b[1] - a[1])) L.push(`- ${CAUSE_NAMES[c] ?? c}：${n}（${((n / deaths.length) * 100).toFixed(1)}％）`);
L.push('', '### 種ごとの死因', '', '| 種 | 死んだ数 | 内訳 |', '|---|---:|---|');
for (const [k, mm] of [...byKindCause].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))) {
  const tot = [...mm.values()].reduce((x, y) => x + y, 0);
  L.push(`| ${name(k)} | ${tot} | ${[...mm].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${CAUSE_NAMES[c] ?? c} ${n}`).join('、')} |`);
}
L.push('', '### 誰が誰を（多い順に20組）', '');
for (const [k, n] of [...killers].sort((a, b) => b[1] - a[1]).slice(0, 20)) L.push(`- ${k}：${n}`);
L.push('');

// ---- 由来 ----
const byOrigin = new Map<number, Map<string, number>>();
for (const b of births) {
  if (!byOrigin.has(b.k)) byOrigin.set(b.k, new Map());
  const mm = byOrigin.get(b.k) as Map<string, number>;
  mm.set(b.origin, (mm.get(b.origin) ?? 0) + 1);
}
L.push(`## 生き物の由来（全${births.length}件）`, '', '| 種 | 正面の入口 | 地表の横穴 | 地底の裂け目 | 川の口 | 天井の裂け目 | マナから | 中で生まれた |', '|---|---:|---:|---:|---:|---:|---:|---:|');
for (const [k, mm] of [...byOrigin].sort((a, b) => a[0] - b[0])) L.push(`| ${name(k)} | ${mm.get('entrance') ?? 0} | ${mm.get('mouth') ?? 0} | ${mm.get('fissure') ?? 0} | ${mm.get('river') ?? 0} | ${mm.get('shaft') ?? 0} | ${mm.get('mana') ?? 0} | ${mm.get('born') ?? 0} |`);
const ent = births.filter((b) => b.origin === 'entrance').length;
L.push('', `口が開いた日：${w.map.mouths.map((mo, i) => `${['地表の横穴', '地底の裂け目', '川の口'][mo.kind]}（${mo.x}, ${mo.y}）${w.eco.mouthOpen(i) ? '開いている' : '閉じたまま'}`).join('、')}`, '');
L.push('', `正面の入口から来た割合：${((ent / Math.max(1, births.length)) * 100).toFixed(1)}％（ウィスプを除くと ${((ent / Math.max(1, births.filter((b) => b.k !== 0).length)) * 100).toFixed(1)}％）`, '');
L.push(`外へ出ていった：${exits.length}件（${[...new Set(exits.map((e) => e.reason))].map((r) => `${r === 'returned' ? '生還した冒険者' : r === 'home' ? '満ちて巣へ帰った' : '飢えて去った'} ${exits.filter((e) => e.reason === r).length}`).join('、')}）`, '');

// ---- 死に場所の偏り ----
const CELL = 8;
const cw = Math.ceil(m.w / CELL);
const cellCount = new Map<number, number>();
// ウィスプは苔から生まれてすぐ消えるはかない光なので、死に場所の偏りからは除く
const deathsNW = deaths.filter((d) => d.k !== 0);
for (const d of deathsNW) {
  const c = Math.floor(d.y / 16 / CELL) * cw + Math.floor(d.x / 16 / CELL);
  cellCount.set(c, (cellCount.get(c) ?? 0) + 1);
}
const nearEntrance = deaths.filter((d) => Math.abs(d.x / 16 - m.entrance.x) + d.y / 16 < 16).length;
L.push('## 死に場所の偏り（ウィスプを除く）', '', `入口から16マス以内で死んだ割合：${((nearEntrance / Math.max(1, deaths.length)) * 100).toFixed(1)}％（入口のまわりはマップの約${((16 * 16 * 2) / (m.w * m.h) * 100).toFixed(1)}％）`, '', '| 区画（x, y マス） | 死んだ数 | 割合 | 多い種と死因 |', '|---|---:|---:|---|');
for (const [c, n] of [...cellCount].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  const cx = (c % cw) * CELL;
  const cy = Math.floor(c / cw) * CELL;
  const here = deathsNW.filter((d) => Math.floor(d.y / 16 / CELL) * cw + Math.floor(d.x / 16 / CELL) === c);
  const top = new Map<string, number>();
  for (const d of here) top.set(`${name(d.k)}（${CAUSE_NAMES[d.cause] ?? d.cause}）`, (top.get(`${name(d.k)}（${CAUSE_NAMES[d.cause] ?? d.cause}）`) ?? 0) + 1);
  L.push(`| ${cx}, ${cy}${Math.abs(cx + 4 - m.entrance.x) + cy < 16 ? '（入口）' : ''} | ${n} | ${((n / deathsNW.length) * 100).toFixed(1)}％ | ${[...top].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, v]) => `${s} ${v}`).join('、')} |`);
  if (n / deathsNW.length > 0.15) anomalies.push(`死が一つの区画（${cx}, ${cy}）に集中している（全体の${((n / deaths.length) * 100).toFixed(0)}％）`);
}
L.push('');

// ---- 足踏み ----
// 起きて歩く姿のまま2分以上ほぼ同じ場所にいた（sim.ts の stuck.jsonl）。道が見つからないまま歩いていたもの（壁に押しつけている）は兆候に挙げる
{
  const by = new Map<number, { n: number; nopath: number }>();
  for (const r of stuck) {
    const b = by.get(r.k) ?? { n: 0, nopath: 0 };
    b.n++;
    if (r.nopath >= 0.5) b.nopath++;
    by.set(r.k, b);
  }
  L.push(`## 足踏み（起きて歩く姿のまま、2分以上ほぼ同じ場所にいた。全${stuck.length}回）`, '');
  if (!stuck.length) L.push('- なし');
  for (const [k, b] of [...by].sort((a, c) => c[1].n - a[1].n)) L.push(`- ${name(k)}：${b.n}回（うち道が見つからないまま ${b.nopath}回）`);
  L.push('');
  for (const [k, b] of by) if (b.nopath >= 3) anomalies.push(`${name(k)}が、道が見つからないまま壁際で足踏みした（${b.nopath}回）`);
}

// ---- 埋まった生き物 ----
// 壁や瓦礫のマスの中に埋まっていて、安全策で床へ出た（settle.jsonl の unbury）。瓦礫を置く処理が生き物のいるマスを避けていれば、ほとんど起きないはず
{
  const U = rd('settle.jsonl').filter((x) => x.ev === 'unbury');
  if (U.length) {
    const by = new Map<number, number>();
    for (const u of U) by.set(u.k, (by.get(u.k) ?? 0) + 1);
    L.push(`## 壁や瓦礫に埋まっていて床へ出た（全${U.length}回）`, '', ...[...by].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${name(k)}：${n}回`), '');
    if (U.length >= 5) anomalies.push(`壁や瓦礫に埋まった生き物が${U.length}回、安全策で床へ出た（埋まる道筋が残っている）`);
  }
}

// ---- 保存則 ----
const last = samples[samples.length - 1];
const drifts = samples.filter((s) => s.nutrientDrift !== 0 || s.goldDrift !== 0 || s.rockDrift !== 0 || (s.manaDrift ?? 0) !== 0);
if (drifts.length) anomalies.push(`保存則がずれた（最初は${drifts[0].day}日目：養分${drifts[0].nutrientDrift}、金貨${drifts[0].goldDrift}、岩${drifts[0].rockDrift}）`);
L.push('## 保存則と環境', '', `- 養分：総量 ${last.total}、生き物が使える量 ${last.available}（はじめ ${samples[0].available}）、ずれ ${last.nutrientDrift}`, `- 金貨：${last.gold}、ずれ ${last.goldDrift}`, `- マナ：土 ${last.mana ?? '-'}、生き物 ${last.manaHeld ?? '-'}、ずれ ${last.manaDrift ?? '-'}`, `- 岩：ずれ ${last.rockDrift}、瓦礫 ${last.rubble}マス、開いた床 ${last.open}マス（はじめ ${samples[0].open}）`, `- 死骸：${last.corpses}`, `- 噂：${last.rumors}、外の世界の地図：${last.lore}区画`, '');

// ---- 出来事（ゲーム内ログ） ----
L.push(`## 出来事（ゲーム内ログ。全${events.length}件、種類ごとの数）`, '');
const evc = new Map<string, number>();
for (const e of events) {
  const key = String(e.m).replace(/\{k:(\d+)\}/g, (_: string, n: string) => name(+n)).replace(/（.*?）/g, '').replace(/\d+/g, 'N');
  evc.set(key, (evc.get(key) ?? 0) + 1);
}
for (const [k, n] of [...evc].sort((a, b) => b[1] - a[1]).slice(0, 30)) L.push(`- ${k}：${n}`);
L.push('');

L.push('## おかしな兆候', '');
if (!anomalies.length) L.push('- 見つからなかった');
for (const a of anomalies) L.push(`- ${a}`);
L.push('', '## 画像', '', '- deaths.png：死んだ場所の濃さ（赤）', '- mana.png：マナの濃さ（紫）', '- births.png：生き物が現れた場所（橙：入口と地表の横穴、紫：地底の裂け目、青：川の口、黄：天井の裂け目、緑：中で生まれた）', '');
writeFileSync(join(run, 'report.md'), L.join('\n'));

// ---- 画像 ----
const S = 3;
function baseMap(): Uint8Array {
  const img = new Uint8Array(m.w * S * m.h * S * 4);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const k = y * m.w + x;
      let c = [12, 10, 16];
      if (m.rubble[k]) c = [80, 68, 56];
      else if (!m.solid[k]) c = m.lava[k] ? [170, 60, 20] : w.water[k] > 40 ? [40, 70, 110] : m.sealed[k] ? [24, 42, 46] : [70, 68, 80];
      for (let yy = 0; yy < S; yy++)
        for (let xx = 0; xx < S; xx++) {
          const p = ((y * S + yy) * m.w * S + x * S + xx) * 4;
          img[p] = c[0];
          img[p + 1] = c[1];
          img[p + 2] = c[2];
          img[p + 3] = 255;
        }
    }
  return img;
}
function dot(img: Uint8Array, x: number, y: number, col: number[], a: number) {
  const px = Math.floor((x / 16) * S);
  const py = Math.floor((y / 16) * S);
  for (let yy = -1; yy <= 1; yy++)
    for (let xx = -1; xx <= 1; xx++) {
      const X = px + xx;
      const Y = py + yy;
      if (X < 0 || Y < 0 || X >= m.w * S || Y >= m.h * S) continue;
      const p = (Y * m.w * S + X) * 4;
      for (let i = 0; i < 3; i++) img[p + i] = Math.min(255, img[p + i] * (1 - a) + col[i] * a);
    }
}
const di = baseMap();
for (const d of deaths) dot(di, d.x, d.y, [255, 40, 40], 0.35);
writeFileSync(join(run, 'deaths.png'), encodePng(m.w * S, m.h * S, di));
// マナの濃さのマップ（紫）
const mi = baseMap();
for (let k = 0; k < w.mana.length; k++) {
  const v = Math.min(1, w.mana[k] / 60);
  if (v <= 0.02) continue;
  dot(mi, (k % m.w) * 16 + 8, Math.floor(k / m.w) * 16 + 8, [190, 90, 255], v * 0.8);
}
writeFileSync(join(run, 'mana.png'), encodePng(m.w * S, m.h * S, mi));
const bi = baseMap();
for (const b of births) if (b.k !== 0) dot(bi, b.x, b.y, b.origin === 'entrance' || b.origin === 'mouth' ? [255, 140, 40] : b.origin === 'shaft' ? [255, 230, 80] : b.origin === 'fissure' ? [190, 110, 255] : b.origin === 'river' ? [90, 170, 255] : [80, 220, 120], 0.35);
writeFileSync(join(run, 'births.png'), encodePng(m.w * S, m.h * S, bi));
console.log(`レポートを書きました：${join(run, 'report.md')}（${days.toFixed(2)}日、死んだ ${deaths.length}、現れた ${births.length}、兆候 ${anomalies.length}）`);
