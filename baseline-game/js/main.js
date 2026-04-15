import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const isDesktopFinePointer =
  window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches ?? false;

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}
function nowMs() {
  return performance.now();
}
function formatSeconds(ms) {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}m ${r.toFixed(0)}s`;
}
function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pickUnique(arr, n) {
  if (n > arr.length) throw new Error("pickUnique: n larger than array length");
  const copy = [...arr];
  shuffleInPlace(copy);
  return copy.slice(0, n);
}
function lerpColor(c1, c2, t) {
  const a = new THREE.Color(c1);
  const b = new THREE.Color(c2);
  return a.lerp(b, t);
}
function cssColorFromThreeColor(c) {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

/* ------------------------------- CSV helpers ------------------------------ */
function csvCell(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
function downloadTextFile(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  return ok;
}
function safeTimestampForFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

/* -------------------------------------------------------------------------- */
/* DOM elements                                                               */
/* -------------------------------------------------------------------------- */
const tutorialOverlay = document.getElementById("tutorialOverlay");
const tutorialBody = document.getElementById("tutorialBody");
const tutorialBackBtn = document.getElementById("tutorialBackBtn");
const tutorialNextBtn = document.getElementById("tutorialNextBtn");

const lookModePanel = document.getElementById("lookModePanel");
const lookModeRadios = Array.from(document.querySelectorAll('input[name="lookMode"]'));

const taskBar = document.getElementById("taskBar");
const taskTargetNameEl = document.getElementById("taskTargetName");

const confirmBtn = document.getElementById("confirmBtn");
const resetBtn = document.getElementById("resetBtn");

const stickZone = document.getElementById("stickZone");
const stickKnob = document.getElementById("stickKnob");

const crosshair = document.getElementById("crosshair");

if (!tutorialOverlay || !tutorialBody || !tutorialBackBtn || !tutorialNextBtn) {
  throw new Error(
    "Tutorial UI elements not found. Check index.html IDs: tutorialOverlay, tutorialBody, tutorialBackBtn, tutorialNextBtn."
  );
}
if (!taskBar || !taskTargetNameEl) {
  throw new Error("Task bar elements not found. Check index.html IDs: taskBar, taskTargetName.");
}

/* -------------------------------------------------------------------------- */
/* Live stats line in task bar                                                */
/* -------------------------------------------------------------------------- */
const taskStatsEl = document.createElement("div");
taskStatsEl.style.marginTop = "8px";
taskStatsEl.style.fontSize = "12px";
taskStatsEl.style.opacity = "0.88";
taskStatsEl.style.fontWeight = "650";
taskStatsEl.style.color = "rgba(255,255,255,0.90)";
taskBar.appendChild(taskStatsEl);

/* Bigger, cleaner guidance line (distance only) */
const navGuideEl = document.createElement("div");
navGuideEl.style.marginTop = "10px";
navGuideEl.style.fontSize = "16px";
navGuideEl.style.lineHeight = "1.15";
navGuideEl.style.opacity = "1";
navGuideEl.style.fontWeight = "950";
navGuideEl.style.letterSpacing = "0.02em";
navGuideEl.style.color = "white";
navGuideEl.style.textShadow = "0 2px 12px rgba(0,0,0,0.55)";
navGuideEl.style.padding = "8px 10px";
navGuideEl.style.borderRadius = "12px";
navGuideEl.style.background = "rgba(0,0,0,0.25)";
navGuideEl.style.border = "1px solid rgba(255,255,255,0.12)";
navGuideEl.style.display = "inline-block";
taskBar.appendChild(navGuideEl);

/* -------------------------------------------------------------------------- */
/* Center Dialog (modal) for feedback                                         */
/* -------------------------------------------------------------------------- */
const dialogOverlay = document.createElement("div");
dialogOverlay.style.position = "fixed";
dialogOverlay.style.inset = "0";
dialogOverlay.style.display = "none";
dialogOverlay.style.placeItems = "center";
dialogOverlay.style.background = "rgba(4,7,18,0.62)";
dialogOverlay.style.zIndex = "250";
dialogOverlay.style.padding = "18px";
dialogOverlay.style.backdropFilter = "blur(10px)";

const dialogCard = document.createElement("div");
dialogCard.style.width = "min(760px, 100%)";
dialogCard.style.borderRadius = "18px";
dialogCard.style.background = "rgba(0,0,0,0.72)";
dialogCard.style.border = "1px solid rgba(255,255,255,0.14)";
dialogCard.style.boxShadow = "0 26px 90px rgba(0,0,0,0.65)";
dialogCard.style.padding = "16px";

const dialogTitle = document.createElement("div");
dialogTitle.style.fontSize = "20px";
dialogTitle.style.fontWeight = "950";
dialogTitle.style.color = "white";
dialogTitle.style.marginBottom = "8px";

const dialogBody = document.createElement("div");
dialogBody.style.color = "rgba(255,255,255,0.95)";
dialogBody.style.fontSize = "15px";
dialogBody.style.lineHeight = "1.45";

const dialogMetrics = document.createElement("div");
dialogMetrics.style.display = "grid";
dialogMetrics.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
dialogMetrics.style.gap = "10px";
dialogMetrics.style.marginTop = "12px";

function metricBox(label, value) {
  const box = document.createElement("div");
  box.style.borderRadius = "14px";
  box.style.background = "rgba(255,255,255,0.08)";
  box.style.border = "1px solid rgba(255,255,255,0.12)";
  box.style.padding = "12px";

  const l = document.createElement("div");
  l.textContent = label;
  l.style.fontSize = "12px";
  l.style.fontWeight = "900";
  l.style.letterSpacing = "0.10em";
  l.style.opacity = "0.9";
  l.style.textTransform = "uppercase";

  const v = document.createElement("div");
  v.textContent = value;
  v.style.marginTop = "6px";
  v.style.fontSize = "22px";
  v.style.fontWeight = "950";
  v.style.letterSpacing = "-0.01em";
  v.style.color = "white";

  box.appendChild(l);
  box.appendChild(v);
  return box;
}

const dialogActions = document.createElement("div");
dialogActions.style.display = "flex";
dialogActions.style.justifyContent = "flex-end";
dialogActions.style.gap = "10px";
dialogActions.style.marginTop = "14px";

const dialogBtn = document.createElement("button");
dialogBtn.className = "btn tutorialPrimary";
dialogBtn.textContent = "Continue";
dialogBtn.style.minWidth = "160px";

dialogActions.appendChild(dialogBtn);
dialogCard.appendChild(dialogTitle);
dialogCard.appendChild(dialogBody);
dialogCard.appendChild(dialogMetrics);
dialogCard.appendChild(dialogActions);
dialogOverlay.appendChild(dialogCard);
document.body.appendChild(dialogOverlay);

let dialogResolve = null;
dialogBtn.addEventListener("click", () => {
  dialogOverlay.style.display = "none";
  if (dialogResolve) dialogResolve();
  dialogResolve = null;
});

function showDialog({ title, bodyHtml, metrics = [], buttonText = "Continue", extraActions = [] }) {
  dialogTitle.textContent = title;
  dialogBody.innerHTML = bodyHtml;
  dialogBtn.textContent = buttonText;

  dialogMetrics.innerHTML = "";
  if (metrics.length === 0) {
    dialogMetrics.style.display = "none";
  } else {
    dialogMetrics.style.display = "grid";
    for (const m of metrics) dialogMetrics.appendChild(metricBox(m.label, m.value));
  }

  dialogActions.innerHTML = "";

  for (const act of extraActions) {
    const b = document.createElement("button");
    b.className = act.className || "btn";
    b.textContent = act.label;
    b.addEventListener("click", async () => {
      try {
        await act.onClickAsync?.();
      } catch (e) {
        console.error(e);
      }
    });
    dialogActions.appendChild(b);
  }

  dialogActions.appendChild(dialogBtn);

  dialogOverlay.style.display = "grid";
  dialogCard.animate(
    [
      { transform: "translateY(10px) scale(0.985)", opacity: 0.0 },
      { transform: "translateY(0px) scale(1)", opacity: 1.0 },
    ],
    { duration: 160, easing: "ease-out" }
  );

  return new Promise((resolve) => {
    dialogResolve = resolve;
  });
}

/* -------------------------------------------------------------------------- */
/* Tutorial step indicator + progress bar                                     */
/* -------------------------------------------------------------------------- */
const tutorialTitle = document.getElementById("tutorialTitle");
const tutorialCard = document.getElementById("tutorialCard");

const tutorialStep = document.createElement("div");
tutorialStep.style.marginBottom = "8px";
tutorialStep.style.fontSize = "12px";
tutorialStep.style.letterSpacing = "0.08em";
tutorialStep.style.opacity = "0.9";
tutorialStep.style.fontWeight = "900";
tutorialStep.textContent = "STEP 1";
tutorialTitle?.insertAdjacentElement("afterend", tutorialStep);

const tutorialProgressWrap = document.createElement("div");
tutorialProgressWrap.style.height = "8px";
tutorialProgressWrap.style.borderRadius = "999px";
tutorialProgressWrap.style.background = "rgba(255,255,255,0.10)";
tutorialProgressWrap.style.border = "1px solid rgba(255,255,255,0.12)";
tutorialProgressWrap.style.overflow = "hidden";
tutorialProgressWrap.style.margin = "8px 0 10px 0";

const tutorialProgressBar = document.createElement("div");
tutorialProgressBar.style.height = "100%";
tutorialProgressBar.style.width = "0%";
tutorialProgressBar.style.borderRadius = "999px";
tutorialProgressBar.style.background =
  "linear-gradient(90deg, rgba(46,107,255,1), rgba(255,209,102,1))";
tutorialProgressWrap.appendChild(tutorialProgressBar);
tutorialStep.insertAdjacentElement("afterend", tutorialProgressWrap);

/* -------------------------------------------------------------------------- */
/* Tasks (random 5 from pool each run)                                        */
/* -------------------------------------------------------------------------- */
const BUILDING_POOL = [
  "Boyd Orr",
  "Main Building",
  "Library",
  "GUU",
  "Adam Smith Building",
  "JMS",
  "Stevenson Building",
  "Fraser Building",
];
const TASKS_PER_RUN = 5;

let tasks = [];
let totalTasks = TASKS_PER_RUN;

let currentTaskIndex = 0;
let taskStartMs = nowMs();
let wrongAttemptsThisTask = 0;

let totalStartMs = nowMs();
let totalWrongAttempts = 0;
let totalConfirms = 0;

let perTask = [];

let participantId = "";
function ensureParticipantId() {
  if (participantId) return participantId;
  const raw = prompt(
    "Participant ID (e.g., P01). Leave blank to auto-generate.\n\nDo NOT enter name/email."
  );
  participantId = (raw || "").trim();
  if (!participantId) participantId = `P-${Date.now()}`;
  return participantId;
}

function generateNewTasks() {
  tasks = pickUnique(BUILDING_POOL, TASKS_PER_RUN);
  shuffleInPlace(tasks);
  totalTasks = tasks.length;
  perTask = tasks.map(() => ({ timeMs: 0, wrong: 0, confirms: 0 }));
}

function resetRunState({ newTasks = true } = {}) {
  if (newTasks) generateNewTasks();

  currentTaskIndex = 0;
  taskStartMs = nowMs();
  wrongAttemptsThisTask = 0;

  totalStartMs = nowMs();
  totalWrongAttempts = 0;
  totalConfirms = 0;

  updateTaskBar();
}

function startTask(index) {
  currentTaskIndex = index;
  taskStartMs = nowMs();
  wrongAttemptsThisTask = 0;
  updateTaskBar();
}

function updateTaskBar() {
  if (currentTaskIndex >= totalTasks) {
    taskTargetNameEl.textContent = `All tasks complete — Final report shown`;
    taskStatsEl.textContent = `Run complete.`;
    navGuideEl.textContent = ``;
    return;
  }
  const label = `Task ${currentTaskIndex + 1} of ${totalTasks}`;
  const target = tasks[currentTaskIndex];
  taskTargetNameEl.textContent = `${label} — Walk to: ${target}`;
}

resetRunState({ newTasks: true });

/* -------------------------------------------------------------------------- */
/* Tutorial pages                                                             */
/* -------------------------------------------------------------------------- */
let tutorialIndex = 0;
const tutorialPages = [
  {
    title: "Welcome",
    body:
      `Welcome to the Campus Navigation Simulator.<br><br>` +
      `Each run gives you <b>${TASKS_PER_RUN}</b> random tasks.<br><br>` +
      `Your goal:<br>` +
      `• Move toward the target building<br>` +
      `• Aim the circle at it<br>` +
      `• Press <b>Confirm</b> to select it`,
  },
  {
    title: "How to Move",
    body:
      `Move around the campus:<br>` +
      `• Mobile: swipe/drag the joystick<br>` +
      `• Desktop: WASD or arrow keys<br><br>` +
      `The task banner stays on screen so you always know where to go.`,
  },
  {
    title: "How to Aim",
    body:
      `Aim at buildings:<br>` +
      `• Mobile: tilt your phone<br>` +
      `• Desktop: drag the mouse to look around<br><br>` +
      `When a building highlights, you are aiming at it.`,
  },
  {
    title: "Confirm & Feedback",
    body:
      `Press <b>Confirm</b> to choose the highlighted building.<br><br>` +
      `Correct picks flash <b>green</b> with a "ding".<br>` +
      `Wrong picks flash <b>red</b> with a "buzz".<br><br>` +
      `We track time and errors for each task.`,
  },
  {
    title: "Ready to Start",
    body: `Press <b>Start walking</b> when you're ready.`,
  },
];

if (lookModePanel) {
  lookModePanel.style.display = isDesktopFinePointer ? "block" : "none";
}

function setTutorialProgress(i) {
  const pctDone = ((i + 1) / tutorialPages.length) * 100;
  tutorialProgressBar.style.width = `${pctDone}%`;
  tutorialStep.textContent = `STEP ${i + 1} / ${tutorialPages.length} — ${tutorialPages[i].title}`;
}

function animateTutorialChange() {
  if (!tutorialCard) return;
  tutorialCard.animate(
    [
      { transform: "translateY(0px) scale(1)", opacity: 1 },
      { transform: "translateY(6px) scale(0.995)", opacity: 0.7 },
      { transform: "translateY(0px) scale(1)", opacity: 1 },
    ],
    { duration: 220, easing: "ease-out" }
  );
}

function renderTutorial() {
  tutorialBody.innerHTML = tutorialPages[tutorialIndex].body;
  tutorialBackBtn.disabled = tutorialIndex === 0;

  const isLast = tutorialIndex === tutorialPages.length - 1;
  tutorialNextBtn.textContent = isLast ? "Start walking" : "Next";
  tutorialNextBtn.classList.toggle("isGlow", isLast);

  setTutorialProgress(tutorialIndex);
  animateTutorialChange();
}
renderTutorial();

tutorialBackBtn.addEventListener("click", () => {
  tutorialIndex = Math.max(0, tutorialIndex - 1);
  renderTutorial();
});

/* -------------------------------------------------------------------------- */
/* Look mode                                                                  */
/* -------------------------------------------------------------------------- */
let lookMode = "drag"; // "drag" or "fps"
function readLookModeFromUI() {
  const chosen = lookModeRadios.find((r) => r.checked)?.value;
  if (chosen === "fps" || chosen === "drag") lookMode = chosen;
}

/* -------------------------------------------------------------------------- */
/* Tilt aiming (ABSOLUTE TILT - OLD BASELINE METHOD)                         */
/* -------------------------------------------------------------------------- */
const aim = { yaw: 0, pitch: 0 };
let tiltEnabled = false;

async function requestTiltPermissionIfNeeded() {
  if (typeof DeviceOrientationEvent === "undefined") return false;
  const DOE = DeviceOrientationEvent;

  if (typeof DOE.requestPermission === "function") {
    try {
      const res = await DOE.requestPermission();
      tiltEnabled = res === "granted";
      return tiltEnabled;
    } catch {
      tiltEnabled = false;
      return false;
    }
  }

  tiltEnabled = true;
  return true;
}

// ABSOLUTE TILT METHOD (Direct mapping, capped)
window.addEventListener("deviceorientation", (e) => {
  if (!tiltEnabled) return;

  const beta = (e.beta ?? 0) * (Math.PI / 180);
  const gamma = (e.gamma ?? 0) * (Math.PI / 180);

  // pitch (front/back tilt)
  aim.pitch = clamp(beta * 0.6, -1.1, 1.1);

  // yaw (left/right tilt) DIRECT MAPPING (capped at ±30°)
  aim.yaw = gamma * 0.8;  // ← ABSOLUTE POSITIONING, NOT ACCUMULATING
  
  console.log("Absolute Tilt: yaw =", aim.yaw.toFixed(3), "gamma =", gamma.toFixed(3));
});

/* -------------------------------------------------------------------------- */
/* Desktop mouse aiming + renderer var                                        */
/* -------------------------------------------------------------------------- */
let renderer = null;
let mouseDown = false;
let lastX = 0,
  lastY = 0;

function restoreCursor() {
  document.body.style.cursor = "default";
  if (renderer?.domElement) renderer.domElement.style.cursor = "default";
}

document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement) restoreCursor();
});

window.addEventListener("keyup", (e) => {
  if (e.key === "Escape") restoreCursor();
});

function onMouseMoveDrag(e) {
  if (!mouseDown) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  aim.yaw -= dx * 0.003;
  aim.pitch -= dy * 0.003;
  aim.pitch = clamp(aim.pitch, -1.2, 1.2);
}

function onMouseMoveFPS(e) {
  if (!renderer) return;
  if (document.pointerLockElement !== renderer.domElement) return;
  aim.yaw -= (e.movementX || 0) * 0.0025;
  aim.pitch -= (e.movementY || 0) * 0.0025;
  aim.pitch = clamp(aim.pitch, -1.2, 1.2);
}

function enableMouseLookHandlers() {
  window.removeEventListener("mousemove", onMouseMoveDrag);
  window.removeEventListener("mousemove", onMouseMoveFPS);

  if (lookMode === "drag") window.addEventListener("mousemove", onMouseMoveDrag);
  else window.addEventListener("mousemove", onMouseMoveFPS);
}

window.addEventListener("mousedown", (e) => {
  mouseDown = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener("mouseup", () => (mouseDown = false));

/* -------------------------------------------------------------------------- */
/* Movement input (keys + joystick)                                           */
/* -------------------------------------------------------------------------- */
const keys = new Set();
window.addEventListener(
  "keydown",
  (e) => {
    keys.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  },
  { passive: false }
);
window.addEventListener("keyup", (e) => keys.delete(e.code));

let stickActive = false;
let stickCenter = { x: 0, y: 0 };
let stickVec = new THREE.Vector2(0, 0);
const stickMax = 46;

function setKnob(dx, dy) {
  if (!stickKnob) return;
  stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}
function pointerXY(ev) {
  if (ev.touches?.length) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
  return { x: ev.clientX, y: ev.clientY };
}
function updateStick(px, py) {
  const dx = px - stickCenter.x;
  const dy = py - stickCenter.y;
  const len = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(len, stickMax);
  const ndx = (dx / len) * clamped;
  const ndy = (dy / len) * clamped;
  setKnob(ndx, ndy);
  stickVec.set(ndx / stickMax, ndy / stickMax);
}
function onStickDown(ev) {
  if (!stickZone) return;
  stickActive = true;
  const r = stickZone.getBoundingClientRect();
  stickCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const p = pointerXY(ev);
  updateStick(p.x, p.y);
}
function onStickMove(ev) {
  if (!stickActive) return;
  ev.preventDefault();
  const p = pointerXY(ev);
  updateStick(p.x, p.y);
}
function onStickUp() {
  stickActive = false;
  stickVec.set(0, 0);
  setKnob(0, 0);
}
stickZone?.addEventListener("pointerdown", onStickDown);
window.addEventListener("pointermove", onStickMove, { passive: false });
window.addEventListener("pointerup", onStickUp);
window.addEventListener("pointercancel", onStickUp);

/* -------------------------------------------------------------------------- */
/* Audio + Vibration feedback                                                 */
/* -------------------------------------------------------------------------- */
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume?.();
}

function playDing() {
  try {
    ensureAudio();
    const t0 = audioCtx.currentTime;

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    o.type = "sine";
    o.frequency.setValueAtTime(880, t0);
    o.frequency.exponentialRampToValueAtTime(1320, t0 + 0.08);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);

    o.connect(g).connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + 0.2);
  } catch {
    // ignore
  }
}

function playBuzz() {
  try {
    ensureAudio();
    const t0 = audioCtx.currentTime;

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    o.type = "sawtooth";
    o.frequency.setValueAtTime(140, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);

    o.connect(g).connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + 0.25);
  } catch {
    // ignore
  }

  if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
}

/* -------------------------------------------------------------------------- */
/* 3D Simulation                                                              */
/* -------------------------------------------------------------------------- */
let scene, camera;
let buildings = [];
let currentTarget = null;
let currentGoalBuilding = null;

const player = {
  pos: new THREE.Vector3(0, 1.7, 40),
  speed: 10,
};

const moveState = { forward: 0, strafe: 0 };
const MOVE_ACCEL_PER_SEC = 8.0;
const MOVE_DECEL_PER_SEC = 11.0;

const GUIDE_NEAR = 10;
const GUIDE_FAR = 80;

const aimHighlightMat = new THREE.MeshStandardMaterial({
  color: 0xffd166,
  roughness: 0.45,
  emissive: 0x5a3a00,
  emissiveIntensity: 0.9,
});
const correctMat = new THREE.MeshStandardMaterial({
  color: 0x22c55e,
  roughness: 0.35,
  emissive: 0x22c55e,
  emissiveIntensity: 1.25,
});
const wrongMat = new THREE.MeshStandardMaterial({
  color: 0xef4444,
  roughness: 0.35,
  emissive: 0xef4444,
  emissiveIntensity: 1.25,
});

/* -------------------------------------------------------------------------- */
/* Visual palette + simple props                                              */
/* -------------------------------------------------------------------------- */
const BUILDING_STYLE = {
  "Boyd Orr": { color: 0xbfc5c9, accent: 0x2b2f36, windows: 0x2a6aa8 },
  "Main Building": { color: 0xc9b08b, accent: 0x6b4f2a, windows: 0x7aa7ff },
  "Library": { color: 0x9fb6c8, accent: 0x233042, windows: 0x7aa7ff },
  "GUU": { color: 0xa7b7a3, accent: 0x2f3b2e, windows: 0x6dd6ff },
  "Adam Smith Building": { color: 0xc4a6c8, accent: 0x3b2241, windows: 0xd7b6ff },
  "JMS": { color: 0xd0a48a, accent: 0x3a2a22, windows: 0xffd37a },
  "Stevenson Building": { color: 0xaaaaaa, accent: 0x1f2937, windows: 0xb6f0ff },
  "Fraser Building": { color: 0xb9c38a, accent: 0x2d3a1f, windows: 0x9cffd9 },
};

function addTree(scene, x, z, s = 1) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.1 * s, 10),
    new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 1 })
  );
  trunk.position.set(x, 0.55 * s, z);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.75 * s, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0x2f6f4e, roughness: 1 })
  );
  crown.position.set(x, 1.55 * s, z);

  scene.add(trunk, crown);
}

function addBench(scene, x, z, ry = 0) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.25 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.45), wood);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.10), wood);
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.35), metal);
  const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.35), metal);

  seat.position.set(0, 0.32, 0);
  back.position.set(0, 0.55, -0.18);
  leg1.position.set(-0.78, 0.17, 0);
  leg2.position.set(0.78, 0.17, 0);

  const g = new THREE.Group();
  g.add(seat, back, leg1, leg2);
  g.position.set(x, 0, z);
  g.rotation.y = ry;

  scene.add(g);
}

function addStreetLamp(scene, x, z, height = 6) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.2 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x3b424d, roughness: 0.5, metalness: 0.35 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, height, 10), poleMat);
  pole.position.set(x, height / 2, z);
  scene.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), headMat);
  arm.position.set(x + 0.45, height - 0.2, z);
  scene.add(arm);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xfff1c1,
      roughness: 0.2,
      emissive: 0xffd37a,
      emissiveIntensity: 1.0,
    })
  );
  bulb.position.set(x + 0.9, height - 0.2, z);
  scene.add(bulb);

  const light = new THREE.PointLight(0xffe6b5, 0.55, 16, 2);
  light.position.set(x + 0.9, height - 0.2, z);
  scene.add(light);
}

function addDashedCenterLine(scene, { axis = "x", length = 260, dash = 6, gap = 6, y = 0.02 }) {
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xf6f2c0,
    roughness: 0.6,
    metalness: 0.0,
    emissive: 0x1a1a10,
    emissiveIntensity: 0.12,
  });

  const total = dash + gap;
  const count = Math.floor(length / total);

  for (let i = 0; i < count; i++) {
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(dash, 0.35), lineMat);
    seg.rotation.x = -Math.PI / 2;
    const t = -length / 2 + i * total + dash / 2;

    if (axis === "x") seg.position.set(t, y, 0);
    else seg.position.set(0, y, t);

    scene.add(seg);
  }
}

function makeLabelSprite(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const fontSize = 48;
  ctx.font = `900 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  const padX = 36;
  const padY = 22;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width + padX * 2);
  const h = Math.ceil(fontSize + padY * 2);

  canvas.width = w;
  canvas.height = h;

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  ctx.font = `900 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, padX, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(w * 0.01, h * 0.01, 1);
  sprite.renderOrder = 999;
  return sprite;
}

function findBuildingByName(name) {
  return buildings.find((b) => b?.userData?.name === name) || null;
}
function refreshGoalMesh() {
  if (currentTaskIndex >= totalTasks) {
    currentGoalBuilding = null;
    return;
  }
  currentGoalBuilding = findBuildingByName(tasks[currentTaskIndex]);
}
function distanceToCurrentGoal() {
  if (!currentGoalBuilding) return null;
  const dx = currentGoalBuilding.position.x - player.pos.x;
  const dz = currentGoalBuilding.position.z - player.pos.z;
  return Math.hypot(dx, dz);
}

function updateNavGuidanceUI() {
  if (currentTaskIndex >= totalTasks || !currentGoalBuilding || !camera) {
    navGuideEl.textContent = "";
    navGuideEl.style.color = "rgba(255,255,255,0.92)";
    return;
  }

  const dist = distanceToCurrentGoal();
  if (dist == null) return;

  const t = clamp((dist - GUIDE_NEAR) / (GUIDE_FAR - GUIDE_NEAR), 0, 1);
  let col;
  if (t < 0.5) col = lerpColor(0x22c55e, 0xffd166, t / 0.5);
  else col = lerpColor(0xffd166, 0xef4444, (t - 0.5) / 0.5);

  navGuideEl.textContent = `${dist.toFixed(0)}m to target`;
  navGuideEl.style.color = cssColorFromThreeColor(col);
}

function buildResultsCsv() {
  const pid = participantId || "unknown";
  const runTs = new Date().toISOString();

  const totalElapsed = nowMs() - totalStartMs;
  const overallAccuracy = totalTasks / Math.max(1, totalConfirms);

  const rows = [];
  rows.push(["test_method", "absolute_tilt"]);  // ← LOGS THE METHOD
  rows.push(["participant_id", pid]);
  rows.push(["run_timestamp", runTs]);
  rows.push(["tasks_per_run", totalTasks]);
  rows.push(["task_order", tasks.join(" | ")]);
  rows.push(["total_time_ms", Math.round(totalElapsed)]);
  rows.push(["total_confirms", totalConfirms]);
  rows.push(["total_wrong_attempts", totalWrongAttempts]);
  rows.push(["overall_accuracy", overallAccuracy.toFixed(4)]);
  rows.push(["overall_accuracy_percent", (overallAccuracy * 100).toFixed(1)]);
  rows.push([]);
  rows.push(["task_index", "task_name", "time_ms", "wrong_attempts", "confirms", "task_accuracy"]);

  for (let i = 0; i < totalTasks; i++) {
    const t = perTask[i] || { timeMs: 0, wrong: 0, confirms: 0 };
    const taskAcc = 1 / Math.max(1, t.wrong + 1);
    rows.push([
      i + 1,
      tasks[i],
      Math.round(t.timeMs || 0),
      t.wrong || 0,
      t.confirms || 0,
      taskAcc.toFixed(4),
    ]);
  }

  return toCsv(rows);
}

/* -------------------------------------------------------------------------- */
/* 3D init                                                                    */
/* -------------------------------------------------------------------------- */
function init3D() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x87a7ff, 1);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  document.body.appendChild(renderer.domElement);
  restoreCursor();

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x87a7ff, 50, 260);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 700);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(30, 35, 20);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x2f6f4e, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f232a, roughness: 0.95, metalness: 0.02 });

  const road1 = new THREE.Mesh(new THREE.PlaneGeometry(260, 8), roadMat);
  road1.rotation.x = -Math.PI / 2;
  road1.position.y = 0.01;
  scene.add(road1);

  const road2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 260), roadMat);
  road2.rotation.x = -Math.PI / 2;
  road2.position.y = 0.01;
  scene.add(road2);

  addDashedCenterLine(scene, { axis: "x", length: 260 });
  addDashedCenterLine(scene, { axis: "z", length: 260 });

  for (let x = -110; x <= 110; x += 28) addStreetLamp(scene, x, 5.5);
  for (let z = -110; z <= 110; z += 28) addStreetLamp(scene, 5.5, z);

  addBench(scene, -3, 8, Math.PI / 2);
  addBench(scene, 3, 8, Math.PI / 2);
  addBench(scene, -3, -8, -Math.PI / 2);
  addBench(scene, 3, -8, -Math.PI / 2);

  addTree(scene, -55, -55, 1.6);
  addTree(scene, -65, -20, 1.4);
  addTree(scene, -62, 40, 1.5);
  addTree(scene, 55, -55, 1.6);
  addTree(scene, 65, -18, 1.4);
  addTree(scene, 62, 42, 1.55);
  addTree(scene, 0, 65, 1.7);
  addTree(scene, 0, -65, 1.7);

  buildings = [];

  function makeBuilding(name, x, z, w = 7, d = 7, h = 8) {
    if (name === "Boyd Orr") h *= 1.65;
    if (name === "Library") h *= 1.35;
    if (name === "Fraser Building") {
      h *= 0.75;
      w *= 1.55;
      d *= 1.25;
    }

    const style = BUILDING_STYLE[name] || { color: 0xb0b0b0, accent: 0x222222, windows: 0x6dd6ff };

    const baseMat = new THREE.MeshStandardMaterial({
      color: style.color,
      roughness: 0.88,
      metalness: 0.04,
    });

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseMat);
    mesh.position.set(x, h / 2, z);
    mesh.userData = { name, baseMat, lockUntil: 0 };
    scene.add(mesh);
    buildings.push(mesh);

    const plinthMat = new THREE.MeshStandardMaterial({ color: style.accent, roughness: 0.95, metalness: 0.02 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.6, d + 0.8), plinthMat);
    plinth.position.set(x, 0.3, z);
    scene.add(plinth);

    const roofMat = new THREE.MeshStandardMaterial({ color: style.accent, roughness: 0.75, metalness: 0.08 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.45, d + 0.35), roofMat);
    roof.position.set(x, h + 0.225, z);
    scene.add(roof);

    const winMat = new THREE.MeshStandardMaterial({
      color: 0x0b1220,
      roughness: 0.35,
      metalness: 0.05,
      emissive: style.windows,
      emissiveIntensity: 0.32,
    });

    function addWindowsOnFace(face) {
      const cols = Math.max(3, Math.floor(w / 1.4));
      const rows = Math.max(2, Math.floor(h / 2.2));

      const winW = Math.min(0.65, (w * 0.75) / cols);
      const winH = Math.min(0.55, (h * 0.55) / rows);
      const gapX = winW * 0.55;
      const gapY = winH * 0.6;

      const startX = -((cols - 1) * (winW + gapX)) / 2;
      const startY = h * 0.35;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), winMat);

          const lx = startX + c * (winW + gapX);
          const ly = startY + r * (winH + gapY);

          if (face === "front") {
            win.position.set(x + lx, ly, z + d / 2 + 0.02);
          } else if (face === "back") {
            win.rotation.y = Math.PI;
            win.position.set(x + lx, ly, z - d / 2 - 0.02);
          } else if (face === "right") {
            win.rotation.y = Math.PI / 2;
            win.position.set(x + w / 2 + 0.02, ly, z + lx);
          } else if (face === "left") {
            win.rotation.y = -Math.PI / 2;
            win.position.set(x - w / 2 - 0.02, ly, z + lx);
          }

          scene.add(win);
        }
      }
    }

    addWindowsOnFace("front");
    addWindowsOnFace("back");
    addWindowsOnFace("left");
    addWindowsOnFace("right");

    const label = makeLabelSprite(name);
    label.position.set(x, h + 2.0, z);
    scene.add(label);
  }

  makeBuilding("Boyd Orr", -22, -16, 9, 7, 10);
  makeBuilding("Main Building", -6, -18, 10, 8, 12);
  makeBuilding("GUU", 10, -18, 8, 8, 8);
  makeBuilding("JMS", 26, -16, 8, 7, 9);

  makeBuilding("Stevenson Building", -22, 18, 10, 8, 10);
  makeBuilding("Library", -6, 22, 11, 8, 12);
  makeBuilding("Fraser Building", 10, 22, 9, 8, 9);
  makeBuilding("Adam Smith Building", 26, 18, 10, 8, 10);

  enableMouseLookHandlers();

  if (lookMode === "fps") {
    renderer.domElement.addEventListener("click", () => {
      renderer.domElement.requestPointerLock?.();
    });
  }

  renderer.domElement.addEventListener("pointerdown", () => ensureAudio(), { once: true });

  confirmBtn?.addEventListener("click", onConfirm);

  resetBtn?.addEventListener("click", async () => {
    resetRunState({ newTasks: true });

    player.pos.set(0, 1.7, 40);
    aim.yaw = 0;
    aim.pitch = 0;

    moveState.forward = 0;
    moveState.strafe = 0;

    refreshGoalMesh();

    await showDialog({
      title: "New Run Started",
      bodyHtml:
        `New set of tasks generated.<br><br>` +
        `First objective:<br><b>Task 1 of ${totalTasks}</b> — <b>${tasks[0]}</b>`,
      metrics: [
        { label: "Tasks", value: `0 / ${totalTasks}` },
        { label: "Pool Size", value: String(BUILDING_POOL.length) },
        { label: "Order", value: "Random" },
        { label: "Selection", value: "Random 5" },
      ],
      buttonText: "Continue",
    });
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  refreshGoalMesh();
  tick();
}

/* -------------------------------------------------------------------------- */
/* Highlight helpers                                                          */
/* -------------------------------------------------------------------------- */
function flashBuilding(mesh, state, ms = 1100) {
  if (!mesh) return;

  const until = nowMs() + ms;
  mesh.userData.lockUntil = until;

  if (state === "correct") mesh.material = correctMat;
  else if (state === "wrong") mesh.material = wrongMat;
}

function applyAimHighlight(target) {
  const t = nowMs();

  for (const b of buildings) {
    if ((b.userData.lockUntil || 0) > t) continue;
    b.material = b.userData.baseMat;
  }

  if (target && (target.userData.lockUntil || 0) <= t) target.material = aimHighlightMat;
}

/* -------------------------------------------------------------------------- */
/* Camera + Targeting                                                         */
/* -------------------------------------------------------------------------- */
function updateCameraTransform() {
  if (!camera) return;
  camera.position.copy(player.pos);

  const forward = new THREE.Vector3(0, 0, -1);
  forward.applyEuler(new THREE.Euler(aim.pitch, aim.yaw, 0, "YXZ"));
  camera.lookAt(player.pos.clone().add(forward.multiplyScalar(10)));
}

const raycaster = new THREE.Raycaster();
const centerNDC = new THREE.Vector2(0, 0);

/* -------------------------------------------------------------------------- */
/* Confirm / Task completion + dialogs                                         */
/* -------------------------------------------------------------------------- */
let dialogBusy = false;

async function onConfirm() {
  if (dialogBusy) return;
  if (currentTaskIndex >= totalTasks) return;

  ensureAudio();

  if (!currentTarget) {
    dialogBusy = true;
    await showDialog({
      title: "No Selection",
      bodyHtml: `Aim at a building (wait for highlight), then press <b>Confirm</b>.`,
      metrics: [],
      buttonText: "OK",
    });
    dialogBusy = false;
    return;
  }

  const needed = tasks[currentTaskIndex];
  const chosen = currentTarget.userData.name;

  totalConfirms++;
  perTask[currentTaskIndex].confirms++;

  if (chosen !== needed) {
    wrongAttemptsThisTask++;
    totalWrongAttempts++;
    perTask[currentTaskIndex].wrong++;

    flashBuilding(currentTarget, "wrong", 1100);
    playBuzz();
    await sleep(420);

    const dist = distanceToCurrentGoal();
    const distText = dist == null ? "" : `${dist.toFixed(0)}m`;

    dialogBusy = true;
    await showDialog({
      title: "Oops — Wrong Building",
      bodyHtml:
        `You selected <b>${chosen}</b>.<br><br>` +
        `Target for <b>Task ${currentTaskIndex + 1} of ${totalTasks}</b>:<br>` +
        `<b>${needed}</b><br><br>` +
        (distText ? `You are currently <b>${distText}</b> away from the target.<br><br>` : "") +
        `Try again.`,
      metrics: [],
      buttonText: "Try again",
    });
    dialogBusy = false;
    return;
  }

  const elapsed = nowMs() - taskStartMs;
  perTask[currentTaskIndex].timeMs = elapsed;

  const attempts = wrongAttemptsThisTask;
  const taskAccuracy = 1 / (attempts + 1);

  flashBuilding(currentTarget, "correct", 1300);
  playDing();
  await sleep(420);

  dialogBusy = true;
  await showDialog({
    title: `Task ${currentTaskIndex + 1} Completed`,
    bodyHtml: `Nice work — you found <b>${needed}</b>.<br><br>Prepare for the next destination.`,
    metrics: [
      { label: "Time", value: formatSeconds(elapsed) },
      { label: "Wrong Attempts", value: String(attempts) },
      { label: "Accuracy", value: pct(taskAccuracy) },
      { label: "Tasks Done", value: `${currentTaskIndex + 1} / ${totalTasks}` },
    ],
    buttonText: currentTaskIndex + 1 >= totalTasks ? "Final report" : "Next task",
  });
  dialogBusy = false;

  const nextIndex = currentTaskIndex + 1;

  if (nextIndex >= totalTasks) {
    currentTaskIndex = totalTasks;
    updateTaskBar();
    refreshGoalMesh();

    const totalElapsed = nowMs() - totalStartMs;
    const overallAccuracy = totalTasks / Math.max(1, totalConfirms);

    const sumTaskTimes = perTask.reduce((acc, t) => acc + (t.timeMs || 0), 0);
    const avgPerTask = sumTaskTimes / totalTasks;

    const perTaskLines = perTask
      .map((t, i) => {
        const a = 1 / Math.max(1, t.wrong + 1);
        return `Task ${i + 1}: ${tasks[i]} — time ${formatSeconds(t.timeMs)} — wrong ${t.wrong} — accuracy ${pct(a)}`;
      })
      .join("<br>");

    const csvText = buildResultsCsv();
    const filename = `mhci_results_${participantId || "unknown"}_${safeTimestampForFilename()}.csv`;

    dialogBusy = true;
    await showDialog({
      title: "Final Report",
      bodyHtml:
        `You've completed all <b>${totalTasks}</b> tasks.<br><br>` +
        `<b>Summary</b><br>${perTaskLines}<br><br>` +
        `<b>Export your results:</b><br>` +
        `• Download CSV (attach to a Google Form), or<br>` +
        `• Copy CSV (paste into a form text box).`,
      metrics: [
        { label: "Total Time", value: formatSeconds(totalElapsed) },
        { label: "Avg / Task", value: formatSeconds(avgPerTask) },
        { label: "Wrong Attempts", value: String(totalWrongAttempts) },
        { label: "Overall Accuracy", value: pct(overallAccuracy) },
      ],
      buttonText: "Close",
      extraActions: [
        {
          label: "Copy CSV",
          className: "btn",
          onClickAsync: async () => {
            const ok = await copyToClipboard(csvText);
            await showDialog({
              title: ok ? "Copied" : "Copy failed",
              bodyHtml: ok
                ? "CSV copied to clipboard. Paste it into the Google Form."
                : "Clipboard blocked by browser. Use Download CSV instead.",
              metrics: [],
              buttonText: "OK",
            });
          },
        },
        {
          label: "Download CSV",
          className: "btn tutorialPrimary",
          onClickAsync: async () => {
            downloadTextFile(filename, csvText, "text/csv");
          },
        },
      ],
    });
    dialogBusy = false;
    return;
  }

  startTask(nextIndex);
  refreshGoalMesh();
}

/* -------------------------------------------------------------------------- */
/* Loop                                                                       */
/* -------------------------------------------------------------------------- */
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);

  let forwardWanted = 0;
  let strafeWanted = 0;

  if (keys.has("ArrowUp") || keys.has("KeyW")) forwardWanted += 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) forwardWanted -= 1;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) strafeWanted -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) strafeWanted += 1;

  forwardWanted += -stickVec.y;
  strafeWanted += stickVec.x;

  const wantedLen = Math.hypot(forwardWanted, strafeWanted);
  if (wantedLen > 1) {
    forwardWanted /= wantedLen;
    strafeWanted /= wantedLen;
  }

  const fDelta = forwardWanted - moveState.forward;
  const sDelta = strafeWanted - moveState.strafe;

  const fRate =
    Math.abs(forwardWanted) > Math.abs(moveState.forward) ? MOVE_ACCEL_PER_SEC : MOVE_DECEL_PER_SEC;
  const sRate =
    Math.abs(strafeWanted) > Math.abs(moveState.strafe) ? MOVE_ACCEL_PER_SEC : MOVE_DECEL_PER_SEC;

  moveState.forward += clamp(fDelta, -fRate * dt, fRate * dt);
  moveState.strafe += clamp(sDelta, -sRate * dt, sRate * dt);

  if (Math.abs(moveState.forward) < 0.001) moveState.forward = 0;
  if (Math.abs(moveState.strafe) < 0.001) moveState.strafe = 0;

  const yawOnly = new THREE.Euler(0, aim.yaw, 0, "YXZ");
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(yawOnly);
  const right = new THREE.Vector3(1, 0, 0).applyEuler(yawOnly);

  player.pos.add(
    new THREE.Vector3()
      .addScaledVector(forward, moveState.forward)
      .addScaledVector(right, moveState.strafe)
      .multiplyScalar(player.speed * dt)
  );
  player.pos.y = 1.7;

  updateCameraTransform();

  if (currentTaskIndex < totalTasks) {
    taskStatsEl.textContent = `Time: ${formatSeconds(nowMs() - taskStartMs)}  •  Wrong: ${wrongAttemptsThisTask}`;
  } else {
    taskStatsEl.textContent = `Run complete.`;
  }

  updateNavGuidanceUI();

  raycaster.setFromCamera(centerNDC, camera);
  const hits = raycaster.intersectObjects(buildings, false);
  currentTarget = hits.length ? hits[0].object : null;

  crosshair?.classList.toggle("onTarget", !!currentTarget);

  applyAimHighlight(currentTarget);

  const t = nowMs();
  for (const b of buildings) {
    if ((b.userData.lockUntil || 0) > 0 && (b.userData.lockUntil || 0) <= t) {
      b.userData.lockUntil = 0;
      if (b === currentTarget) b.material = aimHighlightMat;
      else b.material = b.userData.baseMat;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* -------------------------------------------------------------------------- */
/* Tutorial Next handler                                                      */
/* -------------------------------------------------------------------------- */
tutorialNextBtn.addEventListener("click", async () => {
  if (tutorialIndex < tutorialPages.length - 1) {
    tutorialIndex++;
    renderTutorial();
    return;
  }

  ensureParticipantId();

  readLookModeFromUI();
  await requestTiltPermissionIfNeeded();

  tutorialOverlay.style.display = "none";
  resetRunState({ newTasks: true });
  init3D();
});