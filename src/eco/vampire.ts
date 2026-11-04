/** Ecology のメソッド：ヴァンパイア（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';

/** ヴァンパイアの状態（st）：コウモリの群れにばらけて飛んでいる */
export const VAMP_SCATTER = 40;
/** ヴァンパイアの状態（st）：昼のあいだ、住処の棺の中で眠っている */
export const VAMP_COFFIN = 41;
/** ばらけて逃げられる間隔（生き物の更新の回数。ゲーム内の1日） */
const SCATTER_EVERY = DAY_TICKS_ECO / CR_EVERY;

/** ヴァンパイアが血を吸う獲物 */
const VAMP_PREY = new Set<number>([Kind.Rat, Kind.Goblin, Kind.Kobold, Kind.Lizardman, Kind.Adventurer]);

export function vampire(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Vampire];
  if (this.leaveIfStarving(c)) return;
  const m = this.w.map;
  const k = this.tileOf(c.x, c.y);
  // 近くのコウモリを従える
  if (this.step % 25 === c.id % 25) {
    this.nearby(c.x, c.y, 12, (o) => {
      if (o.k === Kind.Bat && !o.dead && !o.away && o.ref2 === 0) o.ref2 = c.id;
    });
  }
  if (c.act === 2 && c.actT < 4) return;
  // 光を嫌う：日の光と溶岩の照り返し。光る苔のほのかな明かりは、夜の通り道としてなら通れる程度に軽く数える
  const lightAt = (q: number) => (q < 0 ? 0 : this.w.lightBase[q] * day + this.w.mossGlow[q] * 500 + this.w.lavaGlow[q] * 1500);
  // 歩くときに手前で止まるのは、日の光だけ（夜に光る苔や溶岩の照り返しの手前で止まると、住処へ帰れずにその場で動けなくなっていた）
  const sunAt = (q: number) => (q < 0 ? 0 : this.w.lightBase[q] * day);
  if (lightAt(k) > 60) {
    let best = k;
    for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (q >= 0 && q < m.solid.length && !m.solid[q] && lightAt(q) < lightAt(best)) best = q;
    c.act = 1;
    this.moveToward(c, (best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, s.speed * 1.3);
    return;
  }
  // 火の明かり（松明、焚き火、かがり火）にも近寄らない：明かりの輪の2マス外までに入ったら、火から離れる。
  // 明かりの中ではコウモリにばらけて逃げられないので、松明を掲げた冒険者に追い詰められると倒される（vampCanScatter）。
  // 冒険者の焚き火が細っていれば、その焚き火は怖がらない（src/eco/night.ts の weakCampAt）
  for (const f of this.fires()) {
    const R = f[2] + 2 * TILE;
    const d2 = sq(c.x - f[0]) + sq(c.y - f[1]);
    if (d2 >= R * R || this.weakCampAt(f[0], f[1])) continue;
    const L = Math.sqrt(d2) || 1;
    c.act = 1;
    c.ref = 0;
    this.tryMove(c, ((c.x - f[0]) / L) * s.speed * 1.3, ((c.y - f[1]) / L) * s.speed * 1.3);
    return;
  }
  // 起きている冒険者の一行（7マス以内）からは、打ちかかられる前に退く（死ぬのはたいてい、松明を持つ一行に見つかったとき）。
  // 焚き火で眠っている者は避けない（寝込みを狙う）。打たれて間もないときは、退かずに打ち合う
  if (this.w.tick - c.hitAt > 60) {
    let ax = 0;
    let ay = 0;
    let n = 0;
    this.nearby(c.x, c.y, 7, (o) => {
      if (o.k !== Kind.Adventurer || o.dead || o.away || o.sleep > 0 || sq(o.x - c.x) + sq(o.y - c.y) > sq(7 * TILE)) return;
      ax += o.x;
      ay += o.y;
      n++;
    });
    if (n) {
      ax /= n;
      ay /= n;
      const L = Math.hypot(c.x - ax, c.y - ay) || 1;
      c.act = 1;
      c.ref = 0;
      const x0 = c.x;
      const y0 = c.y;
      this.tryMove(c, ((c.x - ax) / L) * s.speed * 1.3, ((c.y - ay) / L) * s.speed * 1.3);
      // 行き止まりなら住処の方へ
      if (c.x === x0 && c.y === y0) this.goTo(c, c.hx, c.hy, s.speed * 1.3);
      return;
    }
  }
  if (day > 0.05) {
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 12 * 12) {
      c.act = 1;
      const x0 = c.x;
      const y0 = c.y;
      this.goTo(c, c.hx, c.hy, s.speed);
      // 帰り道の次の一歩が明るい所なら、進まずに暗がりで日が落ちるのを待つ
      // （以前は明るい所へ一歩出ては光を嫌って戻り、その場で行ったり来たりしていた）
      if (sunAt(this.tileOf(c.x, c.y)) > 60) {
        c.x = x0;
        c.y = y0;
        c.act = 0;
      }
    } else c.act = 0;
    return;
  }
  // 夜は暗がりを歩いて、温かい血の生き物を狩る。
  // 偵察：従えるコウモリが多いほど遠くの獲物まで見つける（コウモリ1匹ごとに4マス、10マスから30マスまで）。
  // 獲物を決めたら（c.ref に獲物の番号）、コウモリはまずその上を旋回し、ヴァンパイアが近づくと獲物に群がって足止めする（batPinned）
  // 夜明け前（1日の 0.1〜0.2）には狩りをやめて住処へ帰りはじめる（夜が明けると、帰り道の明るい所の手前で動けなくなり、そこで冒険者に見つかっていた）
  const predawn = this.phaseNow >= 0.1 && this.phaseNow < 0.2;
  if (c.food < s.cap * 0.7 && !predawn) {
    // 眷属を連れている間は、強い獲物（オーク、ドワーフ）も狙う
    let thr = -1;
    const withThralls = () => {
      if (thr < 0) {
        thr = 0;
        for (const o of this.list) if (o.k === Kind.Thrall && !o.dead && o.ref2 === c.id) thr++;
      }
      return thr > 0;
    };
    const ok = (o: Cr) => {
      if (o.dead || o.away) return false;
      if (!VAMP_PREY.has(o.k) && !((o.k === Kind.Orc || o.k === Kind.Dwarf) && withThralls())) return false;
      if (lightAt(this.tileOf(o.x, o.y)) > 60) return false;
      // 火の明かりの中の獲物は狙わない。冒険者の焚き火は、細るのを待つ（src/eco/night.ts の campFire）
      return !(this.fireNear(o.x, o.y) && !this.weakCampAt(o.x, o.y));
    };
    // 獲物を決めた（またはあきらめた）step を lure に持つ。決めてから生き物の更新240回たっても仕留められなければあきらめ、
    // そのあと60回は次の獲物を探さない（明るい所の手前で待ち続けて、コウモリに群がられた獲物がいつまでも足止めされていた）
    let prey: Cr | null = c.ref ? this.byId.get(c.ref) ?? null : null;
    if (prey && (!ok(prey) || this.step - c.lure > 240)) {
      if (ok(prey)) c.lure = this.step;
      prey = null;
    }
    if (!prey) c.ref = 0;
    if (!prey && this.step % 10 === c.id % 10 && this.step - c.lure > 60) {
      let fol = 0;
      for (const b of this.list) if (b.k === Kind.Bat && !b.dead && !b.away && b.ref2 === c.id) fol++;
      const R = 10 + 4 * Math.min(5, fol);
      let bd = R * TILE * R * TILE;
      this.nearby(c.x, c.y, R, (o) => {
        if (!ok(o)) return;
        // 焚き火で眠っている冒険者は、近くにいるものとして好んで狙う（src/eco/night.ts）
        const d = (sq(o.x - c.x) + sq(o.y - c.y)) * (this.campSleeper(o) ? 0.25 : 1);
        if (d < bd) {
          bd = d;
          prey = o;
        }
      });
      if (prey) {
        c.ref = (prey as Cr).id;
        c.lure = this.step;
        // 分析用：コウモリ（2匹以上）が見つけた獲物の上を旋回しはじめた
        if (fol >= 2) this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'scout', id: c.id, n: (prey as Cr).k, x: Math.round((prey as Cr).x), y: Math.round((prey as Cr).y) } as never);
      }
    }
    if (prey) {
      const p = prey as Cr;
      c.act = 1;
      if (sq(p.x - c.x) + sq(p.y - c.y) < 11 * 11) {
        // 一口では食べず、打ち合って仕留める（src/eco/combat.ts の hunt と同じ）
        // 分析用：コウモリに群がられて足止めされた獲物に、ヴァンパイアが打ちかかった（獲物ごとに1回）
        if (this.batPinned(p) && c.gait !== p.id) {
          c.gait = p.id;
          this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'pin', id: c.id, n: p.k, x: Math.round(p.x), y: Math.round(p.y) } as never);
        }
        const won = this.fight(c, p);
        // 獲物の分け前を、従うコウモリに与える
        if (won) {
          c.ref = 0;
          this.nearby(c.x, c.y, 6, (b) => {
            if (b.k !== Kind.Bat || b.dead || b.ref2 !== c.id || c.food <= 20) return;
            const t = Math.min(6, SPEC[Kind.Bat].cap - b.food, c.food - 20);
            if (t > 0) {
              b.food += t;
              c.food -= t;
              b.sinceMeal = 0;
            }
          });
        }
      } else {
        const x0 = c.x;
        const y0 = c.y;
        this.goTo(c, p.x, p.y, s.speed * 1.2);
        // 明るい所へは踏み込まない（手前で待つ）
        if (sunAt(this.tileOf(c.x, c.y)) > 60) {
          c.x = x0;
          c.y = y0;
          c.act = 0;
        }
      }
      return;
    }
    // 近くに獲物がいなければ、いちばん近い獲物の方へ遠出する（行き先は tx, ty。生き物の更新50回ごとに選び直す）
    if (this.step % 50 === c.id % 50 || !c.tx) {
      let bd = 1e18;
      c.tx = 0;
      for (const o of this.list) {
        // 遠出は住処から45マス以内の獲物まで（遠くへ行くほど、夜明けまでに帰れなくなる）
        if (!ok(o) || sq(o.x - c.hx) + sq(o.y - c.hy) > sq(45 * TILE)) continue;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < bd) {
          bd = d;
          c.tx = o.x;
          c.ty = o.y;
        }
      }
    }
    if (c.tx) {
      c.act = 1;
      const x0 = c.x;
      const y0 = c.y;
      this.goTo(c, c.tx, c.ty, s.speed);
      if (sunAt(this.tileOf(c.x, c.y)) > 60) {
        c.x = x0;
        c.y = y0;
        c.act = 0;
      }
      return;
    }
  } else c.ref = 0;
  c.act = 1;
  // 腹が満ちているか夜明け前で、住処から遠ければ、暗がりを通って住処へ帰る（明るい所の手前では待つ）。飢えていれば、暗がりをさまよって獲物を探す
  if ((c.food >= s.cap * 0.7 || predawn) && sq(c.hx - c.x) + sq(c.hy - c.y) > sq(8 * TILE)) {
    const x0 = c.x;
    const y0 = c.y;
    this.goTo(c, c.hx, c.hy, s.speed);
    if (sunAt(this.tileOf(c.x, c.y)) > 60) {
      c.x = x0;
      c.y = y0;
      c.act = 0;
    }
    return;
  }
  const j = DIR16[ih(c.id, this.step >> 5, 114) & 15];
  const nk = this.tileOf(c.x + j[0] * 10, c.y + j[1] * 10);
  if (lightAt(nk) <= 60) this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
  else c.act = 0;
}

/**
 * やられそうになったヴァンパイアが、コウモリの群れにばらけて逃げられるか：1日に1回まで（最後にばらけた step を lureAt に持つ）。
 * 日の光や、据えた大きな火（焚き火、かがり火、炉、入口の灯り）の明かりの中ではばらけられず、そのまま倒される。
 * 松明の明かりではばらけられる（松明でも封じると、松明を持つ冒険者の一行にほぼ必ず倒され、1日もたずにいなくなっていた）
 */
export function vampCanScatter(this: Ecology, c: Cr): boolean {
  if (c.k !== Kind.Vampire || c.dead || c.st === VAMP_SCATTER) return false;
  if (this.step - c.lureAt < SCATTER_EVERY) return false;
  if (this.sunlit(this.tileOf(c.x, c.y), this.dayNow)) return false;
  for (const f of this.fires()) {
    if (sq(f[0] - c.x) + sq(f[1] - c.y) >= f[2] * f[2] || f[2] < 3 * TILE) continue;
    return false;
  }
  return true;
}

/** コウモリの群れにばらける：姿が消え、群れが住処へ飛んでいく。その間は誰にも狙われない（away として扱う） */
export function vampScatter(this: Ecology, c: Cr): void {
  c.st = VAMP_SCATTER;
  c.away = true;
  c.lureAt = this.step;
  c.ref = 0;
  c.flee = 0;
  c.feed = 0;
  c.act = 1;
  this.paths.delete(c.id);
  this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'scatter', id: c.id, x: Math.round(c.x), y: Math.round(c.y) } as never);
  this.log(c.x, c.y, `追い詰められた{k:${Kind.Vampire}}が、コウモリの群れにばらけて飛び去った`);
}

/** ばらけた群れの飛行：住処へ飛び、着いたら（または生き物の更新600回たったら）姿を戻す。体力は半分まで戻る */
export function vampFly(this: Ecology, c: Cr): void {
  c.act = 1;
  const home = c.hx || c.hy;
  const arrived = !home || this.goTo(c, c.hx, c.hy, 2.2) || sq(c.hx - c.x) + sq(c.hy - c.y) < 12 * 12;
  if (arrived || this.step - c.lureAt > 600) {
    if (!this.tilePassable({ ...c, st: 0 } as Cr, this.tileOf(c.x, c.y))) return;
    c.st = 0;
    c.away = false;
    c.hp = Math.max(c.hp, this.maxHp(c) * 0.5);
    c.act = 0;
    this.paths.delete(c.id);
    this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'reform', id: c.id, x: Math.round(c.x), y: Math.round(c.y) } as never);
  }
}

/**
 * 棺：昼、住処（hx, hy）に戻ったヴァンパイアは棺に入って蓋を閉め、日が暮れると出てくる。
 * 棺の中の間は誰にも狙われない（away として扱う）。ただし、僧侶か竜殺しの冒険者が棺のそば（2マス以内）まで来ると、
 * 蓋が暴かれて、ヴァンパイアはその場で起き上がって打ち合う。棺はヴァンパイアが生きている間、住処にある（描画は src/creatureView.ts）。
 * true なら、今は棺の中（ほかの行いをしない）
 */
export function vampCoffin(this: Ecology, c: Cr): boolean {
  if (c.st === VAMP_COFFIN) {
    let opener: Cr | null = null;
    this.nearby(c.x, c.y, 2, (o) => {
      if (o.k === Kind.Adventurer && !o.dead && !o.away && o.sleep === 0 && (o.sp === Job.Priest || o.sp === Job.Slayer) && sq(o.x - c.x) + sq(o.y - c.y) < sq(2 * TILE)) opener = o;
    });
    if (this.dayNow > 0.05 && !opener) {
      c.sleep = 2;
      c.act = 0;
      return true;
    }
    // 棺で眠ったので眠気は消える（眠りの処理 doSleep を通らないので、ここで消す。消さないと夜の帰り道で眠り込んでいた）
    c.drowsy = 0;
    c.st = 0;
    c.away = false;
    c.sleep = 0;
    c.act = 0;
    if (opener) {
      const o = opener as Cr;
      c.foe = o.id;
      c.hitAt = this.w.tick;
      this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'coffinOpened', id: c.id, n: o.sp, x: Math.round(c.x), y: Math.round(c.y) } as never);
      this.log(c.x, c.y, `冒険者が{k:${Kind.Vampire}}の棺を暴いた`);
    }
    return false;
  }
  if (c.st === 0 && !c.dead && !c.away && this.dayNow > 0.05 && (c.hx || c.hy) && sq(c.hx - c.x) + sq(c.hy - c.y) < 14 * 14 && this.w.tick - c.hitAt > 120) {
    c.st = VAMP_COFFIN;
    c.away = true;
    c.x = c.hx;
    c.y = c.hy;
    c.ref = 0;
    c.feed = 0;
    c.flee = 0;
    c.sleep = 2;
    c.act = 0;
    this.paths.delete(c.id);
    return true;
  }
  return false;
}

/**
 * ヴァンパイアの住処：縦穴 (tx, ty) から40マス以内で、歩いて洞窟の本体へ出られる、壁を背にした、昼でも暗い床のマス（まっすぐ測っていちばん近いもの）。
 * 従うコウモリがその天井にぶら下がる。なければ -1
 */
export function vampLair(this: Ecology, tx: number, ty: number): number {
  const m = this.w.map;
  const sx = Math.floor(tx / TILE);
  const sy = Math.floor(ty / TILE);
  const main = this.regionOf(1 * m.w + m.entrance.x + 1);
  let best = -1;
  let bd = 1e9;
  for (let dy = -40; dy <= 40; dy++)
    for (let dx = -40; dx <= 40; dx++) {
      const x = sx + dx;
      const y = sy + dy;
      if (x < 1 || y < 2 || x >= m.w - 1 || y >= m.h - 1) continue;
      const d = dx * dx + dy * dy;
      if (d >= bd || d < 9) continue;
      const k = y * m.w + x;
      if (m.solid[k] || !m.solid[k - m.w] || m.lava[k] || m.maze[k] || this.w.water[k] > 10) continue;
      if (this.w.lightBase[k] > 20 || this.w.lightBase[k - m.w] > 40 || this.w.mossGlow[k] > 0.03 || this.w.lavaGlow[k] > 0.02) continue;
      if (this.regionOf(k) !== main) continue;
      best = k;
      bd = d;
    }
  return best;
}

/** いま獲物を決めているヴァンパイアの番号（生き物の更新ごとに、その回で最初に聞かれたときに探す。セーブしない） */
const lordCache = new WeakMap<Ecology, { step: number; id: number }>();

/**
 * o がコウモリに群がられて足止めされているか：ヴァンパイアが o を獲物に決めていて、6マス以内まで近づき、
 * 従えるコウモリが2匹以上 o にまとわりついている（20px 以内）。足止めされた者は逃げられず（src/eco/step.ts）、打ち返しも弱い（src/eco/combat.ts の fight）
 */
export function batPinned(this: Ecology, o: Cr): boolean {
  if (!this.counts[Kind.Vampire] || !VAMP_PREY.has(o.k) || o.dead) return false;
  let lc = lordCache.get(this);
  if (!lc || lc.step !== this.step) {
    lc = { step: this.step, id: 0 };
    for (const c of this.list) if (c.k === Kind.Vampire && !c.dead && !c.away && c.ref) lc.id = c.id;
    lordCache.set(this, lc);
  }
  const v = lc.id ? this.byId.get(lc.id) : undefined;
  if (!v || v.dead || v.ref !== o.id || sq(v.x - o.x) + sq(v.y - o.y) > sq(6 * TILE)) return false;
  let n = 0;
  this.nearby(o.x, o.y, 2, (b) => {
    if (b.k === Kind.Bat && !b.dead && b.ref2 === v.id && sq(b.x - o.x) + sq(b.y - o.y) < 20 * 20) n++;
  });
  return n >= 2;
}

declare module '../ecology' {
  interface Ecology {
    vampire: typeof vampire;
    batPinned: typeof batPinned;
    vampLair: typeof vampLair;
    vampCanScatter: typeof vampCanScatter;
    vampScatter: typeof vampScatter;
    vampFly: typeof vampFly;
    vampCoffin: typeof vampCoffin;
  }
}

Object.assign(Ecology.prototype, { vampire, batPinned, vampLair, vampCanScatter, vampScatter, vampFly, vampCoffin });
