/**
 * 死んだときの様子を集める（「なぜ死んだか」を調べるための使い捨てスクリプトの代わり）。
 *
 *   npm run autopsy -- --seed seed7 --days 25 --kind 2 --cause starve
 *   npm run autopsy -- --seed かしたれ --days 15 --kind 10 --by 25 --examples 5
 *   npm run autopsy -- --seed abc --days 20 --kind 2 --cause starve --from runs/x   （runs/x の checkpoint から続けて回す）
 *
 * --kind 種の番号（names.ts）、--cause 死因（starve, eaten, fight など。省くとすべて）、--by 手を下した種、
 * --examples 直前の様子を書き出す例の数（既定 4）、--out 書き出すファイル（既定 runs/autopsy-<シード>-<種>.md）。
 *
 * 死ぬたびに次を記録し、組み合わせごとの数（内訳の表）と、例ごとの死ぬ直前の様子（地上の時間で約2分ぶん）を書き出す：
 *   状態（st、act）、腹（food、hungry）、逃げている・眠っている・捕まっている、
 *   足もと（深い水、溶岩、閉じた空洞）、まわり8マスで通れるマスの数、
 *   直前の地上の約1分で動いた距離（止まっていたか）、住みか（hx, hy）までの距離、
 *   食べられる苔・キノコ（20以上）までの道のり（大ネズミ・コボルトなど草食・雑食のとき）、
 *   近く（3マス）にいた生き物の種
 * 種ごとの事情は見ない共通の項目だけなので、気になる組み合わせを見つけたら --examples で一生の終わりを追う。
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DAY_TICKS, World } from '../../src/world';
import { CAUSE_NAMES, KIND_NAMES, parseArgs } from './common';

const a = parseArgs(process.argv.slice(2));
const kind = a.kind !== undefined ? +a.kind : -1;
const cause = a.cause;
const byK = a.by !== undefined ? +a.by : undefined;
const nEx = +(a.examples ?? 4);

const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));
let w: World;
if (a.from && existsSync(join(a.from, 'checkpoint.json'))) {
  const s = JSON.parse(readFileSync(join(a.from, 'checkpoint.json'), 'utf8'));
  w = new World(s.seed, { tick: s.tick, seen: new Uint8Array(s.n), water: new Int32Array(unb64(s.water).buffer), nutr: new Int32Array(unb64(s.nutr).buffer), moss: unb64(s.moss), fungus: unb64(s.fungus), burn: unb64(s.burn), ash: unb64(s.ash), mat: unb64(s.mat), born: s.born, washed: s.washed, mana: s.mana ? new Int32Array(unb64(s.mana).buffer) : undefined, manaBorn: s.manaBorn, manaLeaked: s.manaLeaked, manaFaded: s.manaFaded, digs: s.digs, eco: s.eco });
} else w = new World(a.seed || 'かしたれ');
const seed = w.map.seed;
const days = +(a.days || 15);
const e = w.eco as any;
const m = w.map;
const T = 16;
const name = (k: number) => KIND_NAMES[k] ?? `種${k}`;

// 直前の様子：20刻みごとに、対象の種の生き物の状態を覚えておく（最後の60件＝地上の約2分）
const ring = new Map<number, string[]>();
const pos = new Map<number, [number, number][]>();
const eats = (k: number) => k === 2 || k === 10 || k === 9 || k === 0 || k === 12;
function foodDist(c: any): number {
  if (!eats(c.k)) return -2;
  const d: Int32Array = e.walkDist(e.tileOf(c.x, c.y), 60);
  let best = -1;
  for (let q = 0; q < d.length; q++) if (d[q] >= 0 && Math.max(w.moss[q], w.fungus[q]) >= 20 && (best < 0 || d[q] < best)) best = d[q];
  return best;
}
const bucket = (v: number, cuts: number[], labels: string[]) => {
  for (let i = 0; i < cuts.length; i++) if (v < cuts[i]) return labels[i];
  return labels[labels.length - 1];
};
const rows: { key: string; ex: string }[] = [];
const hist = new Map<string, number>();
const orig = e.die.bind(e);
e.die = (c: any, cs = '', by = -1) => {
  if (!c.dead && (kind < 0 || c.k === kind)) {
    // die() は死因が空なら、腹を空かせていれば飢え、そうでなければ other とする（同じ扱い）
    const cz = cs || (c.hungry > 0 ? 'starve' : 'other');
    if ((!cause || cause === cz) && (byK === undefined || byK === by)) {
      const tx = Math.floor(c.x / T);
      const ty = Math.floor(c.y / T);
      const k = ty * m.w + tx;
      let open = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && e.passable(c, c.x + dx * T, c.y + dy * T)) open++;
      const P = pos.get(c.id) ?? [];
      const old = P.length >= 3 ? P[P.length - 3] : null;
      const moved = old ? Math.hypot(c.x - old[0], c.y - old[1]) / T : -1;
      const home = c.hx || c.hy ? Math.hypot(c.hx - c.x, c.hy - c.y) / T : -1;
      const fd = foodDist(c);
      const near = new Set<string>();
      e.nearby(c.x, c.y, 3, (o: any) => {
        if (o !== c && !o.dead && Math.hypot(o.x - c.x, o.y - c.y) < 3 * T) near.add(name(o.k));
      });
      const under = m.lava[k] ? '溶岩' : w.water[k] > 40 ? '深い水' : m.sealed[k] ? '閉じた空洞' : '床';
      const key = [
        `死因:${CAUSE_NAMES[cz] ?? cz}${by >= 0 ? `（${name(by)}）` : ''}`,
        `st${c.st}`,
        c.flee > 0 ? '逃げている' : c.sleep > 0 ? '眠っている' : c.caught ? '捕まっている' : '',
        `足もと:${under}`,
        open <= 1 ? '通れるマス≦1' : '',
        moved >= 0 && moved < 1 ? '止まっていた' : '',
        fd === -2 ? '' : `食べ物まで:${fd < 0 ? 'なし' : bucket(fd, [3, 10, 30], ['3マス未満', '10マス未満', '30マス未満', '30マス以上'])}`,
        home >= 0 ? `住みかまで:${bucket(home, [5, 15], ['5マス未満', '15マス未満', '15マス以上'])}` : '',
      ]
        .filter(Boolean)
        .join(' / ');
      hist.set(key, (hist.get(key) ?? 0) + 1);
      if (rows.filter((r) => r.key === key).length < 2) {
        const lines = (ring.get(c.id) ?? []).slice(-12);
        rows.push({
          key,
          ex: [`#### ${name(c.k)} ${c.id}（${(w.tick / DAY_TICKS).toFixed(2)}日目、マス ${tx},${ty}）`, '', `${key}`, '', '近くにいた：' + ([...near].join('、') || 'なし'), '', '```', ...lines, '```', ''].join('\n'),
        });
      }
    }
  }
  return orig(c, cs, by);
};

while (w.tick < days * DAY_TICKS) {
  w.step();
  if (w.tick % 20) continue;
  for (const c of e.list) {
    if (c.dead || (kind >= 0 && c.k !== kind)) continue;
    const r = ring.get(c.id) ?? [];
    ring.set(c.id, r);
    const t = c.ref > 0 && c.k === 2 ? c.ref - 1 : -1;
    const p = e.paths.get(c.id);
    r.push(`${(w.tick / DAY_TICKS).toFixed(3)} st${c.st} act${c.act} 食${c.food} 飢${c.hungry} 位置 ${(c.x / T).toFixed(1)},${(c.y / T).toFixed(1)}${t >= 0 ? ` 目当て ${t % m.w},${Math.floor(t / m.w)}（苔${w.moss[t]} 茸${w.fungus[t]}）` : ''}${p ? ` 道筋 ${p.path.length} 行き詰まり ${p.stall}` : ''}${c.flee > 0 ? ' 逃' : ''}${c.sleep > 0 ? ' 眠' : ''} 水${w.water[Math.floor(c.y / T) * m.w + Math.floor(c.x / T)]}`);
    if (r.length > 60) r.shift();
    const P = pos.get(c.id) ?? [];
    pos.set(c.id, P);
    if (w.tick % 200 === 0) {
      P.push([c.x, c.y]);
      if (P.length > 4) P.shift();
    }
  }
}

const total = [...hist.values()].reduce((x, y) => x + y, 0);
const L: string[] = [
  `# 死んだときの様子：${seed}、${days}日、${kind >= 0 ? name(kind) : 'すべての種'}${cause ? `、死因 ${CAUSE_NAMES[cause] ?? cause}` : ''}${byK !== undefined ? `、手を下した種 ${name(byK)}` : ''}`,
  '',
  `全${total}件。「止まっていた」は直前の地上の約1分で1マスも動いていないこと。食べ物までの道のりは、食べられる苔かキノコ（20以上）までの歩いた距離（60マスまで）。`,
  '',
  '| 件数 | 割合 | 様子 |',
  '|---:|---:|---|',
  ...[...hist].sort((x, y) => y[1] - x[1]).map(([k, n]) => `| ${n} | ${((100 * n) / Math.max(1, total)).toFixed(0)}％ | ${k} |`),
  '',
  '## 例（死ぬ直前の様子、20刻みごと）',
  '',
  // 多い組み合わせの順に、それぞれ2例まで（全部で --examples 組まで）
  ...[...hist].sort((x, y) => y[1] - x[1]).slice(0, nEx).flatMap(([k]) => rows.filter((r) => r.key === k).map((r) => r.ex)),
];
const out = a.out || `runs/autopsy-${seed}-${kind >= 0 ? kind : 'all'}.md`;
writeFileSync(out, L.join('\n'));
console.log(L.slice(0, 20 + Math.min(15, hist.size)).join('\n'));
console.log(`\n書き出した：${out}`);
