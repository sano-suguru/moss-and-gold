/**
 * Ecology のメソッド：ゴブリンの夜の盗み（冒険者の作り直しの二歩目）。
 *
 * 見せたい瞬間：夜、焚き火を囲んで休む一行のところへ、ゴブリンが暗がりから忍び寄り、
 * 食べ物か松明を盗んで暗がりへ逃げ帰る。見張りに見つかれば、手ぶらで逃げ帰る。
 *
 * 状態（ゴブリンの st）：15 忍び寄る（lure 狙う冒険者、lureAt 出た step 番号、tx/ty 光の縁の潜む所、gait 潜んで待つ残り）、
 * 16 逃げ帰る（盗んだ食べ物は袋 units に入れて、集落の蓄えへ）。
 *
 * 通路での掠め取り（ゴブリンの流れを短くする）：暗い通路を行く一行の最後尾に、集落のゴブリンが暗がりから忍び寄り、
 * 荷（食べ物）を掠め取って暗がりへ逃げる。最後尾の冒険者が気づいて「！」、一行は振り返る。
 * 状態：17 つける（lure 最後尾の冒険者、lureAt 出た step 番号、gait 0 以上はつけている更新の回数、-1 駆け寄る）→ 16 逃げ帰る。
 */
import { Camp, Cr, DAY_TICKS_ECO, Ecology, Job, Kind, Party, SPEC, ih, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 盗みに出る集落の、蓄えの乏しさ（蓄えの目安に対する割合） */
const RAID_STORE = 0.7;
/** 盗みに出る遠さ（集落から焚き火まで、マス）。焚き火の残りの時間で着ける所だけ（1マスあたり生き物の更新約25回で見積もる） */
const RAID_R = 80;
/** 通路での掠め取りに出る集落の、蓄えの乏しさ（蓄えの目安に対する割合。目安近くまで蓄えがあれば出ない） */
const SNATCH_STORE = 0.9;
/** 通路での掠め取りに出る遠さ（集落から最後尾の冒険者まで、マス） */
const SNATCH_R = 24;
/** 掠め取りをあきらめる長さ（つけはじめてからの生き物の更新の回数） */
const SNATCH_GIVEUP = 1000;
/** 通り道の脇で待ち伏せる長さ（生き物の更新の回数） */
const WATCH_STEPS = 2400;

export function isNight(this: Ecology): boolean {
  return this.phaseNow > 0.79 || this.phaseNow < 0.18;
}

/** 盗みに出る（updateCamps から、通常速度で5秒ごと）：夜、蓄えの乏しい集落のそば（40マス）で一行が焚き火を囲んでいれば、1〜3匹が忍び出る */
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

/** 一行の最後尾（生きている者のうち、並びのいちばん後ろ） */
export function partyTail(this: Ecology, p: Party): Cr | null {
  for (let i = p.members.length - 1; i >= 1; i--) {
    const o = this.byId.get(p.members[i]);
    if (o && !o.dead && !o.away) return o;
  }
  return null;
}

/**
 * 通路での掠め取りに出る（updateCamps のあと、通常速度で5秒ごと。昼も夜も）：蓄えが目安に足りない集落から、
 * 一行が焚き火を囲まずに近く（24マス、歩いて32マス）の暗い所を歩いていれば、1匹（ときどき2匹）が最後尾をつけに出る。
 * 一行が近くにいなければ（ただし50マスの内を歩いていれば）、冒険者の通り道（人の気配の濃い所）の脇の暗がり（道から6〜9マス）へ1匹が待ち伏せに出る
 */
export function planSnatch(this: Ecology): void {
  for (const cp of this.camps) {
    if (cp.id < 0 || cp.kind !== 0 || cp.hide || (cp.snatchT ?? 0) > this.w.tick) continue;
    if ((cp.store ?? 0) >= this.campStoreGoal(cp) * SNATCH_STORE) continue;
    const members = this.campMembers(cp);
    if (!members.length || members.some((c) => c.st === 15 || c.st === 16 || c.st === 17)) continue;
    let best: { p: Party; t: Cr } | null = null;
    let bd = SNATCH_R * TILE * SNATCH_R * TILE;
    for (const p of this.parties) {
      if ((p.camp ?? -1) >= 0 || p.members.length < 2) continue;
      // この集落を退治しに来た一行には近づかない
      if (p.aim === 5 && !p.aimEnd && p.aimId === cp.id) continue;
      const t = this.partyTail(p);
      if (!t) continue;
      const d = sq(t.x - cp.x) + sq(t.y - cp.y);
      // すぐそば（9マス）の一行は、集落の見張り（watchCamps）が扱う。日の差す所や光る苔の明るい所では出ない
      if (d >= bd || d < 9 * TILE * 9 * TILE || this.lit(this.tileOf(t.x, t.y), this.day) > 0.35) continue;
      bd = d;
      best = { p, t };
    }
    // 松明を持つ者は出ない（暗がりに紛れられない）
    const ready = members.filter((c) => c.flee <= 0 && c.sleep === 0 && !c.away && c.torch <= 0 && (c.st === 0 || c.st === 3 || c.st === 4) && c.hungry < SPEC[Kind.Goblin].starve * 0.6 && c.units < 10);
    if (!ready.length) continue;
    // 歩いて遠い（回り道で32マスより先の）一行は追わない
    if (best && this.walkDist(this.tileOf(cp.x, cp.y), 32)[this.tileOf(best.t.x, best.t.y)] < 0) best = null;
    if (!best) {
      // 待ち伏せに出るのは、一行がそう遠くない所（50マス）を歩いているときだけ
      if (this.parties.some((q) => (q.camp ?? -1) < 0 && q.members.some((id) => {
        const o = this.byId.get(id);
        return !!o && !o.dead && sq(o.x - cp.x) + sq(o.y - cp.y) < 50 * TILE * 50 * TILE;
      }))) this.sendWatchers(cp, ready);
      continue;
    }
    const { p, t } = best;
    ready.sort((a, b) => sq(a.x - t.x) + sq(a.y - t.y) - (sq(b.x - t.x) + sq(b.y - t.y)) || a.id - b.id);
    const n = Math.min(ready.length, ih(cp.id, this.step, 290) % 4 === 0 ? 2 : 1);
    for (let i = 0; i < n; i++) {
      const c = ready[i];
      c.st = 17;
      c.lure = t.id;
      c.lureAt = this.step;
      c.tx = 0;
      c.ty = 0;
      c.gait = 0;
      c.ref2 = 0;
    }
    cp.snatchT = this.w.tick + DAY_TICKS_ECO / 8;
    this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'stalk', n, to: p.id, x: Math.round(t.x), y: Math.round(t.y) } as never);
    if (this.step - (this.lastLogged[980] ?? -99999) > 1500) {
      this.lastLogged[980] = this.step;
      this.log(cp.x, cp.y, `{k:${Kind.Goblin}}が、通路を行く冒険者の一行の後ろを、暗がりからつけはじめた`);
    }
  }
}

/** 待ち伏せの場所：集落から歩いて40マスまでの、冒険者の通り道から6〜9マス脇の暗い床（集落にいちばん近い所）。なければ -1 */
export function snatchSpot(this: Ecology, cp: Camp): number {
  const m = this.w.map;
  const wd = this.walkDist(this.tileOf(cp.x, cp.y), 40);
  const route = this.routeDist(10);
  let best = -1;
  let bd = 1e9;
  for (let k = 0; k < wd.length; k++) {
    if (wd[k] < 0 || wd[k] >= bd || route[k] < 6 || route[k] > 9) continue;
    if (m.lava[k] || this.w.water[k] > 20 || this.lit(k, this.day) > 0.3 || this.inKoboldLand((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8)) continue;
    bd = wd[k];
    best = k;
  }
  return best;
}

/** 待ち伏せに出す（planSnatch から）：1匹が、通り道の脇の暗がりで一行を待つ（ゲーム内の約6分の1日） */
export function sendWatchers(this: Ecology, cp: Camp, ready: Cr[]): void {
  const m = this.w.map;
  const k = this.snatchSpot(cp);
  // 待ち伏せできる所がなければ、しばらく（ゲーム内の1/8日）見送る
  cp.snatchT = this.w.tick + DAY_TICKS_ECO / 8;
  if (k < 0) return;
  const x = (k % m.w) * TILE + 8;
  const y = Math.floor(k / m.w) * TILE + 8;
  ready.sort((a, b) => sq(a.x - x) + sq(a.y - y) - (sq(b.x - x) + sq(b.y - y)) || a.id - b.id);
  const n = 1;
  for (let i = 0; i < n; i++) {
    const c = ready[i];
    c.st = 17;
    c.lure = 0;
    c.lureAt = this.step;
    c.tx = x + (i ? 10 : 0);
    c.ty = y;
    c.gait = 0;
    c.ref2 = 0;
  }
  // 待ち伏せのあいだと、帰ってからしばらくは出ない
  cp.snatchT = this.w.tick + WATCH_STEPS + DAY_TICKS_ECO / 8;
  this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'ambush', n, x, y } as never);
}

/**
 * 通路での掠め取りの最中のゴブリン（st 17。lurk の初めから）。true なら、この回の更新はこれで終わり。
 * 1. 一行の灯りの外（6〜8マス後ろ）を、暗がりを選んでつける。灯りの中に入ってしまったら下がる
 * 2. 一行が歩いているとき、ときどき（つけはじめて生き物の更新30回より後）最後尾へ駆け寄る
 * 3. 最後尾の荷から食べ物を掠め取り、暗がりへ逃げ帰る（st 16）。最後尾が気づいて「！」、一行が振り返る
 */
export function goblinSnatch(this: Ecology, c: Cr): boolean {
  const s = SPEC[Kind.Goblin];
  const cp = this.campOf(c);
  let t = this.byId.get(c.lure);
  const p = t ? this.parties.find((q) => q.id === t!.party) : undefined;
  const giveUp = () => {
    c.st = 16;
    c.lure = 0;
    c.gait = 0;
    return this.goblinRaid(c);
  };
  if (!cp || cp.kind !== 0) {
    c.st = 0;
    c.lure = 0;
    return false;
  }
  // 0. 通り道の脇の暗がりで待ち伏せる：一行の最後尾が近く（12マス、暗い所）を通れば、つけはじめる。長く来なければ帰る
  if (!c.lure) {
    if (this.step - c.lureAt > WATCH_STEPS || c.hungry > s.starve * 0.6) return giveUp();
    if (this.step % 5 === c.id % 5) {
      for (const q of this.parties) {
        if ((q.camp ?? -1) >= 0 || q.members.length < 2 || (q.aim === 5 && !q.aimEnd && q.aimId === cp.id)) continue;
        const tl = this.partyTail(q);
        if (!tl || this.lit(this.tileOf(tl.x, tl.y), this.day) > 0.35) continue;
        const dt = sq(tl.x - c.x) + sq(tl.y - c.y);
        // 一行が近く（30マス）にいれば、暗がりづたいに寄っていく（待ち伏せの場所を、一行の来る方へ移す）
        if (dt > 12 * TILE * 12 * TILE) {
          if (dt < 30 * TILE * 30 * TILE) {
            c.tx = Math.round(tl.x);
            c.ty = Math.round(tl.y);
          }
          continue;
        }
        c.lure = tl.id;
        c.lureAt = this.step;
        c.gait = 0;
        this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'stalk', n: 1, to: q.id, how: 'ambush', x: Math.round(tl.x), y: Math.round(tl.y) } as never);
        if (this.step - (this.lastLogged[980] ?? -99999) > 1500) {
          this.lastLogged[980] = this.step;
          this.log(c.x, c.y, `暗がりで待ち伏せていた{k:${Kind.Goblin}}が、通り過ぎる冒険者の一行の後ろをつけはじめた`);
        }
        return true;
      }
    }
    if (sq(c.tx - c.x) + sq(c.ty - c.y) > 0.7 * TILE * 0.7 * TILE) {
      c.act = 1;
      this.goTo(c, c.tx, c.ty, s.speed * 1.2);
    } else c.act = 0;
    return true;
  }
  // 一行が焚き火を囲んだか、見失ったか、長くかかりすぎたら、手ぶらで帰る
  if (!t || t.dead || t.away || !p || (p.camp ?? -1) >= 0 || this.step - c.lureAt > SNATCH_GIVEUP) return giveUp();
  // 最後尾が入れ替わったら（倒れた者がいれば）、いまの最後尾をつける
  const tail = this.partyTail(p);
  if (!tail) return giveUp();
  if (tail !== t) {
    t = tail;
    c.lure = t.id;
  }
  const d2 = sq(t.x - c.x) + sq(t.y - c.y);
  const lights = this.partyLights(p);
  let inLight = false;
  for (const l of lights) if (sq(c.x - l.x) + sq(c.y - l.y) < 5.5 * TILE * 5.5 * TILE) inLight = true;
  if (c.gait >= 0) {
    c.gait++;
    // 見つかる：灯りの中に入ってしまい、そちらを向いた者（盗賊と狩人は向きによらず）に見られると、ときどき気づかれる
    if (inLight && this.step % 4 === c.id % 4) {
      for (const id of p.members) {
        const a = this.byId.get(id);
        if (!a || a.dead || !this.seenBy(a, lights, c)) continue;
        const sharp = a.sp === Job.Thief || a.sp === Job.Hunter;
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const front = a.dir === 0 ? dy > -4 : a.dir === 1 ? dy < 4 : a.dir === 2 ? dx > -4 : dx < 4;
        if (!front && !sharp) continue;
        if (dx * dx + dy * dy > 4.5 * TILE * 4.5 * TILE || ih(c.id, this.step, 291) % (sharp ? 6 : 14) !== 0) continue;
        this.fxMarks.push({ t: this.w.tick, id: a.id, m: '!' });
        this.fxMarks.push({ t: this.w.tick, id: c.id, m: '!' });
        if (this.fxMarks.length > 120) this.fxMarks.splice(0, 40);
        this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: cp.id, ev: 'spotted', n: a.sp, how: 'snatch', x: Math.round(c.x), y: Math.round(c.y) } as never);
        return giveUp();
      }
    }
    // 2. 一行が歩いていて、すぐ後ろ（5マス）まで寄れたら、ときどき駆け寄る（最後尾が灯りの縁近く＝灯りを持つ者から離れていれば、なおさら）
    const lead = this.byId.get(p.members[0]);
    const moving = !!lead && lead.act === 1 && (p.braceT ?? 0) <= this.step && (p.listenT ?? 0) <= this.step;
    let edge = true;
    for (const l of lights) if (l !== t && sq(t.x - l.x) + sq(t.y - l.y) < 1.5 * TILE * 1.5 * TILE) edge = false;
    if (lights.includes(t) && lights.length === 1) edge = false;
    // 最後尾が日の差す所や光る苔の明るい所にいるあいだは、駆け寄らない（暗い通路でだけ）
    const dark = this.lit(this.tileOf(t.x, t.y), this.day) <= 0.35 && this.lit(this.tileOf(c.x, c.y), this.day) <= 0.35;
    if (c.gait > 20 && moving && dark && d2 < 5 * TILE * 5 * TILE && ih(c.id, this.step, 292) % (edge ? 5 : 12) === 0) c.gait = -1;
    else {
      // 1. 灯りの縁の外を、すぐ後ろ（3.5マスまで）からつける。灯りの中に入ってしまったら下がる
      if (inLight) {
        c.act = 1;
        const L = Math.sqrt(d2) || 1;
        this.tryMove(c, ((c.x - t.x) / L) * s.speed, ((c.y - t.y) / L) * s.speed);
      } else if (d2 > 3.5 * TILE * 3.5 * TILE) {
        c.act = 1;
        // 遠いうちは小走りで追いつき（一行の歩みより速く）、近づいたら一行の歩みに合わせる
        this.goTo(c, t.x, t.y, s.speed * (d2 > 8 * TILE * 8 * TILE ? 1.45 : 1.0));
      } else {
        c.act = 0;
        c.dir = Math.abs(t.x - c.x) > Math.abs(t.y - c.y) ? (t.x > c.x ? 2 : 3) : t.y > c.y ? 0 : 1;
      }
      return true;
    }
  }
  // 3. 最後尾へ駆け寄って、荷から食べ物を掠め取る（すばやく：一行の歩みの2倍より速く）
  c.gait--;
  if (c.gait < -80) return giveUp();
  c.act = 1;
  if (d2 < 14 * 14) {
    c.ref2 = this.goblinSteal(c, t, cp, true, 'snatch');
    c.st = 16;
    c.lure = 0;
    c.gait = 0;
    // 最後尾が気づいて「！」。一行は立ち止まって、逃げていく方へ振り返る
    this.fxMarks.push({ t: this.w.tick, id: t.id, m: '!' });
    this.fxMarks.push({ t: this.w.tick, id: c.id, m: '!' });
    if (this.fxMarks.length > 120) this.fxMarks.splice(0, 40);
    this.brace(p, c.x, c.y, 3, 14);
    // 逃げていく者は追わない（弱い者が逃げていく）
    c.flee = 40;
    c.foe = t.id;
    return true;
  }
  if (d2 < 4 * TILE * 4 * TILE) this.moveToward(c, t.x, t.y, s.speed * 2.2);
  else this.goTo(c, t.x, t.y, s.speed * 2.2);
  return true;
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

/** 盗みの最中のゴブリン（lurk の初めから）。true なら、この回の更新はこれで終わり */
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
    if (c.gait <= 0) {
      // 見張りが起きていれば、うとうとするのを待つ（眠りの印が出たら駆け寄る）。せっかちな者（8匹に1匹）と、待ちくたびれた者は待たずに駆け寄る
      const watcher = this.byId.get(p.members[0]);
      const patient = ih(c.id, c.lureAt, 274) % 8 !== 0;
      c.gait = patient && watcher && !watcher.dead && !this.watchDozing(p) && this.step - c.lureAt < 2600 ? 1 : -1;
    }
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
export function goblinSteal(this: Ecology, c: Cr, t: Cr, camp: Camp | undefined, bag: boolean, how?: string): number {
  const bold = !!camp && this.campChief(camp);
  const room = bag ? 40 - c.units : SPEC[Kind.Goblin].cap - c.food;
  const take = Math.max(0, Math.min(bold ? 30 : 20, Math.max(0, t.food - 5), room));
  t.food -= take;
  if (bag) c.units += take;
  else c.food += take;
  let torch = 0;
  // 通路での掠め取りは、荷の食べ物だけ（手に掲げた松明は取れない）
  if (how !== 'snatch' && t.torch > 0 && c.torch <= 0) {
    c.torch = t.torch;
    t.torch = 0;
    torch = 1;
  }
  const tp = this.parties.find((q) => q.id === t.party);
  if (tp && (take > 0 || torch)) {
    tp.robbed = (tp.robbed ?? 0) + 1;
    tp.robX = Math.round(t.x);
    tp.robY = Math.round(t.y);
    // 盗みを働いた集落（逃げ帰る先）。生きて帰れば、町に「どこの集落のゴブリンか」が伝わる
    if (camp && camp.id >= 0 && camp.kind === 0) {
      tp.robCamp = camp.id;
      tp.robCX = Math.round(camp.x);
      tp.robCY = Math.round(camp.y);
    }
    this.record('settle', { t: this.w.tick, k: Kind.Goblin, id: camp?.id ?? -1, ev: 'rob', n: take, how: how ?? (bag ? 'raid' : 'lurk'), to: torch, doze: this.watchDozing(tp) ? 1 : 0, x: Math.round(t.x), y: Math.round(t.y) } as never);
  }
  if (this.step - (this.lastLogged[997] ?? -99999) > 3000) {
    this.lastLogged[997] = this.step;
    this.log(c.x, c.y, how === 'snatch' ? `{k:${Kind.Goblin}}が暗がりから駆け寄り、一行の最後尾の冒険者の荷から食べ物を掠め取って逃げた` : torch ? `{k:${Kind.Goblin}}が冒険者の松明と荷物を盗んで、暗がりへ逃げた` : `{k:${Kind.Goblin}}が冒険者の荷物を盗んで、暗がりへ逃げた`);
  }
  return take;
}

/** 焚き火の見張りがうとうとしているか（眠りの印が出て、忍び寄る者に気づかない） */
export function watchDozing(this: Ecology, p: Party): boolean {
  return (p.camp ?? -1) >= 0 && (p.dozeT ?? 0) > this.step;
}

/**
 * 焚き火の見張りは、ずっと起きてはいられない：起きている間（通常速度で約20〜45秒）と、うとうとする間（約10〜20秒）を繰り返す。
 * updateParties から、焚き火を囲んでいる一行について生き物の更新ごと
 */
export function watchDoze(this: Ecology, p: Party): void {
  if ((p.dozeNext ?? 0) === 0) p.dozeNext = this.step + 150 + (ih(p.id, this.step, 281) % 250);
  if (this.step < (p.dozeNext ?? 0)) return;
  p.dozeT = this.step + 90 + (ih(p.id, this.step, 282) % 120);
  p.dozeNext = p.dozeT + 180 + (ih(p.id, this.step, 283) % 260);
  const lead = this.byId.get(p.members[0]);
  this.record('settle', { t: this.w.tick, k: Kind.Adventurer, id: p.id, ev: 'doze', n: p.dozeT - this.step, x: Math.round(lead?.x ?? 0), y: Math.round(lead?.y ?? 0) } as never);
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
    watchDozing: typeof watchDozing;
    watchDoze: typeof watchDoze;
    partyTail: typeof partyTail;
    planSnatch: typeof planSnatch;
    goblinSnatch: typeof goblinSnatch;
    snatchSpot: typeof snatchSpot;
    sendWatchers: typeof sendWatchers;
  }
}

Object.assign(Ecology.prototype, { isNight, planRaids, goblinRaid, goblinSteal, darkPath, watchDozing, watchDoze, partyTail, planSnatch, goblinSnatch, snatchSpot, sendWatchers });
