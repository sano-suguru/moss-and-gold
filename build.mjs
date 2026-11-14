// 使い方:
//   node build.mjs        → dist/index.html（一つのHTMLにまとめた完成版）
//   node build.mjs --dev  → 開発サーバー（npm run dev）。src と src/index.html を書き換えると作り直し、開いているページを自動で読み込み直す。
//                           ファイルは build/dev/ に書く。ポートは環境変数 PORT で決める（無ければ 8000、使用中なら 8000〜8999 の空きを esbuild が選ぶ）。
//                           既定では自分のマシン（127.0.0.1）からだけ開ける。スマホの実機などから見るときは HOST=0.0.0.0 を付ける。
import { build, context } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const opts = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
};

if (process.argv.includes('--dev')) {
  // 開発用：JS は別ファイルにし（ソースマップ付き、圧縮しない）、esbuild が書き直しを知らせる /esbuild に繋いで、
  // 作り直しのたびにページを読み込み直す。
  const dir = 'build/dev';
  mkdirSync(dir, { recursive: true });
  const reload = "new EventSource('/esbuild').addEventListener('change', () => location.reload());";
  const indexPath = resolve('src/index.html');
  // index.html も esbuild に見張らせる：main.ts を読み込むたびに、本番と同じ目印（/*__APP__*/）の所へ読み込み直しの処理を置いた
  // 開発用の HTML を書き、index.html の中身のハッシュを main.ts の末尾のコメントに足す。index.html が変わるとソースマップが変わるので、
  // esbuild が「書き換わった」と知らせ、ページが読み込み直される（watchFiles に入れるので、index.html の書き換えでも作り直す）。
  const devHtml = {
    name: 'dev-html',
    setup(b) {
      b.onLoad({ filter: /[\\/]src[\\/]main\.ts$/ }, (args) => {
        const src = readFileSync(indexPath, 'utf8');
        if (!src.includes('/*__APP__*/')) throw new Error('src/index.html に /*__APP__*/ が無い');
        writeFileSync(`${dir}/index.html`, src.replace('/*__APP__*/', () => `${reload}</script>\n<script src="app.js">`));
        const hash = createHash('sha256').update(src).digest('hex').slice(0, 12);
        return { contents: `${readFileSync(args.path, 'utf8')}\n// index.html ${hash}\n`, loader: 'ts', watchFiles: [indexPath] };
      });
    },
  };
  const ctx = await context({ ...opts, outfile: `${dir}/app.js`, sourcemap: true, logLevel: 'info', plugins: [devHtml] });
  await ctx.watch();
  const { hosts, port } = await ctx.serve({
    servedir: dir,
    host: process.env.HOST || '127.0.0.1',
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  });
  console.log(`開発サーバー: http://${hosts[0] === '0.0.0.0' ? 'localhost' : hosts[0]}:${port}/`);
} else {
  const r = await build({ ...opts, minify: true, write: false });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = readFileSync('src/index.html', 'utf8').replace('/*__APP__*/', () => js);
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  console.log(`dist/index.html ${(html.length / 1024).toFixed(1)} KB`);
}
