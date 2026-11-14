// 카메라 분석 순수 함수 테스트 — 합성 신호(실제 사람 아님). 알고리즘 동작 확인일 뿐 실제 정확도 아님.
const test = require("node:test");
const assert = require("node:assert/strict");
require("../camera-core.js");
const C = globalThis.UJ.camcore;

function rand(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }
function synth({ fps = 30, sec = 30, hz = 0, amp = 0.6, noise = 0.3, lDrift = 0, drop = 0, seed = 7 }) {
  const r = rand(seed), t = [], g = [], L = [];
  for (let i = 0; i < fps * sec; i++) {
    if (drop && r() < drop) continue;
    const tt = i / fps; t.push(tt);
    g.push(120 + (hz ? amp * Math.sin(2 * Math.PI * hz * tt) : 0) + noise * gauss(r) + 0.02 * tt);
    L.push(60 + lDrift * Math.sin(2 * Math.PI * 0.2 * tt) + 0.1 * gauss(r));
  }
  return { t, g, L };
}
// 피부색 타원 합성 프레임 (사람 아님)
function frame(w, h, rgb, bg) {
  const d = new Uint8ClampedArray(w * h * 4), e = C.guide(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, inside = ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 <= 1;
    const c = inside ? rgb : bg || [30, 30, 40];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return d;
}

test("Lab: 흰색 L*≈100, a*≈0 / 빨강 a*>0", () => {
  const w = C.rgbToLab(255, 255, 255);
  assert.ok(Math.abs(w.L - 100) < 0.5 && Math.abs(w.a) < 0.5);
  assert.ok(C.rgbToLab(200, 80, 80).a > 30);
});

test("1.2 Hz 변조 → 72±3 bpm", () => {
  const v = C.vitalsFromSamples(synth({ hz: 1.2 }), 30);
  assert.equal(v.status, "ok", JSON.stringify(v));
  assert.ok(Math.abs(v.bpm - 72) <= 3, String(v.bpm));
});

test("변조 없는 신호 → 측정 불가 (시드 200개)", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const v = C.vitalsFromSamples(synth({ hz: 0, seed }), 30);
    assert.equal(v.status, "unavailable", `seed ${seed} snr ${v.snr}`);
  }
});

test("완전히 일정한 신호 → 측정 불가 (SNR 무한대 오판 방지)", () => {
  const v = C.vitalsFromSamples(synth({ hz: 0, noise: 0 }), 30);
  assert.equal(v.status, "unavailable");
  assert.ok(v.reasons.includes("noSignal"));
});

test("프레임 드롭 >10% → 측정 불가", () => {
  const v = C.vitalsFromSamples(synth({ hz: 1.2, drop: 0.3 }), 30);
  assert.equal(v.status, "unavailable");
  assert.ok(v.reasons.includes("frameDrop"));
});

test("조명 변동 큼 → 측정 불가", () => {
  const v = C.vitalsFromSamples(synth({ hz: 1.2, lDrift: 8 }), 30);
  assert.ok(v.reasons.includes("lightingVaries"));
});

test("붉기만 올린 프레임 → Δa*>0 & 주의 임계 이상, 조명 게이트 통과", () => {
  const W = 160, H = 120;
  const base = C.measureFrame(frame(W, H, [200, 150, 130]), W, H);
  const red = C.measureFrame(frame(W, H, [212, 140, 128]), W, H);
  const g = C.lightGate(base, red);
  assert.ok(g.ok, JSON.stringify(g));
  const d = C.compare(base, red);
  assert.ok(d.face > C.GATE.redWatch, String(d.face));
});

test("조명이 다른 프레임 → 재촬영 안내(게이트 실패)", () => {
  const W = 160, H = 120;
  const base = C.measureFrame(frame(W, H, [200, 150, 130]), W, H);
  const dark = C.measureFrame(frame(W, H, [140, 100, 85]), W, H);
  assert.equal(C.lightGate(base, dark).ok, false);
  const blown = C.measureFrame(frame(W, H, [255, 255, 255]), W, H);
  assert.ok(C.lightGate(base, blown).reasons.includes("saturated"));
});
