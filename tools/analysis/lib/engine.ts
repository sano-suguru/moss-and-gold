/**
 * 画面なしでシミュレーションを進めるときのエントリポイント。ここから import をたどれるソース（src/ の world、ecology、mapgen など）の中身のハッシュが、シミュレーションのバージョン（simHash）になる。
 * 1 tick ごとに何を呼ぶかもここで決める。sim・probe・check で同じ進め方をしないと、同じバージョンでも展開が分かれる。
 */
import { DAY_TICKS, World } from '../../../src/world';
import { Ecology } from '../../../src/ecology'; // メソッドは world.ts が読み込む src/eco/ で足される

export { DAY_TICKS, World, Ecology };

/**
 * プレイヤーに見えたマスの更新の間隔（tick）。見えたマスは画面の地図の表示と「初めて見た種」のゲーム内ログにしか使われず、生き物の判断には影響しないので、画面なしの実行では間引く
 * （20 tick ごとの場合と比べて、かしたれの6日間で死亡・誕生・住みつき・種ごとの数が同じ）。ゲームの画面では main.ts が別に更新する
 */
export const SEEN_EVERY = 200;

/** 1 tick 進める（見えたマスの更新の結果は状態に含まれる：種の発見のゲーム内ログなど） */
export function tick(w: World): void {
  w.step();
  if (w.tick % SEEN_EVERY === 0) w.updateSeen();
}
