/**
 * 複数のシードを実行して（キャッシュにあれば再利用して）、結果を out/<番号>-<シード>/ に置く。batch と ab が使う。
 */
import { cpus } from 'os';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { Bin, ensureRun, getBin, materialize, pool, readMeta, secPerDay } from './runs';
import { DAY_TICKS } from './engine';

export const dirName = (seeds: string[], i: number) => `${String(i + 1).padStart(2, '0')}-${seeds[i].replace(/[\\/:*?"<>|\s]/g, '_')}`;

export interface SetSpec { seeds: string[]; days: number; adv: number; ver: Bin; fork?: { day: number; base: Bin }; out: string }

/** 実行時間の見積もり（キャッシュにある過去の結果の1日あたりの秒数 × 残りの日数。重いものから先に実行するため） */
function weight(spec: SetSpec, seed: string): number {
  const from = spec.fork && spec.fork.base.simHash !== spec.ver.simHash ? spec.fork.day : 0;
  return (spec.days - from) * secPerDay(seed);
}

/** 複数のシードの組をまとめて実行する（並列数は jobs。組をまたいで重いものから） */
export async function runSets(sets: SetSpec[], jobs = cpus().length, log: (s: string) => void = console.log): Promise<void> {
  const tasks = sets.flatMap((spec) =>
    spec.seeds.map((seed, i) => ({
      w: weight(spec, seed),
      f: async () => {
        const cached = await ensureRun({ seed, days: spec.days, adv: spec.adv, ver: spec.ver, fork: spec.fork }, log);
        materialize(cached, join(spec.out, dirName(spec.seeds, i)), spec.days);
      },
    })),
  );
  for (const s of sets) {
    mkdirSync(s.out, { recursive: true });
    writeFileSync(join(s.out, 'batch.json'), JSON.stringify({ seeds: s.seeds, days: s.days, advMax: s.adv, sim: s.ver.simHash, ref: s.ver.ref, fork: s.fork ? { day: s.fork.day, sim: s.fork.base.simHash, ref: s.fork.base.ref } : undefined }, null, 1));
  }
  await pool(tasks, jobs);
}

/** 各シードの report.md を作る（並列数は jobs） */
export async function reports(out: string, seeds: string[], jobs = cpus().length): Promise<void> {
  const rep = await getBin('report');
  await pool(seeds.map((_, i) => ({
    w: 1,
    f: () => new Promise<void>((res) => {
      const dir = join(out, dirName(seeds, i));
      if (!existsSync(join(dir, 'samples.jsonl'))) return res();
      const p = spawn(process.execPath, [rep.path, '--run', dir], { stdio: ['ignore', 'ignore', 'inherit'] });
      p.on('exit', () => res());
    }),
  })), jobs);
}

export const finished = (dir: string, days: number) => (readMeta(dir)?.tick ?? 0) >= days * DAY_TICKS;
