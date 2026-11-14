# Ujumin — Astronaut Health Monitor (prototype)

NASA Space Apps 2026 · "Create Health Monitoring Software for Astronauts on Space Missions".
**Simulated data · demo thresholds · not a diagnostic tool · not affiliated with NASA.**

Astronauts are not doctors, and the farther from Earth, the harder real-time medical support becomes (NASA HRP "5 Hazards", distance).
Ujumin is a serverless web app that turns a 1–3 minute daily self-check into a **vital-monitor view of change**, and switches to step-by-step **emergency cards** when needed.

## What it does
- **Three-layer check:** numbers (sleep, stress, resting HR, temperature, exercise, food intake, cabin ppCO₂) → structured symptom modules (12 modules, red flags) → optional camera.
- **Vital monitor:** every channel shows today vs **yesterday** vs **personal baseline** (mean of first 14 days), with demo thresholds drawn on a 30-day trace. Levels use `*` / `**` / `***` markers and icons, never colour alone.
- **Respond mode:** 13 emergency cards (R1–R13). Switches automatically only when a new trigger appears, includes a ground-comms branch, a checklist and a copy-ready **English ground report** with user-selected photos.
- **Camera as an auxiliary signal:** redness change (CIELAB Δa*) against your own reference photo, side-by-side comparison, site photos for reports, and an optional 30-s camera heart rate that shows "unavailable" unless a quality gate passes. Camera alone never exceeds *Watch*.
- **Evidence tab:** 63 conditions from NASA Appendix E (Tables E.2-1/E.2-2), each tagged with occurrence evidence (O0–O3) and detection evidence (D0–D2). Every rule carries source IDs, and rules without a read source are not loaded.

## Honest scope
Zero rules reach evidence level A (threshold and action both sourced). All thresholds are demo values. Card procedures are generic first-aid-level demos (evidence C). Features dropped for lack of evidence (blink/drowsiness detection, camera stroke/anaemia judgement) are listed in the Evidence tab.

## Run
Open `index.html` (double-click works) or the GitHub Pages URL. No build step, no server, **no network requests** (CSP `connect-src 'none'`). Photos and numbers stay in browser storage and can be deleted.

## Tests
```
npm install            # Playwright, uses installed Chrome
npm test               # engine, data integrity, camera algorithm (node --test)
npm run test:e2e       # browser smoke test: scenarios, auto-switch, report, language, 390 px
node tests/make-videos.js && node tests/e2e-camera.js   # camera acceptance with synthetic (non-human) videos
```
Camera tests use synthetic skin-coloured ellipses, never a real person. They check that the algorithm behaves as intended, not real-world accuracy.

## Files
`index.html` · `style.css` · `data.js` (sources, conditions, symptoms, rules, cards) · `engine.js` (pure rule engine) · `ui.js` · `camera-core.js` (pure camera analysis) · `camera.js` · `store.js` · `report.js` · `tests/` · `reference/` (earlier prototype and mockup, reference only)

## AI disclosure
Code and data were drafted with Claude (Anthropic) and reviewed by the team.
