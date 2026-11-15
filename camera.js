/* 우주민 camera.js — 카메라 패널 UI (§7). 분석은 camera-core.js, 기록 모델은 camdata.js.
 * 원칙: 동의 후 사용 / 스트림은 촬영 직후 stop() / 원본 영상 미저장 / 네트워크 요청 0건 / 판정 없음 / 얼굴 인식 모델 없음. */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});
  const C = UJ.camcore, CD = UJ.camdata;
  const W = 480, H = 640; // 세로(3:4) 분석 프레임 — 가로 영상은 가운데를 잘라 씀(화면 object-fit: cover와 동일)
  const REGIONS = ["arm", "leg", "mouth", "wound", "eye", "face", "other"];
  let stream = null, api = null, root = null, busy = false, msg = null, hrProgress = null, locks = null;
  let mode = "face", roiNorm = null, siteRect = null, drag = null, repeatRes = null, siteSel = "";

  const $ = (s) => root.querySelector(s);
  const T = (...a) => api.T(...a), esc = (s) => api.esc(s);
  const RNAME = { face: ["얼굴", "Face"], eye: ["눈", "Eye"], mouth: ["입 안·입술", "Mouth/lips"], arm: ["손·팔", "Hand/arm"], leg: ["다리", "Leg"], wound: ["상처·화상", "Wound/burn"], other: ["기타", "Other"] };
  const rname = (r) => T(RNAME[r][0], RNAME[r][1]);
  const cam = () => api.S.camera;
  const day = () => api.S.missionDay;
  const newId = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const rt = (r) => (api.reasonTxt ? api.reasonTxt(r) : r);
  const sg = (v) => { const s = (+v).toFixed(1); return +s === 0 ? "0.0" : (+s > 0 ? "+" : "") + s; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const curNorm = () => roiNorm || (cam().ref && cam().ref.roiNorm) || C.defaultNorm();

  /* ───── 스트림 ───── */
  async function start() {
    if (stream) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMsg(T("이 환경에서는 카메라를 쓸 수 없습니다 (HTTPS 필요할 수 있음). 사진 파일로 대체하십시오.", "Camera is not available here (HTTPS may be required). Use a photo file instead."), true); return false; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
      // 자동 노출·화이트밸런스 고정 시도 — 지원 안 되면 그대로 진행
      locks = "none";
      try { const tr = stream.getVideoTracks()[0], cap = tr.getCapabilities ? tr.getCapabilities() : {}; const adv = {};
        if (cap.exposureMode && cap.exposureMode.includes("manual")) adv.exposureMode = "manual";
        if (cap.whiteBalanceMode && cap.whiteBalanceMode.includes("manual")) adv.whiteBalanceMode = "manual";
        if (Object.keys(adv).length) { await tr.applyConstraints({ advanced: [adv] }); locks = Object.keys(adv).join("+"); } } catch (e) { locks = "failed"; }
      const v = $("#camVideo"); v.srcObject = stream; await v.play().catch(() => {});
      drawOverlay(); setMsg(T("타원 안에 얼굴을 맞추십시오. 얼굴 인식 모델 없이 지정한 영역을 측정합니다.", "Fit your face inside the oval. The regions you set are measured — no face-detection model."));
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
    const x = cv.getContext("2d"), e = C.guide(W, H);
    x.clearRect(0, 0, W, H);
    x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 2; x.setLineDash([8, 6]);
    x.beginPath(); x.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, Math.PI * 2); x.stroke();
    x.setLineDash([]); x.font = "13px monospace";
    if (mode === "face") {
      const rects = C.roiRects(W, H, curNorm());
      for (const k in rects) { const r = rects[k]; x.strokeStyle = x.fillStyle = drag && drag.k === k ? "rgba(255,220,120,.95)" : "rgba(214,140,255,.95)"; x.strokeRect(r.x, r.y, r.w, r.h); x.fillText(k, r.x + 2, r.y - 4); }
    } else if (siteRect) {
      const r = C.roiRects(W, H, { s: siteRect }).s; x.strokeStyle = x.fillStyle = "rgba(120,220,255,.95)"; x.strokeRect(r.x, r.y, r.w, r.h); x.fillText(T("측정 영역", "region"), r.x + 2, r.y - 4);
    }
  }

  /* ───── 프레임 ───── */
  function drawCover(x, src, w, h) {
    const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
    const s = Math.max(w / sw, h / sh), dw = sw * s, dh = sh * s;
    x.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  function frameFromSource(src) {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d", { willReadFrequently: true });
    drawCover(x, src, W, H);
    return { data: x.getImageData(0, 0, W, H).data, canvas: cv };
  }
  function thumb(canvas) {
    const t = document.createElement("canvas"); t.width = 240; t.height = 320;
    t.getContext("2d").drawImage(canvas, 0, 0, 240, 320);
    return t.toDataURL("image/jpeg", 0.72);
  }
  function frameL(src) {
    const cv = document.createElement("canvas"); cv.width = 60; cv.height = 80;
    const x = cv.getContext("2d", { willReadFrequently: true }); drawCover(x, src, 60, 80);
    const d = x.getImageData(15, 20, 30, 40).data; let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    return C.rgbToLab(r / n, gg / n, b / n).L;
  }
  /* 워밍업: 연속 3프레임 L* 변화 < 1.5%가 될 때까지 프레임을 버림(최대 4초) */
  async function warmup() {
    const v = $("#camVideo"), t0 = performance.now(), samples = [];
    while (true) {
      const t = (performance.now() - t0) / 1000;
      samples.push({ t, L: frameL(v) });
      const i = C.stableIndex(samples);
      if (i >= 0) return true;
      if (t > C.GATE.warmMax) return false;
      await sleep(100);
    }
  }
  async function grab(n, gap) {
    const v = $("#camVideo"), frames = [];
    for (let i = 0; i < n; i++) { frames.push(frameFromSource(v)); await sleep(gap || 120); }
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
  const measureAll = (frames, norm) => C.combineFrames(frames.map((f) => C.measureFrame(f.data, W, H, norm)));
  const r2 = (v) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);
  const pack = (rois) => Object.fromEntries(Object.entries(rois).map(([k, r]) => [k, r.valid ? { a: r2(r.a), b: r2(r.b), L: r2(r.L), n: r.n || 0, valid: true, reason: null } : { valid: false, reason: r.reason || "invalid", n: r.n || 0 }]));

  function savePhoto(region, kind, canvas, note) {
    const p = { id: newId(region), region, kind, day: day(), dataUrl: thumb(canvas), note: note || "" };
    if (!api.store.photos.add(p)) setMsg(T("브라우저 저장소에 저장하지 못했습니다(용량·차단). 이 세션에서만 유지됩니다.", "Could not persist to browser storage (quota/blocked). Kept for this session only."), true);
    return p;
  }
  function commit() { api.save(); api.changed(); }

  /* ───── 기준 세션: 3회 촬영 중앙값, ROI별 a* 범위 > 2.0이면 거부 ───── */
  function doReference(sets, source) {
    const norm = curNorm();
    const ms = sets.map((fr) => measureAll(fr, norm));
    let res;
    if (ms.length >= 2) res = C.baselineSession(ms);
    else res = { ok: true, measure: ms[0], ranges: {} };
    if (!res.ok) return setMsg(T("촬영 간 편차가 큽니다 — 조명·자세 확인 후 재촬영 (기준 확정 거부, 값 저장 안 함). 범위", "Captures differ too much — check lighting and pose, then retake (reference not set, nothing saved). Range") + ": " + Object.entries(res.ranges).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", "), true);
    const gt = C.gate(null, res.measure);
    if (!gt.ok) return setMsg(T("기준 촬영 품질 미달", "Reference capture failed quality gate") + ": " + gt.reasons.map(rt).join(", "), true);
    const last = sets[sets.length - 1][sets[sets.length - 1].length - 1];
    const p = savePhoto("face", "baseline", last.canvas);
    cam().ref = { measure: { rois: res.measure.rois, bg: res.measure.bg }, roiNorm: norm, gray: C.gray32(last.data, W, H), photoId: p.id, day: day(), source, captures: sets.length };
    CD.addRecord(cam(), { id: newId("rec"), day: day(), ts: Date.now(), kind: "daily", source, synthetic: false, rois: pack(res.measure.rois), bg: res.measure.bg, gate: { ok: true, reasons: [], warn: gt.warn }, conf: gt.conf, photoId: p.id });
    roiNorm = null; commit();
    setMsg(T(`기준 촬영 완료 (${sets.length}회 촬영 중앙값). 이후 촬영은 같은 자세·조명으로 맞추십시오.`, `Reference set (median of ${sets.length} captures). Match this pose and lighting later.`) + (gt.warn.length ? " · " + gt.warn.map(rt).join(", ") : ""));
  }

  /* ───── 오늘 촬영: ROI별 게이트 + 위치(NCC) + 배경 조명 참조 ───── */
  function doDaily(frames, source) {
    const ref = cam().ref;
    if (!ref) return setMsg(T("먼저 기준을 촬영하십시오.", "Capture a reference first."), true);
    const m = measureAll(frames, ref.roiNorm);
    const last = frames[frames.length - 1];
    const ncc = ref.gray ? C.ncc(ref.gray, C.gray32(last.data, W, H)) : null;
    const gt = C.gate(ref.measure, m, { ncc });
    const p = gt.ok ? savePhoto("face", "daily", last.canvas) : null;
    CD.addRecord(cam(), { id: newId("rec"), day: day(), ts: Date.now(), kind: "daily", source, synthetic: false, rois: pack(m.rois), bg: m.bg, gate: { ok: gt.ok, reasons: gt.reasons, warn: gt.warn, dL: r2(gt.dL), ncc: r2(ncc) }, conf: gt.conf, photoId: p ? p.id : null });
    commit();
    if (!gt.ok) {
      const pct = gt.dL !== null ? ` (${(gt.dL * 100).toFixed(0)}%, ${T("허용", "allowed")} ±10%)` : "";
      return setMsg(T("재촬영 필요", "Please retake") + ": " + gt.reasons.map((r) => rt(r) + (r === "tooDark" || r === "tooBright" ? pct : "")).join(", ") + (gt.reasons.includes("position") ? " — " + T("기준 사진 반투명 오버레이에 맞추십시오", "align with the semi-transparent reference overlay") : "") + T(" (기록은 '품질 미달'로 저장, 추세·규칙 제외)", " (stored as 'failed', excluded from trend and rules)"), true);
    }
    const d = CD.deltas(cam(), day(), "face");
    const changed = d.rulesOn && d.dBase !== null && d.dBase >= C.GATE.redWatch;
    setMsg((changed ? T("기준 대비 붉기 변화 있음, 확인 필요.", "Redness changed vs baseline — please check.") : T("촬영 저장됨.", "Capture saved.")) + (gt.warn.length ? " · " + gt.warn.map(rt).join(", ") : "") + (gt.conf === "low" ? " · " + T("낮은 신뢰 — 표시만", "low confidence — display only") : ""), changed || gt.conf === "low");
  }

  /* ───── 재현성 점검: 연속 2회 촬영 ROI별 |Δa*| ───── */
  async function doRepeat() {
    const ref = cam().ref; if (!ref) return setMsg(T("먼저 기준을 촬영하십시오.", "Capture a reference first."), true);
    const a = measureAll(await grab(3), ref.roiNorm);
    setMsg(T("두 번째 촬영 중… 같은 자세 유지", "Second capture… hold the same pose"));
    await sleep(800);
    const b = measureAll(await grab(3), ref.roiNorm);
    repeatRes = CD.repeatability({ rois: a.rois }, { rois: b.rois }, C.GATE.repeat);
    setMsg(repeatRes.warn ? T("잡음이 커서 +3 기준이 의미 없을 수 있음 (어느 영역 차이 > 1.5)", "Noise is large — the +3 threshold may be meaningless (a region differs by > 1.5)") : T("연속 2회 차이 ≤ 1.5 — 이 조건의 잡음 바닥", "Two captures differ ≤ 1.5 — noise floor under these conditions"), repeatRes.warn);
  }

  /* ───── 30초 심박·호흡 (보조) — 실측 타임스탬프·움직임 기록 ───── */
  async function doHr() {
    if (!(await start())) return;
    busy = true; hrProgress = 0; render();
    const v = $("#camVideo");
    await v.play().catch(() => {});
    if (v.scrollIntoView) v.scrollIntoView({ block: "center" });
    setMsg(T("30초 측정 중 — 화면을 스크롤하지 말고 움직이지 마십시오 (화면 밖이면 프레임이 줄어 결과를 낼 수 없습니다).", "Measuring for 30 s — keep still and do not scroll (off-screen video drops frames and gives no result)."));
    const cv = document.createElement("canvas"); cv.width = 120; cv.height = 160;
    const x = cv.getContext("2d", { willReadFrequently: true });
    const rects = C.roiRects(120, 160, curNorm()), face = ["forehead", "cheekL", "cheekR"];
    const s = { t: [], g: [], L: [], m: [] }, t0 = performance.now(), DUR = 30000;
    let prev = null;
    await new Promise((resolve) => {
      let lastMt = -1;
      const step = (now, meta) => {
        const el = performance.now() - t0;
        const mt = meta && meta.mediaTime !== undefined ? meta.mediaTime : null;
        if (mt === null || mt !== lastMt) {
          lastMt = mt;
          drawCover(x, v, 120, 160);
          const d = x.getImageData(0, 0, 120, 160).data;
          let gg = 0, r = 0, b = 0, n = 0;
          for (const k of face) { const rc = rects[k]; for (let yy = rc.y; yy < rc.y + rc.h; yy++) for (let xx = rc.x; xx < rc.x + rc.w; xx++) { const i = (yy * 120 + xx) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
          const gray = []; for (let i = 0; i < d.length; i += 16) gray.push(d[i + 1]);
          let mm = 0; if (prev) { for (let i = 0; i < gray.length; i++) mm += Math.abs(gray[i] - prev[i]); mm /= gray.length; } prev = gray;
          s.t.push(el / 1000); s.g.push(gg / n); s.L.push(C.rgbToLab(r / n, gg / n, b / n).L); s.m.push(mm);
        }
        hrProgress = Math.min(1, el / DUR); const pb = $("#hrProg"); if (pb) pb.value = hrProgress;
        if (el >= DUR || !stream) return resolve();
        next();
      };
      const next = () => {
        let fired = false;
        const go = (now, meta) => { if (fired) return; fired = true; clearTimeout(to); step(now, meta); };
        const to = setTimeout(go, 100); // 화면 밖이면 프레임 콜백이 멈출 수 있음 → 타이머로 진행(누락은 게이트가 판정)
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(go);
      };
      next();
    });
    stop(); busy = false; hrProgress = null;
    const r = C.vitalsFromSamples(s);
    CD.addRecord(cam(), { id: newId("hr"), day: day(), ts: Date.now(), kind: "hr", source: "camera", synthetic: false, rois: {}, conf: "ok",
      gate: { ok: r.status === "ok", reasons: r.reasons }, hr: r.status === "ok" ? Math.round(r.bpm) : null, resp: r.resp ? Math.round(r.resp) : null, snr: isFinite(r.snr) ? r2(r.snr) : null, frames: s.t.length, fps: r2(r.fps) });
    commit();
    setMsg(r.status === "ok" ? T(`카메라 심박 ${Math.round(r.bpm)} bpm — 보조 참고값, 정확도 미검증.`, `Camera HR ${Math.round(r.bpm)} bpm — auxiliary reference, accuracy unverified.`)
      : T("측정 불가 — 품질 게이트 미통과", "Unavailable — quality gate failed") + ` (${r.reasons.map(rt).join(", ")})`, r.status !== "ok");
  }

  /* ───── 부위 촬영: 부위 ID별 기준(첫 사진)·추세 ───── */
  function ensureSite() {
    const sites = cam().sites;
    if (siteSel && sites[siteSel]) return sites[siteSel];
    const region = $("#siteRegion").value, n = Object.values(sites).filter((x) => x.region === region).length + 1;
    const id = region + "-" + n; sites[id] = { id, region, label: `${rname(region)}-${n}`, created: day() }; siteSel = id;
    return sites[id];
  }
  function doSite(frame, source) {
    if (!siteRect) return setMsg(T("측정할 영역을 지정하십시오 (영상 위에서 끌어 사각형 그리기).", "Set the region to measure (drag a box on the image)."), true);
    const site = ensureSite(), key = "site:" + site.id;
    const m = C.siteMeasure(frame.data, W, H, siteRect);
    const ref = CD.siteRef(cam(), site.id);
    const gt = C.siteGate(ref ? ref.rois.site : null, m);
    const p = savePhoto(site.region, "site", frame.canvas, $("#siteNote").value);
    CD.addRecord(cam(), { id: newId("site"), day: day(), ts: Date.now(), kind: "site", siteId: site.id, source, synthetic: false, rois: pack(m.rois), bg: m.bg, gate: { ok: gt.ok, reasons: gt.reasons }, conf: "ok", photoId: p.id, rect: siteRect });
    commit();
    if (!ref && gt.ok) return setMsg(T(`${site.label}: 첫 사진 — 비교 기준이 됩니다.`, `${site.label}: first photo — it becomes the reference.`));
    if (!gt.ok) return setMsg(T("사진은 저장했지만 붉기 변화는 계산하지 않았습니다", "Photo saved, redness change not computed") + ": " + gt.reasons.map(rt).join(", "), true);
    const d = CD.deltas(cam(), day(), key);
    setMsg(`${site.label}: ${T("기준 사진 대비", "vs reference")} Δa* ${d.dBase === null ? "--" : sg(d.dBase)}${site.region === "mouth" || site.region === "eye" ? " · " + T("기록만, 판정 없음", "log only, no judgement") : ""}`, d.dBase !== null && d.dBase >= C.GATE.redWatch);
  }
  function deleteSitePhoto(photoId) {
    const r = CD.removeRecord(cam(), photoId);
    api.store.photos.remove(photoId);
    commit();
    setMsg(r.refChanged ? (r.newRef ? T(`기준 사진이 삭제되어 남은 가장 오래된 사진(D${r.newRef.day})이 새 기준입니다.`, `Reference deleted — the oldest remaining photo (D${r.newRef.day}) is the new reference.`) : T("기준 사진이 삭제되었고 남은 사진이 없습니다.", "Reference deleted; no photos remain.")) : T("사진을 삭제했습니다. 추세·Δ를 다시 계산했습니다.", "Photo deleted; trend and Δ recomputed."));
  }

  /* 결막(아래 눈꺼풀 안쪽): 사용자가 사진을 눌러 지정 → a* 기록만 (빈혈 판정 아님, 규칙 연결 없음) */
  function conjAt(photo, fx, fy) {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
      const x = cv.getContext("2d"); x.drawImage(img, 0, 0);
      const s = Math.round(img.width * 0.06), r = { x: Math.max(0, Math.round(fx * img.width - s / 2)), y: Math.max(0, Math.round(fy * img.height - s / 2)), w: s, h: s };
      const d = x.getImageData(0, 0, img.width, img.height).data; let R = 0, G = 0, B = 0, n = 0;
      for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) { const i = (yy * img.width + xx) * 4; R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
      const a = C.rgbToLab(R / n, G / n, B / n).a;
      cam().conj = (cam().conj || []).concat([{ day: day(), photoId: photo.id, a: r2(a) }]);
      api.save(); setMsg(T(`결막 영역 a* ${a.toFixed(1)} 기록 — 빈혈 판정 아님 (선별 연구 특이도 72–76% 수준, 오탐 많음)`, `Conjunctival a* ${a.toFixed(1)} logged — not an anaemia judgement (screening studies: specificity ~72–76%, many false positives)`));
    };
    img.src = photo.dataUrl;
  }

  function exportJson() {
    const data = CD.exportData(cam(), day());
    data.exported = new Date().toISOString();
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `ujumin-camera-D${day()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function setMsg(m, bad) { msg = { m, bad: !!bad }; const el = root && $("#camMsg"); if (el) { el.textContent = m; el.className = bad ? "bad" : "ok"; } }

  /* ───── 렌더 ───── */
  function render(r, a) {
    if (r) root = r; if (a) api = a;
    const c = cam();
    if (!c.consent) {
      root.innerHTML = `<div class="panel"><h2>${T("카메라 점검 동의", "Camera check consent")}</h2><ul>
        <li>${T("영상·사진은 이 기기 안에서만 처리하며 네트워크로 보내지 않습니다.", "Video and photos are processed on this device only and never sent over the network.")}</li>
        <li>${T("원본 영상은 저장하지 않습니다. 촬영 직후 카메라를 끕니다.", "Raw video is never stored. The camera is turned off right after each capture.")}</li>
        <li>${T("축소 사진과 수치만 브라우저 저장소에 저장하며, 언제든 전체 삭제할 수 있습니다.", "Only reduced photos and numbers are kept in browser storage; delete them all at any time.")}</li>
        <li>${T("진단하지 않습니다. 기준 대비 변화량과 사진 증거만 보여 줍니다. 카메라 단독으로는 '주의'까지만, 카드를 만들지 않습니다.", "No diagnosis. Shows change vs your baseline and photo evidence only. Camera alone reaches Watch at most and never creates a card.")}</li>
        <li>${T("할 수 없는 것: SANS·심장·신장 등 내부 질환, 졸음·뇌졸중·빈혈·황달 판정. 피부색별 정확도는 검증되지 않았습니다(D0).", "Cannot do: internal conditions (SANS, heart, kidney), drowsiness / stroke / anaemia / jaundice judgement. Accuracy across skin tones is not validated (D0).")}</li></ul>
        <div class="btns"><button class="primary" id="consentYes">${T("동의하고 시작", "Agree and start")}</button><button id="consentNo">${T("동의하지 않음 (카메라 없이 사용)", "Decline (use without camera)")}</button></div></div>`;
      $("#consentYes").onclick = () => { c.consent = true; api.save(); api.changed(); render(); };
      $("#consentNo").onclick = () => { const p = document.createElement("p"); p.className = "muted"; p.textContent = T("카메라 없이도 모든 점검·응급 기능을 쓸 수 있습니다.", "All check-in and emergency features work without the camera."); root.querySelector(".panel").appendChild(p); };
      return;
    }
    const photos = api.store.photos.all(), ph = (id) => photos.find((p) => p.id === id);
    const ref = c.ref, refPhoto = ref && ph(ref.photoId);
    const todayRec = CD.dayRecord(c, day(), "face") || CD.dayRecords(c, day(), "face").pop();
    const curPhoto = todayRec && todayRec.photoId && ph(todayRec.photoId);
    const sites = Object.values(c.sites || {});
    const dis = busy ? "disabled" : "";
    root.innerHTML = `<div class="cam-grid"><div>
      <div class="panel"><h2>${T("카메라", "Camera")} <span class="dim">480×640 · ${T("보조 신호 · D0", "auxiliary · D0")}</span></h2>
        <div class="btns seg"><button id="mFace" class="${mode === "face" ? "on" : ""}">${T("얼굴 정기 점검", "Face routine")}</button><button id="mSite" class="${mode === "site" ? "on" : ""}">${T("부위 촬영", "Site photo")}</button></div>
        <div class="stagebox" id="stage"><video id="camVideo" playsinline muted></video>${mode === "face" && refPhoto ? `<img class="ghost" src="${refPhoto.dataUrl}" alt="">` : ""}<canvas id="camOv" class="ov"></canvas>${stream ? "" : `<div class="empty camoff">${T("카메라 꺼짐 — 켜거나 사진 파일을 고르십시오", "Camera off — turn it on or choose a photo file")}</div>`}</div>
        <p class="dim" style="font-size:11.5px;margin:4px 0 0">${mode === "face" ? (ref ? T("반투명 = 기준 사진. 같은 자세로 맞추십시오. 영역 박스는 기준 촬영 전에 끌어서 조정합니다.", "Translucent = reference photo; match the pose. Region boxes are dragged before the reference capture.") : T("영역 박스(이마·뺨·눈·입술)를 끌어 얼굴에 맞춘 뒤 기준을 촬영하십시오.", "Drag the region boxes (forehead, cheeks, eye, lips) onto the face, then capture the reference.")) : T("영상 위에서 끌어 측정할 사각형을 그리십시오.", "Drag on the image to draw the box to measure.")}${locks ? ` · ${T("노출·WB 고정", "exposure/WB lock")}: ${esc(locks)}` : ""}</p>
        <div class="btns" style="margin-top:6px"><button id="camOn" ${dis}>${T("카메라 켜기", "Camera on")}</button><button id="camOff">${T("끄기", "Off")}</button>
          <label class="muted" style="font-size:12px;align-self:center">${T("또는 사진 파일", "or photo file")}: <input type="file" accept="image/*" id="camFile" aria-label="photo file"></label></div>
        <p id="camMsg" class="${msg && msg.bad ? "bad" : "ok"}" role="status" style="min-height:1.4em;margin:8px 0 0">${esc(msg ? msg.m : "")}</p>
        ${mode === "face" ? `
        <div class="btns"><button id="capBase" ${dis}>${ref ? T("기준 다시 촬영 (3회)", "Retake reference (3×)") : T("기준 촬영 (3회 중앙값)", "Capture reference (median of 3)")}</button>
          <button id="capDaily" class="primary" ${busy || !ref ? "disabled" : ""}>${T("오늘 촬영·비교", "Capture today & compare")}</button>
          <button id="capRepeat" ${busy || !ref ? "disabled" : ""}>${T("재현성 점검 (연속 2회)", "Repeatability (2 in a row)")}</button>
          <button id="capHr" ${dis}>${T("30초 심박·호흡", "30-s HR & resp")}</button></div>
        <p class="dim" style="font-size:11.5px">${T("파일 사용 시", "With a file")}: <select id="fileFor"><option value="daily">${T("오늘 촬영", "today")}</option><option value="base">${T("기준 (1장 — 3회 검증 생략)", "reference (1 image — 3× check skipped)")}</option></select></p>
        ${hrProgress !== null ? `<progress id="hrProg" max="1" value="${hrProgress}" style="margin-top:6px"></progress>` : ""}
        <p class="dim" style="font-size:11.5px">${T("카메라 심박: 정지 상태 35명(전원 백인) 실험실 연구 1개(D1). 실측 타임스탬프로 프레임 누락 판정, 움직임·대역 가장자리·하모닉 게이트. 호흡수는 기록만.", "Camera HR: one lab study, n=35, all white, at rest (D1). Frame drop judged from measured timestamps; motion, band-edge and harmonic gates. Resp. rate is logged only.")}</p>` : `
        <div class="btns"><select id="siteSel" aria-label="site"><option value="">${T("새 부위 ID", "new site ID")}</option>${sites.map((s) => `<option value="${esc(s.id)}" ${s.id === siteSel ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>
          <select id="siteRegion" aria-label="region">${REGIONS.map((x) => `<option value="${x}">${esc(rname(x))}</option>`).join("")}</select>
          <input type="text" id="siteNote" placeholder="${T("메모 (선택)", "note (optional)")}" style="flex:1;min-width:100px"><button id="capSite" ${dis}>${T("부위 촬영", "Capture site")}</button></div>
        <p class="dim" style="font-size:11.5px">${T("부위 ID마다 첫 사진이 기준입니다(팔-1, 팔-2는 따로). 파일을 고르면 부위 사진으로 처리합니다.", "Each site ID uses its first photo as reference (arm-1 and arm-2 are separate). A chosen file is treated as a site photo.")}</p>`}
      </div>
      <div class="panel"><h2>${T("저장·내보내기", "Storage & export")}</h2>
        <div class="btns"><button id="camExport">${T("수치 JSON 내보내기 (사진 제외)", "Export numbers as JSON (no photos)")}</button><button id="camDelete" class="danger">${T("카메라 데이터 전체 삭제", "Delete all camera data")}</button></div>
        <p class="dim" style="font-size:11.5px">${T("저장 사진", "Stored photos")}: ${photos.length} · ${T("저장 용량", "storage")} ${Math.round(api.store.usage().frac * 100)}% · ${T("네트워크 요청 0건", "0 network requests")}</p></div>
    </div><div>
      ${mode === "face" ? `<div class="panel"><h2>${T("기준 vs 오늘", "Reference vs today")}</h2>
        ${refPhoto && curPhoto ? `<div class="cmp" id="cmp" style="--split:50%"><img src="${refPhoto.dataUrl}" alt="reference"><img class="top" src="${curPhoto.dataUrl}" alt="today"><div class="bar"></div><span class="cap l">${T("기준", "REF")} D${ref.day}</span><span class="cap r">${T("오늘", "TODAY")} D${todayRec.day}</span></div>
          <input type="range" id="split" min="0" max="100" value="50" style="width:100%" aria-label="${T("비교 슬라이더", "comparison slider")}">` : `<p class="muted">${ref ? T("오늘 촬영하면 기준과 나란히 비교합니다.", "Capture today to compare side by side.") : T("먼저 기준을 촬영하십시오.", "Capture a reference first.")}</p>`}
        ${todayRec ? `<div class="scroll"><table><tr><th>ROI</th><th>a*</th><th>b*</th><th>L*</th><th>Δ${T("기준", "base")}</th><th></th></tr>${CD.ROIS.map((k) => { const x = todayRec.rois[k] || {}, d = CD.deltas(c, day(), k); return `<tr><td class="mono">${k}</td>${x.valid ? `<td class="mono">${x.a.toFixed(1)}</td><td class="mono">${x.b.toFixed(1)}</td><td class="mono">${x.L.toFixed(1)}</td>` : `<td colspan="3" class="bad">—(${esc(rt(x.reason))})</td>`}<td class="mono">${d.dBase === null ? "--" : sg(d.dBase)}</td><td>${d.dBase !== null && d.rulesOn && d.dBase >= C.GATE.redWatch ? "* △" : "○"}</td></tr>`; }).join("")}</table></div>
          <p class="dim" style="font-size:11.5px">${T("b*·L*는 기록만 하며 판정하지 않습니다. 주의 임계 Δa* +3은 데모 값(D0). 게이트", "b* and L* are logged only, never judged. Watch threshold Δa* +3 is a demo value (D0). Gate")}: ${todayRec.gate.ok ? T("통과", "passed") : T("미달", "failed") + " — " + esc((todayRec.gate.reasons || []).map(rt).join(", "))}${todayRec.gate.ncc !== undefined && todayRec.gate.ncc !== null ? ` · NCC ${todayRec.gate.ncc}` : ""}</p>` : ""}
        ${repeatRes ? `<h3>${T("재현성 (연속 2회 |Δa*|)", "Repeatability (|Δa*| of 2 captures)")}</h3><p class="mono" style="font-size:12px">${repeatRes.rows.map((x) => `${x.roi} ${x.diff === null ? "--" : x.diff.toFixed(2)}`).join(" · ")}</p><p class="${repeatRes.warn ? "bad" : "dim"}" style="font-size:11.5px">${repeatRes.warn ? T("잡음이 커서 +3 기준이 의미 없을 수 있음", "Noise is large — the +3 threshold may be meaningless") : T("+3은 근거 없는 데모 값입니다. 잡음 바닥을 직접 확인하는 용도입니다.", "+3 is an unsourced demo value; this shows the noise floor directly.")}</p>` : ""}
      </div>` : ""}
      <div class="panel"><h2>${T("부위 사진 이력", "Site photo history")}</h2>
        ${sites.length ? sites.map((st) => { const recs = c.records.filter((x) => x.kind === "site" && x.siteId === st.id).sort((a, b) => a.day - b.day || a.ts - b.ts), refR = CD.siteRef(c, st.id);
          return `<h3>${esc(st.label)}</h3><div class="thumbs">${recs.map((x) => { const p = ph(x.photoId); const v = x.gate.ok && x.rois.site.valid && refR ? r2(x.rois.site.a - refR.rois.site.a) : null;
            return `<div class="thumb">${p ? `<img src="${p.dataUrl}" alt="${esc(st.label)} D${x.day}" ${st.region === "eye" ? `data-conj="${p.id}" style="cursor:crosshair" title="${T("눌러서 결막 영역 지정", "click to set conjunctival ROI")}"` : ""}>` : ""}D${x.day}${x === refR ? " · " + T("기준", "ref") : v !== null ? ` · Δa* ${sg(v)}` : x.gate.ok ? "" : " · " + T("품질 미달", "failed")}${p ? ` <button class="mini" data-delphoto="${p.id}" aria-label="delete">✕</button>` : ""}</div>`; }).join("")}</div>`; }).join("")
          : `<p class="muted">${T("부위 사진 없음.", "No site photos.")}</p>`}
        ${(c.conj || []).length ? `<p class="dim" style="font-size:11.5px">${T("결막 a* 기록 (빈혈 판정 아님)", "Conjunctival a* log (not an anaemia judgement)")}: ${c.conj.map((x) => `D${x.day} ${x.a}`).join(", ")}</p>` : ""}
      </div></div></div>`;
    if (stream) { const v = $("#camVideo"); v.srcObject = stream; v.play().catch(() => {}); }
    drawOverlay();
    bind();
  }

  function bind() {
    $("#mFace").onclick = () => { mode = "face"; render(); };
    $("#mSite").onclick = () => { mode = "site"; render(); };
    $("#camOn").onclick = () => start().then(() => render());
    $("#camOff").onclick = () => { stop(); render(); };
    const run = async (fn) => { if (busy) return; if (!(await start())) return; busy = true; render(); try { if (!(await warmup())) { setMsg(T("카메라 안정화 실패 (4초 안에 밝기가 안정되지 않음) — 조명을 고정하고 다시 시도", "Camera did not stabilise (brightness not steady within 4 s) — fix the lighting and retry"), true); return; } await fn(); } finally { stop(); busy = false; render(); } };
    const bBase = $("#capBase"); if (bBase) bBase.onclick = () => run(async () => { const sets = []; for (let i = 0; i < 3; i++) { sets.push(await grab(3)); await sleep(300); } doReference(sets, "camera"); });
    const bDaily = $("#capDaily"); if (bDaily) bDaily.onclick = () => run(async () => doDaily(await grab(5), "camera"));
    const bRep = $("#capRepeat"); if (bRep) bRep.onclick = () => run(doRepeat);
    const bHr = $("#capHr"); if (bHr) bHr.onclick = () => { if (!busy) doHr().then(() => render()); };
    const bSite = $("#capSite"); if (bSite) bSite.onclick = () => run(async () => doSite((await grab(1))[0], "camera"));
    const ss = $("#siteSel"); if (ss) ss.onchange = () => { siteSel = ss.value; };
    $("#camFile").onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const f = await loadFile(file);
        if (mode === "site") doSite(f, "file");
        else if ($("#fileFor").value === "base") doReference([[f]], "file");
        else doDaily([f], "file");
      } catch (err) { setMsg(T("이미지를 읽지 못했습니다.", "Could not read the image."), true); }
      render();
    };
    $("#camExport").onclick = exportJson;
    $("#camDelete").onclick = () => { if (!confirm(T("사진·기준·카메라 수치를 모두 지웁니다. 체크인 기록은 남습니다.", "Delete all photos, reference and camera numbers? Check-in records are kept."))) return; stop(); api.store.clearCamera(api.S); repeatRes = null; siteSel = ""; setMsg(T("카메라 데이터를 모두 삭제했습니다.", "All camera data deleted.")); api.changed(); render(); };
    const sp = $("#split"); if (sp) sp.oninput = () => $("#cmp").style.setProperty("--split", sp.value + "%");
    root.querySelectorAll("[data-conj]").forEach((img) => img.addEventListener("click", (e) => {
      const r = img.getBoundingClientRect(), p = api.store.photos.all().find((x) => x.id === img.dataset.conj);
      if (p) conjAt(p, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    }));
    root.querySelectorAll("[data-delphoto]").forEach((b) => (b.onclick = () => { if (confirm(T("이 사진을 삭제할까요?", "Delete this photo?"))) { deleteSitePhoto(b.dataset.delphoto); render(); } }));
    // 영역 조정: 얼굴 모드 = ROI 박스 끌기(기준 촬영 전), 부위 모드 = 사각형 그리기
    const ov = $("#camOv");
    const pt = (e) => { const r = ov.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    ov.onpointerdown = (e) => {
      const [x, y] = pt(e);
      if (mode === "site") { drag = { site: true, x0: x, y0: y }; siteRect = [x, y, x, y]; }
      else { const n = curNorm(); const k = Object.keys(n).find((kk) => x >= n[kk][0] && x <= n[kk][2] && y >= n[kk][1] && y <= n[kk][3]); if (!k) return; roiNorm = JSON.parse(JSON.stringify(n)); drag = { k, x, y }; }
      ov.setPointerCapture(e.pointerId); drawOverlay();
    };
    ov.onpointermove = (e) => {
      if (!drag) return; const [x, y] = pt(e);
      if (drag.site) siteRect = [Math.min(drag.x0, x), Math.min(drag.y0, y), Math.max(drag.x0, x), Math.max(drag.y0, y)].map((v) => Math.min(1, Math.max(0, v)));
      else { const r = roiNorm[drag.k], dx = x - drag.x, dy = y - drag.y; const w = r[2] - r[0], h = r[3] - r[1]; const nx = Math.min(1 - w, Math.max(0, r[0] + dx)), ny = Math.min(1 - h, Math.max(0, r[1] + dy)); roiNorm[drag.k] = [nx, ny, nx + w, ny + h]; drag.x = x; drag.y = y; }
      drawOverlay();
    };
    ov.onpointerup = () => { if (drag && drag.site && siteRect && (siteRect[2] - siteRect[0] < 0.02 || siteRect[3] - siteRect[1] < 0.02)) siteRect = null; drag = null; drawOverlay(); };
  }

  UJ.cameraUI = { render, leave() { if (!busy) stop(); }, stop, _test: { setSiteRect: (r) => { siteRect = r; }, setMode: (m) => { mode = m; } } };
})(typeof window !== "undefined" ? window : globalThis);
