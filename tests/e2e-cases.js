// UI 케이스 e2e — Chrome + 가짜 카메라(합성 y4m, 사람 아님). CSP를 끄지 않고 실행(bypassCSP 없음).
// 결과: tests/out/e2e-cases.json (cases.test.js가 읽음) + 스크린샷 tests/out/cases-*.png
// 실행: node tests/make-videos.js && node tests/e2e-cases.js
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const OUT = path.join(__dirname, "out");
const PROFILE = path.join(OUT, "profile-cases");
const URL_ = process.env.UJ_URL || "file://" + path.resolve(__dirname, "..", "index.html");
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const res = {}, extra = [];
const mark = (id, ok, info) => { res[id] = { ok: !!ok, info: info || "" }; console.log(`${ok ? "✔" : "✖"} ${id} ${info || ""}`); };
const check = (name, ok, info) => { extra.push([name, !!ok]); console.log(`${ok ? "✔" : "✖"} ${name} ${info || ""}`); };
const net = [], errors = [];

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: "chrome", headless: true, viewport: { width: 1280, height: 1000 },
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${path.join(OUT, "videos", "base.y4m")}`],
  });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI)); });
  const p = ctx.pages()[0] || (await ctx.newPage());
  p.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  p.on("dialog", (d) => d.accept());
  const poll = async (fn, arg, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 20000)) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); } return false; };
  const care = async () => { await p.click('[data-view="care"]'); await p.waitForTimeout(80); };
  await p.goto(URL_);
  // 기본 언어는 영어 — 이 테스트의 문구 검사는 한국어 화면 기준
  await p.evaluate(() => { if (UJ.app.state.lang !== "ko") document.querySelector("#langBtn").click(); });
  await p.waitForTimeout(300);

  /* C006 — 데모 D30: 모든 체크인 행에 추세·어제·기준선·Δ */
  const rowInfo = () => Array.from(document.querySelectorAll("#monitor .vrow, #camgroup .vrow")).map((r) => ({
    id: r.id, trend: !!r.querySelector("svg polyline, svg circle"), val: (r.querySelector(".val") || {}).textContent || "",
    deltas: Array.from(r.querySelectorAll(".delta b")).map((b) => b.textContent.trim()), text: r.textContent }));
  {
    const rows = (await p.evaluate(rowInfo)).filter((r) => ["row-hr", "row-temp", "row-sleep", "row-stress", "row-intake", "row-ex", "row-co2"].includes(r.id));
    const bad = rows.filter((r) => !r.trend || /--|미입력/.test(r.val) || r.deltas.length < 2 || r.deltas.some((d) => d === "--") || !/BASE/.test(r.text) || !/어제/.test(r.text));
    mark("C006", rows.length === 7 && !bad.length, `rows ${rows.length}, bad ${bad.map((b) => b.id).join(",")}`);
  }

  /* C086 — 프리셋 11개: 모든 행 데이터·추세·Δ, 카메라 합성 표시. 정상 프리셋 카메라 Δ≈0 */
  {
    const fails = [];
    let normalFace = null;
    for (let i = 0; i < 11; i++) {
      await care();
      await p.click(`[data-preset="${i}"]`);
      await p.waitForTimeout(120);
      await care();
      const rows = await p.evaluate(rowInfo);
      for (const r of rows) {
        const isBp = r.id === "row-bp", isRad = r.id === "row-rad";
        const hasVal = !/^\s*--\s*$/.test(r.val) && r.val.trim() !== "";
        const hasTrend = isBp ? true : r.trend;
        const hasDelta = isBp || isRad || (r.deltas.length >= 2 && r.deltas[1] !== "--");
        if (!hasVal || !hasTrend || !hasDelta) fails.push(`P${i}:${r.id}`);
      }
      if (i === 0) normalFace = await p.evaluate(() => UJ.camdata.deltas(UJ.app.state.camera, UJ.app.state.missionDay, "face").dBase);
      if (rows.length < 17) fails.push(`P${i}:rows=${rows.length}`);
    }
    mark("C086", !fails.length && Math.abs(normalFace) < 0.5, `fails ${fails.slice(0, 6).join(" ")} · 정상 face Δ ${normalFace}`);
  }
  await care(); await p.click('[data-preset="0"]'); await care();

  /* C095 — 영어 전환: 케어 화면·카메라 패널에 한글 없음(브랜드 h1 제외) */
  {
    await p.click("#langBtn"); await p.waitForTimeout(150);
    await p.click("#consentYes").catch(() => {});
    await p.waitForTimeout(100);
    const han = await p.evaluate(() => { const t = [document.querySelector("#view-care").innerText, document.querySelector("#daynav").innerText, document.querySelector("#alarm").innerText, document.querySelector("#tabs").innerText].join("\n"); return (t.match(/[^\n]*[가-힣][^\n]*/g) || []).slice(0, 5); });
    mark("C095", !han.length, han.length ? "한글 남음: " + han.join(" | ") : "EN 화면에 한글 없음 (케어·카메라·알람·탭)");
    await p.click("#langBtn"); await p.waitForTimeout(150);
  }

  /* (a) 촬영 → 추세 점 생성 (가짜 카메라 base.y4m: 기준 3회 → 오늘 촬영) */
  {
    await care();
    if (await p.$("#consentYes")) await p.click("#consentYes");
    await p.click("#capBase");
    const okBase = await poll(() => /기준 촬영 완료|Reference set/.test(document.querySelector("#camMsg").textContent), null, 30000);
    check("(a) 가짜 카메라 기준 3회 촬영", okBase, await p.locator("#camMsg").textContent());
    await p.click("#capDaily");
    await poll(() => !document.querySelector("#capDaily").disabled && /저장|saved|재촬영|retake|붉기|Redness/.test(document.querySelector("#camMsg").textContent), null, 30000);
    const st = await p.evaluate(() => { const s = UJ.app.state, c = UJ.camdata; const d = c.deltas(s.camera, s.missionDay, "face"); const rec = c.dayRecord(s.camera, s.missionDay, "face"); return { msg: document.querySelector("#camMsg").textContent, synthetic: d.synthetic, source: rec && rec.source, series: c.series(s.camera, s.missionDay, "face").at(-1), dBase: d.dBase, rowSynth: /합성/.test(document.querySelector("#row-cam-face").textContent) }; });
    check("(a) 오늘 실제 촬영 → 오늘 추세 점 생성, 합성 기록 대체(C090)", st.source === "camera" && !st.synthetic && st.series !== null && !st.rowSynth, JSON.stringify(st));
    await p.screenshot({ path: path.join(OUT, "cases-camera.png") });
  }

  /* (b) 임무일 이동 → Δ어제 표시, 하루 마감 */
  {
    await p.click("#dPrev"); await p.waitForTimeout(150);
    const prev = await p.evaluate(() => ({ label: document.querySelector("#dLabel").textContent, dy: document.querySelector("#row-hr .delta b").textContent, input: document.querySelector("#in-hr").value }));
    check("(b) ◀ D29 이동 → 그날 값·Δ어제 표시", /D29/.test(prev.label) && prev.dy !== "--" && prev.input !== "", JSON.stringify(prev));
    await p.click("#dNext"); await p.waitForTimeout(150);
    await p.click("#dClose"); await p.waitForTimeout(200);
    const nd = await p.evaluate(() => ({ label: document.querySelector("#dLabel").textContent, input: document.querySelector("#in-hr").value, val: document.querySelector("#row-hr .val").textContent, dy: document.querySelector("#row-hr .delta b").textContent, committed: UJ.app.state.days[30].committed }));
    check("(b) 하루 마감 → D31, 입력 미입력, D30 확정", /D31/.test(nd.label) && nd.input === "" && /미입력/.test(nd.val) && nd.committed, JSON.stringify(nd));
    await p.fill("#in-hr", "70"); await p.waitForTimeout(150);
    const dy = await p.evaluate(() => document.querySelector("#row-hr .delta b").textContent);
    check("(b) D31 입력 → Δ어제(D30 대비) 표시", dy !== "--", dy);
  }

  /* C099 — 90일치 렌더 < 300 ms */
  {
    const perf = await p.evaluate(() => {
      const s = UJ.app.state; s.days = UJ.store.synthDays(90); s.curDay = 90;
      s.camera.records = UJ.camdata.seed(90); UJ.camdata.recomputeSuperseded(s.camera);
      const t0 = performance.now(); UJ.app.goDay(90); const t1 = performance.now(); // 입력 패널 재생성 + 전체 렌더
      UJ.app.refresh(); const t2 = performance.now();
      const labels = Array.from(document.querySelectorAll("#row-hr svg text")).map((t) => t.textContent);
      return { first: Math.round(t1 - t0), second: Math.round(t2 - t1), labels };
    });
    mark("C099", perf.first < 300 && perf.labels.some((l) => /D90/.test(l)) && perf.labels.includes("D1"), `first ${perf.first} ms, second ${perf.second} ms, labels ${perf.labels.filter((l) => /^D|오늘/.test(l)).join(",")}`);
  }

  /* C096 — 390px: 가로 넘침 없음, 체크인이 첫 화면 */
  {
    await p.setViewportSize({ width: 390, height: 844 });
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(250);
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, top: document.querySelector("#checkinTop").getBoundingClientRect().top, firstInput: document.querySelector("#in-hr").getBoundingClientRect().top }));
    await p.screenshot({ path: path.join(OUT, "cases-390.png") });
    await p.screenshot({ path: path.join(OUT, "cases-390-full.png"), fullPage: true });
    mark("C096", m.sw <= 390 && m.firstInput < 844, JSON.stringify(m));
    await p.setViewportSize({ width: 1280, height: 1000 });
  }

  /* C013 / C014 — 새로 시작(D1): 동의 전 '카메라 미사용' 한 줄, 동의 후 '카메라 미측정' 한 줄 */
  {
    await care();
    await p.evaluate(() => { UJ.app.state.camera.consent = false; });
    await p.click("#mFresh"); await p.waitForTimeout(250);
    const a = await p.evaluate(() => ({ t: document.querySelector("#camgroup").innerText, rows: document.querySelectorAll("#camgroup .vrow").length, label: document.querySelector("#dLabel").textContent }));
    mark("C013", /카메라 미사용/.test(a.t) && a.rows === 0 && /D1/.test(a.label), JSON.stringify(a));
    await p.click("#consentYes"); await p.waitForTimeout(200);
    const b = await p.evaluate(() => ({ t: document.querySelector("#camgroup").innerText, rows: document.querySelectorAll("#camgroup .vrow").length }));
    mark("C014", /카메라 미측정/.test(b.t) && b.rows === 0, JSON.stringify(b));
    const c1 = await p.evaluate(() => ({ base: document.querySelector("#row-hr .lim").textContent, d: Array.from(document.querySelectorAll("#row-hr .delta b")).map((x) => x.textContent) }));
    check("새로 시작 D1: 기준선 0/14, Δ --", /0\/14/.test(c1.base) && c1.d.every((x) => x === "--"), JSON.stringify(c1));
  }

  const csp = await p.evaluate(() => window.__csp);
  mark("C097", net.length === 0 && csp.length === 0, `network ${net.length}, CSP violations ${csp.length}${net.length ? " " + net.join(",") : ""}${csp.length ? " " + csp.join(",") : ""}`);
  check("콘솔 오류 0", errors.length === 0, errors.join(" | "));
  await ctx.close();
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.writeFileSync(path.join(OUT, "e2e-cases.json"), JSON.stringify(res, null, 1));
  const fails = Object.values(res).filter((r) => !r.ok).length + extra.filter((x) => !x[1]).length;
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
  process.exit(fails ? 1 : 0);
})();
