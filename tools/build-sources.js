/* SpaceVital47 — source collection page generator.
 * Splits the read SOURCES in data.js into NASA / other: sources-nasa.html, sources-other.html.
 * Run: npm run sources  (re-run after editing sources in data.js) */
"use strict";
const fs = require("fs");
const path = require("path");
require("../data.js");
const U = globalThis.UJ;
const ROOT = path.join(__dirname, "..");

// Not app references (submission guide, material for a feature not adopted).
const SKIP = new Set(["submitGuide", "sensors2021"]);

const GROUPS = {
  nasa: [
    { name: "Medical Standards & Mission Operations", ids: ["appE", "ntrsEmerg"] },
    { name: "Human Research Program (HRP)", ids: ["hrpHazards", "hrpRisks", "hrpResearch"] },
    { name: "Human System Risks", ids: ["rFitness", "rImmune", "rCardio", "rNutrition", "rBone", "rSans", "rSleep", "rBehavior", "rRadCancer", "rHypoxia", "rHostMicro"] },
  ],
  other: [
    { name: "Agency & Institutional Reports", ids: ["noaa", "napShuttle"] },
    { name: "Spaceflight Medicine Literature", ids: ["crucian2016", "eyeNpj2023", "meer2023", "skinCommMed2024"] },
    { name: "Camera-Based & Non-Invasive Measurement", ids: ["rppgHr2025", "rppgResp2022", "suner2021", "niada2025"] },
    { name: "Press Releases", ids: ["anemiaEureka"] },
  ],
};

// Usage for sources not linked in the data (by app feature)
const MANUAL_USE = { rppgHr2025: "Camera heart rate measurement" };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function usage(id) {
  const rules = U.RULES.filter((r) => r.sources.includes(id));
  const cards = U.CARDS.filter((c) => c.sources.includes(id));
  const conds = U.CONDITIONS.filter((c) => c.sources.includes(id));
  const out = [];
  if (conds.length === U.CONDITIONS.length) out.push(`Full condition list (${conds.length})`);
  else if (conds.length) out.push("Conditions: " + conds.slice(0, 4).map((c) => c.en).join(", ") + (conds.length > 4 ? ` +${conds.length - 4} more` : ""));
  if (cards.length) out.push("Emergency cards: " + (cards.length > 4 ? `${cards.length}` : cards.map((c) => c.en).join(", ")));
  if (rules.length) out.push(`Alert rules: ${rules.length}`);
  if (MANUAL_USE[id]) out.push(MANUAL_USE[id]);
  return out.length ? out.join(" · ") : "Background reference";
}

function page(kind) {
  const isNasa = kind === "nasa";
  const byId = Object.fromEntries(U.SOURCES.map((s) => [s.id, s]));
  const groups = GROUPS[kind].map((g) => ({ ...g, items: g.ids.map((id) => byId[id]).filter((s) => s && s.status === "read" && !SKIP.has(s.id)) }));
  const all = groups.flatMap((g) => g.items);
  const plain = all.map((s, i) => `${i + 1}. ${s.title}${s.url ? ". " + s.url : ""}`).join("\n");
  let n = 0;
  const body = groups.filter((g) => g.items.length).map((g) => `
    <section>
      <h2>${esc(g.name)} <span class="count">${g.items.length}</span></h2>
      <ol start="${n + 1}">${g.items.map((s) => { n++; return `
        <li data-cite="${esc(s.title + (s.url ? ". " + s.url : ""))}">
          <div class="t"><span class="n">${n}.</span>${esc(s.title)}</div>
          ${s.url ? `<a class="u" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a>` : `<span class="u none">No online URL</span>`}
          <div class="use">${esc(usage(s.id))}</div>
          <button class="copy" type="button">Copy</button>
        </li>`; }).join("")}
      </ol>
    </section>`).join("");

  const title = isNasa ? "NASA Sources" : "Other Sources";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SpaceVital47 — ${title}</title>
<style>
:root { --bg: #05070a; --panel: #0b0f14; --panel2: #111821; --line: #1f2a36; --text: #e6edf3; --muted: #93a1af; --dim: #5d6b79; --accent: #6ea8ff; --ok: #3ddc84; color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--text); }
body { font: 14px/1.5 -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif; }
.wrap { max-width: 880px; margin: 0 auto; padding: 24px 16px 48px; }
header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 16px; border-bottom: 1px solid var(--line); padding-bottom: 14px; }
h1 { font-size: 20px; margin: 0; }
h1 small { color: var(--muted); font-weight: 400; font-size: 14px; margin-left: 6px; }
nav { display: flex; gap: 6px; margin-left: auto; }
nav a { color: var(--muted); text-decoration: none; border: 1px solid var(--line); border-radius: 4px; padding: 5px 10px; font-size: 13px; }
nav a[aria-current] { color: var(--bg); background: var(--text); border-color: var(--text); }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 16px 0 4px; color: var(--muted); font-size: 13px; }
button { font: inherit; color: var(--text); background: var(--panel2); border: 1px solid var(--line); border-radius: 4px; padding: 6px 12px; cursor: pointer; }
button:hover { border-color: var(--muted); }
button.done { border-color: var(--ok); color: var(--ok); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
h2 { font-size: 15px; margin: 28px 0 8px; color: var(--muted); font-weight: 600; }
.count { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: var(--dim); margin-left: 4px; }
ol { margin: 0; padding: 0; list-style: none; }
li { position: relative; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px 76px 12px 14px; margin-bottom: 8px; }
.n { font-family: ui-monospace, "SF Mono", Menlo, monospace; color: var(--dim); margin-right: 6px; font-weight: 400; }
.t { font-weight: 600; }
.u { display: block; font-size: 12.5px; color: var(--accent); word-break: break-all; margin-top: 3px; }
.u.none { color: var(--dim); }
.use { font-size: 12.5px; color: var(--muted); margin-top: 6px; }
li .copy { position: absolute; top: 10px; right: 10px; padding: 4px 10px; font-size: 12px; }
footer { margin-top: 32px; color: var(--dim); font-size: 12px; }
footer a { color: var(--muted); }
@media (max-width: 480px) { li { padding-right: 14px; padding-top: 40px; } nav { margin-left: 0; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${title}<small>${all.length}</small></h1>
    <nav aria-label="Source type">
      <a href="sources-nasa.html"${isNasa ? ' aria-current="page"' : ""}>NASA</a>
      <a href="sources-other.html"${isNasa ? "" : ' aria-current="page"'}>Other</a>
    </nav>
  </header>
  <div class="bar">
    <button id="copyAll" type="button">Copy all</button>
    <span>${isNasa ? "Published by NASA" : "Non-NASA agencies, journals and press releases"} — copied as "No. Title. URL".</span>
  </div>
  ${body}
  <footer><a href="index.html">← Back to SpaceVital47</a></footer>
</div>
<textarea id="plain" hidden>${esc(plain)}</textarea>
<script>
(function () {
  function copy(text, btn) {
    var done = function () { var t = btn.textContent; btn.textContent = "Copied"; btn.classList.add("done"); setTimeout(function () { btn.textContent = t; btn.classList.remove("done"); }, 1200); };
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); }); }
    else { fallback(text); done(); }
  }
  function fallback(text) {
    var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove();
  }
  document.getElementById("copyAll").onclick = function () { copy(document.getElementById("plain").value, this); };
  document.querySelectorAll("li .copy").forEach(function (b) { b.onclick = function () { copy(b.parentNode.dataset.cite, b); }; });
})();
</script>
</body>
</html>
`;
}

for (const kind of ["nasa", "other"]) {
  const file = path.join(ROOT, `sources-${kind}.html`);
  fs.writeFileSync(file, page(kind));
  console.log("wrote", path.relative(ROOT, file));
}
