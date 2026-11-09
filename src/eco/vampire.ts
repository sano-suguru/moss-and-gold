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

/** 狩りに出る腹の減り方：胃の中が4割を切ったら（以前は7割。長く居つくようになって、獲物を倒しすぎていた） */
const HUNT_BELOW = 0.4;

/** ヴァンパイアが血を吸う獲物 */
const VAMP_PREY = new Set<number>([Kind.Rat, Kind.Goblin, Kind.Kobold, Kind.Lizardman, Kind.Adventurer]);

export function vampire(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Vampire];
  if (this.leaveIfStarving(c)) return;
  // 技の溜めと、血を吸っているあいだ（src/eco/vampskill.ts）
  if (this.vampSkill(c)) return;
  const m = this.w.map;
  const k = this.tileOf(c.x, c.y);
  // 近くのコウモリを従える。従えるのは RETINUE_MAX 匹まで
  // （以前は上限がなく、コウモリの多いシードでは26匹ほどが狭い住処で主の周りに押し合っていた。偵察の遠さは5匹で上限に届き、
  //  足止めは2匹からできるので、それより多い分は群れの見た目にしか効かない。渦を巻いて見える数は残す）
  if (this.step % 25 === c.id % 25) {
    let n = 0;
    for (const o of this.list) if (o.k === Kind.Bat && !o.dead && o.ref2 === c.id) n++;
    this.nearby(c.x, c.y, 12, (o) => {
      if (n < RETINUE_MAX && o.k === Kind.Bat && !o.dead && !o.away && o.ref2 === 0) {
        o.ref2 = c.id;
        n++;
      }
    });
  }
  if (c.act === 2 && c.actT < 4) return;
  // 光を嫌う：日の光と溶岩の照り返し。光る苔のほのかな明かりは、夜の通り道としてなら通れる程度に軽く数える
  const lightAt = (q: number) => (q < 0 ? 0 : this.w.lightBase[q] * day + this.w.mossGlow[q] * 500 + this.w.lavaGlow[q] * 1500);
  // 歩くときに手前で止まるのは、日の光だけ（夜に光る苔や溶岩の照り返しの手前で止まると、住処へ帰れずにその場で動けなくなっていた）
  const sunAt = (q: number) => (q < 0 ? 0 : this.w.lightBase[q] * day);
  // 明るい所（日の光か溶岩の照り返し）にいたら、暗い方へ逃げる。光る苔のほのかな明かりからは逃げない（苔の道で一歩進んでは戻り、足踏みしていた）
  const glare = (q: number) => (q < 0 ? 0 : sunAt(q) + this.w.lavaGlow[q] * 1500);
  if (glare(k) > 60) {
    let best = k;
    for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (q >= 0 && q < m.solid.length && !m.solid[q] && glare(q) < glare(best)) best = q;
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
  // 一行に技を使ってから生き物の更新60回のあいだは、打たれたばかりでも打ち合わずに退く（打って退く）。
  // ただし、そばの冒険者がコウモリに群がられて足止めされていれば、退かずに打ちかかる
  // （以前は、技のあとに打ち返されると打ち合いに切り替わり、一行と殴り合って倒されていた。16シード×25日で、倒された52体のうち22体）
  const afterSkill = this.w.tick - c.cast < 60 * CR_EVERY;
  if (this.w.tick - c.hitAt > 60 || afterSkill) {
    const foes: Cr[] = [];
    this.nearby(c.x, c.y, 7, (o) => {
      if (o.k !== Kind.Adventurer || o.dead || o.away || o.sleep > 0 || sq(o.x - c.x) + sq(o.y - c.y) > sq(7 * TILE)) return;
      foes.push(o);
    });
    const n = foes.length;
    // 夜なら、退く前に技を使う（霧になって後衛の背後へ、コウモリの群れ、血吸い。src/eco/vampskill.ts）
    if (n && day <= 0.05 && this.vampEngage(c, foes, null)) return;
    const pinned = foes.some((o) => this.batPinned(o) && sq(o.x - c.x) + sq(o.y - c.y) < sq(2 * TILE));
    // 退くときは、住処への道をたどる（一行から離れる向きへ一歩ずつ動くと、壁に当たって住処の向きと行き来し、その場で足踏みしていた）
    if (n && !pinned && sq(c.hx - c.x) + sq(c.hy - c.y) > sq(2 * TILE)) {
      c.act = 1;
      c.ref = 0;
      this.goTo(c, c.hx, c.hy, s.speed * 1.3);
      return;
    }
  }
  if (day > 0.05) {
    // 住処が遠いまま眠気が出てきたら（眠りの目安の3割を超えたら）、近くの物陰（行き止まりや、人の気配の薄い暗い所）へ寄って、
    // そこで眠り込んで棺を呼び出す（vampCoffin）。物陰は生き物の更新20回ごとに選び直し、tx, ty に持つ
    // （以前はどこで眠り込んでもその場に棺を出したので、通路の真ん中の棺が僧侶や竜殺しに暴かれていた。16シード×25日で4回 → 17回）
    const th = Ecology.SLEEP[Kind.Vampire]?.th ?? 1500;
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 12 * 12 && c.drowsy > th * 0.3) {
      if (!c.tx || this.step % 20 === c.id % 20) {
        const spot = this.vampHideSpot(c);
        c.tx = spot ? spot[0] : 0;
        c.ty = spot ? spot[1] : 0;
      }
      if (c.tx) {
        if (sq(c.tx - c.x) + sq(c.ty - c.y) < 8 * 8) c.act = 0;
        else {
          c.act = 1;
          const x0 = c.x;
          const y0 = c.y;
          this.goTo(c, c.tx, c.ty, s.speed);
          if (sunAt(this.tileOf(c.x, c.y)) > 60) {
            c.x = x0;
            c.y = y0;
            c.act = 0;
          }
        }
        return;
      }
    }
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
  // 冒険者の亡骸があれば、腹の減り方にかかわらず、そこへ歩いてかがみ込み、眷属として起き上がらせる（獲物を追っている途中は除く。vampRaiseFallen）
  if (!predawn && !c.ref && this.vampRaiseFallen(c, day)) return;
  if (c.food < s.cap * HUNT_BELOW && !predawn) {
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
      // 大ネズミは、飢えが進んでから（3割を超えてから）狙う。小さな獲物ばかり狩って、大ネズミが絶える日が増えていた
      if (o.k === Kind.Rat && c.sinceMeal < s.starve * 0.3) return false;
      if (lightAt(this.tileOf(o.x, o.y)) > 60) return false;
      // 火（松明、焚き火、かがり火）の明かりの輪の3マス外までにいる獲物は狙わない。冒険者の焚き火は、細るのを待つ（src/eco/night.ts の campFire）。
      // ヴァンパイアは明かりの輪の2マス外までに入ると火から離れて獲物をあきらめるので、以前は、ゴブリンの集落の焚き火のそばの獲物を選んでは
      // 近づく途中で追い返され、それを繰り返して、シードによっては25日で数匹しか仕留められなかった
      for (const f of this.fires()) if (sq(o.x - f[0]) + sq(o.y - f[1]) < sq(f[2] + 3 * TILE) && !this.weakCampAt(f[0], f[1])) return false;
      // 起きている冒険者のそば（7マス以内）にいる、冒険者でない獲物は狙わない。ヴァンパイアは起きている冒険者に近づくと退いて獲物をあきらめるので、
      // 以前は、冒険者の近くのゴブリンなどを選んでは退くのを繰り返していた（冒険者そのものは、退いても隙をうかがって狙い続ける）
      if (o.k === Kind.Adventurer) return true;
      let awake = false;
      this.nearby(o.x, o.y, 8, (a) => {
        if (!awake && a !== o && a.k === Kind.Adventurer && !a.dead && !a.away && a.sleep === 0 && sq(a.x - o.x) + sq(a.y - o.y) < sq(7 * TILE)) awake = true;
      });
      return !awake;
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
      // 離れた獲物には、血吸いやコウモリの群れを使う（src/eco/vampskill.ts）
      if (this.vampEngage(c, [], p)) return;
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
      // 遠出は住処から45マス以内の獲物まで（遠くへ行くほど、夜明けまでに帰れなくなる）。飢えが進むほど遠くまで行く（最後に食べてから
      // 飢え死にまでの4割で80マスまで）。住処の近くに獲物がいないマップでは、狩りに出られないまま飢えて去っていた
      const far = 45 + 35 * Math.min(1, c.sinceMeal / (s.starve * 0.4));
      for (const o of this.list) {
        if (sq(o.x - c.hx) + sq(o.y - c.hy) > sq(far * TILE) || !ok(o)) continue;
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
  if ((c.food >= s.cap * HUNT_BELOW || predawn) && sq(c.hx - c.x) + sq(c.hy - c.y) > sq(8 * TILE)) {
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
  this.vampMistFx(c.x, c.y, 0);
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
    this.vampMistFx(c.x, c.y, 1);
    this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'reform', id: c.id, x: Math.round(c.x), y: Math.round(c.y) } as never);
  }
}

/** 黒い霧の演出を残す（描画専用。src/creatureView.ts） */
export function vampMistFx(this: Ecology, x: number, y: number, how: number): void {
  this.fxVampMist.push({ t: this.w.tick, x, y, how });
  if (this.fxVampMist.length > 12) this.fxVampMist.splice(0, 4);
}

/**
 * 住処へ帰れないまま眠気の出てきたヴァンパイアが、棺を呼び出す物陰：いまいる所から10マス以内の、同じ洞窟の続きの床で、
 * 日の光も大きな火の明かりも届かない所のうち、人の気配の薄い所（冒険者の通り道から外れた所）、まわり8マスに壁の多い所（行き止まりや壁ぎわ）、近い所ほど選ぶ。
 * 見つからなければ null（その場で眠り込めば、その場に棺を出す）
 */
export function vampHideSpot(this: Ecology, c: Cr): [number, number] | null {
  const m = this.w.map;
  const tx = Math.floor(c.x / TILE);
  const ty = Math.floor(c.y / TILE);
  const k0 = this.tileOf(c.x, c.y);
  const reg = k0 >= 0 ? this.regionOf(k0) : -1;
  if (reg < 0) return null;
  const fires = this.fires();
  let best: [number, number] | null = null;
  let bs = -1e9;
  for (let y = Math.max(1, ty - 10); y <= Math.min(m.h - 2, ty + 10); y++)
    for (let x = Math.max(1, tx - 10); x <= Math.min(m.w - 2, tx + 10); x++) {
      const k = y * m.w + x;
      if (m.solid[k] || this.regionOf(k) !== reg || this.w.lightBase[k] * this.dayNow > 60) continue;
      const px = x * TILE + 8;
      const py = y * TILE + 8;
      if (!this.passable(c, px, py)) continue;
      let lit = false;
      for (const f of fires) if (sq(px - f[0]) + sq(py - f[1]) < sq(f[2] + 2 * TILE)) lit = true;
      if (lit) continue;
      let walls = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) if (m.solid[k + dy * m.w + dx]) walls++;
      const sc = walls * 3 - this.presenceAt(px, py) * 60 - Math.hypot(x - tx, y - ty) * 0.4;
      if (sc > bs) {
        bs = sc;
        best = [px, py];
      }
    }
  return best;
}

/**
 * 棺：昼、住処（hx, hy）に戻ったヴァンパイアは棺に入って蓋を閉め、日が暮れると出てくる。
 * 棺の中の間は誰にも狙われない（away として扱う）。ただし、僧侶か竜殺しの冒険者が棺のそば（2マス以内）まで来ると、
 * 蓋が暴かれて、ヴァンパイアはその場で起き上がって打ち合う。棺はヴァンパイアが生きている間、住処にある（描画は src/creatureView.ts）。
 * 住処へ帰れないまま眠り込んだときは、その場に棺を呼び出して入る（その棺は、出てくると霧になって消える）。
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
    c.tx = 0;
    c.ty = 0;
    // 住処の外に呼び出した棺は、出てくると黒い霧になって消える
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 2) this.vampMistFx(c.x, c.y, 0);
    c.sleep = 0;
    c.act = 0;
    if (!opener) this.vampCallBats(c);
    if (opener) {
      const o = opener as Cr;
      c.foe = o.id;
      c.hitAt = this.w.tick;
      this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'coffinOpened', id: c.id, n: o.sp, x: Math.round(c.x), y: Math.round(c.y) } as never);
      this.log(c.x, c.y, `冒険者が{k:${Kind.Vampire}}の棺を暴いた`);
    }
    return false;
  }
  // 住処に着いたら住処の棺に入る。住処へ帰れないまま昼の眠気に負けて眠り込んだら、その場に黒い霧から棺を呼び出して入る
  // （以前は通路の床でそのまま眠り、棺に入らずに無防備に寝ていた）
  const atHome = (c.hx || c.hy) && sq(c.hx - c.x) + sq(c.hy - c.y) < 14 * 14;
  if (c.st === 0 && !c.dead && !c.away && this.dayNow > 0.05 && (atHome || c.sleep > 0) && this.w.tick - c.hitAt > 120) {
    c.st = VAMP_COFFIN;
    c.away = true;
    if (atHome) {
      c.x = c.hx;
      c.y = c.hy;
    } else {
      this.vampMistFx(c.x, c.y, 1);
      this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'coffinAway', id: c.id, x: Math.round(c.x), y: Math.round(c.y) } as never);
    }
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

/** 倒れた冒険者の亡骸を探す遠さ（住処からのマス） */
const RAISE_R = 70;

/**
 * 倒れた冒険者を眷属にする：夜、住処から70マス以内の歩いて行ける所に、骨になる前の冒険者の亡骸があれば、いちばん近いものへ歩いて行き、
 * かがみ込んで血を短く吸い、眷属として起き上がる印を付ける（src/eco/thrall.ts の vampClaim。少しして起き上がる）。
 * ヴァンパイア自身が倒した者でなくてよい（冒険者を倒す数を増やさずに、倒れた冒険者が眷属になる場面を見せる。以前は25日で6シードほどだった）。
 * 冒険者が倒れるのは、ヴァンパイアのいない間や、昼（棺で眠っている間）、住処から遠い所が多いので、倒れてからの長さでは絞らず（骨になる前なら選ぶ）、
 * 遠さは住処から70マス以内と、遠出（45マス）より広くとる（住処から45マス・倒れて半日以内に絞ると25日で5回ほどだった。
 * 遠さの上限をなくすと、遠くの亡骸へ歩く間に狩りをしなくなり、コウモリの足止めが減った）。獲物を追っている途中は向かわない。
 * 明かりの中の亡骸、僧侶に清められた亡骸、骨になった亡骸（残りの養分が30未満も含む）、もう印の付いた亡骸、住処から歩いて行けない所の亡骸、
 * 起きている冒険者がそばにいる亡骸は選ばない。目当ての亡骸の番号は ref2 に持つ。
 * true なら、この回は亡骸へ向かったか印を付けた
 */
export function vampRaiseFallen(this: Ecology, c: Cr, day: number): boolean {
  const s = SPEC[Kind.Vampire];
  const ok = (o: Cr) => {
    if (o.k !== Kind.Adventurer || o.dead !== 1 || o.st === 99 || o.units < 30 || this.corpseStage(o) === 2) return false;
    if (o.lure && this.byId.get(o.lure)?.k === Kind.Vampire) return false;
    const q = this.tileOf(o.x, o.y);
    if (q < 0 || this.w.lightBase[q] * day + this.w.lavaGlow[q] * 1500 > 60) return false;
    if (this.fireNear(o.x, o.y) && !this.weakCampAt(o.x, o.y)) return false;
    if (sq(o.x - c.hx) + sq(o.y - c.hy) > sq(RAISE_R * TILE)) return false;
    // 住処から歩いて行けない所の亡骸は選ばない（閉じた空洞や水の向こうの亡骸を目当てにして、着けないまま立ち尽くしていた）
    const home = this.tileOf(c.hx, c.hy);
    if (home < 0 || this.regionOf(q) !== this.regionOf(home)) return false;
    // 起きている冒険者がそば（7マス以内）にいる亡骸は、去るまで待つ（近づくと退くので、行っては戻るのを繰り返していた）
    let awake = false;
    this.nearby(o.x, o.y, 8, (a) => {
      if (!awake && a.k === Kind.Adventurer && !a.dead && !a.away && a.sleep === 0 && sq(a.x - o.x) + sq(a.y - o.y) < sq(7 * TILE)) awake = true;
    });
    return !awake && this.thrallRoomForAdv(c, o);
  };
  let d = c.ref2 ? this.byId.get(c.ref2) : undefined;
  if (d && !ok(d)) d = undefined;
  if (!d) c.ref2 = 0;
  if (!d && this.step % 10 === c.id % 10) {
    let bd = 1e18;
    for (const o of this.list) {
      if (!ok(o)) continue;
      const dd = sq(o.x - c.x) + sq(o.y - c.y);
      if (dd < bd) {
        bd = dd;
        d = o;
      }
    }
    if (d) c.ref2 = d.id;
  }
  if (!d) return false;
  c.ref = 0;
  c.act = 1;
  if (sq(d.x - c.x) + sq(d.y - c.y) < 11 * 11) {
    c.ref2 = 0;
    if (this.vampClaim(c, d)) {
      // 血を短く吸う（src/eco/senses.ts の feeding。印を付けた亡骸からは生き物の更新15回で離れる）
      c.feed = d.id;
      c.act = 2;
      c.actT = 0;
      c.dir = Math.abs(d.x - c.x) > Math.abs(d.y - c.y) ? (d.x > c.x ? 2 : 3) : d.y > c.y ? 0 : 1;
      this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'raiseFallen', id: c.id, n: d.sp, x: Math.round(d.x), y: Math.round(d.y) } as never);
    }
    return true;
  }
  const x0 = c.x;
  const y0 = c.y;
  this.goTo(c, d.x, d.y, s.speed * 1.1);
  // 明るい所へは踏み込まない（手前で待つ）
  const k = this.tileOf(c.x, c.y);
  if (k >= 0 && this.w.lightBase[k] * day > 60) {
    c.x = x0;
    c.y = y0;
    c.act = 0;
  }
  return true;
}

/** ヴァンパイアが従えるコウモリの数の上限 */
const RETINUE_MAX = 12;
/** 日暮れに呼び寄せるコウモリの数の上限（従うコウモリと合わせて）と、呼び寄せる遠さ（住処からのマス） */
const CALL_BATS = 5;
const CALL_R = 40;
/** コウモリの状態（st）：ヴァンパイアに呼ばれ、閉じた空洞のねぐらから縦穴で外へ出て、入口か縦穴から入り直すところ（その間は away） */
export const BAT_CALLED = 5;
/** 呼ばれたコウモリが外を回って入り直すまで（生き物の更新の回数） */
const CALL_OUTSIDE = 60;

/**
 * 日暮れに棺から出たヴァンパイアが、従うコウモリが5匹に満たなければ、住処から40マス以内の、まだ誰にも従っていないコウモリを、
 * 近い順に5匹になるまで呼び寄せる。住処と飛んでつながった所にいるコウモリは、そのまま住処へ飛んでくる。
 * 閉じた空洞のねぐらにいるコウモリ（多くのねぐらは縦穴の下の閉じた空洞にある）は、縦穴から外へ出て、住処とつながった入口か縦穴から入り直し、
 * そこから住処へ飛んでくる（batCalled）。従うコウモリは、飢えやクモの巣、ワイバーンで減っていき、以前は数日で1匹もいなくなっていた
 */
export function vampCallBats(this: Ecology, c: Cr): void {
  let fol = 0;
  for (const b of this.list) if (b.k === Kind.Bat && !b.dead && b.ref2 === c.id) fol++;
  if (fol >= CALL_BATS) return;
  const home = this.tileOf(c.hx, c.hy);
  const reg = home >= 0 ? this.regionOf(home) : -1;
  if (reg < 0) return;
  const cand: [number, Cr][] = [];
  for (const b of this.list) {
    if (b.k !== Kind.Bat || b.dead || b.away || b.caught || b.ref2) continue;
    const d2 = sq(b.x - c.hx) + sq(b.y - c.hy);
    if (d2 <= sq(CALL_R * TILE)) cand.push([d2, b]);
  }
  cand.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
  let n = 0;
  let out = 0;
  for (const [, b] of cand) {
    if (fol + n >= CALL_BATS) break;
    b.ref2 = c.id;
    b.ref = 0;
    n++;
    // ねぐらでぶら下がるコウモリは天井ぎわ（壁のマス）にいることがあるので、ねぐらの場所（tx, ty）でも見る
    const k = this.tileOf(b.x, b.y);
    const kr = this.tileOf(b.tx, b.ty);
    if ((k >= 0 && this.regionOf(k) === reg) || (kr >= 0 && this.regionOf(kr) === reg)) b.st = 1;
    else {
      b.st = BAT_CALLED;
      b.away = true;
      b.lureAt = this.step;
      out++;
    }
  }
  // 分析用：日暮れにコウモリを呼び寄せた（out は外を回って来る数）
  if (n) this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'callBats', id: c.id, n, out, x: Math.round(c.x), y: Math.round(c.y) } as never);
}

/**
 * 呼ばれて外を回るコウモリ（st が BAT_CALLED）：生き物の更新60回たったら、主の住処とつながった入口か縦穴のうち、住処にいちばん近い所から入り直す
 * （そこからは従うコウモリとして住処へ飛ぶ）。主がもういなければ、元のねぐらへ戻る
 */
export function batCalled(this: Ecology, c: Cr): void {
  const lord = this.byId.get(c.ref2);
  if (!lord || lord.dead || lord.k !== Kind.Vampire) {
    c.ref2 = 0;
    c.st = 0;
    c.away = false;
    c.x = c.px = c.tx;
    c.y = c.py = c.ty;
    return;
  }
  if (this.step - c.lureAt < CALL_OUTSIDE) return;
  const m = this.w.map;
  const home = this.tileOf(lord.hx, lord.hy);
  const reg = home >= 0 ? this.regionOf(home) : -1;
  const ops: [number, number][] = [[m.entrance.x, 1], ...m.shafts.map((sh) => [sh.x, sh.y] as [number, number])];
  let best: [number, number] | null = null;
  let bd = 1e18;
  for (const [x, y] of ops) {
    const k = y * m.w + x;
    if (k < 0 || k >= m.solid.length || this.regionOf(k) !== reg) continue;
    const d = sq(x * TILE + 8 - lord.hx) + sq(y * TILE + 8 - lord.hy);
    if (d < bd) {
      bd = d;
      best = [x, y];
    }
  }
  const [ox, oy] = best ?? [m.entrance.x, 1];
  c.x = c.px = ox * TILE + 8;
  c.y = c.py = oy * TILE + 8;
  c.away = false;
  c.st = 1;
  this.paths.delete(c.id);
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
      if (m.solid[k] || !m.solid[k - m.w] || m.lava[k] || this.inLair(x * TILE + 8, y * TILE + 8) || this.w.water[k] > 10) continue;
      if (this.w.lightBase[k] > 20 || this.w.lightBase[k - m.w] > 40 || this.w.mossGlow[k] > 0.03 || this.w.lavaGlow[k] > 0.02) continue;
      if (this.regionOf(k) !== main) continue;
      best = k;
      bd = d;
    }
  return best;
}

/** コウモリが獲物に群がって足止めしはじめる、ヴァンパイアと獲物の近さ（マス。以前は6マスで、ヴァンパイアが近づく前に獲物が逃げることが多かった） */
export const PIN_R = 8;

/** いま獲物を決めているヴァンパイアの番号（生き物の更新ごとに、その回で最初に聞かれたときに探す。セーブしない） */
const lordCache = new WeakMap<Ecology, { step: number; id: number }>();

/**
 * o がコウモリに群がられて足止めされているか：ヴァンパイアが o を獲物に決めていて、8マス以内（PIN_R）まで近づき、
 * 従えるコウモリが2匹以上 o にまとわりついている（20px 以内）。足止めされた者は逃げられず（src/eco/step.ts）、打ち返しも弱い（src/eco/combat.ts の fight）
 */
export function batPinned(this: Ecology, o: Cr): boolean {
  // （獲物の種は問わない：眷属を連れたヴァンパイアが狙うオークとドワーフも、群がられれば足止めされる）
  if (!this.counts[Kind.Vampire] || o.dead || o.k === Kind.Vampire || o.k === Kind.Bat) return false;
  let lc = lordCache.get(this);
  if (!lc || lc.step !== this.step) {
    lc = { step: this.step, id: 0 };
    for (const c of this.list) if (c.k === Kind.Vampire && !c.dead && !c.away && c.ref) lc.id = c.id;
    lordCache.set(this, lc);
  }
  const v = lc.id ? this.byId.get(lc.id) : undefined;
  if (!v || v.dead || v.ref !== o.id || sq(v.x - o.x) + sq(v.y - o.y) > sq(PIN_R * TILE)) return false;
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
    vampHideSpot: typeof vampHideSpot;
    vampCallBats: typeof vampCallBats;
    batCalled: typeof batCalled;
    vampRaiseFallen: typeof vampRaiseFallen;
    vampMistFx: typeof vampMistFx;
  }
}

Object.assign(Ecology.prototype, { vampire, batPinned, vampLair, vampCanScatter, vampScatter, vampFly, vampCoffin, vampHideSpot, vampCallBats, batCalled, vampRaiseFallen, vampMistFx });
