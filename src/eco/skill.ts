/**
 * Ecology のメソッド：技の溜めと、使ったあとの間（どの種の技にも使う共通の部品）。
 *
 * 技は、溜め（windup 回の生き物の更新）のあいだ動かずに構え、溜め終わった回に放つ。放ったあとは cool 回の更新のあいだ、同じ技を溜め直さない。
 * 溜めの途中で打たれると、技は止まる（溜め直しは、使ったあとの間が明けてから）。
 * 溜めのあいだは、動きの種類を攻撃（act 2）にして、経過（actT）を −windup から数える（生き物の更新ごとに1ずつ増え、0 になった回が溜め終わり）。
 * 画面は、経過が負の数のあいだ「構えたまま」のコマで描く（src/creatureView.ts）。
 * 技を溜めはじめた時刻（tick）は Cr.cast に持ち、セーブに入れる（使ったあとの間と、溜めの途中で打たれたかの判定に使う）。
 */
import { CR_EVERY, Cr, Ecology } from '../ecology';

/** 技の速さ：溜めと、使ったあとの間（どちらも生き物の更新の回数） */
export interface Skill {
  windup: number;
  cool: number;
}

/** 魔法使いのマジックミサイル：およそ1.6秒溜め、使ったあと4秒は溜め直さない（多くて5.6秒に1回） */
export const SKILL_WIZARD_MISSILE: Skill = { windup: 8, cool: 20 };
/** 狩人の矢の雨：およそ0.8秒引き絞り、射たあと3秒は引き直さない */
export const SKILL_HUNTER_RAIN: Skill = { windup: 4, cool: 15 };

/** 戦士の飛ぶ斬撃：およそ0.6秒振りかぶり、使ったあと2.4秒は溜め直さない */
export const SKILL_WARRIOR_SLASH: Skill = { windup: 3, cool: 12 };
/** 竜殺しの大剣の薙ぎ払い：およそ1.2秒溜め、使ったあと4.4秒は溜め直さない */
export const SKILL_SLAYER_CLEAVE: Skill = { windup: 6, cool: 22 };
/** 僧侶のハンマー（打った所で光の十字架が爆ぜる）：およそ0.8秒振りかぶり、使ったあと4秒は溜め直さない */
export const SKILL_PRIEST_HAMMER: Skill = { windup: 4, cool: 20 };
/** ミノタウロスの斧の薙ぎ払い：およそ0.8秒振りかぶり、使ったあと2秒は溜め直さない */
export const SKILL_MINO_SWEEP: Skill = { windup: 4, cool: 10 };
/** ミノタウロスの突進：およそ1.6秒、頭を下げて地面をかき、使ったあと6秒は溜め直さない */
export const SKILL_MINO_CHARGE: Skill = { windup: 8, cool: 30 };
/** ゴーレムの両腕の振り下ろし：およそ1.2秒、両腕を掲げて溜め、使ったあと3秒は溜め直さない */
export const SKILL_GOLEM_SLAM: Skill = { windup: 6, cool: 15 };
/** ゴーレムの地割れ：およそ2秒、地面に光る筋を走らせて溜め、使ったあと7秒は溜め直さない */
export const SKILL_GOLEM_QUAKE: Skill = { windup: 10, cool: 35 };
/** 盗賊の短剣投げ：およそ0.4秒構え、投げたあと2秒は構え直さない */
export const SKILL_THIEF_THROW: Skill = { windup: 2, cool: 10 };

/** 使ったあとの間が明けていて、技を溜めはじめられるか */
export function skillCanStart(this: Ecology, c: Cr, s: Skill): boolean {
  // 怯んでいる者は溜めを始められない（src/eco/charge.ts）
  return c.stun <= 0 && this.w.tick - c.cast >= (s.windup + s.cool) * CR_EVERY;
}

/** 技を溜めはじめる */
export function skillStart(this: Ecology, c: Cr, s: Skill): void {
  c.act = 2;
  c.actT = -s.windup;
  c.cast = this.w.tick;
}

/**
 * 溜めの進み（生き物の更新ごとに、ほかの行動より先に呼ぶ）。
 * 'charging' 溜めている（ほかの行動をしない）、'ready' 溜め終わった（この回に放つ）、'broken' 溜めの途中で打たれて止まった、'' 溜めていない
 */
export function skillStep(this: Ecology, c: Cr, s: Skill, breakOnHit = true): 'charging' | 'ready' | 'broken' | '' {
  // 経過が 0 の攻撃の姿は、溜め終わりのときだけ（攻撃で経過を 0 にした回は、次の更新のはじめに 1 へ増えている）。
  // 念のため、溜めはじめてからの時刻でも確かめる
  if (c.act !== 2 || c.actT > 0 || this.w.tick - c.cast > (s.windup + 1) * CR_EVERY) return '';
  // 大物の溜めは、打たれただけでは止まらない（重い一撃を受けたときだけ、src/eco/combat.ts の strike が止める）
  if (breakOnHit && c.hitAt > c.cast) {
    c.act = 0;
    c.actT = 0;
    return 'broken';
  }
  return c.actT < 0 ? 'charging' : 'ready';
}

declare module '../ecology' {
  interface Ecology {
    skillCanStart: typeof skillCanStart;
    skillStart: typeof skillStart;
    skillStep: typeof skillStep;
  }
}

Object.assign(Ecology.prototype, { skillCanStart, skillStart, skillStep });
