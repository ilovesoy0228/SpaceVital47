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
  await page.click('[data-view="camera"]');
  if (await page.$("#consentYes")) await page.click("#consentYes");
  await fn(page);
  await ctx.close();
}
const msg = (p) => p.locator("#camMsg").textContent();
const waitMsg = (p, re, t) => p.waitForFunction((src) => new RegExp(src).test(document.querySelector("#camMsg")?.textContent || ""), re.source, { timeout: t || 15000 });

(async () => {
  await session("base", async (p) => {
    await p.click("#capBase"); await waitMsg(p, /기준 촬영 완료/);
    ok(true, "합성 영상으로 기준 촬영 완료 (file:// + 가짜 카메라에서 getUserMedia 동작)");
    await p.click("#capDaily"); await waitMsg(p, /붉기 변화/);
    const d = await p.evaluate(() => UJ.app.state.camera.daily.at(-1));
    ok(d.gate && Math.abs(d.dFace) < 1, `같은 영상 일상 촬영: 조명 통과, Δa* ≈ 0 (${d.dFace})`);
    ok(await p.evaluate(() => !document.querySelector("#camVideo").srcObject), "촬영 직후 스트림 정지");
  });
  await session("red", async (p) => {
    await p.click("#capDaily"); await waitMsg(p, /붉기 변화 있음/);
    const d = await p.evaluate(() => UJ.app.state.camera.daily.at(-1));
    ok(d.dFace > 3, `붉기만 올린 영상: Δa* > 0 이고 주의 임계 이상 (${d.dFace})`);
    const tile = await p.evaluate(() => UJ.app.ev.tiles.camFace && UJ.app.ev.tiles.camFace.level);
    ok(tile === 1, "카메라 타일 = 주의(1)");
    ok(await p.evaluate(() => UJ.app.ev.overall < 3 && !UJ.app.ev.cards.length), "카메라 단독으로 긴급 없음");
    await p.screenshot({ path: path.join(OUT, "camera-red.png"), fullPage: false });
  });
  await session("dark", async (p) => {
    await p.click("#capDaily"); await waitMsg(p, /조명이 다릅니다/);
    ok(true, "조명이 다른 영상: 재촬영 안내 — " + (await msg(p)));
  });
  await session("pulse", async (p) => {
    await p.click("#capHr"); await waitMsg(p, /카메라 심박|측정 불가/, 60000);
    const d = await p.evaluate(() => UJ.app.state.camera.daily.at(-1));
    ok(d.hrStatus === "ok" && Math.abs(d.hr - 72) <= 3, `1.2 Hz 변조 영상: ${d.hr} bpm (72±3), SNR ${d.hrSnr}, frames ${d.frames}`);
  });
  await session("still", async (p) => {
    await p.click("#capHr"); await waitMsg(p, /카메라 심박|측정 불가/, 60000);
    const d = await p.evaluate(() => UJ.app.state.camera.daily.at(-1));
    ok(d.hrStatus === "unavailable", `변조 없는 영상: 측정 불가 (${(d.hrReasons || []).join(",")}, SNR ${d.hrSnr})`);
    p.on("dialog", (dl) => dl.accept());
    await p.click("#camDelete"); await waitMsg(p, /삭제/);
    const left = await p.evaluate(() => ({ photos: localStorage.getItem("ujumin.photos.v1"), cam: JSON.parse(localStorage.getItem("ujumin.v1")).camera }));
    ok(!left.photos && !left.cam.baseline && !left.cam.daily.length, "전체 삭제 후 저장소에 사진·기준·수치 없음");
  });
  ok(net.length === 0, "네트워크 요청 0건" + (net.length ? ": " + net.join(", ") : ""));
  ok(errors.length === 0, "콘솔 오류 0" + (errors.length ? ": " + errors.join(" | ") : ""));
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
  process.exit(fails ? 1 : 0);
})();
