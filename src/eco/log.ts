/** Ecology のメソッド：記録（src/ecology.ts のクラスに、prototype で足す。中身は分ける前と同じ） */
import { Ecology, } from '../ecology';

/** 目立つ出来事を記録に残す（新しい順に60件まで） */
export function log(this: Ecology, x: number, y: number, m: string): void {
  this.events.push({ t: this.w.tick, x: Math.round(x), y: Math.round(y), m });
  if (this.events.length > 60) this.events.shift();
}

/** 種が初めて照らされた */
export function discover(this: Ecology, k: number, x: number, y: number): void {
  if (this.discovered[k]) return;
  this.discovered[k] = 1;
  this.log(x, y, `初めて光の中に姿を見せた：{k:${k}}`);
}

declare module '../ecology' {
  interface Ecology {
    log: typeof log;
    discover: typeof discover;
  }
}

Object.assign(Ecology.prototype, { log, discover });
