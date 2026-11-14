/* 우주민 camera-core.js — 카메라 분석 순수 함수 (DOM 없음, 테스트 가능).
 * 판정하지 않음: 기준 대비 변화량(Δa*)과 보조 참고값만 계산. 모든 게이트 수치는 데모 값 [설계 선택]. */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});

  const GATE = { tolL: 0.10, maxSat: 0.02, minSnr: 10, maxDrop: 0.10, maxLVar: 0.05, redWatch: 3 };

  /* sRGB(0–255) → CIELAB (D65) */
  function rgbToLab(r, g2, b) {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const R = lin(r), G = lin(g2), B = lin(b);
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
    const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
    const fx = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const x = fx(X), y = fx(Y), z = fx(Z);
    return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
  }

  /* 안내 타원(얼굴 인식 모델 없음) — 프레임 비율 기준 */
  function guide(w, h) { return { cx: w / 2, cy: h / 2, rx: w * 0.2, ry: h * 0.36 }; }
  /* 고정 비율 ROI: 타원 상자 기준 [x0,y0,x1,y1] (0–1) */
  const ROI_DEF = {
    forehead: [0.30, 0.10, 0.70, 0.24],
    eye: [0.18, 0.34, 0.82, 0.44],
    cheekL: [0.16, 0.52, 0.40, 0.68],
    cheekR: [0.60, 0.52, 0.84, 0.68],
  };
  function roiRects(w, h) {
    const e = guide(w, h), x0 = e.cx - e.rx, y0 = e.cy - e.ry, W = 2 * e.rx, H = 2 * e.ry, out = {};
    for (const k in ROI_DEF) { const d = ROI_DEF[k]; out[k] = { x: Math.round(x0 + d[0] * W), y: Math.round(y0 + d[1] * H), w: Math.round((d[2] - d[0]) * W), h: Math.round((d[3] - d[1]) * H) }; }
    return out;
  }

  /* ROI 평균 RGB → Lab. 포화 픽셀 비율도 계산 */
  function roiStats(data, w, rect) {
    let r = 0, gg = 0, b = 0, n = 0, sat = 0;
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = (y * w + x) * 4; const R = data[i], G = data[i + 1], B = data[i + 2];
      r += R; gg += G; b += B; n++; if (R >= 250 || G >= 250 || B >= 250) sat++;
    }
    if (!n) return null;
    r /= n; gg /= n; b /= n;
    const lab = rgbToLab(r, gg, b);
    return { r, g: gg, b, L: lab.L, a: lab.a, sat: sat / n, n };
  }

  /* 한 프레임 측정: 얼굴(이마+양 뺨)·눈 주변 */
  function measureFrame(data, w, h, rects) {
    rects = rects || roiRects(w, h);
    const rois = {};
    for (const k in rects) rois[k] = roiStats(data, w, rects[k]);
    const faceKeys = ["forehead", "cheekL", "cheekR"];
    const avg = (ks, p) => ks.reduce((s, k) => s + rois[k][p], 0) / ks.length;
    const all = Object.keys(rois);
    return { rois, face: { a: avg(faceKeys, "a"), L: avg(faceKeys, "L") }, eye: { a: rois.eye.a, L: rois.eye.L },
      L: avg(all, "L"), sat: all.reduce((s, k) => s + rois[k].sat * rois[k].n, 0) / all.reduce((s, k) => s + rois[k].n, 0) };
  }

  /* 여러 프레임 평균 (기준 촬영 = 5프레임) */
  function averageMeasures(list) {
    const n = list.length, m = (fn) => list.reduce((s, x) => s + fn(x), 0) / n;
    const rois = {};
    for (const k in list[0].rois) rois[k] = { a: m((x) => x.rois[k].a), L: m((x) => x.rois[k].L), sat: m((x) => x.rois[k].sat) };
    return { rois, face: { a: m((x) => x.face.a), L: m((x) => x.face.L) }, eye: { a: m((x) => x.eye.a), L: m((x) => x.eye.L) }, L: m((x) => x.L), sat: m((x) => x.sat), frames: n };
  }

  /* 조명 게이트: 평균 L*가 기준 ±10% 이내, 포화 픽셀 <2% (데모 값) */
  function lightGate(base, cur) {
    const reasons = [];
    if (cur.sat >= GATE.maxSat) reasons.push("saturated");
    if (base && Math.abs(cur.L - base.L) / base.L > GATE.tolL) reasons.push("lighting");
    return { ok: !reasons.length, reasons, dL: base ? (cur.L - base.L) / base.L : null };
  }

  function compare(base, cur) {
    const out = { face: cur.face.a - base.face.a, eye: cur.eye.a - base.eye.a, rois: {} };
    for (const k in cur.rois) if (base.rois[k]) out.rois[k] = cur.rois[k].a - base.rois[k].a;
    return out;
  }

  /* 비균일 샘플 → 균일 격자 선형 보간 */
  function resample(t, v, fs) {
    const t0 = t[0], t1 = t[t.length - 1], n = Math.floor((t1 - t0) * fs) + 1, out = new Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const tt = t0 + i / fs;
      while (j < t.length - 2 && t[j + 1] < tt) j++;
      const a = t[j], b = t[j + 1], f = b > a ? (tt - a) / (b - a) : 0;
      out[i] = v[j] + (v[j + 1] - v[j]) * Math.min(1, Math.max(0, f));
    }
    return out;
  }
  function detrend(x) {
    const n = x.length, mx = (n - 1) / 2, my = x.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - mx) * (x[i] - my); den += (i - mx) * (i - mx); }
    const k = den ? num / den : 0;
    return x.map((v, i) => v - my - k * (i - mx));
  }
  /* 대역 내 파워 스펙트럼(직접 DFT, Hann 창) → 최대 피크와 SNR */
  function bandPeak(x, fs, lo, hi, step) {
    step = step || 0.005;
    const n = x.length, w = x.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
    const fr = [], P = [];
    for (let f = lo; f <= hi + 1e-9; f += step) {
      let re = 0, im = 0; const k = (2 * Math.PI * f) / fs;
      for (let i = 0; i < n; i++) { re += w[i] * Math.cos(k * i); im -= w[i] * Math.sin(k * i); }
      fr.push(f); P.push(re * re + im * im);
    }
    let pi = 0; for (let i = 1; i < P.length; i++) if (P[i] > P[pi]) pi = i;
    const fp = fr[pi], near = [], far = [];
    for (let i = 0; i < P.length; i++) { const d = Math.abs(fr[i] - fp); if (d <= 0.05) near.push(P[i]); else if (d > 0.2) far.push(P[i]); }
    const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const noise = mean(far);
    return { freq: fp, snr: noise > 0 ? mean(near) / noise : Infinity };
  }

  /**
   * 카메라 심박·호흡 (보조). samples = { t:[s], g:[G 평균], L:[L* 평균] }, nominalFps = 기대 프레임률
   * 품질 게이트(피크 SNR, 프레임 드롭 <10%, 조명 변동) 실패 시 status 'unavailable'
   */
  function vitalsFromSamples(samples, nominalFps) {
    const t = samples.t, n = t.length, reasons = [];
    if (n < 10) return { status: "unavailable", reasons: ["tooFewFrames"] };
    const dur = t[n - 1] - t[0];
    const drop = 1 - n / (dur * nominalFps + 1);
    if (drop > GATE.maxDrop) reasons.push("frameDrop");
    const Lm = samples.L.reduce((s, v) => s + v, 0) / n;
    const Lsd = Math.sqrt(samples.L.reduce((s, v) => s + (v - Lm) * (v - Lm), 0) / n);
    if (Lm > 0 && Lsd / Lm > GATE.maxLVar) reasons.push("lightingVaries");
    const fs = 15; // 분석용 재표본화 주파수
    const x = detrend(resample(t, samples.g, fs));
    const sd = Math.sqrt(x.reduce((s2, v) => s2 + v * v, 0) / x.length);
    if (sd < 1e-3) reasons.push("noSignal"); // 완전히 일정한 신호 → 잡음 파워 0 → SNR 무한대 오판 방지
    const hr = bandPeak(x, fs, 0.7, 3.0);
    if (!(hr.snr >= GATE.minSnr)) reasons.push("lowSnr");
    const rr = bandPeak(x, fs, 0.1, 0.5, 0.01);
    const out = { status: reasons.length ? "unavailable" : "ok", reasons, snr: hr.snr, drop, lVar: Lm ? Lsd / Lm : null, durationSec: dur };
    if (!reasons.length) out.bpm = hr.freq * 60;
    out.resp = rr.snr >= GATE.minSnr && !reasons.includes("lightingVaries") ? rr.freq * 60 : null; // 기록만
    return out;
  }

  UJ.camcore = { GATE, rgbToLab, guide, roiRects, roiStats, measureFrame, averageMeasures, lightGate, compare, vitalsFromSamples, bandPeak, detrend, resample };
  if (typeof module !== "undefined" && module.exports) module.exports = UJ.camcore;
})(typeof window !== "undefined" ? window : globalThis);
