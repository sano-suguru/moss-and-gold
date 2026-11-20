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
import { World, DAY_TICKS } from '../../src/world';
import { CR_EVERY, Kind } from '../../src/ecology';
import { SPAWN_DEFS } from '../../src/eco/spawndef';
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
  /** seeds の from〜to 日目に加えて見る組（test に渡すログは、seeds の組のあとに、この組のぶんが続く） */
  more?: { seeds: string[]; from: number; to: number }[];
  /** シードごとのログを受け取り、目安に届いたかどうかと、表に出す値を返す */
  test: (r: Recs[]) => { ok: boolean; value: string };
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const RUN_A = { seeds: ['かしたれ', 'seed8', 'abc', 'seed7'], from: 10, to: 18 };
/** ゴブリンの夜の盗み：10〜18日目に盗みに出ることが多いシード */
const RUN_RAID = { seeds: ['seed40', 'seed30', 'seed17', 'abc'], from: 10, to: 18 };
// リビングアーマーは冒険者の武具が溜まった所でしか生まれず、起きるシードが変更のたびに入れ替わる。甲冑が育つ15〜23日目に、16シードの合計で見る
const RUN_ARMOR = { seeds: ['abc', 'かしたれ', 'はじまりの洞窟', 'seed4', 'seed5', 'seed6', 'seed7', 'seed8', 'seed40', 'seed41', 'seed18', 'seed27', 'seed23', 'seed35', 'seed17', 'seed30'], from: 15, to: 23 };
// まれな出来事（僧侶が亡骸の前で祈る）を見る組。数シードを選ぶと、ほかの変更で展開が分かれるたびに落ちるので、15シードの合計で見る
const RUN_WIDE = { seeds: ['abc', 'かしたれ', 'はじまりの洞窟', 'seed4', 'seed5', 'seed6', 'seed7', 'seed8', 'seed40', 'seed41', 'seed18', 'seed27', 'seed35', 'seed30', 'seed17'], from: 10, to: 18 };
const RUN_BLESS = RUN_WIDE;
// check の項目にしないもの：オークの貢ぎ物の取り立て（collectTribute）と、倒れた冒険者がヴァンパイアの眷属として起き上がる場面（vampRaiseFallen）。
// どちらも16シード×25日でも数回〜十数回で、どのシードを選んでも短い実行では確かめられない。ab の「見せたい場面」の表（lib/moments.ts）で起きたシードの数を追う。
// ヴァンパイアが倒した者を眷属にする仕組みそのものは、RUN_A の項目（旋回と眷属）で確かめる

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
    // ヴァンパイア（src/eco/vampire.ts、src/eco/bat.ts）：日暮れにコウモリを呼び寄せ、コウモリに群がられて足止めされた獲物に打ちかかる。数シードでは1シードの展開で落ちるので、15シードの合計で見る
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
    // リビングアーマー：溜まり場に残った武具や巡回の途中で見つけた床の武具を一つずつ取り込み、倒れるかマナが尽きると武具が床に散らばる
    name: 'リビングアーマーが武具を取り込み、崩れて散らばる（16シードの15〜23日目で取り込み6回以上・崩れる2回以上）',
    ...RUN_ARMOR,
    test: (rs) => {
      const a = rs.map((r) => r.settle.filter((x) => x.k === 29 && x.ev === 'absorb').length);
      const f = rs.map((r) => r.settle.filter((x) => x.k === 29 && x.ev === 'fall').length);
      return { ok: sum(a) >= 6 && sum(f) >= 2, value: rs.map((r, i) => `${r.seed} 取り込み${a[i]}・崩れる${f[i]}`).join('、') };
    },
  },
  {
    // リビングアーマーは、倒れずに強い一打を受けると手の武器を落とす（armorShed）。強くなり続けず、打ち合うたびに強さが行き来する。
    name: 'リビングアーマーが打たれて手の武器を落とす（16シードの15〜23日目で20回以上）',
    ...RUN_ARMOR,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 29 && x.ev === 'shed').length);
      return { ok: sum(n) >= 20, value: rs.filter((_r, i) => n[i]).map((r) => `${r.seed} ${n[rs.indexOf(r)]}`).join('、') || '0' };
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
    // 三歩目：深部の探索の一行が物資の置き場を残し、次の一行がそこで食料を補う。まれな出来事なので、RUN_WIDE の15シードの合計で見る
    name: '物資の置き場が残され、次の一行が補う（15シードの合計で置き場4つ・補う2回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const c = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'cache' && !x.merged).length);
      const u = rs.map((r) => new Set(r.settle.filter((x) => x.k === 25 && x.ev === 'supply').map((x) => x.id)).size);
      return { ok: sum(c) >= 4 && sum(u) >= 2, value: `置き場 ${sum(c)}、補った一行 ${sum(u)}（${rs.filter((_, i) => c[i] > 0).length}シード）` };
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
    // コボルトとゴブリンの戦（planWars）：蓄えの乏しい大きな群れが隣の住みかへ攻めに出る。隣り合う住処と集落のあるシードでしか起きず、
    // その組み合わせはベースのスナップショットから数日で入れ替わるので、一つの窓では起きないことがある（main の10〜18日目で15シード合計5回）。
    // RUN_WIDE と RUN_ARMOR の二つの窓の合計で見る（どちらもほかのチェックが実行するので、実行は増えない）
    name: 'コボルトかゴブリンの群れが相手の住みかへ攻めに出る（10〜18日目の15シードと15〜23日目の16シードの合計で3回以上・2シード以上）',
    ...RUN_WIDE,
    more: [RUN_ARMOR],
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.ev === 'warGo').length);
      return { ok: sum(n) >= 3 && new Set(rs.filter((_, i) => n[i] > 0).map((r) => r.seed)).size >= 2, value: rs.filter((_, i) => n[i] > 0).map((r) => `${r.seed}（${r.from}〜${r.to}日） ${n[rs.indexOf(r)]}`).join('、') || 'なし' };
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
    // 冒険者の技は、見通しの利く相手にだけ放つ（src/eco/adventurer.ts の「戦う」）。溜め終わったときに相手が壁の陰へ入っていたら、
    // 放たずに構えを解き、頭に「？」が出る（settle の skillLost）
    name: '溜め終わった技の相手が壁の陰へ入ったら、冒険者が放たずに見失う（15シードの合計で1回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'skillLost').length);
      return { ok: sum(n) >= 1, value: `合計 ${sum(n)}（${rs.map((r, i) => `${r.seed} ${n[i]}`).join('、')}）` };
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
    // 依頼を受けて入った一行の依頼は、その前に必ず町の掲示に出ている（ログ「町に〇〇の依頼が出た」。掲示を覚えていないスナップショットから始めたときは、最初の作り直しの init の記録）。
    // 実行は始まりの日のスナップショットから始まり、それより前に出た依頼はログに無いので、始まりの日の掲示（セーブの RQ。依頼の種類×100＋狩る種）に出ていた依頼も、前に出ていたと数える
    name: '依頼で入った一行の依頼は、その前に町に出ている（15シードの合計で例外0）',
    ...RUN_WIDE,
    test: (rs) => {
      let n = 0;
      let tot = 0;
      for (const r of rs) {
        const a = r.settle.filter((x) => x.k === 25);
        const board = new Set(((r.state(r.from)?.eco?.RQ ?? []) as number[]));
        for (const e of a.filter((x) => x.ev === 'enter' && x.q > 0)) {
          tot++;
          if (board.has(e.q * 100 + (e.qk ?? 0))) continue;
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
    // 食べ物の足りる場所がどの横穴の先にも無いマップでも、少ない群れが貧しい場所に集落を作る。起きるシードが展開で入れ替わるので、15シードの合計で見る
    // （0日目からの16シード×25日では main で13回・10シードだが、ベースの10日目から8日だけの実行では1回のこともある）
    name: 'ゴブリンの少ない群れが貧しい場所に集落を作る（15シードの合計で1回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'found' && x.poor === 1).length);
      return { ok: sum(n) >= 1, value: `${sum(n)}回（${rs.filter((_, i) => n[i] > 0).map((r) => r.seed).join('、') || 'なし'}）` };
    },
  },
  {
    // ゴブリンの流れを短くする：通り道の脇の暗がりで待ち伏せ、通路を行く一行の最後尾から荷を掠め取る。まれな出来事なので、RUN_WIDE の15シードの合計で見る
    name: 'ゴブリンが通路を行く一行の最後尾から荷を掠め取る（15シードの合計で4回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const st = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'stalk').length);
      const rob = rs.map((r) => r.settle.filter((x) => x.k === 12 && x.ev === 'rob' && x.how === 'snatch').length);
      return { ok: sum(rob) >= 4, value: `${sum(rob)}回（つけた ${sum(st)}回。${rs.filter((_r, i) => rob[i]).map((r) => `${r.seed} ${rob[rs.indexOf(r)]}`).join('、')}）` };
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
    // 亡骸を清める：僧侶のいる一行が、冒険者の亡骸の前で立ち止まって祈る（清められた亡骸は起き上がらない。blessBrace）
    name: '僧侶が冒険者の亡骸の前で祈って清める（15シードの合計で2回以上）',
    ...RUN_BLESS,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 25 && x.ev === 'bless').length);
      return { ok: sum(n) >= 2, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 冒険者でない亡骸を清める：僧侶のいる一行が、起き上がりうる所の人型の亡骸か、倒されたアンデッドの残骸の前で祈る。骨は祈りの終わりに金の光の粒になって崩れる
    // （blessBrace・blessCrumble）。どのシードで起きるかは展開で変わるので、15シードの合計で見る
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
    // 打ち合いで仕留めて食べたのが、一口で食べたより多い（1シードの揺れに左右されないよう、4シードの合計で見る）
    name: '狩りは打ち合って仕留めて食べる（4シードの合計で80回以上、合計で一口で食べたより多い）',
    ...RUN_A,
    test: (rs) => {
      const sl = rs.map((r) => r.deaths.filter((x) => x.cause === 'eaten' && x.slain === 1).length);
      const gu = rs.map((r) => r.deaths.filter((x) => x.cause === 'eaten' && !x.slain).length);
      return { ok: sum(sl) >= 80 && sum(sl) > sum(gu), value: rs.map((r, i) => `${r.seed} ${sl[i]}（一口 ${gu[i]}）`).join('、') };
    },
  },
  {
    // クモの巣は、大ネズミやアリを捕まえ、大きな者に引き裂かれ、冒険者に切り払われる（updateWebs）
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
    // コボルトのスリングの投石（src/eco/koboldskill.ts）：冒険者の一行に気づいて逃げ出す前に、振り向いて小石を投げて当てる。15シードの合計で見る（コボルトのいるシードは展開で入れ替わるので、シード数には余裕を置く）
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
    // マナで命をつなぐ大物（Ecology.MANA_FED。metabolism）：飢えの猶予を過ぎても体のマナを燃やして生き延び、休んで土から吸い、ウィスプを吸って補う。
    // ヴァンパイア（19）も数える
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
    // seed17 は湧ける暗がりがどれも竜のそばか人のよく通る所で、湧かない
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
    // （獲物がいなければ、マナの濃い暗がりへ寝床を移して休み）、自分より大きな者を睨んで石に変える（石化の記録の by が17）。1〜2シードの出来事に偏り、展開が分かれただけで大きく変わるので、15シードの合計と起きたシードの数で、目安は少なめに見る（最新の実測：仕留めた47回・4シード、石像84・6シード）
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
    // 遠出していないときは、同じ洞窟の中のマナの濃い暗がりへ見回りに出る（patrol）。15シードの合計で見る。目安は実測（睨みを受けた631回・12シード、見回り132回・13シード）の半分ほど
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
    // マナの減った大物が、近くのウィスプへ寄って吸う（sipWisp）。大物は暗い深部に、ウィスプは苔のある明るい所に多く、近くにいることは少ない。
    // 1〜2シードの出来事に大きく偏るので、15シードの合計で、目安は少なめにする（main の10日目から始めた最新の実測：3回・2シード）
    name: 'マナの減った大物がウィスプを吸う（15シードの合計で3回以上・2シード以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.deaths.filter((x) => x.cause === 'sipped').length);
      const seeds = n.filter((v) => v > 0).length;
      return { ok: sum(n) >= 3 && seeds >= 2, value: rs.filter((_, i) => n[i] > 0).map((r) => `${r.seed} ${n[rs.indexOf(r)]}`).join('、') + `（${seeds}シード）` };
    },
  },
  {
    // 冒険者が倒れた所で、マナが立ちのぼる（heroDeathMana）。外で死んだ者と、石になった者（死の記録を別の所でする）は除かれるので、8割以上で見る
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
    // どのシードで起きるかは展開で変わるので、15シードの合計で見る
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
    // この4シードでは10〜18日に新しい住処ができない（abc と seed7 は10日目より前からの住処が続く）。住処があるかで見る
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
    name: '大ネズミが土から湧きつづける（4シードの合計で、湧いた群れが25回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 2 && x.ev === 'gen').length);
      return { ok: sum(n) >= 25, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // スライムは死骸を包み込んで食べ、育つと二つに分かれる（死骸の予約が残ってどのスライムも食べられなくなると、生まれては飢え死にを繰り返す）。スライムがいたサンプルの割合で見る
    name: 'スライムが死骸を食べて残りつづける（4シードの合計で、スライムがいたサンプルが6割以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.samples.filter((s) => (s.counts[5] ?? 0) > 0).length);
      const all = sum(rs.map((r) => r.samples.length));
      return { ok: sum(n) >= all * 0.6, value: rs.map((r, i) => `${r.seed} ${n[i]}/${r.samples.length}`).join('、') };
    },
  },
  {
    // 大ネズミが絶えかけても、土からまた湧く。
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
    // 倒されたワームは、また深部から湧く（src/eco/spawndef.ts のワームの行）。
    // ワームの死はまれ（16シード×25日で数回）なので、該当する死が無ければ通す（0回を落とすと、ほかの変更で展開が分かれただけで落ちる）。
    // ワームの行には「前に湧いてから cool 回の生き物の更新は次を湧かせない」決まり（generateOne）と、湧き始める日（minDay）がある。
    // なので、湧き直しを待つ窓は、死んだ時刻・前に湧いてから cool がすぎて湧けるようになる時刻・湧き始める日のうち、いちばん遅い時刻から2日にする。
    // cool と minDay は表から読み、生き物の更新の回数は CR_EVERY を掛けて tick に直す（表や更新の間隔を変えても、チェックがずれない）。
    // 前に湧いた時刻は、実行の中の湧いた記録（settle の gen）と、始まりの日のセーブにある、最後に湧いた時の生き物の更新の番号（LA）から取る。
    // セーブに LA や更新の番号が無ければ、前に湧いた時刻が分からないので、数えずに落とす。待つ窓が実行の終わりを越える死は数えない
    name: '倒されたワームが、また深部から湧く（15シードで、湧けるようになってから2日の内に湧き直した回数が8割以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const def = SPAWN_DEFS.find((d) => d.k === Kind.Worm);
      if (!def) return { ok: false, value: 'src/eco/spawndef.ts にワームの行が無い' };
      // generateOne は「step − 前に湧いた step ≦ cool」なら湧かせないので、湧けるのは cool＋1 回の更新のあと
      const coolT = def.cool ? (def.cool + 1) * CR_EVERY : 0;
      const W = 2 * DAY_TICKS;
      let dead = 0;
      let back = 0;
      const noLA: string[] = [];
      for (const r of rs) {
        const gens = r.settle.filter((x) => x.k === Kind.Worm && x.ev === 'gen').map((x) => x.t as number);
        const st = r.state(r.from);
        const la = st?.eco?.LA as (number | null)[] | undefined;
        const s0 = st?.eco?.s;
        const t0 = st?.tick ?? st?.w?.tick;
        if (!Array.isArray(la) || typeof s0 !== 'number' || typeof t0 !== 'number') {
          noLA.push(r.seed);
          continue;
        }
        // LA の値が null なら、始まりの日までに一度も湧いていない（はじめからいたワームだけ）
        const la0 = la[Kind.Worm];
        if (la0 != null) gens.push(t0 - (s0 - la0) * CR_EVERY);
        for (const d of r.deaths.filter((x) => x.k === Kind.Worm)) {
          const prev = Math.max(-1e9, ...gens.filter((t) => t < d.t));
          const open = Math.max(d.t, prev + coolT, def.minDay * DAY_TICKS);
          if (open + W > r.to * DAY_TICKS) continue;
          dead++;
          if (gens.some((t) => t >= d.t && t <= open + W)) back++;
        }
      }
      if (noLA.length) return { ok: false, value: `始まりの日のセーブに、最後に湧いた時の記録（LA）か更新の番号が無い：${noLA.join('、')}` };
      return { ok: dead === 0 || back >= dead * 0.8, value: `倒された ${dead} 回、そのうち湧けるようになってから2日の内に湧き直した ${back} 回` };
    },
  },
  {
    // 道が見つからないとき、壁に押しつけて足踏みし続けず、近づけるだけ近づいて立ち止まる
    name: '道が見つからないまま壁際で足踏みしない（4シードの合計で40回以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.stuck.filter((x) => countsAsStuck(x) && x.nopath >= 0.5).length);
      return { ok: sum(n) <= 40, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 歩き方の止まる番で、その場から動いていない者は、描画で立ち姿になる（src/creatureView.ts。止まる番かは gaitPaused）。
    // 引っかかりの判定もそれに合わせて、止まる番を歩いていないとみなす（sim.ts の watchWalk）。
    // 回数は大ネズミの数で大きく変わるので、大ネズミ1匹あたりで見る：
    // 引っかかりの回数 ÷（ゲーム内の1/4日ごとのサンプルで数えた大ネズミの数の合計）
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
    // 逃げる距離（26px）の境目で行き来しないかを、大ネズミ1匹あたり（上の項目と同じ数え方）で、15シードの合計で見る
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
    // 数で大きく変わるので、2種を合わせた1匹あたり（大ネズミの項目と同じ数え方）で見る
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
    // あてもなくぶらつく所（stroll：住処や集落や村のないコボルト・ゴブリン・リザードマン、獲物の見つからないドラゴン）は、立ち止まる番と、ふつうの速さの0.9倍で歩く番を交互にする。
    // 住処や集落のそばでうろつく所（コボルト、ゴブリン、リザードマン、バジリスク）と、サラマンダー・スケルトンのさまよい歩きは、歩く番の速さをふつうの0.8〜0.9倍にする。
    // 数で大きく変わるので、7種を合わせた1匹あたり（トロールとオークの項目と同じ数え方）で見る
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
    // 回数はコウモリの数と混み具合で揺れるので、コウモリ1匹あたり（回数 ÷ 1/4日ごとのサンプルで数えたコウモリの数の合計）で見る
    name: 'コウモリがねぐらのそばで震えない（4シードで、コウモリ1匹あたりの引っかかりが2.5以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 1).length);
      const bats = rs.map((r) => r.samples.filter((x) => x.t > r.from * 14400).reduce((a, x) => a + (x.counts[1] ?? 0), 0));
      const v = sum(n) / Math.max(1, sum(bats));
      return { ok: v <= 2.5, value: `${v.toFixed(2)}（${rs.map((r, i) => `${r.seed} ${n[i]}/${bats[i]}`).join('、')}）` };
    },
  },
  {
    // コボルトは食べ物の目当てを保つ（src/eco/kobold.ts。更新のたびに苔を探し直すと、目当てが入れ替わってジグザグに行き来する）。
    // 回数はコボルトの数で大きく揺れるので、コボルト1匹あたりの引っかかり（大ネズミの項目と同じ数え方）で見る
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
    // 人の気配を避ける強いモンスターは、退く先を決めて着くまで歩き、退き終えてしばらくは気配を気にしない（retreatTo・retreatStep）。
    name: '強いモンスターが人の気配の前で行き来しない（オーク・ミノタウロス・トロール・ワイバーンの引っかかりが4シードの合計で2200回以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.hitch.filter((x) => x.k === 13 || x.k === 15 || x.k === 16 || x.k === 23).length);
      return { ok: sum(n) <= 2200, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 縦穴から来るコウモリは、縦穴の真上が岩や縦穴とつながっていない洞窟なら、縦穴のマスの天井ぎわに生まれてぶら下がる（roostSpot）。
    // （岩の中や別の洞窟に生まれると、夜に縦穴へ戻れず、そのそばで足踏みしたまま飢える）
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
    // 横切る仲間のたびに歩みをゆるめ、脚を動かしたまま進まないことがないか。アリの数で大きく変わるので、アリ1匹あたりの引っかかり（大ネズミの項目と同じ数え方）で見る
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
    // アリの住みかの印（逃げるときに逃げ帰る先）は巣（src/eco/ant.ts、src/eco/arrivals.ts）。入ってきた地表の口のままだと、傷を負うとダンジョンの入口まで逃げる。
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
    // 食べ物のマスは、いまいる所と歩いてつながるマスだけを選ぶ（goblinForage、findMoss）。
    // （斜めにしかつながらない窪みや壁の向こうのマスを選ぶと、壁の角に押しつけたまま足踏みし続ける）。15シードの10〜18日目のゴブリンの長い足踏み（2分以上）で見る
    name: 'ゴブリンが行けない食べ物を目指して足踏みし続けない（15シードで、ゴブリンの2分以上の足踏みが45回以下）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.stuck.filter((x) => countsAsStuck(x) && x.k === 12).length);
      return { ok: sum(n) <= 45, value: `${sum(n)}回（${rs.filter((_r, i) => n[i]).map((r) => `${r.seed} ${n[rs.indexOf(r)]}`).join('、')}）` };
    },
  },
  {
    // 逃げる者は、住みかのそばで相手が離れていれば身をひそめ、帰り道の途中に相手がいれば近づかずに身をひそめる（woundsAndFlight）。
    // 動けなければ相手の方を向いて縮こまり（fleeFrom）、角を斜めに抜けられないときは道筋に従う（straightOk）。
    // 15シードの10〜18日目のコボルトの長い足踏み（2分以上）で見る
    name: '逃げるコボルトが住処のそばで足踏みし続けない（15シードで、コボルトの2分以上の足踏みが40回以下）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.stuck.filter((x) => countsAsStuck(x) && x.k === 10).length);
      return { ok: sum(n) <= 40, value: `${sum(n)}回` };
    },
  },
  {
    // 焚き火の席が壁の中に置かれ、休むあいだ席へ向かって足踏みし続けることがない
    name: '冒険者が足踏みしない（4シードの合計で40回以下）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.stuck.filter((x) => countsAsStuck(x) && x.k === 25).length);
      return { ok: sum(n) <= 40, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 掘り出した土の瓦礫を生き物のいるマスに置かない。それでも壁や瓦礫に埋まった生き物は、安全策で床へ出る（その回数が少ないこと）。
    // 群れの数と住処の場所で回数が変わるので、目安には少し余裕を置く（実測11回）
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
    // どのシードで起きるかは変更のたびに入れ替わるので、焼け死ぬ者すべてを、起きやすいシード（ほかの項目でも10〜18日目を実行している組）で見る
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
    // 目安は実測（仕留めた43・引きずった23）の半分ほど
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
    // 水場（src/eco/water.ts）：渇いた生き物が水場へ水を飲みに来て、いろいろな種が入れ替わり立ち寄る。
    // 水を飲みはじめたとき、その水場のまわりに3種以上いれば、水場ごとに生き物の更新300回に1回だけ waterCrowd を記録する。
    name: '水場に入れ替わり水を飲みに来て、3種以上が同時にいる（15シードの合計で、水を飲んだのが200回以上・3種以上が同時にいたのが30回以上、起きたシードが10以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const drink = sum(rs.map((r) => r.settle.filter((x) => x.ev === 'drink').length));
      const crowd = rs.map((r) => r.settle.filter((x) => x.ev === 'waterCrowd').length);
      const seeds = crowd.filter((v) => v > 0).length;
      return { ok: drink >= 200 && sum(crowd) >= 30 && seeds >= 10, value: `水を飲んだ ${drink}、3種以上が同時にいた ${sum(crowd)}（${seeds}シード）` };
    },
  },
  {
    // 底の層（src/eco/swarm.ts）：粒スライムと光る胞子を、決めた種が食べ、粒スライムが濃い所では大きいスライムが生まれる。
    // graze は4回に1回だけ settle に記録する（n 0 粒スライム / 1 光る胞子 / 2 大グモが巣にかかった胞子）
    name: '底の層を食べる（15シードの合計で、粒スライム・光る胞子・巣の胞子の記録がそれぞれ20以上、粒スライムを食べたシードが12以上、大きいスライムが1回以上生まれる）',
    ...RUN_WIDE,
    test: (rs) => {
      const cnt = (n: number) => sum(rs.map((r) => r.settle.filter((x) => x.ev === 'graze' && x.n === n).length));
      const seeds = rs.filter((r) => r.settle.some((x) => x.ev === 'graze' && x.n === 0)).length;
      const born = sum(rs.map((r) => r.settle.filter((x) => x.ev === 'grainSlime').length));
      const [g, sp, wb] = [cnt(0), cnt(1), cnt(2)];
      return { ok: g >= 20 && sp >= 20 && wb >= 20 && seeds >= 12 && born >= 1, value: `粒スライム ${g}（${seeds}シード）、光る胞子 ${sp}、巣の胞子 ${wb}、大きいスライム ${born}` };
    },
  },
  {
    // 床を生かす（dripAt・mossStep、rotInto、batDropping）：天井のしずくのまわりに苔が育ち、
    // 死骸やねぐらの糞からキノコが生えて、苔かキノコ（20以上）のある床が広がる。
    // 18日目の地形（日次スナップショットの掘削のログを作業ツリーのコードで再生したもの）と、スナップショットの苔とキノコで数える
    name: '苔かキノコのある床が広がる（4シードそれぞれで、18日目に開いた床の10％以上）',
    ...RUN_A,
    test: (rs) => {
      const v = rs.map((r) => {
        const st = r.state(r.to);
        if (!st) return NaN;
        const w = new World(r.seed);
        for (const op of (st.digs ?? []) as number[]) (w as any).replayOp(op);
        const m = w.map;
        const mo = Buffer.from(st.moss as unknown as string, 'base64');
        const fu = Buffer.from(st.fungus as unknown as string, 'base64');
        let n = 0;
        let g = 0;
        for (let k = 0; k < m.solid.length; k++) {
          if (m.solid[k] || m.sealed[k]) continue;
          n++;
          if (mo[k] >= 20 || fu[k] >= 20) g++;
        }
        return (100 * g) / n;
      });
      return { ok: v.every((x) => x >= 10), value: rs.map((r, i) => `${r.seed} ${v[i].toFixed(1)}％`).join('、') };
    },
  },
  {
    // 溶岩をはさんだ空洞（applyDig・openPocket）：溶岩のマスには閉じた空洞の印が付かないので、空洞を開くときに溶岩を越えて広げる。
    // 越えないと、溶岩の溜まりで分かれた空洞の片側が開いたときや、開いた側から溶岩の隣を掘り抜いたときに、溶岩の向こうの床が閉じたまま残る
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
    // 歩いて行ける場所の判定（regionOf）：溶岩も壁とみなす。溶岩の溜まりをはさんだ二つの開いた場所は、別の領域になる
    // （溶岩を通れる床として扱うと同じ領域になり、溶岩の向こうのコボルトの住処が島とみなされず、入口から来たコボルトが溶岩の手前で立ち往生する）。
    // 10日目（始めの日）の地形（日次スナップショットの掘削のログを作業ツリーのコードで再生したもの）で、まわりの床が二つ以上の領域に分かれる溶岩の溜まりを数える。
    // 溜まりが場所を分けるかは生き物が掘った跡で変わるので、18日目ではなく10日目の地形で見る
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
    // コボルトは外から来ず、住処の場で土から湧く（src/eco/spawndef.ts）。住処を目指してさまよい、飢え死にすることが起きないかを見る
    name: 'コボルトが行けない住処を目指して飢えない（seed30・かしたれ の10〜18日目で、コボルトの飢え死にが合計10匹以下。main は37匹）',
    seeds: ['seed30', 'かしたれ'],
    from: 10,
    to: 18,
    test: (rs) => {
      const n = rs.map((r) => r.deaths.filter((x) => x.k === 10 && x.cause === 'starve').length);
      return { ok: sum(n) <= 10, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 地形の釣り合い（World.closeOldTunnels と、掘った所の瓦礫が岩に戻ること）：掘り跡が開き続けない。
    // 開いた床の増減は、地形変更ログ（digs）の from〜to 日目に増えた分から数える（掘る・風化で +1、瓦礫・崩落で −1、固まるは 0）
    name: '開いた床が増え続けない（15シードの10〜18日目で、増えた床の合計が床の1%以内。main は 2619）',
    ...RUN_WIDE,
    test: (rs) => {
      const OPEN = [1, -1, -1, 1, 0, 0, 0, 0];
      const d = rs.map((r) => {
        const a = (r.state(r.from)?.digs ?? []) as number[];
        const b = (r.state(r.to)?.digs ?? []) as number[];
        let n = 0;
        for (let i = a.length; i < b.length; i++) n += OPEN[b[i] & 7];
        return n;
      });
      // 開いた床はシードごとにおよそ1万2千マス
      return { ok: Math.abs(sum(d)) <= rs.length * 120, value: `合計 ${sum(d)}（${rs.map((r, i) => `${r.seed} ${d[i]}`).join('、')}）` };
    },
  },
  {
    // 古い坑道が崩れて塞がる場面（World.closeOldTunnels）：見せたい場面が起きているか
    name: '古い坑道が崩れて塞がる（15シードの10〜18日目で、合計15回以上）',
    ...RUN_WIDE,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.ev === 'tunnelClose').length);
      return { ok: sum(n) >= 15, value: `合計 ${sum(n)}（${rs.map((r, i) => `${r.seed} ${n[i]}`).join('、')}）` };
    },
  },
];
