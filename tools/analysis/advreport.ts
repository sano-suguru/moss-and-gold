/**
 * 冒険者の目標と、ゴブリンの盗み・退治、竜退治、大ネズミの引っ越しの列を、二つの実行結果（ab の base と new など）で数えて A/B 比較する。
 *   npm run advreport -- --runs runs/ab-x/base,runs/ab-x/new [--out runs/x.md]
 * ログ（settle.jsonl・deaths.jsonl）だけを読む（再実行しない）。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAIRED_HEAD, PAIRED_NOTE, paired, pairedRow } from './lib/stats';
import { countMoments, momentTable } from './lib/moments';

const argv = process.argv.slice(2);
const opt = (k: string, d = '') => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const [A, B] = opt('runs').split(',');
const out = opt('out');
const K = { Rat: 2, Kobold: 10, Goblin: 12, Orc: 13, Worm: 22, Wyvern: 23, Dragon: 24, Adventurer: 25 };
const AIMS = ['探索', '宝探し', '竜退治', '大物狩り', 'アンデッド祓い', 'ゴブリン退治', '深部の探索'];

const read = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const seedsOf = (d: string) => readdirSync(d).filter((x) => existsSync(join(d, x, 'settle.jsonl'))).sort();

type M = Record<string, number>;
function measure(dir: string): M {
  const s = read(join(dir, 'settle.jsonl'));
  const de = read(join(dir, 'deaths.jsonl'));
  const m: M = {};
  const add = (k: string, v = 1) => (m[k] = (m[k] ?? 0) + v);
  const ev = (k: number, e: string) => s.filter((x) => x.k === k && x.ev === e);
  m.盗みに出た = ev(K.Goblin, 'raid').length;
  m['盗んだ（すべて）'] = ev(K.Goblin, 'rob').length;
  m['盗んだ（盗みに出た者）'] = ev(K.Goblin, 'rob').filter((x) => x.how === 'raid').length;
  m['盗んだ（灯りに潜んだ者）'] = ev(K.Goblin, 'rob').filter((x) => x.how !== 'raid').length;
  m.盗みが見つかった = ev(K.Goblin, 'spotted').length;
  m.盗んだ物を蓄えに入れた = ev(K.Goblin, 'loot').filter((x) => x.n > 0).length;
  const enter = ev(K.Adventurer, 'enter');
  const arrive = ev(K.Adventurer, 'arrive');
  const aim = ev(K.Adventurer, 'aim');
  const end = ev(K.Adventurer, 'end');
  for (let a = 0; a < AIMS.length; a++) {
    m[`一行：${AIMS[a]}`] = enter.filter((x) => x.how === a).length;
    if (a) {
      m[`着いた：${AIMS[a]}`] = new Set(arrive.filter((x) => x.how === a).map((x) => x.id)).size;
      m[`果たした：${AIMS[a]}`] = aim.filter((x) => x.how === a && x.reason === 1).length;
    }
    m[`全滅：${AIMS[a]}`] = end.filter((x) => x.how === a && x.reason === 'wiped').length;
  }
  m['竜退治：道を知って入った'] = enter.filter((x) => x.how === 2 && x.to === 1).length;
  m.竜の寝床への道を持ち帰った = ev(K.Adventurer, 'way').length;
  m['ゴブリン退治：松明で隠れた者を見つけた'] = ev(K.Adventurer, 'reveal').length;
  // ゴブリン退治の一行が目指した集落の終わり方（一行が入ってからゲーム内の1日以内）
  for (const h of enter.filter((x) => x.how === 5)) {
    const fin = s.find((x) => x.k === K.Goblin && x.id === h.n && (x.ev === 'abandon' || x.ev === 'empty') && x.t >= h.t && x.t < h.t + 14400);
    add(`退治された集落の終わり：${fin ? (fin.ev === 'empty' ? '皆いなくなった' : `捨てた（${fin.reason}）`) : '続いた'}`);
  }
  m.冒険者に倒されたゴブリン = de.filter((x) => x.k === K.Goblin && x.by === K.Adventurer).length;
  m.冒険者に倒されたドラゴン = de.filter((x) => x.k === K.Dragon && x.by === K.Adventurer).length;
  m['冒険者に倒されたワイバーン・ワーム'] = de.filter((x) => (x.k === K.Wyvern || x.k === K.Worm) && x.by === K.Adventurer).length;
  m.死んだ冒険者 = de.filter((x) => x.k === K.Adventurer).length;
  m['大ネズミの引っ越し（巣穴を移した）'] = read(join(dir, 'moves.jsonl')).filter((x) => x.k === K.Rat).length;
  m.大ネズミの引っ越しの列 = ev(K.Rat, 'march').length;
  // 三歩目：見張りのうとうと、盗みの噂、物資の置き場
  m.見張りがうとうとした = ev(K.Adventurer, 'doze').length;
  m['盗んだ（見張りがうとうと中）'] = ev(K.Goblin, 'rob').filter((x) => x.doze === 1).length;
  m['物資の置き場を残した（新しく）'] = ev(K.Adventurer, 'cache').filter((x) => !x.merged).length;
  m.物資の置き場に荷を足した = ev(K.Adventurer, 'cache').filter((x) => x.merged).length;
  m['置き場の入口からの道のり（最大、マス）'] = Math.max(0, ...ev(K.Adventurer, 'cache').map((x) => x.how ?? 0));
  m.置き場で補った食料 = ev(K.Adventurer, 'supply').reduce((a, x) => a + x.n, 0);
  m['置き場をあさった大ネズミ（回）'] = ev(K.Rat, 'cache').length;
  m.列で歩いた大ネズミ = ev(K.Rat, 'march').reduce((a, x) => a + x.n, 0);
  m.引っ越しの途中で死んだ大ネズミ = de.filter((x) => x.k === K.Rat && x.march).length;
  return m;
}

const seeds = seedsOf(B).filter((x) => seedsOf(A).includes(x));
const ma = seeds.map((x) => measure(join(A, x)));
const mb = seeds.map((x) => measure(join(B, x)));
const keys = [...new Set([...ma, ...mb].flatMap((o) => Object.keys(o)))];
const lines = [`# 冒険者の目標・ゴブリンの盗み・竜退治・大ネズミの引っ越し（${seeds.length} シード、${A} → ${B}）`, '', ...momentTable([A, B], [seeds.map((x) => countMoments(join(A, x))), seeds.map((x) => countMoments(join(B, x)))]), '## A/B 比較（同じシード同士）', '', PAIRED_NOTE, '', ...PAIRED_HEAD];
for (const k of keys) lines.push(pairedRow(k, paired(ma.map((o) => o[k] ?? 0), mb.map((o) => o[k] ?? 0), seeds)));
lines.push('', '## シードごと（作業ツリー）', '', `| シード | ${keys.join(' | ')} |`, `|---|${keys.map(() => '---:').join('|')}|`);
seeds.forEach((sd, i) => lines.push(`| ${sd} | ${keys.map((k) => mb[i][k] ?? 0).join(' | ')} |`));
const txt = lines.join('\n') + '\n';
if (out) writeFileSync(out, txt);
console.log(txt.split('\n## シードごと')[0]);
