/**
 * 道具の組み立てと、版の見分け（esbuild の API を使う。Node からそのまま読める JS）。
 *
 * - 版（simHash）：シミュレーションを決めるソース（tools/analysis/lib/engine.ts からたどれるファイル）の中身のハッシュ。
 *   中身だけで決まるので、git の参照（コミット）でも作業中のファイルでも、同じ中身なら同じ版になる。
 *   途中の状態の保存庫（runs/.cache/snap）は版ごとに分け、版が違えば使わない。
 * - 道具の版（binHash）：組み立てた道具（記録の仕方も含む）のソースの中身のハッシュ。回した結果の保存庫（runs/.cache/run）はこれで分ける。
 * - 組み立てた道具は runs/.cache/bin/<道具>-<binHash>.js に置き、書き換えない（batch の最中にソースを直しても、回っているものに響かない）。
 * - git の参照（--base HEAD~1 など）は、その版の src/ だけを runs/.cache/src/<コミット>/ に取り出し、いまの道具（記録の仕方）と組み合わせて組み立てる。
 *   前の版といまの版を、同じ記録の仕方で比べるため。
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

/** git の参照を、その版の src/ を取り出したフォルダに（作業中のもの＝'cur' なら ROOT） */
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

/** src/ への import を、別の版の src/ へ差し替える */
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

const h = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);
/** 組み立てに入ったファイルの中身のハッシュ（場所は、版のフォルダを除いた名前で） */
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
/** シミュレーションの版（engine.ts からたどれるソースの中身） */
export async function simHash(ref = 'cur') {
  const root = refRoot(ref);
  if (memo.has('sim:' + root)) return memo.get('sim:' + root);
  const r = await build({ entryPoints: [join(ROOT, 'tools/analysis/lib/engine.ts')], bundle: true, platform: 'node', write: false, metafile: true, logLevel: 'silent', plugins: redirect(root) });
  const v = inputsHash(r.metafile, root);
  memo.set('sim:' + root, v);
  return v;
}

/**
 * 道具を組み立てる（tools/analysis/<name>.ts、ref の版の src/ と組み合わせて）。
 * 返すもの：{ path（組み立てたファイル）, simHash, binHash }。同じ中身なら組み立て直さない。
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
