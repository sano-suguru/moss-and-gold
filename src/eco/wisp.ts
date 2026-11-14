/** Ecology のメソッド：ウィスプ（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { type Cr, DIR16, Ecology, Kind, NB4, SPEC, ih, sq } from '../ecology';
import { TILE } from '../mapgen';

export function wisp(this: Ecology, c: Cr, day: number): void {
  // 光の精：生まれた光の筋のまわり5マスをゆっくり漂う。飢えない。襲われたときだけ、まぶしい光線で打ち返す
  if (c.elite === 7) {
    c.sinceMeal = 0;
    if (c.foe && this.w.tick - c.hitAt < 120) {
      const f = this.byId.get(c.foe);
      if (f && !f.dead && sq(f.x - c.x) + sq(f.y - c.y) < 5 * TILE * 5 * TILE) {
        c.act = 2;
        if (this.step % 20 === c.id % 20) this.fight(c, f);
        return;
      }
    }
    const a = (ih(c.id, this.step >> 6, 309) % 628) / 100;
    c.act = 1;
    this.goTo(c, c.hx + Math.cos(a) * 3 * TILE, c.hy + Math.sin(a) * 2 * TILE, SPEC[Kind.Wisp].speed * 0.5);
    return;
  }
  const m = this.w.map;
  const k = this.tileOf(c.x, c.y);
  // 光に寄る：自分と上下左右のマスで一番明るい方へ
  let best = this.litW(k, day);
  let bx = 0;
  let by = 0;
  const tx = Math.floor(c.x / TILE);
  const ty = Math.floor(c.y / TILE);
  const nb = NB4;
  for (const [dx, dy] of nb) {
    const xx = tx + dx;
    const yy = ty + dy;
    if (xx < 0 || yy < 0 || xx >= m.w || yy >= m.h) continue;
    const l = this.litW(yy * m.w + xx, day);
    if (l > best + 0.02) {
      best = l;
      bx = dx;
      by = dy;
    }
  }
  c.vx += bx * 0.08;
  c.vy += by * 0.08;
  // 水の流れに乗る
  if (k >= 0 && this.w.water[k] > 20) {
    const sc = m.height[k] * 2 + this.w.water[k];
    for (const [dx, dy] of nb) {
      const n = k + dx + dy * m.w;
      if (n < 0 || n >= m.solid.length || m.solid[n]) continue;
      if (m.height[n] * 2 + this.w.water[n] < sc - 2) {
        c.vx += dx * 0.05;
        c.vy += dy * 0.05;
        break;
      }
    }
  }
  const j = DIR16[ih(c.id, this.step, 1) & 15];
  c.vx = (c.vx + j[0] * 0.18) * 0.86;
  c.vy = (c.vy + j[1] * 0.18) * 0.86;
  const sp = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
  const max = SPEC[Kind.Wisp].speed;
  if (sp > max) {
    c.vx = (c.vx / sp) * max;
    c.vy = (c.vy / sp) * max;
  }
  // 間引いたぶん（Ecology.WISP_EVERY 回ぶん）動いて食べる
  const K = Math.max(Ecology.WISP_EVERY, 1);
  this.tryMove(c, c.vx * K, c.vy * K);
  if (!(c.act === 2 && c.actT < 4)) c.act = sp > 0.15 ? 1 : 0;
  if (ih(c.id, this.step, 2) % 2 === 0 && c.food < SPEC[Kind.Wisp].cap && this.eatMoss(c, K)) {
    c.act = 2;
    c.actT = 0;
  }
}

/** ウィスプがこの回の更新では判断しない（間引かれる）か */
export function wispIdle(this: Ecology, c: Cr): boolean {
  const K = Ecology.WISP_EVERY;
  return K > 1 && this.step % K !== c.id % K;
}

/** 描画の補間の割合：間引かれるウィスプは、動いた回から WISP_EVERY 回ぶんの時間をかけて px から x へ（ほかは alpha のまま） */
export function moveAlpha(this: Ecology, c: Cr, alpha: number): number {
  const K = Ecology.WISP_EVERY;
  if (c.k !== Kind.Wisp || c.elite === 7 || c.caught || K <= 1) return alpha;
  const since = (((this.step - c.id) % K) + K) % K;
  return (since + alpha) / K;
}

declare module '../ecology' {
  interface Ecology {
    wisp: typeof wisp;
    wispIdle: typeof wispIdle;
    moveAlpha: typeof moveAlpha;
  }
}

Object.assign(Ecology.prototype, { wisp, wispIdle, moveAlpha });
