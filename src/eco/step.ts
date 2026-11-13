/** Ecology のメソッド：生き物の更新1回（step。src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BONE_CAP, BONE_KINDS, KIN_RISE_MANA, KIN_ZOMBIE_CAP, KIN_ZOMBIES, ZOMBIE_KINDS } from './undead';
import { BLOOD, Burrow, CELL, CR_EVERY, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq, STONE_DECAY_EVERY } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import { VAMP_SCATTER } from './vampire';
import { BLESSED, CRUMBLING } from './roster';
import type { World } from '../world';

export function update(this: Ecology, tick: number, day: number, phase: number): void {
  this.step++;
  this.trimChews();
  this.day = day;
  this.dayNow = day;
  this.phaseNow = phase;
  this.rebuildGrid();
  this.buildGroups();
  this.buildLitMap();
  this.corpses = this.list.filter((c) => c.dead === 1 && c.units > 0 && c.k !== Kind.Wisp && c.k !== Kind.Slime && c.k !== Kind.Myconid);
  this.counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const c of this.list) if (!c.dead) this.counts[c.k]++;
  // 飛んでいた魔法の矢と、降ってきた矢の雨を当てる（src/eco/attack.ts）
  this.resolveVolleys();

  for (const c of this.list) {
    if (c.dead === 2) continue;
    // バジリスクの睨みで進んだ石化は、睨まれ続けなければ少しずつ戻る（どの生き物も、ほかの処理で更新を飛ばす前に）
    if (c.dead === 0 && c.stone > 0 && this.step % STONE_DECAY_EVERY === c.id % STONE_DECAY_EVERY) c.stone = Math.max(0, c.stone - 1);
    // ウィスプ（光の精を除く）は WISP_EVERY 回に1回だけ判断して動く（Ecology.WISP_EVERY）。ほかの回は腹が減るだけ。
    // px は動いた回の前の位置のまま残す（描画が WISP_EVERY 回ぶんの時間をかけて補間する）
    if (c.dead === 0 && c.k === Kind.Wisp && c.elite !== 7 && !c.caught && this.wispIdle(c)) {
      c.actT++;
      this.metabolism(c);
      continue;
    }
    c.px = c.x;
    c.py = c.y;
    c.actT++;
    if (c.dead === 1) {
      this.decay(c);
      continue;
    }
    // 壁や瓦礫の中に埋まっていたら、いちばん近い床へ出る
    if (!c.away) this.unbury(c);
    if (c.caught) {
      c.act = 1;
      // もがいて抜け出す（コウモリは70分の1、大ネズミとアリは60分の1、ウィスプは160分の1。生き物の更新ごと）。抜け出したら巣の外へ跳び出す（escapeWeb）
      if (ih(c.id, this.step, 41) % (c.k === Kind.Bat ? 70 : c.k === Kind.Rat || c.k === Kind.Ant ? 60 : 160) === 0) this.escapeWeb(c);
      this.metabolism(c);
      continue;
    }
    // ヴァンパイアは、昼は住処の棺の中で眠る（src/eco/vampire.ts の vampCoffin）
    if (c.k === Kind.Vampire && this.vampCoffin(c)) {
      // 棺で眠っている間も、休んでいる間と同じく足もとの土からマナを吸う（下の restSoak より先に continue するので、ここで呼ぶ）
      this.restSoak(c);
      this.metabolism(c);
      continue;
    }
    // コウモリの群れにばらけたヴァンパイアは、住処へ飛ぶだけ（src/eco/vampire.ts の vampFly）
    if (c.k === Kind.Vampire && c.st === VAMP_SCATTER) {
      this.vampFly(c);
      this.metabolism(c);
      continue;
    }
    // ヴァンパイアのコウモリに群がられている間は、もがくだけで逃げられない（src/eco/vampire.ts の batPinned）
    if (this.batPinned(c)) {
      c.act = 1;
      c.flee = 0;
      this.metabolism(c);
      continue;
    }
    // 毒（src/eco/attack.ts）
    if (c.poison > 0 && !c.away && this.poisonTick(c)) continue;
    // はね飛ばされている者と怯み（src/eco/charge.ts）
    if ((c.kb > 0 || c.stun > 0) && !c.away && this.knockTick(c)) {
      this.metabolism(c);
      continue;
    }
    // マイコニドの眠りの胞子を浴びた人は、立ったまま少しのあいだ眠る（src/eco/myconidskill.ts）
    if (c.doze > 0 && !c.away && this.dozeTick(c)) {
      this.metabolism(c);
      continue;
    }
    // 大グモの糸に縛られている者は、その場でもがき、隣の相手だけを打つ（src/eco/spiderskill.ts）
    if (c.bind > 0 && !c.away && this.boundStep(c)) {
      this.metabolism(c);
      continue;
    }
    // ヴァンパイアの霧の歩みの一撃のあとは、深手で逃げる処理より先に、霧になって元の暗がりへ戻る（src/eco/vampskill.ts）
    // （逃げる処理が先だと、背後に現れた直後に一行に打ち返されて逃げに切り替わり、戻れずに倒されていた）
    if (c.k === Kind.Vampire && c.run === -4 && this.vampSkill(c)) {
      this.metabolism(c);
      continue;
    }
    // オークの斧が鎖の先に出ているあいだは、逃げる処理より先に、その場で鎖をたぐる（src/eco/orcskill.ts）
    if (c.k === Kind.Orc && c.run > 0 && this.orcSkill(c)) {
      this.metabolism(c);
      continue;
    }
    // アンデッドの起き上がりと、スケルトンがリッチに変わる間（src/eco/undead.ts）
    if ((c.k === Kind.Skeleton || c.k === Kind.Zombie || c.k === Kind.Lich) && (c.st === 10 || c.st === 11) && this.undeadRise(c)) {
      this.metabolism(c);
      continue;
    }
    // バジリスクの睨みの溜めと、睨む判断（src/eco/basilisk.ts）。深手で逃げる処理と、火を怖がって離れる処理より先に（逃げながらでも、追ってくる者や松明を持つ冒険者を睨む）
    if (c.k === Kind.Basilisk && this.basiliskGaze(c)) {
      this.metabolism(c);
      continue;
    }
    if (STR[c.k] > 0 && this.woundsAndFlight(c)) {
      this.metabolism(c);
      continue;
    }
    if (c.k === Kind.Minotaur && c.gait > 0) c.gait--;
    if (c.sleep > 0 && this.alarms.size && this.alarms.has(this.groupKey(c) ?? '')) c.sleep = 0;
    this.restSoak(c);
    // ウィスプは土からマナを吸う（生き物の更新4回に1回、少しずつ。体に40まで）
    if (c.k === Kind.Wisp && this.step % 4 === c.id % 4 && c.mana < 40) {
      const k = this.tileOf(c.x, c.y);
      if (k >= 0 && this.w.mana[k] >= 3) {
        const t = Math.min(2, this.w.mana[k] - 1, 40 - c.mana);
        this.w.mana[k] -= t;
        c.mana += t;
      }
    }
    // マイコニドの眠りの胞子の溜めと、吐く判断（src/eco/myconidskill.ts）
    if (c.k === Kind.Myconid && this.myconidSkill(c)) {
      this.metabolism(c);
      continue;
    }
    if (Ecology.PESTERS.has(c.k) && this.pester(c)) {
      this.metabolism(c);
      continue;
    }
    if (this.feeding(c)) {
      this.metabolism(c);
      continue;
    }
    if (this.doSleep(c, day, this.phaseNow)) {
      this.metabolism(c);
      continue;
    }
    // オークの技（雄叫び・投げ斧）の溜めと、使う判断（src/eco/orcskill.ts）
    if (c.k === Kind.Orc && this.orcSkill(c)) {
      this.metabolism(c);
      continue;
    }
    // 大グモの技（糸吐き）の溜めと、吐いたあとの噛みつき、使う判断（src/eco/spiderskill.ts）。火を怖がって離れるより先に（松明を持つ冒険者に糸を吐く）
    if (c.k === Kind.Spider && this.spiderSkill(c)) {
      this.metabolism(c);
      continue;
    }
    // コボルトのスリングの投石の溜めと、投げたあとに逃げ出すまで（src/eco/koboldskill.ts）
    if (c.k === Kind.Kobold && c.run === -1 && this.koboldSkill(c)) {
      this.metabolism(c);
      continue;
    }
    if ((c.k === Kind.Orc && this.orcWary(c)) || this.heedAlarm(c) || this.fearFire(c) || this.lurk(c) || this.territory(c) || this.retreatStep(c) || this.shyOfPeople(c)) {
      this.metabolism(c);
      continue;
    }
    if (this.hear(c)) {
      this.metabolism(c);
      continue;
    }
    switch (c.k) {
      case Kind.Wisp: this.wisp(c, day); break;
      case Kind.Bat: this.bat(c, day, phase); break;
      case Kind.Rat: this.rat(c, day); break;
      case Kind.Lizard: if (!this.followOwner(c)) this.lizard(c, day); break;
      case Kind.Spider: this.spider(c, day); break;
      case Kind.Slime: this.slime(c); break;
      case Kind.Zombie: this.zombie(c); break;
      case Kind.Ghost: this.ghost(c, day); break;
      case Kind.Myconid: this.myconid(c); break;
      case Kind.Ant: this.ant(c); break;
      case Kind.Kobold: this.kobold(c); break;
      case Kind.Salamander: this.salamander(c); break;
      case Kind.Goblin: this.goblin(c); break;
      case Kind.Orc: this.orc(c); break;
      case Kind.Lizardman: this.lizardman(c); break;
      case Kind.Minotaur: this.minotaur(c); break;
      case Kind.Troll: this.troll(c, day); break;
      case Kind.Basilisk: this.basilisk(c); break;
      case Kind.Gargoyle: this.gargoyle(c); break;
      case Kind.Vampire: this.vampire(c, day); break;
      case Kind.Mimic: this.mimic(c); break;
      case Kind.Golem: this.golem(c); break;
      case Kind.Worm: this.worm(c); break;
      case Kind.Wyvern: this.wyvern(c); break;
      case Kind.Dragon: this.dragon(c, day); break;
      case Kind.Adventurer: this.adventurer(c, day); break;
      case Kind.Skeleton: this.skeleton(c, day); break;
      case Kind.Lich: this.lich(c, day); break;
      case Kind.Dwarf: this.dwarf(c); break;
      case Kind.Armor: this.armor(c); break;
      case Kind.Thrall: this.thrall(c); break;
    }
    if (!c.dead) this.metabolism(c);
  }
  this.updateWebs();
  if (this.step % 50 === 0) this.arrivals(day);
  if (this.step % 10 === 0) for (let i = 0; i < this.deathMap.length; i++) if (this.deathMap[i] > 0) this.deathMap[i]--;
  if (this.step % 200 === 0) for (let i = 0; i < this.graveMap.length; i++) if (this.graveMap[i] > 0) this.graveMap[i]--;
  if (this.step % 400 === 0) for (let i = 0; i < this.advGrave.length; i++) if (this.advGrave[i] > 0) this.advGrave[i]--;
  if (this.step % 50 === 25) this.spawnGhosts(day);
  if (this.step % 40 === 20) this.spawnSlimes();
  if (this.step % 10 === 5) this.updateColonies();
  if (this.step % 50 === 35) this.updateWarrens();
  if (this.step % 10 === 3) this.watchWarrens();
  if (this.step % 10 === 7) this.watchCamps();
  if (this.step % 600 === 115) this.updateVassals();
  this.checkTraps();
  if (this.step % 200 === 100) this.spawnSalamanders();
  if (this.step % 50 === 15) this.updateCamps();
  if (this.step % 50 === 25) this.planRaids();
  if (this.step % 50 === 35) this.planSnatch();
  if (this.step % 50 === 45) this.planCacheRaids();
  if (this.step % 50 === 45) this.updateStatues(day);
  if (this.step % 50 === 47) this.armorBirths();
  if (this.step % 50 === 30) this.updateTreasure(day);
  this.updateFire();
  this.updateDigging();
  if (this.step % 100 === 41) this.checkJoined();
  // 魔物が土の養分とマナから湧く（src/eco/generate.ts。表の各行が自分の判定の回を持つので、毎回呼ぶ）
  this.generate();
  if (this.step % 50 === 13) this.manaBirths(this.day);
  if (this.step % 300 === 77) this.riseLeaders();
  if (this.step % 100 === 43) this.breakTopWall();
  for (const pid of this.pendingScraps.splice(0)) {
    const p = this.parties.find((q) => q.id === pid);
    if (p) this.dropScraps(p, this.w.map.entrance.x * TILE + 16, 3 * TILE + 8, 2);
  }
  if (this.step % 600 === 310 || this.presenceBase.every((v) => v === 0)) this.updatePresenceBase();
  this.updatePresenceTrace();
  this.syncLongSleep();
  this.personalSpace();
  this.wakeByNoise();
  this.breed();
  if (this.step % 300 === 211) this.tendGroups();
  if (this.step % 300 === 7 || !this.forage.length) this.updateForage();
  if (this.step % 8 === 3) this.creatureSounds();
  this.updateParties();
  this.updateHold();
  this.updateItems();
  if (this.step % 40 === 10) for (let k = 0; k < this.w.ash.length; k++) if (this.w.ash[k] > 0) { this.w.ash[k]--; if ((this.w.ash[k] & 15) === 0) this.w.fxDirty = true; }
  this.lastPhase = phase;
  if (this.step % 10 === 0 || this.list.length > 4000) {
    const keep = this.list.filter((c) => c.dead !== 2);
    if (keep.length !== this.list.length) {
      for (const c of this.list)
        if (c.dead === 2) {
          this.byId.delete(c.id);
          this.paths.delete(c.id);
          this.gkMemo.delete(c.id);
        }
      this.list = keep;
    }
  }
}

/**
 * マナで命をつなぐ大物（Ecology.MANA_FED）は、休んでいる間（眠っている間。棺で眠るヴァンパイアも。眠らないガーゴイルは止まり木で石像のふりをしている間）、
 * 生き物の更新 MANA_REST_EVERY 回に1回、足もとのタイルのマナが4以上なら1吸う（体に manaMax まで）。
 * 糸に捕まった・群がられた・はね飛ばされたなどの間は吸わない（update の、それらの分岐より後で呼ぶ。棺の分岐だけは、その中で呼ぶ）
 */
export function restSoak(this: Ecology, c: Cr): void {
  if (!Ecology.MANA_FED.has(c.k) || this.step % Ecology.MANA_REST_EVERY !== c.id % Ecology.MANA_REST_EVERY || c.mana >= Ecology.manaMax(c.k)) return;
  if (!(c.sleep > 0 || (c.k === Kind.Gargoyle && c.act === 0 && c.x === c.hx && c.y === c.hy))) return;
  const k = this.tileOf(c.x, c.y);
  if (k >= 0 && this.w.mana[k] >= 4) {
    this.w.mana[k]--;
    c.mana++;
  }
}

export function metabolism(this: Ecology, c: Cr): void {
  // 水の精と光の精は、マナで体を保つので腹が減らない（食べ物も体も減らない）
  if (c.elite === 6 || c.elite === 7) return;
  if (c.k === Kind.Zombie || c.k === Kind.Ghost) return;
  const s = SPEC[c.k];
  if (c.k === Kind.Slime && c.food === 0 && this.step % 80 === c.id % 80) {
    // 食べるものがないスライムは少しずつ縮む
    c.body--;
    this.deposit(c.x, c.y, 1);
    if (c.body < 4) this.die(c, 'starve');
    return;
  }
  if (c.glow > 0) c.glow = Math.max(0, c.glow - s.glowDecay);
  // 眠っている間は腹が減りにくい（生き物の更新2回に1回だけ）
  if (c.sleep > 0 && this.step % 2 === 0) return;
  c.sinceMeal++;
  // ねぐらで眠るコウモリは代謝を落とす。ヴァンパイアに従うコウモリも、主の力で、ねぐらで眠るときと同じく腹が減りにくい（5分の1）。
  // 従うコウモリは外へ餌を取りに出ないので、野生のコウモリと同じ減り方では1日ほどで、3分の1でもシードによっては飢え死にしていた（src/eco/bat.ts の batForage）
  const meta = c.k === Kind.Bat && (c.st === 0 || c.ref2) ? s.meta * 5 : s.meta;
  if (c.k === Kind.Bat && c.st === 0 && this.step % 5 !== 0) {
    if (c.food === 0) return;
  }
  if (this.step % meta === (c.id % meta)) {
    if (c.food > 0) {
      c.food--;
      if (c.away) this.exported++;
      else this.deposit(c.x, c.y, 1);
      c.hungry = 0;
    }
  }
  if (c.food === 0) c.hungry++;
  if (c.hungry > s.starve) {
    // マナで命をつなぐ大物は、飢えの猶予を過ぎたら体のマナを燃やして生き延びる（hungry の値で間引く。step で間引くと、眠っている間の早戻りと重なって燃えない個体が出る）。
    // 胃に食べ物が入ったら、燃やすのも飢え死にもやめ、次の消化の回に hungry が0に戻るのを待つ
    // （食べた直後は hungry が増えないので、そのまま燃やす判定をすると、燃やす回に当たった値のまま毎回燃やし、マナが0なら食べたのに飢え死にしていた）
    if (Ecology.MANA_FED.has(c.k) && (c.food > 0 || c.mana > 0)) {
      if (c.food === 0 && (c.hungry - s.starve) % Ecology.MANA_BURN_EVERY === 0) {
        c.mana--;
        this.w.manaFaded++;
        if (c.mana === Ecology.MANA_LOW - 1) this.record('settle', { t: this.w.tick, k: c.k, id: c.id, ev: 'manaLow', x: Math.round(c.x), y: Math.round(c.y) } as never);
      }
    } else this.die(c, 'starve');
  }
}

/** 死骸の段階：0 新しい、1 腐りかけ、2 骨 */
export function corpseStage(this: Ecology, c: Cr): number {
  if (c.units <= Math.max(2, Math.floor(c.init * 0.3))) return 2;
  if (c.actT > 900 || c.units < c.init * 0.75) return 1;
  return 0;
}

export function decay(this: Ecology, c: Cr): void {
  if (c.k === Kind.Wisp || c.k === Kind.Slime || c.k === Kind.Ghost || c.k === Kind.Myconid) {
    if (c.actT > 8) c.dead = 2;
    return;
  }
  // ヴァンパイアの印の付いた亡骸は、眷属として起き上がる（src/eco/thrall.ts）
  if (this.raiseThrall(c)) return;
  // 僧侶に清められた骨は、祈りの終わりに金の光の粒になって崩れる（src/eco/roster.ts の blessCrumble）
  if (this.blessCrumble(c)) return;
  // 何もされなければ、死骸はとてもゆっくり朽ちて土に返る。骨はさらに長く残る（ミノタウロスの縄張りの骨は、その4倍。寝床に骨が積もる）
  const stage = this.corpseStage(c);
  const every = stage === 2 ? (this.inLair(c.x, c.y) ? 1600 : 400) : 60;
  if (c.units > 0 && this.step % every === c.id % every) {
    c.units--;
    this.deposit(c.x, c.y, 1);
  }
  if (c.units <= 0) {
    c.dead = 2;
    return;
  }
  // 清められていない冒険者の亡骸は、骨になったあと、多くが死んだ暗い所で起き上がる
  if (c.k === Kind.Adventurer && c.st !== BLESSED && c.actT > 1500 && this.step % 50 === c.id % 50) {
    const k = this.tileOf(c.x, c.y);
    const deaths = this.deathsAt(c.x, c.y);
    const lichNear = this.lichNear(c.x, c.y);
    if (k >= 0 && this.lit(k, this.day) < 0.15 && this.manaAround(k) >= 6 && (deaths >= 300 || lichNear) && ih(c.id, this.step, 140) % (lichNear ? 6 : 30) === 0) {
      this.raiseUndead(c, deaths >= 600 && this.manaAround(k) >= 10);
      return;
    }
  }
  // 冒険者のほかの人型（ゴブリン・コボルト・オーク・ドワーフ・リザードマン）の亡骸も、骨になったあと、死者の多い暗い所で起き上がる（src/eco/undead.ts の raiseBones）。
  // 僧侶に清められた亡骸（src/eco/roster.ts の blessBrace）は起き上がらない
  const blessed = c.st === BLESSED || c.st === CRUMBLING;
  if (BONE_KINDS.includes(c.k) && !blessed && stage === 2 && c.actT > 1500 && this.step % 50 === c.id % 50 && this.counts[Kind.Skeleton] < BONE_CAP) {
    const k = this.tileOf(c.x, c.y);
    const lichNear = this.lichNear(c.x, c.y);
    if (k >= 0 && this.lit(k, this.day) < 0.15 && this.manaAround(k) >= KIN_RISE_MANA && (this.deathsAt(c.x, c.y) >= 300 || lichNear) && ih(c.id, this.step, 141) % (lichNear ? 6 : 30) === 0) {
      this.raiseBones(c);
      return;
    }
  }
  // 暗く湿った所で、スライムに見つからずに残った死骸は、ゾンビとして起き上がることがある（リッチのそばではずっと起き上がりやすい）
  // 骨の竜：成竜の亡骸が、マナの濃い暗がりでゲーム内の半日ほど眠ったあと、骨の竜として起き上がる
  if (c.k === Kind.Dragon && c.sp >= 2 && c.elite !== 8 && c.actT > DAY_TICKS_ECO / 4 && this.step % 50 === c.id % 50) {
    const k = this.tileOf(c.x, c.y);
    if (k >= 0 && this.manaAround(k) >= 12 && this.lit(k, this.day) < 0.2) {
      c.dead = 0;
      c.elite = 8;
      c.body = c.units;
      c.init = c.units;
      c.units = 0;
      c.hp = this.maxHp(c);
      c.st = 1;
      c.act = 0;
      c.food = 0;
      this.takeMana(c, k, 200, 3);
      this.nameOf(c);
      this.log(c.x, c.y, `ダンジョンの主の亡骸が、骨の竜「${this.names.get(c.id)}」として起き上がった`);
      return;
    }
  }
  // 大ネズミ・大トカゲのほか、人型（ゴブリン・コボルト・オーク・リザードマン）のまだ肉のある亡骸も（ZOMBIE_KINDS）。肉が尽きると骨に戻り、骨はまたスケルトンとして起き上がりうる
  // （人型は、要るマナが KIN_RISE_MANA と低いかわりに、同時に KIN_ZOMBIE_CAP 体まで）
  const kin = KIN_ZOMBIES.includes(c.k);
  if (ZOMBIE_KINDS.includes(c.k) && !blessed && stage < 2 && c.actT > 500 && c.ref === 0 && (!kin || this.kinZombies() < KIN_ZOMBIE_CAP)) {
    const k = this.tileOf(c.x, c.y);
    const boost = this.step % 50 === c.id % 50 && this.lichNear(c.x, c.y);
    if (k >= 0 && this.lit(k, this.day) < 0.15 && this.manaAround(k) >= (kin ? KIN_RISE_MANA : 5) && (this.w.moist[k] >= 70 || boost) && ih(c.id, this.step, 51) % (boost ? 8 : 800) === 0) {
      c.sp = c.k;
      c.k = Kind.Zombie;
      c.body = c.units;
      c.init = c.units;
      c.units = 0;
      c.dead = 0;
      c.act = 0;
      c.actT = 0;
      c.hungry = 0;
      c.glow = 0;
      c.party = 0;
      c.torch = 0;
      c.hp = -1;
      this.startRise(c, c.sp);
    }
  }
}

declare module '../ecology' {
  interface Ecology {
    restSoak: typeof restSoak;
    update: typeof update;
    metabolism: typeof metabolism;
    corpseStage: typeof corpseStage;
    decay: typeof decay;
  }
}

Object.assign(Ecology.prototype, { update, restSoak, metabolism, corpseStage, decay });
