// 카메라 합격 기준(CLAUDE.md §7.7) — Chrome 가짜 카메라 + 합성 영상. 실행: node tests/make-videos.js && node tests/e2e-camera.js
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const OUT = path.join(__dirname, "out");
const VID = path.join(OUT, "videos");
const PROFILE = path.join(OUT, "profile");
const URL_ = process.env.UJ_URL || "file://" + path.resolve(__dirname, "..", "index.html");
fs.rmSync(PROFILE, { recursive: true, force: true });

let fails = 0;
const ok = (c, m) => { console.log((c ? "✔ " : "✖ ") + m); if (!c) fails++; };
const net = [], errors = [];

async function session(video, fn) {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: "chrome", headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 },
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${path.join(VID, video + ".y4m")}`],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  page.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL_);
  await page.evaluate(() => document.querySelector("#camSection").scrollIntoView()); // 같은 화면 오른쪽 카메라 패널
  if (await page.$("#consentYes")) await page.click("#consentYes");
  await fn(page);
  await ctx.close();
}
const msg = (p) => p.locator("#camMsg").textContent();
const waitMsg = (p, re, t) => p.waitForFunction((src) => new RegExp(src).test(document.querySelector("#camMsg")?.textContent || ""), re.source, { timeout: t || 15000 });

const closeDay = (p) => p.click("#dClose").then(() => p.waitForTimeout(200));
const last = (p, kind) => p.evaluate((k) => UJ.app.state.camera.records.filter((r) => r.kind === k).sort((a, b) => a.ts - b.ts).at(-1), kind);
const waitIdle = (p, re, t) => p.waitForFunction((src) => { const b = document.querySelector("#capDaily"); return new RegExp(src).test(document.querySelector("#camMsg")?.textContent || "") && (!b || !b.disabled); }, re.source, { timeout: t || 30000 });

(async () => {
  await session("base", async (p) => {
    await p.click("#capBase"); await waitIdle(p, /기준 촬영 완료/);
    ok(true, "합성 영상으로 기준 3회 촬영 완료 (file:// + 가짜 카메라, 워밍업 통과)");
    ok(await p.evaluate(() => !document.querySelector("#camVideo").srcObject), "촬영 직후 스트림 정지");
    await closeDay(p);                                   // D31
    await p.click("#capDaily"); await waitIdle(p, /촬영 저장됨|붉기|재촬영/);
    const r = await last(p, "daily");
    const d = await p.evaluate(() => UJ.camdata.deltas(UJ.app.state.camera, UJ.app.state.missionDay, "face"));
    ok(r.gate.ok && Math.abs(d.dBase) < 1 && r.gate.ncc > 0.9, `같은 영상 D31: 게이트 통과, Δa* ≈ 0 (${d.dBase}), NCC ${r.gate.ncc}`);
    ok(d.n === 2 && !d.rulesOn, "실제 촬영 기준 n=2 — 규칙은 3일부터 (합성 기록과 섞지 않음)");
    await closeDay(p);                                   // D32
  });
  await session("red", async (p) => {
    await p.click("#capDaily"); await waitIdle(p, /붉기 변화 있음|촬영 저장됨|재촬영/);
    const d = await p.evaluate(() => UJ.camdata.deltas(UJ.app.state.camera, UJ.app.state.missionDay, "face"));
    ok(d.dBase > 3, `붉기만 올린 영상 D32: Δa* ${d.dBase} > +3 (n=${d.n})`);
    ok(await p.evaluate(() => UJ.app.ev.tiles.camFace && UJ.app.ev.tiles.camFace.level === 1), "얼굴 종합 타일 = 주의(1)");
    ok(await p.evaluate(() => UJ.app.ev.overall < 3 && !UJ.app.ev.cards.length), "카메라 단독으로 긴급·카드 없음");
    await p.screenshot({ path: path.join(OUT, "camera-red.png"), fullPage: false });
  });
  await session("dark", async (p) => {
    await p.click("#capDaily"); await waitIdle(p, /재촬영 필요/);
    const r = await last(p, "daily");
    ok(!r.gate.ok && r.gate.reasons.includes("tooDark"), "조명이 다른 영상: 재촬영 안내, '품질 미달' 기록 — " + (await msg(p)));
  });
  await session("pulse", async (p) => {
    await p.click("#capHr"); await waitMsg(p, /카메라 심박|측정 불가/, 60000);
    const r = await last(p, "hr");
    ok(r.gate.ok && Math.abs(r.hr - 72) <= 3, `1.2 Hz 변조 영상: ${r.hr} bpm (72±3), SNR ${r.snr}, frames ${r.frames}, 실측 fps ${r.fps}`);
  });
  await session("still", async (p) => {
    await p.click("#capHr"); await waitMsg(p, /카메라 심박|측정 불가/, 60000);
    const r = await last(p, "hr");
    ok(!r.gate.ok, `변조 없는 영상: 측정 불가 (${(r.gate.reasons || []).join(",")}, SNR ${r.snr})`);
    p.on("dialog", (dl) => dl.accept());
    await p.click("#camDelete"); await waitMsg(p, /삭제/);
    const left = await p.evaluate(() => ({ photos: localStorage.getItem("ujumin.photos.v2"), cam: JSON.parse(localStorage.getItem("ujumin.v2")).camera, days: Object.keys(JSON.parse(localStorage.getItem("ujumin.v2")).days).length }));
    ok(!left.photos && !left.cam.ref && !left.cam.records.length && left.days > 30, "전체 삭제 후 사진·기준·카메라 수치 없음, 체크인 기록 유지");
  });
  ok(net.length === 0, "네트워크 요청 0건" + (net.length ? ": " + net.join(", ") : ""));
  ok(errors.length === 0, "콘솔 오류 0" + (errors.length ? ": " + errors.join(" | ") : ""));
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
  process.exit(fails ? 1 : 0);
})();
