/** Ecology のメソッド：中で殖える（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { DAY_TICKS_ECO, Ecology, Kind, ih, } from '../ecology';
import { TILE } from '../mapgen';

/**
 * 大ネズミは巣穴で子を産み（親の蓄えから子の体を作る）、クモは巣に卵嚢を、トカゲは暖かい所に卵を残す。
 * 卵はゲーム内の半日ほどで孵る。数は、これまでの上限（餌の量で決まる）を超えない
 */
export function breed(this: Ecology): void {
  const m = this.w.map;
  const n = this.counts;
  // 大ネズミ：巣穴に2匹以上いて、蓄えのある親がいれば2匹産む
  // ダンジョン全体で一度に一腹まで。数が上限に近いほど産まれにくい（食べ物が豊かでも、ゆっくり増える）
  const cap = this.ratCap();
  if (this.step % 300 === 140 && n[Kind.Rat] < cap && ih(this.step, 305) % 100 >= (100 * n[Kind.Rat]) / Math.max(1, cap)) {
    let litters = 0;
    for (const b of this.burrows) {
      if (litters >= 1) break;
      // 一つの巣穴が子を産むのは、ゲーム内の約4時間に1回まで（食べ物が豊かでも、一気には増えない）
      if (ih(b.x, b.y * 7 + Math.floor(this.step / 300), 304) % 4 !== 0) continue;
      const res = this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y);
      // 巣穴のまわりで養える数を超えるなら産まない（移った先で殖えすぎてまた飢えないように）
      if (res.length < 2 || res.length >= 8 || res.length + 2 > (b.cap ?? 0)) continue;
      const mom = res.find((c) => c.food >= 30 && this.w.tick - c.bornAt > DAY_TICKS_ECO / 2);
      if (!mom) continue;
      for (let i = 0; i < 2; i++) {
        mom.food -= 12;
        this.originNext = 'born';
        if (i === 0) litters++;
        const pup = this.spawn(Kind.Rat, b.x + (i ? 4 : -4), b.y + 2, 8, 4);
        pup.hx = b.x;
        pup.hy = b.y;
        pup.bornAt = this.w.tick;
      }
    }
  }
  // クモ：腹が満ちて巣を持っていれば、巣に卵嚢を残す
  if (this.step % 450 === 220 && n[Kind.Spider] < Math.min(14, Math.floor((n[Kind.Wisp] + n[Kind.Bat]) / 25))) {
    for (const c of this.list) {
      if (c.dead || c.k !== Kind.Spider || c.food < 60 || this.eggs.filter((e) => e.k === Kind.Spider).length >= 4) continue;
      const web = this.webs.find((w) => w.owner === c.id);
      if (!web) continue;
      c.food -= 30;
      this.eggs.push({ id: this.nextId++, k: Kind.Spider, x: web.x + 4, y: web.y + 4, t: this.w.tick, n: 2, units: 30 });
    }
  }
  // 大トカゲ：腹が満ちていれば、近くの暖かい所（なければ足もと）に卵を埋める
  if (this.step % 450 === 330 && n[Kind.Lizard] < Math.min(24, Math.floor(n[Kind.Rat] / 6))) {
    for (const c of this.list) {
      if (c.dead || c.k !== Kind.Lizard || c.food < 90 || this.eggs.filter((e) => e.k === Kind.Lizard).length >= 3) continue;
      let spot = this.tileOf(c.x, c.y);
      let bh = -1;
      const x0 = Math.floor(c.x / TILE);
      const y0 = Math.floor(c.y / TILE);
      for (let dy = -5; dy <= 5; dy++)
        for (let dx = -5; dx <= 5; dx++) {
          const k = (y0 + dy) * m.w + x0 + dx;
          if (k < 0 || k >= m.solid.length || m.solid[k] || m.lava[k] || this.w.water[k] > 10 || this.w.heat[k] > 150) continue;
          if (this.w.heat[k] > bh) {
            bh = this.w.heat[k];
            spot = k;
          }
        }
      c.food -= 40;
      this.eggs.push({ id: this.nextId++, k: Kind.Lizard, x: (spot % m.w) * TILE + 8, y: Math.floor(spot / m.w) * TILE + 9, t: this.w.tick, n: 2, units: 40 });
    }
  }
  // 孵る（ゲーム内の半日ほど）
  for (let i = this.eggs.length - 1; i >= 0; i--) {
    const e = this.eggs[i];
    if (this.w.tick - e.t < DAY_TICKS_ECO / 2) continue;
    this.eggs.splice(i, 1);
    const k = this.tileOf(e.x, e.y);
    if (k < 0 || m.solid[k]) {
      this.deposit(e.x, e.y, e.units);
      continue;
    }
    for (let j = 0; j < e.n; j++) {
      this.originNext = 'born';
      // 卵の左右5px に並べて孵す。そこが岩（卵が壁ぎわにある）なら、卵の所に（以前は壁の中に孵り、安全策で床へ出されていた）
      const kx = this.tileOf(e.x + (j ? 5 : -5), e.y);
      const hx = kx >= 0 && !m.solid[kx] ? e.x + (j ? 5 : -5) : e.x;
      const c = this.spawn(e.k, hx, e.y, Math.floor(e.units / e.n), 0);
      c.bornAt = this.w.tick;
      const extra = e.units - Math.floor(e.units / e.n) * e.n;
      if (j === 0 && extra) c.food += extra;
    }
  }
}

export function updateDigging(this: Ecology): void {
  const m = this.w.map;
  // 大ネズミは巣穴を掘り進める（短く細い穴）
  if (this.step % 300 === 77) {
    for (const b of this.burrows) {
      if ((b.len ?? 0) >= 10) continue;
      if (!this.list.some((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y)) continue;
      const home = this.tileOf(b.x, b.y);
      const k = this.tunnelToward(b.hk ?? -1, home, 10);
      if (k >= 0) {
        b.hk = k;
        b.len = (b.len ?? 0) + 1;
      }
    }
  }
  // アリは巣を広げて、小部屋と細い通路を掘る
  if (this.step % 500 === 123) {
    for (const c of this.colonies) {
      if (c.store < 10 || (c.len ?? 0) >= 40) continue;
      const home = this.tileOf(c.x, c.y);
      const k = this.tunnelToward(c.hk ?? -1, home, 18);
      if (k >= 0) {
        c.hk = k;
        c.len = (c.len ?? 0) + 1;
        // 五マスごとに小部屋
        if (c.len % 5 === 0) for (const q of [k + 1, k + m.w, k + m.w + 1]) if (m.solid[q] && !m.lava[q]) this.w.dig(q);
      }
    }
  }
  // 掘り当てた空洞と崩落を記録に残す。崩落の下にいた生き物は押しつぶされる
  // 掘る音：前回の生き物の更新から新しく掘られたマス（地形変更ログ digs の増えた分）
  for (let i = Math.max(0, this.lastDigCount); i < this.w.digs.length; i++) {
    const op = this.w.digs[i];
    if ((op & 7) !== 0) continue;
    const k = op >> 3;
    this.noise((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 7);
  }
  this.lastDigCount = this.w.digs.length;
  // 岩の向こうの空洞を掘り当てた記録は、ログには出さない（物語の節目ではない）
  this.w.openedQueue.length = 0;
  while (this.w.collapseQueue.length) {
    const o = this.w.collapseQueue.shift() as { k: number; n: number };
    const x = (o.k % m.w) * TILE + 8;
    const y = Math.floor(o.k / m.w) * TILE + 8;
    this.log(x, y, `天井が崩れ落ちた`);
    this.noise(x, y, 22);
    this.effects.push({ x, y, t: this.w.tick });
    this.nearby(x, y, 3, (c) => {
      if (c.dead || c.away || [Kind.Worm, Kind.Golem, Kind.Ghost, Kind.Wisp].includes(c.k)) return;
      if ((c.k === Kind.Bat || c.k === Kind.Wyvern) && c.st !== 0) return;
      const k = this.tileOf(c.x, c.y);
      if (k >= 0 && m.solid[k]) this.die(c, 'crushed');
    });
  }
  if (this.effects.length && this.w.tick - this.effects[0].t > 200) this.effects.shift();
  while (this.blood.length && this.w.tick - this.blood[0].t > DAY_TICKS_ECO / 2) this.blood.shift();
}

declare module '../ecology' {
  interface Ecology {
    breed: typeof breed;
    updateDigging: typeof updateDigging;
  }
}

Object.assign(Ecology.prototype, { breed, updateDigging });
