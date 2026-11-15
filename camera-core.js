/* 우주민 camera-core.js — 카메라 분석 순수 함수 (DOM 없음, 테스트 가능). 얼굴 인식 모델 없음.
 * 판정하지 않음: 기준 대비 붉기(a*) 변화량과 보조 참고값만 계산. 모든 게이트 수치는 [설계 선택]·D0(근거 없음). */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});

  const GATE = {
    tolL: 0.10,          // 기준 대비 얼굴 L* ±10%
    specY: 245,          // 정반사: 세 채널 ≥250 또는 휘도 Y ≥ 245
    darkY: 25,           // 저노출: Y < 25
    maxBad: 0.20,        // ROI 무효: 정반사+저노출 > 20%
    minSkin: 0.40,       // ROI 무효: 피부 화소 < 40%
    minFaceRois: 2,      // 유효 얼굴 ROI 2개 미만이면 거부
    bgShift: 2.0,        // 배경 a*/b* 이동 ≥ 2.0 → 화이트밸런스/조명 변화
    sideLight: 0.25,     // 좌우 뺨 밝기 차 > 25% → 한쪽 조명(낮은 신뢰)
    frameCv: 0.05,       // 프레임 간 ROI 밝기 변동 > 5% → 재촬영
    minNcc: 0.6,         // 기준 사진과 위치 NCC < 0.6 → 거부
    baseRange: 2.0,      // 기준 세션 3회 a* 범위 > 2.0 → 확정 거부
    warmStep: 0.015, warmN: 3, warmMax: 4, // 워밍업: 연속 3프레임 L* 변화 < 1.5%, 최대 4초
    repeat: 1.5,         // 재현성 경고
    minSnr: 10, maxDrop: 0.10, maxLVar: 0.05, edgeHz: 0.05, harmHi: 0.5, harmLo: 0.2, motionStep: 0.03,
    redWatch: 3,         // 주의 임계 Δa* +3 — 근거 없는 데모 값
  };
  const ROIS = ["forehead", "cheekL", "cheekR", "eye", "lips"];
  const FACE = ["forehead", "cheekL", "cheekR"];

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
  /* CIELAB → sRGB (테스트 픽스처·합성용) */
  function labToRgb(L, a, b) {
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const inv = (t) => (t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27));
    const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
    const R = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, G = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, B = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    const gam = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055);
    return [gam(R), gam(G), gam(B)];
  }
  const lumaY = (R, G, B) => 0.299 * R + 0.587 * G + 0.114 * B;

  /* 안내 타원 — 세로 3:4 프레임 기준 */
  function guide(w, h) { return { cx: w / 2, cy: h / 2, rx: w * 0.32, ry: h * 0.3 }; }
  /* 기본 ROI: 타원 상자 기준 정규화 [x0,y0,x1,y1]. 사용자가 기준 촬영 때 끌어 맞춘 값이 있으면 그것을 씀 */
  const ROI_DEF = {
    forehead: [0.30, 0.10, 0.70, 0.24],
    eye: [0.18, 0.34, 0.82, 0.44],
    cheekL: [0.16, 0.52, 0.40, 0.68],
    cheekR: [0.60, 0.52, 0.84, 0.68],
    lips: [0.36, 0.78, 0.64, 0.88],
  };
  /* 프레임 정규화 좌표(0–1)로 변환한 기본 ROI */
  function defaultNorm() {
    const e = guide(1, 1), x0 = e.cx - e.rx, y0 = e.cy - e.ry, W = 2 * e.rx, H = 2 * e.ry, out = {};
    for (const k in ROI_DEF) { const d = ROI_DEF[k]; out[k] = [x0 + d[0] * W, y0 + d[1] * H, x0 + d[2] * W, y0 + d[3] * H]; }
    return out;
  }
  function roiRects(w, h, norm) {
    norm = norm || defaultNorm();
    const out = {};
    for (const k in norm) { const d = norm[k]; out[k] = { x: Math.round(d[0] * w), y: Math.round(d[1] * h), w: Math.max(1, Math.round((d[2] - d[0]) * w)), h: Math.max(1, Math.round((d[3] - d[1]) * h)) }; }
    return out;
  }

  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const trimmed = (a, lo, hi) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), i0 = Math.floor(s.length * lo), i1 = Math.max(i0 + 1, Math.ceil(s.length * hi)); const t = s.slice(i0, i1); return t.reduce((x, y) => x + y, 0) / t.length; };

  /* 화소 분류: 정반사(세 채널 ≥250 또는 Y ≥245) / 저노출(Y <25) / 그 외 */
  function pixelClass(R, G, B) {
    const Y = lumaY(R, G, B);
    if ((R >= 250 && G >= 250 && B >= 250) || Y >= GATE.specY) return "spec";
    if (Y < GATE.darkY) return "dark";
    return "ok";
  }

  /* ROI별 통계: 피부 화소 마스크(정반사·암부·저채도·비피부 색상·ROI 중앙 밝기에서 먼 화소 제외) → a* 10–90% 절사 평균.
   * 무효: 정반사+암부 > 20% (reason spec|dark) / 피부 화소 < 40% (reason occluded) */
  function roiStats(data, w, rect) {
    const px = [];
    let spec = 0, dark = 0, n = 0, gSum = 0;
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = (y * w + x) * 4, R = data[i], G = data[i + 1], B = data[i + 2];
      n++; gSum += G;
      const c = pixelClass(R, G, B);
      if (c === "spec") { spec++; continue; }
      if (c === "dark") { dark++; continue; }
      px.push(rgbToLab(R, G, B));
    }
    if (!n) return { valid: false, reason: "empty", n: 0 };
    const Lmed = median(px.map((p) => p.L));
    const skin = px.filter((p) => { const C = Math.hypot(p.a, p.b), h = Math.atan2(p.b, p.a) * 180 / Math.PI; return C >= 6 && h >= -10 && h <= 95 && p.L >= 28 && Math.abs(p.L - Lmed) <= 18; });
    const bad = (spec + dark) / n, skinFrac = skin.length / n;
    const out = { n, skinN: skin.length, spec: spec / n, dark: dark / n, skinFrac, g: gSum / n };
    if (bad > GATE.maxBad) return Object.assign(out, { valid: false, reason: spec >= dark ? "spec" : "dark" });
    if (skinFrac < GATE.minSkin) return Object.assign(out, { valid: false, reason: "occluded" });
    return Object.assign(out, { valid: true, reason: null, a: trimmed(skin.map((p) => p.a), 0.1, 0.9), b: trimmed(skin.map((p) => p.b), 0.1, 0.9), L: trimmed(skin.map((p) => p.L), 0.1, 0.9) });
  }

  /* 배경 참조: 프레임 네 모서리(각 10%). 정반사·암부가 아닌 화소가 50% 미만이면 무효 */
  function bgStats(data, w, h) {
    const s = Math.round(Math.min(w, h) * 0.1), px = [];
    let n = 0;
    for (const [x0, y0] of [[0, 0], [w - s, 0], [0, h - s], [w - s, h - s]])
      for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x += 2) {
        const i = (y * w + x) * 4; n++;
        if (pixelClass(data[i], data[i + 1], data[i + 2]) === "ok") px.push(rgbToLab(data[i], data[i + 1], data[i + 2]));
      }
    if (px.length < n * 0.5) return { valid: false };
    return { valid: true, a: median(px.map((p) => p.a)), b: median(px.map((p) => p.b)), L: median(px.map((p) => p.L)) };
  }

  /* 한 프레임 측정 (ROI 5개 + 배경) */
  function measureFrame(data, w, h, norm) {
    const rects = roiRects(w, h, norm), rois = {};
    for (const k of ROIS) rois[k] = roiStats(data, w, rects[k]);
    return { rois, bg: bgStats(data, w, h) };
  }

  /* 여러 프레임 → ROI별 중앙값. 프레임 간 ROI 밝기 CV > 5%면 flicker 사유 */
  function combineFrames(list) {
    const rois = {}, reasons = [];
    for (const k of ROIS) {
      const v = list.map((m) => m.rois[k]).filter((r) => r && r.valid);
      if (v.length * 2 < list.length || !v.length) { const r0 = list.map((m) => m.rois[k]).find((r) => r && !r.valid) || {}; rois[k] = { valid: false, reason: r0.reason || "invalid", n: r0.n || 0 }; continue; }
      rois[k] = { valid: true, reason: null, a: median(v.map((r) => r.a)), b: median(v.map((r) => r.b)), L: median(v.map((r) => r.L)), n: median(v.map((r) => r.skinN)) };
      if (v.length > 1) { const Ls = v.map((r) => r.L), m = Ls.reduce((x, y) => x + y, 0) / Ls.length, sd = Math.sqrt(Ls.reduce((s, x) => s + (x - m) * (x - m), 0) / Ls.length); if (m > 0 && sd / m > GATE.frameCv && !reasons.includes("flicker")) reasons.push("flicker"); }
    }
    const bgs = list.map((m) => m.bg).filter((b) => b && b.valid);
    const bg = bgs.length * 2 >= list.length && bgs.length ? { valid: true, a: median(bgs.map((b) => b.a)), b: median(bgs.map((b) => b.b)), L: median(bgs.map((b) => b.L)) } : { valid: false };
    return { rois, bg, frames: list.length, reasons };
  }

  const faceL = (rois) => { const v = FACE.map((k) => rois[k]).filter((r) => r && r.valid).map((r) => r.L); return v.length ? median(v) : null; };

  /* 품질 게이트(ROI별) — ref = 기준(없으면 절대 조건만). 반환 { ok, reasons, warn, conf, dL } */
  function gate(ref, m, opt) {
    opt = opt || {};
    const reasons = (m.reasons || []).slice(), warn = [];
    let conf = "ok";
    const validFace = FACE.filter((k) => m.rois[k] && m.rois[k].valid);
    if (validFace.length < GATE.minFaceRois) reasons.push("tooFewRois");
    else if (validFace.length < FACE.length) warn.push("partial");
    const L = faceL(m.rois), L0 = ref ? faceL(ref.rois) : null;
    const dL = L !== null && L0 ? (L - L0) / L0 : null;
    if (dL !== null && Math.abs(dL) > GATE.tolL) reasons.push(dL < 0 ? "tooDark" : "tooBright");
    if (!m.bg || !m.bg.valid) { conf = "low"; warn.push("noBgRef"); }
    else if (ref && ref.bg && ref.bg.valid && (Math.abs(m.bg.a - ref.bg.a) >= GATE.bgShift || Math.abs(m.bg.b - ref.bg.b) >= GATE.bgShift)) reasons.push("whiteBalance");
    const cl = m.rois.cheekL, cr = m.rois.cheekR;
    if (cl && cr && cl.valid && cr.valid && Math.abs(cl.L - cr.L) / Math.max(cl.L, cr.L) > GATE.sideLight) { warn.push("sideLight"); conf = "low"; }
    if (opt.ncc !== undefined && opt.ncc !== null && opt.ncc < GATE.minNcc) reasons.push("position");
    return { ok: !reasons.length, reasons, warn, conf, dL };
  }

  /* 기준 세션: 3회 촬영(각각 combineFrames 결과) → ROI별 a* 범위 > 2.0이면 거부, 아니면 중앙값 */
  function baselineSession(list) {
    const rois = {}, ranges = {};
    let reject = false;
    for (const k of ROIS) {
      const v = list.map((m) => m.rois[k]).filter((r) => r && r.valid);
      if (v.length < 2) { rois[k] = { valid: false, reason: (list[0].rois[k] || {}).reason || "invalid" }; continue; }
      const as = v.map((r) => r.a), rg = Math.max(...as) - Math.min(...as);
      ranges[k] = rg; if (rg > GATE.baseRange) reject = true;
      rois[k] = { valid: true, reason: null, a: median(as), b: median(v.map((r) => r.b)), L: median(v.map((r) => r.L)), n: median(v.map((r) => r.n || 0)) };
    }
    const bgs = list.map((m) => m.bg).filter((b) => b && b.valid);
    const bg = bgs.length ? { valid: true, a: median(bgs.map((b) => b.a)), b: median(bgs.map((b) => b.b)), L: median(bgs.map((b) => b.L)) } : { valid: false };
    return { ok: !reject, reject, ranges, measure: { rois, bg, reasons: [] } };
  }

  /* 워밍업: samples=[{t(s), L}] → 연속 3프레임 L* 변화 < 1.5%가 처음 되는 인덱스. 4초 안에 없으면 -1 */
  function stableIndex(samples) {
    let run = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].t > GATE.warmMax) return -1;
      const a = samples[i - 1].L, b = samples[i].L;
      run = a > 0 && Math.abs(b - a) / a < GATE.warmStep ? run + 1 : 0;
      if (run >= GATE.warmN - 1) return i;
    }
    return -1;
  }

  /* 위치 비교: 그레이스케일 32×43 축소 후 NCC */
  function gray32(data, w, h) {
    const W = 32, H = 43, out = new Float64Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x0 = Math.floor(i * w / W), x1 = Math.floor((i + 1) * w / W), y0 = Math.floor(j * h / H), y1 = Math.floor((j + 1) * h / H);
      let s = 0, n = 0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const k = (y * w + x) * 4; s += lumaY(data[k], data[k + 1], data[k + 2]); n++; }
      out[j * W + i] = n ? s / n : 0;
    }
    return Array.from(out, (v) => Math.round(v));
  }
  function ncc(a, b) {
    const n = Math.min(a.length, b.length); if (!n) return null;
    let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
    return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
  }

  /* 부위 촬영: 사용자가 지정한 정규화 사각형 하나 */
  function siteMeasure(data, w, h, rectNorm) {
    if (!rectNorm) return { error: "noRect" };
    const r = roiRects(w, h, { site: rectNorm }).site;
    return { rois: { site: roiStats(data, w, r) }, bg: bgStats(data, w, h) };
  }
  function siteGate(ref, m) {
    const s = m.rois.site, reasons = [];
    if (!s.valid) reasons.push(s.reason || "invalid");
    else if (ref && ref.valid && Math.abs(s.L - ref.L) / ref.L > GATE.tolL) reasons.push(s.L < ref.L ? "tooDark" : "tooBright");
    return { ok: !reasons.length, reasons };
  }

  /* ───── rPPG (보조) ───── */
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
  function spectrum(x, fs, lo, hi, step) {
    const n = x.length, w = x.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
    const fr = [], P = [];
    for (let f = lo; f <= hi + 1e-9; f += step) {
      let re = 0, im = 0; const k = (2 * Math.PI * f) / fs;
      for (let i = 0; i < n; i++) { re += w[i] * Math.cos(k * i); im -= w[i] * Math.sin(k * i); }
      fr.push(f); P.push(re * re + im * im);
    }
    return { fr, P };
  }
  function bandPeak(x, fs, lo, hi, step) {
    const { fr, P } = spectrum(x, fs, lo, hi, step || 0.005);
    let pi = 0; for (let i = 1; i < P.length; i++) if (P[i] > P[pi]) pi = i;
    const fp = fr[pi], near = [], far = [];
    for (let i = 0; i < P.length; i++) { const d = Math.abs(fr[i] - fp); if (d <= 0.05) near.push(P[i]); else if (d > 0.2) far.push(P[i]); }
    const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const noise = mean(far);
    const powerAt = (f) => { let best = 0; for (let i = 0; i < fr.length; i++) if (Math.abs(fr[i] - f) <= 0.03) best = Math.max(best, P[i]); return best; };
    return { freq: fp, snr: noise > 0 ? mean(near) / noise : Infinity, peak: P[pi], powerAt, lo, hi };
  }

  /* 실측 타임스탬프 기반 프레임 드롭: 간격 > 2×중앙 간격이면 그 사이 누락 프레임 수를 셈 */
  function frameDrop(t) {
    const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
    const med = median(d) || 0; if (!med) return { drop: 1, fps: 0 };
    let miss = 0; for (const x of d) if (x > 2 * med) miss += Math.round(x / med) - 1;
    return { drop: miss / (t.length + miss), fps: 1 / med };
  }

  /**
   * 카메라 심박·호흡. samples = { t:[s], g:[G 평균], L:[L* 평균], m?:[프레임 차이(움직임)] }
   * 게이트: frameDrop(실측) / lightingVaries / motion / noSignal / lowSnr / bandEdge / harmonic. 호흡은 기록만.
   */
  function vitalsFromSamples(samples) {
    const t = samples.t, n = t.length, reasons = [];
    if (n < 10) return { status: "unavailable", reasons: ["tooFewFrames"] };
    const dur = t[n - 1] - t[0];
    const fd = frameDrop(t);
    if (fd.drop > GATE.maxDrop) reasons.push("frameDrop");
    const Lm = samples.L.reduce((s, v) => s + v, 0) / n;
    const Lsd = Math.sqrt(samples.L.reduce((s, v) => s + (v - Lm) * (v - Lm), 0) / n);
    let jumps = 0; for (let i = 1; i < n; i++) if (Lm > 0 && Math.abs(samples.L[i] - samples.L[i - 1]) / Lm > GATE.motionStep) jumps++;
    const mBad = samples.m ? samples.m.filter((v) => v > 8).length / n : 0;
    if (jumps >= 2 || mBad > 0.05) reasons.push("motion");
    else if (Lm > 0 && Lsd / Lm > GATE.maxLVar) reasons.push("lightingVaries");
    const fs = 15;
    const x = detrend(resample(t, samples.g, fs));
    const sd = Math.sqrt(x.reduce((s2, v) => s2 + v * v, 0) / x.length);
    if (sd < 1e-3) reasons.push("noSignal");
    const hr = bandPeak(x, fs, 0.7, 3.0);
    if (!(hr.snr >= GATE.minSnr) && !reasons.includes("noSignal")) reasons.push("lowSnr");
    let f = hr.freq;
    if (!reasons.length) {
      if (f - 0.7 < GATE.edgeHz || 3.0 - f < GATE.edgeHz) reasons.push("bandEdge");
      else if (f / 2 >= 0.7) {
        const ratio = hr.powerAt(f / 2) / hr.peak;   // 기본파(f/2) 파워 / 최대 피크
        if (ratio >= GATE.harmHi) f = f / 2;          // 기본파 채택
        else if (ratio >= GATE.harmLo) reasons.push("harmonic"); // 모호 → 측정 불가
      }
    }
    const rr = bandPeak(x, fs, 0.1, 0.5, 0.01);
    const out = { status: reasons.length ? "unavailable" : "ok", reasons, snr: hr.snr, drop: fd.drop, fps: fd.fps, lVar: Lm ? Lsd / Lm : null, durationSec: dur };
    if (!reasons.length) out.bpm = f * 60;
    out.resp = !reasons.length && rr.snr >= GATE.minSnr ? rr.freq * 60 : null; // 기록만
    return out;
  }

  UJ.camcore = { GATE, ROIS, FACE, rgbToLab, labToRgb, lumaY, guide, ROI_DEF, defaultNorm, roiRects, pixelClass, roiStats, bgStats, measureFrame, combineFrames, gate, baselineSession,
    stableIndex, gray32, ncc, siteMeasure, siteGate, vitalsFromSamples, frameDrop, bandPeak, detrend, resample, median };
  if (typeof module !== "undefined" && module.exports) module.exports = UJ.camcore;
})(typeof window !== "undefined" ? window : globalThis);
