/* SpaceVital47 store.js — 브라우저 저장소. 쓰기가 한 번 실패하면 이후 모든 읽기·쓰기를 메모리로 일관 전환(이 세션에서만 유지).
 * 네트워크 없음. 사진 용량 80%에서 경고만(자동 삭제 금지). */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});
  const KEY = "ujumin.v2", PKEY = "ujumin.photos.v2";
  const LIMIT = 5 * 1024 * 1024; // 대부분 브라우저의 localStorage 한도(문자 수 근사) [설계 선택]
  const mem = {};
  let memMode = false;
  const ls = () => { try { return g.localStorage || null; } catch (e) { return null; } };
  function toMemory() {
    if (memMode) return;
    try { const s = ls(); if (s) for (const k of [KEY, PKEY]) { const v = s.getItem(k); if (v !== null && mem[k] === undefined) mem[k] = v; } } catch (e) { /* 읽기도 막힘 */ }
    memMode = true;
  }
  function raw(k) {
    if (memMode) return mem[k] === undefined ? null : mem[k];
    try { const s = ls(); if (!s) { memMode = true; return mem[k] === undefined ? null : mem[k]; } return s.getItem(k); } catch (e) { toMemory(); return mem[k] === undefined ? null : mem[k]; }
  }
  function read(k) { const v = raw(k); try { return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function write(k, v) {
    const str = JSON.stringify(v);
    if (!memMode) {
      try { const s = ls(); if (s) { s.setItem(k, str); return true; } } catch (e) { /* 용량 초과·차단 */ }
      toMemory();
    }
    mem[k] = str; return false;
  }
  function remove(k) { delete mem[k]; if (!memMode) try { const s = ls(); if (s) s.removeItem(k); } catch (e) { /* ignore */ } }

  const CHECKIN = () => UJ.CHANNELS.filter((c) => c.source === "checkin");
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* 합성 체크인 D1..n (시드 고정) */
  function synthDays(n, seed) {
    const r = rng(seed || 20261114), noise = () => (r() + r() + r() - 1.5) * 2, days = {};
    for (let d = 1; d <= n; d++) {
      const ck = {};
      for (const c of CHECKIN()) ck[c.id] = +Math.min(c.max, Math.max(c.min, c.def + noise() * c.amp)).toFixed(c.dec);
      for (const o of UJ.OPTIONAL_INPUTS) ck[o.id] = null;
      days[d] = { checkin: ck, symptoms: {}, committed: true, synthetic: true };
    }
    return days;
  }
  function emptyCheckin() { const t = {}; for (const c of CHECKIN()) t[c.id] = null; for (const o of UJ.OPTIONAL_INPUTS) t[o.id] = null; return t; }
  function defaultCheckin() { const t = {}; for (const c of CHECKIN()) t[c.id] = c.def; for (const o of UJ.OPTIONAL_INPUTS) t[o.id] = null; return t; }

  /* mode 'demo' = D30, 합성 D1–D29 + 카메라 합성 기록 / 'fresh' = D1, 이력 0 */
  function fresh(mode) {
    const base = { v: 2, lang: "en", mode: mode || "demo", crew: "A", shelter: false, radT: 0, respond: null, done: {}, comms: "yes", attach: {} };
    if (base.mode === "fresh") return Object.assign(base, { missionDay: 1, curDay: 1, days: { 1: { checkin: emptyCheckin(), symptoms: {}, committed: false } }, camera: UJ.camdata.empty() });
    const days = synthDays(29);
    days[30] = { checkin: defaultCheckin(), symptoms: {}, committed: false, synthetic: true };
    const camera = UJ.camdata.empty();
    camera.records = UJ.camdata.seed(29);
    UJ.camdata.recomputeSuperseded(camera);
    UJ.camdata.setSynthetic(camera, 30, { face: 0, hr: 63 }); // 오늘(D30) 합성 기록 — 정상 시나리오
    return Object.assign(base, { missionDay: 30, curDay: 30, days, camera });
  }

  const store = {
    load() { const s = read(KEY); if (!s || s.v !== 2) return fresh("demo"); const f = fresh(s.mode); return Object.assign(f, s, { camera: Object.assign(UJ.camdata.empty(), s.camera || {}) }); },
    save(state) { return write(KEY, state); },
    reset(mode) { remove(KEY); return fresh(mode); },
    persistent() { return !memMode && !!ls(); },
    _memMode() { return memMode; },
    usage() { const a = (raw(KEY) || "").length + (raw(PKEY) || "").length; return { chars: a, limit: LIMIT, frac: a / LIMIT, warn: a / LIMIT >= 0.8 }; },
    emptyCheckin, defaultCheckin, synthDays, fresh,
    photos: {
      all() { return read(PKEY) || []; },
      add(p) { const a = store.photos.all(); a.push(p); return write(PKEY, a); },
      update(id, patch) { write(PKEY, store.photos.all().map((p) => (p.id === id ? Object.assign({}, p, patch) : p))); },
      remove(id) { write(PKEY, store.photos.all().filter((p) => p.id !== id)); },
      clear() { remove(PKEY); },
    },
    /* 카메라 관련 저장 전부 삭제(사진·기준·수치). 체크인은 그대로 */
    clearCamera(state) { store.photos.clear(); const consent = state.camera.consent; state.camera = UJ.camdata.empty(); state.camera.consent = consent; state.attach = {}; store.save(state); },
  };
  UJ.store = store;
  if (typeof module !== "undefined" && module.exports) module.exports = store;
})(typeof window !== "undefined" ? window : globalThis);
