/**
 * Ecology のメソッド：キノコの森（大キノコの林）。
 *
 * 見せたい場面：
 *  1. 暗く湿った所でキノコ（下草）が一帯に濃く茂ると、そこに大キノコが1本生え、森の芽になる。
 *  2. 大キノコは下草の濃い隣へ次々に生え増え、差し渡し20マスほどの林になる。6本そろうと森に名前が付き、ゲーム内ログに出る。
 *     床は菌床に変わり、森はぼんやり光り、育ちきった大キノコは光る胞子を降らせる（描画は src/creatureView.ts と src/renderer.ts）。
 *  3. 光・熱・乾き・下草が食べ尽くされること・火で衰え、大キノコが1本も無くなると森は消える。
 *
 * 大キノコは通れる。体に取り込んだ養分（Shroom.s）は、保存則では生き物が持つ養分（heldNutrients）に数え、枯れたり焼けたりすると土に返る。
 * 進めるのはキノコの更新（World.fungusStep。40 tick ごとに2回分）の中で、確率は MOSS_R 倍にしてある。
 */
import { type Grove, type Shroom, Ecology, MOSS_R, ih } from '../ecology';
import { TILE } from '../mapgen';

/** 同時にある森の数の上限 */
export const GROVE_MAX = 3;
/** 森の芽どうしの間（マス。縦と横の大きい方） */
const GROVE_GAP = 26;
/** 大キノコが生えられるのは、森の芽からこのマス数の内（縦と横の大きい方）。森の差し渡しは最大でこの2倍＋1 */
export const GROVE_R = 11;
/** 森の芽になる：まわり7×7マスのうち、下草が SEED_FUNGUS 以上のマスがこの数以上（実測で、5〜6日目に15シードの半分ほどで1か所目が満たす） */
const SEED_DENSE = 16;
const SEED_FUNGUS = 60;
/** 生え増える先：まわり5×5マスのうち、下草が GROW_FUNGUS 以上のマスがこの数以上 */
const GROW_DENSE = 6;
const GROW_FUNGUS = 50;
/** これを超える下草は畑（アリ・ゴブリン・コボルト・ドワーフが植えたもの）とみなし、森にしない */
const FARM_FUNGUS = 140;
/** 生えたばかりの大キノコが下草から取る養分と、育ちきった大きさ */
const SHROOM_BORN = 20;
export const SHROOM_MAX = 120;
/** 生え増えるのは、この大きさ以上の大キノコから */
const SHROOM_SPREAD = 40;
/** 大キノコが育つ速さ（キノコの更新1回分に吸う養分は、この MOSS_R 倍まで） */
const GROW_RATE = 2;
/** 1本の大キノコが、キノコの更新1回分に生え増えを試すくじ（MOSS_R / この数） */
const SPREAD_ODDS = 40;
/** まわり3×3の下草の合計がこれ未満なら、支えを失って細る */
const SUPPORT = 90;
/** 森に名前が付く大キノコの数 */
export const GROVE_NAMED = 6;
/** 区画の光る胞子の上限（src/eco/swarm.ts の SPORE_MAX と同じ） */
const SPORE_MAX = 150;

const GROVE_NAMES = ['ほの明かりの森', '胞子の森', 'しずくの森', '青がさの森', 'ささやきの森', 'ねむり茸の森', '霧ふる森', '月かさの森', 'うつろ茸の森', 'もや灯りの森', '灰がさの森'];

/** マス k が大キノコの生えられる床か（暗く、湿り、熱くなく、溶岩でも深い水でも閉じた空洞でもない） */
function groundOk(e: Ecology, k: number, day: number): boolean {
  const m = e.w.map;
  const w = e.w;
  return !m.solid[k] && !m.sealed[k] && !m.lava[k] && w.water[k] <= 40 && w.heat[k] <= 60 && w.moist[k] >= 90 && w.lightBase[k] * day < 150;
}

/** マス k のまわり (2R+1)×(2R+1) で、下草が min 以上のマスの数。畑の下草（FARM_FUNGUS を超える）があれば -1 */
function dense(e: Ecology, k: number, R: number, min: number): number {
  const m = e.w.map;
  const x0 = k % m.w;
  const y0 = Math.floor(k / m.w);
  if (x0 < R || y0 < R || x0 >= m.w - R || y0 >= m.h - R) return 0;
  let n = 0;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const f = e.w.fungus[k + dy * m.w + dx];
      if (f > FARM_FUNGUS) return -1;
      if (f >= min) n++;
    }
  return n;
}

/** マス k のまわり (2R+1)×(2R+1) に大キノコがあるか */
function shroomNear(e: Ecology, k: number, R: number): boolean {
  const W = e.w.map.w;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (e.shrooms.has(k + dy * W + dx)) return true;
  return false;
}

/** 大キノコを生やす：マス k の下草から SHROOM_BORN を体に移す */
function sprout(e: Ecology, k: number, g: number): void {
  e.w.fungus[k] -= SHROOM_BORN;
  e.shrooms.set(k, { k, s: SHROOM_BORN, g });
  e.mossTouched = true;
}

/** 大キノコを取り除き、体の養分をマス to の土に返す */
export function dropShroom(this: Ecology, k: number, to = k): void {
  const sh = this.shrooms.get(k);
  if (!sh) return;
  this.w.nutr[to] += sh.s;
  this.shrooms.delete(k);
  this.mossTouched = true;
}

/** 新しい森の名前（生きている森と重ならないもの） */
function groveName(e: Ecology, id: number, k: number): string {
  const used = new Set(e.groves.map((g) => g.name));
  const i0 = ih(id, k, 0x6f7) % GROVE_NAMES.length;
  for (let i = 0; i < GROVE_NAMES.length; i++) {
    const n = GROVE_NAMES[(i0 + i) % GROVE_NAMES.length];
    if (!used.has(n)) return n;
  }
  return GROVE_NAMES[i0];
}

/** 森の芽を探す：開いた床を30か所見て、下草の濃い一帯の真ん中で、ほかの森から離れた最初のマス */
function seedGrove(e: Ecology, step: number, day: number): void {
  const m = e.w.map;
  const N = m.w * m.h;
  for (let i = 0; i < 30; i++) {
    const k = ih(step, i, 0x6f1) % N;
    if (e.w.fungus[k] < SEED_FUNGUS || e.shrooms.has(k) || !groundOk(e, k, day)) continue;
    const x = k % m.w;
    const y = Math.floor(k / m.w);
    if (e.groves.some((g) => Math.max(Math.abs(g.x - x), Math.abs(g.y - y)) < GROVE_GAP)) continue;
    if (dense(e, k, 3, SEED_FUNGUS) < SEED_DENSE) continue;
    const id = e.nextGrove++;
    e.groves.push({ id, x, y, name: groveName(e, id, k), t: e.w.tick, named: 0 });
    sprout(e, k, id);
    return;
  }
}

/**
 * キノコの更新ごと（World.fungusStep から。day は昼の光の強さの係数）：大キノコが育ち・細り・生え増え・胞子を降らせ、
 * 森の芽を探し、森の大キノコの数を数えて名前を付けたり消したりする
 */
export function groveStep(this: Ecology, step: number, day: number): void {
  const m = this.w.map;
  const W = m.w;
  const fu = this.w.fungus;
  const Nu = this.w.nutr;
  const byId = new Map<number, Grove>();
  for (const g of this.groves) byId.set(g.id, g);
  const all: Shroom[] = [...this.shrooms.values()];
  for (const sh of all) {
    const k = sh.k;
    if (m.solid[k] || m.lava[k]) {
      this.dropShroom(k);
      continue;
    }
    const L = this.w.lightBase[k] * day + this.w.moss[k] * 2;
    let sup = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sup += fu[k + dy * W + dx];
    // 光・熱・乾き・下草の支えの無さで細り、細りきると倒れて土に返る
    if (L > 250 || this.w.heat[k] > 60 || this.w.moist[k] < 70 || sup < SUPPORT || !byId.has(sh.g)) {
      const dec = Math.min(sh.s, 2 * MOSS_R);
      sh.s -= dec;
      Nu[k] += dec;
      if (sh.s <= 0) this.shrooms.delete(k);
      this.mossTouched = true;
      continue;
    }
    if (sh.s < SHROOM_MAX) {
      // まわり3×3の土から根で養分を吸って育つ（土が尽きていれば、濃い下草の分を吸う）
      let want = GROW_RATE * MOSS_R;
      for (let i = 0; i < 9 && want > 0; i++) {
        const q = k + (Math.floor(i / 3) - 1) * W + (i % 3) - 1;
        const g = Math.min(want, Nu[q]);
        Nu[q] -= g;
        sh.s += g;
        want -= g;
      }
      for (let i = 0; i < 9 && want > 0; i++) {
        const q = k + (Math.floor(i / 3) - 1) * W + (i % 3) - 1;
        if (fu[q] <= SEED_FUNGUS) continue;
        fu[q]--;
        sh.s++;
        want--;
      }
    } else if (ih(k, step, 0x6f3) % 6 < MOSS_R) {
      // 育ちきった大キノコは、体の養分を少しずつ光る胞子にして降らせる（胞子は漂って薄れ、土に返る）
      const cell = this.swarmCell((k % W) * TILE + 8, Math.floor(k / W) * TILE + 8);
      if (cell >= 0 && this.spores[cell] < SPORE_MAX) {
        this.spores[cell]++;
        sh.s--;
      }
    }
    // 隣の下草の濃い所へ生え増える
    if (sh.s >= SHROOM_SPREAD && ih(k, step, 0x6f5) % SPREAD_ODDS < MOSS_R) {
      // まわり7×7から3か所を見て、最初に生えられるマスへ
      const gr = byId.get(sh.g)!;
      for (let i = 0; i < 3; i++) {
        const h = ih(k, step, 0x6f9 + i);
        const c = k + (((h >>> 4) % 7) - 3) * W + ((h % 7) - 3);
        const cx = c % W;
        const cy = Math.floor(c / W);
        if (c < 0 || c >= fu.length || Math.max(Math.abs(cx - gr.x), Math.abs(cy - gr.y)) > GROVE_R || fu[c] < GROW_FUNGUS || fu[c] > FARM_FUNGUS) continue;
        if (shroomNear(this, c, 1) || !groundOk(this, c, day) || dense(this, c, 2, GROW_FUNGUS) < GROW_DENSE) continue;
        sprout(this, c, sh.g);
        break;
      }
    }
  }
  if (this.groves.length < GROVE_MAX) seedGrove(this, step, day);
  // 森ごとの大キノコの数：そろえば名前をログに出し、1本も無くなれば森は消える
  const count = new Map<number, number>();
  for (const sh of this.shrooms.values()) count.set(sh.g, (count.get(sh.g) ?? 0) + 1);
  const keep: Grove[] = [];
  for (const g of this.groves) {
    const n = count.get(g.id) ?? 0;
    const x = g.x * TILE + 8;
    const y = g.y * TILE + 8;
    if (n === 0) {
      if (g.named) {
        this.log(x, y, `${g.name}が枯れ果てた`);
        this.record('settle', { t: this.w.tick, k: -1, id: g.id, ev: 'groveGone', x, y } as never);
      }
      continue;
    }
    if (!g.named && n >= GROVE_NAMED) {
      g.named = 1;
      this.log(x, y, `大キノコが林になり、${g.name}が生まれた`);
      this.record('settle', { t: this.w.tick, k: -1, id: g.id, ev: 'grove', n, x, y } as never);
    }
    keep.push(g);
  }
  this.groves = keep;
}

/** マス k の大キノコが属する森（なければ undefined） */
export function groveAt(this: Ecology, k: number): Grove | undefined {
  const sh = this.shrooms.get(k);
  return sh ? this.groves.find((g) => g.id === sh.g) : undefined;
}

/** 大キノコの体の養分の合計（openOnly なら閉じた空洞の中を除く） */
export function shroomNutrients(this: Ecology, openOnly = false): number {
  let s = 0;
  for (const sh of this.shrooms.values()) if (!openOnly || !this.w.map.sealed[sh.k]) s += sh.s;
  return s;
}

declare module '../ecology' {
  interface Ecology {
    groveStep: typeof groveStep;
    dropShroom: typeof dropShroom;
    groveAt: typeof groveAt;
    shroomNutrients: typeof shroomNutrients;
  }
}

Object.assign(Ecology.prototype, { groveStep, dropShroom, groveAt, shroomNutrients });
