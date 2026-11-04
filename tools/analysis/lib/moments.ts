/**
 * 見せたい場面の発生回数（CLAUDE.md の「画面に見えること」：25日に一度も起きない場面は、見る人にとって存在しないのと同じ）。
 * 各実行のログ（settle / births / deaths / exits）から、シードごとに数える。compare と advreport が表にする。
 *
 * 目安：たいていのシード（4分の3以上。16シードなら12以上）で、25日に1回以上（できれば数回）。
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const K = { Wisp: 0, Bat: 1, Spider: 4, Gargoyle: 18, Mimic: 20, Worm: 22, Wyvern: 23, Rat: 2, Kobold: 10, Goblin: 12, Orc: 13, Dragon: 24, Adventurer: 25 };

export interface Moment {
  key: string;
  label: string;
}

/** 数える場面（表に並べる順） */
export const MOMENTS: Moment[] = [
  { key: 'slainEat', label: '狩り：打ち合って仕留めて食べた' },
  { key: 'webEat', label: '狩り：クモが巣にかかった獲物を食べた' },
  { key: 'swallow', label: '狩り：ワームかミミックが丸のみにした' },
  { key: 'airSnatch', label: '狩り：ワイバーンかガーゴイルが飛ぶコウモリをさらった' },
  { key: 'snatch', label: '通路での掠め取り：盗んだ' },
  { key: 'stalk', label: '通路での掠め取り：つけた' },
  { key: 'anyRob', label: 'ゴブリンの盗み（夜と通路の合計）' },
  { key: 'raid', label: '夜の盗み：忍び寄った' },
  { key: 'raidRob', label: '夜の盗み：盗んだ' },
  { key: 'dozeRob', label: '見張りがうとうとする間に盗まれた' },
  { key: 'nightAttack', label: '焚き火の夜襲：一行が起こされた（見張り・盗賊が気づいた、寝込みを打たれた）' },
  { key: 'nightWatch', label: '焚き火の夜襲：見張りか盗賊が気づいて起こした' },
  { key: 'nightHit', label: '焚き火の夜襲：寝込みの一打ち' },
  { key: 'campDeath', label: '焚き火の夜襲：焚き火で休む間に倒れた（人数。目安は1シード25日に1〜2人まで）' },
  { key: 'campBreak', label: '焚き火の夜襲：被害を受けて焚き火を消して発った' },
  { key: 'huntArrive', label: 'ゴブリン退治の一行が集落に着いた' },
  { key: 'reveal', label: '松明で隠れたゴブリンを見つけた' },
  { key: 'lairFound', label: '深部の探索の一行が竜の寝床を見つけた' },
  { key: 'wayHome', label: '竜の寝床への道が町に伝わった' },
  { key: 'lairArrive', label: '竜退治の一行が寝床に着いた' },
  { key: 'dragonSlain', label: '冒険者がドラゴンを倒した' },
  { key: 'dragonBurn', label: 'ドラゴンの炎で焼け死んだ（生き物の数）' },
  { key: 'flyerBurn', label: 'コウモリ・ワイバーン・ウィスプがドラゴンの炎で焼け死んだ' },
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
  { key: 'gobArrive', label: 'ゴブリンの群れが外から来て集落を作った' },
  { key: 'gobPoor', label: 'ゴブリンの少ない群れが貧しい場所に集落を作った' },
  { key: 'gobFound', label: 'ゴブリンの集落ができた（外から来た・引っ越し・分かれた）' },
  { key: 'gobCampDays', label: 'ゴブリンの集落があった日数（一つ以上ある間。小数1桁）' },
  { key: 'gobAbFood', label: 'ゴブリンが集落を捨てた：食べ物が尽きた' },
  { key: 'gobAbRaids', label: 'ゴブリンが集落を捨てた：襲われすぎた' },
  { key: 'gobAbAlone', label: 'ゴブリンが集落を捨てた：2匹未満になった' },
  { key: 'gobAbDragon', label: 'ゴブリンが集落を捨てた：竜が近くに来た' },
  { key: 'gobEmpty', label: 'ゴブリンの集落に誰もいなくなった' },
  { key: 'gobHomeless', label: '集落の無いゴブリンが飢えて外へ去った（匹）' },
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

const DAY = 14400;

/**
 * ゴブリンの集落が一つ以上あった長さ（日）。集落ごとに、できた（found）から、捨てた（abandon）か誰もいなくなった（empty）のうち早い方までを区間とし、
 * 重なりをまとめて足す。終わりの記録が無い集落は実行の終わり（meta.json の tick）まで。since より前にできた集落は since から数える。
 */
function campDays(s: { k: number; ev: string; id: number; t: number }[], dir: string, since: number, pre: { k: number; ev: string; id: number; t: number }[]): number {
  const metaP = join(dir, 'meta.json');
  const end = existsSync(metaP) ? (JSON.parse(readFileSync(metaP, 'utf8')).tick as number) : Math.max(0, ...s.map((x) => x.t));
  const t0 = Math.max(0, since);
  const st = new Map<number, number>();
  const en = new Map<number, number>();
  // since より前にできて、since の時点でまだ終わっていなかった集落
  for (const x of pre) {
    if (x.k !== K.Goblin) continue;
    if (x.ev === 'found') st.set(x.id, t0);
    else if (x.ev === 'abandon' || x.ev === 'empty') st.delete(x.id);
  }
  for (const x of s) {
    if (x.k !== K.Goblin) continue;
    if (x.ev === 'found') st.set(x.id, x.t);
    else if ((x.ev === 'abandon' || x.ev === 'empty') && st.has(x.id) && !en.has(x.id)) en.set(x.id, x.t);
  }
  const iv = [...st].map(([id, a]) => [a, en.get(id) ?? end]).sort((p, q) => p[0] - q[0]);
  let tot = 0;
  let cs = -1;
  let ce = -1;
  for (const [a, b] of iv) {
    if (a > ce) {
      if (ce > cs) tot += ce - cs;
      cs = a;
      ce = b;
    } else ce = Math.max(ce, b);
  }
  if (ce > cs) tot += ce - cs;
  return Math.round((10 * tot) / DAY) / 10;
}

const readAll = (dir: string, f: string) =>
  existsSync(join(dir, f))
    ? readFileSync(join(dir, f), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

const read = (dir: string, f: string, since: number) =>
  existsSync(join(dir, f))
    ? readFileSync(join(dir, f), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
        .filter((r) => !(typeof r.t === 'number' && r.t <= since))
    : [];

/** 1回の実行（1シード）のログから、場面ごとの発生回数を数える。since（tick）より後のログだけ */
export function countMoments(dir: string, since = -1): Record<string, number> {
  const s = read(dir, 'settle.jsonl', since);
  const b = read(dir, 'births.jsonl', since);
  const d = read(dir, 'deaths.jsonl', since);
  const x = read(dir, 'exits.jsonl', since);
  const pre = since >= 0 ? readAll(dir, 'settle.jsonl').filter((r) => typeof r.t === 'number' && r.t <= since) : [];
  const gobAb = (r: string) => s.filter((y) => y.k === K.Goblin && y.ev === 'abandon' && y.reason === r).length;
  const ev = (k: number, e: string) => s.filter((x) => x.k === k && x.ev === e);
  const rob = ev(K.Goblin, 'rob');
  const uniq = (a: { id: number; to?: number }[]) => new Set(a.map((x) => `${x.id},${x.to ?? ''}`)).size;
  const gulp = (by: number[]) => d.filter((y) => y.cause === 'eaten' && !y.slain && by.includes(y.by)).length;
  return {
    slainEat: d.filter((y) => y.cause === 'eaten' && y.slain === 1).length,
    webEat: gulp([K.Spider]),
    swallow: gulp([K.Worm, K.Mimic]),
    airSnatch: gulp([K.Wyvern, K.Gargoyle]),
    snatch: rob.filter((x) => x.how === 'snatch').length,
    stalk: ev(K.Goblin, 'stalk').length,
    anyRob: rob.filter((x) => x.how === 'snatch' || x.how === 'raid').length,
    hear: ev(K.Adventurer, 'hear').length,
    trophyHome: ev(K.Adventurer, 'trophy').filter((x) => x.how === 'home').length,
    trophyTake: ev(K.Adventurer, 'trophy').filter((x) => x.how === 'take').length,
    raid: ev(K.Goblin, 'raid').length,
    raidRob: rob.filter((x) => x.how === 'raid').length,
    dozeRob: rob.filter((x) => x.doze === 1).length,
    nightAttack: ev(K.Adventurer, 'wake').filter((x) => x.how === 'watch' || x.how === 'thief' || x.how === 'hit').length,
    nightWatch: ev(K.Adventurer, 'wake').filter((x) => x.how === 'watch' || x.how === 'thief').length,
    nightHit: ev(K.Adventurer, 'nightHit').length,
    campBreak: ev(K.Adventurer, 'campBreak').length,
    campDeath: d.filter((x) => x.k === K.Adventurer && x.camp === 1).length,
    huntArrive: new Set(ev(K.Adventurer, 'arrive').filter((x) => x.how === 5).map((x) => x.id)).size,
    reveal: ev(K.Adventurer, 'reveal').length,
    lairFound: s.filter((x) => x.k === K.Adventurer && x.ev === 'aim' && x.how === 6 && x.reason === 1).length,
    wayHome: ev(K.Adventurer, 'way').length,
    lairArrive: new Set(ev(K.Adventurer, 'arrive').filter((x) => x.how === 2).map((x) => x.id)).size,
    dragonSlain: d.filter((x) => x.k === K.Dragon && x.by === K.Adventurer).length,
    dragonBurn: d.filter((x) => x.cause === 'burned' && x.by === K.Dragon).length,
    flyerBurn: d.filter((x) => x.cause === 'burned' && x.by === K.Dragon && (x.k === K.Bat || x.k === K.Wyvern || x.k === K.Wisp)).length,
    cache: ev(K.Adventurer, 'cache').filter((x) => !x.merged).length,
    supply: uniq(ev(K.Adventurer, 'supply')),
    cacheRaid: ev(K.Rat, 'cache').length,
    manaBirth: b.filter((x) => x.origin === 'mana' && x.k !== K.Dragon).length,
    hatch: b.filter((x) => x.origin === 'mana' && x.k === K.Dragon).length,
    march: ev(K.Rat, 'march').length,
    abandon: s.filter((x) => (x.k === K.Kobold || x.k === K.Goblin) && x.ev === 'abandon').length,
    gobArrive: ev(K.Goblin, 'found').filter((y) => y.how === 'arrive').length,
    gobPoor: ev(K.Goblin, 'found').filter((y) => y.poor === 1).length,
    gobFound: ev(K.Goblin, 'found').length,
    gobCampDays: campDays(s, dir, since, pre),
    gobAbFood: gobAb('food'),
    gobAbRaids: gobAb('raids'),
    gobAbAlone: gobAb('alone'),
    gobAbDragon: gobAb('dragon'),
    gobEmpty: ev(K.Goblin, 'empty').length,
    gobHomeless: x.filter((y) => y.k === K.Goblin && y.reason === 'starving').length,
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

/** 表の1セル（シードごとの回数から）：起きたシードの数（目安に届けば ✅）、合計、シードごとの中央値 */
export function momentCell(vals: number[]): string {
  const n = vals.length;
  const hit = vals.filter((v) => v > 0).length;
  const s = [...vals].sort((a, b) => a - b);
  const med = n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
  const ok = hit >= Math.ceil(n * 0.75);
  // 日数などの小数の値は、足したときの丸めの誤差を表に出さない
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return `${ok ? '✅' : '❌'} ${hit}/${n}（計 ${r1(vals.reduce((a, v) => a + v, 0))}、中央値 ${r1(med)}）`;
}

/** 見せたい場面の表（複数の実行の組を列に並べる）。runs[i][j] は組 i のシード j の回数 */
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
