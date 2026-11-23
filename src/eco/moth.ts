/**
 * Ecology のメソッド：灯り蛾（Kind.Moth）。
 *
 * 見せたい場面：
 *  1. 光る苔の群落から小さな蛾が湧き、明かり（冒険者の松明と杖の光、ドワーフの坑夫の灯り、焚き火、鍛冶場や集落の火、坑道のランプ、床で燃える松明）を
 *     見つけると寄っていき、そのまわりをひらひら回る（mothLights。生き物の光る体、ウィスプやゴーストには寄らない）。
 *  2. 明かりに群がった蛾を、夜に飛ぶコウモリがさらい（batHuntMoth）、水際の大ガエルが舌で捕まえ、クモの巣が捕らえる。
 *  3. 腹が減ると苔へ降りて食べる。明かりが無ければ、湧いた苔のまわりを漂う（住みかは hx, hy）。
 * 小さく、死ぬと体は土へ返って死骸を残さない（骨の積もった暗がりや死骸を食べる種の当てにならないように。die）。
 * いま回っている明かりは ref2 に持つ（明かりの種類×1e6＋マス。離れた所（3マスより遠く）から着いたとき settle の light を記録する）。
 */
import { type Cr, DIR16, Ecology, Job, Kind, SPEC, ItemKind, ih, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 明かりに気づく距離（マス） */
export const MOTH_SEE = 10;
/** 寄っていく明かりの、住みか（湧いた苔）からの遠さの上限（マス。松明を持った一行にダンジョンじゅうついて行かず、苔のまわりを通る明かりに群がって戻る） */
const MOTH_RANGE = 12;
/** 明かりに着いたとみなす距離（px。ここから回りはじめる） */
const MOTH_NEAR = 3 * TILE;
/** 苔を食べに降りる腹の減り具合（食べた物が胃の大きさのこの割合を切ったら） */
const MOTH_HUNGRY = 0.5;
/** 苔を探す距離（マス） */
const MOTH_MOSS = 6;
/** ダンジョン全体の数の上限（湧く表の上限） */
export const MOTH_CAP = 40;
/** 明かりの種類：0 冒険者の松明・杖、1 ドワーフの坑夫の灯り、2 冒険者の焚き火、3 集落・鍛冶場の火、4 坑道のランプ、5 床で燃える松明 */
export type MothLightKind = 0 | 1 | 2 | 3 | 4 | 5;

/** 明かりの一覧（x, y, 種類×1e6＋マス を3つずつ）。生き物の更新ごとに作り直す（セーブしない。作り直しは更新の通し番号だけで決める） */
const cache = new WeakMap<Ecology, { step: number; pts: number[] }>();

/** 蛾が寄る明かりの一覧（生き物の更新ごとに一度だけ作る） */
export function mothLights(this: Ecology): number[] {
  const got = cache.get(this);
  if (got && got.step === this.step) return got.pts;
  const pts: number[] = [];
  const m = this.w.map;
  const key = (kind: MothLightKind, x: number, y: number) => kind * 1e6 + Math.max(0, this.tileOf(x, y));
  for (const c of this.list) {
    if (c.dead || c.away) continue;
    // 人の明かりは、足もとを回る輪の中心にする（輪の半分が人の手前を通り、描くときに明かりの高さまで持ち上げる）
    if (c.k === Kind.Adventurer && (c.torch > 0 || c.sp === Job.Wizard)) pts.push(c.x, c.y + 2, key(0, c.x, c.y));
    else if (c.k === Kind.Dwarf && c.sp === 0) pts.push(c.x, c.y + 2, key(1, c.x, c.y));
  }
  for (const p of this.parties) {
    if ((p.camp ?? -1) < 0) continue;
    const x = ((p.camp as number) % m.w) * TILE + 8;
    const y = Math.floor((p.camp as number) / m.w) * TILE + 4;
    pts.push(x, y, key(2, x, y));
  }
  for (const cp of this.camps) if (cp.id >= 0 && (cp.fuel ?? 0) > 0) pts.push(cp.x, cp.y + 6, key(3, cp.x, cp.y));
  if (this.hold && this.hold.forge >= 0) {
    const x = (this.hold.forge % m.w) * TILE + 8;
    const y = Math.floor(this.hold.forge / m.w) * TILE + 2;
    pts.push(x, y, key(3, x, y));
  }
  for (const k of this.lamps) pts.push((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 2, 4 * 1e6 + k);
  for (const it of this.gear) if (it.kind === ItemKind.Torch) pts.push(it.x, it.y - 4, key(5, it.x, it.y));
  cache.set(this, { step: this.step, pts });
  return pts;
}

export function moth(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Moth];
  if (c.act === 2 && c.actT < 3) return;
  const k0 = this.tileOf(c.x, c.y);
  // 腹が減ったら苔へ降りて食べる
  if (c.food < s.cap * MOTH_HUNGRY) {
    if (k0 >= 0 && this.w.moss[k0] > 20 && this.eatMoss(c, 1)) {
      c.act = 2;
      c.actT = 0;
      c.ref2 = 0;
      return;
    }
    const mk = this.mothMoss(c);
    if (mk >= 0) {
      c.act = 1;
      c.ref2 = 0;
      this.goTo(c, (mk % this.w.map.w) * TILE + 8, Math.floor(mk / this.w.map.w) * TILE + 8, s.speed);
      return;
    }
  }
  // 明かりへ寄り、まわりを回る
  const pts = this.mothLights();
  const reg = this.regionOf(k0);
  let bi = -1;
  let bd = MOTH_SEE * TILE * MOTH_SEE * TILE;
  for (let i = 0; i < pts.length; i += 3) {
    const d = sq(pts[i] - c.x) + sq(pts[i + 1] - c.y);
    if (d >= bd || sq(pts[i] - c.hx) + sq(pts[i + 1] - c.hy) > MOTH_RANGE * TILE * MOTH_RANGE * TILE || this.regionOf(this.tileOf(pts[i], pts[i + 1])) !== reg) continue;
    bd = d;
    bi = i;
  }
  if (bi >= 0) {
    const lx = pts[bi];
    const ly = pts[bi + 1];
    // 回る輪：個体ごとに半径と向きを変える（8の字に近い、ゆらいだ輪）
    const a = this.step * 0.13 + c.id * 2.399;
    const r = 9 + (c.id % 4) * 3 + Math.sin(this.step * 0.07 + c.id) * 2;
    const tx = lx + Math.cos(a) * r;
    const ty = ly + Math.sin(a * (c.id % 2 ? 1 : 2)) * r * 0.55;
    c.act = 1;
    if (bd > MOTH_NEAR * MOTH_NEAR) {
      c.ref2 = 0;
      this.goTo(c, tx, ty, s.speed);
    } else {
      // 離れた所から着いたときだけ記録する（回っている明かりを乗り換えるたびには記録しない）
      if (c.ref2 === 0) this.record('settle', { t: this.w.tick, k: Kind.Moth, ev: 'light', id: c.id, n: Math.floor(pts[bi + 2] / 1e6), x: Math.round(lx), y: Math.round(ly) } as never);
      c.ref2 = pts[bi + 2];
      this.moveToward(c, tx, ty, s.speed * 1.3);
    }
    return;
  }
  c.ref2 = 0;
  // 明かりが無ければ、湧いた苔のまわりを漂う
  if (sq(c.hx - c.x) + sq(c.hy - c.y) > 5 * TILE * 5 * TILE) {
    c.act = 1;
    this.goTo(c, c.hx, c.hy, s.speed * 0.7);
    return;
  }
  if (ih(c.id, this.step >> 3, 341) % 3 !== 0) {
    const j = DIR16[ih(c.id, this.step >> 3, 342) & 15];
    c.act = 1;
    this.tryMove(c, j[0] * s.speed * 0.5, j[1] * s.speed * 0.5);
  } else c.act = 0;
}

/** いちばん近い、食べられる苔のあるマス（MOTH_MOSS マスの内。なければ -1） */
export function mothMoss(this: Ecology, c: Cr): number {
  const m = this.w.map;
  const tx = Math.floor(c.x / TILE);
  const ty = Math.floor(c.y / TILE);
  for (let r = 1; r <= MOTH_MOSS; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
        const k = y * m.w + x;
        if (!m.solid[k] && this.w.moss[k] > 40) return k;
      }
  return -1;
}

/** 灯り蛾が湧く場所（タイル番号、なければ -1）：苔やキノコの群落（forage）のうち、苔の濃い床。状態は書き換えない（spawndef の site） */
export function mothSite(this: Ecology): number {
  const f = this.forage;
  if (!f.length) return -1;
  for (let i = 0; i < 8; i++) {
    const k = f[ih(this.step, i, 343) % f.length];
    if (!this.w.map.solid[k] && !this.w.map.sealed[k] && this.w.moss[k] >= 60) return k;
  }
  return -1;
}

/**
 * 夜に飛ぶコウモリが、近くの灯り蛾をさらう（すぐそばならその場で食べ、3マスの内なら追う）。この回の行動をこれで済ませたら true。
 * ヴァンパイアに従うコウモリは主のそばを離れないので狩らない
 */
export function batHuntMoth(this: Ecology, c: Cr): boolean {
  const s = SPEC[Kind.Bat];
  if (c.ref2 || c.food >= s.cap * 0.8) return false;
  let prey: Cr | null = null;
  let bd = 3 * TILE * 3 * TILE;
  this.nearby(c.x, c.y, 3, (o) => {
    if (o.k !== Kind.Moth || o.dead || o.away || o.caught) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      prey = o;
    }
  });
  if (!prey) return false;
  const p = prey as Cr;
  if (bd < 10 * 10) {
    this.eat(c, p);
    return true;
  }
  c.act = 1;
  this.moveToward(c, p.x, p.y, s.speed * 1.2);
  return true;
}

declare module '../ecology' {
  interface Ecology {
    moth: typeof moth;
    mothLights: typeof mothLights;
    mothMoss: typeof mothMoss;
    mothSite: typeof mothSite;
    batHuntMoth: typeof batHuntMoth;
  }
}
Object.assign(Ecology.prototype, { moth, mothLights, mothMoss, mothSite, batHuntMoth });
