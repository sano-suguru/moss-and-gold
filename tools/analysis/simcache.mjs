#!/usr/bin/env node
/**
 * 現在のソースのバージョンのキャッシュ（16シード×25日の実行結果と日次スナップショット）を、GitHub の Release にアップロードする・そこから取得する。
 * 新しいセッションで main のバージョンを再実行しないため（GitHub Actions の simcache.yml が main へのマージごとに作ってアップロードする）。
 *
 *   node tools/analysis/simcache.mjs key            アップロードするファイルの名前（simcache-<シミュレーションのハッシュ>-<sim ツールのハッシュ>.tar.gz）
 *   node tools/analysis/simcache.mjs pack <file>    runs/.cache から、現在のバージョンの分だけを tar.gz にまとめる
 *   node tools/analysis/simcache.mjs fetch          Release から取得して runs/.cache に展開する（取得済みなら何もしない。Release になければ何もせずに終わる）
 *   node tools/analysis/simcache.mjs fetch --ref origin/main   main のバージョンの分を取得する（作業中のブランチの src ではなく）
 *
 * まとめるのは、シミュレーションのハッシュ（simHash）が一つだけの（pure な）日次スナップショット runs/.cache/snap/<simHash>/ と、
 * ビルドした sim ツールのハッシュ（binHash）ごとの、0日目から実行した結果 runs/.cache/run/<binHash>/a*\/<シード>/0/。
 * 中身のハッシュで決まる場所なので、取得したものは手元で実行したものと同じように使われる（規則は docs/rework-tools.md）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bin, CACHE, ROOT } from './lib/bins.mjs';

const TAG = 'sim-cache';
const cmd = process.argv[2];
// --ref <git の参照>：そのコミットの src/ でビルドする（ツールは作業ツリーのもの）。比較のベースになる main の名前を出すとき（SessionStart フック）
const ref = process.argv.includes('--ref') ? process.argv[process.argv.indexOf('--ref') + 1] : 'cur';
const sim = await bin('sim', ref);
const name = `simcache-${sim.simHash}-${sim.binHash}.tar.gz`;

/** origin の owner/repo（https でも ssh でも、ローカルの git の proxy でも末尾から読む） */
function repo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT }).toString().trim();
  const m = /([^/:]+)\/([^/]+?)(\.git)?$/.exec(url);
  if (!m) throw new Error(`origin の URL が読めない：${url}`);
  return `${m[1]}/${m[2]}`;
}

/** tar.gz にまとめるもの（runs/.cache からの相対パス） */
function parts() {
  const out = [];
  if (existsSync(join(CACHE, 'snap', sim.simHash))) out.push(join('snap', sim.simHash));
  const rd = join(CACHE, 'run', sim.binHash);
  if (existsSync(rd))
    for (const a of readdirSync(rd))
      for (const s of readdirSync(join(rd, a))) if (existsSync(join(rd, a, s, '0'))) out.push(join('run', sim.binHash, a, s, '0'));
  return out;
}

if (cmd === 'key') {
  console.log(name);
} else if (cmd === 'pack') {
  const file = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : name;
  const ps = parts();
  if (!ps.length) throw new Error('まとめるものがない（先に npm run batch -- --seeds 16 --days 25 を実行する）');
  execFileSync('tar', ['-czf', file, '-C', CACHE, ...ps], { stdio: 'inherit' });
  console.log(`${file}（${ps.length} 個）`);
} else if (cmd === 'fetch') {
  const mark = join(CACHE, 'fetched', name);
  if (existsSync(mark)) {
    console.log(`キャッシュは取得済み：${name}`);
    process.exit(0);
  }
  mkdirSync(join(CACHE, 'fetched'), { recursive: true });
  // SIMCACHE_BASE で取得元を差し替えられる（テスト用。file:// も可）
  const url = `${process.env.SIMCACHE_BASE ?? `https://github.com/${repo()}/releases/download/${TAG}`}/${name}`;
  const tmp = join(CACHE, 'fetched', `${name}.part`);
  try {
    execFileSync('curl', ['-sSfL', '--retry', '3', '-o', tmp, url], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch {
    console.log(`Release にまだない：${name}（main にマージしたあと Actions の simcache が作り終えるとアップロードされる。いまは手元で実行する）`);
    process.exit(0);
  }
  execFileSync('tar', ['-xzf', tmp, '-C', CACHE], { stdio: 'inherit' });
  rmSync(tmp);
  writeFileSync(mark, url + '\n');
  console.log(`キャッシュを取得した：${name}（バージョン ${sim.simHash}）`);
} else {
  console.log('使い方：node tools/analysis/simcache.mjs key | pack <file> | fetch');
  process.exit(1);
}
