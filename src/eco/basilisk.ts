/** Ecology のメソッド：バジリスク（濃いマナの暗がりに住み、睨みで相手を石に変え、飢えると獲物の所まで遠出する。src/ecology.ts のクラスに、prototype で足す） */
import { Cr, DIR16, Ecology, HUNT5, Kind, SPEC, STR, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';

/** バジリスクが湧く所の、まわりのマナの濃さのしきい値（src/eco/spawndef.ts）。湧いた所をそのまま住みかにする */
export const BASILISK_MANA = 30;
/**
 * バジリスクが遠出で追う獲物（住処で群れるコボルトとゴブリンを除く。遠出でそれらの住処へ踏み込むと、16シード×25日でコボルトの住処が78 → 53に減り、
 * ゴブリンが絶えたシードが1 → 6に増え、返り討ちにあうバジリスクも増えた）。住みかのそばでは、それらも狩る（HUNT5）
 */
export const BASILISK_ROAM_PREY: Kind[] = [Kind.Rat, Kind.Lizard, Kind.Ant];

export function basilisk(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Basilisk];
  if (this.leaveIfStarving(c)) return;
  if (c.act === 2 && c.actT < 6) return;
  // 自分より大きなものが近づくと睨みつけ、見通しの通っている相手を石に変える
  if (this.step % 10 === c.id % 10) {
    let target: Cr | null = null;
    this.nearby(c.x, c.y, 4, (o) => {
      if (target || o.dead || o.away || STR[o.k] < 6 || o.k === Kind.Basilisk || o.k === Kind.Gargoyle || o.k === Kind.Dragon) return;
      if (sq(o.x - c.x) + sq(o.y - c.y) > 4 * TILE * 4 * TILE) return;
      const m = this.w.map;
      if (!lineOfSight(m, c.x, c.y, o.x, o.y)) return;
      target = o;
    });
    if (target) {
      const t = target as Cr;
      c.act = 2;
      c.actT = 0;
      const dx = t.x - c.x;
      const dy = t.y - c.y;
      c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : dy > 0 ? 0 : 1;
      if (ih(c.id, t.id, this.step) % 24 === 0) this.petrify(t, Kind.Basilisk);
      return;
    }
  }
  // 飢えの猶予を過ぎ、体のマナを燃やしはじめたら、住みかを出て、獲物のいる所まで遠出する（広く10マスで獲物を探す）。
  // 湧く濃いマナの暗がりには、たいてい獲物がいない（main の16シード×25日では、湧いた所の12マスの内に獲物がいたのは110頭中7頭）。
  // 以前の遠出は、マナが尽きかけてから（飢えて去るのと同じ条件）だったので、先に去りはじめてしまい、ほとんど起きなかった。
  // 胃が空になってすぐ（生き物の更新1500回）出ると、狩りすぎて大ネズミの生まれる数が16シード×25日で2割5分ほど減ったので、マナを燃やしはじめるまで待つ
  const roam = c.hungry > s.starve;
  if (c.hungry && this.hunt(c, roam ? 10 : 8, roam ? BASILISK_ROAM_PREY : HUNT5, s.speed * 1.2)) return;
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
  // 遠出していなければ、住みかのそば（10マスの内）へ帰る（狩って胃に食べ物が入ると、遠出から帰る）
  if (sq(c.hx - c.x) + sq(c.hy - c.y) > 10 * TILE * 10 * TILE) {
    c.act = 1;
    this.goTo(c, c.hx, c.hy, s.speed);
    return;
  }
  // 住みかのそばで、たいてい立ち止まり、ときどき、ふつうに近い速さで歩く（もともと足の遅い種なので、それでもゆっくり）。
  // （以前はふつうの速さの0.6倍で歩き、脚を動かしながらほとんど進まず、足踏みして見えていた）
  c.act = c.actT % 90 < 50 ? 0 : 1;
  if (c.act === 1) {
    const j = DIR16[ih(c.id, this.step >> 5, 113) & 15];
    this.tryMove(c, j[0] * s.speed * 0.9, j[1] * s.speed * 0.9);
  }
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

declare module '../ecology' {
  interface Ecology {
    basilisk: typeof basilisk;
    basiliskManaBed: typeof basiliskManaBed;
  }
}

Object.assign(Ecology.prototype, { basilisk, basiliskManaBed });
