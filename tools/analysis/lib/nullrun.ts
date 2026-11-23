/**
 * 無害な変更の実行（A/B 比較の「揺れの幅」の基準）。ab が使う。
 *
 * 展開は少しの違いで大きく分かれるので、何も仕組みを変えなくても、A/B 比較の表の何行かは「はっきり」になる
 * （300行あまりを一行ずつ判定するので、一行あたりの見落とし・見誤りの割合が小さくても、何行かは引っかかる）。
 * そこで、ベースと同じシミュレーションのまま、from 日目の状態だけを少し変えて（次に生まれる生き物の番号 nextId を k だけ進める。
 * 生き物の番号はハッシュの乱数の種なので、そこから先の展開が分かれる。仕組みは何も変わらない）続けた実行を作り、
 * ベースとの差を「無害な変更でもこのくらい動く」幅として A/B 比較の表に並べる（compare.ts の --null）。
 *
 * キャッシュ：runs/.cache/null/<binHash>/a<上限>/<シード>/k<k>-f<from>/（sim の出力と同じ形。ベースの from 日目までのログを含む）。
 * meta.json の系譜（lineage）に null-k<k> を足すので、sim はこれを「0日目から一つのバージョンだけで実行したもの」とみなさず、
 * 日次スナップショットをバージョンごとのキャッシュ（runs/.cache/snap/）に置かない（置くと、ベースから分岐する実行がこの展開から始まってしまう）。
 * k を 0 にすると、ベースと1バイトも違わない続きになる（しくみの確かめに使う）。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, linkSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { DAY_TICKS } from './engine';
import { readState, writeState } from './state';
import { type Bin, CACHE, dayName, ensureRun, type Logger, RECORDS, readMeta, seedKey } from './runs';

/** 無害な変更の実行の場所 */
export const nullDir = (binHash: string, adv: number, seed: string, k: number, from: number) => join(CACHE, 'null', binHash, `a${adv}`, seedKey(seed), `k${k}-f${from}`);

function node(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, args, { stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`失敗（${c}）：node ${args.join(' ')}`))));
  });
}

/** ログ（jsonl）を t（tick）が maxT 以下の行だけに切り出してコピーする */
function copyRecords(from: string, to: string, maxT: number) {
  for (const f of RECORDS) {
    const p = join(from, `${f}.jsonl`);
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, 'utf8').split('\n').filter(Boolean).filter((l) => {
      const m = /"t":(\d+)/.exec(l);
      return !m || +m[1] <= maxT;
    });
    writeFileSync(join(to, `${f}.jsonl`), lines.length ? lines.join('\n') + '\n' : '');
  }
}

/**
 * ベース ver の、from 日目の状態の nextId を k 進めて days 日目まで続けた実行の場所を返す（キャッシュになければ実行し、日数が足りなければ再開する）。
 * ベースの from 日目までの実行も、なければ作る（ensureRun）
 */
export async function ensureNullRun(seed: string, days: number, adv: number, ver: Bin, k: number, from: number, log: Logger = () => {}): Promise<string> {
  const dir = nullDir(ver.binHash, adv, seed, k, from);
  const target = days * DAY_TICKS;
  const have = readMeta(dir);
  if (have && have.tick >= target) return dir;
  const t0 = Date.now();
  if (have && existsSync(join(dir, 'checkpoint.json'))) {
    await node([ver.path, '--resume', dir, '--days', String(days), '--budget', '1e9']);
  } else {
    const base = await ensureRun({ seed, days: from, adv, ver }, log);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, 'snap'), { recursive: true });
    copyRecords(base, dir, from * DAY_TICKS);
    for (const f of readdirSync(join(base, 'snap'))) {
      const m = /^d(\d+)\.json\.gz$/.exec(f);
      if (!m || +m[1] > from) continue;
      try {
        linkSync(join(base, 'snap', f), join(dir, 'snap', f));
      } catch {
        cpSync(join(base, 'snap', f), join(dir, 'snap', f));
      }
    }
    const s = readState(join(base, 'snap', dayName(from)));
    s.eco.n += k;
    writeState(join(dir, 'checkpoint.json'), s);
    const bm = readMeta(base)!;
    const lineage = [...(bm.lineage ?? []), { sim: `null-k${k}`, from: from * DAY_TICKS }];
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ ...bm, tick: from * DAY_TICKS, days: from, lineage }, null, 1));
    await node([ver.path, '--resume', dir, '--days', String(days), '--budget', '1e9']);
  }
  log(`  ${seed}：無害な変更 k${k}（${from}日目から）→${days}日（${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
  return dir;
}
