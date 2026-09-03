import React, { useState, useMemo, useEffect } from "react";
import { FIXED_SOLAIRE, FIXED_PAC, FIXED_PV, FIXED_VENTILATION } from "./data/questionBanks.js";

/* ---------------------------------------------------------
   Design tokens — "blueprint" aesthetic grounded in the
   subject: the CESI schémas in the original course already
   use dashed control-boxes, red (chaud) / blue (froid) lines.
   This leans into that vocabulary and animates it.
--------------------------------------------------------- */
const T = {
  navy: "#0E2A3F",
  navyDeep: "#081A28",
  panel: "#123448",
  grid: "#1C4A5E",
  ink: "#EAF2F5",
  inkDim: "#9FBAC7",
  copper: "#E8793A",
  copperDim: "#8A4A2A",
  azure: "#4FB3D9",
  gold: "#F2B705",
  good: "#5FBF8F",
};

const FONT_DISPLAY = "'Space Grotesk', 'IBM Plex Sans', sans-serif";
const FONT_BODY = "'IBM Plex Sans', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

/* ---------------------------------------------------------
   Progress tracking — talks to the cesi-tracker Worker (D1-backed).
   Minimal fields only (team name, scores, counts) per RGPD
   data-minimization; see cesi-tracker/DEPLOY.md for the notice text.
   TRACKER_URL is set once the worker is deployed (see DEPLOY.md);
   until then, tracking calls fail silently and the site works
   exactly as before.
--------------------------------------------------------- */
const TRACKER_URL = "https://cesi-tracker.nscottarthur.workers.dev"; // deployed 2026-08-31
const AUTH_TOKEN_KEY = "cesi_auth_token";
const AUTH_TEAM_KEY = "cesi_auth_team";

function getAuth() {
  try {
    return { token: localStorage.getItem(AUTH_TOKEN_KEY) || "", team: localStorage.getItem(AUTH_TEAM_KEY) || "" };
  } catch {
    return { token: "", team: "" };
  }
}
function setAuth(token, team) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_TEAM_KEY, team);
  } catch {}
}
function clearAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TEAM_KEY);
  } catch {}
}
async function authFetch(path, body) {
  if (!TRACKER_URL) return null;
  const { token } = getAuth();
  if (!token) return null;
  try {
    return await fetch(`${TRACKER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body || {}),
    });
  } catch {
    return null;
  }
}
function trackEvent(payload) {
  authFetch("/api/track", payload);
}
function trackAssistantUsage(module_id) {
  authFetch("/api/assistant-usage", { module_id });
}
function trackHeartbeat(module_id, seconds) {
  authFetch("/api/heartbeat", { module_id, seconds });
}
async function submitOpenResponse(module_id, question, response_text, ai_feedback) {
  return authFetch("/api/open-response", { module_id, question, response_text, ai_feedback });
}

/* ---------------------------------------------------------
   Heartbeat — logs ~30s chunks of active time on a module,
   only while the tab is visible.
--------------------------------------------------------- */
function useHeartbeat(moduleId) {
  useEffect(() => {
    if (!TRACKER_URL) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") trackHeartbeat(moduleId, 30);
    }, 30000);
    return () => clearInterval(interval);
  }, [moduleId]);
}

/* ---------------------------------------------------------
   Content — paraphrased from the CESI course material
   (Contexte, Principe, Types de systèmes, Appoint,
   Régulation/Dimensionnement)
--------------------------------------------------------- */
const SYSTEMES = [
  {
    id: "mono",
    label: "Thermosiphon monobloc",
    resume: "Capteur et ballon sur un même châssis rigide.",
    avantages: [
      "Investissement faible, mise en œuvre très simple",
      "Aucune énergie électrique auxiliaire nécessaire",
      "Fiabilité éprouvée, peu de pièces mobiles",
    ],
    limites: [
      "Réservé aux zones sans risque de gel",
      "Peu discret en toiture (ballon apparent)",
    ],
  },
  {
    id: "separe",
    label: "Thermosiphon à éléments séparés",
    resume: "Capteur et ballon distincts ; le ballon reste plus haut que le capteur.",
    avantages: [
      "Ballon vertical → bonne stratification des températures",
      "Facilite l'intégration d'un appoint intégré",
    ],
    limites: [
      "Canalisations courtes et rectilignes imposées",
      "Circulation par gravité : sensible à la conception hydraulique",
    ],
  },
  {
    id: "force",
    label: "Circulation forcée",
    resume: "Un circulateur piloté par régulation fait circuler le fluide caloporteur.",
    avantages: [
      "Système le plus installé actuellement",
      "Position du capteur libre par rapport au ballon",
      "Fonctionne quelle que soit la zone climatique (antigel)",
    ],
    limites: [
      "Consommation électrique du circulateur",
      "Réglage fin de la régulation nécessaire (DD / DA)",
    ],
  },
  {
    id: "autovidange",
    label: "Autovidangeable",
    resume: "Le circuit primaire se vidange automatiquement à l'arrêt du circulateur.",
    avantages: [
      "Protection naturelle contre le gel et la surchauffe",
      "Liquide antigel non indispensable en théorie",
    ],
    limites: [
      "Pompe devant vaincre la hauteur manométrique au redémarrage",
      "Canalisations sans contre-pente obligatoires",
    ],
  },
];

const APPOINTS = [
  {
    id: "elec",
    label: "Intégré électrique",
    resume: "Réchauffeur électrique placé entre le tiers et la moitié supérieure du ballon.",
    avantages: [
      "Solution la plus répandue en France, simple à programmer",
      "Coût d'investissement raisonnable",
      "Peut être coupé l'été sans impact",
    ],
    limites: ["Coût d'usage électrique en période de faible ensoleillement"],
  },
  {
    id: "hydro",
    label: "Intégré hydraulique",
    resume: "Second échangeur relié à la chaudière, dans le volume supérieur du ballon.",
    avantages: [
      "Équipement cohérent avec le chauffage des locaux",
      "Fonctionnement économique avec chaudière bois ou gaz basse condensation",
    ],
    limites: [
      "Investissement plus élevé qu'un appoint électrique",
      "Chaudière à maintenir allumée même l'été",
    ],
  },
  {
    id: "separe",
    label: "Séparé",
    resume: "Second chauffe-eau indépendant, en dehors du ballon solaire.",
    avantages: [
      "Flexible : électrique, bois, gaz ou fioul",
      "Utile en complément d'un ballon ECS déjà existant",
    ],
    limites: ["Emprise au sol plus importante"],
  },
];

const QUIZ = [
  {
    q: "Quel est le rôle de la régulation dans un CESI à circulation forcée ?",
    options: [
      "Elle donne priorité au solaire et module l'appoint selon le besoin",
      "Elle coupe le solaire dès que l'appoint fonctionne",
      "Elle n'intervient que l'été",
    ],
    correct: 0,
    explain:
      "La régulation privilégie systématiquement l'énergie solaire disponible et n'active l'appoint qu'en complément.",
  },
  {
    q: "À quelle température minimale la consigne de l'appoint est-elle généralement réglée ?",
    options: ["40 °C", "55 °C (souvent 60 °C)", "90 °C"],
    correct: 1,
    explain:
      "La sortie après appoint doit être ≥ 55 °C ; en pratique la consigne est souvent fixée à 60 °C.",
  },
  {
    q: "Quel type de système fonctionne sans circulateur ni régulation ?",
    options: ["Circulation forcée", "Autovidangeable", "Thermosiphon"],
    correct: 2,
    explain:
      "Le thermosiphon exploite uniquement les écarts de densité du fluide chauffé/refroidi pour circuler.",
  },
  {
    q: "En circulation forcée régulée, quand le circulateur démarre-t-il ?",
    options: [
      "Quand DT = Tc − Tb dépasse le Différentiel de Démarrage (DD)",
      "Dès le lever du soleil, quelle que soit la température",
      "Quand la température du ballon dépasse 100 °C",
    ],
    correct: 0,
    explain:
      "Le circulateur démarre lorsque DT > DD et s'arrête lorsque DT < DA (principe d'hystérésis).",
  },
  {
    q: "Quel est l'intérêt principal d'un système autovidangeable ?",
    options: [
      "Il produit de l'eau plus chaude que les autres systèmes",
      "Il protège l'installation du gel et de la surchauffe sans antigel obligatoire",
      "Il ne nécessite aucun ballon de stockage",
    ],
    correct: 1,
    explain:
      "En cas de risque de gel ou de surchauffe (>120 °C), le circuit se vidange automatiquement vers une bouteille de récupération.",
  },
];

/* ---------------------------------------------------------
   Small building blocks
--------------------------------------------------------- */
function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FONT_BODY,
        fontSize: 13,
        fontWeight: 600,
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? T.copper : T.grid}`,
        background: active ? "rgba(232,121,58,0.15)" : "transparent",
        color: active ? T.copper : T.inkDim,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 150ms ease",
      }}
    >
      {children}
    </button>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: T.panel,
        border: `1px solid ${T.grid}`,
        borderRadius: 10,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: T.azure,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------
   Hero: animated CESI schematic
--------------------------------------------------------- */
function HeroSchema({ sun, setSun }) {
  const circulating = sun > 18;
  const appointOn = sun < 55;
  const ballonTemp = Math.round(38 + sun * 0.42);
  const dashSpeed = circulating ? Math.max(0.4, 1.6 - sun / 80) : 0;

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 0 22px" }}>
        <Eyebrow>Schéma de principe — CESI à circulation forcée</Eyebrow>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: 22,
              color: T.ink,
              margin: 0,
            }}
          >
            Fais varier l'ensoleillement, observe la régulation
          </h2>
        </div>
      </div>

      <style>{`
        @keyframes flowDash { to { stroke-dashoffset: -40; } }
        .flow-pipe { stroke-dasharray: 8 6; animation: flowDash linear infinite; }
        @keyframes pulseGlow { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        .pulse { animation: pulseGlow 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .flow-pipe { animation: none !important; }
          .pulse { animation: none !important; }
        }
      `}</style>

      <svg viewBox="0 0 760 300" style={{ width: "100%", display: "block" }}>
        <defs>
          <pattern id="graph" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke={T.grid} strokeWidth="0.5" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="760" height="300" fill={T.navyDeep} />
        <rect width="760" height="300" fill="url(#graph)" />

        {/* Sun */}
        <circle
          cx="80"
          cy="60"
          r={14 + sun / 12}
          fill={T.gold}
          opacity={0.25 + (sun / 100) * 0.6}
        />
        <circle cx="80" cy="60" r="10" fill={T.gold} />
        <text x="80" y="95" textAnchor="middle" fontFamily={FONT_MONO} fontSize="10" fill={T.inkDim}>
          soleil
        </text>

        {/* Capteur solaire (tilted rectangle) */}
        <g transform="translate(140,90) rotate(-25)">
          <rect x="0" y="0" width="120" height="60" fill="#132F42" stroke={T.ink} strokeWidth="1.5" rx="3" />
          {[1, 2, 3, 4].map((i) => (
            <line key={i} x1={i * 24} y1="0" x2={i * 24} y2="60" stroke={T.grid} strokeWidth="1" />
          ))}
        </g>
        <text x="150" y="185" fontFamily={FONT_BODY} fontSize="12" fill={T.ink} fontWeight="600">
          Capteurs
        </text>

        {/* Régulation (dashed control box) */}
        <rect x="130" y="20" width="230" height="45" fill="none" stroke={T.azure} strokeWidth="1.5" strokeDasharray="5 4" rx="4" />
        <text x="145" y="14" fontFamily={FONT_MONO} fontSize="10" fill={T.azure}>
          régulation
        </text>
        <circle cx="205" cy="42" r="6" fill={circulating ? T.copper : T.grid} className={circulating ? "pulse" : ""} />
        <text x="220" y="46" fontFamily={FONT_MONO} fontSize="10" fill={T.inkDim}>
          sonde S-1
        </text>

        {/* Hot pipe: capteur -> ballon */}
        <path
          d="M 260 100 L 420 100"
          fill="none"
          stroke={circulating ? T.copper : T.copperDim}
          strokeWidth="4"
          className={circulating ? "flow-pipe" : ""}
          style={{ animationDuration: `${dashSpeed || 1}s` }}
        />
        {/* Cold return pipe: ballon -> capteur */}
        <path
          d="M 420 170 L 200 170 L 200 130"
          fill="none"
          stroke={circulating ? T.azure : "#2A4A5A"}
          strokeWidth="4"
          className={circulating ? "flow-pipe" : ""}
          style={{ animationDuration: `${(dashSpeed || 1) * 1.1}s` }}
        />

        {/* Ballon de stockage */}
        <rect x="420" y="60" width="90" height="150" rx="18" fill="#132F42" stroke={T.ink} strokeWidth="1.5" />
        <rect
          x="428"
          y={60 + 150 - Math.max(10, (ballonTemp - 20) * 2.2)}
          width="74"
          height={Math.max(10, (ballonTemp - 20) * 2.2) - 8}
          rx="8"
          fill={T.copper}
          opacity="0.35"
        />
        <text x="465" y="235" textAnchor="middle" fontFamily={FONT_BODY} fontSize="12" fill={T.ink} fontWeight="600">
          Ballon
        </text>
        <text
          x="465"
          y="140"
          textAnchor="middle"
          fontFamily={FONT_MONO}
          fontSize="18"
          fontWeight="600"
          fill={T.ink}
        >
          {ballonTemp}°C
        </text>

        {/* Appoint block */}
        <rect
          x="560"
          y="95"
          width="90"
          height="45"
          rx="4"
          fill="none"
          stroke={appointOn ? T.gold : T.grid}
          strokeWidth="1.5"
          strokeDasharray="5 4"
          className={appointOn ? "pulse" : ""}
        />
        <text x="565" y="88" fontFamily={FONT_MONO} fontSize="10" fill={appointOn ? T.gold : T.inkDim}>
          appoint {appointOn ? "actif" : "veille"}
        </text>
        <path d="M 510 118 L 560 118" fill="none" stroke={appointOn ? T.gold : T.grid} strokeWidth="4" />

        {/* Hot water out */}
        <path d="M 650 118 L 700 118" fill="none" stroke={T.copper} strokeWidth="4" markerEnd="url(#arrow)" />
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={T.copper} />
          </marker>
        </defs>
        <text x="655" y="105" fontFamily={FONT_MONO} fontSize="10" fill={T.inkDim}>
          eau chaude
        </text>
      </svg>

      <div style={{ padding: "16px 22px 22px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim }}>
          <span>Ensoleillement faible</span>
          <span>Ensoleillement fort</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={sun}
          onChange={(e) => setSun(Number(e.target.value))}
          style={{ width: "100%", accentColor: T.copper }}
        />
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>
          {appointOn
            ? "L'ensoleillement ne suffit pas à couvrir le besoin : la régulation active l'appoint en complément du solaire."
            : "Le solaire seul couvre le besoin en eau chaude : l'appoint reste en veille."}
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------
   Comparison simulator
--------------------------------------------------------- */
function Simulator() {
  const [sysId, setSysId] = useState(SYSTEMES[2].id);
  const [appId, setAppId] = useState(APPOINTS[0].id);
  const sys = useMemo(() => SYSTEMES.find((s) => s.id === sysId), [sysId]);
  const app = useMemo(() => APPOINTS.find((a) => a.id === appId), [appId]);

  return (
    <Card>
      <Eyebrow>Simulateur de configuration</Eyebrow>
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: T.ink, margin: "0 0 14px 0" }}>
        Compose ton installation
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginBottom: 6 }}>
            TYPE DE SYSTÈME
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SYSTEMES.map((s) => (
              <Pill key={s.id} active={s.id === sysId} onClick={() => setSysId(s.id)}>
                {s.label}
              </Pill>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginBottom: 6 }}>
            TYPE D'APPOINT
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {APPOINTS.map((a) => (
              <Pill key={a.id} active={a.id === appId} onClick={() => setAppId(a.id)}>
                {a.label}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {[
          { data: sys, tone: T.copper },
          { data: app, tone: T.azure },
        ].map(({ data, tone }, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${T.grid}`,
              borderRadius: 8,
              padding: 14,
              background: T.navyDeep,
            }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: tone, marginBottom: 4 }}>
              {data.label}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim, marginBottom: 10, lineHeight: 1.5 }}>
              {data.resume}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.good, marginBottom: 4 }}>
              + AVANTAGES
            </div>
            <ul style={{ margin: "0 0 10px 0", paddingLeft: 16, fontSize: 12.5, color: T.ink, lineHeight: 1.6 }}>
              {data.avantages.map((a, k) => (
                <li key={k}>{a}</li>
              ))}
            </ul>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#E0784F", marginBottom: 4 }}>
              − LIMITES
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: T.ink, lineHeight: 1.6 }}>
              {data.limites.map((a, k) => (
                <li key={k}>{a}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------
   Regulation explainer (DD / DA)
--------------------------------------------------------- */
function Regulation() {
  const [dt, setDt] = useState(6);
  const DD = 7,
    DA = 3;
  const state = dt > DD ? "marche" : dt < DA ? "arrêt" : "maintien";
  const color = state === "marche" ? T.copper : state === "arrêt" ? T.azure : T.inkDim;
  return (
    <Card>
      <Eyebrow>Hystérésis de régulation</Eyebrow>
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: T.ink, margin: "0 0 10px 0" }}>
        DT = Tc − Tb pilote le circulateur
      </h3>
      <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim, lineHeight: 1.6, marginTop: 0 }}>
        Le circulateur démarre lorsque DT dépasse le Différentiel de Démarrage
        (DD ≈ {DD} K) et s'arrête lorsque DT passe sous le Différentiel d'Arrêt
        (DA ≈ {DA} K). Fais glisser DT pour voir l'état du circulateur.
      </p>
      <input
        type="range"
        min="0"
        max="15"
        value={dt}
        onChange={(e) => setDt(Number(e.target.value))}
        style={{ width: "100%", accentColor: T.copper, margin: "10px 0" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 20, color: T.ink }}>DT = {dt} K</span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            color,
            border: `1px solid ${color}`,
            borderRadius: 999,
            padding: "4px 12px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          circulateur : {state}
        </span>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------
   Quiz
--------------------------------------------------------- */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const QUIZ_TIME_LIMIT_S = 1200; // 20 minutes, matching Habiba's Moodle setting
const QUIZ_MAX_ATTEMPTS = 2;

function attemptsKey(moduleId) {
  return `cesi_quiz_attempts_${moduleId}`;
}
function loadAttemptState(moduleId) {
  try {
    return JSON.parse(localStorage.getItem(attemptsKey(moduleId))) || { count: 0, best: 0 };
  } catch {
    return { count: 0, best: 0 };
  }
}
function saveAttemptState(moduleId, state) {
  try {
    localStorage.setItem(attemptsKey(moduleId), JSON.stringify(state));
  } catch {}
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* ---------------------------------------------------------
   Quiz — matches Habiba's real Moodle grading format:
   fixed 20-question set (her actual quiz, order shuffled per
   attempt, answer options shuffled), 20-minute timer, max 2
   attempts, deferred feedback (no reveal until the whole
   attempt is submitted), highest of the 2 attempts kept.
--------------------------------------------------------- */
function Quiz({ bank, moduleId = "solaire" }) {
  const [attemptState, setAttemptState] = useState(() => loadAttemptState(moduleId));
  const [inProgress, setInProgress] = useState(false);
  const [pool, setPool] = useState([]);
  const [answers, setAnswers] = useState({}); // { [questionIndex]: number[] }
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME_LIMIT_S);
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const remainingAttempts = QUIZ_MAX_ATTEMPTS - attemptState.count;

  function startAttempt() {
    const shuffledPool = shuffle(bank).map((q) => {
      const order = shuffle(q.options.map((_, i) => i));
      return {
        q: q.q,
        options: order.map((i) => q.options[i]),
        correct: q.correct.map((ci) => order.indexOf(ci)),
      };
    });
    setPool(shuffledPool);
    setAnswers({});
    setTimeLeft(QUIZ_TIME_LIMIT_S);
    setSubmitted(false);
    setInProgress(true);
  }

  useEffect(() => {
    if (!inProgress || submitted) return;
    if (timeLeft <= 0) {
      finishAttempt();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, submitted, timeLeft]);

  function toggle(qIdx, optIdx) {
    if (submitted) return;
    const item = pool[qIdx];
    const isMulti = item.correct.length > 1;
    setAnswers((a) => {
      const cur = a[qIdx] || [];
      if (isMulti) {
        return { ...a, [qIdx]: cur.includes(optIdx) ? cur.filter((x) => x !== optIdx) : [...cur, optIdx] };
      }
      return { ...a, [qIdx]: [optIdx] };
    });
  }

  function finishAttempt() {
    let score = 0;
    pool.forEach((item, idx) => {
      const picked = (answers[idx] || []).slice().sort().join(",");
      const correct = item.correct.slice().sort().join(",");
      if (picked === correct) score += 1;
    });
    setFinalScore(score);
    setSubmitted(true);
    setInProgress(false);
    const newState = {
      count: attemptState.count + 1,
      best: Math.max(attemptState.best, score),
    };
    setAttemptState(newState);
    saveAttemptState(moduleId, newState);
    trackEvent({ module_id: moduleId, event_type: "quiz_completed", quiz_score: score, quiz_total: pool.length });
  }

  const answeredCount = Object.values(answers).filter((a) => a.length > 0).length;

  // --- Results screen (after submission) ---
  if (submitted) {
    return (
      <Card>
        <Eyebrow>Auto-évaluation — résultat</Eyebrow>
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 34, color: T.gold, fontWeight: 600 }}>
            {finalScore} / {pool.length}
          </div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginTop: 6 }}>
            Meilleur score : {attemptState.best} / {pool.length} · Tentative {attemptState.count} / {QUIZ_MAX_ATTEMPTS}
          </p>
          {remainingAttempts > 0 ? (
            <button
              onClick={startAttempt}
              style={{ marginTop: 10, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, color: T.navyDeep, background: T.copper, border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer" }}
            >
              Deuxième tentative ({remainingAttempts} restante)
            </button>
          ) : (
            <p style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: T.inkDim }}>
              Les 2 tentatives ont été utilisées — le meilleur score est conservé.
            </p>
          )}
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {pool.map((item, idx) => {
            const picked = answers[idx] || [];
            const isRight = picked.slice().sort().join(",") === item.correct.slice().sort().join(",");
            return (
              <div key={idx} style={{ border: `1px solid ${T.grid}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.ink, marginBottom: 6 }}>{item.q}</div>
                {item.options.map((opt, oi) => {
                  const wasPicked = picked.includes(oi);
                  const isCorrectOpt = item.correct.includes(oi);
                  let color = T.inkDim;
                  if (isCorrectOpt) color = T.good;
                  else if (wasPicked) color = "#E0784F";
                  return (
                    <div key={oi} style={{ fontFamily: FONT_MONO, fontSize: 11, color, paddingLeft: 8 }}>
                      {wasPicked ? "☑" : "☐"} {opt}
                    </div>
                  );
                })}
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: isRight ? T.good : "#E0784F", marginTop: 4 }}>
                  {isRight ? "Correct" : "Incorrect"}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // --- In-progress attempt (deferred feedback: no correct/incorrect shown) ---
  if (inProgress) {
    return (
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: T.ink, margin: 0 }}>
            Auto-évaluation ({pool.length} questions)
          </h3>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              color: timeLeft < 60 ? "#E0784F" : T.gold,
              border: `1px solid ${timeLeft < 60 ? "#E0784F" : T.grid}`,
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            ⏱ {formatTime(timeLeft)}
          </span>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.inkDim, marginBottom: 12 }}>
          {answeredCount} / {pool.length} répondues — les réponses ne sont révélées qu'à la fin.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
          {pool.map((item, qIdx) => {
            const isMulti = item.correct.length > 1;
            const picked = answers[qIdx] || [];
            return (
              <div key={qIdx} style={{ borderTop: qIdx > 0 ? `1px solid ${T.grid}` : "none", paddingTop: qIdx > 0 ? 14 : 0 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.azure, marginBottom: 4 }}>
                  Q{qIdx + 1} · {isMulti ? "plusieurs réponses" : "une seule réponse"}
                </div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.ink, marginBottom: 8, lineHeight: 1.5 }}>{item.q}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {item.options.map((opt, oi) => {
                    const isPicked = picked.includes(oi);
                    return (
                      <button
                        key={oi}
                        onClick={() => toggle(qIdx, oi)}
                        style={{
                          textAlign: "left",
                          fontFamily: FONT_BODY,
                          fontSize: 13,
                          color: T.ink,
                          padding: "8px 12px",
                          borderRadius: 7,
                          border: `1px solid ${isPicked ? T.copper : T.grid}`,
                          background: isPicked ? "rgba(232,121,58,0.1)" : "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ width: 13, height: 13, flexShrink: 0, borderRadius: isMulti ? 3 : "50%", border: `1.5px solid ${isPicked ? T.copper : T.inkDim}`, background: isPicked ? T.copper : "transparent" }} />
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={finishAttempt}
          style={{ marginTop: 16, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, color: T.navyDeep, background: T.copper, border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer" }}
        >
          Soumettre le quiz
        </button>
      </Card>
    );
  }

  // --- Start screen ---
  return (
    <Card>
      <Eyebrow>Auto-évaluation</Eyebrow>
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: T.ink, margin: "0 0 8px 0" }}>
        {pool.length || bank.length} questions · 20 minutes · {QUIZ_MAX_ATTEMPTS} tentatives max
      </h3>
      <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim, lineHeight: 1.55 }}>
        Comme sur Moodle : les réponses ne sont révélées qu'à la fin de la tentative. Le meilleur des{" "}
        {QUIZ_MAX_ATTEMPTS} scores est conservé.
      </p>
      {attemptState.count > 0 && (
        <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.gold }}>
          Meilleur score actuel : {attemptState.best} / {bank.length} · {attemptState.count} / {QUIZ_MAX_ATTEMPTS} tentatives utilisées
        </p>
      )}
      {remainingAttempts > 0 ? (
        <button
          onClick={startAttempt}
          style={{ marginTop: 8, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, color: T.navyDeep, background: T.copper, border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer" }}
        >
          {attemptState.count === 0 ? "Commencer le quiz" : "Deuxième tentative"}
        </button>
      ) : (
        <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#E0784F" }}>
          Les {QUIZ_MAX_ATTEMPTS} tentatives ont été utilisées pour ce chapitre.
        </p>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------
   Open-ended question — student writes a free-text answer,
   the assistant gives formative (not pass/fail) feedback, and
   both the answer and feedback are logged for the teacher
   dashboard (deliberate submitted work, unlike casual chat).
--------------------------------------------------------- */
function OpenQuestion({ moduleId, question }) {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    const answer = text.trim();
    if (!answer || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 350,
          system: `Tu donnes un retour formatif (pas une note) sur la réponse d'un étudiant à une question ouverte
de systèmes énergétiques durables. Sois encourageant mais précis : confirme ce qui est juste, corrige
ou nuance ce qui est imprécis, et complète si un point important manque. 3-5 phrases, en français,
vocabulaire technique du cours. Ne donne pas de note chiffrée.`,
          messages: [{ role: "user", content: `Question posée à l'étudiant : "${question}"\n\nRéponse de l'étudiant : "${answer}"` }],
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error?.message || data.error || "Erreur");
      const fb = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      setFeedback(fb);
      submitOpenResponse(moduleId, question, answer, fb);
      setSubmitted(true);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <Eyebrow>Question ouverte</Eyebrow>
      <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.ink, lineHeight: 1.55, marginTop: 0 }}>{question}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitted}
        rows={4}
        placeholder="Rédige ta réponse ici…"
        style={{
          width: "100%",
          background: T.navyDeep,
          border: `1px solid ${T.grid}`,
          borderRadius: 8,
          padding: "10px 12px",
          color: T.ink,
          fontFamily: FONT_BODY,
          fontSize: 13.5,
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      {!submitted && (
        <button
          onClick={submit}
          disabled={loading || !text.trim()}
          style={{
            marginTop: 10,
            background: !text.trim() ? T.grid : T.copper,
            color: T.navyDeep,
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 13,
            cursor: loading || !text.trim() ? "default" : "pointer",
          }}
        >
          {loading ? "Analyse en cours…" : "Envoyer ma réponse"}
        </button>
      )}
      {error && <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: "#E0784F", marginTop: 8 }}>{error}</div>}
      {feedback && (
        <div style={{ marginTop: 12, border: `1px solid ${T.grid}`, borderRadius: 8, padding: 12, background: T.navyDeep }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.azure, marginBottom: 6 }}>RETOUR DE L'ASSISTANT</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.ink, lineHeight: 1.55 }}>{feedback}</div>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------
   AI Assistant — floating chat panel wired directly to the
   existing generic Cloudflare Worker proxy (imt-ai-proxy),
   which forwards any Anthropic Messages API body verbatim
   using its own server-side ANTHROPIC_API_KEY. The system
   prompt therefore lives here, client-side, and is sent as
   part of the request body on every call.
   Answers content questions directly and coaches Socratically
   on the système/appoint simulator, per the course scope.
--------------------------------------------------------- */
const PROXY_URL = "https://imt-ai-proxy.nscottarthur.workers.dev/";

const ASSISTANT_SYSTEM_PROMPT_BASE = `Tu es l'assistant pédagogique du module e-learning "Systèmes énergétiques durables"
(GCBD, IMT Mines Alès, Habiba Lharti), qui couvre le solaire thermique, la pompe à chaleur, le solaire
photovoltaïque, et la ventilation/traitement d'air.

Ton rôle :
- Aider les étudiants à comprendre les notions du chapitre actuellement ouvert (voir contexte ci-dessous).
- Pour les questions FACTUELLES sur le fonctionnement, réponds directement et clairement.
- Pour les questions liées à un simulateur ou un choix de configuration, privilégie une approche
  socratique : pose une question en retour pour aider l'étudiant à raisonner sur les compromis,
  plutôt que de donner directement "la bonne réponse".
- Reste strictement dans le périmètre du chapitre ouvert et des systèmes énergétiques durables du cours.
  Si une question sort de ce périmètre, indique-le poliment et recentre sur le module.
- Réponds en français, de façon concise (quelques phrases), avec le vocabulaire technique du cours.
- Ne fabrique jamais de valeurs chiffrées incohérentes avec le cours.`;

function Assistant({ sectionContext, moduleId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Bonjour ! Je peux t'aider à comprendre le fonctionnement du CESI ou t'accompagner dans le simulateur. Pose-moi une question.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);
    trackAssistantUsage(moduleId);
    try {
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          system: ASSISTANT_SYSTEM_PROMPT_BASE + (sectionContext ? `\n\nContexte actuel : ${sectionContext}` : ""),
          messages: nextMessages.slice(-12).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || data.error || `Erreur (${res.status})`);
      }
      const reply = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      setMessages((m) => [...m, { role: "assistant", content: reply || "(réponse vide)" }]);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed",
          bottom: 22,
          left: 22,
          zIndex: 50,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: `1px solid ${T.copper}`,
          background: T.copper,
          color: T.navyDeep,
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 20,
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        }}
        aria-label="Ouvrir l'assistant"
      >
        {open ? "×" : "?"}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 88,
            left: 22,
            zIndex: 50,
            width: 340,
            maxWidth: "calc(100vw - 44px)",
            height: 440,
            display: "flex",
            flexDirection: "column",
            background: T.panel,
            border: `1px solid ${T.grid}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${T.grid}`,
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: 13,
              color: T.ink,
            }}
          >
            Assistant CESI
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: m.role === "user" ? T.copper : T.navyDeep,
                  color: m.role === "user" ? T.navyDeep : T.ink,
                  border: m.role === "user" ? "none" : `1px solid ${T.grid}`,
                  borderRadius: 10,
                  padding: "8px 11px",
                  fontFamily: FONT_BODY,
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim }}>l'assistant écrit…</div>
            )}
            {error && (
              <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: "#D9534F" }}>
                {error}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, padding: 10, borderTop: `1px solid ${T.grid}` }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Pose ta question…"
              style={{
                flex: 1,
                background: T.navyDeep,
                border: `1px solid ${T.grid}`,
                borderRadius: 8,
                padding: "8px 10px",
                color: T.ink,
                fontFamily: FONT_BODY,
                fontSize: 12.5,
                outline: "none",
              }}
            />
            <button
              onClick={send}
              disabled={loading}
              style={{
                background: T.copper,
                color: T.navyDeep,
                border: "none",
                borderRadius: 8,
                padding: "0 14px",
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------
   Course modules registry — used by Home and the router.
   Only "solaire" has content today; the other three are
   placeholders pending material from Habiba.
--------------------------------------------------------- */
const MODULES = [
  {
    id: "solaire",
    number: "1",
    title: "Solaire thermique",
    subtitle: "Le CESI en action",
    resume:
      "Schéma animé, simulateur de configuration système/appoint, hystérésis de régulation, quiz.",
    ready: true,
  },
  {
    id: "pac",
    number: "2",
    title: "Pompe à chaleur",
    subtitle: "Cycle frigorifique, COP",
    resume: "Schéma animé du cycle, comparateur de types de PAC, simulateur de COP.",
    ready: true,
  },
  {
    id: "pv",
    number: "3",
    title: "Solaire photovoltaïque",
    subtitle: "Cellule → réseau",
    resume: "Chaîne cellule/module/onduleur, simulateur d'installation, quiz.",
    ready: true,
  },
  {
    id: "ventilation",
    number: "4",
    title: "Ventilation et traitement d'air",
    subtitle: "QAI, puits climatique, CTA",
    resume: "Puits climatique interactif, notions clés QAI/VMC/CTA, quiz.",
    ready: true,
  },
];

/* ---------------------------------------------------------
   MODULE 2 — Pompe à chaleur
--------------------------------------------------------- */
const PAC_TYPES = [
  {
    id: "air-air",
    label: "Air / Air",
    resume: "Source froide : air extérieur. Émission : air (splits, gainable).",
    avantages: ["Installation simple et rapide", "Coût d'investissement le plus bas", "Réversible (chaud/froid) facilement"],
    limites: ["Pas de production d'ECS", "Performance dégradée par grand froid"],
  },
  {
    id: "air-eau",
    label: "Air / Eau",
    resume: "Source froide : air extérieur. Émission : eau (radiateurs, plancher chauffant).",
    avantages: ["Compatible avec un réseau hydraulique existant", "Peut produire l'ECS (ballon associé)"],
    limites: ["COP plus sensible à la température extérieure qu'une PAC géothermique", "Émetteurs basse température recommandés"],
  },
  {
    id: "eau-eau",
    label: "Eau / Eau",
    resume: "Source froide : nappe phréatique ou eau de surface.",
    avantages: ["Température de source stable toute l'année → bon COP"],
    limites: ["Nécessite une ressource en eau disponible et autorisations", "Coût de forage/captage élevé"],
  },
  {
    id: "geo",
    label: "Géothermique (sol/eau)",
    resume: "Source froide : sol via capteurs enterrés horizontaux ou sondes verticales.",
    avantages: ["Température de source très stable → COP élevé et régulier"],
    limites: ["Emprise au sol importante (horizontal) ou forage (vertical)", "Investissement initial élevé"],
  },
];

const PAC_QUIZ = [
  {
    q: "Quels sont les 4 éléments principaux d'une PAC à compression ?",
    options: [
      "Évaporateur, compresseur, condenseur, détendeur",
      "Capteur, régulateur, ballon, échangeur",
      "Ventilateur, filtre, gaine, registre",
    ],
    correct: 0,
    explain: "Le fluide frigorigène traverse ces 4 éléments et change d'état (liquide/gazeux) au cours du cycle.",
  },
  {
    q: "Comment évolue le COP quand l'écart entre source froide et température de chauffage augmente ?",
    options: ["Il augmente", "Il diminue", "Il reste constant"],
    correct: 1,
    explain: "Plus l'écart de température entre la source froide et le chauffage est grand, plus le COP diminue.",
  },
  {
    q: "Que mesure l'EER, par rapport au COP ?",
    options: [
      "L'EER est l'équivalent du COP mais en mode refroidissement",
      "L'EER est le COP mesuré en hiver uniquement",
      "L'EER n'a aucun rapport avec le COP",
    ],
    correct: 0,
    explain: "COP = performance en chauffage ; EER = performance équivalente en mode refroidissement.",
  },
  {
    q: "Quelle est la différence entre COP/EER et SCOP/SEER ?",
    options: [
      "Aucune, ce sont des synonymes",
      "COP/EER = efficacité instantanée en labo ; SCOP/SEER = efficacité réelle sur une année",
      "SCOP/SEER ne s'appliquent qu'aux PAC géothermiques",
    ],
    correct: 1,
    explain: "Les coefficients saisonniers (SCOP/SEER) reflètent un bilan énergétique sur une année complète de fonctionnement.",
  },
  {
    q: "Pourquoi une PAC géothermique a-t-elle généralement un COP plus stable qu'une PAC air/eau ?",
    options: [
      "Parce que la température du sol varie peu au cours de l'année",
      "Parce qu'elle ne contient pas de fluide frigorigène",
      "Parce qu'elle fonctionne sans compresseur",
    ],
    correct: 0,
    explain: "La source froide (sol) reste à température quasi constante toute l'année, contrairement à l'air extérieur.",
  },
];

function PACCycleHero({ tExt, setTExt, tDepart, setTDepart }) {
  // Simplified illustrative COP curve derived from course description:
  // COP degrades as tExt drops and as tDepart rises.
  const cop = Math.max(1.2, 4.6 - (7 - tExt) * 0.055 - (tDepart - 35) * 0.035).toFixed(2);
  const active = true;
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 0 22px" }}>
        <Eyebrow>Cycle frigorifique — PAC à compression</Eyebrow>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 22, color: T.ink, margin: 0 }}>
          Fais varier les conditions, observe le COP
        </h2>
      </div>
      <style>{`
        @keyframes pacFlow { to { stroke-dashoffset: -40; } }
        .pac-pipe { stroke-dasharray: 8 6; animation: pacFlow 1.1s linear infinite; }
      `}</style>
      <svg viewBox="0 0 760 260" style={{ width: "100%", display: "block" }}>
        <defs>
          <pattern id="graph2" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke={T.grid} strokeWidth="0.5" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="760" height="260" fill={T.navyDeep} />
        <rect width="760" height="260" fill="url(#graph2)" />

        {/* Evaporateur */}
        <rect x="60" y="90" width="140" height="70" rx="6" fill="#132F42" stroke={T.azure} strokeWidth="1.5" />
        <text x="130" y="130" textAnchor="middle" fontFamily={FONT_BODY} fontSize="12" fill={T.ink}>Évaporateur</text>
        <text x="130" y="178" textAnchor="middle" fontFamily={FONT_MONO} fontSize="10" fill={T.azure}>source froide</text>

        {/* Compresseur */}
        <rect x="300" y="40" width="120" height="60" rx="6" fill="#132F42" stroke={T.copper} strokeWidth="1.5" />
        <text x="360" y="75" textAnchor="middle" fontFamily={FONT_BODY} fontSize="12" fill={T.ink}>Compresseur</text>

        {/* Condenseur */}
        <rect x="540" y="90" width="150" height="70" rx="6" fill="#132F42" stroke={T.copper} strokeWidth="1.5" />
        <text x="615" y="130" textAnchor="middle" fontFamily={FONT_BODY} fontSize="12" fill={T.ink}>Condenseur</text>
        <text x="615" y="178" textAnchor="middle" fontFamily={FONT_MONO} fontSize="10" fill={T.copper}>source chaude</text>

        {/* Détendeur */}
        <rect x="300" y="170" width="120" height="50" rx="6" fill="#132F42" stroke={T.azure} strokeWidth="1.5" />
        <text x="360" y="200" textAnchor="middle" fontFamily={FONT_BODY} fontSize="12" fill={T.ink}>Détendeur</text>

        {/* Flow lines */}
        <path d="M 200 110 L 300 65" fill="none" stroke={T.azure} strokeWidth="3.5" className="pac-pipe" />
        <path d="M 420 65 L 540 110" fill="none" stroke={T.copper} strokeWidth="3.5" className="pac-pipe" />
        <path d="M 615 160 L 615 195 L 420 195" fill="none" stroke={T.copper} strokeWidth="3.5" className="pac-pipe" />
        <path d="M 300 195 L 130 195 L 130 160" fill="none" stroke={T.azure} strokeWidth="3.5" className="pac-pipe" />
      </svg>
      <div style={{ padding: "16px 22px 22px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim }}>
            <span>Température extérieure</span>
            <span>{tExt} °C</span>
          </div>
          <input type="range" min="-10" max="15" value={tExt} onChange={(e) => setTExt(Number(e.target.value))} style={{ width: "100%", accentColor: T.copper }} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim }}>
            <span>Température de départ eau</span>
            <span>{tDepart} °C</span>
          </div>
          <input type="range" min="35" max="65" value={tDepart} onChange={(e) => setTDepart(Number(e.target.value))} style={{ width: "100%", accentColor: T.copper }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim }}>COP estimé (illustratif)</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 24, color: T.gold, fontWeight: 600 }}>{cop}</span>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.inkDim, lineHeight: 1.5 }}>
          Plus la température extérieure est basse et plus la température de départ demandée est élevée,
          plus le COP se dégrade — d'où l'intérêt des émetteurs basse température (plancher chauffant).
        </div>
      </div>
    </Card>
  );
}

function PACPerformancePanel() {
  const [tab, setTab] = useState("cop");
  return (
    <Card>
      <Eyebrow>Performances thermiques — approfondissement</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <Pill active={tab === "cop"} onClick={() => setTab("cop")}>COP / EER</Pill>
        <Pill active={tab === "scop"} onClick={() => setTab("scop")}>SCOP / SEER</Pill>
        <Pill active={tab === "charge"} onClick={() => setTab("charge")}>Charge partielle</Pill>
        <Pill active={tab === "reversible"} onClick={() => setTab("reversible")}>PAC réversible</Pill>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.ink, lineHeight: 1.65 }}>
        {tab === "cop" && (
          <>
            Sur le diagramme enthalpique (Mollier), l'énergie prélevée à l'évaporateur (Q1) et l'énergie
            récupérée au condenseur (Q2) s'obtiennent à partir de la variation d'enthalpie du fluide frigorigène :
            <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: T.gold, margin: "8px 0", background: T.navyDeep, padding: 10, borderRadius: 6 }}>
              Puissance frigorifique = Qm × (Hs − He)évaporateur<br />
              Puissance calorifique = Qm × (Hs − He)condenseur<br />
              COP = Q2 / W&nbsp;&nbsp;&nbsp;&nbsp;EER = Q1 / W
            </div>
            W est le travail fourni par le compresseur. L'EER est l'équivalent du COP mais en mode
            refroidissement.
          </>
        )}
        {tab === "scop" && (
          <>
            Le COP/EER mesure l'efficacité <strong>instantanée</strong>, en conditions de laboratoire. Pour les
            équipements &lt; 12 kW, les fabricants doivent aussi communiquer des coefficients{" "}
            <strong>saisonniers</strong> — SCOP (chauffage) et SEER (refroidissement) — établis sur un bilan
            énergétique d'une année complète de fonctionnement réel : c'est l'indicateur le plus représentatif
            pour comparer deux PAC.
          </>
        )}
        {tab === "charge" && (
          <>
            La performance dépend aussi du taux de charge (puissance disponible vs. puissance réellement
            demandée par le bâtiment). Un compresseur <strong>tout ou rien</strong> voit sa performance chuter à
            faible charge (séquences marche/arrêt répétées). Un compresseur à <strong>vitesse variable
            (inverter)</strong> améliore nettement ce point, mais repasse en tout-ou-rien sous un certain seuil.
            D'où l'importance de dimensionner la PAC pour un fonctionnement proche de la pleine charge.
          </>
        )}
        {tab === "reversible" && (
          <>
            Une PAC réversible produit du chaud ou du froid grâce à une <strong>vanne 4 voies</strong> qui inverse
            le cycle : le condenseur devient évaporateur et inversement. Cette vanne sert aussi à dégivrer la
            batterie extérieure en hiver — le givre faisant chuter la performance s'il n'est pas éliminé.
          </>
        )}
      </div>
    </Card>
  );
}

function PACFicheRevision() {
  const [tab, setTab] = useState("emetteurs");
  return (
    <Card>
      <Eyebrow>Fiche de révision — tout ce qui est testé dans le quiz</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <Pill active={tab === "emetteurs"} onClick={() => setTab("emetteurs")}>Émetteurs</Pill>
        <Pill active={tab === "geothermie"} onClick={() => setTab("geothermie")}>Capteurs géothermiques</Pill>
        <Pill active={tab === "dimensionnement"} onClick={() => setTab("dimensionnement")}>Dimensionnement & régulation</Pill>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.ink, lineHeight: 1.65 }}>
        {tab === "emetteurs" && (
          <>
            Une PAC classique ne dépasse pas 60°C au condenseur, et sa performance dépend de l'écart entre
            source froide et source chaude — d'où la recherche systématique d'émetteurs basse température :
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
              <li><strong>Plancher chauffant/rafraîchissant</strong> — le mieux adapté (régime d'eau 35-40°C, ΔT 5-7K)</li>
              <li><strong>Radiateur à eau chaude</strong> — basse ou haute température selon dimensionnement</li>
              <li><strong>Ventilo-convecteur</strong> — pour le tertiaire nécessitant de grands renouvellements d'air</li>
            </ul>
            Émission possible en mode hydraulique (eau), aéraulique (air) ou à détente directe (fluide
            frigorigène).
          </>
        )}
        {tab === "geothermie" && (
          <>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.85 }}>
              <li><strong>Capteurs horizontaux</strong> — enterrés à faible profondeur (0,5 à 1,2 m), surface de captage 1,5 à 3× la surface chauffée, ~20-25 W/m² captés. Moins chers, mais rendement inférieur.</li>
              <li><strong>Sondes verticales</strong> — forage jusqu'à 100-200 m (sol constant ~13°C dès 10 m, +2-3°C/100m), ~45 W/ml captés. Coût élevé (forage) mais emprise au sol faible.</li>
              <li><strong>Corbeilles géothermiques (capteurs hélicoïdaux)</strong> — combinent logique verticale/horizontale, 2-3 m de profondeur, 5 à 10 corbeilles pour une maison individuelle. Alternative quand le forage n'est pas autorisé ou le terrain trop petit.</li>
            </ul>
          </>
        )}
        {tab === "dimensionnement" && (
          <>
            Le débit nominal doit être maintenu pour garantir la performance : un surdébit gaspille de
            l'électricité et dégrade l'entrée PAC, un débit trop faible fait chuter la performance voire arrête
            la PAC. Avec des robinets thermostatiques ou vannes 2 voies, une <strong>soupape de pression
            différentielle</strong> est nécessaire pour maintenir le débit minimal. Un <strong>découplage</strong>{" "}
            (bipasse, bouteille de découplage, ou volume tampon) permet d'alimenter la PAC à son ΔT optimal
            (5-7K) tout en alimentant les émetteurs à un ΔT différent.
          </>
        )}
      </div>
    </Card>
  );
}

function PACTypesSimulator() {
  const [id, setId] = useState(PAC_TYPES[1].id);
  const t = PAC_TYPES.find((x) => x.id === id);
  return (
    <Card>
      <Eyebrow>Types de PAC</Eyebrow>
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: T.ink, margin: "0 0 14px 0" }}>
        Compare les configurations source/émission
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {PAC_TYPES.map((x) => (
          <Pill key={x.id} active={x.id === id} onClick={() => setId(x.id)}>{x.label}</Pill>
        ))}
      </div>
      <div style={{ border: `1px solid ${T.grid}`, borderRadius: 8, padding: 14, background: T.navyDeep }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: T.copper, marginBottom: 4 }}>{t.label}</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim, marginBottom: 10, lineHeight: 1.5 }}>{t.resume}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.good, marginBottom: 4 }}>+ AVANTAGES</div>
        <ul style={{ margin: "0 0 10px 0", paddingLeft: 16, fontSize: 12.5, color: T.ink, lineHeight: 1.6 }}>
          {t.avantages.map((a, k) => <li key={k}>{a}</li>)}
        </ul>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#E0784F", marginBottom: 4 }}>− LIMITES</div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: T.ink, lineHeight: 1.6 }}>
          {t.limites.map((a, k) => <li key={k}>{a}</li>)}
        </ul>
      </div>
    </Card>
  );
}

function PompeAChaleurModule({ onBack }) {
  const [tExt, setTExt] = useState(7);
  const [tDepart, setTDepart] = useState(45);
  useEffect(() => { trackEvent({ module_id: "pac", event_type: "module_opened" }); }, []);
  useHeartbeat("pac");
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
      <header>
        <button onClick={onBack} style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.azure, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 10 }}>
          ← Retour aux chapitres
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.12em", color: T.inkDim, textTransform: "uppercase" }}>
          Chapitre 2 · Systèmes énergétiques durables
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: T.ink, margin: "6px 0 4px 0" }}>
          Pompe à chaleur
        </h1>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
          Le cycle frigorifique, les 4 grands types de PAC selon la source froide et l'émission,
          et ce qui fait varier la performance (COP/SCOP) au fil de l'année.
        </p>
      </header>

      <PACCycleHero tExt={tExt} setTExt={setTExt} tDepart={tDepart} setTDepart={setTDepart} />
      <PACPerformancePanel />
      <PACFicheRevision />
      <PACTypesSimulator />
      <OpenQuestion moduleId="pac" question="Pourquoi une pompe à chaleur air/eau associée à un plancher chauffant basse température affiche-t-elle généralement un meilleur COP annuel qu'associée à des radiateurs haute température ?" />
      <Quiz bank={FIXED_PAC} moduleId="pac" />

      <footer style={{ textAlign: "center", paddingTop: 8 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.grid }}>
          Prototype — GCBD · Systèmes énergétiques durables · Habiba Lharti
        </span>
      </footer>

      <Assistant moduleId="pac" sectionContext={`Chapitre ouvert : Pompe à chaleur. T° extérieure simulée : ${tExt}°C, T° départ eau : ${tDepart}°C.`} />
    </div>
  );
}

/* ---------------------------------------------------------
   MODULE 3 — Solaire photovoltaïque
--------------------------------------------------------- */
const PV_QUIZ = [
  {
    q: "Sur quel principe physique repose la conversion photovoltaïque ?",
    options: [
      "L'absorption de photons dans un matériau semi-conducteur, qui libère des charges électriques",
      "La dilatation thermique d'un fluide caloporteur",
      "L'induction électromagnétique d'une turbine",
    ],
    correct: 0,
    explain: "Le semi-conducteur absorbe les photons du rayonnement et libère des charges électriques utilisables dans un circuit.",
  },
  {
    q: "Combien de cellules trouve-t-on généralement en série dans un module photovoltaïque ?",
    options: ["Entre 36 et 72", "Entre 5 et 10", "Plus de 500"],
    correct: 0,
    explain: "Ce nombre varie selon le fabricant mais se situe généralement entre 36 et 72 cellules en série.",
  },
  {
    q: "Quel est le rôle du MPPT dans un onduleur ?",
    options: [
      "Rechercher en continu le point de puissance maximale du champ photovoltaïque",
      "Convertir le courant alternatif en courant continu",
      "Stocker l'énergie produite la nuit",
    ],
    correct: 0,
    explain: "Le MPPT (Max Peak Power Tracker) ajuste en permanence le point de fonctionnement pour maximiser la puissance produite.",
  },
  {
    q: "Que définissent les conditions STC ?",
    options: [
      "Des conditions de test normalisées pour comparer les modules entre eux",
      "La durée de vie garantie d'un module",
      "Le tarif de rachat de l'électricité",
    ],
    correct: 0,
    explain: "STC : éclairement 1000 W/m², température de cellule 25°C, coefficient air masse 1,5.",
  },
  {
    q: "À partir de quelle puissance passe-t-on typiquement à plusieurs chaînes PV connectées en parallèle sur un même onduleur ?",
    options: ["Au-delà de 3 kW", "Dès la première installation", "Jamais, une seule chaîne suffit toujours"],
    correct: 0,
    explain: "Pour une puissance supérieure à 3 kW, plusieurs chaînes photovoltaïques en parallèle sont généralement nécessaires.",
  },
];

function PVPipelineHero({ irradiance, setIrradiance }) {
  const power = Math.round(irradiance * 3.2);
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 0 22px" }}>
        <Eyebrow>De la cellule au réseau</Eyebrow>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 22, color: T.ink, margin: 0 }}>
          Cellule → module → onduleur → réseau
        </h2>
      </div>
      <svg viewBox="0 0 760 220" style={{ width: "100%", display: "block" }}>
        <rect width="760" height="220" fill={T.navyDeep} />
        {["Cellule PV", "Module (36-72 cellules)", "Onduleur (MPPT, DC→AC)", "Réseau EDF"].map((label, i) => (
          <g key={i} transform={`translate(${40 + i * 180}, 70)`}>
            <rect width="150" height="80" rx="6" fill="#132F42" stroke={i === 2 ? T.copper : T.azure} strokeWidth="1.5" opacity={0.3 + (irradiance / 100) * 0.7} />
            <text x="75" y="45" textAnchor="middle" fontFamily={FONT_BODY} fontSize="11.5" fill={T.ink}>{label}</text>
            {i < 3 && <path d={`M ${150} 40 L 190 40`} stroke={T.copper} strokeWidth="3" markerEnd="url(#pvArrow)" />}
          </g>
        ))}
        <defs>
          <marker id="pvArrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={T.copper} />
          </marker>
        </defs>
      </svg>
      <div style={{ padding: "16px 22px 22px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim }}>
          <span>Éclairement (0–1000 W/m²)</span>
          <span>{irradiance * 10} W/m²</span>
        </div>
        <input type="range" min="0" max="100" value={irradiance} onChange={(e) => setIrradiance(Number(e.target.value))} style={{ width: "100%", accentColor: T.copper }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim }}>Puissance produite (illustrative)</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 22, color: T.gold, fontWeight: 600 }}>{power} W</span>
        </div>
      </div>
    </Card>
  );
}

function PVFicheRevision() {
  const [tab, setTab] = useState("semiconducteur");
  return (
    <Card>
      <Eyebrow>Fiche de révision — physique de la cellule (testée dans le quiz)</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <Pill active={tab === "semiconducteur"} onClick={() => setTab("semiconducteur")}>Semi-conducteur</Pill>
        <Pill active={tab === "caracteristique"} onClick={() => setTab("caracteristique")}>Courant-tension</Pill>
        <Pill active={tab === "assemblage"} onClick={() => setTab("assemblage")}>Série vs parallèle</Pill>
        <Pill active={tab === "bypass"} onClick={() => setTab("bypass")}>Diodes by-pass</Pill>
        <Pill active={tab === "temperature"} onClick={() => setTab("temperature")}>Effet température</Pill>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.ink, lineHeight: 1.65 }}>
        {tab === "semiconducteur" && (
          <>
            Le matériau semi-conducteur le plus utilisé est le <strong>silicium</strong>. Un atome de silicium a 4
            électrons de valence, formant un cristal où tous les électrons sont utilisés — donc peu conducteur au
            départ. Le <strong>dopage</strong> introduit des impuretés : dopage P avec du bore (3 électrons,
            crée des « trous »), dopage N avec du phosphore (5 électrons, électrons libres en excès). La jonction
            P-N ainsi créée est ce qui permet la conversion photoélectrique.
          </>
        )}
        {tab === "caracteristique" && (
          <>
            La puissance électrique P = U × I. Ni au court-circuit ni au circuit ouvert la puissance n'est
            maximale (P = 0 dans les deux cas) — le point de puissance maximale P_MPP se situe au « coude » de
            la courbe courant-tension. Le <strong>facteur de forme</strong> (fill factor) mesure à quel point
            cette courbe est « carrée » : plus il est élevé, plus P_MPP est grande pour un même I_courtcircuit et
            U_circuitouvert.
          </>
        )}
        {tab === "assemblage" && (
          <>
            <strong>Cellules/modules en série</strong> : les tensions s'additionnent, le courant reste celui d'une
            seule cellule (36 à 72 cellules en série dans un module typique). <strong>En parallèle</strong> : les
            courants s'additionnent, la tension reste constante. Pour l'assemblage de modules : une chaîne
            (string) = modules en série (même courant requis) ; plusieurs chaînes en parallèle = même tension
            requise entre elles.
          </>
        )}
        {tab === "bypass" && (
          <>
            Si une cellule d'un module câblé en série est à l'ombre, elle devient résistante — le module produit
            moins, et la cellule ombragée chauffe (effet Joule) et se dégrade (« hot spot »). Les{" "}
            <strong>diodes by-pass</strong> (2 à 5 par module) court-circuitent le sous-réseau de cellules
            ombragées dès qu'il devient résistant, protégeant le module au prix d'une perte de production
            limitée à ce sous-réseau.
          </>
        )}
        {tab === "temperature" && (
          <>
            En été, les panneaux atteignent souvent 60°C — <strong>au-dessus des 25°C des conditions STC</strong>,
            ce qui dégrade leur rendement réel par rapport à la fiche technique. C'est aussi pourquoi
            l'intégration en toiture (moins ventilée) ne produit pas toujours plus que la surimposition (mieux
            ventilée) aux forts ensoleillements, malgré une meilleure esthétique.
          </>
        )}
      </div>
    </Card>
  );
}

function PVDeepDivePanel() {
  const [tab, setTab] = useState("stc");
  return (
    <Card>
      <Eyebrow>Approfondissement</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <Pill active={tab === "stc"} onClick={() => setTab("stc")}>Conditions STC</Pill>
        <Pill active={tab === "rendement"} onClick={() => setTab("rendement")}>Rendement module</Pill>
        <Pill active={tab === "onduleur"} onClick={() => setTab("onduleur")}>Rôles de l'onduleur</Pill>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.ink, lineHeight: 1.65 }}>
        {tab === "stc" && (
          <>
            Les conditions STC (Standard Test Conditions) normalisent la mesure des modules en laboratoire,
            pour pouvoir les comparer entre eux :
            <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: T.gold, margin: "8px 0", background: T.navyDeep, padding: 10, borderRadius: 6 }}>
              Éclairement Pi = 1000 W/m² · Température de cellule = 25°C · Coefficient air masse = 1,5
            </div>
            La puissance électrique fournie dans ces conditions est la <strong>puissance crête</strong> indiquée
            sur la fiche technique du module.
          </>
        )}
        {tab === "rendement" && (
          <>
            Le rendement η d'un module est la part d'énergie radiative transformée en énergie électrique :
            <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: T.gold, margin: "8px 0", background: T.navyDeep, padding: 10, borderRadius: 6 }}>
              η_STC = Pc / (1000 × S_module)
            </div>
            où Pc est la puissance crête (W) et S_module la surface du module (m²). Le point de puissance
            maximale (P_MPP) est le produit d'un courant I_MPP et d'une tension U_MPP donnés — c'est exactement
            ce point que le MPPT de l'onduleur cherche à suivre en continu.
          </>
        )}
        {tab === "onduleur" && (
          <>
            L'onduleur remplit plusieurs fonctions, pas seulement la conversion DC→AC :
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
              <li><strong>MPPT</strong> — recherche en continu le point de puissance maximale du champ PV</li>
              <li><strong>Protection de découplage</strong> — coupe l'installation en cas de défaut réseau EDF</li>
              <li><strong>Contrôle d'isolement côté DC</strong> — alarme et arrêt si un défaut est détecté</li>
            </ul>
            Rendement de l'onduleur : η = P_AC / P_DC, avec P_DC = U_DC × I_DC. Les meilleurs onduleurs du
            marché atteignent aujourd'hui ~98% de rendement crête.
          </>
        )}
      </div>
    </Card>
  );
}

function PVInstallationSimulator() {
  const [size, setSize] = useState("small");
  const small = size === "small";
  return (
    <Card>
      <Eyebrow>Configuration d'installation</Eyebrow>
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: T.ink, margin: "0 0 14px 0" }}>
        Installation résidentielle : &lt; 3 kW ou &gt; 3 kW
      </h3>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <Pill active={small} onClick={() => setSize("small")}>&lt; 3 kW</Pill>
        <Pill active={!small} onClick={() => setSize("large")}>&gt; 3 kW</Pill>
      </div>
      <div style={{ border: `1px solid ${T.grid}`, borderRadius: 8, padding: 14, background: T.navyDeep, fontFamily: FONT_BODY, fontSize: 13, color: T.ink, lineHeight: 1.6 }}>
        {small ? (
          <>Un seul onduleur, environ 16 modules connectés. Une ou deux chaînes photovoltaïques
          en parallèle sur cet onduleur — configuration typique pour les particuliers.</>
        ) : (
          <>Plusieurs chaînes photovoltaïques connectées en parallèle sur un même onduleur.
          Quand plusieurs boîtes de jonction coexistent, une seconde jonction est faite dans
          un coffret dédié : la « boîte de raccordement ».</>
        )}
      </div>
    </Card>
  );
}

function SolairePhotovoltaiqueModule({ onBack }) {
  const [irradiance, setIrradiance] = useState(70);
  useEffect(() => { trackEvent({ module_id: "pv", event_type: "module_opened" }); }, []);
  useHeartbeat("pv");
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
      <header>
        <button onClick={onBack} style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.azure, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 10 }}>
          ← Retour aux chapitres
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.12em", color: T.inkDim, textTransform: "uppercase" }}>
          Chapitre 3 · Systèmes énergétiques durables
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: T.ink, margin: "6px 0 4px 0" }}>
          Solaire photovoltaïque
        </h1>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
          De la cellule au réseau électrique : conversion photovoltaïque, rôle de l'onduleur et du MPPT,
          et configurations d'installation selon la puissance.
        </p>
      </header>

      <PVPipelineHero irradiance={irradiance} setIrradiance={setIrradiance} />
      <PVFicheRevision />
      <PVDeepDivePanel />
      <PVInstallationSimulator />
      <OpenQuestion moduleId="pv" question="Un onduleur photovoltaïque intègre une fonction MPPT. Explique à quoi elle sert et pourquoi elle est nécessaire même par temps partiellement nuageux." />
      <Quiz bank={FIXED_PV} moduleId="pv" />

      <footer style={{ textAlign: "center", paddingTop: 8 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.grid }}>
          Prototype — GCBD · Systèmes énergétiques durables · Habiba Lharti
        </span>
      </footer>

      <Assistant moduleId="pv" sectionContext={`Chapitre ouvert : Solaire photovoltaïque. Éclairement simulé : ${irradiance * 10} W/m².`} />
    </div>
  );
}

/* ---------------------------------------------------------
   MODULE 4 — Ventilation et traitement d'air
--------------------------------------------------------- */
const VENT_QUIZ = [
  {
    q: "Selon l'ANSES, combien de décès par an sont attribués à la pollution de l'air intérieur en France ?",
    options: ["Environ 20 000", "Environ 2 000", "Environ 200 000"],
    correct: 0,
    explain: "L'ANSES estime le coût de la pollution de l'air intérieur à environ 19 milliards d'euros par an, pour ~20 000 décès.",
  },
  {
    q: "Quel est le principe du puits climatique (puits canadien/provençal) ?",
    options: [
      "Utiliser l'inertie thermique du sol pour préchauffer ou rafraîchir l'air neuf",
      "Filtrer l'air avec des matériaux biosourcés enterrés",
      "Remplacer totalement la ventilation mécanique",
    ],
    correct: 0,
    explain: "La température du sol reste relativement stable toute l'année, contrairement à l'air extérieur (-20°C à +35°C en France).",
  },
  {
    q: "Quel rendement peut atteindre l'échangeur d'une VMC double flux dans les meilleures conditions ?",
    options: ["80 à 90 %", "Environ 20 %", "Plus de 99 %"],
    correct: 0,
    explain: "L'air extérieur froid est préchauffé par l'air intérieur extrait via l'échangeur, avec un rendement pouvant atteindre 80–90%.",
  },
  {
    q: "Depuis quand la vérification des systèmes de ventilation mécanique est-elle obligatoire en résidentiel neuf (RE2020) ?",
    options: ["Depuis le 1er janvier 2022", "Depuis 1982", "Ce n'est pas obligatoire"],
    correct: 0,
    explain: "La RE2020 impose cette vérification pour les permis de construire déposés depuis le 1er janvier 2022.",
  },
  {
    q: "Quelle est la profondeur d'enfouissement typique des tubes d'un puits climatique ?",
    options: ["Entre 1,5 et 3 m", "Moins de 20 cm", "Plus de 15 m"],
    correct: 0,
    explain: "Les tubes sont enfouis entre 1,5 et 3 m, avec un diamètre de 80 à 125 mm et une vitesse d'air de 1,5 à 4 m/s.",
  },
];

function PuitsClimatiqueFicheRevision() {
  const [tab, setTab] = useState("conception");
  return (
    <Card>
      <Eyebrow>Fiche de révision — puits climatique (le plus testé dans le quiz)</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <Pill active={tab === "conception"} onClick={() => setTab("conception")}>Conception & tubes</Pill>
        <Pill active={tab === "reseau"} onClick={() => setTab("reseau")}>Réseau & condensats</Pill>
        <Pill active={tab === "performance"} onClick={() => setTab("performance")}>Performance saisonnière</Pill>
        <Pill active={tab === "radon"} onClick={() => setTab("radon")}>Radon</Pill>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.ink, lineHeight: 1.65 }}>
        {tab === "conception" && (
          <>
            Paramètres de dimensionnement :
            <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: T.gold, margin: "8px 0", background: T.navyDeep, padding: 10, borderRadius: 6 }}>
              Profondeur d'enfouissement : 1,5 à 3 m<br />
              Diamètre des tubes : 80 à 125 mm · Vitesse de l'air : 1,5 à 4 m/s<br />
              Matériau : PE ou PP
            </div>
            Le dimensionnement consiste à déterminer, pour un débit d'air donné, la longueur totale de tubes
            pour que l'air en sortie soit le plus proche possible de la température du sol. Toujours raccordé
            à une ventilation mécanique ou une CTA — c'est le ventilateur de cette installation qui fait
            circuler l'air, le puits ne fonctionne jamais seul.
          </>
        )}
        {tab === "reseau" && (
          <>
            Le réseau comprend une entrée d'air neuf (grille anti-volatile/anti-rongeurs + filtre), les tubes
            posés avec une <strong>pente minimale</strong> pour l'écoulement des condensats, une boîte
            d'inspection pour l'entretien, et un dispositif de collecte/évacuation des condensats. Un bypass
            optionnel permet de court-circuiter le puits avec une prise d'air directe. Le réseau n'est
            volontairement <strong>pas linéaire</strong> pour maximiser le temps de contact air/sol.
          </>
        )}
        {tab === "performance" && (
          <>
            Le sol reste à température quasi constante toute l'année, contrairement à l'air extérieur (de -20°C
            à +35°C en France) — un puits bien dimensionné rapproche donc la température de sortie de celle du
            sol. Il est d'autant plus performant en hiver que l'écart air extérieur/sol est grand, et en été
            quand il est associé à une <strong>sur-ventilation nocturne</strong>. Il réduit significativement
            les besoins de chauffage, mais n'assure jamais la totalité des besoins à lui seul.
          </>
        )}
        {tab === "radon" && (
          <>
            Le radon est un gaz radioactif naturellement présent dans le sol, qui présente un vrai risque
            sanitaire. Un puits climatique peut en faciliter l'entrée dans le bâtiment : le radon pénètre
            typiquement par un défaut d'étanchéité entre le dallage et le sol, notamment quand le bâtiment est{" "}
            <strong>mis en dépression</strong> (ce que peut provoquer une ventilation mal réglée). D'où
            l'importance de l'étanchéité du dallage et d'un dimensionnement correct du système.
          </>
        )}
      </div>
    </Card>
  );
}

function PuitsClimatiqueHero({ depth, setDepth }) {
  // Illustrative: soil temperature stabilizes with depth
  const airTemp = -5;
  const soilTemp = 12;
  const outTemp = (airTemp + (soilTemp - airTemp) * Math.min(1, depth / 2.5)).toFixed(1);
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 0 22px" }}>
        <Eyebrow>Puits climatique — inertie thermique du sol</Eyebrow>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 22, color: T.ink, margin: 0 }}>
          Fais varier la profondeur d'enfouissement
        </h2>
      </div>
      <svg viewBox="0 0 760 220" style={{ width: "100%", display: "block" }}>
        <rect width="760" height="220" fill={T.navyDeep} />
        {/* soil gradient */}
        <rect x="0" y="60" width="760" height="160" fill="#0A2233" />
        {[...Array(6)].map((_, i) => (
          <line key={i} x1="0" y1={60 + i * 27} x2="760" y2={60 + i * 27} stroke={T.grid} strokeWidth="0.5" opacity="0.4" />
        ))}
        <text x="20" y="45" fontFamily={FONT_MONO} fontSize="11" fill={T.azure}>air extérieur : {airTemp}°C</text>
        <line x1="80" y1="70" x2="80" y2={70 + depth * 55} stroke={T.copper} strokeWidth="4" strokeDasharray="6 5" />
        <circle cx="80" cy={70 + depth * 55} r="6" fill={T.gold} />
        <line x1="80" y1={70 + depth * 55} x2="680" y2={70 + depth * 55} stroke={T.copper} strokeWidth="4" strokeDasharray="6 5" />
        <line x1="680" y1={70 + depth * 55} x2="680" y2="70" stroke={T.copper} strokeWidth="4" strokeDasharray="6 5" />
        <text x="360" y="205" textAnchor="middle" fontFamily={FONT_MONO} fontSize="11" fill={T.gold}>
          température du sol ≈ {soilTemp}°C (quasi constante)
        </text>
      </svg>
      <div style={{ padding: "16px 22px 22px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim }}>
          <span>Profondeur d'enfouissement</span>
          <span>{depth.toFixed(1)} m</span>
        </div>
        <input type="range" min="0" max="3" step="0.1" value={depth} onChange={(e) => setDepth(Number(e.target.value))} style={{ width: "100%", accentColor: T.copper }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim }}>Température de l'air en sortie de puits (illustrative)</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 22, color: T.gold, fontWeight: 600 }}>{outTemp}°C</span>
        </div>
      </div>
    </Card>
  );
}

const VENT_TOPICS = [
  {
    id: "qai",
    label: "QAI & réglementation",
    text: "La législation impose des débits minimaux de ventilation selon la nature du bâtiment, tandis que des organismes sanitaires fixent des objectifs de concentration limite pour certains polluants (COV) — mais ces valeurs n'ont pas de caractère réglementaire. Résultat : les débits fixés il y a 30 ans sont parfois insuffisants au regard de seuils sanitaires plus récents. Cette exigence de ventilation entre aussi en tension avec l'étanchéité à l'air imposée par la réglementation thermique, ce qui impose de bien maîtriser le fonctionnement de la ventilation mécanique.",
  },
  {
    id: "naturelle",
    label: "Ventilation naturelle",
    text: "Repose sur le tirage thermique (air chaud plus léger qui s'évacue) et l'effet du vent, sans apport mécanique. Simple et sans consommation électrique, mais son débit dépend des conditions climatiques — donc peu fiable pour garantir un renouvellement d'air constant.",
  },
  {
    id: "hybride",
    label: "Ventilation hybride",
    text: "Combine tirage naturel et assistance mécanique d'extraction, pour garantir la permanence de la ventilation même quand le tirage thermique seul est insuffisant (ex : été, vent faible).",
  },
  {
    id: "mecanique",
    label: "VMC double flux",
    text: "Échange la chaleur entre l'air extrait des pièces humides (vicié) et l'air neuf insufflé dans les pièces de vie, sans mélange des flux, via un échangeur. En hiver, l'air froid extérieur est préchauffé — rendement pouvant atteindre 80 à 90% dans les meilleures conditions. Trois technologies d'échangeur existent : statique (à plaques), rotatif (transmet aussi l'humidité), et thermodynamique (une PAC air extrait/air neuf). Deux architectures de réseau : « pieuvre » (chaque bouche reliée directement à l'unité) ou « branche » (plusieurs bouches sur un même conduit).",
  },
  {
    id: "puits",
    label: "Puits climatique",
    text: "Exploite l'inertie thermique du sol, dont la température reste relativement stable toute l'année contrairement à l'air extérieur, pour préchauffer ou rafraîchir l'air neuf avant son entrée dans le bâtiment.",
  },
  {
    id: "cta",
    label: "Centrale de traitement d'air",
    text: "Une CTA assure chauffage, rafraîchissement, humidification/déshumidification et filtration de l'air — système « tout air » à débit constant ou variable. Elle est simple flux (1 ventilateur de soufflage) ou double flux (soufflage + reprise, avec récupération de chaleur possible sur l'air extrait). Construction monobloc ou modulaire (modules ventilation, batteries chaude/froide, filtre...).",
  },
  {
    id: "dimensionnement",
    label: "Dimensionnement CTA",
    text: "Le dimensionnement d'une CTA découle des débits d'air réglementaires à assurer par local, des besoins de traitement thermique (chaud/froid) et de la qualité de filtration requise — en cohérence avec les contraintes de perte de charge du réseau aéraulique.",
  },
];

function VentTopicsPanel() {
  const [id, setId] = useState(VENT_TOPICS[0].id);
  const topic = VENT_TOPICS.find((t) => t.id === id);
  return (
    <Card>
      <Eyebrow>Notions clés</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {VENT_TOPICS.map((t) => (
          <Pill key={t.id} active={t.id === id} onClick={() => setId(t.id)}>{t.label}</Pill>
        ))}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.ink, lineHeight: 1.6 }}>{topic.text}</div>
    </Card>
  );
}

function VentilationModule({ onBack }) {
  const [depth, setDepth] = useState(1.5);
  useEffect(() => { trackEvent({ module_id: "ventilation", event_type: "module_opened" }); }, []);
  useHeartbeat("ventilation");
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
      <header>
        <button onClick={onBack} style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.azure, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 10 }}>
          ← Retour aux chapitres
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.12em", color: T.inkDim, textTransform: "uppercase" }}>
          Chapitre 4 · Systèmes énergétiques durables
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: T.ink, margin: "6px 0 4px 0" }}>
          Ventilation et traitement d'air
        </h1>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
          Qualité de l'air intérieur, ventilation naturelle/hybride/mécanique, puits climatique
          et centrale de traitement d'air (CTA).
        </p>
      </header>

      <PuitsClimatiqueHero depth={depth} setDepth={setDepth} />
      <PuitsClimatiqueFicheRevision />
      <VentTopicsPanel />
      <OpenQuestion moduleId="ventilation" question="Pourquoi un puits climatique est-il plus utile en intersaison qu'en plein été caniculaire dans une région où le sol reste chaud en profondeur ?" />
      <Quiz bank={FIXED_VENTILATION} moduleId="ventilation" />

      <footer style={{ textAlign: "center", paddingTop: 8 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.grid }}>
          Prototype — GCBD · Systèmes énergétiques durables · Habiba Lharti
        </span>
      </footer>

      <Assistant moduleId="ventilation" sectionContext={`Chapitre ouvert : Ventilation et traitement d'air. Profondeur de puits climatique simulée : ${depth.toFixed(1)} m.`} />
    </div>
  );
}

/* ---------------------------------------------------------
   Contexte énergétique — framing content from the
   "Introduction et contexte" chapter (Lharti & Couderc,
   Sept. 2025), shown on Home ahead of the 4 modules.
--------------------------------------------------------- */
const CONTEXT_STATS = [
  { value: "20 h", label: "volume horaire du cours", sub: "4 modules (9h) + projet (9h) + soutenance (2h)" },
  { value: "116 → 61", label: "Md€ facture énergétique FR", sub: "pic en 2022, retombée partielle en 2023" },
  { value: "50 %", label: "taux d'indépendance énergétique", sub: "part de la consommation primaire produite en France (2022)" },
  { value: "45 %", label: "part résidentiel-tertiaire", sub: "dans la consommation finale d'énergie en France (2022)" },
  { value: "17 %", label: "du parc logé en passoire thermique", sub: "étiquettes F/G du DPE, ~5,2 millions de logements" },
  { value: "33 %", label: "objectif ENR 2030", sub: "loi énergie-climat 2019, contre 20,7 % en 2022" },
];

function ContextePanel() {
  return (
    <Card>
      <Eyebrow>Introduction et contexte</Eyebrow>
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: T.ink, margin: "0 0 6px 0" }}>
        Pourquoi des systèmes énergétiques durables dans le bâtiment ?
      </h3>
      <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim, lineHeight: 1.6, marginTop: 0 }}>
        Le résidentiel-tertiaire pèse presque la moitié de la consommation finale d'énergie en
        France, et une part significative du parc reste très énergivore. Les 4 chapitres du cours
        couvrent les principaux postes techniques pour y répondre : eau chaude sanitaire,
        chauffage/climatisation et ventilation.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 6 }}>
        {CONTEXT_STATS.map((s, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${T.grid}`,
              borderRadius: 8,
              padding: "10px 12px",
              background: T.navyDeep,
            }}
          >
            <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 600, color: T.copper }}>
              {s.value}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: T.ink, marginTop: 2, lineHeight: 1.4 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: T.inkDim, marginTop: 3, lineHeight: 1.4 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.grid, marginTop: 10 }}>
        Sources : SDES — Chiffres clés de l'énergie / des énergies renouvelables 2023, Bilan
        énergétique de la France 2024 (données 2021–23).
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------
   Home — course landing page, module navigation grid
--------------------------------------------------------- */
function LoginScreen({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!username.trim() || !password.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (!TRACKER_URL) throw new Error("Suivi non encore activé pour ce déploiement.");
      const res = await fetch(`${TRACKER_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de connexion");
      setAuth(data.token, data.team_name);
      onLoggedIn(data.team_name);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.12em", color: T.inkDim, textTransform: "uppercase" }}>
          GCBD · Systèmes énergétiques durables
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: T.ink, margin: "6px 0" }}>
          Connexion
        </h1>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim, margin: 0 }}>
          Identifiants distribués par l'enseignante en début de semestre.
        </p>
      </div>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Identifiant"
            style={{ background: T.navyDeep, border: `1px solid ${T.grid}`, borderRadius: 8, padding: "10px 12px", color: T.ink, fontFamily: FONT_BODY, fontSize: 13.5, outline: "none" }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            type="password"
            placeholder="Mot de passe"
            style={{ background: T.navyDeep, border: `1px solid ${T.grid}`, borderRadius: 8, padding: "10px 12px", color: T.ink, fontFamily: FONT_BODY, fontSize: 13.5, outline: "none" }}
          />
          <button
            onClick={login}
            disabled={loading}
            style={{ background: T.copper, color: T.navyDeep, border: "none", borderRadius: 8, padding: "10px", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13.5, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
          {error && <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: "#E0784F" }}>{error}</div>}
        </div>
      </Card>
      <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: T.inkDim, lineHeight: 1.5, textAlign: "center" }}>
        Ce module enregistre votre progression (chapitres ouverts, scores aux quiz, temps passé),
        le nombre de questions posées à l'assistant IA (jamais leur contenu), et vos réponses aux
        questions ouvertes, afin d'aider l'enseignante à évaluer l'implication dans le cadre du
        bonus de participation. Ces données sont supprimées à la fin du semestre.
      </p>
    </div>
  );
}

function Home({ onOpen }) {
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
      <header>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.12em", color: T.inkDim, textTransform: "uppercase" }}>
          GCBD · Éco-conception des bâtiments durables
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: T.ink, margin: "6px 0 4px 0" }}>
          Systèmes énergétiques durables
        </h1>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
          Module e-learning interactif — 4 chapitres du cours, à explorer en auto-apprentissage
          avant la soutenance. Choisis un chapitre pour commencer.
        </p>
      </header>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim }}>
        <span>Connecté : <strong style={{ color: T.ink }}>{getAuth().team}</strong></span>
        <button
          onClick={() => { clearAuth(); window.location.reload(); }}
          style={{ background: "none", border: "none", color: T.azure, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 11 }}
        >
          se déconnecter
        </button>
      </div>
      <ContextePanel />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {MODULES.map((m) => (
          <button
            key={m.id}
            onClick={() => m.ready && onOpen(m.id)}
            style={{
              textAlign: "left",
              cursor: m.ready ? "pointer" : "default",
              background: T.panel,
              border: `1px solid ${m.ready ? T.grid : "#173245"}`,
              borderRadius: 10,
              padding: 18,
              opacity: m.ready ? 1 : 0.55,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: m.ready ? T.copper : T.inkDim }}>
              Chapitre {m.number} {m.ready ? "" : "· à venir"}
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: T.ink }}>
              {m.title}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim }}>{m.subtitle}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim, lineHeight: 1.5, marginTop: 4 }}>
              {m.resume}
            </div>
            {m.ready && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.copper, marginTop: 6 }}>
                Ouvrir →
              </span>
            )}
          </button>
        ))}
      </div>

      <footer style={{ textAlign: "center", paddingTop: 8 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.grid }}>
          Prototype — GCBD · Systèmes énergétiques durables · Habiba Lharti
        </span>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------
   Capteurs comparison — added from the deepened 2025 course
   content (rendement equations, coefficient K, price ranges)
--------------------------------------------------------- */
const CAPTEURS = [
  { id: "nonvitre", label: "Non vitré", temp: "< 30°C", k: "K entre 20 et 25", prix: "économique", usage: "Chauffage de piscine, fortes pertes thermiques" },
  { id: "vitre", label: "Plan vitré", temp: "50–80°C (90°C double vitrage)", k: "K entre 3 et 6", prix: "200–400 €/m²", usage: "Le plus utilisé en CESI résidentiel" },
  { id: "tube", label: "Tubes sous vide", temp: "60–85°C", k: "K entre 1 et 3", prix: "~600 €/m²", usage: "Zones froides, meilleur rendement à fort DT" },
];

function SolaireFicheRevision() {
  const [tab, setTab] = useState("pose");
  return (
    <Card>
      <Eyebrow>Fiche de révision — tout ce qui est testé dans le quiz</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <Pill active={tab === "pose"} onClick={() => setTab("pose")}>Pose des capteurs</Pill>
        <Pill active={tab === "securite"} onClick={() => setTab("securite")}>Composants de sécurité</Pill>
        <Pill active={tab === "dimensionnement"} onClick={() => setTab("dimensionnement")}>Dimensionnement</Pill>
        <Pill active={tab === "risques"} onClick={() => setTab("risques")}>Risques sanitaires</Pill>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.ink, lineHeight: 1.65 }}>
        {tab === "pose" && (
          <>
            5 méthodes de pose des capteurs solaires : <strong>en intégration</strong> (remplace la couverture,
            le plus intégré esthétiquement), <strong>en surimposition</strong> (fixés sur la toiture existante via
            rails/crochets, le plus courant), <strong>en façade</strong>, <strong>sur châssis</strong> (au sol ou
            toit terrasse), et <strong>en casquette</strong> (structure en saillie). Le choix dépend de
            l'orientation disponible, de la structure du bâti et du budget.
          </>
        )}
        {tab === "securite" && (
          <>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li><strong>Soupape de sécurité</strong> — évite le dépassement de pression max, tarée à moins 10% de cette pression, raccordée à un réservoir de récupération, sur le circuit d'entrée des capteurs.</li>
              <li><strong>Vase d'expansion</strong> — absorbe la dilatation du fluide, comporte purge de gaz et vidange.</li>
              <li><strong>Clapet anti-thermosiphon</strong> — indispensable si le ballon est au même niveau ou plus bas que les capteurs, pour empêcher un refroidissement nocturne du ballon par circulation inversée.</li>
              <li><strong>Mitigeur thermostatique</strong> — mélange eau chaude/froide pour livrer max 60°C aux points de puisage (sans lui, l'eau peut dépasser 80°C en été).</li>
              <li><strong>Groupe de sécurité</strong> — 4 fonctions en un accessoire : robinet d'arrêt, clapet anti-retour, robinet de vidange, soupape de sécurité.</li>
            </ul>
          </>
        )}
        {tab === "dimensionnement" && (
          <>
            5 étapes : besoins ECS → volume du ballon (100 à 200% de la conso journalière) → surface de capteurs
            (ratio 45 à 75 L de stockage par m² selon la zone climatique) → taux de couverture solaire (jamais
            visé à 100% : ne doit pas dépasser 85% l'été, sous peine de surchauffe) → productivité solaire
            (400 à 600 kWh/m².an visés).
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#E0784F", margin: "8px 0", background: T.navyDeep, padding: 10, borderRadius: 6 }}>
              Un surdimensionnement entraîne : coût d'installation plus élevé, productivité limitée, risque de
              surchauffe l'été (dégradation du liquide antigel, usure prématurée), et donc contre-performance
              globale de l'installation.
            </div>
          </>
        )}
        {tab === "risques" && (
          <>
            <strong>Brûlures</strong> — à 60°C, 1 seconde d'exposition suffit pour une brûlure au 2e degré, contre
            2,5 minutes à 50°C pour un enfant de moins de 5 ans. Les plus exposés : enfants, personnes âgées,
            personnes en situation de handicap.
            <br /><br />
            <strong>Légionelles</strong> — bactéries responsables de plus de 1000 cas de légionellose déclarés
            par an en France, dont une centaine de décès. Contamination par inhalation de fines gouttelettes
            (douches principalement). Les légionelles se développent dans les biofilms des canalisations. D'où
            l'obligation réglementaire de maintenir l'ECS ≥ 55°C en sortie de ballon (ou cycles de choc thermique)
            au-delà de 400 L stockés, tout en limitant à 50-60°C aux points de puisage pour éviter les brûlures —
            d'où le rôle clé du mitigeur thermostatique.
          </>
        )}
      </div>
    </Card>
  );
}

function CapteursPanel() {
  const [id, setId] = useState(CAPTEURS[1].id);
  const c = CAPTEURS.find((x) => x.id === id);
  return (
    <Card>
      <Eyebrow>Différents modèles de capteurs</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {CAPTEURS.map((x) => (
          <Pill key={x.id} active={x.id === id} onClick={() => setId(x.id)}>{x.label}</Pill>
        ))}
      </div>
      <div style={{ border: `1px solid ${T.grid}`, borderRadius: 8, padding: 14, background: T.navyDeep }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontFamily: FONT_MONO, fontSize: 12, color: T.ink }}>
          <div><span style={{ color: T.inkDim }}>Eau produite : </span>{c.temp}</div>
          <div><span style={{ color: T.inkDim }}>Pertes thermiques : </span>{c.k}</div>
          <div><span style={{ color: T.inkDim }}>Coût : </span>{c.prix}</div>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.ink, marginTop: 10, lineHeight: 1.5 }}>{c.usage}</div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.grid, marginTop: 10 }}>
        Rendement η = β − K·(T_moy − T_ext)/P (méthode française) — plus K est faible, moins il y a de pertes.
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------
   Module 1 — Solaire thermique (fully built)
--------------------------------------------------------- */
function SolaireThermiqueModule({ onBack }) {
  const [sun, setSun] = useState(65);
  useEffect(() => { trackEvent({ module_id: "solaire", event_type: "module_opened" }); }, []);
  useHeartbeat("solaire");

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
      <header>
        <button
          onClick={onBack}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: T.azure,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            marginBottom: 10,
          }}
        >
          ← Retour aux chapitres
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.12em", color: T.inkDim, textTransform: "uppercase" }}>
          Chapitre 1 · Systèmes énergétiques durables
        </div>
        <h1
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 30,
            color: T.ink,
            margin: "6px 0 4px 0",
          }}
        >
          Solaire thermique — le CESI en action
        </h1>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
          Prototype interactif — remplace la lecture linéaire du module Scenari par
          une exploration manipulable du principe de fonctionnement, des variantes de
          système et de la régulation d'un Chauffe-Eau Solaire Individuel.
        </p>
      </header>

      <HeroSchema sun={sun} setSun={setSun} />
      <CapteursPanel />
      <SolaireFicheRevision />
      <Simulator />
      <Regulation />
      <OpenQuestion moduleId="solaire" question="Un CESI à circulation forcée est réglé avec un Différentiel de Démarrage (DD) trop faible. Quel phénomène cela provoque-t-il, et pourquoi est-ce problématique pour le circulateur ?" />
      <Quiz bank={FIXED_SOLAIRE} moduleId="solaire" />

      <footer style={{ textAlign: "center", paddingTop: 8 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.grid }}>
          Prototype — GCBD · Systèmes énergétiques durables · Habiba Lharti
        </span>
      </footer>

      <Assistant moduleId="solaire" sectionContext={`Chapitre ouvert : Solaire thermique. Niveau d'ensoleillement simulé actuel : ${sun}%.`} />
    </div>
  );
}

/* ---------------------------------------------------------
   Placeholder module — for chapters without content yet
--------------------------------------------------------- */
function PlaceholderModule({ mod, onBack }) {
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
      <header>
        <button
          onClick={onBack}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: T.azure,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            marginBottom: 10,
          }}
        >
          ← Retour aux chapitres
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.12em", color: T.inkDim, textTransform: "uppercase" }}>
          Chapitre {mod.number} · Systèmes énergétiques durables
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: T.ink, margin: "6px 0 4px 0" }}>
          {mod.title}
        </h1>
      </header>
      <Card style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.inkDim }}>
          Contenu en préparation — en attente du support de cours pour ce chapitre.
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------
   Root — simple client-side router across the 4 chapters
--------------------------------------------------------- */
export default function App() {
  const [view, setView] = useState("home");
  const [loggedIn, setLoggedIn] = useState(!TRACKER_URL || !!getAuth().token);
  const activeMod = MODULES.find((m) => m.id === view);

  if (TRACKER_URL && !loggedIn) {
    return (
      <div style={{ minHeight: "100vh", background: T.navy, fontFamily: FONT_BODY, padding: "28px 18px 60px 18px" }}>
        <style>{`@import url('${FONT_IMPORT_URL}');`}</style>
        <LoginScreen onLoggedIn={() => setLoggedIn(true)} />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.navy,
        fontFamily: FONT_BODY,
        padding: "28px 18px 60px 18px",
      }}
    >
      <style>{`@import url('${FONT_IMPORT_URL}');`}</style>

      {view === "home" && <Home onOpen={setView} />}
      {view === "solaire" && <SolaireThermiqueModule onBack={() => setView("home")} />}
      {view === "pac" && <PompeAChaleurModule onBack={() => setView("home")} />}
      {view === "pv" && <SolairePhotovoltaiqueModule onBack={() => setView("home")} />}
      {view === "ventilation" && <VentilationModule onBack={() => setView("home")} />}
      {activeMod && !activeMod.ready && (
        <PlaceholderModule mod={activeMod} onBack={() => setView("home")} />
      )}
    </div>
  );
}
