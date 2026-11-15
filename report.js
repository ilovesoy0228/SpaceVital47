/* SpaceVital47 report.js — 영문 지상 보고서 (항상 영문). 순수 함수. */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});
  const LV_EN = ["Normal", "Watch", "Act", "Emergency"];
  const f = (v, dec) => (v === null || v === undefined ? "n/a" : (+v).toFixed(dec));
  /* 부호 표시. 반올림 후 0이면 "-0" 대신 "0.0" */
  const sgn = (v, dec) => { if (v === null || v === undefined || Number.isNaN(+v)) return "n/a"; const s = (+v).toFixed(dec); if (+s === 0) return (0).toFixed(dec); return (+s > 0 ? "+" : "") + s; };
  function cameraLines(cs) {
    if (!cs || !cs.used) return ["Camera: not used"];
    const out = ["Camera (auxiliary signal, threshold +3):"];
    for (const r of cs.rows) out.push(`  ${r.key} a* ${r.today === null ? "n/a" : f(r.today, 1)} (d-base ${sgn(r.dBase, 1)}, d-yesterday ${sgn(r.dYest, 1)}; ${r.todayStatus === "ok" ? "gate passed" : r.todayStatus === "lowconf" ? "low confidence, excluded from rules" : "gate failed: " + (r.reasons || []).join(",")}${r.synthetic ? "; SYNTHETIC" : ""})`);
    if (cs.hr) out.push(`  camera HR ${cs.hr.status === "ok" ? f(cs.hr.bpm, 0) + " bpm" : "unavailable (" + cs.hr.reasons.join(",") + ")"}, SNR ${cs.hr.snr === null ? "n/a" : f(cs.hr.snr, 1)} (reference only)`);
    return out;
  }

  /**
   * ctx = { card, manual, comms:'yes'|'no', elapsedSec, crew, missionDay, ev (engine result), today, symptoms:{id:{sev,onset}},
   *         done:{stepIndex:true}, photos:[{id,region,date,note}] (사용자가 고른 것만) }
   */
  function reportText(ctx) {
    const c = ctx.card, ev = ctx.ev;
    const steps = c.steps.concat(UJ.COMMS_STEPS[ctx.comms] || []);
    const mm = String(Math.floor(ctx.elapsedSec / 60)).padStart(2, "0"), ss = String(ctx.elapsedSec % 60).padStart(2, "0");
    const chLine = (id, unit, dec) => {
      const d = ev.deltas[id] || {};
      return `  ${id.toUpperCase()} ${f(d.today, dec)} ${unit} (baseline ${f(d.base, dec)}, d-base ${sgn(d.dBase, dec)}, d-yesterday ${sgn(d.dYest, dec)})`;
    };
    const syms = Object.keys(ctx.symptoms || {}).filter((k) => ctx.symptoms[k]).map((k) => {
      const s = UJ.SYMPTOMS.find((x) => x.id === k); const o = ctx.symptoms[k] || {};
      return s ? `${s.en}${s.redFlag ? " [red flag]" : ""}${o.sev !== undefined && o.sev !== "" ? `, severity ${o.sev}/10` : ""}${o.onset ? `, onset ${o.onset}` : ""}` : k;
    });
    const groups = new Set();
    for (const k of Object.keys(ctx.symptoms || {})) { const s = UJ.SYMPTOMS.find((x) => x.id === k); if (s && ctx.symptoms[k]) s.mapsTo.forEach((m) => groups.add(m)); }
    const groupNames = Array.from(groups).map((id) => (UJ.CONDITIONS.find((x) => x.id === id) || {}).en).filter(Boolean);
    const flags = Object.keys(ev.tiles).filter((k) => ev.tiles[k].level >= 1).map((k) => `${tileNameEn(k)}: ${LV_EN[ev.tiles[k].level]}`);
    const photos = ctx.photos || [];
    return [
      "[SIMULATED DATA - PROTOTYPE - NOT FOR CLINICAL USE]",
      `GROUND REPORT: ${c.id} ${c.en}`,
      `Crew: ${ctx.crew} (simulated)    Mission day: ${ctx.missionDay} (simulated)`,
      `Time since alert: ${mm}:${ss}`,
      `Trigger: ${c.triggerText.en}${ctx.manual ? " (manually started)" : ""}`,
      `Comms: ${ctx.comms === "yes" ? "ground available - requesting support" : "ground unavailable - self-managed, retrying comms every 30 min"}`,
      "Today vs personal baseline (mean of first 14 days):",
      chLine("hr", "bpm", 0), chLine("temp", "C", 1), chLine("sleep", "h", 1), chLine("stress", "/5", 0),
      chLine("intake", "%", 0), chLine("ex", "min", 0), chLine("co2", "mmHg", 1),
      ...cameraLines(ctx.camera),
      `Symptoms checked: ${syms.length ? syms.join("; ") : "none"}`,
      `Related risk groups (not a diagnosis): ${groupNames.length ? groupNames.join("; ") : "none"}`,
      `Active flags: ${flags.length ? flags.join("; ") : "none"}`,
      "Steps:",
      ...steps.map((s, i) => `  [${ctx.done && ctx.done[i] ? "x" : " "}] ${s.en}`),
      `Attached photos (${photos.length}): ${photos.length ? photos.map((p) => `${p.id} ${p.region} ${p.date}${p.note ? ` "${p.note}"` : ""}`).join("; ") : "none"}`,
      ctx.comms === "yes" ? "Request: guidance on next steps; confirm whether further action is needed." : "Request: (queued) send when comms resume.",
    ].join("\n");
  }

  function tileNameEn(k) {
    if (k.startsWith("m:")) { const m = UJ.MODULES.find((x) => "m:" + x.id === k); return m ? "Symptoms/" + m.en : k; }
    if (k === "bp") return "Blood pressure";
    const c = UJ.CHANNELS.find((x) => x.id === k); return c ? c.en : k;
  }

  UJ.report = { reportText, tileNameEn, sgn, cameraLines };
  if (typeof module !== "undefined" && module.exports) module.exports = UJ.report;
})(typeof window !== "undefined" ? window : globalThis);
