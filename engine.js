/* 우주민 engine.js — DOM 없는 순수 함수. 입력(오늘·이력·증상·카메라·이벤트) → 타일·단계·카드·메시지 */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});
  const BASELINE_DAYS = 14;
  const CAM_MISMATCH_BPM = 5;

  /* 규칙 로드: 출처 id가 없거나, 존재하지 않거나, 'read'가 아닌 출처만 있으면 제외하고 경고 */
  function loadRules(rules, sources, warn) {
    warn = warn || ((m) => (typeof console !== "undefined" ? console.warn(m) : null));
    const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
    const ok = [], rejected = [];
    for (const r of rules) {
      const ids = Array.isArray(r.sources) ? r.sources : [];
      const missing = ids.filter((id) => !byId[id]);
      const usable = ids.filter((id) => byId[id] && byId[id].status === "read");
      if (!ids.length || missing.length || !usable.length) {
        rejected.push(r.id);
        warn(`[UJ] rule "${r.id}" not loaded: ${!ids.length ? "no source id" : missing.length ? "unknown source " + missing.join(",") : "no source with status=read"}`);
        continue;
      }
      ok.push(Object.assign({}, r, { sources: usable, camera: usesCamera(r.when) }));
    }
    return { rules: ok, rejected };
  }

  function usesCamera(w) {
    if (!w) return false;
    if (w.cam) return true;
    return (w.all || w.any || []).some(usesCamera);
  }

  const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(+v) ? null : +v);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  /* 기준선 = 이력의 처음 14일 평균. 유효값 14개 미만이면 null (수집 중 n/14) */
  function baselines(history, channelIds) {
    const out = {};
    for (const ch of channelIds) {
      const vals = history.slice(0, BASELINE_DAYS).map((d) => num(d[ch])).filter((v) => v !== null);
      out[ch] = { value: vals.length >= BASELINE_DAYS ? mean(vals) : null, n: Math.min(vals.length, BASELINE_DAYS) };
    }
    return out;
  }

  function cmp(v, c) {
    if (v === null) return false;
    if (c.gte !== undefined && !(v >= c.gte - 1e-9)) return false;
    if (c.gt !== undefined && !(v > c.gt)) return false;
    if (c.lte !== undefined && !(v <= c.lte + 1e-9)) return false;
    if (c.lt !== undefined && !(v < c.lt)) return false;
    return true;
  }

  function test(w, ctx) {
    if (w.all) return w.all.every((x) => test(x, ctx));
    if (w.any) return w.any.some((x) => test(x, ctx));
    if (w.sym) return ctx.syms.has(w.sym);
    if (w.symAny) return w.symAny.some((s) => ctx.syms.has(s));
    if (w.event) return !!ctx.events[w.event];
    if (w.flux) return cmp(num(ctx.flux), w.flux);
    if (w.cam) return cmp(num(ctx.cam[w.cam]), w);
    if (w.ch) {
      const v = num(ctx.today[w.ch]);
      if (w.dBase) {
        const b = ctx.base[w.ch] && ctx.base[w.ch].value;
        if (v === null || b === null || b === undefined) return false;
        return cmp(v - b, w.dBase);
      }
      return cmp(v, w);
    }
    return false;
  }

  /**
   * evaluate(input, rules)
   * input = { today:{ch:val}, history:[{ch:val}] (오늘 제외, 오래된 순), symptoms:{id:true|{sev}},
   *           camera:{face,eye,skin (Δa*), hr, resp}, flux, events:{shelter} }
   */
  function evaluate(input, rules) {
    const today = input.today || {};
    const history = input.history || [];
    const chIds = Array.from(new Set(Object.keys(today).concat(history.length ? Object.keys(history[0]) : []))).filter((k) => k !== "date");
    const base = baselines(history, chIds);
    const yest = history.length ? history[history.length - 1] : {};
    const syms = new Set(Object.keys(input.symptoms || {}).filter((k) => input.symptoms[k]));
    const cam = input.camera || {};
    const ctx = { today, base, syms, cam, flux: input.flux, events: input.events || {} };

    const deltas = {};
    for (const ch of chIds) {
      const v = num(today[ch]), y = num(yest[ch]), b = base[ch] ? base[ch].value : null;
      deltas[ch] = { today: v, yesterday: y, base: b, n: base[ch] ? base[ch].n : 0,
        dYest: v !== null && y !== null ? v - y : null, dBase: v !== null && b !== null ? v - b : null };
    }

    const tiles = {};
    const cards = [];
    for (const r of rules) {
      if (!test(r.when, ctx)) continue;
      let level = r.level;
      // 카메라 신호: 자기 채널 최대 주의(1), 결합 규칙도 최대 조치(2), 카메라로 긴급 생성 금지
      if (r.camera) level = Math.min(level, r.type === "camera" ? 1 : 2);
      const t = (tiles[r.tile] = tiles[r.tile] || { level: 0, rules: [], top: null });
      t.rules.push(r.id);
      if (level > t.level || (level === t.level && !t.top)) { t.level = level; t.top = r; }
      if (r.card && level === 3 && !r.camera && !cards.includes(r.card)) cards.push(r.card);
    }

    const notes = [];
    const camHr = num(cam.hr), hr = num(today.hr);
    if (camHr !== null && hr !== null && Math.abs(camHr - hr) >= CAM_MISMATCH_BPM) notes.push({ id: "camHrMismatch", diff: camHr - hr });

    let overall = 0;
    for (const k in tiles) overall = Math.max(overall, tiles[k].level);
    if (cards.length) overall = 3;
    return { tiles, overall, cards, base, deltas, notes, baselineReady: Object.values(base).some((b) => b.value !== null) };
  }

  /* Respond 상태: 새 카드 트리거가 처음 나타날 때만 자동 전환. 확인한 조건은 사라질 때까지 재전환 없음 */
  function newRespondState() { return { acked: {}, manual: {}, prevActive: [], t0: {} }; }

  function updateRespond(rs, detected, now) {
    const next = { acked: Object.assign({}, rs.acked), manual: Object.assign({}, rs.manual), prevActive: rs.prevActive.slice(), t0: Object.assign({}, rs.t0) };
    for (const k of Object.keys(next.acked)) if (!detected.includes(k)) delete next.acked[k];
    const all = Array.from(new Set(detected.concat(Object.keys(next.manual).filter((k) => next.manual[k]))));
    const active = all.filter((k) => !next.acked[k] || next.manual[k]);
    for (const k of Object.keys(next.t0)) if (!active.includes(k)) delete next.t0[k];
    for (const k of active) if (!next.t0[k]) next.t0[k] = now || 0;
    const fresh = active.filter((k) => detected.includes(k) && !next.prevActive.includes(k));
    next.prevActive = active.slice();
    return { rs: next, active, fresh, autoSwitch: fresh.length > 0 };
  }

  function startManual(rs, card) { const n = JSON.parse(JSON.stringify(rs)); n.manual[card] = true; return n; }

  function standDown(rs, card, detected) {
    const n = JSON.parse(JSON.stringify(rs));
    delete n.manual[card];
    delete n.t0[card];
    if (detected.includes(card)) n.acked[card] = true;
    n.prevActive = n.prevActive.filter((k) => k !== card || detected.includes(card));
    return n;
  }

  /* 채널별 임계선(그래프용): 규칙에서 해당 채널 기준을 꺼냄 */
  function thresholdLines(rules, ch, baseValue) {
    const lines = [];
    const visit = (w, r) => {
      if (w.all || w.any) return (w.all || w.any).forEach((x) => visit(x, r));
      if (w.ch !== ch) return;
      const c = w.dBase || w, rel = !!w.dBase;
      for (const op of ["gte", "gt", "lte", "lt"]) if (c[op] !== undefined) {
        if (rel && (baseValue === null || baseValue === undefined)) continue;
        const v = rel ? baseValue + c[op] : c[op];
        if (!lines.some((l) => Math.abs(l.value - v) < 1e-9)) lines.push({ value: v, level: r.level, label: rel ? (c[op] > 0 ? "+" : "") + c[op] : String(c[op]) });
      }
    };
    rules.filter((r) => !r.generic && r.level < 3).forEach((r) => visit(r.when, r));
    return lines;
  }

  Object.assign(UJ, { engine: { loadRules, baselines, evaluate, newRespondState, updateRespond, startManual, standDown, thresholdLines, BASELINE_DAYS } });
  if (typeof module !== "undefined" && module.exports) module.exports = UJ.engine;
})(typeof window !== "undefined" ? window : globalThis);
