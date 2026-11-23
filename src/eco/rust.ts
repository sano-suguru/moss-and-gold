/**
 * Ecology のメソッド：錆喰い虫（Kind.RustBeetle）。鉄を食べる小さな甲虫。
 *
 * 見せたい場面：
 *  1. 長く打ち捨てられて錆びた、未練の抜けた鉄の武具（甲冑が打たれて落とした武器、崩れた甲冑の残骸、僧侶に清められた武具。rustEdible）に、
 *     赤錆色の甲虫が群がって齧り、錆の粉を散らしながら食べ尽くす（rustEdible）。
 *  2. マナの宿りうる武具（fuel が0以上。古戦場の錆びた武具も含む）は、未練を嫌って食べない。甲冑の材料には手を付けず、
 *     甲冑が崩れたあとの残骸を片づける。
 *  3. 鉄を食べると、ときどき土の養分から子を産む。鉄が尽きて長く食べられないと、飢えて死ぬ。
 * 養分ではなく鉄を食べるので、胃と代謝は持たない（SPEC の cap 0）。飢えは最後に鉄を食べてからの生き物の更新の回数（sinceMeal）で決まる。
 * 齧っている武具は ref2、齧りはじめた回は lureAt に持つ。
 */
import { type Cr, CR_EVERY, DAY_TICKS_ECO, DIR16, Ecology, type Item, Kind, SPEC, ih, sq } from '../ecology';
import { isJobItem } from './armor';

/** 鉄の武具を嗅ぎつける道のり（歩数） */
const RUST_SMELL = 24;
/** 一つの武具を食べ尽くすまでの、生き物の更新の回数 */
export const RUST_GNAW = 300;
/** 最後に鉄を食べてから、これだけの生き物の更新の回数がたつと飢えて死ぬ（ゲーム内の2日） */
export const RUST_STARVE = Math.round((2 * DAY_TICKS_ECO) / CR_EVERY);
/** 武具へ向かう途中で目当てを選び直す間隔（生き物の更新の回数） */
const RUST_RETARGET = 200;
/** ダンジョン全体の数の上限（子を産むのはこれより少ないときだけ） */
export const RUST_CAP = 8;

/** 武具が錆びるまでの、床に落ちてからの tick（ゲーム内の1日） */
export const RUST_AGE = DAY_TICKS_ECO;
/**
 * 錆喰い虫が食べられる武具：未練の抜けた（fuel が負の）職業の道具で、床に落ちてから RUST_AGE 以上たって錆びたもの。
 * 甲冑が打たれて落とした武器は、たいてい錆びる前に甲冑が拾い直す（落ちてすぐの武器を食べると、甲冑が武具を取り込む場面が半分に減る）
 */
export function rustEdible(this: Ecology, it: Item): boolean {
  return isJobItem(it.kind) && it.fuel < 0 && this.w.tick - it.t >= RUST_AGE;
}

export function rustBeetle(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.RustBeetle];
  if (c.sinceMeal > RUST_STARVE) {
    this.die(c, 'starve');
    return;
  }
  let it = c.ref2 ? (this.gear.find((o) => o.id === c.ref2) ?? null) : null;
  // 目当ての武具が無くなった（ほかの錆喰い虫が食べた、甲冑やゴブリンが拾った）か、食べられなくなったら、探し直す
  if (it && !this.rustEdible(it)) it = null;
  if (!it) {
    c.ref2 = 0;
    it = this.rustTarget(c);
    if (it) {
      c.ref2 = it.id;
      c.lureAt = -1;
    }
  }
  if (it) {
    if (sq(it.x - c.x) + sq(it.y - c.y) > 9 * 9) {
      c.act = 1;
      c.lureAt = -1;
      this.goTo(c, it.x, it.y, s.speed);
      // 向かう途中は、生き物の更新 RUST_RETARGET 回ごとに目当てを選び直す（地形が変わって行けなくなった武具を追い続けない。
      // 選び直しは歩いて RUST_SMELL 歩までの武具からなので、行けない武具は選ばれない）
      if (this.step % RUST_RETARGET === c.id % RUST_RETARGET) c.ref2 = 0;
      return;
    }
    // 齧る（act 2 のまま。齧りはじめた回から RUST_GNAW 回で食べ尽くす）
    if (c.lureAt < 0) c.lureAt = this.step;
    c.act = 2;
    c.actT = 0;
    c.dir = Math.abs(it.x - c.x) > Math.abs(it.y - c.y) ? (it.x > c.x ? 2 : 3) : it.y > c.y ? 0 : 1;
    // 齧るたびに錆の粉が舞う（描画専用の印。fxBites の4つ目が2）
    if (this.step % 3 === c.id % 3) this.fxBites.push(this.step, c.id, this.tileOf(it.x, it.y), 2);
    if (this.step - c.lureAt >= RUST_GNAW) this.rustEat(c, it);
    return;
  }
  // 食べる物が無ければ、壁ぎわをゆっくりうろつく
  if (ih(c.id, this.step >> 4, 321) % 3 === 0) {
    const j = DIR16[ih(c.id, this.step >> 4, 322) & 15];
    c.act = 1;
    this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
  } else c.act = 0;
}

/** いちばん歩いて近い、食べられる武具（RUST_SMELL 歩まで。なければ null） */
export function rustTarget(this: Ecology, c: Cr): Item | null {
  if (!this.gear.some((o) => this.rustEdible(o))) return null;
  const walk = this.walkNear(this.tileOf(c.x, c.y), RUST_SMELL);
  let best: Item | null = null;
  let bd = 1e9;
  for (const o of this.gear) {
    if (!this.rustEdible(o)) continue;
    const k = this.tileOf(o.x, o.y);
    const d = k >= 0 ? walk[k] : -1;
    if (d < 0 || d >= bd) continue;
    bd = d;
    best = o;
  }
  return best;
}

/** 武具を食べ尽くす：床から消し、ときどき土の養分から子を産む */
export function rustEat(this: Ecology, c: Cr, it: Item): void {
  this.gear = this.gear.filter((o) => o !== it);
  this.record('settle', { t: this.w.tick, k: Kind.RustBeetle, ev: 'rust', id: c.id, n: it.kind, x: Math.round(it.x), y: Math.round(it.y) } as never);
  c.ref2 = 0;
  c.lureAt = -1;
  c.sinceMeal = 0;
  c.act = 0;
  if (this.counts[Kind.RustBeetle] < RUST_CAP && ih(c.id, this.step, 323) % 2 === 0) {
    const k = this.tileOf(c.x, c.y);
    const got = k >= 0 ? this.takeNutrients(k, SPEC[Kind.RustBeetle].body, 3) : 0;
    if (got) {
      const b = this.spawn(Kind.RustBeetle, c.x + 4, c.y + 2, got, 0);
      b.lureAt = -1;
      this.counts[Kind.RustBeetle]++;
    }
  }
}

/**
 * 錆喰い虫が湧く場所（タイル番号、なければ -1）：食べられる武具のうち、まわり6マスの内に食べられる武具がいちばん多いものの足もと。
 * 状態は書き換えない（spawndef の site）
 */
export function rustSite(this: Ecology): number {
  const items = this.gear.filter((o) => this.rustEdible(o));
  let best = -1;
  let bn = 0;
  for (const it of items) {
    const k = this.tileOf(it.x, it.y);
    if (k < 0 || this.w.map.solid[k] || this.w.map.sealed[k]) continue;
    let n = 0;
    for (const o of items) if (sq(o.x - it.x) + sq(o.y - it.y) < 96 * 96) n++;
    if (n > bn) {
      bn = n;
      best = k;
    }
  }
  return best;
}

declare module '../ecology' {
  interface Ecology {
    rustBeetle: typeof rustBeetle;
    rustTarget: typeof rustTarget;
    rustEat: typeof rustEat;
    rustSite: typeof rustSite;
    rustEdible: typeof rustEdible;
  }
}
Object.assign(Ecology.prototype, { rustBeetle, rustTarget, rustEat, rustSite, rustEdible });
