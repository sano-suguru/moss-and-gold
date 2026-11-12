/**
 * Ecology のメソッド：外の世界の魔物の噂（種ごと）。
 *
 * 生きて帰った冒険者が、見かけた大物と、受けた被害（仲間が石化しかけた・倒された）を町に伝え、その種の噂が強まる。
 * 噂は種ごとに強さと最後に知られた場所を持ち、日ごとに薄れる（src/eco/salamander.ts の onDayEvents）。
 *
 * 噂の種になる魔物：冒険者が敵とみなす魔物のうち、アンデッド（祓いの噂）・ゴブリン（盗みの噂）・竜の仲間（竜の噂）を除いたもの。
 * 見かけただけで噂になるのは強さ10以上、仲間が石化しかけたり倒されたりすれば強さ6以上（どの種も同じ決まり）。
 */
import { Ecology, Kind, Party, STR } from '../ecology';

/** 魔物の噂になりうる種（アンデッド・ゴブリン・竜の仲間は、それぞれ別の噂になる） */
const BEAST_KINDS = [Kind.Kobold, Kind.Orc, Kind.Lizardman, Kind.Minotaur, Kind.Troll, Kind.Vampire, Kind.Thrall, Kind.Basilisk];
/** 見かけただけで噂になる強さ、被害で噂になる強さ */
const SEEN_STR = 10;
const HURT_STR = 6;
/** 生還者1人分の噂の強まり：見かけた大物（帰還1回の合計。見た種で分ける）、被害1件（一行で3件まで） */
const SEEN_ADD = 0.2;
const HURT_ADD = 0.3;
const HURT_MAX = 3;
/** これより弱くなった噂は忘れる */
const FORGET = 0.02;

/** 見かけただけで噂になる種か */
export function beastSeenKind(k: number): boolean {
  return BEAST_KINDS.includes(k) && STR[k] >= SEEN_STR;
}

/** 受けた被害で噂になる種か */
export function beastHurtKind(k: number): boolean {
  return BEAST_KINDS.includes(k) && STR[k] >= HURT_STR;
}

/** その種の噂（なければ作る）。種の番号の順に並べておく */
export function beastRumor(this: Ecology, k: number): number[] {
  const bs = this.rumors.beasts;
  let e = bs.find((b) => b[0] === k);
  if (!e) {
    e = [k, 0, 0, 0];
    bs.push(e);
    bs.sort((a, b) => a[0] - b[0]);
  }
  return e;
}

/** 魔物の噂の強さの合計（評判に入る） */
export function beastTotal(this: Ecology): number {
  let s = 0;
  for (const b of this.rumors.beasts) s += b[1];
  return s;
}

/** 魔物の噂が日ごとに薄れる */
export function fadeBeastRumors(this: Ecology, mul: number): void {
  for (const b of this.rumors.beasts) b[1] *= mul;
  this.rumors.beasts = this.rumors.beasts.filter((b) => b[1] >= FORGET);
}

/** 一行が受けた被害を覚える（同じ種の被害はまとめ、場所と個体は最後のものにする） */
export function partyHurt(this: Ecology, p: Party, k: number, x: number, y: number, id: number): void {
  if (!beastHurtKind(k)) return;
  const h = (p.hurt ??= []);
  const e = h.find((a) => a[0] === k);
  if (e) {
    e[1]++;
    e[2] = Math.round(x);
    e[3] = Math.round(y);
    e[4] = id;
  } else h.push([k, 1, Math.round(x), Math.round(y), id]);
}

/** 一行が見かけた大物を覚える（種ごとに、最後に見た場所） */
export function partySawBeast(this: Ecology, p: Party, k: number, x: number, y: number): void {
  if (!beastSeenKind(k)) return;
  const s = (p.seenB ??= []);
  const e = s.find((a) => a[0] === k);
  if (e) {
    e[1] = Math.round(x);
    e[2] = Math.round(y);
  } else s.push([k, Math.round(x), Math.round(y)]);
}

/**
 * 生きて帰った者が、魔物の噂を持ち帰る（mul は吟遊詩人の倍率）。
 * 見かけた大物は合計 SEEN_ADD を見た種で分け、被害は1件 HURT_ADD（一行で HURT_MAX 件まで）。
 * 被害を与えた個体が分かっていて、もう倒されていれば、その被害は噂にしない（目当てのいない狩りに出ないように）
 */
export function carryBeastRumors(this: Ecology, p: Party, mul: number): void {
  const seen = p.seenB ?? [];
  for (const s of seen) {
    const e = this.beastRumor(s[0]);
    e[1] += (SEEN_ADD / seen.length) * mul;
    e[2] = s[1];
    e[3] = s[2];
  }
  let left = HURT_MAX;
  for (const h of p.hurt ?? []) {
    if (left <= 0) break;
    if (h[4] > 0) {
      const o = this.byId.get(h[4]);
      if (!o || o.dead || o.away || o.k !== h[0]) continue;
    }
    const n = Math.min(left, h[1]);
    left -= n;
    const e = this.beastRumor(h[0]);
    e[1] += HURT_ADD * n * mul;
    e[2] = h[2];
    e[3] = h[3];
  }
}

declare module '../ecology' {
  interface Ecology {
    beastRumor: typeof beastRumor;
    beastTotal: typeof beastTotal;
    fadeBeastRumors: typeof fadeBeastRumors;
    partyHurt: typeof partyHurt;
    partySawBeast: typeof partySawBeast;
    carryBeastRumors: typeof carryBeastRumors;
  }
}

Object.assign(Ecology.prototype, { beastRumor, beastTotal, fadeBeastRumors, partyHurt, partySawBeast, carryBeastRumors });
