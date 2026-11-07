import type { Atlas } from './atlas';
import { BLOOD, Ecology, GOLD_CAP, Kind, type Cr } from './ecology';
import { TROPHY } from './eco/loot';
import { ARMOR_BIRTH_MANA, ARMOR_LOW, ARMOR_RISE, isJobItem } from './eco/armor';
import { RANK_AT, packLook, unpackLook } from './eco/roster';
import { SKILL_WIZARD_FIRE } from './eco/skill';
import { VAMP_COFFIN, VAMP_SCATTER } from './eco/vampire';
import { MAX_DYN } from './shaders';
import { heroOrbAt } from './sprites';

/** 冒険者の攻撃で、技の演出を振り下ろしのコマまで遅らせる tick 数（攻撃のコマ 0 構え・1 振り上げのあと） */
const ADV_STRIKE_LAG = 4;
/** その攻撃の記録が、冒険者の振る技か（演出を振り下ろしのコマに合わせるもの） */
function advStrike(eco: Ecology, r: { aid: number; style: string }): boolean {
  return eco.byId.get(r.aid)?.k === Kind.Adventurer && r.style !== 'grow' && r.style !== 'puff';
}

const MAX_SPRITES = 4096;

export interface CreatureFrame {
  sprites: Float32Array;
  nSprites: number;
  shadows: Float32Array;
  nShadows: number;
  dyn: Float32Array;
  nDyn: number;
}

/** 生き物の描き方（どのコマを、どこに、どれだけ浮かせて）を毎フレーム組み立てる */
/**
 * 名簿の見た目がわからない冒険者の既定の見た目（職ごと。戦士、魔法使い、盗賊、僧侶、吟遊詩人、狩人、竜殺しの順）。
 * 演出の見本の冒険者や、ロード直後で生前の姿を覚えていない亡骸・眷属・石像に使う。位は熟練（ADV_DEFAULT_RANK）
 */
const ADV_DEFAULT_LOOK = [packLook(1, 0, 0, 2, 0), packLook(4, 1, 3, 0, 1), packLook(0, 2, 5, 0, 0), packLook(2, 0, 1, 1, 1), packLook(3, 1, 4, 1, 0), packLook(5, 3, 2, 1, 0), packLook(0, 2, 0, 2, 1)];
const ADV_DEFAULT_RANK = 1;

export class CreatureView {
  /** 技の残した床の跡（描画専用） */
  private marks: { x: number; y: number; key: string; t: number }[] = [];
  private seenFx = new WeakSet<object>();
  private lunge = new Map<number, { t: number; ux: number; uy: number }>();
  /** 飛び散る粒（描画専用）：位置、高さ、速さ、種類、色、生まれた tick、寿命 */
  private bits: { x: number; y: number; z: number; vx: number; vy: number; vz: number; kind: number; col: number; t0: number; life: number }[] = [];
  private bitsTick = -1;
  /** 捕食の演出（drawEats が毎フレーム決める）：描かない獲物、くわえて振られている獲物の位置、跳ねるミミックの高さ */
  private eatHide = new Set<number>();
  private eatCarry = new Map<number, { x: number; y: number; lift: number }>();
  private eatHop = new Map<number, number>();
  /** 足につかんで運ばれている獲物（さらった者の id → 獲物の絵のコマと、さらってからの tick） */
  private eatClutch = new Map<number, { frame: number; age: number }>();
  /** 糸の繭を抱えて食べているクモ（クモの id → 繭の大きさ 0〜2 と、巻き始めてからの tick） */
  private eatCocoon = new Map<number, { v: number; age: number }>();
  /** 飲み込んだ獲物の膨らみ（ワームの id → 頭からの道のり px） */
  private wormBulge = new Map<number, number>();
  /** ワームの頭が岩の中にいたか（岩から床へ出た瞬間に土ぼこりを上げるため） */
  private wormInRock = new Map<number, boolean>();

  /**
   * 起きているワーム（描画専用）：頭の跡（eco.trails、14px ごとの点）をなぞって4px ごとに胴の節を重ね、頭の側を太く尾へ細くする。
   * 節は膨らみとくびれを交互に置いて環形の胴に見せ、飲み込んだ獲物の膨らみ（wormBulge）はその所を太くする。
   * 岩のマスにある部分は体を描かず、押し上げられて割れた岩（マスに一つ）にする。頭が岩の中なら大きく割れて土ぼこりが立ち、岩から床へ出た瞬間に土ぼこりと小石が散る
   */
  private drawWorm(eco: Ecology, A: Atlas, c: Cr, x: number, yy: number, t: number, push: (x: number, y: number, lift: number, flip: boolean, frame: number, glow: number, kind: number) => void): void {
    const m = eco.w.map;
    const tileAt = (px: number, py: number) => {
      const tx = Math.floor(px / 16);
      const ty = Math.floor(py / 16);
      return tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? -1 : ty * m.w + tx;
    };
    const rock = (k: number) => k < 0 || !!m.solid[k];
    const tr = eco.trails.get(c.id) ?? [];
    const pts: number[] = [x, yy];
    for (let i = 0; i + 1 < tr.length; i += 2) pts.push(tr[i], tr[i + 1]);
    const STEP = 4;
    const LMAX = 132;
    const samples: number[] = [];
    let base = 0;
    let next = 6;
    for (let i = 0; i + 3 < pts.length && next <= LMAX; i += 2) {
      const ax = pts[i];
      const ay = pts[i + 1];
      const L = Math.hypot(pts[i + 2] - ax, pts[i + 3] - ay);
      if (L < 0.01) continue;
      while (next <= base + L && next <= LMAX) {
        const u = (next - base) / L;
        samples.push(ax + (pts[i + 2] - ax) * u, ay + (pts[i + 3] - ay) * u, next);
        next += STEP;
      }
      base += L;
    }
    const flash = eco.w.tick - c.hitAt < 2 ? 20 : 0;
    const bulge = this.wormBulge.get(c.id);
    const mounds = new Set<number>();
    // 尾から頭へ（頭に近い節を手前に）
    for (let j = samples.length / 3 - 1; j >= 0; j--) {
      const sx = samples[j * 3];
      const sy = samples[j * 3 + 1];
      const s = samples[j * 3 + 2];
      const k = tileAt(sx, sy);
      if (rock(k)) {
        if (k >= 0 && !mounds.has(k)) {
          mounds.add(k);
          push(sx, sy + 3, 0, false, A.wormMound(k, false, m.hard[k]), 0, 5);
        }
        continue;
      }
      let r = 10 - (s / LMAX) * 6.5;
      if (j === samples.length / 3 - 1) r -= 1.5;
      if (bulge !== undefined && Math.abs(s - bulge) < 10) r += 3.5 * (1 - Math.abs(s - bulge) / 10);
      push(sx, sy + r * 0.8, 0, false, A.wormBody(r, Math.round(s / STEP) & 1), 0, flash);
    }
    // 頭：進む向き（頭と、少し後ろの跡の点から）。開いた口は、食べる時と、掘り進む間の噛みしめ
    let hx = 0;
    let hy = 0;
    for (let i = 2; i + 1 < pts.length; i += 2) {
      if (Math.hypot(pts[i] - x, pts[i + 1] - yy) > 3) {
        hx = x - pts[i];
        hy = yy - pts[i + 1];
        break;
      }
    }
    const d8 = hx || hy ? (Math.round(Math.atan2(hy, hx) / (Math.PI / 4)) + 8) % 8 : [2, 6, 0, 4][c.dir] ?? 2;
    const open = c.act === 2 ? [1, 2, 3, 2][Math.min(3, c.actT)] : c.act === 1 ? (Math.floor(t * 3 + c.id) & 1) : 0;
    const hk = tileAt(x, yy);
    const inRock = rock(hk);
    if (inRock) {
      push(x, yy + 4, 0, false, A.wormMound(hk + Math.floor(t * 2), true, hk >= 0 ? m.hard[hk] : 1), 0, 5 + flash);
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.9 + i / 3) % 1;
        push(x + Math.cos(i * 2.1 + t) * 9, yy + 2, 2 + ph * 10, false, A.dust(Math.min(3, Math.floor(ph * 4))), 0, 2);
      }
    } else push(x, yy + 10, 0, false, A.wormMouth(d8, open), 0, flash);
    // 岩から床へ出た瞬間：土ぼこりと小石
    const was = this.wormInRock.get(c.id);
    this.wormInRock.set(c.id, inRock);
    if (was && !inRock) {
      const now = eco.w.tick;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 6.283;
        this.bits.push({ x, y: yy + 4, z: 4, vx: Math.cos(a) * 1.1, vy: Math.sin(a) * 0.55, vz: i & 1 ? 0.5 : 2, kind: i & 1 ? 1 : 0, col: 0, t0: now, life: i & 1 ? 16 : 18 });
      }
    }
  }

  /** 死骸をかじった一口（食べる者の id → その一口の tick と、死骸への向き） */
  private bites = new Map<number, { t: number; step: number; ux: number; uy: number }>();

  /**
   * 捕食の演出（eco.fxEats と、死骸を食べている者から。すべて描画専用）。
   * 打ち合いで仕留めた獲物は、口にくわえて振り回してから地面に落とす。食べている間は、一口ごとに死骸へ頭を突っ込み、肉片や血のしずくが飛ぶ。
   * 一口で食べる場面：クモは獲物を糸の繭に巻いて食べ（食べるにつれて繭が細る）、ワームは獲物を口へ吸い込んで胴の膨らみが尾へ送られ、
   * ミミックは獲物を箱へ引き込んで閉じ、何度か跳ねる。ワイバーンとガーゴイルは、さらったコウモリを足につかんだまましばらく飛ぶ。
   * 肉でない獲物（ウィスプ・スライム・ゴースト・マイコニド）は、光の粒・しずく・白い靄・胞子になって散る
   */
  private drawEats(eco: Ecology, A: Atlas, inView: (x: number, y: number, m: number) => boolean, push: (x: number, y: number, lift: number, flip: boolean, frame: number, glow: number, kind: number) => void, dyn: { x: number; y: number; r: number; i: number; c?: number }[], alpha: number): void {
    const now = eco.w.tick;
    this.eatHide.clear();
    this.eatCarry.clear();
    this.eatHop.clear();
    this.eatClutch.clear();
    this.eatCocoon.clear();
    this.wormBulge.clear();
    const pos = (c: Cr): [number, number] => {
      const a = eco.moveAlpha(c, alpha);
      return [c.px + (c.x - c.px) * a, c.py + (c.y - c.py) * a];
    };
    const fxCol = (k: number) => [5, 5, 3, 6][BLOOD[k]] ?? -1;
    const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
    for (const e of eco.fxEats) {
      const age = now - e.t + alpha;
      if (age < 0 || age > 60 * 10) continue;
      const pred = eco.byId.get(e.by);
      const prey = eco.byId.get(e.id);
      const live = prey && prey.dead !== 2 ? prey : null;
      const px = live ? live.x : e.x;
      const py = live ? live.y : e.y;
      if (!inView(px, py, 60)) continue;
      if (e.bk === Kind.Spider) {
        // 糸の繭：巻いている間（最初の5秒）と、クモが食べている間
        const feeding = pred && !pred.dead && pred.feed === e.id && live && live.dead === 1;
        if (age > 50 && !feeding) continue;
        if (live) this.eatHide.add(e.id);
        const v = feeding && live!.init > 0 ? (live!.units > live!.init * 0.6 ? 0 : live!.units > live!.init * 0.25 ? 1 : 2) : age < 20 ? 0 : age < 36 ? 1 : 2;
        // 繭は、獲物に取りついたクモの体に隠れないよう、クモの絵の手前に重ねる（生き物を描く所で）
        if (pred && !pred.dead) this.eatCocoon.set(pred.id, { v, age });
        else push(px, py + 0.05, 4, false, A.fx(`cocoon:${v}`), 0, 2);
        continue;
      }
      if (e.bk === Kind.Worm && pred && !pred.dead) {
        const [wx, wy] = pos(pred);
        // 吸い込む：獲物が0.8秒かけて口へ引き寄せられる
        if (age < 8) {
          const p = age / 8;
          push(lerp(e.x, wx, p * p), lerp(e.y, wy, p * p) + 0.1, lerp(2, 10, p), lerp(e.x, wx, 1) < e.x, this.frameOf(e.k, e.sp, 0, 3, Math.min(3, Math.floor(age / 2)), 0, 0), 0, 3);
        }
        // 胴の膨らみ：頭から尾へ送られていく（drawWorm が、頭からこの道のりの所の節を太く描く）
        if (age >= 6 && age < 50) this.wormBulge.set(pred.id, (age - 6) * 3);
        continue;
      }
      if (e.bk === Kind.Mimic && pred && !pred.dead) {
        const [mx, my] = pos(pred);
        // 箱へ引き込み、閉じて三度跳ねる
        if (age < 5) push(lerp(e.x, mx, age / 5), lerp(e.y, my, age / 5) + 0.1, lerp(3, 6, age / 5), mx < e.x, this.frameOf(e.k, e.sp, 0, 3, 1, 0, 0), 0, 3);
        if (age < 30) this.eatHop.set(pred.id, Math.abs(Math.sin((age / 10) * Math.PI)) * 4 * (1 - age / 36));
        continue;
      }
      if ((e.bk === Kind.Wyvern || e.bk === Kind.Gargoyle) && pred && !pred.dead && age < 24) {
        // さらう：コウモリを足につかんで飛ぶ（2秒ほど。そのあいだ地面の死骸は描かない）
        // （さらった者の姿の上に重ねて描く。生き物を描く所で）
        if (live) this.eatHide.add(e.id);
        this.eatClutch.set(pred.id, { frame: this.frameOf(e.k, e.sp, 0, 3, 1, 0, 0), age });
        continue;
      }
      if (e.k === Kind.Wisp || e.k === Kind.Slime || e.k === Kind.Ghost || e.k === Kind.Myconid) {
        // 肉でない獲物は、食べられた所で散る
        if (age >= 16) continue;
        const p = age / 16;
        const f = Math.min(3, Math.floor(p * 4));
        for (let i = 0; i < 8; i++) {
          const a = i * 0.785 + (e.id % 7);
          const r = 2 + p * (e.k === Kind.Slime ? 9 : 7);
          const x = e.x + Math.cos(a) * r;
          const y = e.y + Math.sin(a) * r * 0.5;
          if (e.k === Kind.Wisp) push(x, y, 7 + p * 12 + (i % 3), false, A.speck(2, f), 0, 2);
          else if (e.k === Kind.Ghost) push(x, y, 8 + p * 16 + (i % 3), false, A.speck(0, f), 0, 2);
          else if (e.k === Kind.Myconid) push(x, y, 4 + p * 14 + (i % 4), false, A.speck(2, f), 0, 2);
          else push(x, y, Math.max(0, 5 + (i % 3) - p * p * 12), false, A.fx('bit:2:3:0'), 0, 4);
        }
        if (e.k === Kind.Wisp) dyn.push({ x: e.x, y: e.y - 8, r: 26, i: 0.5 * (1 - p) });
        continue;
      }
      // 打ち合いで仕留めた獲物：口にくわえて振り回し（1.2秒）、地面に落とす（0.4秒）
      if (e.slain && live && live.dead === 1 && pred && !pred.dead && pred.feed === e.id && age < 16) {
        const [ax, ay] = pos(pred);
        const bs = Ecology.bodySize(pred.k) || 6;
        const fwd = pred.dir === 2 ? 1 : pred.dir === 3 ? -1 : 0;
        const mx = ax + fwd * bs * 0.6;
        const my = ay + (pred.dir === 0 ? 2 : pred.dir === 1 ? -2 : 0) + 0.2;
        const ml = bs * 0.55 + 2;
        if (age < 12) {
          const sh = Math.sin(age * 2.2) * 2.5;
          this.eatCarry.set(e.id, { x: mx + sh, y: my, lift: ml + Math.abs(Math.cos(age * 2.2)) * 1.5 });
        } else {
          const p = (age - 12) / 4;
          this.eatCarry.set(e.id, { x: lerp(mx, live.x, p), y: lerp(my, live.y, p), lift: ml * (1 - p * p) });
        }
      }
    }
    // 食べている者の一口：死骸へ頭を突っ込み、肉片と血のしずくが飛ぶ（生き物の更新ごとに一度だけまく）
    for (const c of eco.list) {
      if (!c.feed || c.dead || c.act !== 2 || c.actT !== 0) continue;
      const d = eco.byId.get(c.feed);
      if (!d || d.dead !== 1 || !inView(d.x, d.y, 20)) continue;
      const b = this.bites.get(c.id);
      if (b && b.step === eco.step) continue;
      const L = Math.hypot(d.x - c.x, d.y - c.y) || 1;
      this.bites.set(c.id, { t: now, step: eco.step, ux: (d.x - c.x) / L, uy: (d.y - c.y) / L });
      if (c.k === Kind.Vampire) continue; // 肉片は飛ばさない（血を吸う流れは下で描く）
      const col = fxCol(d.k);
      if (col < 0) continue;
      for (let i = 0; i < 3; i++) {
        const a = ((eco.step * 7 + i * 13 + c.id) % 12) * 0.52;
        this.bits.push({ x: d.x, y: d.y, z: 3, vx: Math.cos(a) * 0.8, vy: Math.sin(a) * 0.4, vz: 1.3 + (i % 2) * 0.4, kind: 2, col, t0: now, life: 14 });
      }
      if (b && now - b.t < 40) continue;
      this.bits.push({ x: d.x, y: d.y, z: 3, vx: 0, vy: 0, vz: 1.8, kind: 0, col: 0, t0: now, life: 12 });
    }
    // ヴァンパイアは肉を食いちぎらず、血を吸う：食べている間ずっと、死骸から赤い粒が弧を描いて口へ流れ込む
    for (const c of eco.list) {
      if (c.k !== Kind.Vampire || !c.feed || c.dead) continue;
      const d = eco.byId.get(c.feed);
      if (!d || d.dead !== 1 || !inView(d.x, d.y, 30)) continue;
      const [vx, vy] = pos(c);
      for (let i = 0; i < 8; i++) {
        const p = ((now * 0.06 + i / 8) % 1 + 1) % 1;
        push(lerp(d.x, vx, p), lerp(d.y, vy, p) + 0.2, lerp(2, 15, p) + Math.sin(p * Math.PI) * 5, false, A.fx('bit:2:5:0'), 0, 4);
      }
    }
    for (const [id, b] of this.bites) {
      if (now - b.t > 60) this.bites.delete(id);
      else if (now - b.t <= 6 && !this.lunge.has(id)) this.lunge.set(id, { t: b.t, ux: b.ux, uy: b.uy });
    }
  }

  /** 苔とキノコの粒、石のかけらをまいた生き物の更新の通し番号（同じ更新の記録で二度まかないため） */
  private chewStep = -1;
  /** 食べる者が最後に苔やキノコのかけらをまいた tick（生き物の id ごと） */
  private chewAt = new Map<number, number>();
  /** ウィスプが苔の光を吸う粒（描画専用）：苔のあった所、吸った者の id、生まれた tick */
  private sips: { x: number; y: number; id: number; t0: number }[] = [];

  /**
   * 食べる一口と掘る一振りの演出（eco.fxBites と eco.fxDigs から。すべて描画専用）。
   * 苔やキノコを食べる者（大ネズミ・コボルト・コウモリ・ドワーフ・アリ・ゴブリンなど）は、一口ごとに口元から苔の緑やキノコの茶色のかけらがこぼれ、
   * ウィスプは、足元の苔から淡い光の粒を体へ吸い上げる。岩を掘る者（ドワーフ・コボルト）は、一振りごとに岩肌から石のかけらが跳ねて土ぼこりが舞い、
   * 掘り抜いた瞬間は、そのマスから石のかけらと土ぼこりが大きく弾ける。
   * 粒は、記録された生き物の更新ごとに一度だけまく（同じ者が毎回まくと多すぎるので、食べる者は前にまいてから6 tick 空け、掘る者は更新2回に1回）
   */
  private drawChews(eco: Ecology, A: Atlas, inView: (x: number, y: number, m: number) => boolean, push: (x: number, y: number, lift: number, flip: boolean, frame: number, glow: number, kind: number) => void, alpha: number): void {
    const now = eco.w.tick;
    const m = eco.w.map;
    if (eco.step !== this.chewStep) {
      // まだまいていない更新の記録だけ（ロードし直した直後などで番号が戻ったら、残っている分から）
      const from = this.chewStep > eco.step ? -1 : this.chewStep;
      this.chewStep = eco.step;
      const B = eco.fxBites;
      for (let i = 0; i < B.length; i += 4) {
        if (B[i] <= from) continue;
        const c = eco.byId.get(B[i + 1]);
        if (!c || c.dead || !inView(c.x, c.y, 20)) continue;
        const k = B[i + 2];
        if (c.k === Kind.Wisp) {
          // 苔の光を吸い上げる：まわりの苔から三つの光の粒
          for (let j = 0; j < 3; j++) {
            const a = ((B[i] * 5 + j * 7 + c.id) % 12) * 0.52;
            this.sips.push({ x: (k % m.w) * 16 + 8 + Math.cos(a) * 7, y: Math.floor(k / m.w) * 16 + 8 + Math.sin(a) * 4, id: c.id, t0: now });
          }
          continue;
        }
        // 同じ者が毎回まくと多すぎるので、前にまいてから6 tick（生き物の更新3回）は空ける
        // （ロードし直して時間が戻ったときは、前の記録を無視する）
        const last = this.chewAt.get(c.id);
        if (last !== undefined && now >= last && now - last < 6) continue;
        this.chewAt.set(c.id, now);
        const bs = Ecology.bodySize(c.k) || 6;
        const fx = c.dir === 2 ? 1 : c.dir === 3 ? -1 : 0;
        const mx = c.x + fx * bs * 0.45;
        const my = c.y + (c.dir === 0 ? 2 : c.dir === 1 ? -2 : 0);
        const col = B[i + 3] === 1 ? 1 : 3;
        for (let j = 0; j < 3; j++) {
          const a = ((B[i] * 7 + j * 5 + c.id) % 12) * 0.52;
          this.bits.push({ x: mx, y: my + 1, z: 2 + bs * 0.25, vx: Math.cos(a) * 0.7 + fx * 0.3, vy: Math.sin(a) * 0.35, vz: 1.3 + j * 0.3, kind: 2, col, t0: now, life: 14 });
        }
      }
      if (this.chewAt.size > 300) for (const [id, t0] of this.chewAt) if (now - t0 > 60 || now < t0) this.chewAt.delete(id);
      const D = eco.fxDigs;
      for (let i = 0; i < D.length; i += 4) {
        if (D[i] <= from) continue;
        const c = eco.byId.get(D[i + 1]);
        const k = D[i + 2];
        const tx = (k % m.w) * 16 + 8;
        const ty = Math.floor(k / m.w) * 16 + 8;
        if (!inView(tx, ty, 20)) continue;
        const cx = c ? c.x : tx;
        const cy = c ? c.y : ty + 16;
        const L = Math.hypot(cx - tx, cy - ty) || 1;
        const ux = (cx - tx) / L;
        const uy = (cy - ty) / L;
        // 岩肌：岩のマスの、掘る者の側の縁
        const fx = tx + ux * 8;
        const fy = ty + uy * 8;
        if (D[i + 3] === 1) {
          // 掘り抜いた：マスの中から、石のかけらと土ぼこりが四方へ弾ける
          for (let j = 0; j < 12; j++) {
            const a = (j / 12) * 6.283;
            this.bits.push({ x: tx + Math.cos(a) * 3, y: ty + 4 + Math.sin(a) * 2, z: 4, vx: Math.cos(a) * 1.1, vy: Math.sin(a) * 0.55, vz: j & 1 ? 0.5 : 2.2, kind: j & 1 ? 1 : 0, col: 0, t0: now, life: j & 1 ? 18 : 20 });
          }
          continue;
        }
        if (!c || (D[i] + c.id) % 2) continue;
        // 一振り：岩肌から、掘る者の体の外まで石のかけらが三つ跳ね、土ぼこりが二つ舞う
        for (let j = 0; j < 3; j++) {
          const s = ((D[i] * 3 + j * 5 + c.id) % 7) / 7 - 0.5;
          this.bits.push({ x: fx, y: fy, z: 7, vx: ux * 0.9 - uy * s * 2.2, vy: uy * 0.45 + ux * s * 1.1, vz: 1.6 + j * 0.4, kind: 0, col: 0, t0: now, life: 18 });
        }
        for (let j = 0; j < 2; j++) this.bits.push({ x: fx - uy * (j ? 4 : -4), y: fy + 1, z: 5, vx: ux * 0.5 - uy * (j ? 0.5 : -0.5), vy: uy * 0.25, vz: 0.5, kind: 1, col: 0, t0: now, life: 16 });
      }
    }
    // 吸い上げられる光の粒：1秒ほどかけて、床から浮かぶウィスプの体へ
    if (this.sips.length) {
      this.sips = this.sips.filter((s) => now >= s.t0 && now - s.t0 < 10);
      for (const s of this.sips) {
        const c = eco.byId.get(s.id);
        if (!c || c.dead || !inView(s.x, s.y, 20)) continue;
        const p = Math.min(1, (now - s.t0 + alpha) / 10);
        const e = p * p;
        push(s.x + (c.x - s.x) * e, s.y + (c.y - s.y) * e + 0.2, e * 8, false, A.speck(2, p < 0.7 ? 0 : 1), 0.6, 2);
      }
    }
  }

  /**
   * 攻撃の技の演出：記録（eco.fxAttacks）ごとに、技の種類に応じて部品を組み合わせて描く。
   * 振り（斬る、荒い振り、突く、刺す）は打つ側の前に軌跡、噛む・爪は受ける側に跡、殴るは一拍ためてから土ぼこりと弾ける光と床のひび、
   * 矢と魔法の弾は飛んでいってから当たる、光線は二者のあいだを結ぶ、吸うは赤い粒が打つ側へ吸い込まれる、
   * 冷たい手は霜、溶かすはしぶきと溶け跡、胞子は緑の粉。強い一撃は大きく、とどめは白い大きな光と一瞬の明るさ
   */
  private drawAttacks(eco: Ecology, A: Atlas, inView: (x: number, y: number, m: number) => boolean, push: (x: number, y: number, lift: number, flip: boolean, frame: number, glow: number, kind: number) => void, dyn: { x: number; y: number; r: number; i: number; c?: number }[]): void {
    const now = eco.w.tick;
    for (const r of eco.fxAttacks) {
      const age = now - r.t - (advStrike(eco, r) ? ADV_STRIKE_LAG : 0);
      if (age < 0 || age > 24) continue;
      if (!inView(r.dx, r.dy, 60) && !inView(r.ax, r.ay, 60)) continue;
      const vx = r.dx - r.ax;
      const vy = r.dy - r.ay;
      const dist = Math.hypot(vx, vy) || 1;
      const ux = vx / dist;
      const uy = vy / dist;
      const flip = vx < 0;
      const sz = Math.min(2, r.size + (r.big ? 1 : 0));
      const f3 = (a: number, per: number) => Math.min(2, Math.floor(a / per));
      const lift = 9;
      // 当たる時（飛ぶものは届くまでの時間）
      const fly = r.style === 'arrow' || r.style === 'orb' || r.style === 'bats' ? Math.max(3, Math.min(9, Math.round(dist / 12))) : r.style === 'smash' || r.style === 'charge' ? 2 : r.style === 'rune' ? 3 : 0;
      const hitAge = age - fly;
      const once = !this.seenFx.has(r) && hitAge >= 0;
      if (once) this.seenFx.add(r);
      // （すでに明るい場所では控えめに。打たれた側の体が白く飛ばないように）
      const bright = Math.min(1, eco.lit(Math.floor(r.dy / 16) * eco.w.map.w + Math.floor(r.dx / 16), eco.w.dayNow()));
      const damp = 1 - bright * 0.7;
      const f6 = (a: number) => Math.max(0, Math.min(5, a));
      // 粒をまく（当たった最初の一度だけ）。kind 0 石のかけら、1 土ぼこり、2 しずく、3 氷のかけら、4 火花
      const spray = (kind: number, col: number, n: number, sp: number, up: number) => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 6.283 + (r.t % 7);
          const k2 = 0.6 + ((i * 37 + r.t) % 10) / 12;
          this.bits.push({ x: r.dx, y: r.dy, z: lift - 2, vx: Math.cos(a) * sp * k2 + ux * sp * 0.6, vy: Math.sin(a) * sp * 0.5 * k2, vz: up * k2, kind, col, t0: now, life: kind === 1 ? 14 : kind === 4 ? 8 : 18 });
        }
      };
      switch (r.style) {
        case 'slash':
        case 'jag':
        case 'stab':
        case 'sting': {
          const ss = r.style === 'slash' ? sz : r.style === 'jag' ? Math.max(1, sz) : 0;
          if (age < 6) push(r.ax + ux * (6 + ss * 3), r.ay + uy * 4, lift, flip, A.fx(`slash2:${ss}:${r.col}:${f6(age)}`), 0, 4);
          if (r.style === 'stab' && age >= 3 && age < 9) push(r.ax + ux * 8, r.ay + uy * 4 + 2, lift - 2, flip, A.fx(`slash2:0:${r.col}:${f6(age - 3)}`), 0, 4);
          if (once) {
            if (r.style === 'sting') spray(2, r.col, 5, 1.2, 1.6);
            else if (r.style === 'jag') spray(0, 6, 4, 1.1, 1.8);
            else spray(4, 0, r.big ? 5 : 3, 1.4, 1.2);
          }
          break;
        }
        case 'bite':
          if (age < 6) push(r.dx, r.dy, lift, flip, A.fx(`bite2:${sz >= 1 ? 1 : 0}:${f6(age)}`), 0, 4);
          if (once) spray(r.col === 6 ? 0 : 2, 5, r.col === 6 ? 6 : 3, 1.1, 1.6);
          break;
        case 'claw':
          if (age < 6) push(r.dx, r.dy, lift, flip, A.fx(`claw2:${r.col}:${f6(age)}`), 0, 4);
          if (once) spray(2, 5, 3, 1.0, 1.4);
          break;
        case 'smash':
          if (hitAge >= 0 && hitAge < 6) push(r.dx, r.dy + 3, 1, false, A.fx(`ring:${sz}:${r.col}:${f6(hitAge)}`), 0, 4);
          if (once) {
            spray(0, 6, 4 + sz * 2, 1.0 + sz * 0.3, 2.2);
            spray(1, 0, 3 + sz, 0.6, 0.5);
            if (sz >= 2) this.marks.push({ x: r.dx, y: r.dy + 3, key: `crack:${r.t % 3}`, t: now });
          }
          break;
        case 'breath':
          break;
        case 'puff':
          // 幼竜の煙の息の練習：口元から灰色の煙の塊がふわりと出る
          if (once) for (let i = 0; i < 4; i++) this.bits.push({ x: r.dx + ux * i * 2, y: r.dy, z: 10 + i, vx: ux * 0.5 + (i - 1.5) * 0.1, vy: 0, vz: 0.25, kind: 1, col: 0, t0: now, life: 16 });
          break;
        case 'grow':
          // 竜が育った瞬間：紫のマナの光が集まって弾け、古い鱗がはがれ落ちる
          if (age < 6) push(r.dx, r.dy, 16, false, A.fx(`blast:2:4:${f6(5 - age)}`), 0, 4);
          if (age >= 4 && age < 10) push(r.dx, r.dy + 3, 1, false, A.fx(`ring:2:4:${f6(age - 4)}`), 0, 4);
          if (age < 8) dyn.push({ x: r.dx, y: r.dy - 16, r: 70, i: 0.6 * damp * (1 - age / 8), c: 2 });
          if (once) spray(2, 5, 10, 1.4, 2.2);
          break;
        case 'arrow':
        case 'orb':
          if (hitAge < 0) {
            const p = age / fly;
            const x = r.ax + vx * p;
            const y = r.ay + vy * p;
            if (r.style === 'arrow') {
              const d8 = (Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8;
              push(x, y, lift + Math.sin(p * Math.PI) * 6, false, A.fx(`arrow2:${d8}`), 0, 4);
            } else {
              push(x, y, lift + 2, false, A.fx(`orb2:${r.col}:${age & 3}`), 0, 4);
              // 弾の通ったあとに、薄れていく小さな粒
              if (age > 0) push(x - vx / fly, y - vy / fly, lift + 2, false, A.fx(`bit:4:${r.col}:${2}`), 0, 4);
              dyn.push({ x, y: y - lift, r: 22 + sz * 6, i: 0.3 * damp, c: r.col === 2 ? 1 : 2 });
            }
          } else if (hitAge < 6) {
            if (r.style === 'arrow') push(r.dx, r.dy, lift, false, A.fx(`ring:0:0:${f6(hitAge)}`), 0, 4);
            else push(r.dx, r.dy, lift, false, A.fx(`blast:${sz}:${r.col}:${f6(hitAge)}`), 0, 4);
          }
          if (once) spray(4, r.col, r.style === 'arrow' ? 3 : 5, 1.3, 1.4);
          break;
        case 'beam':
          if (age < 7) {
            for (let i = 1; i < dist / 5; i++) push(r.ax + ux * i * 5, r.ay + uy * i * 5, lift + 2, false, A.fx(`bit:0:6:${0}`), 0, 4);
            if (age >= 2) push(r.dx, r.dy, lift, false, A.fx(`ring:1:6:${f6(age - 2)}`), 0, 4);
          }
          if (once) spray(1, 0, 3, 0.5, 0.6);
          break;
        case 'drain':
          if (age < 6) push(r.dx, r.dy, lift, flip, A.fx(`claw2:${r.col}:${f6(age)}`), 0, 4);
          if (age >= 2 && age < 14)
            for (let i = 0; i < 3; i++) {
              const p = Math.min(1, (age - 2 - i * 2) / 8);
              if (p < 0) continue;
              push(r.dx - vx * p, r.dy - vy * p, lift + Math.sin(p * Math.PI) * 4, false, A.fx(`bit:2:5:0`), 0, 4);
            }
          break;
        case 'chill':
          if (age < 6) push(r.dx, r.dy, lift, false, A.fx(`blast:1:7:${f6(age)}`), 0, 4);
          if (once) {
            spray(3, 7, 5, 1.0, 1.6);
            this.marks.push({ x: r.dx, y: r.dy + 3, key: `stain:2:${r.t % 3}`, t: now });
          }
          break;
        case 'acid':
          if (age < 6) push(r.dx, r.dy, lift - 2, false, A.fx(`blast:0:3:${f6(age)}`), 0, 4);
          if (once) {
            spray(2, 3, 6, 1.1, 1.8);
            this.marks.push({ x: r.dx, y: r.dy + 3, key: `stain:0:${r.t % 3}`, t: now });
          }
          break;
        case 'charge':
          // ミノタウロスの突進：打つ側から相手まで砂ぼこりの帯が走り、当たった所に大きな衝撃の輪
          if (age < 5)
            for (let i = 0; i < 5; i++) {
              const p = Math.min(1, (age + 1) / 4) * (i / 5);
              push(r.ax + vx * p, r.ay + vy * p + 2, 1 + (i % 2), false, A.fx(`bit:1:0:${Math.min(3, (age + i) >> 1)}`), 0, 4);
            }
          if (hitAge >= 0 && hitAge < 6) push(r.dx, r.dy + 3, 1, false, A.fx(`ring:2:6:${f6(hitAge)}`), 0, 4);
          if (once) {
            spray(0, 6, 7, 1.6, 2.2);
            spray(1, 0, 5, 0.8, 0.6);
          }
          break;
        case 'rune':
          // ゴーレム：体の紋様が紫に光ってから、振り下ろす
          if (age < 3) {
            push(r.ax, r.ay - 4, 14, false, A.fx(`orb2:4:${age & 3}`), 0, 4);
            dyn.push({ x: r.ax, y: r.ay - 18, r: 30, i: 0.45 * damp, c: 2 });
          }
          if (hitAge >= 0 && hitAge < 6) {
            push(r.dx, r.dy + 3, 1, false, A.fx(`ring:2:4:${f6(hitAge)}`), 0, 4);
            push(r.dx, r.dy, lift, false, A.fx(`blast:1:4:${f6(hitAge)}`), 0, 4);
          }
          if (once) {
            spray(0, 6, 6, 1.2, 2.0);
            this.marks.push({ x: r.dx, y: r.dy + 3, key: `crack:${r.t % 3}`, t: now });
          }
          break;
        case 'bats':
          // ヴァンパイア：小さなコウモリの群れを放ち、群れが相手に取りついて血を吸い、赤い粒が戻ってくる
          if (hitAge < 0)
            for (let i = 0; i < 3; i++) {
              const p = Math.max(0, Math.min(1, (age - i * 0.6) / fly));
              const wob = Math.sin(age * 1.7 + i * 2) * 5;
              push(r.ax + vx * p - uy * wob, r.ay + vy * p + ux * wob, lift + 4 + Math.sin(p * Math.PI) * 6, vx < 0, A.index(1, 2, 1, (age + i) & 3), 0, 4);
            }
          else if (hitAge < 6) {
            push(r.dx, r.dy, lift, flip, A.fx(`claw2:5:${f6(hitAge)}`), 0, 4);
            for (let i = 0; i < 3; i++) push(r.dx + Math.cos(hitAge + i * 2.1) * 6, r.dy, lift + 6 + Math.sin(hitAge + i * 2.1) * 3, i % 2 === 0, A.index(1, 2, 1, (hitAge + i) & 3), 0, 4);
          }
          if (hitAge >= 4 && hitAge < 14)
            for (let i = 0; i < 3; i++) {
              const p = Math.min(1, (hitAge - 4 - i * 2) / 7);
              if (p < 0) continue;
              push(r.dx - vx * p, r.dy - vy * p, lift + Math.sin(p * Math.PI) * 4, false, A.fx(`bit:2:5:0`), 0, 4);
            }
          break;
        case 'mimic':
          // ミミック：宝箱の蓋が閉じる勢いの噛みつきで、金貨のかけらが散る
          if (age < 6) push(r.dx, r.dy, lift, flip, A.fx(`bite2:1:${f6(age)}`), 0, 4);
          if (once) spray(2, 1, 6, 1.3, 2.0);
          break;
        case 'spore':
          if (once) spray(1, 0, 5, 0.5, 0.7);
          if (age < 9) for (let i = 0; i < 5; i++) push(r.dx + Math.cos(i * 1.3) * age, r.dy, lift + Math.sin(i * 1.3) * age * 0.6 + age * 0.4, false, A.speck(2, Math.min(3, age >> 1)), 0, 4);
          break;
      }
      // 当たった瞬間、どの技でも一瞬まわりを技の色で照らす（暗がりの戦いが遠くからでも分かるように）
      if (hitAge >= 0 && hitAge < 3) {
        const lc = [3, 4, 1, 5, 2, 6, 3, 7][r.col] ?? 3;
        dyn.push({ x: r.dx, y: r.dy - lift, r: 24 + sz * 8 + (r.big ? 8 : 0), i: (0.42 + (r.big ? 0.15 : 0)) * damp * (1 - hitAge / 3), c: lc });
      }
      // とどめ：大きな衝撃の輪と、飛び散る火花と、一瞬の明るさ
      if (r.kill && hitAge >= 0 && hitAge < 6) {
        push(r.dx, r.dy + 2, 1, false, A.fx(`ring:2:${r.col === 6 ? 6 : 0}:${f6(hitAge)}`), 0, 4);
        if (hitAge < 3) dyn.push({ x: r.dx, y: r.dy - lift, r: 48, i: (0.55 - hitAge * 0.17) * damp, c: 3 });
        if (once) spray(4, 0, 7, 1.8, 1.8);
      }
    }
  }
  /** 生き物ごとの、いちばん新しい当たった印（のけぞりのため） */
  private lastHit = new Map<number, { t: number; ax: number; ay: number }>();
  /** ウィスプの通った跡（描画専用） */
  private trails = new Map<number, [number, number, number][]>();
  private out: CreatureFrame = {
    sprites: new Float32Array(MAX_SPRITES * 12),
    nSprites: 0,
    shadows: new Float32Array(MAX_SPRITES * 4),
    nShadows: 0,
    dyn: new Float32Array(MAX_DYN * 4),
    nDyn: 0,
  };
  private order: { y: number; c: Cr; x: number; yy: number }[] = [];

  /** 幼竜と若い竜が左を向いているか（生き物の id ごと）。描画だけの記憶で、セーブしない */
  private youngFaceL = new Map<number, boolean>();
  /**
   * 名簿の冒険者の姿と位を、生き物の番号ごとに覚えておく（描画専用。セーブしない）。
   * 倒れた冒険者は次の生き物の更新で名簿から外れる（src/eco/roster.ts の rosterStep）ので、そのあとの倒れる動き・亡骸・眷属を、生前の姿のまま描くため
   */
  private heroLooks = new Map<number, { look: number; rank: number }>();
  private heroLooksEco: Ecology | null = null;

  /** 冒険者の姿と位：名簿の人 → 覚えている生前の姿 → 倒れた所の墓標（ロード直後の亡骸） → 職ごとの既定の見た目 */
  private advLook(eco: Ecology, c: Cr, job: number): { look: number; rank: number } {
    if (this.heroLooksEco !== eco) {
      this.heroLooks.clear();
      this.heroLooksEco = eco;
    }
    const h = c.k === Kind.Adventurer ? eco.heroOf(c) : eco.roster.find((q) => q.cid === c.id);
    if (h) {
      const m = this.heroLooks.get(c.id);
      if (!m || m.look !== h.look || m.rank !== h.rank) this.heroLooks.set(c.id, { look: h.look, rank: h.rank });
      return h;
    }
    const m = this.heroLooks.get(c.id);
    if (m) return m;
    if (c.dead) {
      const g = eco.graves.find((q) => q.job === job && Math.abs(q.x - c.x) < 16 && Math.abs(q.y - c.y) < 16);
      if (g) {
        const r = { look: g.look, rank: g.rank };
        this.heroLooks.set(c.id, r);
        return r;
      }
    }
    return { look: ADV_DEFAULT_LOOK[job] ?? ADV_DEFAULT_LOOK[0], rank: ADV_DEFAULT_RANK };
  }

  /** 覚えている姿のうち、もういない生き物の分を捨てる */
  private pruneHeroLooks(eco: Ecology): void {
    if (this.heroLooks.size < 64) return;
    for (const id of [...this.heroLooks.keys()]) if (!eco.byId.has(id)) this.heroLooks.delete(id);
  }
  constructor(private atlas: Atlas) {}

  /** 種・向き・動作・コマから、アトラスのコマ番号を引く */
  private frameOf(sp: number, orig: number, dir: number, act: number, f: number, bright: number, v: number): number {
    const A = this.atlas;
    switch (sp) {
      case Kind.Slime: return A.named('slime', dir, act, f, v);
      case Kind.Zombie: return A.named(orig === Kind.Lizard ? 'zlizard' : 'zrat', dir, act, f);
      case Kind.Ghost: return A.named('ghost', dir, act, f);
      case Kind.Myconid: return A.named('myconid', dir, act, f);
      case Kind.Ant: return A.named('ant', dir, act, f, v);
      case Kind.Kobold: return A.named('kobold', dir, act, f);
      case Kind.Salamander: return A.named('salamander', dir, act, f);
      case Kind.Goblin: return A.named('goblin', dir, act, f, v);
      case Kind.Orc: return A.named('orc', dir, act, f, v);
      case Kind.Lizardman: return A.named('lizardman', dir, act, f);
      case Kind.Minotaur: return A.named('minotaur', dir, act, f);
      case Kind.Troll: return A.named('troll', dir, act, f);
      case Kind.Basilisk: return A.named('basilisk', dir, act, f);
      case Kind.Gargoyle: return A.named('gargoyle', dir, act, f);
      case Kind.Vampire: return A.named('vampire', dir, act, f);
      case Kind.Mimic: return A.named('mimic', dir, act, f);
      case Kind.Golem: return A.named('golem', dir, act, f);
      case Kind.Worm: return A.named('worm', dir, act, f);
      case Kind.Wyvern: return A.named('wyvern', dir, act, f);
      case Kind.Dragon: return A.named(['dragonH', 'dragonY', 'dragon', 'dragonB'][Math.min(3, orig)], dir, act, f, v);
      // 姿のわからない冒険者（石像、丸のみにされる獲物など）：職ごとの既定の見た目（orig が職）
      case Kind.Adventurer: return A.hero(orig, false, ADV_DEFAULT_LOOK[orig] ?? ADV_DEFAULT_LOOK[0], ADV_DEFAULT_RANK, dir, act, f);
      case Kind.Skeleton: return A.named('skel', dir, act, f, v);
      case Kind.Lich: return A.named('lich', dir, act, f);
      case Kind.Dwarf: return A.named('dwarf', dir, act, f, v);
      case Kind.Armor: return A.named('armor', dir, act, f, v);
      case Kind.Rat: return v === 1 ? A.named('pup', dir, act === 1 ? 1 : 0, f) : A.index(sp, dir, act, f, bright);
      default: return A.index(sp, dir, act, f, bright);
    }
  }

  /**
   * リビングアーマーの武具の置き方（描画専用）：取り込んだ武器と盾が、芯（宙に浮く胸当てと冑）の周りをゆっくり巡る。
   * 体になった武具は芯に溶け込んでいるので描かない（誕生のとき、芯へ寄り集まる演出で見せる）。
   * 攻めるときは、最初に取り込んだ武具が向いている方へ飛び出して戻る。front は芯より手前に描くか
   */
  private armorGear(eco: Ecology, A: Atlas, c: Cr, x: number, y: number, lift: number, t: number): { x: number; y: number; lift: number; flip: boolean; frame: number; front: boolean }[] {
    const kit = eco.armorKit.get(c.id) ?? [0];
    const hand = kit.slice(1 + kit[0]);
    const out: { x: number; y: number; lift: number; flip: boolean; frame: number; front: boolean }[] = [];
    const ph = c.id * 0.731;
    const n = hand.length;
    const dir = [[0, 1], [0, -1], [1, 0], [-1, 0]][c.dir] ?? [0, 1];
    const fly = c.act === 2 && c.actT < 4 ? [5, 11, 15, 8][c.actT] : 0;
    hand.forEach((kd, i) => {
      const a = t * 0.9 + (i * 6.2832) / n + ph;
      const s = Math.sin(a);
      let gx = x + Math.cos(a) * 13;
      let gy = y + s * 4;
      let gl = lift + 10 + Math.sin(t * 2.1 + i * 1.7) * 1.5;
      let front = s >= 0;
      if (i === 0 && fly) {
        gx = x + dir[0] * fly;
        gy = y + dir[1] * fly * 0.6 + 0.1;
        gl = lift + 9;
        front = true;
      }
      out.push({ x: gx, y: gy + (front ? 0.08 : -0.08), lift: gl, flip: Math.cos(a) < 0, frame: A.item(kd, Math.floor(t * 6) + i), front });
    });
    return out;
  }

  build(eco: Ecology, view: { x0: number; y0: number; x1: number; y1: number }, t: number, alpha: number, night: boolean): CreatureFrame {
    const o = this.out;
    o.nSprites = 0;
    o.nShadows = 0;
    o.nDyn = 0;
    const A = this.atlas;
    const pushSprite = (x: number, y: number, lift: number, flip: boolean, frame: number, glow: number, kind: number, phase = 0) => {
      // 閉じた空洞の中にあるものは、岩越しに暗く見える
      {
        const mm = eco.w.map;
        const tk = Math.floor((y - 2) / 16) * mm.w + Math.floor(x / 16);
        // （すでに暗く描くもの＝隠れている生き物には重ねない。kind の 20 は傷の光なので、足して 20 にならないように）
        if (tk >= 0 && tk < mm.sealed.length && mm.sealed[tk] && kind % 20 < 9.5) kind += 10;
      }
      if (o.nSprites >= MAX_SPRITES) return;
      const fr = A.frames[frame];
      const k = o.nSprites * 12;
      o.sprites[k] = x;
      o.sprites[k + 1] = y;
      o.sprites[k + 2] = lift;
      o.sprites[k + 3] = flip ? 1 : 0;
      o.sprites[k + 4] = fr.x;
      o.sprites[k + 5] = fr.y;
      o.sprites[k + 6] = fr.w;
      o.sprites[k + 7] = fr.h;
      o.sprites[k + 8] = fr.ax;
      o.sprites[k + 9] = fr.ay;
      o.sprites[k + 10] = glow;
      o.sprites[k + 11] = kind + phase * 0.99;
      o.nSprites++;
    };
    const inView = (x: number, y: number, m: number) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m + 40;

    // 地面のもの（巣穴、クモの巣）
    // 大ネズミの巣穴：引っ越しの列の先頭が新しい巣穴に着くまでは、古い場所に穴を描く（描画専用。fxMarch）
    for (const b of eco.burrows) {
      let bx = b.x;
      let by = b.y;
      const mv = eco.fxMarch.find((e) => e.tx === b.x && e.ty === b.y && eco.w.tick - e.t < 3600);
      if (mv) {
        const lead = eco.list.find((c) => c.k === 2 && !c.dead && c.st === 11 && c.ref2 === 0 && c.hx === b.x && c.hy === b.y);
        if (lead && (lead.x - b.x) ** 2 + (lead.y - b.y) ** 2 > 24 * 24) {
          bx = mv.x;
          by = mv.y;
        }
      }
      if (inView(bx, by, 16)) pushSprite(bx, by, 0, false, A.burrow, 0, 2);
    }
    // 物資の置き場：木箱と寝具（食料が減ると中身が減り、空になれば残骸）
    for (const o of eco.caches) if (inView(o.x, o.y, 24)) pushSprite(o.x, o.y + 6, 0, false, A.supply(o.food <= 0 ? 0 : o.food < 60 ? 1 : 2), 0, 2);
    // ヴァンパイアの住処：棺（昼は蓋が閉じて中で眠り、夜は蓋がずれて空）と、まわりに残る血の跡（src/eco/vampire.ts の vampCoffin）
    for (const v of eco.list) {
      if (v.k !== Kind.Vampire || v.dead || !(v.hx || v.hy) || !inView(v.hx, v.hy, 40)) continue;
      for (let i = 0; i < 5; i++) {
        const a = ((v.id * 7 + i * 37) % 100) / 100 * 6.283;
        const r = 10 + ((v.id + i * 13) % 9);
        pushSprite(v.hx + Math.cos(a) * r, v.hy + 4 + Math.sin(a) * r * 0.5, 0, i % 2 === 1, A.blood(0, (v.id + i) & 3), 0, 2);
      }
      pushSprite(v.hx, v.hy + 2, 0, false, A.coffin(v.st !== VAMP_COFFIN), 0, 2);
    }
    // コボルトの住処：畑の畝、奥の寝床、入口の飾り柱、罠
    for (const wr of eco.warrens) {
      if (wr.id < 0 || !inView(wr.x, wr.y, 96)) continue;
      const mw = eco.mapW;
      for (const k of eco.farmTiles(wr)) pushSprite((k % mw) * 16 + 8, Math.floor(k / mw) * 16 + 14, 0, false, A.furrow(eco.w.fungus[k] >= 80 ? 1 : 0), 0, 2);
      pushSprite(wr.x, wr.y + 5, 0, false, A.nest, 0, 2);
      // 蓄え：寝床の脇に積んだキノコの山（蓄えの目安に対する割合で三段階。尽きれば消える）
      const ws = wr.store ?? 0;
      if (ws > 0) {
        const fr = ws / Math.max(1, eco.storeGoal(wr));
        pushSprite(wr.x + 11, wr.y + 7, 0, false, A.larder(0, fr >= 0.67 ? 2 : fr >= 0.34 ? 1 : 0), 0, 2);
      }
      const d = wr.door ?? -1;
      // 横穴の入口の脇（横穴と反対の側の、床の上）に飾り柱を立てる
      if (d >= 0) {
        const dx0 = (d % mw) * 16 + 8;
        const dy0 = Math.floor(d / mw) * 16 + 8;
        const vx = wr.x - dx0;
        const vy = wr.y - dy0;
        const ox = vx > 8 ? -7 : vx < -8 ? 7 : Math.abs(vy) > 8 ? 7 : 7;
        const oy = vy > 8 ? -3 : vy < -8 ? 3 : 0;
        pushSprite(dx0 + ox, dy0 + 6 + oy, 0, false, A.totem, 0, 0);
      }
    }
    for (const tr of eco.traps) {
      const tx = (tr.k % eco.mapW) * 16 + 8;
      const ty = Math.floor(tr.k / eco.mapW) * 16 + 11;
      if (inView(tx, ty, 16)) pushSprite(tx, ty, 0, false, A.trap, 0, 2);
    }
    for (const w of eco.webs) if (inView(w.x, w.y, w.r + 8)) pushSprite(w.x, w.y, 0, false, w.r >= 28 ? A.webBig : A.web, 0, 2);
    // 引き裂かれた巣（描画専用）：破れて垂れた巣が3秒ほど残って消え、裂けた瞬間に糸くずが舞う
    for (const tw of eco.fxWebTears) {
      const age = eco.w.tick - tw.t;
      if (age < 0 || age > 40 || !inView(tw.x, tw.y, tw.r + 8)) continue;
      if (age < 28 || (age & 1)) pushSprite(tw.x, tw.y + age * 0.08, 0, false, A.webTorn, 0, 2);
      if (age < 16)
        for (let i = 0; i < 8; i++) {
          const a = i * 0.785 + (tw.t % 5);
          const r = 6 + age * 1.2 + (i % 3) * 3;
          pushSprite(tw.x + Math.cos(a) * r, tw.y + Math.sin(a) * r * 0.6, 6 + Math.sin(age * 0.3 + i) * 3 - age * 0.3, false, A.fx('bit:3:7:0'), 0, 4);
        }
    }
    for (const c of eco.colonies) if (inView(c.x, c.y, 24)) pushSprite(c.x, c.y + 4, 0, false, A.anthill, 0, 2);
    for (const c of eco.camps) {
      if (!inView(c.x, c.y, 32)) continue;
      pushSprite(c.x, c.y + 6, 0, false, c.kind === 0 ? A.camp : A.hut, 0, 2);
      if (c.id < 0 || c.kind !== 0) continue;
      // ゴブリンの集落の蓄え：小屋の脇に積んだ肉と骨とキノコの山（三段階）
      const cs = c.store ?? 0;
      if (cs > 0) {
        const fr = cs / Math.max(1, eco.campStoreGoal(c));
        pushSprite(c.x - 20, c.y + 14, 0, false, A.larder(1, fr >= 0.67 ? 2 : fr >= 0.34 ? 1 : 0), 0, 2);
      }
      // オークに従う集落：小屋の後ろから、牙の印の赤い旗が突き出す（縄張りの印）
      if (c.lx || c.ly) pushSprite(c.x + 8, c.y + 1, 0, false, A.banner, 0, 0);
    }
    // ドワーフの鍛冶場と坑道のランプ
    {
      const mw = eco.w.map.w;
      const ff = Math.floor(t * 7);
      if (eco.hold && eco.hold.forge >= 0) {
        const k = eco.hold.forge;
        const x = (k % mw) * 16 + 8;
        const y = Math.floor(k / mw) * 16 + 14;
        if (inView(x, y, 40)) pushSprite(x, y, 0, false, A.forge(ff), 0, 2);
      }
      for (const cp of eco.camps) {
        if (cp.id < 0 || !(cp.fuel ?? 0)) continue;
        if (inView(cp.x, cp.y + 10, 24)) pushSprite(cp.x, cp.y + 14, 0, false, A.campfire(ff + cp.id), 0, 2);
      }
      for (const p of eco.parties) {
        const k = p.camp ?? -1;
        if (k < 0) continue;
        const x = (k % mw) * 16 + 8;
        const y = Math.floor(k / mw) * 16 + 12;
        if (inView(x, y, 20)) pushSprite(x, y, 0, false, A.campfire(ff + k), 0, 2);
      }
      for (const k of eco.lamps) {
        const x = (k % mw) * 16 + 8;
        const y = Math.floor(k / mw) * 16 + 4;
        if (inView(x, y, 16)) pushSprite(x, y, 6, false, A.lamp(ff + k), 0, 2);
      }
    }
    // 外とつながる口：地表の横穴の外（昼は日なた、夜は月明かり）、地底の裂け目と立ちのぼる光の粒、地下の川の口
    {
      const mm = eco.w.map;
      const night = eco.w.dayNow() < 0.2;
      const fr = Math.floor(t * 5);
      // 正面の入口：石の階段、柱とアーチ、かがり火
      {
        const gx = mm.entrance.x * 16 + 16;
        if (inView(gx, 24, 60)) pushSprite(gx, 0, 0, false, A.mouth(night ? 'gateNight' : 'gateDay', fr), 0, 2);
      }
      for (const mo of mm.mouths) {
        const x = mo.x * 16 + 8;
        const y = mo.y * 16 + 8;
        if (!inView(x, y, 48)) continue;
        if (mo.kind === 0 && mo.y === 0) pushSprite(x, 0, 0, false, A.mouth(night ? 'nightTop' : 'dayTop', fr), 0, 2);
        else if (mo.kind === 0) pushSprite(x, y + 8, 0, mo.x > 0, A.mouth(night ? 'night' : 'day', fr), 0, 2);
        else if (mo.kind === 1) {
          pushSprite(x, y + 6, 0, false, A.mouth('fissure', fr), 0, 2);
          for (let i = 0; i < 7; i++) {
            const age = (t * 0.35 + i / 7) % 1;
            const yy = y + 10 - Math.floor(age * 30) + ((i * 7) % 20) - 10;
            const xx = x + Math.sin(age * 6 + i) * 3 + ((i * 5) % 7) - 3;
            pushSprite(xx, yy, 6 + age * 10, false, A.mouth('mote', Math.floor(age * 4)), 0, 2);
          }
        } else pushSprite(x, y + 4, 0, false, A.mouth("inlet", fr), 0, 2);
      }
      // 卵
      for (const e of eco.eggs) if (inView(e.x, e.y, 16)) pushSprite(e.x, e.y, 0, false, A.mouth(e.k === 4 ? 'sac' : 'clutch', Math.floor(t * 2) + e.id), 0, 2);
    }
    // 見た目の粒（シミュレーションには関わらない。時刻から決まる）
    {
      const w = eco.w;
      const mm = w.map;
      const day = w.dayNow();
      const hsh = (a: number, b: number) => {
        let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
      };
      // 光の筋に舞う塵（昼）
      if (day > 0.15)
        for (let si = 0; si < mm.shafts.length; si++) {
          const sh = mm.shafts[si];
          const sx = sh.x * 16 + 8;
          const sy = sh.y * 16 + 8;
          if (!inView(sx, sy, 80)) continue;
          for (let i = 0; i < 12; i++) {
            const ph = (t * 0.05 + hsh(si, i)) % 1;
            const x = sx + (hsh(i, si + 7) - 0.5) * 26 + Math.sin(t * 0.6 + i) * 4;
            const y = sy - 30 + ph * 60;
            const fade = Math.floor((1 - Math.sin(ph * Math.PI) * day) * 3.99);
            pushSprite(x, y + 30, 30 - ph * 4, false, A.speck(0, fade), 0, 2);
          }
        }
      // 火の粉：焚き火、集落のかがり火、鍛冶場、燃えているマス、溶岩
      const embers = (x: number, y: number, n: number, seed: number, h: number) => {
        for (let i = 0; i < n; i++) {
          const ph = (t * 0.55 + hsh(seed, i)) % 1;
          const xx = x + (hsh(i, seed + 3) - 0.5) * 10 + Math.sin(t * 2 + i * 1.7) * (2 + ph * 4);
          pushSprite(xx, y, 2 + ph * h, false, A.speck(1, Math.floor(ph * 4)), 0, 2);
        }
      };
      for (const p of eco.parties) if ((p.camp ?? -1) >= 0) embers((p.camp! % mm.w) * 16 + 8, Math.floor(p.camp! / mm.w) * 16 + 12, 5, p.id, 26);
      // かがり火の火の粉は、燃料（集めた枯れキノコの軸）の多さで数と高さが変わる（尽きかけると細る）
      for (const cp of eco.camps) if (cp.id >= 0 && (cp.fuel ?? 0) > 0 && inView(cp.x, cp.y, 40)) embers(cp.x, cp.y + 14, Math.min(8, 1 + ((cp.fuel as number) >> 1)), cp.id, 14 + Math.min(12, cp.fuel as number) * 2);
      {
        const gx = mm.entrance.x * 16 + 16;
        if (inView(gx, 24, 60)) {
          embers(gx - 29, 38, 3, 901, 16);
          embers(gx + 28, 38, 3, 902, 16);
        }
      }
      if (eco.hold && eco.hold.forge >= 0) embers((eco.hold.forge % mm.w) * 16 + 8, Math.floor(eco.hold.forge / mm.w) * 16 + 10, 5, 77, 22);
      const vx0 = Math.max(0, Math.floor(view.x0 / 16));
      const vx1 = Math.min(mm.w - 1, Math.ceil(view.x1 / 16));
      const vy0 = Math.max(0, Math.floor(view.y0 / 16));
      const vy1 = Math.min(mm.h - 1, Math.ceil(view.y1 / 16));
      let budget = 160;
      for (let ty = vy0; ty <= vy1 && budget > 0; ty++)
        for (let tx = vx0; tx <= vx1 && budget > 0; tx++) {
          const k = ty * mm.w + tx;
          const r = hsh(k, 991);
          if (w.burn[k] > 0 && r < 0.6) {
            embers(tx * 16 + 8, ty * 16 + 12, 2, k, 24);
            budget -= 2;
          } else if (mm.lava[k] && r < 0.12) {
            embers(tx * 16 + 8, ty * 16 + 12, 1, k, 18);
            budget--;
          } else if (!mm.solid[k] && w.fungus[k] > 150 && r < 0.18) {
            // 豊かなキノコの群落から漂う胞子
            const ph = (t * 0.12 + hsh(k, 5)) % 1;
            pushSprite(tx * 16 + 8 + Math.sin(t * 0.7 + k) * 5 + ph * 6, ty * 16 + 12, 4 + ph * 18, false, A.speck(2, Math.floor((1 - Math.sin(ph * Math.PI)) * 3.99)), 0, 2);
            budget--;
          }
        }
      // 湧き水に落ちるしずく
      for (let si = 0; si < mm.springs.length; si++) {
        const sp = mm.springs[si];
        const x = sp.x * 16 + 8;
        const y = sp.y * 16 + 10;
        if (!inView(x, y, 30)) continue;
        for (let i = 0; i < 2; i++) {
          const ph = (t * 0.7 + hsh(si, i)) % 1;
          if (ph < 0.85) pushSprite(x + (hsh(i, si) - 0.5) * 8, y, 22 * (1 - ph / 0.85), false, A.speck(3, 0), 0, 2);
          else pushSprite(x + (hsh(i, si) - 0.5) * 8, y, 0, false, A.speck(3, Math.floor((ph - 0.85) / 0.15 * 4)), 0, 2);
        }
      }
    }
    const dyn: { x: number; y: number; r: number; i: number; c?: number }[] = [];
    // 当たった印（のけぞりのための記録）と、攻撃の技の演出。気づいた印：「！」「？」
    {
      // 冒険者の攻撃は4コマ（構え・振り上げ・振り下ろし・戻り。1コマは生き物の更新1回＝2 tick）なので、
      // 技の演出と打たれた側ののけぞりは振り下ろしのコマ（攻撃から4 tick 後）に、踏み込みはその手前の振り上げから始める（描画だけの遅れ）
      const hitLag = new Map<string, number>();
      for (const r of eco.fxAttacks) if (eco.w.tick - r.t <= 30 && advStrike(eco, r)) hitLag.set(r.t + ':' + r.did, ADV_STRIKE_LAG);
      this.lastHit.clear();
      for (const h of eco.fxHits) {
        const lag = hitLag.get(h.t + ':' + h.id) ?? 0;
        const age = eco.w.tick - h.t - lag;
        if (age < 0 || age > 8) continue;
        this.lastHit.set(h.id, lag ? { ...h, t: h.t + lag } : h);
      }
      this.lunge.clear();
      for (const r of eco.fxAttacks) {
        const lag = advStrike(eco, r) ? ADV_STRIKE_LAG - 2 : 0;
        if (eco.w.tick - r.t - lag > 6 || eco.w.tick - r.t - lag < 0) continue;
        const L = Math.hypot(r.dx - r.ax, r.dy - r.ay) || 1;
        if (r.style === 'arrow' || r.style === 'orb' || r.style === 'beam') continue;
        this.lunge.set(r.aid, { t: r.t + lag, ux: (r.dx - r.ax) / L, uy: (r.dy - r.ay) / L });
      }
      this.drawAttacks(eco, A, inView, pushSprite, dyn);
      this.drawEats(eco, A, inView, pushSprite, dyn, alpha);
      this.drawChews(eco, A, inView, pushSprite, alpha);
      // 粒を動かす（tick ごと）：石のかけらは跳ねて転がり、土ぼこりはふくらんで沈み、しずくと氷は落ち、火花は飛んで消える
      {
        const now2 = eco.w.tick;
        const steps = this.bitsTick < 0 ? 0 : Math.min(6, now2 - this.bitsTick);
        this.bitsTick = now2;
        for (let s2 = 0; s2 < steps; s2++)
          for (const b of this.bits) {
            b.x += b.vx;
            b.y += b.vy;
            b.z += b.vz;
            if (b.kind === 1) {
              b.vz = b.vz * 0.8 - 0.02;
              b.vx *= 0.85;
              b.vy *= 0.85;
            } else {
              b.vz -= b.kind === 4 ? 0.25 : 0.38;
              if (b.z < 0) {
                b.z = 0;
                b.vz = b.kind === 0 ? -b.vz * 0.35 : 0;
                b.vx *= 0.5;
                b.vy *= 0.5;
              }
            }
          }
        this.bits = this.bits.filter((b) => now2 - b.t0 < b.life);
        if (this.bits.length > 400) this.bits.splice(0, this.bits.length - 400);
        for (const b of this.bits) {
          if (!inView(b.x, b.y, 10)) continue;
          const age = now2 - b.t0;
          const f = b.kind === 1 ? Math.min(3, Math.floor((age / b.life) * 4)) : b.kind === 4 ? Math.min(3, Math.floor((age / b.life) * 4)) : 0;
          if (b.kind !== 1 && b.kind !== 4 && age > b.life * 0.7 && (age & 1)) continue;
          pushSprite(b.x, b.y, Math.max(0, b.z), false, A.fx(`bit:${b.kind}:${b.col}:${f}`), 0, 4);
        }
      }
      const byId = new Map<number, (typeof eco.list)[number]>();
      for (const c of eco.list) byId.set(c.id, c);
      const listening = new Set<number>();
      for (const p of eco.parties) if ((p.listenT ?? 0) > eco.step && (p.camp ?? -1) < 0) for (const id of p.members) listening.add(id);
      for (const mk of eco.fxMarks) {
        const age = eco.w.tick - mk.t;
        if (age > 18) continue;
        const c = byId.get(mk.id);
        if (!c || c.dead || !inView(c.x, c.y, 20)) continue;
        const pop = age < 3 ? age : 3;
        if (mk.m === '?' && listening.has(c.id)) continue;
        pushSprite(c.x + 5, c.y, 22 + pop + Ecology.bodySize(c.k) * 0.6, false, A.mark(mk.m), 0, 2);
      }
      // オークの威嚇（src/eco/orc.ts の orcWary、st 20）：唸って武器を打ち鳴らしているあいだずっと、頭の上に「！」が跳ねる
      for (const c of eco.list) {
        if (c.k !== Kind.Orc || c.st !== 20 || c.dead || !inView(c.x, c.y, 20)) continue;
        const hop = Math.abs(Math.sin(t * 9 + c.id)) * 2.5;
        pushSprite(c.x + 5, c.y, 24 + hop + Ecology.bodySize(c.k) * 0.6, false, A.mark('!'), 0, 2);
      }
      // 聞き耳の「？」：立ち止まって耳を澄ませているあいだずっと、皆の頭の上に（前は出た瞬間の2秒だけで、見落としやすかった）
      for (const id of listening) {
        const c = byId.get(id);
        if (!c || c.dead || c.sleep || !inView(c.x, c.y, 20)) continue;
        const bob = Math.round(Math.sin(t * 3 + id * 0.7) * 0.8);
        pushSprite(c.x + 5, c.y, 25 + bob + Ecology.bodySize(c.k) * 0.6, false, A.mark('?'), 0, 2);
      }
    }
    // 墓標（熟練以上の冒険者が倒れた所）
    for (const g of eco.graves) if (inView(g.x, g.y, 20)) pushSprite(g.x, g.y, 0, false, A.grave(g.rank, unpackLook(g.look).color), 0, 2);
    // 墓標か亡骸の前で祈る僧侶：墓標（亡骸）から光の粒が立ちのぼる（描画専用）
    for (const p of eco.parties) {
      if ((p.braceT ?? 0) <= eco.step || (p.braceK !== 4 && p.braceK !== 5)) continue;
      const pr = p.members.map((id) => eco.byId.get(id)).find((o) => o && !o.dead && o.sp === 3);
      if (!pr) continue;
      const gx = p.braceX ?? pr.x;
      const gy = p.braceY ?? pr.y;
      pushSprite(gx, gy - 0.05, 4, false, A.halo(1), 0, 2);
      // 聖印の光が二つ、ずれて立ちのぼって薄れる
      for (let i = 0; i < 2; i++) {
        const ph = (t * 0.45 + i * 0.5) % 1;
        pushSprite(gx + Math.sin(ph * 5 + i) * 2, gy, 18 + ph * 22, false, A.pray(Math.min(3, Math.floor(ph * 4))), 0, 2);
      }
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.5 + i / 5) % 1;
        pushSprite(gx + Math.sin(i * 2.1 + t * 1.3) * 6, gy, 4 + ph * 26, false, A.speck(1, Math.min(3, Math.floor(ph * 4))), 0, 2);
      }
      pushSprite(pr.x, pr.y, 30 + Math.sin(t * 2) * 1.5, false, A.pray(1), 0, 2);
    }
    // 幼竜が生まれた場所の卵の殻
    if (eco.dragonShell && eco.w.tick - eco.dragonShell.t >= 52 && eco.w.tick - eco.dragonShell.t < 14400 * 3 && inView(eco.dragonShell.x, eco.dragonShell.y, 20)) pushSprite(eco.dragonShell.x, eco.dragonShell.y, 0, false, A.eggShell(), 0, 2);
    // 血の跡（地面に描く）
    for (const b of eco.blood) if (inView(b.x, b.y, 8)) pushSprite(b.x, b.y, 0, false, A.blood(b.c, b.v), 0, 2);
    // 技の残した床の跡（ひび、溶け跡、霜。通常速度で数分かけて消える）
    this.marks = this.marks.filter((mk) => eco.w.tick - mk.t < 3000);
    for (const mk of this.marks) if (inView(mk.x, mk.y, 16) && ((eco.w.tick - mk.t) < 2000 || ((mk.x + mk.y + eco.w.tick) & 1))) pushSprite(mk.x, mk.y, 0, false, A.fx(mk.key), 0, 2);
    // 崩落の土ぼこり
    for (const ef of eco.effects) {
      const age = (eco.w.tick - ef.t) / 120;
      if (age < 0 || age > 1 || !inView(ef.x, ef.y, 60)) continue;
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39996;
        const r = (6 + (i % 5) * 7) * Math.min(1, age * 1.8);
        pushSprite(ef.x + Math.cos(a) * r * 1.3, ef.y + Math.sin(a) * r * 0.7 + 4, 4 + age * 10, false, A.dust(Math.min(3, Math.floor(age * 4 + (i % 2)))), 0, 2);
      }
    }
    // 床に落ちた道具（松明は燃え、金属は光が当たるときらめく）
    const itf = Math.floor(t * 6);
    for (const it of eco.gear) {
      if (!inView(it.x, it.y, 16)) continue;
      pushSprite(it.x, it.y + 2, 0, false, it.kind === 12 ? A.trophy(TROPHY[it.fuel]?.[1] ?? 'fang') : A.item(it.kind, itf + it.id), 0, 2);
      // マナ（持ち主の未練と、土から吸ったマナ）が宿った武具：青白い粒が立ちのぼる。甲冑が立ち上がる量に近づくほど頻く（src/eco/armor.ts）
      if (isJobItem(it.kind) && it.fuel > 0) {
        const ph = (t * 0.45 + it.id * 0.137) % 1;
        if (ph < Math.min(1, it.fuel / ARMOR_BIRTH_MANA)) pushSprite(it.x + Math.sin(ph * 6 + it.id) * 3, it.y + 2.05, 2 + ph * 12, false, A.manaMote(Math.min(3, Math.floor(ph * 4))), 0, 2);
      }
    }
    // 宝の山：量に応じた大きさ。光が当たるときらめく
    const tf = Math.floor(t * 3);
    // 宝：溜まった量で五段階（1〜9、10〜39、40〜99、100〜249、250〜）、持ち主で飾りを変える
    for (const p of eco.piles) {
      if (p.gold <= 0 || !inView(p.x, p.y, 40)) continue;
      const tier = p.gold >= 250 ? 4 : p.gold >= 100 ? 3 : p.gold >= 40 ? 2 : p.gold >= 10 ? 1 : 0;
      pushSprite(p.x, p.y + 4, 0, false, A.hoard(tier, eco.pileOwner(p), tf + p.id), 0, 2);
    }
    // 石像：石になった瞬間の姿を、石の色で
    for (const st of eco.statues) {
      if (!inView(st.x, st.y, 40)) continue;
      const dir = st.dir === 0 ? 0 : st.dir === 1 ? 1 : 2;
      const lift = st.k === Kind.Bat || st.k === Kind.Gargoyle ? 0 : 0;
      pushSprite(st.x, st.y, lift, st.dir === 3, this.frameOf(st.k, st.sp, dir, Math.min(2, st.act), st.f, 0, 0), 0, 3);
    }

    // 生き物は足元の位置で前後を決める
    this.order.length = 0;
    for (const c of eco.list) {
      // コウモリの群れにばらけたヴァンパイア：姿の代わりに、14匹のコウモリが、飛ぶ向きの後ろへ尾を引いて住処へ飛ぶ（src/eco/vampire.ts の vampScatter）。
      // ばらけた直後（生き物の更新12回まで）は、ヴァンパイアのいた所から四方へはじけ、それから尾の形に寄り集まる。
      // （以前は8匹が半径4〜14px に固まり、石像の色で描いていたので、小さな灰色の点にしか見えなかった）
      if (c.k === Kind.Vampire && c.st === VAMP_SCATTER && !c.dead) {
        const a = eco.moveAlpha(c, alpha);
        const x = c.px + (c.x - c.px) * a;
        const y = c.py + (c.y - c.py) * a;
        if (inView(x, y, 90)) {
          const t = eco.w.tick + alpha;
          const age = eco.step - c.lureAt + alpha * 0.5;
          // 飛ぶ向き：動いた向き。止まっていれば住処の向き
          let dx = c.x - c.px;
          let dy = c.y - c.py;
          if (Math.abs(dx) + Math.abs(dy) < 0.05) {
            dx = c.hx - x;
            dy = c.hy - y;
          }
          const L = Math.hypot(dx, dy) || 1;
          const ux = dx / L;
          const uy = dy / L;
          const m = Math.min(1, age / 12);
          const N = 14;
          for (let i = 0; i < N; i++) {
            // 尾：先頭から後ろへ並び、後ろほど幅が広く、左右に揺れる
            const back = (i / N) * 38;
            const wid = 4 + back * 0.5;
            const sway = Math.sin(t * 0.21 + i * 1.9) * wid;
            const surge = Math.cos(t * 0.17 + i * 2.7) * 4;
            const tx = x - ux * (back + surge) - uy * sway;
            const ty = y - uy * (back + surge) * 0.8 + ux * sway * 0.6;
            // はじける：四方へ広がって（生き物の更新6回で半径30px）、また尾へ寄る
            const ang = i * 2.399;
            const rad = 30 * Math.sin(m * Math.PI) + 2;
            const bx = (x + Math.cos(ang) * rad) * (1 - m) + tx * m;
            const by = (y + Math.sin(ang) * rad * 0.6) * (1 - m) + ty * m;
            const flip = m < 1 ? Math.cos(ang) < 0 : ux < 0;
            pushSprite(bx, by, 9 + (i % 5) * 3 + Math.sin(t * 0.3 + i) * 3, flip, A.index(1, 2, 1, (Math.floor(t * 0.5) + i) & 3), 0, 0);
          }
        }
        continue;
      }
      if (c.dead === 2 || c.away) continue;
      const a = eco.moveAlpha(c, alpha);
      const x = c.px + (c.x - c.px) * a;
      const y = c.py + (c.y - c.py) * a;
      // （ワームは胴が長いので、頭が少し画面の外でも描く）
      if (!inView(x, y, c.k === Kind.Worm ? 150 : 40)) continue;
      this.order.push({ y, c, x, yy: y });
    }
    // ヴァンパイアの黒い霧：コウモリにばらけた瞬間と、姿を戻した瞬間（描画専用。fxVampMist）。
    // 姿を戻すときは、四方からコウモリが寄り集まって、霧の中で人の形に戻る
    for (const ef of eco.fxVampMist) {
      const tt = eco.w.tick + alpha;
      const age = tt - ef.t;
      const dur = ef.how ? 36 : 28;
      if (age < 0 || age >= dur || !inView(ef.x, ef.y, 60)) continue;
      const ph = age / dur;
      for (let i = 0; i < 5; i++) {
        const an = i * 1.257 + ef.t;
        const r = 4 + ph * 14;
        pushSprite(ef.x + Math.cos(an) * r, ef.y + Math.sin(an) * r * 0.5 + 0.1, 6 + ph * 10 + (i % 2) * 4, i % 2 === 1, A.mist(Math.min(3, Math.floor(ph * 4))), 0, 0);
      }
      if (ef.how === 1 && ph < 0.75) {
        const p2 = ph / 0.75;
        for (let i = 0; i < 10; i++) {
          const an = i * 2.399 + ef.t * 0.1;
          const r = 34 * (1 - p2);
          pushSprite(ef.x + Math.cos(an) * r, ef.y + Math.sin(an) * r * 0.6, 10 + (1 - p2) * 10 + (i % 3) * 2, Math.cos(an) > 0, A.index(1, 2, 1, (Math.floor(tt * 0.5) + i) & 3), 0, 0);
        }
      }
    }
    this.order.sort((a, b) => a.y - b.y || a.c.id - b.c.id);

    // 炎に焼かれた者（描画専用。fxBurns）
    const burnAt = new Map<number, number>();
    for (const e of eco.fxBurns) if (eco.w.tick - e.t < 30) burnAt.set(e.id, e.t);
    // マナから生まれた者（描画専用の出現の演出）
    const manaBorn = new Map<number, { t: number; x: number; y: number }>();
    for (const e of eco.fxManaBorn) if (eco.w.tick - e.t < 100) manaBorn.set(e.id, e);
    // 身構えている一行（描画専用：武器を構えた姿で止める。目標に着いたときは振りかぶり、そばを通るときは構えるだけ）
    const braced = new Map<number, number>();
    for (const p of eco.parties) if ((p.braceT ?? 0) > eco.step) for (const id of p.members) braced.set(id, p.braceK ?? 2);
    // 戦利品を担ぐ者
    const trophyOf = new Map<number, number>();
    for (const p of eco.parties) if (p.trophy && p.trophyBy) trophyOf.set(p.trophyBy, p.trophy);
    // 物音に耳を澄ます一行：前に出た前衛だけが構える
    for (const p of eco.parties) if ((p.listenT ?? 0) > eco.step && p.listenBy) braced.set(p.listenBy, 2);
    this.pruneHeroLooks(eco);
    for (const ord of this.order) {
      const c = ord.c;
      let x = ord.x;
      let yy = ord.yy;
      // ヴァンパイアの眷属は、元の種の姿で描き、青白く塗り替える（シェーダーの kind 6。src/eco/thrall.ts）。冒険者の眷属は生前の姿のまま
      const thrallOf = c.k === Kind.Thrall && !c.dead;
      const sp = thrallOf ? c.sp : c.k;
      const csp = thrallOf ? (c.sp === Kind.Adventurer ? Math.max(0, c.lure - 1) : 0) : c.sp;
      // 隠れている者は、こちら（暗がりの外）を向いて潜む（目が見えるように）
      let dir = c.dir === 0 || eco.isHidden(c) ? 0 : c.dir === 1 ? 1 : 2;
      let flip = c.dir === 3;
      // 幼竜と若い竜には横向きの絵しかない。上下へ動くときも、横にどちらへ動いているかで左右を決め、
      // 一時停止中やロード直後で動きが分からなければ、飛んでいる竜は行き先の側を向き、それ以外は直前の左右を保つ（以前は上下の向きのとき必ず右を向き、左上へ飛ぶと右を向いたまま後ろへ滑って見えた）
      const youngDragon = sp === Kind.Dragon && c.sp < 2 && c.elite !== 8;
      if (youngDragon) {
        if (c.dir === 2 || c.dir === 3) flip = c.dir === 3;
        else if (Math.abs(c.x - c.px) > 0.05) flip = c.x < c.px;
        else if (c.st === 2 && Math.abs(eco.dragonFlightGoal(c)[0] - c.x) > 1) flip = eco.dragonFlightGoal(c)[0] < c.x;
        else flip = this.youngFaceL.get(c.id) ?? false;
        this.youngFaceL.set(c.id, flip);
        dir = 2;
      }
      let act = c.act;
      let f = 0;
      let lift = 0;
      const seed = c.id * 0.37;
      if (c.dead === 1) {
        act = 3;
        f = Math.min(3, c.actT);
        if (sp === Kind.Wisp) f = Math.min(3, c.actT >> 1);
      } else if (c.caught) {
        act = 1;
        f = Math.floor(t * 10 + seed) & 1;
      } else if (sp === Kind.Adventurer && braced.get(c.id) === 4) {
        // 墓標の前：武器は構えず、静かに立つ
        act = 0;
        f = 0;
      } else if (sp === Kind.Adventurer && braced.has(c.id) && act === 0) {
        act = 2;
        f = braced.get(c.id) === 1 ? 1 : 0;
      } else if (act === 2) {
        // 魔法使いの詠唱中（経過が負の数。src/eco/skill.ts）は、杖を掲げたコマのまま
        f = c.actT < 0 ? 1 : Math.min(3, c.actT);
      } else if (act === 1 && c.x === c.px && c.y === c.py && eco.gaitPaused(c)) {
        // 歩き方の止まる番（大ネズミの「止まってあたりをうかがう」、一行の先頭が見回す、など）で、この更新ではその場から動いていない。
        // 行動の多くは移動のあとで「着いていなければ歩く姿」と姿を決め直すので、act は歩く姿のままになっている。
        // 本当に止まっているので立ち姿で描く（以前は、その場で足を動かし続けて引っかかって見えた）
        act = 0;
        f = Math.floor(t * 2.6 + seed) & 3;
      } else if (act === 1) {
        f = Math.floor(t * 7 + seed) & 3;
      } else {
        f = Math.floor(t * 2.6 + seed) & 3;
      }
      if (sp === Kind.Zombie && act === 1) f = Math.floor(t * 4.5 + seed) & 3;
      if (sp === Kind.Ghost) lift = 6 + (Math.floor(t * 1.5 + seed) & 1);
      if (sp === Kind.Gargoyle && act !== 0 && !c.dead) lift = 10;
      // リビングアーマーは宙に浮く
      if (sp === Kind.Armor && !c.dead) lift = 5;
      if (sp === Kind.Wyvern && !c.dead) lift = 18 + (Math.floor(t * 2 + seed) & 1);
      if (sp === Kind.Dragon && c.st === 2 && !c.dead) lift = 20;
      if (sp === Kind.Dragon && c.away) continue;
      if (sp === Kind.Wisp) {
        lift = c.dead ? 4 : 7 + (Math.floor(t * 2 + seed) & 1);
      } else if (sp === Kind.Bat) {
        const roosting = c.st === 0 && !c.dead && !c.caught && !night;
        if (roosting) {
          act = 0;
          dir = 0;
          // ヴァンパイアに従うコウモリは、主の住処の床のマスの上端にいる。絵は壁の面にぶら下がって見えるよう持ち上げる
          if (c.ref2) lift = 18;
        } else if (!c.dead && !c.caught) {
          lift = 16;
          if (act === 0) {
            act = 1;
            f = Math.floor(t * 9 + seed) & 3;
          }
        } else if (c.caught) lift = 6;
      }
      // 炎に焼かれている者（描画専用）：燃える床の上にいる間と、炎に焼かれてから3秒ほど、体のまわりから火の粉が舞い上がる（src/eco/fire.ts の burnHurt）。
      // （以前は、焼かれても傷を受けたときの白い光が出るだけで、燃える床で少しずつ焼かれていることが見えなかった）
      if (!c.dead && sp !== Kind.Dragon) {
        const tk = eco.tileOf(c.x, c.y);
        const onFire = tk >= 0 && eco.w.burn[tk] > 0 && !eco.airborne(c);
        if (onFire || burnAt.has(c.id)) {
          const t = eco.w.tick + alpha;
          const bh = Ecology.bodySize(sp) * 0.9 + 4;
          for (let i = 0; i < 7; i++) {
            const ph = (t * 0.045 + i * 0.37) % 1;
            pushSprite(x + Math.sin(t * 0.2 + i * 2.1) * (4 + (i % 3) * 2), yy + 0.06, lift + 2 + ph * bh, false, A.speck(1, Math.min(3, Math.floor(ph * 4))), 0, 2);
          }
        }
      }
      // マナから生まれた者の出現（描画専用）：生まれる場所にマナの粒が渦を巻いて集まり、影の姿から白く光って形が固まる。
      // ドラゴンの幼子は、マナが卵に集まり、卵が揺れてひびが走り、割れて殻から出てくる
      let veil = 0;
      {
        const mb = manaBorn.get(c.id);
        if (mb && !c.dead) {
          const age = eco.w.tick - mb.t + alpha;
          const egg = sp === Kind.Dragon;
          const G = 30;
          const HATCH = egg ? G + 22 : G;
          const F = 14;
          if (age < HATCH + F + 6) {
            const cx = egg ? mb.x : x;
            const cy = egg ? mb.y + 4 : yy;
            const bh = egg ? 8 : Ecology.bodySize(sp) * 0.9 + 6;
            // 集まる粒
            const n = age < G ? 18 : 8;
            const p = Math.min(1, age / G);
            for (let i = 0; i < n; i++) {
              const ang = i * 2.399 + age * (0.1 + (i % 3) * 0.03) * (i % 2 ? 1 : -1);
              const r = age < G ? 3 + Math.pow(1 - p, 1.4) * (30 + (i % 4) * 6) : Math.max(0, 6 - (age - G) * 0.3);
              const fade = age < G ? Math.min(3, Math.floor(p * 4 + (i % 2))) : Math.max(0, 2 - Math.floor((age - G) / 8));
              if (age >= G && r <= 0) continue;
              pushSprite(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.55, bh + Math.sin(i * 1.7 + age * 0.25) * 4 * (1 - p * 0.5), false, A.manaMote(fade), 0, 2);
            }
            if (age < G * 1.2 && age > G * 0.4) pushSprite(cx, cy - 0.05, bh * 0.5, false, A.halo(age > G * 0.8 ? 1 : 0), 0, 2);
            if (egg && age < HATCH) {
              // 卵：マナを吸って筋が光り、揺れてひびが走る
              const shake = age > G ? (Math.floor(age) % 4 < 2 ? 1 : -1) * (age > HATCH - 8 ? 1.5 : 0.8) : 0;
              const v = age < G * 0.5 ? 0 : age < G ? 1 : age < HATCH - 7 ? 2 : 3;
              pushSprite(cx + shake, cy, 0, false, A.dragonEgg(v), 0, 2);
            }
            // 姿：集まるあいだは見せず、影の姿から白い光で形が固まる
            if (age < HATCH) veil = 1;
            else if (age < HATCH + F * 0.5) veil = egg ? 3 : 2;
            else if (age < HATCH + F * 0.5 + 3) veil = 3;
          }
        }
      }
      // リビングアーマーの組み上がり（描画専用。st 10 の間）：散らばった武具が震え、寄り集まって浮き上がり、白い光の中で甲冑の形になる
      if (sp === Kind.Armor && c.st === 10 && !c.dead) {
        const age = Math.min(ARMOR_RISE, c.actT + alpha);
        const p = age / ARMOR_RISE;
        // 武具は床にあった位置から寄り集まる（ロードし直した直後など、その記録が無ければ、まわりに散らした位置から）
        const rec = eco.fxArmorRise.find((e) => e.id === c.id);
        const kit = eco.armorKit.get(c.id) ?? [0];
        const parts: [number, number, number][] = rec ? rec.parts : kit.slice(1, 1 + kit[0]).map((kd, i) => {
          const ang = i * 2.399 + c.id * 0.7;
          const r0 = 14 + ((i * 7 + c.id) % 12);
          return [kd, Math.cos(ang) * r0 * 1.2, Math.sin(ang) * r0 * 0.6];
        });
        if (p < 0.85)
          parts.forEach(([kd, dx, dy], i) => {
            const g = p < 0.4 ? 0 : Math.min(1, (p - 0.4) / 0.4);
            const k2 = 1 - g * g;
            const shake = (Math.floor(t * 18 + i * 3) % 2 ? 1 : -1) * (p < 0.4 ? 0.4 + p * 2 : 0.4);
            pushSprite(c.x + dx * k2 + shake, c.y + dy * k2 + 2, g * 10, false, A.item(kd, 0), 0, 2);
          });
        if (p > 0.3 && p < 0.9)
          for (let i = 0; i < 6; i++) {
            const ph = (t * 0.9 + i / 6) % 1;
            pushSprite(x + Math.cos(i * 2.4 + t * 3) * (8 - ph * 6), yy + 0.05, 2 + ph * 18, false, A.manaMote(Math.min(3, Math.floor(ph * 4))), 0, 2);
          }
        if (p < 0.8) veil = 1;
        else if (p < 0.9) veil = 3;
      }
      if (veil === 1) continue;
      // クモの巣の糸の中：捕まった者はもがいて小刻みに揺れ、足を取られた者は糸を引きずって揺れる。どちらも白い糸がまとわりつく
      if (!c.dead && eco.webs.length && (c.caught || (eco.webEffect(c) === 2 && eco.inWeb(c)))) {
        const k = c.caught ? 1.2 : 0.6;
        x += Math.sin(t * 31 + c.id) * k;
        const fh = Ecology.bodySize(sp) || 6;
        for (let i = 0; i < (c.caught ? 3 : 2); i++) {
          const a = t * 2.3 + i * 2.1 + c.id;
          pushSprite(x + Math.cos(a) * fh * 0.5, yy + 0.1, lift + 2 + ((i * 3 + Math.floor(t * 4)) % Math.max(2, Math.round(fh * 0.8))), false, A.fx('bit:3:7:0'), 0, 4);
        }
      }
      // 逃げる途中で縮こまっている者（src/eco/combat.ts の cower）：相手の方を向いて小刻みに震え、3秒に一度、0.6秒ほど左右をうかがう。
      // （立ち止まっているだけだと、動けなくなって固まったように見えるので、怯えていると分かる姿にする）
      if (!c.dead && c.flee > 0 && c.act === 0 && c.sleep === 0 && !c.caught && sp !== Kind.Wisp && sp !== Kind.Ghost) {
        x += Math.sin(t * 40 + c.id) * 0.6;
        const ph = (t + (c.id % 13) * 0.23) % 3;
        if (ph < 0.6) {
          if (dir === 2) flip = !flip;
          else {
            dir = 2;
            flip = ph < 0.3;
          }
        }
      }
      // 床から養分を吸うスライム：吸う一口ごと（生き物の更新10回に1回）に、まわりの床から緑の粒が体へ吸い込まれる（src/eco/slime.ts の slimeCanSip）
      if (sp === Kind.Slime && !c.dead && c.elite !== 6 && eco.slimeCanSip(c)) {
        const age = ((((eco.step - (c.id % 10)) % 10) + 10) % 10) + alpha * 0.5;
        if (age < 5) {
          const p = age / 5;
          const bh = 3 + eco.slimeSize(c) * 2;
          for (let i = 0; i < 6; i++) {
            const ang = i * 1.047 + (c.id % 7) * 0.9 + p * 0.8;
            const r = (1 - p) * (10 + (i % 3) * 3);
            pushSprite(x + Math.cos(ang) * r, yy + Math.sin(ang) * r * 0.5 + 0.2, p * bh, false, A.speck(2, p < 0.8 ? 0 : 1), 0.6, 2);
          }
        }
      }
      // 捕食の演出（drawEats）：繭やさらわれた姿で描く獲物は、ふつうには描かない。くわえて振られている獲物は口元に。食べたミミックは跳ねる
      if (this.eatHide.has(c.id)) continue;
      {
        const cr = this.eatCarry.get(c.id);
        if (cr) {
          x = cr.x;
          yy = cr.y;
          lift = cr.lift;
        }
        lift += this.eatHop.get(c.id) ?? 0;
      }
      const bright = sp === Kind.Wisp && c.glow > 90 ? 1 : 0;
      // 隠れている者（ほかの生き物には気づかれない）：眺める人には、暗く沈んだ影の姿と光る目で見せる
      const hidden = eco.isHidden(c);
      const isCorpse = c.dead === 1 && c.actT >= 4 && sp !== Kind.Wisp && sp !== Kind.Slime && sp !== Kind.Ghost && sp !== Kind.Myconid;
      const eliteName = ['', 'firespirit', 'pknight', '', '', '', 'wspirit', 'lspirit', '', 'mlord'][c.elite] ?? '';
      // 冒険者は、名簿の人でも、名簿から外れた亡骸や眷属でも、手描きの体で描く（src/sprites.ts の heroSprite。姿は advLook）
      const adv = sp === Kind.Adventurer ? this.advLook(eco, c, csp) : null;
      let frame = adv
        ? isCorpse
          ? eco.corpseStage(c) < 2
            ? this.atlas.hero(csp, false, adv.look, adv.rank, 0, 3, 3)
            : this.atlas.corpse(sp, 2)
          : this.atlas.hero(csp, !thrallOf && c.torch > 0 && csp !== 1 && csp < 4, adv.look, adv.rank, dir, act, f)
        : !isCorpse && eliteName ? this.atlas.named(eliteName, dir, act, f, 0) : isCorpse ? this.atlas.corpse(sp, eco.corpseStage(c)) : this.frameOf(sp, c.elite === 8 ? 3 : csp, dir, act, f, bright, sp === Kind.Slime ? eco.slimeSize(c) : sp === Kind.Ant && c.units > 0 ? 1 : sp === Kind.Dragon && c.st === 2 ? 1 : sp === Kind.Skeleton ? (c.init ? [1, 0, 2, 3, 5, 4, 6][csp] : 0) : sp === Kind.Goblin ? (c.torch > 0 ? 2 : c.party ? 1 : 0) : sp === Kind.Orc ? (c.party ? 1 : 0) : sp === Kind.Dwarf ? csp : sp === Kind.Rat && eco.w.tick - c.bornAt < 14400 / 4 ? 1 : 0);
      // 名簿の冒険者の演出（位の光、位が上がったときの光の粒など。src/eco/roster.ts）
      if (adv && !isCorpse) {
        const h = thrallOf ? eco.roster.find((q) => q.cid === c.id) ?? null : eco.heroOf(c);
        // 英雄（位3）は足もとを淡い金色の光で照らす（絵に点を打たず、描画の柔らかい光で。描画専用）
        if (h && h.rank >= 3 && !c.dead && !hidden) dyn.push({ x, y: yy - 12, r: 34, i: 0.32, c: 4 });
        // 魔法使いの攻撃：掲げた杖の宝玉が光る（掲げる・突き上げる・下ろすのコマで、明るく→いちばん明るく→薄れる。描画専用）
        if (csp === 1 && act === 2 && f >= 1 && !c.dead && !hidden) {
          const [ox, oy] = heroOrbAt(['down', 'up', 'side'][dir], f, adv.rank) as number[];
          const qx = x + (flip ? -ox : ox);
          const qy = yy + oy - lift;
          if (c.actT < 0) {
            // 詠唱：溜めるにつれて宝玉の光がふくらんで脈打ち、光の粒が宝玉へ吸い寄せられる
            const p = Math.max(0, Math.min(1, (SKILL_WIZARD_FIRE.windup + c.actT) / SKILL_WIZARD_FIRE.windup));
            const pulse = 1 + 0.15 * Math.sin(t * 18 + c.id);
            dyn.push({ x: qx, y: qy, r: (18 + 34 * p) * pulse, i: (0.35 + 0.65 * p) * (adv.rank === 0 ? 0.8 : 1), c: 1 });
            for (let i = 0; i < 5; i++) {
              const ph = (t * 1.4 + i / 5 + c.id * 0.11) % 1;
              const rr = 16 * (1 - ph);
              const a = i * 1.26 + t * 2.5;
              pushSprite(qx + Math.cos(a) * rr, yy + 0.1, -oy + lift + Math.sin(a) * rr * 0.6, false, A.fx(`bit:4:2:${3 - Math.min(3, Math.floor(ph * 4))}`), 0, 4);
            }
            // 溜めの後半は、宝玉の先に火の玉が灯る
            if (p > 0.45) pushSprite(qx, yy + 0.1, -oy + lift + 2, false, A.fx(`orb2:2:${Math.floor(t * 12) & 3}`), 0, 4);
          } else dyn.push({ x: qx, y: qy, r: [0, 30, 44, 22][f], i: [0, 0.5, 0.85, 0.3][f] * (adv.rank === 0 ? 0.6 : 1), c: 1 });
        }
        // 位が上がって初めての遠征：入ってきてしばらく、金の光の粒が体のまわりを立ちのぼる（「見違えた」）
        const pt = h && h.rank > 0 && h.ret === RANK_AT[h.rank] ? eco.parties.find((q) => q.id === c.party) : undefined;
        if (pt && eco.step - pt.since < 400) {
          for (let i = 0; i < 3 + h!.rank * 2; i++) {
            const ph = (t * 0.7 + i / (3 + h!.rank * 2)) % 1;
            pushSprite(x + Math.cos(i * 2.4 + t * 2) * 7, yy + Math.sin(i * 2.4 + t * 2) * 2, 2 + ph * 26, false, A.speck(1, Math.min(3, Math.floor(ph * 4))), 0, 2);
          }
          if (h!.rank >= 3) pushSprite(x, yy - 0.05, 6, false, A.halo(0), 0, 2);
        }
        // 引退の前の最後の遠征の英雄：金の粒が二つ、ゆっくり立ちのぼる（「これが最後」。描画専用）
        if (h && h.last && h.rank >= 3) {
          for (let i = 0; i < 2; i++) {
            const ph = (t * 0.35 + i * 0.5 + c.id * 0.13) % 1;
            pushSprite(x + Math.sin(ph * 6 + i * 3) * 6, yy, 6 + ph * 30, false, A.speck(1, Math.min(3, Math.floor(ph * 4))), 0, 2);
          }
        }
      }
      // 僧侶に清められた亡骸：数秒に一度、祈りのときと同じ聖印の光が、薄れながら亡骸から立ちのぼる（もう起き上がらない印。描画専用。src/eco/roster.ts の blessBrace）
      if (isCorpse && c.st === 99) {
        const ph = (t * 0.2 + c.id * 0.37) % 1;
        if (ph < 0.45) pushSprite(x, yy, 6 + ph * 40, false, A.pray(1 + Math.min(2, Math.floor(ph * 6.7))), 0, 2);
      }
      let glow = c.glow / 255;
      // リビングアーマーの冑の覗き穴の光：マナが十分なら灯り続け、少なくなるとちらつく（描画専用）
      if (sp === Kind.Armor && !c.dead) glow = c.mana < ARMOR_LOW ? ((Math.floor(t * 6) * 7 + c.id * 13) % 5 < 2 ? 0 : 0.3) : 0.8;
      // 起きているワーム：頭の跡に沿ったひと続きの胴と、進む向きに口を開く頭（drawWorm）
      if (sp === Kind.Worm && !c.dead && c.sleep !== 2) {
        this.drawWorm(eco, A, c, x, yy, t, pushSprite);
        continue;
      }
      // 影
      if (o.nShadows < MAX_SPRITES && sp !== Kind.Wisp && sp !== Kind.Ghost && !isCorpse && !(sp === Kind.Bat && act === 0 && (lift === 0 || c.ref2 > 0))) {
        const fr = this.atlas.frames[frame];
        const k = o.nShadows * 4;
        o.shadows[k] = x;
        o.shadows[k + 1] = yy;
        o.shadows[k + 2] = Math.max(2, fr.w * (lift > 0 ? 0.22 : 0.32));
        o.shadows[k + 3] = lift > 0 ? 1 : 2.2;
        o.nShadows++;
      }
      // 眠り専用の姿：宝の上のドラゴン、目覚める前のワーム、ねぐらのコウモリ、毛布にくるまる冒険者
      const sf = Math.floor(t * 1.2 + c.id);
      if (!isCorpse && c.sleep === 2) {
        if (sp === Kind.Dragon) frame = A.sleep(c.elite === 8 ? 'dragonB' : ['dragonH', 'dragonY', 'dragon'][Math.min(2, c.sp)], sf);
        else if (sp === Kind.Worm) frame = A.sleep('worm', sf);
        else if (sp === Kind.Bat && (lift === 0 || (c.ref2 > 0 && act === 0))) frame = A.sleep('bat', sf);
        else if (adv) frame = A.heroBed(csp, adv.look, adv.rank, sf);
      }
      // 攻める側：打つ前にわずかに身を引き、打つ瞬間に相手の方へ踏み込む
      {
        const lg = this.lunge.get(c.id);
        if (lg) {
          const age = eco.w.tick - lg.t;
          const k2 = age <= 1 ? -1.5 : age <= 4 ? 3.5 * (1 - (age - 2) / 3) : 0;
          x += lg.ux * k2;
          yy += lg.uy * k2 * 0.6;
        }
      }
      // 打たれた直後は少しのけぞる（打った側から離れる向きへ）
      {
        const hit = this.lastHit.get(c.id);
        if (hit && eco.w.tick - hit.t < 6) {
          const dx = c.x - hit.ax;
          const dy = c.y - hit.ay;
          const L = Math.hypot(dx, dy) || 1;
          const k2 = (6 - (eco.w.tick - hit.t)) / 6;
          x += (dx / L) * 2.5 * k2;
          yy += (dy / L) * 1.5 * k2;
        }
      }
      // 光らない生き物のまわりの、見た目だけの淡い暈（光る種は自分で本当に光るので描かない）
      // （大きな体でも暈は中くらいまで。閉じた空洞の中の生き物には描かない）
      if (!isCorpse && !hidden && sp !== Kind.Wisp && sp !== Kind.Myconid && sp !== Kind.Slime && sp !== Kind.Ghost && c.sleep !== 2) {
        const bs = Ecology.bodySize(sp);
        const tk = Math.floor(c.y / 16) * eco.w.map.w + Math.floor(c.x / 16);
        if (bs > 0 && !eco.w.map.sealed[tk]) pushSprite(x, yy - 0.05, lift * 0.5, false, A.halo(bs >= 11 ? 1 : 0), 0, 2);
      }
      // 王の冠と、頭の角兜（頭の上に重ねる）
      if (!isCorpse && (c.elite === 4 || c.elite === 5) && c.sleep !== 2) {
        const hy = c.elite === 4 ? 13 : 24;
        const hx = c.elite === 4 ? (flip ? -5 : 5) : (flip ? -1 : 1);
        pushSprite(x + hx, yy + 0.05, lift + hy, flip, c.elite === 4 ? A.crown() : A.chiefHelm(), 0, 2);
      }
      // 貢ぎ物の袋：取り立てたオークは、袋を肩に担いで縄張りへ帰る
      if (!isCorpse && sp === Kind.Orc && c.units > 0 && !hidden) pushSprite(x + (flip ? 6 : -6), yy + 0.05, lift + 16, flip, A.sack(), 0, 2);
      // ゴブリンの袋：摘んだキノコや苔、冒険者から盗んだ食べ物を背負って集落へ持ち帰る
      if (!isCorpse && sp === Kind.Goblin && c.units >= 6 && !hidden && !c.dead) pushSprite(x + (flip ? 5 : -5), yy + 0.05, lift + 10, flip, A.sack(), 0, 2);
      // 冒険者の荷：金貨の袋（持つ量に応じた大きさ）を背に担ぎ、目標を果たした一行の担ぐ者は戦利品を肩に
      if (!isCorpse && sp === Kind.Adventurer && !c.dead && c.sleep !== 2) {
        if (c.gold > 0) {
          const z = c.gold >= GOLD_CAP[c.sp] * 0.6 ? 2 : c.gold >= GOLD_CAP[c.sp] * 0.25 ? 1 : 0;
          pushSprite(x + (flip ? 5 : -5), yy + 0.05, lift + 9 + z, flip, A.goldSack(z), 0, 2);
        }
        const tp = trophyOf.get(c.id);
        // 戦利品は背に担ぐ（体の輪郭の外へ突き出して、兜や武器と重ならないように）
        if (tp) pushSprite(x + (flip ? 12 : -12), yy + 0.06, lift + 12, !flip, A.trophy(TROPHY[tp]?.[1] ?? 'fang'), 0, 2);
      }
      // 傷を受けた瞬間は白く光る
      const flash = !isCorpse && eco.w.tick - c.hitAt < 2 ? 20 : 0;
      // リビングアーマーの武具（芯の後ろ側の分。手前の分は芯のあと）
      const armorGear = sp === Kind.Armor && !c.dead && veil === 0 ? this.armorGear(eco, A, c, x, yy, lift, t) : null;
      if (armorGear) for (const g of armorGear) if (!g.front) pushSprite(g.x, g.y, g.lift, g.flip, g.frame, 0, 2);
      pushSprite(x, yy, lift, flip, frame, hidden || veil === 2 ? 0 : glow, (veil === 3 ? 20 : flash) + (hidden || veil === 2 ? 10 : 0) + (thrallOf && !hidden && veil !== 2 ? 6 : 0), (c.id * 0.6180339) % 1);
      if (armorGear) for (const g of armorGear) if (g.front) pushSprite(g.x, g.y, g.lift, g.flip, g.frame, 0, 2);
      // 糸の繭を抱えて食べるクモ：体の手前に繭、巻き始めは白い糸の粒が繭のまわりを回る
      {
        const cc = this.eatCocoon.get(c.id);
        if (cc) {
          const cx = x + (flip ? -4 : 4);
          pushSprite(cx, yy + 2, 1, false, A.fx(`cocoon:${cc.v}`), 0, 2);
          if (cc.age < 12)
            for (let i = 0; i < 4; i++) {
              const a = i * 1.57 + cc.age * 0.9;
              pushSprite(cx + Math.cos(a) * 5, yy + 2 + Math.sin(a) * 2, 5 + Math.sin(a) * 2, false, A.fx('bit:3:7:0'), 0, 4);
            }
        }
      }
      // さらったコウモリを足につかんで飛ぶ：体の下側に、もがく獲物を重ねる
      {
        const cl = this.eatClutch.get(c.id);
        if (cl) pushSprite(x + (flip ? -3 : 3) + Math.sin(cl.age * 1.3) * 1.5, yy + 0.05, lift + (sp === Kind.Wyvern ? 2 : 0) + Math.abs(Math.sin(cl.age * 0.9)) * 1.5, flip, cl.frame, 0, 0);
      }
      // 隠れている者の目：影の姿の上で光る（ときどきまばたき）。暗がりで灯りを狙って潜む者（待ち伏せのゴブリンなど）も、暗ければ目だけ光る
      if (thrallOf && !hidden && adv) {
        // 眷属になった冒険者の目：手描きの体の目の位置（足もとから12ピクセル上）に赤く光る。後ろ向きのときは見えない
        const ph = Math.floor(t * 2 + c.id * 0.37) % 9;
        if (dir !== 1) pushSprite(x + (dir === 2 ? (flip ? -2 : 2) : 0), yy + 0.05, lift + 12, flip, A.heroRedEyes(dir === 2, ph === 8 ? 3 : ph & 1), 0, 0);
      } else if (thrallOf && !hidden) {
        // 眷属の目：いつも赤く光る（ときどきまばたき）
        const ph = Math.floor(t * 2 + c.id * 0.37) % 9;
        pushSprite(x + (flip ? -1 : 1) * (dir === 2 ? 1 : 0), yy + 0.05, lift + Math.max(4, (Ecology.bodySize(sp) || 6) * 1.5), false, A.redEyes(ph === 8 ? 3 : ph & 1), 0, 0);
      } else if (hidden || (!isCorpse && ((c.lure && sp !== Kind.Vampire) || (sp === Kind.Goblin && c.st === 17)) && !c.dead && c.act === 0 && !eco.isLit(c))) {
        const ph = Math.floor(t * 2 + c.id * 0.37) % 7;
        pushSprite(x, yy + 0.05, lift + (sp === Kind.Goblin ? 14 : 7), false, A.eyes(ph === 6 ? 3 : ph & 1), 0, 0);
      }
      // ウィスプの光の尾：通ったあとに、淡い光の粒が少しのあいだ残る（描画専用）
      if (sp === Kind.Wisp && !isCorpse) {
        let tr = this.trails.get(c.id);
        if (!tr) this.trails.set(c.id, (tr = []));
        const last = tr[0];
        if (!last || Math.abs(last[0] - x) + Math.abs(last[1] - yy) > 2) {
          tr.unshift([x, yy, lift]);
          if (tr.length > 7) tr.pop();
        }
        for (let i = 1; i < tr.length; i++) pushSprite(tr[i][0], tr[i][1], tr[i][2] + 3, false, A.speck(2, Math.min(3, Math.floor(i / 2))), 0, 2);
      }
      // 眠りの Z：深い眠りは大きな Z がゆっくり、浅い眠りと眠りながら動く種は小さな z、半分だけ眠る種は小さな z と光ったままの片目
      if (!isCorpse && c.sleep > 0 && sp !== Kind.Bat) {
        const fh = this.atlas.frames[frame].h;
        const cyc = c.sleep === 2 ? 2.4 : 1.6;
        for (let i = 0; i < (c.sleep === 2 ? 2 : 1); i++) {
          const ph = ((t + (c.id % 7) * 0.31) / cyc + i * 0.5) % 1;
          const zx = x + (flip ? -1 : 1) * (4 + ph * 6) + Math.sin(ph * 6) * 1.5;
          const zl = lift + fh * (sp === Kind.Dragon ? 0.55 : 0.75) + ph * 14;
          pushSprite(zx, yy, zl, false, A.sleep(c.sleep === 2 || sp === Kind.Adventurer ? 'Z' : 'z', Math.floor(ph * 4)), 0, 2);
        }
        if (c.sleep === 3) pushSprite(x + (flip ? -2 : 2), yy, lift + fh * 0.72, false, A.sleep('eye', Math.floor(t * 2)), 0, 2);
      }
      // ドラゴンの炎の柱：口元から（その先の扇の中の床には、燃える床と同じ炎を描く。src/renderer.ts の updateFx）
      if (sp === Kind.Dragon && act === 2 && c.ref2 > 0 && !c.dead && dir !== 1) {
        if (youngDragon) {
          // 若い竜：小さな炎を、若い竜の口元（体の中心から前へ約27px、上へ約24px）から
          pushSprite(x + (flip ? -1 : 1) * 27, yy - 21, 0, flip, this.atlas.breathYoung(Math.floor(t * 10)), 0, 0);
          dyn.push({ x: x + (flip ? -24 : 24), y: yy - 8, r: 60, i: 1.2, c: 1 });
        } else {
          const bf = this.atlas.breath(dir === 0, Math.floor(t * 10));
          if (dir === 2) pushSprite(x + (flip ? -1 : 1) * (44 + 4), yy - 40 * 1 + 1, 0, flip, bf, 0, 0);
          else pushSprite(x, yy - 44 + 1, 0, false, bf, 0, 0);
          dyn.push({ x: x + (dir === 2 ? (flip ? -40 : 40) : 0), y: yy - (dir === 2 ? 16 : 8), r: 90, i: 1.6, c: 1 });
        }
      }
      // 光を帯びた生き物の光
      if (!c.dead || c.k === Kind.Wisp) {
        if (sp === Kind.Wisp) dyn.push({ x, y: yy - lift, r: 18 + glow * 16, i: (c.dead ? 0.1 : 0.2) + glow * 0.45 });
        else if (sp === Kind.Ghost && !c.dead) dyn.push({ x, y: yy - lift - 8, r: 20, i: 0.1 });
        else if (sp === Kind.Salamander && !c.dead) dyn.push({ x, y: yy - 6, r: 34, i: 0.55, c: 1 });
        else if (sp === Kind.Myconid && !c.dead) dyn.push({ x, y: yy - 14, r: 30, i: 0.42, c: 2 });
        else if (c.glow > 16) dyn.push({ x, y: yy - lift - 4, r: 14 + glow * 16, i: glow * 0.32 });
      }
    }
    dyn.sort((a, b) => b.i - a.i);
    for (const d of dyn) {
      if (o.nDyn >= MAX_DYN) break;
      o.dyn.set([d.x, d.y, d.r, Math.min(9.9, d.i) + 10 * (d.c ?? 0)], o.nDyn * 4);
      o.nDyn++;
    }
    return o;
  }
}
