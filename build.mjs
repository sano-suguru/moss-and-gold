// 使い方:
//   node build.mjs        → dist/index.html（一つのHTMLにまとめた完成版）
//   node build.mjs --dev  → 開発サーバー（npm run dev）。src を書き換えると作り直し、開いているページを自動で読み込み直す。
//                           ファイルは build/dev/ に書く。ポートは環境変数 PORT（既定 8000、使用中なら次の空き）。
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const opts = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
};

if (process.argv.includes('--dev')) {
  // 開発用：JS は別ファイルにし（ソースマップ付き、圧縮しない）、esbuild が書き直しを知らせる /esbuild に繋いで、
  // 作り直しのたびにページを読み込み直す。HTML は起動時に一度だけ作るので、src/index.html を変えたら起動し直す。
  const dir = 'build/dev';
  mkdirSync(dir, { recursive: true });
  const reload = "new EventSource('/esbuild').addEventListener('change', () => location.reload());";
  const html = readFileSync('src/index.html', 'utf8')
    .replace('<script>/*__APP__*/</script>', () => `<script>${reload}</script>\n<script src="app.js"></script>`);
  writeFileSync(`${dir}/index.html`, html);
  const ctx = await context({ ...opts, outfile: `${dir}/app.js`, sourcemap: true, logLevel: 'info' });
  await ctx.watch();
  const { hosts, port } = await ctx.serve({ servedir: dir, port: Number(process.env.PORT) || 8000 });
  console.log(`開発サーバー: http://${hosts[0] === '0.0.0.0' ? 'localhost' : hosts[0]}:${port}/`);
} else {
  const r = await build({ ...opts, minify: true, write: false });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = readFileSync('src/index.html', 'utf8').replace('/*__APP__*/', () => js);
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  console.log(`dist/index.html ${(html.length / 1024).toFixed(1)} KB`);
}
