/* SpaceVital47 ui.js — 화면. 숫자·단계는 전부 엔진 계산 결과(고정 텍스트 금지, §8.3). */
(function () {
  "use strict";
  const UJ = window.UJ, E = UJ.engine, store = UJ.store, TL = UJ.timeline, CD = UJ.camdata;
  const loaded = E.loadRules(UJ.RULES, UJ.SOURCES);
  const rules = loaded.rules;

  let S = wire(store.load());
  /* 오늘(보고 있는 임무일) 기록에 연결되는 접근자 — 저장 JSON에는 포함되지 않음 */
  function dayObj() { if (!S.days[S.missionDay]) S.days[S.missionDay] = { checkin: store.emptyCheckin(), symptoms: {}, committed: false }; const d = S.days[S.missionDay]; d.checkin = d.checkin || store.emptyCheckin(); d.symptoms = d.symptoms || {}; return d; }
  function wire(st) {
    Object.defineProperty(st, "today", { get() { return dayObj().checkin; }, set(v) { dayObj().checkin = v; }, enumerable: false, configurable: true });
    Object.defineProperty(st, "symptoms", { get() { return dayObj().symptoms; }, set(v) { dayObj().symptoms = v; }, enumerable: false, configurable: true });
    return st;
  }
  let view = "care", camDirty = true, ev = null, active = [], sel = null, autoBanner = false, symOpen = null, toolsOpen = true, radTimer = null, built = false;
  let rs = S.respond && S.respond.acked ? S.respond : E.newRespondState();

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = (ko, en) => (S.lang === "ko" ? ko : en);
  const L = (o) => (o ? (S.lang === "ko" ? o.ko : o.en) : "");
  const LV = { ko: ["정상", "주의", "조치", "긴급"], en: ["Normal", "Watch", "Act", "Emergency"] };
  const ICON = ["○", "△", "◇", "■"], PRI = ["", "*", "**", "***"];
  const CH = Object.fromEntries(UJ.CHANNELS.map((c) => [c.id, c]));
  const SY = Object.fromEntries(UJ.SYMPTOMS.map((s) => [s.id, s]));
  const CARD = Object.fromEntries(UJ.CARDS.map((c) => [c.id, c]));
  const COND = Object.fromEntries(UJ.CONDITIONS.map((c) => [c.id, c]));
  const CHECKIN = UJ.CHANNELS.filter((c) => c.source === "checkin");
  const fmt = (v, d) => (v === null || v === undefined || v === "" || Number.isNaN(+v) ? "--" : (+v).toFixed(d));
  const sgn = (v, d) => { if (v === null || v === undefined || Number.isNaN(+v)) return "--"; const s = (+v).toFixed(d); return +s === 0 ? "±" + (0).toFixed(d) : (+s > 0 ? "▲+" : "▼") + s; }; // 반올림 후 0이면 "-0" 대신 ±0
  const stageHTML = (lvl, msg) => `<span class="pri">${PRI[lvl]}</span><span aria-hidden="true">${ICON[lvl]}</span><span>${LV[S.lang][lvl]}${msg ? " · " + esc(msg) : ""}</span>`;

  /* 합성 방사선 곡선 48 h (실데이터 아님) */
  const FLUX = Array.from({ length: 48 }, (_, t) => (t < 14 ? 0.2 : t <= 20 ? 0.2 * Math.pow(10, ((t - 14) / 6) * Math.log10(150 / 0.2)) : Math.max(0.2, 150 * Math.exp(-(t - 20) / 5))));

  /* ───────── 계산 ───────── */
  function compute() {
    ev = E.evaluate({ days: S.days, day: S.missionDay, symptoms: S.symptoms, camera: CD.engineInput(S.camera, S.missionDay), flux: FLUX[S.radT], events: { shelter: S.shelter } }, rules);
    const u = E.updateRespond(rs, ev.cards, Date.now());
    rs = u.rs; S.respond = rs; active = u.active;
    if (u.autoSwitch) { view = "respond"; autoBanner = true; sel = u.fresh[0]; }
    if (!active.includes(sel)) sel = active[0] || null;
    store.save(S); renderBanner();
  }
  function renderBanner() {
    const el = $("#storeBanner"), u = store.usage(), msgs = [];
    if (!store.persistent()) msgs.push(T("브라우저 저장소를 쓸 수 없습니다 — 이 세션에서만 유지됩니다 (새로고침하면 사라짐).", "Browser storage unavailable — data is kept for this session only (lost on reload)."));
    if (u.warn) msgs.push(T(`저장 용량 ${Math.round(u.frac * 100)}% 사용 — 오래된 부위 사진 정리를 권합니다 (자동 삭제하지 않음).`, `Storage ${Math.round(u.frac * 100)}% used — consider removing old site photos (nothing is deleted automatically).`));
    el.textContent = msgs.join(" ");
    el.classList.toggle("hide", !msgs.length);
  }
  function refresh() { compute(); render(); }

  /* ───────── 공통 렌더 ───────── */
  function render() {
    renderAlarm();
    $$("#tabs button").forEach((b) => {
      b.classList.toggle("on", b.dataset.view === view);
      b.classList.toggle("alert", b.dataset.view === "respond" && active.length > 0 && view !== "respond");
      b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false");
    });
    for (const v of ["care", "respond"]) $("#view-" + v).classList.toggle("hide", v !== view);
    if (view !== "care") UJ.cameraUI.leave();
    renderDayNav();
    if (view === "care") { renderSymTiles(); renderMonitor(); renderCamGroup(); updateHints(); if (camDirty) { camDirty = false; UJ.cameraUI.render($("#camSection"), api); } }
    if (view === "respond") renderRespond();
  }
  function tileName(k) {
    if (k.startsWith("m:")) { const m = UJ.MODULES.find((x) => "m:" + x.id === k); return T("증상·", "Sx·") + L(m); }
    if (k === "bp") return T("혈압", "Blood pressure");
    return L(CH[k]);
  }
  function renderAlarm() {
    const el = $("#alarm"), lvl = ev.overall;
    el.className = "alarm s" + lvl;
    let msg;
    if (active.length) msg = active.map((k) => `${k} ${L(CARD[k])}`).join(" · ");
    else if (lvl > 0) msg = Object.keys(ev.tiles).filter((k) => ev.tiles[k].level === lvl).map(tileName).join(" · ");
    else msg = T("모든 지표가 내 기준선 범위 안", "All indicators within personal baseline range");
    const acked = ev.cards.filter((k) => rs.acked[k]);
    el.innerHTML = `<span class="pri">${PRI[lvl] || "—"}</span><span aria-hidden="true">${ICON[lvl]}</span>
      <span class="msg">${LV[S.lang][lvl]} · ${esc(msg)}${acked.length ? ` <span style="font-weight:400">(${T("확인됨·지속 중", "acknowledged, still present")}: ${acked.join(", ")})</span>` : ""}</span>
      ${active.length && view !== "respond" ? `<button id="goResp">${T("응급 카드 열기", "Open emergency card")}</button>` : ""}`;
    const b = $("#goResp"); if (b) b.onclick = () => { view = "respond"; autoBanner = false; render(); };
  }
  function renderStatic() {
    UJ.cameraUI.leave(); camDirty = true; // 언어·초기화 시 카메라 영역도 다시 그림
    document.documentElement.lang = S.lang;
    $("#meta").textContent = `CREW-${S.crew} · ${S.mode === "fresh" ? T("새로 시작", "fresh start") : T("데모", "demo")}`;
    $("#tags").innerHTML = [
      ["warn", "SIMULATED DATA"], ["warn", "DEMO THRESHOLDS"], ["", T("기준선 = 기록 있는 처음 14일", "Baseline = first 14 recorded days")],
      ["", T("진단 도구 아님", "Not a diagnostic tool")], ["", T("NASA와 무관", "Not affiliated with NASA")],
    ].map(([c, t]) => `<span class="tag ${c}">${esc(t)}</span>`).join("");
    const names = { care: T("모니터·점검·카메라", "Monitor, check-in & camera"), respond: T("응급 Respond", "Respond") };
    $$("#tabs button").forEach((b) => (b.textContent = names[b.dataset.view]));
    $("#monnote").textContent = T("하루 1회 기록의 임무일별 추세입니다. 점선 = 내 기준선(처음 14일), 가로 실선 = 경고 기준.",
      "Per-mission-day trends of once-daily records. Dashed = personal baseline (first 14 days); solid horizontal = alert threshold.");
    $("#footer").innerHTML = esc(T("진단·치료 도구가 아닙니다. NASA와 제휴하지 않았습니다. 사진·수치는 이 기기 안에만 저장됩니다.",
      "Not a diagnostic or treatment tool. Not affiliated with NASA. Photos and numbers stay on this device.")) +
      ` · ${T("출처", "Sources")}: <a href="sources/nasa/index.html">${T("우주기관 자료", "Space agency")}</a> · <a href="sources/other/index.html">${T("연구·기타", "Research & other")}</a>`;
    buildMonitor(); buildCheckin();
  }

  /* ───────── 모니터 ───────── */
  const ROWS = ["hr", "temp", "sleep", "stress", "intake", "ex", "co2", "rad", "bp"];
  function buildMonitor() {
    $("#monitor").innerHTML = ROWS.map((id) => {
      const c = CH[id], color = c ? `var(${c.color})` : "var(--text)";
      const name = id === "bp" ? T("혈압·SpO₂ (선택 입력)", "BP · SpO₂ (optional)") : L(c);
      return `<div class="vrow" id="row-${id}"><div class="wave"><div class="lbl" style="color:${color}"><span>${esc(id.toUpperCase())} · ${esc(name)}</span><span class="src" data-src></span></div><div data-svg></div>${id === "rad" ? radControls() : ""}</div><div class="num" data-num></div></div>`;
    }).join("");
    const rc = $("#radCtl");
    rc.querySelector("input[type=range]").addEventListener("input", (e) => { stopRad(); S.radT = +e.target.value; refresh(); });
    rc.querySelector("[data-play]").onclick = toggleRad;
    rc.querySelector("[data-shelter]").addEventListener("change", (e) => { S.shelter = e.target.checked; refresh(); });
  }
  function radControls() {
    return `<div class="radctl" id="radCtl"><button data-play>${radTimer ? T("일시정지", "Pause") : T("재생", "Play")}</button>
      <input type="range" min="0" max="47" value="${S.radT}" aria-label="${T("재생 시각", "replay hour")}">
      <span class="mono" data-t></span>
      <label><input type="checkbox" data-shelter ${S.shelter ? "checked" : ""}> ${T("모의: 대피 지시 수신", "Sim: shelter instruction received")}</label></div>`;
  }
  function toggleRad() {
    if (radTimer) return stopRad();
    if (S.radT >= 47) S.radT = 0;
    radTimer = setInterval(() => { if (S.radT >= 47) return stopRad(); S.radT++; refresh(); }, 350);
    $("#radCtl [data-play]").textContent = T("일시정지", "Pause");
  }
  function stopRad() { clearInterval(radTimer); radTimer = null; const b = $("#radCtl [data-play]"); if (b) b.textContent = T("재생", "Play"); }

  function waveWidth() { const m = $("#monitor"); const w = m ? m.clientWidth : 600; return Math.max(240, (w > 640 ? w - 271 : w) - 22); }

  function trendSVG(series, o) {
    const W = waveWidth(), H = 104, padT = 12, padB = 14;
    const vals = series.filter((v) => v !== null && v !== undefined && v !== "" && !Number.isNaN(+v)).map(Number);
    const ext = vals.concat(o.base !== null && o.base !== undefined ? [o.base] : [], (o.lines || []).map((l) => l.value));
    let lo = Math.min(...ext), hi = Math.max(...ext);
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const span = hi - lo || Math.abs(hi) * 0.1 || 1; lo -= span * 0.12; hi += span * 0.12;
    const n = series.length, x = (i) => (n > 1 ? 6 + (i / (n - 1)) * (W - 40) : (W - 40) / 2), y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria)}">`;
    if (o.nBase) { const xb = x(o.nBase - 0.5); s += `<rect x="0" y="0" width="${xb}" height="${H - padB}" fill="#ffffff" fill-opacity=".03"/><line x1="${xb}" x2="${xb}" y1="0" y2="${H - padB}" stroke="var(--dim)" stroke-dasharray="1 3"/><text x="4" y="9" font-size="9" fill="var(--dim)" font-family="monospace">${T("기준선 구간", "baseline window")} ${esc(o.baseLabel || "")}</text>`; }
    for (const l of o.lines || []) s += `<line x1="0" x2="${W - 34}" y1="${y(l.value)}" y2="${y(l.value)}" stroke="var(--thr)" stroke-width="1"/><text x="${W - 32}" y="${y(l.value) + 3}" font-size="9.5" fill="var(--thr)" font-family="monospace">${esc(l.label)}</text>`;
    if (o.base !== null && o.base !== undefined) s += `<line x1="0" x2="${W - 34}" y1="${y(o.base)}" y2="${y(o.base)}" stroke="${o.color}" stroke-opacity=".55" stroke-dasharray="5 4"/><text x="${W - 32}" y="${y(o.base) + 3}" font-size="9.5" fill="${o.color}" fill-opacity=".8" font-family="monospace">BASE</text>`;
    let seg = [], segs = [];
    series.forEach((v, i) => { if (v === null || v === undefined || v === "" || Number.isNaN(+v)) { if (seg.length) segs.push(seg); seg = []; } else seg.push(`${x(i).toFixed(1)},${y(+v).toFixed(1)}`); });
    if (seg.length) segs.push(seg);
    for (const sg of segs) s += sg.length > 1 ? `<polyline points="${sg.join(" ")}" fill="none" stroke="${o.color}" stroke-width="2" stroke-linejoin="round"/>` : `<circle cx="${sg[0].split(",")[0]}" cy="${sg[0].split(",")[1]}" r="2.2" fill="${o.color}"/>`; // 앞뒤가 결측인 단독 기록은 점으로
    const last = series[n - 1];
    if (last !== null && last !== undefined && last !== "" && !Number.isNaN(+last)) s += `<circle cx="${x(n - 1)}" cy="${y(+last)}" r="4" fill="${o.color}" stroke="var(--bg)" stroke-width="2"/>`;
    if (o.cursor !== undefined) s += `<line x1="${x(o.cursor)}" x2="${x(o.cursor)}" y1="0" y2="${H - padB}" stroke="var(--text)" stroke-width="1"/>`;
    const xl = o.xLabels || [];
    for (const [i, t] of xl) s += `<text x="${Math.min(x(i), W - 40)}" y="${H - 2}" font-size="9.5" fill="var(--muted)" font-family="monospace" text-anchor="${i === 0 ? "start" : "middle"}">${esc(t)}</text>`;
    return s + "</svg>";
  }
  function radSVG() {
    const W = waveWidth(), H = 104, padT = 10, padB = 14;
    const x = (i) => 6 + (i / 47) * (W - 40), y = (f) => padT + (1 - (Math.log10(f) + 1) / 4) * (H - padT - padB);
    const pts = FLUX.map((f, i) => `${x(i).toFixed(1)},${y(f).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="proton flux">
      <line x1="0" x2="${W - 34}" y1="${y(10)}" y2="${y(10)}" stroke="var(--thr)"/><text x="${W - 32}" y="${y(10) + 3}" font-size="9.5" fill="var(--thr)" font-family="monospace">10</text>
      <text x="6" y="${y(10) - 4}" font-size="9" fill="var(--thr)" font-family="monospace">${T("10 pfu = NOAA S1 이벤트 정의 (행동 기준 아님)", "10 pfu = NOAA S1 event definition (not an action threshold)")}</text>
      <polyline points="${pts}" fill="none" stroke="var(--c-rad)" stroke-width="2" stroke-opacity=".35"/>
      <polyline points="${FLUX.slice(0, S.radT + 1).map((f, i) => `${x(i).toFixed(1)},${y(f).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--c-rad)" stroke-width="2"/>
      <line x1="${x(S.radT)}" x2="${x(S.radT)}" y1="0" y2="${H - padB}" stroke="var(--text)"/>
      <circle cx="${x(S.radT)}" cy="${y(FLUX[S.radT])}" r="4" fill="var(--c-rad)" stroke="var(--bg)" stroke-width="2"/>
      <text x="6" y="${H - 2}" font-size="9.5" fill="var(--muted)" font-family="monospace">0 h</text><text x="${W - 40}" y="${H - 2}" font-size="9.5" fill="var(--muted)" font-family="monospace">47 h</text></svg>`;
  }
  function stageBlock(tileId, msgFn) {
    const t = ev.tiles[tileId], lvl = t ? t.level : 0;
    return `<div class="stage s${lvl}">${stageHTML(lvl, lvl ? msgFn() : "")}</div>${lvl && t.top ? `<div class="act">→ ${esc(L(t.top.action))}</div>` : ""}`;
  }

  function renderMonitor() {
    if (!$("#row-hr")) buildMonitor();
    const D = S.missionDay;
    for (const c of CHECKIN) {
      const row = $("#row-" + c.id), d = ev.deltas[c.id] || {}, color = `var(${c.color})`;
      const series = TL.series(S.days, D, c.id);
      const lines = E.thresholdLines(rules, c.id, d.base);
      const xl = [[0, "D1"]].concat(d.baseEnd && d.baseEnd > 1 && d.baseEnd < D - 2 ? [[d.baseEnd - 1, "D" + d.baseEnd]] : [], D > 1 ? [[D - 1, T("오늘 D", "today D") + D]] : []);
      row.querySelector("[data-svg]").innerHTML = trendSVG(series, { base: d.base, lines, color, nBase: d.baseEnd || 0, baseLabel: d.baseEnd ? "→D" + d.baseEnd : "", xLabels: xl, aria: `${c.en} trend by mission day` });
      const baseTxt = d.base === null ? `${T("기준선 수집 중", "baseline")} ${d.n}/14` : `BASE ${fmt(d.base, c.dec)}`;
      const lim = lines.map((l) => l.label).join(" / ");
      const yTxt = d.yesterday !== null ? `${T("어제", "YEST")} ${fmt(d.yesterday, c.dec)}` : `${T("어제 기록 없음", "no record yesterday")}${d.last ? ` · ${T("마지막", "last")} D${d.last.day} ${fmt(d.last.value, c.dec)}` : ""}`;
      const dLastTxt = d.dYest === null && d.dLast !== null ? `<span title="${T("어제 대신 마지막 기록 대비", "vs last record instead of yesterday")}">Δ D${d.last.day} (${d.last.ago}${T("일 전", "d ago")}) <b>${sgn(d.dLast, c.dec)}</b></span>` : "";
      row.querySelector("[data-num]").innerHTML = `
        <span class="name" style="color:${color}">${esc(c.id.toUpperCase())} ${esc(c.unit)}</span>
        <span class="lim">${baseTxt}<br>${yTxt}<br>${lim ? "LIM " + esc(lim) : ""}</span>
        <span class="val" style="color:${color}">${d.today === null ? `<small class="dim" style="font-size:14px">${T("미입력", "not entered")}</small>` : fmt(d.today, c.dec)}</span>
        <span class="delta"><span>Δ${T("어제", "yest")} <b>${sgn(d.dYest, c.dec)}</b></span><span>Δ${T("기준선", "base")} <b>${sgn(d.dBase, c.dec)}</b></span>${dLastTxt}</span>
        ${stageBlock(c.id, () => (d.dBase !== null ? `${T("기준선", "baseline")} ${sgn(d.dBase, c.dec)} ${c.unit}` : `${fmt(d.today, c.dec)} ${c.unit}`))}`;
    }
    // 방사선
    const rr = $("#row-rad");
    rr.querySelector("[data-svg]").innerHTML = radSVG();
    rr.querySelector("[data-t]").textContent = `${S.radT} h`;
    rr.querySelector("input[type=range]").value = S.radT;
    rr.querySelector("[data-shelter]").checked = S.shelter;
    rr.querySelector("[data-num]").innerHTML = `<span class="name" style="color:var(--c-rad)">RAD pfu</span>
      <span class="lim">ACT ≥10<br>EMG ${T("대피 지시", "shelter order")}</span><span class="val" style="color:var(--c-rad)">${fmt(FLUX[S.radT], FLUX[S.radT] < 10 ? 1 : 0)}</span>
      ${stageBlock("rad", () => (S.shelter ? T("대피 지시 수신", "Shelter instruction received") : T("≥10 pfu 이벤트 진행 중", "≥10 pfu event in progress")))}`;
    // 혈압·SpO₂
    const br = $("#row-bp"), t = S.today;
    br.querySelector("[data-svg]").innerHTML = `<div class="empty">${T("선택 입력 — 추세 없음.", "Optional input — no trend.")}</div>`;
    br.querySelector("[data-num]").innerHTML = `<span class="name">BP mmHg · SpO₂ %</span><span class="lim">${T("기록", "log")}<br>SpO₂ ${T("규칙 없음", "no rule")}</span>
      <span class="val" style="font-size:26px">${t.bpSys !== "" && t.bpSys !== undefined && t.bpSys !== null ? fmt(t.bpSys, 0) + "/" + fmt(t.bpDia, 0) : "--"}<small>${t.spo2 !== "" && t.spo2 !== undefined && t.spo2 !== null ? " " + fmt(t.spo2, 0) + "%" : ""}</small></span>
      ${stageBlock("bp", () => T("기준 140/90", "threshold 140/90"))}`;
  }

  /* ───────── 카메라 그룹 (ROI별 행, 접기/펴기) ───────── */
  const CAM_KEYS = [["face", "camFace"], ["forehead", "camForehead"], ["cheekL", "camCheekL"], ["cheekR", "camCheekR"], ["eye", "camEye"], ["lips", "camLips"]];
  const REASON = {
    tooDark: ["조명이 어둡습니다", "too dark"], tooBright: ["조명이 밝습니다", "too bright"], tooFewRois: ["유효 얼굴 영역 2개 미만", "fewer than 2 valid face regions"],
    whiteBalance: ["화이트밸런스/조명 변화", "white balance / lighting shift"], position: ["기준 사진과 위치가 다름", "position differs from reference"], flicker: ["프레임 간 밝기 변동", "brightness varies across frames"],
    lighting: ["조명 다름", "lighting differs"], spec: ["반사", "glare"], dark: ["어두움", "dark"], occluded: ["가림", "occluded"], invalid: ["무효", "invalid"],
    noBgRef: ["조명 참조 없음", "no lighting reference"], sideLight: ["한쪽 조명", "one-sided light"], partial: ["일부 영역 제외", "some regions excluded"],
    frameDrop: ["프레임 누락", "frame drop"], lowSnr: ["신호 약함", "weak signal"], noSignal: ["신호 없음", "no signal"], lightingVaries: ["조명 변동", "lighting varies"], motion: ["움직임", "motion"],
    bandEdge: ["대역 가장자리", "band edge"], harmonic: ["하모닉 모호", "ambiguous harmonic"], tooFewFrames: ["프레임 부족", "too few frames"], noRect: ["영역 미지정", "no region set"],
  };
  const reasonTxt = (r) => (REASON[r] ? T(REASON[r][0], REASON[r][1]) : r);
  let camOpen = true;
  function camKeys() {
    return CAM_KEYS.concat(Object.keys(S.camera.sites || {}).map((id) => ["site:" + id, "camSkin"]), [["hr", "camHr"], ["resp", "camResp"]]);
  }
  function camLabel(key, tile) {
    if (key.startsWith("site:")) { const st = S.camera.sites[key.slice(5)] || {}; return `${T("부위", "Site")} ${st.label || key.slice(5)}`; }
    return L(CH[tile]);
  }
  function renderCamGroup() {
    const box = $("#camgroup"), cam = S.camera, D = S.missionDay;
    const any = (cam.records || []).some((r) => r.day <= D);
    if (!any) {
      box.innerHTML = `<div class="camfold"><span>${!cam.consent ? T("카메라 미사용 — 동의하면 오른쪽에서 촬영할 수 있습니다", "Camera not used — consent on the right to capture") : T("카메라 미측정 — 촬영하기", "Camera not measured — capture")}</span>${cam.consent ? `<button id="goCam2">${T("촬영하기", "Capture")}</button>` : ""}</div>`;
      const b = $("#goCam2"); if (b) b.onclick = goCamera;
      return;
    }
    const rows = camKeys().map(([key, tile]) => camRowHTML(key, tile, D)).join("");
    box.innerHTML = `<details class="camgrp" ${camOpen ? "open" : ""}><summary><b>${T("카메라 (보조 신호)", "Camera (auxiliary signal)")}</b>
        <span class="dim">${T("영역별 a* 변화", "a* change per region")}</span></summary>
      <div class="monitor">${rows}</div></details>`;
    box.querySelector("details").ontoggle = (e) => (camOpen = e.target.open);
  }
  function camRowHTML(key, tile, D) {
    const cam = S.camera, d = CD.deltas(cam, D, key), series = CD.series(cam, D, key);
    const isHr = key === "hr" || key === "resp", dec = isHr ? 0 : 1, unit = isHr ? CH[tile].unit : "a*";
    const color = "var(--c-cam)";
    const pts = series.filter((v) => v !== null).length;
    const t = ev.tiles[tile], lvl = key === "resp" ? 0 : t && !key.startsWith("site:") ? t.level : key.startsWith("site:") && t && d.dBase !== null && d.dBase >= UJ.camcore.GATE.redWatch ? t.level : 0;
    const lines = isHr ? [] : d.base !== null ? [{ value: d.base + UJ.camcore.GATE.redWatch, label: "+" + UJ.camcore.GATE.redWatch }] : [];
    const svg = pts >= 2 ? trendSVG(series, { base: d.base, lines, color, xLabels: [[0, "D1"], [D - 1, T("오늘 D", "today D") + D]], aria: key + " trend" })
      : `<div class="empty">${pts ? T("유효 기록 1회 — 추세는 2회부터", "1 valid record — trend needs 2") : T("유효 기록 없음 — 측정하지 않은 파형은 그리지 않습니다", "No valid record — no trace without a measurement")}</div>`;
    const st = [];
    if (d.todayStatus === "none") st.push(T("오늘 미측정", "not measured today"));
    if (d.todayStatus === "failed") st.push(`<span class="bad">${T("품질 미달", "quality gate failed")}: ${esc(d.reasons.map(reasonTxt).join(", "))}</span>`);
    if (d.todayStatus === "lowconf") st.push(`<span class="bad">${T("조명 참조 없음/낮은 신뢰 — 표시만, 규칙·추세 제외", "no lighting reference / low confidence — display only, excluded from rules and trend")}</span>`);
    if (d.lastValid) st.push(`<span class="dim">D${d.lastValid.day} ${T("마지막 유효", "last valid")} ${fmt(d.lastValid.value, dec)}</span>`);
    if (!key.startsWith("site:") && !isHr) st.push(d.locked ? T("기준 확정", "baseline locked") : `${T("기준 형성 중", "baseline forming")} ${d.n}/14${d.n < 3 ? " · " + T("규칙은 3일부터", "rules from day 3") : ""}`);
    if (key.startsWith("site:")) st.push(d.base !== null ? T("첫 사진 = 기준", "first photo = reference") : "");
    if (d.todayStatus === "ok" && d.yStatus === "failed") st.push(T("어제 품질 미달", "yesterday failed quality gate"));
    if (d.sourceMismatch) st.push(`<span class="bad">⚠ ${T("어제와 출처 다름(파일/웹캠) — 참고만", "source differs from yesterday (file/webcam) — reference only")}</span>`);
    if (d.partial) st.push(`${T("일부 ROI 제외", "some regions excluded")}: ${esc(d.excluded.map(([k, r]) => `${k}(${reasonTxt(r)})`).join(", "))}`);
    if (key === "lips") st.push(T("기록·표시만, 판정 없음", "log/display only, no judgement"));
    if (key === "resp") st.push(T("기록만 — 규칙 없음", "log only — no rule"));
    if (key === "hr") { const mm = ev.notes.find((n) => n.id === "camHrMismatch"); if (mm) st.push(`<span style="color:var(--s1)">⚠ ${T("수동 심박과 불일치", "mismatch vs manual HR")} ${sgn(mm.diff, 0)} bpm</span>`); }
    const yTxt = d.yesterday !== null ? `${T("어제", "YEST")} ${fmt(d.yesterday, dec)}` : `${d.yStatus === "failed" ? T("어제 품질 미달", "yesterday failed") : T("어제 기록 없음", "no record yesterday")}${d.last ? ` · ${T("마지막", "last")} D${d.last.day}` : ""}`;
    const dLastTxt = d.dYest === null && d.dLast !== null && d.n >= 2 ? `<span>Δ D${d.last.day} (${d.last.ago}${T("일 전", "d ago")}) <b>${sgn(d.dLast, dec)}</b></span>` : "";
    const showD = isHr || d.n >= 2 || key.startsWith("site:");
    return `<div class="vrow camrow" id="row-cam-${esc(key.replace(":", "-"))}" data-camkey="${esc(key)}"><div class="wave"><div class="lbl" style="color:${color}"><span>${esc(key.toUpperCase())} · ${esc(camLabel(key, tile))}</span><span class="src">${isHr ? (key === "hr" ? T("보조 지표", "auxiliary") : T("기록", "log only")) : T("기준 +3", "threshold +3")}</span></div>${svg}</div>
      <div class="num"><span class="name" style="color:${color}">${esc(key.toUpperCase())} ${esc(unit)}</span>
        <span class="lim">${d.base !== null ? "BASE " + fmt(d.base, dec) : T("기준 없음", "no baseline")}<br>${yTxt}</span>
        <span class="val" style="color:${color};font-size:30px">${d.today === null ? "--" : fmt(d.today, dec)}</span>
        <span class="delta">${showD ? `<span>Δ${T("어제", "yest")} <b>${sgn(d.dYest, dec)}</b></span><span>Δ${T("기준선", "base")} <b>${sgn(d.dBase, dec)}</b></span>${dLastTxt}` : `<span class="dim">${T("Δ 숨김 (기록 1회)", "Δ hidden (1 record)")}</span>`}</span>
        <div class="stage s${lvl}">${stageHTML(lvl, lvl ? T("기준 대비 붉기 변화 있음, 확인 필요", "Redness changed vs baseline — check") : "")}</div>
        <span class="camst">${st.filter(Boolean).join(" · ")}</span></div></div>`;
  }

  /* ───────── 증상 요약 ───────── */
  /* ② 증상 점검: 모듈 타일(개수·단계) = 열기 버튼, 연 모듈의 체크리스트·위험군·조치를 바로 아래에 */
  function renderSymTiles() {
    const tiles = $("#symTiles"); if (!tiles) return;
    tiles.innerHTML = UJ.MODULES.map((m) => {
      const n = UJ.SYMPTOMS.filter((s) => s.module === m.id && S.symptoms[s.id]).length;
      const t = ev.tiles["m:" + m.id], lvl = t ? t.level : 0;
      return `<button class="s${lvl}${symOpen === m.id ? " open" : ""}" data-mod="${m.id}" aria-expanded="${symOpen === m.id}"><span class="mname">${esc(L(m))}</span><span class="n">${n || ""}</span><span class="stage s${lvl}">${lvl ? `${PRI[lvl]} ${ICON[lvl]} ${LV[S.lang][lvl]}` : ""}</span></button>`;
    }).join("");
    const total = Object.keys(S.symptoms).length;
    $("#symCount").textContent = total ? T(`${total}개 체크됨`, `${total} checked`) : T("체크한 증상 없음 — 해당 부위 타일을 눌러 점검", "No symptoms checked — tap a body area to check");
    const gbox = $("#symGroups"); if (!gbox || !symOpen) return;
    const t = ev.tiles["m:" + symOpen], list = UJ.SYMPTOMS.filter((s) => s.module === symOpen && S.symptoms[s.id]);
    const groups = Array.from(new Set(list.flatMap((s) => s.mapsTo))).map((id) => COND[id]).filter(Boolean);
    gbox.innerHTML = `${groups.length ? `<p>${T("관련 위험군 (진단 아님, 확인 권고)", "Related risk groups (not a diagnosis; check advised)")}: ${groups.map((c) => `${esc(L(c))} <span class="dim mono">${c.occurrence}·${c.detection}</span>`).join(", ")}</p>` : ""}${t && t.top ? `<p>${stageHTML(t.level, "")} → ${esc(L(t.top.action))}</p>` : ""}`;
  }
  function renderSymItems() {
    const box = $("#symItems"); if (!box) return;
    if (!symOpen) { box.innerHTML = ""; return; }
    const m = UJ.MODULES.find((x) => x.id === symOpen);
    box.innerHTML = `<div class="symdetail"><div class="symhead"><b>${esc(L(m))}</b><button class="mini" data-mod="${m.id}">${T("닫기", "Close")}</button></div><div class="items">
      ${UJ.SYMPTOMS.filter((s) => s.module === m.id).map((s) => `<div class="sym"><input type="checkbox" id="sy-${s.id}" data-sym="${s.id}" ${S.symptoms[s.id] ? "checked" : ""}>
        <label for="sy-${s.id}">${esc(L(s))}${s.redFlag ? `<span class="flag" title="red flag">⚑</span>` : ""}</label>
        <div class="fu ${S.symptoms[s.id] ? "" : "hide"}" data-fu="${s.id}"><label>${T("강도", "Severity")} <select data-sev="${s.id}"><option value="">-</option>${Array.from({ length: 11 }, (_, i) => `<option ${S.symptoms[s.id] && String(S.symptoms[s.id].sev) === String(i) ? "selected" : ""}>${i}</option>`).join("")}</select></label>
        <label>${T("시작", "Onset")} <input type="time" data-onset="${s.id}" value="${esc(S.symptoms[s.id] && S.symptoms[s.id].onset || "")}"></label></div></div>`).join("")}
      </div><div id="symGroups"></div></div>`;
  }

  /* ───────── 점검 입력 ───────── */
  function buildCheckin() {
    const box = $("#checkin");
    const field = (c) => `<div class="frow"><label for="in-${c.id}"><span class="chip" style="background:var(${c.color || "--muted"})"></span>${esc(L(c))} <span class="dim">(${esc(c.unit)})</span><span class="hint" data-hint="${c.id}"></span></label>
      <input type="number" id="in-${c.id}" data-ch="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${S.today[c.id] === null || S.today[c.id] === undefined ? "" : esc(S.today[c.id])}" placeholder="${T("미입력", "—")}" inputmode="decimal"></div>`;
    $("#checkinTop").innerHTML = `<div class="panel ckin"><h2>① ${T("직접 점검 — 수치 입력", "Check-in — numbers")} <span class="dim">(${T("승무원", "crew")} ${S.crew} · D${S.missionDay}${S.missionDay < S.curDay ? " · " + T("과거 기록 수정 중", "editing a past day") : ""} · ${T("빈칸 = 미입력", "blank = not entered")})</span></h2>
        <div class="ckgrid">${CHECKIN.map(field).join("")}</div>
        <details style="margin-top:6px"><summary class="muted">${T("선택 입력: 혈압·SpO₂", "Optional: BP · SpO₂")}</summary><div class="ckgrid">${UJ.OPTIONAL_INPUTS.map(field).join("")}</div></details>
        <p class="dim" style="font-size:11.5px;margin:6px 0 0" id="rangeMsg"></p></div>`;
    $("#checkinTop").oninput = onCheckinInput;
    $("#checkinTop").onchange = onCheckinInput;
    const sb = $("#symbox");
    sb.innerHTML = `<div class="panel symbox"><h2>② ${T("증상 점검", "Symptom check")} <span class="dim">(⚑ ${T("빨간 깃발 · 진단명 대신 위험군·단계·조치만", "red flag · risk groups, level and action only — never a diagnosis")})</span></h2>
      <div class="btns"><button id="noSym" class="primary">${T("오늘 이상 없음", "Nothing unusual today")}</button><span class="dim" id="symCount" style="align-self:center;font-size:12px"></span></div>
      <div class="symsum" id="symTiles"></div><div id="symItems"></div></div>`;
    sb.oninput = onCheckinInput; sb.onchange = onCheckinInput;   // 재생성 시 리스너 중복 방지(속성 할당)
    sb.onclick = (e) => { const b = e.target.closest("[data-mod]"); if (!b) return; symOpen = symOpen === b.dataset.mod ? null : b.dataset.mod; renderSymItems(); renderSymTiles(); };
    $("#noSym").onclick = () => { S.symptoms = {}; renderSymItems(); refresh(); };
    renderSymItems();
    // 맨 아래: 시연 도구(합성) — 발표·심사용. 실제 사용 흐름에는 필요 없음
    box.innerHTML = `<details class="panel tools" ${toolsOpen ? "open" : ""}><summary><b>${T("시연 도구", "Demo tools")}</b></summary>
      <h3>${T("시나리오", "Scenarios")}</h3><div class="btns presets">${PRESETS.map((p, i) => `<button data-preset="${i}">${esc(L(p))}</button>`).join("")}</div>
      <h3>${T("데이터", "Data")}</h3><div class="btns"><button id="resetToday">${T("오늘 입력 지우기", "Clear today's input")}</button>
        <button id="mFresh" class="${S.mode === "fresh" ? "on" : ""}">${T("새로 시작 (D1, 전체 삭제)", "Fresh start (D1, deletes all)")}</button><button id="mDemo" class="${S.mode !== "fresh" ? "on" : ""}">${T("데모 데이터 (D30, 전체 삭제)", "Demo data (D30, deletes all)")}</button></div></details>`;
    box.querySelector("details").ontoggle = (e) => (toolsOpen = e.target.open);
    box.querySelector(".presets").onclick = (e) => { const b = e.target.closest("[data-preset]"); if (b) applyPreset(+b.dataset.preset); };
    $("#resetToday").onclick = () => { S.today = store.emptyCheckin(); S.symptoms = {}; S.shelter = false; S.radT = 0; rs = E.newRespondState(); S.done = {}; stopRad(); buildCheckin(); refresh(); };
    $("#mFresh").onclick = () => setMode("fresh");
    $("#mDemo").onclick = () => setMode("demo");
  }
  function onCheckinInput(e) {
    const t = e.target;
    if (t.dataset.ch) {
      const c = CH[t.dataset.ch] || UJ.OPTIONAL_INPUTS.find((o) => o.id === t.dataset.ch);
      const v = t.value === "" ? "" : +t.value;
      const bad = v !== "" && (v < c.min || v > c.max);
      t.setAttribute("aria-invalid", bad ? "true" : "false");
      $("#rangeMsg").textContent = bad ? `${L(c)}: ${T("허용 범위", "allowed range")} ${c.min}–${c.max} ${c.unit}. ${T("범위 밖 값은 미입력으로 처리합니다.", "Out-of-range values are treated as missing.")}` : "";
      S.today[c.id] = bad || v === "" ? null : v;
    } else if (t.dataset.sym) {
      if (t.checked) S.symptoms[t.dataset.sym] = S.symptoms[t.dataset.sym] || {}; else delete S.symptoms[t.dataset.sym];
      $(`[data-fu="${t.dataset.sym}"]`).classList.toggle("hide", !t.checked);
    } else if (t.dataset.sev !== undefined && t.dataset.sev) {
      if (S.symptoms[t.dataset.sev]) S.symptoms[t.dataset.sev].sev = t.value;
    } else if (t.dataset.onset) {
      if (S.symptoms[t.dataset.onset]) S.symptoms[t.dataset.onset].onset = t.value;
    } else return;
    refresh();
  }
  function updateHints() {
    for (const c of CHECKIN) {
      const d = ev.deltas[c.id] || {}, h = $(`[data-hint="${c.id}"]`);
      if (h) h.textContent = `${d.yesterday !== null ? T("어제", "yest") + " " + fmt(d.yesterday, c.dec) : T("어제 기록 없음", "no record yesterday")} · ${d.base === null ? T("기준선 수집 중", "baseline") + " " + d.n + "/14" : T("내 평균", "my baseline") + " " + fmt(d.base, c.dec)}`;
    }
  }

  /* 시연 시나리오 (합성) */
  // cam = 그날 합성 카메라 기록(기준선 중앙값 대비 Δa*, 심박). 정상은 ≈0, 발열은 +1.5로 일부러 임계값 아래 [설계 선택]
  const P = (ko, en, today, sym, extra, cam) => ({ ko, en, today: today || {}, sym: sym || [], extra: extra || {}, cam: cam || { face: 0 } });
  const OPT = { bpSys: 118, bpDia: 76, spo2: 98 };
  const PRESETS = [
    P("정상", "Normal day", {}, [], {}, { face: 0, hr: 63 }),
    P("수면 부족 + 스트레스", "Poor sleep + stress", { sleep: 4.5, stress: 4, hr: 70 }, [], {}, { face: 0, hr: 70 }),
    P("발열 + 심박 상승", "Fever + raised HR", { temp: 38.2, hr: 78 }, ["feverChills", "cough"], {}, { face: 1.5, hr: 79 }),
    P("R2 감염 악화", "R2 Infection worsening", { temp: 38.6, hr: 90, ex: 20, intake: 60 }, ["confusion", "feverChills"], {}, { face: 1.2, hr: 91 }),
    P("R5 흉통 + 심박", "R5 Chest pain + HR", { hr: 86 }, ["chestPain", "coldSweat"], {}, { face: 0, hr: 87 }),
    P("R4 알레르기 조합", "R4 Allergy combination", {}, ["hives", "faceSwelling", "throatTight"], {}, { face: 3.6, hr: 66 }),
    P("CO₂ 상승 + 두통", "CO₂ rise + headache", { co2: 5.6 }, ["headache"], {}, { face: 0, hr: 64 }),
    P("방사선 이벤트 (22 h)", "Radiation event (22 h)", {}, [], { radT: 22 }, { face: 0, hr: 63 }),
    P("R1 대피 지시", "R1 Shelter instruction", {}, [], { radT: 22, shelter: true }, { face: 0, hr: 64 }),
    P("R3 눈 화학물질", "R3 Chemical in eye", {}, ["eyeChem", "eyePain"], {}, { eye: 4.2, hr: 65 }),
    P("R6 뇌졸중 의심", "R6 Suspected stroke", {}, ["faceDroop", "slurred"], {}, { face: 0, hr: 66 }),
  ];
  function applyPreset(i) {
    const p = PRESETS[i];
    stopRad();
    S.today = Object.assign(store.defaultCheckin(), OPT, p.today);
    dayObj().synthetic = true;
    S.symptoms = Object.fromEntries(p.sym.map((s) => [s, {}]));
    S.radT = p.extra.radT || 0; S.shelter = !!p.extra.shelter;
    CD.setSynthetic(S.camera, S.missionDay, p.cam);
    rs = E.newRespondState(); S.done = {}; autoBanner = false; view = "care"; camDirty = true;
    buildCheckin(); refresh();
  }

  /* ───────── 임무일 이동 · 하루 마감 · 모드 ───────── */
  function renderDayNav() {
    const D = S.missionDay;
    $("#daynav").innerHTML = `<button id="dPrev" ${D <= 1 ? "disabled" : ""} aria-label="${T("이전 임무일", "previous mission day")}">◀</button>
      <span class="mono dday" id="dLabel">D${D}${D < S.curDay ? ` <small>(${T("과거", "past")})</small>` : ""}</span>
      <button id="dNext" ${D >= S.curDay ? "disabled" : ""} aria-label="${T("다음 임무일", "next mission day")}">▶</button>
      <button id="dClose" ${D !== S.curDay ? "disabled" : ""} title="${T("오늘 입력을 이력에 확정하고 다음 날로", "commit today and move to the next day")}">${T("하루 마감", "Close day")}</button>
`;
    $("#dPrev").onclick = () => goDay(D - 1);
    $("#dNext").onclick = () => goDay(D + 1);
    $("#dClose").onclick = closeDay;
  }
  function goDay(d) { if (d < 1 || d > S.curDay) return; stopRad(); S.missionDay = d; dayObj(); camDirty = true; buildCheckin(); refresh(); }
  function closeDay() {
    const ids = CHECKIN.map((c) => c.id).concat(UJ.OPTIONAL_INPUTS.map((o) => o.id));
    const r = TL.closeDay(S.days, S.curDay, ids);
    S.days = r.days; S.curDay = r.D; S.missionDay = r.D; S.shelter = false; S.radT = 0; stopRad();
    rs = E.newRespondState(); S.done = {}; camDirty = true; buildCheckin(); refresh();
  }
  function setMode(mode) {
    if (!confirm(mode === "fresh" ? T("모든 데이터(사진 포함)를 지우고 D1부터 새로 시작합니다.", "Delete all data (incl. photos) and start fresh at D1?") : T("모든 데이터(사진 포함)를 지우고 데모 데이터(D30)로 돌아갑니다.", "Delete all data (incl. photos) and load the demo data (D30)?"))) return;
    UJ.cameraUI.stop(); store.photos.clear(); const lang = S.lang; S = wire(store.reset(mode)); S.lang = lang; rs = E.newRespondState(); stopRad(); renderStatic(); refresh();
  }

  /* ───────── Respond ───────── */
  function renderRespond() {
    const root = $("#view-respond");
    const manualGrid = `<div class="cards">${UJ.CARDS.map((c) => `<button data-manual="${c.id}"><b>${c.id}</b> ${esc(L(c))}<small>${esc(L(c.triggerText))}</small></button>`).join("")}</div>`;
    if (!sel) {
      root.innerHTML = `<div class="panel"><h2>${T("활성 응급 카드 없음", "No active emergency card")}</h2>
        <p class="muted">${T("긴급 트리거가 처음 나타나면 이 화면으로 자동 전환됩니다. 확인한 조건은 사라질 때까지 다시 전환하지 않습니다. 아래에서 수동으로 시작할 수 있습니다 (R11은 수동 전용).", "This screen opens automatically when an emergency trigger first appears. Acknowledged conditions do not re-trigger until they clear. Start a card manually below (R11 is manual-only).")}</p>${manualGrid}</div>`;
      return;
    }
    const c = CARD[sel], done = S.done[sel] || {};
    const steps = c.steps.concat(UJ.COMMS_STEPS[S.comms]);
    const cnt = steps.filter((_, i) => done[i]).length;
    const photos = store.photos.all();
    const att = S.attach[sel] || {};
    const slotFirst = photos.slice().sort((a, b) => (c.photoSlots.includes(b.region) ? 1 : 0) - (c.photoSlots.includes(a.region) ? 1 : 0));
    const trig = rules.find((r) => c.trigger.includes(r.id));
    root.innerHTML = `
      ${autoBanner ? `<div class="panel" style="border-color:var(--s3)">${T("긴급 트리거 감지 → 응급 모드로 자동 전환되었습니다.", "Emergency trigger detected → switched to Respond automatically.")}</div>` : ""}
      <div class="resp-head"><div class="t"><span class="pri">***</span><span aria-hidden="true">■</span><span>${LV[S.lang][3]} · ${c.id} ${esc(L(c))}</span><span class="timer" id="timer">00:00</span></div>
        <div class="muted" style="font-size:12.5px">${T("트리거", "Trigger")}: ${esc(L(c.triggerText))}${rs.manual[sel] ? " · " + T("수동 시작", "manual start") : ""}</div>
        ${active.length > 1 ? `<div class="btns" style="margin-top:6px">${active.map((a) => `<button data-sel="${a}" class="${a === sel ? "on" : ""}">${a} ${esc(L(CARD[a]))}</button>`).join("")}</div>` : ""}</div>
      <div class="resp-grid"><div>
        <div class="panel"><h2>① ${T("상태 확인", "Status check")}</h2>
          <p style="margin:0 0 4px">${trig ? `${T("발동 규칙", "Fired rule")}: <span class="mono">${trig.id}</span> — ${esc(describeWhen(trig.when))}` : T("수동 시작 카드", "Manually started card")}</p>
          <p class="mono muted" style="font-size:12px;margin:0">HR ${fmt(ev.deltas.hr.today, 0)} (${T("기준", "base")} ${fmt(ev.deltas.hr.base, 0)}) · TEMP ${fmt(ev.deltas.temp.today, 1)} (${fmt(ev.deltas.temp.base, 1)})</p></div>
        <div class="panel"><h2>② ${T("지상 교신", "Ground contact")}</h2><div class="btns">
          <button data-comms="yes" class="${S.comms === "yes" ? "on" : ""}">${T("교신 가능 → 보고서 전송·지시 확인", "Available → send report, confirm instructions")}</button>
          <button data-comms="no" class="${S.comms === "no" ? "on" : ""}">${T("교신 불가 → 온보드 절차 계속", "Unavailable → continue onboard")}</button></div></div>
        <div class="panel"><h2>③ ${T("체크리스트", "Checklist")} (${cnt}/${steps.length})</h2><progress max="${steps.length}" value="${cnt}"></progress>
          <ul class="steps">${steps.map((s, i) => `<li class="${done[i] ? "done" : ""}"><input type="checkbox" id="st${i}" data-step="${i}" ${done[i] ? "checked" : ""}><label for="st${i}">${esc(L(s))}</label></li>`).join("")}</ul></div>
      </div><div>
        <div class="panel"><h2>④ ${T("영문 지상 보고서", "Ground report (English)")}</h2>
          <textarea class="report" id="report" readonly aria-label="report">${esc(reportFor(sel))}</textarea>
          <div class="btns" style="margin-top:6px"><button id="copyBtn">${T("최신 상태로 갱신 후 복사", "Refresh & copy")}</button><button id="dlBtn">${T("보고서+사진 파일로 저장", "Save report + photos as file")}</button><span class="muted" id="copyMsg" style="font-size:12px;align-self:center"></span></div>
          <h3>${T("첨부할 사진 (직접 고른 것만, 전송 없음)", "Photos to attach (only those you pick; nothing is sent)")}${c.photoSlots.length ? ` · ${T("권장 부위", "suggested")}: ${c.photoSlots.join(", ")}` : ""}</h3>
          ${slotFirst.length ? `<div class="thumbs">${slotFirst.map((p) => `<div class="thumb"><img src="${p.dataUrl}" alt="${esc(p.region)} ${esc(p.date)}"><label><input type="checkbox" data-attach="${p.id}" ${att[p.id] ? "checked" : ""}> ${esc(p.region)} · D${p.day}</label></div>`).join("")}</div>` : `<p class="muted">${T("저장된 사진 없음.", "No stored photos.")}</p>`}
          <button id="camFromResp" style="margin-top:6px">${T("카메라로 부위 촬영", "Capture a site photo")}</button></div>
        <div class="panel"><button id="standDown" class="danger">${T("상황 종료·확인 → 일반 모드", "Stand down · acknowledge → Care")}</button>
          <p class="dim" style="font-size:11.5px;margin:6px 0 0">${T("확인한 조건은 사라질 때까지 다시 자동 전환하지 않습니다.", "An acknowledged condition will not auto-switch again until it clears.")}</p></div>
        <details class="panel"><summary>${T("다른 카드 수동 시작", "Start another card manually")}</summary>${manualGrid}</details>
      </div></div>`;
    tick();
  }
  function reportFor(k) {
    const att = S.attach[k] || {};
    return UJ.report.reportText({ card: CARD[k], manual: !!rs.manual[k], comms: S.comms, elapsedSec: Math.max(0, Math.floor((Date.now() - (rs.t0[k] || Date.now())) / 1000)),
      crew: S.crew, missionDay: S.missionDay, ev, today: S.today, symptoms: S.symptoms, done: S.done[k] || {}, camera: CD.summary(S.camera, S.missionDay),
      photos: store.photos.all().filter((p) => att[p.id]).map((p) => ({ id: p.id, region: p.region, date: "D" + p.day, note: p.note })) });
  }
  function tick() { const el = $("#timer"); if (!el || !sel || !rs.t0[sel]) return; const s = Math.floor((Date.now() - rs.t0[sel]) / 1000); el.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function onRespondClick(e) {
    const t = e.target.closest("button,input"); if (!t) return;
    if (t.dataset.manual) { rs = E.startManual(rs, t.dataset.manual); sel = t.dataset.manual; autoBanner = false; return refresh(); }
    if (t.dataset.sel) { sel = t.dataset.sel; return render(); }
    if (t.dataset.comms) { S.comms = t.dataset.comms; S.done[sel] = {}; return refresh(); }
    if (t.id === "copyBtn") {
      const txt = reportFor(sel); $("#report").value = txt;
      const msg = (m) => ($("#copyMsg").textContent = m);
      const manual = () => { $("#report").select(); msg(T("직접 복사하십시오 (Ctrl/Cmd+C)", "Select and copy (Ctrl/Cmd+C)")); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => msg(T("복사했습니다", "Copied")), manual); else manual();
      return;
    }
    if (t.id === "dlBtn") return downloadPackage(sel);
    if (t.id === "camFromResp") return goCamera();
    if (t.id === "standDown") { rs = E.standDown(rs, sel, ev.cards); delete S.done[sel]; autoBanner = false; view = "care"; return refresh(); }
  }
  function onRespondChange(e) {
    const t = e.target;
    if (t.dataset.step !== undefined) { S.done[sel] = S.done[sel] || {}; S.done[sel][t.dataset.step] = t.checked; store.save(S); return renderRespond(); }
    if (t.dataset.attach) { S.attach[sel] = S.attach[sel] || {}; if (t.checked) S.attach[sel][t.dataset.attach] = true; else delete S.attach[sel][t.dataset.attach]; store.save(S); $("#report").value = reportFor(sel); }
  }
  function downloadPackage(k) {
    const att = S.attach[k] || {}, ph = store.photos.all().filter((p) => att[p.id]);
    const html = `<!doctype html><meta charset="utf-8"><title>Ground report ${k}</title><body style="font-family:monospace;background:#fff;color:#000"><pre>${esc(reportFor(k))}</pre>${ph.map((p) => `<figure><img src="${p.dataUrl}" width="320"><figcaption>${esc(p.id)} ${esc(p.region)} D${p.day} ${esc(p.note || "")}</figcaption></figure>`).join("")}</body>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = `spacevital47-report-${k}-D${S.missionDay}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ───────── 규칙 조건 문구 (응급 카드에서 사용) ───────── */
  function describeWhen(w) {
    if (w.all) return "(" + w.all.map(describeWhen).join(" AND ") + ")";
    if (w.any) return "(" + w.any.map(describeWhen).join(" OR ") + ")";
    if (w.sym) return L(SY[w.sym]);
    if (w.symAny) return "[" + w.symAny.map((s) => L(SY[s])).join(" | ") + "]";
    if (w.event) return T("대피 지시 수신(모의)", "shelter instruction (sim)");
    if (w.flux) return `flux ≥ ${w.flux.gte} pfu`;
    if (w.cam) return `${T("카메라", "camera")} ${w.cam} Δa* ≥ ${w.gte}`;
    if (w.ch) {
      const name = CH[w.ch] ? w.ch.toUpperCase() : w.ch;
      const c = w.dBase || w, ops = { gte: "≥", gt: ">", lte: "≤", lt: "<" };
      const op = Object.keys(ops).find((k) => c[k] !== undefined);
      return w.dBase ? `${name} ${T("기준선", "baseline")} ${c[op] > 0 ? "+" : ""}${c[op]} (${ops[op]})` : `${name} ${ops[op]} ${c[op]}`;
    }
    return "?";
  }

  /* ───────── 카메라 영역 연결 (모니터·점검과 같은 화면) ───────── */
  function goCamera() { view = "care"; autoBanner = false; render(); const el = $("#camSection"); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
  const api = {
    get S() { return S; }, T, L, esc, store,
    save() { store.save(S); },
    changed() { compute(); renderAlarm(); if (view === "care") { renderMonitor(); renderCamGroup(); updateHints(); } },
    reasonTxt: (r) => reasonTxt(r),
  };

  /* ───────── 시작 ───────── */
  function init() {
    $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (!b) return; view = b.dataset.view; autoBanner = false; render(); });
    $("#langBtn").onclick = () => { S.lang = S.lang === "ko" ? "en" : "ko"; renderStatic(); refresh(); };
    $("#view-respond").addEventListener("click", onRespondClick);
    $("#view-respond").addEventListener("change", onRespondChange);
    $("#monitor").addEventListener("click", () => {});
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => view === "care" && renderMonitor(), 150); });
    setInterval(tick, 1000);
    renderStatic(); refresh();
    built = true;
  }
  window.UJ.app = { get state() { return S; }, get ev() { return ev; }, get view() { return view; }, applyPreset, refresh, goDay, closeDay, PRESETS };
  init();
})();
