/**
 * Ecology のメソッド：グール（屍喰い。Kind.Ghoul）。
 *
 * 見せたい場面：
 *  1. 骨や死骸の多い暗がりの近くに、2〜3匹の群れで湧き、暗い行き止まりに巣（hx, hy）を構える（湧き方は src/eco/spawndef.ts の表）。
 *  2. 腹が減ると、肉の残る死骸を嗅ぎつけて歩み寄り、引きずって巣へ運ぶ（feeding から dragToLair）。巣に着いたら、その場で肉を食べる。
 *  3. 食べ終わった骨は巣に残り、骨塚になる。骨が積もった暗がりなので、マナが溜まると骨がスケルトンとして起き上がり（riseSpot）、
 *     起き上がった骨はグールに打ちかかる（スケルトンの襲う相手にグールが入っている）。
 *  4. 死骸が見つからないまま腹が減りきると、近くの大ネズミを襲う。仕留めた獲物も巣へ運ぶ。
 * 死骸をつかんだ回は lureAt に持つ（GHOUL_DRAG 回たっても巣に着かなければ、その場で食べる。dragToLair）。
 * 昼は巣で眠る（Ecology.SLEEP）。群れは巣ごとに一つ（群れの識別は巣の位置）で、眠る場所も巣のまわり。火を怖がる（Ecology.FEARS_FIRE）。
 */
import { type Cr, Ecology, Kind, SPEC, ih, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 死骸を嗅ぎつける距離（マス） */
export const GHOUL_SMELL = 16;
/** 巣に着いたとみなす距離（px。引きずってきた死骸がここまで来たら食べはじめる） */
export const GHOUL_BED = 2 * TILE;
/** 引きずる死骸が、グールの体のどれだけうしろを付いてくるか（px） */
export const GHOUL_TAIL = 8;
/** 死骸をつかんでから（lureAt）生き物の更新この回数たっても巣に着かなければ（道がふさがったなど）、引きずるのをやめてその場で食べる */
export const GHOUL_DRAG = 1800;
/** 死骸を探しに出る腹の減り具合（食べた物が胃の大きさのこの割合を切ったら） */
const GHOUL_HUNGRY = 0.6;
/** 大ネズミを襲う腹の減り具合（死骸が見つからず、食べた物がこの割合を切ったら） */
const GHOUL_STARVING = 0.25;

export function ghoul(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Ghoul];
  if (c.act === 2 && c.actT < 4) return;
  if (c.food < s.cap * GHOUL_HUNGRY) {
    const d = this.ghoulCarrion(c);
    if (d) {
      if (sq(d.x - c.x) + sq(d.y - c.y) < 14 * 14) {
        // 死骸をつかむ。次の回から feeding が巣へ引きずり、巣で食べる（つかんだ回を lureAt に覚える）
        c.feed = d.id;
        c.lureAt = this.step;
        c.act = 2;
        c.actT = 0;
      } else {
        c.act = 1;
        this.goTo(c, d.x, d.y, s.speed);
      }
      return;
    }
    if (c.food < s.cap * GHOUL_STARVING) {
      let prey: Cr | null = null;
      let bd = 5 * TILE * 5 * TILE;
      this.nearby(c.x, c.y, 5, (o) => {
        if (o.k !== Kind.Rat || o.dead || o.away) return;
        const dd = sq(o.x - c.x) + sq(o.y - c.y);
        if (dd < bd) {
          bd = dd;
          prey = o;
        }
      });
      if (prey) {
        const p = prey as Cr;
        // 仕留めたら、その死骸を巣へ引きずる（eat が feed と lureAt を付ける）
        if (bd < 14 * 14) this.fight(c, p);
        else {
          c.act = 1;
          this.goTo(c, p.x, p.y, s.speed * 1.2);
        }
        return;
      }
    }
  }
  // 巣へ戻り、巣のまわりをうろつく
  const far = sq(c.hx - c.x) + sq(c.hy - c.y) > 3 * TILE * 3 * TILE;
  if (far) {
    c.act = 1;
    this.goTo(c, c.hx, c.hy, s.speed * 0.8);
    return;
  }
  if (ih(c.id, this.step >> 5, 311) % 3 === 0) {
    const a = (ih(c.id, this.step >> 5, 312) % 628) / 100;
    c.act = 1;
    this.goTo(c, c.hx + Math.cos(a) * 1.5 * TILE, c.hy + Math.sin(a) * 1.5 * TILE, s.speed * 0.5);
  } else c.act = 0;
}

/**
 * グールが嗅ぎつける死骸：GHOUL_SMELL マスの内の、肉の残る死骸のうちいちばん近いもの（同じつながった洞窟の領域にあり、
 * ほかのグールがつかんでいないもの。グール自身の死骸は食べない）
 */
export function ghoulCarrion(this: Ecology, c: Cr): Cr | null {
  const reg = this.regionOf(this.tileOf(c.x, c.y));
  const taken = new Set<number>();
  for (const o of this.list) if (o.k === Kind.Ghoul && !o.dead && o !== c && o.feed) taken.add(o.feed);
  let best: Cr | null = null;
  let bd = GHOUL_SMELL * TILE * GHOUL_SMELL * TILE;
  for (const o of this.carrion) {
    if (o.k === Kind.Ghoul || this.flesh(o) <= 0 || taken.has(o.id)) continue;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d >= bd || this.regionOf(this.tileOf(o.x, o.y)) !== reg) continue;
    bd = d;
    best = o;
  }
  return best;
}

/**
 * グールの巣の場所（湧く場所。タイル番号、なければ -1）：肉の残る死骸か骨のある所から10マスの内の、暗く（日の光も光る苔も無い）乾いた床のうち、
 * まわりの岩がいちばん多い所（行き止まりや壁のくぼみ）。ほかのグールの巣から20マス以上離す
 */
export function ghoulDen(this: Ecology): number {
  const m = this.w.map;
  const seeds = this.corpses.filter((o) => {
    const k = this.tileOf(o.x, o.y);
    return k >= 0 && !m.sealed[k] && o.k !== Kind.Ghoul;
  });
  if (!seeds.length) return -1;
  const dens = this.list.filter((o) => o.k === Kind.Ghoul && !o.dead);
  const o = seeds[ih(this.step, seeds.length, 313) % seeds.length];
  const tx0 = Math.floor(o.x / TILE);
  const ty0 = Math.floor(o.y / TILE);
  const reg = this.regionOf(this.tileOf(o.x, o.y));
  let best = -1;
  let bv = -1;
  for (let i = 0; i < 40; i++) {
    const h = ih(this.step, i, 314);
    const x = tx0 + ((h & 31) % 21) - 10;
    const y = ty0 + (((h >>> 5) & 31) % 21) - 10;
    if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
    const k = y * m.w + x;
    if (m.solid[k] || m.sealed[k] || m.lava[k] || m.vault[k] || this.w.water[k] > 20 || this.regionOf(k) !== reg) continue;
    if (this.w.lightBase[k] > 30 || this.w.moss[k] > 40 || this.inLair(x * TILE + 8, y * TILE + 8)) continue;
    if (dens.some((g) => sq(g.hx / TILE - x) + sq(g.hy / TILE - y) < 20 * 20)) continue;
    let walls = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.solid[k + dy * m.w + dx]) walls++;
    const v = walls * 4 - (Math.abs(x - tx0) + Math.abs(y - ty0)) * 0.1;
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}

declare module '../ecology' {
  interface Ecology {
    ghoul: typeof ghoul;
    ghoulCarrion: typeof ghoulCarrion;
    ghoulDen: typeof ghoulDen;
  }
}
Object.assign(Ecology.prototype, { ghoul, ghoulCarrion, ghoulDen });
