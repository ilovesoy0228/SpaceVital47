// 테스트 픽스처 — 합성 프레임·샘플. 실제 사람 얼굴 아님. 기본 피부색 Lab(65,14,18)은 합성 값이며 실제 피부 분포가 아님.
const C = require("../camera-core.js");
const W = 480, H = 640;
const BASE = { L: 65, a: 14, b: 18 }, BG = { L: 45, a: -3, b: -12 };

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

/**
 * skinFrame({ dA:{roi:Δa*}, Lscale, Lbase, spec:{roi:비율}, occl:{roi:비율}, bgShift:{a,b}, bgDark, sideL, shift:{x,y}, seed, noise })
 * → { data(RGBA 480×640), w, h }
 */
function skinFrame(o) {
  o = o || {};
  const r = rng(o.seed || 7), sig = o.noise === undefined ? 1 : o.noise, Ls = o.Lscale || 1, base = Object.assign({}, BASE, o.base || {});
  if (o.Lbase) base.L = o.Lbase;
  const data = new Uint8ClampedArray(W * H * 4);
  const bgLab = { L: BG.L * Ls, a: BG.a + ((o.bgShift || {}).a || 0), b: BG.b + ((o.bgShift || {}).b || 0) };
  const bgRgb = o.bgDark ? [5, 5, 5] : C.labToRgb(bgLab.L, bgLab.a, bgLab.b);
  const skinRgb = C.labToRgb(base.L * Ls, base.a, base.b);
  const e = C.guide(W, H), sx = (o.shift || {}).x || 0, sy = (o.shift || {}).y || 0;
  const rects = C.roiRects(W, H);
  const roiRgb = {};
  for (const k of C.ROIS) {
    const Lk = base.L * Ls * (k === "cheekL" && o.sideL ? o.sideL : 1);
    roiRgb[k] = C.labToRgb(Lk, base.a + ((o.dA || {})[k] || 0), base.b);
  }
  const inRect = (x, y, rc) => x >= rc.x && x < rc.x + rc.w && y >= rc.y && y < rc.y + rc.h;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = bgRgb;
    const xx = x - sx, yy = y - sy;
    if (((xx - e.cx) / e.rx) ** 2 + ((yy - e.cy) / e.ry) ** 2 <= 1) {
      c = skinRgb;
      for (const k of C.ROIS) {
        const rc = rects[k];
        if (inRect(xx, yy, rc)) {
          c = roiRgb[k];
          const rowFrac = (yy - rc.y) / rc.h;
          if (o.spec && o.spec[k] && rowFrac < o.spec[k]) c = [255, 255, 255];
          else if (o.occl && o.occl[k] && rowFrac < o.occl[k]) c = [128, 128, 130];
        }
      }
    }
    const i = (y * W + x) * 4;
    data[i] = c[0] + sig * gauss(r); data[i + 1] = c[1] + sig * gauss(r); data[i + 2] = c[2] + sig * gauss(r); data[i + 3] = 255;
  }
  return { data, w: W, h: H };
}
const measure = (f) => C.combineFrames([C.measureFrame(f.data, f.w, f.h)]);

/** makeVideoSamples({ bpm, fs, seconds, gapFrac, lightVar, noise, harm:{bpm,amp,fundAmp}, constant, motion, seed }) */
function makeVideoSamples(o) {
  o = o || {};
  const fs = o.fs || 30, sec = o.seconds || 30, r = rng(o.seed || 3), t = [], g = [], L = [], m = [];
  const gapStart = sec * 0.4, gapEnd = gapStart + sec * (o.gapFrac || 0);
  for (let i = 0; i < fs * sec; i++) {
    const tt = i / fs;
    if (o.gapFrac && tt >= gapStart && tt < gapEnd) continue;
    let v = 120;
    if (!o.constant) {
      if (o.bpm) v += (o.amp || 1) * Math.sin(2 * Math.PI * (o.bpm / 60) * tt);
      if (o.harm) v += o.harm.amp * Math.sin(2 * Math.PI * (o.harm.bpm / 60) * tt) + (o.harm.fundAmp || 0) * Math.sin(2 * Math.PI * (o.harm.bpm / 120) * tt);
      v += (o.noise === undefined ? 0.05 : o.noise) * gauss(r);
    }
    let l = 60 * (1 + (o.lightVar || 0) * Math.sin(2 * Math.PI * 0.05 * tt));
    let mm = 1;
    if (o.motion && tt > 10 && tt < 16) { l += (Math.floor(tt * 3) % 2 ? 6 : -6); mm = 20; }
    t.push(tt); g.push(v); L.push(l); m.push(mm);
  }
  return { t, g, L, m };
}
module.exports = { skinFrame, measure, makeVideoSamples, W, H, BASE };
