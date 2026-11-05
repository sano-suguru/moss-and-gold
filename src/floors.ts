/**
 * 床の材質の一覧（描画だけで使う。シミュレーションは見ない）。
 *
 * 地形は、下から「床の材質の段」「床の上の状態の段」「床の上のもの」「壁」の順に重ねて描く（src/shaders.ts の地形シェーダー）。
 * この一覧は、いちばん下の「床の材質の段」の定義。床のマスは、この一覧の材質を1つだけ持つ。
 *
 * 境目では、優先度（prio）の高い材質が上に重なる。縁の形は、上に重なる材質自身の形だけで決まり、下に何があるかは見ない。
 * なので、材質が増えても、縁の作り方は材質の数だけで済む（組み合わせごとに用意しなくてよい）。
 *
 * 縁の型（edge）：
 * - 'built'（人の手の型）：縁はマスの境目にそろえてまっすぐ。下の材質よりわずかに高く敷かれているように見せる：
 *   南の縁に暗い側面、その南の床へ落ちる影、東西の縁から落ちる細い影、北の縁に明るい線。
 *   ほかの床に接する縁の石（レンガ）は、ところどころ欠けたり抜けたりして、下の材質がのぞく。
 * - 'natural'（自然の型）：縁がマスの境目の内外へ数 px ずつふらつき、角は丸くなる。
 *
 * built（人の手のものか）：人の手の床に接する壁の角は丸めず直角にし、その床に面した壁の正面は石積みにする。
 *
 * 材質を足すときは、この一覧に1行足し、シェーダーの floorPattern に模様の描き方を足す。
 * 地図の上のどこがどの材質かは floorId が決める（今は地図の石畳の情報から作る。材質を本当に増やすときは、
 * 地形の生成（MapData）に材質の配列を持たせる。それはシミュレーションの変更なので、そのときに扱う）。
 */
export interface Floor {
  name: string;
  prio: number;
  edge: 'built' | 'natural';
  built: boolean;
}

export const FLOORS: Floor[] = [
  { name: '岩床', prio: 0, edge: 'natural', built: false },
  { name: '石畳', prio: 1, edge: 'built', built: true },
];

/** マス k の床の材質の番号（FLOORS の位置） */
export function floorId(m: { paved: ArrayLike<number> }, k: number): number {
  return m.paved[k] ? 1 : 0;
}

/** シェーダーに埋め込む、材質ごとの性質の定数（GLSL） */
export function floorGlsl(): string {
  // 真偽の性質は、材質の番号のビットに並べた整数にする（シェーダーで配列を変数の番号で引くと重いので）
  const n = FLOORS.length;
  const bits = (f: (x: Floor) => boolean) => FLOORS.reduce((b, x, i) => (f(x) ? b | (1 << i) : b), 0);
  return `const int FLOOR_N = ${n};
const int FLOOR_PRIO[${n}] = int[${n}](${FLOORS.map((x) => x.prio).join(', ')});
const int FLOOR_EDGE_BUILT = ${bits((x) => x.edge === 'built')};
const int FLOOR_HANDMADE = ${bits((x) => x.built)};
bool edgeBuilt(int f) { return ((FLOOR_EDGE_BUILT >> f) & 1) != 0; }
bool handmade(int f) { return ((FLOOR_HANDMADE >> f) & 1) != 0; }`;
}
