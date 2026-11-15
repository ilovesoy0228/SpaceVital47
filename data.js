/* SpaceVital47 data.js — 근거·문서 담당(B)이 수정하는 파일.
 * 규칙: 값을 지어내지 말 것. 출처 id가 없는 규칙은 엔진이 로드하지 않음.
 * status가 'read'가 아닌 출처는 근거로 쓰지 않음.
 * 이 파일의 초안은 Claude(Anthropic)가 CLAUDE.md §4·§5·§6·§14를 옮겨 작성했습니다. */
(function (g) {
  "use strict";
  const UJ = (g.UJ = g.UJ || {});
  const R = "https://www.nasa.gov/reference/";

  /* ───────────── SOURCES ───────────── */
  const SOURCES = [
    { id: "appE", title: "NASA — Appendix E: Health and Medical Care Technical Requirements (Tables E.2-1 IMM sample output, E.2-2 condition list)", url: R + "appendix-e-health-and-medical-care-technical-requirements/", status: "read", inResourcesTab: false,
      note: { ko: "IMM 건수는 임무당 예상(모델 추정, 'Sample', 임무 미명시). 실제 관측 건수 아님. 표 번호 37 행이 원문에서 빠져 있음.", en: "IMM counts are modelled expected events per mission ('Sample', mission unspecified), not observed counts. Row 37 is missing in the original." } },
    { id: "ntrsEmerg", title: "NASA NTRS 20220019247 — ISS Emergency Operations History (SpaceOps 2023)", url: "https://ntrs.nasa.gov/api/citations/20220019247/downloads/Emergency%20Ops%20History%20for%20SpaceOps%20Conference%202023.pdf", status: "read", inResourcesTab: false,
      note: { ko: "ISS 응급 3종(화재·급감압·독성 대기). 의료 응급은 범위 밖. 독성 대기 대부분은 승무원이 직접 알림.", en: "ISS emergencies: fire, rapid depressurisation, toxic atmosphere. Medical is out of scope. Most toxic-atmosphere events are crew-reported." } },
    { id: "hrpHazards", title: "NASA HRP — 5 Hazards of Human Spaceflight", url: "https://www.nasa.gov/hrp/hazards", status: "read", inResourcesTab: true,
      note: { ko: "지구와의 거리로 지시·의료 지원이 어려워짐.", en: "Distance from Earth limits real-time guidance and medical support." } },
    { id: "hrpRisks", title: "NASA HRP — Human System Risks", url: "https://www.nasa.gov/hrp/risks/", status: "read", inResourcesTab: true,
      note: { ko: "위험 17개 목록. CO₂·신장 결석은 이 목록에 없음.", en: "17-risk list. CO₂ and renal stones are not on it." } },
    { id: "hrpResearch", title: "NASA HRP — Ongoing HRP Research", url: "https://www.nasa.gov/hrp/ongoing-hrp-research/", status: "read", inResourcesTab: true, note: { ko: "", en: "" } },
    { id: "rFitness", title: "NASA — Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness", url: R + "risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness", status: "read", inResourcesTab: false,
      note: { ko: "근력·유산소 평균 10–12% 감소, 12–38%가 20% 이상 손실, ISS 하루 약 1.5시간 운동.", en: "Average strength/aerobic loss 10–12%; 12–38% lose >20%; ISS crews exercise ~1.5 h/day." } },
    { id: "rImmune", title: "NASA — Risk of Altered Immune System Responses", url: R + "risk-of-altered-immune-system-responses", status: "read", inResourcesTab: false,
      note: { ko: "휴면 바이러스 재활성(입술 포진·대상포진), 발진, 비정형 알레르기.", en: "Latent virus reactivation (cold sores, shingles), rashes, atypical allergies." } },
    { id: "rCardio", title: "NASA — Risk of Cardiovascular Adaptations", url: R + "risk-of-cardiovascular-adaptations", status: "read", inResourcesTab: false, note: { ko: "임계값 수치 없음.", en: "No threshold values." } },
    { id: "rNutrition", title: "NASA — Risk of Inadequate Food and Nutrition", url: R + "risk-of-inadequate-food-and-nutrition", status: "read", inResourcesTab: false, note: { ko: "섭취량 수치 없음.", en: "No intake thresholds." } },
    { id: "rBone", title: "NASA — Risk of Spaceflight-Induced Bone Changes", url: R + "risk-of-spaceflight-induced-bone-changes", status: "read", inResourcesTab: false,
      note: { ko: "4–6개월 임무에서 월 1–1.5% 감소(척추·고관절). 신장 결석 언급 없음.", en: "1–1.5 %/month loss on 4–6-month missions (spine, hip). No mention of renal stones." } },
    { id: "rSans", title: "NASA — Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)", url: R + "risk-of-spaceflight-associated-neuro-ocular-syndrome-sans", status: "read", inResourcesTab: false,
      note: { ko: "ISS 승무원 70%가 안구 뒤쪽 부종. 안저검사 필요 — 카메라로 못 잡음.", en: "70% of ISS crew show posterior-eye swelling. Needs fundus exam — not visible to a camera." } },
    { id: "rSleep", title: "NASA — Risk from Inadequate Sleep and Irregular Schedules", url: R + "risk-from-inadequate-sleep-and-irregular-schedules", status: "read", inResourcesTab: false,
      note: { ko: "하루 일출·일몰 16번.", en: "16 sunrises/sunsets per day." } },
    { id: "rBehavior", title: "NASA — Risk of Behavioral Conditions and Psychiatric Disorders", url: R + "risk-of-behavioral-conditions-and-psychiatric-disorders", status: "read", inResourcesTab: false,
      note: { ko: "고립·밀폐로 불안·우울 위험.", en: "Isolation and confinement raise anxiety/depression risk." } },
    { id: "rRadCancer", title: "NASA — Risk of Radiation-Induced Cancers", url: R + "risk-of-radiation-induced-cancers", status: "read", inResourcesTab: false,
      note: { ko: "태양입자 이벤트·선량 한도 정보 없음.", en: "No SPE or dose-limit information." } },
    { id: "rHypoxia", title: "NASA — Risk of Hypoxia", url: R + "risk-of-hypoxia", status: "read", inResourcesTab: false, note: { ko: "CO₂ 언급 없음.", en: "No mention of CO₂." } },
    { id: "rHostMicro", title: "NASA — Risk of Host-Microorganism Interactions", url: R + "risk-of-host-microorganism-interactions", status: "read", inResourcesTab: false, note: { ko: "", en: "" } },
    { id: "noaa", title: "NOAA SWPC — Space Weather Scales", url: "https://www.spaceweather.gov/noaa-scales-explanation", status: "read", inResourcesTab: false,
      note: { ko: "S1(≥10 MeV 플럭스 10 pfu)은 이벤트 시작·종료 정의, 생물학적 영향 없음. S3 이상에서 EVA 방사선 회피 권고. 행동 임계값 아님.", en: "S1 (≥10 MeV flux 10 pfu) defines event start/end; no biological effect. EVA radiation avoidance is advised from S3. Not an action threshold." } },
    { id: "crucian2016", title: "Crucian et al. 2016 — Incidence of clinical symptoms during long-duration orbital spaceflight (IJGM)", url: "https://www.dovepress.com/incidence-of-clinical-symptoms-during-long-duration-orbital-spacefligh-peer-reviewed-article-IJGM", status: "read", inResourcesTab: false,
      note: { ko: "ISS 46명, 면역 관련 증상 70건(발진 23, 상기도 20, 감염 ≥13). 눈·근골격·위장·부상·수면 제외 — '발진 1위'라고 쓰지 않음.", en: "46 ISS crew, 70 immune-related events (rash 23, URI 20, infection ≥13). Eye, MSK, GI, injury and sleep excluded — do not call rash 'the #1 symptom'." } },
    { id: "eyeNpj2023", title: "npj Microgravity 2023 — ocular complaints in spaceflight (s41526-023-00335-7)", url: "https://link.springer.com/10.1038/s41526-023-00335-7", status: "read", inResourcesTab: false,
      note: { ko: "눈 호소 242건: 자극 33%, 이물감 23%.", en: "242 ocular complaints: irritation 33%, foreign-body sensation 23%." } },
    { id: "meer2023", title: "Meer et al. 2023 — ocular conditions and evacuation risk (s41526-023-00279-y)", url: "https://www.nature.com/articles/s41526-023-00279-y.pdf", status: "read", inResourcesTab: false,
      note: { ko: "화학 화상이 ISS 대피 위험 평가 1위, 안구 사진 촬영 권고.", en: "Chemical burn ranked #1 ISS evacuation risk; ocular photography recommended." } },
    { id: "skinCommMed2024", title: "Communications Medicine 2024 — skin in spaceflight (s43856-024-00532-9)", url: "https://link.springer.com/10.1038/s43856-024-00532-9", status: "read", inResourcesTab: false,
      note: { ko: "피부 관련 열람 자료. 인수인계서에 수치 요약이 없어 이 앱에서 수치 근거로 쓰지 않음.", en: "Skin reference. No figures summarised in the handover, so no numbers are taken from it." } },
    { id: "anemiaEureka", title: "EurekAlert 939794 — space anaemia press release", url: "https://www.eurekalert.org/news-releases/939794", status: "read", inResourcesTab: false,
      note: { ko: "14명, 적혈구 파괴 54%↑. 착륙 시 13명 중 5명 빈혈(보도자료).", en: "14 crew, 54% more RBC destruction; 5 of 13 anaemic at landing (press release)." } },
    { id: "suner2021", title: "Suner et al. 2021 (PLoS ONE) — smartphone conjunctival anaemia screening", url: null, status: "read", inResourcesTab: false,
      note: { ko: "344명, 검증 정확도 72.6%, 민감도 72.8%, 특이도 72.5%. URL은 인수인계서에 없음 [미확인].", en: "n=344; validation accuracy 72.6%, sensitivity 72.8%, specificity 72.5%. URL not recorded [unverified]." } },
    { id: "niada2025", title: "NiADA 2025 (Cureus) — non-invasive anaemia detection", url: null, status: "read", inResourcesTab: false,
      note: { ko: "2,476명, 민감도 ≥88%, 특이도 71.8–76.1%. URL은 인수인계서에 없음 [미확인].", en: "n=2,476; sensitivity ≥88%, specificity 71.8–76.1%. URL not recorded [unverified]." } },
    { id: "rppgHr2025", title: "Frontiers in Physiology 2025 — camera-based heart rate (fphys.2025.1638809)", url: "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1638809/pdf", status: "read", inResourcesTab: false,
      note: { ko: "35명, 평균 오차 0.1–0.4 bpm. 전원 백인, 정지 상태, 실험실.", en: "n=35, mean error 0.1–0.4 bpm. All white participants, at rest, lab setting." } },
    { id: "rppgResp2022", title: "Frontiers in Physiology 2022 — video respiratory rate (fphys.2022.801709)", url: "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2022.801709/pdf", status: "read", inResourcesTab: false,
      note: { ko: "정지·0.5–1.2 m에서 양호, 자연 호흡·움직임에 취약.", en: "Good at rest at 0.5–1.2 m; weak with natural breathing and motion." } },
    { id: "napShuttle", title: "National Academies 2001 — Shuttle STS-1–89 medical events (2nd-hand)", url: "https://www.nationalacademies.org/read/10218/chapter/5", status: "read", inResourcesTab: false,
      note: { ko: "1,867건: 우주 적응 증후군 42.2%, 신경·감각 17.0%, 소화 8.7%, 피부 8.1%. 부상 수치가 본문·표에서 다름.", en: "1,867 events: SAS 42.2%, neuro/sensory 17.0%, GI 8.7%, skin 8.1%. Injury figures inconsistent." } },
    { id: "submitGuide", title: "NASA Space Apps — Project Submission Guide (2025 edition)", url: "https://www.spaceappschallenge.org/resources/project-submission-guide/", status: "read", inResourcesTab: false, note: { ko: "2026판 문구 [미확인].", en: "2026 wording [unverified]." } },
    // ── 근거로 쓰지 않는 자료 (목록에만) ──
    { id: "csaRadiation", title: "CSA — Monitoring Radiation for Astronaut Health (Resources tab)", url: null, status: "unverified", inResourcesTab: true, note: { ko: "재확인하지 않음 [미확인].", en: "Not re-checked [unverified]." } },
    { id: "eerRetracted", title: "Eyelid position photo analysis (eer3.70043)", url: "https://journal.hep.com.cn/eer/EN/10.1002/eer3.70043", status: "unverified", inResourcesTab: false, note: { ko: "철회 표기 — 인용 금지.", en: "Marked retracted — do not cite." } },
    { id: "pmc11090304", title: "PMC11090304 — real-time conjunctival photo anaemia", url: null, status: "title-only", inResourcesTab: false, note: { ko: "제목만 봄 — 인용 금지.", en: "Title only — do not cite." } },
    { id: "pmc9323611", title: "PMC9323611 — PERCLOS / facial physiological signals", url: null, status: "title-only", inResourcesTab: false, note: { ko: "제목만 봄 — 인용 금지.", en: "Title only — do not cite." } },
    { id: "sensors2021", title: "Sensors 2021 — driver drowsiness (8-driver simulator)", url: null, status: "read", inResourcesTab: false, note: { ko: "정확도 수치 없음 → 졸음 카메라 감지는 도입하지 않음.", en: "No accuracy figures → camera drowsiness detection not adopted." } },
  ];

  /* ───────────── 13 categories (Table E.2-2) ───────────── */
  const CATEGORIES = {
    env: { ko: "환경·우주 적응", en: "Environment & adaptation" }, eye: { ko: "눈", en: "Eye" }, ent: { ko: "이비인후", en: "ENT" },
    dental: { ko: "치과·구강", en: "Dental & oral" }, cardio: { ko: "심혈관", en: "Cardiovascular" }, pulm: { ko: "폐·가슴", en: "Pulmonary & chest" },
    gi: { ko: "소화기·복부", en: "GI & abdomen" }, gu: { ko: "비뇨·생식", en: "Genitourinary" }, msk: { ko: "근골격", en: "Musculoskeletal" },
    skin: { ko: "피부", en: "Skin" }, neuro: { ko: "신경", en: "Neurological" }, behav: { ko: "정신·인지·행동", en: "Behavioural & cognitive" }, other: { ko: "기타", en: "Other" },
  };

  /* ───────────── CONDITIONS (§4, 1 row = 1 table row) ─────────────
   * [id, category, ko, en, imm(main number|null), starred, occurrence, channels, cap, detection, cards, extraSources, note(원문 근거)] */
  const C = (id, category, ko, en, imm, starred, occurrence, channels, cap, detection, cards, extra, note) =>
    ({ id, category, ko, en, imm, starred, occurrence, channels, cap, detection, cards, sources: ["appE"].concat(extra), note });
  const CONDITIONS = [
    // 4.1 환경·우주 적응
    C("allergy", "env", "알레르기 반응 / 아나필락시스", "Allergic reaction / anaphylaxis", 1.18, true, "O1", ["Q", "C", "Cp"], 3, "D0", ["R4"], ["rImmune"], "E.2-1 allergic reaction 1.18; E.2-2 anaphylaxis★"),
    C("ars", "env", "급성 방사선 증후군", "Acute radiation syndrome", null, false, "O2", ["Q", "V"], 3, "D0", ["R1"], [], "E.2-2 only"),
    C("sas", "env", "우주 멀미", "Space motion sickness", 4.37, true, "O1", ["Q"], 1, "D0", [], [], "E.2-1 4.37"),
    C("headache", "env", "두통 (CO₂ 관련 / 우주 적응 / 늦은 두통)", "Headache (CO₂ / SAS / late)", 5.25, true, "O1", ["Q", "V"], 2, "D0", [], [], "E.2-1 late headache 5.25, CO₂ headache 2.15, SAS headache 2.11"),
    C("backpain", "env", "허리 통증(우주 적응) / 허리 부상", "Back pain (SAS) / back injury", 3.41, true, "O1", ["Q", "V"], 2, "D0", [], [], "E.2-1 back injury 3.41, back pain 3.15"),
    C("congestion", "env", "코막힘 / 기압 손상(귀·부비동)", "Nasal congestion / barotrauma", 3.51, true, "O1", ["Q"], 1, "D0", [], [], "E.2-1 nasal congestion 3.51, barotrauma 3.28"),
    C("constipation", "env", "변비", "Constipation", 1.02, true, "O1", ["Q"], 1, "D0", [], [], "E.2-1 1.02"),
    C("epistaxis", "env", "코피", "Nosebleed", null, false, "O2", ["Q", "Cp"], 1, "D0", [], [], "E.2-2 only"),
    C("malnutrition", "env", "영양 결핍", "Nutritional deficiency", null, false, "O2", ["V", "Q"], 2, "D0", [], ["rNutrition"], "E.2-2 only; nutrition risk page has no intake numbers"),
    C("medication", "env", "약물 부작용 / 약물 과다", "Medication reaction / overdose", null, false, "O2", ["Q", "P"], 3, "D0", ["R13"], [], "E.2-2 only (manual card)"),
    C("noisehl", "env", "소음성 난청", "Noise-induced hearing loss", 0.57, false, "O1", ["Q"], 1, "D0", [], [], "E.2-1 0.57"),
    C("urinary", "env", "요실금 / 요폐", "Urinary incontinence / retention", 0.11, true, "O1", ["Q"], 2, "D0", [], [], "E.2-1 retention 0.11; E.2-2 incontinence★"),
    C("burn", "env", "화상(열) / 화재 관련 화상", "Thermal / fire burn", null, false, "O2", ["Q", "Cp"], 3, "D0", ["R9"], [], "E.2-2 only"),
    C("toxinhal", "env", "연기·연소 생성물 흡입 / 독성 흡입 / 천체 먼지", "Smoke / toxic inhalation / celestial dust", null, false, "O2", ["Q", "P"], 3, "D0", ["R11"], ["ntrsEmerg"], "E.2-2 only; environment alarms are not detected by this app"),
    C("dcs", "env", "감압병 / 색전증 / 급성 고산병", "Decompression sickness / embolism / altitude sickness", null, false, "O2", ["P"], 3, "D0", ["R11"], [], "E.2-2 only (manual card)"),
    C("choking", "env", "질식·기도 폐쇄", "Choking / airway obstruction", null, false, "O2", ["P"], 3, "D0", ["R10"], [], "E.2-2 only (manual card)"),
    C("evaenv", "env", "감전 / 한랭 손상 / 저체온 / 열 질환 / EVA 탈수", "Electric shock / cold injury / hypothermia / heat illness / EVA dehydration", null, false, "O2", ["Q", "P"], 2, "D0", [], [], "E.2-2 only; EVA context"),
    // 4.2 눈
    C("eyeabrasion", "eye", "눈 찰과상(각막)", "Corneal abrasion", 7.42, true, "O1", ["Q", "C", "Cp"], 2, "D0", [], ["eyeNpj2023"], "E.2-1 7.42; 242 ocular complaints (irritation 33%, FB 23%)"),
    C("eyechem", "eye", "눈 화학 손상", "Chemical eye injury", 0.64, true, "O1", ["Q", "Cp"], 3, "D0", ["R3"], ["meer2023"], "E.2-1 0.64; #1 ISS evacuation-risk ranking"),
    C("eyefb", "eye", "눈 이물", "Eye foreign body", null, true, "O2", ["Q", "Cp"], 2, "D0", [], [], "E.2-2★"),
    C("eyeinfect", "eye", "눈 감염 / 눈꺼풀·전안부 감염 / 각막 궤양", "Eye infection / lid infection / corneal ulcer", 0.53, false, "O1", ["Q", "C", "Cp", "V"], 2, "D0", [], [], "E.2-1 eye infection 0.53"),
    C("sans", "eye", "SANS", "SANS", 2.08, false, "O1", ["Q"], 2, "D0", [], ["rSans"], "E.2-1 2.08; needs fundus exam — camera cannot see it"),
    C("eyeacute", "eye", "급성 시력 상실 / 급성 녹내장 / 망막 박리 / 관통 안외상", "Acute vision loss / glaucoma / retinal detachment / penetrating eye trauma", null, false, "O2", ["Q"], 3, "D0", ["R3"], [], "E.2-2 only"),
    // 4.3 이비인후
    C("respinf", "ent", "호흡기 감염 (상기도·하기도)", "Respiratory infection (upper/lower)", 3.46, false, "O1", ["Q", "V"], 2, "D0", [], ["rImmune", "crucian2016"], "E.2-1 3.46"),
    C("pharyngitis", "ent", "인후염 / 부비동염 / 인플루엔자", "Pharyngitis / sinusitis / influenza", 1.17, false, "O1", ["Q", "V"], 2, "D0", [], [], "E.2-1 pharyngitis 1.17, sinusitis 0.64, influenza 0.11"),
    C("ear", "ent", "중이염 / 외이도염 / 귀지 / 청력 손실", "Otitis media / externa / cerumen / hearing loss", 0.32, false, "O1", ["Q"], 1, "D0", [], [], "E.2-1 otitis externa 0.32, media 0.30"),
    // 4.4 치과
    C("dentalcaries", "dental", "충치 / 크라운·충전물 소실 / 치아 파절 / 탈구", "Caries / lost crown or filling / fracture / avulsion", 0.88, false, "O1", ["Q", "Cp"], 2, "D0", [], [], "E.2-1 caries 0.88"),
    C("mouthulcer", "dental", "입안 궤양", "Mouth ulcer", 0.96, false, "O1", ["Q", "Cp"], 1, "D0", [], [], "E.2-1 0.96"),
    C("abscess", "dental", "치근 농양", "Dental abscess", 0.068, false, "O1", ["Q", "Cp", "V"], 2, "D0", [], [], "E.2-1 0.068"),
    // 4.5 심혈관
    C("acs", "cardio", "급성 관상동맥 증후군 / 협심증·심근경색", "Acute coronary syndrome / angina / MI", null, false, "O2", ["Q", "V", "C"], 3, "D0", ["R5"], [], "E.2-2 only; camera HR is reference only"),
    C("arrhythmia", "cardio", "부정맥(심방세동·조동)", "Arrhythmia (AF / flutter)", null, false, "O2", ["Q", "V", "C"], 3, "D0", ["R5"], [], "E.2-2 only"),
    C("arrest", "cardio", "심인성 쇼크 / 갑작스러운 심정지", "Cardiogenic shock / sudden cardiac arrest", null, false, "O2", ["P"], 3, "D0", ["R5"], [], "E.2-2 only (manual card)"),
    C("dvt", "cardio", "정맥 혈전", "Venous thrombosis", null, false, "O2", ["Q", "Cp"], 2, "D0", [], [], "E.2-2 only"),
    C("hemshock", "cardio", "외상성 출혈성 쇼크", "Traumatic haemorrhagic shock", null, false, "O2", ["Q", "P"], 3, "D0", ["R8"], [], "E.2-2 only"),
    C("htn", "cardio", "고혈압", "Hypertension", null, false, "O2", ["V"], 1, "D0", [], [], "E.2-2 only; BP device availability [unverified]"),
    C("orthostatic", "cardio", "중력 전환 기립성 불내증", "Orthostatic intolerance (gravity transition)", null, true, "O2", ["X"], 0, "D0", [], [], "E.2-2★; post-landing — listed only"),
    // 4.6 폐
    C("asthma", "pulm", "반응성 기도(천식)", "Reactive airway (asthma)", null, false, "O2", ["Q", "C"], 3, "D0", ["R10"], [], "E.2-2 only"),
    C("chesttrauma", "pulm", "흉부 외상(둔상·관통)", "Chest trauma", null, false, "O2", ["Q", "Cp"], 3, "D0", ["R8"], [], "E.2-2 only"),
    // 4.7 소화기
    C("diarrhea", "gi", "설사 / 소화불량 / 위장염 / 역류", "Diarrhoea / indigestion / gastroenteritis / reflux", 3.53, true, "O1", ["Q", "V"], 2, "D0", [], [], "E.2-1 diarrhoea 3.53, indigestion 0.64"),
    C("hemorrhoid", "gi", "치질 / 탈장", "Haemorrhoids / hernia", 0.22, false, "O1", ["Q"], 1, "D0", [], [], "E.2-1 haemorrhoids 0.22"),
    C("acuteabd", "gi", "충수염 / 담낭염 / 게실염 / 췌장염 / 장폐색 / 복부 외상", "Appendicitis / cholecystitis / diverticulitis / pancreatitis / obstruction / abdominal trauma", null, false, "O2", ["Q", "V"], 3, "D0", ["R7"], [], "E.2-2 only"),
    // 4.8 비뇨
    C("uti", "gu", "요로 감염", "Urinary tract infection", 1.44, true, "O1", ["Q", "V"], 2, "D0", [], [], "E.2-1 1.44"),
    C("nephrolithiasis", "gu", "신장 결석", "Nephrolithiasis (renal stone)", null, false, "O2", ["Q"], 2, "D0", [], [], "E.2-2 lists nephrolithiasis; not in top-48 of E.2-1; no threshold source"),
    C("guother", "gu", "급성 신손상 / 급성 전립선염 / 질염 / 비정상 자궁 출혈", "AKI / prostatitis / vaginitis / abnormal uterine bleeding", null, false, "O2", ["Q"], 2, "D0", [], [], "E.2-2 only"),
    // 4.9 근골격
    C("sprain", "msk", "어깨·팔꿈치·발목·무릎·손목·고관절 염좌, 목 부상", "Shoulder/elbow/ankle/knee/wrist/hip sprain, neck injury", 2.43, false, "O1", ["Q", "Cp"], 2, "D0", [], [], "E.2-1 shoulder 2.43, elbow 1.32, ankle 1.22, neck 0.99, knee 0.78, wrist 0.55, hip 0.45"),
    C("evahand", "msk", "손톱 박리 / 이상감각 / 손 부상 / 수트 접촉 손상", "Fingernail delamination / paresthesia / hand injury / suit contact injury", 0.65, false, "O1", ["Q", "Cp"], 2, "D0", [], [], "E.2-1 paresthesia 0.65, delamination 0.40"),
    C("fracture", "msk", "피로골절 / 탈구 / 골절", "Stress fracture / dislocation / fracture", 0.13, false, "O1", ["Q", "Cp"], 3, "D0", ["R8"], [], "E.2-1 lower-limb stress fracture 0.13, finger dislocation 0.11"),
    C("mskother", "msk", "구획 증후군 / 급성 관절염 / 디스크 / 과사용 손상", "Compartment syndrome / acute arthritis / disc / overuse", null, false, "O2", ["Q"], 3, "D0", ["R8"], [], "E.2-2 only"),
    // 4.10 피부
    C("skinabrasion", "skin", "피부 찰과상", "Skin abrasion", 9.86, true, "O1", ["Q", "Cp", "C"], 2, "D0", [], [], "E.2-1 9.86"),
    C("rash", "skin", "피부 발진", "Skin rash", 9.83, true, "O1", ["Q", "C", "Cp"], 2, "D0", [], ["rImmune", "crucian2016"], "E.2-1 9.83; immune page mentions rash"),
    C("skininf", "skin", "피부 감염 / 봉와직염 / 바이러스·곰팡이 감염", "Skin infection / cellulitis / viral·fungal", 1.38, true, "O1", ["Q", "C", "Cp", "V"], 3, "D0", ["R2"], [], "E.2-1 1.38; E.2-2 cellulitis★"),
    C("zoster", "skin", "대상포진", "Herpes zoster (shingles)", 0.11, false, "O1", ["Q", "Cp"], 2, "D0", [], ["rImmune"], "E.2-1 0.11; latent virus reactivation"),
    C("laceration", "skin", "피부 열상", "Skin laceration", 0.11, true, "O1", ["Q", "Cp"], 3, "D0", ["R8"], [], "E.2-1 0.11"),
    C("chemskin", "skin", "화학 화상(피부) / 독성 피부 노출", "Chemical skin burn / toxic skin exposure", null, false, "O2", ["Q", "Cp"], 3, "D0", ["R9", "R11"], [], "E.2-2 only"),
    // 4.11 신경
    C("stroke", "neuro", "뇌혈관 사고(뇌졸중)", "Cerebrovascular accident (stroke)", null, false, "O2", ["Q", "Cp"], 3, "D0", ["R6"], [], "E.2-2 only; camera = photo attachment only, no measurement"),
    C("seizure", "neuro", "발작 / 두부 외상 / 신경 쇼크", "Seizure / head injury / neurogenic shock", null, false, "O2", ["Q", "P"], 3, "D0", ["R6"], [], "E.2-2 only"),
    C("neuropathy", "neuro", "신경병증 / 이상감각 / 신경전정 장애(착륙)", "Neuropathy / paresthesia / neurovestibular (landing)", null, false, "O2", ["Q"], 2, "D0", [], [], "E.2-2 only"),
    // 4.12 정신
    C("insomnia", "behav", "불면·수면 장애·일주기 불일치", "Insomnia / sleep disorder / circadian misalignment", 13.85, true, "O1", ["V", "Q"], 2, "D0", [], ["rSleep"], "E.2-1 late insomnia 13.85 (top row), SAS insomnia 2.70"),
    C("stress", "behav", "급성 스트레스 / 적응 반응 / 불안·공황 / 기분 장애 / 인지 장애", "Acute stress / adjustment / anxiety / mood / cognitive", null, true, "O2", ["V", "Q"], 2, "D0", [], ["rBehavior"], "E.2-2★"),
    C("depression", "behav", "우울 / 무기력 / 단조로움 / 소진 / 대인 갈등", "Depression / apathy / monotony / burnout / interpersonal conflict", null, true, "O2", ["Q"], 2, "D0", [], ["rBehavior"], "E.2-2 (interpersonal conflict★)"),
    C("psychcrisis", "behav", "섬망 / 정신병 / 안전 문항(자해·타해 생각)", "Delirium / psychosis / safety item", null, false, "O2", ["Q"], 3, "D0", ["R12"], ["rBehavior"], "E.2-2 only"),
    // 4.13 기타
    C("sepsis", "other", "패혈증", "Sepsis", null, false, "O2", ["V", "Q"], 3, "D0", ["R2"], [], "E.2-2 only"),
    C("anemia", "other", "빈혈·철 결핍", "Anaemia / iron deficiency", null, false, "O3", ["Q", "V", "Cp"], 1, "D1", [], ["anemiaEureka", "suner2021", "niada2025"], "Camera conjunctival screening specificity ~72–76% (D1) — photo comparison only"),
  ];

  /* ───────────── CHANNELS (vital rows) ───────────── */
  const CHANNELS = [
    { id: "hr", ko: "안정 시 심박", en: "Resting HR", unit: "bpm", dec: 0, color: "--c-hr", source: "checkin", min: 30, max: 200, step: 1, def: 62, amp: 2 },
    { id: "temp", ko: "체온", en: "Body temp", unit: "°C", dec: 1, color: "--c-temp", source: "checkin", min: 34, max: 42, step: 0.1, def: 36.6, amp: 0.15 },
    { id: "sleep", ko: "수면", en: "Sleep", unit: "h", dec: 1, color: "--c-sleep", source: "checkin", min: 0, max: 14, step: 0.5, def: 7, amp: 0.4 },
    { id: "stress", ko: "스트레스", en: "Stress", unit: "1–5", dec: 0, color: "--c-stress", source: "checkin", min: 1, max: 5, step: 1, def: 2, amp: 0.6 },
    { id: "intake", ko: "식사 섭취", en: "Food intake", unit: "%", dec: 0, color: "--c-intake", source: "checkin", min: 0, max: 150, step: 5, def: 100, amp: 5 },
    { id: "ex", ko: "운동", en: "Exercise", unit: "min", dec: 0, color: "--c-ex", source: "checkin", min: 0, max: 240, step: 5, def: 90, amp: 8 },
    { id: "co2", ko: "선실 CO₂ 분압", en: "Cabin ppCO₂", unit: "mmHg", dec: 1, color: "--c-co2", source: "checkin", min: 0, max: 15, step: 0.1, def: 3, amp: 0.2 },
    { id: "rad", ko: "방사선 (합성 재생)", en: "Radiation (synthetic replay)", unit: "pfu", dec: 1, color: "--c-rad", source: "event" },
    { id: "camFace", ko: "카메라 붉기 · 얼굴 종합 (이마·양 뺨 중앙값)", en: "Camera redness · face (median of forehead & cheeks)", unit: "Δa*", dec: 1, color: "--c-cam", source: "camera", roi: "face" },
    { id: "camForehead", ko: "카메라 붉기 · 이마", en: "Camera redness · forehead", unit: "Δa*", dec: 1, color: "--c-cam", source: "camera", roi: "forehead" },
    { id: "camCheekL", ko: "카메라 붉기 · 왼뺨", en: "Camera redness · left cheek", unit: "Δa*", dec: 1, color: "--c-cam", source: "camera", roi: "cheekL" },
    { id: "camCheekR", ko: "카메라 붉기 · 오른뺨", en: "Camera redness · right cheek", unit: "Δa*", dec: 1, color: "--c-cam", source: "camera", roi: "cheekR" },
    { id: "camLips", ko: "카메라 붉기 · 입술 (기록·표시만)", en: "Camera redness · lips (log/display only)", unit: "Δa*", dec: 1, color: "--c-cam", source: "camera", roi: "lips" },
    { id: "camEye", ko: "카메라 붉기 · 눈 주변", en: "Camera redness · periocular", unit: "Δa*", dec: 1, color: "--c-cam", source: "camera", roi: "eye" },
    { id: "camSkin", ko: "카메라 붉기 · 선택 부위", en: "Camera redness · chosen site", unit: "Δa*", dec: 1, color: "--c-cam", source: "camera" },
    { id: "camHr", ko: "카메라 심박 (보조)", en: "Camera HR (aux)", unit: "bpm", dec: 0, color: "--c-cam", source: "camera" },
    { id: "camResp", ko: "카메라 호흡수 (기록만)", en: "Camera resp. rate (log only)", unit: "/min", dec: 0, color: "--c-cam", source: "camera" },
  ];
  // 선택 입력 (장비 존재 [미확인])
  const OPTIONAL_INPUTS = [
    { id: "bpSys", ko: "수축기 혈압", en: "Systolic BP", unit: "mmHg", min: 60, max: 250, step: 1 },
    { id: "bpDia", ko: "이완기 혈압", en: "Diastolic BP", unit: "mmHg", min: 30, max: 150, step: 1 },
    { id: "spo2", ko: "SpO₂ (기록만)", en: "SpO₂ (log only)", unit: "%", min: 50, max: 100, step: 1 },
  ];

  /* ───────────── SYMPTOM MODULES & SYMPTOMS (§6.2) ───────────── */
  const MODULES = [
    { id: "neuro", ko: "머리·신경", en: "Head & neuro" }, { id: "eye", ko: "눈", en: "Eyes" }, { id: "ent", ko: "귀·코·목·호흡", en: "Ear·nose·throat·breathing" },
    { id: "chest", ko: "가슴·심장", en: "Chest & heart" }, { id: "gi", ko: "배·소화", en: "Abdomen & digestion" }, { id: "gu", ko: "비뇨", en: "Urinary" },
    { id: "msk", ko: "근골격·통증", en: "Muscles, bones & pain" }, { id: "skin", ko: "피부", en: "Skin" }, { id: "dental", ko: "치아·입", en: "Teeth & mouth" },
    { id: "mental", ko: "정신·수면", en: "Mind & sleep" }, { id: "general", ko: "전신", en: "General" }, { id: "exposure", ko: "노출·사건", en: "Exposure & events" },
  ];
  // [id, module, ko, en, mapsTo[], redFlag]
  const S = (id, module, ko, en, mapsTo, redFlag) => ({ id, module, ko, en, mapsTo, redFlag: !!redFlag, followUps: ["onset", "severity"] });
  const SYMPTOMS = [
    S("headache", "neuro", "두통", "Headache", ["headache"]),
    S("headacheSudden", "neuro", "갑작스러운 극심한 두통", "Sudden severe headache", ["stroke"], 1),
    S("dizziness", "neuro", "어지러움", "Dizziness", ["sas", "anemia"]),
    S("faceDroop", "neuro", "얼굴 한쪽 처짐", "Facial droop", ["stroke"], 1),
    S("weakOneSide", "neuro", "한쪽 팔다리 힘 빠짐", "One-sided weakness", ["stroke"], 1),
    S("slurred", "neuro", "말이 어눌함", "Slurred speech", ["stroke"], 1),
    S("seizure", "neuro", "발작", "Seizure", ["seizure"], 1),
    S("headInjury", "neuro", "머리 충격·부상", "Head impact / injury", ["seizure"]),
    S("paresthesia", "neuro", "저림·이상감각", "Tingling / paresthesia", ["neuropathy", "evahand"]),
    S("eyePain", "eye", "눈 통증", "Eye pain", ["eyeabrasion", "eyeinfect"]),
    S("eyeFb", "eye", "이물감", "Foreign-body sensation", ["eyeabrasion", "eyefb"]),
    S("eyeTearing", "eye", "눈물 흘림", "Tearing", ["eyeabrasion"]),
    S("eyeRed", "eye", "충혈", "Red eye", ["eyeinfect", "eyeabrasion"]),
    S("eyeDischarge", "eye", "눈 분비물", "Eye discharge", ["eyeinfect"]),
    S("visionChange", "eye", "시야 변화 (흐림·원시화)", "Vision change (blur, farsightedness)", ["sans"]),
    S("visionLossAcute", "eye", "갑작스러운 시력 저하·상실", "Sudden vision loss", ["eyeacute"], 1),
    S("eyeSevere", "eye", "극심한 눈 통증", "Severe eye pain", ["eyeacute", "eyechem"], 1),
    S("eyeChem", "eye", "눈에 화학물질이 들어감", "Chemical in the eye", ["eyechem"], 1),
    S("congestion", "ent", "코막힘", "Nasal congestion", ["congestion"]),
    S("soreThroat", "ent", "인후통", "Sore throat", ["pharyngitis", "respinf"]),
    S("cough", "ent", "기침", "Cough", ["respinf"]),
    S("sputum", "ent", "가래", "Sputum", ["respinf"]),
    S("wheeze", "ent", "쌕쌕거림", "Wheezing", ["asthma"]),
    S("dyspneaRest", "ent", "쉬는 중에도 숨이 참", "Short of breath at rest", ["asthma", "choking"], 1),
    S("throatTight", "ent", "목·혀가 조이는 느낌", "Throat or tongue tightness", ["allergy"], 1),
    S("earPain", "ent", "귀 통증·먹먹함", "Ear pain / fullness", ["ear", "congestion"]),
    S("nosebleed", "ent", "코피", "Nosebleed", ["epistaxis"]),
    S("chestPain", "chest", "흉통", "Chest pain", ["acs"], 1),
    S("palpitations", "chest", "두근거림", "Palpitations", ["arrhythmia"]),
    S("nearFaint", "chest", "실신할 것 같음 / 실신", "Near-fainting / fainting", ["arrhythmia", "acs"], 1),
    S("coldSweat", "chest", "식은땀", "Cold sweat", ["acs"]),
    S("nausea", "gi", "구역", "Nausea", ["sas", "ars"]),
    S("abdPain", "gi", "복통", "Abdominal pain", ["diarrhea", "acuteabd"]),
    S("abdPainSevere", "gi", "심한 복통", "Severe abdominal pain", ["acuteabd"], 1),
    S("vomitPersist", "gi", "구토가 멈추지 않음", "Persistent vomiting", ["acuteabd", "diarrhea"], 1),
    S("abdRigid", "gi", "배가 딱딱하게 굳음", "Rigid abdomen", ["acuteabd"], 1),
    S("diarrhea", "gi", "설사", "Diarrhoea", ["diarrhea"]),
    S("constipation", "gi", "변비", "Constipation", ["constipation"]),
    S("dyspepsia", "gi", "소화불량·속쓰림", "Indigestion / reflux", ["diarrhea"]),
    S("dysuria", "gu", "배뇨통", "Painful urination", ["uti"]),
    S("frequency", "gu", "빈뇨", "Frequent urination", ["uti"]),
    S("hematuria", "gu", "혈뇨", "Blood in urine", ["nephrolithiasis", "uti"]),
    S("flankSevere", "gu", "심한 옆구리 통증", "Severe flank pain", ["nephrolithiasis"], 1),
    S("urineRetention", "gu", "소변이 나오지 않음·새어 나옴", "Cannot urinate / leaking", ["urinary"]),
    S("backPain", "msk", "허리·고관절 통증", "Back / hip pain", ["backpain"]),
    S("jointPain", "msk", "어깨·무릎 등 관절 통증", "Shoulder, knee or other joint pain", ["sprain"]),
    S("deformity", "msk", "팔다리 변형", "Limb deformity", ["fracture"], 1),
    S("cannotUse", "msk", "팔다리를 쓸 수 없음", "Cannot use a limb", ["fracture", "mskother"], 1),
    S("legSwelling", "msk", "한쪽 다리·팔 붓기·통증", "One-sided leg/arm swelling or pain", ["dvt"]),
    S("rash", "skin", "발진", "Rash", ["rash", "allergy"]),
    S("itch", "skin", "가려움", "Itching", ["rash", "allergy"]),
    S("hives", "skin", "두드러기", "Hives", ["allergy"]),
    S("blister", "skin", "물집·수포", "Blisters", ["zoster", "burn"]),
    S("wound", "skin", "상처·찰과상", "Wound / abrasion", ["skinabrasion", "laceration"]),
    S("bleedUncontrolled", "skin", "멈추지 않는 출혈", "Bleeding that will not stop", ["laceration", "hemshock"], 1),
    S("faceSwelling", "skin", "얼굴·입술 붓기", "Face or lip swelling", ["allergy", "abscess"]),
    S("burnMinor", "skin", "작은 화상", "Minor burn", ["burn"]),
    S("burnMajor", "skin", "얼굴·손·넓은 범위 또는 물집 있는 화상", "Burn on face/hands, large area or blistered", ["burn", "chemskin"], 1),
    S("toothache", "dental", "치통", "Toothache", ["dentalcaries", "abscess"]),
    S("mouthUlcer", "dental", "입안 궤양", "Mouth ulcer", ["mouthulcer"]),
    S("toothFracture", "dental", "치아 깨짐·충전물 빠짐", "Broken tooth / lost filling", ["dentalcaries"]),
    S("lowMood", "mental", "기분 저하", "Low mood", ["depression"]),
    S("anxiety", "mental", "불안", "Anxiety", ["stress"]),
    S("apathy", "mental", "무기력", "Apathy / low energy", ["depression"]),
    S("poorFocus", "mental", "집중 곤란", "Poor concentration", ["stress"]),
    S("poorSleepQ", "mental", "잠의 질이 나쁨", "Poor sleep quality", ["insomnia"]),
    S("hallucination", "mental", "환각·망상·심한 혼란", "Hallucinations / delusions / severe confusion", ["psychcrisis"], 1),
    S("safety", "mental", "자신이나 남을 해치고 싶은 생각", "Thoughts of harming yourself or others", ["psychcrisis"], 1),
    S("feverChills", "general", "열감·오한", "Feeling feverish / chills", ["respinf", "sepsis"]),
    S("fatigue", "general", "심한 피로", "Marked fatigue", ["anemia", "ars"]),
    S("confusion", "general", "의식 혼미·심한 무기력", "Confusion / marked lethargy", ["sepsis"], 1),
    S("chemSkin", "exposure", "피부에 화학물질 노출", "Chemical on skin", ["chemskin"], 1),
    S("smoke", "exposure", "연기·이상한 냄새 노출", "Smoke / unusual odour exposure", ["toxinhal"]),
    S("pressure", "exposure", "압력 변화 느낌 (귀·관절)", "Pressure change sensation (ears/joints)", ["dcs", "congestion"]),
    S("medTaken", "exposure", "약 복용", "Took medication", ["medication"]),
    S("medOversedation", "exposure", "약 복용 후 심한 졸림·느린 호흡", "Very drowsy or slow breathing after medication", ["medication"], 1),
  ];

  /* ───────────── RULES ─────────────
   * when 문법: {ch, gte|gt|lte|lt}=오늘 값 / {ch, dBase:{gte|lte}}=오늘−기준선 / {sym} / {symAny:[]}
   *           {cam:'face'|'eye'|'skin', gte} = Δa* / {flux:{gte}} / {event:'shelter'} / {all:[]} / {any:[]}
   * tile: 채널 id 또는 증상 모듈 id ('m:eye' 형식) 또는 'rad'. level 3 규칙은 card를 가짐. */
  const ACT = (ko, en) => ({ ko, en });
  const RULES = [
    // ① 기준선 대비 (§9) — 전부 데모 임계값
    { id: "sleep1", type: "baseline", tile: "sleep", level: 1, when: { ch: "sleep", dBase: { lte: -1 } }, evidenceLevel: "B", sources: ["rSleep", "appE"], action: ACT("취침 환경·일정 점검, 내일 재확인", "Review sleep schedule/environment; recheck tomorrow") },
    { id: "sleep2", type: "baseline", tile: "sleep", level: 2, when: { ch: "sleep", dBase: { lte: -2 } }, evidenceLevel: "B", sources: ["rSleep", "appE"], action: ACT("작업 부하 조정 요청, 지상 수면 지원 연락", "Request workload change; contact ground sleep support") },
    { id: "stress1", type: "baseline", tile: "stress", level: 1, when: { ch: "stress", dBase: { gte: 1 } }, evidenceLevel: "B", sources: ["rBehavior"], action: ACT("휴식·대화 시간 확보", "Schedule rest / talk time") },
    { id: "stress2", type: "baseline", tile: "stress", level: 2, when: { ch: "stress", dBase: { gte: 2 } }, evidenceLevel: "B", sources: ["rBehavior"], action: ACT("지상 심리 지원 연락 권고", "Contact ground behavioural support") },
    { id: "hr1", type: "baseline", tile: "hr", level: 1, when: { ch: "hr", dBase: { gte: 10 } }, evidenceLevel: "B", sources: ["rCardio"], action: ACT("휴식 후 재측정", "Rest and re-measure") },
    { id: "hr2", type: "baseline", tile: "hr", level: 2, when: { ch: "hr", dBase: { gte: 20 } }, evidenceLevel: "B", sources: ["rCardio"], action: ACT("지상 의료진 연락 권고", "Contact ground flight surgeon") },
    { id: "temp1", type: "baseline", tile: "temp", level: 1, when: { ch: "temp", dBase: { gte: 0.8 } }, evidenceLevel: "B", sources: ["rImmune"], action: ACT("4시간 후 체온·증상 재측정", "Re-measure temp/symptoms in 4 h") },
    { id: "temp2", type: "baseline", tile: "temp", level: 2, when: { ch: "temp", gte: 38.0 }, evidenceLevel: "B", sources: ["rImmune"], action: ACT("접촉 최소화, 지상 의료진 연락", "Limit contact; contact ground flight surgeon") },
    { id: "co2a", type: "baseline", tile: "co2", level: 1, when: { any: [{ ch: "co2", dBase: { gte: 2 } }, { sym: "headache" }] }, evidenceLevel: "B", sources: ["appE"], action: ACT("환기·CO₂ 측정 재확인", "Recheck ventilation / CO₂ reading") },
    { id: "co2b", type: "combo", tile: "co2", level: 2, when: { any: [{ ch: "co2", dBase: { gte: 4 } }, { all: [{ ch: "co2", dBase: { gte: 2 } }, { sym: "headache" }] }] }, evidenceLevel: "B", sources: ["appE"], action: ACT("지상 환경 담당 보고, 작업 중단 검토", "Report to ground environment team; consider stopping work") },
    { id: "intake1", type: "baseline", tile: "intake", level: 1, when: { ch: "intake", lt: 85 }, evidenceLevel: "B", sources: ["rNutrition"], action: ACT("식단 보충 계획 확인", "Review supplemental food plan") },
    { id: "intake2", type: "baseline", tile: "intake", level: 2, when: { ch: "intake", lt: 70 }, evidenceLevel: "B", sources: ["rNutrition"], action: ACT("지상 영양 담당 보고", "Report to ground nutrition support") },
    { id: "ex1", type: "baseline", tile: "ex", level: 1, when: { ch: "ex", lt: 60 }, evidenceLevel: "B", sources: ["rFitness"], action: ACT("오늘 운동 보충", "Make up exercise today") },
    { id: "ex2", type: "baseline", tile: "ex", level: 2, when: { ch: "ex", lt: 30 }, evidenceLevel: "B", sources: ["rFitness"], action: ACT("운동 중단 사유 확인, 지상 보고", "Check why exercise stopped; report to ground") },
    { id: "bp1", type: "baseline", tile: "bp", level: 1, when: { any: [{ ch: "bpSys", gte: 140 }, { ch: "bpDia", gte: 90 }] }, evidenceLevel: "B", sources: ["appE"], action: ACT("휴식 후 재측정, 기록", "Rest, re-measure and log"), note: "임계값 출처 [미확인]" },
    // ⑤ 이벤트
    { id: "rad2", type: "event", tile: "rad", level: 2, when: { flux: { gte: 10 } }, evidenceLevel: "B", sources: ["noaa", "hrpHazards"], action: ACT("임무 절차·지상 안내 확인, 대피 지시 대기", "Check mission procedure / ground guidance; await shelter instruction") },
    { id: "rad3", type: "event", tile: "rad", level: 3, card: "R1", when: { event: "shelter" }, evidenceLevel: "C", sources: ["noaa", "hrpHazards"], action: ACT("응급 카드 R1 실행", "Run card R1") },
    // ④ 카메라 (자기 채널 최대 1)
    { id: "camFace1", type: "camera", detection: "D0", tile: "camFace", level: 1, when: { cam: "face", gte: 3 }, evidenceLevel: "B", sources: ["appE"], action: ACT("기준 대비 붉기 변화 있음, 확인 필요", "Redness changed vs baseline — check") },
    { id: "camEye1", type: "camera", detection: "D0", tile: "camEye", level: 1, when: { cam: "eye", gte: 3 }, evidenceLevel: "B", sources: ["appE", "eyeNpj2023"], action: ACT("기준 대비 붉기 변화 있음, 확인 필요", "Redness changed vs baseline — check") },
    // ROI별 단독 규칙(케이스 C045–C049) — 카메라 단독 = 최대 주의(1), 감지 근거 D0, 임계 +3은 데모 값 [설계 선택]
    { id: "camForehead1", type: "camera", tile: "camForehead", level: 1, when: { cam: "forehead", gte: 3 }, evidenceLevel: "B", detection: "D0", sources: ["appE"], action: ACT("기준 대비 붉기 변화 있음, 확인 필요", "Redness changed vs baseline — check") },
    { id: "camCheekL1", type: "camera", tile: "camCheekL", level: 1, when: { cam: "cheekL", gte: 3 }, evidenceLevel: "B", detection: "D0", sources: ["appE"], action: ACT("기준 대비 붉기 변화 있음, 확인 필요", "Redness changed vs baseline — check") },
    { id: "camCheekR1", type: "camera", tile: "camCheekR", level: 1, when: { cam: "cheekR", gte: 3 }, evidenceLevel: "B", detection: "D0", sources: ["appE"], action: ACT("기준 대비 붉기 변화 있음, 확인 필요", "Redness changed vs baseline — check") },
    { id: "camLips1", type: "camera", tile: "camLips", level: 1, when: { cam: "lips", gte: 3 }, evidenceLevel: "B", detection: "D0", sources: ["appE"], action: ACT("기준 대비 붉기 변화 기록됨 (판정 아님)", "Redness change logged vs baseline (no judgement)") },
    { id: "camSkin1", type: "camera", detection: "D0", tile: "camSkin", level: 1, when: { cam: "skin", gte: 3 }, evidenceLevel: "B", sources: ["appE"], action: ACT("기준 대비 붉기 변화 있음, 확인 필요", "Redness changed vs baseline — check") },
    // 카메라 + 증상 결합 → 해당 모듈 조치(2) [설계 선택]
    { id: "camSkinCombo", type: "combo", tile: "m:skin", level: 2, when: { all: [{ any: [{ cam: "face", gte: 3 }, { cam: "skin", gte: 3 }] }, { symAny: ["rash", "itch", "hives", "faceSwelling"] }] }, evidenceLevel: "B", sources: ["appE", "rImmune"], action: ACT("사진 첨부해 지상 보고, 변화 추적", "Attach photos, report to ground, track change") },
    { id: "camEyeCombo", type: "combo", tile: "m:eye", level: 2, when: { all: [{ cam: "eye", gte: 3 }, { symAny: ["eyePain", "eyeRed", "eyeFb"] }] }, evidenceLevel: "B", sources: ["appE", "eyeNpj2023"], action: ACT("눈 사진 첨부해 지상 보고", "Attach eye photo and report to ground") },
    // ② 증상 플래그 (특정)
    { id: "sans2", type: "flag", tile: "m:eye", level: 2, when: { sym: "visionChange" }, evidenceLevel: "B", sources: ["rSans"], action: ACT("증상 시작 시각 기록, 지상 보고 (카메라로 확인 불가)", "Log onset; report to ground (camera cannot assess)") },
    { id: "flank2", type: "flag", tile: "m:gu", level: 2, when: { sym: "flankSevere" }, evidenceLevel: "B", sources: ["appE"], action: ACT("수분 섭취 기록, 지상 의료진 연락", "Log fluid intake; contact ground flight surgeon") },
    { id: "back2", type: "combo", tile: "m:msk", level: 2, when: { all: [{ sym: "backPain" }, { ch: "ex", lt: 30 }] }, evidenceLevel: "B", sources: ["rBone", "appE"], action: ACT("지상 보고, 운동 프로토콜 점검", "Report to ground; review exercise protocol") },
    { id: "uti2", type: "combo", tile: "m:gu", level: 2, when: { all: [{ symAny: ["dysuria", "frequency"] }, { ch: "temp", gte: 38.0 }] }, evidenceLevel: "B", sources: ["appE"], action: ACT("지상 의료진 연락", "Contact ground flight surgeon") },
    { id: "resp2", type: "combo", tile: "m:ent", level: 2, when: { all: [{ symAny: ["cough", "soreThroat", "sputum"] }, { ch: "temp", dBase: { gte: 0.8 } }] }, evidenceLevel: "B", sources: ["appE", "rImmune"], action: ACT("접촉 최소화, 지상 의료진 연락", "Limit contact; contact ground flight surgeon") },
    { id: "gi2", type: "combo", tile: "m:gi", level: 2, when: { all: [{ symAny: ["diarrhea", "vomitPersist", "abdPain"] }, { any: [{ ch: "intake", lt: 70 }, { ch: "temp", gte: 38.0 }] }] }, evidenceLevel: "B", sources: ["appE"], action: ACT("수분 보충 기록, 지상 보고", "Log fluids; report to ground") },
    // ③ 응급 카드 트리거 (§5) — 데모, 근거 수준 C
    { id: "cardR2", type: "combo", tile: "temp", level: 3, card: "R2", when: { all: [{ ch: "temp", gte: 38.0 }, { ch: "hr", dBase: { gte: 20 } }, { sym: "confusion" }] }, evidenceLevel: "C", sources: ["rImmune", "appE"], action: ACT("응급 카드 R2 실행", "Run card R2") },
    { id: "cardR3", type: "flag", tile: "m:eye", level: 3, card: "R3", when: { symAny: ["eyeChem", "eyeSevere", "visionLossAcute"] }, evidenceLevel: "C", sources: ["meer2023", "appE"], action: ACT("응급 카드 R3 실행", "Run card R3") },
    { id: "cardR4", type: "combo", tile: "m:skin", level: 3, card: "R4", when: { all: [{ symAny: ["hives", "itch", "faceSwelling"] }, { symAny: ["dyspneaRest", "throatTight", "dizziness"] }] }, evidenceLevel: "C", sources: ["appE", "rImmune"], action: ACT("응급 카드 R4 실행", "Run card R4") },
    { id: "cardR5", type: "combo", tile: "m:chest", level: 3, card: "R5", when: { any: [{ all: [{ sym: "chestPain" }, { any: [{ ch: "hr", dBase: { gte: 20 } }, { sym: "nearFaint" }, { sym: "coldSweat" }, { sym: "dyspneaRest" }] }] }, { sym: "nearFaint" }] }, evidenceLevel: "C", sources: ["appE", "rCardio"], action: ACT("응급 카드 R5 실행", "Run card R5") },
    { id: "cardR6", type: "combo", tile: "m:neuro", level: 3, card: "R6", when: { any: [{ symAny: ["faceDroop", "weakOneSide", "slurred", "seizure"] }, { all: [{ sym: "headInjury" }, { sym: "confusion" }] }] }, evidenceLevel: "C", sources: ["appE"], action: ACT("응급 카드 R6 실행", "Run card R6") },
    { id: "cardR7", type: "combo", tile: "m:gi", level: 3, card: "R7", when: { all: [{ sym: "abdPainSevere" }, { any: [{ sym: "vomitPersist" }, { ch: "temp", gte: 38.0 }, { sym: "abdRigid" }] }] }, evidenceLevel: "C", sources: ["appE"], action: ACT("응급 카드 R7 실행", "Run card R7") },
    { id: "cardR8", type: "flag", tile: "m:msk", level: 3, card: "R8", when: { symAny: ["deformity", "cannotUse", "bleedUncontrolled"] }, evidenceLevel: "C", sources: ["appE"], action: ACT("응급 카드 R8 실행", "Run card R8") },
    { id: "cardR9", type: "flag", tile: "m:skin", level: 3, card: "R9", when: { symAny: ["burnMajor", "chemSkin"] }, evidenceLevel: "C", sources: ["appE"], action: ACT("응급 카드 R9 실행", "Run card R9") },
    { id: "cardR10", type: "flag", tile: "m:ent", level: 3, card: "R10", when: { sym: "dyspneaRest" }, evidenceLevel: "C", sources: ["appE"], action: ACT("응급 카드 R10 실행", "Run card R10") },
    { id: "cardR12", type: "flag", tile: "m:mental", level: 3, card: "R12", when: { symAny: ["safety", "hallucination"] }, evidenceLevel: "C", sources: ["rBehavior", "appE"], action: ACT("응급 카드 R12 실행", "Run card R12") },
    { id: "cardR13", type: "flag", tile: "m:exposure", level: 3, card: "R13", when: { sym: "medOversedation" }, evidenceLevel: "C", sources: ["appE"], action: ACT("응급 카드 R13 실행", "Run card R13") },
  ];
  // 증상 일반 규칙: 체크한 증상 → 해당 모듈 주의(1), redFlag → 조치(2). 출처: Appendix E. [설계 선택]
  for (const s of SYMPTOMS) {
    RULES.push({ id: "sym_" + s.id, type: "flag", tile: "m:" + s.module, level: s.redFlag ? 2 : 1, when: { sym: s.id }, evidenceLevel: "B", sources: ["appE"], generic: true,
      action: s.redFlag ? ACT("시작 시각·강도 기록, 지상 연락", "Log onset and severity; contact ground") : ACT("기록 후 내일 재확인", "Log it and recheck tomorrow") });
  }
  for (const r of RULES) r.thresholdIsDemo = true;

  /* ───────────── CARDS (§5) ───────────── */
  const st = (ko, en) => ({ ko, en });
  const CARDS = [
    { id: "R1", ko: "방사선 이벤트 대피", en: "Radiation event — shelter", trigger: ["rad3"], manualOnly: false, photoSlots: [], evidence: "C", sources: ["noaa", "hrpHazards"],
      triggerText: st("대피 지시 수신(모의). 합성 플럭스 ≥10 pfu는 조치(2)까지", "Shelter instruction received (simulated). Synthetic flux ≥10 pfu only reaches Act (2)"),
      steps: [st("경보 출처 확인 (지상 / 온보드 모니터)", "Confirm the alert source (ground / onboard monitor)"), st("지정 차폐 구역으로 이동", "Move to the designated shelter area"), st("시각·위치·동행 승무원 기록", "Log time, location and crew present"), st("선량계 값 기록, 해제 지시까지 대기", "Record dosimeter reading; stay until cleared"), st("해제 후 증상 확인 (구역·피로) 및 기록", "After clearance, check and log symptoms (nausea, fatigue)")] },
    { id: "R2", ko: "감염 악화 (패혈증 의심)", en: "Infection worsening (suspected sepsis)", trigger: ["cardR2"], manualOnly: false, photoSlots: ["skin", "mouth", "leg"], evidence: "C", sources: ["rImmune", "appE"],
      triggerText: st("체온 ≥38.0 + 심박 기준선 +20 + 의식 혼미", "Temp ≥38.0 + HR baseline +20 + confusion"),
      steps: [st("체온·심박·의식 15분 간격 재측정", "Re-measure temp, HR, mental status every 15 min"), st("다른 승무원과 접촉 최소화", "Limit contact with other crew"), st("온보드 감염 의심 절차서 열기 (이 카드는 처치를 지시하지 않음)", "Open the onboard suspected-infection checklist (this card does not prescribe treatment)"), st("증상 시작·경과 기록", "Log symptom onset and progression")] },
    { id: "R3", ko: "눈 화학물질·눈 외상·급성 시야 상실", en: "Chemical eye / eye trauma / acute vision loss", trigger: ["cardR3"], manualOnly: false, photoSlots: ["eye"], evidence: "C", sources: ["meer2023", "appE"],
      triggerText: st("눈에 화학물질·극심한 눈 통증 / 급성 시력 상실", "Chemical in eye, severe eye pain or acute vision loss"),
      steps: [st("즉시 눈 세척 시작, 중단 없이 계속", "Start flushing the eye immediately and keep going"), st("눈 비비지 않기, 가능하면 렌즈 제거", "Do not rub; remove contact lenses if possible"), st("물질 종류 확인·기록", "Identify and log the substance"), st("세척 후 통증·시야 재평가", "Re-assess pain and vision after flushing"), st("표준 안구 사진 촬영·첨부", "Take and attach a standard eye photo")] },
    { id: "R4", ko: "알레르기·아나필락시스", en: "Allergic reaction / anaphylaxis", trigger: ["cardR4"], manualOnly: false, photoSlots: ["face"], evidence: "C", sources: ["appE", "rImmune"],
      triggerText: st("(두드러기·가려움·붓기) + (호흡곤란·목/혀 조임·어지러움)", "(hives/itch/swelling) + (breathlessness/throat tightness/dizziness)"),
      steps: [st("노출 원인 제거", "Remove the exposure"), st("온보드 키트 절차서 열기", "Open the onboard kit checklist"), st("호흡·의식 15분 간격 기록", "Log breathing and consciousness every 15 min"), st("즉시 지상 연락", "Contact ground immediately")] },
    { id: "R5", ko: "흉통·심장 증상", en: "Chest pain / cardiac symptoms", trigger: ["cardR5"], manualOnly: false, photoSlots: [], evidence: "C", sources: ["appE", "rCardio"],
      triggerText: st("흉통 + (심박 +20·실신 느낌·식은땀·호흡곤란) / 실신", "Chest pain + (HR +20, near-faint, cold sweat or breathlessness) / fainting"),
      steps: [st("안정·자세 유지", "Rest and hold position"), st("증상 시작 시각·양상 기록", "Log onset time and character"), st("심박 15분 간격 기록", "Log HR every 15 min"), st("즉시 지상 연락", "Contact ground immediately")] },
    { id: "R6", ko: "뇌졸중 의심·발작·두부 외상", en: "Suspected stroke / seizure / head injury", trigger: ["cardR6"], manualOnly: false, photoSlots: ["face"], evidence: "C", sources: ["appE"],
      triggerText: st("얼굴 처짐·한쪽 힘 빠짐·말 어눌 / 발작 / 두부 외상 + 의식 변화", "Facial droop, one-sided weakness, slurred speech / seizure / head injury + altered consciousness"),
      steps: [st("증상 시작 시각 기록", "Log symptom onset time"), st("의식 상태 기록", "Log level of consciousness"), st("주변 안전 확보", "Make the surroundings safe"), st("즉시 지상 연락", "Contact ground immediately")] },
    { id: "R7", ko: "급성 복증", en: "Acute abdomen", trigger: ["cardR7"], manualOnly: false, photoSlots: [], evidence: "C", sources: ["appE"],
      triggerText: st("심한 복통 + (지속 구토·체온 ≥38·복부 경직)", "Severe abdominal pain + (persistent vomiting, temp ≥38 or rigid abdomen)"),
      steps: [st("통증 위치·시작 시각 기록", "Log pain location and onset"), st("금식 여부 확인", "Check fasting status"), st("체온 재측정", "Re-measure temperature"), st("지상 연락", "Contact ground")] },
    { id: "R8", ko: "외상·출혈·골절 의심", en: "Trauma / bleeding / suspected fracture", trigger: ["cardR8"], manualOnly: false, photoSlots: ["wound"], evidence: "C", sources: ["appE"],
      triggerText: st("변형·사용 불가 / 멈추지 않는 출혈", "Deformity or loss of use / bleeding that will not stop"),
      steps: [st("직접 압박으로 지혈", "Apply direct pressure to bleeding"), st("부위 고정", "Immobilise the area"), st("시각·기전 기록", "Log time and mechanism"), st("지상 연락", "Contact ground")] },
    { id: "R9", ko: "화상", en: "Burn", trigger: ["cardR9"], manualOnly: false, photoSlots: ["wound"], evidence: "C", sources: ["appE"],
      triggerText: st("얼굴·손·넓은 범위·수포 화상 / 피부 화학물질", "Burn on face/hands, large or blistered / chemical on skin"),
      steps: [st("열원·화학물질 제거", "Remove heat source / chemical"), st("흐르는 물로 식히기", "Cool with running water"), st("깨끗이 덮기", "Cover cleanly"), st("범위·시각 기록", "Log extent and time")] },
    { id: "R10", ko: "호흡곤란·기도", en: "Breathing difficulty / airway", trigger: ["cardR10"], manualOnly: false, photoSlots: [], evidence: "C", sources: ["appE"],
      triggerText: st("휴식 중 호흡곤란 / 수동 시작(질식·흡입)", "Breathless at rest / manual start (choking, inhalation)"),
      steps: [st("자세·환기 확인", "Check posture and ventilation"), st("호흡수·의식 기록", "Log breathing rate and consciousness"), st("즉시 지상 연락", "Contact ground immediately")] },
    { id: "R11", ko: "환경 노출 사고 (수동 시작 전용)", en: "Environmental exposure (manual start only)", trigger: [], manualOnly: true, photoSlots: ["other"], evidence: "C", sources: ["ntrsEmerg", "appE"],
      triggerText: st("앱은 감지하지 않음 — ISS 환경 경보 체계 몫", "Not detected by this app — handled by the station's environment alarms"),
      steps: [st("선내 경보 절차 우선", "Station alarm procedure comes first"), st("건강 영향(증상·시각·노출 물질) 기록·보고", "Log and report health effects (symptoms, time, substance)")] },
    { id: "R12", ko: "행동·정신 위기", en: "Behavioural / psychiatric crisis", trigger: ["cardR12"], manualOnly: false, photoSlots: [], evidence: "C", sources: ["rBehavior", "appE"],
      triggerText: st("안전 문항 양성 / 환각·망상·심한 혼란", "Safety item positive / hallucinations, delusions or severe confusion"),
      steps: [st("혼자 두지 않기·안전 확보", "Do not leave the person alone; make safe"), st("즉시 지상 심리 지원 연락", "Contact ground psychological support immediately")] },
    { id: "R13", ko: "약물 과다·이상반응", en: "Medication overdose / adverse reaction", trigger: ["cardR13"], manualOnly: false, photoSlots: [], evidence: "C", sources: ["appE"],
      triggerText: st("수동 시작 / 복용 후 심한 졸림·느린 호흡", "Manual start / very drowsy or slow breathing after medication"),
      steps: [st("복용 약·양·시각 기록", "Log drug, dose and time"), st("호흡·의식 확인", "Check breathing and consciousness"), st("즉시 지상 연락", "Contact ground immediately")] },
  ];
  // 공통 골격의 교신 분기 단계 (§5)
  const COMMS_STEPS = {
    yes: [st("영문 보고서를 지상에 전송하고 지시 확인", "Send the English report to ground and confirm instructions")],
    no: [st("온보드 절차 계속, 15분마다 활력징후 재기록", "Continue onboard procedure; re-log vitals every 15 min"), st("30분마다 교신 재시도 (보고서 준비됨)", "Retry comms every 30 min (report is ready)")],
  };

  /* ───────────── 근거 부족으로 제외한 항목 (§14) ───────────── */
  const EXCLUDED = [
    st("눈 깜빡임·졸음(PERCLOS)·안면 비대칭 자동 판정 — 신뢰할 얼굴 추적 없음, 근거 부재(D0). 졸음 근거는 운전자 8명 시뮬레이터뿐", "Blink / drowsiness (PERCLOS) / facial asymmetry auto-detection — no reliable face tracking, no evidence (D0); drowsiness evidence is an 8-driver simulator study only"),
    st("카메라 뇌졸중 판정 — 240명 학회 초록, 정확도 수치 없음 → 사진 첨부만", "Camera stroke detection — 240-person abstract, no accuracy figures → photo attachment only"),
    st("카메라 빈혈 판정 — 특이도 72–76% 수준, 오탐 많음 → 사진 비교만", "Camera anaemia judgement — specificity ~72–76%, many false positives → photo comparison only"),
    st("방사선 실데이터 재생 — RadLab/NOAA 접근 [미확인] → 합성 곡선 유지", "Real radiation replay — RadLab/NOAA access [unverified] → synthetic curve kept"),
    st("환경 경보 자체 감지 — ISS 환경 경보 체계 몫(NTRS 20220019247) → R11 수동 카드", "Environment alarm detection — station alarm system's job (NTRS 20220019247) → manual card R11"),
  ];

  Object.assign(UJ, { SOURCES, CATEGORIES, CONDITIONS, CHANNELS, OPTIONAL_INPUTS, MODULES, SYMPTOMS, RULES, CARDS, COMMS_STEPS, EXCLUDED });
})(typeof window !== "undefined" ? window : globalThis);
