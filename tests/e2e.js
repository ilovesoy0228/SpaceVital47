// E2E 스모크: file:// 로 열기, 콘솔 오류 0, 외부 네트워크 요청 0, 시나리오·자동 전환·보고서·언어·390px 가로 스크롤.
// 실행: npm run test:e2e  (설치된 Chrome 사용)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const URL_ = process.env.UJ_URL || "file://" + path.resolve(__dirname, "..", "index.html");

let fails = 0;
const ok = (c, m) => { console.log((c ? "✔ " : "✖ ") + m); if (!c) fails++; };

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], net = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) net.push(r.url()); });
  await page.goto(URL_);
  // 기본 언어는 영어 — 이 테스트의 문구 검사는 한국어 화면 기준
  ok((await page.evaluate(() => UJ.app.state.lang + "/" + document.documentElement.lang)) === "en/en", "첫 화면 기본 언어 = 영어");
  await page.evaluate(() => { if (UJ.app.state.lang !== "ko") document.querySelector("#langBtn").click(); });
  await page.waitForSelector("#row-hr .val");

  ok((await page.locator("#alarm").getAttribute("class")).includes("s0"), "정상일: 알람 s0");
  await page.screenshot({ path: path.join(OUT, "care-normal.png"), fullPage: true });

  // 수면 부족 + 스트레스 → 조치
  await page.click('[data-preset="1"]');
  ok((await page.locator("#alarm").getAttribute("class")).includes("s2"), "수면 부족+스트레스: 알람 s2(조치)");
  ok((await page.locator("#row-sleep .stage").textContent()).includes("**"), "수면 행에 ** 표식");

  // 입력 변경 즉시 갱신
  await page.fill("#in-hr", "90");
  ok((await page.locator("#row-hr .val").textContent()).trim() === "90", "입력 변경 즉시 모니터 갱신");

  // R2 → 자동 전환
  await page.click('[data-preset="3"]');
  ok(!(await page.locator("#view-respond").getAttribute("class") || "").includes("hide"), "R2: 응급 화면 자동 전환");
  const rep = await page.locator("#report").inputValue();
  ok(rep.startsWith("[SIMULATED DATA - PROTOTYPE - NOT FOR CLINICAL USE]") && rep.includes("R2"), "영문 보고서 헤더·카드");
  await page.check("#st0");
  await page.click("#copyBtn").catch(() => {});
  ok((await page.locator("#report").inputValue()).includes("[x] Re-measure"), "체크한 단계가 보고서에 반영");
  await page.screenshot({ path: path.join(OUT, "respond-R2.png"), fullPage: true });

  // 종료 → 재전환 없음
  await page.click("#standDown");
  await page.fill("#in-hr", "91");
  ok((await page.locator("#view-respond").getAttribute("class")).includes("hide"), "확인 후 같은 조건으로 재전환 없음");

  // 수동 시작 R11
  await page.click('[data-view="respond"]');
  await page.click('[data-manual="R11"]');
  ok((await page.locator(".resp-head").textContent()).includes("R11"), "R11 수동 시작");
  await page.click("#standDown");

  // 언어 전환
  await page.click("#langBtn");
  ok((await page.locator('[data-view="care"]').textContent()).includes("Monitor"), "영문 전환");
  ok(!(await page.$('[data-view="evidence"]')) && (await page.locator('#footer a[href="sources/nasa/index.html"], #footer a[href="sources/other/index.html"]').count()) === 2, "근거 탭 없음, 하단에 출처 링크 2개");
  await page.click("#langBtn");

  // 모바일 390px
  await page.click('[data-view="care"]');
  await page.click('[data-preset="0"]');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, `390px 가로 스크롤 없음 (scrollWidth ${sw})`);
  await page.screenshot({ path: path.join(OUT, "mobile-390.png"), fullPage: false });
  ok(!(await page.$('[data-view="camera"]')) && (await page.locator("#view-care #camSection #consentYes, #view-care #camSection #camVideo").count()) > 0, "카메라가 모니터·점검 화면 안에 있음 (별도 탭 없음)");
  for (const v of ["respond"]) {
    await page.click(`[data-view="${v}"]`); await page.waitForTimeout(150);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(w <= 390, `390px ${v} 가로 스크롤 없음 (${w})`);
  }

  ok(errors.length === 0, "콘솔 오류 0" + (errors.length ? ": " + errors.join(" | ") : ""));
  ok(net.length === 0, "외부 네트워크 요청 0" + (net.length ? ": " + net.join(", ") : ""));
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
  process.exit(fails ? 1 : 0);
})();
