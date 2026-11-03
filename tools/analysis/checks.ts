/**
 * 早めの確かめ（npm run check）の中身。大きな batch の前に、決まった途中の状態から短く回して、新しい流れが実際に起きるかを見る。
 *
 * 一つの確かめ：seeds のそれぞれを、前の版（--base、既定 HEAD）の from 日目の状態から、いまの版で to 日目まで回し、
 * test に記録（from 日目より後のもの）を渡す。同じ (シード, from, to) の回は確かめどうしで共有し、保存庫（runs/.cache/run）にも残る。
 * いまの版を変えていなければ、2回目からは回さずに結果を使う。
 *
 * 確かめを足すときは、起きることがわかっているシードと日を、前の batch の settle.jsonl などから選ぶ（例：かしたれは10日目ごろに貢ぎ物）。
 */
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
  /** その日の状態（ゲームの保存と同じ形の JSON）。from〜to の整数の日 */
  state: (day: number) => any;
}
export interface Check {
  name: string;
  seeds: string[];
  from: number;
  to: number;
  /** シードごとの記録を受け取り、届いたかどうかと、表に出す値 */
  test: (r: Recs[]) => { ok: boolean; value: string };
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const RUN_A = { seeds: ['かしたれ', 'seed8', 'abc', 'seed7'], from: 10, to: 18 };

export const CHECKS: Check[] = [
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
    name: 'オークが貢ぎ物を取り立てる（4シードで1回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 13 && x.ev === 'tribute').length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    name: 'ゴブリンの集落の蓄えが0でない時がある（集落のあった記録の1割以上）',
    ...RUN_A,
    test: (rs) => {
      const v = rs.flatMap((r) => r.samples.filter((s) => (s.settle?.campStore ?? []).length).map((s) => sum(s.settle.campStore)));
      const pos = v.filter((x) => x > 0).length;
      return { ok: v.length > 0 && pos >= 0.1 * v.length, value: `${pos}/${v.length} 記録` };
    },
  },
  {
    // PR #2 のあと、この4シードでは10〜18日に新しい住処ができない（abc と seed7 は10日目より前からの住処が続く）。住処があるかで見る
    name: 'コボルトの住処がある（4シードの記録の合計の1割以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.samples.filter((s) => (s.settle?.warren ?? []).length).length);
      const all = sum(rs.map((r) => r.samples.length));
      return { ok: sum(n) >= 0.1 * all, value: rs.map((r, i) => `${r.seed} ${n[i]}/${r.samples.length}`).join('、') };
    },
  },
  {
    // 大ネズミは天井の裂け目や横穴から少しずつ来ては去るので、ある刻みに0匹でも絶えたとは限らない（前の版でも abc は0匹と数匹を行き来する）。来つづけるかで見る
    name: '大ネズミが来つづける（4シードの合計で10匹以上来た）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.births.filter((b) => b.k === 2 && b.origin !== 'born').length);
      return { ok: sum(n) >= 10, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 七巡目：地表の横穴が開いたあとでも、絶えかけたら天井の割れ目から入り直す（abc と seed7 は前の版で0匹の日が続く）
    name: '大ネズミが割れ目から入り直す（4シードで1回以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 2 && x.ev === 'reenter').length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    // 七巡目：取り立ては腹を空かせたときに、要る分（腹の空き＝120まで）を、蓄えの半分まで。空振り（0）は記録しない
    name: 'オークの取り立ては1回につき1〜120',
    ...RUN_A,
    test: (rs) => {
      const t = rs.flatMap((r) => r.settle.filter((x) => x.k === 13 && x.ev === 'tribute'));
      const v = t.length ? sum(t.map((x) => x.n ?? 0)) / t.length : 0;
      return { ok: t.length > 0 && t.every((x) => x.n >= 1 && x.n <= 120), value: `${t.length} 回、平均 ${v.toFixed(0)}` };
    },
  },
  {
    name: '四つの帳簿がずれない',
    ...RUN_A,
    test: (rs) => {
      const d = Math.max(0, ...rs.flatMap((r) => r.samples.map((s) => Math.max(Math.abs(s.nutrientDrift), Math.abs(s.goldDrift), Math.abs(s.rockDrift), Math.abs(s.manaDrift ?? 0)))));
      return { ok: d === 0, value: `最大 ${d}` };
    },
  },
];
