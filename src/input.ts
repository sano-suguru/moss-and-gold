export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface Camera {
  /** 画面中央のワールド座標（ピクセル） */
  x: number;
  y: number;
  /** CSSピクセルあたりのドット数（整数倍） */
  zoom: number;
}

export interface InputHooks {
  cam: Camera;
  dpr: () => number;
  bounds: () => { w: number; h: number };
  onTap?: (wx: number, wy: number) => void;
  onZoom?: () => void;
  onInteract?: () => void;
}

export function deviceScale(zoom: number, dpr: number): number {
  return Math.max(1, Math.round(zoom * dpr));
}

export class Input {
  private pts = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private pinchD = 0;
  private wheelAcc = 0;
  private keys = new Set<string>();
  private moved = false;

  constructor(private el: HTMLElement, private h: InputHooks) {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    el.addEventListener('wheel', this.wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k);
        e.preventDefault();
      } else if (k === '+' || k === '=') this.zoomBy(1);
      else if (k === '-') this.zoomBy(-1);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** CSSピクセル1つ分がワールドで何ピクセルか */
  private worldPerCss(): number {
    const dpr = this.h.dpr();
    return dpr / deviceScale(this.h.cam.zoom, dpr);
  }

  private pan(dxCss: number, dyCss: number): void {
    const k = this.worldPerCss();
    this.h.cam.x -= dxCss * k;
    this.h.cam.y -= dyCss * k;
    this.clamp();
  }

  clamp(): void {
    const b = this.h.bounds();
    const c = this.h.cam;
    c.x = Math.min(Math.max(c.x, 0), b.w);
    c.y = Math.min(Math.max(c.y, 0), b.h);
  }

  /** 指定位置（CSSピクセル、画面左上基準）を固定したまま拡大縮小 */
  zoomBy(step: number, cx?: number, cy?: number): void {
    const c = this.h.cam;
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom + step));
    if (nz === c.zoom) return;
    const r = this.el.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - r.left - r.width / 2;
    const py = (cy ?? r.top + r.height / 2) - r.top - r.height / 2;
    const before = this.worldPerCss();
    const wx = c.x + px * before;
    const wy = c.y + py * before;
    c.zoom = nz;
    const after = this.worldPerCss();
    c.x = wx - px * after;
    c.y = wy - py * after;
    this.clamp();
    this.h.onZoom?.();
  }

  private down = (e: PointerEvent) => {
    this.el.setPointerCapture(e.pointerId);
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (this.pts.size === 1) this.moved = false;
    if (this.pts.size === 2) {
      this.pinchD = this.dist();
      this.moved = true;
    }
    this.h.onInteract?.();
  };

  private move = (e: PointerEvent) => {
    const p = this.pts.get(e.pointerId);
    if (!p) return;
    if (this.pts.size === 1) {
      if (e.pointerType === 'mouse' && (e.buttons & 3) === 0) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) this.moved = true;
      if (this.moved) this.pan(dx, dy);
    } else if (this.pts.size === 2) {
      const before = this.mid();
      p.x = e.clientX;
      p.y = e.clientY;
      const after = this.mid();
      this.pan(after.x - before.x, after.y - before.y);
      const d = this.dist();
      if (this.pinchD > 0) {
        if (d / this.pinchD > 1.45) {
          this.zoomBy(1, after.x, after.y);
          this.pinchD = d;
        } else if (d / this.pinchD < 0.69) {
          this.zoomBy(-1, after.x, after.y);
          this.pinchD = d;
        }
      }
      return;
    }
    p.x = e.clientX;
    p.y = e.clientY;
  };

  private up = (e: PointerEvent) => {
    const p = this.pts.get(e.pointerId);
    this.pts.delete(e.pointerId);
    if (!p) return;
    if (this.pts.size === 0 && !this.moved && performance.now() - p.t < 400 && this.h.onTap) {
      const r = this.el.getBoundingClientRect();
      const k = this.worldPerCss();
      this.h.onTap(this.h.cam.x + (e.clientX - r.left - r.width / 2) * k, this.h.cam.y + (e.clientY - r.top - r.height / 2) * k);
    }
    if (this.pts.size < 2) this.pinchD = 0;
    // 二本指から一本指に戻ったとき、残った指の基準を更新して跳ねないようにする
    for (const q of this.pts.values()) {
      q.sx = q.x;
      q.sy = q.y;
    }
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    this.wheelAcc += e.deltaY * unit;
    if (this.wheelAcc <= -90) {
      this.zoomBy(1, e.clientX, e.clientY);
      this.wheelAcc = 0;
    } else if (this.wheelAcc >= 90) {
      this.zoomBy(-1, e.clientX, e.clientY);
      this.wheelAcc = 0;
    }
  };

  private mid() {
    let x = 0;
    let y = 0;
    for (const p of this.pts.values()) {
      x += p.x;
      y += p.y;
    }
    return { x: x / this.pts.size, y: y / this.pts.size };
  }

  private dist(): number {
    const a = [...this.pts.values()];
    return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  }

  /** キーボードでの移動（毎フレーム） */
  update(dt: number): void {
    if (!this.keys.size) return;
    this.h.onInteract?.();
    let dx = 0;
    let dy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    const sp = 520 * dt;
    this.pan(-dx * sp, -dy * sp);
  }
}
