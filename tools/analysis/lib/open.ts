/**
 * あるシードの、ある刻みの状態を手に入れる（調べ物・確かめ・後からの計算が使う）。
 *
 * 探す順（見つかったものを使い、何を使ったかを知らせる）：
 *   1. --run <フォルダ> を指定したら、その回の1日ごとの状態（batch や ab が作ったフォルダでもよい）
 *   2. いまの版で最初から回した状態（runs/.cache/snap/<いまの版>）
 *   3. いまの版で、前の版の途中の状態から続けた回（runs/.cache/run の f<日>-<版>、ab --fork や preset quick が作る）
 *   4. 前の版（--base、既定 HEAD）で最初から回した状態から、いまの版で続ける（コードを直した直後。何日目から分かれたかを示す）
 *   5. どれもなければ最初から回す（途中の1日ごとの状態は 2. の保存庫に置くので、次からは速い）
 * どの場合も、いちばん近い前の日の状態から、刻みを一つずつ進めて目当ての刻みまで行く（進め方は sim と同じ lib/engine.ts の tick）。
 */
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { DAY_TICKS, Ecology, World, tick } from './engine';
import { decodeState, encodeState, readState, writeState } from './state';
import { CACHE, dayName, getSimHash, readMeta, SELF_SIM, seedKey, snapDays, snapDir, snapsOf } from './runs';

export interface Opened { w: World; from: string; fromTick: number }
export interface OpenOpts { run?: string; base?: string; adv?: number; quiet?: boolean; pure?: boolean }

const daysIn = (dir: string) => (existsSync(dir) ? readdirSync(dir).map((f) => /^d(\d+)\.json\.gz$/.exec(f)).filter(Boolean).map((m) => +m![1]) : []);

/** 目当ての刻み以下で、いちばん近い日の状態を探す */
async function findStart(seed: string, t: number, o: OpenOpts): Promise<{ path: string; day: number; from: string } | null> {
  const want = Math.floor(t / DAY_TICKS);
  const adv = o.adv ?? Ecology.ADV_MAX_PARTIES;
  const best = (dir: string, min = 1) => daysIn(dir).filter((d) => d <= want && d >= min).sort((a, b) => b - a)[0];
  if (o.run) {
    const d = best(snapsOf(o.run));
    if (d !== undefined) return { path: join(snapsOf(o.run), dayName(d)), day: d, from: `${o.run} の ${d}日目の状態` };
    throw new Error(`${o.run} に ${want}日目以前の状態がない`);
  }
  const pureDay = best(snapDir(SELF_SIM, adv, seed));
  // 3. いまの版で続けた回
  let fork: { path: string; day: number; from: string } | null = null;
  const base = join(CACHE, 'run');
  if (existsSync(base))
    for (const b of readdirSync(base)) {
      const d = join(base, b, `a${adv}`, seedKey(seed));
      if (!existsSync(d)) continue;
      for (const st of readdirSync(d)) {
        if (!st.startsWith('f')) continue;
        const m = readMeta(join(d, st));
        const lin = m?.lineage ?? [];
        if (!lin.length || lin[lin.length - 1].sim !== SELF_SIM) continue;
        const from = Math.ceil(lin[lin.length - 1].from / DAY_TICKS);
        const day = best(join(d, st, 'snap'), from + 1);
        if (day !== undefined && (!fork || day > fork.day)) fork = { path: join(d, st, 'snap', dayName(day)), day, from: `いまの版を ${st.slice(1).split('-')[0]}日目の前の版（${st.split('-')[1]}）の状態から続けた回の ${day}日目` };
      }
    }
  if (pureDay !== undefined && (!fork || pureDay >= fork.day)) return { path: join(snapDir(SELF_SIM, adv, seed), dayName(pureDay)), day: pureDay, from: `いまの版で最初から回した ${pureDay}日目の状態` };
  if (fork && !o.pure) return fork;
  if (o.pure) return pureDay !== undefined ? { path: join(snapDir(SELF_SIM, adv, seed), dayName(pureDay)), day: pureDay, from: `いまの版で最初から回した ${pureDay}日目の状態` } : null;
  // 4. 前の版
  const bs = await getSimHash(o.base || 'HEAD');
  if (bs !== SELF_SIM) {
    const bd = best(snapDir(bs, adv, seed));
    if (bd !== undefined) return { path: join(snapDir(bs, adv, seed), dayName(bd)), day: bd, from: `前の版（${o.base || 'HEAD'}、${bs}）で最初から回した ${bd}日目の状態から、いまの版で続けた` };
  }
  return null;
}

/** seed の t 刻みの状態（t は刻み。日で言うなら day * DAY_TICKS） */
export async function openAt(seed: string, t: number, o: OpenOpts = {}): Promise<Opened> {
  if (o.adv !== undefined) Ecology.ADV_MAX_PARTIES = o.adv;
  const st = await findStart(seed, t, o);
  let w: World;
  let from: string;
  if (st) {
    w = decodeState(readState(st.path));
    from = st.from;
  } else {
    w = new World(seed);
    from = 'いまの版で最初から（途中の状態がなかったので回した。1日ごとの状態は保存庫に置いた）';
  }
  // 最初から回すときは、1日ごとの状態を保存庫に置く（この版で混じりけなし）
  const save = !st && SELF_SIM !== '?' ? snapDir(SELF_SIM, Ecology.ADV_MAX_PARTIES, seed) : '';
  if (save) mkdirSync(save, { recursive: true });
  const t0 = Date.now();
  const fromTick = w.tick;
  while (w.tick < t) {
    tick(w);
    if (save && w.tick % DAY_TICKS === 0 && !existsSync(join(save, dayName(w.tick / DAY_TICKS)))) writeState(join(save, dayName(w.tick / DAY_TICKS)), encodeState(w));
  }
  if (!o.quiet) console.error(`［${seed}］${from}${w.tick > fromTick ? ` → ${((w.tick - fromTick) / DAY_TICKS).toFixed(2)}日ぶん進めた（${((Date.now() - t0) / 1000).toFixed(1)}秒）` : ''}`);
  return { w, from, fromTick };
}

export { snapDays };
