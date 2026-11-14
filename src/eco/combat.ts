/** Ecology のメソッド：強さと戦い、飢えて去ること、傷と戦い（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { BONE_SP } from './undead';
import { BLOOD, CR_EVERY, type Cr, DAY_TICKS_ECO, DWARF_STR, Ecology, FLEE_AT, JOB_STR, Job, Kind, SPEC, STR, TIER, TIER_MUL, ih, sq } from '../ecology';
import { TILE } from '../mapgen';
import { thrallStr } from './thrall';
import { ARMOR_HAND_MAX } from './armor';

/** 攻める側の勝つ確率は、近くの仲間を含めた強さの比で決まる。負けた側は死ぬことがある */
/** 強さ：冒険者は職業と一行の格で決まる */
export function str(this: Ecology, c: Cr): number {
  if (c.k === Kind.Adventurer) return JOB_STR[c.sp] * TIER_MUL[c.init] * this.rankMul(c) * (c.sp === Job.Thief && c.act === 2 ? 1.6 : 1);
  // スケルトンは生前の装備で強さが決まる。武器を拾ったゴブリンとオークは強くなる
  // 冒険者のほかの人型の骨は、生前の強さの7割（2以上。src/eco/undead.ts の raiseBones）
  if (c.k === Kind.Skeleton) return c.sp >= BONE_SP ? Math.max(2, Math.round(STR[c.sp - BONE_SP] * 0.7)) : c.init ? JOB_STR[c.sp] * 1.2 : 3;
  if (c.k === Kind.Dwarf) return DWARF_STR[c.sp];
  if (c.k === Kind.Thrall) return thrallStr(c);
  // リビングアーマーは、手に取り込んだ武器と盾1つごとに強くなる（src/eco/armor.ts）
  if (c.k === Kind.Armor) return STR[c.k] + 3 * Math.min(ARMOR_HAND_MAX, this.armorHand(c).length);
  if ((c.k === Kind.Goblin || c.k === Kind.Orc) && c.party) return STR[c.k] * 1.6;
  // 特別な個体
  if (c.elite === 1) return 12;
  if (c.elite === 2) return 10;
  if (c.elite === 6) return 8;
  if (c.elite === 7) return 3;
  if (c.elite === 8) return STR[Kind.Dragon] * 0.8;
  if (c.elite === 9) return 9;
  if (c.elite === 4) return STR[c.k] * 3;
  if (c.elite === 5) return STR[c.k] * 2.5;
  // ドラゴンは育ち具合で強さが変わる（幼竜、若い竜、成竜）
  if (c.k === Kind.Dragon) return STR[c.k] * [0.25, 0.6, 1][Math.min(2, c.sp)];
  return STR[c.k];
}

/** 縄張りの中に敵が来たら追い払う（戦う） */
export function defend(this: Ecology, c: Cr, hx: number, hy: number, enemies: Kind[]): boolean {
  if (sq(c.x - hx) + sq(c.y - hy) > 12 * TILE * 12 * TILE) return false;
  let foe: Cr | null = null;
  let bd = 3 * TILE * 3 * TILE;
  this.nearby(c.x, c.y, 3, (o) => {
    if (o.dead || o.away || !enemies.includes(o.k) || !this.canSense(c, o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      foe = o;
    }
  });
  if (!foe) return false;
  const f = foe as Cr;
  c.act = 1;
  if (sq(f.x - c.x) + sq(f.y - c.y) < 11 * 11) this.fight(c, f);
  else this.goTo(c, f.x, f.y, SPEC[c.k].speed * 1.2);
  return true;
}

/** 食べ物にありつけないまま長く経った大物は、入口から出ていく */
export function leaveIfStarving(this: Ecology, c: Cr): boolean {
  const s = SPEC[c.k];
  if (c.st !== 9 && c.sinceMeal < s.starve * 0.6) return false;
  // マナで命をつなぐ大物は、マナが残っているあいだは去らない
  if (c.st !== 9 && Ecology.MANA_FED.has(c.k) && c.mana >= Ecology.MANA_LOW) return false;
  c.st = 9;
  c.act = 1;
  const m = this.w.map;
  // 出ていく口：人（ドワーフなど）は正面の入口。野の生き物は、自分の種に合う開いた自然の口のうちいちばん近いもの。
  // 野の生き物に開いた口がなければ、出ていけずに中で飢える
  const people = c.k === Kind.Dwarf || c.k === Kind.Adventurer;
  let ex = people ? m.entrance.x * TILE + 16 : -1;
  let ey = TILE + 8;
  if (!people) {
    const want = c.k === Kind.Basilisk || c.k === Kind.Minotaur ? 1 : c.k === Kind.Lizardman ? 2 : 0;
    let bd = 1e18;
    for (let i = 0; i < m.mouths.length; i++) {
      if (m.mouths[i].kind !== want || !this.mouthOpen(i)) continue;
      const [mx, my] = this.mouthSpot(i);
      const d = sq(mx - c.x) + sq(my - c.y);
      if (d < bd) {
        bd = d;
        ex = mx;
        ey = my;
      }
    }
    if (ex < 0) {
      c.st = c.st === 9 ? 0 : c.st;
      return false;
    }
  }
  if (this.goTo(c, ex, ey, s.speed) || sq(ex - c.x) + sq(ey - c.y) < 30 * 30) {
    if (c.k === Kind.Adventurer) this.heroHome(c, false);
    this.record('exits', { t: this.w.tick, k: c.k, reason: 'starving', x: Math.round(c.x), y: Math.round(c.y) } as never);
    this.w.manaLeaked += c.mana;
    c.mana = 0;
    this.exported += c.body + c.food + c.units;
    if (c.gold > 0) {
      this.goldOut += c.gold;
      c.gold = 0;
    }
    if (c.k === Kind.Dwarf) {
      // 生きて外へ出たドワーフが、ゴーレムの話を伝える
      if (this.hold?.golem) this.dwarfLore |= 1;
    }
    c.body = 0;
    c.food = 0;
    c.units = 0;
    this.w.manaLeaked += c.mana;
    c.mana = 0;
    c.dead = 2;
  }
  return true;
}

export function hunt(this: Ecology, c: Cr, R: number, kinds: Kind[], speed: number): boolean {
  let prey: Cr | null = null;
  let bd = R * TILE * R * TILE;
  const tier = TIER[c.k] ?? 1;
  const me = this.str(c);
  this.nearby(c.x, c.y, R, (o) => {
    if (o.dead || o.away || o.caught || !kinds.includes(o.k) || o.k === Kind.Dragon) return;
    if (o.k === Kind.Bat && o.st !== 0) return;
    // 気づけない相手と、（火を怖がる者にとって）火のそばの獲物は狙わない
    if (!this.canSense(c, o)) return;
    // ゴブリンはコボルトの縄張りの中の獲物を追わない
    if (c.k === Kind.Goblin && this.inKoboldLand(o.x, o.y)) return;
    // （夜襲に出る大物は、3割ほど飢えていれば、細った焚き火のそばの獲物も狙う。src/eco/night.ts）
    if (Ecology.FEARS_FIRE.has(c.k) && c.sinceMeal < SPEC[c.k].starve * 0.85 && this.fireDaunts(c, o.x, o.y)) return;
    // 知性ある者と狡猾な者は、自分の2倍より強い相手には挑まない（以前は1.1倍・1.6倍で、大物どうしがほとんどぶつからなかった）
    const ts = this.str(o) * (o.hp > 0 ? o.hp / this.maxHp(o) : 1);
    if (tier >= 2 && ts > me * 2) return;
    // 焚き火で眠っている冒険者は、近くにいるものとして好んで狙う（寝込みを襲う）
    const d = (sq(o.x - c.x) + sq(o.y - c.y)) * (this.campSleeper(o) ? 0.25 : 1);
    if (d < bd) {
      bd = d;
      prey = o;
    }
  });
  if (!prey) return false;
  const p = prey as Cr;
  this.markNotice(c, p, '!');
  c.act = 1;
  const d2 = sq(p.x - c.x) + sq(p.y - c.y);
  // ミノタウロスは、4マスの内なら斧の薙ぎ払い、4〜8マスなら突進を溜める（src/eco/charge.ts）
  if (c.k === Kind.Minotaur && this.minoEngage(c, p, d2)) return true;
  if (d2 < 11 * 11) {
    // 狩りは、相手が小さくても一口では食べず、打ち合って仕留めてから食べる（攻撃のエフェクトを見せる）。
    // 一口で食べるのは、クモの巣・ワームの丸のみ・空中でさらう・ミミックの丸のみ・死骸を食べる、の場面だけ
    this.fight(c, p);
  } else if (TIER[c.k] === 2 && d2 > 2 * TILE * 2 * TILE) {
    // 狡猾な種は、仲間がいれば回り込んで別々の方向から近づく
    let allies = 0;
    this.nearby(c.x, c.y, 4, (o) => {
      if (o !== c && !o.dead && o.k === c.k) allies++;
    });
    if (allies) {
      const a = ((c.id * 2.3999) % 6.283) - 3.14;
      const r = Math.min(Math.sqrt(d2) * 0.6, 2.5 * TILE);
      this.goTo(c, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, speed);
    } else this.goTo(c, p.x, p.y, speed);
  } else this.goTo(c, p.x, p.y, speed);
  return true;
}

/**
 * 体力の上限は 4 + 強さ × HP_PER_STR。一打ちの傷は強さの1.2〜2.4倍なので、強さが同じ相手なら、ふつうの一打ちでおよそ5打、技なら3打ほどで倒れる。
 * （以前は 4 + 強さ×5 で、近くの仲間1人ごとに一打ちが4割重くなった（最大2.2倍）ので、一行に囲まれた大物は1〜2打で倒れていた）
 */
export const HP_PER_STR = 9;

/** 体力の上限（強さに比例） */
export function maxHp(this: Ecology, c: Cr): number {
  // リビングアーマー（空の鎧）は固い。固さは体になった武具の数で決まり、手に取った武器と盾は打撃（強さ）だけを上げる（src/eco/armor.ts の armorHp）
  if (c.k === Kind.Armor) return this.armorHp(c);
  return Math.round(4 + this.str(c) * HP_PER_STR);
}

export function bleed(this: Ecology, c: Cr, n: number): void {
  const col = BLOOD[c.k];
  if (col < 0) return;
  for (let i = 0; i < n; i++) {
    this.blood.push({ x: Math.round(c.x + ((ih(c.id, this.step, 160 + i) % 9) - 4)), y: Math.round(c.y + ((ih(c.id, this.step, 170 + i) % 5) - 1)), t: this.w.tick, c: col, v: ih(c.id, this.step, 180 + i) & 3 });
  }
  if (this.blood.length > 400) this.blood.splice(0, this.blood.length - 400);
}

/**
 * 一打ち：強さで傷を与える。倒せば true。fx が false なら、打つ者の攻撃のエフェクトを出さない（形のある攻撃は、形のエフェクトを別に一つ出す。src/eco/attack.ts）。
 * （以前は、近くにいる同じ種の仲間1人ごとに一打ちが4割重くなっていた（最大2.2倍）。画面では1人が打っているだけなのに、
 *  一行がそばにいるだけで倍の傷になり、囲まれた大物が1〜2打で倒れていた。数の力は、形のある攻撃で実際に皆が打つことで出す）
 */
export function strike(this: Ecology, a: Cr, d: Cr, mul = 1, fx = true): boolean {
  // ゴーストの体は、魔法と聖なる攻撃でない一打ちの多くをすり抜ける（src/eco/ghostskill.ts）
  if (d.k === Kind.Ghost && this.ghostPhase(a, d, fx)) return false;
  if (d.hp <= 0) d.hp = this.maxHp(d);
  const sa = this.str(a);
  let dmg = sa * (1.2 + (ih(a.id, d.id ^ this.step, 161) % 1000) / 1000 * 1.2) * mul;
  // バジリスクの見つめから目を背けている者は、相手を見ずに打つので、傷が半分（src/eco/basilisk.ts）
  if (a.avert > this.w.tick) dmg *= 0.5;
  d.hp -= dmg;
  // 大物の溜め（突進など）は、体力の上限の2割を超える重い一撃を受けたときだけ止まる（src/eco/charge.ts の breakWindup）
  if (d.k !== Kind.Adventurer && d.act === 2 && d.actT < 0 && d.hp > 0 && dmg > this.maxHp(d) * 0.2) this.breakWindup(d);
  // リビングアーマーは、倒れずに強い一打を受けると、手の武器を落とす（src/eco/armor.ts）
  if (d.k === Kind.Armor && d.hp > 0) this.armorShed(d, dmg, a);
  // やられそうになったヴァンパイアは、コウモリの群れにばらけて逃げる（1日に1回、光の中ではできない。src/eco/vampire.ts）
  let scatter = false;
  if (d.k === Kind.Vampire && d.hp < this.maxHp(d) * 0.35 && this.vampCanScatter(d)) {
    d.hp = Math.max(1, d.hp);
    scatter = true;
  }
  if (d.k === Kind.Adventurer && d.hp > 0) this.heroHurt(d);
  d.hitAt = this.w.tick;
  d.foe = a.id;
  d.sleep = 0;
  // 焚き火で休む冒険者が打たれた：手強い敵なら一行が飛び起きる（src/eco/night.ts）
  if (d.k === Kind.Adventurer) this.campHit(d, a);
  this.fxHits.push({ t: this.w.tick, x: d.x, y: d.y, ax: a.x, ay: a.y, id: d.id });
  if (this.fxHits.length > 120) this.fxHits.splice(0, 40);
  if (fx) this.pushAttackFx(a, d, dmg > this.maxHp(d) * 0.4, d.hp <= 0);
  this.raiseAlarm(d, a);
  this.bleed(d, 1);
  // 焚き火のそばの小物との小競り合い（コウモリに血を吸われて払うなど）は、一行の皆を起こすほどの音を立てない
  if (!this.campPetty(a, d)) this.noise(d.x, d.y, 9);
  if (scatter) this.vampScatter(d);
  // 分析用：光の中で追い詰められ、コウモリにばらけられずに倒されたヴァンパイア
  else if (d.k === Kind.Vampire && d.hp <= 0 && this.step - d.lureAt >= DAY_TICKS_ECO / CR_EVERY) this.record('settle', { t: this.w.tick, k: Kind.Vampire, ev: 'lightKill', id: d.id, n: a.k, x: Math.round(d.x), y: Math.round(d.y) } as never);
  return d.hp <= 0;
}

/**
 * 戦い：打ち合い。攻める側が一打ち、守る側が打ち返す。体力が尽きた方が倒れる。
 * 勝てば（攻める側が）食べるか倒すかする。打ち合いは数回で決まる（通常速度で1〜2秒）
 */
export function fight(this: Ecology, a: Cr, d: Cr): boolean {
  a.act = 2;
  a.actT = 0;
  if (a.hp <= 0) a.hp = this.maxHp(a);
  // 寝込みの一打ち：焚き火で眠っている冒険者への最初の一打ちは重く（1.5倍）、その打ち合いでは打ち返されない（src/eco/night.ts）
  const asleep = this.nightHit(a, d);
  if (this.strike(a, d, asleep ? 1.5 : 1)) {
    this.slay(a, d);
    return true;
  }
  // 打ち返し（逃げている者と、寝込みを打たれて飛び起きたばかりの者は打ち返さない）
  // ゴーストは、人（冒険者とドワーフ）のほかには打ち返さない（モンスターとは命を取り合わない。src/eco/ghostskill.ts）
  if (d.flee <= 0 && this.str(d) > 0 && !asleep && !(d.k === Kind.Ghost && a.k !== Kind.Adventurer && a.k !== Kind.Dwarf)) {
    d.act = 2;
    d.actT = 0;
    // コウモリに群がられている者の打ち返しは弱い（src/eco/vampire.ts の batPinned）
    if (this.strike(d, a, this.batPinned(d) ? 0.4 : 0.8)) {
      this.die(a, 'fight', d.k);
      if (d.k === Kind.Vampire) this.vampClaim(d, a);
      else if (d.k === Kind.Thrall) this.thrallClaim(d, a);
      // リビングアーマーは、打ち返しで倒した相手も覚える（その落とし物を「奪って」取り込む。src/eco/armor.ts）
      if (d.k === Kind.Armor) {
        d.ref = a.id;
        d.ref2 = this.step;
      }
      return false;
    }
  }
  return false;
}

/** 体力の回復と、逃げる判断。true なら今は逃げている（ほかの行いをしない） */
export function woundsAndFlight(this: Ecology, c: Cr): boolean {
  const mx = this.maxHp(c);
  if (c.hp <= 0 || c.hp > mx) c.hp = mx;
  // 回復：ゆっくり。住みかや巣、食べたばかりなら早く。トロールは見る間にふさがる（炎の傷は除く）。骨と石は自分では治らない
  if (c.hp < mx && c.k !== Kind.Skeleton && c.k !== Kind.Golem && c.k !== Kind.Gargoyle && c.k !== Kind.Armor) {
    const home = sq(c.hx - c.x) + sq(c.hy - c.y) < 3 * TILE * 3 * TILE && (c.hx || c.hy);
    const every = c.k === Kind.Troll ? 8 : c.sleep > 0 ? 12 : home || c.sinceMeal < 200 ? 20 : 60;
    if (this.step % every === c.id % every) {
      const k = this.tileOf(c.x, c.y);
      const burnt = k >= 0 && this.w.ash[k] > 0 && c.k === Kind.Troll;
      if (!burnt) c.hp = Math.min(mx, c.hp + Math.max(1, mx / 40));
    }
  }
  // 深手の者は血の跡を点々と残す
  if (c.hp < mx * 0.5 && c.act === 1 && this.step % 18 === c.id % 18) this.bleed(c, 1);
  // 逃げる判断
  const tier = TIER[c.k] ?? 1;
  if (c.flee > 0) c.flee--;
  else if (tier > 0 && c.hp < mx * FLEE_AT[tier] && this.w.tick - c.hitAt < 60 && c.k !== Kind.Adventurer && c.k !== Kind.Dwarf) c.flee = 120 + (ih(c.id, this.step, 162) % 80);
  if (c.flee <= 0) return false;
  const f = this.byId.get(c.foe);
  c.act = 1;
  const sp = SPEC[c.k].speed * 1.2;
  // コボルトは、追っ手がすぐそば（6マス）にいるあいだは住処へ向かわず、まず追っ手から離れる（追っ手の脇をすり抜けて帰ろうとしない）
  const closeFoe = c.k === Kind.Kobold && f && !f.dead && sq(f.x - c.x) + sq(f.y - c.y) < 6 * TILE * 6 * TILE;
  // 住みかへ帰る道の途中に相手がいる（住みかへの向きと相手への向きがほぼ同じ）とき、相手が8マスの内なら住みかへは向かわない。
  // 相手が3マスより離れていればその場で身をひそめ、近ければ離れる向きへ動く（下）。
  // （以前は相手の方へ帰っては離れるのを、距離の境目で更新ごとに繰り返し、5分以上その場で行き来していた。はじまりの洞窟のコボルト）
  if ((c.hx || c.hy) && f && !f.dead && !closeFoe && sq(c.hx - c.x) + sq(c.hy - c.y) > 20 * 20) {
    const fd = Math.sqrt(sq(f.x - c.x) + sq(f.y - c.y)) || 1;
    const hd = Math.sqrt(sq(c.hx - c.x) + sq(c.hy - c.y)) || 1;
    const toward = ((f.x - c.x) * (c.hx - c.x) + (f.y - c.y) * (c.hy - c.y)) / (fd * hd);
    if (toward > 0.5 && fd < 8 * TILE && fd < hd) {
      // 相手が3マスより離れていれば、相手を大きく回り込むように横へ動いて住みかを目指す（住みかの側へ曲がる向きを選ぶ）
      if (fd > 3 * TILE) {
        this.skirt(c, f, sp);
        return true;
      }
      this.fleeFrom(c, f, sp);
      return true;
    }
  }
  if ((c.hx || c.hy) && !closeFoe) {
    // 巣や住みかへ逃げ帰る
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 20 * 20) {
      this.goTo(c, c.hx, c.hy, sp);
      return true;
    }
  }
  if (f && !f.dead) {
    // 住みかのそば（20px の内）まで逃げ帰っていて、相手が2マスより離れていれば、住みかで身を縮めてじっとする。
    // （以前はそこでも相手から離れる向きへ一歩ずつ動いたので、行き止まりにある住みかでは壁に押しつけたまま足を動かし続けた。
    //  seed27 では、住処のそばで休む冒険者への警戒（heedAlarm）が続き、コボルト10匹ほどが4〜6分足踏みしていた）
    // 巣や住みかへ逃げ帰った者は、その中へ身を隠す（denHidden。画面では暗がりに沈んで目だけが光る）。隠れている間は、すぐそばまで来た者にしか気づかれない
    if ((c.hx || c.hy) && sq(c.hx - c.x) + sq(c.hy - c.y) <= 20 * 20 && sq(f.x - c.x) + sq(f.y - c.y) > 2 * TILE * 2 * TILE) {
      this.cower(c, f);
      return true;
    }
    this.fleeFrom(c, f, sp);
  } else if ((c.hx || c.hy) && c.hungry < SPEC[c.k].starve * 0.5) {
    // 物音におびえて（相手のいないまま）巣へ逃げ帰った者は、逃げる時間が切れるまで巣のそばで身をひそめる。
    // （以前は巣の20px の内に着いたとたんに逃げるのをやめて餌探しへ戻り、次の物音でまた逃げ帰るのを、更新ごとに繰り返していた。
    //  seed35 では、リザードマンが大ネズミを狩り続ける巣穴のそばで、大ネズミが何匹も巣の縁で行ったり来たりしていた）
    c.act = 0;
  } else c.flee = 0;
  return true;
}

/**
 * 逃げる者が、相手から離れる向きへ一歩動く。行き止まりの壁などで動けなければ（ほとんど進まなければ）、その場で縮こまる（cower）。
 * （以前は壁に押しつけたまま歩く姿で足を動かし続けた。冒険者が住処のそばで休むと、行き止まりに逃げ込んだコボルトが何分も足踏みしていた。
 *  15シードの10〜18日目で、コボルトの2分以上の足踏みの半分以上がこれだった）
 */
export function fleeFrom(this: Ecology, c: Cr, f: Cr, sp: number): void {
  const dx = c.x - f.x;
  const dy = c.y - f.y;
  const L = Math.sqrt(dx * dx + dy * dy) || 1;
  const x0 = c.x;
  const y0 = c.y;
  this.tryMove(c, (dx / L) * sp, (dy / L) * sp);
  if (Math.abs(c.x - x0) + Math.abs(c.y - y0) >= sp * 0.3) return;
  // 行き止まりで逃げ場がない：相手が飛びかかれる所（1.5マス）にいれば、向き直って噛みつき返す（窮鼠猫を噛む）。
  // まだ離れていれば、相手の方へ向き直って身構える（cower）
  if (L < 1.5 * TILE && this.str(c) > 0 && !f.away) {
    this.setDir(c, f.x - c.x, f.y - c.y);
    // 分析用：追い詰められて噛みつき返した（lib/moments.ts。続けて噛みついている間は、一匹ごとに生き物の更新20回に1回だけ数える）
    if (this.step % 20 === c.id % 20) this.record('settle', { t: this.w.tick, k: c.k, ev: 'cornerBite', id: c.id, n: f.k, x: Math.round(c.x), y: Math.round(c.y) } as never);
    if (this.fight(c, f)) c.flee = 0;
    else c.act = 2;
    return;
  }
  this.cower(c, f);
}

/**
 * 住みかへ帰る道の途中に相手がいるとき、相手を回り込むように横へ動く。相手への向きに直角な二つの向きのうち、住みかの側の向きへ、
 * 少し相手から離れる向きを混ぜて進む。ふさがっていれば反対の向きを試し、どちらも進めなければ身構える（cower）
 */
export function skirt(this: Ecology, c: Cr, f: Cr, sp: number): void {
  const dx = c.x - f.x;
  const dy = c.y - f.y;
  const L = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const side = (c.hx - c.x) * -uy + (c.hy - c.y) * ux >= 0 ? 1 : -1;
  for (const sg of [side, -side]) {
    const vx = -uy * sg * 0.85 + ux * 0.5;
    const vy = ux * sg * 0.85 + uy * 0.5;
    const x0 = c.x;
    const y0 = c.y;
    this.tryMove(c, vx * sp, vy * sp);
    if (Math.abs(c.x - x0) + Math.abs(c.y - y0) >= sp * 0.3) {
      c.act = 1;
      return;
    }
  }
  this.cower(c, f);
}

/** 逃げて巣や住みかの中へ身を隠しているか（逃げている間に、住みかの20px の内で立ち止まっている） */
export function denHidden(this: Ecology, o: Cr): boolean {
  return !o.dead && o.flee > 0 && o.act === 0 && (o.hx !== 0 || o.hy !== 0) && sq(o.hx - o.x) + sq(o.hy - o.y) <= 20 * 20 && o.k !== Kind.Adventurer && o.k !== Kind.Dwarf;
}

/** 逃げる者が、その場で身構える：立ち止まって相手の方を向く（住みかのそばなら、その中へ身を隠したことになる。denHidden） */
export function cower(this: Ecology, c: Cr, f: Cr): void {
  c.act = 0;
  this.setDir(c, f.x - c.x, f.y - c.y);
}

/** 深手を負った者は足を引きずって遅くなる */
export function limp(this: Ecology, c: Cr): number {
  if (c.hp <= 0) return 1;
  const r = c.hp / this.maxHp(c);
  return r < 0.35 ? 0.6 : 1;
}

declare module '../ecology' {
  interface Ecology {
    str: typeof str;
    defend: typeof defend;
    leaveIfStarving: typeof leaveIfStarving;
    hunt: typeof hunt;
    maxHp: typeof maxHp;
    bleed: typeof bleed;
    strike: typeof strike;
    fight: typeof fight;
    woundsAndFlight: typeof woundsAndFlight;
    fleeFrom: typeof fleeFrom;
    cower: typeof cower;
    skirt: typeof skirt;
    denHidden: typeof denHidden;
    limp: typeof limp;
  }
}

Object.assign(Ecology.prototype, { str, defend, leaveIfStarving, hunt, maxHp, bleed, strike, fight, woundsAndFlight, fleeFrom, cower, skirt, denHidden, limp });
