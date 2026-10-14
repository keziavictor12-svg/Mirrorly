(function (root) {
  "use strict";

  // Snap Camera Kit live mirror. Snap renders hair lenses from its own engine
  // in the browser; Mirrorly only chooses the lens for the selected look.
  // The AI salon result and the local 2.5D renderer remain separate.

  const slug = (value) => String(value || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  // Lens lookup order: explicit map "style:Color", explicit map "style",
  // lens named "<style>-<color>", lens named "<style>". Returns null if none.
  function findLens(lenses, lensMap, styleId, colorName) {
    const byId = (id) => lenses.find((lens) => lens.id === id) || null;
    const mapped = lensMap?.[styleId + ":" + colorName] || lensMap?.[styleId];
    if (mapped) return byId(mapped);
    const wanted = [slug(styleId) + "-" + slug(colorName), slug(styleId)];
    for (const name of wanted) {
      const lens = lenses.find((candidate) => slug(candidate.name) === name);
      if (lens) return lens;
    }
    return null;
  }

  // A lens built for one style can still recolor itself from these params.
  function launchParamsFor(styleId, color) {
    return { styleId, hairColor: color?.value || "", hairColorName: color?.name || "" };
  }

  const helpers = { slug, findLens, launchParamsFor };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = helpers;
    return;
  }

  let config = null;
  let configPromise = null;
  let cameraKit = null;
  let session = null;
  let source = null;
  let sessionStream = null;
  let lenses = [];
  let appliedKey = "";
  let liveCanvas = null;
  let mount = null;
  let visible = false;
  let lastError = "";
  let lookVersion = 0;
  // Last Camera Kit step reached, so a stalled call can be located (no pixels or token).
  let step = "idle";

  async function loadConfig() {
    if (!configPromise) {
      configPromise = fetch("/api/snap-config", { cache: "no-store" })
        .then((response) => response.json())
        .catch(() => {
          // A network failure is not cached, so the next showLook retries the fetch.
          configPromise = null;
          return { available: false, missing: [], error: "Snap configuration unavailable" };
        });
    }
    config = await configPromise;
    return config;
  }

  let badge = null;

  function setVisible(value) {
    visible = Boolean(value && liveCanvas);
    if (liveCanvas) liveCanvas.hidden = !visible;
    if (mount && !badge) {
      // Snap requires its branding while a Camera Kit lens is running.
      badge = document.createElement("span");
      badge.className = "snap-badge";
      badge.textContent = "Powered by Snap Camera Kit";
      mount.append(badge);
    }
    if (badge) badge.hidden = !visible;
  }

  // Concurrent callers (camera start plus style/colour sync) share one setup;
  // otherwise a second call sees a half-built session with no lenses and hides it.
  let sessionSetup = null;
  let setupStream = null;

  function ensureSession(stream, mountElement) {
    if (sessionSetup && setupStream === stream) return sessionSetup;
    setupStream = stream;
    const setup = createSession(stream, mountElement).catch((error) => {
      if (sessionSetup === setup) { sessionSetup = null; setupStream = null; }
      throw error;
    });
    sessionSetup = setup;
    return setup;
  }

  async function createSession(stream, mountElement) {
    await stop(true, true);
    step = "bootstrap";
    const { bootstrapCameraKit, createMediaStreamSource, Transform2D } = await import("./vendor/snap/camera-kit.mjs");
    cameraKit ??= await bootstrapCameraKit({ apiToken: config.apiToken });
    session = await cameraKit.createSession();
    session.events.addEventListener("error", (event) => {
      lastError = event.detail?.error?.message || "Snap lens error";
      // Camera Kit removes a crashed lens itself; force a re-apply next time.
      if (event.detail?.error?.name === "LensExecutionError") appliedKey = "";
      root.dispatchEvent(new CustomEvent("mirrorly-snap", { detail: { status: "error", message: lastError } }));
    });
    mount = mountElement;
    liveCanvas = session.output.live;
    liveCanvas.classList.add("snap-live-canvas");
    liveCanvas.setAttribute("aria-label", "Snap Camera Kit live hairstyle mirror");
    liveCanvas.hidden = true;
    mount.append(liveCanvas);
    source = createMediaStreamSource(stream, { transform: Transform2D.MirrorX, cameraType: "front" });
    step = "setSource";
    await session.setSource(source);
    sessionStream = stream;
    step = "play";
    await session.play("live");
    const settings = stream.getVideoTracks()[0]?.getSettings?.() || {};
    // Valid only after play(); keeps the webcam's native aspect ratio.
    await source.setRenderSize(settings.width || 1280, settings.height || 720);
    step = "loadLensGroups";
    ({ lenses } = await cameraKit.lensRepository.loadLensGroups(config.lensGroupIds));
    return session;
  }

  // Show the Snap lens for this look. Returns true when Snap is rendering it,
  // false when Snap is unconfigured or has no lens for this look.
  async function showLook(stream, mountElement, style, color) {
    const version = ++lookVersion;
    await loadConfig();
    if (!config.available || !stream) {
      setVisible(false);
      return false;
    }
    try {
      await ensureSession(stream, mountElement);
      if (version !== lookVersion) return visible;
      const lens = findLens(lenses, config.lensMap, style.id, color.name);
      if (!lens) {
        appliedKey = "";
        await session.removeLens();
        setVisible(false);
        return false;
      }
      const key = lens.id + ":" + color.name;
      if (key !== appliedKey) {
        // Same lens, new colour: remove it first so the lens restarts and its
        // colour script reads the new hairColor launch param.
        if (appliedKey.startsWith(lens.id + ":")) {
          step = "removeLens";
          await session.removeLens();
          if (version !== lookVersion) return visible;
        }
        step = "applyLens";
        await session.applyLens(lens, { launchParams: launchParamsFor(style.id, color) });
        if (version !== lookVersion) return visible;
        appliedKey = key;
      }
      step = "playLens";
      await session.play("live");
      step = "shown";
      setVisible(true);
      lastError = "";
      return true;
    } catch (error) {
      lastError = error?.message || "Snap Camera Kit could not start";
      console.error("Mirrorly Snap Camera Kit failed", error);
      setVisible(false);
      return false;
    }
  }

  async function hide() {
    lookVersion += 1;
    setVisible(false);
    await session?.pause("live").catch(() => {});
  }

  async function stop(keepCameraKit = false, keepSetup = false) {
    // Internal restarts keep lookVersion, or the caller's own request would look stale.
    if (!keepSetup) { sessionSetup = null; setupStream = null; lookVersion += 1; }
    setVisible(false);
    appliedKey = "";
    lenses = [];
    sessionStream = null;
    liveCanvas?.remove();
    liveCanvas = null;
    const closing = session;
    session = null;
    source = null;
    await closing?.destroy().catch(() => {});
    if (!keepCameraKit) {
      await cameraKit?.destroy?.().catch(() => {});
      cameraKit = null;
    }
  }

  function getStatus() {
    return {
      configured: Boolean(config?.available),
      missing: config?.missing || [],
      configError: config?.error || null,
      visible,
      lensCount: lenses.length,
      lensNames: lenses.map((lens) => lens.name),
      step,
      error: lastError || null
    };
  }

  // Lens ids and names from the configured groups, for SNAP_LENS_MAP setup.
  const getLenses = () => lenses.map((lens) => ({ id: lens.id, name: lens.name, groupId: lens.groupId }));

  root.MirrorlySnap = { ...helpers, loadConfig, showLook, hide, stop, getStatus, getLenses, getCanvas: () => (visible ? liveCanvas : null) };
})(typeof window === "undefined" ? globalThis : window);
