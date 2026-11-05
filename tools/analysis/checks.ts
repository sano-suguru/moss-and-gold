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
import { World } from '../../src/world';
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
  /** 短い引っかかり（歩く姿のまま3秒で正味半タイルも進まない。sim.ts の hitch.jsonl） */
  hitch: any[];
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
// リビングアーマーは、冒険者が倒れて武具の溜まった所でしか生まれず、どのシードで起きるかが版ごとに入れ替わる。1シードの展開で項目が揺れないよう、出やすいシードを広く並べる。
// 迷路をなくした（#41）main の10〜18日目の取り込みは かしたれ 24・seed23 20・seed5 5・seed17 3・seed40 1、
// 炎を傷に変えたコード（#42。冒険者の倒れる数が減った）では かしたれ 16・seed5 14・seed17 8・seed8 5。
// #42 を取り込んだ main の10〜18日目では、甲冑が立ち上がるのは16シードの合計で8回だけ（seed23 2・seed7 2・かしたれ 1・seed4 1・seed30 1・seed41 1）で、
// 以前の組（かしたれ・seed5・seed17・seed23・seed8・seed40）では3回になり項目が落ちた。立ち上がったシードの組にする
// （取り込みは かしたれ 7・seed23 8・seed4 2・seed7 2、崩れるのは6回。どのシードもほかの項目で実行しているので、実行するシードは増えない）
// コボルトを住処へ歩いて行ける口から入れたコード（#45 のあと）では、かしたれと seed30 の展開が変わり、16シードを0日目から通しで実行したときの10〜18日目は、
// 立ち上がるのが seed40 2・seed4 1・seed41 1（main は かしたれ 1・seed30 1 も）、取り込みは seed4 2 だけ（main は かしたれ 3・seed4 2・seed30 1）、崩れるのは seed40 2・seed4 1。
// 25日を通した回数は変わらない（立ち上がる 21→22、取り込み 32→30、崩れる 20→20）が、この8日の間ではまれなので、seed40 を足し、取り込みの目安を下げた
// スケルトンが装備を拾わなくなった（骨は体の未練、鎧は道具の未練）コードで、CI と同じく main（b103425）の10日目から始めると、10〜18日目の甲冑は
// 16シードの合計で立ち上がる3回・取り込み0回になり、どのシードの組でも項目が落ちた（main 自身でも立ち上がる4回・取り込み2回で、ぎりぎりだった）。
// 手元で HEAD（0日目から作業ツリーで実行した状態）の10日目から始めたときは通っていたので、始め方で結果が分かれていた。
// 甲冑が育つ15〜23日目にする。この8日間は、main の25日の実行でも作業ツリーの25日の実行でも、下の7シードで立ち上がり・取り込み・崩れるが起きる
// （main：立ち上がる9・取り込み11・崩れる7、作業ツリー：9・11・5。どちらも かしたれ が多く、seed6・seed40・seed41・seed18・seed17・seed30 に散らばる）
// スライムが死骸を分け合い、湿った床で暮らすようにしたコードでは、25日を0日目から通すと15〜23日目の立ち上がりは main 9 → 11 回で、
// 起きるシードが入れ替わった（main：かしたれ 4・seed41 3・seed23 1・seed17 1、作業ツリー：abc 3・seed41 3・seed35 3・seed5 1・seed27 1）。
// CI と同じく main の15日目から始めると、上の7シードでは立ち上がり2回・取り込み0回で落ちたので、abc・seed35・seed5 を足す
const RUN_ARMOR = { seeds: ['かしたれ', 'seed6', 'seed40', 'seed41', 'seed18', 'seed17', 'seed30', 'abc', 'seed35', 'seed5'], from: 15, to: 23 };
// 僧侶が亡骸の前で祈る場面は、冒険者の亡骸があり、そのそばを僧侶のいる一行が安全に通るときだけ起きる（16シード×25日で13シード・30回ほど）。
// 0日目から作業ツリーで実行した10〜18日目では seed5 2・seed17 2・seed4 1・seed6 1・seed27 1・seed30 1。RUN_A の4シードでは0回だった
const RUN_BLESS = { seeds: ['seed5', 'seed17', 'seed4', 'seed6', 'seed27', 'seed30'], from: 10, to: 18 };
const RUN_ORC = { seeds: ['かしたれ', 'seed27'], from: 10, to: 18 };
// オークの取り立ては、従う集落に蓄えがたまったときだけ起きるまれな出来事（16シード×25日で約25回、起きるのは6シードほど）。
// いまのコードで10〜18日目に起きているシードを選ぶ。焚き火の夜襲の二歩目（#29）のコードで、
// 0日目から実行すると abc 11.7日目・seed27 15.5日目から何度も、#28 の main の10日目から続けると seed23 15.8日目ほか（どちらでも起きるシードはない）。
// 以前の かしたれ は六歩目（#16）のあと、seed41・seed18 は焚き火の眠り（#28）のあと、18日目までに起きなくなった。
// クモの巣の変更（#38）のコードで0日目から実行すると、abc・seed27・seed23 では起きず、seed41・seed30 で起きる（#37 の main では seed23・seed41・seed30 で起きる）。
// どちらのスナップショットから始めても通るよう、seed23・seed41・seed30 にしていた。
// 壁から床へ1マスだけ突き出た岩を作らないようにした地形（#49）では、0日目から実行した10〜18日目に seed23・seed41 で起きず、seed30 は1回か0回。
// 起きるのは abc 6・seed7 8・seed17 2（#48 を取り込む前のコードでは abc 6・seed17 7・seed35 4）なので、abc・seed7・seed17 にする
// （どのシードもほかの項目で10〜18日目を実行しているので、実行するシードは増えない）
// スライムが死骸を分け合うようにした main（#54）では、10〜18日目に abc・seed7・seed17 で起きなくなった（16シードで seed35 6・seed30 3・seed40 1）。
// 苔の無いコウモリを外へ出すコードを main の10日目から続けても seed35 4・seed30 3・seed40 1・かしたれ 1 なので、seed35・seed30・seed40 にする
// （どのシードもほかの項目で10〜18日目を実行しているので、実行するシードは増えない）
const RUN_TRIB = { seeds: ['seed35', 'seed30', 'seed40'], from: 10, to: 18 };
// 倒れた冒険者がヴァンパイアの眷属として起き上がるのは、16シードの10〜18日目で2〜3回のまれな出来事で、どのシードで起きるかは地形と展開で入れ替わる。
// #49 の地形では RUN_A の4シードで起きず、はじまりの洞窟 1・seed40 2（#48 を取り込む前のコードでは seed6 1・seed35 1）。
// どちらでも起きるよう4シードを並べる（どれもほかの項目で10〜18日目を実行しているので、実行するシードは増えない）
const RUN_THRALL = { seeds: ['はじまりの洞窟', 'seed40', 'seed6', 'seed35'], from: 10, to: 18 };

export const CHECKS: Check[] = [
  {
    // ヴァンパイア（src/eco/vampire.ts、src/eco/thrall.ts）：コウモリが獲物を見つけ、倒された者が眷属として起き上がる
    name: 'ヴァンパイアのコウモリが獲物の上を旋回し、倒された者が眷属として起き上がる（4シードで旋回1回・眷属1体以上）',
    ...RUN_A,
    test: (rs) => {
      const sc = rs.map((r) => r.settle.filter((x) => x.k === 19 && x.ev === 'scout').length);
      const th = rs.map((r) => r.births.filter((x) => x.k === 30).length);
      return { ok: sum(sc) >= 1 && sum(th) >= 1, value: rs.map((r, i) => `${r.seed} 旋回${sc[i]}・眷属${th[i]}`).join('、') };
    },
  },
  {
    // ヴァンパイア（src/eco/vampire.ts、src/eco/bat.ts）：日暮れにコウモリを呼び寄せ、コウモリに群がられて足止めされた獲物に打ちかかる。
    // 足止めは RUN_A の4シードの10〜18日目では合わせて2〜3回しか起きず、1シードの展開が分かれただけで落ちていた（#50）。
    // 0日目から実行した10〜18日目で、呼び寄せは seed40 2〜4・seed6 1〜2、足止めは seed40 8〜14・seed27 7・seed18 4（#48 の main と #50）
    name: 'ヴァンパイアが日暮れにコウモリを呼び寄せ、コウモリに群がられた獲物に打ちかかる（4シードで呼び寄せ1回・足止め2回以上）',
    seeds: ['seed40', 'seed27', 'seed18', 'seed6'],
    from: 10,
    to: 18,
    test: (rs) => {
      const ca = rs.map((r) => r.settle.filter((x) => x.k === 19 && x.ev === 'callBats').length);
      const pin = rs.map((r) => r.settle.filter((x) => x.k === 19 && x.ev === 'pin').length);
      return { ok: sum(ca) >= 1 && sum(pin) >= 2, value: rs.map((r, i) => `${r.seed} 呼び寄せ${ca[i]}・足止め${pin[i]}`).join('、') };
    },
  },
  {
    // ヴァンパイア（src/eco/vampire.ts の vampRaiseFallen）：倒れた冒険者の亡骸にかがみ込み、眷属として起き上がらせる
    name: '倒れた冒険者がヴァンパイアの眷属として起き上がる（4シードで1体以上）',
    ...RUN_THRALL,
    test: (rs) => {
      const n = rs.map((r) => r.births.filter((x) => x.k === 30 && x.from === 25).length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // リビングアーマー（src/eco/armor.ts）：倒れた冒険者の武具に未練が宿り、溜まり場で甲冑が立ち上がる
    name: 'リビングアーマーが武具の溜まり場から立ち上がる（10シードの15〜23日目で4回以上）',
    ...RUN_ARMOR,
    test: (rs) => {
      const n = rs.map((r) => r.births.filter((x) => x.k === 29 && x.origin === 'gear').length);
      return { ok: sum(n) >= 4, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // リビングアーマー：床の武器と盾を取り込み、倒れるかマナが尽きると武具が床に散らばる
    name: 'リビングアーマーが武具を取り込み、崩れて散らばる（10シードの15〜23日目で取り込み2回以上・崩れる2回以上）',
    ...RUN_ARMOR,
    test: (rs) => {
      const a = rs.map((r) => r.settle.filter((x) => x.k === 29 && x.ev === 'absorb').length);
      const f = rs.map((r) => r.settle.filter((x) => x.k === 29 && x.ev === 'fall').length);
      return { ok: sum(a) >= 2 && sum(f) >= 2, value: rs.map((r, i) => `${r.seed} 取り込み${a[i]}・崩れる${f[i]}`).join('、') };
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
    // 亡骸を清める：僧侶のいる一行が、冒険者の亡骸の前で立ち止まって祈る（清められた亡骸は起き上がらない。src/eco/roster.ts の blessBrace）
    name: '僧侶が冒険者の亡骸の前で祈って清める（6シードの合計で2回以上）',
    ...RUN_BLESS,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'bless').length);
      return { ok: sum(n) >= 2, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
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
    // （1シードの揺れに左右されないよう、回数は4シードの合計で見る。クモの巣の変更（#38）のあと、abc の10〜18日目は10回ほどになった。
    // 迷路をなくして地形が変わったあと、seed8 の10〜18日目はワーム・クモの巣・ワイバーンの一口が多く、打ち合い31に対し一口34になったので、一口との比べも合計で見る）
    name: '狩りは打ち合って仕留めて食べる（4シードの合計で80回以上、合計で一口で食べたより多い）',
    ...RUN_A,
    test: (rs) => {
      const sl = rs.map((r) => r.deaths.filter((x) => x.cause === 'eaten' && x.slain === 1).length);
      const gu = rs.map((r) => r.deaths.filter((x) => x.cause === 'eaten' && !x.slain).length);
      return { ok: sum(sl) >= 80 && sum(sl) > sum(gu), value: rs.map((r, i) => `${r.seed} ${sl[i]}（一口 ${gu[i]}）`).join('、') };
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
    name: 'オークが貢ぎ物を取り立てる（seed35・seed30・seed40 の合計で1回以上）',
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
    // スライムは死骸を包み込んで食べ、育つと二つに分かれる。死んだスライムの予約が死骸に残って、どのスライムも食べられなくなっていたころ（371df4e8baa4）は、
    // 生まれては飢え死にを繰り返し、この4シードの10〜18日目でスライムがいたサンプルは 64/128（abc 9・seed7 5）だった。
    // 死骸を分け合い、湿った床で養分を吸い、とても湿った床でも生まれるようにしたコードでは、main の10日目から始めて 103/132（かしたれ 33・seed8 21・abc 27・seed7 22）
    name: 'スライムが死骸を食べて残りつづける（4シードの合計で、スライムがいたサンプルが6割以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.samples.filter((s) => (s.counts[5] ?? 0) > 0).length);
      const all = sum(rs.map((r) => r.samples.length));
      return { ok: sum(n) >= all * 0.6, value: rs.map((r, i) => `${r.seed} ${n[i]}/${r.samples.length}`).join('、') };
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
    // 歩き方の止まる番で、その場から動いていない者は、描画で立ち姿になる（src/creatureView.ts。止まる番かは src/eco/move.ts の gaitPaused）。
    // 引っかかりの判定もそれに合わせて、止まる番を歩いていないとみなす（sim.ts の watchWalk）。
    // 止まる番も歩く姿で描いていたとき（#52 の判定）は、main の10〜18日目で大ネズミの引っかかりが4シードの合計で約8400回
    // （かしたれ 1364・seed8 1950・abc 1706・seed7 3417）。多くは「止まってあたりをうかがう」番に、その場で足を動かしていたもの。
    // いまの判定では約3000回（かしたれ 427・seed8 683・abc 693・seed7 1180）
    name: '大ネズミが止まる番に足踏みしない（4シードの合計で引っかかりが4500回以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 2).length);
      return { ok: sum(n) <= 4500, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // ねぐらのまわりに苔が見つからないコウモリは、その夜は縦穴から外へ餌を取りに出る（src/eco/bat.ts）。
    // 以前はねぐらのそばで更新のたびに向きを選び直して飛び、その場で震えて引っかかって見えていた。
    // main の10〜18日目では、コウモリの引っかかりが4シードの合計で約21400回（かしたれ 2807・seed8 8294・abc 3749・seed7 6545）、
    // 直したコードを main の10日目から続けると約2400回（かしたれ 75・seed8 758・abc 882・seed7 641）
    name: 'コウモリがねぐらのそばで震えない（4シードの合計で引っかかりが6000回以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 1).length);
      return { ok: sum(n) <= 6000, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
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
    // ドラゴンの炎（src/eco/fire.ts）：口元から細い扇で吐き、扇の中と燃える床で焼かれた者が倒れる。
    // 以前は飛ぶ者（コウモリ・ワイバーン・ウィスプ）が炎に当たると即死していたのでそれを見ていたが、炎を口元から細い扇で吐くようにしたあと（#42）、
    // 迷路をなくした（#41）main の10日目から続けると、飛ぶ者が焼けるのは16シードで seed7 の3回だけになった。焼け死ぬ者すべてで見る。
    // main（abc 41・seed7 22・seed41 42・seed4 37）でも、細い扇のコード（abc 7・seed7 7・seed41 12・seed4 1）でも起きるシードを並べていた。
    // その後の main（#53）の10〜18日目では abc 0・seed7 1・seed41 0・seed4 3 になり、苔の無いコウモリを外へ出すコードを main の10日目から続けると
    // abc 0・seed7 2・seed41 0・seed4 0 で項目が落ちた（25日を通した焼け死には main 52件・そのコード 79件で、減ってはいない）。
    // main の0日目から／そのコードの0日目から／そのコードを main の10日目から、のどの10〜18日目でも起きるシードにする
    // （かしたれ 3・3・3、はじまりの洞窟 5・5・4、seed8 4・4・3、seed6 2・4・3。どれもほかの項目で10〜18日目を実行しているので、実行するシードは増えない）
    name: 'ドラゴンの炎で焼け死ぬ（かしたれ・はじまりの洞窟・seed8・seed6 の合計で3回以上・焼け死んだシード2つ以上）',
    seeds: ['かしたれ', 'はじまりの洞窟', 'seed8', 'seed6'],
    from: 10,
    to: 18,
    test: (rs) => {
      const all = rs.map((r) => r.deaths.filter((x) => x.cause === 'burned' && x.by === 24));
      const fly = all.map((a) => a.filter((x) => x.k === 1 || x.k === 23 || x.k === 0).length);
      return { ok: sum(all.map((a) => a.length)) >= 3 && all.filter((a) => a.length > 0).length >= 2, value: rs.map((r, i) => `${r.seed} 炎で死んだ${all[i].length}（うち飛ぶ者${fly[i]}）`).join('、') };
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
  {
    // 溶岩をはさんだ空洞（src/world.ts の applyDig・openPocket）：溶岩のマスには閉じた空洞の印が付かないので、空洞を開くときに溶岩を越えて広げる。
    // 越えないと、溶岩の溜まりで分かれた空洞の片側が開いたときや、開いた側から溶岩の隣を掘り抜いたときに、溶岩の向こうの床が閉じたまま残る
    // （直す前の main では、16シード中8シードで起き、seed30・seed35・seed40 は25日のうち19〜20日、はじまりの洞窟は16日残っていた）。
    // 18日目の地形（日次スナップショットの掘削のログを作業ツリーのコードで再生したもの）で、開いた床に接する溶岩の溜まりの向こうに、閉じた空洞が残っていないかを見る
    name: '溶岩の向こうに閉じた空洞が残らない（seed30・seed35・seed40・はじまりの洞窟で、開いた溶岩の溜まりが合計1つ以上・残った閉じた床0マス）',
    seeds: ['seed30', 'seed35', 'seed40', 'はじまりの洞窟'],
    from: 10,
    to: 18,
    test: (rs) => {
      const res = rs.map((r) => {
        const w = new World(r.seed);
        for (const op of (r.state(r.to)?.digs ?? []) as number[]) (w as any).replayOp(op);
        const m = w.map;
        const seen = new Uint8Array(m.solid.length);
        let pools = 0;
        let left = 0;
        for (let s = 0; s < m.solid.length; s++) {
          if (!m.lava[s] || seen[s]) continue;
          const q = [s];
          seen[s] = 1;
          let open = false;
          let sealedT = 0;
          for (let i = 0; i < q.length; i++) {
            const c = q[i];
            if (m.sealed[c] && !m.solid[c]) sealedT++;
            for (const n of [c + 1, c - 1, c + m.w, c - m.w]) {
              if (m.solid[n] || seen[n]) continue;
              if (m.lava[n] || m.sealed[n]) {
                seen[n] = 1;
                q.push(n);
              } else open = true;
            }
          }
          if (open) {
            pools++;
            left += sealedT;
          }
        }
        return { pools, left };
      });
      return { ok: sum(res.map((x) => x.pools)) >= 1 && sum(res.map((x) => x.left)) === 0, value: rs.map((r, i) => `${r.seed} 開いた溜まり${res[i].pools}・残った${res[i].left}`).join('、') };
    },
  },
  {
    // 歩いて行ける場所の判定（src/eco/islands.ts の regionOf）：溶岩も壁とみなす。溶岩の溜まりをはさんだ二つの開いた場所は、別の領域になる
    // （溶岩を通れる床として扱っていたときは同じ領域になり、溶岩の向こうのコボルトの住処が島とみなされず、入口から来たコボルトが溶岩の手前で立ち往生した）。
    // 18日目の地形（日次スナップショットの掘削のログを作業ツリーのコードで再生したもの）で、まわりの床が二つ以上の領域に分かれる溶岩の溜まりを数える。
    // #49（地形の生成の変更）の前の main の16シードの18日目では seed18・seed27・seed30 で1つずつあった。
    // #49 のあとの main では seed18・seed4・seed6 で1つずつ（10日目でも seed18 2・seed6 1）で、seed27・seed30 では0になったので、シードを替えた。
    // 溜まりが場所を分けるかは、それまでに生き物が掘った跡で変わる。スライムが死骸を分け合うようにしたコードを0日目から通すと
    // 18日目は seed5 1・seed6 1・seed18 2（seed4 は0）になったので、seed5 を足す
    name: '溶岩の溜まりをはさんだ場所が別の領域になる（seed18・seed4・seed6・seed5 の合計で、場所を分ける溶岩の溜まりが2つ以上）',
    seeds: ['seed18', 'seed4', 'seed6', 'seed5'],
    from: 10,
    to: 18,
    test: (rs) => {
      const n = rs.map((r) => {
        const w = new World(r.seed);
        for (const op of (r.state(r.to)?.digs ?? []) as number[]) (w as any).replayOp(op);
        const m = w.map;
        const seen = new Uint8Array(m.solid.length);
        let pools = 0;
        for (let s = 0; s < m.solid.length; s++) {
          if (!m.lava[s] || seen[s]) continue;
          const q = [s];
          seen[s] = 1;
          const regs = new Set<number>();
          for (let i = 0; i < q.length; i++) {
            const c = q[i];
            for (const nb of [c + 1, c - 1, c + m.w, c - m.w]) {
              if (m.solid[nb]) continue;
              if (m.lava[nb]) {
                if (!seen[nb]) {
                  seen[nb] = 1;
                  q.push(nb);
                }
              } else {
                const g = w.eco.regionOf(nb);
                if (g >= 0) regs.add(g);
              }
            }
          }
          if (regs.size >= 2) pools++;
        }
        return pools;
      });
      return { ok: sum(n) >= 2, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // コボルトが住処に加わりに来るとき（src/eco/arrivals.ts）は、その住処へ歩いて行ける地表の横穴からだけ入る（pickDoor の reach）。
    // 歩いて行けない横穴から入ると、住処を目指してさまよい、飢えていた。main の10〜18日目では seed30 で23匹、かしたれで14匹が飢え死にした
    // （#45 のあとの main。直したコードで0日目から通しで実行すると、この間の飢え死にはどちらも0匹。
    // main の10日目から始めると、10日目より前に行けない住処へ加わっていた者が seed30 で5匹ほど飢える）
    name: 'コボルトが行けない住処を目指して飢えない（seed30・かしたれ の10〜18日目で、コボルトの飢え死にが合計10匹以下。main は37匹）',
    seeds: ['seed30', 'かしたれ'],
    from: 10,
    to: 18,
    test: (rs) => {
      const n = rs.map((r) => r.deaths.filter((x) => x.k === 10 && x.cause === 'starve').length);
      return { ok: sum(n) <= 10, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
];
