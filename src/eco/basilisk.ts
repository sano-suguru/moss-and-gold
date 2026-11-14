/** Ecology のメソッド：バジリスク（濃いマナの暗がりに住み、睨みで相手を石に変え、飢えると獲物の所まで遠出する。src/ecology.ts のクラスに、prototype で足す） */
import { type Cr, DIR16, Ecology, HUNT5, Job, Kind, SPEC, STONE_FULL, STR, TIER, ih, sq } from '../ecology';
import type { Skill } from './skill';
import { lineOfSight, TILE } from '../mapgen';

/** バジリスクが湧く所の、まわりのマナの濃さのしきい値（src/eco/spawndef.ts）。湧いた所をそのまま住みかにする */
export const BASILISK_MANA = 30;
/**
 * バジリスクが遠出で追う獲物（住処で群れるコボルトとゴブリンを除く。遠出でそれらの住処へ踏み込むと、16シード×25日でコボルトの住処が78 → 53に減り、
 * ゴブリンが絶えたシードが1 → 6に増え、返り討ちにあうバジリスクも増えた）。住みかのそばでは、それらも狩る（HUNT5）
 */
export const BASILISK_ROAM_PREY: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Ant];

/** 睨み：およそ1.2秒、目を光らせて溜め、見つめ終わってから4秒は溜め直さない */
export const SKILL_BASILISK_GAZE: Skill = { windup: 6, cool: 20 };
/** 一度に見つめ続ける長さの上限（生き物の更新の回数） */
export const STARE_MAX = 40;
/** 見つめていて、この回数（生き物の更新）のあいだ目が合わなければ、見つめるのをやめる */
const STARE_LOST = 10;
/** 目が合っている更新1回で進む石化の量の元。実際の量は STONE_RATE × 40 / (40 + 体 + マナ / 2)：体が大きいほど、体のマナが多いほど進みにくい */
export const STONE_RATE = 10;
/** 打たれてから、打ってきた相手を先に見つめ返すまでの tick */
const GAZE_FOE_T = 60;
/** 見つめる相手を探す範囲（マス。夜目は、明るい所の相手なら8マス先まで見える：src/eco/senses.ts の canSense） */
const GAZE_LOOK_R = 8;
/**
 * 睨まない種：同じバジリスク、体が石や土の者（ガーゴイル・ゴーレム・ワーム）、竜、体のない者（ウィスプ・ゴースト）、空を飛ぶ者（コウモリ・ワイバーン。
 * 床に降りないので、石像にすると宙に浮いた石像になってしまう）
 */
const GAZE_IMMUNE = new Set<number>([Kind.Basilisk, Kind.Gargoyle, Kind.Golem, Kind.Worm, Kind.Dragon, Kind.Wisp, Kind.Ghost, Kind.Bat, Kind.Wyvern]);
/** 魔物が睨みの溜めに気づいて目を背ける割合（％。賢さの段階 TIER ごと：本能だけの者は背けない） */
const AVERT_TIER = [0, 10, 25, 40];

/**
 * 見つめられる相手か：バジリスクに見えている（canSense：夜目なので、5マスの内なら見通しが通れば、8マスの内なら相手が明るい所にいれば）。
 * 眠っている者は目を閉じているので見つめられない。腹の減っているバジリスクは、獲物を石にせず、噛んで仕留めて食べる
 */
function gazeTarget(e: Ecology, c: Cr, o: Cr): boolean {
  if (o.dead || o.away || o.caught || o.sleep > 0 || GAZE_IMMUNE.has(o.k)) return false;
  // 宝箱に化けているミミックは目を閉じている（襲いかかっている間だけ見つめられる）
  if (o.k === Kind.Mimic && o.act === 0) return false;
  if (c.hungry > 0 && HUNT5.includes(o.k)) return false;
  return e.canSense(c, o);
}

/** 睨みの溜めに気づいた相手が目を背ける割合（％）。冒険者は職業と位で、魔物は賢さで決まる */
function avertChance(e: Ecology, o: Cr): number {
  if (o.k === Kind.Adventurer) {
    const base = o.sp === Job.Thief || o.sp === Job.Hunter ? 60 : o.sp === Job.Slayer ? 50 : 40;
    return Math.min(90, base + 10 * (e.heroOf(o)?.rank ?? 0));
  }
  return AVERT_TIER[TIER[o.k] ?? 0] ?? 0;
}

/** 見つめで石化しかけた冒険者の一行に、そのことを被害として覚えさせる（町へ帰ると、バジリスクの噂が強まる。src/eco/quest.ts） */
function partyStoned(e: Ecology, c: Cr, o: Cr): void {
  if (o.k !== Kind.Adventurer || !o.party) return;
  const p = e.parties.find((q) => q.id === o.party);
  if (p) e.partyHurt(p, c.k, c.x, c.y, c.id, true);
}

/**
 * 睨みを始める（生き物の更新5回に1回見る。打たれたばかりなら、打ってきた相手を先に）：見えている相手に向き直り、目を光らせて溜める。
 * 相手から光る目が見えれば（見通しが通り、8マスの内）、相手は「!」と気づき、目を背けるかを決める（背けた者は、この見つめのあいだ背中を向ける）
 */
export function gazeStart(this: Ecology, c: Cr): boolean {
  if (this.step % 5 !== c.id % 5 || !this.skillCanStart(c, SKILL_BASILISK_GAZE)) return false;
  let target: Cr | null = null;
  if (this.w.tick - c.hitAt <= GAZE_FOE_T && c.foe) {
    const f = this.byId.get(c.foe);
    if (f && gazeTarget(this, c, f)) target = f;
  }
  if (!target) {
    let bd = Infinity;
    this.nearby(c.x, c.y, GAZE_LOOK_R, (o) => {
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d >= bd || !gazeTarget(this, c, o)) return;
      bd = d;
      target = o;
    });
  }
  if (!target) return false;
  const t = target as Cr;
  c.run = -1;
  c.aim = t.id;
  c.lure = 0;
  this.setDir(c, t.x - c.x, t.y - c.y);
  this.skillStart(c, SKILL_BASILISK_GAZE);
  if (sq(t.x - c.x) + sq(t.y - c.y) <= GAZE_LOOK_R * TILE * GAZE_LOOK_R * TILE && lineOfSight(this.w.map, t.x, t.y, c.x, c.y)) {
    this.markNotice(t, c, '!');
    if (ih(t.id, c.cast, 431) % 100 < avertChance(this, t)) {
      t.avert = this.w.tick + (SKILL_BASILISK_GAZE.windup + STARE_MAX) * 2;
      this.record('settle', { t: this.w.tick, k: Kind.Basilisk, id: c.id, ev: 'gaze', n: t.k, how: 0, x: Math.round(t.x), y: Math.round(t.y) } as never);
    }
  }
  return true;
}

/** 見つめるのをやめる（ここから次の睨みまでの間を数える）。見つめていた相手が目を背けていれば、背けるのをやめる（ほかの相手を打つ傷が半分のまま残らないように） */
function stareEnd(e: Ecology, c: Cr): void {
  const o = c.aim ? e.byId.get(c.aim) : undefined;
  if (o && o.avert > e.w.tick) o.avert = e.w.tick;
  c.run = 0;
  c.aim = 0;
  c.act = 0;
  c.actT = 0;
  c.cast = e.w.tick - SKILL_BASILISK_GAZE.windup * 2;
}

/**
 * 睨みの溜めと、見つめる間（src/eco/step.ts から、深手で逃げる処理・火を怖がって離れる処理・縄張りの張り合いより先に呼ぶ。この回に睨みのことをしたら true）。
 * 溜めの間はほかのことをしない（打たれても止まらない）。溜め終わったら、相手が見えている間（STARE_MAX 回まで）立ち止まって見つめ続け、
 * 相手がバジリスクのほうを向いて目が合っている間、石化が進む（目を背けている者は進まない）。満ちたら石像になる。
 * 深手で逃げる処理より先なので、追い詰められたバジリスクは逃げずに見つめ返す
 * （以前は4マスの内の相手に8秒おきの一発で、冒険者は5マス前後から打って2〜3秒で倒し、16シード×25日で冒険者が石化しかけたのは13回、石像は0だった）
 */
export function basiliskGaze(this: Ecology, c: Cr): boolean {
  // 眠っている間は目を閉じている
  if (c.sleep > 0) {
    if (c.run === -1 || c.run === -6) stareEnd(this, c);
    return false;
  }
  if (c.run === -1) {
    const g = this.skillStep(c, SKILL_BASILISK_GAZE, false);
    // 溜めの間も目が光る
    if (g === 'charging') {
      c.glow = Math.max(c.glow, 30);
      return true;
    }
    if (g !== 'ready') {
      c.run = 0;
      return this.gazeStart(c);
    }
    c.run = -6;
    c.ref = this.step;
  }
  if (c.run !== -6) return this.gazeStart(c);
  const o = this.byId.get(c.aim);
  const staring = (this.w.tick - c.cast) / 2 - SKILL_BASILISK_GAZE.windup;
  if (!o || staring > STARE_MAX || !gazeTarget(this, c, o)) {
    stareEnd(this, c);
    return false;
  }
  c.act = 2;
  // 見つめている間は目が光る（暗がりでも、8マスの内の冒険者から見える：src/eco/adventurer.ts の seenBy）
  c.glow = Math.max(c.glow, 30);
  this.setDir(c, o.x - c.x, o.y - c.y);
  // 目が合っているか：相手が背けておらず、バジリスクのほうを向いている。生き物の更新 STARE_LOST 回のあいだ目が合わなければ、見つめるのをやめる
  // （次の睨みで、目の合う別の相手に移れるように。以前は背けた相手を8秒見つめ続け、正面で打ち合う者の石化が進まなかった）
  const fx = o.dir === 2 ? 1 : o.dir === 3 ? -1 : 0;
  const fy = o.dir === 0 ? 1 : o.dir === 1 ? -1 : 0;
  if (o.avert > this.w.tick || (c.x - o.x) * fx + (c.y - o.y) * fy <= 0) {
    if (this.step - c.ref > STARE_LOST) {
      stareEnd(this, c);
      return false;
    }
    return true;
  }
  c.ref = this.step;
  o.stone += (STONE_RATE * 40) / (40 + o.body + o.mana / 2);
  if (staring % 6 === 0) {
    // 睨みの線（描画専用）
    this.fxAttacks.push({ t: this.w.tick, style: 'beam', col: 6, size: 1, ax: c.x, ay: c.y, dx: o.x, dy: o.y, did: o.id, aid: c.id, big: false, kill: false });
    if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  }
  const rec = (how: number) => this.record('settle', { t: this.w.tick, k: Kind.Basilisk, id: c.id, ev: 'gaze', n: o.k, how, x: Math.round(o.x), y: Math.round(o.y) } as never);
  if (o.stone >= STONE_FULL) {
    rec(2);
    partyStoned(this, c, o);
    this.petrify(o, Kind.Basilisk);
    stareEnd(this, c);
    return true;
  }
  // 最初に目が合ったとき：記録し、相手が反応する。冒険者は見つめるバジリスクに気づいて戦う（foe）。小さな魔物（強さ6未満：大ネズミ・コボルト・ゴブリンなど）は逃げる。
  // 大物（強さ6以上：ミノタウロス・トロール・オークなど）は、目をそらして数歩下がる（追わない。打ち合うなら目を背けたままで、傷は半分）。
  // （以前は大物を向き直らせていたので、見つめられ続けて、16シード×25日でミノタウロスの死の40％が石になっていた。
  //  賢さの段階で分けたときは、コボルトとゴブリンまで目をそらして下がり、小さな魔物が石にならなくなった）
  if (!c.lure) {
    c.lure = 1;
    rec(1);
    partyStoned(this, c, o);
    if (o.k === Kind.Adventurer) {
      // 見つめるバジリスクに気づかせて戦わせる（打たれた扱いにはしない：hitAt を入れると、打たれたように光り、溜めていた技も止まる）
      o.foe = c.id;
    } else if (STR[o.k] < 6) {
      o.flee = Math.max(o.flee, 60 + (o.id % 20));
      o.foe = c.id;
    } else {
      o.avert = Math.max(o.avert, this.w.tick + (STARE_MAX - staring) * 2 + 40);
      o.flee = Math.max(o.flee, 20 + (o.id % 10));
      o.foe = c.id;
    }
  }
  return true;
}

export function basilisk(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Basilisk];
  if (this.leaveIfStarving(c)) return;
  // 噛みついた直後は、少しのあいだ動かない（睨みの溜めと見つめは、src/eco/step.ts から basiliskGaze が先に行う）
  if (c.act === 2 && c.actT >= 0 && c.actT < 6) return;
  // 飢えの猶予を過ぎ、体のマナを燃やしはじめたら、住みかを出て、獲物のいる所まで遠出する（広く10マスで獲物を探す）。
  // 湧く濃いマナの暗がりには、たいてい獲物がいない（main の16シード×25日では、湧いた所の12マスの内に獲物がいたのは110頭中7頭）。
  // 以前の遠出は、マナが尽きかけてから（飢えて去るのと同じ条件）だったので、先に去りはじめてしまい、ほとんど起きなかった。
  // 胃が空になってすぐ（生き物の更新1500回）出ると、狩りすぎて大ネズミの生まれる数が16シード×25日で2割5分ほど減ったので、マナを燃やしはじめるまで待つ
  const roam = c.hungry > s.starve;
  if (c.hungry && this.hunt(c, roam ? 10 : 8, roam ? BASILISK_ROAM_PREY : HUNT5, s.speed * 1.2)) {
    // 狩りのあいだは見回りをやめる（見回りで歩くバジリスクからは大ネズミが逃げるが、狩りで忍び寄るときは逃げない）
    c.gait = 0;
    return;
  }
  // 狩れる獲物がいなければ、マナが減っているとき、近くのウィスプを吸う
  if (this.sipWisp(c)) return;
  // 湧いた所（濃いマナの暗がり）を住みかにする（休んでいる間に足もとのマナを吸えるように）。住みかが明るければ、入口から離れた暗がりへ移る。
  // （以前は、住みかのまわりのマナが30未満なら移っていた。湧くときに体へ足もとのマナを取るので、湧いた直後に30を割ることがあり、
  // main の16シード×25日では110頭中29頭が、湧いてすぐ遠く（ときに100マス以上先）の暗がりへ住みかを移し、うち10頭がマナの薄い所で飢え死にした）
  const m = this.w.map;
  const hk = this.tileOf(c.hx, c.hy);
  if (c.hx === c.x && c.hy === c.y && !(hk >= 0 && this.w.lightBase[hk] === 0)) {
    const lair = this.pickDark(2, 80);
    if (lair >= 0) {
      c.hx = (lair % m.w) * TILE + 8;
      c.hy = Math.floor(lair / m.w) * TILE + 8;
    }
  }
  if (roam) {
    c.gait = 0;
    // 遠出：生き物の更新32回ごとに、同じ洞窟の領域の、40マスの内でいちばん近い獲物の居場所を選び直し（tx, ty）、そこへ歩く。
    // 着いたら、その場で獲物を探す（上の hunt）。着いても見つからなければ、住みかから32マスの内を歩き回る
    if (this.step % 32 === c.id % 32) {
      c.tx = 0;
      c.ty = 0;
      const reg = this.regionOf(this.tileOf(c.x, c.y));
      let bd = 40 * TILE * 40 * TILE;
      for (const o of this.list) {
        if (o.dead || o.away || o.caught || !BASILISK_ROAM_PREY.includes(o.k)) continue;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d >= bd || this.regionOf(this.tileOf(o.x, o.y)) !== reg) continue;
        bd = d;
        c.tx = o.x;
        c.ty = o.y;
      }
      // 獲物が見つからなければ、同じ洞窟の領域の、マナの濃い暗がりへ寝床を移す（そこで眠れば、足もとのマナを吸える：restSoak）
      if (!c.tx && !c.ty) this.basiliskManaBed(c, reg);
    }
    if (c.tx || c.ty) {
      if (sq(c.tx - c.x) + sq(c.ty - c.y) > 2 * TILE * 2 * TILE) {
        c.act = 1;
        this.goTo(c, c.tx, c.ty, s.speed);
        return;
      }
      if (sq(c.hx - c.x) + sq(c.hy - c.y) > 32 * TILE * 32 * TILE) {
        c.act = 1;
        this.goTo(c, c.hx, c.hy, s.speed);
        return;
      }
      c.act = 1;
      const j = DIR16[ih(c.id, this.step >> 6, 114) & 15];
      this.tryMove(c, j[0] * s.speed, j[1] * s.speed);
      return;
    }
    // 獲物がいないあいだは、ぶらつかずに寝床へ戻って休む（歩き回るとマナを燃やすばかりで、眠って土から吸う間がなかった）
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > 2 * TILE * 2 * TILE) {
      c.act = 1;
      this.goTo(c, c.hx, c.hy, s.speed);
      return;
    }
    c.act = 0;
    return;
  }
  this.basiliskPatrol(c);
}

/**
 * 獲物の見つからないバジリスクが、寝床を同じ洞窟の領域（reg）のマナの濃い暗がりへ移す。いまいる所から24マス四方を2マスおきに見て、
 * 開いた床・日の差さない暗がり・水たまりでない所のうち、まわりのマナ（manaAround）がいちばん濃いマスを選び、
 * いまの寝床より5以上濃ければ、そこを住みか（hx, hy）にする（同じくらいなら移らない。行ったり来たりしないように）
 */
export function basiliskManaBed(this: Ecology, c: Cr, reg: number): void {
  const m = this.w.map;
  const cx = Math.floor(c.x / TILE);
  const cy = Math.floor(c.y / TILE);
  const hk = this.tileOf(c.hx, c.hy);
  let best = -1;
  let bm = (hk >= 0 ? this.manaAround(hk) : 0) + 5;
  for (let dy = -24; dy <= 24; dy += 2)
    for (let dx = -24; dx <= 24; dx += 2) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.lightBase[k] > 0 || this.regionOf(k) !== reg) continue;
      const mn = this.manaAround(k);
      if (mn <= bm) continue;
      bm = mn;
      best = k;
    }
  if (best < 0) return;
  c.hx = (best % m.w) * TILE + 8;
  c.hy = Math.floor(best / m.w) * TILE + 8;
}

/** 見回り：寝床で休む長さ、見回り先で立ち止まって見回す長さ、見回り先へ歩くのをあきらめるまでの長さ（どれも生き物の更新の回数） */
export const PATROL_REST = 400;
export const PATROL_LINGER = 150;
export const PATROL_TIMEOUT = 900;
/** 見回り先を選ぶ範囲（寝床から、縦と横にこのマス数の内） */
const PATROL_R = 30;
/** 眠気（drowsy）がこれを超えたら、見回りをやめて寝床へ帰る（眠りに落ちるしきい値は1560〜3614。寝床で眠れば、足もとのマナを吸える） */
const PATROL_DROWSY = 1400;

/**
 * 見回り先を選ぶ：寝床のまわり PATROL_R マス四方を16か所試し、最初に条件を満たすマスを返す（なければ −1）。
 * 条件：開いた床で、日の差さない暗がり、水たまりでない、寝床と同じ洞窟の領域、まわりのマナが10以上、人の気配が濃すぎない（0.4未満。冒険者の通り道にも出ていく）、
 * 寝床から minD マス以上、ほかのバジリスクの寝床から10マス以上（縄張りの張り合いを避ける）
 */
export function basiliskWaypoint(this: Ecology, c: Cr, minD: number): number {
  const m = this.w.map;
  const hk = this.tileOf(c.hx, c.hy);
  if (hk < 0) return -1;
  const reg = this.regionOf(hk);
  const bx = hk % m.w;
  const by = Math.floor(hk / m.w);
  // ほかのバジリスクの寝床（マス）を、候補を調べる前に一度だけ集める
  const beds: [number, number][] = [];
  for (const o of this.list) if (o !== c && !o.dead && o.k === Kind.Basilisk) beds.push([o.hx / TILE, o.hy / TILE]);
  for (let i = 0; i < 16; i++) {
    const h = ih(c.id, this.step, 410 + i);
    const x = bx + (h % (PATROL_R * 2 + 1)) - PATROL_R;
    const y = by + ((h >> 8) % (PATROL_R * 2 + 1)) - PATROL_R;
    if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1 || Math.abs(x - bx) + Math.abs(y - by) < minD) continue;
    const k = y * m.w + x;
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.lightBase[k] > 0 || this.regionOf(k) !== reg) continue;
    if (this.manaAround(k) < 10 || this.presenceAt(x * TILE + 8, y * TILE + 8) >= 0.4) continue;
    if (beds.some(([hx, hy]) => Math.abs(hx - x) + Math.abs(hy - y) < 10)) continue;
    return k;
  }
  return -1;
}

/** 寝床を移す（how：0 寝床のマナが薄くなった、1 襲われて生き延びた）。最後に移した tick を ref2 に覚える */
function moveBed(e: Ecology, c: Cr, k: number, how: number): void {
  const m = e.w.map;
  c.hx = (k % m.w) * TILE + 8;
  c.hy = Math.floor(k / m.w) * TILE + 8;
  c.ref2 = e.w.tick;
  e.record('settle', { t: e.w.tick, k: Kind.Basilisk, id: c.id, ev: 'bedMove', how, x: Math.round(c.hx), y: Math.round(c.hy) } as never);
}

/**
 * 縄張りの見回り（遠出していないとき）。段は gait に、その段に入った生き物の更新の番号は lureAt に、見回り先は tx, ty に覚える（どれもセーブされる）。
 * 0 寝床のそばで休む（たいてい立ち止まり、ときどき歩く）→ PATROL_REST 回たったら見回り先を選ぶ
 * 1 見回り先へ歩く → 着いた・行き詰まった・PATROL_TIMEOUT 回たったら
 * 2 見回り先で立ち止まって見回す → PATROL_LINGER 回たったら、寝床のまわりのマナが20未満と薄く、ここが5以上濃ければ、ここを寝床にする。そうでなければ
 * 3 寝床へ帰る → 着いたら 0
 * 眠気が溜まったら寝床へ帰る。襲われて生き延びたら、寝床から20マス以上離れた所へ寝床を移す
 */
export function basiliskPatrol(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Basilisk];
  const since = this.step - c.lureAt;
  const phase = (g: number) => {
    c.gait = g;
    c.lureAt = this.step;
  };
  // 襲われて生き延びたら（打たれてから300 tick たち、逃げ終えていれば）、寝床を離れた所へ移す
  if (c.hitAt > c.ref2 && this.w.tick - c.hitAt > 300 && c.flee <= 0) {
    const k = this.basiliskWaypoint(c, 20);
    c.ref2 = this.w.tick;
    if (k >= 0) {
      moveBed(this, c, k, 1);
      c.tx = c.hx;
      c.ty = c.hy;
      phase(1);
    }
  }
  if ((c.gait === 1 || c.gait === 2) && c.drowsy > PATROL_DROWSY) phase(3);
  if (c.gait === 1) {
    const arrived = sq(c.tx - c.x) + sq(c.ty - c.y) < sq(1.5 * TILE);
    const stuck = (this.paths.get(c.id)?.miss ?? 0) >= 3;
    if (!arrived && !stuck && since < PATROL_TIMEOUT) {
      c.act = 1;
      this.goTo(c, c.tx, c.ty, s.speed);
      return;
    }
    phase(2);
  }
  if (c.gait === 2) {
    if (since < PATROL_LINGER) {
      c.act = 0;
      if (since % 40 === 0) c.dir = ih(c.id, this.step, 412) & 3;
      return;
    }
    const here = this.tileOf(c.x, c.y);
    const hk = this.tileOf(c.hx, c.hy);
    const bedMana = hk >= 0 ? this.manaAround(hk) : 0;
    if (here >= 0 && bedMana < 20 && this.w.lightBase[here] === 0 && this.manaAround(here) >= bedMana + 5) {
      moveBed(this, c, here, 0);
      phase(0);
    } else phase(3);
  }
  if (c.gait === 3) {
    if (sq(c.hx - c.x) + sq(c.hy - c.y) > sq(1.5 * TILE)) {
      c.act = 1;
      this.goTo(c, c.hx, c.hy, s.speed);
      return;
    }
    phase(0);
  }
  // 段0：寝床のそば（10マスの内）へ帰り、たいてい立ち止まり、ときどき、ふつうに近い速さで歩く（もともと足の遅い種なので、それでもゆっくり）。
  // （以前はふつうの速さの0.6倍で歩き、脚を動かしながらほとんど進まず、足踏みして見えていた）
  if (sq(c.hx - c.x) + sq(c.hy - c.y) > 10 * TILE * 10 * TILE) {
    c.act = 1;
    this.goTo(c, c.hx, c.hy, s.speed);
    return;
  }
  if (this.step - c.lureAt >= PATROL_REST && c.drowsy < PATROL_DROWSY) {
    const k = this.basiliskWaypoint(c, 10);
    if (k >= 0) {
      const m = this.w.map;
      c.tx = (k % m.w) * TILE + 8;
      c.ty = Math.floor(k / m.w) * TILE + 8;
      phase(1);
      this.record('settle', { t: this.w.tick, k: Kind.Basilisk, id: c.id, ev: 'patrol', x: Math.round(c.tx), y: Math.round(c.ty) } as never);
      c.act = 1;
      this.goTo(c, c.tx, c.ty, s.speed);
      return;
    }
    // 見回り先が見つからなければ、しばらく休んでから選び直す
    c.lureAt = this.step;
  }
  c.act = c.actT % 90 < 50 ? 0 : 1;
  if (c.act === 1) {
    const j = DIR16[ih(c.id, this.step >> 5, 113) & 15];
    this.tryMove(c, j[0] * s.speed * 0.9, j[1] * s.speed * 0.9);
  }
}

declare module '../ecology' {
  interface Ecology {
    basilisk: typeof basilisk;
    basiliskManaBed: typeof basiliskManaBed;
    gazeStart: typeof gazeStart;
    basiliskGaze: typeof basiliskGaze;
    basiliskWaypoint: typeof basiliskWaypoint;
    basiliskPatrol: typeof basiliskPatrol;
  }
}

Object.assign(Ecology.prototype, { basilisk, basiliskManaBed, gazeStart, basiliskGaze, basiliskWaypoint, basiliskPatrol });
