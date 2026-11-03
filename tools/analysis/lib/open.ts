/**
 * あるシードの、ある tick の時点の状態を取得する（probe・check・metric が使う）。
 *
 * 探す順（見つかったものを使い、どれを使ったかを表示する）：
 *   1. --run <フォルダ> を指定したら、その実行の日次スナップショット（batch や ab が作ったフォルダでもよい）
 *   2. 作業ツリーのバージョンで0日目から実行したスナップショット（runs/.cache/snap/<作業ツリーの simHash>）
 *   3. 作業ツリーのバージョンで、ベースのスナップショットから続けた実行（runs/.cache/run の f<日>-<simHash>。ab --fork や preset quick が作る）
 *   4. ベース（--base、既定 HEAD）で0日目から実行したスナップショットから、作業ツリーのコードで続ける（コードを直した直後。何日目から分岐したかを表示する）
 *   5. どれもなければ0日目から実行する（日次スナップショットは 2. のキャッシュに置くので、次からは速い）
 * どの場合も、目的の tick 以前でいちばん近い日のスナップショットから、1 tick ずつ進めて目的の tick まで行く（進め方は sim と同じ lib/engine.ts の tick）。
 */
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { DAY_TICKS, Ecology, World, tick } from './engine';
import { decodeState, encodeState, readState, writeState } from './state';
import { CACHE, dayName, getSimHash, readMeta, SELF_SIM, seedKey, snapDays, snapDir, snapsOf } from './runs';

export interface Opened { w: World; from: string; fromTick: number }
export interface OpenOpts { run?: string; base?: string; adv?: number; quiet?: boolean; pure?: boolean }

const daysIn = (dir: string) => (existsSync(dir) ? readdirSync(dir).map((f) => /^d(\d+)\.json\.gz$/.exec(f)).filter(Boolean).map((m) => +m![1]) : []);

/** 目的の tick 以前で、いちばん近い日のスナップショットを探す */
async function findStart(seed: string, t: number, o: OpenOpts): Promise<{ path: string; day: number; from: string } | null> {
  const want = Math.floor(t / DAY_TICKS);
  const adv = o.adv ?? Ecology.ADV_MAX_PARTIES;
  const best = (dir: string, min = 1) => daysIn(dir).filter((d) => d <= want && d >= min).sort((a, b) => b - a)[0];
  if (o.run) {
    const d = best(snapsOf(o.run));
    if (d !== undefined) return { path: join(snapsOf(o.run), dayName(d)), day: d, from: `${o.run} の ${d}日目のスナップショット` };
    throw new Error(`${o.run} に ${want}日目以前のスナップショットがない`);
  }
  const pureDay = best(snapDir(SELF_SIM, adv, seed));
  // 3. 作業ツリーのバージョンで、ベースのスナップショットから続けた実行
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
        if (day !== undefined && (!fork || day > fork.day)) fork = { path: join(d, st, 'snap', dayName(day)), day, from: `ベース（${st.split('-')[1]}）の ${st.slice(1).split('-')[0]}日目のスナップショットから作業ツリーで続けた実行の ${day}日目` };
      }
    }
  if (pureDay !== undefined && (!fork || pureDay >= fork.day)) return { path: join(snapDir(SELF_SIM, adv, seed), dayName(pureDay)), day: pureDay, from: `作業ツリーで0日目から実行した ${pureDay}日目のスナップショット` };
  if (fork && !o.pure) return fork;
  if (o.pure) return pureDay !== undefined ? { path: join(snapDir(SELF_SIM, adv, seed), dayName(pureDay)), day: pureDay, from: `作業ツリーで0日目から実行した ${pureDay}日目のスナップショット` } : null;
  // 4. ベースのスナップショットから作業ツリーで続ける
  const bs = await getSimHash(o.base || 'HEAD');
  if (bs !== SELF_SIM) {
    const bd = best(snapDir(bs, adv, seed));
    if (bd !== undefined) return { path: join(snapDir(bs, adv, seed), dayName(bd)), day: bd, from: `ベース（${o.base || 'HEAD'}、${bs}）で0日目から実行した ${bd}日目のスナップショットから、作業ツリーで続けた` };
  }
  return null;
}

/** seed の t tick の時点の状態（日で指定するなら t = day * DAY_TICKS） */
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
    from = '作業ツリーで0日目から（スナップショットがなかったので実行した。日次スナップショットはキャッシュに置いた）';
  }
  // 0日目から実行するときは、日次スナップショットをキャッシュに置く（このバージョンだけで実行したものなので、ほかのバージョンが混じらない）
  const save = !st && SELF_SIM !== '?' ? snapDir(SELF_SIM, Ecology.ADV_MAX_PARTIES, seed) : '';
  if (save) mkdirSync(save, { recursive: true });
  const t0 = Date.now();
  const fromTick = w.tick;
  while (w.tick < t) {
    tick(w);
    if (save && w.tick % DAY_TICKS === 0 && !existsSync(join(save, dayName(w.tick / DAY_TICKS)))) writeState(join(save, dayName(w.tick / DAY_TICKS)), encodeState(w));
  }
  if (!o.quiet) console.error(`［${seed}］${from}${w.tick > fromTick ? ` → ${((w.tick - fromTick) / DAY_TICKS).toFixed(2)}日分進めた（${((Date.now() - t0) / 1000).toFixed(1)}秒）` : ''}`);
  return { w, from, fromTick };
}

export { snapDays };
