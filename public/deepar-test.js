import * as deepar from "/vendor/deepar/js/deepar.esm.js";

const status = document.querySelector("#status");
const startButton = document.querySelector("#startButton");
const applyEffectButton = document.querySelector("#applyEffectButton");
const effectSelect = document.querySelector("#effectSelect");
const preview = document.querySelector("#deeparRoot");

let config = null;
let deepAR = null;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? "#ffaaa5" : "";
}

async function loadConfig() {
  const response = await fetch("/api/deepar-config", { cache: "no-store" });
  if (!response.ok) throw new Error("DeepAR configuration could not be loaded");
  config = await response.json();
  if (!config.available) {
    setStatus("DeepAR is installed. Add a valid Web SDK license key to run the camera test.");
    return;
  }
  for (const effect of config.sampleEffects || []) {
    const option = document.createElement("option");
    option.value = effect.url;
    option.textContent = effect.name;
    effectSelect.append(option);
  }
  if (config.sampleEffects?.length) {
    effectSelect.value = config.testEffectUrl;
    effectSelect.disabled = false;
  }
  startButton.disabled = false;
  setStatus(`DeepAR is licensed. ${config.sampleEffects?.length || 0} free-package effects are ready to test.`);
}

async function startDeepAr() {
  startButton.disabled = true;
  setStatus("Loading DeepAR WebAssembly, tracking, camera, and test effect...");
  try {
    deepAR = await deepar.initialize({
      licenseKey: config.licenseKey,
      previewElement: preview,
      effect: effectSelect.value || config.testEffectUrl,
      rootPath: config.sdkRootPath,
      additionalOptions: { hint: "faceInit" }
    });
    deepAR.setFps(30);
    applyEffectButton.disabled = effectSelect.disabled;
    setStatus("DeepAR camera and selected sample effect are active. This package contains no hairstyle effects.");
  } catch (error) {
    console.error("Mirrorly DeepAR test failed", error);
    setStatus(error.message || "DeepAR could not start", true);
    startButton.disabled = false;
  }
}

async function applySelectedEffect() {
  if (!deepAR || !effectSelect.value) return;
  applyEffectButton.disabled = true;
  setStatus(`Switching to ${effectSelect.selectedOptions[0]?.textContent || "the selected effect"}...`);
  try {
    await deepAR.switchEffect(effectSelect.value);
    setStatus(`${effectSelect.selectedOptions[0]?.textContent || "Selected effect"} is active.`);
  } catch (error) {
    console.error("Mirrorly DeepAR effect switch failed", error);
    setStatus(error.message || "The selected effect could not be loaded", true);
  } finally {
    applyEffectButton.disabled = false;
  }
}

startButton.addEventListener("click", startDeepAr);
applyEffectButton.addEventListener("click", applySelectedEffect);
effectSelect.addEventListener("change", () => {
  if (deepAR) applySelectedEffect();
});
window.addEventListener("beforeunload", () => deepAR?.shutdown());
loadConfig().catch((error) => setStatus(error.message, true));
