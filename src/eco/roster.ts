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
import { Cr, Ecology, Job, Kind, Party, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { ADV_NAMES, JOB_NAMES } from '../names';

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
  /** 倒れた刻み */
  t: number;
}

export const ROSTER_SIZE = 12;
export const GRAVE_MAX = 20;
export const RANK_NAMES = ['見習い', '熟練', '歴戦', '英雄'];
/** 位が上がる帰還の回数 */
export const RANK_AT = [0, 2, 4, 7];
/** 位ごとの強さの倍率（英雄で頭打ち。英雄でも竜には一行で挑む強さ） */
export const RANK_MUL = [1, 1.07, 1.14, 1.2];
/** はじめの名簿の職業（戦士3、魔法使い2、盗賊2、僧侶2、吟遊詩人、狩人、竜殺し） */
const START_JOBS = [Job.Warrior, Job.Warrior, Job.Warrior, Job.Wizard, Job.Wizard, Job.Thief, Job.Thief, Job.Priest, Job.Priest, Job.Bard, Job.Hunter, Job.Slayer];
/** 墓標で立ち止まる長さ（歩）と、気づく遠さ（マス） */
const GRAVE_STOP = 60;
const GRAVE_R = 6;

/** 姿の値：髪 0〜5、肌 0〜3、身につける色 0〜5、体つき 0〜2、頭の形 0〜1 */
export function packLook(hair: number, skin: number, color: number, build: number, head: number): number {
  return hair | (skin << 3) | (color << 5) | (build << 8) | (head << 10);
}
export function unpackLook(v: number): { hair: number; skin: number; color: number; build: number; head: number } {
  return { hair: v & 7, skin: (v >> 3) & 3, color: (v >> 5) & 7, build: (v >> 8) & 3, head: (v >> 10) & 1 };
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
  const hero: Hero = { id, name, job, look, rank: 0, ret: 0, trips: 0, cid: 0 };
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
export function pickHeroes(this: Ecology, jobs: number[], salt: number): Hero[] | null {
  this.fillRoster();
  const out: Hero[] = [];
  const free = (h: Hero) => h.cid === 0 && !out.includes(h);
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
  return out;
}

/** 一行に入った冒険者を名簿に結ぶ */
export function heroEnter(this: Ecology, h: Hero, c: Cr, p: Party): void {
  h.cid = c.id;
  h.trips++;
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
  const r = rankFor(h.ret);
  if (r > h.rank) {
    h.rank = r;
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: c.party, ev: 'rank', n: h.id, how: r, to: h.ret, x: Math.round(c.x), y: Math.round(c.y) } as never);
    this.log(c.x, c.y, `${JOB_NAMES[h.job]}${h.name}が帰還${h.ret}回を重ね、${RANK_NAMES[r]}になった`);
  }
}

/**
 * 名簿の見直し（updateParties の初め、毎歩）：中にいるはずの者が倒れていれば、名簿から外して新人を加え、熟練以上なら倒れた所に墓標を立てる
 */
export function rosterStep(this: Ecology): void {
  for (let i = this.roster.length - 1; i >= 0; i--) {
    const h = this.roster[i];
    if (!h.cid) continue;
    const c = this.byId.get(h.cid);
    if (c && !c.dead) continue;
    this.roster.splice(i, 1);
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: c?.party ?? 0, ev: 'fallen', n: h.id, how: h.rank, to: h.ret, x: Math.round(c?.x ?? 0), y: Math.round(c?.y ?? 0) } as never);
    if (c && h.rank >= 1) this.raiseGrave(h, c.x, c.y);
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
    this.log(old.x, old.y, `${heroTitle(old)}の古い墓標が崩れて消えた`);
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
    this.log(g.x, g.y, `${this.partyTitle(p)}の一行が、${heroTitle(g)}の墓標の前で立ち止まった${priest ? '（僧侶が祈りを捧げた）' : ''}`);
    return;
  }
}

/** 触れた場所の墓標（札のため） */
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
    heroEnter: typeof heroEnter;
    heroHome: typeof heroHome;
    rosterStep: typeof rosterStep;
    raiseGrave: typeof raiseGrave;
    graveBrace: typeof graveBrace;
    pickGrave: typeof pickGrave;
  }
}

Object.assign(Ecology.prototype, { recruit, fillRoster, heroOf, rankMul, pickHeroes, heroEnter, heroHome, rosterStep, raiseGrave, graveBrace, pickGrave });
