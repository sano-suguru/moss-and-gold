import type { Atlas } from './atlas';
import { Ecology, Kind, type Cr } from './ecology';
import { MAX_DYN } from './shaders';

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
export class CreatureView {
  /** 技の残した床の跡（描画だけ） */
  private marks: { x: number; y: number; key: string; t: number }[] = [];
  private seenFx = new WeakSet<object>();
  private lunge = new Map<number, { t: number; ux: number; uy: number }>();
  /** 飛び散る粒（描画だけ）：位置、高さ、速さ、種類、色、生まれた刻み、寿命 */
  private bits: { x: number; y: number; z: number; vx: number; vy: number; vz: number; kind: number; col: number; t0: number; life: number }[] = [];
  private bitsTick = -1;

  /**
   * 攻撃の技の演出：記録（eco.fxAttacks）ごとに、技の種類に応じて部品を組み合わせて描く。
   * 振り（斬る、荒い振り、突く、刺す）は打つ側の前に軌跡、噛む・爪は受ける側に跡、殴るは一拍ためてから土ぼこりと弾ける光と床のひび、
   * 矢と魔法の弾は飛んでいってから当たる、光線は二者のあいだを結ぶ、吸うは赤い粒が打つ側へ吸い込まれる、
   * 冷たい手は霜、溶かすはしぶきと溶け跡、胞子は緑の粉。強い一撃は大きく、とどめは白い大きな光と一瞬の明るさ
   */
  private drawAttacks(eco: Ecology, A: Atlas, inView: (x: number, y: number, m: number) => boolean, push: (x: number, y: number, lift: number, flip: boolean, frame: number, glow: number, kind: number) => void, dyn: { x: number; y: number; r: number; i: number; c?: number }[]): void {
    const now = eco.w.tick;
    for (const r of eco.fxAttacks) {
      const age = now - r.t;
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
  /** ウィスプの通った跡（描画だけに使う） */
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
      case Kind.Adventurer: return v >= 8 ? A.named('adv2', dir, act, f, v - 8) : A.named('adv', dir, act, f, v);
      case Kind.Skeleton: return A.named('skel', dir, act, f, v);
      case Kind.Lich: return A.named('lich', dir, act, f);
      case Kind.Dwarf: return A.named('dwarf', dir, act, f, v);
      case Kind.Rat: return v === 1 ? A.named('pup', dir, act === 1 ? 1 : 0, f) : A.index(sp, dir, act, f, bright);
      default: return A.index(sp, dir, act, f, bright);
    }
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
        if (tk >= 0 && tk < mm.sealed.length && mm.sealed[tk]) kind += 10;
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
    for (const b of eco.burrows) if (inView(b.x, b.y, 16)) pushSprite(b.x, b.y, 0, false, A.burrow, 0, 2);
    // コボルトの住処：畑の畝、奥の寝床、入口の飾り柱、罠
    for (const wr of eco.warrens) {
      if (wr.id < 0 || !inView(wr.x, wr.y, 96)) continue;
      const mw = eco.mapW;
      for (const k of eco.farmTiles(wr)) pushSprite((k % mw) * 16 + 8, Math.floor(k / mw) * 16 + 14, 0, false, A.furrow(eco.w.fungus[k] >= 80 ? 1 : 0), 0, 2);
      pushSprite(wr.x, wr.y + 5, 0, false, A.nest, 0, 2);
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
    // 隠れているコボルト：姿は見せず、暗がりで目だけが光る（ときどきまばたき）
    for (const c of eco.list) {
      if (c.k !== Kind.Kobold || !eco.isHidden(c) || !inView(c.x, c.y, 16)) continue;
      const ph = Math.floor(t * 2 + c.id * 0.37) % 7;
      pushSprite(c.x, c.y - 7, 0, false, A.eyes(ph === 6 ? 3 : ph & 1), 0, 0);
    }
    for (const w of eco.webs) if (inView(w.x, w.y, 24)) pushSprite(w.x, w.y, 0, false, A.web, 0, 2);
    for (const c of eco.colonies) if (inView(c.x, c.y, 24)) pushSprite(c.x, c.y + 4, 0, false, A.anthill, 0, 2);
    for (const c of eco.camps) if (inView(c.x, c.y, 32)) pushSprite(c.x, c.y + 6, 0, false, c.kind === 0 ? A.camp : A.hut, 0, 2);
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
      for (const cp of eco.camps) if (cp.id >= 0 && (cp.fuel ?? 0) > 0 && inView(cp.x, cp.y, 40)) embers(cp.x, cp.y + 14, 6, cp.id, 30);
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
      this.lastHit.clear();
      for (const h of eco.fxHits) {
        const age = eco.w.tick - h.t;
        if (age > 8) continue;
        this.lastHit.set(h.id, h);
      }
      this.lunge.clear();
      for (const r of eco.fxAttacks) {
        if (eco.w.tick - r.t > 6) continue;
        const L = Math.hypot(r.dx - r.ax, r.dy - r.ay) || 1;
        if (r.style === 'arrow' || r.style === 'orb' || r.style === 'beam') continue;
        this.lunge.set(r.aid, { t: r.t, ux: (r.dx - r.ax) / L, uy: (r.dy - r.ay) / L });
      }
      this.drawAttacks(eco, A, inView, pushSprite, dyn);
      // 粒を動かす（刻みごと）：石のかけらは跳ねて転がり、土ぼこりはふくらんで沈み、しずくと氷は落ち、火花は飛んで消える
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
      for (const mk of eco.fxMarks) {
        const age = eco.w.tick - mk.t;
        if (age > 18) continue;
        const c = byId.get(mk.id);
        if (!c || c.dead || !inView(c.x, c.y, 20)) continue;
        const pop = age < 3 ? age : 3;
        pushSprite(c.x + 5, c.y, 22 + pop + Ecology.bodySize(c.k) * 0.6, false, A.mark(mk.m), 0, 2);
      }
    }
    // 幼竜が生まれた場所の卵の殻
    if (eco.dragonShell && eco.w.tick - eco.dragonShell.t < 14400 * 3 && inView(eco.dragonShell.x, eco.dragonShell.y, 20)) pushSprite(eco.dragonShell.x, eco.dragonShell.y, 0, false, A.eggShell(), 0, 2);
    // 血の跡（地面に描く）
    for (const b of eco.blood) if (inView(b.x, b.y, 8)) pushSprite(b.x, b.y, 0, false, A.blood(b.c, b.v), 0, 2);
    // 技の残した床の跡（ひび、溶け跡、霜。地上の時間で数分かけて消える）
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
    for (const it of eco.gear) if (inView(it.x, it.y, 16)) pushSprite(it.x, it.y + 2, 0, false, A.item(it.kind, itf + it.id), 0, 2);
    // 宝の山：量に応じた大きさ。光が当たるときらめく
    const tf = Math.floor(t * 3);
    // 宝：溜まった量で五段階（1〜9、10〜39、40〜99、100〜249、250〜）、持ち主で飾りを変える
    for (const p of eco.piles) {
      if (p.gold <= 0 || !inView(p.x, p.y, 40)) continue;
      const tier = p.gold >= 250 ? 4 : p.gold >= 100 ? 3 : p.gold >= 40 ? 2 : p.gold >= 10 ? 1 : 0;
      pushSprite(p.x, p.y + 4, 0, false, A.hoard(tier, eco.pileOwner(p), tf + p.id), 0, 2);
    }
    // ワームの胴：頭の跡をたどる節
    for (const c of eco.list) {
      if (c.k !== Kind.Worm || c.dead || c.sleep === 2) continue;
      const tr = eco.trails.get(c.id);
      if (!tr) continue;
      const n = Math.min(tr.length / 2, 10);
      for (let i = n - 1; i >= 1; i--) {
        const sx = tr[i * 2];
        const sy = tr[i * 2 + 1];
        if (inView(sx, sy, 32)) pushSprite(sx, sy + 6, 0, false, A.wormSeg(i === n - 1 ? 1 : 0), 0, 0);
      }
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
      if (c.dead === 2 || c.away || eco.isHidden(c)) continue;
      const x = c.px + (c.x - c.px) * alpha;
      const y = c.py + (c.y - c.py) * alpha;
      if (!inView(x, y, 40)) continue;
      this.order.push({ y, c, x, yy: y });
    }
    this.order.sort((a, b) => a.y - b.y || a.c.id - b.c.id);

    for (const ord of this.order) {
      const c = ord.c;
      let x = ord.x;
      let yy = ord.yy;
      const sp = c.k;
      let dir = c.dir === 0 ? 0 : c.dir === 1 ? 1 : 2;
      const flip = c.dir === 3;
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
      } else if (act === 2) {
        f = Math.min(3, c.actT);
      } else if (act === 1) {
        f = Math.floor(t * 7 + seed) & 3;
      } else {
        f = Math.floor(t * 2.6 + seed) & 3;
      }
      if (sp === Kind.Zombie && act === 1) f = Math.floor(t * 4.5 + seed) & 3;
      if (sp === Kind.Ghost) lift = 6 + (Math.floor(t * 1.5 + seed) & 1);
      if (sp === Kind.Gargoyle && act !== 0 && !c.dead) lift = 10;
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
        } else if (!c.dead && !c.caught) {
          lift = 16;
          if (act === 0) {
            act = 1;
            f = Math.floor(t * 9 + seed) & 3;
          }
        } else if (c.caught) lift = 6;
      }
      const bright = sp === Kind.Wisp && c.glow > 90 ? 1 : 0;
      const isCorpse = c.dead === 1 && c.actT >= 4 && sp !== Kind.Wisp && sp !== Kind.Slime && sp !== Kind.Ghost && sp !== Kind.Myconid;
      const eliteName = ['', 'firespirit', 'pknight', '', '', '', 'wspirit', 'lspirit', '', 'mlord'][c.elite] ?? '';
      let frame = !isCorpse && eliteName ? this.atlas.named(eliteName, dir, act, f, 0) : isCorpse ? this.atlas.corpse(sp, eco.corpseStage(c)) : this.frameOf(sp, c.elite === 8 ? 3 : c.sp, dir, act, f, bright, sp === Kind.Slime ? eco.slimeSize(c) : sp === Kind.Ant && c.units > 0 ? 1 : sp === Kind.Dragon && c.st === 2 ? 1 : sp === Kind.Adventurer ? (c.sp >= 4 ? 8 + c.sp - 4 : c.sp * 2 + (c.torch > 0 && c.sp !== 1 ? 1 : 0)) : sp === Kind.Skeleton ? (c.init ? [1, 0, 2, 3, 5, 4, 6][c.sp] : 0) : sp === Kind.Goblin ? (c.torch > 0 ? 2 : c.party ? 1 : 0) : sp === Kind.Orc ? (c.party ? 1 : 0) : sp === Kind.Dwarf ? c.sp : sp === Kind.Rat && eco.w.tick - c.bornAt < 14400 / 4 ? 1 : 0);
      const glow = c.glow / 255;
      // 影
      if (o.nShadows < MAX_SPRITES && sp !== Kind.Wisp && sp !== Kind.Ghost && !isCorpse && !(sp === Kind.Bat && act === 0 && lift === 0)) {
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
        else if (sp === Kind.Bat && lift === 0) frame = A.sleep('bat', sf);
        else if (sp === Kind.Adventurer) frame = A.sleep('bed-' + ['warrior', 'wizard', 'thief', 'priest', 'bard', 'hunter', 'slayer'][c.sp], sf);
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
      if (!isCorpse && sp !== Kind.Wisp && sp !== Kind.Myconid && sp !== Kind.Slime && sp !== Kind.Ghost && c.sleep !== 2) {
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
      // 傷を受けた瞬間は白く光る
      const flash = !isCorpse && eco.w.tick - c.hitAt < 2 ? 20 : 0;
      pushSprite(x, yy, lift, flip, frame, glow, flash, (c.id * 0.6180339) % 1);
      // ウィスプの光の尾：通ったあとに、淡い光の粒が少しのあいだ残る（描画だけ）
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
          pushSprite(zx, yy, zl, false, A.sleep(c.sleep === 2 ? 'Z' : 'z', Math.floor(ph * 4)), 0, 2);
        }
        if (c.sleep === 3) pushSprite(x + (flip ? -2 : 2), yy, lift + fh * 0.72, false, A.sleep('eye', Math.floor(t * 2)), 0, 2);
      }
      // ドラゴンの炎の柱：口元から
      if (sp === Kind.Dragon && act === 2 && c.ref2 > 0 && !c.dead && dir !== 1) {
        const bf = this.atlas.breath(dir === 0, Math.floor(t * 10));
        if (dir === 2) pushSprite(x + (flip ? -1 : 1) * (44 + 4), yy - 40 * 1 + 1, 0, flip, bf, 0, 0);
        else pushSprite(x, yy - 44 + 1, 0, false, bf, 0, 0);
        dyn.push({ x: x + (dir === 2 ? (flip ? -40 : 40) : 0), y: yy - (dir === 2 ? 16 : 8), r: 90, i: 1.6, c: 1 });
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
