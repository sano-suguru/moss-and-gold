import { MAP_H, MAP_W, TILE } from './mapgen';
import { Camera, Input, deviceScale } from './input';
import { MAX_LIGHTS, MAX_SHAFTS, Renderer, newLights, newShafts } from './renderer';
import { load, packBits, packI32, packU8, save, unpackBits, unpackI32, unpackU8, type SaveData } from './save';
import { buildAtlas } from './atlas';
import { CreatureView } from './creatureView';
import { CR_EVERY } from './ecology';
import { DAY_TICKS, TICKS_PER_SEC, World, dayIntensity, timeLabel } from './world';
import { JOB_NAMES, NAMES, renderEvent } from './names';

// 確認用の表示：URL の末尾に #lit（全体を明るく照らす）か #albedo（地形の色だけ）を付ける（#clean,lit のように並べてもよい）
const debugMode = (): number => {
  const q = new URLSearchParams(location.search).get('debug');
  // #clean,lit のように、ほかの指定と並べてもよい
  const h = location.hash.slice(1).split(',');
  return h.includes('albedo') || q === 'albedo' ? 1 : h.includes('lit') || q === 'lit' ? 2 : 0;
};
let DEBUG = debugMode();
// #clean を付けると画面の部品を隠す（見た目の確認用）
const applyClean = () => document.body.classList.toggle('clean', location.hash.includes('clean') || location.hash.includes('fxdemo'));
window.addEventListener('hashchange', () => {
  DEBUG = debugMode();
  applyClean();
});
window.addEventListener('DOMContentLoaded', applyClean);
applyClean();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function randomSeed(): string {
  const kana = 'かきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ';
  let s = '';
  for (let i = 0; i < 4; i++) s += kana[Math.floor(Math.random() * kana.length)];
  return s;
}

function showError(msg: string): void {
  const e = $('error');
  e.textContent = msg;
  e.hidden = false;
}

function boot(): void {
  const canvas = $<HTMLCanvasElement>('cv');
  let renderer: Renderer;
  try {
    renderer = new Renderer(canvas);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
    return;
  }

  const atlas = buildAtlas();
  renderer.setAtlas(atlas);
  const view = new CreatureView(atlas);
  let saved = load();
  const cam: Camera = { x: 0, y: 0, zoom: 2 };
  let world: World;
  let speed = saved?.speed ?? 1;
  if (![0, 1, 3, 10, 30].includes(speed)) speed = 1;
  let lastGlowV = -1;
  let acc = 0;
  let sinceSeen = 0;
  // 演出のデモ（URL の末尾に #fxdemo）：明るく開けた所に技の見本の組を並べ、技を繰り返す
  const DEMO = location.hash.includes('fxdemo');
  let demoAcc = 0;
  let seenBigHit = -1;
  let hitStopUntil = 0;

  const startWorld = (seed: string, keep: boolean) => {
    const N = MAP_W * MAP_H;
    world =
      keep && saved
        ? new World(seed, {
            tick: saved.tick,
            seen: unpackBits(saved.seen, N),
            water: unpackI32(saved.water, N),
            nutr: unpackI32(saved.nutr, N),
            moss: unpackU8(saved.moss, N),
            fungus: unpackU8(saved.fungus, N),
            burn: unpackU8(saved.burn, N),
            ash: unpackU8(saved.ash, N),
            mat: unpackU8(saved.mat, N),
            mana: saved.mana ? unpackI32(saved.mana, N) : undefined,
            manaBorn: saved.manaBorn,
            manaLeaked: saved.manaLeaked,
            manaFaded: saved.manaFaded,
            born: saved.born,
            washed: saved.washed,
            digs: saved.digs,
            eco: saved.eco,
          })
        : new World(seed);
    if (keep && saved) {
      cam.x = saved.cam.x;
      cam.y = saved.cam.y;
      cam.zoom = saved.cam.zoom;
    } else {
      // 入口にいちばん近い光の筋から眺め始める
      const e = world.map.entrance;
      let best = world.map.shafts[0];
      let bd = Infinity;
      for (const s of world.map.shafts) {
        const d = (s.x - e.x) ** 2 + (s.y - e.y) ** 2;
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      cam.x = (best ? best.x : e.x) * TILE + 8;
      cam.y = (best ? best.y : e.y + 4) * TILE + 8;
      cam.zoom = 2;
    }
    if (DEMO) {
      // 開けた床がいちばん多い所（入口側の洞窟のうち）を探して、見本を並べる
      const m = world.map;
      let bk = -1;
      let bv = -1;
      for (let y = 10; y < m.h - 10; y += 3)
        for (let x = 18; x < m.w - 18; x += 3) {
          let v = 0;
          for (let dy = -6; dy <= 6; dy += 2) for (let dx = -16; dx <= 16; dx += 2) { const k = (y + dy) * m.w + x + dx; if (!m.solid[k] && !m.sealed[k] && !m.lava[k] && world.water[k] < 20) v++; }
          if (v > bv) {
            bv = v;
            bk = y * m.w + x;
          }
        }
      const cx = (bk % m.w) * TILE + 8;
      const cy = Math.floor(bk / m.w) * TILE + 8;
      world.eco.demoSetup(cx, cy);
      for (const c of world.eco.list) world.seen[Math.floor(c.y / TILE) * m.w + Math.floor(c.x / TILE)] = 1;
      for (let k = 0; k < world.eco.discovered.length; k++) world.eco.discovered[k] = 1;
      cam.x = cx;
      cam.y = cy;
      cam.zoom = 3;
      speed = 0;
      // 昼にして、見本のまわりをランプで照らす
      world.tick = Math.floor(world.tick / 14400) * 14400 + 7200;
      document.body.classList.add('clean');
    }
    world.computeGlow();
    world.updateSeen();
    renderer.setWorld(world);
    world.fieldsDirty = false;
    ($('seedInput') as HTMLInputElement).value = seed;
    updateZoomLabel();
  };

  const input = new Input(canvas, {
    cam,
    dpr: () => window.devicePixelRatio || 1,
    bounds: () => ({ w: MAP_W * TILE, h: MAP_H * TILE }),
    onZoom: () => updateZoomLabel(),
    onInteract: () => {
      hideHint();
    },
    onTap: (wx, wy) => onTap(wx, wy),
  });

  // ---- 触れる：一回で生き物の札、二回続けて触れると画面の部品を隠して絵だけ（もう一度で戻る） ----
  let tapTimer = 0;
  let lastTap = { t: -1e9, x: 0, y: 0 };
  let selected = 0;
  const card = $('card');
  const cardTitle = $('cardTitle');
  const cardLines = $('cardLines');
  let cardAt = 0;
  const closeCard = () => {
    selected = 0;
    card.hidden = true;
  };
  $('cardClose').addEventListener('click', closeCard);
  function onTap(wx: number, wy: number) {
    const now = performance.now();
    if (now - lastTap.t < 320 && Math.abs(wx - lastTap.x) + Math.abs(wy - lastTap.y) < 40) {
      clearTimeout(tapTimer);
      lastTap.t = -1e9;
      document.body.classList.toggle('clean');
      return;
    }
    lastTap = { t: now, x: wx, y: wy };
    clearTimeout(tapTimer);
    tapTimer = window.setTimeout(() => {
      const c = world.eco.pick(wx, wy);
      if (c) {
        selected = c.id;
        card.hidden = false;
        cardAt = 0;
      } else closeCard();
    }, 300);
  }
  // 地図を指で動かしたら、追いかけるのをやめる
  let downAt = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (selected && e.buttons && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) closeCard();
  });
  function updateCard(now: number) {
    if (!selected) return;
    const c = world.eco.list.find((o) => o.id === selected);
    if (!c || c.dead || c.away) {
      closeCard();
      return;
    }
    // カメラが生き物を追いかける（なめらかに）
    cam.x += (c.x - cam.x) * 0.12;
    cam.y += (c.y - 10 - cam.y) * 0.12;
    if (now - cardAt > 300) {
      cardAt = now;
      const d = world.eco.describe(c, NAMES, JOB_NAMES);
      cardTitle.textContent = d.title;
      cardLines.textContent = '';
      for (const l of d.lines) {
        const li = document.createElement('li');
        li.textContent = l;
        cardLines.append(li);
      }
    }
    // 札は生き物の頭の上に
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const k = dpr / deviceScale(cam.zoom, dpr);
    const sx = (c.x - cam.x) / k + r.width / 2;
    const sy = (c.y - 26 - cam.y) / k + r.height / 2;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const left = Math.min(r.width - cw - 8, Math.max(8, sx - cw / 2));
    card.style.left = `${left}px`;
    card.style.top = `${Math.max(8, sy - ch - 10)}px`;
    card.style.setProperty('--tail', `${Math.min(cw - 12, Math.max(12, sx - left))}px`);
  }

  // ---- たためる部品（たたんだ状態は覚えておく） ----
  const ui = (() => {
    try {
      return JSON.parse(localStorage.getItem('dungeon-aquarium-ui') || '{}');
    } catch {
      return {};
    }
  })() as Record<string, boolean>;
  const saveUi = () => {
    try {
      localStorage.setItem('dungeon-aquarium-ui', JSON.stringify(ui));
    } catch {
      /* 保存できなくてもよい */
    }
  };
  // 狭い画面では、はじめは地図をたたんでおく
  if (ui.map === undefined && window.innerWidth < 520) ui.map = true;
  const fold = (boxId: string, btnId: string, key: string, open: string, shut: string) => {
    const box = $(boxId);
    const btn = $(btnId);
    const apply = () => {
      box.classList.toggle('collapsed', !!ui[key]);
      btn.setAttribute('aria-expanded', String(!ui[key]));
      btn.textContent = ui[key] ? shut : open;
    };
    btn.addEventListener('click', () => {
      ui[key] = !ui[key];
      saveUi();
      apply();
    });
    apply();
  };
  fold('ctl', 'ctlFold', 'ctl', '▴', '▾');
  fold('mapbox', 'mapFold', 'map', '地図 ▴', '地図 ▾');
  fold('log', 'logFold', 'log', '▾', '▴');

  // 画面の操作
  const speedBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-speed]')];
  const syncSpeed = () => speedBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === speed)));
  speedBtns.forEach((b) =>
    b.addEventListener('click', () => {
      speed = Number(b.dataset.speed);
      syncSpeed();
    }),
  );
  syncSpeed();

  const panel = $('seedPanel');
  const toggle = $('seedToggle');
  const seedInput = $<HTMLInputElement>('seedInput');
  const setPanel = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) seedInput.focus();
  };
  toggle.addEventListener('click', () => setPanel(panel.hidden));
  const go = (seed: string) => {
    startWorld(seed, false);
    persist();
    setPanel(false);
  };
  $('seedGo').addEventListener('click', () => go(seedInput.value.trim() || randomSeed()));
  $('seedNew').addEventListener('click', () => go(randomSeed()));
  seedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go(seedInput.value.trim() || randomSeed());
    if (e.key === 'Escape') setPanel(false);
  });

  $('zoomIn').addEventListener('click', () => input.zoomBy(1));
  $('zoomOut').addEventListener('click', () => input.zoomBy(-1));
  function updateZoomLabel() {
    $('zoomLabel').textContent = `${cam.zoom}×`;
  }

  function hideHint() {}

  // ---- 記録：目立つ出来事を時刻つきで。触れるとその場所へ ----
  const logBox = $('log');
  const logList = $('logList');
  const logToggle = $('logToggle');
  logToggle.addEventListener('click', () => {
    const open = !logBox.classList.contains('open');
    logBox.classList.toggle('open', open);
    logToggle.setAttribute('aria-expanded', String(open));
    logToggle.textContent = open ? 'たたむ' : '広げる';
    logSig = '';
  });
  let logSig = '';
  function updateLog() {
    const e = world.eco;
    const disc = e.discovered.reduce((a, v) => a + v, 0);
    const sig = `${e.events.length}:${e.events.length ? e.events[e.events.length - 1].t : 0}:${disc}:${logBox.classList.contains('open')}`;
    if (sig === logSig) return;
    logSig = sig;
    if (!e.events.length) return;
    const open = logBox.classList.contains('open');
    const list = e.events.slice(open ? -60 : -3).reverse();
    logList.textContent = '';
    for (const ev of list) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = timeLabel(ev.t);
      b.append(t, renderEvent(ev.m, e.discovered));
      b.addEventListener('click', () => {
        cam.x = ev.x;
        cam.y = ev.y;
      });
      li.append(b);
      logList.append(li);
    }
  }

  // ---- 養分：生き物が使える量と、一日前からの増減 ----
  const nutriEl = $('nutri');
  let nutriAt = 0;
  let nutriHist: { t: number; v: number }[] = [];
  let nutriSeed = '';
  function updateNutri(now: number) {
    if (now - nutriAt < 1000) return;
    nutriAt = now;
    if (nutriSeed !== world.map.seed) {
      nutriSeed = world.map.seed;
      nutriHist = [];
    }
    const v = world.availableNutrients();
    const t = world.tick;
    if (!nutriHist.length || t - nutriHist[nutriHist.length - 1].t >= 600) nutriHist.push({ t, v });
    while (nutriHist.length > 2 && t - nutriHist[1].t >= DAY_TICKS) nutriHist.shift();
    const old = nutriHist[0];
    const amt = v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `${v}`;
    let ch = '—';
    if (old && t - old.t >= DAY_TICKS * 0.95 && old.v > 0) {
      const p = (v / old.v - 1) * 100;
      ch = `${p >= 0 ? '＋' : '−'}${Math.abs(p).toFixed(1)}％`;
    }
    nutriEl.textContent = `養分 ${amt}（1日で${ch}）`;
  }

  // ---- ミニマップ：開いた場所、照らされたことのある範囲、光源、いま見ている範囲 ----
  const mini = $('mini') as HTMLCanvasElement;
  mini.width = MAP_W;
  mini.height = MAP_H;
  const mctx = mini.getContext('2d')!;
  let mimg = mctx.createImageData(mini.width, mini.height);
  let lastMini = 0;
  let viewRect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  function drawMini(now: number) {
    if (now - lastMini < 400) return;
    lastMini = now;
    const m = world.map;
    if (mini.width !== m.w || mini.height !== m.h) {
      mini.width = m.w;
      mini.height = m.h;
      mimg = mctx.createImageData(m.w, m.h);
    }
    const d = mimg.data;
    for (let k = 0; k < m.w * m.h; k++) {
      let c: number[];
      if (m.rubble[k]) c = [92, 78, 64];
      else if (m.solid[k]) c = [10, 9, 14];
      else if (m.sealed[k] && !m.lava[k]) c = world.water[k] > 40 ? [24, 46, 62] : [30, 52, 56];
      else if (m.lava[k]) c = [190, 70, 26];
      else if (world.burn[k]) c = [255, 140, 40];
      else if (world.water[k] > 40) c = world.seen[k] ? [52, 92, 140] : [30, 50, 80];
      else c = world.seen[k] ? [104, 100, 118] : [52, 50, 64];
      d[k * 4] = c[0];
      d[k * 4 + 1] = c[1];
      d[k * 4 + 2] = c[2];
      d[k * 4 + 3] = 255;
    }
    mctx.putImageData(mimg, 0, 0);
    for (const l of world.lights()) {
      if (l.kind !== 'torch' && l.kind !== 'shaft') continue;
      mctx.fillStyle = l.kind === 'torch' ? '#ffb050' : '#fff2c0';
      mctx.fillRect(Math.floor(l.x / TILE) - 1, Math.floor(l.y / TILE) - 1, 2, 2);
    }
    mctx.strokeStyle = 'rgba(255,255,255,0.85)';
    mctx.lineWidth = 1;
    mctx.strokeRect(Math.floor(viewRect.x0 / TILE) + 0.5, Math.floor(viewRect.y0 / TILE) + 0.5, Math.max(2, Math.floor((viewRect.x1 - viewRect.x0) / TILE)), Math.max(2, Math.floor((viewRect.y1 - viewRect.y0) / TILE)));
  }
  mini.addEventListener('pointerdown', (ev) => {
    const r = mini.getBoundingClientRect();
    cam.x = ((ev.clientX - r.left) / r.width) * world.map.w * TILE;
    cam.y = ((ev.clientY - r.top) / r.height) * world.map.h * TILE;
    ev.stopPropagation();
  });

  function persist() {
    save({
      v: 3,
      seed: world.map.seed,
      tick: world.tick,
      cam: { x: cam.x, y: cam.y, zoom: cam.zoom },
      speed,
      seen: packBits(world.seen),
      water: packI32(world.water),
      nutr: packI32(world.nutr),
      moss: packU8(world.moss),
      fungus: packU8(world.fungus),
      burn: packU8(world.burn),
      ash: packU8(world.ash),
      mat: packU8(world.mat),
      mana: packI32(world.mana),
      manaBorn: world.manaBorn,
      manaLeaked: world.manaLeaked,
      manaFaded: world.manaFaded,
      born: world.born,
      washed: world.washed,
      digs: world.digs,
      eco: world.eco.serialize(),
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });
  window.addEventListener('pagehide', persist);
  setInterval(persist, 10000);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showError('描画が中断されました。ページを読み込み直すと、続きから眺められます。');
  });

  // 古い保存から引き継ぐのはシードだけ（tick が 0 のとき）。そのときは入口から眺め始める
  startWorld(saved?.seed ?? randomSeed(), !!saved && (saved.tick > 0 || !!saved.eco));
  // 見た目の確認用（スクショの道具）：ページを読み込み直さずに、保存と同じ形の場面を開く（絵の部品と WebGL を作り直さないので速い）
  (window as unknown as { __openScene: (json: string) => void }).__openScene = (json: string) => {
    saved = JSON.parse(json) as SaveData;
    speed = saved.speed ?? 0;
    startWorld(saved.seed, true);
    (window as unknown as { __frames: number; __hold?: boolean }).__frames = 0;
    (window as unknown as { __hold?: boolean }).__hold = false;
  };

  const lights = newLights();
  const halos = newLights();
  const shafts = newShafts();
  const clock = $('clock');
  let lastClock = '';
  let last = performance.now();

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  // 描いた回数（スクショの道具が、描き終わるのを待つのに使う）
  (window as unknown as { __frames: number }).__frames = 0;
  const frame = (now: number) => {
    // スクショの道具が描き終わりを待ったあと、描くのを止めて撮る（__hold）。止めている間は前の絵のまま
    const dbg = window as unknown as { __frames: number; __hold?: boolean };
    if (dbg.__hold) {
      last = now;
      requestAnimationFrame(frame);
      return;
    }
    dbg.__frames++;
    const raw = Math.max(0, (now - last) / 1000);
    last = now;
    input.update(Math.min(0.1, raw));

    // 強い一撃やとどめの瞬間は、ほんの一瞬（0.05秒）すべての動きを止める「ため」（速さ1×と3×のときだけ）
    if (world.eco.lastBigHit !== seenBigHit) {
      seenBigHit = world.eco.lastBigHit;
      if ((speed > 0 && speed <= 3) || DEMO) hitStopUntil = now + 50;
    }
    const stopped = now < hitStopUntil;
    // 決まった刻みでシミュレーションを進める（タブ復帰時の大きな飛びは1秒分までに抑える）
    if (!stopped) acc += Math.min(1, raw) * TICKS_PER_SEC * speed;
    let n = Math.floor(acc);
    acc -= n;
    if (n > 3000) {
      n = 3000;
      acc = 0;
    }
    if (DEMO) {
      // 演出のデモ：シミュレーションは回さず、時刻だけ進めて技を繰り返す
      if (!stopped) demoAcc += Math.min(0.1, raw) * TICKS_PER_SEC;
      while (demoAcc >= 1) {
        demoAcc -= 1;
        world.tick++;
        world.eco.demoTick();
        for (const c of world.eco.list) {
          c.px = c.x;
          c.py = c.y;
        }
      }
      n = 0;
    }
    for (let i = 0; i < n; i++) world.step();
    sinceSeen += n;
    if (world.terrainDirty) {
      world.terrainDirty = false;
      renderer.uploadMap(world);
    }
    if (world.fxDirty) {
      world.fxDirty = false;
      renderer.updateFx(world);
    }
    if (world.glowVersion !== lastGlowV) {
      lastGlowV = world.glowVersion;
      renderer.updateGlow(world);
    }
    if (sinceSeen >= 20) {
      sinceSeen = 0;
      world.updateSeen();
    }
    if (world.fieldsDirty) {
      renderer.updateFields(world);
      world.fieldsDirty = false;
    }

    resize();
    const dpr = window.devicePixelRatio || 1;
    const scale = deviceScale(cam.zoom, dpr);
    const artW = Math.ceil(canvas.width / scale);
    const artH = Math.ceil(canvas.height / scale);
    const ox = Math.round(cam.x - artW / 2);
    const oy = Math.round(cam.y - artH / 2);
    const t = now / 1000;

    // 画面に関わる光源だけを選ぶ
    const all = world.lights();
    const vis = all.filter((l) => l.x + l.r > ox - 8 && l.x - l.r < ox + artW + 8 && l.y + l.r > oy - 8 && l.y - l.r < oy + artH + 8);
    vis.sort((a, b) => b.i * b.r - a.i * a.r);
    lights.n = 0;
    halos.n = 0;
    for (const l of vis) {
      if (lights.n >= MAX_LIGHTS) break;
      const k = lights.n * 4;
      lights.pos.set([l.x, l.y, l.r, l.i], k);
      lights.col.set([l.c[0], l.c[1], l.c[2], l.occ ? 1 : 0], k);
      lights.n++;
    }
    let ns = 0;
    for (const l of all) {
      if (l.kind !== 'shaft' || ns >= MAX_SHAFTS) continue;
      if (l.x < ox - 40 || l.x > ox + artW + 40 || l.y < oy - 8 || l.y > oy + artH + 110) continue;
      shafts.set([l.x, l.y, l.i / 1.05, 0], ns * 4);
      ns++;
    }

    const alpha = Math.min(1, ((world.tick % CR_EVERY) + acc) / CR_EVERY);
    const cf = view.build(world.eco, { x0: ox, y0: oy, x1: ox + artW, y1: oy + artH }, t, alpha, dayIntensity(world.tick) <= 0);
    renderer.render({ originX: ox, originY: oy, artW, artH, scale, time: t, lights, halos, shafts, nShafts: ns, debug: DEBUG, ...cf });

    viewRect = { x0: ox, y0: oy, x1: ox + artW, y1: oy + artH };
    updateCard(now);
    {
      const chip = document.getElementById('ctlChip');
      if (chip) chip.textContent = `${speed === 0 ? '停止' : `${speed}×`}　${timeLabel(world.tick)}`;
    }
    updateNutri(now);
    drawMini(now);
    updateLog();
    const label = timeLabel(world.tick);
    if (label !== lastClock) {
      clock.textContent = label;
      lastClock = label;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

try {
  boot();
} catch (err) {
  showError(`起動できませんでした: ${err instanceof Error ? err.message : String(err)}`);
}
