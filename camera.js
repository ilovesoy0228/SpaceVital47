/* 우주민 camera.js — 카메라 탭 UI (§7). 분석은 camera-core.js.
 * 원칙: 동의 후 사용 / 영상 스트림은 촬영 직후 stop() / 원본 영상 미저장 / 네트워크 요청 0건 / 판정 없음. */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});
  const C = UJ.camcore;
  const W = 640, H = 480;
  const REGIONS = ["face", "eye", "mouth", "arm", "leg", "wound", "other"];
  let stream = null, api = null, root = null, busy = false, last = null, msg = "", hrProgress = null;

  const $ = (s) => root.querySelector(s);
  const T = (...a) => api.T(...a), esc = (s) => api.esc(s);
  const RNAME = { face: ["얼굴", "Face"], eye: ["눈", "Eye"], mouth: ["입 안", "Mouth"], arm: ["손·팔 피부", "Hand/arm skin"], leg: ["다리", "Leg"], wound: ["상처·화상", "Wound/burn"], other: ["기타", "Other"] };
  const rname = (r) => T(RNAME[r][0], RNAME[r][1]);
  const cam = () => api.S.camera;
  const day = () => api.S.missionDay;
  const newId = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  /* ───── 스트림 ───── */
  async function start() {
    if (stream) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMsg(T("이 환경에서는 카메라를 쓸 수 없습니다 (HTTPS 필요할 수 있음). 사진 파일로 대체하십시오.", "Camera is not available here (HTTPS may be required). Use a photo file instead."), true); return false; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: W, height: H, facingMode: "user" }, audio: false });
      const v = $("#camVideo"); v.srcObject = stream; await v.play().catch(() => {});
      drawOverlay(); setMsg(T("타원 안에 얼굴을 맞추십시오. 얼굴 인식 모델 없이 고정 비율 영역을 측정합니다.", "Fit your face inside the oval. Fixed-ratio regions are measured — no face-detection model."));
      return true;
    } catch (e) {
      setMsg(T("카메라 권한이 거부되었거나 장치가 없습니다. 사진 파일로 대체하십시오.", "Camera permission denied or no device. Use a photo file instead.") + ` (${e.name})`, true);
      return false;
    }
  }
  function stop() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } const v = root && $("#camVideo"); if (v) v.srcObject = null; }

  function drawOverlay() {
    const cv = $("#camOv"); if (!cv) return;
    cv.width = W; cv.height = H;
    const x = cv.getContext("2d"), e = C.guide(W, H), rects = C.roiRects(W, H);
    x.clearRect(0, 0, W, H);
    x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 2; x.setLineDash([8, 6]);
    x.beginPath(); x.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, Math.PI * 2); x.stroke();
    x.setLineDash([]); x.strokeStyle = "rgba(214,140,255,.9)"; x.font = "12px monospace"; x.fillStyle = "rgba(214,140,255,.9)";
    for (const k in rects) { const r = rects[k]; x.strokeRect(r.x, r.y, r.w, r.h); x.fillText(k, r.x + 2, r.y - 3); }
  }

  /* ───── 프레임 얻기 (카메라 또는 파일) ───── */
  function frameFromSource(src) {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d", { willReadFrequently: true });
    const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
    const s = Math.max(W / sw, H / sh), dw = sw * s, dh = sh * s; // cover
    x.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return { data: x.getImageData(0, 0, W, H).data, canvas: cv };
  }
  function thumb(canvas) {
    const t = document.createElement("canvas"); t.width = 320; t.height = 240;
    t.getContext("2d").drawImage(canvas, 0, 0, 320, 240);
    return t.toDataURL("image/jpeg", 0.72);
  }
  async function grab(n) {
    const v = $("#camVideo"), frames = [];
    for (let i = 0; i < n; i++) { frames.push(frameFromSource(v)); await new Promise((r) => setTimeout(r, 120)); }
    return frames;
  }
  function loadFile(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { const f = frameFromSource(img); URL.revokeObjectURL(url); res(f); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("image")); };
      img.src = url;
    });
  }

  /* ───── 정기 점검 A ───── */
  function savePhoto(region, kind, canvas, note) {
    const p = { id: newId(region), region, kind, day: day(), dataUrl: thumb(canvas), note: note || "" };
    const ok = api.store.photos.add(p);
    if (!ok) setMsg(T("브라우저 저장소에 저장하지 못했습니다(용량·차단). 이 세션에서만 유지됩니다.", "Could not persist to browser storage (quota/blocked). Kept for this session only."), true);
    return p;
  }
  function doBaseline(frames) {
    const ms = frames.map((f) => C.measureFrame(f.data, W, H));
    const m = C.averageMeasures(ms), gate = C.lightGate(null, m);
    if (!gate.ok) return setMsg(T("빛 반사·과노출이 있습니다(포화 픽셀 ≥2%). 다시 촬영하십시오.", "Glare/over-exposure (saturated pixels ≥2%). Please retake."), true);
    const p = savePhoto("face", "baseline", frames[frames.length - 1].canvas);
    cam().baseline = { measure: m, photoId: p.id, day: day() };
    api.save(); api.changed();
    setMsg(T(`기준 촬영 완료 (${m.frames}프레임 평균). 이후 촬영은 이 기준과 비교합니다.`, `Reference captured (${m.frames}-frame mean). Later captures compare against it.`));
  }
  function doDaily(frames) {
    const b = cam().baseline;
    if (!b) return doBaseline(frames);
    const m = C.averageMeasures(frames.map((f) => C.measureFrame(f.data, W, H)));
    const gate = C.lightGate(b.measure, m);
    if (!gate.ok) {
      last = { gate, m };
      return setMsg(gate.reasons.includes("saturated") ? T("빛 반사·과노출이 있습니다. 다시 촬영하십시오.", "Glare/over-exposure. Please retake.") : T(`조명이 다릅니다 (밝기 ${(gate.dL * 100).toFixed(0)}%, 허용 ±10%). 다시 촬영하십시오.`, `Lighting differs (brightness ${(gate.dL * 100).toFixed(0)}%, allowed ±10%). Please retake.`), true);
    }
    const d = C.compare(b.measure, m);
    const p = savePhoto("face", "daily", frames[frames.length - 1].canvas);
    const list = cam().daily.filter((x) => !(x.day === day() && x.gate));
    const prevHr = cam().daily.find((x) => x.day === day() && x.hrStatus);
    const entry = { day: day(), gate: true, dFace: +d.face.toFixed(2), dEye: +d.eye.toFixed(2), rois: Object.fromEntries(Object.entries(d.rois).map(([k, v]) => [k, +v.toFixed(2)])), dL: +gate.dL.toFixed(3), photoId: p.id };
    if (prevHr) Object.assign(entry, { hr: prevHr.hr, resp: prevHr.resp, hrStatus: prevHr.hrStatus, hrReasons: prevHr.hrReasons });
    cam().daily = list.filter((x) => x.day !== day()).concat([entry]);
    last = { gate, m, d, photoId: p.id };
    api.save(); api.changed();
    const changed = d.face >= C.GATE.redWatch || d.eye >= C.GATE.redWatch;
    setMsg(changed ? T("기준 대비 붉기 변화 있음, 확인 필요.", "Redness changed vs reference — please check.") : T("기준 대비 큰 붉기 변화 없음.", "No large redness change vs reference."), changed);
  }

  /* ───── 30초 심박·호흡 (보조) ───── */
  async function doHr() {
    if (!(await start())) return;
    busy = true; hrProgress = 0; render(); // 먼저 다시 그린 뒤 새 video 요소를 잡아야 함(분리된 요소는 프레임이 오지 않음)
    const v = $("#camVideo"), track = stream.getVideoTracks()[0];
    await v.play().catch(() => {});
    const fps = (track.getSettings && track.getSettings().frameRate) || 30;
    const cv = document.createElement("canvas"); cv.width = 160; cv.height = 120;
    const x = cv.getContext("2d", { willReadFrequently: true });
    const rects = C.roiRects(160, 120), face = ["forehead", "cheekL", "cheekR"];
    const s = { t: [], g: [], L: [] }, t0 = performance.now(), DUR = 30000;
    await new Promise((resolve) => {
      const step = (now) => {
        const el = (performance.now() - t0);
        x.drawImage(v, 0, 0, 160, 120);
        const d = x.getImageData(0, 0, 160, 120).data;
        let gg = 0, L = 0;
        for (const k of face) { const st = C.roiStats(d, 160, rects[k]); gg += st.g; L += st.L; }
        s.t.push(el / 1000); s.g.push(gg / 3); s.L.push(L / 3);
        hrProgress = Math.min(1, el / DUR); const pb = $("#hrProg"); if (pb) pb.value = hrProgress;
        if (el >= DUR || !stream) return resolve();
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else requestAnimationFrame(step);
      };
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else requestAnimationFrame(step);
    });
    stop(); busy = false; hrProgress = null;
    const r = C.vitalsFromSamples(s, fps);
    const today = cam().daily.find((e) => e.day === day()) || (cam().daily.push({ day: day() }), cam().daily[cam().daily.length - 1]);
    Object.assign(today, { hrStatus: r.status, hrReasons: r.reasons, hr: r.status === "ok" ? Math.round(r.bpm) : null, resp: r.resp ? Math.round(r.resp) : null, hrSnr: isFinite(r.snr) ? +r.snr.toFixed(1) : null, frames: s.t.length });
    api.save(); api.changed();
    setMsg(r.status === "ok" ? T(`카메라 심박 ${Math.round(r.bpm)} bpm — 보조 참고값, 정확도 미검증.`, `Camera HR ${Math.round(r.bpm)} bpm — auxiliary reference, accuracy unverified.`)
      : T("측정 불가 — 품질 게이트 미통과", "Unavailable — quality gate failed") + ` (${r.reasons.join(", ")})`, r.status !== "ok");
  }

  /* ───── 부위 촬영 B ───── */
  function doSite(frame, region, note) {
    const box = { x: W * 0.35, y: H * 0.35, w: W * 0.3, h: H * 0.3 };
    const st = C.roiStats(frame.data, W, { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) });
    const p = savePhoto(region, "site", frame.canvas, note);
    const regs = cam().regions;
    let d = null, info;
    if (!regs[region]) { regs[region] = { ref: { a: st.a, L: st.L }, photoId: p.id }; info = T("이 부위의 첫 사진 — 비교 기준이 됩니다.", "First photo of this site — it becomes the reference."); }
    else {
      const ref = regs[region].ref, dl = (st.L - ref.L) / ref.L;
      if (Math.abs(dl) > C.GATE.tolL || st.sat >= C.GATE.maxSat) info = T("조명이 기준과 다릅니다 — 사진은 저장했지만 붉기 변화는 계산하지 않았습니다.", "Lighting differs from the reference — photo saved, redness change not computed.");
      else { d = +(st.a - ref.a).toFixed(2); info = T(`기준 사진 대비 Δa* ${d >= 0 ? "+" : ""}${d}`, `Δa* vs reference ${d >= 0 ? "+" : ""}${d}`); }
    }
    cam().skin = (cam().skin || []).concat([{ day: day(), region, d: region === "eye" ? null : d, photoId: p.id }]);
    api.save(); api.changed(); setMsg(info);
  }

  /* 결막(아래 눈꺼풀 안쪽) ROI: 사용자가 사진을 눌러 지정 → a* 기록만 */
  function conjAt(photo, fx, fy) {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
      const x = cv.getContext("2d"); x.drawImage(img, 0, 0);
      const s = Math.round(img.width * 0.06), r = { x: Math.max(0, Math.round(fx * img.width - s / 2)), y: Math.max(0, Math.round(fy * img.height - s / 2)), w: s, h: s };
      const st = C.roiStats(x.getImageData(0, 0, img.width, img.height).data, img.width, r);
      cam().conj = (cam().conj || []).concat([{ day: day(), photoId: photo.id, a: +st.a.toFixed(2) }]);
      api.save(); setMsg(T(`결막 영역 a* ${st.a.toFixed(1)} 기록 — 빈혈 판정 아님 (선별 연구 특이도 72–76% 수준, 오탐 많음)`, `Conjunctival a* ${st.a.toFixed(1)} logged — not an anaemia judgement (screening studies: specificity ~72–76%, many false positives)`));
    };
    img.src = photo.dataUrl;
  }

  function exportJson() {
    const c = cam();
    const data = { exported: new Date().toISOString(), note: "Ujumin camera numbers only - no photos or video. SIMULATED/PROTOTYPE, not for clinical use.",
      missionDay: day(), reference: c.baseline ? { day: c.baseline.day, face: c.baseline.measure.face, eye: c.baseline.measure.eye, L: c.baseline.measure.L } : null,
      daily: c.daily.map(({ photoId, ...rest }) => rest), sites: (c.skin || []).map(({ photoId, ...rest }) => rest), conjunctiva: (c.conj || []).map(({ photoId, ...rest }) => rest) };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `ujumin-camera-D${day()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function setMsg(m, bad) { msg = { m, bad: !!bad }; const el = root && $("#camMsg"); if (el) { el.textContent = m; el.className = bad ? "bad" : "ok"; } }

  /* ───── 렌더 ───── */
  function render(r, a) {
    if (r) root = r; if (a) api = a;
    const c = cam();
    if (!c.consent) {
      root.innerHTML = `<div class="panel" style="max-width:720px"><h2>${T("카메라 점검 동의", "Camera check consent")}</h2><ul>
        <li>${T("영상·사진은 이 기기 안에서만 처리하며 네트워크로 보내지 않습니다.", "Video and photos are processed on this device only and never sent over the network.")}</li>
        <li>${T("원본 영상은 저장하지 않습니다. 촬영 직후 카메라를 끕니다.", "Raw video is never stored. The camera is turned off right after each capture.")}</li>
        <li>${T("기준·일일 사진(축소본)과 수치만 브라우저 저장소에 저장하며, 언제든 전체 삭제할 수 있습니다.", "Only reduced reference/daily photos and numbers are kept in browser storage; delete them all at any time.")}</li>
        <li>${T("진단하지 않습니다. 기준 대비 변화량과 사진 증거만 보여 줍니다. 카메라 단독으로는 '주의'까지만 표시합니다.", "No diagnosis. Shows change vs your reference and photo evidence only. Camera alone reaches Watch at most.")}</li>
        <li>${T("할 수 없는 것: SANS·심장·신장 등 내부 질환, 졸음·뇌졸중·빈혈 판정.", "Cannot do: internal conditions (SANS, heart, kidney), drowsiness / stroke / anaemia judgement.")}</li></ul>
        <div class="btns"><button class="primary" id="consentYes">${T("동의하고 시작", "Agree and start")}</button><button id="consentNo">${T("동의하지 않음 (카메라 없이 사용)", "Decline (use without camera)")}</button></div></div>`;
      $("#consentYes").onclick = () => { c.consent = true; api.save(); render(); };
      $("#consentNo").onclick = () => setMsgInline(T("카메라 없이도 모든 점검·응급 기능을 쓸 수 있습니다.", "All check-in and emergency features work without the camera."));
      return;
    }
    const photos = api.store.photos.all();
    const ph = (id) => photos.find((p) => p.id === id);
    const b = c.baseline, todayD = c.daily.filter((x) => x.day === day() && x.gate).pop();
    const hrD = c.daily.filter((x) => x.day === day() && x.hrStatus).pop();
    const base = b && ph(b.photoId), cur = todayD && ph(todayD.photoId);
    const badge = (v) => (v >= C.GATE.redWatch ? `<span class="stage s1" style="display:inline">* △ ${T("주의", "Watch")}</span>` : `<span class="stage s0" style="display:inline">○</span>`);
    const sitesByRegion = REGIONS.map((rg) => [rg, photos.filter((p) => p.region === rg && (p.kind === "site"))]).filter(([, l]) => l.length);
    const eyePhotos = photos.filter((p) => p.region === "eye");
    root.innerHTML = `<div class="cam-grid"><div>
      <div class="panel"><h2>${T("카메라", "Camera")} <span class="dim">640×480 · ${T("보조 신호", "auxiliary signal")}</span></h2>
        <div class="stagebox"><video id="camVideo" playsinline muted></video><canvas id="camOv" class="ov"></canvas>${stream ? "" : `<div class="empty" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--dim);text-align:center;padding:12px">${T("카메라 꺼짐 — 켜거나 사진 파일을 고르십시오", "Camera off — turn it on or choose a photo file")}</div>`}</div>
        <div class="btns" style="margin-top:8px"><button id="camOn" ${busy ? "disabled" : ""}>${T("카메라 켜기", "Camera on")}</button><button id="camOff">${T("끄기", "Off")}</button>
          <label class="muted" style="font-size:12px;align-self:center">${T("또는 사진 파일", "or photo file")}: <input type="file" accept="image/*" id="camFile" aria-label="photo file"></label></div>
        <p id="camMsg" class="${msg && msg.bad ? "bad" : "ok"}" role="status" style="min-height:1.4em;margin:8px 0 0">${esc(msg ? msg.m : "")}</p>
        <h3>A. ${T("정기 점검", "Routine check")}</h3>
        <div class="btns"><button id="capBase" ${busy ? "disabled" : ""}>${b ? T("기준 다시 촬영", "Retake reference") : T("기준 촬영 (5프레임 평균)", "Capture reference (5-frame mean)")}</button>
          <button id="capDaily" class="primary" ${busy || !b ? "disabled" : ""}>${T("오늘 촬영·비교", "Capture today & compare")}</button>
          <button id="capHr" ${busy ? "disabled" : ""}>${T("30초 심박·호흡 (선택)", "30-s HR & resp (optional)")}</button></div>
        ${hrProgress !== null ? `<progress id="hrProg" max="1" value="${hrProgress}" style="margin-top:6px"></progress><p class="muted" style="font-size:12px">${T("움직이지 말고 30초 유지", "Hold still for 30 s")}</p>` : ""}
        <p class="dim" style="font-size:11.5px">${T("카메라 심박: 정지 상태 35명(전원 백인) 실험실 연구 1개뿐(D1). 품질 게이트(피크 SNR, 프레임 드롭 <10%, 조명 변동) 실패 시 '측정 불가'. 호흡수는 기록만.", "Camera HR: one lab study, n=35, all white, at rest (D1). Shows 'unavailable' if the quality gate (peak SNR, frame drop <10%, lighting stability) fails. Resp. rate is logged only.")}</p>
        <h3>B. ${T("부위 촬영 (필요할 때)", "Site photo (when needed)")}</h3>
        <div class="btns"><select id="siteRegion" aria-label="region">${REGIONS.map((x) => `<option value="${x}">${esc(rname(x))}</option>`).join("")}</select>
          <input type="text" id="siteNote" placeholder="${T("메모 (선택)", "note (optional)")}" style="flex:1;min-width:120px"><button id="capSite" ${busy ? "disabled" : ""}>${T("부위 촬영", "Capture site")}</button></div>
        <p class="dim" style="font-size:11.5px">${T("파일을 고를 때는 아래 동작을 먼저 선택하십시오", "When using a file, pick what it is for")}: <select id="fileFor"><option value="daily">${T("오늘 정기 촬영", "today routine")}</option><option value="base">${T("기준 촬영", "reference")}</option><option value="site">${T("부위 촬영", "site photo")}</option></select></p>
      </div>
      <div class="panel"><h2>${T("저장·내보내기", "Storage & export")}</h2>
        <div class="btns"><button id="camExport">${T("수치 JSON 내보내기 (사진 제외)", "Export numbers as JSON (no photos)")}</button><button id="camDelete" class="danger">${T("카메라 데이터 전체 삭제", "Delete all camera data")}</button></div>
        <p class="dim" style="font-size:11.5px">${T("저장 사진", "Stored photos")}: ${photos.length} · ${T("네트워크 요청 0건 (CSP connect-src 'none')", "0 network requests (CSP connect-src 'none')")}</p></div>
    </div><div>
      <div class="panel"><h2>${T("기준 vs 오늘", "Reference vs today")}</h2>
        ${base && cur ? `<div class="cmp" id="cmp" style="--split:50%"><img src="${base.dataUrl}" alt="reference"><img class="top" src="${cur.dataUrl}" alt="today"><div class="bar"></div><span class="cap l">${T("기준", "REF")} D${b.day}</span><span class="cap r">${T("오늘", "TODAY")} D${todayD.day}</span></div>
          <input type="range" id="split" min="0" max="100" value="50" style="width:100%" aria-label="${T("비교 슬라이더", "comparison slider")}">`
          : `<p class="muted">${b ? T("오늘 촬영하면 기준과 나란히 비교합니다.", "Capture today to compare side by side.") : T("먼저 기준을 촬영하십시오.", "Capture a reference first.")}</p>`}
        ${todayD ? `<table><tr><th>ROI</th><th>Δa*</th><th></th></tr>${Object.entries(todayD.rois).map(([k, v]) => `<tr><td class="mono">${k}</td><td class="mono">${v >= 0 ? "+" : ""}${v.toFixed(1)}</td><td>${badge(v)}</td></tr>`).join("")}
          <tr><td class="mono"><b>face</b></td><td class="mono"><b>${todayD.dFace >= 0 ? "+" : ""}${todayD.dFace.toFixed(1)}</b></td><td>${badge(todayD.dFace)}</td></tr>
          <tr><td class="mono"><b>eye</b></td><td class="mono"><b>${todayD.dEye >= 0 ? "+" : ""}${todayD.dEye.toFixed(1)}</b></td><td>${badge(todayD.dEye)}</td></tr></table>
          <p class="dim" style="font-size:11.5px">${T("주의 임계값 Δa* +3은 데모 값(근거 없음, D0). 문구는 '기준 대비 붉기 변화 있음, 확인 필요'까지만. 조명 차", "Watch threshold Δa* +3 is a demo value (no evidence, D0). Wording stops at 'redness changed vs reference — check'. Lighting diff")} ${(todayD.dL * 100).toFixed(1)}%</p>` : ""}
        ${hrD ? `<p class="mono">CAM-HR: ${hrD.hrStatus === "ok" ? hrD.hr + " bpm" : "-- (" + T("측정 불가", "unavailable") + ": " + esc((hrD.hrReasons || []).join(", ")) + ")"} · CAM-RESP: ${hrD.resp ? hrD.resp + "/min (" + T("기록만", "log only") + ")" : "--"}</p>` : ""}
      </div>
      <div class="panel"><h2>${T("부위 사진 이력", "Site photo history")}</h2>
        ${sitesByRegion.length ? sitesByRegion.map(([rg, l]) => `<h3>${esc(rname(rg))}</h3><div class="thumbs">${l.map((p) => { const s = (c.skin || []).find((x) => x.photoId === p.id); return `<div class="thumb"><img src="${p.dataUrl}" alt="${esc(rg)} D${p.day}" ${rg === "eye" ? `data-conj="${p.id}" style="cursor:crosshair" title="${T("눌러서 결막 영역 지정", "click to set conjunctival ROI")}"` : ""}>D${p.day}${s && s.d !== null && s.d !== undefined ? ` · Δa* ${s.d >= 0 ? "+" : ""}${s.d}` : ""}${p.note ? " · " + esc(p.note) : ""}</div>`; }).join("")}</div>`).join("") : `<p class="muted">${T("부위 사진 없음.", "No site photos.")}</p>`}
        ${eyePhotos.length ? `<p class="dim" style="font-size:11.5px">${T("눈 사진을 누르면 그 지점(아래 눈꺼풀 안쪽)의 a*를 기록합니다. 빈혈 판정 아님.", "Click an eye photo to log a* at that point (inner lower eyelid). Not an anaemia judgement.")}${(c.conj || []).length ? " " + T("기록", "Logged") + ": " + c.conj.map((x) => `D${x.day} a* ${x.a}`).join(", ") : ""}</p>` : ""}
      </div></div></div>`;
    if (stream) { const v = $("#camVideo"); v.srcObject = stream; v.play().catch(() => {}); drawOverlay(); }
    bind();
  }
  function setMsgInline(m) { const p = document.createElement("p"); p.className = "muted"; p.textContent = m; root.querySelector(".panel").appendChild(p); }

  function bind() {
    $("#camOn").onclick = () => start().then(() => render());
    $("#camOff").onclick = () => { stop(); render(); };
    const withFrames = async (n, fn) => { if (busy) return; if (!(await start())) return; busy = true; try { const f = await grab(n); stop(); fn(f); } finally { busy = false; render(); } };
    $("#capBase").onclick = () => withFrames(5, doBaseline);
    $("#capDaily").onclick = () => withFrames(5, doDaily);
    $("#capHr").onclick = () => { if (!busy) doHr().then(() => render()); };
    $("#capSite").onclick = () => withFrames(1, (f) => doSite(f[0], $("#siteRegion").value, $("#siteNote").value));
    $("#camFile").onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const f = await loadFile(file), what = $("#fileFor").value;
        if (what === "base") doBaseline([f]); else if (what === "daily") doDaily([f]); else doSite(f, $("#siteRegion").value, $("#siteNote").value);
      } catch (err) { setMsg(T("이미지를 읽지 못했습니다.", "Could not read the image."), true); }
      render();
    };
    $("#camExport").onclick = exportJson;
    $("#camDelete").onclick = () => { if (!confirm(T("사진·기준·카메라 수치를 모두 지웁니다.", "Delete all photos, reference and camera numbers?"))) return; stop(); api.store.clearCamera(api.S); last = null; setMsg(T("카메라 데이터를 모두 삭제했습니다.", "All camera data deleted.")); api.changed(); render(); };
    const sp = $("#split"); if (sp) sp.oninput = () => $("#cmp").style.setProperty("--split", sp.value + "%");
    root.querySelectorAll("[data-conj]").forEach((img) => img.addEventListener("click", (e) => {
      const r = img.getBoundingClientRect(), p = api.store.photos.all().find((x) => x.id === img.dataset.conj);
      if (p) conjAt(p, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    }));
  }

  UJ.cameraUI = { render, leave() { if (!busy) stop(); }, stop };
})(typeof window !== "undefined" ? window : globalThis);
