/** Ecology のメソッド：ワイバーン、ドラゴン（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { type Cr, DAY_TICKS_ECO, Ecology, Job, Kind, type Pile, SPEC, STR, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';

export function wyvern(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Wyvern];
  c.act = 1;
  // 腹が満ちたか、長く居すぎたら、裂け目から帰る
  if (c.st === 1 && (c.food >= s.cap * 0.8 || c.actT > 2400)) c.st = 9;
  if (c.st === 9) {
    if (this.goTo(c, c.hx, c.hy, s.speed) || sq(c.hx - c.x) + sq(c.hy - c.y) < 10 * 10) {
      this.record('exits', { t: this.w.tick, k: c.k, reason: 'home', x: Math.round(c.x), y: Math.round(c.y) } as never);
      this.exported += c.body + c.food;
      c.body = 0;
      c.food = 0;
      this.w.manaLeaked += c.mana;
      c.mana = 0;
      c.dead = 2;
    }
    return;
  }
  let prey: Cr | null = null;
  let bd = 12 * TILE * 12 * TILE;
  this.nearby(c.x, c.y, 12, (o) => {
    if (o.dead || o.away) return;
    if (!((o.k === Kind.Bat && o.st !== 0) || o.k === Kind.Gargoyle)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      prey = o;
    }
  });
  if (prey) {
    const p = prey as Cr;
    if (sq(p.x - c.x) + sq(p.y - c.y) < 12 * 12) {
      this.eat(c, p);
      c.act = 2;
      c.actT = 0;
    } else this.goTo(c, p.x, p.y, s.speed);
    return;
  }
  // 裂け目のまわりを旋回する
  const a = (this.step * 0.01 + c.id) % 6.283;
  this.moveToward(c, c.hx + Math.cos(a) * 6 * TILE, c.hy + Math.sin(a) * 4 * TILE, s.speed * 0.8);
}

/**
 * ドラゴンの寝床にする宝の山：宝物庫（ゴーレムの持ち場）とドワーフの広間の宝は選ばない。
 * 金貨が多く、人の気配が薄く、深い所ほど好む（深部の古い宝が自然な寝床になる）。
 * 入口側と歩いてつながった宝があれば、その中から選ぶ（竜は飛ぶので島の宝も選べるが、そこでは冒険者が寝床を見つけられず、
 * 竜の寝床への道探しから竜退治へつながる物語が起きない。孵る所は深部の島のままにして、育ってから寝床を移す）
 */
export function pickDragonHoard(this: Ecology, minGold: number): Pile | null {
  const m = this.w.map;
  let best: Pile | null = null;
  let bv = -1e9;
  const ok = (p: Pile) => p.gold >= minGold && this.dragonPileOk(p);
  const main = this.piles.some((p) => ok(p) && !this.onIsland(p.x, p.y));
  for (const p of this.piles) {
    if (!ok(p) || (main && this.onIsland(p.x, p.y))) continue;
    // 深部に近いほど好む（入口のそばの宝を寝床にしない）
    const toDeep = Math.abs(p.x / TILE - m.deep.x) + Math.abs(p.y / TILE - m.deep.y);
    const v = p.gold - this.presenceAt(p.x, p.y) * 300 + (toDeep < 12 ? 200 : 0) - toDeep * 3;
    if (v > bv) {
      bv = v;
      best = p;
    }
  }
  return best;
}

/** 竜が寝床にしてよい宝の山か：宝物庫（ゴーレムの持ち場）、ドワーフの広間、ゴブリンの集落のそばの宝は選ばない */
export function dragonPileOk(this: Ecology, p: Pile): boolean {
  const m = this.w.map;
  const k = this.tileOf(p.x, p.y);
  if (k < 0 || m.vault[k]) return false;
  if (this.hold && sq(p.x - ((this.hold.hk % m.w) * TILE + 8)) + sq(p.y - (Math.floor(this.hold.hk / m.w) * TILE + 8)) < 6 * TILE * 6 * TILE) return false;
  return !this.camps.some((cp) => cp.id >= 0 && sq(cp.x - p.x) + sq(cp.y - p.y) < 6 * TILE * 6 * TILE);
}

/**
 * 寝床を移す先の床（入口側で、深部にいちばん近いマス。宝物庫の中と、寝床にしてはいけない宝の山のそば（降りて積む金貨がその山に足される2マスの内）は除く。なければ -1）
 */
export function dragonLairSpot(this: Ecology): number {
  const m = this.w.map;
  this.regionOf(0);
  for (let r = 0; r <= 80; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = m.deep.x + dx;
        const y = m.deep.y + dy;
        if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
        const k = y * m.w + x;
        if (this.regionOf(k) !== this.mainRegion || m.vault[k]) continue;
        const px = x * TILE + 8;
        const py = y * TILE + 8;
        if (this.piles.some((p) => sq(p.x - px) + sq(p.y - py) < 2 * TILE * 2 * TILE && !this.dragonPileOk(p))) continue;
        return k;
      }
  return -1;
}

/** 宝の山の持ち主（見た目の飾りのため）：宝物庫、ゴブリンの集落、ドワーフの広間、ドラゴンの寝床、ほか */
export function pileOwner(this: Ecology, p: Pile): string {
  const m = this.w.map;
  const k = this.tileOf(p.x, p.y);
  if (k >= 0 && m.vault[k]) return 'vault';
  if (this.list.some((c) => c.k === Kind.Dragon && !c.dead && c.ref === p.id)) return 'dragon';
  if (this.hold && sq(p.x - ((this.hold.hk % m.w) * TILE + 8)) + sq(p.y - (Math.floor(this.hold.hk / m.w) * TILE + 8)) < 6 * TILE * 6 * TILE) return 'dwarf';
  if (this.camps.some((c) => c.id >= 0 && c.kind === 0 && sq(c.x - p.x) + sq(c.y - p.y) < 4 * TILE * 4 * TILE)) return 'goblin';
  return '';
}

/** ドラゴンの浅い眠りの時間か（眠りについてから、ゲーム内の1時間ごとに15分ほど） */
export function dragonLightSleep(this: Ecology, c: Cr): boolean {
  return c.st === 0 && ((this.step - c.lureAt) % 600) < 150;
}

/** ドラゴンは宝の山の、番人のゴーレムから遠い側で眠る（重なって見えないように） */
export function dragonSide(this: Ecology, hoard: Pile): number {
  const g = this.list.find((o) => o.k === Kind.Golem && !o.dead && sq(o.hx - hoard.x) + sq(o.hy - hoard.y) < 20 * TILE * 20 * TILE);
  if (!g) return 1;
  const gx = g.tx > 0 ? g.tx : g.x;
  return gx > hoard.x ? -1 : 1;
}

/** 飛んでいるドラゴンの行き先：腹が減って外へ出るなら裂け目（tx, ty）、そうでなければ寝床（hx, hy） */
export function dragonFlightGoal(this: Ecology, c: Cr): [number, number] {
  const goingOut = c.food < SPEC[Kind.Dragon].cap * 0.3 && c.ref === -1;
  return goingOut ? [c.tx, c.ty] : [c.hx, c.hy];
}

/**
 * 竜の寝床が入口側と切り離された島にあるか：宝の山があればそのマスで、無ければ寝床の位置（hx, hy）で見る。
 * 寝床の位置は宝の山から左右へ18pxずらしてあり、岩のマスに重なることがあるので、岩なら宝の山の側（左右18px）のマスで見る
 */
export function dragonLairIsland(this: Ecology, c: Cr, hoard?: Pile | null): boolean {
  if (hoard) return this.onIsland(hoard.x, hoard.y);
  for (const dx of [0, -18, 18]) {
    const r = this.regionOf(this.tileOf(c.hx + dx, c.hy + 4));
    if (r >= 0) return r !== this.mainRegion;
  }
  return false;
}

/**
 * 育った竜（若い竜・成竜）の寝床が入口側と切り離された島にあれば、入口側へ飛んで寝床を移す（移しはじめたら true）。
 * 入口側に寝床にできる宝の山があればそこへ（pickDragonHoard）。無ければ（入口側の宝はたいてい宝物庫の中）、入口側で深部にいちばん近い床へ飛ぶ（dragonLairSpot）。
 * 島の寝床に宝の山があれば、その金貨をくわえて運び、降りたときにそこへ積んで寝床の宝にする（孵った所で眠る若い竜には、たいてい宝が無い）。
 * 島の寝床の宝で成竜になれる若い竜は、成竜になってから移る。
 * 孵る所は深部の島のままにして、育ったとき（と、起きて寝床へ戻るとき）に移す（島の寝床では冒険者が竜を見つけられず、
 * 竜の寝床への道探しから竜退治へつながる物語が起きない。孵る所を入口側にすると、孵ったばかりの幼竜が倒され続ける）
 */
export function dragonRelocate(this: Ecology, c: Cr): boolean {
  const m = this.w.map;
  const hoard = this.piles.find((p) => p.id === c.ref && p.gold > 0);
  if (c.sp < 1 || c.away || !this.dragonLairIsland(c, hoard)) return false;
  // 島に寝床にできる宝の山（成竜になれるだけの金貨）があれば、若い竜は島で成竜になってから移る
  // （若いうちに入口側へ移ると、竜退治の一行にすぐ倒されて成竜まで育たない。島の宝の山は、狩りから戻ったときに寝床に選ぶ）
  if (c.sp === 1 && this.piles.some((p) => p.gold >= DRAGON_ADULT_GOLD && this.onIsland(p.x, p.y) && this.dragonPileOk(p))) return false;
  const alt = this.pickDragonHoard(1);
  const toPile = !!alt && alt !== hoard && !this.onIsland(alt.x, alt.y);
  const spot = toPile ? -1 : this.dragonLairSpot();
  if (!toPile && spot < 0) return false;
  if (toPile && alt) {
    c.ref = alt.id;
    c.hx = alt.x + this.dragonSide(alt) * 18;
    c.hy = alt.y - 4;
  } else {
    const take = Math.min(hoard?.gold ?? 0, DRAGON_CARRY);
    if (hoard) hoard.gold -= take;
    c.gold += take;
    c.ref = 0;
    // 見つけた床のマスそのものに降りる（左右にずらすと岩に重なることがある）。くわえた金貨は、降りた足もとに積む
    c.hx = (spot % m.w) * TILE + 8;
    c.hy = Math.floor(spot / m.w) * TILE + 8 - 4;
  }
  c.st = 2;
  c.act = 1;
  c.actT = 0;
  c.foe = 0;
  // 覚えている宝の金貨の数は、新しい寝床の宝に合わせる（前の寝床の数のままだと、降りて眠るときに宝を盗られたと思って飛び起きる）
  c.gait = toPile && alt ? alt.gold : 0;
  const how = toPile ? 'pile' : c.gold > 0 ? 'carry' : 'bare';
  this.record('settle', { t: this.w.tick, k: Kind.Dragon, ev: 'lairMove', id: c.id, n: c.sp, how, x: Math.round(c.hx), y: Math.round(c.hy) } as never);
  this.log(c.x, c.y, how === 'pile' ? `{k:${Kind.Dragon}}が深部の寝床を離れ、宝の山へ飛んで寝床を移した` : how === 'carry' ? `{k:${Kind.Dragon}}が宝をくわえて深部の寝床を離れ、新しい寝床へ飛んだ` : `{k:${Kind.Dragon}}が深部の寝床を離れ、新しい寝床へ飛んだ`);
  return true;
}

/** 寝床を移すときに、島の宝の山からくわえて運ぶ金貨の上限（成竜になるのに要る寝床の宝と同じ） */
const DRAGON_CARRY = 60;
/** 若い竜が成竜になるのに要る、寝床の宝の金貨 */
const DRAGON_ADULT_GOLD = 60;

export function dragon(this: Ecology, c: Cr, _day: number): void {
  const s = SPEC[Kind.Dragon];
  const m = this.w.map;
  // 幼竜の遊び：起きていて腹が満ちていれば、近くのコウモリやウィスプを追いかけ、ときどき煙の息を吐く練習をする
  if (c.sp === 0 && c.st === 1 && !c.foe && c.food >= s.cap * 0.5 && c.act !== 2) {
    if (this.step % 240 === c.id % 240) {
      c.act = 2;
      c.actT = 0;
      this.fxAttacks.push({ t: this.w.tick, style: 'puff', col: 6, size: 0, ax: c.x, ay: c.y, dx: c.x + (c.dir === 3 ? -14 : 14), dy: c.y - 4, did: -1, aid: c.id, big: false, kill: false });
      return;
    }
    let toy: Cr | null = null;
    this.nearby(c.x, c.y, 6, (o) => {
      // 壁の中や壁の向こうを飛ぶ相手は追わない（追えば壁に鼻先を押しつけたまま足踏みすることになる）
      if (!toy && !o.dead && (o.k === Kind.Wisp || (o.k === Kind.Bat && o.st !== 0)) && sq(o.x - c.x) + sq(o.y - c.y) < 6 * TILE * 6 * TILE && this.tilePassable(c, this.tileOf(o.x, o.y)) && lineOfSight(m, c.x, c.y, o.x, o.y)) toy = o;
    });
    if (toy && sq(c.hx - c.x) + sq(c.hy - c.y) < 10 * TILE * 10 * TILE) {
      c.act = 1;
      this.goTo(c, (toy as Cr).x, (toy as Cr).y, s.speed * 0.8);
      return;
    }
  }
  // 幼竜は、自分より強い者が近く（5マス）にいれば、寝床から離れる方へ逃げる（眠っていれば目を覚まして）
  if (c.sp === 0 && !c.away && this.step % 3 === c.id % 3) {
    let threat: Cr | null = null;
    this.nearby(c.x, c.y, 5, (o) => {
      if (threat || o.dead || o.away || o === c || o.k === Kind.Wisp || this.str(o) <= this.str(c)) return;
      if (sq(o.x - c.x) + sq(o.y - c.y) < 5 * TILE * 5 * TILE && this.canSense(c, o)) threat = o;
    });
    if (threat) {
      const t = threat as Cr;
      c.st = 1;
      c.act = 1;
      const dx = c.x - t.x;
      const dy = c.y - t.y;
      const L = Math.hypot(dx, dy) || 1;
      this.tryMove(c, (dx / L) * s.speed * 1.3, (dy / L) * s.speed * 1.3);
      return;
    }
  }
  // 育つ：幼竜は寝床（生まれた所）で眠るあいだ、まわりの土からマナを吸い、食べた獲物のマナも溜める。
  // 溜めたマナと、生まれてからの日数（と、成竜になるには寝床の宝）で、若い竜、成竜へ育つ
  if (c.sp < 2 && !c.away) {
    if (c.st === 0 && this.step % 8 === c.id % 8) {
      const k = this.tileOf(c.x, c.y);
      for (const q of [k, k + 1, k - 1, k + m.w, k - m.w]) {
        if (q < 0 || q >= this.w.mana.length || this.w.mana[q] < 4) continue;
        const t = Math.min(1, this.w.mana[q] - 2);
        this.w.mana[q] -= t;
        c.mana += t;
      }
    }
    // 生まれてからの日数（ゲーム内の日数）
    const days = (this.w.tick - c.bornAt) / DAY_TICKS_ECO;
    const hoard = this.piles.find((p) => p.id === c.ref);
    // マナが濃いほど早く育つ（深部のマナが薄いダンジョンでも、日数がたてば育つ）
    if (c.sp === 0 && days > 4 && (c.mana >= 1500 || days > 7)) {
      c.sp = 1;
      this.pushGrowFx(c);
      this.log(c.x, c.y, `{k:${Kind.Dragon}}の幼子が育ち、若い竜になった`);
      this.record('settle', { t: this.w.tick, k: Kind.Dragon, ev: 'grow', id: c.id, n: c.sp, x: Math.round(c.x), y: Math.round(c.y) } as never);
      if (c.st !== 2 && c.st !== 3) this.dragonRelocate(c);
    } else if (c.sp === 1 && days > 13 && (hoard?.gold ?? 0) >= DRAGON_ADULT_GOLD && (c.mana >= 5000 || days > 18)) {
      c.sp = 2;
      this.pushGrowFx(c);
      this.log(c.x, c.y, `若い{k:${Kind.Dragon}}が成竜となり、ダンジョンの主になった`);
      this.record('settle', { t: this.w.tick, k: Kind.Dragon, ev: 'grow', id: c.id, n: c.sp, x: Math.round(c.x), y: Math.round(c.y) } as never);
      if (c.st !== 2 && c.st !== 3) this.dragonRelocate(c);
    }
  }
  // 2 = 飛んでいる（裂け目から宝の山へ、または外へ）、3 = 外へ狩りに出ている、0 = 宝の山の上で眠る、1 = 起きている
  if (c.st === 3) {
    c.away = true;
    if (c.actT > 3000) {
      c.away = false;
      const add = s.cap - c.food;
      c.food += add;
      this.imported += add;
      c.st = 2;
      c.actT = 0;
    }
    return;
  }
  if (c.st === 2) {
    c.act = 1;
    const goingOut = c.food < s.cap * 0.3 && c.ref === -1;
    const [gx, gy] = this.dragonFlightGoal(c);
    // 飛んでいる：岩の上も越えて、まっすぐ目的地へ（道筋は探さない）
    {
      const dx = gx - c.x;
      const dy = gy - c.y;
      const L = Math.sqrt(dx * dx + dy * dy);
      const v = s.speed * 1.6;
      if (L > v) {
        c.x += (dx / L) * v;
        c.y += (dy / L) * v;
        c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : dy > 0 ? 0 : 1;
      } else {
        c.x = gx;
        c.y = gy;
      }
      this.paths.delete(c.id);
    }
    if (sq(gx - c.x) + sq(gy - c.y) < 8 * 8) {
      if (goingOut) {
        c.st = 3;
        c.actT = 0;
      } else {
        c.st = 0;
        c.act = 0;
        c.actT = 0;
        c.lureAt = this.step;
        // くわえてきた金貨は、降りた所に積んで寝床の宝にする（寝床を移したとき）
        if (c.gold > 0 && !this.piles.some((p) => p.id === c.ref)) {
          const before = this.piles.length;
          this.dropGold(c.hx, c.hy + 4, c.gold, this.ownerNote(c, 'stash'));
          c.gold = 0;
          const np = this.piles.length > before ? this.piles[this.piles.length - 1] : this.piles.find((p) => sq(p.x - c.hx) + sq(p.y - (c.hy + 4)) < 20 * 20);
          if (np) c.ref = np.id;
        }
        // 宝の山を覚え直す（宝物庫とドワーフの広間は選ばない）
        const kept = this.piles.find((p) => p.id === c.ref);
        let hoard = kept ?? this.pickDragonHoard(1);
        // 島の寝床へ降りた竜が、入口側の宝の山を選んだら、寝床を移す（dragonRelocate。飛んで行き、記録を残す）
        if (!kept && hoard && !this.onIsland(hoard.x, hoard.y) && this.dragonLairIsland(c) && this.dragonRelocate(c)) return;
        // 入口側へ寝床を移した竜は、島の宝の山を寝床に覚え直さない（移した寝床と行き来しない）
        if (hoard && this.onIsland(hoard.x, hoard.y) && !this.dragonLairIsland(c)) hoard = null;
        if (hoard) c.ref = hoard.id;
        c.gait = hoard ? hoard.gold : 0;
      }
    }
    return;
  }
  if (c.st === 0) {
    c.act = 0;
    c.dir = 2;
    if (this.step % 25 !== c.id % 25) return;
    // 宝の山から金貨を盗られたら、必ず目覚めて盗った者を追う
    const hoardNow = this.piles.find((p) => p.id === c.ref);
    if (hoardNow && c.gait > 0 && hoardNow.gold < c.gait) {
      let thief: Cr | null = null;
      let td = 12 * TILE * 12 * TILE;
      this.nearby(c.x, c.y, 12, (o) => {
        if (o.dead || o === c || o.gold <= 0 || o.k === Kind.Mimic) return;
        const d = sq(o.x - c.x) + sq(o.y - c.y);
        if (d < td) {
          td = d;
          thief = o;
        }
      });
      c.gait = hoardNow.gold;
      c.st = 1;
      c.actT = 0;
      if (thief) {
        c.foe = (thief as Cr).id;
        this.log(c.x, c.y, `宝を盗られた{k:${Kind.Dragon}}が目を覚ました`);
      }
      return;
    }
    if (hoardNow) c.gait = hoardNow.gold;
    // 腹が減るか、強い者（その者の実際の強さで見る）が近くで騒ぐか、近くで戦いの物音がすると目覚める
    let disturbed = false;
    this.nearby(c.x, c.y, 5, (o) => {
      if (!o.dead && o !== c && o.k !== Kind.Golem && this.str(o) >= 9) disturbed = true;
    });
    for (const n of this.noises) if (this.step - n.t < 30 && !n.s && sq(n.x - c.x) + sq(n.y - c.y) < 6 * TILE * 6 * TILE) disturbed = true;
    // 眠りの周期：眠りについてからゲーム内の1〜2日たつと、自然に目を覚ます
    const slept = this.step - c.lureAt;
    const nap = DAY_TICKS_ECO / 2 + (ih(c.id, c.lureAt, 213) % (DAY_TICKS_ECO / 2));
    // 浅い眠りの時間（ゲーム内の1時間のうち15分ほど）は、寝床に近づく者に気づきやすい（盗賊は忍び足で気づかれにくい）
    if (this.dragonLightSleep(c)) {
      let intruder: Cr | null = null;
      this.nearby(c.x, c.y, 5, (o) => {
        if (intruder || o.dead || o.away || o === c || STR[o.k] < 3 || o.k === Kind.Golem) return;
        if (sq(o.x - c.x) + sq(o.y - c.y) > 5 * TILE * 5 * TILE) return;
        const chance = o.k === Kind.Adventurer && o.sp === Job.Thief ? 10 : 3;
        if (ih(c.id, o.id ^ this.step, 214) % chance === 0) intruder = o;
      });
      if (intruder) {
        c.st = 1;
        c.actT = 0;
        c.foe = (intruder as Cr).id;
        if (this.step - (this.lastLogged[996] ?? -99999) > 2000) {
          this.lastLogged[996] = this.step;
          this.log(c.x, c.y, `{k:${Kind.Dragon}}が寝床に近づく気配に目を覚ました`);
        }
        return;
      }
    }
    if (c.food < s.cap * 0.7 || slept > nap || (disturbed && ih(c.id, this.step, 131) % 4 === 0)) {
      c.st = 1;
      c.actT = 0;
    }
    return;
  }
  // 起きている：炎を吐いている途中
  if (c.act === 2 && c.ref2 > 0) {
    // 炎は口元から順に先へ燃え広がる（t は 0 から。若い竜は吐く時間が短いぶん、届く先も短い）
    const t = Math.max(0, (c.sp === 1 ? 7 : 12) - c.ref2);
    this.breathe(c, c.tx, c.ty, t);
    c.ref2--;
    if (c.ref2 === 0) c.actT = 0;
    return;
  }
  // 宝を盗った者を追い、近ければ炎を吐く（金貨を落とすか倒れるまで）
  if (c.foe) {
    const f0 = this.byId.get(c.foe);
    // ミミックは宝箱に化けた魔物で、金貨を抱えていても宝を盗った者ではない（追うと炎を吐き続けて、竜がその場から動かなくなる）。噛みつかれたばかりなら打ち返す
    const f = f0 && f0.k === Kind.Mimic && this.w.tick - c.hitAt > 60 ? undefined : f0;
    const nearLair = f && sq(f.x - c.hx) + sq(f.y - c.hy) < 10 * TILE * 10 * TILE;
    if (!f || f.dead || (f.gold <= 0 && !nearLair) || sq(f.x - c.x) + sq(f.y - c.y) > 30 * TILE * 30 * TILE) c.foe = 0;
    else {
      const d = Math.sqrt(sq(f.x - c.x) + sq(f.y - c.y));
      c.dir = Math.abs(f.x - c.x) > Math.abs(f.y - c.y) ? (f.x > c.x ? 2 : 3) : f.y > c.y ? 0 : 1;
      if (c.sp === 0 && d < 16) {
        // 幼竜はまだ炎を吐けず、噛みつく
        this.fight(c, f);
      } else if (c.sp > 0 && d < 3 * TILE && !this.breathCovers(c, f.x, f.y)) {
        // 若い竜と成竜は、口元より手前のすぐそばの相手からは一歩下がって間合いを取る（炎は口元から先にしか届かない）。下がれなければ噛みつく
        if (!this.dragonStepBack(c, f.x, f.y) && d < 20) this.fight(c, f);
      } else if (c.sp > 0 && d < (c.sp === 1 ? 5 : 6) * TILE && lineOfSight(m, c.x, c.y, f.x, f.y) && this.breathCovers(c, f.x, f.y)) {
        c.act = 2;
        c.actT = 0;
        c.ref2 = c.sp === 1 ? 7 : 12;
        c.tx = f.x;
        c.ty = f.y;
      } else {
        c.act = 1;
        this.goTo(c, f.x, f.y, s.speed * 1.2);
      }
      return;
    }
  }
  // 腹が満ちていれば、まわりの宝の山（宝物庫、ドワーフの広間、自分の寝床のものは除く）から金貨を集めて寝床へ運ぶ
  const carry = [0, 10, 80][Math.min(2, c.sp)];
  if (c.food >= s.cap * (c.sp === 1 ? 0.4 : 0.7) && c.gold < carry) {
    let tgt: Pile | null = null;
    let td = (c.sp === 1 ? 15 : 50) * TILE * (c.sp === 1 ? 15 : 50) * TILE;
    for (const p of this.piles) {
      if (p.id === c.ref || p.gold <= 0) continue;
      const own = this.pileOwner(p);
      if (own === 'vault' || own === 'dwarf' || own === 'dragon') continue;
      const d = sq(p.x - c.x) + sq(p.y - c.y);
      if (d < td) {
        td = d;
        tgt = p;
      }
    }
    if (tgt) {
      const t = tgt as Pile;
      c.act = 1;
      if (sq(t.x - c.x) + sq(t.y - c.y) < 20 * 20) {
        const g = Math.min(t.gold, carry - c.gold);
        t.gold -= g;
        c.gold += g;
      } else this.goTo(c, t.x, t.y, s.speed);
      return;
    }
  }
  // 焼けた獲物を食べる
  if (c.food < s.cap * 0.9) {
    let best: Cr | null = null;
    let bd = 8 * TILE * 8 * TILE;
    for (const o of this.carrion) {
      // 同じ更新の中で肉を食べ尽くされた死骸と、ゾンビとして起き上がった者を除く（src/eco/monsters.ts の troll と同じ）
      if (this.flesh(o) <= 0) continue;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (best) {
      const b = best as Cr;
      c.act = 1;
      if (sq(b.x - c.x) + sq(b.y - c.y) < 16 * 16) {
        const t = Math.min(this.flesh(b), 40, s.cap - c.food);
        b.units -= t;
        c.food += t;
        c.sinceMeal = 0;
      } else this.goTo(c, b.x, b.y, s.speed);
      return;
    }
  }
  // 獲物を探して（遠くまで）、近ければ炎を吐く
  if (c.food < s.cap * 0.7) {
    let prey: Cr | null = null;
    // 幼竜は寝床の近く（12マス）で小さな獲物だけを狩る。若い竜は自分より弱い相手まで
    const R2 = c.sp === 0 ? 12 : 30;
    let bd = R2 * TILE * R2 * TILE;
    this.nearby(c.x, c.y, R2, (o) => {
      if (o.dead || o.away || o === c || [Kind.Golem, Kind.Worm, Kind.Ghost, Kind.Wisp, Kind.Salamander].includes(o.k)) return;
      if (c.sp === 0 && ![Kind.Rat, Kind.Bat, Kind.Lizard, Kind.Ant, Kind.Spider, Kind.Slime].includes(o.k)) return;
      if (c.sp === 1 && this.str(o) > this.str(c) * 0.8) return;
      if ((o.st === 7 || o.st === 12) && this.isHidden(o) && !this.atDoorOf(c, o)) return;
      const d = sq(o.x - c.x) + sq(o.y - c.y);
      if (d < bd) {
        bd = d;
        prey = o;
      }
    });
    if (prey) {
      const p = prey as Cr;
      const d = Math.sqrt(sq(p.x - c.x) + sq(p.y - c.y));
      c.dir = Math.abs(p.x - c.x) > Math.abs(p.y - c.y) ? (p.x > c.x ? 2 : 3) : p.y > c.y ? 0 : 1;
      if (c.sp === 0 && d < 16) {
        this.fight(c, p);
      } else if (c.sp > 0 && d < 3 * TILE && !this.breathCovers(c, p.x, p.y)) {
        if (!this.dragonStepBack(c, p.x, p.y) && d < 20) this.fight(c, p);
      } else if (c.sp > 0 && d < (c.sp === 1 ? 5 : 6) * TILE && lineOfSight(m, c.x, c.y, p.x, p.y) && this.breathCovers(c, p.x, p.y)) {
        // （炎は口元から上下左右に吐くので、炎の扇に入る向きにいる相手にだけ吐く。斜めにいる相手には寄っていく。breathCovers）
        c.act = 2;
        c.actT = 0;
        c.ref2 = c.sp === 1 ? 7 : 12;
        c.tx = p.x;
        c.ty = p.y;
      } else {
        c.act = 1;
        this.goTo(c, p.x, p.y, s.speed);
      }
      return;
    }
  }
  // 腹が満ちたか、何も見つからないまま時間が経ったら：満ちていれば宝の山へ戻って眠り、飢えていれば外へ狩りに出る
  if (c.food >= s.cap * 0.7 || c.actT > 1500) {
    if (c.food < s.cap * 0.3 && (c.sp === 2 || (c.sp === 1 && this.dayNow < 0.1))) {
      const sh = m.shafts[0];
      c.tx = sh.x * TILE + 8;
      c.ty = sh.y * TILE + 8;
      c.ref = -1;
      c.st = 2;
      return;
    }
    // 寝床の場所は覚えている。山が尽きていても、そこへ戻って集めてきた金貨を積み直す
    if (this.dragonRelocate(c)) return;
    const hoard = this.piles.find((p) => p.id === c.ref && p.gold > 0);
    if (hoard) {
      c.hx = hoard.x + this.dragonSide(hoard) * 18;
      c.hy = hoard.y - 4;
      if (c.gold > 0 && sq(hoard.x - c.x) + sq(hoard.y - c.y) < 30 * 30) {
        hoard.gold += c.gold;
        c.gold = 0;
      }
    } else if (c.gold > 0 && sq(c.hx - c.x) + sq(c.hy - c.y) < 30 * 30) {
      const before = this.piles.length;
      this.dropGold(c.hx - 18, c.hy + 4, c.gold, this.ownerNote(c, 'stash'));
      c.gold = 0;
      const np = this.piles.length > before ? this.piles[this.piles.length - 1] : this.piles.reduce((b: Pile | null, p) => (sq(p.x - c.hx) + sq(p.y - c.hy) < 40 * 40 && (!b || p.gold > b.gold) ? p : b), null);
      if (np) c.ref = np.id;
    }
    if (this.goTo(c, c.hx, c.hy, s.speed) || sq(c.hx - c.x) + sq(c.hy - c.y) < 12 * 12) {
      c.st = 0;
      c.act = 0;
      // 眠りについた step 番号（眠りの周期のため）
      c.lureAt = this.step;
    } else c.act = 1;
    return;
  }
  // 獲物が見つからないうちは、立ち止まっては、ふつうに近い速さで歩いて探す（stroll）
  this.stroll(c, 5, 132, 0.9);
}

/** ドラゴン c が、(x, y) にいる相手から一歩下がる（相手の方を向いたまま）。下がれたら true */
export function dragonStepBack(this: Ecology, c: Cr, x: number, y: number): boolean {
  const dx = c.x - x;
  const dy = c.y - y;
  const L = Math.sqrt(dx * dx + dy * dy) || 1;
  const x0 = c.x;
  const y0 = c.y;
  const dir = c.dir;
  c.act = 1;
  this.tryMove(c, (dx / L) * SPEC[Kind.Dragon].speed, (dy / L) * SPEC[Kind.Dragon].speed);
  c.dir = dir;
  return c.x !== x0 || c.y !== y0;
}

declare module '../ecology' {
  interface Ecology {
    wyvern: typeof wyvern;
    pickDragonHoard: typeof pickDragonHoard;
    pileOwner: typeof pileOwner;
    dragonLightSleep: typeof dragonLightSleep;
    dragonSide: typeof dragonSide;
    dragonFlightGoal: typeof dragonFlightGoal;
    dragon: typeof dragon;
    dragonStepBack: typeof dragonStepBack;
    dragonRelocate: typeof dragonRelocate;
    dragonLairIsland: typeof dragonLairIsland;
    dragonPileOk: typeof dragonPileOk;
    dragonLairSpot: typeof dragonLairSpot;
  }
}

Object.assign(Ecology.prototype, { wyvern, pickDragonHoard, pileOwner, dragonLightSleep, dragonSide, dragonFlightGoal, dragon, dragonStepBack, dragonRelocate, dragonLairIsland, dragonPileOk, dragonLairSpot });
