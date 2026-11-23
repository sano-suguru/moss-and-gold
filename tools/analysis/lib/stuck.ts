/**
 * 足踏み・引っかかりとして数える記録か（stuck.jsonl・hitch.jsonl の1行）：その場で漂う種（ウィスプ 0、ゴースト 7、明かりのまわりを回る灯り蛾 34）と、
 * 足踏みの間の半分以上をクモの巣に捕まってもがいていた者（web。記録を始める前の実行結果には無いので 0 とみなす）は数えない。
 *
 * common.ts にも同じ名前の古い判定がある（灯り蛾を含まない）。common.ts は sim も読み込むので、書き換えると sim のビルドの中身が変わり、
 * 手元と Release「sim-cache」の実行結果がすべて使えなくなる。そこで、記録を数える側（compare・report・checks）はこちらを使う
 */
const DRIFTERS = new Set<number>([0, 7, 34]);
export const countsAsStuck = (x: { k: number; web?: number }): boolean => !DRIFTERS.has(x.k) && !((x.web ?? 0) >= 0.5);
