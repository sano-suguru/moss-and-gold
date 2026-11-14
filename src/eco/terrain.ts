/** Ecology のメソッド：掘ることと、空洞と崩落（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { Ecology } from '../ecology';

/** 巣穴やアリの通路を、空洞の気配の方へ一マスずつ掘り進める */
export function tunnelToward(this: Ecology, head: number, home: number, R: number): number {
  const m = this.w.map;
  const hx = home % m.w;
  const hy = Math.floor(home / m.w);
  // 外の風：まだ閉じている地表の横穴の空洞が近くにあれば、その風の吹く方へ掘りたがる
  const tk = this.windTarget(hx, hy, R * 2) ?? this.w.nearestSealed(hx, hy, R);
  if (tk < 0) return -1;
  const tx = tk % m.w;
  const ty = Math.floor(tk / m.w);
  let h = head >= 0 && !m.solid[head] ? head : home;
  // 開いた床のうちは先へ進む
  for (let guard = 0; guard < 20; guard++) {
    const x = h % m.w;
    const y = Math.floor(h / m.w);
    let best = -1;
    const here = Math.abs(tx - x) + Math.abs(ty - y);
    let bd = here + 1;
    // 硬い岩は掘れない（向きを変える）。遠回りは一マスまで
    for (const q of [h + 1, h - 1, h + m.w, h - m.w]) {
      const d = Math.abs(tx - (q % m.w)) + Math.abs(ty - Math.floor(q / m.w));
      if (m.lava[q] || (m.solid[q] && !m.rubble[q] && m.hard[q] === 2)) continue;
      if (d < bd || (d === bd && best >= 0 && m.solid[best] && !m.solid[q])) {
        bd = d;
        best = q;
      }
    }
    if (best < 0 || bd > here) return -1;
    if (m.solid[best]) {
      if (this.w.dig(best)) return best;
      return -1;
    }
    h = best;
  }
  return -1;
}

declare module '../ecology' {
  interface Ecology {
    tunnelToward: typeof tunnelToward;
  }
}

Object.assign(Ecology.prototype, { tunnelToward });
