// node --test tests/  — 엔진·데이터 무결성 테스트 (DOM 없음)
const test = require("node:test");
const assert = require("node:assert/strict");
require("../data.js");
require("../engine.js");
const UJ = globalThis.UJ;
const E = UJ.engine;

const warnings = [];
const { rules, rejected } = E.loadRules(UJ.RULES, UJ.SOURCES, (m) => warnings.push(m));

const BASE = { hr: 62, temp: 36.6, sleep: 7, stress: 2, intake: 100, ex: 90, co2: 3 };
const history = Array.from({ length: 29 }, () => Object.assign({}, BASE));
const run = (today, symptoms, extra) =>
  E.evaluate(Object.assign({ today: Object.assign({}, BASE, today), history, symptoms: symptoms || {}, camera: {}, flux: 0.2, events: {} }, extra || {}), rules);

test("데이터 무결성: 모든 규칙이 존재하는 'read' 출처를 가짐 → 거부 0", () => {
  assert.deepEqual(rejected, [], warnings.join("\n"));
  const ids = new Set(UJ.SOURCES.map((s) => s.id));
  for (const c of UJ.CONDITIONS) for (const s of c.sources) assert.ok(ids.has(s), `${c.id} → ${s}`);
  for (const c of UJ.CARDS) for (const s of c.sources) assert.ok(ids.has(s), `${c.id} → ${s}`);
});

test("데이터 무결성: CONDITIONS 63행(§4), O·D 표기 누락 0, 카드 13개", () => {
  assert.equal(UJ.CONDITIONS.length, 63);
  for (const c of UJ.CONDITIONS) {
    assert.match(c.occurrence, /^O[0-3]$/, c.id);
    assert.match(c.detection, /^D[0-2]$/, c.id);
    assert.ok(UJ.CATEGORIES[c.category], c.id);
  }
  assert.equal(new Set(UJ.CONDITIONS.map((c) => c.id)).size, 63);
  assert.equal(UJ.CARDS.length, 13);
  const symIds = new Set(UJ.SYMPTOMS.map((s) => s.id)), condIds = new Set(UJ.CONDITIONS.map((c) => c.id));
  for (const s of UJ.SYMPTOMS) for (const m of s.mapsTo) assert.ok(condIds.has(m), `${s.id} → ${m}`);
  const walk = (w, id) => { if (w.sym) assert.ok(symIds.has(w.sym), `${id}: ${w.sym}`); (w.symAny || []).forEach((s) => assert.ok(symIds.has(s), `${id}: ${s}`)); (w.all || w.any || []).forEach((x) => walk(x, id)); };
  for (const r of UJ.RULES) walk(r.when, r.id);
  for (const c of UJ.CARDS) for (const t of c.trigger) assert.ok(UJ.RULES.some((r) => r.id === t && r.card === c.id), `${c.id} trigger ${t}`);
});

test("출처 없는 규칙은 로드하지 않고 경고", () => {
  const w = [];
  const r = E.loadRules([{ id: "x", when: {}, sources: [] }, { id: "y", when: {}, sources: ["pmc11090304"] }, { id: "z", when: {}, sources: ["nope"] }], UJ.SOURCES, (m) => w.push(m));
  assert.equal(r.rules.length, 0);
  assert.deepEqual(r.rejected, ["x", "y", "z"]);
  assert.equal(w.length, 3);
});

test("정상일 → 종합 0, 카드 없음", () => {
  const r = run({});
  assert.equal(r.overall, 0);
  assert.deepEqual(r.cards, []);
});

test("수면 부족 + 스트레스 → 수면 조치(2), 스트레스 조치(2)", () => {
  const r = run({ sleep: 4.5, stress: 4 });
  assert.equal(r.tiles.sleep.level, 2);
  assert.equal(r.tiles.stress.level, 2);
  assert.equal(r.overall, 2);
});

test("발열 + 심박 +20 + 의식 혼미 → R2, 종합 3", () => {
  const r = run({ temp: 38.4, hr: 85 }, { confusion: true });
  assert.ok(r.cards.includes("R2"));
  assert.equal(r.overall, 3);
  const r2 = run({ temp: 38.4, hr: 85 });
  assert.ok(!r2.cards.includes("R2"), "의식 혼미 없으면 R2 아님");
  assert.equal(r2.tiles.temp.level, 2);
});

test("흉통 + 심박 +20 → R5 / 흉통 단독은 조치(2)", () => {
  assert.ok(run({ hr: 84 }, { chestPain: true }).cards.includes("R5"));
  const solo = run({}, { chestPain: true });
  assert.deepEqual(solo.cards, []);
  assert.equal(solo.tiles["m:chest"].level, 2);
});

test("알레르기 조합 → R4 / 두드러기 단독은 R4 아님", () => {
  assert.ok(run({}, { hives: true, throatTight: true }).cards.includes("R4"));
  assert.ok(!run({}, { hives: true }).cards.includes("R4"));
});

test("대피 지시 → R1 / 플럭스 ≥10만으로는 조치(2)까지", () => {
  assert.ok(run({}, {}, { events: { shelter: true } }).cards.includes("R1"));
  const f = run({}, {}, { flux: 50 });
  assert.equal(f.tiles.rad.level, 2);
  assert.deepEqual(f.cards, []);
});

test("눈 화학물질 → R3", () => {
  assert.ok(run({}, { eyeChem: true }).cards.includes("R3"));
});

test("카메라 단독은 최대 주의(1), 증상 결합 시 조치(2), 긴급 생성 없음", () => {
  const solo = run({}, {}, { camera: { face: 6 } });
  assert.equal(solo.tiles.camFace.level, 1);
  assert.equal(solo.overall, 1);
  const combo = run({}, { rash: true }, { camera: { face: 6 } });
  assert.equal(combo.tiles["m:skin"].level, 2);
  assert.deepEqual(combo.cards, []);
});

test("카메라 심박과 수동 심박 5 bpm 이상 차이 → 측정 불일치", () => {
  assert.ok(run({ hr: 62 }, {}, { camera: { hr: 70 } }).notes.some((n) => n.id === "camHrMismatch"));
  assert.ok(!run({ hr: 62 }, {}, { camera: { hr: 64 } }).notes.length);
});

test("어제 대비 Δ와 기준선 대비 Δ", () => {
  const h = history.slice(); h[28] = Object.assign({}, BASE, { hr: 66 });
  const r = E.evaluate({ today: Object.assign({}, BASE, { hr: 70 }), history: h, symptoms: {}, camera: {}, events: {} }, rules);
  assert.equal(r.deltas.hr.dYest, 4);
  assert.equal(r.deltas.hr.dBase, 8);
});

test("미입력은 0이 아님 (섭취 비어 있으면 섭취 규칙 미발동)", () => {
  const r = run({ intake: "" });
  assert.equal(r.tiles.intake, undefined);
});

test("기준선 수집 중(n<14) → 기준선 규칙 대신 절대 범위만", () => {
  const short = history.slice(0, 5);
  const r = E.evaluate({ today: Object.assign({}, BASE, { hr: 95, temp: 38.2 }), history: short, symptoms: {}, camera: {}, events: {} }, rules);
  assert.equal(r.deltas.hr.base, null);
  assert.equal(r.deltas.hr.n, 5);
  assert.equal(r.tiles.hr, undefined, "기준선 규칙 미적용");
  assert.equal(r.tiles.temp.level, 2, "절대 범위(≥38.0)는 적용");
});

test("Respond: 새 트리거에서만 자동 전환, 종료 후 재전환 없음, 조건 해소 후 재발 시 다시 전환", () => {
  let s = E.newRespondState();
  let u = E.updateRespond(s, ["R2"], 1); assert.equal(u.autoSwitch, true); s = u.rs;
  u = E.updateRespond(s, ["R2"], 2); assert.equal(u.autoSwitch, false); s = u.rs;
  s = E.standDown(s, "R2", ["R2"]);
  u = E.updateRespond(s, ["R2"], 3); assert.equal(u.autoSwitch, false); assert.deepEqual(u.active, []); s = u.rs;
  u = E.updateRespond(s, [], 4); s = u.rs;               // 조건 해소 → ack 해제
  u = E.updateRespond(s, ["R2"], 5); assert.equal(u.autoSwitch, true);
});

test("Respond: 수동 시작 (R11 수동 전용 포함)", () => {
  let s = E.startManual(E.newRespondState(), "R11");
  const u = E.updateRespond(s, [], 1);
  assert.deepEqual(u.active, ["R11"]);
  assert.equal(u.autoSwitch, false, "수동 시작은 자동 전환으로 세지 않음");
  s = E.standDown(u.rs, "R11", []);
  assert.deepEqual(E.updateRespond(s, [], 2).active, []);
});

test("임계선: 심박은 기준선+10/+20", () => {
  const l = E.thresholdLines(rules, "hr", 62).map((x) => x.value).sort();
  assert.deepEqual(l, [72, 82]);
});
