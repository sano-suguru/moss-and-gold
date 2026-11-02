#!/usr/bin/env node
/**
 * いまのソースの版の保存庫（16シード×25日の結果と1日ごとの状態）を、GitHub の Release に置く・そこから取ってくる。
 * 新しいセッションで main の版を回し直さないため（GitHub Actions の simcache.yml が main へのマージごとに作って置く）。
 *
 *   node tools/analysis/simcache.mjs key            置くファイルの名前（simcache-<版>-<道具の版>.tar.gz）
 *   node tools/analysis/simcache.mjs pack <file>    runs/.cache から、いまの版の分だけを固める
 *   node tools/analysis/simcache.mjs fetch          Release から取ってきて runs/.cache に広げる（もうあれば何もしない。なければ黙って終わる）
 *   node tools/analysis/simcache.mjs fetch --ref origin/main   main の版の分を取ってくる（作業中のブランチの src ではなく）
 *
 * 固めるのは、版（simHash）の混じりけのない1日ごとの状態 runs/.cache/snap/<simHash>/ と、
 * 道具（sim）の版の最初から回した結果 runs/.cache/run/<binHash>/a*\/<シード>/0/。
 * 中身のハッシュで決まる場所なので、取ってきたものは手元で回したものと同じに使われる（規則は docs/rework-tools.md）。
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { bin, CACHE, ROOT } from './lib/bins.mjs';

const TAG = 'sim-cache';
const cmd = process.argv[2];
// --ref <git の参照>：その版の src/ で（道具はいまのもの）。比べる土台の main の名前を出すとき（始まりのフック）
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

/** 固めるもの（runs/.cache からの相対） */
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
  if (!ps.length) throw new Error('固めるものがない（先に npm run batch -- --seeds 16 --days 25 を回す）');
  execFileSync('tar', ['-czf', file, '-C', CACHE, ...ps], { stdio: 'inherit' });
  console.log(`${file}（${ps.length} 個）`);
} else if (cmd === 'fetch') {
  const mark = join(CACHE, 'fetched', name);
  if (existsSync(mark)) {
    console.log(`保存庫はもう取ってある：${name}`);
    process.exit(0);
  }
  mkdirSync(join(CACHE, 'fetched'), { recursive: true });
  // SIMCACHE_BASE で置き場を差し替えられる（確かめ用。file:// も可）
  const url = `${process.env.SIMCACHE_BASE ?? `https://github.com/${repo()}/releases/download/${TAG}`}/${name}`;
  const tmp = join(CACHE, 'fetched', `${name}.part`);
  try {
    execFileSync('curl', ['-sSfL', '--retry', '3', '-o', tmp, url], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch {
    console.log(`Release にまだない：${name}（main にマージしたあと Actions の simcache が作り終えると置かれる。いまは手元で回す）`);
    process.exit(0);
  }
  execFileSync('tar', ['-xzf', tmp, '-C', CACHE], { stdio: 'inherit' });
  rmSync(tmp);
  writeFileSync(mark, url + '\n');
  console.log(`保存庫を取ってきた：${name}（版 ${sim.simHash}）`);
} else {
  console.log('使い方：node tools/analysis/simcache.mjs key | pack <file> | fetch');
  process.exit(1);
}
