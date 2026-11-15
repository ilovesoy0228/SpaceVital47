/* 우주민 camdata.js — 카메라 기록 모델. DOM 없는 순수 함수(테스트 가능).
 * 기록에는 절대값(ROI별 a*, b*, L*)만 저장하고 Δ어제·Δ기준선·얼굴 종합·추세는 읽을 때 계산한다.
 * 카메라 = 보조 신호, 감지 근거 D0. 모든 수치 기준(n≥3, 14일, 중앙값)은 [설계 선택]. 판정하지 않음. */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});
  const FACE = ["forehead", "cheekL", "cheekR"];
  const ROIS = ["forehead", "cheekL", "cheekR", "eye", "lips"];
  const RED_KEYS = ["face"].concat(ROIS);
  const BASE_DAYS = 14, RULE_MIN_N = 3;

  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const r2 = (v) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);
  const empty = () => ({ consent: false, records: [], sites: {}, conj: [], ref: null });

  function kindOf(key) { return key === "hr" || key === "resp" ? "hr" : String(key).startsWith("site:") ? "site" : "daily"; }
  function siteOf(key) { return String(key).startsWith("site:") ? key.slice(5) : null; }

  /* 얼굴 종합 = 유효한 얼굴 ROI(이마·양 뺨) a*의 중앙값. 유효 2개 미만이면 null */
  function faceOf(rois) {
    const v = FACE.map((k) => rois && rois[k]).filter((x) => x && x.valid).map((x) => x.a);
    return v.length >= 2 ? median(v) : null;
  }
  function valueOf(rec, key) {
    if (!rec) return null;
    if (key === "hr") return rec.hr ?? null;
    if (key === "resp") return rec.resp ?? null;
    if (kindOf(key) === "site") return rec.rois && rec.rois.site && rec.rois.site.valid ? rec.rois.site.a : null;
    if (key === "face") return faceOf(rec.rois);
    const r = rec.rois && rec.rois[key];
    return r && r.valid ? r.a : null;
  }
  const usable = (rec) => !!(rec && rec.gate && rec.gate.ok && rec.conf !== "low");
  const matches = (rec, kind, site) => rec.kind === kind && (kind !== "site" || rec.siteId === site);

  /* 그날 값 = 그날 통과한 기록 중 마지막(ts 순). 실패 기록은 저장되지만 값이 아님 */
  function dayRecords(cam, D, key) {
    const kind = kindOf(key), site = siteOf(key);
    return (cam.records || []).filter((r) => r.day === D && matches(r, kind, site)).sort((a, b) => a.ts - b.ts);
  }
  function dayRecord(cam, D, key) {
    const list = dayRecords(cam, D, key).filter((r) => r.gate && r.gate.ok && valueOf(r, key) !== null);
    return list.length ? list[list.length - 1] : null;
  }

  /* 같은 날 재촬영: 새 유효 기록이 들어오면 이전 유효 기록은 superseded */
  function recomputeSuperseded(cam) {
    const groups = {};
    for (const r of cam.records) { const k = r.day + "|" + r.kind + "|" + (r.siteId || ""); (groups[k] = groups[k] || []).push(r); }
    for (const k in groups) {
      const ok = groups[k].filter((r) => r.gate && r.gate.ok).sort((a, b) => a.ts - b.ts);
      groups[k].forEach((r) => (r.superseded = false));
      ok.slice(0, -1).forEach((r) => (r.superseded = true));
    }
    return cam;
  }
  function addRecord(cam, rec) {
    cam.records = (cam.records || []).concat([rec]);
    return recomputeSuperseded(cam);
  }
  /* 기록 삭제(사진 삭제 포함). 부위 기준이 지워지면 남은 가장 오래된 유효 기록이 새 기준 */
  function removeRecord(cam, id) {
    const rec = cam.records.find((r) => r.id === id || r.photoId === id);
    if (!rec) return { refChanged: false };
    const wasRef = rec.kind === "site" && siteRef(cam, rec.siteId) === rec;
    cam.records = cam.records.filter((r) => r !== rec);
    recomputeSuperseded(cam);
    return { refChanged: wasRef, newRef: wasRef ? siteRef(cam, rec.siteId) : null };
  }

  /* 유효 값이 있는 날 목록(D 이하) */
  function validDays(cam, D, key) {
    const days = Array.from(new Set((cam.records || []).filter((r) => r.day <= D).map((r) => r.day))).sort((a, b) => a - b);
    const out = [];
    for (const d of days) { const rec = dayRecord(cam, d, key); if (usable(rec)) out.push({ day: d, value: valueOf(rec, key), rec }); }
    return out;
  }

  /* 카메라 기준선: 유효 기록일 처음 14일의 중앙값(오늘 제외). n = 오늘 포함 처음 14일 중 D 이하 개수.
   * n=1 → Δ 숨김 / n=2 → Δ 표시, 규칙 꺼짐 / n≥3 → 규칙 켜짐 / n=14 → 확정(이후 값은 섞지 않음) */
  /* 합성 기록과 실제 촬영은 섞어 비교하지 않음: 오늘 기록의 종류(없으면 실제 기록이 있으면 실제)만 사용 */
  function classOf(cam, D, key) {
    const kind = kindOf(key), site = siteOf(key);
    const today = (cam.records || []).filter((r) => r.day === D && matches(r, kind, site) && r.gate && r.gate.ok).sort((a, b) => a.ts - b.ts).pop();
    if (today) return !!today.synthetic;
    return !(cam.records || []).some((r) => !r.synthetic && r.day <= D && matches(r, kind, site));
  }
  function scoped(cam, D, key) { const syn = classOf(cam, D, key); return Object.assign({}, cam, { records: (cam.records || []).filter((r) => !!r.synthetic === syn) }); }
  function baseline(cam, D, key) { return baselineRaw(scoped(cam, D, key), D, key); }
  function baselineRaw(cam, D, key) {
    if (kindOf(key) === "site") {
      const ref = siteRef(cam, siteOf(key));
      return ref && ref.day <= D ? { value: valueOf(ref, key), n: validDays(cam, D, key).length, locked: true, refDay: ref.day, refId: ref.id, rulesOn: true } : { value: null, n: 0, locked: false, rulesOn: false };
    }
    const first = validDays(cam, D, key).slice(0, BASE_DAYS);
    const prior = first.filter((x) => x.day < D);
    const n = first.length;
    return { value: prior.length ? median(prior.map((x) => x.value)) : null, n, locked: n >= BASE_DAYS, rulesOn: n >= RULE_MIN_N, days: first.map((x) => x.day) };
  }
  function siteRef(cam, siteId) {
    const list = (cam.records || []).filter((r) => r.kind === "site" && r.siteId === siteId && r.gate && r.gate.ok).sort((a, b) => a.day - b.day || a.ts - b.ts);
    return list[0] || null;
  }

  /* 한 키(ROI·face·hr·resp·site:id)의 오늘 상태와 Δ — 읽을 때 계산 */
  function deltas(cam, D, key) { return deltasRaw(scoped(cam, D, key), D, key); }
  function deltasRaw(cam, D, key) {
    const recs = dayRecords(cam, D, key), rec = dayRecord(cam, D, key);
    const kind = kindOf(key);
    let todayStatus = "none";
    if (rec) todayStatus = rec.conf === "low" ? "lowconf" : "ok";
    else if (recs.length) todayStatus = "failed";
    const today = rec ? valueOf(rec, key) : null;
    const yRecs = dayRecords(cam, D - 1, key), yRec = dayRecord(cam, D - 1, key);
    const yUsable = usable(yRec);
    const yStatus = yUsable ? "ok" : yRecs.length ? "failed" : "none";
    const yesterday = yUsable ? valueOf(yRec, key) : null;
    const prior = validDays(cam, D - 1, key);
    const lastV = prior.length ? prior[prior.length - 1] : null;
    const b = baselineRaw(cam, D, key);
    const ok = todayStatus === "ok";
    const showDelta = kind === "site" ? !!(rec && b.refId && rec.id !== b.refId) : b.n >= 2;
    const out = {
      key, today: r2(today), todayStatus, synthetic: !!(rec && rec.synthetic), source: rec ? rec.source : null, reasons: recs.length ? (recs[recs.length - 1].gate || {}).reasons || [] : [],
      yesterday: r2(yesterday), yStatus,
      dYest: ok && yesterday !== null ? r2(today - yesterday) : null,
      last: yStatus !== "ok" && lastV ? { day: lastV.day, value: r2(lastV.value), ago: D - lastV.day } : null,
      lastValid: !ok && lastV ? { day: lastV.day, value: r2(lastV.value) } : null,
      base: r2(b.value), n: b.n, locked: b.locked, rulesOn: b.rulesOn && ok,
      dBase: ok && showDelta && b.value !== null ? r2(today - b.value) : null,
      sourceMismatch: !!(ok && yUsable && rec.source !== yRec.source),
      partial: key === "face" && rec ? FACE.some((k) => !(rec.rois[k] && rec.rois[k].valid)) : false,
      excluded: key === "face" && rec ? FACE.filter((k) => !(rec.rois[k] && rec.rois[k].valid)).map((k) => [k, (rec.rois[k] || {}).reason || "invalid"]) : [],
    };
    out.dLast = ok && out.last ? r2(today - out.last.value) : null;
    // 얼굴 종합 Δ = 유효한 얼굴 ROI별 Δ의 중앙값(2개 이상). 절대값 중앙값끼리 빼지 않음(케이스 C053)
    if (key === "face" && ok) {
      const per = FACE.map((k) => deltas(cam, D, k));
      const md = (f) => { const v = per.map(f).filter((x) => x !== null && x !== undefined); return v.length >= 2 ? r2(median(v)) : null; };
      out.dBase = showDelta ? md((x) => x.dBase) : null; out.dYest = md((x) => x.dYest); out.dLast = out.last ? md((x) => x.dLast) : null;
    }
    return out;
  }

  /* 추세 시리즈 D1..D — 유효 기록만(실패·낮은 신뢰·미촬영 = null, 보간 금지) */
  function series(cam0, D, key, from) {
    const cam = scoped(cam0, D, key), out = [];
    for (let d = from || 1; d <= D; d++) { const rec = dayRecord(cam, d, key); out.push(usable(rec) ? r2(valueOf(rec, key)) : null); }
    return out;
  }

  /* 엔진 입력: 규칙 켜짐(n≥3)이고 오늘 유효(신뢰 ok)인 키만 Δ기준선을 넘김. 어제 Δ는 규칙에 쓰지 않음 */
  function engineInput(cam, D) {
    const out = {};
    if (!cam) return out; // 합성 기록은 동의 없이도 표시·평가(실제 촬영은 동의 후에만 생김)
    for (const k of RED_KEYS) { const d = deltas(cam, D, k); if (d.rulesOn && d.dBase !== null) out[k] = d.dBase; }
    let skin = null;
    for (const id of Object.keys(cam.sites || {})) { const d = deltas(cam, D, "site:" + id); if (d.todayStatus === "ok" && d.dBase !== null && (skin === null || d.dBase > skin)) skin = d.dBase; }
    if (skin !== null) out.skin = skin;
    const hr = deltas(cam, D, "hr"); if (hr.todayStatus === "ok") { out.hr = hr.today; }
    const rp = deltas(cam, D, "resp"); if (rp.todayStatus === "ok") out.resp = rp.today;
    return out;
  }

  /* 재현성 점검: 같은 사람 연속 2회 촬영 ROI별 |Δa*|. 1.5 초과면 경고([설계 선택]) */
  function repeatability(r1, r2_, limit) {
    limit = limit || 1.5;
    const rows = ROIS.map((k) => { const a = r1.rois[k], b = r2_.rois[k]; return { roi: k, diff: a && b && a.valid && b.valid ? r2(Math.abs(a.a - b.a)) : null }; });
    return { rows, warn: rows.some((x) => x.diff !== null && x.diff > limit), limit };
  }

  /* 내보내기(숫자만, 사진·영상 없음) */
  function exportData(cam, D) {
    const keys = RED_KEYS.concat(Object.keys(cam.sites || {}).map((s) => "site:" + s), ["hr", "resp"]);
    const days = Array.from(new Set((cam.records || []).map((r) => r.day))).filter((d) => d <= D).sort((a, b) => a - b);
    return {
      schema: "ujumin.camera.v2", missionDay: D,
      note: "Numbers only - no photos or video. Camera = auxiliary signal, detection evidence D0. SIMULATED/PROTOTYPE, not for clinical use.",
      records: (cam.records || []).filter((r) => r.day <= D).map((r) => ({ id: r.id, day: r.day, ts: r.ts, kind: r.kind, source: r.source, siteId: r.siteId || null, synthetic: !!r.synthetic, superseded: !!r.superseded,
        gate: r.gate, conf: r.conf, rois: r.rois, bg: r.bg || null, hr: r.hr ?? null, resp: r.resp ?? null, snr: r.snr ?? null })),
      daily: days.flatMap((d) => keys.map((k) => { const x = deltas(cam, d, k); return x.todayStatus === "none" ? null : { day: d, key: k, value: x.today, status: x.todayStatus, dYest: x.dYest, dBase: x.dBase, reasons: x.reasons, synthetic: x.synthetic }; }).filter(Boolean)),
    };
  }

  /* 보고서용 요약 */
  function summary(cam, D) {
    if (!cam || !(cam.records || []).some((r) => r.day === D)) return { used: false };
    const rows = RED_KEYS.map((k) => deltas(cam, D, k)).filter((x) => x.todayStatus !== "none");
    const hr = deltas(cam, D, "hr"), hrRec = dayRecords(cam, D, "hr").pop();
    return { used: true, rows, hr: hrRec ? { bpm: hr.today, status: hr.todayStatus, snr: hrRec.snr ?? null, reasons: (hrRec.gate || {}).reasons || [] } : null };
  }

  /* ───── 합성 시드 (시연용, synthetic:true) ───── */
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const BASE_LAB = { forehead: { a: 14, b: 18, L: 65 }, cheekL: { a: 15.5, b: 17, L: 63 }, cheekR: { a: 15.5, b: 17, L: 63 }, eye: { a: 12, b: 15, L: 58 }, lips: { a: 24, b: 12, L: 52 } };
  function gaussFn(r) { return () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }
  function synthRois(offsets, rnd, sigma) {
    const out = {};
    for (const k of ROIS) { const b = BASE_LAB[k]; out[k] = { a: r2(b.a + (offsets[k] || 0) + sigma * rnd()), b: r2(b.b + 0.4 * rnd()), L: r2(b.L + 0.5 * rnd()), n: 900, valid: true, reason: null }; }
    return out;
  }
  /* D1..D(days): 결측 D9·D17·D22, 게이트 실패 D13, 파일 출처 D5 (케이스표 §3) */
  function seed(days, s) {
    const rnd = gaussFn(rng(s || 4242)), recs = [];
    for (let d = 1; d <= days; d++) {
      if (d === 9 || d === 17 || d === 22) continue;
      const fail = d === 13;
      recs.push({ id: "syn-d" + d, day: d, ts: d * 1e6, kind: "daily", source: d === 5 ? "file" : "camera", synthetic: true, superseded: false, conf: "ok",
        rois: synthRois({}, rnd, 0.6), bg: { a: 0.5, b: 1, L: 40, valid: true }, gate: fail ? { ok: false, reasons: ["lighting"] } : { ok: true, reasons: [] } });
      if (d % 3 !== 0 && !fail) recs.push({ id: "syn-hr-d" + d, day: d, ts: d * 1e6 + 1, kind: "hr", source: "camera", synthetic: true, superseded: false, conf: "ok", rois: {},
        hr: Math.round(63 + 2 * rnd()), resp: Math.round(14 + rnd()), snr: r2(30 + 5 * rnd()), gate: { ok: true, reasons: [] } });
    }
    return recs;
  }
  /* 프리셋: 그날 합성 기록을 시나리오 오프셋(기준선 중앙값 대비)으로 설정. 같은 날 이전 합성 기록은 교체 */
  function setSynthetic(cam, D, spec) {
    cam.records = (cam.records || []).filter((r) => !(r.day === D && r.synthetic));
    const rnd = gaussFn(rng(1000 + D)), offs = {};
    for (const k of ROIS) offs[k] = 0;
    if (spec.face !== undefined) FACE.forEach((k) => (offs[k] = spec.face));
    for (const k of ROIS) if (spec[k] !== undefined) offs[k] = spec[k];
    const rois = {};
    for (const k of ROIS) { const b = baseline(cam, D, k), base = b.value !== null ? b.value : BASE_LAB[k].a; rois[k] = { a: r2(base + offs[k] + 0.05 * rnd()), b: BASE_LAB[k].b, L: BASE_LAB[k].L, n: 900, valid: true, reason: null }; }
    addRecord(cam, { id: "syn-p" + D + "-" + Date.now().toString(36), day: D, ts: Date.now(), kind: "daily", source: "camera", synthetic: true, conf: "ok", rois, bg: { a: 0.5, b: 1, L: 40, valid: true }, gate: { ok: true, reasons: [] } });
    if (spec.hr !== undefined) {
      cam.records = cam.records.filter((r) => !(r.day === D && r.kind === "hr" && r.synthetic));
      addRecord(cam, { id: "syn-ph" + D, day: D, ts: Date.now() + 1, kind: "hr", source: "camera", synthetic: true, conf: "ok", rois: {}, hr: spec.hr, resp: spec.resp || 15, snr: 28, gate: { ok: true, reasons: [] } });
    }
    return cam;
  }

  UJ.camdata = { FACE, ROIS, RED_KEYS, BASE_DAYS, RULE_MIN_N, median, empty, faceOf, valueOf, kindOf, dayRecord, dayRecords, addRecord, removeRecord, recomputeSuperseded,
    baseline, siteRef, deltas, series, engineInput, repeatability, exportData, summary, seed, setSynthetic, BASE_LAB };
  if (typeof module !== "undefined" && module.exports) module.exports = UJ.camdata;
})(typeof window !== "undefined" ? window : globalThis);
