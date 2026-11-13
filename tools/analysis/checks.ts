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
/**
 * ゴブリンの夜の盗み：main の10〜18日目に盗みに出たのは seed40 5回・seed30 5回・seed17 3回・abc 1回（ほかの多くのシードは0〜1回）。
 * （以前は RUN_A の4シードで見ていたが、その4シードでは10〜18日目に合わせて1回しか起きず、ほかの変更で展開が分かれただけで落ちた）
 */
const RUN_RAID = { seeds: ['seed40', 'seed30', 'seed17', 'abc'], from: 10, to: 18 };
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
// 起きるシードは変更のたびに入れ替わり、#60 の後の main では、上の10シードの15〜23日目の立ち上がりが main 自体で2回になり項目が落ちた。
// まれな出来事の項目（RUN_WIDE）と同じく、16シードの合計で見る（16シードでは main 8・ヴァンパイアに従うコウモリを直したコードの0日目から 7・
// main の15日目から 6、取り込みは 11・10・7、崩れるのは 6・8・4。15〜23日目に実行するシードは10から16に増える）
const RUN_ARMOR = { seeds: ['abc', 'かしたれ', 'はじまりの洞窟', 'seed4', 'seed5', 'seed6', 'seed7', 'seed8', 'seed40', 'seed41', 'seed18', 'seed27', 'seed23', 'seed35', 'seed17', 'seed30'], from: 15, to: 23 };
// まれな出来事（僧侶が亡骸の前で祈る。以前はオークの取り立ても）を見るシードの組。どのシードで起きるかは変更のたびに入れ替わり、
// 数シードを選ぶやり方では、ほかの PR の変更で展開が分かれるたびに落ちて、シードを選び直していた（#55・#57・#58）。
// ほかの項目で10〜18日目を実行している14シードに seed17 を足し、15シードの合計で見る（実行するシードは seed17 の1つだけ増える）。
// アリの混雑を直したコード（main #58 の後）では、10〜18日目の15シードの合計が、祈り main 10・0日目から 6・main の10日目から 7、
// 取り立て main 10・5・2（取り立ては main の10日目から続けると seed17 でしか起きなかった）
const RUN_WIDE = { seeds: ['abc', 'かしたれ', 'はじまりの洞窟', 'seed4', 'seed5', 'seed6', 'seed7', 'seed8', 'seed40', 'seed41', 'seed18', 'seed27', 'seed35', 'seed30', 'seed17'], from: 10, to: 18 };
const RUN_BLESS = RUN_WIDE;
// オークの貢ぎ物の取り立て（src/eco/orc.ts の collectTribute）は、check の項目にしない。
// main でも16シード×25日で13回、10〜18日目は1回（seed7）、15〜23日目は6回（4シード）しかなく、
// コボルトのスリングを足した版では、展開が分かれただけで、15シードの10〜18日目が0回にも、25日で30回ほどにもなった。
// どのシードを選んでも短い実行では確かめられないので、ab の「見せたい場面」の表（lib/moments.ts の tribute）で起きたシードの数を追う
// （以前は数シードを選び、起きるシードが入れ替わるたびに選び直し、#59 からは RUN_WIDE の15シードの合計で見ていた）
// 倒れた冒険者がヴァンパイアの眷属として起き上がる場面（src/eco/vampire.ts の vampRaiseFallen）は、check の項目にしない。
// 16シードの10〜18日目で main でも1体（縦穴のコウモリのねぐらを直したコードを main の10日目から続けると0体）、10〜25日目でも0〜5体のまれな出来事で、
// どのシードを選んでも短い実行では確かめられない。ヴァンパイアが倒した者を眷属にする仕組みは、RUN_A の項目（旋回と眷属）で確かめ、
// 冒険者の亡骸から起き上がる場面は、ab の「見せたい場面」の表（lib/moments.ts）で起きたシードの数を追う

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
    // 足止めは数シードでは1シードの展開が分かれただけで落ちていた（#50。4シードの10〜18日目で2〜3回）。ヴァンパイアに技
    // （src/eco/vampskill.ts）を足すと、一行に技を使う時間のぶん狩りが減り、さらに揺れやすくなったので、15シードの合計で見る。
    // 0日目から実行した10〜18日目の15シードの合計で、main は足止め27・呼び寄せ20、技を足したコードは足止め21・呼び寄せ34
    name: 'ヴァンパイアが日暮れにコウモリを呼び寄せ、コウモリに群がられた獲物に打ちかかる（15シードで呼び寄せ4回・足止め8回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const ca = rs.map((r) => r.settle.filter((x) => x.k === 19 && x.ev === 'callBats').length);
      const pin = rs.map((r) => r.settle.filter((x) => x.k === 19 && x.ev === 'pin').length);
      return { ok: sum(ca) >= 4 && sum(pin) >= 8, value: `呼び寄せ ${sum(ca)}、足止め ${sum(pin)}` };
    },
  },
  {
    // リビングアーマー（src/eco/armor.ts）：倒れた冒険者の武具に未練が宿り、溜まり場で甲冑が立ち上がる
    name: 'リビングアーマーが武具の溜まり場から立ち上がる（16シードの15〜23日目で4回以上）',
    ...RUN_ARMOR,
    test: (rs) => {
      const n = rs.map((r) => r.births.filter((x) => x.k === 29 && x.origin === 'gear').length);
      return { ok: sum(n) >= 4, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // リビングアーマー：溜まり場に残った武具や巡回の途中で見つけた床の武具を一つずつ取り込み、倒れるかマナが尽きると武具が床に散らばる。
    // 以前は立ち上がるときに溜まり場の武具を近い順に5個まで一度に体にしていたので、剣や盾が残らず、取り込みはまれだった
    // （#66 の main の16シードの15〜23日目で2回。大ネズミの変更を main の15日目から続けると1回になり、この項目が落ちた）。
    // 芯の分だけを体にして残りを拾い集め、床の武具がまわりのマナを吸って1個からでも立ち上がるようにしたコード（#67）では、
    // 立ち上がり・取り込み・崩れるが 0日目から 62・206・56、main の15日目から 53・140・47
    name: 'リビングアーマーが武具を取り込み、崩れて散らばる（16シードの15〜23日目で取り込み6回以上・崩れる2回以上）',
    ...RUN_ARMOR,
    test: (rs) => {
      const a = rs.map((r) => r.settle.filter((x) => x.k === 29 && x.ev === 'absorb').length);
      const f = rs.map((r) => r.settle.filter((x) => x.k === 29 && x.ev === 'fall').length);
      return { ok: sum(a) >= 6 && sum(f) >= 2, value: rs.map((r, i) => `${r.seed} 取り込み${a[i]}・崩れる${f[i]}`).join('、') };
    },
  },
  {
    // リビングアーマーは、倒れずに強い一打を受けると手の武器を落とす（src/eco/armor.ts の armorShed）。強くなり続けず、打ち合うたびに強さが行き来する。
    // 16シードの15〜23日目で、0日目から 114回（9シード）、main（#66）の15日目から 78回（10シード）。main には無い仕組み
    name: 'リビングアーマーが打たれて手の武器を落とす（16シードの15〜23日目で20回以上）',
    ...RUN_ARMOR,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 29 && x.ev === 'shed').length);
      return { ok: sum(n) >= 20, value: rs.filter((r, i) => n[i]).map((r) => `${r.seed} ${n[rs.indexOf(r)]}`).join('、') || '0' };
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
    // 蓄えの乏しいゴブリンの集落から、歩いて行ける物資の置き場へ食料を取りに出て、木箱をあさって持ち帰る。
    // 集落と食料の残る置き場が両方ある日にしか起きないので、まれな出来事の項目と同じく広いシードの組で見る
    name: 'ゴブリンが物資の置き場の食料を持ち去る（15シードで2回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'cacheLoot').length);
      return { ok: sum(n) >= 2, value: rs.filter((_, i) => n[i] > 0).map((r) => `${r.seed} ${n[rs.indexOf(r)]}`).join('、') || 'なし' };
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
    // 依頼の仕組み（src/eco/quest.ts）：噂から依頼が出て、一行は重さに比例したくじで一つ引き受けて入ってくる。種類が偏らず混ざって来るか
    name: '一行が依頼を受けて入ってくる（15シードの合計で、町に依頼が出る10回以上・依頼の種類が4種類以上混ざる）',
    ...RUN_WIDE,
    test: (rs) => {
      const posted = sum(rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'quest' && !x.init).length));
      const kinds = new Map<number, number>();
      for (const r of rs) for (const x of r.settle) if (x.k === 25 && x.ev === 'enter' && x.q > 0) kinds.set(x.q, (kinds.get(x.q) ?? 0) + 1);
      const NM = ['', '宝探し', '竜退治', '魔物の狩り', '祓い', 'ゴブリン退治', '道探し'];
      return { ok: posted >= 10 && kinds.size >= 4, value: `依頼が出た ${posted}、受けて入った ${[...kinds].sort((a, b) => a[0] - b[0]).map(([q, n]) => `${NM[q]} ${n}`).join('・')}` };
    },
  },
  {
    // 依頼を果たして帰る一行の、目標を果たしてから最後の一人が帰るまでの間に、同じ依頼がまた町に出ない（鎮まるのは最後の一人が帰ったとき。src/eco/quest.ts）
    name: '果たした依頼が、その一行の帰り道にまた出ない（15シードの合計で0回）',
    ...RUN_WIDE,
    test: (rs) => {
      let n = 0;
      let tot = 0;
      for (const r of rs) {
        const a = r.settle.filter((x) => x.k === 25);
        const q = a.filter((x) => x.ev === 'quest');
        for (const e of a.filter((x) => x.ev === 'enter' && x.q > 0)) {
          const ok = a.find((x) => x.id === e.id && x.ev === 'aim' && x.reason === 1);
          const end = a.find((x) => x.id === e.id && x.ev === 'end' && x.reason === 'returned');
          if (!ok || !end) continue;
          tot++;
          if (q.some((x) => x.how === e.q && (x.to ?? 0) === (e.qk ?? 0) && x.t >= ok.t && x.t <= end.t)) n++;
        }
      }
      return { ok: n === 0, value: `果たして帰った一行 ${tot}、帰り道に同じ依頼が出た ${n}` };
    },
  },
  {
    // 依頼を受けて入った一行の依頼は、その前に必ず町の掲示に出ている（ログ「町に〇〇の依頼が出た」。掲示を覚えていないスナップショットから始めたときは、最初の作り直しの init の記録）
    name: '依頼で入った一行の依頼は、その前に町に出ている（15シードの合計で例外0）',
    ...RUN_WIDE,
    test: (rs) => {
      let n = 0;
      let tot = 0;
      for (const r of rs) {
        const a = r.settle.filter((x) => x.k === 25);
        for (const e of a.filter((x) => x.ev === 'enter' && x.q > 0)) {
          tot++;
          if (!a.some((x) => x.ev === 'quest' && x.how === e.q && (x.to ?? 0) === (e.qk ?? 0) && x.t <= e.t)) n++;
        }
      }
      return { ok: n === 0, value: `依頼で入った一行 ${tot}、その前に依頼が出ていなかった ${n}` };
    },
  },
  {
    // 依頼を果たして帰った一行の噂は、依頼が出る強さの半分まで下がる（帰った直後の掲示に同じ依頼が無い。settle の calm の left）
    name: '果たして帰った直後に、同じ依頼が掲示に残らない（15シードの合計で例外0）',
    ...RUN_WIDE,
    test: (rs) => {
      const c = rs.flatMap((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'calm'));
      const n = c.filter((x) => x.left).length;
      return { ok: c.length > 0 && n === 0, value: `噂を鎮めた一行 ${c.length}、同じ依頼が残った ${n}` };
    },
  },
  {
    // バジリスクに仲間を石にされた一行が帰ると、バジリスクの噂が強まり、狩りの依頼が出る（どの種も同じ決まり。src/eco/quest.ts）
    name: 'バジリスク狩りの依頼が出る（15シードの合計で1回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'quest' && x.how === 3 && x.to === 17).length);
      return { ok: sum(n) >= 1, value: rs.filter((_, i) => n[i] > 0).map((r) => `${r.seed} ${n[rs.indexOf(r)]}`).join('、') || 'なし' };
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
    ...RUN_RAID,
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
    // ゴブリンの流れを短くする：通り道の脇の暗がりで待ち伏せ、通路を行く一行の最後尾から荷を掠め取る。
    // 以前は RUN_A の4シードで1回以上を見ていたが、まれな出来事（16シード×25日で30〜52回）で、どの版でも4シードの10〜18日目では0〜4回しか起きず、
    // 大ネズミのおびえる動きを直したコードを main（#68）の10日目から続けると0回になって落ちた。ほかのまれな場面の項目と同じく、RUN_WIDE の15シードの合計で見る。
    // 15シードの10〜18日目で、main（#68）の0日目から 10回、main（#67）の0日目から 19回、大ネズミを直したコードの0日目から 24回、main の10日目から 17回
    name: 'ゴブリンが通路を行く一行の最後尾から荷を掠め取る（15シードの合計で4回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const st = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'stalk').length);
      const rob = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'rob' && x.how === 'snatch').length);
      return { ok: sum(rob) >= 4, value: `${sum(rob)}回（つけた ${sum(st)}回。${rs.filter((r, i) => rob[i]).map((r) => `${r.seed} ${rob[rs.indexOf(r)]}`).join('、')}）` };
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
    name: '僧侶が冒険者の亡骸の前で祈って清める（15シードの合計で2回以上）',
    ...RUN_BLESS,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'bless').length);
      return { ok: sum(n) >= 2, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 冒険者でない亡骸を清める：僧侶のいる一行が、起き上がりうる所の人型の亡骸か、倒されたアンデッドの残骸の前で祈る。骨は祈りの終わりに金の光の粒になって崩れる
    // （src/eco/roster.ts の blessBrace・blessCrumble）。どのシードで起きるかは展開で変わるので、15シードの合計で見る
    // （main の10日目から実行した10〜18日目の8シードで、人型の亡骸15回・残骸12回、8シード中7シードで起きた）
    name: '僧侶が人型の亡骸かアンデッドの残骸を清め、骨が金の粒に崩れる（15シードの合計で清め5回・崩れる3回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && (x.ev === 'blessKin' || x.ev === 'blessUndead')).length);
      const cr = rs.map((r) => r.settle.filter((x) => x.ev === 'crumble').length);
      return { ok: sum(n) >= 5 && sum(cr) >= 3, value: `清め ${sum(n)}（${n.filter((v) => v > 0).length}シード）、崩れる ${sum(cr)}（${cr.filter((v) => v > 0).length}シード）` };
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
    // 六歩目：オークは勝ち目のない一行には威嚇して退く。オークのいるシードは展開で入れ替わるので、15シードの合計で見る
    // （以前は かしたれ・seed27 で見ていたが、main でも10〜18日目は かしたれ 8・seed27 0 で、コボルトのスリングを足した版では
    //  展開が分かれただけで かしたれ も0回になった。15シードの合計は main 286回・12シード、スリングを足した版 215回・11シード）
    name: 'オークが強い一行に威嚇して退く（15シードの合計で20回以上・4シード以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 13 && x.ev === 'bluff').length);
      const seeds = n.filter((v) => v > 0).length;
      return { ok: sum(n) >= 20 && seeds >= 4, value: `${sum(n)}回（${seeds}シード）` };
    },
  },
  {
    // オークの技（src/eco/orcskill.ts）：雄叫びで小物を逃がすか後衛を怖ませ、鎖のついた投げ斧を当てる。オークのいるシードが版ごとに入れ替わるので、15シードの合計で見る
    name: 'オークが雄叫びで相手をおびえさせ、投げ斧を当てる（15シードの合計で雄叫び4回・投げ斧4回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const roar = rs.map((r) => r.settle.filter((x) => x.k === 13 && x.ev === 'orcRoar' && x.n > 0).length);
      const axe = rs.map((r) => r.settle.filter((x) => x.k === 13 && x.ev === 'axeHit').length);
      return { ok: sum(roar) >= 4 && sum(axe) >= 4, value: `雄叫び ${sum(roar)}（${roar.filter((n) => n > 0).length}シード）、投げ斧 ${sum(axe)}（${axe.filter((n) => n > 0).length}シード）` };
    },
  },
  {
    // 大グモの糸吐き（src/eco/spiderskill.ts）：近づいた冒険者に糸を吐いて縛り、縛られた冒険者は糸を切って抜ける。15シードの合計で見る
    // （main の10日目から実行した10〜18日目の、この15シードで、冒険者を縛ったのは279回、14シードで起きた）
    name: '大グモが糸を吐いて冒険者を縛り、冒険者が糸を切って抜ける（15シードの合計でそれぞれ20回以上・8シード以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const bind = rs.map((r) => r.settle.filter((x) => x.k === 4 && x.ev === 'spiderBind' && x.n === 25).length);
      const cut = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'silkCut').length);
      const seeds = bind.filter((v) => v > 0).length;
      return { ok: sum(bind) >= 20 && sum(cut) >= 20 && seeds >= 8, value: `縛った ${sum(bind)}（${seeds}シード）、切って抜けた ${sum(cut)}` };
    },
  },
  {
    // ゴーストの技（src/eco/ghostskill.ts）：金切り声で冒険者を打ってすくませ、冒険者の刃はゴーストの体をすり抜ける。15シードの合計で見る
    name: 'ゴーストが金切り声で冒険者を打ち、冒険者の刃がゴーストをすり抜ける（15シードの合計でそれぞれ20回以上・8シード以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const wail = rs.map((r) => r.settle.filter((x) => x.k === 7 && x.ev === 'ghostWail' && x.how > 0).length);
      const phase = rs.map((r) => r.settle.filter((x) => x.k === 7 && x.ev === 'ghostPhase' && x.n === 25).length);
      const seeds = wail.filter((v) => v > 0).length;
      return { ok: sum(wail) >= 20 && sum(phase) >= 20 && seeds >= 8, value: `金切り声 ${sum(wail)}（${seeds}シード）、すり抜け ${sum(phase)}（${phase.filter((v) => v > 0).length}シード）` };
    },
  },
  {
    // コボルトのスリングの投石（src/eco/koboldskill.ts）：冒険者の一行に気づいて逃げ出す前に、振り向いて小石を投げて当てる。15シードの合計で見る
    // （main の10日目から実行した10〜18日目の、この15シードで、当たったのは1032回、10シードで起きた。コボルトのいるシードは展開で入れ替わるので、シード数には余裕を置く）
    name: 'コボルトが逃げ出す前にスリングで小石を投げ、冒険者に当てる（15シードの合計で20回以上・6シード以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const hit = rs.map((r) => r.settle.filter((x) => x.k === 10 && x.ev === 'stoneHit').length);
      const thrown = rs.map((r) => r.settle.filter((x) => x.k === 10 && x.ev === 'sling').length);
      const seeds = hit.filter((v) => v > 0).length;
      return { ok: sum(hit) >= 20 && seeds >= 6, value: `投げた ${sum(thrown)}、当たった ${sum(hit)}（${seeds}シード）` };
    },
  },
  {
    // 野の生き物は外から来ず、ダンジョンの中の土の養分とマナから湧く（src/eco/spawndef.ts）。外から来るのは冒険者・ドワーフと、空から狩りに来るワイバーンだけ
    name: '外から来る野の生き物がいない（15シードで、ワイバーン・冒険者・ドワーフのほかに、口や裂け目から現れた生き物が0）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.births.filter((b) => ![23, 25, 28].includes(b.k) && ['mouth', 'shaft', 'river', 'fissure'].includes(b.origin)).length);
      return { ok: sum(n) === 0, value: `${sum(n)}匹` + (sum(n) ? `（${rs.filter((_, i) => n[i]).map((r) => r.seed).join('、')}）` : '') };
    },
  },
  {
    // マナで命をつなぐ大物（Ecology.MANA_FED。src/eco/step.ts の metabolism）：飢えの猶予を過ぎても体のマナを燃やして生き延び、休んで土から吸い、ウィスプを吸って補う。
    // main ではミノタウロス・トロール・バジリスク・ガーゴイルの死と飢えて去った数の半分以上が飢えだった（16シード×25日でミノタウロス49％・トロール64％）。
    // 入れた版で main の10日目から始めると 39 / 157（25％）。ヴァンパイア（19）も数える（コードレビューで、数えていないと指摘された）
    name: 'マナで命をつなぐ大物（ミノタウロス・トロール・バジリスク・ガーゴイル・ヴァンパイア）の、飢えで失った割合が3割以下（15シードの合計）',
    ...RUN_WIDE,
    test: (rs) => {
      const FED = [15, 16, 17, 18, 19];
      const st = rs.map((r) => r.deaths.filter((x) => FED.includes(x.k) && x.cause === 'starve').length + r.exits.filter((x) => FED.includes(x.k) && x.reason === 'starving').length);
      const all = rs.map((r) => r.deaths.filter((x) => FED.includes(x.k)).length + r.exits.filter((x) => FED.includes(x.k) && x.reason === 'starving').length);
      return { ok: sum(st) <= sum(all) * 0.3, value: `飢えで失った ${sum(st)} / 死んだ・飢えて去った ${sum(all)}` };
    },
  },
  {
    // バジリスクが画面にいる（src/eco/spawndef.ts のバジリスクの行）：上限を置かず、竜からは12マス離れれば湧く。いないと、睨みの石像・コボルトとゴブリンが避ける住みか・
    // 冒険者の戦利品の眼など、バジリスクがほかの種に与えている意味も消える。15シードの10〜18日目で、1/4日ごとのサンプルの半分以上にいたシードの数を見る。
    // 入れた版で main の10日目から始めると13シード（seed4 18％・seed17 0％。seed17 は湧ける暗がりがどれも竜のそばか人のよく通る所で、main でも一度も湧かない）
    name: 'バジリスクが画面にいる（15シードのうち11シード以上で、10〜18日目のサンプルの半分以上にいた）',
    ...RUN_WIDE,
    test: (rs) => {
      const share = rs.map((r) => (r.samples.length ? r.samples.filter((x) => (x.counts?.[17] ?? 0) > 0).length / r.samples.length : 0));
      const seeds = share.filter((v) => v >= 0.5).length;
      return { ok: seeds >= 11, value: `${seeds}シード（` + rs.map((r, i) => `${r.seed} ${Math.round(share[i] * 100)}％`).join('、') + '）' };
    },
  },
  {
    // バジリスク（src/eco/monsters.ts の basilisk）：飢えの猶予を過ぎると住みかを出て、同じ洞窟の領域の獲物（大ネズミ・大トカゲ・アリ）のいる所まで遠出して狩り
    // （獲物がいなければ、マナの濃い暗がりへ寝床を移して休み）、自分より大きな者を睨んで石に変える（石化の記録の by が17）。1〜2シードの出来事に偏るので、15シードの合計と、起きたシードの数で見る。
    // 入れた版で main の10日目から始めると、仕留めた69回（8シード）・睨み59回（10シード）。上限をやめ、獲物がいなければ寝床で休むようにした版では、仕留めた42回（6シード）・睨み78回（10シード）。睨みを少しずつ進む石化にした版では、仕留めた47回（4シード）・石像84（6シード）。
    // 展開が分かれただけで大きく変わるので、目安は少なめにする
    name: 'バジリスクが獲物を仕留め、睨みで石に変える（15シードの合計で、仕留めた30回以上・睨み25回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const kill = rs.map((r) => r.deaths.filter((x) => x.by === 17 && (x.cause === 'eaten' || x.cause === 'fight')).length);
      const gaze = rs.map((r) => r.deaths.filter((x) => x.by === 17 && x.cause === 'petrified').length);
      const seeds = (a: number[]) => a.filter((v) => v > 0).length;
      return { ok: sum(kill) >= 30 && sum(gaze) >= 25, value: `仕留めた ${sum(kill)}（${seeds(kill)}シード）、睨み ${sum(gaze)}（${seeds(gaze)}シード）` };
    },
  },
  {
    // バジリスクの睨みと見回り（src/eco/basilisk.ts）：目を光らせる溜めのあと、見えている相手を見つめ続け、目が合っている間に石化が少しずつ進む
    // （満ちたら石像。gaze の how 1 最初に目が合った / 2 石像。ここでは1と2を「睨みを受けた」として数える）。
    // 遠出していないときは、同じ洞窟の中のマナの濃い暗がりへ見回りに出る（patrol）。15シードの合計で見る。入れた版で main の10日目から始めると、睨みを受けた631回（12シード）・見回り132回（13シード）。目安はその半分ほどにする
    name: 'バジリスクが睨みで石化を進め、縄張りを見回る（15シードの合計で、睨みを受けた300回以上・見回り60回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const stone = rs.map((r) => r.settle.filter((x) => x.k === 17 && x.ev === 'gaze' && x.how >= 1).length);
      const patrol = rs.map((r) => r.settle.filter((x) => x.k === 17 && x.ev === 'patrol').length);
      const seeds = (a: number[]) => a.filter((v) => v > 0).length;
      return { ok: sum(stone) >= 300 && sum(patrol) >= 60, value: `睨みを受けた ${sum(stone)}（${seeds(stone)}シード）、見回り ${sum(patrol)}（${seeds(patrol)}シード）` };
    },
  },
  {
    // マナの減った大物が、近くのウィスプへ寄って吸う（src/eco/monsters.ts の sipWisp）。大物は暗い深部に、ウィスプは苔のある明るい所に多く、
    // 近くにいることは少ない（main の8シード×10〜18日目の深夜で、大物の1割ほどが8マス以内にウィスプがいた）。15シードの合計で見る。
    // 入れた版で main の10日目から始めると218回（seed4 101・seed41 60・seed8 34 など7シード）。野の生き物を外から来させないようにした版では39回（7シード）。
    // 狩りの後に吸い、見通しの通るウィスプだけを狙い、ヴァンパイアも吸うようにした版では143回（9シード）。死骸の一覧の古い者を除いた版では54回（6シード。展開が分かれただけで大きく変わる）。
    // バジリスクの上限をやめ、獲物がいなければ寝床で休むようにした版では308回（2シード：seed30 287・seed8 21）。16シード×25日では429回（11シード。main は416回）で、
    // 10〜18日目に起きるシードの数だけが展開の分かれ方で大きく変わる。1〜2シードの出来事に大きく偏るので、目安は少なめにし、起きたシードの数は2以上で見る
    name: 'マナの減った大物がウィスプを吸う（15シードの合計で20回以上・2シード以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.deaths.filter((x) => x.cause === 'sipped').length);
      const seeds = n.filter((v) => v > 0).length;
      return { ok: sum(n) >= 20 && seeds >= 2, value: rs.filter((_, i) => n[i] > 0).map((r) => `${r.seed} ${n[rs.indexOf(r)]}`).join('、') + `（${seeds}シード）` };
    },
  },
  {
    // 冒険者が倒れた所で、マナが立ちのぼる（src/eco/salamander.ts の heroDeathMana）。外で死んだ者と、石になった者（死の記録を別の所でする）は除かれるので、8割以上で見る
    name: '冒険者が倒れた所でマナが立ちのぼる（15シードの合計で、冒険者の死の8割以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const dead = sum(rs.map((r) => r.deaths.filter((x) => x.k === 25).length));
      const rise = sum(rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'heroMana').length));
      return { ok: rise >= 1 && rise >= dead * 0.8, value: `マナが立ちのぼった ${rise} / 冒険者の死 ${dead}` };
    },
  },
  {
    // マイコニドの眠りの胞子（src/eco/myconidskill.ts）：3マス以内に来た人へ胞子の雲を吐き、うたた寝させる。15シードの合計で見る
    name: 'マイコニドが眠りの胞子を吐き、人をうたた寝させる（15シードの合計で20回以上・8シード以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const doze = rs.map((r) => r.settle.filter((x) => x.k === 8 && x.ev === 'spore' && x.how === 0 && x.n > 0).length);
      const burst = rs.map((r) => r.settle.filter((x) => x.k === 8 && x.ev === 'spore' && x.how === 1 && x.n > 0).length);
      const seeds = doze.filter((v) => v > 0).length;
      return { ok: sum(doze) >= 20 && seeds >= 8, value: `吐いて眠らせた ${sum(doze)}（${seeds}シード）、弾けて眠らせた ${sum(burst)}` };
    },
  },
  {
    // アンデッド（src/eco/undead.ts）：冒険者のほかの人型の骨がスケルトンとして、まだ肉のある人型の亡骸がゾンビとして起き上がる。
    // どのシードで起きるかは展開で変わるので、15シードの合計で見る（main の10日目から実行した10〜18日目の8シードで、骨93回・ゾンビ23回）
    name: '人型の骨がスケルトンとして、肉のある亡骸がゾンビとして起き上がる（15シードの合計で骨10回・ゾンビ3回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const bone = rs.map((r) => r.births.filter((x) => x.k === 26 && x.origin === 'raised' && [12, 10, 13, 28, 14].includes(x.from)).length);
      const zom = rs.map((r) => r.births.filter((x) => x.k === 6 && x.origin === 'raised' && [12, 10, 13, 14].includes(x.from)).length);
      return { ok: sum(bone) >= 10 && sum(zom) >= 3, value: `骨 ${sum(bone)}（${bone.filter((n) => n > 0).length}シード）、ゾンビ ${sum(zom)}（${zom.filter((n) => n > 0).length}シード）` };
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
    // 大ネズミは、苔の豊かな群落のそばの土から少しずつ湧く（src/eco/spawndef.ts）。ある tick に0匹でも絶えたとは限らないので、湧きつづけるかで見る。
    // （以前は天井の裂け目や横穴から来ていて、「来つづける（10匹以上）」で見ていた）。入れた版で main の10日目から始めると52回（かしたれ 11・seed8 14・abc 17・seed7 10）
    name: '大ネズミが土から湧きつづける（4シードの合計で、湧いた群れが25回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 2 && x.ev === 'gen').length);
      return { ok: sum(n) >= 25, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
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
    // 大ネズミが絶えかけても、土からまた湧く（以前は天井の割れ目から入り直していた。abc と seed7 は、入り直しを入れる前のコードで0匹の日が続いた）。
    // 0匹になったサンプルの後、1日の内に大ネズミが湧いた回数を、0匹になった回数（続く0匹は1回と数える）の8割以上で見る。0匹にならなければ通す。
    // その1日が実行の終わりを越える0匹は数えない（湧く前に実行が終わるので）
    name: '大ネズミが絶えても、また土から湧く（4シードで、0匹になった後1日の内に湧いた回数が8割以上）',
    ...RUN_A,
    test: (rs) => {
      let gone = 0;
      let back = 0;
      for (const r of rs) {
        const gens = r.settle.filter((x) => x.k === 2 && x.ev === 'gen').map((x) => x.t);
        const S = r.samples.filter((x) => x.t > r.from * 14400);
        for (let i = 0; i < S.length; i++) {
          if ((S[i].counts[2] ?? 0) > 0 || (i > 0 && (S[i - 1].counts[2] ?? 0) === 0)) continue;
          if (S[i].t + 14400 > r.to * 14400) continue;
          gone++;
          if (gens.some((t) => t >= S[i].t - 3600 && t <= S[i].t + 14400)) back++;
        }
      }
      return { ok: gone === 0 || back >= gone * 0.8, value: `0匹になった ${gone} 回、そのうち1日の内に湧いた ${back} 回` };
    },
  },
  {
    // 倒されたワームは、また深部から湧く（src/eco/spawndef.ts のワームの行。前に湧いてから2日＝生き物の更新14400回あける）。
    // ワームの死はまれ（16シード×25日で5回。5回とも、死んでから 2,000〜9,500 tick で湧き直した）なので、該当する死が無ければ通す
    // （0回を落とすと、ほかの変更で展開が分かれただけで落ちる）。死んでから2日が実行の終わりを越える死は数えない
    name: '倒されたワームが、また深部から湧く（15シードで、死んでから2日の内に湧き直した回数が8割以上）',
    ...RUN_WIDE,
    test: (rs) => {
      let dead = 0;
      let back = 0;
      for (const r of rs) {
        const gens = r.settle.filter((x) => x.k === 22 && x.ev === 'gen').map((x) => x.t);
        for (const d of r.deaths.filter((x) => x.k === 22 && x.t + 2 * 14400 <= r.to * 14400)) {
          dead++;
          if (gens.some((t) => t > d.t && t <= d.t + 2 * 14400)) back++;
        }
      }
      return { ok: dead === 0 || back >= dead * 0.8, value: `倒された ${dead} 回、そのうち2日の内に湧き直した ${back} 回` };
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
    // 回数は大ネズミの数で大きく変わる（群れの展開しだいで、同じコードでも始め方によって倍ほど違った）ので、大ネズミ1匹あたりで見る：
    // 引っかかりの回数 ÷（ゲーム内の1/4日ごとのサンプルで数えた大ネズミの数の合計）。
    // アリの混雑を直したコード（main #58 の後）で、main 2.80・0日目から 2.02・main の10日目から 4.58。止まる番も歩く姿で描いていたころは約3倍（約8）
    name: '大ネズミが止まる番に足踏みしない（4シードで、大ネズミ1匹あたりの引っかかりが6以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 2).length);
      const rats = rs.map((r) => r.samples.filter((x) => x.t > r.from * 14400).reduce((a, x) => a + (x.counts[2] ?? 0), 0));
      const v = sum(n) / Math.max(1, sum(rats));
      return { ok: v <= 6, value: `${v.toFixed(2)}（${rs.map((r, i) => `${r.seed} ${n[i]}/${rats[i]}`).join('、')}）` };
    },
  },
  {
    // おびえる大ネズミは、40px の内の怖い相手が次に向かう道筋の点の方向にいれば、近づかずにその場でじっとする（src/eco/rat.ts）。
    // 以前は、道筋が相手の方を通っていると、逃げる距離（26px）の境目で、離れる一歩と戻る一歩を繰り返して行き来していた（seed35 で40秒以上）。
    // 大ネズミの数は展開で大きく変わるので、大ネズミ1匹あたり（上の項目と同じ数え方）で、15シードの合計で見る。
    // main（#67）の10〜18日目で 2.96、main（#68）で 3.19、直したコードの0日目から 2.00〜2.01、main の10日目から 2.29
    name: 'おびえる大ネズミが逃げる距離の境目で行き来しない（15シードで、大ネズミ1匹あたりの引っかかりが2.7以下）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 2).length);
      const rats = rs.map((r) => r.samples.filter((x) => x.t > r.from * 14400).reduce((a, x) => a + (x.counts[2] ?? 0), 0));
      const v = sum(n) / Math.max(1, sum(rats));
      return { ok: v <= 2.7, value: `${v.toFixed(2)}（引っかかり ${sum(n)}、大ネズミ ${sum(rats)}）` };
    },
  },
  {
    // 夜のトロール（src/eco/monsters.ts の troll）と、住みかのそばのオーク（src/eco/orc.ts）は、立ち止まる番と、ふつうに近い速さで歩く番を交互にする（見回す動きや、止まっているあいだの効果はない）。
    // 以前はふつうの速さの0.4〜0.6倍で歩き続け、脚を動かしながら3秒で半タイルも進まず（ひらけた床でも必ず引っかかりと数えられ）、足踏みして見えていた。
    // 数で大きく変わるので、2種を合わせた1匹あたり（大ネズミの項目と同じ数え方）で見る。
    // main（#67）の10〜18日目の15シードで 4.38（オーク 5.04・トロール 3.69）、直したコードの0日目から 1.80、main の10日目から 1.74
    name: 'トロールとオークがぶらつくときに足踏みしない（15シードで、2種を合わせた1匹あたりの引っかかりが3以下）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 13 || x.k === 16).length);
      const pop = rs.map((r) => r.samples.filter((x) => x.t > r.from * 14400).reduce((a, x) => a + (x.counts[13] ?? 0) + (x.counts[16] ?? 0), 0));
      const v = sum(n) / Math.max(1, sum(pop));
      return { ok: v <= 3, value: `${v.toFixed(2)}（引っかかり ${sum(n)}、トロールとオーク ${sum(pop)}）` };
    },
  },
  {
    // あてもなくぶらつく所（src/eco/move.ts の stroll：住処や集落や村のないコボルト・ゴブリン・リザードマン、獲物の見つからないドラゴン）は、立ち止まる番と、ふつうの速さの0.9倍で歩く番を交互にする。
    // 住処や集落のそばでうろつく所（コボルト、ゴブリン、リザードマン、バジリスク）と、サラマンダー・スケルトンのさまよい歩きは、歩く番の速さをふつうの0.8〜0.9倍にする。
    // 以前はふつうの速さの0.4〜0.6倍で歩き、脚を動かしながら3秒で半タイルほどしか進まず、ほかの減速が重なると引っかかりと数えられ、足踏みして見えていた。
    // 数で大きく変わるので、7種を合わせた1匹あたり（トロールとオークの項目と同じ数え方）で見る。
    // main（#69）の10〜18日目の15シードで 4.13（コボルト 3.45・ゴブリン 3.12・サラマンダー 9.17・ドラゴン 10.79）、直したコードの0日目から 2.54、main の10日目から 2.34
    name: 'コボルト・ゴブリンなどがぶらつくときに足踏みしない（15シードで、7種を合わせた1匹あたりの引っかかりが3.2以下）',
    ...RUN_WIDE,
    test: (rs) => {
      const ks = [10, 11, 12, 14, 17, 24, 26];
      const n = rs.map((r) => r.hitch.filter((x) => ks.includes(x.k)).length);
      const pop = rs.map((r) => r.samples.filter((x) => x.t > r.from * 14400).reduce((a, x) => a + ks.reduce((b, k) => b + (x.counts[k] ?? 0), 0), 0));
      const v = sum(n) / Math.max(1, sum(pop));
      return { ok: v <= 3.2, value: `${v.toFixed(2)}（引っかかり ${sum(n)}、7種 ${sum(pop)}）` };
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
    // コボルトは食べ物の目当てを保つ（src/eco/kobold.ts。更新のたびに苔を探し直して目当てが入れ替わり、ジグザグに行き来していた）。
    // main（#55）の10〜18日目では、コボルトの引っかかりが4シードの合計で約10300回（かしたれ 233・seed8 0・abc 5430・seed7 4647）、
    // 直したコードを main の10日目から続けると約4700回（かしたれ 0・seed8 0・abc 2957・seed7 1726）
    // 回数はコボルトの数で大きく揺れる（#58・#59 の後の main だけで、この4シードの合計が約7000回まで増えた）ので、
    // 大ネズミの項目と同じく、コボルト1匹あたりの引っかかり（回数 ÷ 1/4日ごとのサンプルで数えたコボルトの数の合計）で見る。
    // アリの住みかの印を直したコード（main #59 の後）で、main 6.87・0日目から 7.86・main の10日目から 7.52。
    // #57 で目当ての入れ替わりを直したとき、回数はほぼ半分になったので、直す前は14前後と見積もれる
    name: 'コボルトが食べ物の目当てを替え続けない（4シードで、コボルト1匹あたりの引っかかりが10以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 10).length);
      const kobs = rs.map((r) => r.samples.filter((x) => x.t > r.from * 14400).reduce((a, x) => a + (x.counts[10] ?? 0), 0));
      const v = sum(n) / Math.max(1, sum(kobs));
      return { ok: v <= 10, value: `${v.toFixed(2)}（${rs.map((r, i) => `${r.seed} ${n[i]}/${kobs[i]}`).join('、')}）` };
    },
  },
  {
    // 人の気配を避ける強いモンスターは、退く先を決めて着くまで歩き、退き終えてしばらくは気配を気にしない（src/eco/senses.ts の retreatTo・retreatStep）。
    // main（#55）の10〜18日目では、オーク・ミノタウロス・トロール・ワイバーンの引っかかりが4シードの合計で約2560回（かしたれ 456・seed8 415・abc 821・seed7 869）、
    // 直したコードを main の10日目から続けると約1550回（かしたれ 241・seed8 179・abc 727・seed7 406）
    name: '強いモンスターが人の気配の前で行き来しない（オーク・ミノタウロス・トロール・ワイバーンの引っかかりが4シードの合計で2200回以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 13 || x.k === 15 || x.k === 16 || x.k === 23).length);
      return { ok: sum(n) <= 2200, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 縦穴から来るコウモリは、縦穴の真上が岩や縦穴とつながっていない洞窟なら、縦穴のマスの天井ぎわに生まれてぶら下がる（src/eco/bat.ts の roostSpot）。
    // 以前は岩の中や別の洞窟に生まれて、夜に縦穴へ戻れず、そのそばで足踏みしたまま飢えていた。
    // main（#57）の10〜18日目では、苔を探すとき（st 1）以外のコウモリの足踏み（2分以上）が seed7 16・seed35 17・seed41 0、
    // 直したコードを main の10日目から続けると seed7 0・seed35 2・seed41 0
    name: 'コウモリが縦穴へ戻れずに足踏みしない（seed7・seed35・seed41 の合計で、苔を探すとき以外の足踏みが8回以下）',
    seeds: ['seed7', 'seed35', 'seed41'],
    from: 10,
    to: 18,
    test: (rs) => {
      const n = rs.map((r) => r.stuck.filter((x) => x.k === 1 && x.st !== 1).length);
      return { ok: sum(n) <= 8, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // アリの混雑（src/eco/move.ts の列の間合い、src/eco/ant.ts の巣のそばで休む）：仲間がいつもまわりにいる巣のそばで、
    // 横切る仲間のたびに歩みをゆるめ、運ぶ物の無いときは乱数の向きにぶらついて、脚を動かしたまま進まなかった。
    // アリの数で大きく変わるので、アリ1匹あたりの引っかかり（大ネズミの項目と同じ数え方）で見る。
    // main #58 の10〜18日目の15シードで13.86、直したコードの0日目から 6.55、main の10日目から 7.23
    name: 'アリが巣のそばで足踏みし続けない（15シードで、アリ1匹あたりの引っかかりが10以下）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 9).length);
      const ants = rs.map((r) => r.samples.filter((x) => x.t > r.from * 14400).reduce((a, x) => a + (x.counts[9] ?? 0), 0));
      const v = sum(n) / Math.max(1, sum(ants));
      return { ok: v <= 10, value: `${v.toFixed(2)}（引っかかり ${sum(n)}、アリ ${sum(ants)}）` };
    },
  },
  {
    // アリの住みかの印（逃げるときに逃げ帰る先）は巣（src/eco/ant.ts、src/eco/arrivals.ts）。
    // 以前は巣を作りに来たアリの印が入ってきた地表の口のままで、傷を負うとダンジョンの入口まで逃げていた（abc・seed27 の12日目で働きアリの8割ほど）。
    // 18日目のセーブで、巣に属するアリの印がすべて巣と一致するかを見る（L は1体43個ずつ：1 種、15・16 住みかの印、19 倒れたか、23 所属。AC は巣 [id, x, y, …]）
    name: 'アリの住みかの印が巣になっている（RUN_WIDE の18日目で、巣に属するアリすべて）',
    ...RUN_WIDE,
    test: (rs) => {
      const bad = rs.map((r) => {
        const eco = r.state(r.to)?.eco;
        if (!eco) return 0;
        const cols = new Map<number, number[]>((eco.AC ?? []).map((a: number[]) => [a[0], a]));
        const L: number[] = eco.L ?? [];
        const V = eco.V ?? 43;
        let n = 0;
        for (let i = 0; i + V - 1 < L.length; i += V) {
          if (L[i + 1] !== 9 || L[i + 19] !== 0) continue;
          const col = cols.get(L[i + 23]);
          if (col && (L[i + 15] !== col[1] || L[i + 16] !== col[2])) n++;
        }
        return n;
      });
      return { ok: sum(bad) === 0, value: `印が巣とずれたアリ ${sum(bad)} 匹` };
    },
  },
  {
    // 冒険者が壁ぎわで足踏みしない（src/eco/adventurer.ts）：一行の並ぶ位置が壁の中なら立てる所へずらし、焚き火の席に入れなければそばに座る。
    // 壁ぎわ（引っかかり始めたマスの周り8マスのうち3マス以上が壁）の冒険者の引っかかりを、冒険者1人あたり（大ネズミの項目と同じ数え方）で見る。
    // main（#63）の10〜18日目の15シードで1.23、直したコードの0日目から 0.84、main の10日目から 0.76
    name: '冒険者が壁ぎわで足踏みしない（15シードで、壁ぎわの冒険者の引っかかりが1人あたり1.05以下）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 25 && x.wall >= 3).length);
      const adv = rs.map((r) => r.samples.filter((x) => x.t > r.from * 14400).reduce((a, x) => a + (x.counts[25] ?? 0), 0));
      const v = sum(n) / Math.max(1, sum(adv));
      return { ok: v <= 1.05, value: `${v.toFixed(2)}（引っかかり ${sum(n)}、冒険者 ${sum(adv)}）` };
    },
  },
  {
    // 食べ物のマスは、いまいる所と歩いてつながるマスだけを選ぶ（src/eco/goblin.ts の goblinForage、src/eco/move.ts の findMoss）。
    // 以前は斜めにしかつながらない窪みや壁の向こうのマスを選び、壁の角に押しつけたまま足踏みし続けた。
    // 15シードの10〜18日目のゴブリンの長い足踏み（2分以上）は、main（#64）で89回（seed41 が72回）、直したコードの0日目から 20回、main の10日目から 25回
    name: 'ゴブリンが行けない食べ物を目指して足踏みし続けない（15シードで、ゴブリンの2分以上の足踏みが45回以下）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.stuck.filter((x) => countsAsStuck(x) && x.k === 12).length);
      return { ok: sum(n) <= 45, value: `${sum(n)}回（${rs.filter((r, i) => n[i]).map((r) => `${r.seed} ${n[rs.indexOf(r)]}`).join('、')}）` };
    },
  },
  {
    // 逃げる者は、住みかのそばで相手が離れていれば身をひそめ、帰り道の途中に相手がいれば近づかずに身をひそめる（src/eco/combat.ts の woundsAndFlight）。
    // 以前は住処のそばで休む冒険者への警戒が続くと、行き止まりの住処で壁に押しつけたまま、あるいは距離の境目で行き来しながら、何分も足踏みした。
    // 15シードの10〜18日目のコボルトの長い足踏み（2分以上）は、main（#65）で58回、直したコードの0日目から 12回、main の10日目から 21回。
    // その後 main（#70）で68回に戻っていた：追っ手が6マスの内にいると、行き止まりの壁へ離れようとし続ける（seed30・かしたれ・seed17）のと、
    // 斜め向かいの畑のマスへ岩の角越しに近道しようとし続ける（seed17・seed18）のが大半。動けなければ相手の方を向いて縮こまり（src/eco/combat.ts の fleeFrom）、
    // 角を斜めに抜けられないときは道筋に従う（src/eco/move.ts の straightOk）ようにして、main の10日目から 15回
    name: '逃げるコボルトが住処のそばで足踏みし続けない（15シードで、コボルトの2分以上の足踏みが40回以下）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.stuck.filter((x) => countsAsStuck(x) && x.k === 10).length);
      return { ok: sum(n) <= 40, value: `${sum(n)}回` };
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
    // 掘り出した土の瓦礫を生き物のいるマスに置かない。それでも壁や瓦礫に埋まった生き物は、安全策で床へ出る（その回数が少ないこと）。
    // 野の生き物を土から湧かせるようにした版では11回（seed8 で住処の通路を掘るコボルト4匹が一度に、ほかにガーゴイル・ドワーフ）で、
    // 瓦礫の置き方ではなく、群れの数と住処の場所が変わったことによるので、目安を15回にする
    name: '壁や瓦礫に埋まる生き物がほとんどいない（4シードの合計で床へ出たのが15回以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.ev === 'unbury').length);
      return { ok: sum(n) <= 15, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 情報パネルのための「いきさつ」（src/eco/notes.ts）：死骸には死んだ理由が、落とし物と金貨の山には持ち主が覚えられ、セーブに入る（18日目の日次スナップショットの eco.NT）。
    // 覚え書きは判断に使わないので、数は展開に関わらない。死骸の分は4シードとも数十、持ち主の分は数個〜数十ある
    name: '死骸と落とし物のいきさつがセーブに残る（各シードで死骸10件以上、合計で持ち主のわかる物10件以上）',
    ...RUN_A,
    test: (rs) => {
      const DEATH = ['eaten', 'fight', 'killed', 'starve', 'burned', 'crushed', 'dried', 'other', 'petrified', 'sipped'];
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
    // 迷路をなくした変更のコードで0日目から実行すると、abc・seed30・seed5 は25日のうちに何度も引きずる（16シード×25日で14シード）。
    // 斧の薙ぎ払いで離れた所に倒した獲物へ歩み寄るようにしてから（src/eco/senses.ts の feeding）、main の10日目から始めて
    // 仕留めた43・引きずった23（abc 14・6、seed30 27・17、seed5 2・0）。目安はその半分ほど
    name: 'ミノタウロスが獲物を仕留めて寝床まで引きずる（abc・seed30・seed5 の合計で仕留める3回・引きずる10回以上）',
    seeds: ['abc', 'seed30', 'seed5'],
    from: 10,
    to: 18,
    test: (rs) => {
      const kill = rs.map((r) => r.deaths.filter((x) => x.by === 15 && (x.cause === 'eaten' || x.cause === 'fight')).length);
      const drag = rs.map((r) => r.settle.filter((x) => x.k === 15 && x.ev === 'drag').length);
      return { ok: sum(kill) >= 3 && sum(drag) >= 10, value: rs.map((r, i) => `${r.seed} 仕留めた${kill[i]}・引きずった${drag[i]}`).join('、') };
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
    // 10日目（始めの日）の地形（日次スナップショットの掘削のログを作業ツリーのコードで再生したもの）で、まわりの床が二つ以上の領域に分かれる溶岩の溜まりを数える。
    // #49（地形の生成の変更）の前の main の16シードの18日目では seed18・seed27・seed30 で1つずつあった。
    // #49 のあとの main では seed18・seed4・seed6 で1つずつ（10日目でも seed18 2・seed6 1）で、seed27・seed30 では0になったので、シードを替えた。
    // 溜まりが場所を分けるかは、それまでに生き物が掘った跡で変わる。スライムが死骸を分け合うようにしたコードを0日目から通すと
    // 18日目は seed5 1・seed6 1・seed18 2（seed4 は0）になったので、seed5 を足した。
    // ぶらつきを直したコード（#70）では、main の10日目から続けると、12〜14日目に seed18 の溜まりの1つの周りが掘られてつながり、18日目は seed18 1 だけになった
    // （#69 の main の18日目は16シードで seed18 3 だけ）。掘った跡に左右されないよう、18日目ではなく10日目の地形で見る。
    // 10日目は、main の10日目から始める CI では main と同じ地形（seed18 2）、#70 のコードの0日目からは seed18 2・seed6 1
    name: '溶岩の溜まりをはさんだ場所が別の領域になる（seed18・seed4・seed6・seed5 の合計で、場所を分ける溶岩の溜まりが2つ以上）',
    seeds: ['seed18', 'seed4', 'seed6', 'seed5'],
    from: 10,
    to: 18,
    test: (rs) => {
      const n = rs.map((r) => {
        const w = new World(r.seed);
        for (const op of (r.state(r.from)?.digs ?? []) as number[]) (w as any).replayOp(op);
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
    // 以前、コボルトが住処に加わりに外から来るとき、歩いて行けない横穴から入ると、住処を目指してさまよい、飢えていた（その住処へ歩いて行ける横穴だけから入るように直した）。
    // いまはコボルトは外から来ず、住処の場で土から湧く（src/eco/spawndef.ts）。住処を目指して飢えることが起きないかを、そのまま見る。
    // main の10〜18日目では seed30 で23匹、かしたれで14匹が飢え死にした
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
