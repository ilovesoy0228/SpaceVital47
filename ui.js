/* 우주민 ui.js — 화면. 숫자·단계는 전부 엔진 계산 결과(고정 텍스트 금지, §8.3). */
(function () {
  "use strict";
  const UJ = window.UJ, E = UJ.engine, store = UJ.store;
  const loaded = E.loadRules(UJ.RULES, UJ.SOURCES);
  const rules = loaded.rules;

  let S = store.load();
  let view = "care", ev = null, active = [], sel = null, autoBanner = false, symOpen = null, radTimer = null, built = false;
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
  const SRC = Object.fromEntries(UJ.SOURCES.map((s) => [s.id, s]));
  const CARD = Object.fromEntries(UJ.CARDS.map((c) => [c.id, c]));
  const COND = Object.fromEntries(UJ.CONDITIONS.map((c) => [c.id, c]));
  const CHECKIN = UJ.CHANNELS.filter((c) => c.source === "checkin");
  const fmt = (v, d) => (v === null || v === undefined || v === "" || Number.isNaN(+v) ? "--" : (+v).toFixed(d));
  const sgn = (v, d) => (v === null || v === undefined ? "--" : (v > 0 ? "▲+" : v < 0 ? "▼" : "±") + (+v).toFixed(d));
  const stageHTML = (lvl, msg) => `<span class="pri">${PRI[lvl]}</span><span aria-hidden="true">${ICON[lvl]}</span><span>${LV[S.lang][lvl]}${msg ? " · " + esc(msg) : ""}</span>`;

  /* 합성 방사선 곡선 48 h (실데이터 아님) */
  const FLUX = Array.from({ length: 48 }, (_, t) => (t < 14 ? 0.2 : t <= 20 ? 0.2 * Math.pow(10, ((t - 14) / 6) * Math.log10(150 / 0.2)) : Math.max(0.2, 150 * Math.exp(-(t - 20) / 5))));

  /* ───────── 계산 ───────── */
  function camToday() {
    const c = S.camera, d = S.missionDay, out = {};
    const day = (c.daily || []).filter((x) => x.day === d).pop();
    if (day) { if (day.gate) { out.face = day.dFace; out.eye = day.dEye; } if (day.hr) out.hr = day.hr; if (day.resp) out.resp = day.resp; }
    const sk = (c.skin || []).filter((x) => x.day === d && x.d !== null && x.d !== undefined).pop();
    if (sk) out.skin = sk.d;
    return out;
  }
  function compute() {
    ev = E.evaluate({ today: S.today, history: S.history, symptoms: S.symptoms, camera: camToday(), flux: FLUX[S.radT], events: { shelter: S.shelter } }, rules);
    const u = E.updateRespond(rs, ev.cards, Date.now());
    rs = u.rs; S.respond = rs; active = u.active;
    if (u.autoSwitch) { view = "respond"; autoBanner = true; sel = u.fresh[0]; }
    if (!active.includes(sel)) sel = active[0] || null;
    store.save(S);
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
    for (const v of ["care", "respond", "camera", "evidence"]) $("#view-" + v).classList.toggle("hide", v !== view);
    if (view === "care") { renderMonitor(); renderSymSum(); updateHints(); }
    if (view === "respond") renderRespond();
    if (view === "camera") UJ.cameraUI.render($("#view-camera"), api);
    if (view === "evidence" && !$("#view-evidence").dataset.lang) renderEvidence();
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
    document.documentElement.lang = S.lang;
    $("#meta").textContent = `CREW-${S.crew} · ${T("임무일", "MISSION DAY")} ${S.missionDay} (${T("모의", "sim")})`;
    $("#tags").innerHTML = [
      ["warn", "SIMULATED DATA"], ["warn", "DEMO THRESHOLDS"], ["", T("기준선 = D1–D14 평균", "Baseline = mean D1–D14")],
      ["", T("진단 도구 아님", "Not a diagnostic tool")], ["", T("NASA와 무관", "Not affiliated with NASA")],
    ].map(([c, t]) => `<span class="tag ${c}">${esc(t)}</span>`).join("");
    const names = { care: T("모니터·점검", "Monitor & check-in"), respond: T("응급 Respond", "Respond"), camera: T("카메라", "Camera"), evidence: T("근거", "Evidence") };
    $$("#tabs button").forEach((b) => (b.textContent = names[b.dataset.view]));
    $("#monnote").textContent = T("파형은 하루 1회 점검값의 30일 추세이며 실시간 측정이 아닙니다. 점선 = 내 기준선(D1–D14 평균), 가로 실선 = 데모 임계값. 방사선만 합성 48시간 재생입니다.",
      "Traces are 30-day trends of once-daily check-in values, not real-time measurements. Dashed = personal baseline (mean D1–D14); solid horizontal = demo threshold. Only radiation is a synthetic 48-hour replay.");
    $("#footer").innerHTML = esc(T("모든 승무원 데이터와 방사선 곡선은 합성(모의)입니다. 의사결정 보조용 프로토타입이며 진단·치료 도구가 아닙니다. NASA와 제휴하지 않았습니다. 서버 없음 — 사진·수치는 이 기기 안에만 저장되며 네트워크로 보내지 않습니다. AI 사용 공개: 코드·데이터 초안 작성에 Claude(Anthropic)를 사용했습니다.",
      "All crew data and the radiation curve are synthetic. Decision-support prototype, not a diagnostic or treatment tool. Not affiliated with NASA. No server — photos and numbers stay on this device and are never sent over the network. AI disclosure: Claude (Anthropic) was used to draft code and data."));
    $("#view-evidence").dataset.lang = "";
    buildMonitor(); buildCheckin();
  }

  /* ───────── 모니터 ───────── */
  const ROWS = ["hr", "temp", "sleep", "stress", "intake", "ex", "co2", "rad", "camFace", "camEye", "camSkin", "camHr", "camResp", "bp"];
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
    const n = series.length, x = (i) => 6 + (i / (n - 1)) * (W - 40), y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria)}">`;
    if (o.nBase) { const xb = x(o.nBase - 0.5); s += `<rect x="0" y="0" width="${xb}" height="${H - padB}" fill="#ffffff" fill-opacity=".03"/><line x1="${xb}" x2="${xb}" y1="0" y2="${H - padB}" stroke="var(--dim)" stroke-dasharray="1 3"/><text x="4" y="9" font-size="9" fill="var(--dim)" font-family="monospace">${T("기준선 구간 D1–D14", "baseline window D1–D14")}</text>`; }
    for (const l of o.lines || []) s += `<line x1="0" x2="${W - 34}" y1="${y(l.value)}" y2="${y(l.value)}" stroke="var(--thr)" stroke-width="1"/><text x="${W - 32}" y="${y(l.value) + 3}" font-size="9.5" fill="var(--thr)" font-family="monospace">${esc(l.label)}</text>`;
    if (o.base !== null && o.base !== undefined) s += `<line x1="0" x2="${W - 34}" y1="${y(o.base)}" y2="${y(o.base)}" stroke="${o.color}" stroke-opacity=".55" stroke-dasharray="5 4"/><text x="${W - 32}" y="${y(o.base) + 3}" font-size="9.5" fill="${o.color}" fill-opacity=".8" font-family="monospace">BASE</text>`;
    let seg = [], segs = [];
    series.forEach((v, i) => { if (v === null || v === undefined || v === "" || Number.isNaN(+v)) { if (seg.length) segs.push(seg); seg = []; } else seg.push(`${x(i).toFixed(1)},${y(+v).toFixed(1)}`); });
    if (seg.length) segs.push(seg);
    for (const sg of segs) s += sg.length > 1 ? `<polyline points="${sg.join(" ")}" fill="none" stroke="${o.color}" stroke-width="2" stroke-linejoin="round"/>` : "";
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
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="synthetic proton flux replay">
      <line x1="0" x2="${W - 34}" y1="${y(10)}" y2="${y(10)}" stroke="var(--thr)"/><text x="${W - 32}" y="${y(10) + 3}" font-size="9.5" fill="var(--thr)" font-family="monospace">10</text>
      <text x="6" y="${y(10) - 4}" font-size="9" fill="var(--thr)" font-family="monospace">${T("10 pfu = NOAA S1 이벤트 정의 (행동 기준 아님)", "10 pfu = NOAA S1 event definition (not an action threshold)")}</text>
      <polyline points="${pts}" fill="none" stroke="var(--c-rad)" stroke-width="2" stroke-opacity=".35"/>
      <polyline points="${FLUX.slice(0, S.radT + 1).map((f, i) => `${x(i).toFixed(1)},${y(f).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--c-rad)" stroke-width="2"/>
      <line x1="${x(S.radT)}" x2="${x(S.radT)}" y1="0" y2="${H - padB}" stroke="var(--text)"/>
      <circle cx="${x(S.radT)}" cy="${y(FLUX[S.radT])}" r="4" fill="var(--c-rad)" stroke="var(--bg)" stroke-width="2"/>
      <text x="6" y="${H - 2}" font-size="9.5" fill="var(--muted)" font-family="monospace">0 h</text><text x="${W - 40}" y="${H - 2}" font-size="9.5" fill="var(--muted)" font-family="monospace">47 h</text></svg>`;
  }
  function srcLine(tileId) {
    const t = ev.tiles[tileId];
    const rs0 = t ? t.top : rules.find((r) => r.tile === tileId && !r.generic);
    if (!rs0) return "";
    return `${T("근거", "Evidence")} ${rs0.evidenceLevel} · ${T("데모 임계값", "demo threshold")} · ${rs0.sources.map((s) => s).join(", ")}${rs0.note ? " · " + rs0.note : ""}`;
  }
  function stageBlock(tileId, msgFn) {
    const t = ev.tiles[tileId], lvl = t ? t.level : 0;
    return `<div class="stage s${lvl}">${stageHTML(lvl, lvl ? msgFn() : "")}</div>${lvl && t.top ? `<div class="act">→ ${esc(L(t.top.action))}</div>` : ""}`;
  }

  function renderMonitor() {
    if (!$("#row-hr")) buildMonitor();
    const N = S.history.length + 1;
    const xl = [[0, "D1"], [13, "D14"], [N - 1, T("오늘 D", "today D") + S.missionDay]];
    for (const c of CHECKIN) {
      const row = $("#row-" + c.id), d = ev.deltas[c.id] || {}, color = `var(${c.color})`;
      const series = S.history.map((h) => h[c.id]).concat([S.today[c.id]]);
      const lines = E.thresholdLines(rules, c.id, d.base);
      row.querySelector("[data-svg]").innerHTML = trendSVG(series, { base: d.base, lines, color, nBase: 14, xLabels: xl, aria: `${c.en} 30-day trend` });
      row.querySelector("[data-src]").textContent = srcLine(c.id);
      const baseTxt = d.base === null ? `${T("기준선 수집 중", "baseline")} ${d.n}/14` : `BASE ${fmt(d.base, c.dec)}`;
      const lim = lines.map((l) => l.label).join(" / ");
      row.querySelector("[data-num]").innerHTML = `
        <span class="name" style="color:${color}">${esc(c.id.toUpperCase())} ${esc(c.unit)}</span>
        <span class="lim">${baseTxt}<br>${T("어제", "YEST")} ${fmt(d.yesterday, c.dec)}<br>${lim ? "LIM " + esc(lim) : ""}</span>
        <span class="val" style="color:${color}">${fmt(d.today, c.dec)}</span>
        <span class="delta"><span>Δ${T("어제", "yest")} <b>${sgn(d.dYest, c.dec)}</b></span><span>Δ${T("기준선", "base")} <b>${sgn(d.dBase, c.dec)}</b></span></span>
        ${stageBlock(c.id, () => (d.dBase !== null ? `${T("기준선", "baseline")} ${sgn(d.dBase, c.dec)} ${c.unit}` : `${fmt(d.today, c.dec)} ${c.unit}`))}`;
    }
    // 방사선
    const rr = $("#row-rad");
    rr.querySelector("[data-svg]").innerHTML = radSVG();
    rr.querySelector("[data-src]").textContent = srcLine("rad");
    rr.querySelector("[data-t]").textContent = `${S.radT} h`;
    rr.querySelector("input[type=range]").value = S.radT;
    rr.querySelector("[data-shelter]").checked = S.shelter;
    rr.querySelector("[data-num]").innerHTML = `<span class="name" style="color:var(--c-rad)">RAD pfu · ${T("합성", "synthetic")}</span>
      <span class="lim">ACT ≥10<br>EMG ${T("대피 지시", "shelter order")}</span><span class="val" style="color:var(--c-rad)">${fmt(FLUX[S.radT], FLUX[S.radT] < 10 ? 1 : 0)}</span>
      ${stageBlock("rad", () => (S.shelter ? T("대피 지시 수신 (모의)", "Shelter instruction (simulated)") : T("≥10 pfu 이벤트 진행 중 (합성)", "≥10 pfu event in progress (synthetic)")))}`;
    renderCamRows();
    // 혈압·SpO₂
    const br = $("#row-bp"), t = S.today;
    br.querySelector("[data-svg]").innerHTML = `<div class="empty">${T("선택 입력 — 장비 존재 [미확인]. 추세 없음.", "Optional input — device availability [unverified]. No trend.")}</div>`;
    br.querySelector("[data-src]").textContent = srcLine("bp");
    br.querySelector("[data-num]").innerHTML = `<span class="name">BP mmHg · SpO₂ %</span><span class="lim">${T("기록", "log")}<br>SpO₂ ${T("규칙 없음", "no rule")}</span>
      <span class="val" style="font-size:26px">${t.bpSys !== "" && t.bpSys !== undefined ? fmt(t.bpSys, 0) + "/" + fmt(t.bpDia, 0) : "--"}<small>${t.spo2 !== "" && t.spo2 !== undefined ? " " + fmt(t.spo2, 0) + "%" : ""}</small></span>
      ${stageBlock("bp", () => T("데모 임계값 140/90 [출처 미확인]", "demo 140/90 [source unverified]"))}`;
  }

  function renderCamRows() {
    const c = S.camera, daily = c.daily || [], today = camToday();
    const camLines = [{ value: UJ.camcore.GATE.redWatch, label: "+" + UJ.camcore.GATE.redWatch }];
    const camRow = (id, series, val, msg) => {
      const row = $("#row-" + id);
      const pts = series.filter((v) => v !== null && v !== undefined);
      row.querySelector("[data-svg]").innerHTML = pts.length >= 2
        ? trendSVG(series, { base: 0, lines: camLines, color: "var(--c-cam)", xLabels: [[0, T("첫 기록", "first")], [series.length - 1, T("최근", "latest")]], aria: id })
        : `<div class="empty">${pts.length ? T("기록 1회 — 추세는 2회부터", "1 record — trend needs 2") : T("카메라 기록 없음 — 측정하지 않은 파형은 그리지 않습니다", "No camera record — no trace is drawn without a measurement")}</div>`;
      row.querySelector("[data-src]").textContent = T("보조 신호 · 감지 근거 D0 · 단독 최대 주의", "aux signal · detection D0 · max Watch alone");
      row.querySelector("[data-num]").innerHTML = `<span class="name" style="color:var(--c-cam)">${esc(id.toUpperCase())} ${esc(CH[id].unit)}</span>
        <span class="lim">${T("기준 대비", "vs reference")}<br>WATCH +${UJ.camcore.GATE.redWatch}</span>
        <span class="val" style="color:var(--c-cam)">${val === null || val === undefined ? "--" : sgn(val, 1).replace("▲", "").replace("▼", "")}</span>
        ${stageBlock(id, () => T("기준 대비 붉기 변화 있음, 확인 필요", "Redness changed vs reference — check"))}
        ${msg ? `<span class="act dim">${esc(msg)}</span>` : ""}`;
    };
    camRow("camFace", daily.filter((x) => x.gate).map((x) => x.dFace), today.face, c.baseline ? "" : T("기준 사진 없음 → 카메라 탭", "No reference photo → Camera tab"));
    camRow("camEye", daily.filter((x) => x.gate).map((x) => x.dEye), today.eye, "");
    camRow("camSkin", (c.skin || []).map((x) => x.d), today.skin, T("부위 촬영의 첫 사진 대비", "vs first photo of that site"));
    const hrDay = daily.filter((x) => x.hrStatus).pop();
    for (const [id, key, label] of [["camHr", "hr", T("보조 참고값, 정확도 미검증", "aux reference, accuracy unverified")], ["camResp", "resp", T("기록만 — 규칙에 연결하지 않음", "log only — not linked to any rule")]]) {
      const row = $("#row-" + id), v = today[key];
      row.querySelector("[data-svg]").innerHTML = `<div class="empty">${T("30초 측정값만 표시 (원신호·영상 저장 안 함)", "Shows 30-s measurement result only (no raw signal or video stored)")}</div>`;
      row.querySelector("[data-src]").textContent = id === "camHr" ? T("감지 D1 · 35명·정지·실험실 연구 1개", "detection D1 · single lab study, n=35, at rest") : T("감지 D1 · 정지·근거리에서만 양호", "detection D1 · good only at rest, close range");
      const mismatch = id === "camHr" && ev.notes.find((n) => n.id === "camHrMismatch");
      const unavailable = hrDay && hrDay.day === S.missionDay && hrDay.hrStatus !== "ok";
      row.querySelector("[data-num]").innerHTML = `<span class="name" style="color:var(--c-cam)">${esc(id.toUpperCase())} ${esc(CH[id].unit)}</span>
        <span class="lim">${esc(label)}</span><span class="val" style="color:var(--c-cam)">${v ? fmt(v, 0) : "--"}</span>
        <div class="stage s0">${v ? "○ " + T("참고", "reference") : unavailable ? "✕ " + T("측정 불가 · 품질 게이트 미통과", "Unavailable · quality gate failed") : "— " + T("측정 안 함", "not measured")}</div>
        ${mismatch ? `<div class="act" style="color:var(--s1)">⚠ ${T("측정 불일치", "Mismatch")}: ${T("수동 심박과", "vs manual HR")} ${sgn(mismatch.diff, 0)} bpm</div>` : ""}`;
    }
  }

  /* ───────── 증상 요약 ───────── */
  function renderSymSum() {
    $("#symsum").innerHTML = UJ.MODULES.map((m) => {
      const n = UJ.SYMPTOMS.filter((s) => s.module === m.id && S.symptoms[s.id]).length;
      const t = ev.tiles["m:" + m.id], lvl = t ? t.level : 0;
      return `<button class="s${lvl}" data-mod="${m.id}" aria-expanded="${symOpen === m.id}"><span class="muted" style="font-size:11.5px">${esc(L(m))}</span><span class="n">${n}</span><span class="stage s${lvl}" style="font-size:11px">${PRI[lvl]} ${ICON[lvl]} ${LV[S.lang][lvl]}</span></button>`;
    }).join("");
    const box = $("#symdetail");
    if (!symOpen) { box.innerHTML = ""; return; }
    const m = UJ.MODULES.find((x) => x.id === symOpen), t = ev.tiles["m:" + symOpen];
    const list = UJ.SYMPTOMS.filter((s) => s.module === symOpen && S.symptoms[s.id]);
    const groups = Array.from(new Set(list.flatMap((s) => s.mapsTo))).map((id) => COND[id]);
    box.innerHTML = `<div class="symdetail"><b>${esc(L(m))}</b>
      ${list.length ? `<ul>${list.map((s) => { const o = S.symptoms[s.id] || {}; return `<li>${esc(L(s))}${s.redFlag ? ` <span class="badge" style="color:var(--s2)">⚑ red flag</span>` : ""}${o.sev !== undefined && o.sev !== "" ? ` · ${T("강도", "severity")} ${esc(o.sev)}/10` : ""}${o.onset ? ` · ${T("시작", "onset")} ${esc(o.onset)}` : ""}</li>`; }).join("")}</ul>` : `<p class="muted">${T("체크한 증상 없음", "No symptoms checked")}</p>`}
      ${groups.length ? `<p>${T("관련 위험군 (진단 아님, 확인 권고)", "Related risk groups (not a diagnosis; check advised)")}: ${groups.map((c) => `${esc(L(c))} <span class="dim mono">${c.occurrence}·${c.detection}</span>`).join(", ")}</p>` : ""}
      ${t && t.top ? `<p>${stageHTML(t.level, "")} → ${esc(L(t.top.action))}</p>` : ""}</div>`;
  }

  /* ───────── 점검 입력 ───────── */
  function buildCheckin() {
    const box = $("#checkin");
    const field = (c) => `<div class="frow"><label for="in-${c.id}"><span class="chip" style="background:var(${c.color || "--muted"})"></span>${esc(L(c))} <span class="dim">(${esc(c.unit)})</span><span class="hint" data-hint="${c.id}"></span></label>
      <input type="number" id="in-${c.id}" data-ch="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${esc(S.today[c.id])}" inputmode="decimal"></div>`;
    box.innerHTML = `
      <div class="panel"><h2>① ${T("수치 입력", "Numbers")} <span class="dim">(${T("승무원", "crew")} ${S.crew}, ${T("모의", "sim")})</span></h2>
        ${CHECKIN.map(field).join("")}
        <details style="margin-top:6px"><summary class="muted">${T("선택 입력: 혈압·SpO₂ (장비 존재 [미확인])", "Optional: BP · SpO₂ (device availability [unverified])")}</summary>${UJ.OPTIONAL_INPUTS.map(field).join("")}</details>
        <p class="dim" style="font-size:11.5px;margin:6px 0 0" id="rangeMsg"></p></div>
      <div class="panel"><h2>② ${T("증상 점검", "Symptom check")}</h2>
        <div class="btns"><button id="noSym" class="primary">${T("오늘 이상 없음", "Nothing unusual today")}</button></div>
        <p class="dim" style="font-size:11.5px;margin:6px 0">${T("⚑ = 빨간 깃발 증상. 진단명을 보여 주지 않고 관련 위험군·단계·조치만 보여 줍니다.", "⚑ = red-flag symptom. Shows risk groups, level and action — never a diagnosis.")}</p>
        ${UJ.MODULES.map((m) => `<details class="mod" data-modbox="${m.id}"><summary><span>${esc(L(m))}</span><span class="mono dim" data-modcount="${m.id}"></span></summary><div class="items">
          ${UJ.SYMPTOMS.filter((s) => s.module === m.id).map((s) => `<div class="sym"><input type="checkbox" id="sy-${s.id}" data-sym="${s.id}" ${S.symptoms[s.id] ? "checked" : ""}>
            <label for="sy-${s.id}">${esc(L(s))}${s.redFlag ? `<span class="flag" title="red flag">⚑</span>` : ""}</label>
            <div class="fu ${S.symptoms[s.id] ? "" : "hide"}" data-fu="${s.id}"><label>${T("강도", "Severity")} <select data-sev="${s.id}"><option value="">-</option>${Array.from({ length: 11 }, (_, i) => `<option ${S.symptoms[s.id] && String(S.symptoms[s.id].sev) === String(i) ? "selected" : ""}>${i}</option>`).join("")}</select></label>
            <label>${T("시작", "Onset")} <input type="time" data-onset="${s.id}" value="${esc(S.symptoms[s.id] && S.symptoms[s.id].onset || "")}"></label></div></div>`).join("")}
        </div></details>`).join("")}</div>
      <div class="panel"><h2>③ ${T("카메라 점검 (선택)", "Camera check (optional)")}</h2><p class="muted" id="camStatus" style="margin:0 0 6px"></p><button id="goCam">${T("카메라 탭으로", "Open Camera tab")}</button></div>
      <div class="panel"><h2>${T("시연 시나리오 (합성)", "Demo scenarios (synthetic)")}</h2><div class="btns presets">${PRESETS.map((p, i) => `<button data-preset="${i}">${esc(L(p))}</button>`).join("")}</div></div>
      <div class="panel"><div class="btns"><button id="resetToday">${T("오늘 입력 초기화", "Reset today")}</button><button id="resetAll" class="danger">${T("전체 초기화", "Reset everything")}</button></div></div>`;
    box.oninput = onCheckinInput;   // 재생성 시 리스너 중복 방지(속성 할당)
    box.onchange = onCheckinInput;
    $("#noSym").onclick = () => { S.symptoms = {}; $$("[data-sym]").forEach((x) => (x.checked = false)); $$("[data-fu]").forEach((x) => x.classList.add("hide")); refresh(); };
    $("#goCam").onclick = () => { view = "camera"; render(); };
    box.querySelector(".presets").addEventListener("click", (e) => { const b = e.target.closest("[data-preset]"); if (b) applyPreset(+b.dataset.preset); });
    $("#resetToday").onclick = () => { S.today = store.defaultToday(); S.symptoms = {}; S.shelter = false; S.radT = 0; rs = E.newRespondState(); S.done = {}; stopRad(); buildCheckin(); refresh(); };
    $("#resetAll").onclick = () => { if (!confirm(T("모든 저장 데이터(사진 포함)를 지웁니다. 계속할까요?", "Delete all stored data including photos?"))) return; store.photos.clear(); const lang = S.lang; S = store.reset(); S.lang = lang; rs = E.newRespondState(); stopRad(); renderStatic(); refresh(); };
  }
  function onCheckinInput(e) {
    const t = e.target;
    if (t.dataset.ch) {
      const c = CH[t.dataset.ch] || UJ.OPTIONAL_INPUTS.find((o) => o.id === t.dataset.ch);
      const v = t.value === "" ? "" : +t.value;
      const bad = v !== "" && (v < c.min || v > c.max);
      t.setAttribute("aria-invalid", bad ? "true" : "false");
      $("#rangeMsg").textContent = bad ? `${L(c)}: ${T("허용 범위", "allowed range")} ${c.min}–${c.max} ${c.unit}. ${T("범위 밖 값은 미입력으로 처리합니다.", "Out-of-range values are treated as missing.")}` : "";
      S.today[c.id] = bad ? "" : v;
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
      if (h) h.textContent = `${T("어제", "yest")} ${fmt(d.yesterday, c.dec)} · ${d.base === null ? T("기준선 수집 중", "baseline") + " " + d.n + "/14" : T("내 평균", "my baseline") + " " + fmt(d.base, c.dec)}`;
    }
    for (const m of UJ.MODULES) { const n = UJ.SYMPTOMS.filter((s) => s.module === m.id && S.symptoms[s.id]).length; const el = $(`[data-modcount="${m.id}"]`); if (el) el.textContent = n ? n + " ✓" : ""; }
    const cs = $("#camStatus"); if (cs) {
      const t = camToday();
      cs.textContent = !S.camera.baseline ? T("기준 사진 없음 — 첫 촬영이 기준이 됩니다.", "No reference photo — the first capture becomes the reference.")
        : t.face !== undefined ? `${T("오늘 측정됨", "Measured today")}: Δa* ${T("얼굴", "face")} ${fmt(t.face, 1)}, ${T("눈 주변", "eye")} ${fmt(t.eye, 1)}` : T("오늘 아직 촬영하지 않음", "Not captured today");
    }
  }

  /* 시연 시나리오 (합성) */
  const P = (ko, en, today, sym, extra) => ({ ko, en, today: today || {}, sym: sym || [], extra: extra || {} });
  const PRESETS = [
    P("정상", "Normal day"),
    P("수면 부족 + 스트레스", "Poor sleep + stress", { sleep: 4.5, stress: 4, hr: 70 }),
    P("발열 + 심박 상승", "Fever + raised HR", { temp: 38.2, hr: 78 }, ["feverChills", "cough"]),
    P("R2 감염 악화", "R2 Infection worsening", { temp: 38.6, hr: 90, ex: 20, intake: 60 }, ["confusion", "feverChills"]),
    P("R5 흉통 + 심박", "R5 Chest pain + HR", { hr: 86 }, ["chestPain", "coldSweat"]),
    P("R4 알레르기 조합", "R4 Allergy combination", {}, ["hives", "faceSwelling", "throatTight"]),
    P("CO₂ 상승 + 두통", "CO₂ rise + headache", { co2: 5.6 }, ["headache"]),
    P("방사선 이벤트 (22 h)", "Radiation event (22 h)", {}, [], { radT: 22 }),
    P("R1 대피 지시", "R1 Shelter instruction", {}, [], { radT: 22, shelter: true }),
    P("R3 눈 화학물질", "R3 Chemical in eye", {}, ["eyeChem", "eyePain"]),
    P("R6 뇌졸중 의심", "R6 Suspected stroke", {}, ["faceDroop", "slurred"]),
  ];
  function applyPreset(i) {
    const p = PRESETS[i];
    stopRad();
    S.today = Object.assign(store.defaultToday(), p.today);
    S.symptoms = Object.fromEntries(p.sym.map((s) => [s, {}]));
    S.radT = p.extra.radT || 0; S.shelter = !!p.extra.shelter;
    rs = E.newRespondState(); S.done = {}; autoBanner = false; view = "care";
    buildCheckin(); refresh();
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
          <ul class="steps">${steps.map((s, i) => `<li class="${done[i] ? "done" : ""}"><input type="checkbox" id="st${i}" data-step="${i}" ${done[i] ? "checked" : ""}><label for="st${i}">${esc(L(s))}</label></li>`).join("")}</ul>
          <p class="dim" style="font-size:11.5px">${T("근거 수준 C · 일반 응급처치 수준 데모 · NASA 전용 절차 [미확인] · 이 카드는 처치를 지시하지 않습니다.", "Evidence C · generic first-aid-level demo · NASA-specific procedure [unverified] · this card does not prescribe treatment.")}</p></div>
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
      crew: S.crew, missionDay: S.missionDay, ev, today: S.today, symptoms: S.symptoms, done: S.done[k] || {},
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
    if (t.id === "camFromResp") { view = "camera"; return render(); }
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
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = `ujumin-report-${k}-D${S.missionDay}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ───────── 근거 ───────── */
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
  const srcLink = (id) => { const s = SRC[id]; return s ? (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(id)}</a>` : esc(id)) : `<span class="bad">${esc(id)}?</span>`; };
  function renderEvidence() {
    const root = $("#view-evidence");
    root.dataset.lang = S.lang;
    const catOpts = Object.keys(UJ.CATEGORIES).map((k) => `<option value="${k}">${esc(L(UJ.CATEGORIES[k]))}</option>`).join("");
    const specific = rules.filter((r) => !r.generic);
    root.innerHTML = `
      <div class="panel legend"><h2>${T("근거 표기 체계", "Evidence notation")}</h2>
        <p><b>${T("규칙 근거 수준", "Rule evidence level")}</b> — A ${T("임계값+행동 모두 출처 확인 (현재 0개)", "threshold + action both sourced (currently 0)")} · B ${T("위험은 출처 확인, 임계값은 데모", "risk sourced, threshold is demo")} · C ${T("데모 절차", "demo procedure")}</p>
        <p><b>${T("발생 근거 O", "Occurrence O")}</b> — O1 ${T("IMM 샘플 표 E.2-1에 임무당 건수(모델 추정)", "count in IMM sample table E.2-1 (modelled)")} · O2 ${T("분류표 E.2-2에만 있음", "listed in Table E.2-2 only")} · O3 ${T("개별 NASA·논문 자료", "other NASA/paper source")} · O0 ${T("출처 없음 → 후보", "no source → candidate")}</p>
        <p><b>${T("감지 근거 D", "Detection D")}</b> — D0 ${T("없음(우리 설계)", "none (our design)")} · D1 ${T("일반 인구 연구, 우주비행사 미검증", "general-population study, not validated in astronauts")} · D2 ${T("우주비행 환경 검증 (현재 0개)", "validated in spaceflight (currently 0)")}</p>
        <p><b>${T("채널", "Channels")}</b> — Q ${T("자기 점검 문항", "self-check item")} · V ${T("수치 변화", "numeric change")} · C ${T("카메라 측정", "camera measurement")} · Cp ${T("카메라 사진 첨부만", "camera photo only")} · P ${T("수동 절차 카드", "manual card")} · X ${T("앱이 감지 못 함", "not detected")} · <b>${T("상한", "cap")}</b> ${T("앱이 스스로 부여하는 최고 단계", "highest level the app can assign")}</p>
        ${loaded.rejected.length ? `<p class="bad">⚠ ${T("로드하지 않은 규칙", "Rules not loaded")}: ${loaded.rejected.join(", ")}</p>` : `<p class="ok">✓ ${T("모든 규칙이 열람 완료(read) 출처를 가짐", "Every rule has a read source")} (${rules.length})</p>`}</div>
      <div class="panel"><h2>${T("질환 카탈로그", "Condition catalogue")} (${UJ.CONDITIONS.length}) — NASA Appendix E ${T("표", "Tables")} E.2-1 · E.2-2</h2>
        <p class="dim" style="font-size:12px;margin:0 0 6px">${T("IMM 건수는 임무당 예상 건수(모델 추정, 'Sample')이며 실제 관측 건수가 아닙니다. ★ = E.2-2 '가장 흔함' 표시(원문 일부 모호).", "IMM counts are modelled expected events per mission ('Sample'), not observed counts. ★ = E.2-2 'most common' mark (partly ambiguous in source).")}</p>
        <label>${T("범주", "Category")} <select id="catSel"><option value="">${T("전체", "All")}</option>${catOpts}</select></label>
        <div class="scroll tscroll" style="margin-top:6px"><table id="condTable"></table></div></div>
      <div class="panel"><h2>${T("규칙", "Rules")} (${specific.length} + ${T("증상 일반 규칙", "generic symptom rules")} ${rules.length - specific.length})</h2>
        <p class="dim" style="font-size:12px;margin:0 0 6px">${T("증상 일반 규칙: 체크한 증상 → 해당 모듈 주의(1), ⚑ 증상 → 조치(2). 출처 appE. [설계 선택]", "Generic symptom rules: checked symptom → module Watch (1); ⚑ → Act (2). Source appE. [design choice]")}</p>
        <div class="scroll tscroll"><table><tr><th>ID</th><th>${T("타일", "Tile")}</th><th>${T("단계", "Level")}</th><th>${T("조건 (데모)", "Condition (demo)")}</th><th>${T("근거", "Ev.")}</th><th>${T("출처", "Sources")}</th></tr>
        ${specific.map((r) => `<tr><td class="mono">${r.id}</td><td>${esc(tileName(r.tile))}</td><td class="mono">${PRI[r.level]} ${LV[S.lang][r.level]}${r.card ? " → " + r.card : ""}</td><td>${esc(describeWhen(r.when))}${r.note ? ` <span class="bad">${esc(r.note)}</span>` : ""}</td><td>${r.evidenceLevel}</td><td>${r.sources.map(srcLink).join(", ")}</td></tr>`).join("")}</table></div></div>
      <div class="panel"><h2>${T("응급 카드", "Emergency cards")} (${UJ.CARDS.length})</h2><div class="scroll"><table><tr><th>ID</th><th>${T("카드", "Card")}</th><th>${T("트리거 (데모)", "Trigger (demo)")}</th><th>${T("단계 수", "Steps")}</th><th>${T("사진", "Photos")}</th><th>${T("근거", "Ev.")}</th><th>${T("출처", "Sources")}</th></tr>
        ${UJ.CARDS.map((c) => `<tr><td class="mono">${c.id}</td><td>${esc(L(c))}</td><td>${esc(L(c.triggerText))}${c.manualOnly ? ` <b>(${T("수동 전용", "manual only")})</b>` : ""}</td><td>${c.steps.length}</td><td>${c.photoSlots.join(", ") || "—"}</td><td>${c.evidence}</td><td>${c.sources.map(srcLink).join(", ")}</td></tr>`).join("")}</table></div></div>
      <div class="panel"><h2>${T("출처", "Sources")} (${UJ.SOURCES.length})</h2><div class="scroll"><table><tr><th>ID</th><th>${T("제목", "Title")}</th><th>${T("열람 상태", "Status")}</th><th>Resources ${T("탭", "tab")}</th><th>${T("메모", "Note")}</th></tr>
        ${UJ.SOURCES.map((s) => `<tr><td class="mono">${esc(s.id)}</td><td>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>` : esc(s.title) + ` <span class="dim">(URL ${T("미기재", "not recorded")})</span>`}</td><td class="${s.status === "read" ? "ok" : "bad"}">${s.status}${s.status === "read" ? "" : " — " + T("근거로 사용 안 함", "not used as evidence")}</td><td>${s.inResourcesTab ? "✓" : ""}</td><td>${esc(L(s.note))}</td></tr>`).join("")}</table></div></div>
      <div class="panel"><h2>${T("근거 부족으로 제외한 기능", "Excluded for lack of evidence")}</h2><ul>${UJ.EXCLUDED.map((x) => `<li>${esc(L(x))}</li>`).join("")}</ul></div>
      <div class="panel"><h2>${T("한계·공개", "Limitations & disclosure")}</h2><ul>
        <li>${T("모든 임계값은 데모 값이며 NASA 의료 기준이 아닙니다. 감지 근거 A 규칙은 0개입니다.", "All thresholds are demo values, not NASA medical criteria. Zero rules reach evidence A.")}</li>
        <li>${T("모든 승무원 데이터와 방사선 곡선은 합성입니다.", "All crew data and the radiation curve are synthetic.")}</li>
        <li>${T("카메라 수치는 보조 신호입니다. 카메라 단독으로는 '주의'까지만, 긴급은 만들지 않습니다.", "Camera values are auxiliary. Alone they reach Watch at most and never create an emergency.")}</li>
        <li>${T("AI 사용 공개: 코드·데이터 초안은 Claude(Anthropic)로 작성했고 팀이 검토했습니다.", "AI disclosure: code and data were drafted with Claude (Anthropic) and reviewed by the team.")}</li></ul></div>`;
    const draw = () => {
      const cat = $("#catSel").value;
      $("#condTable").innerHTML = `<tr><th>${T("범주", "Cat.")}</th><th>${T("질환", "Condition")}</th><th>IMM</th><th>★</th><th>O</th><th>D</th><th>${T("채널", "Ch.")}</th><th>${T("상한", "Cap")}</th><th>${T("카드", "Cards")}</th><th>${T("출처", "Sources")}</th><th>${T("원문 근거", "Source note")}</th></tr>` +
        UJ.CONDITIONS.filter((c) => !cat || c.category === cat).map((c) => `<tr><td>${esc(L(UJ.CATEGORIES[c.category]))}</td><td>${esc(L(c))}</td><td class="mono">${c.imm === null ? "—" : c.imm}</td><td>${c.starred ? "★" : ""}</td><td class="mono">${c.occurrence}</td><td class="mono">${c.detection}</td><td class="mono">${c.channels.join(" ")}</td><td class="mono">${c.cap}</td><td class="mono">${c.cards.join(" ")}</td><td>${c.sources.map(srcLink).join(", ")}</td><td class="dim">${esc(c.note)}</td></tr>`).join("");
    };
    $("#catSel").onchange = draw; draw();
  }

  /* ───────── 카메라 탭 연결 ───────── */
  const api = {
    get S() { return S; }, T, L, esc, store,
    save() { store.save(S); },
    changed() { compute(); renderAlarm(); },
  };

  /* ───────── 시작 ───────── */
  function init() {
    $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (!b) return; if (view === "camera" && b.dataset.view !== "camera") UJ.cameraUI.leave(); view = b.dataset.view; autoBanner = false; render(); });
    $("#langBtn").onclick = () => { S.lang = S.lang === "ko" ? "en" : "ko"; renderStatic(); refresh(); };
    $("#view-respond").addEventListener("click", onRespondClick);
    $("#view-respond").addEventListener("change", onRespondChange);
    $("#monitor").addEventListener("click", () => {});
    $("#symsum").addEventListener("click", (e) => { const b = e.target.closest("[data-mod]"); if (!b) return; symOpen = symOpen === b.dataset.mod ? null : b.dataset.mod; renderSymSum(); });
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => view === "care" && renderMonitor(), 150); });
    setInterval(tick, 1000);
    renderStatic(); refresh();
    built = true;
  }
  window.UJ.app = { get state() { return S; }, get ev() { return ev; }, get view() { return view; }, applyPreset, refresh };
  init();
})();
