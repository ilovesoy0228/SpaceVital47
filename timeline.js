/* 우주민 timeline.js — 임무일(D) 키 날짜 모델. DOM 없는 순수 함수.
 * days = { [D]: { checkin:{ch: number|null}, symptoms:{}, committed:bool, synthetic?:bool } }
 * 규칙(케이스표 §0): 어제 = D−1 기록만 / 기준선 = 기록이 있는 처음 14일 평균(오늘 제외) / 미래 데이터 사용 금지.
 * 모든 수치 기준(14일)은 [설계 선택]. */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});
  const BASELINE_DAYS = 14;

  const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(+v) ? null : +v);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const dayKeys = (days) => Object.keys(days || {}).map(Number).filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
  const valAt = (days, d, ch) => { const x = days && days[d]; return x && x.checkin ? num(x.checkin[ch]) : null; };

  /* 채널별 기준선: D보다 앞선 날 중 그 채널 값이 있는 처음 14일 */
  function baseline(days, D, ch) {
    const hits = [];
    for (const d of dayKeys(days)) {
      if (d >= D) break;
      const v = valAt(days, d, ch);
      if (v !== null) { hits.push({ d, v }); if (hits.length === BASELINE_DAYS) break; }
    }
    const done = hits.length >= BASELINE_DAYS;
    return { value: done ? mean(hits.map((h) => h.v)) : null, n: hits.length, endDay: done ? hits[hits.length - 1].d : null };
  }

  /* 어제(D−1)와, 없을 때 보조로 쓰는 마지막 기록 */
  function yesterday(days, D, ch) {
    const y = valAt(days, D - 1, ch);
    let last = null;
    if (y === null) for (const d of dayKeys(days).reverse()) { if (d >= D) continue; const v = valAt(days, d, ch); if (v !== null) { last = { day: d, value: v, ago: D - d }; break; } }
    return { value: y, missing: y === null, last };
  }

  /* 추세 시리즈: D1..D, 결측은 null(보간 금지). D 이후는 포함하지 않음 */
  function series(days, D, ch, from) {
    const out = [];
    for (let d = from || 1; d <= D; d++) out.push(valAt(days, d, ch));
    return out;
  }

  /* 엔진 입력용 오늘 값: 미입력 = null (기본값을 측정값처럼 쓰지 않음) */
  function todayOf(days, D, chIds) {
    const t = {}, x = (days && days[D] && days[D].checkin) || {};
    for (const ch of chIds) t[ch] = num(x[ch]);
    return t;
  }

  /* 배열 이력(오래된 순, 오늘 제외) → days 맵. 이전 API 호환용 */
  function fromHistory(history, today) {
    const days = {};
    (history || []).forEach((h, i) => { days[i + 1] = { checkin: Object.assign({}, h) }; });
    const D = (history || []).length + 1;
    if (today) days[D] = { checkin: Object.assign({}, today) };
    return { days, D };
  }

  /* 하루 마감: 오늘 기록 확정, 다음 날 빈 기록 생성. 원본 불변 */
  function closeDay(days, D, chIds) {
    const n = JSON.parse(JSON.stringify(days || {}));
    n[D] = Object.assign({ checkin: {}, symptoms: {} }, n[D], { committed: true });
    const empty = {}; for (const ch of chIds) empty[ch] = null;
    if (!n[D + 1]) n[D + 1] = { checkin: empty, symptoms: {}, committed: false };
    return { days: n, D: D + 1 };
  }

  UJ.timeline = { BASELINE_DAYS, num, dayKeys, valAt, baseline, yesterday, series, todayOf, fromHistory, closeDay };
  if (typeof module !== "undefined" && module.exports) module.exports = UJ.timeline;
})(typeof window !== "undefined" ? window : globalThis);
