const canvas = document.querySelector("#previewCanvas");
const context = canvas.getContext("2d");
const arCanvas = document.querySelector("#arCanvas");
const video = document.querySelector("#cameraVideo");
const emptyState = document.querySelector("#emptyState");
const cameraStatus = document.querySelector("#cameraStatus");
const styleGrid = document.querySelector("#styleGrid");
const colorGrid = document.querySelector("#colorGrid");
const beforeAfterButton = document.querySelector("#beforeAfterButton");
const captureFaceButton = document.querySelector("#captureFaceButton");
const liveArButton = document.querySelector("#liveArButton");
const snapshotButton = document.querySelector("#snapshotButton");
const privacyStatus = document.querySelector("#privacyStatus");
const selectedLookLabel = document.querySelector("#selectedLookLabel");
const toast = document.querySelector("#toast");
const trackingHint = cameraStatus;
// Fit is automatic in the customer-facing UI. Keep stable renderer defaults
// internally so the MediaPipe measurement remains the single alignment source.
const controls = {
  x: { value: 0 },
  y: { value: 0 },
  scale: { value: 100 },
  rotation: { value: 0 },
  opacity: { value: 100 },
  depth: { value: 35 },
  autoAlign: { checked: true }
};

const colors = [
  { name: "Natural Black", value: "#171417" },
  { name: "Dark Brown", value: "#35231d" },
  { name: "Chestnut Brown", value: "#70432f" },
  { name: "Copper", value: "#ad5b37" },
  { name: "Golden Blonde", value: "#cba669" }
];

const hairstyles = [
  {
    id: "bob",
    category: "Women's styles",
    name: "Bob Cut",
    description: "Jaw-length curved bob",
    asset: "assets/hair/bob-cut.png",
    model3d: {
      id: "bob-cc0",
      src: "assets/models/bob-cc0.glb",
      license: "CC0 / MakeHuman Community",
      anchor: [0, 6.78, 0.22],
      canonicalFaceWidth: 1.52,
      yOffsetRatio: -0.03,
      occluderDepth: 0.66,
      occluderWidthRatio: 0.80,
      occluderHeightRatio: 1.03,
      alphaTest: 0.035
    },
    faceOpeningRatio: 0.39,
    faceOpeningHeightRatio: 0.56,
    faceCenterYRatio: 0.54,
    viewBox: "0 0 300 380",
    heightFactor: 0.82,
    path: "M43 309C27 254 29 166 53 103C70 57 108 26 150 24C203 22 243 58 258 109C274 166 266 254 251 309C230 326 204 335 176 337L174 246C202 225 216 188 211 147C205 101 181 70 150 68C117 70 93 99 87 145C81 188 95 225 126 246L123 337C92 335 65 326 43 309ZM88 126C94 92 118 77 150 77C182 77 206 96 212 129C220 176 199 222 150 242C101 222 80 176 88 126Z",
    strands: [
      "M68 116C53 182 60 257 83 310",
      "M91 72C67 139 74 219 105 292",
      "M126 44C103 94 105 121 111 146",
      "M174 44C197 94 197 123 190 149",
      "M210 72C235 142 226 229 199 300",
      "M234 117C249 180 240 256 219 310"
    ]
  },
  {
    id: "feather",
    category: "Women's styles",
    name: "Feather Cut",
    description: "Soft feathered layers",
    asset: "assets/hair/feather-cut.png",
    faceOpeningRatio: 0.25,
    faceOpeningHeightRatio: 0.40,
    faceCenterYRatio: 0.39,
    viewBox: "0 0 300 380",
    heightFactor: 1.02,
    path: "M34 348C22 278 25 180 48 108C64 58 105 27 150 24C205 22 246 61 261 116C279 188 269 287 257 348L229 328L239 363L204 338L208 373L174 341L150 376L126 341L92 373L96 338L61 363L71 328L34 348ZM88 126C94 92 118 77 150 77C182 77 206 96 212 129C220 176 199 222 150 242C101 222 80 176 88 126Z",
    strands: [
      "M65 99C45 180 55 262 79 326",
      "M87 63C65 151 78 248 109 335",
      "M116 40C94 109 99 128 109 151",
      "M184 40C207 108 201 130 191 153",
      "M213 63C237 151 223 250 192 337",
      "M237 101C257 179 247 263 223 328",
      "M92 251C113 276 126 307 126 341",
      "M208 251C188 276 174 307 174 341"
    ]
  },
  {
    id: "v-cut",
    category: "Women's styles",
    name: "V Cut",
    description: "Long layers with a V point",
    asset: "assets/hair/v-cut.png",
    faceOpeningRatio: 0.26,
    faceOpeningHeightRatio: 0.31,
    faceCenterYRatio: 0.34,
    faceOffsetXRatio: 0.05,
    viewBox: "0 0 300 380",
    heightFactor: 1.1,
    path: "M38 350C24 274 25 178 49 107C66 57 106 27 150 24C205 22 246 60 261 115C278 185 270 278 260 350L218 345L185 355L150 378L115 355L82 345L38 350ZM88 126C94 92 118 77 150 77C182 77 206 96 212 129C220 176 199 222 150 242C101 222 80 176 88 126Z",
    strands: [
      "M65 102C44 190 57 283 86 344",
      "M89 62C65 155 83 272 120 354",
      "M118 39C99 94 101 127 109 151",
      "M182 39C202 94 199 129 191 153",
      "M211 62C236 154 217 272 180 354",
      "M236 103C257 189 244 283 214 344",
      "M119 254C130 299 141 340 150 373",
      "M181 254C170 299 159 340 150 373"
    ]
  },
  {
    id: "u-cut",
    category: "Women's styles",
    name: "U Cut",
    description: "Long rounded U-shaped finish",
    asset: "assets/hair/u-cut.png",
    faceOpeningRatio: 0.33,
    faceOpeningHeightRatio: 0.31,
    faceCenterYRatio: 0.34,
    faceOffsetXRatio: 0.05,
    viewBox: "0 0 300 380",
    heightFactor: 1.08,
    path: "M38 340C24 270 25 178 49 107C66 57 106 27 150 24C205 22 246 60 261 115C278 184 270 271 262 340C241 364 203 376 150 376C97 376 59 364 38 340ZM88 126C94 92 118 77 150 77C182 77 206 96 212 129C220 176 199 222 150 242C101 222 80 176 88 126Z",
    strands: [
      "M65 102C44 189 55 280 82 342",
      "M89 62C65 154 79 271 112 358",
      "M118 39C99 94 101 127 109 151",
      "M182 39C202 94 199 129 191 153",
      "M211 62C236 154 221 271 188 358",
      "M236 102C257 189 245 280 218 342",
      "M118 255C124 306 136 347 150 371",
      "M182 255C176 306 164 347 150 371"
    ]
  },
  {
    id: "crew-cut",
    category: "Men's styles",
    name: "Crew Cut",
    description: "Textured top with tapered sides",
    asset: "assets/hair/crew-cut.png",
    model3d: {
      id: "short-cc0",
      src: "assets/models/short-cc0.glb",
      license: "CC0 / MakeHuman Community",
      anchor: [0, 8.35, 0.48],
      canonicalFaceWidth: 1.46,
      yOffsetRatio: -0.04,
      occluderDepth: 0.78,
      occluderWidthRatio: 0.82,
      occluderHeightRatio: 1.01,
      alphaTest: 0.09
    },
    faceOpeningRatio: 0.60,
    faceCenterYRatio: 0.59
  },
  {
    id: "buzz-cut",
    category: "Men's styles",
    name: "Buzz Cut",
    description: "Short, even clipper finish",
    asset: "assets/hair/buzz-cut.png",
    faceOpeningRatio: 0.62,
    faceCenterYRatio: 0.59
  },
  {
    id: "curtain-bangs",
    category: "Men's styles",
    name: "Curtain Bangs",
    description: "Center-parted sweeping fringe",
    asset: "assets/hair/curtain-bangs.png",
    faceOpeningRatio: 0.29,
    faceCenterYRatio: 0.47
  },
  {
    id: "skin-fade",
    category: "Men's styles",
    name: "Skin Fade",
    description: "Textured top with a close fade",
    asset: "assets/hair/skin-fade.png",
    faceOpeningRatio: 0.60,
    faceCenterYRatio: 0.59
  }
];

const state = {
  active: false,
  demo: false,
  showOverlay: true,
  style: hairstyles[0],
  color: colors[2],
  detection: null,
  lastDetectionAt: 0,
  detectorBusy: false,
  pointer: { x: 0, y: 0 },
  captured: false,
  capturedFrame: null,
  liveAr: false,
  arReady: false,
  arLoading: false,
  aiAvailable: false,
  aiRendering: false,
  aiResult: null,
  aiRefreshPending: false,
  holdCapturedFrame: false
};

let automaticAiTimer;

function clearAiResult() {
  state.aiResult = null;
  state.holdCapturedFrame = Boolean(state.capturedFrame && state.captured && !state.demo);
  if (privacyStatus) privacyStatus.textContent = "Live camera stays local; captured still uses AI";
  updateAiButton();
}

function updateAiButton() {
  if (!captureFaceButton) return;
  captureFaceButton.title = state.aiAvailable
    ? "Capture, measure, and automatically create the realistic AI hairstyle"
    : "Capture locally; AI merge will resume when API access is available";
}

function scheduleAutomaticAiStill() {
  clearTimeout(automaticAiTimer);
  if (!state.capturedFrame || !state.captured || state.demo || !state.aiAvailable) return;
  automaticAiTimer = setTimeout(() => {
    if (state.aiRendering) {
      state.aiRefreshPending = true;
      return;
    }
    createAiStill();
  }, 750);
}

async function checkAiAvailability() {
  try {
    const response = await fetch("/api/ai-status", { cache: "no-store" });
    const status = await response.json();
    state.aiAvailable = Boolean(status.available);
  } catch {
    state.aiAvailable = false;
  }
  updateAiButton();
}

const hairImages = new Map();
const tintedHairCache = new Map();
const stylePreviewCanvases = new Map();
for (const style of hairstyles) {
  const image = new Image();
  image.decoding = "async";
  image.src = style.asset;
  image.addEventListener("load", () => {
    tintedHairCache.clear();
    renderStylePreviews();
    syncArHair();
  });
  hairImages.set(style.id, image);
}

let detector = null;
if ("FaceDetector" in window) {
  try {
    detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
  } catch {
    detector = null;
  }
}
trackingHint.textContent = "478-point Live AR tracking available";

window.addEventListener("mirrorly-ar-model", (event) => {
  const detail = event.detail || {};
  if (detail.styleId && detail.styleId !== state.style.id) return;
  if (detail.status === "loading") {
    trackingHint.textContent = state.liveAr
      ? "Loading the local true-3D hairstyle mesh"
      : "Preparing the true-3D mesh for Live AR";
  } else if (detail.status === "ready") {
    trackingHint.textContent = state.liveAr
      ? "True 3D GLB + MediaPipe head-pose tracking active"
      : "True 3D mesh ready - start Live AR to test it";
  } else if (detail.status === "fallback") {
    trackingHint.textContent = "3D mesh unavailable - transparent PNG fallback active";
  } else if (detail.status === "png-fallback") {
    trackingHint.textContent = "PNG preview for this style; GLB conversion is pending";
  }
});

function updateSelectedLook() {
  selectedLookLabel.textContent = state.captured || state.demo || state.liveAr
    ? `${state.style.name} / ${state.color.name}`
    : "Position your face and capture";
}

function createStyleButtons() {
  let previousCategory = "";
  hairstyles.forEach((style, index) => {
    if (style.category !== previousCategory) {
      const categoryLabel = document.createElement("p");
      categoryLabel.className = "style-section-label";
      categoryLabel.textContent = style.category;
      styleGrid.append(categoryLabel);
      previousCategory = style.category;
    }
    const button = document.createElement("button");
    button.className = `style-card${index === 0 ? " active" : ""}`;
    button.type = "button";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", index === 0 ? "true" : "false");
    button.innerHTML = `<span class="style-model"><img src="${style.asset}" alt="" /><canvas width="180" height="110" hidden aria-hidden="true"></canvas>${style.model3d ? '<em class="true-3d-badge">TRUE 3D</em>' : ""}</span><strong>${style.name}</strong><small>${style.description}</small>`;
    stylePreviewCanvases.set(style.id, button.querySelector("canvas"));
    button.addEventListener("click", () => {
      clearAiResult();
      state.style = style;
      styleGrid.querySelectorAll("button").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-checked", String(selected));
      });
      updateSelectedLook();
      trackingHint.textContent = style.model3d
        ? "True 3D mesh available - start Live AR to test it"
        : "PNG preview for this style; GLB conversion is pending";
      renderStylePreviews();
      syncArHair();
      scheduleAutomaticAiStill();
    });
    styleGrid.append(button);
  });
}

function createColorButtons() {
  colors.forEach((color, index) => {
    const button = document.createElement("button");
    button.className = `color-button${index === 2 ? " active" : ""}`;
    button.type = "button";
    button.title = color.name;
    button.setAttribute("aria-label", color.name);
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", index === 2 ? "true" : "false");
    button.style.setProperty("--swatch", color.value);
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("small");
    label.textContent = color.name;
    button.append(swatch, label);
    button.addEventListener("click", () => {
      clearAiResult();
      state.color = color;
      colorGrid.querySelectorAll("button").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-checked", String(selected));
      });
      updateSelectedLook();
      renderStylePreviews();
      syncArHair();
      scheduleAutomaticAiStill();
    });
    colorGrid.append(button);
  });
}

function resizeCanvas(sourceWidth, sourceHeight) {
  if (!sourceWidth || !sourceHeight) return;
  if (canvas.width !== sourceWidth || canvas.height !== sourceHeight) {
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("Camera access is not supported in this browser.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    state.active = true;
    state.demo = false;
    state.captured = false;
    state.capturedFrame = null;
    clearAiResult();
    state.liveAr = false;
    arCanvas.hidden = true;
    emptyState.classList.add("hidden");
    cameraStatus.textContent = "Camera active";
    cameraStatus.classList.add("active");
    if (beforeAfterButton) beforeAfterButton.disabled = false;
    captureFaceButton.disabled = false;
    captureFaceButton.textContent = "Capture + AI merge";
    liveArButton.disabled = false;
    snapshotButton.disabled = true;
    updateSelectedLook();
    renderStylePreviews();
    requestAnimationFrame(render);
  } catch (error) {
    showToast(error.name === "NotAllowedError" ? "Camera permission was not granted." : "Unable to start the camera.");
  }
}

function syncArHair() {
  if (!state.arReady || !window.MirrorlyAR) return;
  const hair = getTintedHair(state.style, state.color);
  if (hair) window.MirrorlyAR.setHair(hair, state.style, state.color);
}

async function measureCapturedFace(capturedFrame) {
  state.arLoading = true;
  liveArButton.disabled = true;
  captureFaceButton.disabled = true;
  cameraStatus.textContent = "Measuring captured face...";
  trackingHint.textContent = "Measuring 478 facial landmarks";
  try {
    await window.MirrorlyAR.initialize(arCanvas, video);
    state.arReady = true;
    syncArHair();
    const measurement = await window.MirrorlyAR.measureImage(capturedFrame);
    if (!measurement) throw new Error("No face was found in the captured frame");
    state.detection = measurement;
    cameraStatus.textContent = "Face measured and aligned";
    trackingHint.textContent = "MediaPipe capture measurement active";
    renderStylePreviews();
    showToast("Face measured - hairstyles now auto-fit");
  } catch (error) {
    console.error("Mirrorly captured-face measurement failed", error);
    state.detection = null;
    cameraStatus.textContent = "Face captured";
    trackingHint.textContent = "Measurement unavailable - manual fit remains available";
    showToast("Face measurement failed; use the fit controls");
  } finally {
    state.arLoading = false;
    captureFaceButton.disabled = false;
  }
}

function stopLiveAr(showMessage = true) {
  state.liveAr = false;
  window.MirrorlyAR?.setEnabled(false);
  arCanvas.hidden = true;
  liveArButton.classList.remove("active");
  liveArButton.textContent = "Start live AR";
  liveArButton.disabled = false;
  captureFaceButton.disabled = false;
  snapshotButton.disabled = true;
  cameraStatus.textContent = "Camera active";
  trackingHint.textContent = "478-point Live AR tracking available";
  updateSelectedLook();
  if (showMessage) showToast("Live AR stopped - capture mode restored");
}

async function toggleLiveAr() {
  if (state.liveAr) {
    stopLiveAr();
    return;
  }
  if (state.demo || state.captured) {
    showToast("Retake the face before starting Live AR");
    return;
  }
  if (video.readyState < 2 || !video.videoWidth || state.arLoading) {
    showToast("Wait for the camera image, then try Live AR");
    return;
  }

  state.arLoading = true;
  liveArButton.disabled = true;
  liveArButton.textContent = "Loading AR...";
  trackingHint.textContent = "Loading local face landmark model";
  try {
    await window.MirrorlyAR.initialize(arCanvas, video);
    state.arReady = true;
    syncArHair();
    state.liveAr = true;
    window.MirrorlyAR.setEnabled(true);
    arCanvas.hidden = false;
    liveArButton.disabled = false;
    liveArButton.classList.add("active");
    liveArButton.textContent = "Stop live AR";
    captureFaceButton.disabled = true;
    snapshotButton.disabled = false;
    cameraStatus.textContent = "Live AR active";
    trackingHint.textContent = state.style.model3d
      ? "Loading the local true-3D hairstyle mesh"
      : "MediaPipe tracking live with PNG fallback";
    updateSelectedLook();
    showToast("Live AR ready - move your head naturally");
  } catch (error) {
    console.error("Mirrorly Live AR initialization failed", error);
    stopLiveAr(false);
    trackingHint.textContent = "Live AR unavailable - manual capture still works";
    showToast("Live AR could not start; capture mode is still available");
  } finally {
    state.arLoading = false;
  }
}

function startDemo() {
  if (state.liveAr) stopLiveAr(false);
  state.active = true;
  state.demo = true;
  state.captured = true;
  state.capturedFrame = null;
  emptyState.classList.add("hidden");
  cameraStatus.textContent = "3D demo mode";
  cameraStatus.classList.add("active");
  if (beforeAfterButton) beforeAfterButton.disabled = false;
  captureFaceButton.disabled = true;
  liveArButton.disabled = true;
  snapshotButton.disabled = false;
  updateSelectedLook();
  resizeCanvas(960, 720);
  drawDemoScene();
  const demoCapture = document.createElement("canvas");
  demoCapture.width = canvas.width;
  demoCapture.height = canvas.height;
  demoCapture.getContext("2d").drawImage(canvas, 0, 0);
  state.capturedFrame = demoCapture;
  clearAiResult();
  renderStylePreviews();
  requestAnimationFrame(render);
}

function roundedRectangle(x, y, width, height, radius) {
  const path = new Path2D();
  path.moveTo(x + radius, y);
  path.arcTo(x + width, y, x + width, y + height, radius);
  path.arcTo(x + width, y + height, x, y + height, radius);
  path.arcTo(x, y + height, x, y, radius);
  path.arcTo(x, y, x + width, y, radius);
  return path;
}

function drawDemoScene() {
  const room = context.createRadialGradient(canvas.width * 0.5, canvas.height * 0.35, 20, canvas.width * 0.5, canvas.height * 0.45, canvas.width * 0.75);
  room.addColorStop(0, "#274448");
  room.addColorStop(0.48, "#152426");
  room.addColorStop(1, "#080c0f");
  context.fillStyle = room;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.globalAlpha = 0.28;
  context.fillStyle = "#d7ad68";
  for (let x = 38; x < canvas.width; x += 180) {
    context.fill(roundedRectangle(x, 42, 112, 410, 56));
    context.fillStyle = "#0b1416";
    context.fill(roundedRectangle(x + 8, 50, 96, 394, 48));
    context.fillStyle = "#d7ad68";
  }
  context.restore();

  const mirrorGlow = context.createLinearGradient(0, 90, 0, 690);
  mirrorGlow.addColorStop(0, "#f7ddb0");
  mirrorGlow.addColorStop(0.5, "#b78443");
  mirrorGlow.addColorStop(1, "#4f321d");
  context.fillStyle = mirrorGlow;
  context.shadowColor = "rgba(235, 185, 104, .45)";
  context.shadowBlur = 34;
  context.fill(roundedRectangle(190, 28, 580, 690, 44));
  context.shadowBlur = 0;
  const glass = context.createLinearGradient(210, 50, 750, 700);
  glass.addColorStop(0, "#19363b");
  glass.addColorStop(0.5, "#102327");
  glass.addColorStop(1, "#071113");
  context.fillStyle = glass;
  context.fill(roundedRectangle(202, 40, 556, 666, 36));

  const shoulders = context.createLinearGradient(0, 500, 0, 720);
  shoulders.addColorStop(0, "#1f5a52");
  shoulders.addColorStop(1, "#092b2a");
  context.fillStyle = shoulders;
  context.beginPath();
  context.ellipse(480, 727, 260, 190, 0, Math.PI, Math.PI * 2);
  context.fill();

  context.fillStyle = "#9d624c";
  context.fill(roundedRectangle(435, 437, 90, 132, 35));
  const skin = context.createRadialGradient(435, 230, 30, 490, 330, 190);
  skin.addColorStop(0, "#f0b794");
  skin.addColorStop(0.55, "#c98263");
  skin.addColorStop(1, "#784536");
  context.fillStyle = skin;
  context.shadowColor = "rgba(0,0,0,.35)";
  context.shadowBlur = 24;
  context.beginPath();
  context.ellipse(480, 320, 118, 157, 0, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;

  context.fillStyle = "rgba(45,25,23,.82)";
  context.beginPath();
  context.ellipse(438, 304, 23, 7, -0.08, 0, Math.PI * 2);
  context.ellipse(522, 304, 23, 7, 0.08, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f4ddd1";
  context.beginPath();
  context.ellipse(438, 303, 16, 4, 0, 0, Math.PI * 2);
  context.ellipse(522, 303, 16, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#32201d";
  context.beginPath();
  context.arc(438, 303, 4, 0, Math.PI * 2);
  context.arc(522, 303, 4, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(104,55,45,.65)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(482, 314);
  context.quadraticCurveTo(468, 357, 487, 364);
  context.stroke();
  context.fillStyle = "#8f4050";
  context.beginPath();
  context.ellipse(480, 400, 31, 9, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(255,255,255,.72)";
  context.font = "600 15px system-ui";
  context.fillText("3D SALON DEMO - MOVE THE POINTER TO SEE DEPTH", 28, 40);
}

async function detectFace(now) {
  if (!detector || state.demo || !controls.autoAlign.checked || state.detectorBusy || now - state.lastDetectionAt < 180) return;
  state.detectorBusy = true;
  state.lastDetectionAt = now;
  try {
    const faces = await detector.detect(video);
    state.detection = faces[0]?.boundingBox || null;
  } catch {
    state.detection = null;
  } finally {
    state.detectorBusy = false;
  }
}

function parseHexColor(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function shadeColor(hex, amount) {
  const { r, g, b } = parseHexColor(hex);
  const target = amount < 0 ? 0 : 255;
  const ratio = Math.abs(amount);
  return `rgb(${Math.round(r + (target - r) * ratio)}, ${Math.round(g + (target - g) * ratio)}, ${Math.round(b + (target - b) * ratio)})`;
}

function drawHair() {
  if (!state.showOverlay) return;
  const numericScale = Number(controls.scale.value) / 100;
  const manualX = Number(controls.x.value);
  const manualY = Number(controls.y.value);
  const depth = Number(controls.depth.value) / 100;
  let centerX = canvas.width / 2 + manualX;
  let centerY = canvas.height / 2 + manualY;
  let width = 420 * numericScale;
  let height = 500 * numericScale * state.style.heightFactor;

  if (state.detection && controls.autoAlign.checked) {
    const box = state.detection;
    centerX = canvas.width - (box.x + box.width / 2) + manualX;
    centerY = box.y + box.height * 0.24 + manualY + 100;
    width = box.width * 1.82 * numericScale;
    height = box.height * 2.02 * numericScale * state.style.heightFactor;
  }

  centerX += state.pointer.x * 10 * depth;
  centerY += state.pointer.y * 6 * depth;
  const path = new Path2D(state.style.path);
  const [, , viewWidth, viewHeight] = state.style.viewBox.split(" ").map(Number);
  const baseColor = state.color.value;
  const opacity = Number(controls.opacity.value) / 100;

  context.save();
  context.translate(centerX, centerY);
  context.rotate((Number(controls.rotation.value) + state.pointer.x * 2.3 * depth) * Math.PI / 180);
  context.transform(1, state.pointer.y * 0.025 * depth, state.pointer.x * 0.025 * depth, 1, 0, 0);
  context.scale(width / viewWidth, height / viewHeight);
  context.translate(-viewWidth / 2, -viewHeight / 2);
  context.globalAlpha = opacity;

  const depthSteps = Math.max(1, Math.round(2 + depth * 7));
  for (let layer = depthSteps; layer > 0; layer -= 1) {
    context.save();
    context.translate(-layer * 0.85, layer * 0.7);
    context.fillStyle = shadeColor(baseColor, -0.72 + layer * 0.018);
    context.shadowColor = "rgba(0,0,0,.5)";
    context.shadowBlur = layer === depthSteps ? 14 : 0;
    context.fill(path, "evenodd");
    context.restore();
  }

  context.save();
  context.clip(path, "evenodd");
  const bodyGradient = context.createLinearGradient(25, 40, 278, 335);
  bodyGradient.addColorStop(0, shadeColor(baseColor, -0.56));
  bodyGradient.addColorStop(0.24, shadeColor(baseColor, 0.34));
  bodyGradient.addColorStop(0.48, shadeColor(baseColor, -0.05));
  bodyGradient.addColorStop(0.7, shadeColor(baseColor, 0.23));
  bodyGradient.addColorStop(1, shadeColor(baseColor, -0.62));
  context.fillStyle = bodyGradient;
  context.fillRect(0, 0, viewWidth, viewHeight);

  const crownGlow = context.createRadialGradient(112, 66, 3, 142, 128, 155);
  crownGlow.addColorStop(0, "rgba(255,255,255,.36)");
  crownGlow.addColorStop(0.35, "rgba(255,255,255,.08)");
  crownGlow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = crownGlow;
  context.fillRect(0, 0, viewWidth, viewHeight);
  context.restore();

  context.strokeStyle = shadeColor(baseColor, -0.73);
  context.lineWidth = 2.4;
  context.stroke(path);
  context.strokeStyle = shadeColor(baseColor, 0.48);
  context.lineWidth = 1.55;
  context.globalAlpha = opacity * (0.35 + depth * 0.34);
  for (const strand of state.style.strands) {
    context.stroke(new Path2D(strand));
  }
  context.strokeStyle = "rgba(255,255,255,.28)";
  context.lineWidth = 0.8;
  context.stroke(new Path2D(state.style.strands[2]));
  context.restore();
}

function getTintedHair(style, color) {
  const image = hairImages.get(style.id);
  if (!image?.complete || !image.naturalWidth) return null;
  if (color.name === "Chestnut Brown") return image;

  const cacheKey = `${style.id}:${color.name}`;
  if (tintedHairCache.has(cacheKey)) return tintedHairCache.get(cacheKey);

  const tinted = document.createElement("canvas");
  tinted.width = image.naturalWidth;
  tinted.height = image.naturalHeight;
  const tintContext = tinted.getContext("2d");
  tintContext.drawImage(image, 0, 0);

  tintContext.globalCompositeOperation = "color";
  tintContext.fillStyle = color.value;
  tintContext.fillRect(0, 0, tinted.width, tinted.height);

  if (color.name === "Natural Black" || color.name === "Dark Brown") {
    tintContext.globalCompositeOperation = "multiply";
    tintContext.globalAlpha = color.name === "Natural Black" ? 0.48 : 0.22;
    tintContext.fillStyle = color.value;
    tintContext.fillRect(0, 0, tinted.width, tinted.height);
  } else if (color.name === "Golden Blonde") {
    tintContext.globalCompositeOperation = "screen";
    tintContext.globalAlpha = 0.34;
    tintContext.fillStyle = "#f4d998";
    tintContext.fillRect(0, 0, tinted.width, tinted.height);
  } else if (color.name === "Copper") {
    tintContext.globalCompositeOperation = "source-atop";
    tintContext.globalAlpha = 0.18;
    tintContext.fillStyle = "#cf6b3d";
    tintContext.fillRect(0, 0, tinted.width, tinted.height);
  }

  tintContext.globalCompositeOperation = "destination-in";
  tintContext.globalAlpha = 1;
  tintContext.drawImage(image, 0, 0);
  tintedHairCache.set(cacheKey, tinted);
  return tinted;
}

function drawCapturedFaceCrop(targetContext, targetCanvas) {
  if (!state.capturedFrame) return;
  const source = state.capturedFrame;
  const targetRatio = targetCanvas.width / targetCanvas.height;
  let sourceHeight = source.height * 0.58;
  let sourceWidth = sourceHeight * targetRatio;
  if (sourceWidth > source.width) {
    sourceWidth = source.width;
    sourceHeight = sourceWidth / targetRatio;
  }
  const measuredCenterX = state.detection?.mirrored
    ? (state.detection.centerX ?? state.detection.x + state.detection.width / 2)
    : source.width / 2;
  const measuredCenterY = state.detection?.centerY ?? source.height * 0.43;
  const sourceX = Math.max(0, Math.min(source.width - sourceWidth, measuredCenterX - sourceWidth / 2));
  const sourceY = Math.max(0, Math.min(source.height - sourceHeight, measuredCenterY - sourceHeight * 0.43));
  targetContext.drawImage(
    source,
    sourceX,
    Math.min(source.height - sourceHeight, sourceY),
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetCanvas.width,
    targetCanvas.height
  );
  return {
    sourceX,
    sourceY,
    scale: targetCanvas.width / sourceWidth
  };
}

function drawHairPreview(targetContext, targetCanvas, style, crop) {
  const hair = getTintedHair(style, state.color);
  if (!hair) return;
  let faceWidth = targetCanvas.height * 0.25;
  let faceCenterX = targetCanvas.width / 2;
  let faceCenterY = targetCanvas.height * 0.43;
  let faceHeight = faceWidth * 1.15;
  let roll = 0;
  if (state.detection?.mirrored && controls.autoAlign.checked && crop) {
    const box = state.detection;
    faceWidth = box.width * crop.scale * 1.02;
    faceHeight = box.height * crop.scale * 1.02;
    faceCenterX = ((box.centerX ?? box.x + box.width / 2) - crop.sourceX) * crop.scale;
    faceCenterY = ((box.centerY ?? box.y + box.height / 2) - crop.sourceY) * crop.scale;
    roll = box.roll || 0;
  }
  const drawWidth = faceWidth / style.faceOpeningRatio;
  const drawHeight = style.faceOpeningHeightRatio
    ? faceHeight / style.faceOpeningHeightRatio
    : drawWidth * (hair.height / hair.width);
  targetContext.save();
  targetContext.translate(faceCenterX + faceWidth * (style.faceOffsetXRatio || 0), faceCenterY);
  targetContext.rotate(roll);
  targetContext.globalAlpha = 0.28;
  targetContext.filter = "blur(1px) saturate(.9)";
  targetContext.drawImage(hair, -drawWidth / 2, -drawHeight * style.faceCenterYRatio, drawWidth, drawHeight);
  targetContext.globalAlpha = 1;
  targetContext.filter = "saturate(.94) contrast(.98) brightness(.98)";
  targetContext.shadowColor = "rgba(0,0,0,.16)";
  targetContext.shadowBlur = 2;
  targetContext.drawImage(hair, -drawWidth / 2, -drawHeight * style.faceCenterYRatio, drawWidth, drawHeight);
  targetContext.restore();
}

function renderStylePreviews() {
  for (const style of hairstyles) {
    const preview = stylePreviewCanvases.get(style.id);
    if (!preview) continue;
    const sourceImage = preview.parentElement.querySelector("img");
    if (!state.capturedFrame) {
      preview.hidden = true;
      sourceImage.hidden = false;
      continue;
    }
    preview.hidden = false;
    sourceImage.hidden = true;
    const previewContext = preview.getContext("2d");
    previewContext.clearRect(0, 0, preview.width, preview.height);
    const crop = drawCapturedFaceCrop(previewContext, preview);
    drawHairPreview(previewContext, preview, style, crop);
    const warmth = previewContext.createLinearGradient(0, 0, 0, preview.height);
    warmth.addColorStop(0, "rgba(35,65,68,.04)");
    warmth.addColorStop(1, "rgba(181,112,67,.08)");
    previewContext.fillStyle = warmth;
    previewContext.fillRect(0, 0, preview.width, preview.height);
    const vignette = previewContext.createRadialGradient(preview.width / 2, preview.height * 0.46, 18, preview.width / 2, preview.height / 2, preview.width * 0.76);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.24)");
    previewContext.fillStyle = vignette;
    previewContext.fillRect(0, 0, preview.width, preview.height);
  }
}

function drawCaptureGuide() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height * 0.45;
  const guideRadiusX = Math.min(canvas.width * 0.17, canvas.height * 0.19);
  const guideRadiusY = Math.min(canvas.height * 0.30, guideRadiusX * 1.46);
  context.save();
  context.setLineDash([12, 9]);
  context.lineWidth = Math.max(2, canvas.width / 520);
  context.strokeStyle = "rgba(240, 210, 154, .9)";
  context.shadowColor = "rgba(0,0,0,.45)";
  context.shadowBlur = 8;
  context.beginPath();
  context.ellipse(centerX, centerY, guideRadiusX, guideRadiusY, 0, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  const message = "Position your face inside the guide, then select Capture + AI merge";
  context.font = `600 ${Math.max(15, canvas.width / 68)}px system-ui`;
  const textWidth = context.measureText(message).width;
  context.fillStyle = "rgba(5, 13, 14, .78)";
  const messageY = Math.min(canvas.height - 66, centerY + guideRadiusY + 28);
  context.fillRect(centerX - textWidth / 2 - 18, messageY - 10, textWidth + 36, 42);
  context.fillStyle = "#f4dfb6";
  context.fillText(message, centerX - textWidth / 2, messageY + 17);
  context.restore();
}

async function captureFace() {
  if (state.demo) {
    showToast("Use the camera to capture a real face");
    return;
  }
  if (state.captured) {
    state.captured = false;
    state.capturedFrame = null;
    state.detection = null;
    clearAiResult();
    captureFaceButton.textContent = "Capture + AI merge";
    liveArButton.disabled = false;
    snapshotButton.disabled = true;
    cameraStatus.textContent = "Camera active";
    trackingHint.textContent = "478-point Live AR tracking available";
    updateSelectedLook();
    renderStylePreviews();
    showToast("Ready for a new face capture");
    return;
  }
  if (video.readyState < 2 || !video.videoWidth) {
    showToast("Wait for the camera image, then try again");
    return;
  }
  controls.x.value = 0;
  controls.y.value = 0;
  controls.scale.value = 100;
  controls.rotation.value = 0;
  state.detection = null;
  const capturedFrame = document.createElement("canvas");
  capturedFrame.width = video.videoWidth;
  capturedFrame.height = video.videoHeight;
  const capturedContext = capturedFrame.getContext("2d");
  capturedContext.translate(capturedFrame.width, 0);
  capturedContext.scale(-1, 1);
  capturedContext.drawImage(video, 0, 0, capturedFrame.width, capturedFrame.height);
  state.capturedFrame = capturedFrame;
  state.captured = true;
  clearAiResult();
  captureFaceButton.textContent = "Retake face";
  liveArButton.disabled = true;
  snapshotButton.disabled = false;
  cameraStatus.textContent = "Face captured";
  updateSelectedLook();
  renderStylePreviews();
  showToast("Face captured - measuring automatic fit");
  await measureCapturedFace(capturedFrame);
  if (state.aiAvailable) {
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    await createAiStill();
  } else {
    cameraStatus.textContent = "Face captured - AI merge unavailable";
    showToast("Captured image held; AI merge is currently unavailable");
  }
}

function drawPhotorealisticHair(targetContext = context, targetCanvas = canvas, forceOverlay = false) {
  if (!state.showOverlay && !forceOverlay) return;
  const hair = getTintedHair(state.style, state.color);
  if (!hair) return;

  const numericScale = Number(controls.scale.value) / 100;
  const manualX = Number(controls.x.value);
  const manualY = Number(controls.y.value);
  const depth = Number(controls.depth.value) / 100;
  const opacity = Number(controls.opacity.value) / 100;
  let faceCenterX = targetCanvas.width / 2 + manualX;
  let faceCenterY = targetCanvas.height * 0.43 + manualY;
  let faceWidth = targetCanvas.height * 0.25;
  let faceHeight = faceWidth * 1.15;
  let automaticRoll = 0;

  if (state.detection && controls.autoAlign.checked) {
    const box = state.detection;
    faceCenterX = box.mirrored
      ? (box.centerX ?? box.x + box.width / 2) + manualX
      : targetCanvas.width - (box.x + box.width / 2) + manualX;
    faceCenterY = (box.centerY ?? box.y + box.height * 0.5) + manualY;
    faceWidth = box.width * 1.02;
    faceHeight = box.height * 1.02;
    automaticRoll = box.roll || 0;
  }

  // Long V/U assets have asymmetric inner layers; their visual center sits a
  // little left of the transparent face opening, so compensate per style.
  faceCenterX += faceWidth * (state.style.faceOffsetXRatio || 0);

  const drawWidth = faceWidth / state.style.faceOpeningRatio * numericScale;
  const drawHeight = state.style.faceOpeningHeightRatio
    ? faceHeight / state.style.faceOpeningHeightRatio * numericScale
    : drawWidth * (hair.height / hair.width);
  const parallaxX = state.pointer.x * 7 * depth;
  const parallaxY = state.pointer.y * 4 * depth;

  targetContext.save();
  targetContext.translate(faceCenterX + parallaxX, faceCenterY + parallaxY);
  targetContext.rotate(automaticRoll + (Number(controls.rotation.value) + state.pointer.x * 1.2 * depth) * Math.PI / 180);
  targetContext.transform(1, state.pointer.y * 0.012 * depth, state.pointer.x * 0.012 * depth, 1, 0, 0);

  // A soft contact shadow at the forehead and temples visually seats the hair
  // on the captured face instead of leaving a cut-out-looking inner edge.
  targetContext.save();
  targetContext.filter = `blur(${Math.max(2, faceWidth * 0.018)}px)`;
  targetContext.strokeStyle = "rgba(35, 20, 18, .22)";
  targetContext.lineWidth = Math.max(3, faceWidth * 0.045);
  targetContext.beginPath();
  targetContext.ellipse(0, -faceWidth * 0.015, faceWidth * 0.49, faceWidth * 0.64, 0, Math.PI * 1.04, Math.PI * 1.96);
  targetContext.stroke();
  targetContext.restore();

  // A faint blurred under-layer feathers flyaways into the photograph.
  targetContext.save();
  targetContext.globalAlpha = opacity * 0.30;
  targetContext.filter = `blur(${Math.max(0.8, drawWidth / 720)}px) saturate(.9)`;
  targetContext.drawImage(
    hair,
    -drawWidth * 0.5,
    -drawHeight * state.style.faceCenterYRatio,
    drawWidth,
    drawHeight
  );
  targetContext.restore();

  targetContext.globalAlpha = opacity;
  targetContext.filter = "saturate(.93) contrast(.98) brightness(.985)";
  targetContext.shadowColor = "rgba(0, 0, 0, .16)";
  targetContext.shadowBlur = 2 + depth * 3;
  targetContext.shadowOffsetY = 1 + depth;
  targetContext.drawImage(
    hair,
    -drawWidth * 0.5,
    -drawHeight * state.style.faceCenterYRatio,
    drawWidth,
    drawHeight
  );
  targetContext.restore();
}

function applyCinematicFinish(targetContext = context, targetCanvas = canvas) {
  targetContext.save();

  // One lighting wash over both layers helps the camera image and hair share
  // the same highlights and shadows without making the result look filtered.
  targetContext.globalCompositeOperation = "soft-light";
  const lighting = targetContext.createLinearGradient(0, 0, 0, targetCanvas.height);
  lighting.addColorStop(0, "rgba(45, 78, 80, .055)");
  lighting.addColorStop(0.52, "rgba(118, 91, 75, .025)");
  lighting.addColorStop(1, "rgba(191, 119, 70, .09)");
  targetContext.fillStyle = lighting;
  targetContext.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

  targetContext.globalCompositeOperation = "source-over";
  const vignette = targetContext.createRadialGradient(
    targetCanvas.width / 2,
    targetCanvas.height * 0.44,
    targetCanvas.height * 0.16,
    targetCanvas.width / 2,
    targetCanvas.height * 0.48,
    targetCanvas.width * 0.72
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.72, "rgba(0,0,0,.035)");
  vignette.addColorStop(1, "rgba(4,10,11,.26)");
  targetContext.fillStyle = vignette;
  targetContext.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
  targetContext.restore();
}

function drawAiResult() {
  if (!state.aiResult) return false;
  context.drawImage(state.aiResult, 0, 0, canvas.width, canvas.height);
  return true;
}

function render(now = 0) {
  if (!state.active) return;
  if (state.demo) {
    resizeCanvas(960, 720);
    drawDemoScene();
  } else if (state.capturedFrame) {
    resizeCanvas(state.capturedFrame.width, state.capturedFrame.height);
    if (!drawAiResult()) context.drawImage(state.capturedFrame, 0, 0, canvas.width, canvas.height);
  } else if (video.readyState >= 2) {
    resizeCanvas(video.videoWidth, video.videoHeight);
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.restore();
    if (!state.liveAr) detectFace(now);
  }
  if (state.aiResult) {
    // The AI still is already a fully merged photograph; do not place the AR
    // PNG over it again.
  } else if (state.holdCapturedFrame && state.capturedFrame) {
    // Keep the untouched captured portrait visible while the hidden AR
    // placement guide is prepared and the final AI edit is processing.
  } else if (state.liveAr) {
    applyCinematicFinish();
    window.MirrorlyAR?.update(now, {
      x: Number(controls.x.value),
      y: Number(controls.y.value),
      scale: Number(controls.scale.value),
      rotation: Number(controls.rotation.value),
      opacity: Number(controls.opacity.value) / 100,
      depth: Number(controls.depth.value) / 100
    }, state.showOverlay);
  } else if (state.captured || state.demo) {
    drawPhotorealisticHair();
    applyCinematicFinish();
  } else {
    applyCinematicFinish();
    drawCaptureGuide();
  }
  requestAnimationFrame(render);
}

function setBeforeMode(enabled) {
  state.showOverlay = !enabled;
  beforeAfterButton.textContent = enabled ? "Showing before" : "Hold for before";
}

function saveSnapshot() {
  const snapshotCanvas = document.createElement("canvas");
  snapshotCanvas.width = canvas.width;
  snapshotCanvas.height = canvas.height;
  const snapshotContext = snapshotCanvas.getContext("2d");
  snapshotContext.drawImage(canvas, 0, 0);
  if (state.liveAr && !arCanvas.hidden) snapshotContext.drawImage(arCanvas, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  snapshotCanvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const mode = state.aiResult ? "ai-realistic" : "3d";
    link.download = `mirrorly-${mode}-${state.style.id}-${new Date().toISOString().replaceAll(":", "-")}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast(state.aiResult ? "Realistic AI still saved on this laptop" : "3D preview saved on this laptop");
  }, "image/png");
}

function createStyleReferenceDataUrl() {
  const hair = getTintedHair(state.style, state.color);
  if (!hair) throw new Error("The selected hairstyle asset is still loading");
  const reference = document.createElement("canvas");
  reference.width = hair.width || 1024;
  reference.height = hair.height || 1024;
  const referenceContext = reference.getContext("2d");
  referenceContext.fillStyle = "#e7e2d9";
  referenceContext.fillRect(0, 0, reference.width, reference.height);
  referenceContext.drawImage(hair, 0, 0, reference.width, reference.height);
  return reference.toDataURL("image/png");
}

function createHiddenArPlacementDataUrl() {
  const placement = document.createElement("canvas");
  placement.width = state.capturedFrame.width;
  placement.height = state.capturedFrame.height;
  const placementContext = placement.getContext("2d");
  placementContext.drawImage(state.capturedFrame, 0, 0, placement.width, placement.height);
  drawPhotorealisticHair(placementContext, placement, true);
  applyCinematicFinish(placementContext, placement);
  return placement.toDataURL("image/png");
}

async function createAiStill() {
  if (!state.capturedFrame || state.demo) {
    showToast("Capture a real face before creating an AI still");
    return;
  }
  if (!state.aiAvailable) {
    showToast("AI merge is unavailable; keeping the local AR preview");
    return;
  }

  if (state.aiRendering) {
    state.aiRefreshPending = true;
    return;
  }

  state.aiRendering = true;
  state.holdCapturedFrame = true;
  const requestedStyleId = state.style.id;
  const requestedColorName = state.color.name;
  captureFaceButton.disabled = true;
  captureFaceButton.textContent = "Creating AI hairstyle...";
  cameraStatus.textContent = "Captured image held - AI hairstyle finishing";
  privacyStatus.textContent = "Uploading one captured still for AI hair replacement";
  updateAiButton();
  const aiStartedAt = Date.now();
  const aiProgressTimer = setInterval(() => {
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - aiStartedAt) / 1000));
    captureFaceButton.textContent = `AI finishing... ${elapsedSeconds}s`;
    cameraStatus.textContent = `Captured image held - AI finishing (${elapsedSeconds}s)`;
  }, 1000);

  try {
    const response = await fetch("/api/ai-render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portrait: state.capturedFrame.toDataURL("image/png"),
        arPreview: createHiddenArPlacementDataUrl(),
        styleReference: createStyleReferenceDataUrl(),
        styleId: state.style.id,
        colorName: state.color.name
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "AI still rendering failed");

    const image = new Image();
    image.decoding = "async";
    image.src = result.image;
    await image.decode();
    if (requestedStyleId !== state.style.id || requestedColorName !== state.color.name) {
      state.aiRefreshPending = true;
      return;
    }
    state.aiResult = image;
    state.holdCapturedFrame = false;
    cameraStatus.textContent = "Realistic AI still ready";
    privacyStatus.textContent = "AI processed one captured still";
    showToast("Realistic hairstyle merged into the photograph");
  } catch (error) {
    console.error("Mirrorly AI still failed", error);
    state.aiResult = null;
    state.holdCapturedFrame = true;
    cameraStatus.textContent = "Captured image held - AI unavailable";
    privacyStatus.textContent = "Live camera stays local; AI merge unavailable";
    const billingError = /billing|quota|hard limit|spend/i.test(error.message || "");
    showToast(billingError
      ? "AI billing limit reached; captured image remains visible"
      : (error.message || "AI merge failed; captured image remains visible"));
  } finally {
    clearInterval(aiProgressTimer);
    state.aiRendering = false;
    captureFaceButton.disabled = false;
    captureFaceButton.textContent = "Retake face";
    updateAiButton();
    if (state.aiRefreshPending) {
      state.aiRefreshPending = false;
      scheduleAutomaticAiStill();
    }
  }
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2400);
}

canvas.addEventListener("pointermove", (event) => {
  const bounds = canvas.getBoundingClientRect();
  state.pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
  state.pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
});
canvas.addEventListener("pointerleave", () => {
  state.pointer = { x: 0, y: 0 };
});

document.querySelector("#startCameraButton").addEventListener("click", startCamera);
document.querySelector("#demoButton").addEventListener("click", startDemo);
liveArButton.addEventListener("click", toggleLiveAr);
captureFaceButton.addEventListener("click", captureFace);
snapshotButton.addEventListener("click", saveSnapshot);
beforeAfterButton?.addEventListener("pointerdown", () => setBeforeMode(true));
beforeAfterButton?.addEventListener("pointerup", () => setBeforeMode(false));
beforeAfterButton?.addEventListener("pointerleave", () => setBeforeMode(false));
beforeAfterButton?.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "Enter") setBeforeMode(true);
});
beforeAfterButton?.addEventListener("keyup", () => setBeforeMode(false));

window.addEventListener("beforeunload", () => {
  video.srcObject?.getTracks().forEach((track) => track.stop());
  window.MirrorlyAR?.dispose();
});

createStyleButtons();
createColorButtons();
updateSelectedLook();
checkAiAvailability();
