// shot.ts が書き出した場面を、ゲーム画面（dist/index.html）で撮る：そのまま、印つき、真ん中を切り出して3倍
//   node tools/gallery/shot.mjs build/shots/<name>.json
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');

const sc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const root = resolve('.');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1000, height: 640 } });
await ctx.addInitScript((d) => localStorage.setItem('dungeon-aquarium-v2', d), JSON.stringify(sc.save));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('file://' + root + '/dist/index.html#clean' + (sc.lit ? ',lit' : ''));
// 決まった時間ではなく、20回描き終わるまで待つ（ページの読み込みのあと0.3秒ほど）
await page.waitForFunction(() => (window.__frames ?? 0) >= 20, null, { timeout: 15000 });
await page.evaluate(() => { window.__hold = true; });
const base = join(sc.out, sc.name);
await page.screenshot({ path: base + '.png' });
// 真ん中（見たいもののまわり）を切り出して、ドットのまま3倍
const crop = await page.screenshot({ clip: { x: 350, y: 220, width: 300, height: 200 } });
const big = await page.evaluate(async (b64) => {
  const im = new Image();
  await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas');
  c.width = im.width * 3;
  c.height = im.height * 3;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/png').split(',')[1];
}, crop.toString('base64'));
(await import('fs')).writeFileSync(base + '-crop.png', Buffer.from(big, 'base64'));
// 印：世界の座標を画面へ（画面の中央がカメラ、拡大率倍）
await page.evaluate(({ marks, cam }) => {
  for (const mk of marks) {
    const sx = (mk.x - cam.x) * cam.zoom + innerWidth / 2;
    const sy = (mk.y - cam.y) * cam.zoom + innerHeight / 2;
    const h = 8 * cam.zoom * (mk.size ?? 1);
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${sx - h}px;top:${sy - h}px;width:${2 * h}px;height:${2 * h}px;border:2px solid ${mk.color};box-sizing:border-box;z-index:99;pointer-events:none;color:${mk.color};font:11px sans-serif;text-shadow:0 0 2px #000`;
    d.textContent = mk.label;
    document.body.appendChild(d);
  }
}, { marks: sc.marks, cam: sc.cam });
await page.screenshot({ path: base + '-marked.png' });
console.log(`撮った：${base}.png、${base}-marked.png、${base}-crop.png${errs.length ? '（ページのエラー：' + errs.join(' / ') + '）' : ''}`);
await b.close();
