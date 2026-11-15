/**
 * 蓄えの荷を担ぐ姿を描くかどうか（描画と撮影ツールの shot で共有する。シミュレーションの判断には使わない）。
 * 運ぶ食べ物は腹の中にあり、運ぶ途中かどうかをセーブする状態から読み取る。
 */
import { type Cr, type Ecology, Kind, SPEC } from './ecology';

/** 傷を受けてからこの tick の間は、戦っているか逃げている最中とみなして荷を描かない */
const HAUL_FIGHT_TICKS = 100;

/** 荷の絵の種類：0 キノコの束（住処へ蓄えを運ぶコボルト）、1 ネズミ（腹を満たして集落へ帰るゴブリン）、-1 描かない */
export function haulKind(eco: Ecology, c: Cr): number {
  if (c.dead || c.away || c.sleep === 2 || c.flee > 0 || eco.w.tick - c.hitAt < HAUL_FIGHT_TICKS) return -1;
  // 戦で奪った蓄えを担いで引き上げる者（warHauls）
  if ((c.k === Kind.Kobold || c.k === Kind.Goblin) && eco.warHauls(c)) return c.k === Kind.Kobold ? 0 : 1;
  if (c.k === Kind.Kobold) return c.st === 13 ? 0 : -1;
  if (c.k === Kind.Goblin) return goblinHauls(eco, c) ? 1 : -1;
  return -1;
}

/**
 * 腹を満たして集落へ蓄えを運ぶ途中のゴブリンか（goblin の「腹いっぱいの者は、蓄えが足りなければ集落へ持ち帰る」と同じ条件）。
 * 待機・食べる・食べ物集め（st 0・3・4）の者だけで、隠れに行く者・群れを離れる者・盗みに出た者は除く。
 * 袋を担ぐ者・金貨を運ぶ者・松明を持つ者や冒険者についた者・集落に着いた者も除く
 */
function goblinHauls(eco: Ecology, c: Cr): boolean {
  if (c.act !== 1 || c.hungry || (c.st !== 0 && c.st !== 3 && c.st !== 4) || c.units >= 6 || c.gold > 0 || c.torch > 0 || c.party || c.food <= SPEC[Kind.Goblin].cap * 0.75) return false;
  const camp = eco.campOf(c);
  if (!camp || (camp.store ?? 0) >= eco.campStoreGoal(camp)) return false;
  const d2 = (camp.x - c.x) ** 2 + (camp.y - c.y) ** 2;
  return d2 > 32 * 32 && d2 < 480 * 480;
}
