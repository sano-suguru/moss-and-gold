// シーンのスクリーンショットを撮って一覧画像を作る（Node の Playwright。Python は要らない）。比較のときは、現在の画像と以前の画像を左右に並べる。
//
//   node tools/gallery/shoot.mjs                    スクリーンショットを撮って build/gallery/sheet.png を作る
//   node tools/gallery/shoot.mjs --only dragon,camp 一部のシーンだけ撮り直す
//   node tools/gallery/shoot.mjs --label before     撮った画像を build/gallery/before/ に残す
//   node tools/gallery/shoot.mjs --compare before   現在の画像と before を左右に並べた build/gallery/compare-before.png を作る
//   node tools/gallery/shoot.mjs --light            確認用の明かり（#lit：全体を明るく照らす）をつけて撮る（暗さと絵の出来を分けて見る）
//   node tools/gallery/shoot.mjs --no-shoot         撮らずに一覧画像だけ作り直す
//   node tools/gallery/shoot.mjs --fresh            シーンを必ず作り直す（通常はシミュレーションのコードが同じなら前回のシーンを使う）
//   シーンの作成（build/scenes.js）は、ここから呼ぶ（npm run gallery -- の後ろのオプションがここに届くように）
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = resolve('.');
const G = join(ROOT, 'build', 'gallery');
const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
if (!args.includes('--no-shoot') && existsSync(join(ROOT, 'build', 'scenes.js'))) execFileSync('node', [join(ROOT, 'build', 'scenes.js'), ...(args.includes('--fresh') ? ['--fresh'] : [])], { stdio: 'inherit' });
let scenes = JSON.parse(readFileSync(join(G, 'scenes.json'), 'utf8'));
if (opt('--only')) {
  const keep = opt('--only').split(',');
  scenes = scenes.filter((s) => keep.includes(s.name));
}
const light = args.includes('--light');

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

if (!args.includes('--no-shoot')) {
  // 2つのページで並列に撮る。ページはシーンごとにリロードせず、window.__openScene でシーンだけを入れ替える
  // （テクスチャアトラスと WebGL を作り直さないので、1枚あたり約1.5秒）。スマホのシーンはビューポートの大きさが違うので別のページで撮る。
  const hash = (phone) => [phone ? '' : 'clean', light ? 'lit' : ''].filter(Boolean).join(',');
  const url = (phone) => 'file://' + join(ROOT, 'dist', 'index.html') + (hash(phone) ? '#' + hash(phone) : '');
  // 20フレーム描き終わるまで待ち、描画を止める（止めるとスクリーンショットが速い）
  const waitFrames = async (page) => {
    await page.waitForFunction(() => (window.__frames ?? 0) >= 20, null, { timeout: 15000 });
    await page.evaluate(() => { window.__hold = true; });
  };
  const lane = async (list) => {
    let page = null;
    let ctx = null;
    const errs = [];
    for (const s of list) {
      const data = readFileSync(join(ROOT, s.file), 'utf8');
      const phone = s.device === 'phone';
      if (phone || !page) {
        ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1000, height: 640 }, deviceScaleFactor: phone ? 2 : 1 });
        await ctx.addInitScript((d) => { if (!sessionStorage.getItem('opened')) { localStorage.setItem('dungeon-aquarium-v2', d); sessionStorage.setItem('opened', '1'); } }, data);
        const p = await ctx.newPage();
        p.on('pageerror', (e) => errs.push(String(e)));
        await p.goto(url(phone));
        await waitFrames(p);
        if (phone) {
          await p.screenshot({ path: join(G, s.name + '.png') });
          console.log(s.name, errs.length ? errs.splice(0) : 'ok');
          await ctx.close();
          continue;
        }
        page = p;
      } else {
        await page.evaluate((d) => window.__openScene(d), data);
        await waitFrames(page);
      }
      await page.screenshot({ path: join(G, s.name + '.png') });
      console.log(s.name, errs.length ? errs.splice(0) : 'ok');
    }
    if (page) await page.context().close();
  };
  const jobs = Math.max(1, +(process.env.SHOOT_JOBS || 2));
  await Promise.all(Array.from({ length: jobs }, (_, j) => lane(scenes.filter((_, i) => i % jobs === j))));
}

if (opt('--label')) {
  const d = join(G, opt('--label'));
  mkdirSync(d, { recursive: true });
  for (const s of scenes) if (existsSync(join(G, s.name + '.png'))) copyFileSync(join(G, s.name + '.png'), join(d, s.name + '.png'));
}

/** 一覧画像（dirs が1つなら2列の一覧、2つなら左右に並べた比較）を、ブラウザの canvas で合成する */
async function sheet(dirs, out) {
  const rows = scenes.map((s) => ({
    title: s.title + (dirs.length === 2 ? '　（左：以前　右：現在）' : ''),
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
  console.log('一覧画像：', out);
  await page.close();
}

if (opt('--compare')) await sheet([join(G, opt('--compare')), G], join(G, `compare-${opt('--compare')}.png`));
else await sheet([G], join(G, 'sheet.png'));
await browser.close();
