/**
 * Ecology のメソッド：外の世界の噂と、町に出る依頼（クエスト）。
 *
 * 見せたい場面：町に依頼が出て（ログ「町に〇〇の依頼が出た」）、一行がそれを引き受けて入ってくる（「〇〇の依頼を受けて」）。
 * 噂の強さに応じて、竜退治・竜の寝床への道探し・魔物の狩り・ゴブリン退治・祓い・宝探し・探索の一行が混ざって来る。
 *
 * 依頼は噂から毎回つくる（状態を持たない）。重さは噂の強さそのもので、一行は重さに比例したくじで一つ引き受け、
 * 依頼に合う職業が率いる（ゴブリン退治は戦士、竜退治と竜の寝床への道探しは竜殺し、魔物の狩りは狩人、祓いは僧侶、宝探しは盗賊）。
 * 率いる職業の者が名簿に空いていなければ、名簿に空きがあればその職業の新人を雇い、空きもなければその依頼は引かない（src/eco/roster.ts の canLead）。
 * 依頼を受けた一行が中にいる間（目標を終えていない間）は、その依頼は掲示から外れる。
 * 果たして生きて帰ればその噂が鎮まり、果たせずに帰れば噂はそのまま残る（宝探しだけは、持ち帰った金貨がそのまま噂を強める）。
 *
 * 魔物の噂（種ごと）：
 *
 * 生きて帰った冒険者が、見かけた大物と、受けた被害（仲間が石化しかけた・倒された）を町に伝え、その種の噂が強まる。
 * 噂は種ごとに強さと最後に知られた場所を持ち、日ごとに薄れる（src/eco/salamander.ts の onDayEvents）。
 *
 * 噂の種になる魔物：冒険者が敵とみなす魔物のうち、アンデッド（祓いの噂）・ゴブリン（盗みの噂）・竜の仲間（竜の噂）を除いたもの。
 * 見かけただけで噂になるのは強さ10以上、仲間が石化しかけたり倒されたりすれば強さ6以上（どの種も同じ決まり）。
 */
import { Ecology, Job, Kind, Party, STR, ih } from '../ecology';
import { TILE } from '../mapgen';

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
    e = [k, 0, 0, 0, 0];
    bs.push(e);
    bs.sort((a, b) => a[0] - b[0]);
  }
  return e;
}

/**
 * 魔物の評判（来訪の頻度・一行の人数と格に入る分。各種の噂の5番目の値の合計）。
 * 依頼の重さ（噂の強さ）とは分けて、見かけた大物（帰還1回で合計 SEEN_ADD）と、生きている魔物による石化（1件 HURT_ADD）だけで強まる。
 * （仲間が倒された被害も評判に入れると、16シード×25日で一行が799→884に増え、狩りで大物が減った）
 */
export function beastTotal(this: Ecology): number {
  let s = 0;
  for (const b of this.rumors.beasts) s += b[4] ?? 0;
  return s;
}

/** 魔物の噂（強さと評判）が日ごとに薄れる。どちらも弱くなった噂は忘れる */
export function fadeBeastRumors(this: Ecology, mul: number): void {
  for (const b of this.rumors.beasts) {
    b[1] *= mul;
    b[4] *= mul;
  }
  this.rumors.beasts = this.rumors.beasts.filter((b) => b[1] >= FORGET || b[4] >= FORGET);
}

/** 一行が受けた被害を覚える（同じ種の被害はまとめ、場所と個体は最後のものにする。stone は石化か） */
export function partyHurt(this: Ecology, p: Party, k: number, x: number, y: number, id: number, stone = false): void {
  if (!beastHurtKind(k)) return;
  const h = (p.hurt ??= []);
  const e = h.find((a) => a[0] === k);
  if (e) {
    e[1]++;
    e[2] = Math.round(x);
    e[3] = Math.round(y);
    e[4] = id;
    if (stone) e[5] = (e[5] ?? 0) + 1;
  } else h.push([k, 1, Math.round(x), Math.round(y), id, stone ? 1 : 0]);
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
    e[4] += (SEEN_ADD / seen.length) * mul;
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
    // 分析用：被害の噂を持ち帰った（一行で一度。tools/analysis/lib/moments.ts の petriQuest）
    if (!(p.hurtTold ??= []).includes(h[0])) {
      p.hurtTold.push(h[0]);
      this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'hurtTold', how: h[0], n, x: h[2], y: h[3] } as never);
    }
    const e = this.beastRumor(h[0]);
    e[1] += HURT_ADD * n * mul;
    if (h[5]) e[4] += HURT_ADD * mul;
    e[2] = h[2];
    e[3] = h[3];
  }
}

/** 町に出る依頼：a は目標の種類（Party.aim と同じ番号：0 探索、1 宝探し、2 竜退治、3 魔物の狩り、4 アンデッド祓い、5 ゴブリン退治、6 竜の寝床への道探し）、k は狩る種、w は重さ */
export interface Quest {
  a: number;
  k: number;
  w: number;
}
/** 依頼を受けない一行（探索）のくじの重さ */
const EXPLORE_W = 0.5;
/** 依頼が出る噂の強さ */
const DRAGON_AT = 0.3;
const BEAST_AT = 0.15;
const UNDEAD_AT = 0.4;
const GOLD_AT = 0.3;
/** 依頼を率いる職業（目標の種類の番号で引く。探索は決めない） */
export const QUEST_LEAD = [-1, Job.Thief, Job.Slayer, Job.Hunter, Job.Priest, Job.Warrior, Job.Slayer];
const UNDEAD = [Kind.Zombie, Kind.Skeleton, Kind.Lich, Kind.Ghost, Kind.Armor];

/** 竜退治の相手になる竜：ドラゴン、ワイバーン、岩の中を動くワームは床にいるときだけ */
export function questDragon(this: Ecology): number {
  const m = this.w.map;
  const d = this.list.find((o) => !o.dead && !o.away && o.k === Kind.Dragon) ?? this.list.find((o) => !o.dead && !o.away && o.k === Kind.Wyvern) ?? this.list.find((o) => !o.dead && !o.away && o.k === Kind.Worm && this.tileOf(o.x, o.y) >= 0 && !m.solid[this.tileOf(o.x, o.y)]);
  return d ? d.k : 0;
}

/** 竜の寝床への道が町に知られていて、その先のドラゴンが生きているか */
export function dragonWayKnown(this: Ecology): boolean {
  const way = this.lore.dragonWay;
  const wd = way ? this.byId.get(way[2]) : undefined;
  return !!wd && !wd.dead && !wd.away && wd.k === Kind.Dragon;
}

/** その依頼を受けた一行が中にいて、まだ目標を終えていないか、果たして帰る途中か（最後の一人が帰るまで、その依頼は掲示に戻らない） */
function questTaken(e: Ecology, a: number, k: number): boolean {
  return e.parties.some((p) => p.q === a && (p.qk ?? 0) === k && (!p.aimEnd || (p.aimEnd === 1 && !p.qCalm)) && p.members.some((id) => { const c = e.byId.get(id); return !!c && !c.dead; }));
}

/** いま町に出ている依頼の一覧（噂から毎回つくる。並びは決まった順） */
export function questBoard(this: Ecology): Quest[] {
  const r = this.rumors;
  const out: Quest[] = [];
  const add = (a: number, k: number, w: number) => {
    if (!questTaken(this, a, k)) out.push({ a, k, w });
  };
  if (this.goblinHuntReady()) add(5, 0, r.goblin + 0.25 * r.goblinRobs);
  // 竜の噂：寝床への道が知られていれば竜退治、ドラゴンがいて道が知られていなければ、道を探して持ち帰る依頼（深部の探索）。
  // ドラゴンがいなければ、ワイバーンか床にいるワームの竜退治
  const dk = r.dragon >= DRAGON_AT ? this.questDragon() : 0;
  if (dk === Kind.Dragon && !this.dragonWayKnown()) add(6, 0, r.dragon);
  else if (dk) add(2, 0, r.dragon);
  for (const b of r.beasts) if (b[1] >= BEAST_AT && this.list.some((o) => o.k === b[0] && !o.dead && !o.away)) add(3, b[0], b[1]);
  if (r.undead >= UNDEAD_AT && this.list.some((o) => !o.dead && !o.away && UNDEAD.includes(o.k))) add(4, 0, r.undead);
  if (r.gold >= GOLD_AT && this.lore.gold.length) add(1, 0, r.gold);
  return out;
}

/** 一行が引き受ける依頼を、重さに比例したくじで一つ引く（探索も一定の重さでくじに入る。率いる職業の者が名簿にいなければ、その依頼は引かない） */
export function pickQuest(this: Ecology): Quest {
  const qs = [...this.questBoard().filter((q) => this.canLead(QUEST_LEAD[q.a])), { a: 0, k: 0, w: EXPLORE_W }];
  const tot = qs.reduce((s, q) => s + q.w, 0);
  let v = ((ih(this.step, 220, 7) % 10000) / 10000) * tot;
  for (const q of qs) {
    if (v < q.w) return q;
    v -= q.w;
  }
  return qs[qs.length - 1];
}

/** 依頼の呼び名（記録の文。{k:種} は照らされた種なら名前になる） */
export function questName(this: Ecology, a: number, k: number): string {
  switch (a) {
    case 1:
      return '宝探し';
    case 2:
      return `{k:${this.questDragon() || Kind.Dragon}}退治`;
    case 3:
      return `{k:${k}}狩り`;
    case 4:
      return 'アンデッド祓い';
    case 5:
      return `{k:${Kind.Goblin}}退治`;
    case 6:
      return `{k:${Kind.Dragon}}の寝床への道探し`;
    default:
      return '探索';
  }
}

/** 噂が強まったあと、新しく出た依頼を町の出来事として記録する（before は強まる前の一覧の鍵） */
export function postNewQuests(this: Ecology, before: number[]): void {
  const m = this.w.map;
  for (const q of this.questBoard()) {
    if (before.includes(q.a * 100 + q.k)) continue;
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: 0, ev: 'quest', how: q.a, to: q.k, x: 0, y: 0 } as never);
    this.log(m.entrance.x * TILE + 8, TILE + 8, `町に${this.questName(q.a, q.k)}の依頼が出た`);
  }
}

/** いま出ている依頼の鍵（postNewQuests に渡す） */
export function questKeys(this: Ecology): number[] {
  return this.questBoard().map((q) => q.a * 100 + q.k);
}

/** 依頼を果たした一行が生きて帰ると、最後の一人が帰ったところで、その噂が鎮まる（一行で一度だけ。src/eco/adventurer.ts の updateParties） */
export function calmQuest(this: Ecology, p: Party): void {
  if (p.aimEnd !== 1 || p.qCalm) return;
  p.qCalm = 1;
  const r = this.rumors;
  if (p.q === 5) {
    r.goblin *= 0.3;
    r.goblinRobs = 0;
  } else if (p.q === 2 && p.aim === 2) r.dragon *= 0.3;
  else if (p.q === 3) {
    const b = r.beasts.find((e) => e[0] === p.qk);
    if (b) b[1] *= 0.2;
    this.fadeBeastRumors(1);
  } else if (p.q === 4) r.undead *= 0.3;
}

declare module '../ecology' {
  interface Ecology {
    beastRumor: typeof beastRumor;
    beastTotal: typeof beastTotal;
    fadeBeastRumors: typeof fadeBeastRumors;
    partyHurt: typeof partyHurt;
    partySawBeast: typeof partySawBeast;
    carryBeastRumors: typeof carryBeastRumors;
    questDragon: typeof questDragon;
    dragonWayKnown: typeof dragonWayKnown;
    questBoard: typeof questBoard;
    pickQuest: typeof pickQuest;
    questName: typeof questName;
    postNewQuests: typeof postNewQuests;
    questKeys: typeof questKeys;
    calmQuest: typeof calmQuest;
  }
}

Object.assign(Ecology.prototype, { beastRumor, beastTotal, fadeBeastRumors, partyHurt, partySawBeast, carryBeastRumors, questDragon, dragonWayKnown, questBoard, pickQuest, questName, postNewQuests, questKeys, calmQuest });
