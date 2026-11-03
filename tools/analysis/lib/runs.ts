/**
 * 実行結果とスナップショットのキャッシュ（runs/.cache）。
 *
 *   runs/.cache/bin/<ツール>-<binHash>.js          ビルドしたツール（書き換えない）
 *   runs/.cache/snap/<simHash>/a<上限>/<シード>/d<日>.json.gz
 *                                                    0日目から一つのバージョンだけで実行した（ほかのバージョンが混じらない）日次スナップショット
 *   runs/.cache/run/<binHash>/a<上限>/<シード>/<開始点>/
 *                                                    実行結果（sim の出力と同じ形。snap/ に日次スナップショット）。
 *                                                    開始点は 0（0日目から）か f<日>-<simHash>（そのバージョンの、その日のスナップショットから続けた）
 *   （<上限> は冒険者の一行の上限）
 *
 * キャッシュの無効化は規則だけで決まる：バージョン（中身のハッシュ）が違えば別の場所なので使わない。同じバージョン・同じシード・同じ開始点なら、
 * 実行した日数が足りなければ続きから再開し（--resume。分けて実行しても結果は同じ）、足りていればそのまま使う。
 */
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { cpSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { DAY_TICKS } from './engine';
import { readState, writeState } from './state';

export const CACHE = join(process.cwd(), 'runs', '.cache');

export interface Bin { path: string; simHash: string; binHash: string; ref?: string }

/** ツールをビルドする（bins.mjs を使う。ツールの中からも呼べる） */
export async function getBin(name: string, ref = 'cur'): Promise<Bin> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = await import(join(process.cwd(), 'tools/analysis/lib/bins.mjs'));
  const b = await m.bin(name, ref);
  return { ...b, ref };
}
export async function getSimHash(ref = 'cur'): Promise<string> {
  const m = await import(join(process.cwd(), 'tools/analysis/lib/bins.mjs'));
  return m.simHash(ref);
}

/** このツール自身のバージョン（launch.mjs がビルドしたときに埋め込む。npm run 以外でビルドしたときは '?'） */
export const SELF_SIM: string = (globalThis as any).__SIM_HASH ?? '?';
export const SELF_BIN: string = (globalThis as any).__BIN_HASH ?? '?';

export const seedKey = (seed: string) => `${seed.replace(/[\\/:*?"<>|\s.]/g, '_')}-${createHash('sha1').update(seed).digest('hex').slice(0, 6)}`;
export const snapDir = (simHash: string, adv: number, seed: string) => join(CACHE, 'snap', simHash, `a${adv}`, seedKey(seed));
export const dayName = (d: number) => `d${String(d).padStart(3, '0')}.json.gz`;
export const runDir = (binHash: string, adv: number, seed: string, start: string) => join(CACHE, 'run', binHash, `a${adv}`, seedKey(seed), start);

/** キャッシュにある、ほかのバージョンが混じらない日次スナップショットの日の一覧 */
export function snapDays(simHash: string, adv: number, seed: string): number[] {
  const d = snapDir(simHash, adv, seed);
  if (!existsSync(d)) return [];
  return readdirSync(d).map((f) => /^d(\d+)\.json\.gz$/.exec(f)).filter(Boolean).map((m) => +m![1]).sort((a, b) => a - b);
}

/** 既定の冒険者の一行の上限（現在のソースの Ecology から） */
export function defaultAdv(): number {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return (require('./engine') as typeof import('./engine')).Ecology.ADV_MAX_PARTIES;
}

export interface Meta { seed: string; days: number; tick: number; total0: number; gold0: number; trace: number; advMax?: number; lineage?: { sim: string; from: number }[]; bin?: string }
export const readMeta = (dir: string): Meta | null => (existsSync(join(dir, 'meta.json')) ? JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) : null);

export const RECORDS = ['samples', 'deaths', 'births', 'exits', 'moves', 'settle', 'events', 'trace', 'stuck'];

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
function linkOrCopy(a: string, b: string) {
  try {
    linkSync(a, b);
  } catch {
    cpSync(a, b);
  }
}

/** シードのゲーム内1日あたりの実行秒数（キャッシュにある過去の結果から。なければ 4） */
export function secPerDay(seed: string): number {
  const base = join(CACHE, 'run');
  if (!existsSync(base)) return 4;
  let secs = 0;
  let ticks = 0;
  for (const b of readdirSync(base)) for (const a of existsSync(join(base, b)) ? readdirSync(join(base, b)) : []) {
    const d = join(base, b, a, seedKey(seed));
    if (!existsSync(d)) continue;
    for (const st of readdirSync(d)) {
      const m = readMeta(join(d, st)) as any;
      if (m?.secs && m.secTicks) {
        secs += m.secs;
        ticks += m.secTicks;
      }
    }
  }
  return ticks ? (secs / ticks) * DAY_TICKS : 4;
}

export interface Logger { (s: string): void }

function spawnNode(args: string[], quiet = true): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, args, { stdio: ['ignore', quiet ? 'ignore' : 'inherit', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`失敗（${c}）：node ${args.join(' ')}`))));
  });
}

/** 同じ実行結果のフォルダを二つのジョブが同時に作らないようにする（同じプロセスの中では Promise を共有し、別のプロセスとはロック用のフォルダで排他する） */
const inflight = new Map<string, Promise<string>>();
async function withLock<T>(dir: string, f: () => Promise<T>): Promise<T> {
  const lock = dir + '.lock';
  mkdirSync(dirname(lock), { recursive: true });
  for (let i = 0; ; i++) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, 'pid'), String(process.pid));
      break;
    } catch {
      // ロックを持つプロセスがもういなければ、ロックを外す
      let alive = false;
      try {
        process.kill(+readFileSync(join(lock, 'pid'), 'utf8'), 0);
        alive = true;
      } catch { /* プロセスがない */ }
      if (!alive) rmSync(lock, { recursive: true, force: true });
      else await new Promise((r) => setTimeout(r, 500));
    }
  }
  try {
    return await f();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

export interface RunSpec { seed: string; days: number; adv: number; ver: Bin; fork?: { day: number; base: Bin } }

/**
 * spec の実行結果がそろったキャッシュの場所を返す（なければ実行し、日数が足りなければ再開する）。
 * fork：base のバージョンで0日目から fork.day 日目まで実行したスナップショットから、ver のバージョンで続ける（ログは fork.day 日目までが base と同じ）。
 */
export function ensureRun(spec: RunSpec, log: Logger = () => {}): Promise<string> {
  const pure = !spec.fork || spec.fork.base.simHash === spec.ver.simHash;
  const start = pure ? '0' : `f${spec.fork!.day}-${spec.fork!.base.simHash}`;
  const dir = runDir(spec.ver.binHash, spec.adv, spec.seed, start);
  const key = `${dir}@${spec.days}`;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    const target = spec.days * DAY_TICKS;
    const have = readMeta(dir);
    if (have && have.tick >= target) return dir;
    let baseDir = '';
    if (!pure && !(have && existsSync(join(dir, 'checkpoint.json')))) baseDir = await ensureRun({ seed: spec.seed, days: spec.fork!.day, adv: spec.adv, ver: spec.fork!.base }, log);
    return withLock(dir, async () => {
      const m = readMeta(dir);
      if (m && m.tick >= target) return dir;
      const t0 = Date.now();
      const from = m ? m.tick / DAY_TICKS : pure ? 0 : spec.fork!.day;
      if (m && existsSync(join(dir, 'checkpoint.json'))) {
        await spawnNode([spec.ver.path, '--resume', dir, '--days', String(spec.days), '--budget', '1e9']);
      } else if (pure) {
        rmSync(dir, { recursive: true, force: true });
        await spawnNode([spec.ver.path, '--seed', spec.seed, '--days', String(spec.days), '--out', dir, '--adv-max', String(spec.adv), '--budget', '1e9']);
      } else {
        // 分岐点：base のログを fork.day 日目までコピーし、その日のスナップショットを checkpoint にする
        const F = spec.fork!.day;
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(join(dir, 'snap'), { recursive: true });
        copyRecords(baseDir, dir, F * DAY_TICKS);
        const bm = readMeta(baseDir)!;
        for (const f of readdirSync(join(baseDir, 'snap'))) {
          const mm = /^d(\d+)\.json\.gz$/.exec(f);
          if (mm && +mm[1] <= F) linkOrCopy(join(baseDir, 'snap', f), join(dir, 'snap', f));
        }
        writeState(join(dir, 'checkpoint.json'), readState(join(baseDir, 'snap', dayName(F))));
        writeFileSync(join(dir, 'meta.json'), JSON.stringify({ ...bm, tick: F * DAY_TICKS, days: F }, null, 1));
        await spawnNode([spec.ver.path, '--resume', dir, '--days', String(spec.days), '--budget', '1e9']);
      }
      log(`  ${spec.seed}：${from.toFixed(0)}→${spec.days}日（${((Date.now() - t0) / 1000).toFixed(0)}秒）${pure ? '' : `　ベースの${spec.fork!.day}日目のスナップショットから`}`);
      return dir;
    });
  })();
  inflight.set(key, p);
  return p;
}

/** キャッシュの実行結果を、days 日目までに切り出して out に置く（batch や compare が読む形） */
export function materialize(cached: string, out: string, days: number): void {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const T = days * DAY_TICKS;
  copyRecords(cached, out, T);
  const m = readMeta(cached)!;
  const snap = join(cached, 'snap', dayName(days));
  if (m.tick === T && existsSync(join(cached, 'checkpoint.json'))) linkOrCopy(join(cached, 'checkpoint.json'), join(out, 'checkpoint.json'));
  else writeState(join(out, 'checkpoint.json'), readState(snap));
  writeFileSync(join(out, 'meta.json'), JSON.stringify({ ...m, tick: T, days, snaps: relative(out, join(cached, 'snap')) }, null, 1));
}

/** 実行結果のフォルダの、日次スナップショットの場所（materialize したものはキャッシュを指す） */
export function snapsOf(run: string): string {
  const m = readMeta(run) as any;
  return m?.snaps ? resolve(run, m.snaps) : join(run, 'snap');
}

/** タスクを並列数 n で、重いもの（w が大きいもの）から実行する */
export async function pool<T>(tasks: { w: number; f: () => Promise<T> }[], n: number): Promise<T[]> {
  const order = tasks.map((t, i) => i).sort((a, b) => tasks[b].w - tasks[a].w);
  const res: T[] = new Array(tasks.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, tasks.length)) }, async () => {
    while (i < order.length) {
      const j = order[i++];
      res[j] = await tasks[j].f();
    }
  }));
  return res;
}
