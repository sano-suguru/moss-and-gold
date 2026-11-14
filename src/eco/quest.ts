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
import { type Cr, Ecology, Job, Kind, type Party, STR, ih } from '../ecology';
import { NAMES } from '../names';
import { GOBLIN_HUNT_AT } from './aim';
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

/**
 * 一行が受けた被害を覚える（被害を与えた個体ごとにまとめ、場所は最後のものにする。id はその個体の番号で、分からなければ -1。stone は石化か）。
 * 個体ごとに分けるのは、帰ったときに、もう倒された個体の被害を噂にしないため（同じ種でまとめると、個体の番号が上書きされて確かめられなかった）
 */
export function partyHurt(this: Ecology, p: Party, k: number, x: number, y: number, id: number, stone = false): void {
  if (!beastHurtKind(k)) return;
  const h = (p.hurt ??= []);
  const e = h.find((a) => a[0] === k && a[4] === id);
  if (e) {
    e[1]++;
    e[2] = Math.round(x);
    e[3] = Math.round(y);
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
 * 被害を与えた個体が分かっていて、もう倒されていれば、その被害は噂にしない。個体が分からなければ、その種が1匹もいなければ噂にしない（目当てのいない狩りに出ないように）。
 * 評判（来訪の頻度に入る分）は main と同じく、石化があれば帰還1回で HURT_ADD だけ
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
  let stoned: number[] | undefined;
  for (const h of p.hurt ?? []) {
    if (left <= 0) break;
    if (h[4] > 0) {
      const o = this.byId.get(h[4]);
      if (!o || o.dead || o.away || o.k !== h[0]) continue;
    } else if (!this.list.some((o) => o.k === h[0] && !o.dead && !o.away)) continue;
    const n = Math.min(left, h[1]);
    left -= n;
    // 分析用：被害の噂を持ち帰った（一行で一度。tools/analysis/lib/moments.ts の petriQuest）
    if (!(p.hurtTold ??= []).includes(h[0])) {
      p.hurtTold.push(h[0]);
      this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'hurtTold', how: h[0], n, x: h[2], y: h[3] } as never);
    }
    const e = this.beastRumor(h[0]);
    e[1] += HURT_ADD * n * mul;
    if (h[5] && !stoned) stoned = e;
    e[2] = h[2];
    e[3] = h[3];
  }
  if (stoned) stoned[4] += HURT_ADD * mul;
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
/** アンデッドの種（祓いの依頼の相手。src/eco/aim.ts も使う） */
export const UNDEAD = [Kind.Zombie, Kind.Skeleton, Kind.Lich, Kind.Ghost, Kind.Armor];

/** 竜退治の相手になる竜：ドラゴン、ワイバーン、岩の中を動くワームは床にいるときだけ（この順に探す。src/eco/aim.ts の chooseAim も使う） */
export function questDragonCr(this: Ecology): Cr | undefined {
  const m = this.w.map;
  return this.list.find((o) => !o.dead && !o.away && o.k === Kind.Dragon) ?? this.list.find((o) => !o.dead && !o.away && o.k === Kind.Wyvern) ?? this.list.find((o) => !o.dead && !o.away && o.k === Kind.Worm && this.tileOf(o.x, o.y) >= 0 && !m.solid[this.tileOf(o.x, o.y)]);
}

/** 竜退治の相手になる竜の種（いなければ 0） */
export function questDragon(this: Ecology): number {
  return this.questDragonCr()?.k ?? 0;
}

/** 竜の寝床への道が町に知られていて、その先のドラゴンが生きているか */
export function dragonWayKnown(this: Ecology): boolean {
  const way = this.lore.dragonWay;
  const wd = way ? this.byId.get(way[2]) : undefined;
  return !!wd && !wd.dead && !wd.away && wd.k === Kind.Dragon;
}

/**
 * その依頼を受けた一行が中にいて、まだ目標を終えていないか、果たして帰る途中か（くじから外す）。
 * 果たした一行は、最後の一人が帰ったところで噂を鎮める（leaveDungeon）ので、それまでは外したままにする
 */
function questTaken(e: Ecology, a: number, k: number): boolean {
  return e.parties.some((p) => p.q === a && (p.qk ?? 0) === k && (!p.aimEnd || (p.aimEnd === 1 && !p.qCalm)) && p.members.some((id) => { const c = e.byId.get(id); return !!c && !c.dead; }));
}

/** 依頼の鍵（掲示の一覧 Rumors.posted に覚える） */
const questKey = (a: number, k: number) => a * 100 + k;

/** 噂から出ている依頼の一覧（受けた一行が中にいる依頼も含む。並びは決まった順） */
export function questBoard(this: Ecology): Quest[] {
  const r = this.rumors;
  const out: Quest[] = [];
  const add = (a: number, k: number, w: number) => out.push({ a, k, w });
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

/**
 * 掲示を作り直す：噂から出ている依頼の一覧を覚え（Rumors.posted。セーブに入る）、新しく加わった依頼を「町に〇〇の依頼が出た」と記録する。
 * 受けた一行が中にいる依頼は、噂が薄れて境目を下回っても一覧に残す（あきらめて帰っても、果たして帰る途中に噂が薄れて戻っても、「出た」とはならない）。
 * 鎮まったり薄れたりして消えた依頼が、また噂から出たときは出る。
 * 作り直すのは、一行が依頼を引く直前（pickQuest）、依頼の一行の最後の一人が帰ったとき（leaveDungeon）、竜が生まれたとき、日ごとに噂が薄れたとき。
 * 掲示を覚えていない古いセーブでは、最初の作り直しで、いま出ている依頼をそのまま覚える（ログは出さず、記録だけ init 1 で残す）
 */
export function syncQuests(this: Ecology): void {
  const r = this.rumors;
  const m = this.w.map;
  const keys = this.questBoard().map((q) => questKey(q.a, q.k));
  for (const key of r.posted ?? []) if (!keys.includes(key) && questTaken(this, Math.floor(key / 100), key % 100)) keys.push(key);
  keys.sort((x, y) => x - y);
  const init = !r.posted;
  for (const key of keys) {
    if (r.posted?.includes(key)) continue;
    const a = Math.floor(key / 100);
    const k = key % 100;
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: 0, ev: 'quest', how: a, to: k, ...(init ? { init: 1 } : {}), x: 0, y: 0 } as never);
    if (!init) this.log(m.entrance.x * TILE + 8, TILE + 8, `町に${this.questName(a, k)}の依頼が出た`);
  }
  r.posted = keys;
}

/** 一行が引き受ける依頼を、重さに比例したくじで一つ引く（探索も一定の重さでくじに入る。受けた一行が中にいる依頼と、率いる職業の者が名簿にいない依頼は引かない） */
export function pickQuest(this: Ecology): Quest {
  this.syncQuests();
  const qs = [...this.questBoard().filter((q) => !questTaken(this, q.a, q.k) && this.canLead(QUEST_LEAD[q.a])), { a: 0, k: 0, w: EXPLORE_W }];
  const tot = qs.reduce((s, q) => s + q.w, 0);
  let v = ((ih(this.step, 220, 7) % 10000) / 10000) * tot;
  for (const q of qs) {
    if (v < q.w) return q;
    v -= q.w;
  }
  return qs[qs.length - 1];
}

/**
 * 依頼の呼び名。plain でなければ記録の文（{k:種} は照らされた種なら名前になる）、plain なら情報パネルの文（種の名前そのまま）。
 * 竜退治の k は相手の竜の種（0 ならいまの竜退治の相手）
 */
export function questName(this: Ecology, a: number, k: number, plain = false): string {
  const nm = (kind: number) => (plain ? NAMES[kind] : `{k:${kind}}`);
  switch (a) {
    case 1:
      return '宝探し';
    case 2:
      return `${nm(k || this.questDragon() || Kind.Dragon)}退治`;
    case 3:
      return `${nm(k)}狩り`;
    case 4:
      return 'アンデッド祓い';
    case 5:
      return `${nm(Kind.Goblin)}退治`;
    case 6:
      return `${nm(Kind.Dragon)}の寝床への道探し`;
    default:
      return '探索';
  }
}

/**
 * 依頼を果たした一行の最後の一人が帰ったところで、その噂を、依頼が出る強さの半分まで下げる（一行で一度だけ。src/eco/adventurer.ts の leaveDungeon）。
 * 次の目撃や被害があるまで、同じ依頼は出ない（以前は ×0.2〜0.3 で、帰る者が多いと鎮めたあとも依頼が残った）。宝探しと道探しは鎮めない
 */
export function calmQuest(this: Ecology, p: Party): void {
  if (p.aimEnd !== 1 || p.qCalm) return;
  p.qCalm = 1;
  const r = this.rumors;
  if (p.q === 5) {
    r.goblin = Math.min(r.goblin, GOBLIN_HUNT_AT / 2);
    r.goblinRobs = 0;
  } else if (p.q === 2 && p.aim === 2) r.dragon = Math.min(r.dragon, DRAGON_AT / 2);
  else if (p.q === 3) {
    const b = r.beasts.find((e) => e[0] === p.qk);
    if (b) b[1] = Math.min(b[1], BEAST_AT / 2);
  } else if (p.q === 4) r.undead = Math.min(r.undead, UNDEAD_AT / 2);
  else return;
  // 分析用：鎮めたあとも、同じ依頼が噂から出ているか（left。check で0を確かめる）
  const left = this.questBoard().some((q) => q.a === p.q && q.k === (p.qk ?? 0)) ? 1 : 0;
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'calm', how: p.q, to: p.qk ?? 0, left, x: 0, y: 0 } as never);
}

declare module '../ecology' {
  interface Ecology {
    beastRumor: typeof beastRumor;
    beastTotal: typeof beastTotal;
    fadeBeastRumors: typeof fadeBeastRumors;
    partyHurt: typeof partyHurt;
    partySawBeast: typeof partySawBeast;
    carryBeastRumors: typeof carryBeastRumors;
    questDragonCr: typeof questDragonCr;
    questDragon: typeof questDragon;
    dragonWayKnown: typeof dragonWayKnown;
    questBoard: typeof questBoard;
    syncQuests: typeof syncQuests;
    pickQuest: typeof pickQuest;
    questName: typeof questName;
    calmQuest: typeof calmQuest;
  }
}

Object.assign(Ecology.prototype, { beastRumor, beastTotal, fadeBeastRumors, partyHurt, partySawBeast, carryBeastRumors, questDragonCr, questDragon, dragonWayKnown, questBoard, syncQuests, pickQuest, questName, calmQuest });
