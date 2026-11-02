// 場面を撮って一覧画像を作る（Node の Playwright。Python は要らない）。比較のときは、いまの画像と以前の画像を左右に並べる。
//
//   node tools/gallery/shoot.mjs                    撮って build/gallery/sheet.png
//   node tools/gallery/shoot.mjs --only dragon,camp 場面を選んで撮り直す
//   node tools/gallery/shoot.mjs --label before     撮った画像を build/gallery/before/ に残す
//   node tools/gallery/shoot.mjs --compare before   いまの画像と before を左右に並べた build/gallery/compare-before.png
//   node tools/gallery/shoot.mjs --light            確認用の明かり（#lit：全体を明るく照らす）をつけて撮る（暗さと絵の出来を分けて見る）
//   node tools/gallery/shoot.mjs --no-shoot         撮らずに一覧だけ作り直す
import { createRequire } from 'module';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = resolve('.');
const G = join(ROOT, 'build', 'gallery');
const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
let scenes = JSON.parse(readFileSync(join(G, 'scenes.json'), 'utf8'));
if (opt('--only')) {
  const keep = opt('--only').split(',');
  scenes = scenes.filter((s) => keep.includes(s.name));
}
const light = args.includes('--light');

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

if (!args.includes('--no-shoot')) {
  for (const s of scenes) {
    const phone = s.device === 'phone';
    const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1000, height: 640 }, deviceScaleFactor: phone ? 2 : 1 });
    const data = readFileSync(join(ROOT, s.file), 'utf8');
    await ctx.addInitScript((d) => localStorage.setItem('dungeon-aquarium-v2', d), data);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    const hash = [phone ? '' : 'clean', light ? 'lit' : ''].filter(Boolean).join(',');
    await page.goto('file://' + join(ROOT, 'dist', 'index.html') + (hash ? '#' + hash : ''));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(G, s.name + '.png') });
    console.log(s.name, errs.length ? errs : 'ok');
    await ctx.close();
  }
}

if (opt('--label')) {
  const d = join(G, opt('--label'));
  mkdirSync(d, { recursive: true });
  for (const s of scenes) if (existsSync(join(G, s.name + '.png'))) copyFileSync(join(G, s.name + '.png'), join(d, s.name + '.png'));
}

/** 一覧（dirs が1つなら2列の一覧、2つなら左右の比較）を、ブラウザの canvas で組む */
async function sheet(dirs, out) {
  const rows = scenes.map((s) => ({
    title: s.title + (dirs.length === 2 ? '　（左：以前　右：いま）' : ''),
    imgs: dirs.map((d) => {
      const f = join(d, s.name + '.png');
      return existsSync(f) ? 'data:image/png;base64,' + readFileSync(f).toString('base64') : null;
    }),
  }));
  const page = await browser.newPage();
  const png = await page.evaluate(
    async ({ rows, cols }) => {
      const tw = 480;
      const load = (src) => new Promise((r) => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.src = src; });
      const built = [];
      for (const row of rows) {
        const ims = await Promise.all(row.imgs.map(load));
        const hs = ims.map((i) => (i ? Math.round((i.height * tw) / i.width) : 300));
        const h = Math.max(...hs);
        const c = document.createElement('canvas');
        c.width = tw * ims.length + 10 * (ims.length - 1);
        c.height = h + 34;
        const g = c.getContext('2d');
        g.fillStyle = 'rgb(16,15,20)';
        g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = 'rgb(230,224,210)';
        g.font = '18px sans-serif';
        g.fillText(row.title, 6, 22);
        ims.forEach((im, i) => {
          if (im) g.drawImage(im, i * (tw + 10), 34, tw, hs[i]);
          else { g.fillStyle = 'rgb(40,40,40)'; g.fillRect(i * (tw + 10), 34, tw, 300); }
        });
        built.push(c);
      }
      const W = Math.max(...built.map((r) => r.width)) * cols + 10 * (cols - 1);
      const lines = [];
      for (let i = 0; i < built.length; i += cols) lines.push(built.slice(i, i + cols));
      const H = lines.reduce((a, l) => a + Math.max(...l.map((r) => r.height)) + 10, 0);
      const S = document.createElement('canvas');
      S.width = W;
      S.height = H;
      const g = S.getContext('2d');
      g.fillStyle = 'rgb(8,8,10)';
      g.fillRect(0, 0, W, H);
      let y = 0;
      for (const l of lines) {
        l.forEach((r, j) => g.drawImage(r, j * (built[0].width + 10), y));
        y += Math.max(...l.map((r) => r.height)) + 10;
      }
      return S.toDataURL('image/png').split(',')[1];
    },
    { rows, cols: dirs.length === 2 ? 1 : 2 },
  );
  writeFileSync(out, Buffer.from(png, 'base64'));
  console.log('一覧：', out);
  await page.close();
}

if (opt('--compare')) await sheet([join(G, opt('--compare')), G], join(G, `compare-${opt('--compare')}.png`));
else await sheet([G], join(G, 'sheet.png'));
await browser.close();
