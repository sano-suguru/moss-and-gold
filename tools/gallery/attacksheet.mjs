/**
 * 冒険者の攻撃のコマ（構え・振り上げ・振り下ろし・戻り）を、正面・横・後ろについて、全位で並べた画像を作る（攻撃の動きの見直し用）。
 *   node tools/gallery/attacksheet.mjs --job warrior [--scale 8] [--game 2] [--src build/sprites-main.ts --tag main]
 * 1行が1つの位：立ち姿（向きごとに1コマ）のあとに、攻撃の4コマを正面・横・後ろの順に並べる。
 * --src で別の版の sprites.ts から作り、--tag をファイル名の末尾に付ける（変更の前後を並べるため）
 * できるもの（build/img/）：attack-<職>-x<scale>.png と attack-<職>-x<game>.png（ゲームの倍率）
 */
import { buildSync } from 'esbuild';
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const jobs = opt('job', 'warrior').split(',');
const S = +opt('scale', '8');
const G = +opt('game', '2');
const src = opt('src', 'src/sprites.ts');
const tag = opt('tag', '') ? '-' + opt('tag', '') : '';
mkdirSync('build/img', { recursive: true });
buildSync({ entryPoints: [src], bundle: true, format: 'cjs', outfile: 'build/sprites-attack' + tag + '.cjs', platform: 'node', logLevel: 'silent' });
const SP = require(process.cwd() + '/build/sprites-attack' + tag + '.cjs');
const look = (hair, skin, color, build, head, crest = -1, scar = 0) => hair | (skin << 3) | (color << 5) | (build << 8) | (head << 10) | ((crest + 1) << 11) | (scar << 15);
const lk = look(1, 1, 0, 1, 0, -1);
const DIRS = ['down', 'side', 'up'];
const RANKS = ['見習い', '熟練', '歴戦', '英雄'];
const fr = (j, d, a, f, r) => SP.heroSprite(j, d, a, f, false, lk, r);
const rowOf = (j, r) => DIRS.flatMap((d) => [{ t: '立' + d[0], f: fr(j, d, 'idle', 0, r) }, ...[0, 1, 2, 3].map((q) => ({ t: '攻' + d[0] + q, f: fr(j, d, 'attack', q, r) }))]);
function bbox(frames) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const f of frames) for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) if (f.px[(y * f.W + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0 - 1, y0 - 1, x1 + 2, y1 + 2];
}
const toData = (f) => ({ W: f.W, H: f.H, px: Array.from(f.px) });
const { chromium } = require('playwright');
const browser = await chromium.launch();
async function shoot(name, blocks, scale) {
  const all = blocks.flatMap((b) => b.rows.flat().map((c) => c.f));
  const [x0, y0, x1, y1] = bbox(all);
  const data = blocks.map((b) => ({ title: b.title, rows: b.rows.map((r) => r.map((c) => ({ t: c.t, d: toData(c.f) }))) }));
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#1d1f24;color:#ccc;font:13px sans-serif;padding:10px}h3{margin:8px 0 2px;color:#e8d8a0;font-size:14px}.r{display:flex;gap:4px;margin-bottom:4px}.c{text-align:center;font-size:10px;color:#888}.gap{width:${scale * 3}px}canvas{image-rendering:pixelated;background:#34383f;display:block}</style>
<div id=root></div><script>const D=${JSON.stringify(data)},S=${scale},B=${JSON.stringify([x0, y0, x1, y1])};
const root=document.getElementById('root');
for(const b of D){const h=document.createElement('h3');h.textContent=b.title;root.appendChild(h);
 for(const row of b.rows){const r=document.createElement('div');r.className='r';root.appendChild(r);
  row.forEach((c,i)=>{if(i&&i%5===0){const g=document.createElement('div');g.className='gap';r.appendChild(g)}
   const w=document.createElement('div');w.className='c';const cv=document.createElement('canvas');cv.width=(B[2]-B[0])*S;cv.height=(B[3]-B[1])*S;w.appendChild(cv);if(S>=4){const s=document.createElement('div');s.textContent=c.t;w.appendChild(s)}r.appendChild(w);
   const x=cv.getContext('2d'),f=c.d;for(let y=B[1];y<B[3];y++)for(let X=B[0];X<B[2];X++){if(X<0||y<0||X>=f.W||y>=f.H)continue;const p=y*f.W+X;if(!f.px[p*4+3])continue;x.fillStyle='rgb('+f.px[p*4]+','+f.px[p*4+1]+','+f.px[p*4+2]+')';x.fillRect((X-B[0])*S,(y-B[1])*S,S,S)}})}}</script>`;
  writeFileSync('build/' + name + '.html', html);
  const pg = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await pg.goto('file://' + process.cwd() + '/build/' + name + '.html');
  await pg.screenshot({ path: 'build/img/' + name + '.png', fullPage: true });
  await pg.close();
  console.log('build/img/' + name + '.png');
}
for (const job of jobs) {
  const blocks = (rs) => [{ title: `${job}（立ち／攻撃 構え・振り上げ・振り下ろし・戻り ×正面・横・後ろ）`, rows: rs.map((r) => rowOf(job, r)) }];
  await shoot(`attack-${job}-x${S}${tag}`, blocks(S >= 6 ? [1, 3] : [0, 1, 2, 3]), S);
  await shoot(`attack-${job}-x${G}${tag}`, blocks([0, 1, 2, 3]), G);
}
await browser.close();
