/**
 * ツールのビルドと、バージョンの識別（esbuild の API を使う。Node からそのまま読める JS）。
 *
 * - シミュレーションのバージョン（simHash）：シミュレーションを決めるソース（tools/analysis/lib/engine.ts から import をたどれるファイル）の中身のハッシュ。
 *   中身だけで決まるので、git の参照（コミット）でも作業ツリーのファイルでも、同じ中身なら同じバージョンになる。
 *   スナップショットのキャッシュ（runs/.cache/snap）はバージョンごとに分け、バージョンが違えば使わない。
 * - ツールのバージョン（binHash）：ビルドしたツール（ログの出力の仕方も含む）のソースの中身のハッシュ。実行結果のキャッシュ（runs/.cache/run）はこれで分ける。
 * - ビルドしたツールは runs/.cache/bin/<ツール>-<binHash>.js に置き、書き換えない（batch の実行中にソースを直しても、実行中のものに影響しない）。
 * - git の参照（--base HEAD~1 など）は、そのコミットの src/ だけを runs/.cache/src/<コミット>/ に取り出し、作業ツリーのツール（ログの出力の仕方）と組み合わせてビルドする。
 *   ベースと作業ツリーを、同じログの出力の仕方で比べるため。
 */
import { build } from 'esbuild';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const CACHE = join(ROOT, 'runs', '.cache');
const SRC = join(ROOT, 'src') + sep;

/** git の参照から、そのコミットの src/ を取り出したフォルダを返す（作業ツリー＝'cur' なら ROOT） */
export function refRoot(ref) {
  if (!ref || ref === 'cur') return ROOT;
  const sha = execFileSync('git', ['rev-parse', `${ref}^{commit}`], { cwd: ROOT }).toString().trim();
  const dir = join(CACHE, 'src', sha);
  if (!existsSync(join(dir, 'src'))) {
    mkdirSync(dir, { recursive: true });
    const tar = execFileSync('git', ['archive', sha, 'src'], { cwd: ROOT, maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
  }
  return dir;
}

/** src/ への import を、別のコミットから取り出した src/ へ差し替える（esbuild のプラグイン） */
function redirect(root) {
  if (root === ROOT) return [];
  const to = join(root, 'src') + sep;
  return [{
    name: 'ref-src',
    setup(b) {
      b.onResolve({ filter: /^\./ }, (a) => {
        const p = resolve(a.resolveDir, a.path);
        if (!p.startsWith(SRC)) return undefined;
        let q = to + p.slice(SRC.length);
        if (!q.endsWith('.ts') && existsSync(q + '.ts')) q += '.ts';
        return { path: q };
      });
    },
  }];
}

/** ビルドに含まれたファイルの中身のハッシュ（パスは、取り出したコミットのフォルダを除いた相対パスで数える） */
function inputsHash(meta, root) {
  const strip = (p) => {
    const a = resolve(ROOT, p);
    return root !== ROOT && a.startsWith(root + sep) ? a.slice(root.length + 1) : a.slice(ROOT.length + 1);
  };
  const files = Object.keys(meta.inputs).map((p) => [strip(p), resolve(ROOT, p)]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const H = createHash('sha256');
  for (const [name, abs] of files) H.update(name + '\0').update(readFileSync(abs)).update('\0');
  return H.digest('hex').slice(0, 12);
}

const memo = new Map();
/** シミュレーションのバージョン（engine.ts から import をたどれるソースの中身のハッシュ） */
export async function simHash(ref = 'cur') {
  const root = refRoot(ref);
  if (memo.has('sim:' + root)) return memo.get('sim:' + root);
  const r = await build({ entryPoints: [join(ROOT, 'tools/analysis/lib/engine.ts')], bundle: true, platform: 'node', write: false, metafile: true, logLevel: 'silent', plugins: redirect(root) });
  const v = inputsHash(r.metafile, root);
  memo.set('sim:' + root, v);
  return v;
}

/**
 * ツール（tools/analysis/<name>.ts）を、ref（コミット。'cur' なら作業ツリー）の src/ と組み合わせてビルドする。
 * 返すもの：{ path（ビルドしたファイル）, simHash, binHash }。同じ中身ならビルドし直さない。
 */
export async function bin(name, ref = 'cur') {
  const root = refRoot(ref);
  const key = `bin:${name}:${root}`;
  if (memo.has(key)) return memo.get(key);
  const sim = await simHash(ref);
  const r = await build({ entryPoints: [join(ROOT, 'tools/analysis', name + '.ts')], bundle: true, platform: 'node', write: false, metafile: true, logLevel: 'warning', external: ['esbuild', 'playwright'], plugins: redirect(root) });
  const binHash = inputsHash(r.metafile, root);
  const dir = join(CACHE, 'bin');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name.replace(/\//g, '_')}-${binHash}.js`);
  if (!existsSync(path)) {
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, `globalThis.__SIM_HASH=${JSON.stringify(sim)};globalThis.__BIN_HASH=${JSON.stringify(binHash)};globalThis.__SIM_REF=${JSON.stringify(ref)};\n` + r.outputFiles[0].text);
    renameSync(tmp, path);
  }
  const v = { path, simHash: sim, binHash };
  memo.set(key, v);
  return v;
}
