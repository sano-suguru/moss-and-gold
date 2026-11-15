/**
 * Ecology のメソッド：コボルトとゴブリンの戦。
 *
 * 見せたい場面：蓄えの乏しい大きな群れが住みかの前に集まり、一団になって隣の小さな群れの住みかへ攻めに行く。
 * 守る側は迎え撃つか（攻め手がずっと強ければ）隠れる。攻め手は仲間の4割を失えば逃げ帰り、
 * 相手の住みかに着けば蓄えを袋に詰めて、荷を担いで引き上げる。
 *
 * ふだんの境の小競り合いは総力戦にしない（heedAlarm は、相手の種には打たれた者のすぐそばの仲間だけが加勢する）。
 * 群れごとぶつかるのは、ここで始まる戦のときだけ。
 *
 * 戦の段階（War.ph）：0 集まる、1 攻めに向かう・戦う、2 引き上げる。終わり方（War.end）：0 まだ、1 蓄えを奪った、2 押し返されて退いた、3 やめて引き返した（着いたら蓄えが尽きていたときも）。
 */
import { type Camp, type Cr, DAY_TICKS_ECO, Ecology, Kind, SPEC, STR, type Warren, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 攻めに出る蓄えの乏しさ（蓄えの目安に対する割合） */
const WAR_STORE = 0.5;
/** 攻めに出る数の差（動ける者の数が、相手の動ける者の何倍以上か）と、攻めに出る群れの動ける者の最少の数 */
const WAR_RATIO = 1.25;
const WAR_MIN = 4;
/** 攻めに行く遠さ（歩いてのマス数） */
const WAR_R = 60;
/** 攻めに出る割合（動ける者のうち） */
const WAR_SEND = 0.7;
/** 退く損害（攻めに出た数に対する割合） */
const WAR_LOSS = 0.4;
/** 同じ住みかが次の戦に加わるまでの間（tick） */
const WAR_COOL = 3 * DAY_TICKS_ECO;
/** 集まるのを待つ長さと、攻めに向かう長さの上限（生き物の更新の回数） */
const GATHER_STEPS = 300;
const MARCH_STEPS = 1500;
/** 冒険者の一行がこの距離（マス）の内にいる住みかは、攻めに出ず、攻められもしない */
const PARTY_R = 20;
/** 袋に詰める量の上限（一匹あたり） */
const LOOT_CAP = 20;
/** 攻める相手の住みかに要る蓄え（奪う物の無い住みかは狙わない） */
const LOOT_MIN = 30;
/** 行進で、仲間の真ん中より先に行きすぎたら待つ距離（マス） */
const MARCH_LEAD = 2.5;

export interface War {
  id: number;
  /** 攻める種（コボルトかゴブリン）、攻める住みかと攻められる住みか */
  ak: number;
  from: number;
  to: number;
  ph: number;
  end: number;
  /** 始めた生き物の更新の番号、段階が変わった番号 */
  t: number;
  pt: number;
  /** 攻めに出た数、倒された数、奪った量 */
  n0: number;
  lost: number;
  loot: number;
  ids: number[];
}

type Home = Warren | Camp;
const foeKind = (k: number) => (k === Kind.Kobold ? Kind.Goblin : Kind.Kobold);

/** 攻める種 k の、番号 id の住みか */
export function warHome(this: Ecology, k: number, id: number): Home | undefined {
  return k === Kind.Kobold ? this.warrens.find((o) => o.id === id && id >= 0) : this.camps.find((o) => o.id === id && id >= 0 && o.kind === 0);
}

function homeMembers(e: Ecology, k: number, h: Home): Cr[] {
  return k === Kind.Kobold ? e.warrenMembers(h as Warren) : e.campMembers(h as Camp);
}

/** 戦える者：起きていて、逃げておらず、飢えかけておらず、深手でない（ゴブリンの盗み・コボルトの道中などの最中の者は除く） */
function able(e: Ecology, c: Cr): boolean {
  if (c.dead || c.away || c.flee > 0 || c.sleep !== 0 || c.hungry >= SPEC[c.k].starve * 0.6) return false;
  if (c.hp > 0 && c.hp < e.maxHp(c) * 0.6) return false;
  return c.k === Kind.Kobold ? c.st === 0 || c.st === 4 || c.st === 13 : c.st === 0 || c.st === 3 || c.st === 4;
}

function partyNear(e: Ecology, x: number, y: number): boolean {
  return e.parties.some((p) =>
    p.members.some((id) => {
      const a = e.byId.get(id);
      return !!a && !a.dead && !a.away && sq(a.x - x) + sq(a.y - y) < PARTY_R * TILE * PARTY_R * TILE;
    }),
  );
}

/** 住みかの前（コボルトは横穴の入口、ゴブリンは集落の真ん中） */
function frontOf(e: Ecology, k: number, h: Home): [number, number] {
  const m = e.w.map;
  const d = k === Kind.Kobold ? ((h as Warren).door ?? -1) : -1;
  return d >= 0 ? [(d % m.w) * TILE + 8, Math.floor(d / m.w) * TILE + 8] : [h.x, h.y];
}

/** 攻めに出るかを決める（生き物の更新150回ごと＝通常速度で30秒ごと） */
export function planWars(this: Ecology): void {
  const tick = this.w.tick;
  for (const ak of [Kind.Kobold, Kind.Goblin]) {
    const dk = foeKind(ak);
    // オークに従う集落は攻めに出ない
    const homes: Home[] = ak === Kind.Kobold ? this.warrens.filter((o) => o.id >= 0) : this.camps.filter((o) => o.id >= 0 && o.kind === 0 && !o.lx && !o.ly);
    const targets: Home[] = dk === Kind.Kobold ? this.warrens.filter((o) => o.id >= 0) : this.camps.filter((o) => o.id >= 0 && o.kind === 0);
    if (!targets.length) continue;
    for (const h of homes) {
      if (h.hide || (h.warT ?? 0) > tick || this.wars.some((w) => w.ak === ak && w.from === h.id)) continue;
      const goal = ak === Kind.Kobold ? this.storeGoal(h as Warren) : this.campStoreGoal(h as Camp);
      if ((h.store ?? 0) >= goal * WAR_STORE) continue;
      const mine = homeMembers(this, ak, h).filter((c) => able(this, c));
      if (mine.length < WAR_MIN || partyNear(this, h.x, h.y)) continue;
      const dist = this.walkDist(this.tileOf(h.x, h.y), WAR_R);
      let best: Home | null = null;
      let bd = 1e9;
      for (const t of targets) {
        if ((t.warT ?? 0) > tick || (t.store ?? 0) < LOOT_MIN) continue;
        const d = dist[this.tileOf(t.x, t.y)];
        if (d < 0 || d >= bd) continue;
        const theirs = homeMembers(this, dk, t).filter((c) => !c.dead && !c.away).length;
        if (theirs < 1 || mine.length < theirs * WAR_RATIO || partyNear(this, t.x, t.y)) continue;
        best = t;
        bd = d;
      }
      if (!best) continue;
      const n = Math.ceil(mine.length * WAR_SEND);
      const ids = mine
        .sort((a, b) => a.id - b.id)
        .slice(0, n)
        .map((c) => c.id);
      h.warT = tick + WAR_COOL;
      best.warT = tick + WAR_COOL;
      const w: War = { id: this.nextId++, ak, from: h.id, to: best.id, ph: 0, end: 0, t: this.step, pt: this.step, n0: ids.length, lost: 0, loot: 0, ids };
      this.wars.push(w);
      this.record('settle', { t: tick, k: ak, id: w.id, ev: 'warGather', n: ids.length, to: best.id, x: Math.round(h.x), y: Math.round(h.y) } as never);
    }
  }
}

/** c が加わっている戦 */
export function warOf(this: Ecology, c: Cr): War | undefined {
  if (!this.wars.length || (c.k !== Kind.Kobold && c.k !== Kind.Goblin)) return undefined;
  return this.wars.find((w) => w.ak === c.k && w.ids.includes(c.id));
}

/** 奪った蓄えを担いで引き上げている者か（荷の絵に使う） */
export function warHauls(this: Ecology, c: Cr): boolean {
  const w = this.warOf(c);
  return !!w && w.ph === 2 && w.end === 1 && c.units > 0;
}

/** foe が、住みか h（種 k の）へ攻めてきている戦の攻め手か */
export function warAttacker(this: Ecology, foe: Cr, k: number, h: Home): boolean {
  const w = this.warOf(foe);
  return !!w && w.ph === 1 && foeKind(w.ak) === k && w.to === h.id;
}

/**
 * 住みか h（種 k の）へ攻めてくる攻め手のうち、いちばん近い者と、攻め手の強さの合計（住みかの見張りの、迫る相手の見積もりに使う）。
 * 見張りは迫る相手が群れの1.5倍より強ければ隠れるので、強さを0.75倍にして渡し、攻め手が2倍より強いときに隠れるようにする
 */
export function warThreat(this: Ecology, k: number, h: Home): { near: Cr; d: number; threat: number } | null {
  let near: Cr | null = null;
  let nd = 1e18;
  let threat = 0;
  for (const w of this.wars) {
    if (w.ph !== 1 || foeKind(w.ak) !== k || w.to !== h.id) continue;
    for (const id of w.ids) {
      const a = this.byId.get(id);
      if (!a || a.dead || a.away) continue;
      threat += STR[a.k] * 0.75;
      const d = sq(a.x - h.x) + sq(a.y - h.y);
      if (d < nd) {
        nd = d;
        near = a;
      }
    }
  }
  return near ? { near, d: nd, threat } : null;
}

/**
 * 列を離れる。奪った蓄えを袋に持ったままのコボルトは、腹に入る分を食べ、残りをその場に落とす
 * （コボルトには袋の中身を蓄えに運ぶ動きが無いので、持ったままにすると蓄えにもならず描かれもしない。ゴブリンは集落へ持ち帰る動きがある）
 */
function leave(e: Ecology, w: War, c: Cr): void {
  w.ids = w.ids.filter((id) => id !== c.id);
  if (c.k !== Kind.Kobold || c.units <= 0) return;
  const t = Math.max(0, Math.min(c.units, SPEC[c.k].cap - c.food));
  c.food += t;
  e.deposit(c.x, c.y, c.units - t);
  c.units = 0;
}

/** 戦に加わっている者の動き。true なら今は戦に従っている（kobold・goblin の初めに呼ぶ） */
export function warStep(this: Ecology, c: Cr): boolean {
  const w = this.warOf(c);
  if (!w) return false;
  const home = this.warHome(w.ak, w.from);
  // 住みかが無くなったか、飢えかけたら列を離れる
  if (!home || c.hungry >= SPEC[c.k].starve * 0.6) {
    leave(this, w, c);
    return false;
  }
  const sp = SPEC[c.k].speed;
  c.act = 1;
  if (w.ph === 0) {
    const [fx, fy] = frontOf(this, w.ak, home);
    if (sq(fx - c.x) + sq(fy - c.y) > 1.5 * TILE * 1.5 * TILE) this.goTo(c, fx, fy, sp);
    else c.act = 0;
    return true;
  }
  if (w.ph === 1) {
    const tgt = this.warHome(foeKind(w.ak), w.to);
    if (!tgt) return true;
    // 3マスの内の、守る側の者に打ちかかる
    let foe: Cr | null = null;
    let bd = 3 * TILE * 3 * TILE;
    this.nearby(c.x, c.y, 3, (o) => {
      if (o.dead || o.away || o.k !== foeKind(w.ak) || !this.canSense(c, o)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        foe = o;
      }
    });
    if (foe) {
      const f = foe as Cr;
      if (bd < 11 * 11) this.fight(c, f);
      else this.goTo(c, f.x, f.y, sp * 1.2);
      return true;
    }
    // 住みかの前（コボルトの住処なら横穴の入口）に着いたら、そばの攻め手が皆で蓄えを袋に詰め、引き上げる
    const [tx, ty] = frontOf(this, foeKind(w.ak), tgt);
    if (sq(tx - c.x) + sq(ty - c.y) < 1.5 * TILE * 1.5 * TILE) {
      // 着いたときに蓄えが尽きていれば、奪う物が無いので引き返す
      if ((tgt.store ?? 0) < 1) {
        this.endWar(w, 3, 'empty');
        return true;
      }
      for (const id of w.ids) {
        const o = this.byId.get(id);
        if (!o || o.dead || sq(tx - o.x) + sq(ty - o.y) > 4 * TILE * 4 * TILE) continue;
        const take = Math.max(0, Math.min(tgt.store ?? 0, LOOT_CAP - o.units));
        tgt.store = (tgt.store ?? 0) - take;
        o.units += take;
        w.loot += take;
      }
      this.endWar(w, 1);
      return true;
    }
    // 一団で進む：仲間の真ん中より、目当てに MARCH_LEAD マス以上近づいた者は立ち止まって待つ
    let mx = 0;
    let my = 0;
    let n = 0;
    for (const id of w.ids) {
      const o = this.byId.get(id);
      // 遠く離れた者（水を飲みに行った、引っかかった）は数えない（待ち続けて列ごと止まらないように）
      if (!o || o.dead || sq(o.x - c.x) + sq(o.y - c.y) > 8 * TILE * 8 * TILE) continue;
      mx += o.x;
      my += o.y;
      n++;
    }
    if (n > 1 && Math.sqrt(sq(tx - mx / n) + sq(ty - my / n)) - Math.sqrt(sq(tx - c.x) + sq(ty - c.y)) > MARCH_LEAD * TILE) {
      c.act = 0;
      this.setDir(c, tx - c.x, ty - c.y);
      return true;
    }
    this.goTo(c, tx, ty, sp);
    return true;
  }
  // 引き上げる：蓄えを奪った者は荷を担いで歩き、押し返された者は急いで帰る
  if (sq(home.x - c.x) + sq(home.y - c.y) < 1.5 * TILE * 1.5 * TILE) {
    home.store = (home.store ?? 0) + c.units;
    c.units = 0;
    leave(this, w, c);
    return false;
  }
  this.goTo(c, home.x, home.y, w.end === 2 ? sp * 1.2 : sp);
  return true;
}

/** 戦を終わりにして、皆で引き上げる */
export function endWar(this: Ecology, w: War, end: number, why = ''): void {
  if (w.ph === 2) return;
  const dk = foeKind(w.ak);
  const tgt = this.warHome(dk, w.to);
  const was = w.ph;
  w.ph = 2;
  w.end = end;
  w.pt = this.step;
  const lead = w.ids.map((id) => this.byId.get(id)).find((o) => o && !o.dead);
  const x = lead?.x ?? tgt?.x ?? 0;
  const y = lead?.y ?? tgt?.y ?? 0;
  const place = dk === Kind.Kobold ? '住処' : '集落';
  if (end === 1) {
    // 蓄えを奪われた住みかは、襲われた回数に数える（重なると住みかを捨てる）
    if (tgt) tgt.raids = (tgt.raids ?? 0) + 2;
    this.log(x, y, `{k:${w.ak}}が、{k:${dk}}の${place}の蓄えを奪って引き上げた`);
  } else if (end === 2) this.log(x, y, `{k:${w.ak}}は{k:${dk}}に押し返され、退いた`);
  else if (was === 1) this.log(x, y, `{k:${w.ak}}の群れは、攻めるのをやめて引き返した`);
  this.record('settle', { t: this.w.tick, k: w.ak, id: w.id, ev: 'war', how: end, n: w.n0, lost: w.lost, loot: w.loot, to: w.to, ...(why ? { why } : {}), x: Math.round(x), y: Math.round(y) } as never);
}

/** 戦の段階を進める（生き物の更新ごと。戦が無ければ何もしない） */
export function tendWars(this: Ecology): void {
  if (!this.wars.length) return;
  for (const w of this.wars) {
    // 倒された者を数える
    const alive: number[] = [];
    for (const id of w.ids) {
      const o = this.byId.get(id);
      if (o && !o.dead && !o.away) alive.push(id);
      else if (!o || o.dead) w.lost++;
    }
    w.ids = alive;
    if (w.ph === 2) {
      // 帰り道で住みかへ着けない者（崩落で道が断たれたなど）は、時間が来たら列を離れる
      if (this.step - w.pt >= MARCH_STEPS)
        for (const id of [...w.ids]) {
          const o = this.byId.get(id);
          if (o) leave(this, w, o);
        }
      continue;
    }
    const home = this.warHome(w.ak, w.from);
    const tgt = this.warHome(foeKind(w.ak), w.to);
    if (!home || !tgt || !w.ids.length) {
      this.endWar(w, 3, !home ? 'home' : !tgt ? 'gone' : 'none');
      continue;
    }
    if (w.ph === 1 && w.lost >= Math.ceil(w.n0 * WAR_LOSS)) {
      this.endWar(w, 2);
      continue;
    }
    const members = w.ids.map((id) => this.byId.get(id) as Cr);
    // 攻めに向かう途中で、起きている冒険者・ドワーフ・大物（強さ12以上）が6マスの内に来るか、守る側でない者（オークなど）に仲間が打たれたら、戦をやめて引き返す。
    // （オークはあちこちをぶらつくので、そばを通っただけではやめない）
    if (w.ph === 1 && this.step % 5 === w.id % 5) {
      let met = '';
      for (const c of members) {
        if (this.w.tick - c.hitAt < 10) {
          const f = this.byId.get(c.foe);
          if (f && f.k !== foeKind(w.ak) && f.k !== w.ak) met = `hit${f.k}`;
        }
        this.nearby(c.x, c.y, 6, (o) => {
          // 眠っている者、幼い竜、宝物庫を動かないゴーレムは数えない
          if (met || o.dead || o.away || o.sleep > 0 || (o.k === Kind.Dragon && o.sp < 1) || o.k === Kind.Golem) return;
          if (o.k === Kind.Adventurer || o.k === Kind.Dwarf || STR[o.k] >= 12) met = `met${o.k}`;
        });
        if (met) break;
      }
      if (met) {
        this.endWar(w, 3, met);
        continue;
      }
    }
    if (w.ph === 0) {
      const [fx, fy] = frontOf(this, w.ak, home);
      const ready = members.every((c) => sq(fx - c.x) + sq(fy - c.y) < 2 * TILE * 2 * TILE);
      if (ready || this.step - w.pt >= GATHER_STEPS) {
        w.ph = 1;
        w.pt = this.step;
        const place = foeKind(w.ak) === Kind.Kobold ? '住処' : '集落';
        this.log(fx, fy, `{k:${w.ak}}の群れが、{k:${foeKind(w.ak)}}の${place}へ攻めに出た`);
        this.record('settle', { t: this.w.tick, k: w.ak, id: w.id, ev: 'warGo', n: w.ids.length, to: w.to, x: Math.round(fx), y: Math.round(fy) } as never);
      }
    } else if (this.step - w.pt >= MARCH_STEPS) this.endWar(w, 3, 'time');
  }
  this.wars = this.wars.filter((w) => w.ph !== 2 || w.ids.length > 0);
}

declare module '../ecology' {
  interface Ecology {
    warHome: typeof warHome;
    planWars: typeof planWars;
    warOf: typeof warOf;
    warHauls: typeof warHauls;
    warAttacker: typeof warAttacker;
    warThreat: typeof warThreat;
    warStep: typeof warStep;
    endWar: typeof endWar;
    tendWars: typeof tendWars;
  }
}
Object.assign(Ecology.prototype, { warHome, planWars, warOf, warHauls, warAttacker, warThreat, warStep, endWar, tendWars });
