// docs/MEASUREMENT_CASES.md C001–C100 → 한 줄씩 "C0xx PASS|FAIL|MANUAL". 실행: node --test tests/  (UI 케이스는 먼저 node tests/e2e-cases.js)
// 순수 로직은 DOM 없이, 카메라 알고리즘은 tests/fixtures.js 합성 프레임·샘플로 검증. 모든 임계값은 [설계 선택]·D0.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
require("../data.js");
const TL = require("../timeline.js");
const E = require("../engine.js");
const CD = require("../camdata.js");
const C = require("../camera-core.js");
const R = require("../report.js");
const F = require("./fixtures.js");
const UJ = globalThis.UJ;
const { rules, rejected } = E.loadRules(UJ.RULES, UJ.SOURCES, () => {});
const E2E = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "out", "e2e-cases.json"), "utf8")); } catch (e) { return null; } })();

const results = [];
function c(id, desc, fn) {
  test(`${id} ${desc}`, () => {
    try { fn(); results.push([id, "PASS", desc]); console.log(`${id} PASS — ${desc}`); }
    catch (e) { results.push([id, "FAIL", desc + " :: " + e.message]); console.log(`${id} FAIL — ${desc} :: ${e.message}`); throw e; }
  });
}
function manual(id, desc, why) { test(`${id} ${desc} (MANUAL)`, () => { results.push([id, "MANUAL", why]); console.log(`${id} MANUAL — ${desc} :: ${why}`); }); }
function viaE2E(id, desc) {
  test(`${id} ${desc} (e2e)`, () => {
    if (!E2E || !(id in E2E)) { results.push([id, "MANUAL", "e2e 결과 없음 — node tests/e2e-cases.js 먼저 실행"]); console.log(`${id} MANUAL — ${desc} :: e2e 결과 없음 (node tests/e2e-cases.js 먼저 실행)`); return; }
    const r = E2E[id];
    if (r.ok) { results.push([id, "PASS", desc + " (e2e)"]); console.log(`${id} PASS — ${desc} (e2e: ${r.info || ""})`); }
    else { results.push([id, "FAIL", desc + " (e2e) " + (r.info || "")]); console.log(`${id} FAIL — ${desc} (e2e: ${r.info || ""})`); assert.fail(r.info || "e2e failed"); }
  });
}
after(() => {
  const n = (s) => results.filter((r) => r[1] === s).length;
  console.log(`\nCASES: PASS ${n("PASS")} · FAIL ${n("FAIL")} · MANUAL ${n("MANUAL")} / ${results.length}`);
  fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "out", "cases-summary.json"), JSON.stringify(results, null, 1));
});

/* ───── 헬퍼 ───── */
const CK = UJ.CHANNELS.filter((x) => x.source === "checkin");
const full = (o) => Object.assign(Object.fromEntries(CK.map((x) => [x.id, x.def])), o || {});
function daysFrom(range, o) { const d = {}; for (const i of range) d[i] = { checkin: full(typeof o === "function" ? o(i) : o) }; return d; }
const span = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const evalAt = (days, D, extra) => E.evaluate(Object.assign({ days, day: D, symptoms: {}, camera: {}, flux: 0.2, events: {} }, extra || {}), rules);
function firedHas(ev, pred) { const ids = Object.values(ev.tiles).flatMap((t) => t.rules); return ids.some((id) => pred(rules.find((r) => r.id === id))); }
const usesDBase = (w) => !!(w && (w.dBase || (w.all || w.any || []).some(usesDBase)));
const BL = CD.BASE_LAB;
function rec(day, offs, o) {
  o = o || {};
  const rois = {};
  for (const k of CD.ROIS) rois[k] = { a: BL[k].a + ((offs || {})[k] || 0), b: BL[k].b + ((o.db || {})[k] || 0), L: BL[k].L + ((o.dL || {})[k] || 0), n: 900, valid: !(o.invalid || []).includes(k), reason: (o.invalid || []).includes(k) ? "spec" : null };
  return { id: o.id || `r${day}-${Math.random().toString(36).slice(2, 6)}`, day, ts: o.ts || day * 1000, kind: "daily", source: o.source || "camera", synthetic: !!o.synthetic, rois, bg: { a: 0, b: 0, L: 40, valid: true }, gate: { ok: o.fail ? false : true, reasons: o.fail ? ["tooDark"] : [] }, conf: o.low ? "low" : "ok" };
}
const face = (v) => ({ forehead: v, cheekL: v, cheekR: v });
function camWith(days, todayDay, todayOffs, o) { const cam = CD.empty(); cam.consent = true; for (const d of days) CD.addRecord(cam, rec(d, {})); if (todayDay) CD.addRecord(cam, rec(todayDay, todayOffs, o)); return cam; }
const hrRec = (day, hr, ok, ts) => ({ id: "h" + day + "-" + (ts || 0), day, ts: ts || day * 1000 + 5, kind: "hr", source: "camera", rois: {}, conf: "ok", gate: { ok: ok !== false, reasons: ok === false ? ["lowSnr"] : [] }, hr: ok === false ? null : hr, resp: ok === false ? null : 15, snr: 20 });
const camEval = (cam, D, sym, ck) => evalAt(daysFrom([D], ck || {}), D, { camera: CD.engineInput(cam, D), symptoms: sym || {} });
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} ±${tol}`);
const BAD_WORDS = /빈혈 의심|황달 의심|뇌졸중 의심|창백함 감지|anaemia detected|anemia detected|jaundice detected|stroke detected|drowsy/i;

/* ═════ A. 임무일·이력 (체크인) ═════ */
c("C001", "D1 이력 0일: 기준선 0/14, Δ 없음, 절대 임계 규칙만", () => {
  const ev = evalAt(daysFrom([1], { temp: 38.2, hr: 95 }), 1);
  assert.equal(ev.deltas.temp.base, null); assert.equal(ev.deltas.temp.n, 0); assert.equal(ev.deltas.temp.dYest, null); assert.equal(ev.deltas.temp.dBase, null);
  assert.ok(ev.tiles.temp && ev.tiles.temp.level === 2, "temp2(절대 ≥38.0) 작동");
  assert.ok(!firedHas(ev, (r) => usesDBase(r.when)), "기준선 의존 규칙 미발동");
});
c("C002", "D2: 어제=D1, Δ어제 계산, 기준선 1/14", () => {
  const ev = evalAt(daysFrom([1, 2], (i) => ({ sleep: i === 1 ? 6 : 7.5 })), 2);
  assert.equal(ev.deltas.sleep.yesterday, 6); assert.equal(ev.deltas.sleep.dYest, 1.5); assert.equal(ev.deltas.sleep.n, 1); assert.equal(ev.deltas.sleep.base, null);
});
c("C003", "D8: 7/14 → null, 기준선 규칙 꺼짐", () => {
  const ev = evalAt(daysFrom(span(1, 8), (i) => ({ hr: i === 8 ? 95 : 62 })), 8);
  assert.equal(ev.deltas.hr.n, 7); assert.equal(ev.deltas.hr.base, null); assert.ok(!ev.tiles.hr);
});
c("C004", "D14: 13개 → null (13/14)", () => { const ev = evalAt(daysFrom(span(1, 14)), 14); assert.equal(ev.deltas.hr.n, 13); assert.equal(ev.deltas.hr.base, null); });
c("C005", "D15: 처음 확정(D1–D14 평균), 오늘 값 미포함", () => {
  const days = daysFrom(span(1, 15), (i) => ({ hr: i <= 14 ? 60 + (i % 2) * 2 : 120 }));
  const ev = evalAt(days, 15);
  assert.equal(ev.deltas.hr.base, 61); assert.equal(ev.deltas.hr.dBase, 59); assert.equal(ev.deltas.hr.baseEnd, 14);
});
viaE2E("C006", "D30 데모 첫 실행: 모든 체크인 행에 추세·어제·기준선·Δ");
c("C007", "하루 마감: D30 확정 → D31, 입력 미입력, 기준선 D1–D14 그대로", () => {
  const ids = CK.map((x) => x.id);
  const days = daysFrom(span(1, 30), (i) => ({ hr: 60 + (i % 5) }));
  const before = TL.baseline(days, 30, "hr").value;
  const r = TL.closeDay(days, 30, ids);
  assert.equal(r.D, 31); assert.equal(r.days[30].committed, true);
  for (const id of ids) assert.equal(r.days[31].checkin[id], null);
  assert.deepEqual(r.days[31].symptoms, {});
  assert.equal(TL.baseline(r.days, 31, "hr").value, before);
});
c("C008", "D20 없음 → Δ어제 --, 마지막 D19 대비(2일 전)", () => {
  const days = daysFrom(span(1, 21).filter((d) => d !== 20), (i) => ({ sleep: i === 19 ? 6 : 7 }));
  const ev = evalAt(days, 21);
  assert.equal(ev.deltas.sleep.yesterday, null); assert.equal(ev.deltas.sleep.yesterdayMissing, true); assert.equal(ev.deltas.sleep.dYest, null);
  assert.deepEqual(ev.deltas.sleep.last, { day: 19, value: 6, ago: 2 }); assert.equal(ev.deltas.sleep.dLast, 1);
});
c("C009", "기준선 기간 중 D5 결측 → D16에서 확정, 추세 D5 끊김", () => {
  const days = daysFrom(span(1, 16).filter((d) => d !== 5));
  assert.equal(TL.baseline(days, 15, "hr").value, null); assert.equal(TL.baseline(days, 15, "hr").n, 13);
  const b = TL.baseline(days, 16, "hr"); assert.equal(b.n, 14); assert.equal(b.endDay, 15); assert.notEqual(b.value, null);
  assert.equal(TL.series(days, 16, "hr")[4], null);
});
c("C010", "D12 → D10 보기: 그날 이후 데이터 미사용, 수정은 D10만", () => {
  const days = daysFrom(span(1, 12), (i) => ({ hr: 60 + i }));
  const ev = evalAt(days, 10);
  assert.equal(ev.deltas.hr.today, 70); assert.equal(ev.deltas.hr.yesterday, 69); assert.equal(ev.deltas.hr.n, 9);
  assert.equal(TL.series(days, 10, "hr").length, 10);
  days[10].checkin.hr = 99; assert.equal(days[11].checkin.hr, 71);
});
c("C011", "일부만 입력: 나머지 미입력 → 추세점·규칙 제외", () => {
  const days = daysFrom(span(1, 15)); days[15] = { checkin: Object.assign(store_empty(), { sleep: 4, stress: 4 }) };
  const ev = evalAt(days, 15);
  assert.equal(ev.deltas.hr.today, null); assert.equal(ev.deltas.temp.today, null); assert.ok(!ev.tiles.hr && !ev.tiles.temp);
  assert.equal(TL.series(days, 15, "hr")[14], null); assert.ok(ev.tiles.sleep && ev.tiles.stress, "입력한 채널만 평가");
});
function store_empty() { return Object.fromEntries(CK.map((x) => [x.id, null])); }
c("C012", "같은 날 37.0→38.2 덮어쓰기, 중복 점 없음, 38.2로 재평가", () => {
  const days = daysFrom(span(1, 15)); days[15].checkin.temp = 37.0;
  assert.ok(!evalAt(days, 15).tiles.temp || evalAt(days, 15).tiles.temp.level < 2);
  days[15].checkin.temp = 38.2;
  const s = TL.series(days, 15, "temp"); assert.equal(s.length, 15); assert.equal(s[14], 38.2);
  assert.equal(evalAt(days, 15).tiles.temp.level, 2);
});

/* ═════ B. 카메라 기준선 수명주기 ═════ */
viaE2E("C013", "동의 안 함: 카메라 행 한 줄 '카메라 미사용'");
viaE2E("C014", "동의·이력 0: '카메라 미측정 — 촬영하기' 한 줄");
c("C015", "첫 유효 촬영 n=1: 기준 형성 1/14, Δ 숨김, 규칙 꺼짐, 점 1개", () => {
  const cam = camWith([], 1, face(5));
  const d = CD.deltas(cam, 1, "face");
  assert.equal(d.n, 1); assert.equal(d.dBase, null); assert.equal(d.dYest, null); assert.equal(d.rulesOn, false);
  assert.equal(CD.series(cam, 1, "face").filter((v) => v !== null).length, 1); assert.deepEqual(CD.engineInput(cam, 1), {});
});
c("C016", "n=2: Δ어제·Δ기준선 표시, 규칙 꺼짐", () => {
  const cam = camWith([1], 2, face(3.5)); const d = CD.deltas(cam, 2, "face");
  assert.equal(d.n, 2); near(d.dBase, 3.5, 1e-9); near(d.dYest, 3.5, 1e-9); assert.equal(d.rulesOn, false); assert.equal(CD.engineInput(cam, 2).face, undefined);
});
c("C017", "n=3: 규칙 켜짐, +3이면 L1", () => {
  const cam = camWith([1, 2], 3, face(3)); const d = CD.deltas(cam, 3, "face");
  assert.equal(d.rulesOn, true); assert.equal(camEval(cam, 3).tiles.camFace.level, 1);
});
c("C018", "n=14 확정: 이후 값이 기준선에 섞이지 않음", () => {
  const cam = camWith(span(1, 14), 0); for (const d of span(15, 20)) CD.addRecord(cam, rec(d, face(10)));
  const b = CD.baseline(cam, 20, "face"); assert.equal(b.locked, true); assert.equal(b.n, 14); near(b.value, CD.median([BL.forehead.a, BL.cheekL.a, BL.cheekR.a]), 1e-9);
});
c("C019", "임무 D30에 첫 촬영 → 카메라 기록일 기준 n=1", () => { const cam = camWith([], 30, {}); assert.equal(CD.deltas(cam, 30, "face").n, 1); });
c("C020", "기준 세션 3회 a* 범위 > 2.0 → 거부, 값 저장 안 함", () => {
  const ms = [0, 1.2, 2.5].map((v, i) => F.measure(F.skinFrame({ dA: face(v), seed: 10 + i })));
  const r = C.baselineSession(ms); assert.equal(r.ok, false); assert.ok(r.ranges.forehead > 2.0);
  const ok = C.baselineSession([0, 0.5, 1].map((v, i) => F.measure(F.skinFrame({ dA: face(v), seed: 20 + i })))); assert.equal(ok.ok, true);
});
c("C021", "카메라 전체 삭제: 사진·기준·수치 삭제, 체크인 유지", () => {
  const store = require("../store.js");
  const st = store.fresh("demo"); const before = JSON.stringify(st.days);
  st.camera.ref = { day: 1 }; store.photos.add({ id: "p1", region: "face", dataUrl: "data:x" });
  store.clearCamera(st);
  assert.equal(st.camera.records.length, 0); assert.equal(st.camera.ref, null); assert.equal(store.photos.all().length, 0); assert.equal(JSON.stringify(st.days), before);
});

/* ═════ C. 일별 카메라 Δ 가용성 ═════ */
c("C022", "오늘·어제 유효, 기준 확정 → Δ어제·Δ기준선·추세", () => {
  const cam = camWith(span(1, 19), 20, face(1)); const d = CD.deltas(cam, 20, "face");
  assert.notEqual(d.dYest, null); assert.notEqual(d.dBase, null); assert.ok(CD.series(cam, 20, "face").filter((v) => v !== null).length >= 2);
});
c("C023", "어제 미촬영 → Δ기준선만, '어제 기록 없음'", () => {
  const cam = camWith(span(1, 18), 20, face(1)); const d = CD.deltas(cam, 20, "face");
  assert.equal(d.dYest, null); assert.equal(d.yStatus, "none"); assert.notEqual(d.dBase, null);
});
c("C024", "어제 게이트 실패 → 결측 취급, '어제 품질 미달'", () => {
  const cam = camWith(span(1, 18), 20, face(1)); CD.addRecord(cam, rec(19, {}, { fail: true }));
  const d = CD.deltas(cam, 20, "face"); assert.equal(d.yStatus, "failed"); assert.equal(d.dYest, null);
});
c("C025", "오늘 게이트 실패 → Δ·점 없음, 마지막 유효 표시, 규칙 미발동", () => {
  const cam = camWith(span(1, 27), 28, face(5), { fail: true }); const d = CD.deltas(cam, 28, "face");
  assert.equal(d.todayStatus, "failed"); assert.equal(d.today, null); assert.equal(d.dBase, null); assert.equal(d.lastValid.day, 27);
  assert.equal(CD.series(cam, 28, "face")[27], null); assert.equal(CD.engineInput(cam, 28).face, undefined);
});
c("C026", "오늘 미촬영 → '오늘 미측정', 마지막 유효값", () => { const cam = camWith(span(1, 27), 0); const d = CD.deltas(cam, 28, "face"); assert.equal(d.todayStatus, "none"); assert.equal(d.lastValid.day, 27); });
c("C027", "어제 파일·오늘 웹캠 → 출처 불일치 ⚠, Δ어제 표시, 규칙엔 Δ기준선만", () => {
  const cam = camWith(span(1, 18), 0); CD.addRecord(cam, rec(19, {}, { source: "file" })); CD.addRecord(cam, rec(20, face(4)));
  const d = CD.deltas(cam, 20, "face"); assert.equal(d.sourceMismatch, true); assert.notEqual(d.dYest, null);
  assert.equal(CD.engineInput(cam, 20).face, d.dBase);
});
c("C028", "오늘 심박만 측정 → 붉기 '오늘 미측정', 심박 값", () => {
  const cam = camWith(span(1, 5), 0); CD.addRecord(cam, hrRec(6, 70));
  assert.equal(CD.deltas(cam, 6, "face").todayStatus, "none"); assert.equal(CD.deltas(cam, 6, "hr").today, 70);
});
c("C029", "D1·D3 촬영(D2 없음): Δ어제 --, 마지막 D1 대비(2일 전), D2 끊김", () => {
  const cam = camWith([1], 3, face(2)); const d = CD.deltas(cam, 3, "face");
  assert.equal(d.dYest, null); assert.equal(d.last.day, 1); assert.equal(d.last.ago, 2); near(d.dLast, 2, 1e-9);
  const s = CD.series(cam, 3, "face"); assert.notEqual(s[0], null); assert.equal(s[1], null); assert.notEqual(s[2], null);
});
c("C030", "12일 유효 후 오늘 실패: 추세 12일까지, 마지막 유효값으로 규칙 재발동 없음", () => {
  const cam = CD.empty(); for (const d of span(1, 12)) CD.addRecord(cam, rec(d, d === 12 ? face(5) : {})); CD.addRecord(cam, rec(13, face(5), { fail: true }));
  const s = CD.series(cam, 13, "face"); assert.notEqual(s[11], null); assert.equal(s[12], null); assert.deepEqual(Object.keys(CD.engineInput(cam, 13)).filter((k) => k !== "hr"), []);
});

/* ═════ D. 조명·품질 게이트 (합성 프레임) ═════ */
const REF = F.measure(F.skinFrame({}));
const gateOf = (o, opt) => { const m = F.measure(F.skinFrame(o)); return { m, g: C.gate(REF, m, opt) }; };
c("C031", "같은 프레임: 모든 ROI Δa* 0.0 ±0.05, 통과", () => { const { m, g } = gateOf({}); assert.ok(g.ok); for (const k of C.ROIS) near(m.rois[k].a - REF.rois[k].a, 0, 0.05); });
c("C032", "밝기 −15% → 거부(어둡습니다, −15%)", () => { const { g } = gateOf({ Lscale: 0.85 }); assert.ok(!g.ok); assert.ok(g.reasons.includes("tooDark")); near(g.dL, -0.15, 0.01); });
c("C033", "밝기 +15% → 거부(밝습니다)", () => { const { g } = gateOf({ Lscale: 1.15 }); assert.ok(g.reasons.includes("tooBright")); });
c("C034", "밝기 +8% → 통과", () => { const { g } = gateOf({ Lscale: 1.08 }); assert.ok(g.ok, g.reasons.join()); });
c("C035", "이마 정반사 30% → 이마 무효(반사), 나머지 2개 중앙값, 일부 제외 표시", () => {
  const { m, g } = gateOf({ spec: { forehead: 0.3 }, dA: { cheekL: 1, cheekR: 2 } });
  assert.equal(m.rois.forehead.valid, false); assert.equal(m.rois.forehead.reason, "spec"); assert.ok(g.ok); assert.ok(g.warn.includes("partial"));
  near(CD.faceOf(m.rois), (m.rois.cheekL.a + m.rois.cheekR.a) / 2, 1e-9);
});
c("C036", "양 뺨 정반사 → 유효 얼굴 ROI < 2 → 거부", () => { const { g } = gateOf({ spec: { cheekL: 0.3, cheekR: 0.3 } }); assert.ok(g.reasons.includes("tooFewRois")); });
c("C037", "붉은 피부 R 240–249(250 미만) → 포화 아님, Δa* 정상 계산", () => {
  const lab = C.rgbToLab(240, 150, 130);
  const base = { L: lab.L, a: lab.a, b: lab.b };
  const f0 = F.skinFrame({ base }), f1 = F.skinFrame({ base, dA: face(3) });
  const rc = C.roiRects(F.W, F.H).forehead; let maxR = 0, minR = 255;
  for (let y = rc.y; y < rc.y + rc.h; y++) for (let x = rc.x; x < rc.x + rc.w; x++) { const v = f1.data[(y * F.W + x) * 4]; maxR = Math.max(maxR, v); minR = Math.min(minR, v); }
  assert.equal(C.pixelClass(249, 180, 160), "ok");
  const m0 = F.measure(f0), m1 = F.measure(f1);
  assert.ok(m0.rois.forehead.valid && m1.rois.forehead.valid, "ROI 유효"); assert.ok(minR >= 240 && maxR < 250, `R ${minR}–${maxR}`); assert.ok(C.measureFrame(f1.data, F.W, F.H).rois.forehead.spec < 0.05);
  near(m1.rois.forehead.a - m0.rois.forehead.a, 3, 0.3);
});
c("C038", "하얀 정반사(R,G,B ≥250) > 20% → 해당 ROI 무효", () => { assert.equal(C.pixelClass(252, 251, 250), "spec"); const { m } = gateOf({ spec: { eye: 0.25 } }); assert.equal(m.rois.eye.valid, false); });
c("C039", "배경 a*/b* 2.0 이상 이동 → 거부(화이트밸런스)", () => { const { g } = gateOf({ bgShift: { a: 2.5 } }); assert.ok(g.reasons.includes("whiteBalance")); });
c("C040", "배경 없음 → conf low, 표시만, 규칙·추세 제외", () => {
  const { g } = gateOf({ bgDark: true }); assert.ok(g.ok); assert.equal(g.conf, "low"); assert.ok(g.warn.includes("noBgRef"));
  const cam = camWith(span(1, 5), 6, face(5), { low: true });
  assert.equal(CD.deltas(cam, 6, "face").todayStatus, "lowconf"); assert.equal(CD.engineInput(cam, 6).face, undefined); assert.equal(CD.series(cam, 6, "face")[5], null);
});
c("C041", "좌우 뺨 밝기 차 > 25% → 한쪽 조명 경고, face conf low", () => { const { g } = gateOf({ sideL: 0.7 }); assert.ok(g.warn.includes("sideLight")); assert.equal(g.conf, "low"); });
c("C042", "워밍업: 연속 3프레임 L* 변화 < 1.5%에서 시작, 4초 안에 없으면 실패", () => {
  const s = [60, 50, 66, 55, 58, 58.2, 58.3, 58.2].map((L, i) => ({ t: i * 0.1, L }));
  assert.equal(C.stableIndex(s), 6);
  const bad = Array.from({ length: 50 }, (_, i) => ({ t: i * 0.1, L: 50 + (i % 2) * 5 })); assert.equal(C.stableIndex(bad), -1);
});
c("C043", "기준 사진과 위치 다름(NCC < 0.6) → 거부", () => {
  const a = C.gray32(F.skinFrame({}).data, F.W, F.H), b = C.gray32(F.skinFrame({ shift: { x: 150, y: 120 } }).data, F.W, F.H);
  const n = C.ncc(a, b); assert.ok(n < 0.6, "ncc " + n);
  const { g } = gateOf({}, { ncc: n }); assert.ok(g.reasons.includes("position"));
  assert.ok(C.ncc(a, C.gray32(F.skinFrame({ seed: 99 }).data, F.W, F.H)) > 0.95);
});
c("C044", "가림(피부 화소 < 40%) → 해당 ROI 무효 '가림'", () => { const { m } = gateOf({ occl: { forehead: 0.7 } }); assert.equal(m.rois.forehead.valid, false); assert.equal(m.rois.forehead.reason, "occluded"); });

/* ═════ E. 부위별 붉기 ═════ */
const base5 = (offs, sym) => { const cam = camWith(span(1, 5), 6, offs); return { cam, ev: camEval(cam, 6, sym) }; };
c("C045", "이마만 +3 → 이마 행 △(L1), 얼굴 종합 미발동", () => { const { ev } = base5({ forehead: 3 }); assert.equal(ev.tiles.camForehead.level, 1); assert.ok(!ev.tiles.camFace); });
c("C046", "왼뺨만 +3 → 왼뺨 △", () => { const { ev } = base5({ cheekL: 3 }); assert.equal(ev.tiles.camCheekL.level, 1); assert.ok(!ev.tiles.camFace); });
c("C047", "오른뺨만 +3 → 오른뺨 △", () => { const { ev } = base5({ cheekR: 3 }); assert.equal(ev.tiles.camCheekR.level, 1); });
c("C048", "눈만 +3 → camEye1 L1", () => { const { ev } = base5({ eye: 3 }); assert.equal(ev.tiles.camEye.level, 1); assert.ok(ev.tiles.camEye.rules.includes("camEye1")); });
c("C049", "입술만 +3 → 입술 △(기록·표시), 진단 문구 없음", () => { const { ev } = base5({ lips: 3 }); assert.equal(ev.tiles.camLips.level, 1); assert.ok(!BAD_WORDS.test(JSON.stringify(ev.tiles.camLips.top.action))); });
c("C050", "얼굴 3 ROI 모두 +3 → camFace1 L1", () => { const { ev } = base5(face(3)); assert.equal(ev.tiles.camFace.level, 1); });
c("C051", "얼굴 종합 +2.9 → 미발동(경계)", () => { const { ev } = base5(face(2.9)); assert.ok(!ev.tiles.camFace); });
c("C052", "얼굴 종합 정확히 +3.0 → 발동(gte)", () => { const { ev } = base5(face(3.0)); assert.equal(ev.tiles.camFace.level, 1); });
c("C053", "3개 중 2개 +3 → 중앙값 +3 → 발동", () => { const { ev } = base5({ forehead: 3, cheekL: 3 }); assert.equal(ev.tiles.camFace.level, 1); });
c("C054", "얼굴 −4 → 경보 없음(창백 판정 안 함), 값만 ▼", () => { const { cam, ev } = base5(face(-4)); assert.ok(!ev.tiles.camFace); near(CD.deltas(cam, 6, "face").dBase, -4, 1e-9); });
c("C055", "얼굴 +3.2, 증상 없음 → L1만, 카드·L2 없음", () => { const { ev } = base5(face(3.2)); assert.equal(ev.overall, 1); assert.deepEqual(ev.cards, []); });
c("C056", "얼굴 +3.2 + rash → camSkinCombo L2, 카드 없음", () => { const { ev } = base5(face(3.2), { rash: {} }); assert.equal(ev.tiles["m:skin"].level, 2); assert.ok(ev.tiles["m:skin"].rules.includes("camSkinCombo")); assert.deepEqual(ev.cards, []); });
c("C057", "눈 +3.5 + eyeRed → camEyeCombo L2, R3 카드 없음", () => { const { ev } = base5({ eye: 3.5 }, { eyeRed: {} }); assert.equal(ev.tiles["m:eye"].level, 2); assert.ok(!ev.cards.includes("R3")); });
c("C058", "좌우 뺨 +5/−5 → 숫자만, 비대칭·뇌졸중 판정 없음", () => {
  const { ev } = base5({ cheekL: 5, cheekR: -5 });
  assert.deepEqual(Object.keys(ev.tiles).sort(), ["camCheekL"]); assert.ok(!rules.some((r) => JSON.stringify(r.when).includes("cheekL") && JSON.stringify(r.when).includes("cheekR")));
  for (const f of ["camera.js", "ui.js", "camdata.js", "camera-core.js"]) assert.ok(!/비대칭|asymmetr/i.test(fs.readFileSync(path.join(__dirname, "..", f), "utf8")), f);
});
c("C059", "b*·L* 변화 → 기록만, 판정 문구 없음", () => {
  const cam = camWith(span(1, 5), 0); CD.addRecord(cam, rec(6, {}, { db: { forehead: 6, cheekL: 6, cheekR: 6 }, dL: { forehead: -5 } }));
  const ev = camEval(cam, 6); assert.deepEqual(Object.keys(ev.tiles), []);
  const ex = CD.exportData(cam, 6); assert.ok(ex.records.at(-1).rois.forehead.b !== undefined);
  // ui.js는 카메라 그룹 구간만 검사(R6 '뇌졸중 의심'은 증상 기반 시연 시나리오 이름이라 제외)
  const ui = fs.readFileSync(path.join(__dirname, "..", "ui.js"), "utf8"), seg = ui.slice(ui.indexOf("카메라 그룹 (ROI별 행"), ui.indexOf("증상 요약 ─"));
  assert.ok(seg.length > 1000 && !BAD_WORDS.test(seg), "ui.js camera group");
  for (const f of ["camera.js", "camdata.js", "camera-core.js", "report.js"]) assert.ok(!BAD_WORDS.test(fs.readFileSync(path.join(__dirname, "..", f), "utf8")), f);
});
c("C060", "재현성 점검: ROI별 |Δ|, 1.5 초과면 경고", () => {
  const a = F.measure(F.skinFrame({ seed: 1 })), b = F.measure(F.skinFrame({ seed: 2 })), bad = F.measure(F.skinFrame({ seed: 3, dA: { eye: 1.8 } }));
  const ok = CD.repeatability(a, b); assert.equal(ok.warn, false); assert.ok(ok.rows.every((r) => r.diff < 0.2));
  assert.equal(CD.repeatability(a, bad).warn, true);
});

/* ═════ F. 부위 촬영 ═════ */
const RECT = [0.4, 0.4, 0.6, 0.55];
function siteRec(cam, siteId, day, frameOpt, o) {
  const fr = F.skinFrame(frameOpt || {}); const m = C.siteMeasure(fr.data, F.W, F.H, RECT);
  const ref = CD.siteRef(cam, siteId); const g = C.siteGate(ref ? ref.rois.site : null, m);
  const r = { id: (o && o.id) || `${siteId}-${day}-${Math.random().toString(36).slice(2, 5)}`, photoId: (o && o.id) || null, day, ts: day * 1000 + ((o && o.ts) || 0), kind: "site", siteId, source: "camera", rois: m.rois, gate: { ok: g.ok, reasons: g.reasons }, conf: "ok" };
  cam.sites[siteId] = cam.sites[siteId] || { id: siteId, label: siteId }; CD.addRecord(cam, r); return r;
}
c("C061", "팔-1 첫 사진 = 기준", () => { const cam = CD.empty(); const r = siteRec(cam, "arm-1", 3); assert.equal(CD.siteRef(cam, "arm-1").id, r.id); assert.equal(CD.deltas(cam, 3, "site:arm-1").dBase, null); });
c("C062", "같은 조명 +3 → Δa* +3, 팔-1 △", () => {
  const cam = CD.empty(); siteRec(cam, "arm-1", 3); siteRec(cam, "arm-1", 4, { dA: { forehead: 3, cheekL: 3, cheekR: 3, eye: 3, lips: 3 }, base: {} });
  // RECT는 ROI 밖 일반 피부 → base 색으로 +3 프레임 생성
  const cam2 = CD.empty(); siteRec(cam2, "arm-1", 3); siteRec(cam2, "arm-1", 4, { base: { a: 17 } });
  const d = CD.deltas(cam2, 4, "site:arm-1"); near(d.dBase, 3, 0.3);
  assert.equal(evalAt(daysFrom([4]), 4, { camera: CD.engineInput(cam2, 4) }).tiles.camSkin.level, 1);
});
c("C063", "조명 다름(±10% 초과) → 사진 저장, Δ 계산 안 함", () => { const cam = CD.empty(); siteRec(cam, "arm-1", 3); const r = siteRec(cam, "arm-1", 4, { Lscale: 0.8 }); assert.equal(r.gate.ok, false); assert.equal(CD.deltas(cam, 4, "site:arm-1").dBase, null); });
c("C064", "팔-2는 별도 기준·추세", () => { const cam = CD.empty(); siteRec(cam, "arm-1", 3); siteRec(cam, "arm-2", 4, { base: { a: 20 } }); assert.equal(CD.deltas(cam, 4, "site:arm-2").dBase, null); assert.equal(CD.series(cam, 4, "site:arm-1")[3], null); });
c("C065", "ROI 미지정 촬영 → '측정할 영역을 지정하십시오'", () => { assert.equal(C.siteMeasure(new Uint8ClampedArray(4), 1, 1, null).error, "noRect"); assert.ok(fs.readFileSync(path.join(__dirname, "..", "camera.js"), "utf8").includes("측정할 영역을 지정하십시오")); });
c("C066", "상처-1 D5·D6·D8 → 추세 D7 끊김, Δ어제·Δ기준", () => {
  const cam = CD.empty(); siteRec(cam, "wound-1", 5); siteRec(cam, "wound-1", 6, { base: { a: 15 } }); siteRec(cam, "wound-1", 8, { base: { a: 16 } });
  const s = CD.series(cam, 8, "site:wound-1"); assert.ok(s[4] !== null && s[5] !== null && s[6] === null && s[7] !== null);
  const d = CD.deltas(cam, 8, "site:wound-1"); assert.equal(d.dYest, null); assert.equal(d.last.day, 6); near(d.dBase, 2, 0.3);
});
c("C067", "입 안·입술 부위 → Δa* 기록만", () => { const cam = CD.empty(); siteRec(cam, "mouth-1", 2); siteRec(cam, "mouth-1", 3, { base: { a: 16 } }); near(CD.deltas(cam, 3, "site:mouth-1").dBase, 2, 0.3); });
c("C068", "결막 클릭 → a* 기록만, '빈혈 판정 아님', 규칙 연결 없음", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "camera.js"), "utf8"); assert.ok(src.includes("빈혈 판정 아님") && src.includes("not an anaemia judgement"));
  const cam = camWith(span(1, 5), 6, {}); cam.conj = [{ day: 6, a: 30 }]; assert.ok(!("conj" in CD.engineInput(cam, 6)));
  assert.ok(!rules.some((r) => JSON.stringify(r.when).includes("conj")));
});
c("C069", "기준 사진 삭제 → 남은 가장 오래된 사진이 새 기준", () => {
  const cam = CD.empty(); const r1 = siteRec(cam, "arm-1", 3, {}, { id: "p1" }); siteRec(cam, "arm-1", 4, { base: { a: 15 } }, { id: "p2" }); siteRec(cam, "arm-1", 5, { base: { a: 16 } }, { id: "p3" });
  const res = CD.removeRecord(cam, "p1"); assert.equal(res.refChanged, true); assert.equal(res.newRef.id, "p2"); near(CD.deltas(cam, 5, "site:arm-1").dBase, 1, 0.3);
  assert.ok(fs.readFileSync(path.join(__dirname, "..", "camera.js"), "utf8").includes("새 기준"));
});
c("C070", "피부 밝기 L=40/L=75 → 둘 다 Δa* ≈ +3 ±0.3", () => {
  for (const L of [40, 75]) { const a = F.measure(F.skinFrame({ Lbase: L })), b = F.measure(F.skinFrame({ Lbase: L, dA: face(3) })); assert.ok(a.rois.forehead.valid); near(b.rois.forehead.a - a.rois.forehead.a, 3, 0.3); }
});

/* ═════ G. rPPG ═════ */
const V = (o) => C.vitalsFromSamples(F.makeVideoSamples(o));
c("C071", "1.2 Hz 30초 → 72 ±2 bpm", () => { const r = V({ bpm: 72 }); assert.equal(r.status, "ok"); near(r.bpm, 72, 2); });
c("C072", "잡음 큰 신호 → lowSnr, 값 없음", () => { const r = V({ bpm: 72, amp: 0.05, noise: 2 }); assert.ok(r.reasons.includes("lowSnr")); assert.equal(r.bpm, undefined); });
c("C073", "구간 끊김 15% → frameDrop", () => { const r = V({ bpm: 72, gapFrac: 0.15 }); assert.ok(r.reasons.includes("frameDrop"), r.reasons.join()); });
c("C074", "15 fps 일정(공칭 30 보고) → 실측 기준 통과", () => { const r = V({ bpm: 72, fs: 15 }); assert.equal(r.status, "ok", r.reasons.join()); near(r.fps, 15, 0.1); });
c("C075", "조명 변동 > 5% → lightingVaries", () => { assert.ok(V({ bpm: 72, lightVar: 0.08 }).reasons.includes("lightingVaries")); });
c("C076", "일정한 G → noSignal, SNR 무한대 오판 없음", () => { const r = V({ constant: true }); assert.equal(r.status, "unavailable"); assert.ok(r.reasons.includes("noSignal")); });
c("C077", "얼굴 큰 움직임 → motion", () => { assert.ok(V({ bpm: 72, motion: true }).reasons.includes("motion")); });
c("C078", "수동 70·카메라 78 → camHrMismatch, 한쪽 없으면 노트 없음", () => {
  assert.ok(evalAt(daysFrom([1], { hr: 70 }), 1, { camera: { hr: 78 } }).notes.some((n) => n.id === "camHrMismatch"));
  assert.equal(evalAt(daysFrom([1], { hr: null }), 1, { camera: { hr: 78 } }).notes.length, 0);
  assert.equal(evalAt(daysFrom([1], { hr: 70 }), 1, { camera: {} }).notes.length, 0);
});
c("C079", "카메라 심박·호흡 추세·Δ어제·Δ기준선, 결측일 끊김", () => {
  const cam = CD.empty(); for (const d of [1, 2, 4, 5, 6]) CD.addRecord(cam, hrRec(d, 60 + d));
  const s = CD.series(cam, 6, "hr"); assert.equal(s[2], null); assert.equal(s[5], 66);
  const d = CD.deltas(cam, 6, "hr"); assert.equal(d.dYest, 1); assert.notEqual(d.dBase, null); assert.equal(CD.series(cam, 6, "resp")[0], 15);
});
c("C080", "피크가 대역 가장자리(42·180 bpm 부근) → bandEdge", () => { assert.ok(V({ bpm: 42.5 }).reasons.includes("bandEdge")); assert.ok(V({ bpm: 179 }).reasons.includes("bandEdge")); });
c("C081", "하모닉: 기본파 ≥50% → 기본파 채택, 모호하면 harmonic", () => {
  const ok = V({ harm: { bpm: 120, amp: 1, fundAmp: 0.8 } }); assert.equal(ok.status, "ok"); near(ok.bpm, 60, 2);
  assert.ok(V({ harm: { bpm: 120, amp: 1, fundAmp: 0.6 } }).reasons.includes("harmonic"));
  near(V({ bpm: 120 }).bpm, 120, 2);
});
c("C082", "같은 날 2회(통과·실패) → 그날 값 = 통과 기록, 점 1개", () => {
  const cam = CD.empty(); CD.addRecord(cam, hrRec(3, 70, true, 1)); CD.addRecord(cam, hrRec(3, null, false, 2));
  assert.equal(CD.deltas(cam, 3, "hr").today, 70); assert.equal(CD.series(cam, 3, "hr").filter((v) => v !== null).length, 1);
});

/* ═════ H. 체크인 × 카메라, 프리셋 ═════ */
const storeMod = require("../store.js");
c("C083", "체온 38.2 + face +3.5 → 타일 독립, 카메라가 체온 레벨을 올리지 않음", () => {
  const days = daysFrom(span(1, 20), (i) => ({ temp: i === 20 ? 38.2 : 36.6 }));
  const a = evalAt(days, 20), b = evalAt(days, 20, { camera: { face: 3.5 } });
  assert.equal(a.tiles.temp.level, b.tiles.temp.level); assert.equal(b.tiles.camFace.level, 1);
});
c("C084", "R2 트리거 + 카메라 +4 → R2는 체크인으로만, 카메라는 카드 사유 아님", () => {
  const days = daysFrom(span(1, 20), (i) => (i === 20 ? { temp: 38.6, hr: 90 } : {}));
  const ev = evalAt(days, 20, { camera: { face: 4 }, symptoms: { confusion: {} } }); assert.ok(ev.cards.includes("R2"));
  const r2 = rules.find((r) => r.id === "cardR2"); assert.ok(!r2.camera);
  assert.deepEqual(evalAt(days, 20, { symptoms: { confusion: {} } }).cards, ev.cards);
});
c("C085", "카메라 +5만, 체크인 정상 → L1만, 카드 없음", () => { const ev = evalAt(daysFrom(span(1, 20)), 20, { camera: { face: 5 } }); assert.equal(ev.overall, 1); assert.deepEqual(ev.cards, []); });
viaE2E("C086", "프리셋 11개: 모든 모니터 행에 데이터·추세·Δ, 카메라 합성 표시");
function demoEval(spec, sym) { const st = storeMod.fresh("demo"); CD.setSynthetic(st.camera, 30, spec); return { st, ev: E.evaluate({ days: st.days, day: 30, symptoms: sym, camera: CD.engineInput(st.camera, 30), flux: 0.2, events: {} }, rules) }; }
c("C087", "R4 프리셋: face +3.6 + hives 등 → camSkinCombo L2, R4 카드", () => {
  const { st, ev } = demoEval({ face: 3.6 }, { hives: {}, faceSwelling: {}, throatTight: {} });
  near(CD.deltas(st.camera, 30, "face").dBase, 3.6, 0.15); assert.ok(ev.tiles["m:skin"].rules.includes("camSkinCombo")); assert.ok(ev.cards.includes("R4"));
});
c("C088", "R3 프리셋: eye +4.2 → camEye1 L1 + 결합 L2, R3는 증상 트리거", () => {
  const { ev } = demoEval({ eye: 4.2 }, { eyeChem: {}, eyePain: {} });
  assert.equal(ev.tiles.camEye.level, 1); assert.ok(ev.tiles["m:eye"].rules.includes("camEyeCombo")); assert.ok(ev.cards.includes("R3"));
  const noCam = E.evaluate({ days: storeMod.fresh("demo").days, day: 30, symptoms: { eyeChem: {}, eyePain: {} }, camera: {}, flux: 0.2, events: {} }, rules); assert.ok(noCam.cards.includes("R3"));
});
c("C089", "다음 날 rash 해제 → camSkinCombo 해제, 카메라 L1만", () => { const { ev } = base5(face(3.2)); assert.ok(!ev.tiles["m:skin"]); assert.equal(ev.tiles.camFace.level, 1); });
c("C090", "프리셋 후 같은 날 실제 촬영 → 실제 기록이 대체, '합성' 사라짐", () => {
  const st = storeMod.fresh("demo"); CD.setSynthetic(st.camera, 30, { face: 3.6 }); assert.equal(CD.deltas(st.camera, 30, "face").synthetic, true);
  CD.addRecord(st.camera, rec(30, face(0), { ts: Date.now() + 10000 })); const d = CD.deltas(st.camera, 30, "face");
  assert.equal(d.synthetic, false); assert.ok(st.camera.records.find((r) => r.day === 30 && r.synthetic && r.kind === "daily").superseded);
});

/* ═════ I. 저장·내보내기·보고서·화면 ═════ */
function freshStore(ls) { const p = require.resolve("../store.js"); delete require.cache[p]; globalThis.localStorage = ls; const s = require("../store.js"); return s; }
c("C091", "localStorage 쓰기 실패 → 이후 읽기·쓰기 메모리로 일관, 배너, 소실 없음", () => {
  const backing = { "ujumin.v2": JSON.stringify({ v: 2, stale: true }) }; let fail = false;
  const ls = { getItem: (k) => (k in backing ? backing[k] : null), setItem: (k, v) => { if (fail) throw new Error("QuotaExceeded"); backing[k] = v; }, removeItem: (k) => delete backing[k] };
  const s = freshStore(ls);
  assert.equal(s.save({ v: 2, n: 1 }), true); assert.equal(s.persistent(), true);
  fail = true; assert.equal(s.save({ v: 2, n: 2 }), false); assert.equal(s.persistent(), false);
  const back = s.load(); assert.equal(back.n, 2, "실패 후에도 메모리 값 읽음(오래된 localStorage 값 아님)");
  s.photos.add({ id: "a" }); assert.equal(s.photos.all().length, 1);
  assert.ok(fs.readFileSync(path.join(__dirname, "..", "ui.js"), "utf8").includes("이 세션에서만 유지"));
  delete globalThis.localStorage; freshStore(undefined);
});
c("C092", "사진 저장 용량 80% → 경고, 자동 삭제 없음", () => {
  const backing = { "ujumin.photos.v2": JSON.stringify([{ id: "x", dataUrl: "a".repeat(4.3 * 1024 * 1024) }]) };
  const s = freshStore({ getItem: (k) => backing[k] ?? null, setItem: (k, v) => (backing[k] = v), removeItem: (k) => delete backing[k] });
  assert.equal(s.usage().warn, true); assert.equal(s.photos.all().length, 1);
  delete globalThis.localStorage; freshStore(undefined);
});
c("C093", "JSON 내보내기: 스키마·날짜·ROI별 a*,L*,b*·Δ·사유·synthetic, 사진 없음", () => {
  const st = storeMod.fresh("demo"); const ex = CD.exportData(st.camera, 30);
  assert.equal(ex.schema, "ujumin.camera.v2"); const r = ex.records.find((x) => x.kind === "daily");
  for (const k of ["a", "b", "L"]) assert.ok(typeof r.rois.forehead[k] === "number"); assert.ok("synthetic" in r);
  const d = ex.daily.find((x) => x.key === "face" && x.day === 30); assert.ok("dYest" in d && "dBase" in d && "reasons" in d);
  assert.ok(ex.daily.some((x) => x.status === "failed" && x.reasons.length)); assert.ok(!/dataUrl|data:image/.test(JSON.stringify(ex)));
});
c("C094", "보고서: '-0' 없음, 카메라 수치, 미사용이면 'camera: not used'", () => {
  assert.equal(R.sgn(-0.04, 1), "0.0"); assert.equal(R.sgn(-0.0001, 0), "0");
  const st = storeMod.fresh("demo"); const ev = E.evaluate({ days: st.days, day: 30, symptoms: { confusion: {} }, camera: CD.engineInput(st.camera, 30), flux: 0.2, events: {} }, rules);
  const card = UJ.CARDS.find((x) => x.id === "R2");
  const txt = R.reportText({ card, manual: false, comms: "yes", elapsedSec: 5, crew: "A", missionDay: 30, ev, today: {}, symptoms: {}, done: {}, photos: [], camera: CD.summary(st.camera, 30) });
  assert.ok(!/(^|[^0-9])-0(\.0+)?([^0-9.]|$)/m.test(txt), "no -0"); assert.ok(/Camera \(auxiliary signal, threshold \+3/.test(txt)); assert.ok(/camera HR/.test(txt));
  const t2 = R.reportText({ card, manual: false, comms: "no", elapsedSec: 0, crew: "A", missionDay: 1, ev, today: {}, symptoms: {}, done: {}, photos: [], camera: { used: false } });
  assert.ok(t2.includes("Camera: not used"));
});
viaE2E("C095", "한국어↔영어: 새 문구(게이트 사유·라벨·경고) 두 언어");
viaE2E("C096", "390px: 가로 넘침 없음, 체크인 입력이 첫 화면");
viaE2E("C097", "네트워크 요청 0건, CSP 위반 0건");
manual("C098", "file://와 https:// 실행", "file://는 e2e에서 자동 확인(C097 등). https://는 배포 전이라 미검증 — 배포 후 해당 URL에서 열어 카메라 권한·촬영·사진 파일 대체 경로를 직접 확인");
viaE2E("C099", "90일치 데이터 케어 화면 렌더 < 300 ms");
c("C100", "새 카메라 규칙·ROI가 출처 검증 통과, D0·보조 신호·설계 선택 표기", () => {
  assert.deepEqual(rejected, []);
  for (const id of ["camForehead1", "camCheekL1", "camCheekR1", "camLips1", "camFace1", "camEye1", "camSkin1"]) { const r = rules.find((x) => x.id === id); assert.ok(r, id); assert.equal(r.detection, "D0"); assert.ok(r.camera); }
  assert.ok(fs.readFileSync(path.join(__dirname, "..", "ui.js"), "utf8").includes("설계 선택"));
});
