/* ══════════════════════════════════════════
   CONFIGURACIÓN
══════════════════════════════════════════ */
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/dyyi3qHP7/";

/* ══════════════════════════════════════════
   ESTADO
══════════════════════════════════════════ */
let model, webcam, ctx, maxPredictions;
let running = false;

const LABEL_MAP = {
  "class 7": "pensando",
  "class 8": "sorprendido"
};

function getDisplayName(rawName) {
  if (!rawName) return rawName;
  const normalized = rawName.trim().toLowerCase();

  if (/^class\s*7$/i.test(normalized) || normalized === "7") {
    return "pensando";
  }
  if (/^class\s*8$/i.test(normalized) || normalized === "8") {
    return "sorprendido";
  }

  return LABEL_MAP[rawName] || rawName;
}

/* ══════════════════════════════════════════
   REFERENCIAS AL DOM
══════════════════════════════════════════ */
const canvasEl       = document.getElementById("canvas");
const canvasWrapper  = document.getElementById("canvas-wrapper");
const placeholder    = document.getElementById("placeholder");
const statusEl       = document.getElementById("status");
const btnStart       = document.getElementById("btn-start");
const labelContainer = document.getElementById("label-container");
const emptyState     = document.getElementById("empty-state");
const topCard        = document.getElementById("top-card");
const topNameEl      = document.getElementById("top-name");
const topPctEl       = document.getElementById("top-pct");

/* ══════════════════════════════════════════
   INICIALIZACIÓN
══════════════════════════════════════════ */
async function init() {
  if (running) return;

  btnStart.disabled = true;
  setStatus("loading", "● Cargando modelo…");

  try {
    // Cargar modelo y metadatos
    model = await tmPose.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
    maxPredictions = model.getTotalClasses();

    // Configurar webcam
    const size = 260;
    webcam = new tmPose.Webcam(size, size, true); // true = espejo
    await webcam.setup();
    await webcam.play();

    // Preparar canvas
    canvasEl.width  = size;
    canvasEl.height = size;
    ctx = canvasEl.getContext("2d");

    // Crear una barra por cada clase del modelo
    buildBars();

    // Activar UI
    running = true;
    placeholder.classList.add("hidden");
    canvasWrapper.classList.add("active");
    emptyState.style.display = "none";
    topCard.style.display    = "flex";
    setStatus("online", "● Detección activa");

    // Arrancar bucle de predicción
    window.requestAnimationFrame(loop);

  } catch (err) {
    console.error("Error al inicializar:", err);
    setStatus("", "Error al cargar el modelo");
    btnStart.disabled = false;
  }
}

/* ══════════════════════════════════════════
   CONSTRUCCIÓN DE BARRAS DE RESULTADOS
══════════════════════════════════════════ */
function buildBars() {
  labelContainer.innerHTML = "";

  for (let i = 0; i < maxPredictions; i++) {
    const item = document.createElement("div");
    item.className = "bar-item";
    item.innerHTML = `
      <div class="bar-header">
        <span class="bar-name" id="name-${i}">Clase ${i + 1}</span>
        <span class="bar-pct"  id="pct-${i}">0%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" id="fill-${i}"></div>
      </div>`;
    labelContainer.appendChild(item);
  }
}

/* ══════════════════════════════════════════
   BUCLE PRINCIPAL
══════════════════════════════════════════ */
async function loop() {
  webcam.update();
  await predict();
  window.requestAnimationFrame(loop);
}

/* ══════════════════════════════════════════
   PREDICCIÓN
══════════════════════════════════════════ */
async function predict() {
  // 1. Estimar pose con PoseNet
  const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);

  // 2. Clasificar con el modelo entrenado
  const predictions = await model.predict(posenetOutput);

  // 3. Encontrar la clase dominante
  const best = predictions.reduce((a, b) => a.probability > b.probability ? a : b);

  // 4. Actualizar barras
  predictions.forEach((p, i) => {
    const pct   = (p.probability * 100).toFixed(1);
    const isDom = p.className === best.className;

    const nameEl = document.getElementById(`name-${i}`);
    const pctEl  = document.getElementById(`pct-${i}`);
    const fillEl = document.getElementById(`fill-${i}`);

    const rawName = p.className || p.label || "";
    const displayName = getDisplayName(rawName);

    if (nameEl) nameEl.textContent = displayName;

    if (pctEl) {
      pctEl.textContent = pct + "%";
      pctEl.classList.toggle("high", isDom);
    }

    if (fillEl) {
      fillEl.style.width = pct + "%";
      fillEl.classList.toggle("dominant", isDom);
    }
  });

  // 5. Actualizar tarjeta principal
  const bestName = getDisplayName(best.className || best.label || "");
  topNameEl.textContent = bestName;
  topPctEl.textContent  = (best.probability * 100).toFixed(0) + "%";

  // 6. Dibujar pose sobre el canvas
  drawPose(pose);
}

/* ══════════════════════════════════════════
   DIBUJADO DE POSE
══════════════════════════════════════════ */
function drawPose(pose) {
  if (!webcam.canvas) return;

  // Dibujar frame de la webcam
  ctx.drawImage(webcam.canvas, 0, 0);

  // Dibujar keypoints y esqueleto si hay pose detectada
  if (pose) {
    const minConfidence = 0.5;
    tmPose.drawKeypoints(pose.keypoints, minConfidence, ctx);
    tmPose.drawSkeleton(pose.keypoints, minConfidence, ctx);
  }
}

/* ══════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════ */

/**
 * Actualiza el badge de estado.
 * @param {string} cls   - Clase CSS: "online" | "loading" | ""
 * @param {string} text  - Texto a mostrar
 */
function setStatus(cls, text) {
  statusEl.className   = cls;
  statusEl.textContent = text;
}