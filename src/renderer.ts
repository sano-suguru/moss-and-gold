import type { World } from './world';
import type { Atlas } from './atlas';
import { FLOORS, floorId } from './floors';
import { FS_BLIT, FS_BLUR, FS_BRIGHT, FS_LIGHT, FS_SCENE, FS_SHADOW, FS_SPRITE, MAX_DYN, MAX_LIGHTS, MAX_SHAFTS, VS_FULL, VS_SHADOW, VS_SPRITE } from './shaders';

export interface FrameLights {
  /** 光源ごとに4つずつ：位置 x, y、半径 r、強さ intensity */
  pos: Float32Array;
  /** 光源ごとに4つずつ：色 r, g, b と、壁で遮られるか occ（1 なら影を落とす） */
  col: Float32Array;
  n: number;
}
export interface FrameParams {
  originX: number;
  originY: number;
  artW: number;
  artH: number;
  scale: number;
  time: number;
  lights: FrameLights;
  halos: FrameLights;
  shafts: Float32Array;
  nShafts: number;
  debug?: number;
  /** 光を帯びた生き物の光（x, y, r, 強さ） */
  dyn: Float32Array;
  nDyn: number;
  /** 生き物の描画（1体あたり12個の数：位置4、アトラスの矩形4、情報4） */
  sprites: Float32Array;
  nSprites: number;
  /** 足元の影（x, y, 半径x, 半径y） */
  shadows: Float32Array;
  nShadows: number;
}

const GLOW_SCALE = 120;

type Uniforms = Record<string, WebGLUniformLocation | null>;

function compile(gl: WebGL2RenderingContext, type: number, src: string, name: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`シェーダー（${name}）を準備できませんでした: ${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

function program(gl: WebGL2RenderingContext, fs: string, name: string, names: string[], vs = VS_FULL): { p: WebGLProgram; u: Uniforms } {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, name));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, name));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`シェーダー（${name}）をつなげませんでした: ${gl.getProgramInfoLog(p)}`);
  }
  const u: Uniforms = {};
  for (const n of names) u[n] = gl.getUniformLocation(p, n);
  return { p, u };
}

function makeTex(gl: WebGL2RenderingContext, filter: number): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private light;
  private scene;
  private blit;
  private bright;
  private blur;
  private bloomTex: WebGLTexture[];
  private bloomFb: WebGLFramebuffer[];
  private bW = 1;
  private bH = 1;
  private sprite;
  private shadow;
  private atlasTex: WebGLTexture;
  private spriteBuf: WebGLBuffer;
  private spriteVao: WebGLVertexArrayObject;
  private shadowBuf: WebGLBuffer;
  private shadowVao: WebGLVertexArrayObject;
  private vao: WebGLVertexArrayObject;
  private mapTex: WebGLTexture;
  // マスごとの描き方の情報（tileInfo が作る。壁の角の丸め方、床の材質、高さの違う縁、掘りたてか）
  private tileTex: WebGLTexture;
  private tileData: Uint8Array = new Uint8Array(0);
  private fieldTex: WebGLTexture;
  private manaTex: WebGLTexture;
  private manaData = new Uint8Array(0);
  private glowTex: WebGLTexture;
  private fxTex: WebGLTexture;
  private fxData: Uint8Array = new Uint8Array(0);
  private lightTex: WebGLTexture;
  private artTex: WebGLTexture;
  private lightFb: WebGLFramebuffer;
  private artFb: WebGLFramebuffer;
  private mapData: Uint8Array = new Uint8Array(0);
  private fieldData: Uint8Array = new Uint8Array(0);
  private glowData: Uint8Array = new Uint8Array(0);
  private mapW = 0;
  private mapH = 0;
  private lmW = 0;
  private lmH = 0;
  private aW = 0;
  private aH = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false });
    if (!gl) throw new Error('この端末やブラウザではWebGL2が使えないため、ダンジョンを描けません。最新のブラウザで開いてください。');
    this.gl = gl;
    this.light = program(gl, FS_LIGHT, '光', ['uMap', 'uGlow', 'uFx', 'uMapSize', 'uLmOrigin', 'uNum', 'uL', 'uC', 'uAmbient', 'uMossCol', 'uLavaCol', 'uNumD', 'uDL', 'uDCol']);
    this.sprite = program(gl, FS_SPRITE, '生き物', ['uOrigin', 'uArtSize', 'uAtlas', 'uLight', 'uLmOrigin', 'uLmSize', 'uTime'], VS_SPRITE);
    this.shadow = program(gl, FS_SHADOW, '影', ['uOrigin', 'uArtSize', 'uLight', 'uLmOrigin', 'uLmSize'], VS_SHADOW);
    this.atlasTex = makeTex(gl, gl.NEAREST);
    this.spriteBuf = gl.createBuffer()!;
    this.spriteVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    this.shadowBuf = gl.createBuffer()!;
    this.shadowVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.shadowVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.bindVertexArray(null);
    this.scene = program(gl, FS_SCENE, '場面', [
      'uMap', 'uField', 'uGlow', 'uLight', 'uFx', 'uMana', 'uTile', 'uMapSize', 'uOrigin', 'uArtSize', 'uLmOrigin', 'uLmSize', 'uTime',
      'uNumHalo', 'uH', 'uHC', 'uNumShaft', 'uS', 'uDebug',
    ]);
    this.blit = program(gl, FS_BLIT, '拡大', ['uTex', 'uBloom', 'uScale', 'uBloomStr']);
    this.bright = program(gl, FS_BRIGHT, 'にじみの取り出し', ['uTex']);
    this.blur = program(gl, FS_BLUR, 'にじみのぼかし', ['uTex', 'uDir']);
    this.bloomTex = [makeTex(gl, gl.LINEAR), makeTex(gl, gl.LINEAR)];
    this.bloomFb = [gl.createFramebuffer()!, gl.createFramebuffer()!];
    this.vao = gl.createVertexArray()!;
    this.mapTex = makeTex(gl, gl.NEAREST);
    this.tileTex = makeTex(gl, gl.NEAREST);
    this.fieldTex = makeTex(gl, gl.LINEAR);
    this.manaTex = makeTex(gl, gl.LINEAR);
    this.glowTex = makeTex(gl, gl.LINEAR);
    this.fxTex = makeTex(gl, gl.LINEAR);
    this.lightTex = makeTex(gl, gl.LINEAR);
    this.artTex = makeTex(gl, gl.NEAREST);
    this.lightFb = gl.createFramebuffer()!;
    this.artFb = gl.createFramebuffer()!;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  setWorld(w: World): void {
    const gl = this.gl;
    const m = w.map;
    this.mapW = m.w;
    this.mapH = m.h;
    const N = m.w * m.h;
    this.mapData = new Uint8Array(N * 4);
    this.tileData = new Uint8Array(N * 4);
    this.uploadMap(w);
    this.fieldData = new Uint8Array(N * 4);
    this.glowData = new Uint8Array(N * 4);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, m.w, m.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, this.glowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, m.w, m.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.manaData = new Uint8Array(N);
    gl.bindTexture(gl.TEXTURE_2D, this.manaTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, m.w, m.h, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    this.fxData = new Uint8Array(N * 4);
    gl.bindTexture(gl.TEXTURE_2D, this.fxTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, m.w, m.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.updateFx(w);
    this.updateFields(w);
    this.updateGlow(w);
  }

  /** 地形（岩・溶岩・湧き水と吸い込み穴と掘りたての床・石畳）。掘られたら送り直す */
  uploadMap(w: World): void {
    const gl = this.gl;
    const m = w.map;
    const N = m.w * m.h;
    const feat = new Uint8Array(N);
    for (let k = 0; k < N; k++) if (m.dug[k]) feat[k] = 40;
    for (const s of m.springs) feat[s.y * m.w + s.x] = 85;
    for (const s of m.sinks) feat[s.y * m.w + s.x] = 170;
    for (let k = 0; k < N; k++) {
      this.mapData[k * 4] = m.solid[k] ? 255 : 0;
      this.mapData[k * 4 + 1] = m.lava[k] ? 255 : 0;
      this.mapData[k * 4 + 2] = feat[k];
      this.mapData[k * 4 + 3] = (m.paved[k] ? 128 : 0) | (m.rubble[k] ? 64 : 0) | (m.sealed[k] && !m.solid[k] ? 32 : 0) | (m.solid[k] && !m.rubble[k] ? (m.hard[k] === 0 ? 8 : m.hard[k] === 2 ? 16 : 0) : 0);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, m.w, m.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.mapData);
    tileInfo(m, this.tileData);
    gl.bindTexture(gl.TEXTURE_2D, this.tileTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, m.w, m.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.tileData);
  }

  setAtlas(a: Atlas): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, a.width, a.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, a.data);
    a.dirty.length = 0;
  }

  /** 名簿の冒険者のコマなど、あとから描き足したます目だけを送り直す */
  flushAtlas(a: Atlas): void {
    if (!a.dirty.length) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, a.width);
    for (const [x, y, w, h] of a.dirty) {
      gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a.data);
    }
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    a.dirty.length = 0;
  }

  /** 苔、見たマス、水、養分 */
  updateFields(w: World): void {
    const gl = this.gl;
    const d = this.fieldData;
    for (let k = 0; k < w.moss.length; k++) {
      d[k * 4] = w.moss[k];
      d[k * 4 + 1] = w.mat[k];
      d[k * 4 + 2] = Math.min(255, (w.water[k] * 255) / 300);
      d[k * 4 + 3] = Math.min(255, (w.nutr[k] * 255) / 160);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.mapW, this.mapH, gl.RGBA, gl.UNSIGNED_BYTE, d);
    // マナ（0〜64 を 0〜255 に。濃い所は頭打ち）
    const md = this.manaData;
    for (let k = 0; k < w.mana.length; k++) md[k] = Math.min(255, w.mana[k] * 4);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.manaTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.mapW, this.mapH, gl.RED, gl.UNSIGNED_BYTE, md);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  }

  /** 苔と溶岩の光のにじみ */
  updateGlow(w: World): void {
    const gl = this.gl;
    const d = this.glowData;
    for (let k = 0; k < w.mossGlow.length; k++) {
      d[k * 4] = Math.min(255, w.mossGlow[k] * GLOW_SCALE);
      d[k * 4 + 1] = Math.min(255, w.lavaGlow[k] * GLOW_SCALE);
      d[k * 4 + 2] = w.fungus[k];
      d[k * 4 + 3] = Math.min(255, w.fungusGlow[k] * GLOW_SCALE);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.glowTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.mapW, this.mapH, gl.RGBA, gl.UNSIGNED_BYTE, d);
  }

  /** 燃えているマスと焼け跡を送る */
  updateFx(w: World): void {
    const gl = this.gl;
    const d = this.fxData;
    for (let k = 0; k < w.burn.length; k++) {
      d[k * 4] = w.burn[k] ? Math.min(255, 120 + w.burn[k] * 4) : 0;
      d[k * 4 + 1] = w.ash[k];
    }
    gl.bindTexture(gl.TEXTURE_2D, this.fxTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.mapW, this.mapH, gl.RGBA, gl.UNSIGNED_BYTE, d);
  }

  private ensureTargets(artW: number, artH: number): void {
    const gl = this.gl;
    const lmW = Math.ceil(artW / 4) + 5;
    const lmH = Math.ceil(artH / 4) + 5;
    if (lmW !== this.lmW || lmH !== this.lmH) {
      this.lmW = lmW;
      this.lmH = lmH;
      gl.bindTexture(gl.TEXTURE_2D, this.lightTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, lmW, lmH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightFb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.lightTex, 0);
    }
    if (artW !== this.aW || artH !== this.aH) {
      // にじみ用の小さな絵（4分の1）
      this.bW = Math.max(1, Math.ceil(artW / 4));
      this.bH = Math.max(1, Math.ceil(artH / 4));
      for (let i = 0; i < 2; i++) {
        gl.bindTexture(gl.TEXTURE_2D, this.bloomTex[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.bW, this.bH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFb[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.bloomTex[i], 0);
      }
      this.aW = artW;
      this.aH = artH;
      gl.bindTexture(gl.TEXTURE_2D, this.artTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, artW, artH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.artFb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.artTex, 0);
    }
  }

  render(f: FrameParams): void {
    const gl = this.gl;
    this.ensureTargets(f.artW, f.artH);
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);

    const lmX = Math.floor(f.originX / 4) * 4 - 8;
    const lmY = Math.floor(f.originY / 4) * 4 - 8;

    // 1. 光の地図
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightFb);
    gl.viewport(0, 0, this.lmW, this.lmH);
    let { p, u } = this.light;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
    gl.uniform1i(u.uMap, 0);
    gl.uniform2i(u.uMapSize, this.mapW, this.mapH);
    gl.uniform2f(u.uLmOrigin, lmX, lmY);
    gl.uniform1i(u.uNum, f.lights.n);
    gl.uniform4fv(u.uL, f.lights.pos);
    gl.uniform4fv(u.uC, f.lights.col);
    if (f.debug === 2) gl.uniform3f(u.uAmbient, 0.5, 0.48, 0.45);
    else gl.uniform3f(u.uAmbient, 0.012, 0.01, 0.025);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.glowTex);
    gl.uniform1i(u.uGlow, 1);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.fxTex);
    gl.uniform1i(u.uFx, 4);
    const gk = 255 / GLOW_SCALE;
    gl.uniform3f(u.uMossCol, 0.42 * 0.5 * gk, 0.98 * 0.5 * gk, 0.82 * 0.5 * gk);
    gl.uniform3f(u.uLavaCol, 1.0 * 1.25 * gk, 0.45 * 1.25 * gk, 0.15 * 1.25 * gk);
    gl.uniform1i(u.uNumD, Math.min(MAX_DYN, f.nDyn));
    gl.uniform4fv(u.uDL, f.dyn);
    gl.uniform3f(u.uDCol, 0.66, 0.86, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. 場面
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.artFb);
    gl.viewport(0, 0, f.artW, f.artH);
    ({ p, u } = this.scene);
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.lightTex);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.glowTex);
    gl.uniform1i(u.uMap, 0);
    gl.uniform1i(u.uField, 1);
    gl.uniform1i(u.uLight, 2);
    gl.uniform1i(u.uGlow, 3);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.fxTex);
    gl.uniform1i(u.uFx, 4);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this.manaTex);
    gl.uniform1i(u.uMana, 5);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.tileTex);
    gl.uniform1i(u.uTile, 6);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2i(u.uMapSize, this.mapW, this.mapH);
    gl.uniform2f(u.uOrigin, f.originX, f.originY);
    gl.uniform2f(u.uArtSize, f.artW, f.artH);
    gl.uniform2f(u.uLmOrigin, lmX, lmY);
    gl.uniform2f(u.uLmSize, this.lmW, this.lmH);
    gl.uniform1f(u.uTime, f.time);
    gl.uniform1i(u.uNumHalo, f.halos.n);
    gl.uniform4fv(u.uH, f.halos.pos);
    gl.uniform4fv(u.uHC, f.halos.col);
    gl.uniform1i(u.uNumShaft, f.nShafts);
    gl.uniform4fv(u.uS, f.shafts);
    gl.uniform1i(u.uDebug, f.debug ?? 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2b. 足元の影と生き物（場面の上に重ねる）
    if (f.nShadows > 0) {
      ({ p, u } = this.shadow);
      gl.useProgram(p);
      gl.uniform2f(u.uOrigin, f.originX, f.originY);
      gl.uniform2f(u.uArtSize, f.artW, f.artH);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.lightTex);
      gl.uniform1i(u.uLight, 1);
      gl.uniform2f(u.uLmOrigin, lmX, lmY);
      gl.uniform2f(u.uLmSize, this.lmW, this.lmH);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.DST_COLOR, gl.ZERO);
      gl.bindVertexArray(this.shadowVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuf);
      gl.bufferData(gl.ARRAY_BUFFER, f.shadows.subarray(0, f.nShadows * 4), gl.STREAM_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, f.nShadows);
      gl.disable(gl.BLEND);
    }
    if (f.nSprites > 0) {
      ({ p, u } = this.sprite);
      gl.useProgram(p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.lightTex);
      gl.uniform1i(u.uAtlas, 0);
      gl.uniform1i(u.uLight, 1);
      gl.uniform2f(u.uOrigin, f.originX, f.originY);
      gl.uniform2f(u.uArtSize, f.artW, f.artH);
      gl.uniform2f(u.uLmOrigin, lmX, lmY);
      gl.uniform2f(u.uLmSize, this.lmW, this.lmH);
      gl.uniform1f(u.uTime, f.time);
      gl.bindVertexArray(this.spriteVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
      gl.bufferData(gl.ARRAY_BUFFER, f.sprites.subarray(0, f.nSprites * 12), gl.STREAM_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, f.nSprites);
    }
    gl.bindVertexArray(this.vao);

    // 3. にじみ：明るい所を取り出して縮め、横と縦にぼかす
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, this.bW, this.bH);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFb[0]);
    gl.useProgram(this.bright.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.artTex);
    gl.uniform1i(this.bright.u.uTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(this.blur.p);
    gl.uniform1i(this.blur.u.uTex, 0);
    for (let pass = 0; pass < 2; pass++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFb[1]);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomTex[0]);
      gl.uniform2f(this.blur.u.uDir, 1, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFb[0]);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomTex[1]);
      gl.uniform2f(this.blur.u.uDir, 0, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 4. 画面へ（にじみを重ね、縁をわずかに暗く）
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    ({ p, u } = this.blit);
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.artTex);
    gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTex[0]);
    gl.uniform1i(u.uBloom, 1);
    gl.uniform1f(u.uBloomStr, 0.7);
    gl.uniform1i(u.uScale, f.scale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }
}

export function newLights(): FrameLights {
  return { pos: new Float32Array(MAX_LIGHTS * 4), col: new Float32Array(MAX_LIGHTS * 4), n: 0 };
}
export function newShafts(): Float32Array {
  return new Float32Array(MAX_SHAFTS * 4);
}
export { MAX_DYN, MAX_LIGHTS, MAX_SHAFTS };

/**
 * マスごとの描き方の情報を求める（地形シェーダーが uTile として読む。地形が変わるたびに uploadMap から呼ぶ）。
 * 見た目だけのもので、シミュレーションには使わない。1マス4バイト：
 * - R：壁と角の丸め方。bit0 壁か（瓦礫を除く岩。地図の外も壁とみなす）。bit1〜4 左上・右上・左下・右下の角を丸めるか。
 *   壁のマスでは、その角をはさむ横と縦の隣がどちらも床なら削る（出っ張った角）。
 *   床のマスでは、横・縦・斜めの隣がすべて岩なら岩を張り出させる（へこんだ角）。
 *   角を囲む4マスのどれかが人の手のもの（人の手の床、それに面した壁）か瓦礫なら、直角のまま
 * - G：床の材質の番号（src/floors.ts の FLOORS の位置）。壁は 255
 * - B：高さの違う縁（人の手の型の材質は、下の材質よりわずかに高く見せる）。bit0〜3 は北・東・南・西の隣が、
 *   このマスより下の床（このマスが人の手の型で、隣の床のほうが優先度が低い）。bit4〜7 は北・東・南・西の隣が、このマスより上の床
 * - A：bit0 自然の型の縁を求める必要があるか（まわり8マスに、このマスと重なり合う自然の型の材質がある）。
 *   bit1 掘りたての床か。bit2 まわり8マスに、掘りたてかどうかが違う床がある（岩のかけらの散らばる範囲の縁を、なめらかに求める）。
 *   bit3 岩の内部か（このマスとまわり8マスがすべて壁。上面や縁の判定を省く）。
 *   bit4 壁のマスで、まわり8マスか真下に人の手の床がある（切り石の天端の判定をするか）。
 *   bit5 瓦礫か。bit6 溶岩か。bit7 湧き水か吸い込み穴がある（そのときだけ地図のテクスチャを読む）
 */
export function tileInfo(
  m: {
    w: number;
    h: number;
    solid: ArrayLike<number>;
    rubble: ArrayLike<number>;
    paved: ArrayLike<number>;
    dug: ArrayLike<number>;
    lava: ArrayLike<number>;
    springs: { x: number; y: number }[];
    sinks: { x: number; y: number }[];
  },
  out: Uint8Array,
): void {
  const { w, h } = m;
  const feat = new Uint8Array(w * h);
  for (const q of [...m.springs, ...m.sinks]) feat[q.y * w + q.x] = 1;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const wall = (x: number, y: number) => !inMap(x, y) || (!!m.solid[y * w + x] && !m.rubble[y * w + x]);
  // 床の材質（壁と地図の外は -1）
  const fl = (x: number, y: number) => (wall(x, y) ? -1 : floorId(m, y * w + x));
  const handmade = (x: number, y: number) => {
    const f = fl(x, y);
    return f >= 0 && FLOORS[f].built;
  };
  const square = (x: number, y: number) => {
    if (!inMap(x, y)) return false;
    if (m.rubble[y * w + x] || handmade(x, y)) return true;
    return wall(x, y) && handmade(x, y + 1);
  };
  const dug = (x: number, y: number) => inMap(x, y) && !wall(x, y) && !!m.dug[y * w + x];
  const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const self = wall(x, y);
      let b = self ? 1 : 0;
      for (let q = 0; q < 4; q++) {
        const hx = x + (q & 1 ? 1 : -1);
        const vy = y + (q & 2 ? 1 : -1);
        const hw = wall(hx, y);
        const vw = wall(x, vy);
        const round = self ? !hw && !vw : hw && vw && wall(hx, vy);
        if (!round) continue;
        if (square(x, y) || square(hx, y) || square(x, vy) || square(hx, vy)) continue;
        b |= 2 << q;
      }
      out[k] = b;
      const f = fl(x, y);
      out[k + 1] = f < 0 ? 255 : f;
      let e = 0;
      let a = 0;
      if (f >= 0) {
        const F = FLOORS[f];
        for (let d = 0; d < 4; d++) {
          const g = fl(x + D4[d][0], y + D4[d][1]);
          if (g < 0 || g === f) continue;
          if (F.edge === 'built' && FLOORS[g].prio < F.prio) e |= 1 << d;
          if (FLOORS[g].edge === 'built' && FLOORS[g].prio > F.prio) e |= 16 << d;
        }
        const myDug = dug(x, y);
        if (myDug) a |= 2;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const g = fl(x + dx, y + dy);
            if (g < 0) continue;
            if (g !== f && FLOORS[g].edge === 'natural' && (FLOORS[g].prio > F.prio || F.edge === 'natural')) a |= 1;
            if (dug(x + dx, y + dy) !== myDug) a |= 4;
          }
      }
      if (self) {
        let inner = true;
        let nearHand = handmade(x, y + 1);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!wall(x + dx, y + dy)) inner = false;
            if (handmade(x + dx, y + dy)) nearHand = true;
          }
        if (inner) a |= 8;
        if (nearHand) a |= 16;
      }
      const kk = y * w + x;
      if (m.rubble[kk]) a |= 32;
      if (m.lava[kk]) a |= 64;
      if (feat[kk]) a |= 128;
      out[k + 2] = e;
      out[k + 3] = a;
    }
}
