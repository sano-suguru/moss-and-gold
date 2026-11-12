/**
 * Ecology のメソッド：町の冒険者の名簿（冒険者の作り直しの五歩目）。
 *
 * 見せたい瞬間：
 *  1. 同じ顔がまた来る：冒険者ごとに姿（髪の色、肌の色、体つき、頭の形、身につける色）が決まっていて、何度来ても同じ姿。
 *  2. 装備が良くなる：生きて帰るたびに位が上がり（見習い→熟練→歴戦→英雄）、位ごとに装備が目に見えて変わる
 *     （熟練で盾や胸に紋章、歴戦でマント、英雄で武器がほのかに光る。描画は src/sprites.ts の heroSprite）。
 *  3. 墓標が立つ：熟練以上の冒険者が倒れた所に小さな墓標。のちの一行がそばを通ると、一度立ち止まって墓標の方を向き、僧侶がいれば祈る。
 *
 * 名簿（Ecology.roster）は12人。一行は名簿から組む（職業の決め方と目標の決め方は今までどおり。中にいる者は選ばない）。
 * 倒れた者は名簿から外れ、同じ職業の新人（見習い）が加わる。位は帰還の回数で上がる（2回で熟練、4回で歴戦、7回で英雄）。
 * 位が上がると強さも少し上がる（RANK_MUL。英雄で頭打ち）。墓標（Ecology.graves）は20を超えたら古いものから崩れて消える。
 */
import { Cr, Ecology, Job, Kind, Party, STR, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { ADV_NAMES, JOB_NAMES } from '../names';
import { isJobItem } from './armor';
import { BONE_KINDS, KIN_RISE_MANA } from './undead';

/** 名簿の一人 */
export interface Hero {
  id: number;
  name: string;
  /** 職業（Job） */
  job: number;
  /** 姿（packLook の値：髪・肌・身につける色・体つき・頭の形） */
  look: number;
  /** 位（0 見習い、1 熟練、2 歴戦、3 英雄） */
  rank: number;
  /** 生きて帰った回数 */
  ret: number;
  /** 遠征の回数（入った回数） */
  trips: number;
  /** いま中にいれば、その生き物の番号（いなければ 0） */
  cid: number;
  /** 最後の遠征（引退の前の遠征。見習いを連れて入る）なら 1 */
  last?: number;
  /** この遠征でいちばん減ったときの体力（上限に対する百分率。帰ったとき2割を切っていれば傷が残る） */
  low?: number;
  /** 傷が癒えるまで遠征に出ない期限の tick（この tick より前は一行に選ばない） */
  rest?: number;
}

/** 墓標 */
export interface Grave {
  id: number;
  x: number;
  y: number;
  name: string;
  job: number;
  rank: number;
  ret: number;
  /** 姿（墓標の布の色に） */
  look: number;
  /** 倒れた tick */
  t: number;
}

export const ROSTER_SIZE = 12;
export const GRAVE_MAX = 20;
export const RANK_NAMES = ['見習い', '熟練', '歴戦', '英雄'];
/** 位が上がる帰還の回数 */
export const RANK_AT = [0, 2, 4, 7];
/** 位ごとの強さの倍率（英雄で頭打ち。英雄でも竜には一行で挑む強さ） */
export const RANK_MUL = [1, 1.07, 1.14, 1.2];
/**
 * はじめの名簿の職業（戦士2、魔法使い2、盗賊2、僧侶2、吟遊詩人、狩人2、竜殺し）。倒れた者・引退した者は同じ職業の新人で補うので、この顔ぶれが続く。
 * 依頼を率いる職業（src/eco/quest.ts）の者が中にいる間は、その依頼は引かれないので、狩人を2人にした
 * （1人のときは、16シード×25日で魔物の狩りの依頼の一行が225→151に減り、石化のあとにバジリスク狩りが来る場面が2シードだけだった）。
 * 竜殺しも2人にすると、はじめのうちの一行が強くなって宝物庫のゴーレムが早く倒され、ゴーレムが0匹の割合が400→692に増えたので、1人のまま
 */
const START_JOBS = [Job.Warrior, Job.Warrior, Job.Wizard, Job.Wizard, Job.Thief, Job.Thief, Job.Priest, Job.Priest, Job.Bard, Job.Hunter, Job.Hunter, Job.Slayer];
/** 引退：英雄になってからこの回数の遠征を終えて帰ると引退する（帰還 RANK_AT[3] + RETIRE_AFTER 回）。最後の遠征は見習いを一人連れて入る */
export const RETIRE_AFTER = 3;
export const RETIRE_RET = RANK_AT[3] + RETIRE_AFTER;
/** 傷：体力が上限のこの割合を切って生還すると（目安の2割では、帰還の約0.7％しか当たらず25日にほとんど見えないので半分に。帰還の93％は無傷）、眼帯か包帯の姿が残り、しばらく遠征に出ない */
export const SCAR_AT = 0.5;
export const SCAR_REST = 14400 * 1.5;
/** 頭の飾りの種類（src/sprites.ts の CREST_NAMES。名簿は引退の前に13人になることがあるので13種） */
export const CREST_KINDS = 13;
/** 墓標で立ち止まる長さ（生き物の更新の回数）と、気づく遠さ（マス） */
const GRAVE_STOP = 60;
const GRAVE_R = 6;
/** 冒険者の亡骸に気づいて、僧侶が祈りに立ち止まる遠さ（マス） */
const BLESS_R = 6;
/** 一行の先頭から何マス以内に起きている手強い相手がいると、祈らずに通り過ぎるか */
const BLESS_SAFE = 6;
/** 清められた亡骸の印（st）：起き上がらず、聖印の光が立ちのぼる */
export const BLESSED = 99;
/** 清められて、祈りの終わりに金の光の粒になって崩れる骨の印（st）。祈り始めた step 番号は lureAt */
export const CRUMBLING = 98;
/** 冒険者でない亡骸の前で止まる長さ（生き物の更新の回数。冒険者の亡骸の半分）。骨はこの長さのあと崩れる */
export const KIN_STOP = 30;
/** 冒険者でない亡骸へ祈る間隔（一行ごと。生き物の更新の回数。600回はゲーム内の約2時間） */
const KIN_GAP = 600;
/** 清めると崩れる、倒されたアンデッドの残骸 */
const BLESS_REMAINS: number[] = [Kind.Skeleton, Kind.Zombie, Kind.Lich];

/** 姿の値：髪 0〜5、肌 0〜3、身につける色 0〜5、体つき 0〜2、頭の形 0〜1、頭の飾り（+1 して 1〜13、0 はまだない）、傷（1 眼帯、2 頭の包帯） */
export function packLook(hair: number, skin: number, color: number, build: number, head: number, crest = -1, scar = 0): number {
  return hair | (skin << 3) | (color << 5) | (build << 8) | (head << 10) | ((crest + 1) << 11) | (scar << 15);
}
export function unpackLook(v: number): { hair: number; skin: number; color: number; build: number; head: number; crest: number; scar: number } {
  return { hair: v & 7, skin: (v >> 3) & 3, color: (v >> 5) & 7, build: (v >> 8) & 3, head: (v >> 10) & 1, crest: ((v >> 11) & 15) - 1, scar: (v >> 15) & 3 };
}
/** 名簿の中で使われていない頭の飾りを選んで付ける（名簿の中で重ならない） */
function giveCrest(roster: Hero[], h: Hero): void {
  const used = new Set(roster.filter((o) => o !== h).map((o) => unpackLook(o.look).crest));
  const s = ih(h.id, 11, 304) % CREST_KINDS;
  let c = s;
  for (let i = 0; i < CREST_KINDS; i++) if (!used.has((s + i) % CREST_KINDS)) { c = (s + i) % CREST_KINDS; break; }
  h.look = (h.look & ~(15 << 11)) | ((c + 1) << 11);
}

export function rankFor(ret: number): number {
  let r = 0;
  for (let i = 0; i < RANK_AT.length; i++) if (ret >= RANK_AT[i]) r = i;
  return r;
}

/** 名簿に新人（見習い）を一人加える。名前は名簿と墓標に無いものから */
export function recruit(this: Ecology, job: number): Hero {
  const id = this.nextHero++;
  const used = new Set([...this.roster.map((h) => h.name), ...this.graves.map((g) => g.name)]);
  let name = '';
  const s = ih(id, 7, 301) % ADV_NAMES.length;
  for (let i = 0; i < ADV_NAMES.length && !name; i++) if (!used.has(ADV_NAMES[(s + i) % ADV_NAMES.length])) name = ADV_NAMES[(s + i) % ADV_NAMES.length];
  if (!name) name = `${ADV_NAMES[s]}${['二世', '三世', '四世'][id % 3]}`;
  // 姿：同じ職業の者と、身につける色か髪の色が重ならないように（できるだけ）
  let look = 0;
  for (let tries = 0; tries < 8; tries++) {
    const h = (salt: number, n: number) => ih(id, tries * 7 + salt, 302) % n;
    look = packLook(h(1, 6), h(2, 4), h(3, 6), h(4, 3), h(5, 2));
    const L = unpackLook(look);
    if (!this.roster.some((o) => o.job === job && (unpackLook(o.look).color === L.color || unpackLook(o.look).hair === L.hair))) break;
  }
  const hero: Hero = { id, name, job, look, rank: 0, ret: 0, trips: 0, cid: 0, last: 0, low: 100, rest: 0 };
  giveCrest(this.roster, hero);
  this.roster.push(hero);
  return hero;
}

/** 名簿がまだなければ作る（はじめの12人） */
export function fillRoster(this: Ecology): void {
  if (this.roster.length) return;
  for (const j of START_JOBS) this.recruit(j);
}

/** その冒険者の名簿の上の人（いなければ null。演出のデモの冒険者など） */
export function heroOf(this: Ecology, c: Cr): Hero | null {
  if (c.k !== Kind.Adventurer) return null;
  for (const h of this.roster) if (h.cid === c.id) return h;
  return null;
}

/** 位の強さの倍率 */
export function rankMul(this: Ecology, c: Cr): number {
  const h = this.heroOf(c);
  return h ? RANK_MUL[h.rank] : 1;
}

/**
 * 一行の顔ぶれを名簿から選ぶ（maybeParty から）。jobs は職業の決め方で決めた並び（先頭が率いる者）。
 * その職業の、中にいない者から選ぶ。いなければ、名簿が12人に満たないときだけ新人を加え、満ちていれば中にいない別の職業の者で埋める。
 * 灯りを持つ職業（魔法使い・僧侶・戦士）が一人もいなければ、最後の一人を灯りを持つ職業の者に替える。組めなければ null
 */
/**
 * その職業の者が一行を率いられるか：名簿に空いている（中にいない、傷を癒やしていない）その職業の者がいるか、名簿に空きがあって新人を雇えるか。
 * 率いる者がいない依頼は、その一行のくじから外す（src/eco/quest.ts の pickQuest）。
 * （名簿の上限を超えて新人を雇うと、英雄の最後の遠征（名簿が上限以下のときだけ）が16シード×25日で106→51に減った）
 */
export function canLead(this: Ecology, job: number): boolean {
  const tick = this.w.tick;
  return this.roster.length < ROSTER_SIZE || this.roster.some((h) => h.job === job && h.cid === 0 && (h.rest ?? 0) <= tick);
}

export function pickHeroes(this: Ecology, jobs: number[], salt: number): Hero[] | null {
  this.fillRoster();
  const out: Hero[] = [];
  const tick = this.w.tick;
  const free = (h: Hero) => h.cid === 0 && !out.includes(h) && (h.rest ?? 0) <= tick;
  const choose = (cands: Hero[], i: number) => cands[ih(salt, i, 303) % cands.length];
  for (let i = 0; i < jobs.length; i++) {
    let c = this.roster.filter((h) => h.job === jobs[i] && free(h));
    if (!c.length && this.roster.length < ROSTER_SIZE) {
      out.push(this.recruit(jobs[i]));
      continue;
    }
    // 竜殺しがいなければ戦士、戦士がいなければ竜殺し。それもいなければ誰でも
    if (!c.length && (jobs[i] === Job.Slayer || jobs[i] === Job.Warrior)) c = this.roster.filter((h) => (h.job === Job.Warrior || h.job === Job.Slayer) && free(h));
    if (!c.length) c = this.roster.filter(free);
    if (!c.length) break;
    out.push(choose(c, i));
  }
  if (out.length < 2) return null;
  const light = (j: number) => j === Job.Wizard || j === Job.Priest || j === Job.Warrior;
  if (!out.some((h) => light(h.job))) {
    const c = this.roster.filter((h) => light(h.job) && free(h));
    if (!c.length) return null;
    out[out.length - 1] = choose(c, 99);
  }
  // 引退の前の最後の遠征：英雄は、同じ職業の見習い（後を継ぐ新人。名簿が一時13人になる）を連れて入る
  const old = out.find((h) => h.rank >= 3 && h.ret >= RETIRE_RET - 1);
  if (old && !old.last && this.roster.length <= ROSTER_SIZE) {
    old.last = 1;
    const ap = this.recruit(old.job);
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: 0, ev: 'recruit', n: ap.id, how: ap.job, to: 1, x: 0, y: 0 } as never);
    if (out.length < 5) out.push(ap);
    else {
      // 英雄でも、灯りを持つ最後の一人でもない者と入れ替える
      const light = (j: number) => j === Job.Wizard || j === Job.Priest || j === Job.Warrior;
      let i = out.length - 1;
      while (i > 0 && (out[i] === old || (light(out[i].job) && out.filter((h) => light(h.job)).length <= 1))) i--;
      out[i > 0 ? i : out.length - 1] = ap;
    }
  }
  return out;
}

/** 名簿の者に頭の飾りがなければ付ける（飾りのない古いセーブデータをロードしたとき） */
export function ensureCrests(this: Ecology): void {
  for (const h of this.roster) if (unpackLook(h.look).crest < 0) giveCrest(this.roster, h);
}

/** 打たれた冒険者：この遠征でいちばん減った体力を覚える（傷が残るかの判断。strike から） */
export function heroHurt(this: Ecology, c: Cr): void {
  const h = this.heroOf(c);
  if (!h) return;
  const f = Math.max(0, Math.round((c.hp / this.maxHp(c)) * 100));
  if (f < (h.low ?? 100)) h.low = f;
}

/** 一行に入った冒険者を名簿に結ぶ */
export function heroEnter(this: Ecology, h: Hero, c: Cr, p: Party): void {
  h.cid = c.id;
  h.trips++;
  h.low = 100;
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'hero', n: h.id, how: h.trips, to: h.rank, x: 0, y: 0 } as never);
}

/** 冒険者の呼び方（位・職業・名前）。例：「歴戦の戦士アルド」 */
export function heroTitle(h: { rank: number; job: number; name: string }): string {
  return `${RANK_NAMES[h.rank]}の${JOB_NAMES[h.job]}${h.name}`;
}

/** 外へ出た（leaveDungeon と、飢えて去るとき）。生きて帰れば帰還の回数を数え、位を上げる */
export function heroHome(this: Ecology, c: Cr, returned: boolean): void {
  const h = this.heroOf(c);
  if (!h) return;
  h.cid = 0;
  if (!returned) return;
  h.ret++;
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: c.party, ev: 'home', n: h.id, how: h.rank, to: h.low ?? 100, x: 0, y: 0 } as never);
  // 傷：深手を負って生きて帰った者には、眼帯か頭の包帯が残る（重ねて負えば両方）。しばらく遠征に出ない
  if ((h.low ?? 100) < SCAR_AT * 100) {
    const L = unpackLook(h.look);
    const add = L.scar === 0 ? 1 + (ih(h.id, h.trips, 305) & 1) : 3;
    h.look = (h.look & ~(3 << 15)) | ((L.scar | add) << 15);
    h.rest = this.w.tick + SCAR_REST;
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: c.party, ev: 'scar', n: h.id, how: h.look >> 15, to: h.low ?? 0, x: Math.round(c.x), y: Math.round(c.y) } as never);
    this.log(c.x, c.y, `${heroTitle(h)}が深い傷を負って帰った（${(h.look >> 15) === 1 ? '片目を失い、眼帯をつけた' : (h.look >> 15) === 2 ? '頭に包帯を巻いた' : '眼帯と包帯の姿になった'}）`);
  }
  h.low = 100;
  // 引退：英雄が最後の遠征から生きて帰った。名簿から外れ、それきり来ない（連れてきた見習いが後を継ぐ）
  if (h.last && h.rank >= 3) {
    const i = this.roster.indexOf(h);
    if (i >= 0) this.roster.splice(i, 1);
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: c.party, ev: 'retire', n: h.id, how: h.job, to: h.ret, x: Math.round(c.x), y: Math.round(c.y) } as never);
    this.log(c.x, c.y, `英雄${h.name}（${JOB_NAMES[h.job]}、帰還${h.ret}回）が引退した`);
    if (this.roster.length < ROSTER_SIZE) {
      const nh = this.recruit(h.job);
      this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: 0, ev: 'recruit', n: nh.id, how: nh.job, x: 0, y: 0 } as never);
    }
    return;
  }
  const r = rankFor(h.ret);
  if (r > h.rank) {
    h.rank = r;
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: c.party, ev: 'rank', n: h.id, how: r, to: h.ret, x: Math.round(c.x), y: Math.round(c.y) } as never);
    this.log(c.x, c.y, `${JOB_NAMES[h.job]}${h.name}が帰還${h.ret}回を重ね、${RANK_NAMES[r]}になった`);
  }
}

/**
 * 名簿の見直し（updateParties の初め、生き物の更新ごと）：中にいるはずの者が倒れていれば、名簿から外して新人を加え、熟練以上なら倒れた所に墓標を立てる
 */
export function rosterStep(this: Ecology): void {
  this.ensureCrests();
  for (let i = this.roster.length - 1; i >= 0; i--) {
    const h = this.roster[i];
    if (!h.cid) continue;
    const c = this.byId.get(h.cid);
    if (c && !c.dead) continue;
    this.roster.splice(i, 1);
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: c?.party ?? 0, ev: 'fallen', n: h.id, how: h.rank, to: h.ret, x: Math.round(c?.x ?? 0), y: Math.round(c?.y ?? 0) } as never);
    if (c && h.rank >= 1) this.raiseGrave(h, c.x, c.y);
    // 引退の前で名簿が13人のときは、倒れても新人は加わらない（12人に戻るだけ）
    if (this.roster.length >= ROSTER_SIZE) continue;
    const nh = this.recruit(h.job);
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: 0, ev: 'recruit', n: nh.id, how: nh.job, x: 0, y: 0 } as never);
  }
}

/** 墓標を立てる（倒れた所に近い床。上限を超えたら古いものから崩れて消える） */
export function raiseGrave(this: Ecology, h: Hero, x: number, y: number): void {
  const m = this.w.map;
  let k = this.tileOf(x, y);
  if (k < 0 || m.solid[k] || m.lava[k]) {
    let best = -1;
    let bd = 1e9;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const q = (ty + dy) * m.w + tx + dx;
        if (q < 0 || q >= m.solid.length || m.solid[q] || m.lava[q] || dx * dx + dy * dy >= bd) continue;
        bd = dx * dx + dy * dy;
        best = q;
      }
    if (best < 0) return;
    k = best;
  }
  const gx = (k % m.w) * TILE + 8;
  const gy = Math.floor(k / m.w) * TILE + 10;
  const g: Grave = { id: this.nextHero++, x: gx, y: gy, name: h.name, job: h.job, rank: h.rank, ret: h.ret, look: h.look, t: this.w.tick };
  this.graves.push(g);
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: 0, ev: 'grave', n: g.id, how: h.rank, x: gx, y: gy } as never);
  this.log(gx, gy, `${heroTitle(h)}が倒れた所に、小さな墓標が立った`);
  while (this.graves.length > GRAVE_MAX) {
    const old = this.graves.shift() as Grave;
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: 0, ev: 'gravegone', n: old.id, x: old.x, y: old.y } as never);
  }
}

/** 墓標のそばを通る一行：一度だけ立ち止まり、皆が墓標の方を向く（僧侶がいれば祈る）。aimStep から */
export function graveBrace(this: Ecology, p: Party, lead: Cr): void {
  if ((p.braceT ?? 0) > this.step || p.engage || (p.camp ?? -1) >= 0 || (p.listenT ?? 0) > this.step || !this.graves.length) return;
  const m = this.w.map;
  for (const g of this.graves) {
    if (sq(g.x - lead.x) + sq(g.y - lead.y) > GRAVE_R * TILE * GRAVE_R * TILE) continue;
    if ((p.mourned ??= []).includes(g.id) || !lineOfSight(m, lead.x, lead.y, g.x, g.y)) continue;
    p.mourned.push(g.id);
    if (p.mourned.length > 30) p.mourned.shift();
    this.brace(p, g.x, g.y, 4, GRAVE_STOP);
    const priest = p.members.some((id) => {
      const o = this.byId.get(id);
      return !!o && !o.dead && o.sp === Job.Priest;
    });
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'mourn', n: g.id, how: priest ? 1 : 0, x: Math.round(lead.x), y: Math.round(lead.y) } as never);
    return;
  }
}

/**
 * 亡骸に気づいた、僧侶のいる一行：皆が立ち止まって亡骸の方を向き、僧侶が祈って清める（aimStep から）。
 * 清めは祈り始めた時点で付く（途中で襲われても清まったまま）。清めの印が付くので、同じ亡骸の前で二度は立ち止まらない。
 * 立ち止まらない場面は墓標と同じ（身構えている、戦いに向かっている、焚き火で休んでいる、物音に耳を澄ませている）。
 *
 * 祈る相手は、見える所にあるうちの先に、冒険者の亡骸。清められた冒険者の亡骸は、スケルトンやリッチとして起き上がらず、
 * ヴァンパイアの眷属にもならない（src/eco/step.ts、src/eco/vampire.ts）。亡骸は骨になっても残り、聖印の光が立ちのぼる。
 * 冒険者の亡骸が見えなければ、冒険者でない亡骸にも祈る（以前は冒険者の亡骸だけが相手で、冒険者が倒れにくくなると、祈りの場面がまとめて減った）：
 *  - 人型（ゴブリン・コボルト・オーク・ドワーフ・リザードマン）の亡骸のうち、起き上がりうる所（暗く、足もとにマナがあり、死者が多いかリッチが近い。
 *    src/eco/step.ts の decay と同じ条件）にあるもの（riseSpot）。肉の残る亡骸は、清められると残ったまま起き上がらなくなる（聖印の光が立ちのぼる）。
 *  - 倒されたスケルトン・ゾンビ・リッチの残骸（場所を問わない）。
 *  骨（人型の骨と、アンデッドの残骸）は、祈る間に金色に光り、祈りの終わりに金の光の粒になって立ちのぼって消える（blessCrumble）。
 *  冒険者でない亡骸の前で止まる長さは冒険者の亡骸の半分（KIN_STOP）で、一行ごとに生き物の更新 KIN_GAP 回に1回まで
 *  （人型の亡骸は冒険者の亡骸よりずっと多いので、毎回止まると探索が進まない）。ヴァンパイアの印の付いた亡骸（眷属になる）には祈らない
 */
export function blessBrace(this: Ecology, p: Party, lead: Cr): void {
  if ((p.braceT ?? 0) > this.step || p.engage || (p.camp ?? -1) >= 0 || (p.listenT ?? 0) > this.step) return;
  const priest = p.members.some((id) => {
    const o = this.byId.get(id);
    return !!o && !o.dead && o.sp === Job.Priest;
  });
  if (!priest) return;
  const m = this.w.map;
  // 一行のそばに、起きている手強い相手（強さ6以上：リビングアーマー、ゴーレム、ミノタウロスなど）がいれば祈らない。
  // 亡骸は冒険者が倒された所、たとえば宝物庫の入口のゴーレムの前に溜まるので、その近くで立ち止まると次々に倒されて、亡骸がまた増えていた。
  // 祈る間、一行はその場で止まる（亡骸へは歩み寄らない）ので、危ないかどうかは一行の先頭のまわりで見る
  let danger = -1;
  const safe = () => {
    if (danger < 0) {
      danger = 0;
      this.nearby(lead.x, lead.y, BLESS_SAFE, (q) => {
        if (!danger && !q.dead && !q.away && q.sleep === 0 && q.k !== Kind.Adventurer && q.k !== Kind.Dwarf && STR[q.k] >= 6) danger = 1;
      });
    }
    return danger === 0;
  };
  const seen = (o: Cr) => sq(o.x - lead.x) + sq(o.y - lead.y) <= BLESS_R * TILE * BLESS_R * TILE && lineOfSight(m, lead.x, lead.y, o.x, o.y);
  for (const o of this.corpses) {
    if (o.k !== Kind.Adventurer || o.dead !== 1 || o.units <= 0 || o.st === BLESSED) continue;
    if (!seen(o) || !safe()) continue;
    o.st = BLESSED;
    this.blessGearNear(o.x, o.y);
    this.brace(p, o.x, o.y, 5, GRAVE_STOP);
    const own = o.party === p.id ? 1 : 0;
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'bless', n: o.id, how: o.sp, own, x: Math.round(o.x), y: Math.round(o.y) } as never);
    return;
  }
  if ((p.kinBlessT ?? 0) > this.step) return;
  for (const o of this.corpses) {
    if (o.dead !== 1 || o.units <= 0 || o.st === BLESSED || o.st === CRUMBLING) continue;
    const undead = BLESS_REMAINS.includes(o.k);
    if (!undead && !BONE_KINDS.includes(o.k)) continue;
    if (o.lure && this.byId.get(o.lure)?.k === Kind.Vampire) continue;
    // アンデッド祓いの一行は、目標を果たすまでリッチの残骸を崩さない（果たしたとき、そばのリッチの残骸を見て杖を戦利品にする。src/eco/loot.ts の takeTrophy）
    if (o.k === Kind.Lich && p.aim === 4 && !p.aimEnd) continue;
    if (!seen(o) || (!undead && !this.riseSpot(o.x, o.y)) || !safe()) continue;
    const bones = undead || this.corpseStage(o) === 2;
    if (bones) {
      // 祈りの終わり（生き物の更新 KIN_STOP 回あと）に崩れる。祈り始めた step 番号を lureAt に持つ（ヴァンパイアの印の付いた亡骸は選ばないので、lureAt は空いている）
      o.st = CRUMBLING;
      o.lureAt = this.step;
    } else o.st = BLESSED;
    this.brace(p, o.x, o.y, 5, KIN_STOP);
    p.kinBlessT = this.step + KIN_GAP;
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: undead ? 'blessUndead' : 'blessKin', n: o.k, how: bones ? 1 : 0, x: Math.round(o.x), y: Math.round(o.y) } as never);
    return;
  }
}

/** 人型の亡骸が起き上がりうる所か（暗く、足もとにマナがあり、死者が多いかリッチが近い。src/eco/step.ts の decay の、骨とゾンビの起き上がりに共通の条件） */
export function riseSpot(this: Ecology, x: number, y: number): boolean {
  const k = this.tileOf(x, y);
  return k >= 0 && this.lit(k, this.day) < 0.15 && this.manaAround(k) >= KIN_RISE_MANA && (this.deathsAt(x, y) >= 300 || this.lichNear(x, y));
}

/**
 * 清められた骨が崩れる（step.ts の decay から。祈り始めてから生き物の更新 KIN_STOP 回たったら）：金の光の粒になって立ちのぼり、消える。
 * 残っていた養分は足もとの土へ、体のマナも土へ還す（保存則のため）。描画は src/creatureView.ts の drawAttacks の 'bless'
 */
export function blessCrumble(this: Ecology, c: Cr): boolean {
  if (c.st !== CRUMBLING || this.step - c.lureAt < KIN_STOP) return false;
  const undead = BLESS_REMAINS.includes(c.k);
  this.releaseMana(c);
  this.deposit(c.x, c.y, c.units);
  c.units = 0;
  c.dead = 2;
  this.fxAttacks.push({ t: this.w.tick, style: 'bless', col: 1, size: c.k === Kind.Orc || c.k === Kind.Lich ? 2 : c.k === Kind.Kobold || c.k === Kind.Goblin ? 0 : 1, ax: c.x, ay: c.y, dx: c.x, dy: c.y, did: -1, aid: c.id, big: false, kill: false, fly: 16 });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  this.log(c.x, c.y, undead ? `僧侶の祈りで、倒れた{k:${c.k}}の骸が金の光にほどけた` : `僧侶の祈りで、{k:${c.k}}の骨が金の光にほどけた`);
  this.record('settle', { t: this.w.tick, k: c.k, id: c.id, ev: 'crumble', x: Math.round(c.x), y: Math.round(c.y) } as never);
  return true;
}

/**
 * 亡骸を清めるとき、そのまわり（3マス）の、未練の宿った武具も清める：宿っていたマナは足もとの土へ還り（保存則のため）、
 * もうマナを吸わず、リビングアーマーとして立ち上がらない（fuel を −1 にする。src/eco/armor.ts）
 */
export function blessGearNear(this: Ecology, x: number, y: number): void {
  for (const it of this.gear) {
    if (!isJobItem(it.kind) || it.fuel < 0 || sq(it.x - x) + sq(it.y - y) > 3 * TILE * 3 * TILE) continue;
    const k = this.tileOf(it.x, it.y);
    if (it.fuel > 0) {
      if (k >= 0) this.w.mana[k] += it.fuel;
      else this.w.manaFaded += it.fuel;
    }
    it.fuel = -1;
  }
}

/** 触れた場所の墓標（情報パネルのため） */
export function pickGrave(this: Ecology, wx: number, wy: number): Grave | null {
  let best: Grave | null = null;
  let bd = 10 * 10;
  for (const g of this.graves) {
    const d = sq(g.x - wx) + sq(g.y - 4 - wy);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  return best;
}

declare module '../ecology' {
  interface Ecology {
    recruit: typeof recruit;
    fillRoster: typeof fillRoster;
    heroOf: typeof heroOf;
    rankMul: typeof rankMul;
    pickHeroes: typeof pickHeroes;
    canLead: typeof canLead;
    heroEnter: typeof heroEnter;
    heroHome: typeof heroHome;
    rosterStep: typeof rosterStep;
    raiseGrave: typeof raiseGrave;
    graveBrace: typeof graveBrace;
    blessBrace: typeof blessBrace;
    riseSpot: typeof riseSpot;
    blessCrumble: typeof blessCrumble;
    pickGrave: typeof pickGrave;
    blessGearNear: typeof blessGearNear;
    ensureCrests: typeof ensureCrests;
    heroHurt: typeof heroHurt;
  }
}

Object.assign(Ecology.prototype, { recruit, fillRoster, heroOf, rankMul, pickHeroes, canLead, heroEnter, heroHome, rosterStep, raiseGrave, graveBrace, blessBrace, riseSpot, blessCrumble, pickGrave, blessGearNear, ensureCrests, heroHurt });
