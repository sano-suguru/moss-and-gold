/**
 * 見せたい場面の発生回数（CLAUDE.md の「画面に見えること」：25日に一度も起きない場面は、見る人にとって存在しないのと同じ）。
 * 各実行のログ（settle / births / deaths / exits）から、シードごとに数える。compare と advreport が表にする。
 *
 * 目安：たいていのシード（4分の3以上。16シードなら12以上）で、25日に1回以上（できれば数回）。
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const K = { Myconid: 8, Wisp: 0, Bat: 1, Spider: 4, Gargoyle: 18, Mimic: 20, Worm: 22, Wyvern: 23, Rat: 2, Kobold: 10, Goblin: 12, Orc: 13, Minotaur: 15, Dragon: 24, Adventurer: 25, Armor: 29, Vampire: 19, Thrall: 30, Slime: 5, Ghost: 7, Basilisk: 17 };

export interface Moment {
  key: string;
  label: string;
}

/** 数える場面（表に並べる順） */
export const MOMENTS: Moment[] = [
  { key: 'slainEat', label: '狩り：打ち合って仕留めて食べた' },
  { key: 'vampArrive', label: 'ヴァンパイア：コウモリの群れを連れて現れた' },
  { key: 'vampCall', label: 'ヴァンパイア：日暮れにコウモリを呼び寄せた' },
  { key: 'vampScout', label: 'ヴァンパイア：コウモリが獲物の上を旋回して居場所を示した' },
  { key: 'vampPin', label: 'ヴァンパイア：コウモリが獲物に群がって足止めし、ヴァンパイアが打ちかかった' },
  { key: 'vampScatter', label: 'ヴァンパイア：追い詰められてコウモリの群れにばらけて逃げた' },
  { key: 'vampCoffinOpen', label: 'ヴァンパイア：僧侶か竜殺しが棺を暴いた' },
  { key: 'vampLightKill', label: 'ヴァンパイア：光の中で追い詰められ、ばらけられずに倒された' },
  { key: 'thrallRise', label: 'ヴァンパイア：倒された者が眷属として起き上がった' },
  { key: 'thrallAdv', label: 'ヴァンパイア：倒れた冒険者が眷属として起き上がった' },
  { key: 'boneRise', label: 'アンデッド：ゴブリン・コボルト・オーク・ドワーフ・リザードマンの骨がスケルトンとして起き上がった' },
  { key: 'advBoneRise', label: 'アンデッド：冒険者の骨がスケルトンとして起き上がった' },
  { key: 'zombieKin', label: 'アンデッド：人型の亡骸がゾンビとして起き上がった' },
  { key: 'lichFromBones', label: 'アンデッド：濃いマナを吸い続けたスケルトンがリッチに変わった' },
  { key: 'chargeKnock2', label: 'ミノタウロス：一度の突進で冒険者を2人以上はね飛ばした' },
  { key: 'chargeBlock', label: 'ミノタウロス：突進を戦士か僧侶が受け止めた' },
  { key: 'chargeDodge', label: 'ミノタウロス：突進の溜めを見た冒険者が避け、空振りさせた' },
  { key: 'golemQuake2', label: 'ゴーレム：一度の跳ねる衝撃波で冒険者を2人以上打った' },
  { key: 'golemDodge', label: 'ゴーレム：振り下ろしか跳ねる衝撃波の予兆を見た冒険者が避け、空振りさせた' },
  { key: 'golemKnock', label: 'ゴーレム：振り下ろしで入口の冒険者をはね飛ばした' },
  { key: 'armorBlock', label: 'リビングアーマー：盾の体当たりを戦士か僧侶が受け止めた' },
  { key: 'armorDodge', label: 'リビングアーマー：盾の体当たりの予兆を見た冒険者が避け、空振りさせた' },
  { key: 'armorSweep2', label: 'リビングアーマー：武器の大振りで2体以上を打った' },
  { key: 'partyRetreat', label: '冒険者の一行が戦いの途中でかなわず、一行ごと退いた' },
  { key: 'standoff', label: 'コボルトかゴブリンが、住処のそばを通る一行に立ちふさがって威嚇した' },
  { key: 'orcClash', label: 'オークとのにらみ合いから戦いになった' },
  { key: 'orcRoar', label: 'オーク：雄叫びで小物を逃がすか、冒険者の後衛を怖ませた' },
  { key: 'orcWoken', label: 'オーク：集落の見張りに起こされて飛び起きた' },
  { key: 'orcMeet', label: 'オーク：縄張りに入った一行のもとへ駆けつけて迎え撃った' },
  { key: 'orcRally', label: 'オーク：雄叫びで従う集落のゴブリンを駆けつけさせた' },
  { key: 'orcAxe', label: 'オーク：鎖のついた投げ斧を相手に当てた' },
  { key: 'orcAxeAdv', label: 'オーク：投げ斧を冒険者に当てた' },
  { key: 'vampDrain', label: 'ヴァンパイア：離れた相手から血を吸った' },
  { key: 'vampSwarm', label: 'ヴァンパイア：コウモリの群れを相手へ突っ込ませた' },
  { key: 'vampSwarmBlood', label: 'ヴァンパイア：群れのコウモリが噛みついた血をくわえて戻った' },
  { key: 'vampMist', label: 'ヴァンパイア：霧になって後衛の背後に現れた' },
  { key: 'coffinAway', label: 'ヴァンパイア：住処へ帰れず、その場に棺を呼び出して眠った' },
  { key: 'cornerBite', label: '逃げ場のない獣が、追い詰められて噛みつき返した' },
  { key: 'webEat', label: '狩り：クモが巣にかかった獲物を食べた' },
  { key: 'webCatch', label: 'クモの巣：大ネズミかアリが捕まった' },
  { key: 'webTear', label: 'クモの巣：大きな者が引き裂いた' },
  { key: 'webCut', label: 'クモの巣：冒険者が切り払った' },
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
  { key: 'questPost', label: '依頼：町に新しい依頼が出た（src/eco/quest.ts）' },
  { key: 'questKinds', label: '依頼：入ってきた一行の依頼の種類の数（探索を除く。竜退治・道探し・魔物の狩り・ゴブリン退治・祓い・宝探しのうち）' },
  { key: 'questDragon', label: '依頼：竜退治の依頼を受けた一行が入ってきた' },
  { key: 'questDeep', label: '依頼：竜の寝床への道探し（深部の探索）の依頼を受けた一行が入ってきた' },
  { key: 'questBeast', label: '依頼：魔物の狩りの依頼を受けた一行が入ってきた' },
  { key: 'questGoblin', label: '依頼：ゴブリン退治の依頼を受けた一行が入ってきた' },
  { key: 'questUndead', label: '依頼：アンデッド祓いの依頼を受けた一行が入ってきた' },
  { key: 'questGold', label: '依頼：宝探しの依頼を受けた一行が入ってきた' },
  { key: 'beastArrive', label: '魔物の狩りの一行が、目当ての種を見つけて構えた' },
  { key: 'undeadArrive', label: 'アンデッド祓いの一行が、アンデッドの群れる所に着いた' },
  { key: 'goldArrive', label: '宝探しの一行が、知られた宝の山に着いた' },
  { key: 'petriQuest', label: '依頼：バジリスクに仲間を石にされた一行が帰ってから3日の内に、バジリスク狩りの依頼の一行が入ってきた' },
  { key: 'huntArrive', label: 'ゴブリン退治の一行が集落に着いた' },
  { key: 'reveal', label: '松明で隠れたゴブリンを見つけた' },
  { key: 'lairFound', label: '深部の探索の一行が竜の寝床を見つけた' },
  { key: 'wayHome', label: '竜の寝床への道が町に伝わった' },
  { key: 'lairArrive', label: '竜退治の一行が寝床に着いた' },
  { key: 'dragonSlain', label: '冒険者がドラゴンを倒した' },
  { key: 'dragonBurn', label: 'ドラゴンの炎で焼け死んだ（生き物の数）' },
  { key: 'flyerBurn', label: 'コウモリ・ワイバーン・ウィスプがドラゴンの炎で焼け死んだ' },
  { key: 'burnEscape', label: 'ドラゴンの炎に焼かれて、逃げ延びた（焼かれてから生き物の更新100回後も生きていた）' },
  { key: 'cache', label: '物資の置き場を残した' },
  { key: 'supply', label: '置き場で食料を補った（一行ごと）' },
  { key: 'cacheRaid', label: '置き場が大ネズミにあさられた' },
  { key: 'cacheGob', label: '置き場の食料をゴブリンが袋に詰めて持ち去った' },
  { key: 'manaBirth', label: 'マナから大物が湧いた（ミノタウロス・トロール・バジリスク・ヴァンパイア）' },
  { key: 'hatch', label: '幼竜の孵化' },
  { key: 'minoBirth', label: 'ミノタウロス：縄張りでマナから生まれた' },
  { key: 'minoKill', label: 'ミノタウロス：縄張りのそばで獲物を仕留めた（寝床から16マスの内でしか狩らない）' },
  { key: 'minoDrag', label: 'ミノタウロス：仕留めた獲物を寝床まで引きずった' },
  { key: 'bsGaze', label: 'バジリスク：睨みで相手を石に変えた' },
  { key: 'bsKill', label: 'バジリスク：獲物を仕留めた（ウィスプを吸ったのは除く）' },
  { key: 'bsStone', label: 'バジリスク：見つめられて目が合い、石化しはじめた' },
  { key: 'bsAvert', label: 'バジリスク：睨みの溜めに気づいた冒険者が目を背けた' },
  { key: 'bsStoneAdv', label: 'バジリスク：見つめられて目が合い、冒険者が石化しはじめた' },
  { key: 'bsGazeAdv', label: 'バジリスク：睨みで冒険者が石像になった' },
  { key: 'bsStoneRetreat', label: 'バジリスク：仲間が半ば石になり、冒険者の一行が退いた' },
  { key: 'bsHunt', label: 'バジリスク：噂のバジリスクを狩りに来た一行が、目当ての個体を見つけた' },
  { key: 'bsPatrol', label: 'バジリスク：縄張りを見回りに出た' },
  { key: 'bsBedMove', label: 'バジリスク：寝床を引っ越した' },
  { key: 'bsScare', label: 'バジリスク：見回りで歩いてくるバジリスクから大ネズミが逃げた' },
  { key: 'soilBirth', label: '土の養分から魔物の群れが湧いた（コウモリを除く）' },
  { key: 'heroMana', label: '冒険者が倒れた所でマナが立ちのぼった' },
  { key: 'wispSip', label: 'マナの減った大物がウィスプを吸った' },
  { key: 'manaLow', label: 'マナで命をつないでいた大物のマナが尽きかけた' },
  { key: 'march', label: '大ネズミの引っ越しの列' },
  { key: 'hear', label: '聞き耳で止まる（一行が物音に立ち止まった）' },
  { key: 'trophyHome', label: '戦利品を持ち帰った' },
  { key: 'trophyTake', label: '戦利品を手に入れた' },
  { key: 'abandon', label: '住処・集落を群れで捨てた' },
  { key: 'gobArrive', label: 'ゴブリンの群れが現れて集落を作った（外から来た、または土から湧いた）' },
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
  { key: 'bless', label: '僧侶が冒険者の亡骸の前で祈って清めた' },
  { key: 'blessKin', label: '僧侶が人型（ゴブリン・コボルト・オーク・ドワーフ・リザードマン）の亡骸を清めた' },
  { key: 'blessUndead', label: '僧侶が倒されたアンデッドの残骸を清めた' },
  { key: 'blessAll', label: '僧侶が亡骸を清めた（冒険者・人型・アンデッドの残骸の合計）' },
  { key: 'pray', label: '墓標の前で僧侶が祈った' },
  { key: 'tribute', label: 'オークの取り立て' },
  { key: 'farewell', label: '英雄の最後の遠征（見習いを連れて入った）' },
  { key: 'retire', label: '英雄が引退した' },
  { key: 'scar', label: '傷の残った帰還（眼帯・包帯）' },
  { key: 'orcBluff', label: 'オークが威嚇して退いた' },
  { key: 'spiderBind', label: '大グモ：糸を吐いて相手を縛った' },
  { key: 'spiderBindAdv', label: '大グモ：糸を吐いて冒険者を縛った' },
  { key: 'silkCut', label: '大グモ：糸に縛られた冒険者が、糸を切って抜けた' },
  { key: 'spiderBite', label: '大グモ：糸で縛った相手に跳びかかって噛みついた' },
  { key: 'ghostWail', label: 'ゴースト：金切り声で人を打つか、モンスターを追い払った' },
  { key: 'ghostWailAdv', label: 'ゴースト：金切り声で冒険者を打ってすくませた' },
  { key: 'ghostScare', label: 'ゴースト：金切り声か冷たい手でモンスターを追い払った' },
  { key: 'ghostTouch', label: 'ゴースト：冷たい手で人（冒険者・ドワーフ）を打った' },
  { key: 'ghostTouchAdv', label: 'ゴースト：冷たい手で冒険者を打った' },
  { key: 'ghostPhaseAdv', label: 'ゴースト：冒険者の刃が体をすり抜けた' },
  { key: 'koboldSling', label: 'コボルト：逃げ出す前に振り向いて、スリングで小石を投げた' },
  { key: 'koboldStone', label: 'コボルト：スリングの小石が冒険者に当たった' },
  { key: 'koboldCampStoned', label: 'コボルト：野営の一行にスリングの小石を何度も当て、焚き火を消して発たせた' },
  { key: 'koboldStoneBreak', label: 'コボルト：スリングの小石で、冒険者の技の溜めを止めた' },
  { key: 'mycSpore', label: 'マイコニド：傘を膨らませて眠りの胞子を吐き、人をうたた寝させた' },
  { key: 'mycSporeAdv', label: 'マイコニド：眠りの胞子で冒険者をうたた寝させた' },
  { key: 'mycBurst', label: 'マイコニド：倒れて弾けた胞子で、すぐそばの人がうたた寝した' },
  { key: 'armorRise', label: 'リビングアーマー：武具が寄り集まって立ち上がった' },
  { key: 'armorAbsorb', label: 'リビングアーマー：武具を取り込んだ（床の物と奪った物）' },
  { key: 'armorRob', label: 'リビングアーマー：倒した相手の武具を奪って取り込んだ' },
  { key: 'armorShed', label: 'リビングアーマー：打たれて手の武器を落とした' },
  { key: 'armorFall', label: 'リビングアーマー：崩れて武具が砕け散った' },
  { key: 'armorSlain', label: 'リビングアーマー：冒険者かドワーフに倒された' },
  { key: 'slimeSplit', label: 'スライム：死骸を食べて育ち、二つに分かれた' },
  { key: 'joined', label: '住処の洞窟が入口側とつながる' },
  { key: 'joinedDig', label: '住処の洞窟が入口側とつながる：住処のコボルトが掘ってつないだ' },
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
    vampArrive: b.filter((y) => y.k === K.Vampire).length,
    vampCall: ev(K.Vampire, 'callBats').length,
    vampScout: ev(K.Vampire, 'scout').length,
    vampPin: ev(K.Vampire, 'pin').length,
    vampScatter: ev(K.Vampire, 'scatter').length,
    vampLightKill: ev(K.Vampire, 'lightKill').length,
    vampCoffinOpen: ev(K.Vampire, 'coffinOpened').length,
    thrallRise: b.filter((y) => y.k === K.Thrall).length,
    thrallAdv: b.filter((y) => y.k === K.Thrall && y.from === K.Adventurer).length,
    boneRise: b.filter((y) => y.k === 26 && y.origin === 'raised' && [12, 10, 13, 28, 14].includes(y.from)).length,
    advBoneRise: b.filter((y) => (y.k === 26 || y.k === 27) && y.origin === 'raised' && y.from === K.Adventurer).length,
    zombieKin: b.filter((y) => y.k === 6 && y.origin === 'raised' && [12, 10, 13, 14].includes(y.from)).length,
    lichFromBones: s.filter((x) => x.k === 27 && x.ev === 'lichRise').length,
    webEat: gulp([K.Spider]),
    webCatch: ev(K.Spider, 'web').filter((y) => y.how === 'catch').length,
    webTear: ev(K.Spider, 'web').filter((y) => y.how === 'tear').length,
    webCut: ev(K.Spider, 'web').filter((y) => y.how === 'cut').length,
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
    campBreak: ev(K.Adventurer, 'campBreak').filter((x) => x.how !== 'stoned').length,
    campDeath: d.filter((x) => x.k === K.Adventurer && x.camp === 1).length,
    huntArrive: new Set(ev(K.Adventurer, 'arrive').filter((x) => x.how === 5).map((x) => x.id)).size,
    questPost: ev(K.Adventurer, 'quest').filter((x) => !x.init).length,
    questKinds: new Set(ev(K.Adventurer, 'enter').filter((x) => x.q > 0).map((x) => x.q)).size,
    questDragon: ev(K.Adventurer, 'enter').filter((x) => x.q === 2).length,
    questDeep: ev(K.Adventurer, 'enter').filter((x) => x.q === 6).length,
    questBeast: ev(K.Adventurer, 'enter').filter((x) => x.q === 3).length,
    questGoblin: ev(K.Adventurer, 'enter').filter((x) => x.q === 5).length,
    questUndead: ev(K.Adventurer, 'enter').filter((x) => x.q === 4).length,
    questGold: ev(K.Adventurer, 'enter').filter((x) => x.q === 1).length,
    beastArrive: new Set(ev(K.Adventurer, 'arrive').filter((x) => x.how === 3).map((x) => x.id)).size,
    undeadArrive: new Set(ev(K.Adventurer, 'arrive').filter((x) => x.how === 4).map((x) => x.id)).size,
    goldArrive: new Set(ev(K.Adventurer, 'arrive').filter((x) => x.how === 1).map((x) => x.id)).size,
    // 被害の噂を持ち帰った一行（settle 'hurtTold'、一行で一度）ごとに、その帰還から3日（43200 tick）の内にバジリスク狩りの依頼の一行が入ってきたか
    petriQuest: (() => {
      const told = new Map<number, number>();
      for (const x of ev(K.Adventurer, 'hurtTold')) if (x.how === K.Basilisk && !told.has(x.id)) told.set(x.id, x.t);
      const ent = ev(K.Adventurer, 'enter').filter((x) => x.q === 3 && x.qk === K.Basilisk).map((x) => x.t);
      return [...told.values()].filter((t) => ent.some((u) => u > t && u <= t + 43200)).length;
    })(),
    reveal: ev(K.Adventurer, 'reveal').length,
    chargeKnock2: (() => {
      const g = new Map<string, number>();
      for (const x of s) if (x.k === K.Minotaur && x.ev === 'chargeKnock' && x.n === K.Adventurer) g.set(`${x.id}:${x.at}`, (g.get(`${x.id}:${x.at}`) ?? 0) + 1);
      return [...g.values()].filter((n) => n >= 2).length;
    })(),
    chargeBlock: s.filter((x) => x.k === K.Minotaur && x.ev === 'chargeBlock').length,
    chargeDodge: s.filter((x) => x.k === K.Minotaur && x.ev === 'chargeDodge').length,
    golemQuake2: (() => {
      const g = new Map<string, number>();
      for (const x of s) if (x.k === 21 && x.ev === 'quakeHit') g.set(`${x.id}:${x.at}`, (g.get(`${x.id}:${x.at}`) ?? 0) + 1);
      return [...g.values()].filter((n) => n >= 2).length;
    })(),
    golemDodge: s.filter((x) => x.k === 21 && x.ev === 'golemDodge').length,
    golemKnock: s.filter((x) => x.k === 21 && x.ev === 'slamKnock').length,
    armorBlock: s.filter((x) => x.k === K.Armor && x.ev === 'chargeBlock').length,
    armorDodge: s.filter((x) => x.k === K.Armor && x.ev === 'chargeDodge').length,
    armorSweep2: s.filter((x) => x.k === K.Armor && x.ev === 'armorSweep2').length,
    partyRetreat: s.filter((x) => x.k === K.Adventurer && x.ev === 'partyRetreat').length,
    standoff: s.filter((x) => (x.k === K.Kobold || x.k === K.Goblin) && x.ev === 'standoff').length,
    orcClash: s.filter((x) => x.k === K.Orc && x.ev === 'orcClash').length,
    orcRoar: ev(K.Orc, 'orcRoar').filter((x) => x.n > 0).length,
    orcWoken: ev(K.Orc, 'woken').length,
    orcMeet: ev(K.Orc, 'orcMeet').length,
    orcRally: ev(K.Orc, 'orcRoar').filter((x) => x.how > 0).length,
    orcAxe: ev(K.Orc, 'axeHit').length,
    orcAxeAdv: ev(K.Orc, 'axeHit').filter((x) => x.n === K.Adventurer).length,
    spiderBind: ev(K.Spider, 'spiderBind').length,
    spiderBindAdv: ev(K.Spider, 'spiderBind').filter((x) => x.n === K.Adventurer).length,
    silkCut: ev(K.Adventurer, 'silkCut').length,
    spiderBite: ev(K.Spider, 'spiderBite').length,
    koboldSling: ev(K.Kobold, 'sling').length,
    koboldStone: ev(K.Kobold, 'stoneHit').length,
    koboldCampStoned: ev(K.Adventurer, 'campBreak').filter((x) => x.how === 'stoned').length,
    koboldStoneBreak: ev(K.Kobold, 'stoneHit').filter((x) => x.how > 0).length,
    mycSpore: ev(K.Myconid, 'spore').filter((x) => x.how === 0 && x.n > 0).length,
    mycSporeAdv: ev(K.Myconid, 'spore').filter((x) => x.how === 0 && x.adv > 0).length,
    mycBurst: ev(K.Myconid, 'spore').filter((x) => x.how === 1 && x.n > 0).length,
    ghostWail: ev(K.Ghost, 'ghostWail').filter((x) => x.n > 0 || x.to > 0).length,
    ghostScare: ev(K.Ghost, 'ghostWail').filter((x) => x.to > 0).length + ev(K.Ghost, 'ghostScare').length,
    ghostWailAdv: ev(K.Ghost, 'ghostWail').filter((x) => x.how > 0).length,
    ghostTouch: ev(K.Ghost, 'ghostTouch').length,
    ghostTouchAdv: ev(K.Ghost, 'ghostTouch').filter((x) => x.n === K.Adventurer).length,
    ghostPhaseAdv: ev(K.Ghost, 'ghostPhase').filter((x) => x.n === K.Adventurer).length,
    vampDrain: s.filter((x) => x.k === K.Vampire && x.ev === 'drain').length,
    vampSwarm: s.filter((x) => x.k === K.Vampire && x.ev === 'swarm').length,
    vampSwarmBlood: s.filter((x) => x.k === K.Vampire && x.ev === 'swarmBlood').length,
    vampMist: s.filter((x) => x.k === K.Vampire && x.ev === 'mistStep').length,
    coffinAway: s.filter((x) => x.k === K.Vampire && x.ev === 'coffinAway').length,
    cornerBite: s.filter((x) => x.ev === 'cornerBite').length,
    lairFound: s.filter((x) => x.k === K.Adventurer && x.ev === 'aim' && x.how === 6 && x.reason === 1).length,
    wayHome: ev(K.Adventurer, 'way').length,
    lairArrive: new Set(ev(K.Adventurer, 'arrive').filter((x) => x.how === 2).map((x) => x.id)).size,
    dragonSlain: d.filter((x) => x.k === K.Dragon && x.by === K.Adventurer).length,
    dragonBurn: d.filter((x) => x.cause === 'burned' && x.by === K.Dragon).length,
    flyerBurn: d.filter((x) => x.cause === 'burned' && x.by === K.Dragon && (x.k === K.Bat || x.k === K.Wyvern || x.k === K.Wisp)).length,
    // 焼かれた記録（settle の burn。続けて焼かれても1回。src/eco/fire.ts の burnHurt）のうち、その者の死（deaths の id）が200 tick（生き物の更新100回）の内に無いもの
    burnEscape: (() => {
      const died = new Map<number, number[]>();
      for (const x of d) if (x.id !== undefined) (died.get(x.id) ?? died.set(x.id, []).get(x.id)!).push(x.t);
      return ev(K.Dragon, 'burn').filter((b) => !(died.get(b.id) ?? []).some((t) => t >= b.t && t <= b.t + 200)).length;
    })(),
    cache: ev(K.Adventurer, 'cache').filter((x) => !x.merged).length,
    supply: uniq(ev(K.Adventurer, 'supply')),
    cacheRaid: ev(K.Rat, 'cache').length,
    cacheGob: ev(K.Goblin, 'cacheLoot').length,
    manaBirth: b.filter((x) => x.origin === 'mana' && [K.Minotaur, 16, 17, K.Vampire].includes(x.k)).length,
    hatch: b.filter((x) => x.origin === 'mana' && x.k === K.Dragon).length,
    minoBirth: b.filter((x) => x.origin === 'mana' && x.k === K.Minotaur).length,
    minoKill: d.filter((x) => x.by === K.Minotaur && (x.cause === 'eaten' || x.cause === 'fight')).length,
    bsGaze: d.filter((x) => x.by === K.Basilisk && x.cause === 'petrified').length,
    bsKill: d.filter((x) => x.by === K.Basilisk && (x.cause === 'eaten' || x.cause === 'fight')).length,
    bsStone: ev(K.Basilisk, 'gaze').filter((x) => x.how === 1).length,
    bsAvert: ev(K.Basilisk, 'gaze').filter((x) => x.how === 0 && x.n === K.Adventurer).length,
    bsStoneAdv: ev(K.Basilisk, 'gaze').filter((x) => x.how === 1 && x.n === K.Adventurer).length,
    bsGazeAdv: d.filter((x) => x.by === K.Basilisk && x.cause === 'petrified' && x.k === K.Adventurer).length,
    bsStoneRetreat: s.filter((x) => x.k === K.Adventurer && x.ev === 'partyRetreat' && x.how === 2).length,
    bsHunt: s.filter((x) => x.k === K.Adventurer && x.ev === 'arrive' && x.how === 3 && x.to === K.Basilisk).length,
    bsPatrol: ev(K.Basilisk, 'patrol').length,
    bsBedMove: ev(K.Basilisk, 'bedMove').length,
    bsScare: ev(K.Rat, 'fleeBasilisk').length,
    minoDrag: ev(K.Minotaur, 'drag').length,
    // 湧きの記録（src/eco/generate.ts の settle 'gen'。群れごとに1回）
    soilBirth: s.filter((x) => x.ev === 'gen' && x.how === 'nutr' && x.k !== K.Bat).length,
    heroMana: ev(K.Adventurer, 'heroMana').length,
    wispSip: d.filter((x) => x.cause === 'sipped').length,
    manaLow: s.filter((x) => x.ev === 'manaLow').length,
    march: ev(K.Rat, 'march').length,
    abandon: s.filter((x) => (x.k === K.Kobold || x.k === K.Goblin) && x.ev === 'abandon').length,
    gobArrive: ev(K.Goblin, 'found').filter((y) => y.how === 'arrive' || y.how === 'soil').length,
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
    bless: ev(K.Adventurer, 'bless').length,
    blessKin: ev(K.Adventurer, 'blessKin').length,
    blessUndead: ev(K.Adventurer, 'blessUndead').length,
    blessAll: ev(K.Adventurer, 'bless').length + ev(K.Adventurer, 'blessKin').length + ev(K.Adventurer, 'blessUndead').length,
    pray: ev(K.Adventurer, 'mourn').filter((x) => x.how === 1).length,
    farewell: ev(K.Adventurer, 'farewell').filter((x) => (x.how ?? 0) > 0).length,
    retire: ev(K.Adventurer, 'retire').length,
    scar: ev(K.Adventurer, 'scar').length,
    orcBluff: ev(K.Orc, 'bluff').length,
    armorRise: b.filter((x) => x.k === K.Armor && x.origin === 'gear').length,
    armorAbsorb: ev(K.Armor, 'absorb').length,
    armorRob: ev(K.Armor, 'absorb').filter((x) => x.how === 'rob').length,
    armorShed: ev(K.Armor, 'shed').length,
    armorFall: ev(K.Armor, 'fall').length,
    slimeSplit: ev(K.Slime, 'split').length,
    armorSlain: d.filter((x) => x.k === K.Armor && (x.by === K.Adventurer || x.by === 28)).length,
    // 入口側と切り離されていた住みか（コボルトの住処、ゴブリン・リザードマンの集落、アリの巣）が、入口側の洞窟とつながった（src/eco/islands.ts の markJoined）
    joined: s.filter((x) => x.ev === 'joined').length,
    joinedDig: s.filter((x) => x.ev === 'joined' && x.how === 1).length,
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
