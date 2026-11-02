/**
 * 調べ物の道具（使い捨てのスクリプトの代わり）。途中の状態の保存庫（lib/open.ts）から始めるので、0日目から回し直さない。
 *
 *   npm run probe -- deaths --seed seed7 --kind 2 --cause starve --day 19
 *       19.0〜20.0日（20日目。刻みで 19×DAY_TICKS から 20×DAY_TICKS の手前まで）に飢え死にした大ネズミの、死ぬ直前の履歴（既定で1000刻みぶん）と、
 *       死んだときの様子の組み合わせの内訳。--from 19.5 --to 21 で範囲、--by 手を下した種、--examples 例の数、--keep 履歴の刻み数、
 *       --warm 範囲の始めより keep 刻み前から回す（範囲の始めのすぐ後に死んだものにも履歴が付く。1日ぶん余計にかかる）
 *   npm run probe -- life --seed abc --id 1234 [--from 5 --to 8]
 *       ある個体の一生（生まれた日を1日ごとの状態の番号から探す）。状態（st、逃げる・眠る・死ぬ。--act なら act も）が変わるたびに1行と、20刻みごとの細かい記録
 *   npm run probe -- calls --seed abc --method sendCollectors,collectTribute --from 10 --to 12 [--by-kind]
 *       メソッドの呼び出しの回数・かかった時間・戻り値の内訳（日ごと）。--by-kind は1つめの引数の種ごとに分ける
 *   npm run probe -- look --seed abc --at 18.5 --id 1234 [--r 12]   （または --xy 40,30）
 *       その刻みの、まわりの地形と生き物（字の地図と一覧）。--expr "e.camps.length" で式の値も出す（w 世界、e 生き物たち、m 地図、c --id の個体）
 *   npm run probe -- stuck --seed seed7 --from 10 --to 12 --kind 2
 *       動こうとして進めない場所の地図（stuck.png）と上位のマス（npm run stuckmap と同じもの、範囲つき）
 *
 * 共通：--run <回したフォルダ>（その回の状態を使う）、--base <git の参照>（いまの版の状態がないときに使う前の版。既定 HEAD）、
 * --pure（いまの版で最初から回した状態だけを使う。なければ回して保存庫に置く）、--adv-max、--out 書き出すファイル。
 * 日（--day, --from, --to, --at）は地上の日数（小数可）。どこから始めたか（どの版の何日目の状態か）を最初に表示する。
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DAY_TICKS, tick, World } from './lib/engine';
import { openAt, OpenOpts } from './lib/open';
import { readState } from './lib/state';
import { snapDir, snapsOf, SELF_SIM } from './lib/runs';
import { CAUSE_NAMES, KIND_NAMES, encodePng, parseArgs } from './common';
import { existsSync, readdirSync } from 'fs';

const T = 16;
const name = (k: number) => KIND_NAMES[k] ?? `種${k}`;
const dayOf = (t: number) => (t / DAY_TICKS).toFixed(3);

export async function main(argv: string[]) {
  const sub = argv[0] && !argv[0].startsWith('--') ? argv.shift()! : 'help';
  const a = parseArgs(argv);
  const seed = a.seed || 'かしたれ';
  const o: OpenOpts = { run: a.run, base: a.base, pure: !!a.pure, adv: a['adv-max'] !== undefined ? +a['adv-max'] : undefined };
  const t0 = Date.now();
  if (sub === 'deaths') await deaths(seed, a, o);
  else if (sub === 'life') await life(seed, a, o);
  else if (sub === 'calls') await calls(seed, a, o);
  else if (sub === 'look') await look(seed, a, o);
  else if (sub === 'stuck') await stuck(seed, a, o);
  else {
    console.log('使い方：npm run probe -- deaths|life|calls|look|stuck --seed <シード> ...（tools/analysis/probe.ts の先頭を見る）');
    return;
  }
  console.error(`（${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
}

/** 生き物の1行（履歴と一覧に使う） */
function line(w: World, c: any): string {
  const e = w.eco as any;
  const m = w.map;
  const k = Math.floor(c.y / T) * m.w + Math.floor(c.x / T);
  const tr = c.ref > 0 && c.k === 2 ? c.ref - 1 : -1;
  const p = e.paths?.get?.(c.id);
  return `${dayOf(w.tick)} st${c.st} act${c.act} 食${c.food} 飢${c.hungry} 体${+c.hp.toFixed(1)} 位置 ${(c.x / T).toFixed(1)},${(c.y / T).toFixed(1)}${tr >= 0 ? ` 目当て ${tr % m.w},${Math.floor(tr / m.w)}（苔${w.moss[tr]} 茸${w.fungus[tr]}）` : ''}${c.hx || c.hy ? ` 住みかまで ${(Math.hypot(c.hx - c.x, c.hy - c.y) / T).toFixed(0)}` : ''}${p ? ` 道筋 ${p.path.length} 行き詰まり ${p.stall}` : ''}${c.flee > 0 ? ' 逃' : ''}${c.sleep > 0 ? ' 眠' : ''}${c.caught ? ' 捕' : ''}${c.away ? ' 外' : ''} 水${w.water[k]}`;
}

// ---------------- deaths ----------------

async function deaths(seed: string, a: Record<string, string>, o: OpenOpts) {
  const kind = a.kind !== undefined ? +a.kind : -1;
  const cause = a.cause;
  const byK = a.by !== undefined ? +a.by : undefined;
  const nEx = +(a.examples ?? 4);
  const from = a.day !== undefined ? +a.day : +(a.from ?? 0);
  const to = a.to !== undefined ? +a.to : a.day !== undefined ? +a.day + 1 : from + 1;
  const keep = +(a.keep ?? 1000);
  const every = +(a.every ?? 20);
  // 始まりは from の刻み（その日の状態から）。範囲の始めの keep 刻みの間に死んだものは履歴が短い（--warm で keep 刻み前から始める）
  const startT = Math.max(0, Math.round(from * DAY_TICKS) - (a.warm ? keep : 0));
  const { w } = await openAt(seed, startT, o);
  const e = w.eco as any;
  const m = w.map;
  const ring = new Map<number, string[]>();
  const sts = new Map<number, number[]>();
  const pos = new Map<number, [number, number, number][]>();
  const eats = (k: number) => k === 2 || k === 10 || k === 9 || k === 0 || k === 12;
  const foodDist = (c: any): number => {
    if (!eats(c.k)) return -2;
    const d: Int32Array = e.walkDist(e.tileOf(c.x, c.y), 60);
    let best = -1;
    for (let q = 0; q < d.length; q++) if (d[q] >= 0 && Math.max(w.moss[q], w.fungus[q]) >= 20 && (best < 0 || d[q] < best)) best = d[q];
    return best;
  };
  const bucket = (v: number, cuts: number[], labels: string[]) => {
    for (let i = 0; i < cuts.length; i++) if (v < cuts[i]) return labels[i];
    return labels[labels.length - 1];
  };
  const rows: { key: string; ex: string }[] = [];
  const hist = new Map<string, number>();
  const lo = from * DAY_TICKS;
  const orig = e.die.bind(e);
  e.die = (c: any, cs = '', by = -1) => {
    if (c.dead || !(kind < 0 || c.k === kind) || w.tick < lo) return orig(c, cs, by);
    const x0 = c.x;
    const y0 = c.y;
    const snap = { ...c };
    const nd = e.stats.deaths.length;
    const r = orig(c, cs, by);
    const rec = e.stats.deaths.length > nd ? e.stats.deaths[e.stats.deaths.length - 1] : null;
    if (!rec) return r;
    const cz = rec.cause;
    const cc = { ...snap, x: x0, y: y0 };
    if ((cause && cause !== cz) || (byK !== undefined && byK !== by)) return r;
    const tx = Math.floor(cc.x / T);
    const ty = Math.floor(cc.y / T);
    const k = ty * m.w + tx;
    let open = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && e.passable(cc, cc.x + dx * T, cc.y + dy * T)) open++;
    const P = pos.get(cc.id) ?? [];
    const old = P.find((p) => w.tick - p[2] <= 600) ?? null;
    const moved = old ? Math.hypot(cc.x - old[0], cc.y - old[1]) / T : -1;
    const home = cc.hx || cc.hy ? Math.hypot(cc.hx - cc.x, cc.hy - cc.y) / T : -1;
    const fd = foodDist(cc);
    const near = new Set<string>();
    e.nearby(cc.x, cc.y, 3, (q: any) => {
      if (q.id !== cc.id && !q.dead && Math.hypot(q.x - cc.x, q.y - cc.y) < 3 * T) near.add(name(q.k));
    });
    // 直前（keep 刻み）に多かった状態
    const S = sts.get(cc.id) ?? [];
    const cnt = new Map<number, number>();
    for (const s of S) cnt.set(s, (cnt.get(s) ?? 0) + 1);
    const mostSt = [...cnt].sort((p, q) => q[1] - p[1])[0];
    const under = m.lava[k] ? '溶岩' : w.water[k] > 40 ? '深い水' : m.sealed[k] ? '閉じた空洞' : '床';
    const key = [
      `死因:${CAUSE_NAMES[cz] ?? cz}${by >= 0 ? `（${name(by)}）` : ''}`,
      `st${cc.st}`,
      mostSt && S.length >= 5 ? `直前に多かった:st${mostSt[0]}（${Math.round((100 * mostSt[1]) / S.length)}％）` : '',
      cc.flee > 0 ? '逃げている' : cc.sleep > 0 ? '眠っている' : cc.caught ? '捕まっている' : '',
      `足もと:${under}`,
      open <= 1 ? '通れるマス≦1' : '',
      moved >= 0 && moved < 1 ? '止まっていた' : '',
      fd === -2 ? '' : `食べ物まで:${fd < 0 ? 'なし' : bucket(fd, [3, 10, 30], ['3マス未満', '10マス未満', '30マス未満', '30マス以上'])}`,
      home >= 0 ? `住みかまで:${bucket(home, [5, 15], ['5マス未満', '15マス未満', '15マス以上'])}` : '',
    ].filter(Boolean).join(' / ');
    hist.set(key, (hist.get(key) ?? 0) + 1);
    if (rows.filter((q) => q.key === key).length < 2) {
      const lines = ring.get(cc.id) ?? [];
      rows.push({ key, ex: [`#### ${name(cc.k)} ${cc.id}（${dayOf(w.tick)}日目、マス ${tx},${ty}）${w.tick - startT < keep ? `　※履歴は始まりからの ${w.tick - startT} 刻みだけ（--warm で前から）` : ''}`, '', key, '', '近くにいた：' + ([...near].join('、') || 'なし'), '', '```', ...lines, '```', ''].join('\n') });
    }
    return r;
  };
  const N = Math.ceil(keep / every);
  while (w.tick < to * DAY_TICKS) {
    tick(w);
    if (w.tick % every) continue;
    for (const c of e.list) {
      if (c.dead || (kind >= 0 && c.k !== kind)) continue;
      const r = ring.get(c.id) ?? [];
      ring.set(c.id, r);
      r.push(line(w, c));
      if (r.length > N) r.shift();
      const S = sts.get(c.id) ?? [];
      sts.set(c.id, S);
      S.push(c.st);
      if (S.length > N) S.shift();
      if (w.tick % 200 === 0) {
        const P = pos.get(c.id) ?? [];
        pos.set(c.id, P);
        P.push([c.x, c.y, w.tick]);
        if (P.length > 5) P.shift();
      }
    }
    // 死んだものの履歴は捨てる（覚える量を抑える）
    if (w.tick % 2000 === 0) for (const id of ring.keys()) if (!e.list.some((c: any) => c.id === id && !c.dead)) { ring.delete(id); sts.delete(id); pos.delete(id); }
  }
  const total = [...hist.values()].reduce((x, y) => x + y, 0);
  const L: string[] = [
    `# 死んだときの様子：${seed}、${from}〜${to}日目、${kind >= 0 ? name(kind) : 'すべての種'}${cause ? `、死因 ${CAUSE_NAMES[cause] ?? cause}` : ''}${byK !== undefined ? `、手を下した種 ${name(byK)}` : ''}`,
    '',
    `全${total}件。履歴は死ぬ前の ${keep} 刻み（${every}刻みごと）。「直前に多かった」はその間にいちばん多かった状態。「止まっていた」は直前の地上の約1分で1マスも動いていないこと。食べ物までの道のりは、食べられる苔かキノコ（20以上）までの歩いた距離（60マスまで）。`,
    '',
    '| 件数 | 割合 | 様子 |',
    '|---:|---:|---|',
    ...[...hist].sort((x, y) => y[1] - x[1]).map(([k, n]) => `| ${n} | ${((100 * n) / Math.max(1, total)).toFixed(0)}％ | ${k} |`),
    '',
    '## 例（死ぬ直前の履歴）',
    '',
    ...[...hist].sort((x, y) => y[1] - x[1]).slice(0, nEx).flatMap(([k]) => rows.filter((r) => r.key === k).map((r) => r.ex)),
  ];
  const out = a.out || `runs/probe-deaths-${seed}-${kind >= 0 ? kind : 'all'}-${from}.md`;
  writeFileSync(out, L.join('\n'));
  const first = rows[0];
  console.log(L.slice(0, 8 + Math.min(12, hist.size)).join('\n'));
  if (first) console.log('\n' + first.ex.split('\n').slice(0, 6).join('\n') + '\n```\n' + first.ex.split('```')[1].trim().split('\n').slice(-12).join('\n') + '\n```');
  console.log(`\n書き出した：${out}`);
}

// ---------------- life ----------------

/** 生き物の番号から、生まれた日（その番号がまだ使われていない、いちばん遅い日の状態）を探す */
function bornDay(seed: string, id: number, o: OpenOpts): number {
  const dirs = [o.run ? snapsOf(o.run) : '', snapDir(SELF_SIM, o.adv ?? 1, seed)].filter((d) => d && existsSync(d));
  for (const d of dirs) {
    const days = readdirSync(d).map((f) => /^d(\d+)\.json\.gz$/.exec(f)).filter(Boolean).map((x) => +x![1]).sort((p, q) => p - q);
    let best = 0;
    for (const day of days) {
      const s = readState(join(d, `d${String(day).padStart(3, '0')}.json.gz`));
      if ((s.eco as any).n > id) return best;
      best = day;
    }
  }
  return -1;
}

async function life(seed: string, a: Record<string, string>, o: OpenOpts) {
  const id = +a.id;
  let from = a.from !== undefined ? +a.from : bornDay(seed, id, o);
  if (from < 0) throw new Error(`生まれた日がわからない：--from で、${id} がいる日を指定してください`);
  const every = +(a.every ?? 20);
  const { w } = await openAt(seed, Math.round(from * DAY_TICKS), o);
  const e = w.eco as any;
  const to = a.to !== undefined ? +a.to : from + 30;
  const L: string[] = [];
  const changes: string[] = [];
  let last = '';
  let seen = false;
  let sinceT = w.tick;
  while (w.tick < to * DAY_TICKS) {
    tick(w);
    const c = e.list.find((q: any) => q.id === id);
    if (!c) {
      if (seen) break;
      continue;
    }
    if (!seen) {
      seen = true;
      changes.push(`${dayOf(w.tick)} 現れた：${name(c.k)}${c.elite ? `（特別な個体 ${c.elite}）` : ''} 位置 ${(c.x / T).toFixed(1)},${(c.y / T).toFixed(1)}`);
    }
    const sig = `st${c.st}${a.act ? ` act${c.act}` : ''}${c.flee > 0 ? ' 逃' : ''}${c.sleep > 0 ? ' 眠' : ''}${c.dead ? ` 死${c.dead}` : ''}`;
    if (sig !== last) {
      changes.push(`${dayOf(w.tick)}（前の状態は地上の${((w.tick - sinceT) / 10).toFixed(0)}秒）${sig}　${line(w, c)}`);
      last = sig;
      sinceT = w.tick;
    }
    if (w.tick % every === 0) L.push(line(w, c));
    if (c.dead) {
      const d = e.stats.deaths.filter((x: any) => Math.abs(x.t - w.tick) < 3 && x.k === c.k);
      changes.push(`${dayOf(w.tick)} 死んだ：${d.map((x: any) => `${CAUSE_NAMES[x.cause] ?? x.cause}${x.by >= 0 ? `（${name(x.by)}）` : ''}`).join('、') || '—'}`);
      break;
    }
    if (c.away && w.tick % 600 === 0) { /* 外にいる */ }
  }
  if (!seen) throw new Error(`${id} が ${from}〜${to}日目に見つからない`);
  const out = a.out || `runs/probe-life-${seed}-${id}.md`;
  writeFileSync(out, [`# ${seed} の生き物 ${id} の一生`, '', '## 状態が変わったとき', '', '```', ...changes, '```', '', `## ${every}刻みごと`, '', '```', ...L, '```'].join('\n'));
  console.log(changes.slice(0, 60).join('\n') + (changes.length > 60 ? `\n…（ほか ${changes.length - 60} 行）` : ''));
  console.log(`\n書き出した：${out}`);
}

// ---------------- calls ----------------

async function calls(seed: string, a: Record<string, string>, o: OpenOpts) {
  const from = +(a.from ?? 0);
  const to = +(a.to ?? from + 1);
  const { w } = await openAt(seed, Math.round(from * DAY_TICKS), o);
  const e = w.eco as any;
  const methods = (a.method || '').split(',').filter(Boolean);
  if (!methods.length) throw new Error('--method 名前[,名前...] を指定してください（Ecology か World のメソッド）');
  const stat = new Map<string, { n: number; ms: number; ret: Map<string, number>; perDay: Map<number, number> }>();
  const summ = (v: unknown): string => {
    if (v === undefined) return 'undefined';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return `配列(${v.length})`;
    const r = v as any;
    if (typeof r.k === 'number' && typeof r.id === 'number') return `${name(r.k)}`;
    return '{' + Object.keys(r).slice(0, 4).join(',') + '}';
  };
  for (const mth of methods) {
    const obj = typeof e[mth] === 'function' ? e : typeof (w as any)[mth] === 'function' ? w : null;
    if (!obj) throw new Error(`メソッドがない：${mth}`);
    const f = obj[mth];
    obj[mth] = function (this: unknown, ...args: unknown[]) {
      const t = performance.now();
      const r = f.apply(this, args);
      const dt = performance.now() - t;
      if (w.tick < from * DAY_TICKS) return r;
      const key = a['by-kind'] && args[0] && typeof (args[0] as any).k === 'number' ? `${mth}［${name((args[0] as any).k)}］` : mth;
      const s = stat.get(key) ?? { n: 0, ms: 0, ret: new Map(), perDay: new Map() };
      stat.set(key, s);
      s.n++;
      s.ms += dt;
      const rv = summ(r);
      s.ret.set(rv, (s.ret.get(rv) ?? 0) + 1);
      const d = Math.floor(w.tick / DAY_TICKS);
      s.perDay.set(d, (s.perDay.get(d) ?? 0) + 1);
      return r;
    };
  }
  while (w.tick < to * DAY_TICKS) tick(w);
  const L = [`# 呼び出しの数：${seed}、${from}〜${to}日目`, ''];
  for (const [k, s] of [...stat].sort((p, q) => q[1].n - p[1].n)) {
    L.push(`## ${k}：${s.n}回、${s.ms.toFixed(0)}ミリ秒`, '', '| 戻り値 | 回数 |', '|---|---:|', ...[...s.ret].sort((p, q) => q[1] - p[1]).slice(0, 15).map(([v, n]) => `| ${v.slice(0, 80)} | ${n} |`), '', `日ごと：${[...s.perDay].map(([d, n]) => `${d}日目 ${n}`).join('、')}`, '');
  }
  if (!stat.size) L.push('（呼ばれなかった）');
  console.log(L.join('\n'));
  if (a.out) writeFileSync(a.out, L.join('\n'));
}

// ---------------- look ----------------

async function look(seed: string, a: Record<string, string>, o: OpenOpts) {
  const at = +(a.at ?? 1);
  const { w } = await openAt(seed, Math.round(at * DAY_TICKS), o);
  const e = w.eco as any;
  const m = w.map;
  const R = +(a.r ?? 12);
  const c0 = a.id ? e.list.find((c: any) => c.id === +a.id) : null;
  if (a.id && !c0) console.log(`（${a.id} はこの刻みにはいない）`);
  const [cx, cy] = c0 ? [Math.floor(c0.x / T), Math.floor(c0.y / T)] : (a.xy || `${m.entrance.x},2`).split(',').map(Number);
  const marks = new Map<number, string>();
  const near = e.list.filter((c: any) => c.dead !== 2 && Math.abs(c.x / T - cx) <= R && Math.abs(c.y / T - cy) <= R).sort((p: any, q: any) => Math.hypot(p.x / T - cx, p.y / T - cy) - Math.hypot(q.x / T - cx, q.y / T - cy));
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const legend: string[] = [];
  near.forEach((c: any, i: number) => {
    const ch = i < letters.length ? letters[i] : '*';
    const k = Math.floor(c.y / T) * m.w + Math.floor(c.x / T);
    if (!marks.has(k) || c === c0) marks.set(k, c === c0 ? '@' : ch);
    legend.push(`${c === c0 ? '@' : ch} ${name(c.k)} ${c.id}${c.dead ? '（死骸）' : ''}${c.elite ? ` 特別${c.elite}` : ''}  ${line(w, c)}`);
  });
  const rows: string[] = [];
  for (let y = cy - R; y <= cy + R; y++) {
    let s = '';
    for (let x = cx - R; x <= cx + R; x++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) { s += ' '; continue; }
      const k = y * m.w + x;
      s += marks.get(k) ?? (m.rubble[k] ? 'r' : m.solid[k] ? '#' : m.lava[k] ? '^' : m.sealed[k] ? '%' : w.water[k] > 40 ? '~' : w.water[k] > 0 ? ',' : w.fungus[k] >= 20 ? 'f' : w.moss[k] >= 20 ? 'm' : m.paved?.[k] ? '=' : '.');
    }
    rows.push(s);
  }
  const settle: string[] = [];
  const inR = (x: number, y: number) => Math.abs(x / T - cx) <= R + 4 && Math.abs(y / T - cy) <= R + 4;
  for (const b of e.burrows ?? []) if (inR(b.x, b.y)) settle.push(`巣穴 ${(b.x / T).toFixed(0)},${(b.y / T).toFixed(0)}`);
  for (const v of e.warrens ?? []) if (inR(v.x, v.y)) settle.push(`コボルトの住処 ${v.id} ${(v.x / T).toFixed(0)},${(v.y / T).toFixed(0)} 蓄え ${v.store ?? 0} 隠れ ${v.hide ?? 0} 襲われ ${v.raids ?? 0}`);
  for (const v of e.camps ?? []) if (inR(v.x, v.y)) settle.push(`${v.kind === 0 ? 'ゴブリンの集落' : 'リザードマンの村'} ${v.id} ${(v.x / T).toFixed(0)},${(v.y / T).toFixed(0)} 蓄え ${v.store ?? 0} 隠れ ${v.hide ?? 0} 襲われ ${v.raids ?? 0}${v.lx || v.ly ? ` 従う先 ${(v.lx / T).toFixed(0)},${(v.ly / T).toFixed(0)}` : ''}`);
  const L = [
    `# ${seed}、${dayOf(w.tick)}日目、マス ${cx},${cy} のまわり ${R} マス`,
    '',
    '# 岩　. 床　~ 深い水　, 浅い水　^ 溶岩　% 閉じた空洞　r 瓦礫　m 苔（20以上）　f キノコ（20以上）　= 石畳　@ 見ている個体　英字・数字 生き物（下の一覧）',
    '',
    '```', ...rows, '```', '',
    ...(settle.length ? ['住みついた群れ：' + settle.join('、'), ''] : []),
    '```', ...legend, '```',
  ];
  if (a.expr) {
    const f = new Function('w', 'e', 'm', 'c', `return (${a.expr});`);
    let v: unknown;
    try { v = f(w, e, m, c0); } catch (err) { v = `（式の誤り：${(err as Error).message}）`; }
    L.push('', `式 ${a.expr} の値：`, '```', JSON.stringify(v)?.slice(0, 4000) ?? String(v), '```');
  }
  console.log(L.join('\n'));
  if (a.out) writeFileSync(a.out, L.join('\n'));
}

// ---------------- stuck ----------------

async function stuck(seed: string, a: Record<string, string>, o: OpenOpts) {
  const from = +(a.from ?? 0);
  const to = +(a.to ?? (a.days ? +a.days : from + 2));
  const { w } = await openAt(seed, Math.round(from * DAY_TICKS), o);
  const e = w.eco as any;
  const m = w.map;
  const kind = a.kind !== undefined ? +a.kind : -1;
  const out = a.out || `runs/stuckmap-${m.seed}-${kind >= 0 ? kind : 'all'}`;
  mkdirSync(out, { recursive: true });
  const N = m.w * m.h;
  const heat = new Float32Array(N);
  const crowd = new Float32Array(N);
  const who = new Map<number, Map<string, number>>();
  const hist = new Map<number, [number, number][]>();
  let total = 0;
  while (w.tick < to * DAY_TICKS) {
    tick(w);
    if (w.tick % 20) continue;
    for (const c of e.list) {
      if (c.dead || c.away || (kind >= 0 && c.k !== kind)) continue;
      const H = hist.get(c.id) ?? [];
      hist.set(c.id, H);
      H.push([c.x, c.y]);
      if (H.length > 11) H.shift();
      if (c.act !== 1 || H.length < 11) continue;
      const [ox, oy] = H[0];
      if (Math.hypot(c.x - ox, c.y - oy) >= T / 2) continue;
      const k = Math.floor(c.y / T) * m.w + Math.floor(c.x / T);
      if (k < 0 || k >= N) continue;
      heat[k]++;
      total++;
      let n = 0;
      e.nearby(c.x, c.y, 3, (q: any) => {
        if (q !== c && !q.dead && Math.hypot(q.x - c.x, q.y - c.y) < 3 * T) n++;
      });
      crowd[k] += n;
      const mm = who.get(k) ?? new Map<string, number>();
      who.set(k, mm);
      const key = `${name(c.k)} st${c.st}`;
      mm.set(key, (mm.get(key) ?? 0) + 1);
    }
  }
  const S = 3;
  const img = new Uint8Array(m.w * S * m.h * S * 4);
  let mx = 1;
  for (let k = 0; k < N; k++) mx = Math.max(mx, heat[k]);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const k = y * m.w + x;
      let c = [12, 10, 16];
      if (m.rubble[k]) c = [80, 68, 56];
      else if (!m.solid[k]) c = m.lava[k] ? [170, 60, 20] : w.water[k] > 40 ? [40, 70, 110] : m.sealed[k] ? [24, 42, 46] : [70, 68, 80];
      if (heat[k] > 0) {
        const v = Math.min(1, Math.sqrt(heat[k] / mx));
        c = [255, Math.round(230 * (1 - v)), 40];
      }
      for (let yy = 0; yy < S; yy++)
        for (let xx = 0; xx < S; xx++) {
          const p = ((y * S + yy) * m.w * S + x * S + xx) * 4;
          img[p] = c[0];
          img[p + 1] = c[1];
          img[p + 2] = c[2];
          img[p + 3] = 255;
        }
    }
  writeFileSync(join(out, 'stuck.png'), encodePng(m.w * S, m.h * S, img));
  const cell = (q: number) => (q < 0 || q >= N ? '#' : m.solid[q] ? '#' : m.lava[q] ? '火' : w.water[q] > 40 ? '~' : '.');
  const top = [...heat.keys()].filter((k) => heat[k] > 0).sort((p, q) => heat[q] - heat[p]).slice(0, 20);
  const L = [
    `# 足止めの地図：${m.seed}、${from}〜${to}日目、${kind >= 0 ? name(kind) : 'すべての種'}`,
    '',
    `動こうとして（act 1）地上の20秒進めなかった回数（20刻みごとに数える）：全${total}回。地図は stuck.png（黄→赤ほど多い）。`,
    '',
    '| マス | 回数 | 上・右・下・左（自分） | 混み具合（平均） | 多い種と状態 |',
    '|---|---:|---|---:|---|',
    ...top.map((k) => {
      const x = k % m.w;
      const y = Math.floor(k / m.w);
      const nb = [k - m.w, k + 1, k + m.w, k - 1].map(cell).join('') + `（${cell(k)}）`;
      const ws = [...(who.get(k) ?? new Map())].sort((p, q) => q[1] - p[1]).slice(0, 3).map(([s, n]) => `${s} ${n}`).join('、');
      return `| ${x},${y} | ${heat[k]} | ${nb} | ${(crowd[k] / heat[k]).toFixed(1)} | ${ws} |`;
    }),
  ];
  writeFileSync(join(out, 'stuck.md'), L.join('\n'));
  console.log(L.join('\n'));
  console.log(`\n書き出した：${out}/stuck.png、${out}/stuck.md`);
}

if (/probe(-[0-9a-f]+)?\.js$/.test(process.argv[1] ?? "")) main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
