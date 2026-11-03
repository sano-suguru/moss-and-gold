/**
 * 見せたい瞬間の回数（見える相互作用の決まり：25日に一度も起きない場面は、眺める人にとって存在しないのと同じ）。
 * 回の記録（settle / births / deaths / exits）から、シードごとに数える。compare と advreport が表にする。
 *
 * 目安：たいていのシード（4分の3以上。16シードなら12以上）で、25日に1回以上（できれば数回）。
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const K = { Rat: 2, Kobold: 10, Goblin: 12, Orc: 13, Dragon: 24, Adventurer: 25 };

export interface Moment {
  key: string;
  label: string;
}

/** 数える瞬間（並べる順） */
export const MOMENTS: Moment[] = [
  { key: 'snatch', label: '通路での掠め取り：盗んだ' },
  { key: 'stalk', label: '通路での掠め取り：つけた' },
  { key: 'anyRob', label: 'ゴブリンの盗み（夜と通路の合計）' },
  { key: 'raid', label: '夜の盗み：忍び寄った' },
  { key: 'raidRob', label: '夜の盗み：盗んだ' },
  { key: 'dozeRob', label: '見張りがうとうとする間に盗まれた' },
  { key: 'huntArrive', label: 'ゴブリン退治の一行が集落に着いた' },
  { key: 'reveal', label: '松明で隠れたゴブリンを見つけた' },
  { key: 'lairFound', label: '深部の探索の一行が竜の寝床を見つけた' },
  { key: 'wayHome', label: '竜の寝床への道が町に伝わった' },
  { key: 'lairArrive', label: '竜退治の一行が寝床に着いた' },
  { key: 'dragonSlain', label: '冒険者がドラゴンを倒した' },
  { key: 'cache', label: '物資の置き場を残した' },
  { key: 'supply', label: '置き場で食料を補った（一行ごと）' },
  { key: 'cacheRaid', label: '置き場が大ネズミにあさられた' },
  { key: 'manaBirth', label: 'マナからの出現（幼竜を除く）' },
  { key: 'hatch', label: '幼竜の孵化' },
  { key: 'march', label: '大ネズミの引っ越しの列' },
  { key: 'hear', label: '聞き耳で止まる（一行が物音に立ち止まった）' },
  { key: 'trophyHome', label: '戦利品を持ち帰った' },
  { key: 'trophyTake', label: '戦利品を手に入れた' },
  { key: 'abandon', label: '住処・集落を群れで捨てた' },
  { key: 'heroAgain', label: '同じ顔の再訪（2回目以上の遠征の冒険者）' },
  { key: 'rank1', label: '位が上がった：熟練' },
  { key: 'rank2', label: '位が上がった：歴戦' },
  { key: 'rank3', label: '位が上がった：英雄' },
  { key: 'grave', label: '墓標が立った' },
  { key: 'mourn', label: '墓標の前で一行が立ち止まった' },
  { key: 'pray', label: '墓標の前で僧侶が祈った' },
  { key: 'tribute', label: 'オークの取り立て' },
  { key: 'farewell', label: '英雄の最後の遠征（見習いを連れて入った）' },
  { key: 'retire', label: '英雄が引退した' },
  { key: 'scar', label: '傷の残った帰還（眼帯・包帯）' },
  { key: 'orcBluff', label: 'オークが威嚇して退いた' },
];

const read = (dir: string, f: string, since: number) =>
  existsSync(join(dir, f))
    ? readFileSync(join(dir, f), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
        .filter((r) => !(typeof r.t === 'number' && r.t <= since))
    : [];

/** その回（1シード）の、瞬間ごとの回数。since（刻み）より後の記録だけ */
export function countMoments(dir: string, since = -1): Record<string, number> {
  const s = read(dir, 'settle.jsonl', since);
  const b = read(dir, 'births.jsonl', since);
  const d = read(dir, 'deaths.jsonl', since);
  const ev = (k: number, e: string) => s.filter((x) => x.k === k && x.ev === e);
  const rob = ev(K.Goblin, 'rob');
  const uniq = (a: { id: number; to?: number }[]) => new Set(a.map((x) => `${x.id},${x.to ?? ''}`)).size;
  return {
    snatch: rob.filter((x) => x.how === 'snatch').length,
    stalk: ev(K.Goblin, 'stalk').length,
    anyRob: rob.filter((x) => x.how === 'snatch' || x.how === 'raid').length,
    hear: ev(K.Adventurer, 'hear').length,
    trophyHome: ev(K.Adventurer, 'trophy').filter((x) => x.how === 'home').length,
    trophyTake: ev(K.Adventurer, 'trophy').filter((x) => x.how === 'take').length,
    raid: ev(K.Goblin, 'raid').length,
    raidRob: rob.filter((x) => x.how === 'raid').length,
    dozeRob: rob.filter((x) => x.doze === 1).length,
    huntArrive: new Set(ev(K.Adventurer, 'arrive').filter((x) => x.how === 5).map((x) => x.id)).size,
    reveal: ev(K.Adventurer, 'reveal').length,
    lairFound: s.filter((x) => x.k === K.Adventurer && x.ev === 'aim' && x.how === 6 && x.reason === 1).length,
    wayHome: ev(K.Adventurer, 'way').length,
    lairArrive: new Set(ev(K.Adventurer, 'arrive').filter((x) => x.how === 2).map((x) => x.id)).size,
    dragonSlain: d.filter((x) => x.k === K.Dragon && x.by === K.Adventurer).length,
    cache: ev(K.Adventurer, 'cache').filter((x) => !x.merged).length,
    supply: uniq(ev(K.Adventurer, 'supply')),
    cacheRaid: ev(K.Rat, 'cache').length,
    manaBirth: b.filter((x) => x.origin === 'mana' && x.k !== K.Dragon).length,
    hatch: b.filter((x) => x.origin === 'mana' && x.k === K.Dragon).length,
    march: ev(K.Rat, 'march').length,
    abandon: s.filter((x) => (x.k === K.Kobold || x.k === K.Goblin) && x.ev === 'abandon').length,
    tribute: ev(K.Orc, 'tribute').length,
    heroAgain: ev(K.Adventurer, 'hero').filter((x) => (x.how ?? 0) >= 2).length,
    rank1: ev(K.Adventurer, 'rank').filter((x) => x.how === 1).length,
    rank2: ev(K.Adventurer, 'rank').filter((x) => x.how === 2).length,
    rank3: ev(K.Adventurer, 'rank').filter((x) => x.how === 3).length,
    grave: ev(K.Adventurer, 'grave').length,
    mourn: ev(K.Adventurer, 'mourn').length,
    pray: ev(K.Adventurer, 'mourn').filter((x) => x.how === 1).length,
    farewell: ev(K.Adventurer, 'farewell').filter((x) => (x.how ?? 0) > 0).length,
    retire: ev(K.Adventurer, 'retire').length,
    scar: ev(K.Adventurer, 'scar').length,
    orcBluff: ev(K.Orc, 'bluff').length,
  };
}

/** 回の組（シードごとの回数）の表の1行：起きたシード（目安に届けば ✅）、合計、シードごとの中央値 */
export function momentCell(vals: number[]): string {
  const n = vals.length;
  const hit = vals.filter((v) => v > 0).length;
  const s = [...vals].sort((a, b) => a - b);
  const med = n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
  const ok = hit >= Math.ceil(n * 0.75);
  return `${ok ? '✅' : '❌'} ${hit}/${n}（計 ${vals.reduce((a, v) => a + v, 0)}、中央値 ${med}）`;
}

/** 見せたい瞬間の表（いくつかの回を並べる）。runs[i][j] は回 i のシード j の数え */
export function momentTable(names: string[], runs: Record<string, number>[][]): string[] {
  const L = [
    '## 見せたい瞬間の回数',
    '',
    '起きたシードの数（✅ は目安：4分の3以上のシードで1回以上）、すべてのシードの合計、シードごとの中央値。数え方は tools/analysis/lib/moments.ts。',
    '',
    `| 瞬間 | ${names.join(' | ')} |`,
    `|---|${names.map(() => '---').join('|')}|`,
  ];
  for (const m of MOMENTS) L.push(`| ${m.label} | ${runs.map((r) => momentCell(r.map((o) => o[m.key] ?? 0))).join(' | ')} |`);
  L.push('');
  return L;
}
