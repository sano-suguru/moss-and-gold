import { floorGlsl } from './floors';

export const MAX_LIGHTS = 64;
export const MAX_SHAFTS = 24;

export const VS_FULL = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

// 1. 光の地図：4ピクセル四方ごとに、各光源の明るさと遮り（影）を計算する
export const FS_LIGHT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uMap;
uniform ivec2 uMapSize;
uniform vec2 uLmOrigin;
uniform int uNum;
uniform vec4 uL[${MAX_LIGHTS}];
uniform vec4 uC[${MAX_LIGHTS}];
uniform vec3 uAmbient;
uniform sampler2D uGlow;
uniform sampler2D uFx;
uniform vec3 uMossCol;
uniform vec3 uLavaCol;
uniform int uNumD;
uniform vec4 uDL[48];
uniform vec3 uDCol;
out vec4 o;

bool solidAt(ivec2 t) {
  if (t.x < 0 || t.y < 0 || t.x >= uMapSize.x || t.y >= uMapSize.y) return true;
  return texelFetch(uMap, t, 0).r > 0.5;
}

float vis(vec2 a, vec2 b) {
  ivec2 ta = ivec2(floor(a / 16.0));
  ivec2 tb = ivec2(floor(b / 16.0));
  vec2 d = b - a;
  int n = int(ceil(length(d) / 4.0));
  for (int s = 1; s < 72; s++) {
    if (s >= n) break;
    vec2 q = a + d * (float(s) / float(n));
    ivec2 t = ivec2(floor(q / 16.0));
    if (t == ta || t == tb) continue;
    if (solidAt(t)) return 0.0;
  }
  return 1.0;
}

void main() {
  vec2 p = uLmOrigin + (gl_FragCoord.xy - 0.5) * 4.0 + 2.0;
  vec3 L = uAmbient;
  vec4 g = texture(uGlow, p / 16.0 / vec2(uMapSize));
  // 光る苔は、どれだけ豊かになっても光の芯が白く飛ばないよう、上限をつける
  L += min(g.r, 0.55) * uMossCol + g.g * uLavaCol + min(g.a, 0.6) * vec3(0.6, 0.4, 0.95);
  // 燃えているマスの光（まわりへにじませる）
  vec2 fu = p / 16.0 / vec2(uMapSize), fd = 1.0 / vec2(uMapSize);
  float fb = texture(uFx, fu).r * 0.4 + (texture(uFx, fu + vec2(fd.x, 0.0)).r + texture(uFx, fu - vec2(fd.x, 0.0)).r + texture(uFx, fu + vec2(0.0, fd.y)).r + texture(uFx, fu - vec2(0.0, fd.y)).r) * 0.15
    + (texture(uFx, fu + 2.0 * vec2(fd.x, 0.0)).r + texture(uFx, fu - 2.0 * vec2(fd.x, 0.0)).r + texture(uFx, fu + 2.0 * vec2(0.0, fd.y)).r + texture(uFx, fu - 2.0 * vec2(0.0, fd.y)).r) * 0.08;
  L += fb * vec3(1.0, 0.5, 0.16) * 2.4;
  // 光を帯びた生き物（遮らない小さな光）
  for (int i = 0; i < 48; i++) {
    if (i >= uNumD) break;
    vec4 dl = uDL[i];
    float d = distance(p, dl.xy);
    if (d >= dl.z) continue;
    float f = 1.0 - d / dl.z;
    float ci = floor(dl.w / 10.0);
    float inten = dl.w - ci * 10.0;
    // 色：0 青白、1 炎、2 紫、3 白、4 金、5 毒（緑）、6 血（赤）、7 霜
    vec3 dc = ci < 0.5 ? uDCol : (ci < 1.5 ? vec3(1.0, 0.55, 0.22) : (ci < 2.5 ? vec3(0.72, 0.52, 1.0) : (ci < 3.5 ? vec3(1.0) : (ci < 4.5 ? vec3(1.0, 0.85, 0.5) : (ci < 5.5 ? vec3(0.6, 1.0, 0.45) : (ci < 6.5 ? vec3(1.0, 0.35, 0.3) : vec3(0.7, 0.9, 1.0)))))));
    L += f * f * inten * dc;
  }
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNum) break;
    vec4 l = uL[i];
    float d = distance(p, l.xy);
    if (d >= l.z) continue;
    float f = 1.0 - d / l.z;
    float v = f * (0.45 + 0.55 * f) * l.w;
    if (uC[i].w > 0.5) v *= vis(l.xy, p);
    L += v * uC[i].rgb;
  }
  o = vec4(L * 0.5, 1.0);
}
`;

// 2. 場面：ドット絵の地形を手続き的に描き、光と影、記憶、光暈、光の筋を重ねる
export const FS_SCENE = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uMap;
uniform sampler2D uTile;
uniform sampler2D uField;
uniform sampler2D uMana;
uniform sampler2D uGlow;
uniform sampler2D uLight;
uniform sampler2D uFx;
uniform ivec2 uMapSize;
uniform vec2 uOrigin;
uniform vec2 uArtSize;
uniform vec2 uLmOrigin;
uniform vec2 uLmSize;
uniform float uTime;
uniform int uNumHalo;
uniform vec4 uH[${MAX_LIGHTS}];
uniform vec4 uHC[${MAX_LIGHTS}];
uniform int uNumShaft;
uniform vec4 uS[${MAX_SHAFTS}];
uniform int uDebug;
out vec4 o;

const vec3 cK = vec3(20.0, 16.0, 24.0) / 255.0;
const vec3 ca = vec3(34.0, 30.0, 40.0) / 255.0;
const vec3 cb = vec3(52.0, 46.0, 60.0) / 255.0;
const vec3 cc = vec3(74.0, 66.0, 84.0) / 255.0;
const vec3 cd = vec3(100.0, 92.0, 110.0) / 255.0;
const vec3 ce = vec3(132.0, 124.0, 140.0) / 255.0;
const vec3 mf = vec3(30.0, 70.0, 50.0) / 255.0;
const vec3 mg = vec3(50.0, 120.0, 80.0) / 255.0;
const vec3 mh = vec3(90.0, 190.0, 120.0) / 255.0;
const vec3 mi = vec3(170.0, 240.0, 180.0) / 255.0;

uint hash2(ivec2 p, uint s) {
  uint h = uint(p.x) * 374761393u + uint(p.y) * 668265263u + s * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
float h01(ivec2 p, uint s) { return float(hash2(p, s) & 0xffffffu) / 16777216.0; }

float bayer(ivec2 w) {
  const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return B[(w.x & 3) + (w.y & 3) * 4] / 16.0;
}

bool inMap(ivec2 t) { return t.x >= 0 && t.y >= 0 && t.x < uMapSize.x && t.y < uMapSize.y; }
int solidAt(ivec2 t) { return inMap(t) ? (texelFetch(uMap, t, 0).r > 0.5 ? 1 : 0) : 1; }
int abits(ivec2 t) { return inMap(t) ? int(texelFetch(uMap, t, 0).a * 255.0 + 0.5) : 0; }
bool sealedAt(ivec2 t) { return (abits(t) & 32) != 0; }

// 壁（瓦礫を除く岩。地図の外も壁）。下が床の壁のマスは、上の CAP px が上面（天端）、残りが正面
const int CAP = 5;
const int FACE = 16 - CAP;
bool wallAt(ivec2 t) {
  if (!inMap(t)) return true;
  vec4 m = texelFetch(uMap, t, 0);
  return m.r > 0.5 && (int(m.a * 255.0 + 0.5) & 64) == 0;
}
ivec2 tileOfPx(ivec2 p) { return ivec2(floor(vec2(p) / 16.0)); }
// マスごとの描き方の情報（renderer.ts の tileInfo が求める）。r：壁と角の丸め方（bit0 壁か、bit1〜4 左上・右上・左下・右下の角を丸めるか）、
// g：床の材質の番号（src/floors.ts。壁は 255）、b：高さの違う縁（bit0〜3 北東南西の隣がこのマスより下の床、bit4〜7 上の床）、
// a：bit0 自然の型の縁を求めるか、bit1 掘りたての床か、bit2 まわりに掘りたてかどうかが違う床がある
${floorGlsl()}
ivec4 tileAt(ivec2 t) { return inMap(t) ? ivec4(texelFetch(uTile, t, 0) * 255.0 + 0.5) : ivec4(1, 255, 0, 0); }
int cornerAt(ivec2 t) { return tileAt(t).r; }
// マス t が人の手の床か（その床に接する壁の角は直角、面した壁の正面は石積み）
bool handmadeAt(ivec2 t) { int f = tileAt(t).g; return f < FLOOR_N && handmade(f); }
// なめらかな値のノイズ（0〜1）。格子点の値を補間するので、境目をまだらにしても離れた点が散らばらない
float vnoise(vec2 p, uint salt) {
  vec2 i = floor(p);
  vec2 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  ivec2 c = ivec2(i);
  return mix(mix(h01(c, salt), h01(c + ivec2(1, 0), salt), f.x), mix(h01(c + ivec2(0, 1), salt), h01(c + ivec2(1, 1), salt), f.x), f.y);
}
// 溶岩の広がり（p はワールドのピクセルの中心）。0.5 を超えれば溶岩。
// まわり4マスの中心での「溶岩か」をなめらかに補間し、なめらかなノイズを足す。補間だけでは境目がマスの境目の直線になるので、
// ノイズで岸を数 px ずつ内外へふらつかせ、角を丸める（離れた点や1ピクセルだけの突き出しができないよう、どちらのノイズもなめらかなもの）
float lavaField(vec2 p) {
  vec2 f = p / 16.0 - 0.5;
  ivec2 i0 = ivec2(floor(f));
  vec2 qf = f - floor(f);
  float a = float((tileAt(i0).a >> 6) & 1);
  float b = float((tileAt(i0 + ivec2(1, 0)).a >> 6) & 1);
  float c = float((tileAt(i0 + ivec2(0, 1)).a >> 6) & 1);
  float d = float((tileAt(i0 + ivec2(1, 1)).a >> 6) & 1);
  if (a + b + c + d == 0.0) return 0.0;
  float ls = mix(mix(a, b, qf.x), mix(c, d, qf.x), qf.y);
  return ls + (vnoise(p / 9.0, 641u) - 0.5) * 0.42 + (vnoise(p / 3.0, 642u) - 0.5) * 0.1;
}
// 点 p にいちばん近いマスの角（格子点）をはさむ横の隣のマス
ivec2 cnH(ivec2 p) { ivec2 t = tileOfPx(p); return t + ivec2(p.x - t.x * 16 < 8 ? -1 : 1, 0); }
// 点 p が、見た目の壁か（真上から見た岩の足もとの形）。シミュレーションはマス単位のままで、描画だけ自然の岩壁の角を丸める：
// 出っ張った角は削って床を見せ、へこんだ角は床の上へ岩を張り出させる（どの角を丸めるかは cornerAt）。
// 丸める半径は角ごとに 3〜6px、縁には小さなごつごつした凹凸
bool wallPxB(ivec2 p, ivec2 t, int b) {
  bool self = (b & 1) != 0;
  ivec2 l = p - t * 16;
  int q = (l.x < 8 ? 0 : 1) + (l.y < 8 ? 0 : 2);
  if ((b & (2 << q)) == 0) return self;
  // 角からの距離（ピクセルの中心で 0.5〜7.5）
  ivec2 v = t + ivec2(q & 1, q >> 1);
  vec2 a = abs(vec2(p - v * 16) + 0.5);
  float r = 3.0 + float(hash2(v, 811u) % 4u);
  if (a.x >= r || a.y >= r) return self;
  // 凹凸は、角から見た向き（a.x − a.y）に沿って 3px ごとの値をなめらかにつないだもの。半径の向きには一様なので、
  // 縁は一続きの線のままで、離れた点や1ピクセルだけの突き出しができない
  float u = (a.x - a.y) / 3.0 + 4.0;
  float k = floor(u);
  float j = (mix(h01(v * 16 + ivec2(int(k), 0), 812u), h01(v * 16 + ivec2(int(k) + 1, 0), 812u), u - k) - 0.5) * 1.6;
  bool near = length(vec2(r) - a) > r + j;
  return self ? !near : near;
}
bool wallPx(ivec2 p) {
  ivec2 t = tileOfPx(p);
  return wallPxB(p, t, cornerAt(t));
}
// 点 p（ワールドのピクセル）が壁の上面か：見た目の壁の足もとを、正面の高さ（FACE px）だけ上へずらした形。正面が丸めた角を回り込む
bool topPx(ivec2 p) { return wallPx(p) && wallPx(p + ivec2(0, FACE)); }
// 点 p が壁の正面か
bool facePx(ivec2 p) { return wallPx(p) && !wallPx(p + ivec2(0, FACE)); }
// 上面の点（マス t の中の位置 l）が、人の手の床の縁を囲む切り石の天端か：石積みの正面の天端と、人の手の床から CAP px の内の上面
bool copingPx(ivec2 t, ivec2 l) {
  if (handmadeAt(t + ivec2(0, 1))) return true;
  for (int dy = -1; dy <= 1; dy++)
    for (int dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) continue;
      ivec2 n = t + ivec2(dx, dy);
      if (!handmadeAt(n)) continue;
      int ddx = dx < 0 ? l.x + 1 : dx > 0 ? 16 - l.x : 0;
      int ddy = dy < 0 ? l.y + 1 : dy > 0 ? 16 - l.y : 0;
      if (max(ddx, ddy) <= CAP) return true;
    }
  return false;
}

// 石のひび割れ模様（セル状ノイズ）。x: 最も近い石までの距離, y: 二番目, z: 石ごとの値, w: 石の中での上下左右の位置。
// 最も近い石の中心は stoneC に残す（岩の硬さを石ひとつごとに決めて、層の境目を石のひび割れに沿わせるのに使う）
vec2 stoneC;
vec4 stones(vec2 p, vec2 cs, uint salt) {
  vec2 g = floor(p / cs);
  float d1 = 1e9;
  float d2 = 1e9;
  float id = 0.0;
  float pos = 0.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      ivec2 c = ivec2(g) + ivec2(i, j);
      uint h = hash2(c, salt);
      vec2 fp = (vec2(c) + 0.15 + 0.7 * vec2(float(h & 255u), float((h >> 8u) & 255u)) / 255.0) * cs;
      vec2 dv = (p - fp) / cs;
      float d = length(dv) * min(cs.x, cs.y);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = float((h >> 16u) & 255u) / 255.0;
        pos = dv.x + dv.y;
        stoneC = fp;
      } else if (d < d2) {
        d2 = d;
      }
    }
  return vec4(d1, d2, id, pos);
}

float seenSoft(vec2 wp) { return texture(uField, wp / 16.0 / vec2(uMapSize)).g; }
float waterAt(vec2 p) { return texture(uField, p / 16.0 / vec2(uMapSize)).b; }

vec3 ramp(int i) {
  i = clamp(i, 0, 5);
  if (i == 0) return cK;
  if (i == 1) return ca;
  if (i == 2) return cb;
  if (i == 3) return cc;
  if (i == 4) return cd;
  return ce;
}

int floorIdx(ivec2 l) {
  int half_ = l.y / 8;
  int ry = l.y % 8;
  int cx = (l.x + half_ * 4) % 8;
  if (ry == 7 || cx == 7) return 1;
  if (ry == 6 || cx == 6) return 2;
  if (ry == 0 || cx == 0) return 4;
  return 3;
}

int faceIdx(ivec2 l) {
  int row = l.y / 4;
  int bx = (l.x + (row % 2) * 4) % 8;
  int by = l.y % 4;
  if (bx == 7 || by == 3) return 1;
  if (by == 0) return 5;
  if (bx == 0) return 4;
  return 3;
}

// 明るさの頭打ちをやわらかく：0.78 を超えると、上限 1 へゆるやかに近づく（色合いは保つ）
vec3 softClip(vec3 c) {
  float m = max(c.r, max(c.g, c.b));
  if (m <= 0.78) return c;
  float k = 0.78 + 0.22 * (1.0 - exp(-(m - 0.78) / 0.22));
  return c * (k / m);
}
void main() {
  vec2 fc = vec2(gl_FragCoord.x - 0.5, uArtSize.y - gl_FragCoord.y - 0.5);
  vec2 wp = uOrigin + fc;
  ivec2 w = ivec2(wp);
  if (wp.x < 0.0 || wp.y < 0.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  ivec2 t = w / 16;
  ivec2 l = w - t * 16;
  if (!inMap(t)) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }

  // 見た目の壁（角を丸めた形）。マスと食い違う点（削った角の床、張り出した岩）は、角をはさむ横の隣のマスのものとして描く
  // （削った角では横の隣が床、張り出した岩では横の隣が岩）
  ivec4 tiOwn = tileAt(t);
  bool wpx = wallPxB(w, t, tiOwn.r);
  bool moved = wpx != ((tiOwn.r & 1) != 0);
  if (moved) { t = cnH(w); l = w - t * 16; }
  int s = wpx ? 1 : 0;
  float h = h01(w, 1u);
  vec3 alb;
  bool emis = false;
  bool isTerrain = true;
  bool isWater = false;
  // 記憶を地図のように描くための区別：0 床、1 岩の正面、2 岩の上面。edgeLine は壁の縁
  int tkind = 0;
  bool edgeLine = false;
  int idx;
  bool rub = (tiOwn.a & 32) != 0 && !moved;
  float matGlow = 0.0;
  float glint = 0.0;
  // 溶岩の溜まりの点か（閉じた空洞の中でも、溶岩は岩の奥から赤くぼんやり透けて見せる）
  bool lavaPx = false;
  // 床の点では、この点に近い4マス（マスの中心で囲む4つ）の情報を一度だけ読み、床の材質の縁・壁までの距離・岩のかけらの範囲に使い回す
  ivec4 q00 = ivec4(0);
  ivec4 q10 = ivec4(0);
  ivec4 q01 = ivec4(0);
  ivec4 q11 = ivec4(0);
  vec2 qf = vec2(0.0);
  if (s == 0) {
    vec2 f = (wp + 0.5) / 16.0 - 0.5;
    ivec2 i0 = ivec2(floor(f));
    qf = f - floor(f);
    q00 = tileAt(i0);
    q10 = tileAt(i0 + ivec2(1, 0));
    q01 = tileAt(i0 + ivec2(0, 1));
    q11 = tileAt(i0 + ivec2(1, 1));
  }

  if (s == 1) {
    // 壁の上面と正面（周りの点の見た目の壁を見て、縁と角を点ごとに描く。上面の範囲は topPx、正面の範囲は facePx）。
    // 同じ点の判定を何度もしないよう、この点と左右の点、およびそれぞれ正面の高さだけ下の点の見た目の壁を先に求めておく
    // 岩の内部（まわり8マスもすべて壁）なら、どの点も上面で縁も無いので、判定を省く
    ivec4 tw = moved ? tileAt(t) : tiOwn;
    bool inner = (tw.a & 8) != 0;
    ivec2 dF = ivec2(0, FACE);
    bool wF = inner || wallPx(w + dF);
    bool wL = inner || wallPx(w - ivec2(1, 0));
    bool wR = inner || wallPx(w + ivec2(1, 0));
    bool top = wF;
    bool brick = !top && handmadeAt(t + ivec2(0, 1));
    bool cope = top && (tw.a & 16) != 0 && copingPx(t, l);
    if (top) {
      if (cope) {
        // 切り石の天端：8px 角の石を並べる
        ivec2 b = w / 8;
        ivec2 bl = w - b * 8;
        float bh = h01(b, 47u);
        idx = bh < 0.3 ? 2 : 3;
        if (bl.x == 7 || bl.y == 7) idx = 1;
        else if (bl.x == 0 || bl.y == 0) idx = 4;
        else if (h > 0.95) idx = 4;
      } else {
        // 自然の岩の上面（大きめの岩塊）
        vec4 st = stones(wp + 0.5, vec2(11.0, 9.0), 41u);
        if (st.y - st.x < 1.0) idx = 0;
        else {
          idx = st.z < 0.4 ? 1 : 2;
          if (st.w < -0.45 && h > 0.4) idx += 1;
          if (h > 0.96) idx += 1;
        }
      }
      bool wU = inner || wallPx(w - ivec2(0, 1));
      bool up = inner || (wU && wallPx(w - ivec2(0, 1) + dF));
      bool lf = inner || (wL && wallPx(w - ivec2(1, 0) + dF));
      bool rt = inner || (wR && wallPx(w + ivec2(1, 0) + dF));
      bool dn = inner || (wallPx(w + ivec2(0, 1)) && wallPx(w + ivec2(0, 1) + dF));
      // 床と接する縁は黒い線。正面へ落ちる縁（天端の手前の角）は明るい線。
      // へこんだ角で正面が回り込む曲線では、横が正面でも、すぐ下が上面でなければ明るい線にする（曲線が途切れて点線にならないように）
      bool flrU = !wU;
      bool flrL = !wL;
      bool flrR = !wR;
      if (flrU || flrL || flrR) idx = 0;
      else if (!dn) idx = cope ? 5 : 4;
      else if (!up || !lf || !rt) idx = 0;
      tkind = 2;
      edgeLine = !up || !lf || !rt || !dn;
    } else {
      // 正面の中での高さ（上端が CAP、床に接する下端が 15）。真下へ何 px で床になるかで決める。
      // 使うのは下端の3段と上端だけなので、その分だけ調べる（途中の段は 10。石積みの壁は角を丸めないので、マスの中の位置を使う）
      int fy = 10;
      if (!wallPx(w + ivec2(0, 1))) fy = 15;
      else if (!wallPx(w + ivec2(0, 2))) fy = 14;
      else if (!wallPx(w + ivec2(0, 3))) fy = 13;
      else if (wallPx(w + ivec2(0, FACE - 1))) fy = CAP;
      if (brick) {
        // 石積みの壁（いちばん下の段の下端がマスの下端にそろうよう、行をずらす）
        idx = faceIdx(ivec2(l.x, l.y - CAP + 1));
        if (idx == 3 && h < 0.12) idx = 4;
        if (idx == 3 && h > 0.92) idx = 2;
      } else {
        // 自然の岩肌
        vec4 st = stones(wp + 0.5, vec2(10.0, 5.0), 23u);
        if (st.y - st.x < 1.0) idx = 1;
        else {
          idx = st.z < 0.35 ? 2 : 3;
          if (st.w < -0.35) idx += 1;
          else if (st.w > 0.4) idx -= 1;
        }
      }
      // 天端のすぐ下は影、足もとは暗く
      if (fy == CAP) idx = min(idx, 2);
      if (fy >= 13) idx -= 1;
      bool lf = wL && !wallPx(w - ivec2(1, 0) + dF);
      bool rt = wR && !wallPx(w + ivec2(1, 0) + dF);
      // 左右の縁の黒い線は、床と接する所だけ（へこんだ角で上面と接する所には引かない）
      if (!wL || !wR) idx = 0;
      tkind = 1;
      edgeLine = fy == 15 || !lf || !rt;
    }
    alb = ramp(idx);
    // 岩の硬さ：柔らかい層は茶色がかった細かい肌、硬い岩は青みがかった暗い大きな岩肌（石積みと切り石は人の手のものなので色を分けない）
    if (!brick && !cope) {
      // 硬さは、その点が属する石の中心があるマスで決める（中心が壁でなければ自分のマス）。境目がマスの直線でなく、石のひび割れに沿う
      ivec2 mt = tileOfPx(ivec2(floor(stoneC)));
      int hb = wallAt(mt) ? abits(mt) : abits(t);
      if ((hb & 8) != 0) {
        alb *= vec3(1.22, 1.0, 0.74);
        if (h01(w, 501u) < 0.2) alb *= 1.12;
        else if (h01(w, 502u) < 0.12) alb *= 0.86;
      } else if ((hb & 16) != 0) {
        alb *= vec3(0.74, 0.84, 1.10);
        // 硬い岩の、かすかな鉱物のきらめき（ゆっくり明滅する点。光る）
        if (h01(w, 520u) < 0.004) {
          float tw = 0.5 + 0.5 * sin(uTime * (1.2 + h01(w, 521u) * 2.0) + h01(w, 522u) * 6.28);
          if (tw > 0.75) { alb = mix(alb, vec3(0.75, 0.85, 1.0), (tw - 0.75) * 3.0); glint = (tw - 0.75) * 2.0; }
        }
        vec4 st2 = stones(wp + 0.5, vec2(10.0, 8.0), 503u);
        if (st2.y - st2.x < 1.0) alb *= 0.62;
        else if (st2.z > 0.7) alb *= 1.12;
      }
    }
  } else {
    uint th = hash2(t, 7u);
    // ---- 床の材質の段（src/floors.ts）。この点に見える材質 mat を決める ----
    // 自分のマスの情報は、読んだまわり4マスの中にある（削った壁の角の点は、描くマスを付け替えたので読み直す）
    ivec4 ti = moved ? tileAt(t) : tiOwn;
    int fid = min(ti.g, FLOOR_N - 1);
    int mat = fid;
    // 自然の型の縁：材質ごとに、まわり4マスの中心での「その材質か」をなめらかに補間し、ノイズを足して 0.5 を超えれば覆う。
    // 境目はマスの境目の内外へふらつき、角は丸くなる。優先度の高い材質から覆うかを見る（人の手の型は自分のマスだけを覆う）
    if ((ti.a & 1) != 0) {
      int ids[4] = int[4](q00.g, q10.g, q01.g, q11.g);
      float nz = (vnoise(wp / 5.0, 831u) - 0.5) * 0.45;
      int bestP = -1;
      for (int i = 0; i < 4; i++) {
        int c = ids[i];
        if (c >= FLOOR_N || FLOOR_PRIO[c] <= bestP) continue;
        bool cov;
        if (edgeBuilt(c)) cov = c == fid;
        else {
          float sv = mix(mix(float(q00.g == c), float(q10.g == c), qf.x), mix(float(q01.g == c), float(q11.g == c), qf.x), qf.y);
          cov = sv + nz > 0.5;
        }
        if (cov) { mat = c; bestP = FLOOR_PRIO[c]; }
      }
    }
    // 人の手の型の縁の石：ほかの床に接する縁の石（8px 角を半分ずつずらして並べた石）の一部は、抜けたり欠けたりして下の材質がのぞく
    bool hole = false;
    int hb0x = 0;
    int hb0y = 0;
    int hside = -1;
    if (mat == fid && edgeBuilt(fid) && (ti.b & 15) != 0) {
      int row = w.y >> 3;
      int sh = (row & 1) * 4;
      int col = (w.x + sh) >> 3;
      int bx0 = col * 8 - sh;
      int by0 = row * 8;
      int tx0 = t.x * 16;
      int ty0 = t.y * 16;
      int side = -1;
      if ((ti.b & 1) != 0 && by0 == ty0) side = 0;
      else if ((ti.b & 4) != 0 && by0 + 8 == ty0 + 16) side = 2;
      else if ((ti.b & 8) != 0 && bx0 <= tx0) side = 3;
      else if ((ti.b & 2) != 0 && bx0 + 8 >= tx0 + 16) side = 1;
      if (side >= 0) {
        float bh = h01(ivec2(col, row), 821u);
        if (bh < 0.1) hole = true;
        else if (bh < 0.27) {
          // 欠け：外側の縁から、半円にえぐれる
          int dOut = side == 0 ? w.y - by0 : side == 2 ? by0 + 7 - w.y : side == 3 ? w.x - max(bx0, tx0) : min(bx0 + 7, tx0 + 15) - w.x;
          int along = side == 0 || side == 2 ? w.x - bx0 : w.y - by0;
          float c = 1.5 + h01(ivec2(col, row), 822u) * 4.0;
          hole = length(vec2(float(along) - c, float(dOut))) < 2.6;
        }
        if (hole) {
          ivec2 dir = side == 0 ? ivec2(0, -1) : side == 1 ? ivec2(1, 0) : side == 2 ? ivec2(0, 1) : ivec2(-1, 0);
          mat = min(tileAt(t + dir).g, FLOOR_N - 1);
          hb0x = max(bx0, tx0);
          hb0y = by0;
          hside = side;
        }
      }
    }
    // 材質ごとの模様（材質を足したら、ここに模様の描き方を足す）
    if (mat == 1) {
      // 石畳
      idx = floorIdx(ivec2(w.x & 15, w.y & 15));
      if (idx == 3 && h < 0.07) idx = 2;
      else if (idx == 3 && h > 0.95) idx = 4;
    } else {
      // 岩床
      vec4 st = stones(wp + 0.5, vec2(7.0, 6.0), 11u);
      if (st.y - st.x < 1.0) idx = 1;
      else {
        idx = st.z < 0.25 ? 2 : 3;
        if (st.w < -0.4) idx += 1;
        else if (st.w > 0.45) idx -= 1;
        if (h > 0.97) idx += 1;
      }
    }
    // 人の手の型の材質は、下の材質よりわずかに高く敷かれているように見せる：南の縁に暗い側面、北の縁に明るい線
    if (!hole && mat == fid && edgeBuilt(fid)) {
      if ((ti.b & 4) != 0 && l.y >= 14) idx = l.y == 15 ? 1 : 2;
      else if ((ti.b & 1) != 0 && l.y == 0) idx = 4;
    }
    // 高い材質から落ちる影：北の隣が高ければ上の 3px、東西の隣が高ければその側の 2px を一段暗く
    if (mat == fid) {
      if ((ti.b & 16) != 0 && l.y < 3) idx -= 1;
      if ((ti.b & 32) != 0 && l.x > 13) idx -= 1;
      if ((ti.b & 128) != 0 && l.x < 2) idx -= 1;
    }
    // 抜けた石の穴：まわりの石から穴の底へ落ちる影（北と西の縁。縁が外の床に開いている側は除く）
    if (hole) {
      if (w.y - hb0y < 2 && hside != 0) idx -= 1;
      if (w.x - hb0x < 1 && hside != 3) idx -= 1;
    }
    if (mat == 1 && mat == fid && !hole && (th & 7u) == 0u) {
      int ax = int((th >> 3u) & 7u) + 3;
      int ay = int((th >> 6u) & 7u) + 2;
      int dx = l.x - ax;
      int dy = l.y - ay;
      if (dy >= 0 && dy < 6 && (dx == dy / 2 || (dx == dy / 2 + 1 && dy % 2 == 1))) idx = 1;
    }
    // 壁の足もとは暗く（見た目の壁から 2px 以内は二段、4px 以内は一段。左右は 2px 以内を一段）。
    // 近い4マスに壁が無ければ、調べる点（4px 以内）にも壁は無いので省く
    if ((((q00.r | q10.r | q01.r | q11.r) & 1) != 0)) {
      if (wallPx(w - ivec2(0, 2))) idx -= 2;
      else if (wallPx(w - ivec2(0, 4))) idx -= 1;
      if (wallPx(w - ivec2(2, 0)) || wallPx(w + ivec2(2, 0))) idx -= 1;
    }
    alb = ramp(idx);
    vec2 fuv = (wp + 0.5) / 16.0 / vec2(uMapSize);
    vec4 fld = texture(uField, fuv);
    vec2 glw = texture(uGlow, fuv).rg;
    // 養分の多い土は、わずかに黒く湿って見える
    float rich = smoothstep(0.35, 0.95, fld.a);
    if (rich > 0.0 && !handmade(mat)) {
      alb *= mix(vec3(1.0), vec3(0.8, 0.82, 0.7), rich * 0.7);
      if (h01(w, 77u) < rich * 0.16) alb = vec3(58.0, 44.0, 36.0) / 255.0;
    }
    // 溶岩のそばは焼けて赤茶ける
    float scorch = smoothstep(0.12, 0.6, glw.g);
    if (scorch > 0.0) alb = mix(alb, alb * vec3(1.05, 0.72, 0.6), scorch);
    // 湧き水と吸い込み穴（あるマスだけ地図のテクスチャを読む）
    float feat = (ti.a & 128) != 0 ? texelFetch(uMap, t, 0).b : 0.0;
    // 吸い込み穴
    if (feat > 0.55) {
      float r = length((vec2(l) - 7.5) * vec2(1.0, 1.35));
      if (r < 4.6) alb = r < 3.2 ? cK : ca;
    }
    float md = smoothstep(0.22, 0.62, fld.r);
    if (md > 0.0) {
      if (h01(w, 500u) < md) {
        float v = h01(w, 900u);
        alb = v < 0.4 ? mg : (v < 0.75 ? mh : (v < 0.93 ? mf : mi));
        emis = v >= 0.93 && md > 0.7;
      }
    }
    // 微生物の膜：溶岩のまわりに白、黄、橙、赤茶の縞。端はまだらにかすれ、ほのかに光る
    float mt = fld.g;
    if (mt > 0.05 && !handmade(mat)) {
      float band = floor(glw.g * 9.0 + h01(w / 2, 7u) * 1.6);
      int bi = int(mod(band, 6.0));
      vec3 mc = bi == 0 ? vec3(226.0, 206.0, 168.0) : bi == 1 ? vec3(236.0, 176.0, 80.0) : bi == 2 ? vec3(220.0, 120.0, 48.0) : bi == 3 ? vec3(178.0, 76.0, 38.0) : bi == 4 ? vec3(214.0, 188.0, 128.0) : vec3(204.0, 140.0, 64.0);
      float cover = smoothstep(0.05, 0.75, mt);
      if (h01(w / 2, 9u) < cover * 0.9) {
        alb = mix(alb, mc / 255.0, 0.72 * cover);
        matGlow = 0.11 * cover * (0.75 + 0.25 * sin(uTime * 0.7 + float(band)));
      }
    }
    // ---- 床の上の状態の段 ----
    // 状態（岩のかけら、焼け跡、微生物の膜、苔、水、溶岩）は、それぞれ量を持ち、床の材質を選ばずに上へ重なる。
    // 量はマスの中心の値をなめらかに補間して読み、境目にまだらなノイズを入れる（マスの四角で切れないように）。
    // 掘りたての床：崩れた岩のかけらが散らばる。散らばる範囲の縁は、まわりのマスの「掘りたてか」を補間してまだらにする
    float dugv = float((ti.a >> 1) & 1);
    if ((ti.a & 4) != 0) dugv = mix(mix(float((q00.a >> 1) & 1), float((q10.a >> 1) & 1), qf.x), mix(float((q01.a >> 1) & 1), float((q11.a >> 1) & 1), qf.x), qf.y);
    if (dugv > 0.0 && h01(w, 62u) < smoothstep(0.3, 0.7, dugv + (vnoise(wp / 4.0, 63u) - 0.5) * 0.4)) {
      float r = h01(w, 61u);
      if (r < 0.18) alb = vec3(132.0, 124.0, 140.0) / 255.0;
      else if (r < 0.3) alb = vec3(52.0, 46.0, 60.0) / 255.0;
      else if (r < 0.34) alb = vec3(160.0, 150.0, 140.0) / 255.0;
    }
    // キノコ：小さな柄と薄紫の傘。傘のてっぺんがほのかに光る
    float fd = texelFetch(uGlow, t, 0).b;
    if (fd > 0.01) {
      for (int i = 0; i < 6; i++) {
        uint hh = hash2(t, 300u + uint(i));
        if (float(hh & 255u) / 255.0 > fd * 1.6) continue;
        int ax = 2 + int((hh >> 8u) % 12u);
        int ay = 5 + int((hh >> 12u) % 10u);
        int sz = 1 + int((hh >> 16u) & 1u) * (fd > 0.4 ? 1 : 0);
        int dx = l.x - ax;
        int dy = l.y - ay;
        if (dx == 0 && dy <= 0 && dy >= -sz) { alb = dy == 0 ? vec3(176.0, 166.0, 166.0) / 255.0 : vec3(212.0, 204.0, 198.0) / 255.0; emis = false; }
        else if (dy == -sz - 1 && abs(dx) <= sz) { alb = abs(dx) == sz ? vec3(78.0, 40.0, 100.0) / 255.0 : vec3(118.0, 66.0, 150.0) / 255.0; emis = false; }
        else if (dy == -sz - 2 && abs(dx) <= sz - 1) { alb = vec3(128.0, 78.0, 186.0) / 255.0; emis = true; }
        if (dx == 0 && dy == -sz - 2 + (sz == 1 ? 1 : 0)) { alb = vec3(214.0, 170.0, 255.0) / 255.0; emis = true; }
        if (sz == 1 && dy == -2 && abs(dx) == 1) { alb = vec3(100.0, 58.0, 150.0) / 255.0; emis = true; }
      }
    }
    // 水
    float wd = fld.b;
    float wth = 0.06 + h01(w, 3u) * 0.05;
    if (wd > wth) {
      isWater = true;
      emis = false;
      float dep = smoothstep(0.06, 0.6, wd);
      vec3 wc = mix(vec3(48.0, 92.0, 120.0), vec3(16.0, 34.0, 74.0), dep) / 255.0;
      alb = mix(alb * 0.7, wc, 0.4 + 0.5 * dep);
      // さざ波の線
      int ry = w.y + int(floor(2.0 * sin(float(w.x) * 0.22 + uTime * 1.5)));
      if (ry % 6 == 0 && h01(ivec2(w.x / 3, ry), 9u) < 0.6) alb = mix(alb, vec3(120.0, 172.0, 204.0) / 255.0, 0.45);
      // 水際
      vec2 pc = wp + 0.5;
      float wmin = min(min(waterAt(pc + vec2(0.0, -1.0)), waterAt(pc + vec2(0.0, 1.0))), min(waterAt(pc + vec2(-1.0, 0.0)), waterAt(pc + vec2(1.0, 0.0))));
      if (wmin <= wth) alb = vec3(150.0, 192.0, 208.0) / 255.0;
    }
    // 湧き水：水面に広がる輪
    if (feat > 0.2 && feat < 0.55) {
      float r = length(vec2(l) - 7.5);
      float ring = abs(r - mod(uTime * 5.0, 8.0));
      if (ring < 0.7 && r < 7.5) alb = mix(alb, vec3(0.78, 0.9, 0.96), 0.6);
      if (r < 1.5) alb = vec3(0.78, 0.9, 0.96);
    }
    // 溶岩：床より一段低い溜まりに、黒い岩の皮が浮かび、そのすき間で溶けた岩が光る。
    // 岸はマスの四角に沿わず、数 px ずつ内外へふらつく（lavaField）。まわり4マスに溶岩が無ければ何もしない
    if ((((q00.a | q10.a | q01.a | q11.a) >> 6) & 1) != 0) {
      vec2 pc = wp + 0.5;
      // 岸からの距離のおおよそ（px）。正なら溶岩の中、負なら床
      float ld = (lavaField(pc) - 0.5) * 16.0;
      if (ld > 0.0) {
        lavaPx = true;
        vec4 st = stones(pc + vec2(uTime * 1.1, uTime * 0.45), vec2(9.0, 8.0), 61u);
        float pulse = 0.5 + 0.5 * sin(uTime * 1.6 + st.z * 6.28);
        float gap = st.y - st.x;
        if (gap < 1.6) alb = mix(vec3(255.0, 170.0, 60.0), vec3(255.0, 225.0, 140.0), pulse) / 255.0;
        else if (st.z < 0.62) alb = gap < 2.8 ? vec3(120.0, 38.0, 20.0) / 255.0 : vec3(56.0, 20.0, 18.0) / 255.0 * (0.85 + 0.3 * pulse);
        else alb = mix(vec3(214.0, 70.0, 22.0), vec3(255.0, 128.0, 40.0), pulse) / 255.0;
        // 岸に寄るほど皮が厚く冷えて黒い（岸から 1〜3px。幅はなめらかにふらつく）。そのすぐ内側で溶けた岩が明るく縁取る
        float crust = 1.2 + vnoise(pc / 4.0, 643u) * 1.8;
        if (ld < crust) alb = h < 0.7 ? vec3(40.0, 22.0, 24.0) / 255.0 : vec3(78.0, 32.0, 24.0) / 255.0;
        else if (ld < crust + 1.0) alb = mix(alb, vec3(255.0, 150.0, 50.0) / 255.0, 0.6);
        emis = ld >= crust;
        // 北の岸：床が溜まりへ落ちる岩の側面（3px）が見える（壁の正面と同じく、南から見下ろしているので北の岸だけ）。
        // 岸から 6px より奥の点は、3px 北もかならず溶岩なので調べない
        if (ld < 6.0 && lavaField(pc - vec2(0.0, 3.0)) <= 0.5) {
          vec4 bs = stones(pc, vec2(7.0, 4.0), 644u);
          alb = bs.y - bs.x < 0.9 ? vec3(28.0, 18.0, 22.0) / 255.0 : (bs.z < 0.5 ? vec3(62.0, 40.0, 40.0) : vec3(84.0, 52.0, 44.0)) / 255.0;
          emis = false;
          // 側面のいちばん上は床の縁（明るく）、いちばん下は溶けた岩との境（赤く光る）
          if (lavaField(pc - vec2(0.0, 1.0)) <= 0.5) alb = vec3(104.0, 70.0, 64.0) / 255.0;
          else if (lavaField(pc - vec2(0.0, 2.0)) > 0.5) { alb = vec3(200.0, 70.0, 26.0) / 255.0; emis = true; }
        }
        isWater = false;
      } else if (ld > -2.5) {
        // 岸の床：縁は溶けた岩の熱で焼けて黒ずむ（溜まりに近いほど濃く、まだらに）
        float k = smoothstep(-2.5, 0.0, ld);
        if (bayer(w) < k * 0.85) alb = mix(alb, vec3(46.0, 28.0, 28.0) / 255.0, 0.7);
      }
    }
    // 焼け跡：灰で黒く沈み、まだ熱いうちは熾火がまだらに光る
    // 灰の量と燃えている度合いはなめらかに補間して読む（炎の舌だけは、マスごとの「もの」としてマスの値で描く）
    vec4 fx = texture(uFx, fuv);
    vec4 fxT = fx.r > 0.001 || fx.g > 0.01 ? texelFetch(uFx, t, 0) : vec4(0.0);
    if (fx.g > 0.01 && fxT.r < 0.01) {
      // 灰の濃さはまわり4マスの最大値。補間した値（最大値に対する割合）は、どこまで覆うかだけに使う
      // （補間した値をそのまま濃さにすると、1マスだけの焼け跡が縁に向かって薄れ、ぼやけて見えなくなる）
      ivec2 a0 = max(ivec2(floor((wp + 0.5) / 16.0 - 0.5)), ivec2(0));
      float aMax = max(max(texelFetch(uFx, a0, 0).g, texelFetch(uFx, a0 + ivec2(1, 0), 0).g), max(texelFetch(uFx, a0 + ivec2(0, 1), 0).g, texelFetch(uFx, a0 + ivec2(1, 1), 0).g));
      float a = aMax * smoothstep(0.35, 0.6, fx.g / max(aMax, 0.001) + (vnoise(wp / 3.0, 70u) - 0.5) * 0.35);
      float ah = h01(w, 71u);
      vec3 ashC = ah < 0.3 ? vec3(18.0, 14.0, 16.0) : (ah < 0.7 ? vec3(34.0, 28.0, 30.0) : vec3(58.0, 50.0, 48.0));
      alb = mix(alb, ashC / 255.0, a * 0.85);
      uint eh = hash2(w / 2, 72u + uint(floor(uTime * 1.5)));
      // 熾火は燃え尽きた直後（地上の1時間ほど）だけ、だんだん少なく
      // （燃え尽きたマスの値で決め、補間した灰の量の割合で縁ほど少なく）
      if (fxT.g > 0.955 && float(eh & 1023u) < (fxT.g - 0.955) * 500.0 * min(1.0, fx.g / fxT.g)) { alb = h01(w, 73u) < 0.5 ? vec3(1.0, 0.45, 0.14) : vec3(0.75, 0.2, 0.08); emis = true; }
    }
    // 燃えているマス：焦げた床に熾火がまだらに光り、炎の舌があちこちから揺れながら立ち上がる。
    // 焦げた床と熾火は、燃えている度合いを補間した範囲（縁はまだら）、炎の舌は燃えているマスの中だけ
    // （燃えているマスの値は 0.47 以上。隣が燃えていなければ、マスの境目で補間した値はその半分ほどになる）
    float burnC = fx.r > 0.01 ? smoothstep(0.12, 0.3, fx.r + (vnoise(wp / 3.0, 78u) - 0.5) * 0.2) : 0.0;
    if (burnC > 0.0) {
      float bn = max(fxT.r, fx.r);
      float eh = h01(w / 2, 76u);
      alb = mix(alb, mix(alb * 0.35, vec3(26.0, 16.0, 16.0) / 255.0, 0.6), burnC);
      uint fl = hash2(w / 2, 77u + uint(floor(uTime * 6.0)));
      if (eh < 0.35 * bn * burnC) { alb = float(fl & 3u) == 0.0 ? vec3(255.0, 170.0, 60.0) / 255.0 : vec3(190.0, 60.0, 22.0) / 255.0; emis = true; }
      isWater = false;
    }
    if (fxT.r > 0.01) {
      float bn = fxT.r;
      float fr = floor(uTime * 9.0);
      int nT = 2 + int(bn * 3.0);
      for (int c = 0; c < 5; c++) {
        if (c >= nT) break;
        uint hh = hash2(t * 8 + ivec2(c, 3), 74u + uint(fr) * 7u);
        uint hp = hash2(t * 8 + ivec2(c, 5), 75u);
        float hgt = (4.0 + float(hh & 7u) + float(hp & 3u)) * (0.45 + 0.55 * bn);
        float cx = 1.5 + float(hp % 13u) + sin(uTime * 7.0 + float(c) * 2.1) * 0.6;
        float base = 15.0 - float((hp >> 4) % 6u);
        float dy = base - float(l.y);
        if (dy < 0.0 || dy >= hgt) continue;
        float v = dy / hgt;
        float hw = 1.9 * (1.0 - pow(v, 1.3)) + 0.3;
        float sx = sin(dy * 0.5 + uTime * 8.0 + float(c) * 1.7) * v * 1.4;
        float dx2 = abs(float(l.x) + 0.5 - cx - sx);
        if (dx2 < hw) {
          float ci = v * 2.8 + dx2 / hw * 1.2;
          alb = ci < 0.8 ? vec3(255.0, 248.0, 214.0) / 255.0 : ci < 1.6 ? vec3(255.0, 214.0, 100.0) / 255.0 : ci < 2.5 ? vec3(255.0, 150.0, 44.0) / 255.0 : vec3(224.0, 80.0, 26.0) / 255.0;
          emis = true;
        }
      }
      isWater = false;
    }
  }

  // 瓦礫：割れた岩のかけらが積み重なった低い山。まわりに小石
  if (rub) {
    vec2 lc = vec2(l) + 0.5 - vec2(8.0, 9.0);
    float md = length(lc * vec2(1.0, 1.3));
    vec4 st = stones(wp + 0.5, vec2(4.0, 3.5), 77u);
    float gap = st.y - st.x;
    if (md < 7.6 - st.z * 1.6) {
      float hgt = 1.0 - md / 7.6;
      float litv = clamp(0.45 - (lc.x + lc.y) * 0.035 + st.z * 0.35 + hgt * 0.3, 0.0, 1.0);
      alb = gap < 0.85 ? vec3(38.0, 32.0, 36.0) / 255.0 : mix(vec3(70.0, 62.0, 62.0), vec3(140.0, 128.0, 116.0), litv) / 255.0;
    } else if (hash2(w, 79u) % 19u == 0u) alb = vec3(96.0, 88.0, 84.0) / 255.0;
    emis = false;
    isWater = false;
    tkind = 0;
    edgeLine = false;
  }

  if (uDebug == 1) { o = vec4(alb, 1.0); return; }
  vec2 luv = ((wp + 0.5 - uLmOrigin - 2.0) / 4.0 + 0.5) / uLmSize;
  vec3 L = texture(uLight, luv).rgb * 2.0;
  float bq = bayer(w);
  vec3 col;
  if (emis) {
    col = alb;
  } else {
    // ごく弱い光では網点を出さない（未踏の暗闇はまっ暗に保つ）
    vec3 q = floor(L * 6.0 + bq * clamp(L * 5.0, 0.0, 1.0)) / 6.0;
    col = alb * q * 1.15;
    col = max(col, alb * matGlow * 2.2);
    // 照り返し：近くの光源の光が、まわりの岩や床にほのかに回り込む（光の地図を広く八方から拾う）
    {
      vec3 bounce = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.39;
        bounce += texture(uLight, ((wp + vec2(cos(a), sin(a)) * 30.0 + 0.5 - uLmOrigin - 2.0) / 4.0 + 0.5) / uLmSize).rgb * 2.0;
      }
      bounce /= 8.0;
      col += alb * bounce * (s == 1 ? 0.10 : 0.16);
    }
    float lum = (q.r + q.g + q.b) / 3.0;
    if (isWater) col += q * vec3(0.06, 0.1, 0.14);
    // 水面のきらめき
    if (isWater && lum > 0.25) {
      uint sh = hash2(w + ivec2(0, int(uTime * 2.0)), 91u);
      if (float(sh & 1023u) < lum * 26.0) col += normalize(L + 0.001) * 0.55;
    }
    if (lum > 0.85) {
      float ww = (lum - 0.85) * 0.6;
      col.r += alb.r * ww * 0.5 + 40.0 / 255.0 * ww;
      col.g += alb.g * ww * 0.3 + 20.0 / 255.0 * ww;
    } else if (lum < 0.5) {
      float c2 = (0.5 - lum) * 0.5;
      col *= vec3(1.0 - c2 * 0.5, 1.0 - c2 * 0.25, 1.0 + c2 * 0.4);
    }
    // 暗がり：光が届かなくても、地形は青く沈んだ色でいつも見える（神の視点）
    {
      float ga = dot(alb, vec3(0.3, 0.5, 0.2));
      // 光の届かない所：一段明るく、色も少し残す（地形や生き物が読めるように）
      vec3 dim = mix(vec3(ga), alb, 0.72) * vec3(0.60, 0.62, 0.76);
      // 岩の上面は、上から見下ろした岩肌として、光がなくても地層の色と模様が読める明るさで描く
      if (tkind == 2) dim = mix(vec3(ga), alb, 0.8) * vec3(0.74, 0.74, 0.82);
      dim = max(dim, alb * glint);
      col = max(col, dim);
    }
  }

  // 光暈（苔のにじみ）
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNumHalo) break;
    vec4 H = uH[i];
    float d = distance(wp + 0.5, H.xy);
    if (d >= H.z) continue;
    float a = 1.0 - d / H.z;
    a = floor(a * a * H.w * 4.0 + bq) / 4.0;
    col += uHC[i].rgb * a * (120.0 / 255.0);
  }

  // 光の筋と塵
  for (int i = 0; i < ${MAX_SHAFTS}; i++) {
    if (i >= uNumShaft) break;
    vec4 S = uS[i];
    if (S.z <= 0.0) continue;
    float u = (S.y - wp.y) / 96.0;
    if (u < 0.0 || u > 1.0) continue;
    float cx = S.x - u * 12.0;
    float hw = 14.0 - u * 6.0;
    float e = abs(wp.x + 0.5 - cx) / hw;
    if (e >= 1.0) continue;
    float a0 = pow(1.0 - e, 1.3) * (0.55 + 0.45 * (1.0 - u)) * (u > 0.9 ? (1.0 - u) / 0.1 : 1.0);
    float bb = floor(a0 * S.z * 0.3 * 5.0 + bq) / 5.0;
    col += vec3(255.0, 240.0, 205.0) / 255.0 * bb * 0.9;
    vec2 dpos = wp + vec2(0.0, -uTime * 5.0) + vec2(S.x * 3.1, 0.0);
    ivec2 dc = ivec2(floor(dpos / 5.0));
    uint dh = hash2(dc, 31u);
    if ((dh & 63u) < 3u && a0 > 0.15) {
      ivec2 dp = dc * 5 + ivec2(int((dh >> 6u) % 5u), int((dh >> 9u) % 5u));
      if (ivec2(floor(dpos)) == dp) {
        float tw = 0.5 + 0.5 * sin(uTime * 3.0 + float(dh & 255u));
        col += vec3(230.0, 220.0, 190.0) / 255.0 * tw * S.z;
      }
    }
  }

  // 壁際と角の床は少し暗く（奥行き）。暗がりの色にも大きなむらを少し持たせる
  // 壁までのおおよその距離（px）：まわり4マスの岩の量を点の位置でなめらかに補間した値から出す。
  // まっすぐな壁ぎわでは壁の縁からの距離と一致し、へこんだ角ほど近く、出っ張った角は丸く遠くなる（丸めた壁の形に沿う）
  float de = 16.0;
  if (s == 0) {
    float sv = mix(mix(float(q00.r & 1), float(q10.r & 1), qf.x), mix(float(q01.r & 1), float(q11.r & 1), qf.x), qf.y);
    de = max(0.0, (0.5 - sv) * 16.0);
  }
  if (s == 0 && !rub) {
    col *= mix(0.6, 1.0, smoothstep(0.0, 8.0, de + bq));
    float n = h01(t / 6, 611u) * 0.6 + h01(t / 3, 612u) * 0.4;
    col *= mix(vec3(0.94, 0.97, 1.06), vec3(1.06, 1.0, 0.92), n);
  }

  // マナ：濃い所ほど、床にかすかな紫のもやがゆらぎ、ときどき小さな光の粒がまたたく（光る）。岩の上面にはごく淡い紫の筋
  {
    vec2 muv = (wp / 16.0) / vec2(uMapSize);
    float mn = texture(uMana, muv).r;
    float mi = smoothstep(0.02, 0.55, mn);
    if (mi > 0.0) {
      if (s == 0) {
        float mist = 0.55 + 0.45 * sin(uTime * 0.35 + h01(t / 3, 731u) * 6.283 + float(w.x) * 0.02);
        float mpatch = h01(w / 6, 732u) * 0.5 + h01(w / 3, 733u) * 0.5;
        col += vec3(0.15, 0.05, 0.26) * mi * mist * (0.45 + 0.55 * mpatch);
        if (h01(w, 734u + uint(floor(uTime * 2.0))) < mi * 0.006) col = max(col, vec3(0.75, 0.55, 1.0));
      } else {
        if (h01(w / 2, 735u) < 0.06) col += vec3(0.05, 0.0, 0.09) * mi;
      }
    }
  }

  // 閉じた空洞：上に岩がかぶさっている。線は使わず、色を抜いて冷たく暗く沈め、壁に近いほど岩の色になじませる
  if (s == 0 && sealedAt(t)) {
    float g = dot(col, vec3(0.3, 0.5, 0.2));
    // 溶岩は色を残し、暗い赤に沈める（色を抜くと冷えた石と見分けがつかない）
    col = lavaPx ? mix(vec3(g), col, 0.8) * vec3(0.62, 0.40, 0.38) : mix(vec3(g), col, 0.35) * vec3(0.42, 0.46, 0.60);
    float k = smoothstep(0.0, 9.0, de + bq * 2.0);
    col = mix(vec3(0.035, 0.034, 0.048), col, 0.35 + 0.65 * k);
  }

  o = vec4(softClip(col), 1.0);
}
`;

// 3. 画面へ整数倍で拡大して写す
export const FS_BLIT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uTex;
uniform sampler2D uBloom;
uniform int uScale;
uniform float uBloomStr;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) / uScale;
  vec3 c = texelFetch(uTex, p, 0).rgb;
  vec2 sz = vec2(textureSize(uTex, 0));
  vec2 uv = (vec2(p) + 0.5) / sz;
  // 光のにじみ（明るい所だけを取り出してぼかしたもの）を重ねる
  vec3 b = texture(uBloom, uv).rgb;
  c += b * uBloomStr;
  // 画面の縁をわずかに暗く
  vec2 d = (uv - 0.5) * vec2(1.0, sz.y / sz.x) * 2.0;
  c *= 1.0 - 0.22 * smoothstep(0.55, 1.35, length(d));
  o = vec4(c, 1.0);
}
`;

/** にじみ：絵を4分の1に縮めながら、明るい所だけを取り出す */
export const FS_BRIGHT = `#version 300 es
precision highp float;
uniform sampler2D uTex;
out vec4 o;
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * 4;
  ivec2 sz = textureSize(uTex, 0);
  vec3 acc = vec3(0.0);
  for (int y = 0; y < 4; y++)
    for (int x = 0; x < 4; x++) {
      vec3 c = texelFetch(uTex, min(b + ivec2(x, y), sz - 1), 0).rgb;
      float l = dot(c, vec3(0.3, 0.55, 0.15));
      acc += c * smoothstep(0.5, 0.95, l);
    }
  o = vec4(acc / 16.0, 1.0);
}
`;

/** にじみ：一方向のぼかし（9点） */
export const FS_BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 o;
void main() {
  vec2 sz = vec2(textureSize(uTex, 0));
  vec2 uv = gl_FragCoord.xy / sz;
  vec2 st = uDir / sz;
  vec3 c = texture(uTex, uv).rgb * 0.227;
  c += (texture(uTex, uv + st * 1.38).rgb + texture(uTex, uv - st * 1.38).rgb) * 0.316;
  c += (texture(uTex, uv + st * 3.23).rgb + texture(uTex, uv - st * 3.23).rgb) * 0.070;
  o = vec4(c, 1.0);
}
`;

export const MAX_DYN = 48;

// 4. 生き物（インスタンス描画）
export const VS_SPRITE = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aPos;
layout(location = 1) in vec4 aRect;
layout(location = 2) in vec4 aInfo;
uniform vec2 uOrigin;
uniform vec2 uArtSize;
out vec2 vLocal;
flat out vec4 vRect;
flat out vec4 vInfo;
flat out vec4 vPos;
const vec2 CORNER[6] = vec2[6](vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 1.0));
void main() {
  vec2 local = CORNER[gl_VertexID] * aRect.zw;
  float axf = aPos.w > 0.5 ? aRect.z - aInfo.x : aInfo.x;
  vec2 p = vec2(floor(aPos.x) - axf, floor(aPos.y) - aPos.z - aInfo.y) - uOrigin + local;
  gl_Position = vec4(p.x / uArtSize.x * 2.0 - 1.0, 1.0 - p.y / uArtSize.y * 2.0, 0.0, 1.0);
  vLocal = local;
  vRect = aRect;
  vInfo = aInfo;
  vPos = aPos;
}
`;

export const FS_SPRITE = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uAtlas;
uniform sampler2D uLight;
uniform vec2 uLmOrigin;
uniform vec2 uLmSize;
uniform float uTime;
in vec2 vLocal;
flat in vec4 vRect;
flat in vec4 vInfo;
flat in vec4 vPos;
out vec4 o;
uint hash2(ivec2 p, uint s) {
  uint h = uint(p.x) * 374761393u + uint(p.y) * 668265263u + s * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
float bayer(ivec2 w) {
  const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return B[(w.x & 3) + (w.y & 3) * 4] / 16.0;
}
vec3 lightAt(vec2 wp) { return texture(uLight, ((wp + 0.5 - uLmOrigin - 2.0) / 4.0 + 0.5) / uLmSize).rgb * 2.0; }
bool solidPx(ivec2 l) {
  int w = int(vRect.z);
  if (l.x < 0 || l.y < 0 || l.x >= w || l.y >= int(vRect.w)) return false;
  int lx = vPos.w > 0.5 ? w - 1 - l.x : l.x;
  return texelFetch(uAtlas, ivec2(vRect.xy) + ivec2(lx, l.y), 0).a > 0.5;
}
// 明るさの頭打ちをやわらかく：0.78 を超えると、上限 1 へゆるやかに近づく（色合いは保つ）
vec3 softClip(vec3 c) {
  float m = max(c.r, max(c.g, c.b));
  if (m <= 0.78) return c;
  float k = 0.78 + 0.22 * (1.0 - exp(-(m - 0.78) / 0.22));
  return c * (k / m);
}
void main() {
  ivec2 l = ivec2(floor(vLocal));
  int w = int(vRect.z);
  int lx = vPos.w > 0.5 ? w - 1 - l.x : l.x;
  vec4 tx = texelFetch(uAtlas, ivec2(vRect.xy) + ivec2(lx, l.y), 0);
  if (tx.a < 0.5) discard;
  float a8 = floor(tx.a * 255.0 + 0.5);
  float axf = vPos.w > 0.5 ? vRect.z - vInfo.x : vInfo.x;
  vec2 wp = vec2(floor(vPos.x) - axf + float(l.x), floor(vPos.y) - vPos.z - vInfo.y + float(l.y));
  ivec2 wi = ivec2(wp);
  float glow = vInfo.z;
  float kind = floor(vInfo.w);
  float phase = fract(vInfo.w);
  // 傷を受けた瞬間（kind に 20 を足す）
  bool flash = kind > 19.5;
  if (flash) kind -= 20.0;
  // 閉じた空洞の中の生き物は、岩越しに暗く見える
  bool veiled = kind > 9.5;
  if (veiled) kind -= 10.0;
  // 攻撃の演出（kind 4）：ふつうの小物と同じく照らされるが、暗がりでも半分ほどは自ら見える
  bool fxLit = kind > 3.5 && kind < 4.5;
  if (fxLit) kind = 2.0;
  // 地形の一部として描くもの（kind 5。ワームが押し上げた岩）：地形の岩と同じく、暗がりでの明るさの下限を、生き物の下限ではなく地形の岩の上面と同じにする
  bool terrLit = kind > 4.5 && kind < 5.5;
  if (terrLit) kind = 2.0;
  // ヴァンパイアの眷属（kind 6）：その姿のまま、血の気の失せた青白い色に（赤いもの＝血・裏地・目は、赤のまま残す）。照らされ方は生き物と同じ
  if (kind > 5.5 && kind < 6.5) {
    float l = dot(tx.rgb, vec3(0.3, 0.5, 0.2));
    bool red = tx.r > 0.35 && tx.r > tx.g * 1.8 && tx.r > tx.b * 1.6;
    if (!red) tx.rgb = mix(vec3(30.0, 32.0, 48.0), vec3(214.0, 222.0, 236.0), clamp(l * 1.25, 0.0, 1.0)) / 255.0;
    if (a8 > 251.5 && a8 < 253.5) a8 = 255.0;
    kind = 1.0;
  }
  // 石像：その姿のまま石の色に（光る部分も光らない）
  if (kind > 2.5) {
    float l = dot(tx.rgb, vec3(0.3, 0.5, 0.2));
    tx.rgb = mix(vec3(34.0, 36.0, 44.0), vec3(168.0, 172.0, 180.0), clamp(l * 1.15, 0.0, 1.0)) / 255.0;
    if (a8 < 254.5 && a8 > 250.5) a8 = 255.0;
    glow = 0.0;
  }
  // それ自体が光る（ウィスプ）
  if (a8 > 252.5 && a8 < 253.5) { o = vec4(tx.rgb, 1.0); return; }
  // 宝のきらめき：光が当たっているときだけ光る
  if (a8 > 249.5 && a8 < 250.5) {
    vec3 Lk = lightAt(wp + vec2(0.0, vPos.z));
    float lk = (Lk.r + Lk.g + Lk.b) / 3.0;
    if (lk > 0.12) { o = vec4(tx.rgb * (0.8 + 0.4 * lk), 1.0); return; }
    a8 = 255.0;
  }
  // ゴースト：暗闇でもかすかに青白く透け、光の中ではよく見える
  if (a8 > 250.5 && a8 < 251.5) {
    vec3 Lg = lightAt(wp + vec2(0.0, vPos.z));
    float lg = clamp((Lg.r + Lg.g + Lg.b) / 3.0, 0.0, 1.0);
    float a = 0.32 + 0.68 * lg;
    if (bayer(wi) > a + 0.25) discard;
    o = vec4(softClip(tx.rgb * (0.45 + 0.6 * lg)), 1.0);
    return;
  }
  // 光を帯びたときに光る模様（種ごとに決まった場所）。青白く、呼吸するように明滅する
  bool pattern = a8 > 251.5 && a8 < 252.5;
  if (pattern && glow > 0.03) {
    float pulse = 0.62 + 0.38 * sin(uTime * 2.2 + phase * 6.2832);
    float e = clamp(glow * 1.5, 0.0, 1.0) * pulse;
    if (e > 0.12) { o = vec4(mix(tx.rgb * 0.4, vec3(0.74, 0.92, 1.0), 0.35 + 0.65 * e) * (0.55 + 0.6 * e), 1.0); return; }
  }
  vec3 L = lightAt(wp + vec2(0.0, vPos.z));
  float bq = bayer(wi);
  vec3 q = floor(L * 6.0 + bq * clamp(L * 5.0, 0.0, 1.0)) / 6.0;
  float lum = (q.r + q.g + q.b) / 3.0;
  vec3 col = tx.rgb * q * 1.15;
  // 暗がりでも、姿は青く沈んだ色でいつも見える
  if (terrLit) {
    // （地形の岩の上面と同じ下限：光がなくても地層の色と模様が読める明るさ）
    float ga = dot(tx.rgb, vec3(0.3, 0.5, 0.2));
    col = max(col, mix(vec3(ga), tx.rgb, 0.8) * vec3(0.74, 0.74, 0.82));
  } else {
    float ga = dot(tx.rgb, vec3(0.3, 0.5, 0.2));
    col = max(col, mix(vec3(ga), tx.rgb, 0.75) * vec3(0.72, 0.74, 0.86));
  }
  if (lum > 0.85) {
    float ww = (lum - 0.85) * 0.6;
    col.r += tx.r * ww * 0.5 + 40.0 / 255.0 * ww;
    col.g += tx.g * ww * 0.3 + 20.0 / 255.0 * ww;
  } else if (lum < 0.5) {
    float c2 = (0.5 - lum) * 0.5;
    col *= vec3(1.0 - c2 * 0.5, 1.0 - c2 * 0.25, 1.0 + c2 * 0.4);
  }
  // 縁取り光：光の強くなる向きの輪郭だけを光らせる
  if (kind < 1.5) {
    float lx0 = dot(lightAt(wp + vec2(-3.0, 0.0)), vec3(0.333));
    float lx1 = dot(lightAt(wp + vec2(3.0, 0.0)), vec3(0.333));
    float ly0 = dot(lightAt(wp + vec2(0.0, -3.0)), vec3(0.333));
    float ly1 = dot(lightAt(wp + vec2(0.0, 3.0)), vec3(0.333));
    vec2 g = vec2(lx1 - lx0, ly1 - ly0);
    if (length(g) > 0.03) {
      vec2 d = normalize(g);
      ivec2 s = ivec2(abs(d.x) > 0.38 ? int(sign(d.x)) : 0, abs(d.y) > 0.38 ? int(sign(d.y)) : 0);
      if (!solidPx(l + s)) col += normalize(L + 0.001) * 0.42 * min(1.0, lum * 1.6);
    }
  }
  if (fxLit) {
    float lumT = dot(tx.rgb, vec3(0.3, 0.5, 0.2));
    col = max(col, tx.rgb * (lumT > 0.75 ? 0.85 : 0.5));
  }
  // 傷を受けた瞬間：体の色に白を少し混ぜ、縁をいっそう明るく（体全体を塗りつぶさない）
  if (flash) {
    bool edge = !solidPx(l + ivec2(1, 0)) || !solidPx(l + ivec2(-1, 0)) || !solidPx(l + ivec2(0, 1)) || !solidPx(l + ivec2(0, -1));
    col = mix(col, vec3(1.0), edge ? 0.5 : 0.15);
  }
  // 閉じた空洞の中の生き物：色を抜いて冷たく暗く（光る模様は岩の奥からぼんやり透ける）
  if (veiled) { float g = dot(col, vec3(0.3, 0.5, 0.2)); col = mix(vec3(g), col, 0.4) * vec3(0.42, 0.46, 0.60); }
  o = vec4(softClip(col), 1.0);
}
`;

// 5. 足元の影（掛け合わせで暗くする）
export const VS_SHADOW = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aPos;
uniform vec2 uOrigin;
uniform vec2 uArtSize;
out vec2 vD;
out vec2 vW;
const vec2 CORNER[6] = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));
void main() {
  vec2 c = CORNER[gl_VertexID];
  vec2 wp = floor(aPos.xy) + c * (aPos.zw + 1.0);
  vec2 p = wp - uOrigin;
  gl_Position = vec4(p.x / uArtSize.x * 2.0 - 1.0, 1.0 - p.y / uArtSize.y * 2.0, 0.0, 1.0);
  vD = c * (aPos.zw + 1.0) / aPos.zw;
  vW = wp;
}
`;
// 足元の影は、光の中にいるときだけ落とす（暗闇の生き物の居場所を影で明かさない）
export const FS_SHADOW = `#version 300 es
precision highp float;
uniform sampler2D uLight;
uniform vec2 uLmOrigin;
uniform vec2 uLmSize;
in vec2 vD;
in vec2 vW;
out vec4 o;
void main() {
  float d = dot(vD, vD);
  if (d > 1.0) discard;
  vec3 L = texture(uLight, ((vW - uLmOrigin - 2.0) / 4.0 + 0.5) / uLmSize).rgb * 2.0;
  float lum = (L.r + L.g + L.b) / 3.0;
  if (lum < 0.1) discard;
  float k = mix(1.0, d < 0.55 ? 0.5 : 0.7, clamp((lum - 0.1) * 3.0, 0.0, 1.0));
  o = vec4(vec3(k), 1.0);
}
`;
