/**
 * Ecology のメソッド：リビングアーマー（床に落ちた武具から生まれる、中身の空の自律甲冑）。
 *
 * 見せたい場面：
 *  1. 誕生：倒れた冒険者たちの武具が溜まった所で、未練のいちばん強い武具がカタカタ震えて寄り集まり、甲冑の芯が立ち上がる。
 *  2. 取り込み：溜まり場に残った武具や、巡回の途中で見つけた床の武具に歩み寄って、一つずつ取り込む。剣や盾は手に持った姿になり（強くなる）、
 *     杖や聖印などは体に溶け込む。
 *  3. 奪う：武具を持つ侵入者を倒し、その場に落ちた武具を取り込む。
 *  4. 崩れる：倒されるか、マナが尽きると、体と手の武具が砕け散り、青白い未練が抜けて消える。砕けた武具は、もう次の甲冑の材料にならない
 *     （以前は武具が床に散らばり、また次の甲冑の材料になって、同じ武具から何度でも甲冑が立ち上がった）。
 *
 * 未練：冒険者が倒れると、落とした職業の道具（剣・盾・杖・鎚矛・短剣・聖印・リュート・弓・大剣）に、持ち主の未練としてマナが宿る
 * （床の道具の fuel。1つにつき ARMOR_REMNANT。新しいマナの湧き口として world.manaBorn に足す。src/eco/adventurer.ts の dropJobItems）。
 * ドワーフ（戦士の斧（床では鎚矛）と盾、鍛冶屋の金槌（鎚矛））と、武器を拾ったゴブリン・オークが倒れたときも、落とした武具に未練が宿る
 * （ドワーフは ARMOR_REMNANT、ゴブリン・オークは ARMOR_REMNANT_KIN。src/eco/adventurer.ts の dropBelongings）。
 * 甲冑が打たれて落とした武器と、清められた武具（fuel −1）は、もうマナを吸わない（未練の抜けた武具）。
 * 床の職業の道具は、足もとの土のマナが濃い（ARMOR_SOAK_MIN 以上）と、生き物の更新 ARMOR_SOAK_EVERY 回ごとに1ずつ、ARMOR_BIRTH_MANA まで吸って溜める
 * （土から道具へ移すだけで、総量は変わらない。未練の薄れた古い武具でも、マナの濃い所に置かれていれば、また溜まっていく）。
 * 溜まったマナは少しずつ薄れて消え（world.manaFaded）、拾った者がいれば、その者の体のマナ（Cr.mana）に移る。
 * マナの保存則では、床の武具に宿るマナも、生き物が持つマナと同じく総量に数える（heldMana）。マナの宿った武具は、描画で青白い粒が立ちのぼり、
 * 甲冑が立ち上がる量（ARMOR_BIRTH_MANA）に近づくほど頻くなる。
 *
 * 誕生（生き物の更新50回ごと、armorBirths）：マナの宿った武具から半径 ARMOR_R マスの内の職業の道具のマナの合計が ARMOR_BIRTH_MANA 以上なら、
 * 立ち上がるのに要る分だけ（マナの合計が ARMOR_BIRTH_MANA 以上になるまで）を体にして甲冑が生まれる。1個の武具からでも立ち上がる。
 * （以前は職業の道具が3つ以上要り、冒険者1人の落とす道具は1〜2個なので、2人以上が近くで倒れた所でしか立ち上がらなかった。
 *  未練は約4日で薄れて消えるので、そのあとは何個溜まっていても立ち上がらなかった）
 * 体には、マナの宿った物を先に、手に持たない道具（杖・聖印・リュート・弓）を先に、近い順に使う。残りの武具は溜まり場に残り、
 * 立ち上がった甲冑が一つずつ拾い集める（以前は近い順に5個までを一度に体にしていたので、剣や盾が溜まり場に残らず、
 * 取り込む場面がほとんど起きなかった：16シード×25日で取り込みのあったシードは5つ）。明るさは問わない（竜の焼け跡でも生まれる）。
 * 手を下した大物（ドラゴン・ワイバーン・ワーム）や武具を持つ者が8マスの内にいるあいだは立ち上がらない（組み上がる間に倒されないように）。
 * 体にした武具のマナが、甲冑の体のマナになる。同時にいる数は、地図の面積に比例した安全柵（192×144 マスで4体、armorCap）まで。
 * 生まれてから ARMOR_RISE 回の更新のあいだは、その場で組み上がる（描画は、散らばった武具が寄り集まって立ち上がる演出）。
 *
 * 生き方：体のマナは、生き物の更新 ARMOR_LEAK 回ごとに1ずつ足もとの土へ漏れる。土のマナが濃い所（巡回する宝物庫など）では
 * 土から吸って補い（ARMOR_MANA_MAX まで）、取り込んだ武具の未練でも補う。マナが尽きると崩れる。マナが少ないと動きが鈍る。
 * 未練の持ち場：生まれた場所（hx, hy）から ARMOR_POST_R マスの内だけを見回り、その内の相手だけを襲い、その内の武具だけを拾う（撤退すれば振り切れる）。
 * 体を保つのにマナを燃やし（ARMOR_BURN）、土から吸い続けないと保てない。何体も固まると土のマナが尽き、乏しい者から崩れる。
 * 僧侶に清められた武具からは立ち上がらず、僧侶の十字架は甲冑に倍効く。
 * 巡回先を決めるとき、同じ洞窟の領域の ARMOR_SEEK_R マスの内に取り込める武具があれば、いちばん近いその武具へ向かう。
 * マナが少なくなると、土のマナが濃いほうへ向かう。
 * 取り込み：8マスの内の、見通しの利く床の武具。武器と盾は手に（ARMOR_HAND_MAX 個まで）、杖・聖印・リュート・弓は体に（ARMOR_BODY_MAX 個まで）。
 * 前に取り込んでから、未練の宿った武具なら ARMOR_GATHER_GAP 回、宿っていない武具なら ARMOR_ABSORB_GAP 回の更新が経っていれば取り込む。
 * 襲う相手：武具を持つ侵入者（冒険者、ドワーフ、武器を拾ったゴブリン・オーク）。アンデッド、獣や虫、他の番人は襲わない（番人の側も甲冑を襲わない）。
 * 賢さは本能だけで、逃げない。強さ（打撃）は6に、手に取り込んだ武器と盾1つごとに +3（ARMOR_HAND_MAX 個まで。src/eco/combat.ts の str）。
 * 体力（固さ）は体になった武具の数で決まる（armorHp）。剣や盾を拾うと打撃が重くなり、杖や聖印を体に取り込むと固くなる。
 * 倒れずに強い一打を受けると、最後に手に取った武器か盾を1つ床に落とし、打撃が下がる（armorShed）。落ちた武具にマナは宿っていないので、
 * 拾い直すのは ARMOR_ABSORB_GAP 回の更新おき。その前に冒険者やゴブリンに拾われることもある。強くなり続けず、打ち合うたびに強さが行き来する。
 * 傷は、土のマナの濃い所で立ち番をしているときだけ、ゆっくり直る（続けて来る一行に削られていく）。打たれていないあいだは、体のマナを使って少しずつ傷を直す（マナが ARMOR_LOW の半分を下回ると直せない）。
 * 倒した相手の落とし物は、取り込みの間隔（ARMOR_ABSORB_GAP）を待たずに（武器を落として体勢を崩している間は除く）、強さの上限を超えても ARMOR_ROB_MAX 個まで取り込む（強さは上がらない）。
 * アンデッドとして扱う（冒険者の一行の目標「アンデッド祓い」の相手になる。src/eco/aim.ts）。
 *
 * 状態（Cr の項目の使い方）：st 10 組み上がり中、0 巡回先へ歩く、1 立ち番。tx, ty 巡回先。sinceMeal 立ち番や歩きの経過（生き物の更新の回数）。
 * ref, ref2 最後に倒した相手と、その生き物の更新の通し番号（倒した相手の落とし物を取り込んだか＝「奪う」の判定）。lureAt 最後に取り込んだ生き物の更新の通し番号。
 * 持ち物は Ecology.armorKit。
 */
import { Cr, DIR16, Ecology, Item, ItemKind, Kind, SPEC, STR, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { ITEM_NAMES } from './inspect';

/** 冒険者とドワーフが倒れたとき、落とした職業の道具1つに宿る未練（マナ） */
export const ARMOR_REMNANT = 24;
/** 武器を拾ったゴブリン・オークが倒れたとき、落とした武器に宿る未練（拾い物なので、持ち主の未練は冒険者の半分） */
export const ARMOR_REMNANT_KIN = 12;
/** 未練が1薄れるまでの生き物の更新の回数（24 なら約4日で消える） */
export const ARMOR_REMNANT_FADE = 1200;
/** 誕生：武具を集める半径（マス）、要る未練の合計、体にする武具の数の上限、組み上がる長さ（生き物の更新の回数） */
export const ARMOR_R = 6;
export const ARMOR_BIRTH_MANA = 40;
export const ARMOR_BODY_MAX = 5;
/** 床の職業の道具が土のマナを吸う：足もとの土のマナがこれ以上のとき、生き物の更新 ARMOR_SOAK_EVERY 回ごとに1ずつ */
export const ARMOR_SOAK_MIN = 12;
export const ARMOR_SOAK_EVERY = 200;
export const ARMOR_RISE = 40;
/** 体のマナ：1漏れるまでの生き物の更新の回数、土から吸って溜める上限、これを下回ると動きが鈍りマナの濃い所へ向かう量 */
export const ARMOR_LEAK = 180;
export const ARMOR_MANA_MAX = 120;
/** 体を保つのに燃やすマナ：生き物の更新 ARMOR_BURN 回ごとに1（土へは戻らず消える）。同じ所に何体も固まると土のマナを吸い尽くし、乏しい者から崩れる */
export const ARMOR_BURN = 60;
/** 未練の持ち場：生まれた場所（hx, hy）からこのマス数の内でだけ襲い、武具を拾い、見回る */
export const ARMOR_POST_R = 7;
export const ARMOR_LOW = 30;
/** 手に取り込める武器と盾の数と、取り込んでから次を取り込めるまでの生き物の更新の回数（通常速度で約1分。少しずつ強くなるのが見えるように） */
export const ARMOR_HAND_MAX = 5;
/** 倒した相手から奪う物は、強さの上限（ARMOR_HAND_MAX）を超えても、この数まで取り込む（強さは上がらず、巡る武具が増えるだけ） */
export const ARMOR_ROB_MAX = 5;
export const ARMOR_ABSORB_GAP = 300;
/** 未練の宿った武具（倒れた者の物）を拾い集めるときの間隔（生き物の更新の回数。一つずつ歩み寄って取り込むのが見えるように） */
export const ARMOR_GATHER_GAP = 30;
/** 巡回先を決めるとき、取り込める武具を探す半径（マス） */
export const ARMOR_SEEK_R = ARMOR_POST_R;
/** 体力：4 + ARMOR_HP_MUL ×（もとの強さ + 体の武具1つにつき ARMOR_BODY_HP）。ほかの種は 4 + 強さ×9（src/eco/combat.ts の HP_PER_STR。鎧はその2.4倍ほど）。空の鎧は固い（src/eco/combat.ts の maxHp）。
 *  手に取った武器と盾は体力を上げない（以前は武器で上がった強さにも12倍がかかり、武器5つで体力256＝ミノタウロスの約2.5倍の固さに、
 *  ミノタウロス並みの打撃が付いて、いる量あたりで冒険者をミノタウロスの約4.5倍倒していた） */
export const ARMOR_HP_MUL = 22;
export const ARMOR_BODY_HP = 2;
/** 傷を直す：打たれてから何 tick 経てば直しはじめるか。直すのは、足もとの土のマナが ARMOR_MEND_SOIL 以上の所で立ち番をしているときだけで、
 *  生き物の更新 ARMOR_MEND_EVERY 回ごとに体力の30分の1を直し、体のマナを1使う（足もとの土へ還る）。
 *  （以前はどこでも生き物の更新6回ごとに直し、約36秒で満タンに戻ったので、続けて来る一行が削っても傷が溜まらなかった） */
export const ARMOR_MEND_AFTER = 100;
export const ARMOR_MEND_SOIL = 12;
export const ARMOR_MEND_EVERY = 30;
/** 打たれて武器を落とす：倒れずに受けた一打の傷が、体力の上限のこの割合に近いほど落としやすい（この割合以上なら必ず落とす） */
export const ARMOR_SHED_AT = 0.25;
/** 武器を落としたあと、奪う物も含めて何も取り込めない長さ（生き物の更新の回数。体勢を崩している間。lureAt を先へずらして表す）。
 *  これが無いと、打ち合いの中で相手を一人倒すたびに、落とした武器を「奪った物」として拾い直してしまう */
export const ARMOR_SHED_DAZE = 150;
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

/** 床の武具に宿るマナ：足もとの土が濃ければ吸って溜め、少しずつ薄れる（生き物の更新ごと。updateItems から） */
export function fadeRemnant(this: Ecology, it: Item): void {
  // 僧侶に清められた武具（fuel −1）は、もうマナを吸わない（src/eco/roster.ts の blessBrace）
  if (!isJobItem(it.kind) || it.fuel < 0) return;
  // 吸うのは甲冑が立ち上がる量まで（甲冑の数が上限のあいだ、湧き口のそばの武具がマナを溜め続けないように）
  if (it.fuel < ARMOR_BIRTH_MANA && this.step % ARMOR_SOAK_EVERY === it.id % ARMOR_SOAK_EVERY) {
    const k = this.tileOf(it.x, it.y);
    if (k >= 0 && this.w.mana[k] >= ARMOR_SOAK_MIN) {
      this.w.mana[k]--;
      it.fuel++;
    }
  }
  if (it.fuel <= 0) return;
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
    // （未練の抜けた武具（fuel −1：甲冑から落ちた物、清められた物）は、新しい甲冑の体にしない）
    const near = this.gear.filter((o) => isJobItem(o.kind) && o.fuel >= 0 && sq(o.x - it.x) + sq(o.y - it.y) <= R2 && onFloor(o));
    let mana = 0;
    for (const o of near) mana += Math.max(0, o.fuel);
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
    // 体にする武具：未練の宿った物を先に（未練の無い古い武具ばかりで体を作って、マナの無いまま生まれないように）、
    // 手に持たない道具を先に（剣や盾は溜まり場に残し、立ち上がってから手に取る）、近い順に。立ち上がるのに要る分だけ
    near.sort((a, b) => (b.fuel > 0 ? 1 : 0) - (a.fuel > 0 ? 1 : 0) || (isHandItem(a.kind) ? 1 : 0) - (isHandItem(b.kind) ? 1 : 0) || sq(a.x - x) + sq(a.y - y) - (sq(b.x - x) + sq(b.y - y)) || a.id - b.id);
    const body: Item[] = [];
    let got = 0;
    for (const o of near) {
      if (body.length >= ARMOR_BODY_MAX || got >= ARMOR_BIRTH_MANA) break;
      body.push(o);
      got += Math.max(0, o.fuel);
    }
    if (got < ARMOR_BIRTH_MANA) continue;
    const ids = new Set(body.map((o) => o.id));
    this.gear = this.gear.filter((o) => !ids.has(o.id));
    this.originNext = 'gear';
    const c = this.spawn(Kind.Armor, x, y, 0, 0);
    c.mana = got;
    c.st = 10;
    // 立ち上がったらすぐ、溜まり場に残った武具を拾い集めはじめる
    c.lureAt = this.step - ARMOR_ABSORB_GAP;
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
  // 取り込める武具が同じ洞窟の領域の ARMOR_SEEK_R マスの内にあれば、いちばん近いその武具へ（マナが少ないときは、土のマナを先に）
  if (c.mana >= ARMOR_LOW) {
    const here = this.tileOf(c.x, c.y);
    const reg = here >= 0 ? this.regionOf(here) : -1;
    let best: Item | null = null;
    let bd = sq(ARMOR_SEEK_R * TILE);
    for (const it of this.gear) {
      if (!this.armorWants(c, it)) continue;
      const d = sq(it.x - c.x) + sq(it.y - c.y);
      if (d >= bd) continue;
      if ((c.hx || c.hy) && sq(it.x - c.hx) + sq(it.y - c.hy) > ARMOR_POST_R * TILE * ARMOR_POST_R * TILE) continue;
      const ik = this.tileOf(it.x, it.y);
      if (ik < 0 || m.solid[ik] || (reg >= 0 && this.regionOf(ik) !== reg)) continue;
      bd = d;
      best = it;
    }
    if (best) {
      c.tx = best.x;
      c.ty = best.y;
      return;
    }
  }
  // 未練の持ち場：生まれた場所のまわりだけを見回る（以前は生まれた場所と宝物庫を行き来し、宝物庫の入口に何体も集まって一行を次々に倒していた）
  const posts: [number, number][] = [];
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

/** 甲冑の体力の上限：体になった武具の数で決まる（手の武器と盾は数えない） */
export function armorHp(this: Ecology, c: Cr): number {
  const kit = this.armorKit.get(c.id) ?? [0];
  return Math.round(4 + ARMOR_HP_MUL * (STR[Kind.Armor] + ARMOR_BODY_HP * Math.min(ARMOR_BODY_MAX, kit[0])));
}

/** 打たれて武器を落とす（倒れずに一打を受けたとき。src/eco/combat.ts の strike から）。傷が大きいほど落としやすい */
export function armorShed(this: Ecology, c: Cr, dmg: number, by: Cr): void {
  const kit = this.armorKit.get(c.id);
  if (!kit || kit.length - 1 - kit[0] <= 0) return;
  const p = dmg / (this.maxHp(c) * ARMOR_SHED_AT);
  if ((ih(c.id, this.step ^ by.id, 711) % 1000) / 1000 >= p) return;
  const kd = kit.pop()!;
  // 打たれた向きと反対へ、少し転がる
  const L = Math.hypot(c.x - by.x, c.y - by.y) || 1;
  const r = 8 + (ih(c.id, this.step, 712) % 8);
  let x = c.x + ((c.x - by.x) / L) * r;
  let y = c.y + ((c.y - by.y) / L) * r * 0.7;
  const k = this.tileOf(x, y);
  if (k < 0 || this.w.map.solid[k]) {
    x = c.x;
    y = c.y;
  }
  // 甲冑から落ちた武器は未練が抜けていて、もうマナを吸わない（fuel −1。拾い直すことはできる）
  this.dropItem(x, y, kd, -1, this.ownerNote(c, 'shed'));
  c.lureAt = Math.max(c.lureAt, this.step + ARMOR_SHED_DAZE);
  this.record('settle', { t: this.w.tick, k: Kind.Armor, id: c.id, ev: 'shed', n: kd, by: by.k, x: Math.round(c.x), y: Math.round(c.y) } as never);
}

/** 甲冑がその床の武具を取り込める（手か体に空きがある）か。間隔は見ない */
export function armorWants(this: Ecology, c: Cr, it: Item): boolean {
  const kit = this.armorKit.get(c.id) ?? [0];
  if (isHandItem(it.kind)) return kit.length - 1 - kit[0] < ARMOR_HAND_MAX;
  return isJobItem(it.kind) && kit[0] < ARMOR_BODY_MAX;
}

/** 床の武具を取り込む：武器と盾は手に、ほかの職業の道具は体に */
export function absorbItem(this: Ecology, c: Cr, it: Item): void {
  this.gear = this.gear.filter((o) => o !== it);
  const kit = this.armorKit.get(c.id) ?? [0];
  const before = this.maxHp(c);
  // 倒した相手の落とし物なら「奪った」（倒してから生き物の更新900回の内に、相手の亡骸のそば3マスの内の物）
  const victim = c.ref ? this.byId.get(c.ref) : undefined;
  const rob = !!victim && this.step - c.ref2 < 900 && sq(victim.x - it.x) + sq(victim.y - it.y) < sq(3 * TILE);
  this.takeRemnant(c, it);
  const hand = isHandItem(it.kind);
  if (hand) kit.push(it.kind);
  else {
    kit.splice(1 + kit[0], 0, it.kind);
    kit[0]++;
  }
  this.armorKit.set(c.id, kit);
  // 強くなった分だけ、体力も上がる
  if (c.hp > 0) c.hp += this.maxHp(c) - before;
  c.lureAt = this.step;
  c.act = 2;
  c.actT = 0;
  c.dir = Math.abs(it.x - c.x) > Math.abs(it.y - c.y) ? (it.x > c.x ? 2 : 3) : it.y > c.y ? 0 : 1;
  this.noise(c.x, c.y, 5);
  this.record('settle', { t: this.w.tick, k: Kind.Armor, id: c.id, ev: 'absorb', how: rob ? 'rob' : 'floor', part: hand ? 'hand' : 'body', n: it.kind, x: Math.round(c.x), y: Math.round(c.y) } as never);
  const name = ITEM_NAMES[it.kind] ?? '武具';
}

/**
 * 崩れる：体と手の武具が砕け散る（dropBelongings から。体のマナは die の releaseMana で土へ還る）。砕けた武具は床に残らず、次の甲冑の材料にならない。
 * 画面には、武具の破片が飛び散り、青白い未練が立ちのぼって消える（src/creatureView.ts の armorshatter）
 */
export function scatterArmor(this: Ecology, c: Cr): void {
  const kit = this.armorKit.get(c.id);
  this.armorKit.delete(c.id);
  const kinds = kit ? kit.slice(1) : [];
  this.armorFalls.push(Math.round(c.x), Math.round(c.y), this.step);
  if (this.armorFalls.length > 24) this.armorFalls.splice(0, 3);
  // 崩れる土ぼこり（描画専用）と、砕け散る武具の破片
  this.effects.push({ x: c.x, y: c.y, t: this.w.tick });
  this.fxAttacks.push({ t: this.w.tick, style: 'armorshatter', col: 0, size: 2, ax: c.x, ay: c.y, dx: c.x, dy: c.y, did: -1, aid: c.id, big: true, kill: false, n: Math.max(2, kinds.length) });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  this.record('settle', { t: this.w.tick, k: Kind.Armor, id: c.id, ev: 'fall', n: kinds.length, x: Math.round(c.x), y: Math.round(c.y) } as never);
  this.log(c.x, c.y, `{k:${Kind.Armor}}が崩れ、武具が砕け散った`);
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
  // 体を保つのに、マナを少しずつ燃やす（消える）。吸い続けないと保てないので、固まった所では土のマナが尽きていく
  if (this.step % ARMOR_BURN === (c.id + 7) % ARMOR_BURN && c.mana > 0) {
    c.mana--;
    this.w.manaFaded++;
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
  // 傷を直す：打たれていないあいだ、土のマナの濃い所で立ち番をしているときだけ、体のマナを使って少しずつ（使ったマナは足もとの土へ）
  const mx = this.maxHp(c);
  if (c.hp > 0 && c.hp < mx && c.st === 1 && k >= 0 && this.w.mana[k] >= ARMOR_MEND_SOIL && this.w.tick - c.hitAt > ARMOR_MEND_AFTER && c.mana > ARMOR_LOW / 2 && this.step % ARMOR_MEND_EVERY === c.id % ARMOR_MEND_EVERY) {
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
  // 武器の大振りと盾の体当たり（src/eco/charge.ts）
  if (this.armorSkill(c)) return;
  if (c.act === 2 && c.actT < 5) return;
  const sp = s.speed * (c.mana < ARMOR_LOW ? 0.6 : 1) * this.limp(c);
  // 武具を持つ侵入者を襲う
  let foe: Cr | null = null;
  let bd = sq(6 * TILE);
  this.nearby(c.x, c.y, 6, (o) => {
    if (o.dead || o.away || !this.armorFoe(o) || !this.canSense(c, o)) return;
    // 未練の持ち場（生まれた場所から ARMOR_POST_R マス）の外の相手は追わない（撤退すれば振り切れる）
    if ((c.hx || c.hy) && sq(o.x - c.hx) + sq(o.y - c.hy) > ARMOR_POST_R * TILE * ARMOR_POST_R * TILE) return;
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
    if (this.armorEngage(c, f, bd)) return;
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
  // 床の武具を取り込む（8マスの内の、見通しの利く物。前に取り込んでから、未練の宿った物なら ARMOR_GATHER_GAP 回、
  // 宿っていない物なら ARMOR_ABSORB_GAP 回の更新が経っていれば。
  // 倒した相手の落とし物＝亡骸のそば3マスの内の武器と盾は、倒してから生き物の更新900回の内なら、間隔を待たずに）
  const victim = c.ref && this.step - c.ref2 < 900 ? this.byId.get(c.ref) : undefined;
  const since = this.step - c.lureAt;
  const nHand = this.armorHand(c).length;
  if (since >= ARMOR_GATHER_GAP || (victim && since >= 0 && nHand < ARMOR_ROB_MAX)) {
    let best: Item | null = null;
    let bd2 = sq(8 * TILE);
    for (const it of this.gear) {
      if (!isJobItem(it.kind)) continue;
      if ((c.hx || c.hy) && sq(it.x - c.hx) + sq(it.y - c.hy) > ARMOR_POST_R * TILE * ARMOR_POST_R * TILE) continue;
      const robbed = !!victim && isHandItem(it.kind) && nHand < ARMOR_ROB_MAX && sq(victim.x - it.x) + sq(victim.y - it.y) < sq(3 * TILE);
      if (!robbed && (since < (it.fuel > 0 ? ARMOR_GATHER_GAP : ARMOR_ABSORB_GAP) || !this.armorWants(c, it))) continue;
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
    armorWants: typeof armorWants;
    armorHp: typeof armorHp;
    armorShed: typeof armorShed;
    fadeRemnant: typeof fadeRemnant;
    takeRemnant: typeof takeRemnant;
    armorBirths: typeof armorBirths;
    pickArmorPost: typeof pickArmorPost;
    absorbItem: typeof absorbItem;
    scatterArmor: typeof scatterArmor;
    armor: typeof armor;
  }
}

Object.assign(Ecology.prototype, { armorCap, armorHand, armorFoe, armorWants, armorHp, armorShed, fadeRemnant, takeRemnant, armorBirths, pickArmorPost, absorbItem, scatterArmor, armor });
