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
    name: 'コボルトの住処ができる（4シードで1つ以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => r.settle.filter((x) => x.k === 10 && x.ev === 'found').length);
      return { ok: sum(n) >= 1, value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
    },
  },
  {
    name: '大ネズミが絶えない（最後の記録で、4シードとも1匹以上）',
    ...RUN_A,
    test: (rs) => {
      const n = rs.map((r) => (r.samples.length ? r.samples[r.samples.length - 1].counts['2'] ?? 0 : 0));
      return { ok: n.every((x) => x > 0), value: rs.map((r, i) => `${r.seed} ${n[i]}`).join('、') };
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
