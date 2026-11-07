/**
 * 名簿の冒険者の1職ぶんの全コマ（正面・横・後ろ × 位 × 立ち・歩き・攻撃、倒れた姿）を並べた画像を作る（絵の見直し用）。
 *   node tools/gallery/herosheet.mjs --job wizard [--cmp warrior] [--scale 8] [--game 2] [--look 0] [--src build/sprites-main.ts --tag main]
 * --src で別の版の sprites.ts（例：git show main:src/sprites.ts > build/sprites-main.ts）から作り、--tag をファイル名の末尾に付ける（変更の前後を並べるため）
 * できるもの（build/img/）：
 *   sheet-<職>-r<位>.png  … その位の全コマを scale 倍で（1行目：立ち3向きと倒れた姿4コマ、2行目：歩き、3行目：攻撃。歩きと攻撃は正面・横・後ろの4コマずつ）
 *   sheet-<職>-idle.png   … 全位の立ち姿と倒れた姿を scale 倍で
 *   sheet-<職>-game.png   … 全位の全コマを、ゲームの倍率（game 倍）で。--cmp の職（既定は戦士）の立ち姿を位ごとに並べて添える
 * 色はスプライトそのもの（ゲームのライティングは当てない）。背景は洞窟の床に近い暗い灰色。
 */
import { buildSync } from 'esbuild';
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const job = opt('job', 'wizard');
const cmp = opt('cmp', 'warrior');
const S = +opt('scale', '8');
const G = +opt('game', '2');
const lookIx = +opt('look', '0');
const src = opt('src', 'src/sprites.ts');
const tag = opt('tag', '') ? '-' + opt('tag', '') : '';
mkdirSync('build/img', { recursive: true });
buildSync({ entryPoints: [src], bundle: true, format: 'cjs', outfile: 'build/sprites-sheet' + tag + '.cjs', platform: 'node', logLevel: 'silent' });
const SP = require(process.cwd() + '/build/sprites-sheet' + tag + '.cjs');
const look = (hair, skin, color, build, head, crest = -1, scar = 0) => hair | (skin << 3) | (color << 5) | (build << 8) | (head << 10) | ((crest + 1) << 11) | (scar << 15);
const LOOKS = [look(1, 1, 0, 1, 0, -1), look(3, 2, 1, 2, 1, -1), look(4, 0, 3, 0, 0, -1)];
const lk = LOOKS[lookIx] ?? LOOKS[0];
const DIRS = ['down', 'side', 'up'];
const RANKS = ['見習い', '熟練', '歴戦', '英雄'];
const fr = (j, d, a, f, r, l = lk) => SP.heroSprite(j, d, a, f, false, l, r);
/** 位 r の3行：立ち＋倒れた姿、歩き、攻撃 */
const rowsOf = (j, r) => [
  [...DIRS.map((d) => ({ t: d, f: fr(j, d, 'idle', 0, r) })), ...[0, 1, 2, 3].map((q) => ({ t: '倒' + q, f: fr(j, 'side', 'death', q, r) }))],
  DIRS.flatMap((d) => [0, 1, 2, 3].map((q) => ({ t: '歩' + d[0] + q, f: fr(j, d, 'move', q, r) }))),
  DIRS.flatMap((d) => [0, 1, 2, 3].map((q) => ({ t: '攻' + d[0] + q, f: fr(j, d, 'attack', q, r) }))),
];
/** 全コマで塗られている範囲を合わせて切り出す（コマの位置がそろう） */
function bbox(frames) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const f of frames) for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) if (f.px[(y * f.W + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0 - 1, y0 - 1, x1 + 2, y1 + 2];
}
const toData = (f) => ({ W: f.W, H: f.H, px: Array.from(f.px) });
async function shoot(name0, blocks, scale) {
  const name = name0 + tag;
  // blocks: [{title, rows:[[{t,f}]]}]
  const all = blocks.flatMap((b) => b.rows.flat().map((c) => c.f));
  const [x0, y0, x1, y1] = bbox(all);
  const data = blocks.map((b) => ({ title: b.title, rows: b.rows.map((r) => r.map((c) => ({ t: c.t, d: toData(c.f) }))) }));
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#1d1f24;color:#ccc;font:13px sans-serif;padding:10px}h3{margin:8px 0 2px;color:#e8d8a0;font-size:14px}.r{display:flex;gap:4px;margin-bottom:4px}.c{text-align:center;font-size:10px;color:#888}canvas{image-rendering:pixelated;background:#34383f;display:block}</style>
<div id=root></div><script>const D=${JSON.stringify(data)},S=${scale},B=${JSON.stringify([x0, y0, x1, y1])};
const root=document.getElementById('root');
for(const b of D){const h=document.createElement('h3');h.textContent=b.title;root.appendChild(h);
 for(const row of b.rows){const r=document.createElement('div');r.className='r';root.appendChild(r);
  for(const c of row){const w=document.createElement('div');w.className='c';const cv=document.createElement('canvas');cv.width=(B[2]-B[0])*S;cv.height=(B[3]-B[1])*S;w.appendChild(cv);if(S>=4){const s=document.createElement('div');s.textContent=c.t;w.appendChild(s)}r.appendChild(w);
   const x=cv.getContext('2d'),f=c.d;for(let y=B[1];y<B[3];y++)for(let X=B[0];X<B[2];X++){if(X<0||y<0||X>=f.W||y>=f.H)continue;const p=y*f.W+X;if(!f.px[p*4+3])continue;x.fillStyle='rgb('+f.px[p*4]+','+f.px[p*4+1]+','+f.px[p*4+2]+')';x.fillRect((X-B[0])*S,(y-B[1])*S,S,S)}}}}</script>`;
  writeFileSync('build/' + name + '.html', html);
  const pg = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await pg.goto('file://' + process.cwd() + '/build/' + name + '.html');
  await pg.screenshot({ path: 'build/img/' + name + '.png', fullPage: true });
  await pg.close();
  console.log('build/img/' + name + '.png');
}
const { chromium } = require('playwright');
const browser = await chromium.launch();
for (let r = 0; r < 4; r++) await shoot(`sheet-${job}-r${r}`, [{ title: `${job} ${RANKS[r]}（立ち 正面・横・後ろ／倒れた姿0〜3｜歩き｜攻撃）`, rows: rowsOf(job, r) }], S);
await shoot(`sheet-${job}-idle`, [
  { title: `${job} 位0〜3（立ち 正面・横・後ろ／倒れた姿0〜3）`, rows: [0, 1, 2, 3].map((r) => rowsOf(job, r)[0]) },
  { title: '頭の飾り（羽根・とさか・星・輪。位0〜3の正面と横）', rows: [0, 3, 4, 6].map((c) => [0, 1, 2, 3].flatMap((r) => ['down', 'side'].map((d) => ({ t: SP.CREST_NAMES[c], f: fr(job, d, 'idle', 0, r, look(1, 1, 0, 1, 0, c)) })))) },
], S);
// ゲームの倍率：全位の全コマを1行ずつ、と比べる職の立ち姿
const gameBlocks = [0, 1, 2, 3].map((r) => ({ title: RANKS[r], rows: [rowsOf(job, r).flat()] }));
gameBlocks.push({ title: `並べて比べる：${job}（上）と ${cmp}（下）の立ち姿（位0〜3、正面・横・後ろ）`, rows: [job, cmp].map((j) => [0, 1, 2, 3].flatMap((r) => DIRS.map((d) => ({ t: '', f: fr(j, d, 'idle', 0, r) })))) });
gameBlocks.push({ title: '見た目の違う3人（正面、位0〜3）', rows: [job, cmp].map((j) => [0, 1, 2, 3].flatMap((r) => LOOKS.map((l) => ({ t: '', f: fr(j, 'down', 'idle', 0, r, l) })))) });
await shoot(`sheet-${job}-game`, gameBlocks, G);
await shoot(`sheet-${job}-cmp`, [{ title: `${job}（上）と ${cmp}（下）の立ち姿 位0〜3`, rows: [job, cmp].map((j) => [0, 1, 2, 3].flatMap((r) => DIRS.map((d) => ({ t: RANKS[r][0] + d[0], f: fr(j, d, 'idle', 0, r) })))) }], 4);
await browser.close();
