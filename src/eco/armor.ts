/**
 * Ecology のメソッド：リビングアーマー（床に落ちた武具から生まれる、中身の空の自律甲冑）。
 *
 * 見せたい場面：
 *  1. 誕生：倒れた冒険者たちの武具が溜まった所で、武具がカタカタ震えて寄り集まり、甲冑が立ち上がる。
 *  2. 取り込み：床の剣や盾に歩み寄って取り込み、それを手に持った姿になる（強くなる）。
 *  3. 奪う：武具を持つ侵入者を倒し、その場に落ちた武具を取り込む。
 *  4. 崩れる：倒されるか、マナが尽きると、体と手の武具が床に散らばる。散った武具は、また次の甲冑やゴブリンの拾い物になる。
 *
 * 未練：冒険者が倒れると、落とした職業の道具（剣・盾・杖・鎚矛・短剣・聖印・リュート・弓・大剣）に、持ち主の未練としてマナが宿る
 * （床の道具の fuel。1つにつき ARMOR_REMNANT。新しいマナの湧き口として world.manaBorn に足す。src/eco/adventurer.ts の dropJobItems）。
 * 未練は少しずつ薄れて消え（world.manaFaded）、拾った者がいれば、その者の体のマナ（Cr.mana）に移る。
 * マナの保存則では、床の武具に宿る未練も、生き物が持つマナと同じく総量に数える（heldMana）。未練の宿った武具は、描画で青白くかすかに光る。
 *
 * 誕生（生き物の更新50回ごと、armorBirths）：未練の宿った武具から半径 ARMOR_R マスの内に職業の道具が3つ以上あり、それらの未練の合計が
 * ARMOR_BIRTH_MANA 以上なら、未練の宿った物を先に近い順に ARMOR_BODY_MAX 個までを体にして（その未練の合計が ARMOR_BIRTH_MANA 以上のとき）甲冑が生まれる。明るさは問わない（竜の焼け跡でも生まれる）。
 * 手を下した大物（ドラゴン・ワイバーン・ワーム）や武具を持つ者が8マスの内にいるあいだは立ち上がらない（組み上がる間に倒されないように）。
 * 体にした武具の未練が、甲冑の体のマナになる。同時にいる数は、地図の面積に比例した安全柵（192×144 マスで4体、armorCap）まで。
 * 生まれてから ARMOR_RISE 回の更新のあいだは、その場で組み上がる（描画は、散らばった武具が寄り集まって立ち上がる演出）。
 *
 * 生き方：体のマナは、生き物の更新 ARMOR_LEAK 回ごとに1ずつ足もとの土へ漏れる。土のマナが濃い所（巡回する宝物庫など）では
 * 土から吸って補い（ARMOR_MANA_MAX まで）、取り込んだ武具の未練でも補う。マナが尽きると崩れる。マナが少ないと動きが鈍る。
 * 巡回：生まれた場所（hx, hy）と宝物庫のあいだを行き来し、着いた所でしばらく立ち番をする。
 * マナが少なくなると、土のマナが濃いほうへ向かう。
 * 襲う相手：武具を持つ侵入者（冒険者、ドワーフ、武器を拾ったゴブリン・オーク）。アンデッド、獣や虫、他の番人は襲わない（番人の側も甲冑を襲わない）。
 * 賢さは本能だけで、逃げない。強さは6に、手に取り込んだ武器と盾1つごとに +3（ARMOR_HAND_MAX 個まで。src/eco/combat.ts の str）。
 * 体力は強さの ARMOR_HP_MUL 倍（空の鎧は固い）。打たれていないあいだは、体のマナを使って少しずつ傷を直す（マナが ARMOR_LOW の半分を下回ると直せない）。
 * 倒した相手の落とし物は、取り込みの間隔（ARMOR_ABSORB_GAP）を待たずに、強さの上限を超えても ARMOR_ROB_MAX 個まで取り込む（強さは上がらない）。
 * アンデッドとして扱う（冒険者の一行の目標「アンデッド祓い」の相手になる。src/eco/aim.ts）。
 *
 * 状態（Cr の項目の使い方）：st 10 組み上がり中、0 巡回先へ歩く、1 立ち番。tx, ty 巡回先。sinceMeal 立ち番や歩きの経過（生き物の更新の回数）。
 * ref, ref2 最後に倒した相手と、その生き物の更新の通し番号（倒した相手の落とし物を取り込んだか＝「奪う」の判定）。lureAt 最後に取り込んだ生き物の更新の通し番号。
 * 持ち物は Ecology.armorKit。
 */
import { Cr, DIR16, Ecology, Item, ItemKind, Kind, SPEC, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { ITEM_NAMES } from './inspect';

/** 冒険者が倒れたとき、落とした職業の道具1つに宿る未練（マナ） */
export const ARMOR_REMNANT = 24;
/** 未練が1薄れるまでの生き物の更新の回数（24 なら約4日で消える） */
export const ARMOR_REMNANT_FADE = 1200;
/** 誕生：武具を集める半径（マス）、要る未練の合計、体にする武具の数の上限、組み上がる長さ（生き物の更新の回数） */
export const ARMOR_R = 6;
export const ARMOR_BIRTH_MANA = 40;
export const ARMOR_BODY_MAX = 5;
export const ARMOR_RISE = 40;
/** 体のマナ：1漏れるまでの生き物の更新の回数、土から吸って溜める上限、これを下回ると動きが鈍りマナの濃い所へ向かう量 */
export const ARMOR_LEAK = 180;
export const ARMOR_MANA_MAX = 120;
export const ARMOR_LOW = 30;
/** 手に取り込める武器と盾の数と、取り込んでから次を取り込めるまでの生き物の更新の回数（通常速度で約1分。少しずつ強くなるのが見えるように） */
export const ARMOR_HAND_MAX = 5;
/** 倒した相手から奪う物は、強さの上限（ARMOR_HAND_MAX）を超えても、この数まで取り込む（強さは上がらず、巡る武具が増えるだけ） */
export const ARMOR_ROB_MAX = 8;
export const ARMOR_ABSORB_GAP = 300;
/** 体力：強さの何倍か（ほかの種は5倍。空の鎧は固い。src/eco/combat.ts の maxHp） */
export const ARMOR_HP_MUL = 12;
/** 傷を直す：打たれてから何 tick 経てば直しはじめるか。直すときは生き物の更新6回ごとに体力の30分の1を直し、体のマナを1使う（足もとの土へ還る） */
export const ARMOR_MEND_AFTER = 100;
/** 立ち番の長さ（生き物の更新の回数） */
const ARMOR_GUARD = 300;

/** 職業の道具（未練が宿り、甲冑の体の材料になる） */
export function isJobItem(kind: number): boolean {
  return kind >= ItemKind.Sword && kind <= ItemKind.Greatsword;
}
/** 甲冑が手に取り込む武器と盾 */
export function isHandItem(kind: number): boolean {
  return kind === ItemKind.Sword || kind === ItemKind.Shield || kind === ItemKind.Mace || kind === ItemKind.Dagger || kind === ItemKind.Greatsword;
}

/** 同時にいられる数の安全柵：地図の面積に比例（192×144 マスで4体、少なくとも1体） */
export function armorCap(this: Ecology): number {
  const m = this.w.map;
  return Math.max(1, Math.round((4 * m.w * m.h) / (192 * 144)));
}

/** 手に取り込んだ武器と盾の種類 */
export function armorHand(this: Ecology, c: Cr): number[] {
  const kit = this.armorKit.get(c.id);
  return kit ? kit.slice(1 + kit[0]) : [];
}

/** 甲冑が襲う相手：武具を持つ侵入者 */
export function armorFoe(this: Ecology, o: Cr): boolean {
  return o.k === Kind.Adventurer || o.k === Kind.Dwarf || ((o.k === Kind.Goblin || o.k === Kind.Orc) && o.party !== 0);
}

/** 床の武具に宿る未練が薄れる（生き物の更新ごと。updateItems から） */
export function fadeRemnant(this: Ecology, it: Item): void {
  if (it.fuel <= 0 || !isJobItem(it.kind)) return;
  if (this.step % ARMOR_REMNANT_FADE !== it.id % ARMOR_REMNANT_FADE) return;
  it.fuel--;
  this.w.manaFaded++;
}

/** 床の武具を拾った者に、宿っていた未練を移す（スケルトンの起き上がり、ゴブリン・オークの拾い物、甲冑の取り込み） */
export function takeRemnant(this: Ecology, c: Cr, it: Item): void {
  if (!isJobItem(it.kind) || it.fuel <= 0) return;
  c.mana += it.fuel;
  it.fuel = 0;
}

/** 誕生：未練の宿った武具の溜まり場から、甲冑が生まれる（生き物の更新50回ごと） */
export function armorBirths(this: Ecology): void {
  if (this.counts[Kind.Armor] >= this.armorCap()) return;
  const m = this.w.map;
  const R2 = sq(ARMOR_R * TILE);
  const onFloor = (o: Item) => {
    const k = this.tileOf(o.x, o.y);
    return k >= 0 && !m.solid[k] && !m.sealed[k];
  };
  for (const it of this.gear) {
    if (!isJobItem(it.kind) || it.fuel <= 0 || ih(it.id, this.step, 701) % 3 !== 0 || !onFloor(it)) continue;
    const near = this.gear.filter((o) => isJobItem(o.kind) && sq(o.x - it.x) + sq(o.y - it.y) <= R2 && onFloor(o));
    if (near.length < 3) continue;
    let mana = 0;
    for (const o of near) mana += o.fuel;
    if (mana < ARMOR_BIRTH_MANA) continue;
    if (this.list.some((o) => o.k === Kind.Armor && !o.dead && sq(o.x - it.x) + sq(o.y - it.y) < sq(10 * TILE))) continue;
    // 手を下した大物（竜など）や、武具を持つ者がそば（8マス）にいるあいだは、立ち上がらない（組み上がる間に倒されないように）
    let watched = false;
    this.nearby(it.x, it.y, 8, (o) => {
      if (!watched && !o.dead && !o.away && (this.armorFoe(o) || o.k === Kind.Dragon || o.k === Kind.Wyvern || o.k === Kind.Worm)) watched = true;
    });
    if (watched) continue;
    // 寄り集まる中心：溜まり場の武具の真ん中（壁の中なら、いちばん近い床）
    let cx = 0;
    let cy = 0;
    for (const o of near) {
      cx += o.x;
      cy += o.y;
    }
    cx /= near.length;
    cy /= near.length;
    let ck = this.tileOf(cx, cy);
    if (ck < 0 || m.solid[ck] || m.lava[ck]) ck = this.nearestFloor(cx, cy);
    const x = (ck % m.w) * TILE + 8;
    const y = Math.floor(ck / m.w) * TILE + 8;
    // 体にする武具：未練の宿った物を先に、近い順に（未練の無い古い武具ばかりで体を作って、マナの無いまま生まれないように）
    near.sort((a, b) => (b.fuel > 0 ? 1 : 0) - (a.fuel > 0 ? 1 : 0) || sq(a.x - x) + sq(a.y - y) - (sq(b.x - x) + sq(b.y - y)) || a.id - b.id);
    const body = near.slice(0, ARMOR_BODY_MAX);
    let got = 0;
    for (const o of body) got += o.fuel;
    if (got < ARMOR_BIRTH_MANA) continue;
    const ids = new Set(body.map((o) => o.id));
    this.gear = this.gear.filter((o) => !ids.has(o.id));
    this.originNext = 'gear';
    const c = this.spawn(Kind.Armor, x, y, 0, 0);
    c.mana = got;
    c.st = 10;
    c.lureAt = this.step;
    c.hx = x;
    c.hy = y;
    c.tx = x;
    c.ty = y;
    this.armorKit.set(c.id, [body.length, ...body.map((o) => o.kind)]);
    this.fxArmorRise = this.fxArmorRise.filter((e) => this.w.tick - e.t < 400);
    this.fxArmorRise.push({ id: c.id, t: this.w.tick, parts: body.map((o) => [o.kind, o.x - x, o.y - y] as [number, number, number]) });
    this.counts[Kind.Armor]++;
    this.noise(x, y, 6);
    this.log(x, y, `倒れた者たちの武具が寄り集まり、{k:${Kind.Armor}}として立ち上がった`);
    return;
  }
}

/** 巡回先を決める：生まれた場所と宝物庫のあいだを行き来する。マナが少なければ、土のマナの濃いほうへ */
export function pickArmorPost(this: Ecology, c: Cr): void {
  const m = this.w.map;
  const posts: [number, number][] = [];
  if (m.vaultCenter.x >= 0) posts.push([m.vaultCenter.x * TILE + 8, m.vaultCenter.y * TILE + 8]);
  let tx = c.hx;
  let ty = c.hy;
  if (posts.length) {
    const atHome = sq(c.hx - c.x) + sq(c.hy - c.y) < sq(4 * TILE);
    if (c.mana < ARMOR_LOW) {
      // マナの濃い巡回先へ（いまいる所より濃い所があれば）
      let best = this.manaAround(this.tileOf(c.x, c.y));
      for (const [px, py] of posts) {
        const v = this.manaAround(this.tileOf(px, py));
        if (v > best) {
          best = v;
          tx = px;
          ty = py;
        }
      }
    } else if (atHome || ih(c.id, this.step, 705) % 3 === 0) [tx, ty] = posts[ih(c.id, this.step, 706) % posts.length];
  } else {
    // 巡回する石畳がなければ、生まれた場所のまわり（4マス）を見回る
    const j = DIR16[ih(c.id, this.step, 707) & 15];
    const r = (2 + (ih(c.id, this.step, 708) % 3)) * TILE;
    const k = this.tileOf(c.hx + j[0] * r, c.hy + j[1] * r);
    if (k >= 0 && !m.solid[k] && !m.lava[k]) {
      tx = c.hx + j[0] * r;
      ty = c.hy + j[1] * r;
    }
  }
  c.tx = tx;
  c.ty = ty;
}

/** 床の武器か盾を取り込む */
export function absorbItem(this: Ecology, c: Cr, it: Item): void {
  this.gear = this.gear.filter((o) => o !== it);
  const kit = this.armorKit.get(c.id) ?? [0];
  const before = this.maxHp(c);
  // 倒した相手の落とし物なら「奪った」（倒してから生き物の更新900回の内に、相手の亡骸のそば3マスの内の物）
  const victim = c.ref ? this.byId.get(c.ref) : undefined;
  const rob = !!victim && this.step - c.ref2 < 900 && sq(victim.x - it.x) + sq(victim.y - it.y) < sq(3 * TILE);
  this.takeRemnant(c, it);
  kit.push(it.kind);
  this.armorKit.set(c.id, kit);
  // 強くなった分だけ、体力も上がる
  if (c.hp > 0) c.hp += this.maxHp(c) - before;
  c.lureAt = this.step;
  c.act = 2;
  c.actT = 0;
  c.dir = Math.abs(it.x - c.x) > Math.abs(it.y - c.y) ? (it.x > c.x ? 2 : 3) : it.y > c.y ? 0 : 1;
  this.noise(c.x, c.y, 5);
  this.record('settle', { t: this.w.tick, k: Kind.Armor, id: c.id, ev: 'absorb', how: rob ? 'rob' : 'floor', n: it.kind, x: Math.round(c.x), y: Math.round(c.y) } as never);
  const name = ITEM_NAMES[it.kind] ?? '武具';
  this.log(c.x, c.y, rob ? `{k:${Kind.Armor}}が、倒した相手の${name}を取り込んだ` : `{k:${Kind.Armor}}が床の${name}を取り込んだ`);
}

/** 崩れる：体と手の武具を床に散らす（dropBelongings から。体のマナは die の releaseMana で土へ還る） */
export function scatterArmor(this: Ecology, c: Cr): void {
  const kit = this.armorKit.get(c.id);
  this.armorKit.delete(c.id);
  if (!kit) return;
  const m = this.w.map;
  const n = this.ownerNote(c, 'fell');
  const kinds = kit.slice(1);
  kinds.forEach((kd, i) => {
    const j = DIR16[(ih(c.id, i, 709) & 15)];
    const r = 5 + (ih(c.id, i, 710) % 9);
    let x = c.x + j[0] * r;
    let y = c.y + j[1] * r * 0.7;
    const k = this.tileOf(x, y);
    if (k < 0 || m.solid[k]) {
      x = c.x;
      y = c.y;
    }
    this.dropItem(x, y, kd, 0, n);
  });
  this.armorFalls.push(Math.round(c.x), Math.round(c.y), this.step);
  if (this.armorFalls.length > 24) this.armorFalls.splice(0, 3);
  // 崩れる土ぼこり（描画専用）
  this.effects.push({ x: c.x, y: c.y, t: this.w.tick });
  this.record('settle', { t: this.w.tick, k: Kind.Armor, id: c.id, ev: 'fall', n: kinds.length, x: Math.round(c.x), y: Math.round(c.y) } as never);
  this.log(c.x, c.y, `{k:${Kind.Armor}}が崩れ、武具が床に散らばった`);
}

/** リビングアーマーの行い（生き物の更新ごと） */
export function armor(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Armor];
  const m = this.w.map;
  const k = this.tileOf(c.x, c.y);
  // マナ：少しずつ足もとの土へ漏れ、土のマナが濃い所では吸って補う
  if (this.step % ARMOR_LEAK === c.id % ARMOR_LEAK && c.mana > 0) {
    c.mana--;
    if (k >= 0) this.w.mana[k]++;
    else this.w.manaFaded++;
  }
  if (this.step % 4 === c.id % 4 && c.mana < ARMOR_MANA_MAX && k >= 0 && this.w.mana[k] >= 6) {
    const t = Math.min(2, this.w.mana[k] - 4, ARMOR_MANA_MAX - c.mana);
    this.w.mana[k] -= t;
    c.mana += t;
  }
  if (c.mana <= 0) {
    this.die(c, 'faded');
    return;
  }
  // 傷を直す：打たれていないあいだ、体のマナを使って少しずつ（使ったマナは足もとの土へ）
  const mx = this.maxHp(c);
  if (c.hp > 0 && c.hp < mx && this.w.tick - c.hitAt > ARMOR_MEND_AFTER && c.mana > ARMOR_LOW / 2 && this.step % 6 === c.id % 6) {
    c.hp = Math.min(mx, c.hp + mx / 30);
    c.mana--;
    if (k >= 0) this.w.mana[k]++;
    else this.w.manaFaded++;
  }
  // 組み上がり：その場で、武具が寄り集まって立ち上がる
  if (c.st === 10) {
    c.act = 0;
    if (c.actT >= ARMOR_RISE) {
      c.st = 1;
      c.sinceMeal = ARMOR_GUARD;
    }
    return;
  }
  if (c.act === 2 && c.actT < 5) return;
  const sp = s.speed * (c.mana < ARMOR_LOW ? 0.6 : 1) * this.limp(c);
  // 武具を持つ侵入者を襲う
  let foe: Cr | null = null;
  let bd = sq(6 * TILE);
  this.nearby(c.x, c.y, 6, (o) => {
    if (o.dead || o.away || !this.armorFoe(o) || !this.canSense(c, o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      foe = o;
    }
  });
  if (foe) {
    const f = foe as Cr;
    this.markNotice(c, f, '!');
    c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
    if (bd < 13 * 13) {
      if (this.fight(c, f)) {
        c.ref = f.id;
        c.ref2 = this.step;
      }
    } else {
      c.act = 1;
      this.goTo(c, f.x, f.y, sp * 1.2);
    }
    return;
  }
  // 床の武器と盾を取り込む（8マスの内の、見通しの利く物。前に取り込んでから ARMOR_ABSORB_GAP 回の更新が経っていれば。
  // 倒した相手の落とし物＝亡骸のそば3マスの内の物は、倒してから生き物の更新900回の内なら、間隔を待たずに）
  const victim = c.ref && this.step - c.ref2 < 900 ? this.byId.get(c.ref) : undefined;
  const gapOk = this.step - c.lureAt >= ARMOR_ABSORB_GAP;
  const nHand = this.armorHand(c).length;
  if ((nHand < ARMOR_HAND_MAX && (gapOk || victim)) || (victim && nHand < ARMOR_ROB_MAX)) {
    let best: Item | null = null;
    let bd2 = sq(8 * TILE);
    for (const it of this.gear) {
      if (!isHandItem(it.kind)) continue;
      const robbed = !!victim && sq(victim.x - it.x) + sq(victim.y - it.y) < sq(3 * TILE);
      if (!robbed && (!gapOk || nHand >= ARMOR_HAND_MAX)) continue;
      const d = sq(it.x - c.x) + sq(it.y - c.y);
      if (d >= bd2) continue;
      const ik = this.tileOf(it.x, it.y);
      if (ik < 0 || m.solid[ik] || !lineOfSight(m, c.x, c.y, it.x, it.y)) continue;
      bd2 = d;
      best = it;
    }
    if (best) {
      if (bd2 < 10 * 10) this.absorbItem(c, best);
      else {
        c.act = 1;
        this.goTo(c, best.x, best.y, sp);
      }
      return;
    }
  }
  // 巡回：巡回先へ歩き、着いたらしばらく立ち番をする
  if (c.st === 0) {
    const arrived = sq(c.tx - c.x) + sq(c.ty - c.y) < sq(1.5 * TILE);
    const stuck = (this.paths.get(c.id)?.miss ?? 0) >= 3;
    if (arrived || stuck || c.sinceMeal > 6000) {
      c.st = 1;
      c.sinceMeal = 0;
    } else {
      c.act = 1;
      this.goTo(c, c.tx, c.ty, sp);
      return;
    }
  }
  c.act = 0;
  if (c.sinceMeal % 80 === 0) c.dir = ih(c.id, this.step, 703) & 3;
  if (c.sinceMeal >= ARMOR_GUARD) {
    this.pickArmorPost(c);
    c.st = 0;
    c.sinceMeal = 0;
  }
}

declare module '../ecology' {
  interface Ecology {
    armorCap: typeof armorCap;
    armorHand: typeof armorHand;
    armorFoe: typeof armorFoe;
    fadeRemnant: typeof fadeRemnant;
    takeRemnant: typeof takeRemnant;
    armorBirths: typeof armorBirths;
    pickArmorPost: typeof pickArmorPost;
    absorbItem: typeof absorbItem;
    scatterArmor: typeof scatterArmor;
    armor: typeof armor;
  }
}

Object.assign(Ecology.prototype, { armorCap, armorHand, armorFoe, fadeRemnant, takeRemnant, armorBirths, pickArmorPost, absorbItem, scatterArmor, armor });
