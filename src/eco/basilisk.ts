/** Ecology のメソッド：バジリスク（濃いマナの暗がりに住み、睨みで相手を石に変え、飢えると獲物の所まで遠出する。src/ecology.ts のクラスに、prototype で足す） */
import { Cr, DIR16, Ecology, HUNT5, Job, Kind, SPEC, STONE_FULL, STONE_GAZE, TIER, ih, sq } from '../ecology';
import { Skill } from './skill';
import { lineOfSight, TILE } from '../mapgen';

/** バジリスクが湧く所の、まわりのマナの濃さのしきい値（src/eco/spawndef.ts）。湧いた所をそのまま住みかにする */
export const BASILISK_MANA = 30;
/**
 * バジリスクが遠出で追う獲物（住処で群れるコボルトとゴブリンを除く。遠出でそれらの住処へ踏み込むと、16シード×25日でコボルトの住処が78 → 53に減り、
 * ゴブリンが絶えたシードが1 → 6に増え、返り討ちにあうバジリスクも増えた）。住みかのそばでは、それらも狩る（HUNT5）
 */
export const BASILISK_ROAM_PREY: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Ant];

/** 睨みの届く距離（マス） */
export const GAZE_R = 4;
/**
 * 打ってきた相手を睨み返す距離（マス）と、打たれてから睨み返すまでの tick：打たれてから GAZE_FOE_T tick の内なら、生き物の更新2回に1回、
 * GAZE_FOE_R マスの内で見通しの通る、打ってきた相手を先に睨む。冒険者は魔法の矢・矢の雨・短剣投げで5マス前後から打ち、4マスの内に入る前に倒していた
 * （冒険者に倒された21頭の、傷を受けてから死ぬまでの更新のうち、389回は冒険者が4マスより遠かった）
 */
const GAZE_FOE_R = 7;
const GAZE_FOE_T = 60;
/** 睨み：およそ1.6秒、目を光らせて溜め、放ったあと8秒は溜め直さない */
export const SKILL_BASILISK_GAZE: Skill = { windup: 8, cool: 40 };
/**
 * 睨まない種：同じバジリスク、体が石や土の者（ガーゴイル・ゴーレム・ワーム）、竜、体のない者（ウィスプ・ゴースト）、空を飛ぶ者（コウモリ・ワイバーン。
 * 床に降りないので、石像にすると宙に浮いた石像になってしまう）
 */
const GAZE_IMMUNE = new Set<number>([Kind.Basilisk, Kind.Gargoyle, Kind.Golem, Kind.Worm, Kind.Dragon, Kind.Wisp, Kind.Ghost, Kind.Bat, Kind.Wyvern]);
/** 魔物が睨みの溜めに気づいて目を背ける割合（％。賢さの段階 TIER ごと：本能だけの者は背けない） */
const AVERT_TIER = [0, 10, 25, 40];

/** 睨み返す相手（打たれてから GAZE_FOE_T tick の内で、打ってきた相手が GAZE_FOE_R マスの内で見通しが通っていれば）。なければ null */
function gazeFoe(e: Ecology, c: Cr): Cr | null {
  if (e.w.tick - c.hitAt > GAZE_FOE_T || !c.foe) return null;
  const f = e.byId.get(c.foe);
  return f && gazeTarget(e, c, f, GAZE_FOE_R) ? f : null;
}

/** 睨める相手か（眠っている者は目を閉じているので睨まれない。腹の減っているバジリスクは、獲物を石にせず、噛んで仕留めて食べる） */
function gazeTarget(e: Ecology, c: Cr, o: Cr, R = GAZE_R): boolean {
  if (o.dead || o.away || o.caught || o.sleep > 0 || GAZE_IMMUNE.has(o.k)) return false;
  // 宝箱に化けているミミックは目を閉じている（襲いかかっている間だけ睨まれる）
  if (o.k === Kind.Mimic && o.act === 0) return false;
  if (c.hungry > 0 && HUNT5.includes(o.k)) return false;
  return sq(o.x - c.x) + sq(o.y - c.y) <= R * TILE * R * TILE && lineOfSight(e.w.map, c.x, c.y, o.x, o.y);
}

/**
 * 睨みの溜めを始める（生き物の更新10回に1回見る）：GAZE_R マスの内で見通しの通る、いちばん近い相手に向き直り、目を光らせて溜める。
 * 相手は溜めに気づいて「!」を出す（目を背けるかは、放つときに決める）
 */
export function gazeStart(this: Ecology, c: Cr): boolean {
  if (!this.skillCanStart(c, SKILL_BASILISK_GAZE)) return false;
  // 打たれたばかりなら、打ってきた相手を先に睨み返す（生き物の更新2回に1回見る）
  const foe = this.step % 2 === c.id % 2 ? gazeFoe(this, c) : null;
  if (!foe && this.step % 10 !== c.id % 10) return false;
  let target: Cr | null = foe;
  let bd = Infinity;
  if (!target) this.nearby(c.x, c.y, GAZE_R, (o) => {
    if (!gazeTarget(this, c, o)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      target = o;
    }
  });
  if (!target) return false;
  const t = target as Cr;
  c.run = -1;
  c.aim = t.id;
  this.setDir(c, t.x - c.x, t.y - c.y);
  this.skillStart(c, SKILL_BASILISK_GAZE);
  this.markNotice(t, c, '!');
  return true;
}

/**
 * 睨みの溜めと、放つ判断（src/eco/step.ts から、深手で逃げる処理・火を怖がって離れる処理・縄張りの張り合いより先に呼ぶ）。
 * 逃げる処理より後だと、冒険者の一打ちで体力が半分を切ると逃げるばかりで睨めず、16シード×25日で冒険者を睨めたのは数回だった
 * （冒険者に倒された16頭の、傷を受けてから死ぬまでの更新のうち、166回が逃げていて睨めなかった）。逃げながらでも、追ってくる者を振り返って睨む。
 * 溜めの間はほかのことをせず、溜め終わったら放つ（溜めの間に打たれても止まらない）。この回に睨みのことをしたら true
 */
export function basiliskGaze(this: Ecology, c: Cr): boolean {
  // 眠っている間は目を閉じている
  if (c.sleep > 0) return false;
  const g = c.run === -1 ? this.skillStep(c, SKILL_BASILISK_GAZE, false) : '';
  if (g === 'charging') return true;
  if (g === 'ready') {
    c.run = 0;
    this.gazeRelease(c);
    return true;
  }
  if (c.run === -1) c.run = 0;
  // 噛みついた直後や打ち合いの最中でも、睨みは始められる（以前は、噛みついた直後の止まる間を待っていたので、冒険者と打ち合っている間は一度も睨めなかった）
  return this.gazeStart(c);
}

/** 睨みの溜めに気づいた相手が目を背ける割合（％）。冒険者は職業と位で、魔物は賢さで決まる */
function avertChance(e: Ecology, o: Cr): number {
  if (o.k === Kind.Adventurer) {
    const base = o.sp === Job.Thief || o.sp === Job.Hunter ? 60 : o.sp === Job.Slayer ? 50 : 40;
    return Math.min(90, base + 10 * (e.heroOf(o)?.rank ?? 0));
  }
  return AVERT_TIER[TIER[o.k] ?? 0] ?? 0;
}

/**
 * 睨みを放つ：溜めた相手がまだ GAZE_R マスの内で見通しが通っていれば、目を背けたか、受けたかを決める。
 * 受けた相手は石化が進み（体が大きいほど、体のマナが多いほど少ししか進まない）、STONE_FULL に達すると石像になる。
 * 石像にならなかった相手：冒険者は睨んだバジリスクに気づいて戦い（foe・hitAt）、本能か動物の賢さの魔物は逃げ、ほかの魔物は向き直るだけ（追わせない）
 */
export function gazeRelease(this: Ecology, c: Cr): void {
  const o = this.byId.get(c.aim);
  c.aim = 0;
  if (!o || !gazeTarget(this, c, o, o.id === c.foe && this.w.tick - c.hitAt <= GAZE_FOE_T + SKILL_BASILISK_GAZE.windup * 2 ? GAZE_FOE_R : GAZE_R)) return;
  const rec = (how: number) => this.record('settle', { t: this.w.tick, k: Kind.Basilisk, id: c.id, ev: 'gaze', n: o.k, how, x: Math.round(o.x), y: Math.round(o.y) } as never);
  // 目を背ける：バジリスクに背を向けて、この一回を受けない
  if (ih(o.id, c.cast, 431) % 100 < avertChance(this, o)) {
    this.setDir(o, o.x - c.x, o.y - c.y);
    rec(0);
    return;
  }
  // 睨みの線（描画専用）
  this.fxAttacks.push({ t: this.w.tick, style: 'beam', col: 6, size: 1, ax: c.x, ay: c.y, dx: o.x, dy: o.y, did: o.id, aid: c.id, big: false, kill: false });
  if (this.fxAttacks.length > 160) this.fxAttacks.splice(0, 60);
  o.stone += Math.max(1, Math.round((STONE_GAZE * 40) / (40 + o.body + o.mana / 2)));
  if (o.stone >= STONE_FULL) {
    rec(2);
    this.petrify(o, Kind.Basilisk);
    return;
  }
  rec(1);
  if (o.k === Kind.Adventurer) {
    o.foe = c.id;
    o.hitAt = this.w.tick;
  } else if ((TIER[o.k] ?? 0) <= 1) {
    o.flee = Math.max(o.flee, 60 + (o.id % 20));
    o.foe = c.id;
  } else this.setDir(o, c.x - o.x, c.y - o.y);
}

export function basilisk(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Basilisk];
  if (this.leaveIfStarving(c)) return;
  // 噛みついた直後は、少しのあいだ動かない（睨みの溜めと放つのは、src/eco/step.ts から basiliskGaze が先に行う）
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
 * 条件：開いた床で、日の差さない暗がり、水たまりでない、寝床と同じ洞窟の領域、まわりのマナが10以上、人の気配が薄い（0.2未満）、
 * 寝床から minD マス以上、ほかのバジリスクの寝床から10マス以上（縄張りの張り合いを避ける）
 */
export function basiliskWaypoint(this: Ecology, c: Cr, minD: number): number {
  const m = this.w.map;
  const hk = this.tileOf(c.hx, c.hy);
  if (hk < 0) return -1;
  const reg = this.regionOf(hk);
  const bx = hk % m.w;
  const by = Math.floor(hk / m.w);
  for (let i = 0; i < 16; i++) {
    const h = ih(c.id, this.step, 410 + i);
    const x = bx + (h % (PATROL_R * 2 + 1)) - PATROL_R;
    const y = by + ((h >> 8) % (PATROL_R * 2 + 1)) - PATROL_R;
    if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1 || Math.abs(x - bx) + Math.abs(y - by) < minD) continue;
    const k = y * m.w + x;
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 10 || this.w.lightBase[k] > 0 || this.regionOf(k) !== reg) continue;
    if (this.manaAround(k) < 10 || this.presenceAt(x * TILE + 8, y * TILE + 8) >= 0.2) continue;
    if (this.list.some((o) => o !== c && !o.dead && o.k === Kind.Basilisk && Math.abs(o.hx / TILE - x) + Math.abs(o.hy / TILE - y) < 10)) continue;
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
    gazeRelease: typeof gazeRelease;
    basiliskWaypoint: typeof basiliskWaypoint;
    basiliskPatrol: typeof basiliskPatrol;
  }
}

Object.assign(Ecology.prototype, { basilisk, basiliskManaBed, gazeStart, basiliskGaze, gazeRelease, basiliskWaypoint, basiliskPatrol });
