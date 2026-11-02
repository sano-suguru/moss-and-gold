// koboldshots.ts が書き出した場面を、ゲーム画面（dist/index.html）で撮る。docs/ に PNG を置く
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
const root = resolve('.');
const scenes = JSON.parse(readFileSync('build/gallery/kobold/scenes.json', 'utf8'));
mkdirSync('docs/img', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const s of scenes) {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 640 } });
  const data = readFileSync(s.file, 'utf8');
  await ctx.addInitScript((d) => localStorage.setItem('dungeon-aquarium-v2', d), data);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('file://' + root + '/dist/index.html#clean');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `docs/img/kobold-${s.name}.png` });
  // 印をつけた写し：世界の座標を画面へ（画面の中央がカメラ、拡大率倍）
  await page.evaluate(({ marks, cam }) => {
    for (const mk of marks) {
      const sx = (mk.x - cam.x) * cam.zoom + innerWidth / 2;
      const sy = (mk.y - cam.y) * cam.zoom + innerHeight / 2;
      const d = document.createElement('div');
      d.style.cssText = `position:fixed;left:${sx - 8 * cam.zoom}px;top:${sy - 8 * cam.zoom}px;width:${16 * cam.zoom}px;height:${16 * cam.zoom}px;border:2px solid ${mk.color};box-sizing:border-box;z-index:99;pointer-events:none;color:${mk.color};font:11px sans-serif;text-shadow:0 0 2px #000`;
      d.textContent = mk.label;
      document.body.appendChild(d);
    }
  }, { marks: s.marks, cam: s.cam });
  await page.screenshot({ path: `docs/img/kobold-${s.name}-marked.png` });
  console.log(s.name, errs.length ? errs : 'ok');
  await ctx.close();
}
await b.close();
