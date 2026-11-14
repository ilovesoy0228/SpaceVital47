/* 우주민 store.js — 브라우저 저장소(try/catch, 실패 시 메모리). 네트워크 없음. */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});
  const KEY = "ujumin.v1", PKEY = "ujumin.photos.v1";
  const mem = {};
  const ls = () => { try { return g.localStorage || null; } catch (e) { return null; } };
  function read(k) { try { const s = ls(); const v = s ? s.getItem(k) : mem[k]; return v ? JSON.parse(v) : null; } catch (e) { return mem[k] ? JSON.parse(mem[k]) : null; } }
  function write(k, v) {
    const str = JSON.stringify(v);
    try { const s = ls(); if (s) { s.setItem(k, str); return true; } } catch (e) { /* 용량 초과·차단 → 메모리 */ }
    mem[k] = str; return false;
  }
  function remove(k) { try { const s = ls(); if (s) s.removeItem(k); } catch (e) { /* ignore */ } delete mem[k]; }

  /* 시드 고정 합성 이력 29일 (D1–D29). 오늘 = D30 */
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function synthHistory(seed) {
    const r = rng(seed || 20261114), noise = () => (r() + r() + r() - 1.5) * 2;
    const chs = UJ.CHANNELS.filter((c) => c.source === "checkin");
    const days = [];
    for (let d = 0; d < 29; d++) {
      const day = { day: d + 1 };
      for (const c of chs) {
        let v = c.def + noise() * c.amp;
        v = Math.min(c.max, Math.max(c.min, v));
        day[c.id] = +v.toFixed(c.dec);
      }
      days.push(day);
    }
    return days;
  }
  function defaultToday() {
    const t = {};
    for (const c of UJ.CHANNELS) if (c.source === "checkin") t[c.id] = c.def;
    for (const o of UJ.OPTIONAL_INPUTS) t[o.id] = "";
    return t;
  }
  function fresh() {
    return { v: 1, lang: "ko", crew: "A", missionDay: 30, history: synthHistory(), today: defaultToday(), symptoms: {},
      shelter: false, radT: 0, respond: null, done: {}, comms: "yes", attach: {}, camera: { consent: false, baseline: null, daily: [], regions: {} } };
  }

  const store = {
    load() { const s = read(KEY); if (!s || s.v !== 1) return fresh(); const f = fresh(); return Object.assign(f, s, { camera: Object.assign(f.camera, s.camera || {}) }); },
    save(state) { return write(KEY, state); },
    reset() { remove(KEY); return fresh(); },
    defaultToday, synthHistory,
    photos: {
      all() { return read(PKEY) || []; },
      add(p) { const a = store.photos.all(); a.push(p); const ok = write(PKEY, a); return ok; },
      update(id, patch) { const a = store.photos.all().map((p) => (p.id === id ? Object.assign({}, p, patch) : p)); write(PKEY, a); },
      remove(id) { write(PKEY, store.photos.all().filter((p) => p.id !== id)); },
      clear() { remove(PKEY); },
    },
    /* 카메라 관련 저장 전부 삭제(사진·기준·수치) */
    clearCamera(state) { store.photos.clear(); state.camera = { consent: state.camera.consent, baseline: null, daily: [], regions: {} }; state.attach = {}; store.save(state); },
  };
  UJ.store = store;
  if (typeof module !== "undefined" && module.exports) module.exports = store;
})(typeof window !== "undefined" ? window : globalThis);
