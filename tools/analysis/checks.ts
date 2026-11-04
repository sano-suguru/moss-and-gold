/**
 * 短時間のチェック（npm run check）の項目。大きな batch の前に、固定のスナップショットから短く実行して、新しい挙動が実際に起きるかを見る。
 *
 * 一つのチェック：seeds のそれぞれを、ベース（--base、既定 HEAD）の from 日目のスナップショットから、作業ツリーで to 日目まで実行し、
 * test にログ（from 日目より後のもの）を渡す。同じ (シード, from, to) の実行はチェック同士で共有し、キャッシュ（runs/.cache/run）にも残る。
 * 作業ツリーのシミュレーションのソースを変えていなければ、2回目からは再実行せずに結果を使う。
 *
 * チェックを足すときは、起きることがわかっているシードと日を、前の batch の settle.jsonl などから選ぶ（例：かしたれは10日目ごろに貢ぎ物）。
 */
import { countsAsStuck } from './common';
export interface Recs {
  seed: string;
  from: number;
  to: number;
  samples: any[];
  deaths: any[];
  births: any[];
  exits: any[];
  settle: any[];
  events: any[];
  /** 足踏み（起きて歩く姿のまま2分以上ほぼ同じ場所にいた。sim.ts の stuck.jsonl） */
  stuck: any[];
  /** その日の日次スナップショット（ゲームのセーブと同じ形の JSON）。from〜to の整数の日 */
  state: (day: number) => any;
}
export interface Check {
  name: string;
  seeds: string[];
  from: number;
  to: number;
  /** シードごとのログを受け取り、目安に届いたかどうかと、表に出す値を返す */
  test: (r: Recs[]) => { ok: boolean; value: string };
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const RUN_A = { seeds: ['かしたれ', 'seed8', 'abc', 'seed7'], from: 10, to: 18 };
/** オークの取り立て：縄張りが長く続くシード（オークのいる日数が上限1でも2でも16日ほど） */
const RUN_ORC = { seeds: ['かしたれ', 'seed27'], from: 10, to: 18 };
// オークの取り立ては、従う集落に蓄えがたまったときだけ起きるまれな出来事（16シード×25日で約25回、起きるのは6シードほど）。
// いまのコードで10〜18日目に起きているシードを選ぶ。焚き火の夜襲の二歩目（#29）のコードで、
// 0日目から実行すると abc 11.7日目・seed27 15.5日目から何度も、#28 の main の10日目から続けると seed23 15.8日目ほか（どちらでも起きるシードはない）。
// 以前の かしたれ は六歩目（#16）のあと、seed41・seed18 は焚き火の眠り（#28）のあと、18日目までに起きなくなった。
// クモの巣の変更（#38）のコードで0日目から実行すると、abc・seed27・seed23 では起きず、seed41・seed30 で起きる（#37 の main では seed23・seed41・seed30 で起きる）。
// どちらのスナップショットから始めても通るよう、seed23・seed41・seed30 にする
const RUN_TRIB = { seeds: ['seed23', 'seed41', 'seed30'], from: 10, to: 18 };

export const CHECKS: Check[] = [
  {
    // リビングアーマー（src/eco/armor.ts）：倒れた冒険者の武具に未練が宿り、溜まり場で甲冑が立ち上がる
    name: 'リビングアーマーが武具の溜まり場から立ち上がる（4シードで2回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.births.filter((x) => x.k === 29 && x.origin === 'gear').length);
      return { ok: sum(n) >= 2, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // リビングアーマー：床の武器と盾を取り込み、倒れるかマナが尽きると武具が床に散らばる
    name: 'リビングアーマーが武具を取り込み、崩れて散らばる（4シードで取り込み3回・崩れる1回以上）',
    ...RUN_A,
    test: (rs) => {
      const a = rs.map((r) => r.settle.filter((x) => x.k === 29 && x.ev === 'absorb').length);
      const f = rs.map((r) => r.settle.filter((x) => x.k === 29 && x.ev === 'fall').length);
      return { ok: sum(a) >= 3 && sum(f) >= 1, value: rs.map((r, i) => `${r.seed} 取り込み${a[i]}・崩れる${f[i]}`).join('、') };
    },
  },
  {
    // 焚き火の夜（src/eco/night.ts）：焚き火で眠る一行が、見張り・盗賊に起こされるか、寝込みを打たれて飛び起きる
    name: '焚き火で眠る一行が、敵に気づいた見張りか、寝込みの一打ちで起こされる（4シードで1回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'wake' && x.how !== 'noise').length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 冒険者の作り直しの三歩目：焚き火の見張りはときどきうとうとする（焚き火を囲むたびに何度か）
    name: '焚き火の見張りがうとうとする（4シードで4回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'doze').length);
      return { ok: sum(n) >= 4, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 三歩目：深部の探索の一行が物資の置き場を残し、次の一行がそこで食料を補う（abc では10〜18日に置き場が2つ以上、補うのが1回以上）
    name: '物資の置き場が残され、次の一行が補う（4シードで置き場2つ・補う1回以上）',
    ...RUN_A,
    test: (rs) => {
      const c = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'cache' && !x.merged).length);
      const u = rs.map((r) => new Set(r.settle.filter((x) => x.k === 25 && x.ev === 'supply').map((x) => x.id)).size);
      return { ok: sum(c) >= 2 && sum(u) >= 1, value: rs.map((r, i) => `${r.seed} ${c[i]}（補った一行 ${u[i]}）`).join('、') };
    },
  },
  {
    // 冒険者の作り直しの一歩目：一行は目標を持って入り、目標に着くと構える（seed8・seed7 では10〜18日に何度も着く）
    name: '冒険者の一行が目標に着く（4シードで3回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'arrive').length);
      return { ok: sum(n) >= 3, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 目標でない住処・集落のそばを通るときは身構えて通り過ぎる（seed7 で10〜18日に数回）
    name: '冒険者の一行が住処のそばで身構えて通り過ぎる（4シードで1回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'pass').length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 冒険者の作り直しの二歩目：夜、蓄えの乏しい集落のゴブリンが、焚き火を囲む一行のところへ盗みに出る
    name: 'ゴブリンが夜に盗みに出る（4シードで1回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'raid').length);
      const rob = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'rob').length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}（盗んだ ${rob[i]}）`).join('、') };
    },
  },
  {
    // 食べ物の足りる場所がどの横穴の先にも無いマップでも、少ない群れが貧しい場所に集落を作る。
    // 迷路をなくして地形が変わる前は、かしたれ・seed7・seed8 で10〜18日目に起きていた。変わったあとは seed18・seed40 で3回ずつ、seed8 で1回（かしたれ・seed7 では起きない）
    name: 'ゴブリンの少ない群れが貧しい場所に集落を作る（4シードの合計で2回以上）',
    seeds: ['かしたれ', 'seed8', 'seed18', 'seed40'],
    from: 10,
    to: 18,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'found' && x.poor === 1).length);
      return { ok: sum(n) >= 2, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // ゴブリンの流れを短くする：通り道の脇の暗がりで待ち伏せ、通路を行く一行の最後尾から荷を掠め取る
    name: 'ゴブリンが通路を行く一行の最後尾から荷を掠め取る（4シードで1回以上）',
    ...RUN_A,
    test: (rs) => {
      const st = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'stalk').length);
      const rob = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'rob' && x.how === 'snatch').length);
      return { ok: sum(rob) >= 1, value: rs.map((r, i) => `${r.seed} ${rob[i]}（つけた ${st[i]}）`).join('、') };
    },
  },
  {
    // 見えないけれど聞こえる：暗がりの物音に、一行が立ち止まって耳を澄ます
    name: '冒険者の一行が暗がりの物音に立ち止まる（4シードそれぞれで1回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'hear').length);
      return { ok: n.every((v) => v >= 1), value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 戦利品を担いで帰る：目標を果たした一行が、倒した相手にちなむ戦利品を手に入れる
    name: '目標を果たした一行が戦利品を手に入れる（4シードで1回以上）',
    ...RUN_A,
    test: (rs) => {
      const take = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'trophy' && x.how === 'take').length);
      const home = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'trophy' && x.how === 'home').length);
      return { ok: sum(take) >= 1, value: rs.map((r, i) => `${r.seed} ${take[i]}（持ち帰った ${home[i]}）`).join('、') };
    },
  },
  {
    // 狩りは打ち合って仕留めてから食べる（一口で食べるのは、クモの巣・丸のみ・空中でさらう・死骸だけ）。
    // 打ち合いで仕留めて食べたのが、一口で食べたより多い
    // （1シードの揺れに左右されないよう、回数は4シードの合計で見る。クモの巣の変更（#38）のあと、abc の10〜18日目は10回ほどになった）
    name: '狩りは打ち合って仕留めて食べる（4シードの合計で80回以上、どのシードでも一口で食べたより多い）',
    ...RUN_A,
    test: (rs) => {
      const sl = rs.map((r) => r.deaths.filter((x) => x.cause === 'eaten' && x.slain === 1).length);
      const gu = rs.map((r) => r.deaths.filter((x) => x.cause === 'eaten' && !x.slain).length);
      return { ok: sum(sl) >= 80 && sl.every((v, i) => v > gu[i]), value: rs.map((r, i) => `${r.seed} ${sl[i]}（一口 ${gu[i]}）`).join('、') };
    },
  },
  {
    // クモの巣は、大ネズミやアリを捕まえ、大きな者に引き裂かれ、冒険者に切り払われる（src/eco/spider.ts の updateWebs）
    name: 'クモの巣に大ネズミかアリが捕まり、引き裂かれるか切り払われる（4シードの合計でそれぞれ1回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = (how: string) => rs.map((r) => r.settle.filter((x) => x.k === 4 && x.ev === 'web' && x.how === how).length);
      const ca = n('catch');
      const te = n('tear');
      const cu = n('cut');
      return { ok: sum(ca) >= 1 && sum(te) + sum(cu) >= 1, value: rs.map((r, i) => `${r.seed} 捕まった${ca[i]}・引き裂いた${te[i]}・切り払った${cu[i]}`).join('、') };
    },
  },
  {
    // 大ネズミの巣穴の引っ越しは、群れが一列になって歩いていく
    name: '大ネズミが一列になって巣穴を引っ越す（4シードで1回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 2 && x.ev === 'march').length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 五歩目：町の名簿。同じ顔がまた来て、生きて帰れば位が上がる
    name: '名簿の冒険者が再び来て、位が上がる（4シードの合計で再訪4回以上・位が上がる1回以上）',
    ...RUN_A,
    test: (rs) => {
      const again = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'hero' && (x.how ?? 0) >= 2).length);
      const up = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'rank').length);
      return { ok: sum(again) >= 4 && sum(up) >= 1, value: rs.map((r, i) => `${r.seed} 再訪 ${again[i]}・位 ${up[i]}`).join('、') };
    },
  },
  {
    // 六歩目：英雄は見習いを連れた最後の遠征から帰ると引退する。深手を負って帰った者には傷が残る
    name: '英雄が見習いを連れた最後の遠征から帰って引退する（4シードの合計で1回以上）',
    ...RUN_A,
    test: (rs) => {
      const fw = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'farewell').length);
      const rt = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'retire').length);
      const sc = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'scar').length);
      return { ok: sum(rt) >= 1, value: rs.map((r, i) => `${r.seed} 最後の遠征 ${fw[i]}・引退 ${rt[i]}・傷 ${sc[i]}`).join('、') };
    },
  },
  {
    // 六歩目：オークは勝ち目のない一行には威嚇して退く
    name: 'オークが強い一行に威嚇して退く（かしたれ・seed27 で1回以上）',
    ...RUN_ORC,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 13 && x.ev === 'bluff').length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    name: 'オークが貢ぎ物を取り立てる（seed23・seed41・seed30 の合計で1回以上）',
    ...RUN_TRIB,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 13 && x.ev === 'tribute').length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    name: 'ゴブリンの集落の蓄えが0でない時がある（集落のあったサンプルの1割以上）',
    ...RUN_A,
    test: (rs) => {
      const v = rs.flatMap((r) => r.samples.filter((s) => (s.settle?.campStore ?? []).length).map((s) => sum(s.settle.campStore)));
      const pos = v.filter((x) => x > 0).length;
      return { ok: v.length > 0 && pos >= 0.1 * v.length, value: `${pos}/${v.length} サンプル` };
    },
  },
  {
    // PR #2 のあと、この4シードでは10〜18日に新しい住処ができない（abc と seed7 は10日目より前からの住処が続く）。住処があるかで見る
    name: 'コボルトの住処がある（4シードのサンプルの合計の1割以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.samples.filter((s) => (s.settle?.warren ?? []).length).length);
      const all = sum(rs.map((r) => r.samples.length));
      return { ok: sum(n) >= 0.1 * all, value: rs.map((r, i) => `${r.seed} ${n[i]}/${r.samples.length}`).join('、') };
    },
  },
  {
    // 大ネズミは天井の裂け目や横穴から少しずつ来ては去るので、ある tick に0匹でも絶えたとは限らない（変更前のコードでも abc は0匹と数匹を行き来する）。来つづけるかで見る
    name: '大ネズミが来つづける（4シードの合計で10匹以上来た）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.births.filter((b) => b.k === 2 && b.origin !== 'born').length);
      return { ok: sum(n) >= 10, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 七巡目：地表の横穴が開いたあとでも、絶えかけたら天井の割れ目から入り直す（abc と seed7 は変更前のコードで0匹の日が続く）
    name: '大ネズミが割れ目から入り直す（4シードで1回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 2 && x.ev === 'reenter').length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 七巡目：取り立ては腹を空かせたときに、要る分（腹の空き＝120まで）を、蓄えの半分まで。空振り（0）はログに残さない
    name: 'オークの取り立ては1回につき1〜120',
    ...RUN_TRIB,
    test: (rs) => {
      const t = rs.flatMap((r) => r.settle.filter((x) => x.k === 13 && x.ev === 'tribute'));
      const v = t.length ? sum(t.map((x) => x.n ?? 0)) / t.length : 0;
      return { ok: t.length > 0 && t.every((x) => x.n >= 1 && x.n <= 120), value: `${t.length} 回、平均 ${v.toFixed(0)}` };
    },
  },
  {
    // 道が見つからないとき、壁に押しつけて足踏みし続けず、近づけるだけ近づいて立ち止まる（変更前のコードでは4シードの合計で約640回、変更後は約20回）
    name: '道が見つからないまま壁際で足踏みしない（4シードの合計で40回以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.stuck.filter((x) => countsAsStuck(x) && x.nopath >= 0.5).length);
      return { ok: sum(n) <= 40, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 焚き火の席が壁の中に置かれ、休むあいだ席へ向かって足踏みし続けることがない（変更前のコードでは4シードの合計で約110回、変更後は約15回）
    name: '冒険者が足踏みしない（4シードの合計で40回以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.stuck.filter((x) => countsAsStuck(x) && x.k === 25).length);
      return { ok: sum(n) <= 40, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 掘り出した土の瓦礫を生き物のいるマスに置かない。それでも壁や瓦礫に埋まった生き物は、安全策で床へ出る（その回数が少ないこと）
    name: '壁や瓦礫に埋まる生き物がほとんどいない（4シードの合計で床へ出たのが10回以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.ev === 'unbury').length);
      return { ok: sum(n) <= 10, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 情報パネルのための「いきさつ」（src/eco/notes.ts）：死骸には死んだ理由が、落とし物と金貨の山には持ち主が覚えられ、セーブに入る（18日目の日次スナップショットの eco.NT）。
    // 覚え書きは判断に使わないので、数は展開に関わらない。死骸の分は4シードとも数十、持ち主の分は数個〜数十ある
    name: '死骸と落とし物のいきさつがセーブに残る（各シードで死骸10件以上、合計で持ち主のわかる物10件以上）',
    ...RUN_A,
    test: (rs) => {
      const DEATH = ['eaten', 'fight', 'killed', 'starve', 'burned', 'crushed', 'dried', 'other', 'petrified'];
      const nt = rs.map((r) => ((r.state(r.to)?.eco?.NT ?? []) as (number | string)[][]).filter((a) => (a[1] as number) > r.from * 14400));
      const dead = nt.map((a) => a.filter((x) => DEATH.includes(x[2] as string)).length);
      const own = nt.map((a) => a.filter((x) => ['fell', 'spent', 'stash'].includes(x[2] as string) || (x[2] === '' && (x[5] as number) >= 0)).length);
      return { ok: dead.every((n) => n >= 10) && sum(own) >= 10, value: rs.map((r, i) => `${r.seed} 死骸${dead[i]}・物${own[i]}`).join('、') };
    },
  },
  {
    // 若い竜の炎は口元から燃え始め（以前は口元から2.8マスに火がつかず、すぐそばの獲物へ吐き続けても焼けなかった）、
    // 飛んでいるコウモリなども、吐いている炎そのものに当たれば焼ける（以前は飛んでいれば焼けなかった）。
    // #31 の main の10日目から続けると seed4 は 14〜17日目に若い竜がいる。狩りを打ち合いにした後（0日目から）は seed4 では起きず、seed7・seed23 で起きる。どちらのスナップショットから始めても通るよう、3シードの合計で見る
    name: 'ドラゴンの炎で飛ぶ者（コウモリ・ワイバーン・ウィスプ）が焼ける（seed4・seed7・seed23 の合計で1回以上）',
    seeds: ['seed4', 'seed7', 'seed23'],
    from: 10,
    to: 18,
    test: (rs) => {
      const all = rs.map((r) => r.deaths.filter((x) => x.cause === 'burned' && x.by === 24));
      const fly = all.map((a) => a.filter((x) => x.k === 1 || x.k === 23 || x.k === 0).length);
      return { ok: sum(fly) >= 1, value: rs.map((r, i) => `${r.seed} 炎で死んだ${all[i].length}（うち飛ぶ者${fly[i]}）`).join('、') };
    },
  },
  {
    // ミノタウロス（src/eco/monsters.ts）：深部の行き止まりの縄張りで暮らし、仕留めた獲物を寝床まで引きずる（settle の drag）。
    // 迷路をなくした変更のコードで0日目から実行すると、abc・seed30・seed5 は25日のうちに何度も引きずる（16シード×25日で14シード）
    name: 'ミノタウロスが獲物を仕留めて寝床まで引きずる（abc・seed30・seed5 の合計で仕留める3回・引きずる1回以上）',
    seeds: ['abc', 'seed30', 'seed5'],
    from: 10,
    to: 18,
    test: (rs) => {
      const kill = rs.map((r) => r.deaths.filter((x) => x.by === 15 && (x.cause === 'eaten' || x.cause === 'fight')).length);
      const drag = rs.map((r) => r.settle.filter((x) => x.k === 15 && x.ev === 'drag').length);
      return { ok: sum(kill) >= 3 && sum(drag) >= 1, value: rs.map((r, i) => `${r.seed} 仕留めた${kill[i]}・引きずった${drag[i]}`).join('、') };
    },
  },
  {
    name: '四つの保存則がずれない',
    ...RUN_A,
    test: (rs) => {
      const d = Math.max(0, ...rs.flatMap((r) => r.samples.map((s) => Math.max(Math.abs(s.nutrientDrift), Math.abs(s.goldDrift), Math.abs(s.rockDrift), Math.abs(s.manaDrift ?? 0)))));
      return { ok: d === 0, value: `最大 ${d}` };
    },
  },
];
