/** Ecology のメソッド：大グモ（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { Cr, DIR16, Ecology, Kind, SPEC, STR, Web, ih, sq } from '../ecology';
import { TILE } from '../mapgen';

export function spider(this: Ecology, c: Cr, day: number): void {
  const s = SPEC[Kind.Spider];
  if (c.st === 0) {
    // 巣を張る場所を探す：明るく、壁が近く、飛ぶものが通る所
    const m = this.w.map;
    let ox = c.x;
    let oy = c.y;
    if (c.hungry > 0 || ih(c.id, this.step, 33) % 2 === 0) {
      if (m.shafts.length) {
        const sh = m.shafts[ih(c.id, this.step, 34) % m.shafts.length];
        ox = sh.x * TILE + 8;
        oy = sh.y * TILE + 8;
      }
    }
    const tx0 = Math.floor(ox / TILE);
    const ty0 = Math.floor(oy / TILE);
    let best = -1;
    let bv = 0;
    // 歩いて行ける所（つながった洞窟の同じ領域）だけを選ぶ（以前は岩の向こうの行けない所を選んで、道が見つからないまま足踏みすることがあった）
    const home = this.regionOf(this.tileOf(c.x, c.y));
    for (let i = 0; i < 40; i++) {
      const h = ih(c.id, this.step, 500 + i);
      const x = tx0 + ((h & 255) % 31) - 15;
      const y = ty0 + (((h >>> 8) & 255) % 31) - 15;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue;
      const k = y * m.w + x;
      if (m.solid[k] || m.lava[k] || (home >= 0 && this.regionOf(k) !== home)) continue;
      let walls = 0;
      for (const n of [k + 1, k - 1, k + m.w, k - m.w, k + m.w + 1, k - m.w - 1]) walls += m.solid[n];
      if (walls < 2) continue;
      // 通る者の多い所：飛ぶ者（ウィスプ、コウモリ）と、地面を行く小さな者（大ネズミ、アリ）
      let fly = 0;
      this.nearby(x * TILE + 8, y * TILE + 8, 2, (o) => {
        if ((o.k === Kind.Wisp || o.k === Kind.Bat || o.k === Kind.Rat || o.k === Kind.Ant) && !o.dead) fly++;
      });
      // 通路をふさぐ所（両脇が岩で、前後が開いている）を好む
      const corridor = (m.solid[k - 1] && m.solid[k + 1] && !m.solid[k - m.w] && !m.solid[k + m.w]) || (m.solid[k - m.w] && m.solid[k + m.w] && !m.solid[k - 1] && !m.solid[k + 1]) ? 3 : 0;
      const v = fly + corridor + this.lit(k, Math.max(day, 0.5)) * 3;
      // ほかのクモとその巣から、縄張り（Ecology.TERRITORY、6マス）より離れた所（以前は縄張りの中を選び、向かっては主に追い払われて戻り、行ったり来たりしていた）
      const far = (Ecology.TERRITORY[Kind.Spider] + 1) * TILE;
      const px = x * TILE + 8;
      const py = y * TILE + 8;
      if (v > bv && !this.webs.some((w) => w.owner !== c.id && sq(w.x - px) + sq(w.y - py) < far * far) && !this.list.some((o) => o !== c && o.k === Kind.Spider && !o.dead && sq(o.x - px) + sq(o.y - py) < far * far)) {
        bv = v;
        best = k;
      }
    }
    if (best >= 0) {
      c.tx = (best % m.w) * TILE + 8;
      c.ty = Math.floor(best / m.w) * TILE + 8;
      c.st = 1;
    } else {
      const j = DIR16[ih(c.id, this.step, 7) & 15];
      this.tryMove(c, j[0] * s.speed, j[1] * s.speed);
      c.act = 1;
    }
    return;
  }
  if (c.st === 1) {
    c.act = 1;
    if (this.goTo(c, c.tx, c.ty, s.speed)) {
      const web: Web = { id: this.nextId++, x: c.tx, y: c.ty, r: Ecology.WEB_R, owner: c.id, age: 0 };
      this.webs.push(web);
      c.ref = web.id;
      c.st = 2;
    }
    return;
  }
  // 巣で待ち、かかった獲物を食べる
  const web = this.webs.find((w) => w.id === c.ref);
  if (!web) {
    c.st = 0;
    return;
  }
  let prey: Cr | null = null;
  this.nearby(web.x, web.y, 2, (o) => {
    if (o.caught && o.ref === web.id && !o.dead) prey = o;
  });
  if (prey && c.food < s.cap * 0.7) {
    const p = prey as Cr;
    c.act = 1;
    if (this.moveToward(c, p.x, p.y, s.speed * 1.5)) this.eat(c, p);
  } else {
    if (this.moveToward(c, web.x, web.y, s.speed)) {
      if (c.act !== 2 || c.actT > 6) c.act = 0;
    } else c.act = 1;
  }
  if (c.sinceMeal > 2400) {
    web.owner = 0;
    c.st = 0;
    c.sinceMeal = 0;
  }
  if (c.food >= 60 && this.counts[Kind.Spider] < 14 && ih(c.id, this.step, 31) % 1500 === 0) {
    c.food -= 20;
    this.spawn(Kind.Spider, c.x, c.y, 20, 0);
  }
}

/**
 * 巣を通る者の扱い（体の大きさ＝強さで分ける。webEffect）：
 * 0 何も起きない（飛ばない種のうち、霊やゴーレムなど糸に絡まないもの、巣の主のクモ）、1 捕まる（ウィスプ、飛ぶコウモリ、大ネズミ、アリ）、
 * 2 糸に足を取られて半分の速さになる（強さ2〜5の地面を行く者）、3 引き裂いて通る（強さ6以上）、4 刃物か松明で切り払って通る（冒険者）
 */
export function webEffect(this: Ecology, o: Cr): number {
  if (o.k === Kind.Wisp || o.k === Kind.Rat || o.k === Kind.Ant) return 1;
  if (o.k === Kind.Bat) return o.st !== 0 ? 1 : 0;
  if (o.k === Kind.Adventurer) return 4;
  if (o.k === Kind.Spider || o.k === Kind.Ghost || o.k === Kind.Gargoyle || o.k === Kind.Wyvern || o.k === Kind.Dragon || o.k === Kind.Mimic || o.k === Kind.Worm || o.k === Kind.Lich) return 0;
  return STR[o.k] >= 6 ? 3 : STR[o.k] >= 2 ? 2 : 0;
}

/** その者が、いま巣の糸の中にいるか（足を取られる者が、歩みを半分にするため。tryMove） */
export function inWeb(this: Ecology, c: Cr): boolean {
  for (const w of this.webs) if (sq(c.x - w.x) + sq(c.y - w.y) < w.r * w.r) return true;
  return false;
}

/**
 * 巣から抜け出す：糸を振りほどいて、巣の縁のすぐ外へ跳び出す（巣の中に残ると、また捕まって抜け出せないまま動けなくなるため）。
 * 跳び出せる床がなければ、その場で放される
 */
export function escapeWeb(this: Ecology, c: Cr): void {
  c.caught = false;
  const web = this.webs.find((w) => w.id === c.ref);
  if (!web) return;
  const a0 = Math.atan2(c.y - web.y, c.x - web.x) || (c.id % 8) * 0.785;
  for (let i = 0; i < 8; i++) {
    const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.785;
    const x = web.x + Math.cos(a) * (web.r + 4);
    const y = web.y + Math.sin(a) * (web.r + 4);
    if (this.passable(c, x, y)) {
      c.x = x;
      c.y = y;
      return;
    }
  }
}

/** 巣を引き裂く（大きな者が通った、冒険者が切り払った）。巣の主のクモは、次の更新で巣を張り直しに出る */
export function tearWeb(this: Ecology, web: Web, by: Cr, how: 'tear' | 'cut'): void {
  this.webs = this.webs.filter((w) => w !== web);
  this.fxWebTears.push({ t: this.w.tick, x: web.x, y: web.y, r: web.r });
  if (this.fxWebTears.length > 20) this.fxWebTears.splice(0, 5);
  this.record('settle', { t: this.w.tick, k: Kind.Spider, id: web.id, ev: 'web', how, by: by.k, x: Math.round(web.x), y: Math.round(web.y) } as never);
  // 捕まっていた者は、糸がほどけて逃げられる
  for (const o of this.list) if (o.caught && o.ref === web.id) o.caught = false;
  if (how === 'cut') {
    // 冒険者は、刃物か松明で巣を払う（振りの演出だけを出す。戦いの姿 act 2 にはしない：目標や聞き耳の判断が「戦っている」と見てしまうため）
    this.fxAttacks.push({ t: this.w.tick, style: 'slash', col: 0, size: 1, ax: by.x, ay: by.y, dx: web.x, dy: web.y, did: 0, aid: by.id, big: false, kill: false });
  }
}

export function updateWebs(this: Ecology): void {
  const torn: [Web, Cr, 'tear' | 'cut'][] = [];
  for (const web of this.webs) {
    web.age++;
    const R = Math.ceil(web.r / TILE) + 1;
    this.nearby(web.x, web.y, R, (o) => {
      // （眠っている者は巣に関わらない：焚き火で眠る冒険者が巣を切り払ったり、ねぐらのコウモリが捕まったりしない）
      if (o.dead || o.caught || o.away || o.sleep > 0) return;
      if (sq(o.x - web.x) + sq(o.y - web.y) > web.r * web.r) return;
      const ef = this.webEffect(o);
      if (ef === 1) {
        // 捕まる：ウィスプは8分の1、コウモリは25分の1、大ネズミとアリは30分の1（生き物の更新ごと、糸の中にいる間）
        const chance = o.k === Kind.Wisp ? 8 : o.k === Kind.Bat ? 25 : 30;
        if (ih(o.id, this.step, 61) % chance === 0) {
          o.caught = true;
          o.ref = web.id;
          o.vx = 0;
          o.vy = 0;
          if (o.k === Kind.Rat || o.k === Kind.Ant) this.record('settle', { t: this.w.tick, k: Kind.Spider, id: web.id, ev: 'web', how: 'catch', by: o.k, x: Math.round(o.x), y: Math.round(o.y) } as never);
        }
      } else if ((ef === 3 || ef === 4) && !torn.some((t) => t[0] === web)) torn.push([web, o, ef === 3 ? 'tear' : 'cut']);
    });
  }
  for (const [web, o, how] of torn) this.tearWeb(web, o, how);
  this.webs = this.webs.filter((w) => w.owner !== 0 || w.age < 3000);
}

declare module '../ecology' {
  interface Ecology {
    spider: typeof spider;
    updateWebs: typeof updateWebs;
    webEffect: typeof webEffect;
    inWeb: typeof inWeb;
    tearWeb: typeof tearWeb;
    escapeWeb: typeof escapeWeb;
  }
}

Object.assign(Ecology.prototype, { webEffect, inWeb, tearWeb, escapeWeb, spider, updateWebs });
