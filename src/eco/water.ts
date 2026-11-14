/**
 * Ecology のメソッド：水場（のどの渇き）。いろいろな種が同じ場所へ入れ替わり立ち寄り、出会う場所を作る。
 *
 * - 水を飲む種（DRINKERS）は、生き物の更新ごとに渇き（Cr.thirst）が1ずつ増える（thirstTick。代謝と同じく毎回）。THIRSTY を超え、種ごとの水を飲みに行く時刻
 *   （WINDOW。夜明けと夕暮れ／夜／昼）に入ったら、WATER_R マスの内（まっすぐの距離で見て、同じ洞窟の領域）の、いちばん近い水場へ行く。
 *   コボルト・ゴブリン・大ネズミは、住処や集落や巣穴から遠く離れないよう、HOME_R マスの内の水場にだけ行く。
 *   渇きが THIRST_MAX を超えたら、時刻に関わらず行く。渇いて死ぬことはない（水場が遠い者は行かず、渇きは THIRST_MAX で止まる）。
 * - 冒険者とドワーフは、一行や一団から離れないよう、通り道から8マスの内に水場があるときだけ立ち寄る。
 * - 水場に着いたら、DRINK_TIME 回のあいだ水際でかがんで飲み（Cr.thirst を負の数にして、残りの回数を数える）、渇きが0に戻る。
 *   途中で打たれたり、逃げるなどして水場を離れたりしたら、飲むのをやめて渇いたままにする。
 * - 弱い種は、水場のまわりに自分より強い種（STR が上で、同じ群れでない者）がいれば、少し離れた所で待ち、強い種が去ってから飲む
 *   （いちばん弱い種、強さ WEAK_STR 以下は待たずに、その日はあきらめて引き返す）。眠っている者は数えない。
 *   待つのは WAIT_MAX 回まで（待った回数は Cr.waitW。過ぎたら、その日はあきらめて渇きを THIRSTY の半分にする）。腹を空かせた捕食者は、ふだんどおり狩る（水場の休戦にはしない）。
 * - 水場（waterholes）は、どのマップにもある湧き水と、水（POOL_WATER より多い）のマスが POOL_MIN 以上まとまった水たまり。水の量は刻々と変わるので、
 *   ゲーム内の時間で決まった間隔（WH_EVERY tick ごと）にだけ作り直し、一覧をセーブに入れる（ロードし直しても同じ一覧になるように）。
 * - 水を飲みはじめたとき、その水場のまわりに3種以上いれば、水場ごとに生き物の更新 CROWD_GAP 回に1回だけ、賑わいとして記録する（分析用）。
 */
import { CR_EVERY, type Cr, Ecology, Kind, SPEC, STR, sq } from '../ecology';
import { TILE } from '../mapgen';

/** 水を飲む種 */
const DRINKERS = new Set<Kind>([Kind.Rat, Kind.Lizard, Kind.Kobold, Kind.Goblin, Kind.Orc, Kind.Lizardman, Kind.Troll, Kind.Minotaur, Kind.Basilisk, Kind.Adventurer, Kind.Dwarf, Kind.Bat]);
/** 住処や集落や巣穴から遠く離れないよう、近くの水場（HOME_R マスの内）にだけ行く種（遠くの水場へ行かせると、留守の間に住処が手薄になり、
 *  コボルトの住処が続く日数が半分になった。大ネズミは食べ物から離れすぎて、飢え死にが3倍になった） */
const HOMEBODIES = new Set<Kind>([Kind.Kobold, Kind.Goblin, Kind.Rat]);
const HOME_R = 30;
/** 一行や一団から離れないよう、通り道のそばの水場にだけ立ち寄る種 */
const PASSERS = new Set<Kind>([Kind.Adventurer, Kind.Dwarf]);
/** 水を飲みに行く時刻（一日のうちの割合。0 が真夜中）：0 夜明けと夕暮れ、1 夜、2 昼 */
const WINDOW: Partial<Record<Kind, 0 | 1 | 2>> = {
  [Kind.Rat]: 0, [Kind.Lizard]: 0, [Kind.Lizardman]: 0, [Kind.Troll]: 0, [Kind.Basilisk]: 0,
  [Kind.Bat]: 1, [Kind.Goblin]: 1, [Kind.Kobold]: 1, [Kind.Minotaur]: 1, [Kind.Orc]: 1,
  [Kind.Adventurer]: 2, [Kind.Dwarf]: 2,
};
/** いちばん弱い種とみなす強さ（STR がこれ以下の種は、水場で待たずに引き返し、腹が4割を切ったら水を飲みに行かない） */
const WEAK_STR = 1;
/** 渇いたとみなす値と、時刻に関わらず飲みに行く値（生き物の更新の回数。ゲーム内の1日は7200回） */
const THIRSTY = 5000;
const THIRST_MAX = 9000;
/** 水場へ行く距離（マス。まっすぐの距離）。水場が3か所ほどしかないマップでは、40マスでは大ネズミの半分ほどが届かなかった */
const WATER_R = 70;
/** 飲む回数、待つ上限 */
const DRINK_TIME = 60;
const WAIT_MAX = 150;
/** 水たまりを水場とみなす、水の量と、まとまったマスの数（浅い水たまりも入れる。深い水だけでは、水場が3か所ほどのマップが多く、歩いて40マスの内に水場のない生き物が多かった） */
const POOL_WATER = 10;
const POOL_MIN = 5;
/** 水場の一覧を作り直す間隔（tick）と、一覧が空のあいだの間隔 */
const WH_EVERY = 2000;
const WH_EMPTY_EVERY = 200;
/** 水場の賑わいを記録する間隔（生き物の更新の回数） */
const CROWD_GAP = 300;

export interface Waterhole {
  /** 水場の中心のピクセル座標 */
  x: number;
  y: number;
  /** 最後に賑わいを記録した生き物の更新の通し番号 */
  crowd: number;
}

/** 今の時刻が、その種の水を飲みに行く時刻か */
function inWindow(k: Kind, p: number): boolean {
  const w = WINDOW[k] ?? 0;
  if (w === 0) return (p >= 0.18 && p < 0.32) || (p >= 0.66 && p < 0.8);
  if (w === 1) return p >= 0.8 || p < 0.18;
  return p >= 0.32 && p < 0.66;
}

/**
 * 水場の一覧を作り直す（WH_EVERY tick ごと。一覧が空のあいだは WH_EMPTY_EVERY tick ごと。
 * 空のときに毎回作り直すと、水場のないマップでは生き物の更新ごとにマップ全体をなめていた）
 */
export function updateWaterholes(this: Ecology): void {
  if (this.w.tick % (this.waterholes.length ? WH_EVERY : WH_EMPTY_EVERY) !== 0) return;
  const m = this.w.map;
  const W = m.w;
  const water = this.w.water;
  const old = this.waterholes;
  const list: Waterhole[] = [];
  const keep = (x: number, y: number) => {
    const o = old.find((h) => Math.abs(h.x - x) < 3 * TILE && Math.abs(h.y - y) < 3 * TILE);
    list.push({ x, y, crowd: o ? o.crowd : -1e9 });
  };
  for (const s of m.springs) {
    const k = s.y * W + s.x;
    if (!m.solid[k] && !m.sealed[k]) keep(s.x * TILE + 8, s.y * TILE + 8);
  }
  const seen = new Uint8Array(W * m.h);
  for (let k = 0; k < W * m.h; k++) {
    if (seen[k] || water[k] <= POOL_WATER || m.solid[k] || m.sealed[k]) continue;
    const q = [k];
    seen[k] = 1;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      sx += c % W;
      sy += Math.floor(c / W);
      for (const d of [1, -1, W, -W]) {
        const n = c + d;
        if (n < 0 || n >= W * m.h || seen[n] || water[n] <= POOL_WATER || m.solid[n]) continue;
        seen[n] = 1;
        q.push(n);
      }
    }
    if (q.length < POOL_MIN) continue;
    // 水場の位置は、水たまりのマスのうち重心にいちばん近いマス（重心そのものは、輪や U 字の水たまりでは岩の上に落ち、
    // その洞窟の領域が求まらずに、誰も来ない水場になっていた）
    const gx = sx / q.length;
    const gy = sy / q.length;
    let bk = q[0];
    let bd = Infinity;
    for (const t of q) {
      const d = sq((t % W) - gx) + sq(Math.floor(t / W) - gy);
      if (d < bd) {
        bd = d;
        bk = t;
      }
    }
    const x = (bk % W) * TILE + 8;
    const y = Math.floor(bk / W) * TILE + 8;
    if (!list.some((h) => Math.abs(h.x - x) < 6 * TILE && Math.abs(h.y - y) < 6 * TILE)) keep(x, y);
  }
  this.waterholes = list;
}

/** その者がいま行ける、いちばん近い水場（まっすぐの距離で r マスの内、同じ洞窟の領域。なければ undefined） */
function nearestHole(e: Ecology, c: Cr, r: number): Waterhole | undefined {
  const reg = e.regionOf(e.tileOf(c.x, c.y));
  let best: Waterhole | undefined;
  let bd = sq(r * TILE);
  for (const h of e.waterholes) {
    const d = sq(h.x - c.x) + sq(h.y - c.y);
    if (d >= bd) continue;
    if (e.regionOf(e.tileOf(h.x, h.y)) !== reg) continue;
    bd = d;
    best = h;
  }
  return best;
}

/**
 * 水を飲む岸：水場の中心から5マスの内で、その者と同じ洞窟の領域にある深くない（水が40以下の）床のうち、上下左右のどこかに水（10より多い）があるマスの中から、
 * その者にいちばん近いマスの中心（ピクセル）。なければ水場の中心（壁の向こうの岸を目指して、壁ぎわで足踏みしないように）。
 * （中心を目指すと、中心が深い水の中にある水たまりでは岸までしか行けず、着いたことにならないまま足踏みしていた）
 */
function shoreFor(e: Ecology, h: Waterhole, c: Cr): [number, number] {
  const m = e.w.map;
  const reg = e.regionOf(e.tileOf(c.x, c.y));
  const W = m.w;
  const water = e.w.water;
  const cx = Math.floor(h.x / TILE);
  const cy = Math.floor(h.y / TILE);
  let bx = h.x;
  let by = h.y;
  let bd = Infinity;
  for (let y = cy - 5; y <= cy + 5; y++)
    for (let x = cx - 5; x <= cx + 5; x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= m.h - 1) continue;
      const k = y * W + x;
      if (m.solid[k] || m.sealed[k] || m.lava[k] || water[k] > 40 || e.regionOf(k) !== reg) continue;
      if (!(water[k] > 10 || water[k + 1] > 10 || water[k - 1] > 10 || water[k + W] > 10 || water[k - W] > 10)) continue;
      const px = x * TILE + 8;
      const py = y * TILE + 8;
      const d = sq(px - c.x) + sq(py - c.y);
      if (d < bd) {
        bd = d;
        bx = px;
        by = py;
      }
    }
  return [bx, by];
}

/**
 * 飲んでいる場所を離れたか：どの水場の中心からも8マスより離れたか（岸は中心から縦横5マスの四角の内、斜めの隅でも7.1マスなので、岸で飲んでいる間は離れたことにならない。
 * 6マスにしていたときは、隅の岸に着くたびに、飲みはじめては止めるのをくり返していた）。
 * （水のマスがまわりにあるかで見ると、浅い水たまりでは水の量が10の前後を行き来して、飲みはじめては止めるのを毎回くり返していた）
 */
function leftWater(e: Ecology, c: Cr): boolean {
  return !e.waterholes.some((h) => sq(h.x - c.x) + sq(h.y - c.y) < sq(8 * TILE));
}

/**
 * 渇きを進める（生き物の更新ごとに、代謝と同じく必ず呼ぶ。src/eco/step.ts の metabolism。行動を決める流れの途中で増やすと、
 * 手前の処理でその回の行動が決まることの多い種（追い払いをする大ネズミなど）は、ほとんど渇かなかった）
 */
export function thirstTick(this: Ecology, c: Cr): void {
  if (c.thirst >= 0 && c.thirst < THIRST_MAX && DRINKERS.has(c.k) && !c.away && !c.elite) c.thirst++;
}

/** 渇いていれば水場へ行って飲む。この回の行動をこれで済ませたら true */
export function thirstStep(this: Ecology, c: Cr): boolean {
  if (!DRINKERS.has(c.k) || c.away || c.elite) return false;
  // 飲んでいる最中（thirst が負）：水際でかがんだまま、残りの回数を数える
  if (c.thirst < 0) {
    // 飲んでいる途中で打たれたか、逃げるなどして水場を離れていたら、飲むのをやめる（渇いたままにして、あとで飲み直しに行く）。
    // 打たれたかは、残りの回数ぶんより最近に打たれたかで見る（飲みはじめた時刻を持たずに済むように、ゆるめに見る）。
    // （続けると、逃げた先の乾いた床で立ち止まって飲み続けていた）
    if (this.w.tick - c.hitAt < -c.thirst * CR_EVERY || leftWater(this, c)) {
      c.thirst = THIRSTY;
      return false;
    }
    c.thirst++;
    c.act = 0;
    return c.thirst < 0;
  }
  if (c.thirst < THIRSTY) return false;
  // 戦っている・逃げている・人の気配から退いている・食べている・飢えかけている間は、水より先に。
  // 飢えかけの線は腹の15%（3割では、腹の上限の大きいコボルトがふだんから引っかかって、渇ききっても行かなかった）。
  // ただし、いちばん弱い種（強さ1以下。大ネズミ・コウモリ）は4割（水場で待たされやすく、15%では食べる時間が削られて、大ネズミの飢え死にの割合が倍になった）
  const weak = STR[c.k] <= WEAK_STR;
  if (c.flee > 0 || c.feed || c.run !== 0 || c.caught || this.retreats.has(c.id) || this.w.tick - c.hitAt < 120 || c.food < SPEC[c.k].cap * (weak ? 0.4 : 0.15)) return false;
  if (c.thirst < THIRST_MAX && !inWindow(c.k, this.phaseNow)) return false;
  const h = nearestHole(this, c, PASSERS.has(c.k) ? 8 : HOMEBODIES.has(c.k) ? HOME_R : WATER_R);
  if (!h) return false;
  const d2 = sq(h.x - c.x) + sq(h.y - c.y);
  // 水場のまわり（3マスの内）に、自分より強い、同じ群れでない者がいれば、5マスの所で待つ
  if (d2 < sq(6 * TILE)) {
    const s = STR[c.k];
    let bigger = false;
    this.nearby(h.x, h.y, 3, (o) => {
      // 眠っている者は数えない（水場のそばで眠りこんだ大物がいると、その間だれも飲めなかった）
      if (bigger || o === c || o.dead || o.away || o.sleep > 0 || STR[o.k] <= s) return;
      if (o.k === c.k && o.ref === c.ref) return;
      bigger = true;
    });
    if (bigger && weak) {
      // いちばん弱い種は待たずに引き返す（たいてい誰かを待つことになり、そのぶん食べる時間が削られて、大ネズミの飢え死にが増えた）
      c.thirst = THIRSTY >> 1;
      return false;
    }
    if (bigger) {
      c.waitW++;
      if (c.waitW > WAIT_MAX) {
        c.waitW = 0;
        c.thirst = THIRSTY >> 1;
        return false;
      }
      c.act = 0;
      if (d2 < sq(4 * TILE)) {
        // 近すぎれば少し下がる
        const a = Math.atan2(c.y - h.y, c.x - h.x);
        this.goTo(c, h.x + Math.cos(a) * 5 * TILE, h.y + Math.sin(a) * 5 * TILE, SPEC[c.k].speed * 0.6);
        c.act = 1;
      }
      return true;
    }
  }
  // 岸を探すのは水場の8マスの内に入ってから（遠いうちは水場の中心へ向かう。毎回岸を探すと、生き物1匹あたりの実行時間が2割近く増えた）
  const [sx, sy] = d2 < sq(8 * TILE) ? shoreFor(this, h, c) : [h.x, h.y];
  if (sq(sx - c.x) + sq(sy - c.y) < sq(0.8 * TILE) || d2 < sq(1.6 * TILE)) {
    // 着いた：飲みはじめる
    c.thirst = -DRINK_TIME;
    c.waitW = 0;
    c.act = 0;
    this.fxDrinks.push({ t: this.w.tick, x: Math.round(c.x), y: Math.round(c.y) });
    if (this.fxDrinks.length > 60) this.fxDrinks.splice(0, 20);
    this.record('settle', { t: this.w.tick, k: c.k, id: c.id, ev: 'drink', x: Math.round(c.x), y: Math.round(c.y) } as never);
    if (this.step - h.crowd >= CROWD_GAP) {
      const kinds = new Set<number>();
      this.nearby(h.x, h.y, 5, (o) => {
        if (!o.dead && !o.away) kinds.add(o.k);
      });
      if (kinds.size >= 3) {
        h.crowd = this.step;
        this.record('settle', { t: this.w.tick, k: c.k, id: c.id, ev: 'waterCrowd', n: kinds.size, x: Math.round(h.x), y: Math.round(h.y) } as never);
      }
    }
    return true;
  }
  c.act = 1;
  this.goTo(c, sx, sy, SPEC[c.k].speed);
  return true;
}

declare module '../ecology' {
  interface Ecology {
    updateWaterholes: typeof updateWaterholes;
    thirstStep: typeof thirstStep;
    thirstTick: typeof thirstTick;
  }
}

Object.assign(Ecology.prototype, { updateWaterholes, thirstStep, thirstTick });
