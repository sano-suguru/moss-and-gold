/** Ecology のメソッド：サラマンダー（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BLOOD, Burrow, CELL, CR_EVERY, MOSS_R, Camp, Colony, Cr, DAY_TICKS_ECO, DIR16, DWARF_STR, Ecology, FLEE_AT, GOLD_CAP, GROUPED, HUNT0, HUNT1, HUNT2, HUNT3, HUNT4, HUNT5, HUNT6, HUNT_ORC, Hold, Item, ItemKind, JOB_STR, Job, Kind, Lore, MAX_WISPS, NB4, Party, Pile, Rumors, SPEC, STR, Spec, Statue, TIER, TIER_MUL, TORCH_FUEL, Trap, Warren, Web, ih, sq } from '../ecology';
import { lineOfSight, TILE } from '../mapgen';
import { JOB_NAMES } from '../names';
import type { World } from '../world';
import { isJobItem } from './armor';

export function spawnSalamanders(this: Ecology): void {
  const m = this.w.map;
  let lava = 0;
  for (let k = 0; k < m.w * m.h; k++) if (m.lava[k]) lava++;
  const want = Math.min(4, Math.floor(lava / 15));
  if (this.counts[Kind.Salamander] >= want) return;
  for (let i = 0; i < 60; i++) {
    const k = ih(this.step, i, 76) % (m.w * m.h);
    if (m.solid[k] || m.lava[k] || this.w.heat[k] < 150 || this.w.nutr[k] < 12 || this.manaAround(k) < 8) continue;
    this.w.nutr[k] -= 12;
    const sal = this.spawn(Kind.Salamander, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 12, 0);
    this.takeMana(sal, k, 30);
    // 溶岩の熱と濃いマナが重なると、火の精になる（ダンジョンに一体だけ）
    if (this.manaAround(k) >= 12 && this.w.heat[k] >= 170 && !this.list.some((o) => o.elite === 1 && !o.dead) && this.w.tick - (this.lastElite[1] ?? -1e9) > DAY_TICKS_ECO * 2) {
      this.lastElite[1] = this.w.tick;
      sal.elite = 1;
      this.takeMana(sal, k, 60);
      this.nameOf(sal);
      this.log(sal.x, sal.y, `溶岩の熱と濃いマナから、火の精「${this.names.get(sal.id)}」が生まれた`);
    }
    return;
  }
}

export function salamander(this: Ecology, c: Cr): void {
  const s = SPEC[Kind.Salamander];
  const m = this.w.map;
  const k = this.tileOf(c.x, c.y);
  if (c.act === 2 && c.actT < 4) return;
  // 熱の外には長くいられない：熱い方へ戻る
  if (k >= 0 && this.w.heat[k] < 80) {
    let best = k;
    for (const q of [k + 1, k - 1, k + m.w, k - m.w]) if (q >= 0 && q < m.solid.length && !m.solid[q] && !m.lava[q] && this.w.heat[q] > this.w.heat[best]) best = q;
    c.act = 1;
    this.moveToward(c, (best % m.w) * TILE + 8, Math.floor(best / m.w) * TILE + 8, s.speed);
    return;
  }
  // 熱の区域に迷い込んだネズミやアリを捕まえる
  let prey: Cr | null = null;
  let bd = 34 * 34;
  this.nearby(c.x, c.y, 2, (o) => {
    if (o.dead || o.away || (o.k !== Kind.Rat && o.k !== Kind.Ant)) return;
    const d = sq(o.x - c.x) + sq(o.y - c.y);
    if (d < bd) {
      bd = d;
      prey = o;
    }
  });
  if (prey) {
    const p = prey as Cr;
    c.act = 1;
    if (this.moveToward(c, p.x, p.y, s.speed * 1.4) || sq(p.x - c.x) + sq(p.y - c.y) < 9 * 9) this.fight(c, p);
    return;
  }
  // 熱の中を這い回る
  c.act = c.actT % 50 < 30 ? 1 : 0;
  if (c.act === 1) {
    const j = DIR16[ih(c.id, this.step >> 4, 77) & 15];
    const nx = c.x + j[0] * 8;
    const ny = c.y + j[1] * 8;
    const nk = this.tileOf(nx, ny);
    if (nk >= 0 && !m.solid[nk] && !m.lava[nk] && this.w.heat[nk] >= 80) this.tryMove(c, j[0] * s.speed * 0.6, j[1] * s.speed * 0.6);
    else c.act = 0;
  }
}

/** 空きのある巣穴を使い、なければ壁際の乾いた床で苔に近い所に新しく作る */
export function pickBurrow(this: Ecology): Burrow {
  const m = this.w.map;
  let residents = this.burrows.map((b) => this.list.filter((c) => c.k === Kind.Rat && !c.dead && c.hx === b.x && c.hy === b.y).length);
  // 巣穴が12を超えたら、誰も住んでいない巣穴は崩れて消える（見つけやすさのため数を抑える）。
  // 全部に住んでいて一つも消えないこともある（分家で24まで増える）ので、消したあと選び直すときに自分を呼び直さない
  // （以前は呼び直していて、13以上の巣穴が全部埋まっていると無限に呼び続けてスタックが溢れた）
  if (this.burrows.length > 12) {
    this.burrows = this.burrows.filter((_, i) => residents[i] > 0);
    residents = residents.filter((n) => n > 0);
  }
  for (let i = 0; i < this.burrows.length; i++) if (residents[i] > 0 && residents[i] < 8) return this.burrows[i];
  let best = -1;
  let bv = -1e9;
  for (let i = 0; i < 160; i++) {
    const h = ih(this.step, i, 81);
    const x = 2 + (h % (m.w - 4));
    const y = 2 + ((h >>> 12) % (m.h - 4));
    const k = y * m.w + x;
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 0) continue;
    let walls = 0;
    for (const nn of [k + 1, k - 1, k - m.w]) walls += m.solid[nn];
    if (!walls) continue;
    // 火のそば（入口のかがり火など）には巣穴を作らない
    if (this.fireNear(x * TILE + 8, y * TILE + 11)) continue;
    let moss = 0;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) moss += this.w.moss[yy * m.w + xx];
      }
    // 岩の向こうに空洞の気配がある所を好む（巣穴を掘り進めて掘り当てる）
    const near = this.w.nearestSealed(x, y, 8);
    const v = moss - this.burrows.filter((b) => Math.abs(b.x / TILE - x) < 6 && Math.abs(b.y / TILE - y) < 6).length * 3000 + (near >= 0 ? 20000 : 0);
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  if (best < 0) best = this.nearestFloor(m.entrance.x * TILE + 16, 40);
  const b: Burrow = { x: (best % m.w) * TILE + 8, y: Math.floor(best / m.w) * TILE + 11 };
  b.cap = this.burrowCap(b);
  this.burrows.push(b);
  return b;
}

/** 夕暮れにコウモリが裂け目から入ってくる、夜明けに増える */
export function onDayEvents(this: Ecology, prevPhase: number, phase: number): void {
  const m = this.w.map;
  const crossed = (p: number) => (prevPhase < p && phase >= p) || (prevPhase > phase && (phase >= p || prevPhase < p));
  // 噂は日ごとに薄れる。明るさの噂は、入口のまわりから漏れる光で決まる
  if (crossed(0.5)) {
    const r = this.rumors;
    r.gold *= 0.8;
    r.undead *= 0.8;
    r.beast *= 0.8;
    r.dragon *= 0.85;
    r.goblin *= 0.8;
    let glow = 0;
    for (let y = 0; y < Math.min(m.h, 30); y++)
      for (let x = Math.max(0, m.entrance.x - 30); x < Math.min(m.w, m.entrance.x + 30); x++) {
        const k = y * m.w + x;
        if (this.w.mossGlow[k] > 0.08 || this.w.fungusGlow[k] > 0.06) glow++;
      }
    r.light = Math.min(3, glow / 120);
  }
  if (crossed(0.74)) {
    for (let si = 0; si < m.shafts.length; si++) {
      const s = m.shafts[si];
      const col = this.list.filter((c) => c.k === Kind.Bat && !c.dead && c.tx === s.x * TILE + 8 && c.ty === s.y * TILE + 8).length;
      let moss = 0;
      for (let dy = -10; dy <= 10; dy++)
        for (let dx = -10; dx <= 10; dx++) {
          const x = s.x + dx;
          const y = s.y + dy;
          if (x >= 0 && y >= 0 && x < m.w && y < m.h) moss += this.w.moss[y * m.w + x];
        }
      if (col < 20 && moss > 2500) {
        for (let i = 0; i < 2; i++) {
          this.imported += 10 + 10;
          this.originNext = "shaft";
          // 縦穴の真上が岩や別の洞窟なら、縦穴のマスの中に現れる（roostSpot）
          const [bx, by] = this.roostSpot(s.x * TILE + 8, s.y * TILE + 8, s.x * TILE + 8, s.y * TILE - 20);
          const b = this.spawn(Kind.Bat, bx, by, 10, 10);
          this.homeBat(b, s.x, s.y);
        }
      }
    }
  }
  if (crossed(0.24)) {
    // 夜明けのねぐらで、よく食べた群れに子が生まれる
    const bats = this.list.filter((c) => c.k === Kind.Bat && !c.dead && c.st === 0 && c.food >= 30);
    for (const b of bats) {
      if (this.counts[Kind.Bat] >= 260 || ih(b.id, this.step, 91) % 3 !== 0) continue;
      b.food -= 10;
      const n = this.spawn(Kind.Bat, b.x, b.y, 10, 0);
      n.hx = b.hx;
      n.hy = b.hy;
      n.tx = b.tx;
      n.ty = b.ty;
    }
  }
}

export function homeBat(this: Ecology, b: Cr, sx: number, sy: number): void {
  // ねぐらの天井に、仲間と少しずつ間をあけてぶら下がる（ねぐらの何匹目かで場所を決める）
  const i = this.list.filter((o) => o !== b && o.k === Kind.Bat && !o.dead && o.tx === sx * TILE + 8 && o.ty === sy * TILE + 8).length;
  [b.hx, b.hy] = this.roostSpot(sx * TILE + 8, sy * TILE + 8, sx * TILE + 8 + ((i % 6) - 2.5) * 7 + ((b.id % 3) - 1), sy * TILE - 18 - Math.floor(i / 6) * 8);
  b.tx = sx * TILE + 8;
  b.ty = sy * TILE + 8;
  b.st = 4;
}

/** はじめのウィスプ（苔の濃い所に少し） */
export function seed(this: Ecology): void {
  const m = this.w.map;
  // 古い宝の山、宝物庫のゴーレム、深部で眠るワーム
  for (const h of m.hoards) this.piles.push({ id: this.nextId++, x: h.x * TILE + 8, y: h.y * TILE + 8, gold: h.gold, age: 0 });
  if (m.vaultCenter.x >= 0) {
    const g = this.spawn(Kind.Golem, (m.vaultCenter.x + 3) * TILE + 8, (m.vaultCenter.y + 1) * TILE + 8, 0, 0);
    g.dir = 0;
  }
  if (m.deep.x >= 0) {
    // ワームの体は、まわりの土の養分から
    let body = 0;
    for (let dy = -6; dy <= 6 && body < 300; dy++)
      for (let dx = -6; dx <= 6 && body < 300; dx++) {
        const k = (m.deep.y + dy) * m.w + m.deep.x + dx;
        if (k < 0 || k >= m.solid.length || m.solid[k]) continue;
        const t = Math.min(this.w.nutr[k] - 4, 300 - body);
        if (t > 0) {
          this.w.nutr[k] -= t;
          body += t;
        }
      }
    const wm = this.spawn(Kind.Worm, m.deep.x * TILE + 8 + 30, m.deep.y * TILE + 8 + 20, body, 0);
    wm.st = 0;
    wm.dir = 0;
    // 眠っている体：頭の後ろにとぐろを巻くように
    const tr: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = i * 0.7;
      tr.push(Math.round(wm.x + Math.sin(a) * (6 + i * 1.6)), Math.round(wm.y - 6 - i * 5 + Math.cos(a) * 4));
    }
    this.trails.set(wm.id, tr);
  }
  let n = 0;
  for (let k = 0; k < m.w * m.h && n < 40; k += 7) {
    if (this.w.moss[k] >= 200 && ih(k, 7) % 3 === 0) {
      this.w.moss[k] -= 4;
      this.spawn(Kind.Wisp, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 4, 0);
      n++;
    }
  }
}

/** 苔からウィスプが生まれる（苔の更新から呼ばれる） */
export function maybeSpawnWisp(this: Ecology, k: number, step: number): void {
  if (this.counts[Kind.Wisp] >= MAX_WISPS) return;
  if (this.w.moss[k] < 200 || ih(k, step, 99) % 45 >= MOSS_R || this.w.mana[k] < 2) return;
  this.w.moss[k] -= 4;
  this.counts[Kind.Wisp]++;
  const m = this.w.map;
  const wi = this.spawn(Kind.Wisp, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, 4, 0);
  this.takeMana(wi, k, 2, 0);
  // 光の筋の日の光とマナが重なる所では、光の精になる
  if (this.w.lightBase[k] * this.day >= 250 && this.manaAround(k) >= 4 && !this.list.some((o) => o.elite === 7 && !o.dead) && this.w.tick - (this.lastElite[7] ?? -1e9) > DAY_TICKS_ECO * 2) {
    wi.elite = 7;
    wi.hx = wi.x;
    wi.hy = wi.y;
    this.lastElite[7] = this.w.tick;
    this.takeMana(wi, k, 20, 2);
    this.nameOf(wi);
    this.log(wi.x, wi.y, `日の光とマナが重なり、光の精「${this.names.get(wi.id)}」が生まれた`);
  }
}

/** 金貨の総量（山と、生き物が抱えている分） */
export function totalGold(this: Ecology): number {
  let g = 0;
  for (const p of this.piles) g += p.gold;
  for (const c of this.list) g += c.gold;
  return g;
}

/** 生き物と死骸が抱えている養分の合計 */
/** まわり3×3マスのマナの平均 */
export function manaAround(this: Ecology, k: number): number {
  const m = this.w.map;
  if (k < 0) return 0;
  let s2 = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const q = k + dy * m.w + dx;
    if (q >= 0 && q < this.w.mana.length) s2 += this.w.mana[q];
  }
  return s2 / 9;
}

/** まわり（半径 r マス）の土からマナを集めて、生まれる者の体に移す（足りなければ集められた分だけ） */
export function takeMana(this: Ecology, c: Cr, k: number, want: number, r = 2): void {
  const m = this.w.map;
  let got = 0;
  for (let pass = 0; pass < 4 && got < want; pass++)
    for (let dy = -r; dy <= r && got < want; dy++)
      for (let dx = -r; dx <= r && got < want; dx++) {
        const q = k + dy * m.w + dx;
        if (q < 0 || q >= this.w.mana.length) continue;
        const t = Math.min(this.w.mana[q] >> 1, want - got);
        if (t <= 0) continue;
        this.w.mana[q] -= t;
        got += t;
      }
  c.mana += got;
}

/** まわり（半径 r マス）の土から養分を集める（体を作るため）。集められた量を返す。足りなければ何も取らない */
export function takeNutrients(this: Ecology, k: number, want: number, r = 3): number {
  const m = this.w.map;
  let have = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const q = k + dy * m.w + dx;
    if (q >= 0 && q < this.w.nutr.length && !m.solid[q]) have += Math.max(0, this.w.nutr[q] - 2);
  }
  if (have < want) return 0;
  let got = 0;
  for (let dy = -r; dy <= r && got < want; dy++) for (let dx = -r; dx <= r && got < want; dx++) {
    const q = k + dy * m.w + dx;
    if (q < 0 || q >= this.w.nutr.length || m.solid[q]) continue;
    const t = Math.min(Math.max(0, this.w.nutr[q] - 2), want - got);
    this.w.nutr[q] -= t;
    got += t;
  }
  return got;
}

/**
 * マナから上位の魔物が生まれる（通常速度で5秒ごと）：開いた床を数十か所見て、まわりのマナが濃く、条件の揃った所から、
 * トロール（40〜、暗がり）、ミノタウロス（縄張りの中なら、マナが薄くても）、バジリスク（60〜、暗がり、人の気配が薄い）、
 * ドラゴンの幼子（120〜、ダンジョンにドラゴンがいない）が生まれる。生まれるとき、まわりのマナと土の養分を使う
 */
export function manaBirths(this: Ecology, day: number): void {
  const m = this.w.map;
  const n = this.counts;
  const dragons = this.list.some((c) => c.k === Kind.Dragon && !c.dead);
  // 水の精：深い水とマナが重なる所から（通常速度で1分ごとに数か所を見る。ダンジョンに一体まで）
  if (this.step % 600 === 223 && !this.list.some((o) => o.elite === 6 && !o.dead) && this.w.tick - (this.lastElite[6] ?? -1e9) > DAY_TICKS_ECO * 2) {
    for (let i = 0; i < 80; i++) {
      const k = ih(this.step, i, 306) % (m.w * m.h);
      if (m.solid[k] || m.sealed[k] || this.w.water[k] < 150 || this.manaAround(k) < 12) continue;
      const got = this.takeNutrients(k, 20, 3);
      if (!got) continue;
      this.originNext = 'mana';
      const c = this.spawn(Kind.Slime, (k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8, got, 0);
      c.elite = 6;
      c.hx = c.x;
      c.hy = c.y;
      this.lastElite[6] = this.w.tick;
      this.takeMana(c, k, 40);
      this.nameOf(c);
      this.log(c.x, c.y, `深い水と濃いマナから、水の精「${this.names.get(c.id)}」が生まれた`);
      break;
    }
  }
  // ドラゴンの幼子：ダンジョンにドラゴンがいなければ、6日目以降、深部のまわり（20マス）でいちばん濃い所を探し、70以上なら生まれる（通常速度で1分ごと）
  if (!dragons && this.step % 600 === 113 && this.w.tick > DAY_TICKS_ECO * 6 && this.w.tick - (this.lastArrival[Kind.Dragon] ?? -1e9) * 2 > DAY_TICKS_ECO * 2) {
    let bk = -1;
    let bv = 0;
    for (let dy = -20; dy <= 20; dy++)
      for (let dx = -20; dx <= 20; dx++) {
        const x = m.deep.x + dx;
        const y = m.deep.y + dy;
        if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
        const k = y * m.w + x;
        if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.lightBase[k] > 0 || this.w.water[k] > 40) continue;
        const v = this.manaAround(k);
        if (v > bv) {
          bv = v;
          bk = k;
        }
      }
    if (bk >= 0 && bv >= 70) {
      const got = this.takeNutrients(bk, Math.round(SPEC[Kind.Dragon].body * 0.2), 5);
      if (got) {
        const x = (bk % m.w) * TILE + 8;
        const y = Math.floor(bk / m.w) * TILE + 8;
        this.originNext = 'mana';
        const c = this.spawn(Kind.Dragon, x, y, got, 60);
        this.imported += 60;
        // 幼竜が卵を割って出てくると、地の底の揺れと咆哮が町にも伝わる（竜の噂。竜殺しが深部を探りに来る）
        this.rumors.dragon += 0.6;
        this.takeMana(c, bk, 600, 4);
        c.sp = 0;
        c.st = 0;
        c.hx = x;
        c.hy = y;
        c.bornAt = this.w.tick;
        c.lureAt = this.step;
        this.lastArrival[Kind.Dragon] = this.step;
        this.dragonShell = { x, y: y + 4, t: this.w.tick };
        this.log(x, y, `深部の濃いマナから、{k:${Kind.Dragon}}の幼子が生まれた`);
      }
    }
  }
  const near = (k: number, kind: Kind, R: number) => this.list.some((c) => c.k === kind && !c.dead && Math.abs(c.x / TILE - (k % m.w)) + Math.abs(c.y / TILE - Math.floor(k / m.w)) < R);
  // ミノタウロスは、ダンジョンに一頭もいなくて、2日目以降、前の一頭が生まれてから1日（生き物の更新 DAY_TICKS_ECO / CR_EVERY 回）たっていれば生まれる。
  // そのときは、見る場所の一つめを縄張りの床にする（縄張りはせまく、ばらばらに見るだけではめったに当たらない）
  const minoOk = n[Kind.Minotaur] === 0 && this.w.tick > DAY_TICKS_ECO * 2 && this.step - (this.lastArrival[Kind.Minotaur] ?? -1e9) > DAY_TICKS_ECO / CR_EVERY;
  const lt = minoOk ? this.lairTiles() : [];
  for (let i = 0; i < 40; i++) {
    const k = i === 0 && lt.length ? lt[ih(this.step, 0, 233) % lt.length] : ih(this.step, i, 230) % (m.w * m.h);
    if (m.solid[k] || m.sealed[k] || m.lava[k] || this.w.water[k] > 40) continue;
    const mn = this.manaAround(k);
    const lair = this.inLair((k % m.w) * TILE + 8, Math.floor(k / m.w) * TILE + 8);
    if (mn < 2 && !lair) continue;
    const noSun = this.w.lightBase[k] === 0;
    const dark = this.lit(k, day) < 0.12;
    const x = (k % m.w) * TILE + 8;
    const y = Math.floor(k / m.w) * TILE + 8;
    let kind: Kind | -1 = -1;
    let cost = 0;
    let body = 0;
    if (mn >= 60 && dark && noSun && n[Kind.Basilisk] < 2 && this.presenceAt(x, y) < 0.15 && !near(k, Kind.Basilisk, 30) && !near(k, Kind.Troll, 12) && !near(k, Kind.Dragon, 25)) {
      kind = Kind.Basilisk;
      cost = 240;
      body = 60;
    } else if (mn >= 40 && dark && noSun && n[Kind.Troll] < 2 && !near(k, Kind.Troll, 25) && !near(k, Kind.Basilisk, 12) && !near(k, Kind.Dragon, 25)) {
      kind = Kind.Troll;
      cost = 160;
      body = 150;
    } else if (lair && minoOk) {
      // 縄張りは古い呪いの場所：マナが薄くても、縄張りの中なら主が生まれる（寝床を住みかにする）
      kind = Kind.Minotaur;
      cost = 20;
      body = 120;
    }
    if (kind === -1 || ih(k, this.step, 232) % 4 !== 0) continue;
    const got = this.takeNutrients(k, body, 3);
    if (!got) continue;
    this.originNext = 'mana';
    const c = this.spawn(kind, x, y, got, 0);
    this.takeMana(c, k, cost, 3);
    c.hx = x;
    c.hy = y;
    if (kind === Kind.Minotaur) {
      c.hx = m.lair.x * TILE + 8;
      c.hy = m.lair.y * TILE + 8;
      this.lastArrival[Kind.Minotaur] = this.step;
    }
    this.log(x, y, `濃いマナから{k:${kind}}が生まれた`);
    return;
  }
}

/** 生き物が体に溜めているマナの合計 */
export function heldMana(this: Ecology): number {
  let s = 0;
  for (const c of this.list) if (c.dead !== 2) s += c.mana;
  // 床の武具に宿る未練（src/eco/armor.ts）
  for (const it of this.gear) if (isJobItem(it.kind)) s += it.fuel;
  return s;
}

/** マナをその場の土へ還す */
export function releaseMana(this: Ecology, c: Cr): void {
  if (c.mana <= 0) return;
  const k = this.tileOf(c.x, c.y);
  if (k >= 0) this.w.mana[k] += c.mana;
  else this.w.manaFaded += c.mana;
  c.mana = 0;
}

/** 生き物と巣と石像が抱えている養分。openOnly なら閉じた空洞の中のものは数えない */
export function heldNutrients(this: Ecology, openOnly = false): number {
  const m = this.w.map;
  const ok = (x: number, y: number) => {
    if (!openOnly) return true;
    const k = this.tileOf(x, y);
    return k < 0 || !m.sealed[k];
  };
  let s = 0;
  for (const c of this.list) if (ok(c.x, c.y)) s += c.body + c.food + c.units;
  for (const o of this.colonies) if (ok(o.x, o.y)) s += o.store + o.queen;
  for (const o of this.warrens) if (o.id >= 0 && ok(o.x, o.y)) s += o.store ?? 0;
  for (const o of this.statues) if (ok(o.x, o.y)) s += o.units;
  if (this.hold) s += this.hold.store;
  for (const cp of this.camps) if (cp.id >= 0 && ok(cp.x, cp.y)) s += (cp.fuel ?? 0) + (cp.store ?? 0);
  for (const e of this.eggs) if (ok(e.x, e.y)) s += e.units;
  for (const o of this.caches) if (ok(o.x, o.y)) s += o.food;
  return s;
}

declare module '../ecology' {
  interface Ecology {
    spawnSalamanders: typeof spawnSalamanders;
    salamander: typeof salamander;
    pickBurrow: typeof pickBurrow;
    onDayEvents: typeof onDayEvents;
    homeBat: typeof homeBat;
    seed: typeof seed;
    maybeSpawnWisp: typeof maybeSpawnWisp;
    totalGold: typeof totalGold;
    manaAround: typeof manaAround;
    takeMana: typeof takeMana;
    takeNutrients: typeof takeNutrients;
    manaBirths: typeof manaBirths;
    heldMana: typeof heldMana;
    releaseMana: typeof releaseMana;
    heldNutrients: typeof heldNutrients;
  }
}

Object.assign(Ecology.prototype, { spawnSalamanders, salamander, pickBurrow, onDayEvents, homeBat, seed, maybeSpawnWisp, totalGold, manaAround, takeMana, takeNutrients, manaBirths, heldMana, releaseMana, heldNutrients });
