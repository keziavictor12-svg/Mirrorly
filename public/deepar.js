(() => {
  const state = {
    active: false,
    activeEffectUrl: "",
    activeLookKey: "",
    canvas: null,
    config: null,
    configPromise: null,
    deepAR: null,
    requestedLookKey: "",
    root: null,
    sdkPromise: null,
    switchPromise: null,
    videoElement: null
  };

  function lookKey(styleId, colorName) {
    return styleId + ":" + colorName;
  }

  async function getConfig() {
    if (!state.configPromise) {
      state.configPromise = fetch("/api/deepar-config", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("DeepAR configuration could not be loaded");
          return response.json();
        })
        .then((config) => {
          state.config = config;
          window.dispatchEvent(new CustomEvent("mirrorly-deepar-status", {
            detail: {
              available: Boolean(config.available),
              ready: Boolean(config.ready),
              complete: Boolean(config.complete),
              configuredLookCount: Number(config.configuredLookCount) || 0,
              expectedLookCount: Number(config.expectedLookCount) || 40
            }
          }));
          return config;
        });
    }
    return state.configPromise;
  }

  async function getSdk() {
    if (!state.sdkPromise) {
      state.sdkPromise = import("/vendor/deepar/js/deepar.esm.js");
    }
    return state.sdkPromise;
  }

  async function ensurePlayer(videoElement, root) {
    const config = await getConfig();
    const sdk = await getSdk();
    state.root = root;
    root.hidden = false;
    if (!state.deepAR) {
      state.canvas = document.createElement("canvas");
      state.canvas.width = videoElement.videoWidth || 1280;
      state.canvas.height = videoElement.videoHeight || 720;
      state.canvas.setAttribute("aria-label", "DeepAR live hairstyle preview");
      root.replaceChildren(state.canvas);
      state.deepAR = await sdk.initialize({
        licenseKey: config.licenseKey,
        canvas: state.canvas,
        rootPath: config.sdkRootPath,
        additionalOptions: {
          cameraConfig: { disableDefaultCamera: true },
          hint: "faceInit"
        }
      });
      state.deepAR.setFps(30);
    }
    if (state.videoElement !== videoElement) {
      state.videoElement = videoElement;
      state.deepAR.setVideoElement(videoElement, true);
    }
  }

  async function applyLook(styleId, colorName) {
    const config = await getConfig();
    const key = lookKey(styleId, colorName);
    const effectUrl = config.effects?.[key];
    if (!state.deepAR || !effectUrl) return false;
    state.requestedLookKey = key;
    if (!state.switchPromise) {
      state.switchPromise = (async () => {
        while (state.activeLookKey !== state.requestedLookKey) {
          const targetKey = state.requestedLookKey;
          const targetUrl = config.effects[targetKey];
          if (!targetUrl) return false;
          if (state.activeEffectUrl !== targetUrl) {
            await state.deepAR.switchEffect(targetUrl);
            state.activeEffectUrl = targetUrl;
          }
          const targetColor = targetKey.slice(targetKey.indexOf(":") + 1);
          const control = config.colorControl;
          const vector = control?.values?.[targetColor];
          if (control && Array.isArray(vector) && vector.length === 4) {
            const targets = Array.isArray(control.targets) && control.targets.length
              ? control.targets
              : [{ gameObject: control.gameObject, parameter: control.parameter }];
            for (const target of targets) {
              if (!target?.gameObject || !target?.parameter) continue;
              try {
                state.deepAR.changeParameterVector(
                  target.gameObject,
                  control.component,
                  target.parameter,
                  vector[0],
                  vector[1],
                  vector[2],
                  vector[3]
                );
              } catch (error) {
                console.debug("Mirrorly DeepAR color fallback was not available", target, error);
              }
            }
          }
          state.activeLookKey = targetKey;
        }
        return true;
      })().finally(() => {
        state.switchPromise = null;
      });
    }
    await state.switchPromise;
    return state.activeLookKey === key;
  }

  async function start({ videoElement, root, styleId, colorName }) {
    const config = await getConfig();
    const key = lookKey(styleId, colorName);
    if (!config.available) return { active: false, reason: "license-missing" };
    if (!config.effects?.[key]) {
      return {
        active: false,
        reason: "effect-missing",
        configuredLookCount: config.configuredLookCount,
        expectedLookCount: config.expectedLookCount
      };
    }
    if (!(videoElement instanceof HTMLVideoElement) || !root) {
      return { active: false, reason: "camera-unavailable" };
    }

    try {
      await ensurePlayer(videoElement, root);
      const applied = await applyLook(styleId, colorName);
      if (!applied) return { active: false, reason: "effect-missing" };
      state.deepAR.setPaused(false);
      state.active = true;
      root.hidden = false;
      return { active: true, lookKey: state.activeLookKey };
    } catch (error) {
      console.error("Mirrorly DeepAR initialization failed", error);
      state.active = false;
      root.hidden = true;
      return { active: false, reason: "initialization-failed", error: error.message };
    }
  }

  function pause() {
    state.deepAR?.setPaused(true);
    state.active = false;
    if (state.root) state.root.hidden = true;
  }

  function destroy() {
    state.active = false;
    if (state.root) state.root.hidden = true;
    state.deepAR?.shutdown();
    state.deepAR = null;
    state.canvas = null;
    state.videoElement = null;
    state.activeEffectUrl = "";
    state.activeLookKey = "";
    state.requestedLookKey = "";
    state.switchPromise = null;
  }

  window.MirrorlyDeepAR = Object.freeze({
    applyLook,
    destroy,
    getCanvas: () => state.deepAR?.getCanvas() || state.canvas,
    getStatus: () => ({
      active: state.active,
      activeLookKey: state.activeLookKey,
      available: Boolean(state.config?.available),
      ready: Boolean(state.config?.ready),
      complete: Boolean(state.config?.complete),
      configuredLookCount: Number(state.config?.configuredLookCount) || 0,
      expectedLookCount: Number(state.config?.expectedLookCount) || 40
    }),
    pause,
    start
  });

  getConfig().catch((error) => {
    console.warn("Mirrorly DeepAR configuration unavailable", error.message);
  });
})();
