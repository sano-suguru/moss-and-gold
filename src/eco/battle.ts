/**
 * Ecology のメソッド：古戦場（遠い昔に冒険者と亜人が戦って倒れた跡。場所は MapData の battle、findBattle）。
 *
 * 見せたい場面：
 *  1. 始めた時から、暗がりに骨と錆びた武具と少しの金貨が散らばっている（情報パネルでは「遠い昔の戦いで倒れた」）。
 *  2. 古戦場の真ん中からは怨念がマナとしてにじみ出る（World の湧き口）。マナが溜まるにつれて、亜人の骨、冒険者の骨の順に
 *     スケルトンとして起き上がり、錆びた武具がマナを吸って、リビングアーマーが立ち上がる。
 *     どちらも今ある仕組み（骨の起き上がり、武具の未練）がそのまま拾う。
 *  3. 散らばった金貨と骨は、ゴブリンや冒険者を呼び寄せ、起き上がった骨や甲冑とぶつかる。
 *
 * 骨や金貨の量は、土の養分と同じく、はじめの総量に入る（保存則の初期値は seed のあとで測る）。
 * 骨の体は古戦場のまわりの土の養分から取る。武具の未練は薄れきっている（fuel 0）ので、土のマナが濃くなるまでは立ち上がらない。
 */
import { type Cr, Ecology, ItemKind, Kind, SPEC, ih, sq } from '../ecology';
import { BATTLE_R, TILE } from '../mapgen';

/** 古戦場の骨が朽ちる遅さ（ふつうの骨の何倍か。ミノタウロスの縄張りの骨と同じ）。ふつうの速さでは、冒険者の骨でも2日ほどで土に返り、起き上がらずに消えるものが多い */
export const BATTLE_BONE_SLOW = 4;
/**
 * 古戦場の骨の印（st）：遠い昔の骨は乾ききっていて、食べる所が残っていない（スライム・アリ・ゴブリン・トロール・ドラゴンは食べない）。
 * 起き上がるか、僧侶に清められると印は消える。食べられないので、起き上がるまで古戦場に残る
 */
export const OLD_BONES = 97;
/** 古戦場に散らばる金貨 */
const BATTLE_GOLD = 40;
/** 古戦場の死者の多さ（死者1人あたり100。300 以上で骨が起き上がれる。600 以上になるとゴーストが生まれるので、それより少なくする） */
const BATTLE_GRAVE = 500;

/** (x, y) が古戦場（真ん中から BATTLE_R + 2 マスの内）か。x, y はピクセル */
export function inBattle(this: Ecology, x: number, y: number): boolean {
  const B = this.w.map.battle;
  const r = BATTLE_R + 2;
  return B.x >= 0 && sq(x / TILE - (B.x + 0.5)) + sq(y / TILE - (B.y + 0.5)) <= r * r;
}

/** 古戦場を置く（新しいダンジョンを作ったときに一度だけ。seed から） */
export function seedBattle(this: Ecology): void {
  const m = this.w.map;
  const B = m.battle;
  if (B.x < 0) return;
  const h0 = ih(B.x, B.y, 0xba7);
  // 戦った相手：オーク3体か、ゴブリン4体
  const foe = h0 % 2 === 0 ? Kind.Orc : Kind.Goblin;
  const fallen: { k: Kind; sp: number }[] = [];
  for (let i = 0; i < 2; i++) fallen.push({ k: Kind.Adventurer, sp: ih(h0, i, 1) % 6 });
  for (let i = 0; i < (foe === Kind.Orc ? 3 : 4); i++) fallen.push({ k: foe, sp: foe });
  // 骨を置く床：真ん中から BATTLE_R マスの内の床を、ハッシュの順に
  const spots: number[] = [];
  for (let dy = -BATTLE_R; dy <= BATTLE_R; dy++)
    for (let dx = -BATTLE_R; dx <= BATTLE_R; dx++) {
      const k = (B.y + dy) * m.w + B.x + dx;
      if (!m.solid[k] && !m.sealed[k] && !m.lava[k] && dx * dx + dy * dy <= BATTLE_R * BATTLE_R) spots.push(k);
    }
  spots.sort((a, b) => ih(a, h0, 2) - ih(b, h0, 2));
  const center = B.y * m.w + B.x;
  fallen.forEach((f, i) => {
    const k = spots[i % spots.length];
    // 骨だけになった亡骸：生きていたときの大きさ（init）の3割を残す（corpseStage の骨の段階）
    const init = SPEC[f.k].body + (SPEC[f.k].cap >> 1);
    const units = this.takeNutrients(center, Math.floor(init * 0.3), BATTLE_R + 2);
    if (!units) return;
    const x = (k % m.w) * TILE + 4 + (ih(k, i, 3) % 9);
    const y = Math.floor(k / m.w) * TILE + 4 + (ih(k, i, 4) % 9);
    const c: Cr = this.spawn(f.k, x, y, 0, 0);
    // 始めから骨なので、生まれた記録には残さない（はじめの宝の山と同じく、ダンジョンのはじめの姿の一部）
    this.stats.births.pop();
    c.sp = f.sp;
    c.dir = ih(k, i, 5) % 4;
    c.units = units;
    c.init = init;
    c.dead = 1;
    c.act = 3;
    c.st = OLD_BONES;
    // 倒れてから長くたっている（骨が起き上がる条件の一つ。decay）
    c.actT = 3000;
    this.note(c.id, { t: 0, cause: 'old', who: f.k, ...(f.k === Kind.Adventurer ? { job: f.sp } : {}) });
    // 冒険者の職業の道具は、未練の薄れきった錆びた武具として、亡骸のそばに残る
    if (f.k === Kind.Adventurer)
      Ecology.JOB_ITEMS[f.sp].forEach((kd, j) => this.dropItem(x - 5 + j * 9, y + 4 - j * 3, kd, 0, { t: 0, cause: 'old', who: f.k, job: f.sp }));
  });
  // 亜人が拾って使っていた武器も散らばる
  for (let j = 0; j < 2; j++) {
    const k = spots[(fallen.length + j) % spots.length];
    const kd = [ItemKind.Sword, ItemKind.Shield, ItemKind.Greatsword, ItemKind.Mace][ih(h0, j, 6) % 4];
    this.dropItem((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 10, kd, 0, { t: 0, cause: 'old', who: foe });
  }
  // 倒れた者たちが落とした金貨
  const gk = spots[(fallen.length + 2) % spots.length];
  this.note(this.nextId, { t: 0, cause: 'old' });
  this.piles.push({ id: this.nextId++, x: (gk % m.w) * TILE + 8, y: Math.floor(gk / m.w) * TILE + 8, gold: BATTLE_GOLD, age: 0 });
  // 死者の多い所として覚えられている（骨が起き上がる条件。冒険者の分は亡霊の騎士の条件にも数える）
  const cell = Math.min(17, Math.floor(B.y / 8)) * 24 + Math.min(23, Math.floor(B.x / 8));
  this.graveMap[cell] += BATTLE_GRAVE;
  this.advGrave[cell] += 100 * fallen.filter((f) => f.k === Kind.Adventurer).length;
  this.log(B.x * TILE + 8, B.y * TILE + 8, '暗がりに、遠い昔の戦いの跡が残っている');
}

declare module '../ecology' {
  interface Ecology {
    inBattle: typeof inBattle;
    seedBattle: typeof seedBattle;
  }
}
Object.assign(Ecology.prototype, { inBattle, seedBattle });
