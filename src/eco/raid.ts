/**
 * Ecology のメソッド：ゴブリンの夜の盗み（冒険者の作り直しの二歩目）。
 *
 * 見せたい瞬間：夜、焚き火を囲んで休む一行のところへ、ゴブリンが暗がりから忍び寄り、
 * 食べ物か松明を盗んで暗がりへ逃げ帰る。見張りに見つかれば、手ぶらで逃げ帰る。
 *
 * 状態（ゴブリンの st）：15 忍び寄る（lure 狙う冒険者、lureAt 出た刻み、tx/ty 光の縁の潜む所、gait 潜んで待つ残り）、
 * 16 逃げ帰る（盗んだ食べ物は袋 units に入れて、集落の蓄えへ）。
 */
import { Camp, Cr, DAY_TICKS_ECO, Ecology, Job, Kind, Party, SPEC, ih, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 盗みに出る集落の、蓄えの乏しさ（蓄えの目安に対する割合） */
const RAID_STORE = 0.4;
/** 盗みに出る遠さ（集落から焚き火まで、マス）。焚き火の残りの時間で着ける所だけ（1マスあたり約25歩で見積もる） */
const RAID_R = 50;

export function isNight(this: Ecology): boolean {
  return this.phaseNow > 0.79 || this.phaseNow < 0.18;
}

/** 盗みに出る（updateCamps から、地上の5秒ごと）：夜、蓄えの乏しい集落のそば（40マス）で一行が焚き火を囲んでいれば、1〜3匹が忍び出る */
export function planRaids(this: Ecology): void {
  if (!this.isNight()) return;
  const m = this.w.map;
  for (const cp of this.camps) {
    if (cp.id < 0 || cp.kind !== 0 || cp.hide || (cp.raidT ?? 0) > this.w.tick) continue;
    const members = this.campMembers(cp);
    if (!members.length || members.some((c) => c.st === 15 || c.st === 16)) continue;
    if ((cp.store ?? 0) >= this.campStoreGoal(cp) * RAID_STORE) continue;
    let best: { p: Party; fx: number; fy: number } | null = null;
    let bd = RAID_R * TILE * RAID_R * TILE;
    for (const p of this.parties) {
      if ((p.camp ?? -1) < 0) continue;
      // この集落を退治しに来た一行には近づかない
      if (p.aim === 5 && !p.aimEnd && p.aimId === cp.id) continue;
      const fx = ((p.camp as number) % m.w) * TILE + 8;
      const fy = Math.floor((p.camp as number) / m.w) * TILE + 8;
      const d = sq(fx - cp.x) + sq(fy - cp.y);
      // すぐそば（10マス）の一行は、集落の見張り（watchCamps）が扱う
      if (d >= bd || d < 10 * TILE * 10 * TILE) continue;
      if ((p.campUntil ?? 0) - this.step < Math.sqrt(d) / TILE * 25 + 150) continue;
      bd = d;
      best = { p, fx, fy };
    }
    if (!best) continue;
    const ready = members.filter((c) => c.flee <= 0 && c.sleep === 0 && !c.away && (c.st === 0 || c.st === 3 || c.st === 4) && c.hungry < SPEC[Kind.Goblin].starve * 0.6);
    if (!ready.length) continue;
    // 袋の空いている者を先に（集めた物で袋がいっぱいの者は、盗んだ物を入れられない）
    ready.sort((a, b) => (a.units >= 10 ? 1 : 0) - (b.units >= 10 ? 1 : 0) || sq(a.x - best!.fx) + sq(a.y - best!.fy) - (sq(b.x - best!.fx) + sq(b.y - best!.fy)) || a.id - b.id);
    const n = Math.min(ready.length, 1 + (ih(cp.id, this.step, 270) % 3));
    // 狙うのは、焚き火のまわりで眠っている者（見張り＝先頭を除く）
    const sleepers = best.p.members.slice(1).filter((id) => this.byId.get(id) && !this.byId.get(id)!.dead);
    const target = sleepers.length ? sleepers[ih(cp.id, this.step, 271) % sleepers.length] : best.p.members[0];
    for (let i = 0; i < n; i++) {
      const c = ready[i];
      c.st = 15;
      c.lure = target;
      c.lureAt = this.step;
      c.tx = 0;
      c.ty = 0;
      c.gait = 0;
      c.ref2 = 0;
    }
    cp.raidT = this.w.tick + DAY_TICKS_ECO / 3;
    this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'raid', n, to: best.p.id, x: Math.round(best.fx), y: Math.round(best.fy) } as never);
    if (this.step - (this.lastLogged[986] ?? -99999) > 1500) {
      this.lastLogged[986] = this.step;
      this.log(cp.x, cp.y, `蓄えの乏しい集落の{k:${Kind.Goblin}}${n}匹が、焚き火を囲む冒険者の荷物を狙って、暗がりへ忍び出た`);
    }
  }
}

/** 光の縁の潜む所：焚き火から6.5〜8マスの、明るくない床（ゴブリンの来た側から探す） */
function edgeSpot(eco: Ecology, c: Cr, fx: number, fy: number): [number, number] | null {
  const m = eco.w.map;
  const a0 = Math.atan2(c.y - fy, c.x - fx);
  for (let i = 0; i < 12; i++) {
    const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.35;
    const r = 6.5 + ((c.id + i) % 3) * 0.7;
    const k = eco.tileOf(fx + Math.cos(a) * r * TILE, fy + Math.sin(a) * r * TILE);
    if (k < 0 || m.solid[k] || m.sealed[k] || m.lava[k] || eco.w.water[k] > 20 || eco.litMap[k] === 1 || eco.lit(k, eco.day) > 0.35) continue;
    return [(k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8];
  }
  return null;
}

/** 盗みの最中のゴブリン（lurk の初めから）。true なら、この歩はこれで終わり */
export function goblinRaid(this: Ecology, c: Cr): boolean {
  const s = SPEC[Kind.Goblin];
  const cp = this.campOf(c);
  if (!cp || cp.kind !== 0) {
    c.st = 0;
    c.lure = 0;
    return false;
  }
  if (c.st === 16) {
    // 逃げ帰る：暗がりを選んで集落へ。着いたら盗んだ物を蓄えに入れる
    if (sq(cp.x - c.x) + sq(cp.y - c.y) < 2 * TILE * 2 * TILE) {
      // 盗んだ分（ref2）を記録する。袋の中身（摘んだ物も）はすべて蓄えに
      const got = Math.max(0, c.ref2);
      cp.store = (cp.store ?? 0) + c.units;
      c.units = 0;
      c.ref2 = 0;
      c.st = 0;
      c.gait = 0;
      c.act = 2;
      c.actT = 0;
      if (got > 0) this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'loot', n: got, x: Math.round(cp.x), y: Math.round(cp.y) } as never);
      return true;
    }
    c.act = 1;
    this.goTo(c, cp.x, cp.y, s.speed * 1.25);
    return true;
  }
  const t = this.byId.get(c.lure);
  const p = t ? this.parties.find((q) => q.id === t.party) : undefined;
  // 一行が焚き火を消して発ったか、長くかかりすぎたら、手ぶらで帰る
  if (!t || t.dead || t.away || !p || (p.camp ?? -1) < 0 || this.step - c.lureAt > 3000) {
    c.st = 16;
    c.lure = 0;
    c.gait = 0;
    return this.goblinRaid(c);
  }
  const m = this.w.map;
  const fx = ((p.camp as number) % m.w) * TILE + 8;
  const fy = Math.floor((p.camp as number) / m.w) * TILE + 8;
  // 見つかる：起きている者（焚き火の見張り）の向いている側で、3マスより近く、灯りの中に入ると、ときどき気づかれる（盗賊は気づきやすい）
  if (this.step % 5 === c.id % 5) {
    const lights = this.partyLights(p);
    for (const id of p.members) {
      const a = this.byId.get(id);
      // 気づくのは見張り（先頭）と、眠りの浅い盗賊だけ（焚き火を向いて癒やしている僧侶などは気づかない）
      if (!a || a.dead || a.sleep > 0 || (id !== p.members[0] && a.sp !== Job.Thief)) continue;
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      if (dx * dx + dy * dy > 3 * TILE * 3 * TILE || !this.seenBy(a, lights, c)) continue;
      const front = a.dir === 0 ? dy > -4 : a.dir === 1 ? dy < 4 : a.dir === 2 ? dx > -4 : dx < 4;
      if (!front && a.sp !== Job.Thief) continue;
      if (ih(c.id, this.step, 272) % (a.sp === Job.Thief ? 3 : 6) !== 0) continue;
      this.fxMarks.push({ t: this.w.tick, id: a.id, m: '!' });
      this.fxMarks.push({ t: this.w.tick, id: c.id, m: '!' });
      if (this.fxMarks.length > 120) this.fxMarks.splice(0, 40);
      c.st = 16;
      c.lure = 0;
      c.gait = 0;
      this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'spotted', n: a.sp, how: a.id === p.members[0] ? 'watch' : 'other', x: Math.round(c.x), y: Math.round(c.y) } as never);
      if (this.step - (this.lastLogged[985] ?? -99999) > 1500) {
        this.lastLogged[985] = this.step;
        this.log(c.x, c.y, `焚き火の見張りが、忍び寄る{k:${Kind.Goblin}}に気づいた。{k:${Kind.Goblin}}は暗がりへ逃げ帰った`);
      }
      return this.goblinRaid(c);
    }
  }
  // 1. 光の縁まで、暗がりを選んで忍び寄る
  if (c.gait >= 0 && !(c.tx || c.ty)) {
    const e = edgeSpot(this, c, fx, fy);
    if (e) [c.tx, c.ty] = e;
    else [c.tx, c.ty] = [fx + (c.x > fx ? 7 : -7) * TILE, fy];
  }
  if (c.gait >= 0) {
    if (sq(c.tx - c.x) + sq(c.ty - c.y) > 0.7 * TILE * 0.7 * TILE && !(c.gait === 0 && this.step - c.lureAt > 2200)) {
      c.act = 1;
      // 焚き火から遠いうちは急ぎ、近づいたら（12マス）身を低くしてゆっくり進む
      this.goTo(c, c.tx, c.ty, s.speed * (sq(fx - c.x) + sq(fy - c.y) > 12 * TILE * 12 * TILE ? 1.15 : 0.75));
      return true;
    }
    // 2. 光の縁で身をひそめて、焚き火の方をうかがう
    if (c.gait === 0) c.gait = 25 + (ih(c.id, this.step, 273) % 30);
    c.gait--;
    c.act = 0;
    c.dir = Math.abs(fx - c.x) > Math.abs(fy - c.y) ? (fx > c.x ? 2 : 3) : fy > c.y ? 0 : 1;
    if (c.gait <= 0) c.gait = -1;
    return true;
  }
  // 3. 眠っている者のそばへ駆け寄って、荷物を盗む
  c.act = 1;
  if (sq(t.x - c.x) + sq(t.y - c.y) < 14 * 14) {
    c.ref2 = this.goblinSteal(c, t, cp, true);
    c.st = 16;
    c.lure = 0;
    c.gait = 0;
    this.fxMarks.push({ t: this.w.tick, id: t.id, m: '!' });
    if (this.fxMarks.length > 120) this.fxMarks.splice(0, 40);
    return true;
  }
  // 光の中は、まっすぐ駆け寄る
  if (sq(t.x - c.x) + sq(t.y - c.y) < 4 * TILE * 4 * TILE) this.moveToward(c, t.x, t.y, s.speed * 1.2);
  else this.goTo(c, t.x, t.y, s.speed * 1.2);
  return true;
}

/**
 * 冒険者の荷物を盗む：食べ物（頭のいる集落は多め）と、手の松明（自分が持っていなければ）。
 * bag なら食べ物は袋（units）に入れて集落へ持ち帰る（盗みに出た者）。盗まれた一行は覚えておく（生きて帰れば噂になる）
 */
export function goblinSteal(this: Ecology, c: Cr, t: Cr, camp: Camp | undefined, bag: boolean): number {
  const bold = !!camp && this.campChief(camp);
  const room = bag ? 40 - c.units : SPEC[Kind.Goblin].cap - c.food;
  const take = Math.max(0, Math.min(bold ? 30 : 20, Math.max(0, t.food - 5), room));
  t.food -= take;
  if (bag) c.units += take;
  else c.food += take;
  let torch = 0;
  if (t.torch > 0 && c.torch <= 0) {
    c.torch = t.torch;
    t.torch = 0;
    torch = 1;
  }
  const tp = this.parties.find((q) => q.id === t.party);
  if (tp && (take > 0 || torch)) {
    tp.robbed = (tp.robbed ?? 0) + 1;
    tp.robX = Math.round(t.x);
    tp.robY = Math.round(t.y);
    this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: camp?.id ?? -1, ev: 'rob', n: take, how: bag ? 'raid' : 'lurk', to: torch, x: Math.round(t.x), y: Math.round(t.y) } as never);
  }
  if (this.step - (this.lastLogged[997] ?? -99999) > 3000) {
    this.lastLogged[997] = this.step;
    this.log(c.x, c.y, torch ? `{k:${Kind.Goblin}}が冒険者の松明と荷物を盗んで、暗がりへ逃げた` : `{k:${Kind.Goblin}}が冒険者の荷物を盗んで、暗がりへ逃げた`);
  }
  return take;
}

/** 盗みに出たゴブリンの道筋：明るい所（焚き火や松明の光の中、日の差す所）をできるだけ避ける（出発点と行き先のそばは除く） */
export function darkPath(this: Ecology, c: Cr, from: number, to: number): number[] | null {
  const m = this.w.map;
  const fx = from % m.w;
  const fy = Math.floor(from / m.w);
  const tx = to % m.w;
  const ty = Math.floor(to / m.w);
  const avoid = (k: number) => {
    if (this.litMap[k] !== 1 && this.lit(k, this.day) <= 0.35) return false;
    const x = k % m.w;
    const y = (k / m.w) | 0;
    return sq(x - fx) + sq(y - fy) > 25 && sq(x - tx) + sq(y - ty) > 9;
  };
  return this.findPathAvoid(c, from, to, avoid);
}

declare module '../ecology' {
  interface Ecology {
    isNight: typeof isNight;
    planRaids: typeof planRaids;
    goblinRaid: typeof goblinRaid;
    goblinSteal: typeof goblinSteal;
    darkPath: typeof darkPath;
  }
}

Object.assign(Ecology.prototype, { isNight, planRaids, goblinRaid, goblinSteal, darkPath });
