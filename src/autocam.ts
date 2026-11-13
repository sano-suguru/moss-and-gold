/**
 * おまかせカメラ：眺めているだけの人のために、いろいろな種が入り乱れ、出来事の起きている場所へ、カメラがゆっくり寄っていく。
 * 描画だけのもの（シミュレーションには関わらず、セーブもしない）。
 *
 * - 見どころの点数：画面と同じ大きさの範囲について、生き物の種類の数 × 4 ＋ 生き物の数（30まで）× 0.3 ＋ 最近の出来事
 *   （攻撃の演出 3、捕食 2、水を飲んだ 1、底の層を食べた 0.2。合わせて15まで）。冒険者は種類の一つとして数える。
 * - 候補は、生きている生き物（外に出ている者を除く）の位置から最大60か所。
 * - 3秒ごとに見直す。今の場所にいる生き物の重心へ少しずつ寄せ直し、別の場所が今の場所の1.3倍より高ければ、
 *   今の場所に10秒以上いたときだけ移る。45秒いたら、今の場所から離れた、点数のいちばん高い場所へ移る。
 *   最近（90秒の内）見た場所のそばは、点数を6割にして、同じ所ばかり見ないようにする。
 */
import type { Ecology } from './ecology';
import type { Camera } from './input';

/** 人（冒険者）の種の番号 */
const ADV = 25;

interface Spot {
  x: number;
  y: number;
  score: number;
}

export class AutoCam {
  on = false;
  private target: Spot | null = null;
  private since = 0;
  private lastEval = -1e9;
  private visited: { x: number; y: number; t: number }[] = [];

  /** 見どころの点数（範囲の大きさは画面と同じ w×h。中心 x, y） */
  private score(eco: Ecology, x: number, y: number, w: number, h: number): { s: number; cx: number; cy: number } {
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const y0 = y - h / 2;
    const y1 = y + h / 2;
    const kinds = new Set<number>();
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (const c of eco.list) {
      if (c.dead || c.away || c.x < x0 || c.x >= x1 || c.y < y0 || c.y >= y1) continue;
      kinds.add(c.k);
      n++;
      sx += c.x;
      sy += c.y;
    }
    const t = eco.w.tick;
    let ev = 0;
    for (const a of eco.fxAttacks) if (t - a.t < 40 && a.ax >= x0 && a.ax < x1 && a.ay >= y0 && a.ay < y1) ev += 3;
    for (const a of eco.fxEats) if (t - a.t < 60 && a.x >= x0 && a.x < x1 && a.y >= y0 && a.y < y1) ev += 2;
    for (const a of eco.fxGraze) if (t - a.t < 30 && a.x >= x0 && a.x < x1 && a.y >= y0 && a.y < y1) ev += 0.2;
    for (const a of eco.fxDrinks) if (t - a.t < 60 && a.x >= x0 && a.x < x1 && a.y >= y0 && a.y < y1) ev += 1;
    const s = kinds.size * 4 + Math.min(30, n) * 0.3 + Math.min(15, ev);
    return { s, cx: n ? sx / n : x, cy: n ? sy / n : y };
  }

  /** 最近見た場所のそばなら、点数を減らす */
  private recent(x: number, y: number, now: number, w: number): number {
    for (const v of this.visited) if (now - v.t < 90000 && Math.hypot(v.x - x, v.y - y) < w * 0.6) return 0.6;
    return 1;
  }

  /** 画面の大きさ（ワールドのピクセル w×h）で見どころを選び直し、カメラを寄せる。dt は前の描画からの秒数 */
  update(now: number, dt: number, eco: Ecology, cam: Camera, w: number, h: number): void {
    if (!this.on) return;
    if (now - this.lastEval > 3000) {
      this.lastEval = now;
      const live = eco.list.filter((c) => !c.dead && !c.away);
      // 今の場所を、そこにいる生き物の重心へ寄せ直して点数を付け直す
      let cur: Spot | null = null;
      if (this.target) {
        const r = this.score(eco, this.target.x, this.target.y, w, h);
        cur = { x: this.target.x + (r.cx - this.target.x) * 0.5, y: this.target.y + (r.cy - this.target.y) * 0.5, score: r.s };
      }
      let best: Spot | null = null;
      const step = Math.max(1, Math.floor(live.length / 60));
      const far = !!cur && now - this.since > 45000;
      for (let i = 0; i < live.length; i += step) {
        const c = live[i];
        if (c.k === ADV && live.length > 20 && i % 3 !== 0) continue;
        if (far && cur && Math.hypot(c.x - cur.x, c.y - cur.y) < w) continue;
        const r = this.score(eco, c.x, c.y, w, h);
        const s = r.s * this.recent(r.cx, r.cy, now, w);
        if (!best || s > best.score) best = { x: r.cx, y: r.cy, score: s };
      }
      const move = !cur || (best && (far || (best.score > cur.score * 1.3 && now - this.since > 10000)));
      if (move && best) {
        if (this.target) this.visited.push({ x: this.target.x, y: this.target.y, t: now });
        this.visited = this.visited.filter((v) => now - v.t < 90000);
        this.target = best;
        this.since = now;
      } else if (cur) this.target = cur;
    }
    if (this.target) {
      // なめらかに寄る（遠いほど速く、1秒でおよそ7割）
      const k = Math.min(1, dt * 1.2);
      cam.x += (this.target.x - cam.x) * k;
      cam.y += (this.target.y - 10 - cam.y) * k;
    }
  }

  /** 入れる・切る（入れ直したら、すぐに選び直す） */
  set(on: boolean): void {
    this.on = on;
    this.target = null;
    this.lastEval = -1e9;
  }
}
