/**
 * Ecology のメソッド：焚き火の夜（夜襲の作り直しの一歩目）。
 *
 * 見せたい瞬間：焚き火を囲んで眠る一行に、手強い敵が近づく。起きている見張りが気づけば「！」を出して皆を起こし、
 * 一行は飛び起きて敵の方を向き、応戦する。見張りがうとうとしている間は気づかず、寝ている者が打たれて初めて皆が起きる。
 *
 * 眠り：焚き火で深く眠っている者（見張りと、手当て中の僧侶を除く）は、敵を探さず、物を見ない（src/eco/adventurer.ts）。
 * 起きるのは、自分が打たれたとき（打たれた者だけ。手強い敵なら一行の皆も）、見張りか眠りの浅い盗賊に起こされたとき、
 * 近くで大きな音がしたとき（音の届く範囲の4割の内。src/eco/sleep.ts の wakeByNoise）。
 * 一行が起きている期間の終わり（wakeT、step 番号）のあいだは、眠りの印を付けない（syncLongSleep）。
 * 起きている期間が終わったとき、そのあいだに死者が出たか、一行の体力の平均が半分を切っていれば、焚き火を消して発つ。
 *
 * 夜襲（二歩目）：焚き火は休みの最後の3分の1で細る（campFire。火の怖さの届く範囲と光の輪が小さくなる）。
 * 火を怖がる大物のうちトロールは、3割ほど飢えていれば細った焚き火の縁を越え、眠っている者を好んで狙う（src/eco/combat.ts の hunt）。
 * 遠くの焚き火へ寄っていく動きは入れていない（トロールとヴァンパイアに60マス先の焚き火へ寄らせると、住処の外を出歩くことで生き物の流れが変わり、
 * 16シード×25日でコボルトの飢え死にが約2倍になった）。夜襲を担うのは、焚き火の近くにいるトロールと、灯りに潜むオークが主。
 * オークと住処を持たないコボルトは、焚き火の灯りのそばの暗がりに潜み、見張りがうとうとする隙に眠っている者を襲う（src/eco/senses.ts の lurk）。
 * 眠る一行に忍び寄っているオークは唸らない。一行が起こされたら、一行の皆の強さで見極め、かなわなければ唸って退く（src/eco/orc.ts の orcWary）。
 * ヴァンパイアは眠っている者を好んで血を吸う。眠っている者への最初の一打ちは1.5倍で、その打ち合いでは打ち返されない（寝込みの一打ち、nightHit）。
 */
import { STONED_LEAVE } from './koboldskill';
import { Cr, Ecology, Job, Kind, Party, SPEC, ih, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 起こされてから、敵が見えなくなっても構えている長さ（生き物の更新の回数。通常速度で約30秒） */
const WAKE_STEPS = 150;
/** 見張りが気づく遠さ（灯りの届く範囲） */
const WATCH_R = 5.5;
/** 眠りの浅い盗賊が、物音で目を覚ます遠さ（マス） */
const THIEF_R = 3;

/** 小物（焚き火のそばに来ても、一行の皆は起きない） */
const PETTY = new Set<number>([Kind.Rat, Kind.Bat, Kind.Ant, Kind.Spider, Kind.Lizard, Kind.Slime, Kind.Myconid, Kind.Salamander, Kind.Wisp]);

/** 焚き火の眠りを破る手強い敵か（大ネズミやコウモリのような小物は除く。焚き火への盗み・通路の掠め取りのゴブリンと、威嚇して退くオークは別に扱う） */
export function campFoe(this: Ecology, o: Cr): boolean {
  if (o.dead || o.away || o.flee > 0 || o.sleep > 0) return false;
  switch (o.k) {
    case Kind.Goblin:
      return o.st !== 15 && o.st !== 16 && o.st !== 17;
    case Kind.Orc:
      return o.st !== 20 && o.st !== 21;
    case Kind.Kobold:
    case Kind.Lizardman:
    case Kind.Minotaur:
    case Kind.Troll:
    case Kind.Vampire:
    case Kind.Zombie:
    case Kind.Basilisk:
    case Kind.Skeleton:
    case Kind.Lich:
    case Kind.Armor:
    case Kind.Golem:
    case Kind.Wyvern:
    case Kind.Dragon:
      return true;
    case Kind.Gargoyle:
      return o.act !== 0;
  }
  return false;
}

/** 一行を起こす（how：watch 見張り、thief 盗賊、hit 寝ている者が打たれた、noise 物音）。foe は気づいた相手 */
export function campWake(this: Ecology, p: Party, how: string, foe?: Cr, at?: Cr): void {
  if ((p.camp ?? -1) < 0) return;
  const first = (p.wakeT ?? 0) <= this.step;
  p.wakeT = this.step + WAKE_STEPS;
  if (foe) {
    p.wakeX = Math.round(foe.x);
    p.wakeY = Math.round(foe.y);
  }
  if (!first) return;
  // 起きはじめ：皆に「！」。起きたときの人数を覚えておく（起きている間に倒れた者がいれば、焚き火を消して発つ）
  p.wakeN = p.members.filter((id) => { const o = this.byId.get(id); return !!o && !o.dead; }).length;
  this.partyMark(p, '!', true);
  for (const id of p.members) {
    const o = this.byId.get(id);
    if (!o || o.dead) continue;
    o.sleep = 0;
    if (foe) o.dir = Math.abs(foe.x - o.x) > Math.abs(foe.y - o.y) ? (foe.x > o.x ? 2 : 3) : foe.y > o.y ? 0 : 1;
  }
  const w = at ?? this.byId.get(p.members[0]);
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'wake', how, n: foe?.k ?? -1, doze: this.watchDozing(p) ? 1 : 0, night: this.isNight() ? 1 : 0, x: Math.round(w?.x ?? 0), y: Math.round(w?.y ?? 0) } as never);
  if (how !== 'noise' && this.step - (this.lastLogged[979] ?? -99999) > 1500) {
    this.lastLogged[979] = this.step;
    const what = foe ? `{k:${foe.k}}` : '敵';
    this.log(w?.x ?? 0, w?.y ?? 0, how === 'hit' ? `焚き火のそばで眠っていた冒険者が${what}に襲われ、一行が飛び起きた` : how === 'thief' ? `眠りの浅い盗賊が忍び寄る${what}に気づき、一行を起こした` : `焚き火の見張りが${what}に気づき、眠っている一行を起こした`);
  }
}

/** 焚き火で休む一行の者が打たれた（strike から）。手強い敵なら一行を起こす（小物なら、打たれた者だけが目を覚ます） */
export function campHit(this: Ecology, d: Cr, a: Cr): void {
  const p = this.parties.find((q) => q.id === d.party);
  if (!p || (p.camp ?? -1) < 0) return;
  if (!PETTY.has(a.k)) this.campWake(p, 'hit', a, d);
}

/** 焚き火の小競り合い（休む冒険者と小物の打ち合い）か：物音を立てない（一行の皆を起こさない） */
export function campPetty(this: Ecology, a: Cr, d: Cr): boolean {
  const camper = (o: Cr) => o.k === Kind.Adventurer && (this.parties.find((q) => q.id === o.party)?.camp ?? -1) >= 0;
  return (camper(a) && PETTY.has(d.k)) || (camper(d) && PETTY.has(a.k));
}

/**
 * 焚き火の見張り（updateParties から、焚き火を囲む一行について生き物の更新ごと）：
 * 起きている見張りが、灯りの中で自分の向いている側に手強い敵を見たら、一行を起こす。
 * 眠りの浅い盗賊は、近く（3マス）に来た敵にときどき自分で目を覚まし、一行を起こす。
 * 一行が起きているあいだは、起きている誰かに敵が見えるかぎり、起きている期間を延ばす。
 * 起きている期間が終わったら、そのあいだの被害しだいで（倒れた者・深手・コボルトの小石を何度も当てられた）、焚き火を消して発つ
 */
export function campWatch(this: Ecology, p: Party, alive: Cr[]): void {
  const awake = (p.wakeT ?? 0) > this.step;
  if (!awake && (p.wakeT ?? 0) > 0) {
    // 起きている期間が終わった：倒れた者が出たか、深手を負っていれば、夜明けを待たずに発つ
    const lost = (p.wakeN ?? 0) > alive.length;
    const hp = alive.reduce((s, o) => s + (o.hp > 0 ? o.hp / this.maxHp(o) : 1), 0) / Math.max(1, alive.length);
    // コボルトのスリングの小石を、起きているあいだに何度も当てられた（src/eco/koboldskill.ts）
    const stoned = (p.stoned ?? 0) >= STONED_LEAVE;
    p.wakeT = 0;
    p.wakeN = 0;
    p.stoned = 0;
    if (lost || hp < 0.5 || stoned) {
      const lead = alive[0];
      this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'campBreak', how: lost ? 'lost' : hp < 0.5 ? 'hurt' : 'stoned', x: Math.round(lead.x), y: Math.round(lead.y) } as never);
      this.endCamp(p);
      return;
    }
  }
  if (this.step % 3 !== p.id % 3) return;
  const lights = this.partyLights(p);
  const lead = alive[0];
  for (const a of alive) {
    // 起きている一行は誰でも、眠っている一行は起きている見張り（先頭）と、眠りの浅い盗賊だけが気づく
    const watch = a === lead && a.sleep === 0 && !this.watchDozing(p);
    const thief = a.sp === Job.Thief && a.sleep > 0;
    if (!awake && !watch && !thief) continue;
    const R = awake || watch ? WATCH_R : THIEF_R;
    let foe: Cr | null = null;
    let bd = R * TILE * R * TILE;
    this.nearby(a.x, a.y, Math.ceil(R), (o) => {
      if (!this.campFoe(o)) return;
      const dx = o.x - a.x;
      const dy = o.y - a.y;
      const d = dx * dx + dy * dy;
      if (d >= bd) return;
      if (thief && !awake) {
        // 盗賊は目で見ずに、気配で（ときどき）目を覚ます
        if (ih(a.id, o.id ^ this.step, 285) % 4 !== 0) return;
      } else {
        if (!this.seenBy(a, lights, o)) return;
        // 眠っている一行の見張りは、向いている側だけを見ている
        if (!awake && !(a.dir === 0 ? dy > -4 : a.dir === 1 ? dy < 4 : a.dir === 2 ? dx > -4 : dx < 4)) return;
      }
      bd = d;
      foe = o;
    });
    if (!foe) continue;
    this.campWake(p, awake ? 'still' : watch ? 'watch' : 'thief', foe, a);
    return;
  }
}

/**
 * 焚き火の強さ（1 から 0.375）：休みの最後の3分の1で、火の怖さの届く範囲（4マス）が約1.5マスまで細り、光の輪も小さくなる。
 * 休み始め（campAt）と休み終わりの予定（campUntil）の step 番号から決める（ロードし直しても同じ）
 */
export function campFire(this: Ecology, p: Party): number {
  if ((p.camp ?? -1) < 0 || p.campAt === undefined) return 1;
  const len = Math.max(1, (p.campUntil ?? 0) - p.campAt);
  const f = (this.step - p.campAt) / len;
  return f <= 2 / 3 ? 1 : Math.max(0.375, 1 - (f - 2 / 3) * 3 * 0.625);
}

/**
 * 夜襲に出る火を怖がる大物（トロール）か：3割ほど飢えていれば、細った焚き火の縁を越える。
 * （飢えが6割を超えた大物は、入口から出ていく＝leaveIfStarving に移って狩りをしないので、それより手前から）
 * ミノタウロスは縄張りのそばでしか狩らないので、縄張りの近くで休む一行だけを繰り返し襲ってしまう（迷路に住んでいたころ、16シード×25日で seed41 だけで6人）。
 * バジリスクは冒険者を獲物にしない。どちらも焚き火を怖がるまま
 */
export function nightRaider(this: Ecology, c: Cr): boolean {
  return c.k === Kind.Troll && c.st !== 9 && c.sinceMeal > SPEC[c.k].starve * 0.3;
}

/** (x, y) を照らす火のうち、細った焚き火（冒険者の）があるか */
export function weakCampAt(this: Ecology, x: number, y: number, r = 0): boolean {
  const m = this.w.map;
  for (const p of this.parties) {
    if ((p.camp ?? -1) < 0 || this.campFire(p) >= 1) continue;
    const fx = ((p.camp as number) % m.w) * TILE + 8;
    const fy = Math.floor((p.camp as number) / m.w) * TILE + 8;
    const R = Math.max(r, 4 * this.campFire(p)) * TILE;
    if (sq(fx - x) + sq(fy - y) < R * R) return true;
  }
  return false;
}

/** c が (x, y) の火を怖がるか（夜襲に出る大物は、細った焚き火なら怖がらない） */
export function fireDaunts(this: Ecology, c: Cr, x: number, y: number): boolean {
  if (!this.fireNear(x, y)) return false;
  if (this.nightRaider(c) && this.weakCampAt(x, y)) {
    // 細った焚き火のほかに、怖い火がなければ越える
    for (const f of this.fires()) {
      if (sq(f[0] - x) + sq(f[1] - y) >= f[2] * f[2]) continue;
      if (!this.weakCampAt(f[0], f[1])) return true;
    }
    return false;
  }
  return true;
}

/** 焚き火で眠っている冒険者か（夜襲の獲物。見張りのうとうとも含む） */
export function campSleeper(this: Ecology, o: Cr): boolean {
  if (o.k !== Kind.Adventurer || o.sleep <= 0 || o.dead) return false;
  return (this.parties.find((q) => q.id === o.party)?.camp ?? -1) >= 0;
}

/**
 * 眠る一行の強さの見積もり（オークの見極め）：一行が起きていなければ、起きている者（見張り、手当て中の僧侶）の分だけ。
 * 眠っている一行は弱く見えるので、オークは威嚇して退かずに近づく。起こされた一行は、ふだんどおり全員の強さ
 */
export function campMight(this: Ecology, p: Party): number {
  if ((p.camp ?? -1) < 0 || this.campAwake(p)) return this.partyMight(p);
  let s = 0;
  for (const id of p.members) {
    const o = this.byId.get(id);
    if (!o || o.dead || o.sleep > 0) continue;
    s += this.str(o) * (o.hp > 0 ? o.hp / this.maxHp(o) : 1);
  }
  return s;
}

/** 寝込みの一打ち（fight から、打つ前に）：眠っている冒険者への最初の一打ちを記録する。true なら寝込み（重く打ち、打ち返されない） */
export function nightHit(this: Ecology, a: Cr, d: Cr): boolean {
  if (a.k === Kind.Adventurer || !this.campSleeper(d)) return false;
  const p = this.parties.find((q) => q.id === d.party) as Party;
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'nightHit', n: a.k, doze: this.watchDozing(p) ? 1 : 0, night: this.isNight() ? 1 : 0, x: Math.round(d.x), y: Math.round(d.y) } as never);
  return true;
}

/** 焚き火で休む一行の者か（死の記録の camp の印。src/eco/move.ts） */
export function inCamp(this: Ecology, o: Cr): boolean {
  return o.k === Kind.Adventurer && (this.parties.find((q) => q.id === o.party)?.camp ?? -1) >= 0;
}

/** 一行が焚き火で起きているか（起こされて構えている間） */
export function campAwake(this: Ecology, p: Party): boolean {
  return (p.camp ?? -1) >= 0 && (p.wakeT ?? 0) > this.step;
}

declare module '../ecology' {
  interface Ecology {
    campFoe: typeof campFoe;
    campWake: typeof campWake;
    campHit: typeof campHit;
    campPetty: typeof campPetty;
    campWatch: typeof campWatch;
    campAwake: typeof campAwake;
    campFire: typeof campFire;
    nightRaider: typeof nightRaider;
    weakCampAt: typeof weakCampAt;
    fireDaunts: typeof fireDaunts;
    campSleeper: typeof campSleeper;
    campMight: typeof campMight;
    nightHit: typeof nightHit;
    inCamp: typeof inCamp;
  }
}

Object.assign(Ecology.prototype, { campFoe, campWake, campHit, campPetty, campWatch, campAwake, campFire, nightRaider, weakCampAt, fireDaunts, campSleeper, campMight, nightHit, inCamp });
