/** Ecology のメソッド：冒険者（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Note, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq, STONE_FULL } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import { RANK_NAMES, heroTitle } from './roster';
import { ARMOR_REMNANT, ARMOR_REMNANT_KIN, isJobItem } from './armor';
import { BONE_SP } from './undead';
import type { World } from '../world';
import { SKILL_HUNTER_RAIN, SKILL_PRIEST_HAMMER, SKILL_SLAYER_CLEAVE, SKILL_THIEF_THROW, SKILL_WARRIOR_SLASH, SKILL_WIZARD_MISSILE, type Skill } from './skill';
import { HP_PER_STR } from './combat';
import { HERO_SKILL_MANA, HERO_SKILL_R } from './salamander';
import { QUEST_LEAD, beastSeenKind } from './quest';

/** 一行の撤退で下がる生き物の更新の回数（およそ12秒） */
const RETREAT_N = 60;

/** 職業ごとの技（src/eco/skill.ts）。吟遊詩人は戦わない */
const JOB_SKILL: (Skill | undefined)[] = [SKILL_WARRIOR_SLASH, SKILL_WIZARD_MISSILE, SKILL_THIEF_THROW, SKILL_PRIEST_HAMMER, undefined, SKILL_HUNTER_RAIN, SKILL_SLAYER_CLEAVE];
/** 職業ごとの技の届く距離（マス）：戦士の飛ぶ斬撃5、魔法使いのマジックミサイル10、盗賊の短剣投げ8、僧侶のハンマー3（十字架の腕はさらに3）、狩人の矢の雨12、竜殺しの大剣5.5 */
const JOB_REACH = [5, 10, 8, 3, 0, 12, 5.5];
/** 戦う相手に気づける遠さ（px）：打ってきた相手、灯りの輪か明るい床にいる相手、暗がりのすぐそばの敵（src/eco/adventurer.ts の「戦う」） */
const NOTICE_HIT = 12 * TILE;
const NOTICE_LIT = 5.5 * TILE;
const NOTICE_DARK = 2 * TILE;

/** 噂の総量（評判） */

/**
 * 逃げていく者か（逃げている者と、逃げ出す前にスリングを回しているコボルト。src/eco/koboldskill.ts）。弱い者なら冒険者は追わない。
 * （スリングを回す0.8秒のあいだを逃げていない敵と見ると、一行がそのコボルトへ向かって住処のそばまで寄り、16シード×25日で、
 *  冒険者に倒されるコボルトが116→142匹、最後の数が219→185匹に減った）
 */
function runsOff(o: Cr): boolean {
  return o.flee > 0 || (o.k === Kind.Kobold && o.run === -1);
}
export function reputation(this: Ecology): number {
  const r = this.rumors;
  return r.light + r.gold * 2 + r.undead + this.beastTotal() + r.dragon * 2;
}

export function maybeParty(this: Ecology): void {
  const rep = this.reputation();
  const chance = Math.min(500, 30 + rep * 40);
  if (ih(this.step, 201, 7) % 1000 >= chance) return;
  const m = this.w.map;
  const r = this.rumors;
  const want = Math.min(5, 2 + (ih(this.step, 202, 7) % 3) + (rep > 3 ? 1 : 0));
  const tier = rep < 2 ? 0 : rep < 6 ? 1 : 2;
  // 町に出ている依頼から、重さに比例したくじで一つ引き受ける（探索も一定の重さでくじに入る。src/eco/quest.ts）
  const quest = this.pickQuest();
  // 噂の中身で顔ぶれが変わる：金貨なら盗賊、アンデッドなら僧侶、大物や竜なら戦士、ゴブリン退治なら戦士が多い
  const beast = this.beastTotal();
  const wts = [3 + 3 * (beast + r.dragon) + (quest.a === 5 ? 6 : 0), 2, 1 + 3 * r.gold, 2 + 3 * r.undead, 1, r.beasts.length ? 3 * beast : 0, 0];
  const jobs: number[] = [];
  for (let i = 0; i < want; i++) {
    const tot = wts.reduce((a, b) => a + b, 0);
    let v = (ih(this.step, 203 + i, 7) % 1000) / 1000 * tot;
    let j = 0;
    while (j < wts.length - 1 && v >= wts[j]) v -= wts[j++];
    jobs.push(j);
  }
  // 依頼に合う職業が一行を率いる（ゴブリン退治は戦士、竜退治は竜殺し、魔物の狩りは狩人、祓いは僧侶、宝探しは盗賊）
  if (QUEST_LEAD[quest.a] >= 0) jobs[0] = QUEST_LEAD[quest.a];
  // 光がなければ進めない：魔法使いも僧侶もいなければ、戦士が一人松明を持つ。戦士もいなければ一人を戦士に
  if (!jobs.includes(Job.Wizard) && !jobs.includes(Job.Priest) && !jobs.includes(Job.Warrior)) jobs[jobs.length - 1] = Job.Warrior;
  // 顔ぶれは町の名簿から（中にいる者は選ばない。その職業がいなければ別の職業の者で埋める。src/eco/roster.ts）
  const heroes = this.pickHeroes(jobs, this.step);
  if (!heroes) return;
  jobs.length = heroes.length;
  heroes.forEach((h, i) => (jobs[i] = h.job));
  const size = heroes.length;
  const pid = this.nextId++;
  // 入る口：正面の入口か、外の世界の地図に載った地表の横穴（開いているもの）
  const known = (this.lore.mouths ?? []).filter((i) => this.mouthOpen(i));
  const pick = ih(this.step, 205, 7) % (1 + known.length);
  const door = pick === 0 ? -1 : known[pick - 1];
  const party: Party = { id: pid, members: [], goal: 0, tx: m.entrance.x * TILE + 8, ty: 3 * TILE, since: this.step, tier, initial: size, saw: 0, targetAt: 0, waitT: 0, door, mouths: [], explored: this.lore.explored.slice(), goldCells: this.lore.gold.slice(), goneGold: [], danger: this.lore.danger.filter((d) => this.w.tick - d[2] < DAY_TICKS_ECO * 3).map((d) => [d[0], d[1]]), fatigue: 0, camp: -1, campUntil: 0, lastCamp: this.step };
  let torchGiven = false;
  for (let i = 0; i < size; i++) {
    const j = jobs[i];
    const body = SPEC[Kind.Adventurer].body;
    const food = SPEC[Kind.Adventurer].cap;
    this.imported += body + food;
    this.originNext = 'entrance';
    const [dx0, dy0] = door < 0 ? [m.entrance.x * TILE + 8, TILE + 8] : this.mouthSpot(door);
    if (door >= 0) this.originNext = 'mouth';
    const c = this.spawn(Kind.Adventurer, dx0 + ((i % 3) - 1) * 8, dy0 + Math.floor(i / 3) * 8, body, food);
    c.sp = j;
    c.init = tier;
    c.party = pid;
    c.dir = 0;
    // 懐の金貨（持ち込み）
    const purse = ih(this.step, 210 + i, 7) % 8;
    c.gold = purse;
    this.goldIn += purse;
    // 僧侶は松明を掲げ、ほかに光がなければ戦士が一人松明を持つ。予備の松明を一本ずつ
    if (j === Job.Priest || (j === Job.Warrior && !torchGiven && !jobs.includes(Job.Wizard) && !jobs.includes(Job.Priest))) {
      c.torch = TORCH_FUEL;
      c.ref2 = 1;
      torchGiven = true;
    }
    party.members.push(c.id);
    this.counts[Kind.Adventurer]++;
    this.heroEnter(heroes[i], c, party);
  }
  party.name = heroes[0].name;
  this.parties.push(party);
  // 引き受けた依頼から目標を決める
  this.chooseAim(party, quest);
  // 町の知っている物資の置き場を覚え、深部の探索なら置き場に残す荷を背負う
  this.packForCaches(party);
  const names = heroes.map((h) => `${JOB_NAMES[h.job]}${h.name}${h.trips > 1 ? `（${RANK_NAMES[h.rank]}、${h.trips}度目）` : ''}`).join('・');
  const aim = this.aimPhrase(party);
  // 引退の前の最後の遠征：英雄が見習いを連れて入る
  const old = heroes.find((h) => h.last && h.rank >= 3);
  const ap = old ? (heroes.find((h) => h.rank === 0 && h.trips === 1 && h.job === old.job) ?? heroes.find((h) => h.rank === 0 && h.trips === 1)) : undefined;
  const farewell = old ? `英雄${old.name}の最後の遠征${ap ? `、見習いの${JOB_NAMES[ap.job]}${ap.name}を連れて` : ''}。` : '';
  if (old) this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: pid, ev: 'farewell', n: old.id, how: ap ? ap.id : 0, x: 0, y: 0 } as never);
  const who = `${farewell}${heroTitle(heroes[0])}の一行（${names}）が、${aim ? aim + '、' : ''}`;
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: pid, ev: 'enter', how: party.aim ?? 0, n: party.aimId ?? 0, to: party.aimKnown ?? 0, q: party.q ?? 0, qk: party.qk ?? 0, x: 0, y: 0 } as never);
  // 入口で身支度をして、食べ残しを少し落としていく
  if (door < 0) this.pendingScraps.push(pid);
  if (door < 0) this.log(m.entrance.x * TILE + 8, TILE + 8, `${who}入口から入ってきた`);
  else this.log(this.mouthSpot(door)[0], this.mouthSpot(door)[1], `${who}地表の横穴から入ってきた`);
}

/** 冒険者の一行の光（松明と光の呪文） */
export function partyLights(this: Ecology, p: Party): Cr[] {
  const out: Cr[] = [];
  for (const id of p.members) {
    const c = this.byId.get(id);
    if (c && !c.dead && (c.torch > 0 || c.sp === Job.Wizard)) out.push(c);
  }
  return out;
}

/** その者から見えるか：一行の光の中か、日の光や光る苔に照らされているか。盗賊は夜目が利く */
export function seenBy(this: Ecology, c: Cr, lights: Cr[], o: Cr): boolean {
  if ((o.st === 7 || o.st === 12) && this.isHidden(o) && !this.atDoorOf(c, o) && !this.searchesCamp(c, o)) return false;
  if (c.sp === Job.Thief && sq(o.x - c.x) + sq(o.y - c.y) < 3 * TILE * 3 * TILE) return true;
  for (const l of lights) if (sq(o.x - l.x) + sq(o.y - l.y) < 5.5 * TILE * 5.5 * TILE) return true;
  // 光っている者（glow が16を超える：光る苔やウィスプを食べた者、睨みの溜めや見つめで目を光らせるバジリスクなど。描画でもまわりを照らす）は、
  // 暗がりでも8マスの内なら、見通しが通れば見える
  if (o.glow > 16 && sq(o.x - c.x) + sq(o.y - c.y) < 8 * TILE * 8 * TILE && lineOfSight(this.w.map, c.x, c.y, o.x, o.y)) return true;
  return this.isLit(o);
}

export function updateParties(this: Ecology): void {
  const m = this.w.map;
  this.rosterStep();
  for (const p of this.parties) {
    const alive = p.members.map((id) => this.byId.get(id)).filter((c): c is Cr => !!c && !c.dead);
    if (!alive.length && p.members.length) {
      const last = this.byId.get(p.members[p.members.length - 1]);
      if (!(p.saw & 16)) this.log(last?.x ?? 0, last?.y ?? 0, `${p.name ? p.name + 'の' : ''}冒険者の一行が全滅した`);
      // 担いでいた戦利品は、倒れた所に残る
      this.dropTrophy(p, last);
      // 依頼を果たした一行の一部が帰り、残りが中で倒れた：帰った者が知らせたので、噂を鎮める（ふつうは最後の一人が帰ったとき。leaveDungeon）
      if (p.saw & 16 && p.aimEnd === 1 && !p.qCalm) {
        this.calmQuest(p);
        this.syncQuests();
      }
      // 一行の終わり：目標、着いたか、果たしたか、生きて帰ったか
      this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'end', how: p.aim ?? 0, reason: p.saw & 16 ? 'returned' : 'wiped', to: p.aimEnd ?? 0, n: p.aimId ?? 0, arrived: p.aimAt ? 1 : 0, x: Math.round(last?.x ?? 0), y: Math.round(last?.y ?? 0) } as never);
    }
    p.members = alive.map((c) => c.id);
    if (!alive.length) continue;
    this.aimStep(p, alive);
    this.cacheStep(p, alive);
    this.listenStep(p, alive);
    this.carryTrophy(p, alive);
    if (p.goal !== 0 && (p.camp ?? -1) >= 0) this.endCamp(p);
    if (p.goal === 0) {
      const lights = this.partyLights(p);
      let cap = 0;
      let held = 0;
      let hungry = false;
      for (const c of alive) {
        cap += GOLD_CAP[c.sp];
        held += c.gold;
        if (c.food < SPEC[Kind.Adventurer].cap * 0.25) hungry = true;
      }
      // 置き場をたどった一行は、そのぶん長く奥にいられる
      const tooLong = this.step - p.since > 10800 + 2500 * (p.cacheVis?.length ?? 0);
      const fewer = alive.length * 2 < p.initial;
      const dark = !lights.length;
      const slayer = alive.some((c) => c.sp === Job.Slayer);
      // 傷と疲れ：深手なら引き返し、疲れたか手傷を負ったら焚き火を囲んで休む
      let hpSum = 0;
      let worst = 1;
      for (const c of alive) {
        const r = c.hp > 0 ? c.hp / this.maxHp(c) : 1;
        hpSum += r;
        worst = Math.min(worst, r);
      }
      const avgHp = hpSum / alive.length;
      p.fatigue = (p.fatigue ?? 0) + 1;
      // 食料が乏しくなったら、早めに引き返す（帰り道の分を残す）
      const foodAvg = alive.reduce((a2, o) => a2 + o.food / SPEC[Kind.Adventurer].cap, 0) / alive.length;
      // 食料の残る置き場がすぐ先にあれば、着いて補ってから決める（引き返す判断は、置き場で補ったあとの量で）
      const ahead = this.cacheAhead(p, alive[0], foodAvg);
      if (hungry && ahead) hungry = false;
      if (foodAvg < 0.45 && p.goal === 0 && !ahead) {
        p.goal = 1;
        p.camp = -1;
        this.setExit(p);
        continue;
      }
      // 一行の撤退：皆で向かっている相手との戦いで、仲間が倒れたか、一行の体力が半分を切ったか、仲間の誰かがバジリスクの睨みで半ば石になったら、一行ごと退く。
      // 仲間が倒れていれば町へ帰り、倒れていなければ離れた所で休んでから（離れているうちに石化も戻る）、その相手を避けて探索を続ける
      if (p.engage && (p.retreatUntil ?? 0) <= this.step) {
        const e = this.byId.get(p.engage);
        const fell = alive.length < (p.engageN ?? alive.length);
        const stoned = alive.some((o) => o.stone >= STONE_FULL / 2);
        if (e && !e.dead && !e.away && (fell || avgHp < 0.5 || stoned)) {
          p.retreatUntil = this.step + RETREAT_N;
          p.retreatX = Math.round(e.x);
          p.retreatY = Math.round(e.y);
          p.engage = 0;
          p.camp = -1;
          const dc = this.cellOf(e.x, e.y);
          (p.danger ??= []).push([dc, 9999]);
          if (p.danger.length > 30) p.danger.shift();
          if (fell) {
            p.goal = 1;
            this.setExit(p);
          }
          this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'partyRetreat', n: e.k, how: fell ? 1 : stoned ? 2 : 0, x: Math.round(alive[0].x), y: Math.round(alive[0].y) } as never);
          this.log(alive[0].x, alive[0].y, `${this.partyTitle(p)}の一行が{k:${e.k}}にかなわず、${fell ? '倒れた仲間を残して' : stoned ? '石になりかけた仲間を連れて' : '傷を負って'}退いた`);
          continue;
        }
      }
      // 撤退し終えた一行は、その場で焚き火を囲んで休む（帰り道でなければ）
      if (p.retreatUntil && p.retreatUntil === this.step && p.goal === 0 && (p.camp ?? -1) < 0) this.startCamp(p, alive[0]);
      if (avgHp < 0.35 && p.goal === 0) {
        p.goal = 1;
        p.camp = -1;
        this.setExit(p);
        continue;
      }
      // 地上が夜なら、早めに休む（夜は焚き火を囲む）
      // 休むのは、探索中で食料に余裕があるときだけ（帰り道では休まずに出口を目指す。目標に着いて果たすまでの間も休まない）
      // 置き場へ向かう途中と、場所を知った集落へ退治に向かう途中は休まない（置き場に着いてから、木箱のそばで休む。cacheStep）
      if (p.goal === 0 && foodAvg >= 0.5 && (p.camp ?? -1) < 0 && !(p.aimAt && !p.aimEnd) && !((p.cacheGo || (p.aim === 5 && p.aimKnown && !p.aimAt && !p.aimEnd)) && worst >= 0.5) && this.step - (p.lastCamp ?? 0) > 2500 && ((p.fatigue ?? 0) > 3600 || worst < 0.5 || (this.isNight() && (p.fatigue ?? 0) > 1200))) this.startCamp(p, alive[0]);
      if ((p.camp ?? -1) >= 0 && (p.goal !== 0 || foodAvg < 0.3)) this.endCamp(p);
      if ((p.camp ?? -1) >= 0 && this.step >= (p.campUntil ?? 0)) this.endCamp(p);
      if ((p.camp ?? -1) >= 0) this.watchDoze(p);
      if ((p.camp ?? -1) >= 0) this.campWatch(p, alive);
      if (held >= cap * 0.7 || hungry || tooLong || fewer || dark || ((p.saw & 8) !== 0 && !slayer)) {
        p.goal = 1;
        if ((p.camp ?? -1) >= 0) this.endCamp(p);
        this.setExit(p);
      }
    }
  }
  // 全滅した一行、出ていった一行を片づける
  this.parties = this.parties.filter((p) => p.members.length > 0);
}

export function cellOf(this: Ecology, x: number, y: number): number {
  const m = this.w.map;
  const cw = Math.ceil(m.w / CELL);
  return Math.floor(y / TILE / CELL) * cw + Math.floor(x / TILE / CELL);
}

/** 区画の中の、開いていて歩ける床（中心に近いもの）。なければ -1 */
export function cellFloor(this: Ecology, cell: number): number {
  const m = this.w.map;
  const cw = Math.ceil(m.w / CELL);
  const cx = (cell % cw) * CELL + CELL / 2;
  const cy = Math.floor(cell / cw) * CELL + CELL / 2;
  let best = -1;
  let bd = 1e9;
  for (let dy = -CELL / 2; dy < CELL / 2; dy++)
    for (let dx = -CELL / 2; dx < CELL / 2; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 40) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
  return best;
}

/** 一行の強さ（いまの体力を考えた合計） */
export function partyStr(this: Ecology, p: Party): number {
  let s = 0;
  for (const id of p.members) {
    const c = this.byId.get(id);
    if (c && !c.dead) s += this.str(c) * (c.hp > 0 ? c.hp / this.maxHp(c) : 1);
  }
  return s;
}

/**
 * 一行が見積もる相手の強さ：強さに残りの体力の割合を掛ける。リビングアーマー（空の鎧）は、体力が強さのわりに大きい
 * （ふつうは 4 + 強さ×HP_PER_STR、鎧は体の武具の数で決まる。src/eco/combat.ts の maxHp、src/eco/armor.ts の armorHp）ので、
 * ふつうの種と比べた体力の比を見積もりに掛ける。
 * 入れないと、武具を取り込んで強くなった鎧に一行が挑みつづけ、宝物庫の入口で次々に倒されていた（倒れた者の武具をまた鎧が取り込む）
 */
export function foeStr(this: Ecology, o: Cr): number {
  const s = this.str(o) * (o.hp > 0 ? o.hp / this.maxHp(o) : 1);
  return o.k === Kind.Armor ? (s * this.maxHp(o)) / (4 + HP_PER_STR * this.str(o)) : s;
}

/**
 * 一行の行き先：
 * 1. 知っている宝の区画（自分たちが見たか、外の世界の地図にあるもの）
 * 2. まだ探していない区画のうち、探した区画に接する所（危ない区画は、一行が十分に強くなければ避ける）
 * 3. どれもなければ、入口から離れる向きのでたらめな所
 */
export function pickTarget(this: Ecology, p: Party, from: Cr): void {
  if (this.aimTarget(p, from)) return;
  // 場所を知らない目標（竜・アンデッド・集落など）は、知っている宝に寄り道せず、奥（深部）へ寄せて探す
  const deep = this.aimDeep(p);
  const m = this.w.map;
  const cw = Math.ceil(m.w / CELL);
  const ch = Math.ceil(m.h / CELL);
  const here = this.cellOf(from.x, from.y);
  const hx = here % cw;
  const hy = Math.floor(here / cw);
  const strength = this.partyStr(p);
  const danger = new Map<number, number>();
  for (const d of p.danger ?? []) danger.set(d[0], Math.max(danger.get(d[0]) ?? 0, d[1]));
  const risky = (cell: number) => (danger.get(cell) ?? 0) > strength * 0.7;
  if (p.goal === 0) {
    // 知っている宝
    let gbest = -1;
    let gd = 1e9;
    if (deep && p.aim !== 1) gd = -1;
    for (const g of p.goldCells ?? []) {
      if ((p.goneGold ?? []).includes(g) || risky(g)) continue;
      const d = Math.abs((g % cw) - hx) + Math.abs(Math.floor(g / cw) - hy);
      if (d < gd) {
        gd = d;
        gbest = g;
      }
    }
    if (gbest >= 0) {
      const k = this.cellFloor(gbest);
      if (k >= 0) {
        p.tx = (k % m.w) * TILE + 8;
        p.ty = Math.floor(k / m.w) * TILE + 8;
        p.targetAt = this.step;
        return;
      }
    }
    // まだ探していない区画
    const ex = new Set(p.explored ?? []);
    let best = -1;
    let bv = -1e9;
    for (let cy = 0; cy < ch; cy++)
      for (let cx = 0; cx < cw; cx++) {
        const cell = cy * cw + cx;
        if (ex.has(cell) || risky(cell)) continue;
        let edge = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (ex.has((cy + dy) * cw + cx + dx) && cx + dx >= 0 && cx + dx < cw) edge = true;
        if (!edge && ex.size) continue;
        const v = -(Math.abs(cx - hx) + Math.abs(cy - hy)) * 3 + (deep ? -(Math.abs(cx * CELL - m.deep.x) + Math.abs(cy * CELL - m.deep.y)) / CELL * 2 : cy * 0.5) + (ih(p.id, cell, 230) % 4);
        if (v <= bv) continue;
        if (this.cellFloor(cell) < 0) continue;
        bv = v;
        best = cell;
      }
    if (best >= 0) {
      const k = this.cellFloor(best);
      p.tx = (k % m.w) * TILE + 8;
      p.ty = Math.floor(k / m.w) * TILE + 8;
      p.targetAt = this.step;
      return;
    }
  }
  this.pickTargetRandom(p, from);
}

export function pickTargetRandom(this: Ecology, p: Party, from: Cr): void {
  const m = this.w.map;
  for (let i = 0; i < 40; i++) {
    const a = (ih(p.id, this.step, 220 + i) % 628) / 100;
    const r = (14 + (ih(p.id, this.step, 240 + i) % 22)) * TILE;
    const x = from.x + Math.cos(a) * r;
    const y = from.y + Math.sin(a) * r;
    const k = this.tileOf(x, y);
    if (k < 0 || m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 40) continue;
    // 入口から離れる向きを好む
    const dEnt = Math.abs(x / TILE - m.entrance.x) + y / TILE;
    const dNow = Math.abs(from.x / TILE - m.entrance.x) + from.y / TILE;
    if (dEnt < dNow - 4 && i < 30) continue;
    p.tx = (k % m.w) * TILE + 8;
    p.ty = Math.floor(k / m.w) * TILE + 8;
    p.targetAt = this.step;
    return;
  }
}

export function adventurer(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Adventurer];
  const m = this.w.map;
  let p = this.parties.find((q) => q.id === c.party);
  if (!p) {
    // 一行を失った（ほかの者が先に外へ出た）：一人の一行として、近い出口から外へ出る
    p = { id: this.nextId++, members: [c.id], goal: 1, tx: 0, ty: 0, since: this.step, tier: 0, initial: 1, saw: 16, targetAt: this.step, waitT: 0, door: -1, mouths: [], explored: [], goldCells: [], goneGold: [], danger: [], fatigue: 0, camp: -1, campUntil: 0, lastCamp: this.step } as Party;
    this.parties.push(p);
    c.party = p.id;
    this.setExit(p);
  }
  // 松明が燃え尽きたら、燃えさしを捨てて予備に火をつける
  if (c.torch > 0) {
    c.torch--;
    if (c.torch === 0) {
      this.dropItem(c.x, c.y, ItemKind.Stub, 0, this.ownerNote(c, 'spent'));
      if (c.ref2 > 0) {
        c.ref2--;
        c.torch = TORCH_FUEL;
      }
    }
  }
  // 職業の技の溜め（src/eco/skill.ts）：構えて動かずに溜め、溜めの途中で打たれると止まる（呪文は散って消える）
  const skill = JOB_SKILL[c.sp] ?? null;
  const sk = skill ? this.skillStep(c, skill) : '';
  if (sk === 'charging') return;
  // 近くのミノタウロスの突進の溜めを見たら、通り道から下がる（戦士と僧侶は受け止めに入る。src/eco/charge.ts）
  if (sk !== 'ready' && this.advBrace(c)) return;
  // 一行の撤退：後衛から先に、退く相手から離れる向きへ下がる。前衛（戦士・僧侶・竜殺し）は少し遅れて、しんがりとして下がり、すぐそばに来た相手とは打ち合う
  if ((p.retreatUntil ?? 0) > this.step && p.retreatX !== undefined && sk !== 'ready') {
    const rear = c.sp === Job.Warrior || c.sp === Job.Priest || c.sp === Job.Slayer;
    const since = this.step - ((p.retreatUntil ?? 0) - RETREAT_N);
    const rx = p.retreatX;
    const ry = p.retreatY ?? c.y;
    if (rear) {
      let near: Cr | null = null;
      this.nearby(c.x, c.y, 1, (o) => {
        if (!near && !o.dead && !o.away && o.foe === c.id && this.w.tick - o.hitAt < 300 && sq(o.x - c.x) + sq(o.y - c.y) < 14 * 14) near = o;
      });
      if (near) {
        this.fight(c, near as Cr);
        return;
      }
    }
    if (!rear || since >= 6) {
      const dx = c.x - rx;
      const dy = c.y - ry;
      const L = Math.sqrt(dx * dx + dy * dy) || 1;
      c.act = 1;
      this.goTo(c, c.x + (dx / L) * 3 * TILE, c.y + (dy / L) * 3 * TILE, s.speed * 1.1);
      if (rear) this.setDir(c, rx - c.x, ry - c.y);
      return;
    }
    c.act = 0;
    this.setDir(c, rx - c.x, ry - c.y);
    return;
  }
  if (sk === 'broken') {
    if (c.sp === Job.Wizard) this.fxAttacks.push({ t: this.w.tick, style: 'puff', col: 2, size: 0, ax: c.x, ay: c.y, dx: c.x, dy: c.y - 14, did: -1, aid: c.id, big: false, kill: false });
    return;
  }
  const ready = sk === 'ready';
  if (!ready && c.act === 2 && c.actT < 4) return;
  const lights = this.partyLights(p);
  const leader = this.byId.get(p.members[0]);
  // 探した範囲と、見かけた宝と、地表への別の横穴を覚える
  if (this.step % 20 === c.id % 20) {
    for (let i = 0; i < m.mouths.length; i++) {
      if (m.mouths[i].kind !== 0 || !this.mouthOpen(i) || (p.mouths ??= []).includes(i)) continue;
      const [mx, my] = this.mouthSpot(i);
      if (sq(mx - c.x) + sq(my - c.y) < 6 * TILE * 6 * TILE) p.mouths.push(i);
    }
    const cell = this.cellOf(c.x, c.y);
    if (!(p.explored ??= []).includes(cell)) p.explored.push(cell);
    for (const pl of this.piles) {
      if (sq(pl.x - c.x) + sq(pl.y - c.y) > 6 * TILE * 6 * TILE) continue;
      const gc = this.cellOf(pl.x, pl.y);
      if (!(p.goldCells ??= []).includes(gc)) p.goldCells.push(gc);
    }
    // 集落のかがり火は遠くから見える。見通しが利けば15マス先の集落を、宝のありそうな所として覚える
    for (const cp of this.camps) {
      if (cp.id < 0 || !(cp.fuel ?? 0)) continue;
      if (sq(cp.x - c.x) + sq(cp.y - c.y) > 15 * TILE * 15 * TILE || !lineOfSight(m, c.x, c.y, cp.x, cp.y)) continue;
      const cc = this.cellOf(cp.x, cp.y);
      if (!(p.goldCells ??= []).includes(cc)) p.goldCells.push(cc);
    }
    // 知っている宝の区画に来たのに宝がなければ、もうないと覚える
    if ((p.goldCells ?? []).includes(cell) && !this.piles.some((pl) => this.cellOf(pl.x, pl.y) === cell) && !(p.goneGold ??= []).includes(cell)) p.goneGold.push(cell);
  }
  // 焚き火で眠っている者（うとうとしている見張りも）は、物を見ず、敵を探さない。起きるのは打たれたか、起こされたか、物音がしたとき（src/eco/night.ts）
  if (c.sleep > 0 && (p.camp ?? -1) >= 0) {
    c.act = 0;
    return;
  }
  // 見たものを噂の種に
  if (this.step % 20 === c.id % 20) {
    this.nearby(c.x, c.y, 6, (o) => {
      if (o.dead || o === c || !this.seenBy(c, lights, o)) return;
      if (o.k === Kind.Zombie || o.k === Kind.Ghost) p.saw |= 2;
      // 噂の魔物：見かけた大物（強さ10以上の魔物。種ごとに覚える。src/eco/quest.ts）
      if (beastSeenKind(o.k)) {
        p.saw |= 4;
        this.partySawBeast(p, o.k, o.x, o.y);
      }
      if (o.k === Kind.Skeleton || o.k === Kind.Lich || o.k === Kind.Armor) p.saw |= 2;
      // 危ない相手：一行より強そうなら区画を覚え、勝てそうになければ引き返す
      if (o.k !== Kind.Adventurer && STR[o.k] >= 6 && TIER[o.k] !== undefined) {
        const os = this.foeStr(o);
        const ps = this.partyStr(p);
        if (os > ps * 0.7) {
          const dc = this.cellOf(o.x, o.y);
          const ex = (p.danger ??= []).find((d) => d[0] === dc);
          if (ex) ex[1] = Math.max(ex[1], Math.round(os));
          else p.danger.push([dc, Math.round(os)]);
          if (p.danger.length > 30) p.danger.shift();
          const slayerHunt = (o.k === Kind.Dragon || o.k === Kind.Wyvern || o.k === Kind.Worm) && p.members.some((id) => this.byId.get(id)?.sp === Job.Slayer);
          // 見て引き返すのは、竜（ドラゴン・ワイバーン・ワーム）だけ。ほかの敵には強さに関わらず挑み、負けそうなら戦いの途中で一行ごと退く（retreat）
          const wyrm = o.k === Kind.Dragon || o.k === Kind.Wyvern || o.k === Kind.Worm;
          if (wyrm && os > ps * 1.2 && !slayerHunt && p.goal === 0) {
            p.goal = 1;
            p.camp = -1;
            this.setExit(p);
            this.log(c.x, c.y, `冒険者の一行が{k:${o.k}}を見て、かなわないと引き返した`);
          }
        }
      }
      if (o.k === Kind.Dragon || o.k === Kind.Wyvern || o.k === Kind.Worm) {
        p.saw |= 8;
        p.dgx = Math.round(o.x);
        p.dgy = Math.round(o.y);
        // 寝床のドラゴンを、見通しの利く所から見た：そこまでの道が分かった（生きて帰れば町に知られる）
        if (o.k === Kind.Dragon && !p.dgId && lineOfSight(m, c.x, c.y, o.x, o.y)) {
          p.dgId = o.id;
          p.dgvx = Math.round(c.x);
          p.dgvy = Math.round(c.y);
        }
      }
    });
  }
  // 戦う：三段階。気づく距離は灯りの届く範囲（5.5マス、光の中に見えている相手）。
  //  雑魚（大ネズミ、コウモリ、アリ、ウィスプ、マイコニド、サラマンダー、トカゲ、クモ、スライム）は、近く（2マス）に来たか、自分に害をなしたときに、通りがかりの一人が払う。
  //  手強い敵は、気づいた者が一行に知らせ、一行が皆で向かう。かなわない相手は避ける（引き返す）。
  //  盗賊はミミックを見破る以外は自分から戦わず、吟遊詩人は戦わない（どちらも襲われれば打ち返す）
  // 身構えて止まる（目標に着いたとき、目標でない住みかのそばを通るとき）。襲われている者は構えずに打ち返す
  if ((p.braceT ?? 0) > this.step && (p.camp ?? -1) < 0 && !(c.foe && this.w.tick - c.hitAt < 150)) {
    c.act = 0;
    const bx = p.braceX ?? c.x;
    const by = p.braceY ?? c.y;
    c.dir = Math.abs(bx - c.x) > Math.abs(by - c.y) ? (bx > c.x ? 2 : 3) : by > c.y ? 0 : 1;
    return;
  }
  const ENEMY = [Kind.Goblin, Kind.Kobold, Kind.Orc, Kind.Lizardman, Kind.Minotaur, Kind.Troll, Kind.Vampire, Kind.Thrall, Kind.Zombie, Kind.Basilisk, Kind.Skeleton, Kind.Lich, Kind.Armor];
  // ウィスプは剣では払えない光なので、雑魚に含めない（誘われても追いかけて迷うだけ。魔法使いは瓶に捕まえる）
  const MINOR = [Kind.Rat, Kind.Bat, Kind.Ant, Kind.Myconid, Kind.Salamander, Kind.Lizard, Kind.Spider, Kind.Slime];
  if (c.sp === Job.Slayer) ENEMY.push(Kind.Dragon, Kind.Wyvern, Kind.Worm);
  let foe: Cr | null = null;
  let bd = 1e18;
  // 一行で向かっている手強い敵がいれば、まずそれ
  if (p.engage) {
    const e = this.byId.get(p.engage);
    const runner = e && ((runsOff(e) && STR[e.k] <= 3) || this.orcYields(p, e)) && !(e.id === c.foe && this.w.tick - c.hitAt < 150);
    if (e && !e.dead && !e.away && !runner && sq(e.x - c.x) + sq(e.y - c.y) < 10 * TILE * 10 * TILE && c.sp !== Job.Bard && c.sp !== Job.Thief) foe = e;
    else if (!e || e.dead || e.away || runner) p.engage = 0;
  }
  // 気づける遠さ（見通しが利くことが条件）：
  //   打ってきた相手は、暗がりでも NOTICE_HIT まで（打たれたら気づく。オークの投げ斧のように、灯りの外から打つ敵がいるので）。
  //   一行の灯りの輪の中か、明るい床にいる相手は NOTICE_LIT まで。暗がりの敵（雑魚は除く）は、すぐそば（NOTICE_DARK。盗賊は夜目が利いて3マス）なら気配で気づく。
  //   （以前は、打たれても相手が暗がりにいれば向き直らなかった。
  //    灯りの中の相手を10マス先まで見えるようにも試したが、16シード×25日で、ヴァンパイアの血吸いが 62→16 回、ゴブリンの夜の盗みが 35→15 回に減ったので、5.5マスのままにした）
  if (!foe)
    this.nearby(c.x, c.y, NOTICE_HIT / TILE + 1, (o) => {
      if (o.dead || o.away) return;
      const attacked = o.id === c.foe && this.w.tick - c.hitAt < 150;
      // 目標でない住民（住処・集落・村・縄張りの者）には、自分たちから戦いを始めない
      // 威嚇して退くオーク（src/eco/orc.ts の orcWary）も追わない
      const enemy = (ENEMY.includes(o.k) && !this.spareResident(p, c, o) && !this.orcYields(p, o)) || (o.k === Kind.Gargoyle && o.act !== 0) || (o.k === Kind.Mimic && c.sp === Job.Thief) || (c.sp === Job.Hunter && p.aim === 3 && !!p.aimK && o.k === p.aimK);
      const minor = MINOR.includes(o.k) && (o.k !== Kind.Bat || o.st === 0 || o.foe === c.id);
      if (!enemy && !minor && !attacked) return;
      if (!attacked && (c.sp === Job.Bard || (c.sp === Job.Thief && o.k !== Kind.Mimic))) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      const near = c.sp === Job.Thief ? 3 * TILE : NOTICE_DARK;
      // （暗がりの気配で気づくのは敵だけ。大ネズミなどの雑魚にまで気づくと、暗がりの雑魚を払う数が増え、大ネズミがはっきり減った）
      // （盗みに忍び寄るゴブリンも、暗がりの気配では気づかれない。見張りが気配で盗人に気づくと、夜の盗みがはっきり減った）
      const sneaking = o.k === Kind.Goblin && o.st >= 15 && o.st <= 18;
      const reach = attacked ? NOTICE_HIT : this.seenBy(c, lights, o) ? NOTICE_LIT : enemy && !sneaking && d < near * near && !this.isHidden(o) ? near : 0;
      if (d >= reach * reach || (d > 2 * TILE * 2 * TILE && !lineOfSight(this.w.map, c.x, c.y, o.x, o.y))) return;
      // 雑魚は、近く（2マス）に来たときか、自分に害をなしたときだけ払う
      if (minor && !enemy && !attacked && o.foe !== c.id && d > 2 * TILE * 2 * TILE) return;
      // 逃げていく弱い者（コボルトなど）は、追いかけて倒しには行かない
      if (!attacked && runsOff(o) && STR[o.k] <= 3 && d > 1.5 * TILE * 1.5 * TILE) return;
      if (d < bd) {
        bd = d;
        foe = o;
      }
    });
  // 手強い敵に気づいたら、一行に知らせる（かなわない相手は、見張りの判断で引き返す）
  // （以前は一行の1.2倍より強い相手には知らせず、皆で向かわなかった。いまは強さに関わらず皆で向かい、負けそうなら退く）
  // 暗がりから血を吸うヴァンパイア（灯りの中に見えていない）には、打たれて気づいても、一行で暗がりへ踏み込まない。
  // 吸われた者はヴァンパイアの方を向いて構え、届く技のある者は撃ち返す（src/eco/vampskill.ts の血吸い。
  // 打たれたら気づくようにしたとき、一行が暗がりへ詰め寄ってヴァンパイアを追い払い、血吸いが16シード×25日で62→13回に減った）
  const darkVamp = !!foe && (foe as Cr).k === Kind.Vampire && !this.seenBy(c, lights, foe as Cr);
  if (foe && !darkVamp && !MINOR.includes((foe as Cr).k) && !p.engage && (p.retreatUntil ?? 0) <= this.step) {
    p.engage = (foe as Cr).id;
    p.engageN = p.members.filter((id) => !this.byId.get(id)?.dead).length;
  }
  // 逃げていく弱い者（コボルトなど）は、すぐそばにいなければ追わない（射かけもしない）
  if (foe && runsOff(foe as Cr) && STR[(foe as Cr).k] <= 3 && sq((foe as Cr).x - c.x) + sq((foe as Cr).y - c.y) > 14 * 14) {
    if (p.engage === (foe as Cr).id) p.engage = 0;
    foe = null;
  }
  if (foe) {
    const f = foe as Cr;
    this.markNotice(c, f, '!');
    c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
    const fd2 = sq(f.x - c.x) + sq(f.y - c.y);
    const reach = JOB_REACH[c.sp] * TILE;
    if (skill) {
      // 職業の技（src/eco/skill.ts）：届く距離に敵がいれば溜め、溜め終わった回に放つ。使ったあとの間は溜め直さない。
      // （以前は、近接の職は体が触れるくらい（1マス弱）でしか打てず、魔法使いは生き物の更新4回ごとに、狩人は3回に1回ほど、溜めなしで撃ち続けていた。
      //  8シード×12日で、近接の一打ちを受ける前に死んだ大物が6割、魔法使いが打たれたのは25時間に1回、狩人は0回）
      if (ready) {
        c.act = 2;
        c.actT = 0;
        // 技を放つと、その場にマナが生まれる（冒険者の活動がダンジョンにマナを持ち込む。src/eco/salamander.ts の deedMana）
        if (!c.away) this.deedMana(c.x, c.y, HERO_SKILL_MANA[c.sp] ?? 2, HERO_SKILL_R);
        // 関係のない小物（大ネズミ・スライムなど）は、狙った相手か自分を襲ってきた相手でなければ巻き込まない（src/eco/attack.ts の advMinorOk）
        const who = (o: Cr) => o.k !== Kind.Adventurer && o.k !== Kind.Dwarf && (o === f || o.foe === c.id || (ENEMY.includes(o.k) && !this.spareResident(p, c, o) && !this.orcYields(p, o)));
        const fl = Math.sqrt(fd2) || 1;
        const ux = (f.x - c.x) / fl;
        const uy = (f.y - c.y) / fl;
        if (c.sp === Job.Warrior) {
          // 剣を振り、斬撃の波を前へ飛ばす（5マスの直線。2体まで貫く）
          this.areaStrike(c, c.x, c.y, ux, uy, { kind: 'line', r: reach, w: 10, max: 2 }, 1.2, { style: 'slashwave', col: 0 }, who);
        } else if (c.sp === Job.Slayer) {
          // 光の大剣の刀身が現れ、5.5マスの扇をゆっくり大きく薙ぎ払う（溜めは長く、一撃は重い）
          this.areaStrike(c, c.x, c.y, ux, uy, { kind: 'fan', r: reach, half: 1.3 }, 2, { style: 'greatsword', col: 1 }, who);
        } else if (c.sp === Job.Priest) {
          // ハンマーを振り下ろし、打った所で光の十字架が爆ぜる（縦横に腕3マス）。打つのは敵の足もと（届く距離より遠ければ、届く距離の先）。
          // アンデッドと夜の眷属には倍効く
          const hd = Math.min(fl, reach);
          const hx = c.x + ux * hd;
          const hy = c.y + uy * hd;
          const holy = (o: Cr) => o.k === Kind.Zombie || o.k === Kind.Skeleton || o.k === Kind.Lich || o.k === Kind.Thrall || o.k === Kind.Vampire || o.k === Kind.Armor;
          const cross = { kind: 'cross' as const, r: 3 * TILE, w: 9 };
          this.fxAttacks.push({ t: this.w.tick, style: 'cross', col: 1, size: 2, ax: c.x, ay: c.y, dx: hx, dy: hy, did: f.id, aid: c.id, big: true, kill: false, rad: cross.r });
          this.areaStrike(c, hx, hy, ux, uy, cross, 1.2, { style: '', col: 1 }, (o) => who(o) && !holy(o));
          this.areaStrike(c, hx, hy, ux, uy, cross, 2.4, { style: '', col: 1 }, (o) => who(o) && holy(o));
        } else if (c.sp === Job.Wizard) {
          // マジックミサイル：紫の魔力の尾を引く誘導弾を4発。狙う敵と、そのほか近くの敵（最大2体）へ分かれて飛び、届いたときに必ず当たる（1発は軽い）
          const tg: Cr[] = [f];
          this.nearby(c.x, c.y, Math.ceil(JOB_REACH[c.sp]), (o) => {
            if (tg.length >= 3 || o === f || o.dead || o.away || !who(o) || sq(o.x - c.x) + sq(o.y - c.y) > reach * reach || !this.seenBy(c, lights, o)) return;
            tg.push(o);
          });
          for (let i = 0; i < 4; i++) {
            const t = tg[i % tg.length];
            const fly = Math.round(6 + Math.sqrt(sq(t.x - c.x) + sq(t.y - c.y)) / 20);
            this.queueVolley(c, { d: t.id, x: 0, y: 0, r: 0, mul: 0.5, poison: 0 }, fly);
            this.fxAttacks.push({ t: this.w.tick, style: 'missile', col: 4, size: 1, ax: c.x, ay: c.y, dx: t.x, dy: t.y, did: t.id, aid: c.id, big: false, kill: false, n: i, fly });
          }
        } else if (c.sp === Job.Hunter) {
          // 矢の雨：弧を描いて高く上がった矢が、狙った所のまわりに少しばらけて降る（1.3マス）。落ちたときにそこにいる者に当たり（動いていれば避けられる）、
          // 当たった所で毒の煙が爆ぜて毒にする
          const fly = 12;
          this.queueVolley(c, { d: -1, x: f.x, y: f.y, r: 1.3 * TILE, mul: 1.2, poison: 25, tgt: f.id }, fly);
          this.fxAttacks.push({ t: this.w.tick, style: 'rain', col: 3, size: 1, ax: c.x, ay: c.y, dx: f.x, dy: f.y, did: -1, aid: c.id, big: false, kill: false, rad: 1.3 * TILE, n: 6, fly });
        } else if (fd2 <= sq(reach * 1.2)) {
          // 盗賊の短剣投げ。構えているあいだに届く距離の外へ出られたら外れる
          if (this.strike(c, f, 1)) this.die(f, 'fight', c.k);
        }
        return;
      }
      if (fd2 <= reach * reach && this.skillCanStart(c, skill)) {
        this.skillStart(c, skill);
        return;
      }
    }
    if (c.sp === Job.Wizard || c.sp === Job.Hunter) {
      // 離れて撃つ者が、使ったあとの間を待つあいだ：敵が近ければ（2.5マス）離れ、遠ければその場で構える
      if (fd2 < 2.5 * TILE * 2.5 * TILE) {
        c.act = 1;
        this.fleeFrom(c, f, s.speed);
        this.setDir(c, f.x - c.x, f.y - c.y);
      } else c.act = 0;
      return;
    }
    if (sq(f.x - c.x) + sq(f.y - c.y) < 14 * 14) {
      this.fight(c, f);
      return;
    }
    if (darkVamp) {
      c.act = 0;
      return;
    }
    c.act = 1;
    this.goTo(c, f.x, f.y, s.speed);
    return;
  }
  // 見えない所の物音に耳を澄ましている（src/eco/listen.ts）：音の方を向いて止まり、前衛が前に出て構える
  if (this.listening(c, p)) return;
  // 害のない相手への、職業ごとの関わり方（気づいたら「？」）
  if (this.advInteract(c, p, lights)) return;
  // 金貨を拾う：見えている山（行きだけ）
  if (p.goal === 0 && c.gold < GOLD_CAP[c.sp]) {
    let pile: Pile | null = null;
    let pd = 7 * TILE * 7 * TILE;
    for (const o of this.piles) {
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d >= pd) continue;
      const k = this.tileOf(o.x, o.y);
      let vis = c.sp === Job.Thief && d < 4 * TILE * 4 * TILE;
      for (const l of lights) if (sq(o.x - l.x) + sq(o.y - l.y) < 5.5 * TILE * 5.5 * TILE) vis = true;
      if (!vis && !(k >= 0 && this.lit(k, day) > 0.35)) continue;
      pd = d;
      pile = o;
    }
    if (pile) {
      const pl = pile as Pile;
      p.saw |= 1;
      c.act = 1;
      if (sq(pl.x - c.x) + sq(pl.y - c.y) < 12 * 12) {
        const t = Math.min(pl.gold, GOLD_CAP[c.sp] - c.gold);
        pl.gold -= t;
        c.gold += t;
        // ドワーフの広間の宝の山なら、ドワーフに盗みが知れる
        if (this.hold && sq(pl.x - ((this.hold.hk % m.w) * TILE + 8)) + sq(pl.y - (Math.floor(this.hold.hk / m.w) * TILE + 8)) < 5 * TILE * 5 * TILE) {
          this.alarms.set('d', { t: this.step, foe: c.id, x: Math.round(pl.x), y: Math.round(pl.y) });
          if (this.step - (this.lastLogged[999] ?? -99999) > 1500) {
            this.lastLogged[999] = this.step;
            this.log(c.x, c.y, `冒険者が{k:${Kind.Dwarf}}の広間の宝を盗み、ドワーフが気づいた`);
          }
        }
        c.act = 2;
        c.actT = 0;
        this.piles = this.piles.filter((o) => o.gold > 0);
      } else this.goTo(c, pl.x, pl.y, s.speed);
      return;
    }
  }
  // 焚き火を囲んで休む：焚き火のまわりに座り、僧侶が皆を癒やす。見張りは外を向く
  if ((p.camp ?? -1) >= 0) {
    const fx = ((p.camp as number) % m.w) * TILE + 8;
    const fy = Math.floor((p.camp as number) / m.w) * TILE + 8;
    const idx = p.members.indexOf(c.id);
    let a = (idx / Math.max(1, p.members.length)) * 6.283;
    let sx = fx + Math.cos(a) * 14;
    let sy = fy + Math.sin(a) * 10;
    // 席が壁の中や溶岩の上なら、焚き火のまわりを少しずつ回って、座れる床を探す（壁際の焚き火では席の半分が壁にかかる）。
    // どこにも座れる床がなければ、焚き火のマスのそばに座る
    if (!this.campSeatOk(c, p.camp as number, sx, sy)) {
      let found = false;
      for (let j = 1; j < 24 && !found; j++) {
        const a2 = a + (j & 1 ? 1 : -1) * Math.ceil(j / 2) * 0.524;
        for (const r of [1, 0.6]) {
          const x2 = fx + Math.cos(a2) * 14 * r;
          const y2 = fy + Math.sin(a2) * 10 * r;
          if (this.campSeatOk(c, p.camp as number, x2, y2)) {
            a = a2;
            sx = x2;
            sy = y2;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        sx = fx + (idx % 3) - 1;
        sy = fy + 5;
      }
    }
    c.hx = fx;
    c.hy = fy;
    const d2 = sq(sx - c.x) + sq(sy - c.y);
    if (d2 > 8 * 8) {
      c.act = 1;
      const d0 = Math.sqrt(d2);
      this.goTo(c, sx, sy, s.speed);
      // 席のそば（1.5マスの内）まで来て、眠る仲間や壁の角に阻まれてほとんど近づけなければ、その場に座る
      // （以前は席へ入れないまま、眠る仲間の脇で歩く姿のまま押し返され続け、seed27 では2分近く足踏みしていた）
      if (!(d0 < 24 && d0 - Math.hypot(sx - c.x, sy - c.y) < 0.2)) return;
    }
    c.act = 0;
    const watch = idx === 0;
    // 起こされて構えている間は、気づいた敵のいた方を向く
    if (this.campAwake(p) && (p.wakeX || p.wakeY)) c.dir = Math.abs((p.wakeX ?? 0) - c.x) > Math.abs((p.wakeY ?? 0) - c.y) ? ((p.wakeX ?? 0) > c.x ? 2 : 3) : (p.wakeY ?? 0) > c.y ? 0 : 1;
    else c.dir = watch ? (Math.cos(a) > 0 ? 2 : 3) : Math.abs(fx - c.x) > Math.abs(fy - c.y) ? (fx > c.x ? 2 : 3) : fy > c.y ? 0 : 1;
    // 僧侶は、傷ついた者がいる間だけ起きていて、生き物の更新15回に1回ずつ癒やす（皆が治ったら、僧侶も眠る。syncLongSleep）
    if (c.sp === Job.Priest && this.step % 15 === c.id % 15 && this.campWounded(p)) {
      for (const id of p.members) {
        const o = this.byId.get(id);
        if (o && !o.dead && sq(o.x - fx) + sq(o.y - fy) < 40 * 40) o.hp = Math.min(this.maxHp(o), (o.hp > 0 ? o.hp : this.maxHp(o)) + this.maxHp(o) / 20);
      }
      c.act = 2;
      c.actT = 0;
    }
    return;
  }
  // 引き返す一行は入口から外へ
  if (p.goal === 1 && ((Math.floor(c.y / TILE) <= 1 && Math.abs(Math.floor(c.x / TILE) - m.entrance.x) <= 2) || (p.tx !== m.entrance.x * TILE + 8 && sq(p.tx - c.x) + sq(p.ty - c.y) < 20 * 20))) {
    this.leaveDungeon(c, p);
    return;
  }
  // 進む：先頭は行き先へ、ほかは先頭について行く
  if (!leader || leader === c) {
    if (p.goal === 0 && (p.targetAt === 0 || this.step - p.targetAt > 900 || sq(p.tx - c.x) + sq(p.ty - c.y) < 20 * 20)) this.pickTarget(p, c);
    c.act = 1;
    // 光の外へは急がない（一行がそろうのを待つ）
    let far = false;
    for (const id of p.members) {
      const o = this.byId.get(id);
      if (o && !o.dead && sq(o.x - c.x) + sq(o.y - c.y) > 70 * 70) far = true;
    }
    if (far && p.waitT < 120) {
      p.waitT++;
      c.act = 0;
      return;
    }
    if (!far) p.waitT = 0;
    this.goTo(c, p.tx, p.ty, s.speed * 0.8);
    return;
  }
  const idx = p.members.indexOf(c.id);
  // 先頭の後ろに、少し間をあけて並ぶ
  let ox = [0, -14, 14, -8, 8][idx % 5];
  let oy = -[0, 10, 10, 22, 22][idx % 5];
  // 並ぶ位置が壁の中なら、左右を入れ替えた位置、先頭に寄せた位置、先頭の真後ろの順に、立てる床で先頭と歩いてつながる所にする
  // （以前は先頭が壁ぎわを歩くと並ぶ位置が壁の中に入り、そこへまっすぐ向かって壁に押しつけたまま足踏みしていた。1回5〜7秒、1日に800回ほど）
  {
    const lk = this.tileOf(leader.x, leader.y);
    const ok = (dx: number, dy: number) => {
      const k = this.tileOf(leader.x + dx, leader.y + dy);
      return k >= 0 && lk >= 0 && this.tilePassable(c, k) && this.regionOf(k) === this.regionOf(lk);
    };
    for (const [dx, dy] of [[ox, oy], [-ox, oy], [ox / 2, oy / 2], [0, oy / 2], [0, 0]]) {
      if (!ok(dx, dy)) continue;
      ox = dx;
      oy = dy;
      break;
    }
  }
  if (sq(leader.x + ox - c.x) + sq(leader.y + oy - c.y) > 22 * 22) {
    c.act = 1;
    this.goTo(c, leader.x + ox, leader.y + oy, s.speed);
  } else {
    c.act = leader.act === 1 ? 1 : 0;
    c.dir = leader.dir;
    if (leader.act === 1) this.moveToward(c, leader.x + ox, leader.y + oy, s.speed * 0.8);
  }
}

/** 引き返す先：正面の入口か、入ってきた口か、見つけた地表の横穴のうち、先頭にいちばん近いもの */
export function setExit(this: Ecology, p: Party): void {
  const m = this.w.map;
  const lead = this.byId.get(p.members[0]);
  const cands: [number, number][] = [[m.entrance.x * TILE + 8, TILE + 8]];
  for (const i of new Set([...(p.mouths ?? []), ...(p.door !== undefined && p.door >= 0 ? [p.door] : [])])) if (this.mouthOpen(i)) cands.push(this.mouthSpot(i));
  let best = cands[0];
  if (lead) {
    let bd = 1e18;
    for (const c of cands) {
      const d = sq(c[0] - lead.x) + sq(c[1] - lead.y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
  }
  p.tx = best[0];
  p.ty = best[1];
}

/** 焚き火の場所：近くの、壁に囲まれた所（袋小路や角）。水辺なら少し好む */
export function startCamp(this: Ecology, p: Party, leader: Cr, near?: { x: number; y: number }): void {
  const m = this.w.map;
  const hx = Math.floor((near ?? leader).x / TILE);
  const hy = Math.floor((near ?? leader).y / TILE);
  const R = near ? 2 : 8;
  let best = -1;
  let bv = -1e9;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const x = hx + dx;
      const y = hy + dy;
      if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.burn[k]) continue;
      // 置き場のそばで休むときは、木箱のマスそのものには焚き火を置かない
      if (near && k === this.tileOf(near.x, near.y)) continue;
      let walls = 0;
      let water = 0;
      for (let yy = -1; yy <= 1; yy++)
        for (let xx = -1; xx <= 1; xx++) {
          const q = k + yy * m.w + xx;
          if (m.solid[q]) walls++;
          if (this.w.water[q] > 20) water = 1;
        }
      if (walls > 5) continue;
      const v = walls * 3 + water * 4 - (Math.abs(dx) + Math.abs(dy)) * 0.5;
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
  if (best < 0) return;
  p.camp = best;
  p.campAt = this.step;
  // 夜は長めに休む（ゲーム内の夜のあいだ焚き火を囲む）
  p.campUntil = this.step + (this.isNight() ? 2400 : 1500);
  p.dozeT = 0;
  p.dozeNext = 0;
}

/** 焚き火を囲む一行に、焚き火のそば（僧侶が癒やせる所）で傷ついている者がいるか（僧侶が起きて手当てを続けるか） */
export function campWounded(this: Ecology, p: Party): boolean {
  const k = p.camp ?? -1;
  if (k < 0) return false;
  const fx = (k % this.w.map.w) * TILE + 8;
  const fy = Math.floor(k / this.w.map.w) * TILE + 8;
  for (const id of p.members) {
    const o = this.byId.get(id);
    if (o && !o.dead && o.hp > 0 && o.hp < this.maxHp(o) && sq(o.x - fx) + sq(o.y - fy) < 40 * 40) return true;
  }
  return false;
}

/** 焚き火のまわりの席 (x, y) に座れるか：立てる床で、焚き火のマスか、その隣のマス（壁を隔てた向こうではない） */
export function campSeatOk(this: Ecology, c: Cr, fire: number, x: number, y: number): boolean {
  const k = this.tileOf(x, y);
  if (k < 0 || !this.tilePassable(c, k)) return false;
  const m = this.w.map;
  const dx = (k % m.w) - (fire % m.w);
  const dy = Math.floor(k / m.w) - Math.floor(fire / m.w);
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;
  // 斜めの隣は、間の二つのマスの少なくとも一つが床でないと、角をはさんで向こう側になる
  if (dx !== 0 && dy !== 0 && m.solid[fire + dx] && m.solid[fire + dy * m.w]) return false;
  return true;
}

export function endCamp(this: Ecology, p: Party): void {
  const k = p.camp ?? -1;
  // 焚き火の跡に灰が残る。食べ残しも少し落ちる
  if (k >= 0) {
    this.w.ash[k] = Math.max(this.w.ash[k], 200);
    this.dropScraps(p, (k % this.w.map.w) * TILE + 8, Math.floor(k / this.w.map.w) * TILE + 8, 3);
  }
  p.camp = -1;
  p.fatigue = 0;
  p.stoned = 0;
  p.lastCamp = this.step;
}

/** 冒険者の食べ残し：一行の食料から少しずつ、その場所のまわりの土に落とす（キノコが生えやすくなる） */
export function dropScraps(this: Ecology, p: Party, x: number, y: number, per: number): void {
  for (const id of p.members) {
    const o = this.byId.get(id);
    if (!o || o.dead || o.food < per + 10) continue;
    o.food -= per;
    this.deposit(x + ((id % 5) - 2) * 6, y + ((id % 3) - 1) * 6, per);
  }
}

/** 入口から外へ出ていく：持ち出した金貨と養分を保存則の収支に計上し、見たものを噂に */
export function leaveDungeon(this: Ecology, c: Cr, p: Party): void {
  if (c.food > 12) {
    c.food -= 2;
    this.deposit(c.x, c.y + 10, 2);
  }
  this.record('exits', { t: this.w.tick, k: c.k, reason: 'returned', x: Math.round(c.x), y: Math.round(c.y) } as never);
  this.heroHome(c, true);
  this.w.manaLeaked += c.mana;
  c.mana = 0;
  // 生きて帰った者が、探した範囲と宝と危ない場所を、外の世界の地図に加える
  const lo = this.lore;
  for (const i of p.mouths ?? []) if (!(lo.mouths ??= []).includes(i)) lo.mouths.push(i);
  for (const e of p.explored ?? []) if (!lo.explored.includes(e)) lo.explored.push(e);
  for (const g of p.goldCells ?? []) if (!lo.gold.includes(g) && !(p.goneGold ?? []).includes(g)) lo.gold.push(g);
  lo.gold = lo.gold.filter((g) => !(p.goneGold ?? []).includes(g));
  for (const d of p.danger ?? []) {
    const ex = lo.danger.find((e) => e[0] === d[0]);
    if (ex) {
      ex[1] = d[1];
      ex[2] = this.w.tick;
    } else lo.danger.push([d[0], d[1], this.w.tick]);
  }
  lo.danger = lo.danger.filter((d) => this.w.tick - d[2] < DAY_TICKS_ECO * 3).slice(-60);
  p.saw |= 16;
  // 背負ってきた置き場の荷が残っていれば、それも持ち帰る
  this.exported += c.body + c.food + c.units;
  c.units = 0;
  this.goldOut += c.gold;
  this.tellCaches(p);
  this.bringTrophy(c, p);
  // 生きて帰った者が噂を持ち帰る
  const r = this.rumors;
  // 吟遊詩人が生きて帰れば噂は何倍にも広まり、吟遊詩人を失った一行の噂は細る
  let bard = 1;
  for (const id of p.members) {
    const o = this.byId.get(id);
    if (o && !o.dead && o.sp === Job.Bard) bard = 3;
  }
  if (c.sp === Job.Bard) bard = 3;
  const mul = bard;
  if (c.gold > 0 || p.saw & 1) r.gold += (0.15 + c.gold / 150) * mul;
  if (p.saw & 2) r.undead += 0.2 * mul;
  // 見かけた大物と、受けた被害（石化・死者）は、種ごとの魔物の噂になる（src/eco/quest.ts）
  this.carryBeastRumors(p, mul);
  if (p.saw & 8) {
    r.dragon += 0.25 * mul;
    if (p.dgx || p.dgy) {
      r.dragonX = p.dgx ?? 0;
      r.dragonY = p.dgy ?? 0;
    }
  }
  // 竜の寝床への道（見通しの利く所から寝床のドラゴンを見た一行が持ち帰る）
  if (p.dgId && !(lo.dragonWay && lo.dragonWay[2] === p.dgId)) {
    lo.dragonWay = [p.dgvx ?? 0, p.dgvy ?? 0, p.dgId, this.w.tick];
    this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'way', n: p.dgId, x: p.dgvx ?? 0, y: p.dgvy ?? 0 } as never);
    this.log(c.x, c.y, `生きて帰った冒険者が、深部の{k:${Kind.Dragon}}の寝床への道を町に伝えた`);
  }
  // ゴブリンに荷物を盗まれた話（溜まると、ゴブリン退治の一行が来る）
  if (p.robbed) {
    r.goblin += 0.12 * Math.min(3, p.robbed) * mul;
    r.goblinX = p.robX ?? 0;
    r.goblinY = p.robY ?? 0;
    // 盗まれた回数と、盗みを働いた集落（一行で一度だけ伝える）。2回でゴブリン退治の一行が来る
    if (!p.robTold) {
      p.robTold = 1;
      r.goblinRobs += p.robbed;
      if (p.robCamp) {
        r.goblinCamp = p.robCamp;
        r.goblinCampX = p.robCX ?? 0;
        r.goblinCampY = p.robCY ?? 0;
      }
    }
  }
  c.body = 0;
  c.food = 0;
  c.gold = 0;
  c.dead = 2;
  this.returned++;
  // 最後の一人が帰ったところで：依頼を果たした一行ならその噂を鎮め、町の掲示を作り直す（src/eco/quest.ts）。
  // （帰る者が一人ずつ噂を足すので、最初の一人で鎮めると残りの仲間が足し直し、果たした152の一行のうち44で、帰る途中に同じ依頼がまた出ていた。
  //  次の一行の更新で鎮めると、それまでの間に次の一行が、果たしたばかりの依頼を引けた）
  if (!p.members.some((id) => { const o = this.byId.get(id); return !!o && !o.dead; })) {
    this.calmQuest(p);
    this.syncQuests();
  }
}

/** 倒れた者の持ち物を床に落とす（冒険者の道具） */
export function dropBelongings(this: Ecology, c: Cr): void {
  const n = c.k === Kind.Goblin || c.k === Kind.Orc || c.k === Kind.Adventurer ? this.ownerNote(c, 'fell') : undefined;
  if (c.k === Kind.Armor) {
    this.scatterArmor(c);
    return;
  }
  // ドワーフの戦士と鍛冶屋は、手の武器（床の道具では鎚矛として扱う）を落とし、戦士は盾も落とす。坑夫のつるはしは武器ではないので落とさない。
  // 冒険者と同じく、持ち主の未練としてマナが宿る（新しいマナの湧き口。リビングアーマーの材料になる。src/eco/armor.ts）
  if (c.k === Kind.Dwarf) {
    const kinds = c.sp === 2 ? [ItemKind.Mace, ItemKind.Shield] : c.sp === 1 ? [ItemKind.Mace] : [];
    kinds.forEach((kd, i) => {
      this.w.manaBorn += ARMOR_REMNANT;
      this.dropItem(c.x + 3 - i * 7, c.y + 2 - i * 2, kd, ARMOR_REMNANT, this.ownerNote(c, 'fell'));
    });
    return;
  }
  // （冒険者のほかの人型の骨（sp = BONE_SP + 生前の種）は、職業の道具を持たない。src/eco/undead.ts の raiseBones）
  if (c.k === Kind.Skeleton && c.init && c.sp < BONE_SP) {
    this.dropJobItems(c);
    c.init = 0;
    return;
  }
  if (c.k === Kind.Goblin || c.k === Kind.Orc) {
    // 拾って持っていた武器には、拾い物の未練（冒険者の半分）が宿る（src/eco/armor.ts）
    if (c.party) {
      const rem = isJobItem(c.party) ? ARMOR_REMNANT_KIN : 0;
      this.w.manaBorn += rem;
      this.dropItem(c.x, c.y, c.party, rem, n);
    }
    if (c.torch > 0) this.dropItem(c.x + 3, c.y, ItemKind.Torch, c.torch, n);
    else if (c.torch < 0) this.dropItem(c.x + 3, c.y, ItemKind.Stub, 0, n);
    c.party = 0;
    c.torch = 0;
    return;
  }
  if (c.k !== Kind.Adventurer) return;
  this.fallen++;
  const x = c.x;
  const y = c.y;
  if (c.torch > 0) this.dropItem(x + 4, y + 2, ItemKind.Torch, c.torch, n);
  c.torch = 0;
  this.dropJobItems(c);
  // 背負っていた荷（背負い袋と寝具）も、倒れた所に残る
  this.dropItem(x - 6, y - 3, ItemKind.Pack, 0, n);
  c.party = 0;
}

export function dropJobItems(this: Ecology, c: Cr): void {
  const n = this.ownerNote(c, 'fell');
  // 倒れた冒険者の道具には、持ち主の未練としてマナが宿る（新しいマナの湧き口。スケルトンが落とし直す物には宿らない。src/eco/armor.ts）
  const rem = c.k === Kind.Adventurer ? ARMOR_REMNANT : 0;
  Ecology.JOB_ITEMS[c.sp].forEach((kd, i) => {
    this.w.manaBorn += rem;
    this.dropItem(c.x - 4 + i * 7, c.y + 3 - i * 2, kd, rem, n);
  });
}

/** 床に道具を置く。n は情報パネルに出すいきさつ（落とした者など。判断には使わない） */
export function dropItem(this: Ecology, x: number, y: number, kind: number, fuel: number, n?: Note): void {
  const id = this.nextId++;
  this.gear.push({ id, x: Math.round(x), y: Math.round(y), kind, fuel });
  if (n) this.note(id, n);
  // 古い燃えさしから片づける（道具が増えすぎないように）
  if (this.gear.length > 160) {
    const i = this.gear.findIndex((o) => o.kind === ItemKind.Stub);
    const [gone] = this.gear.splice(i >= 0 ? i : 0, 1);
    // 片づけた武具に宿っていた未練は、薄れて消えたことにする（マナの保存則）
    if (isJobItem(gone.kind) && gone.fuel > 0) this.w.manaFaded += gone.fuel;
  }
}

/** 床に落ちた松明は燃え続け、燃え尽きると燃えさしになる */
export function updateItems(this: Ecology): void {
  for (const it of this.gear) {
    if (it.kind !== ItemKind.Torch) {
      this.fadeRemnant(it);
      continue;
    }
    it.fuel--;
    if (it.fuel <= 0) it.kind = ItemKind.Stub;
  }
}

/**
 * 光を出しうる種（ゴブリン・リッチ・ウィスプ・マイコニド・スライム・ゴースト・ドワーフ・冒険者）と、光る格（elite が 1・2・6・7・9）。
 * 生き物の光（crLights）が光を出すのは、このどちらかに当たる者だけ。eachLight はそれ以外の者を先に飛ばす（速さのため）。
 * crLights に光る種や格を足したら、ここにも足す（test/determinism.ts が、すべての種と格で食い違いがないかを確かめる）
 */
export const LIGHT_KIND: boolean[] = [];
for (const k of [Kind.Goblin, Kind.Lich, Kind.Wisp, Kind.Myconid, Kind.Slime, Kind.Ghost, Kind.Dwarf, Kind.Adventurer]) LIGHT_KIND[k] = true;
export const LIGHT_ELITE: boolean[] = [];
for (const e of [1, 2, 6, 7, 9]) LIGHT_ELITE[e] = true;

type LightFn = (x: number, y: number, r: number, i: number, cr: number, cg: number, cb: number) => void;

/** 生きている者 c が出す光（松明、光の呪文、もともと光る種）を、fn に順に渡す */
export function crLights(c: Cr, fn: LightFn): void {
  if (c.k === Kind.Goblin && c.torch > 0) fn(c.x, c.y - 12, 80, 1.0, 1.0, 0.6, 0.28);
  if (c.k === Kind.Lich) fn(c.x, c.y - 16, 56, 0.6, 0.7, 0.45, 1.0);
  // もともと光る種：自分のまわり2〜3マスを、本当に照らす
  if (c.elite === 1) fn(c.x, c.y - 12, 64, 0.8, 1.0, 0.55, 0.22);
  else if (c.elite === 2) fn(c.x, c.y - 14, 40, 0.4, 0.6, 0.8, 1.0);
  else if (c.elite === 6) fn(c.x, c.y - 10, 44, 0.4, 0.5, 0.8, 1.0);
  else if (c.elite === 7) fn(c.x, c.y - 12, 72, 0.7, 1.0, 0.95, 0.8);
  else if (c.elite === 9) fn(c.x, c.y - 14, 52, 0.45, 0.6, 1.0, 0.55);
  else if (c.k === Kind.Wisp) fn(c.x, c.y - 10, 40, 0.55, 0.55, 1.0, 0.8);
  else if (c.k === Kind.Myconid) fn(c.x, c.y - 8, 36, 0.45, 0.7, 1.0, 0.6);
  else if (c.k === Kind.Slime) fn(c.x, c.y - 4, 30, 0.4, 0.55, 1.0, 0.5);
  else if (c.k === Kind.Ghost) fn(c.x, c.y - 12, 44, 0.5, 0.7, 0.85, 1.0);
  if (c.k === Kind.Dwarf && c.sp === 0) fn(c.x, c.y - 10, 52, 0.75, 1.0, 0.82, 0.5);
  if (c.k !== Kind.Adventurer) return;
  if (c.torch > 0) fn(c.x, c.y - 14, 92, 1.1, 1.0, 0.62, 0.3);
  else if (c.sp === Job.Wizard) fn(c.x, c.y - 18, 80, 0.9, 0.72, 0.86, 1.0);
}

/**
 * 光源（生き物の光、鍛冶場の火、坑道のランプ、冒険者の焚き火、床で燃える松明）を順に fn に渡す。描画と明るさのマップに使う。
 * lightSources と同じ順・同じ値で、配列や物を作らない
 */
export function eachLight(this: Ecology, fn: LightFn): void {
  for (const c of this.list) {
    if (c.dead) continue;
    if (!LIGHT_KIND[c.k] && !LIGHT_ELITE[c.elite]) continue;
    crLights(c, fn);
  }
  // 鍛冶場の火と坑道のランプ、冒険者の焚き火
  const mw = this.w.map.w;
  for (const cp of this.camps) if (cp.id >= 0 && (cp.fuel ?? 0) > 0) fn(cp.x, cp.y + 6, 140, 1.25, 1.0, 0.58, 0.26);
  // 冒険者の焚き火は、休みの最後の3分の1で細って、光の輪が小さく暗くなる（src/eco/night.ts の campFire）
  for (const p of this.parties) {
    if ((p.camp ?? -1) < 0) continue;
    const f = this.campFire(p);
    fn(((p.camp as number) % mw) * TILE + 8, Math.floor((p.camp as number) / mw) * TILE + 4, 120 * Math.max(0.55, f), 1.25 * (0.6 + 0.4 * f), 1.0, 0.6, 0.28);
  }
  if (this.hold && this.hold.forge >= 0) fn((this.hold.forge % mw) * TILE + 8, Math.floor(this.hold.forge / mw) * TILE + 2, 130, 1.3, 1.0, 0.55, 0.22);
  for (const k of this.lamps) fn((k % mw) * TILE + 8, Math.floor(k / mw) * TILE + 2, 64, 0.8, 1.0, 0.85, 0.55);
  for (const it of this.gear) if (it.kind === ItemKind.Torch) fn(it.x, it.y - 4, 52, 0.7, 1.0, 0.6, 0.28);
}

export function lightSources(this: Ecology): { x: number; y: number; r: number; i: number; c: [number, number, number] }[] {
  const out: { x: number; y: number; r: number; i: number; c: [number, number, number] }[] = [];
  this.eachLight((x, y, r, i, cr, cg, cb) => out.push({ x, y, r, i, c: [cr, cg, cb] }));
  return out;
}

declare module '../ecology' {
  interface Ecology {
    reputation: typeof reputation;
    maybeParty: typeof maybeParty;
    partyLights: typeof partyLights;
    seenBy: typeof seenBy;
    updateParties: typeof updateParties;
    cellOf: typeof cellOf;
    cellFloor: typeof cellFloor;
    partyStr: typeof partyStr;
    foeStr: typeof foeStr;
    pickTarget: typeof pickTarget;
    pickTargetRandom: typeof pickTargetRandom;
    adventurer: typeof adventurer;
    setExit: typeof setExit;
    startCamp: typeof startCamp;
    endCamp: typeof endCamp;
    campSeatOk: typeof campSeatOk;
    campWounded: typeof campWounded;
    dropScraps: typeof dropScraps;
    leaveDungeon: typeof leaveDungeon;
    dropBelongings: typeof dropBelongings;
    dropJobItems: typeof dropJobItems;
    dropItem: typeof dropItem;
    updateItems: typeof updateItems;
    eachLight: typeof eachLight;
    lightSources: typeof lightSources;
  }
}

Object.assign(Ecology.prototype, { reputation, maybeParty, partyLights, seenBy, updateParties, cellOf, cellFloor, partyStr, foeStr, pickTarget, pickTargetRandom, adventurer, setExit, startCamp, endCamp, campSeatOk, campWounded, dropScraps, leaveDungeon, dropBelongings, dropJobItems, dropItem, updateItems, eachLight, lightSources });
