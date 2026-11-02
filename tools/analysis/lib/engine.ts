/**
 * 画面なしでシミュレーションを進めるときの入口。ここからたどれるソース（src/ の world、ecology、mapgen など）の中身が「版」（simHash）になる。
 * 進め方（1刻みごとに何を呼ぶか）もここで決める。sim・調べ物・確かめで同じ進め方をしないと、同じ版でも展開が分かれる。
 */
import { DAY_TICKS, World } from '../../../src/world';
import { Ecology } from '../../../src/ecology'; // メソッドは world.ts が読み込む src/eco/ で足される

export { DAY_TICKS, World, Ecology };

/**
 * 見たマスの更新の間隔（刻み）。見たマスは画面の地図と「初めて見た種」の記録にしか使われず、生き物の判断には響かないので、画面なしでは間引く
 * （20刻みごとと比べて、かしたれ6日で死・誕生・住みつき・種ごとの数が同じ）。ゲームの画面は main.ts で別に更新する
 */
export const SEEN_EVERY = 200;

/** 1刻み進める（見たマスの更新は状態に入る：種の発見の記録など） */
export function tick(w: World): void {
  w.step();
  if (w.tick % SEEN_EVERY === 0) w.updateSeen();
}
