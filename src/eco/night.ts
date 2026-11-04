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
 */
import { Cr, Ecology, Job, Kind, Party, ih, sq } from '../ecology';
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
 * 起きている期間が終わったら、そのあいだの被害しだいで、焚き火を消して発つ
 */
export function campWatch(this: Ecology, p: Party, alive: Cr[]): void {
  const awake = (p.wakeT ?? 0) > this.step;
  if (!awake && (p.wakeT ?? 0) > 0) {
    // 起きている期間が終わった：倒れた者が出たか、深手を負っていれば、夜明けを待たずに発つ
    const lost = (p.wakeN ?? 0) > alive.length;
    const hp = alive.reduce((s, o) => s + (o.hp > 0 ? o.hp / this.maxHp(o) : 1), 0) / Math.max(1, alive.length);
    p.wakeT = 0;
    p.wakeN = 0;
    if (lost || hp < 0.5) {
      const lead = alive[0];
      this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'campBreak', how: lost ? 'lost' : 'hurt', x: Math.round(lead.x), y: Math.round(lead.y) } as never);
      this.log(lead.x, lead.y, `夜襲を受けた冒険者の一行が、焚き火を消して発った`);
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
  }
}

Object.assign(Ecology.prototype, { campFoe, campWake, campHit, campPetty, campWatch, campAwake });
