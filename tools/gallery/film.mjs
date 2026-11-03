// tools/analysis/film.ts が書き出したフレームを、ゲーム画面（dist/index.html）でスクリーンショットに撮り、一枚に並べる（各フレームの下に、日と、先頭の生き物の情報パネルの内容）
//   node tools/gallery/film.mjs build/film/<name>.json
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');

const sc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const root = resolve('.');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 960, height: 600 } });
await ctx.addInitScript((d) => localStorage.setItem('dungeon-aquarium-v2', d), JSON.stringify(sc.frames[0].save));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('file://' + root + '/dist/index.html#clean' + (sc.lit ? ',lit' : ''));
await page.waitForFunction(() => (window.__frames ?? 0) >= 20, null, { timeout: 20000 });
const W = 480;
const H = 320;
const shots = [];
for (let i = 0; i < sc.frames.length; i++) {
  if (i > 0) {
    await page.evaluate((j) => window.__openScene(j), JSON.stringify(sc.frames[i].save));
    await page.waitForFunction(() => (window.__frames ?? 0) >= 20, null, { timeout: 20000 });
  }
  await page.evaluate(() => { window.__hold = true; });
  // 印（目標、身構えた住みか）を重ねる：ワールド座標を画面座標へ変換する（画面の中央がカメラの位置）
  await page.evaluate(({ marks, cam }) => {
    for (const mk of marks ?? []) {
      const sx = (mk.x - cam.x) * cam.zoom + innerWidth / 2;
      const sy = (mk.y - cam.y) * cam.zoom + innerHeight / 2;
      const h = 9 * cam.zoom;
      const d = document.createElement('div');
      d.className = '__mk';
      d.style.cssText = `position:fixed;left:${sx - h}px;top:${sy - h}px;width:${2 * h}px;height:${2 * h}px;border:1px dashed ${mk.color};box-sizing:border-box;z-index:99;pointer-events:none;color:${mk.color};font:11px sans-serif;text-shadow:0 0 2px #000,0 0 2px #000;white-space:nowrap`;
      d.textContent = mk.label;
      document.body.appendChild(d);
    }
  }, { marks: sc.frames[i].marks, cam: sc.frames[i].cam });
  const png = await page.screenshot({ clip: { x: 480 - W / 2, y: 300 - H / 2, width: W, height: H } });
  await page.evaluate(() => document.querySelectorAll('.__mk').forEach((d) => d.remove()));
  shots.push(png.toString('base64'));
}
const cols = Math.min(sc.cols || 3, shots.length);
const strip = await page.evaluate(async ({ shots, labels, title, cols, W, H }) => {
  const rows = Math.ceil(shots.length / cols);
  const LH = 34;
  const c = document.createElement('canvas');
  c.width = cols * (W + 6) + 6;
  c.height = 30 + rows * (H + LH + 6);
  const g = c.getContext('2d');
  g.fillStyle = '#15131a';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#eee';
  g.font = '14px sans-serif';
  g.fillText(title, 8, 20);
  for (let i = 0; i < shots.length; i++) {
    const im = new Image();
    await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + shots[i]; });
    const x = 6 + (i % cols) * (W + 6);
    const y = 30 + Math.floor(i / cols) * (H + LH + 6);
    g.drawImage(im, x, y);
    g.fillStyle = '#ffd24a';
    g.font = 'bold 13px sans-serif';
    g.fillText(String(i + 1), x + 6, y + 16);
    g.fillStyle = '#ddd';
    g.font = '11px sans-serif';
    const words = labels[i];
    // 長いラベルは二行に折り返す
    const cut = words.length > 44 ? words.lastIndexOf(' / ', 60) : -1;
    g.fillText(cut > 0 ? words.slice(0, cut) : words, x + 2, y + H + 14);
    if (cut > 0) g.fillText(words.slice(cut + 3), x + 2, y + H + 28);
  }
  return c.toDataURL('image/png').split(',')[1];
}, { shots, labels: sc.frames.map((f) => f.label), title: sc.title, cols, W, H });
const path = join(sc.out, `${sc.name}.png`);
writeFileSync(path, Buffer.from(strip, 'base64'));
console.log(`スクリーンショットを撮った：${path}（${shots.length}フレーム）${errs.length ? '（ページのエラー：' + errs.join(' / ') + '）' : ''}`);
await b.close();
