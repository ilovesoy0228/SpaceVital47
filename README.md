# SpaceVital47 — Astronaut Health Monitor (prototype)

NASA Space Apps 2026 · "Create Health Monitoring Software for Astronauts on Space Missions".
**Simulated data · demo thresholds · not a diagnostic tool · not affiliated with NASA.**

Astronauts are not doctors, and the farther from Earth, the harder real-time medical support becomes (NASA HRP "5 Hazards", distance).
SpaceVital47 is a serverless web app that turns a 1–3 minute daily self-check into a **vital-monitor view of change**, and switches to step-by-step **emergency cards** when needed.

## What it does
- **Three-layer check:** numbers (sleep, stress, resting HR, temperature, exercise, food intake, cabin ppCO₂) → structured symptom modules (12 modules, red flags) → optional camera.
- **Mission-day model:** every record is keyed by mission day. "Yesterday" means D−1 only (otherwise "no record yesterday" + "vs last record Dn"); baseline = first 14 days that have a record; ◀ ▶ day navigation recomputes with no future data; "Close day" commits today. Blank inputs stay "not entered" and never count as measurements. Missing days break the trend line (no interpolation).
- **Vital monitor:** every channel shows today vs yesterday vs personal baseline with demo thresholds. Levels use `*` / `**` / `***` markers and icons, never colour alone.
- **Respond mode:** 13 emergency cards (R1–R13). Switches automatically only when a new trigger appears, includes a ground-comms branch, a checklist and a copy-ready **English ground report** with user-selected photos.
- **Camera as an auxiliary signal (detection evidence D0):** absolute a*/b*/L* per region (forehead, cheeks, eye area, lips) is stored; Δ is computed when read. Per-region quality gates (glare, under-exposure, occlusion via a skin-pixel mask with trimmed means), warm-up, a 3-capture reference check, draggable regions + reference-photo overlay with position check (NCC), background lighting reference, and a repeatability check that shows the noise floor. Site photos have their own IDs and baselines. Camera heart rate uses measured frame timestamps and motion / band-edge / harmonic gates. Camera alone never exceeds *Watch* and never creates a card. Synthetic and real captures are never compared with each other.
- **Evidence tab:** 63 conditions from NASA Appendix E (Tables E.2-1/E.2-2), each tagged with occurrence evidence (O0–O3) and detection evidence (D0–D2). Every rule carries source IDs, and rules without a read source are not loaded.

## Honest scope
Zero rules reach evidence level A (threshold and action both sourced). All thresholds are demo values. Card procedures are generic first-aid-level demos (evidence C). Features dropped for lack of evidence (blink/drowsiness detection, camera stroke/anaemia judgement) are listed in the Evidence tab.

## Run
Open `index.html` (double-click works) or the GitHub Pages URL. No build step, no server, **no network requests** (CSP `connect-src 'none'`). Photos and numbers stay in browser storage and can be deleted.

## Tests
```
npm install              # Playwright 1.48.2, drives the installed Chrome
npm run test:all         # everything below, in the right order
npm run test:ui-cases    # synthetic y4m videos + UI cases (C006, C013, C014, C086, C095–C097, C099) → tests/out/e2e-cases.json
npm test                 # node --test: engine, data integrity, camera algorithm, and docs/MEASUREMENT_CASES.md C001–C100
npm run test:e2e         # browser smoke test: presets, auto-switch, report, language, 390 px
npm run test:camera      # camera acceptance with Chrome's fake camera (synthetic, non-human videos)
```
`tests/cases.test.js` prints one line per case (`C0xx PASS|FAIL|MANUAL`). UI cases read the result of `test:ui-cases`; run it first or they show as MANUAL.
Last local run (2026-11-15): **99 PASS · 0 FAIL · 1 MANUAL** (C098: the https:// deployment is not verified yet).
Camera tests use synthetic skin-coloured ellipses and synthetic signals, never a real person. They check that the algorithm behaves as designed — **not** real-world accuracy, real webcams, or different real skin tones.

## Files
`index.html` · `style.css` · `data.js` (sources, conditions, symptoms, rules, cards) · `timeline.js` (mission-day model) · `engine.js` (pure rule engine) · `camdata.js` (camera record model) · `ui.js` · `camera-core.js` (pure camera analysis) · `camera.js` · `store.js` · `report.js` · `tests/` · `reference/` (earlier prototype and mockup, reference only)

## AI disclosure
Code and data were drafted with Claude (Anthropic) and reviewed by the team.
