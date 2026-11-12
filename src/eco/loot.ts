/**
 * Ecology のメソッド：冒険者の戦利品（倒した目標にちなむもの）。
 *
 * 見せたい瞬間：帰り道の一行が、金貨の袋や戦利品（竜の牙、トロールの棍棒など）を担いで入口へ向かう。
 * 全滅した一行の倒れた所には、荷と戦利品が残る。
 *
 * 目標（竜、大物、アンデッド、ゴブリン退治）を果たした一行は、戦利品を一つ担ぐ（Party.trophy は種の番号、trophyBy は担ぐ者）。
 * 担ぐ者が倒れれば仲間が担ぎ直し、全滅すれば倒れた所に残る（床の道具 ItemKind.Trophy。fuel に種の番号）。
 * 生きて帰れば記録に「〜の一行が竜の牙を持ち帰った」。戦利品は保存則の対象外（姿と記録だけ）。
 */
import { Cr, Ecology, ItemKind, Job, Kind, Party, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 戦利品の名前と、絵の種類（src/sprites.ts の trophyArt） */
export const TROPHY: Record<number, [string, string]> = {
  [Kind.Dragon]: ['竜の牙', 'fang'],
  [Kind.Wyvern]: ['ワイバーンの毒の尾', 'fang'],
  [Kind.Worm]: ['ワームの牙', 'fang'],
  [Kind.Troll]: ['トロールの棍棒', 'club'],
  [Kind.Minotaur]: ['ミノタウロスの角', 'horn'],
  [Kind.Basilisk]: ['バジリスクの眼', 'eye'],
  [Kind.Vampire]: ['吸血鬼の牙', 'fang'],
  [Kind.Lich]: ['リッチの杖', 'staff'],
  [Kind.Skeleton]: ['古い骨の冠', 'skull'],
  [Kind.Zombie]: ['古い骨の冠', 'skull'],
  [Kind.Ghost]: ['古い骨の冠', 'skull'],
  [Kind.Goblin]: ['ゴブリンの頭の角兜', 'helm'],
  [Kind.Orc]: ['オークの斧', 'axe'],
  [Kind.Lizardman]: ['リザードマンの槍', 'spear'],
  [Kind.Golem]: ['ゴーレムの核', 'eye'],
  [Kind.Armor]: ['動く甲冑の冑', 'helm'],
  [Kind.Gargoyle]: ['ガーゴイルの角', 'horn'],
  [Kind.Mimic]: ['ミミックの歯', 'fang'],
  [Kind.Spider]: ['大グモの毒牙', 'fang'],
  [Kind.Lizard]: ['大トカゲの皮', 'hide'],
};

export function trophyName(k: number): string {
  return TROPHY[k]?.[0] ?? '獣の牙';
}

/** 目標を果たした一行が戦利品を担ぐ（endAim から）。宝探しと深部の探索にはない */
export function takeTrophy(this: Ecology, p: Party, lead: Cr): void {
  const a = p.aim ?? 0;
  if (a < 2 || a > 5 || p.trophy) return;
  let k = 0;
  if (a === 2 || a === 3) {
    const t = this.byId.get(p.aimId ?? 0);
    k = t ? t.k : a === 2 ? Kind.Dragon : (p.aimK ?? this.rumors.beastKind) || Kind.Troll;
  } else if (a === 4) {
    // アンデッド祓い：リッチを倒していれば杖、リビングアーマーが崩れていれば冑（生き物の更新3000回の内に、目標の10マスの内で）、ほかは骨の冠
    k = Kind.Skeleton;
    const f = this.armorFalls;
    for (let i = 0; i + 2 < f.length; i += 3) if (f[i + 2] >= this.step - 3000 && sq(f[i] - (p.aimX ?? 0)) + sq(f[i + 1] - (p.aimY ?? 0)) < 10 * TILE * 10 * TILE) k = Kind.Armor;
    for (const o of this.corpses) if (o.k === Kind.Lich && o.dead === 1 && sq(o.x - (p.aimX ?? 0)) + sq(o.y - (p.aimY ?? 0)) < 10 * TILE * 10 * TILE) k = Kind.Lich;
  } else k = Kind.Goblin;
  const alive = p.members.map((id) => this.byId.get(id)).filter((c): c is Cr => !!c && !c.dead);
  const by = this.trophyBearer(alive) ?? lead;
  p.trophy = k;
  p.trophyBy = by.id;
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'trophy', how: 'take', n: k, x: Math.round(by.x), y: Math.round(by.y) } as never);
  this.log(by.x, by.y, `${this.partyTitle(p)}の一行が${trophyName(k)}を手に入れた`);
}

/** 戦利品を担ぐ者：戦士か竜殺し（力のある者）、いなければ先頭 */
export function trophyBearer(this: Ecology, alive: Cr[]): Cr | null {
  return alive.find((c) => c.sp === Job.Slayer) ?? alive.find((c) => c.sp === Job.Warrior) ?? alive[0] ?? null;
}

/** 担ぐ者が倒れたら、仲間が担ぎ直す（updateParties から、生き物の更新ごと） */
export function carryTrophy(this: Ecology, p: Party, alive: Cr[]): void {
  if (!p.trophy) return;
  const by = this.byId.get(p.trophyBy ?? 0);
  if (by && !by.dead && alive.includes(by)) return;
  const nb = this.trophyBearer(alive);
  if (nb) p.trophyBy = nb.id;
}

/** 全滅した一行の戦利品は、担いでいた者の倒れた所に残る（updateParties から） */
export function dropTrophy(this: Ecology, p: Party, at: Cr | undefined): void {
  if (!p.trophy) return;
  const by = this.byId.get(p.trophyBy ?? 0) ?? at;
  if (by) {
    this.dropItem(by.x + 5, by.y - 2, ItemKind.Trophy, p.trophy, this.partyNote(p));
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'trophy', how: 'lost', n: p.trophy, x: Math.round(by.x), y: Math.round(by.y) } as never);
  }
  p.trophy = 0;
}

/** 生きて帰った者が戦利品を担いでいれば、持ち帰った（leaveDungeon から） */
export function bringTrophy(this: Ecology, c: Cr, p: Party): void {
  if (!p.trophy || p.trophyBy !== c.id) return;
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'trophy', how: 'home', n: p.trophy, x: Math.round(c.x), y: Math.round(c.y) } as never);
  this.log(c.x, c.y, `${this.partyTitle(p)}の一行が${trophyName(p.trophy)}を持ち帰った`);
  p.trophy = 0;
}

declare module '../ecology' {
  interface Ecology {
    takeTrophy: typeof takeTrophy;
    trophyBearer: typeof trophyBearer;
    carryTrophy: typeof carryTrophy;
    dropTrophy: typeof dropTrophy;
    bringTrophy: typeof bringTrophy;
  }
}

Object.assign(Ecology.prototype, { takeTrophy, trophyBearer, carryTrophy, dropTrophy, bringTrophy });
