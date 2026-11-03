/**
 * 画面なしでシミュレーションを全速で実行し、分析用のログを書き出す。
 *
 *   npm run sim -- --seed かしたれ --days 30 --out runs/kashitare
 *   npm run sim -- --resume runs/kashitare            （中断した所から再開する）
 *   npm run sim -- --seed abc --days 10 --trace 1234   （生き物 1234 の一生を毎 tick ログに残す）
 *
 * --budget 秒（既定 270）を超えそうになると、区切りのよい所でチェックポイントを書き出して止まる。
 * もう一度 --resume で同じフォルダを指定すれば再開する（決定的なので、分けて実行しても結果は同じ）。
 *
 * 書き出すもの（--out のフォルダ）：
 *   meta.json        シード、目標の日数、現在の tick、バージョンの系譜（lineage：どのバージョンのシミュレーションがどの tick から実行したか）
 *   samples.jsonl    ゲーム内の 1/4 日ごとの数値（tick が DAY_TICKS/4 の倍数のとき。再開しても同じ tick で記録する）
 *   deaths.jsonl     死んだ生き物（tick、種、死因、手を下した種、場所）
 *   births.jsonl     現れた生き物（tick、種、由来、場所）
 *   exits.jsonl      外へ出ていった生き物
 *   moves.jsonl      群れの引っ越し（大ネズミの巣穴）
 *   settle.jsonl     住みつく群れの出来事（コボルトの住処とゴブリンの集落を作った・捨てた・消えた、従えた、取り立て）
 *   events.jsonl     ゲーム内ログ（画面の「記録」）に出る出来事
 *   trace.jsonl      --trace で指定した生き物の毎 tick の状態
 *   stuck.jsonl      足踏み：起きて歩く姿のまま、ゲーム内の2分（1200 tick）以上ほぼ同じ場所（12px 以内）にいた生き物（そうなった時点で1回記録）
 *   snap/dNNN.json.gz 日次スナップショット（ゲームのセーブと同じ形。調査と、後から値を計算するのに使う）
 *   checkpoint.json  再開するためのチェックポイント（ゲームのセーブと同じ形）
 * 0日目から一つのバージョンだけで実行したもの（pure）は、日次スナップショットを runs/.cache/snap/<バージョン>/ にも置く（probe などが再利用する）。
 * レポートと画像は npm run report -- --run <フォルダ> で作る。
 */
import { appendFileSync, existsSync, linkSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'fs';
import { join } from 'path';
import { DAY_TICKS, Ecology, World, tick } from './lib/engine';
import { decodeState, encodeState, readState, writeState } from './lib/state';
import { dayName, SELF_BIN, SELF_SIM, snapDir } from './lib/runs';
import { parseArgs } from './common';

const args = parseArgs(process.argv.slice(2));
const out = args.resume || args.out || `runs/${args.seed || 'かしたれ'}`;
mkdirSync(join(out, 'snap'), { recursive: true });
const budget = +(args.budget || 270) * 1000;
const started = Date.now();

let w: World;
let meta: { seed: string; days: number; tick: number; total0: number; gold0: number; trace: number; advMax?: number; lineage?: { sim: string; from: number }[]; bin?: string; secs?: number; secTicks?: number };
if (args.resume && existsSync(join(out, 'checkpoint.json'))) {
  meta = JSON.parse(readFileSync(join(out, 'meta.json'), 'utf8'));
  if (args.days) meta.days = +args.days;
  // 冒険者の一行の数の上限（分析用の切り替え）は、再開するときも同じにする
  if (meta.advMax !== undefined) Ecology.ADV_MAX_PARTIES = meta.advMax;
  w = decodeState(readState(join(out, 'checkpoint.json')));
  // バージョンの系譜：別のバージョンのチェックポイントから続けるときは、その tick から先はこのバージョン
  meta.lineage ??= [{ sim: '?', from: 0 }];
  if (meta.lineage[meta.lineage.length - 1].sim !== SELF_SIM) meta.lineage.push({ sim: SELF_SIM, from: w.tick });
  console.log(`再開：${(w.tick / DAY_TICKS).toFixed(2)}日目`);
} else {
  const seed = args.seed || 'かしたれ';
  if (args['adv-max'] !== undefined) Ecology.ADV_MAX_PARTIES = +args['adv-max'];
  w = new World(seed);
  meta = { seed, days: +(args.days || 10), tick: 0, total0: 0, gold0: 0, trace: +(args.trace || 0), advMax: Ecology.ADV_MAX_PARTIES, lineage: [{ sim: SELF_SIM, from: 0 }] };
  meta.total0 = w.totalNutrients();
  meta.gold0 = w.eco.totalGold();
  for (const f of ['samples', 'deaths', 'births', 'exits', 'moves', 'settle', 'events', 'trace', 'stuck']) writeFileSync(join(out, `${f}.jsonl`), '');
  console.log(`新しく：シード「${seed}」を ${meta.days} 日`);
}
meta.bin = SELF_BIN;
/** 0日目から一つのバージョンだけで実行したもの（日次スナップショットをバージョンごとのキャッシュにも置く） */
const pure = meta.lineage!.length === 1 && meta.lineage![0].sim === SELF_SIM && SELF_SIM !== '?';
const shared = pure ? snapDir(SELF_SIM, meta.advMax ?? Ecology.ADV_MAX_PARTIES, meta.seed) : '';
if (shared) mkdirSync(shared, { recursive: true });
function snapshot(txt: string, day: number) {
  const p = join(out, 'snap', dayName(day));
  writeState(p, txt);
  if (shared && !existsSync(join(shared, dayName(day)))) {
    try {
      linkSync(p, join(shared, dayName(day)));
    } catch {
      try { cpSync(p, join(shared, dayName(day))); } catch { /* 置けなくても続ける */ }
    }
  }
}

const append = (f: string, rows: unknown[]) => {
  if (rows.length) appendFileSync(join(out, `${f}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
};
let lastEventT = -1;
{
  const ev = w.eco.events;
  if (ev.length) lastEventT = ev[ev.length - 1].t;
  if (existsSync(join(out, 'events.jsonl'))) {
    const lines = readFileSync(join(out, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length) lastEventT = JSON.parse(lines[lines.length - 1]).t;
  }
}

/**
 * シードの豊かさ：開いた地表の横穴から歩いて行ける範囲（道のり100マス）の床1マスあたりの、食べられる苔とキノコ
 * （20以上の群落の、根元12を除いた分）。口が開いていなければ null
 */
function richness(): number | null {
  const e = w.eco as any;
  const m = w.map;
  const seen = new Uint8Array(m.w * m.h);
  let any = false;
  for (let i = 0; i < m.mouths.length; i++) {
    if (m.mouths[i].kind !== 0 || !e.mouthOpen(i)) continue;
    const [x, y] = e.mouthSpot(i);
    const d: Int32Array = e.walkDist(e.tileOf(x, y), 100);
    for (let k = 0; k < d.length; k++) if (d[k] >= 0) seen[k] = 1;
    any = true;
  }
  if (!any) return null;
  let n = 0;
  let f = 0;
  for (let k = 0; k < seen.length; k++) {
    if (!seen[k]) continue;
    n++;
    const v = Math.max(w.moss[k], w.fungus[k]);
    if (v >= 20) f += v - 12;
  }
  return n ? +(f / n).toFixed(2) : null;
}

/**
 * 足踏みを見つける：20 tick ごとに、生きている生き物が最初に見た位置から 12px 以上離れたかを見て、離れなかったまま 1200 tick たったら、
 * その間の半分以上で歩く姿（act 1）、眠りが半分未満なら記録する。壁に押しつけて歩き続ける、たどり着けない席へ向かい続けるなど、画面で引っかかって見える場面。
 * 読むだけで展開は変えない。状態はセーブしないので、再開した直後の 1200 tick は数え始めからやり直す
 */
const STUCK_T = 1200;
const still = new Map<number, { x: number; y: number; t0: number; n: number; walk: number; sleep: number; miss: number; done: boolean }>();
function watchStuck(): unknown[] {
  const e = w.eco;
  const rows: unknown[] = [];
  const seen = new Set<number>();
  for (const c of e.list) {
    if (c.dead || c.away) continue;
    seen.add(c.id);
    let r = still.get(c.id);
    if (!r || (c.x - r.x) ** 2 + (c.y - r.y) ** 2 > 144) {
      r = { x: c.x, y: c.y, t0: w.tick, n: 0, walk: 0, sleep: 0, miss: 0, done: false };
      still.set(c.id, r);
    }
    r.n++;
    if (c.act === 1) r.walk++;
    if (c.sleep > 0) r.sleep++;
    // 道が見つからないまま歩いているか（道筋の記録に miss が無い古いバージョンでは、空の道筋で見る）
    const pp = e.paths.get(c.id) as { path: number[]; miss?: number } | undefined;
    if (pp && (pp.miss ?? (pp.path.length === 0 ? 1 : 0)) > 0) r.miss++;
    if (!r.done && w.tick - r.t0 >= STUCK_T) {
      r.done = true;
      if (r.walk * 2 >= r.n && r.sleep * 2 < r.n) rows.push({ t: w.tick, k: c.k, id: c.id, st: c.st, x: Math.round(c.x), y: Math.round(c.y), nopath: +(r.miss / r.n).toFixed(2) });
    }
  }
  for (const id of still.keys()) if (!seen.has(id)) still.delete(id);
  return rows;
}

function sample() {
  const e = w.eco;
  const m = w.map;
  const counts: Record<number, number> = {};
  let corpses = 0;
  for (const c of e.list) {
    if (c.dead === 0) counts[c.k] = (counts[c.k] ?? 0) + 1;
    else if (c.dead === 1) corpses++;
  }
  let open = 0;
  let rubble = 0;
  for (let k = 0; k < m.solid.length; k++) {
    if (m.rubble[k]) rubble++;
    else if (!m.solid[k] && !m.sealed[k] && !m.lava[k]) open++;
  }
  const total = w.totalNutrients();
  return {
    t: w.tick,
    day: +(w.tick / DAY_TICKS).toFixed(3),
    counts,
    corpses,
    open,
    rubble,
    available: w.availableNutrients(),
    total,
    nutrientDrift: total - meta.total0 - e.imported + e.exported - w.born + w.washed,
    mana: w.soilMana(),
    manaHeld: e.heldMana(),
    manaDrift: w.totalMana() - w.manaBorn + w.manaLeaked + w.manaFaded,
    gold: e.totalGold(),
    goldDrift: e.totalGold() - meta.gold0 - e.goldIn + e.goldOut,
    rockDrift: w.rockLedger() - w.initialRock,
    rumors: +e.reputation().toFixed(2),
    parties: e.parties.length,
    lore: e.lore.explored.length,
    hold: e.hold ? e.hold.stage : -1,
    // 比較の表（batch）のため：口が開いているか、住みついた群れ、生きている竜の育ち、特別な個体（読むだけ。展開は変えない）
    mouths: m.mouths.map((_, i) => (e.mouthOpen(i) ? 1 : 0)),
    settle: {
      burrow: e.burrows.map((b) => `${b.x},${b.y}`),
      warren: e.warrens.map((v) => v.id),
      colony: e.colonies.map((v) => v.id),
      camp: e.camps.filter((v) => v.kind === 0).map((v) => v.id),
      campStore: e.camps.filter((v) => v.kind === 0 && v.id >= 0).map((v) => v.store ?? 0),
      village: e.camps.filter((v) => v.kind === 1).map((v) => v.id),
      orc: [...new Set(e.list.filter((c) => c.k === 13 && !c.dead && (c.hx || c.hy)).map((c) => `${c.hx},${c.hy}`))],
    },
    dragons: e.list.filter((c) => c.k === 24 && !c.dead).map((c) => c.sp),
    elites: e.list.filter((c) => c.elite && !c.dead).map((c) => [c.id, c.elite]),
    rich: richness(),
  };
}

const startTick = w.tick;
const target = meta.days * DAY_TICKS;
const Q = DAY_TICKS / 4;
let stopped = false;
const stuckRows: unknown[] = [];
while (w.tick < target) {
  const traceId = meta.trace;
  // ゲーム内の 1/4 日の区切り（tick が Q の倍数）まで進める。再開しても同じ区切りで記録する
  const until = Math.min(target, (Math.floor(w.tick / Q) + 1) * Q);
  while (w.tick < until) {
    tick(w);
    if (w.tick % 20 === 0) stuckRows.push(...watchStuck());
    if (traceId) {
      const c = w.eco.list.find((o) => o.id === traceId);
      if (c && w.tick % 2 === 0) append('trace', [{ t: w.tick, k: c.k, x: +c.x.toFixed(1), y: +c.y.toFixed(1), act: c.act, st: c.st, hp: +c.hp.toFixed(1), food: c.food, flee: c.flee, dead: c.dead }]);
    }
  }
  const st = w.eco.stats;
  append('deaths', st.deaths.splice(0));
  append('births', st.births.splice(0));
  append('exits', st.exits.splice(0));
  append('moves', st.moves.splice(0));
  append('settle', st.settle.splice(0));
  append('events', w.eco.events.filter((ev) => ev.t > lastEventT));
  if (w.eco.events.length) lastEventT = Math.max(lastEventT, w.eco.events[w.eco.events.length - 1].t);
  append('stuck', stuckRows.splice(0));
  append('samples', [sample()]);
  if (w.tick % DAY_TICKS === 0) snapshot(JSON.stringify(encodeState(w)), w.tick / DAY_TICKS);
  process.stdout.write(`\r${(w.tick / DAY_TICKS).toFixed(2)}日目  生き物${w.eco.list.filter((c) => !c.dead).length}  ${((Date.now() - started) / 1000).toFixed(0)}秒   `);
  if (Date.now() - started > budget) {
    stopped = true;
    break;
  }
}
meta.secs = (meta.secs ?? 0) + (Date.now() - started) / 1000;
meta.secTicks = (meta.secTicks ?? 0) + w.tick - startTick;
meta.tick = w.tick;
writeState(join(out, 'checkpoint.json'), encodeState(w));
writeFileSync(join(out, 'meta.json'), JSON.stringify(meta, null, 1));
console.log(stopped ? `\n時間切れが近いので ${(w.tick / DAY_TICKS).toFixed(2)} 日目で止めました。続きは：npm run sim -- --resume ${out}` : `\n${meta.days} 日まで実行しました。レポートは：npm run report -- --run ${out}`);
