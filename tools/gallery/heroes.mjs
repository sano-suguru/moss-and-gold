/**
 * 名簿の冒険者の、位ごとの姿の一覧画像（見習い・熟練・歴戦・英雄を、職業ごとに並べる）を作る → build/img/hero-ranks.png
 *   node tools/gallery/heroes.mjs [--out build/img/hero-ranks.png] [--scale 4]
 * 色はスプライトそのもの（ゲームのライティングは当てない）。姿は職業ごとに固定の二人分（外見のビット `look`）を、正面・横・後ろで並べる。墓標も添える。
 */
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const out = opt('out', 'build/img/hero-ranks.png');
const S = +opt('scale', '4');
mkdirSync('build/img', { recursive: true });
buildSync({ entryPoints: ['src/sprites.ts'], bundle: true, format: 'cjs', outfile: 'build/sprites-heroes.cjs', platform: 'node', logLevel: 'silent' });
const SP = require(process.cwd() + '/build/sprites-heroes.cjs');
// 職の名前は src/sprites.ts の HERO_JOBS（職の番号の順）から読み、ここには表に出す日本語の名前だけを同じ順で持つ
const JOB_JA = ['戦士', '魔法使い', '盗賊', '僧侶', '吟遊詩人', '狩人', '竜殺し'];
if (SP.HERO_JOBS.length !== JOB_JA.length) throw new Error(`職の数（${SP.HERO_JOBS.length}）と日本語の名前の数（${JOB_JA.length}）が合わない`);
const JOBS = SP.HERO_JOBS.map((j, i) => [j, JOB_JA[i]]);
const RANKS = ['見習い', '熟練', '歴戦', '英雄'];
const look = (hair, skin, color, build, head, crest = -1, scar = 0) => hair | (skin << 3) | (color << 5) | (build << 8) | (head << 10) | ((crest + 1) << 11) | (scar << 15);
const LOOKS = [look(1, 1, 0, 1, 0, 0), look(3, 2, 1, 2, 1, 7)];
const toData = (fr) => ({ W: fr.W, H: fr.H, px: Array.from(fr.px), glow: fr.mat.map((m) => (m === 'wisp' ? 1 : 0)) });
const rows = JOBS.map(([j, jn]) => ({ jn, cells: RANKS.map((rn, r) => ({ rn, figs: LOOKS.flatMap((lk) => [['down', 0], ['side', 0], ['up', 0]].map(([d]) => toData(SP.heroSprite(j, d, 'idle', 0, false, lk, r)))) })) }));
const graves = [1, 2, 3].map((r) => toData(SP.graveMarker(r, 2)));
// 頭の飾り12種（名簿の12人で重ならない）：職業を替えながら、正面・横
const crests = SP.CREST_NAMES.map((n, i) => ({ n, figs: [['down', 1], ['side', 1], ['down', 0], ['down', 3]].map(([d, r]) => toData(SP.heroSprite(SP.HERO_JOBS[i % SP.HERO_JOBS.length], d, 'idle', 0, false, look(i % 6, i % 4, i % 6, 1, 0, i), r))) }));
// 傷の姿：眼帯・包帯・両方
const scars = [1, 2, 3].map((sc) => [['down', 1], ['side', 2], ['up', 1]].map(([d, r]) => toData(SP.heroSprite('warrior', d, 'idle', 0, false, look(2, 1, 0, 1, 1, 4, sc), r))));
const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#22252b;color:#ddd;font:14px sans-serif;padding:12px}table{border-collapse:collapse}td,th{padding:4px 10px;border-bottom:1px solid #333;vertical-align:bottom}th{color:#e8d8a0}canvas{image-rendering:pixelated;margin-right:2px;background:#3a3f47}.g{margin-top:10px}</style>
<table><tr><th></th>${RANKS.map((r) => `<th>${r}</th>`).join('')}</tr>${rows.map((row, i) => `<tr><th>${row.jn}</th>${row.cells.map((c, k) => `<td>${c.figs.map((_, n) => `<canvas id="c${i}_${k}_${n}"></canvas>`).join('')}</td>`).join('')}</tr>`).join('')}</table>
<div class=g>墓標（熟練・歴戦・英雄）：${graves.map((_, i) => `<canvas id="g${i}"></canvas>`).join('')}</div>
<div class=g>頭の飾り（熟練の正面・横、見習い、英雄）：<table><tr>${crests.map((c, i) => `<td>${c.n}<br>${c.figs.map((_, n) => `<canvas id="k${i}_${n}"></canvas>`).join('')}</td>${i % 6 === 5 ? '</tr><tr>' : ''}`).join('')}</tr></table></div>
<div class=g>傷の姿（眼帯・頭の包帯・両方）：${scars.map((f, i) => f.map((_, n) => `<canvas id="s${i}_${n}"></canvas>`).join('')).join(' &nbsp; ')}</div>
<script>const D=${JSON.stringify({ rows, graves, crests, scars })};const S=${S};
function draw(id,fr){const c=document.getElementById(id);c.width=fr.W*S;c.height=fr.H*S;const x=c.getContext('2d');for(let y=0;y<fr.H;y++)for(let X=0;X<fr.W;X++){const p=y*fr.W+X;if(!fr.px[p*4+3])continue;x.fillStyle='rgb('+fr.px[p*4]+','+fr.px[p*4+1]+','+fr.px[p*4+2]+')';x.fillRect(X*S,y*S,S,S)}}
D.rows.forEach((r,i)=>r.cells.forEach((c,k)=>c.figs.forEach((f,n)=>draw('c'+i+'_'+k+'_'+n,f))));D.graves.forEach((g,i)=>draw('g'+i,g));D.crests.forEach((c,i)=>c.figs.forEach((f,n)=>draw('k'+i+'_'+n,f)));D.scars.forEach((s,i)=>s.forEach((f,n)=>draw('s'+i+'_'+n,f)));</script>`;
writeFileSync('build/hero-ranks.html', html);
const { chromium } = require('playwright');
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1800, height: 900 } });
await pg.goto('file://' + process.cwd() + '/build/hero-ranks.html');
await pg.screenshot({ path: out, fullPage: true });
await b.close();
console.log('スクリーンショットを撮った：' + out);
