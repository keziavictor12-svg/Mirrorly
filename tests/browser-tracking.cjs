// Real Edge/WebGL integration with deterministic landmarks. No camera permission,
// API requests, customer portraits, or paid AI generation are used by this test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const canonicalFixture = require('./fixtures/mediapipe-canonical-points.json');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(root, '.edge-accuracy-'));
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert.ok(edge, 'Edge is required for this integration test');
const source = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const catalogContext = {};
vm.runInNewContext(source.slice(source.indexOf('const hairstyles = '), source.indexOf('const pngPreferredLiveStyles')) + '\nglobalThis.catalog = hairstyles;', catalogContext);
const browser = spawn(edge, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, 'http://localhost:4173/'], { windowsHide: true, stdio: 'ignore' });
const pending = new Map();
let socket;
let id = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = Date.now() + 60000;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const messageId = ++id;
    const timeout = setTimeout(() => { pending.delete(messageId); reject(new Error(`${method} timed out`)); }, 25000);
    pending.set(messageId, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
}

async function main() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  while (!fs.existsSync(portFile)) {
    assert.ok(Date.now() < deadline, 'Edge debug port did not start');
    await delay(150);
  }
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  let page;
  while (!page) {
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = pages.find((p) => p.type === 'page' && p.url.startsWith('http://localhost:4173/'));
    if (!page) await delay(150);
    assert.ok(Date.now() < deadline, 'Mirrorly page did not open');
  }
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(message.id);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  };
  while (true) {
    const ready = await send('Runtime.evaluate', { expression: "document.readyState === 'complete' && !!window.MirrorlyAR && typeof buildLiveAiMergedLayer === 'function'", returnByValue: true });
    if (ready.result?.value) break;
    assert.ok(Date.now() < deadline, 'Mirrorly scripts did not finish loading');
    await delay(100);
  }
  const result = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const vision = await import('./vendor/mediapipe/vision_bundle.mjs');
      const THREE = await import('./vendor/three/three.module.min.js');
      await import('./tracking.js');
      const tracking = window.MirrorlyTracking;
      let result;
      vision.FaceLandmarker.createFromOptions = async () => ({
        detectForVideo: () => result,
        close: () => {}, setOptions: async () => {}
      });
      let segmentationLoads = 0;
      vision.ImageSegmenter.createFromOptions = async () => {
        segmentationLoads++;
        return { close() {}, getLabels: () => ['background', 'hair'] };
      };
      const canvas = document.createElement('canvas');
      const video = { videoWidth: 1280, videoHeight: 720, readyState: 2, currentTime: 0 };
      await window.MirrorlyAR.initialize(canvas, video);
      await Promise.all([window.MirrorlyAR.prepareHairSegmentation(), window.MirrorlyAR.prepareHairSegmentation()]);
      if (segmentationLoads !== 1) throw new Error('Local segmentation warm-up loads duplicate models');
      const controls = { x: 0, y: 0, scale: 100, rotation: 0, opacity: 1, depth: 0.35 };
      const catalog = ${JSON.stringify(catalogContext.catalog)};
      const canonicalPoints = ${JSON.stringify(canonicalFixture.points)};
      let now = 1000;
      function frame(yaw, tx = 630, roll = 0.05) {
        const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.1, yaw, roll, 'YXZ'));
        const e = matrix.elements;
        const r = [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
        const points = Array.from({ length: 478 }, () => ({ x: tx / 1280, y: 0.5, z: 0 }));
        for (const [index, point] of canonicalPoints.entries()) {
          const p = tracking.transform(r, point);
          points[index] = { x: (tx + p[0] * 12) / 1280, y: (350 - p[1] * 12) / 720, z: -p[2] * 12 / 1280 };
        }
        result = { faceLandmarks: [points], facialTransformationMatrixes: [{ data: matrix.setPosition(1, 0, -50).toArray() }] };
        now += 40;
        video.currentTime += 0.04;
        window.MirrorlyAR.update(now, controls, true);
        return window.MirrorlyAR.getStatus(now);
      }
      window.MirrorlyAR.setEnabled(true);
      if (window.MirrorlyAR.getStatus(now).tracking) throw new Error('Tracking started before detection');
      const checks = [];
      const modelEvents = [];
      window.addEventListener('mirrorly-ar-model', event => modelEvents.push(event.detail));
      for (const style of catalog) {
        const image = new Image(); image.src = style.asset; await image.decode();
        window.MirrorlyAR.setHair(image, style, { value: '#70432f' });
        frame(0);
        const until = performance.now() + 10000;
        while (window.MirrorlyAR.getStatus(now).renderMode !== '3d') {
          if (performance.now() > until) throw new Error(style.id + ' failed to load as 3D: ' + JSON.stringify({ status: window.MirrorlyAR.getStatus(now).styleId, events: modelEvents.slice(-4) }));
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        for (let i = 0; i < 30; i++) frame(0.6, 650);
        const status = window.MirrorlyAR.getStatus(now);
        if (!status.tracking || Math.abs(status.pose.yaw + 0.6) > 0.05) throw new Error(style.id + ' rotation did not follow fully');
        if (Math.abs(status.pose.faceWidth - 12 * tracking.faceWidthCm) > 0.1) throw new Error(style.id + ' shrank on yaw');
        const gl = canvas.getContext('webgl2');
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let visiblePixels = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) visiblePixels++;
        if (visiblePixels < 100) throw new Error(style.id + ' did not render visible hair');
        checks.push({ style: style.id, mode: status.renderMode, yaw: status.pose.yaw, width: status.pose.faceWidth, visiblePixels });
      }
      const stale = window.MirrorlyAR.getStatus(now + 250);
      if (stale.tracking) throw new Error('Ghost tracking did not expire');
      result = { faceLandmarks: [] };
      now += 250; video.currentTime += 0.25;
      window.MirrorlyAR.update(now, controls, true);
      const staleGl = canvas.getContext('webgl2');
      const stalePixels = new Uint8Array(canvas.width * canvas.height * 4);
      staleGl.readPixels(0, 0, canvas.width, canvas.height, staleGl.RGBA, staleGl.UNSIGNED_BYTE, stalePixels);
      if (stalePixels.some((v, i) => i % 4 === 3 && v > 0)) throw new Error('Ghost hair is still rendered');
      window.MirrorlyAR.setEnabled(false);
      window.MirrorlyAR.setEnabled(true);
      const reacquired = frame(0, 450);
      if (!reacquired.tracking || Math.abs(reacquired.pose.x - tracking.fitFace(result.faceLandmarks[0], 1280, 720, result.facialTransformationMatrixes[0]).x) > 0.01) throw new Error('Reacquired face inherited the old pose');
      const fallbackImage = new Image(); fallbackImage.src = catalog[0].asset; await fallbackImage.decode();
      const failedStyle = { ...catalog[0], id: 'test-missing-model', model3d: { ...catalog[0].model3d, src: '/assets/models/test-missing-model.glb' } };
      const fallbackReady = new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        const listener = (event) => {
          if (event.detail.styleId !== failedStyle.id || event.detail.status !== 'fallback') return;
          clearTimeout(timeout); window.removeEventListener('mirrorly-ar-model', listener); resolve(true);
        };
        window.addEventListener('mirrorly-ar-model', listener);
      });
      window.MirrorlyAR.setHair(fallbackImage, failedStyle, { value: '#70432f' });
      if (!await fallbackReady) throw new Error('Model failure did not activate fallback');
      const fallback = frame(0);
      if (!fallback.tracking || fallback.renderMode !== 'png') throw new Error('PNG fallback did not retain tracking');
      const layerStyle = { ...catalog[0], id: 'test-layered-ai', model3d: null };
      window.MirrorlyAR.setHair(fallbackImage, layerStyle, '#70432f', fallbackImage);
      const layered = frame(0.25);
      if (!layered.tracking || layered.renderMode !== 'png') throw new Error('Layered AI fallback failed');
      window.MirrorlyAR.setEnabled(false);
      window.MirrorlyAR.setEnabled(true);
      frame(0);
      const capturePose = window.MirrorlyAR.getCapturePose();
      const captureFaceMask = window.MirrorlyAR.createCaptureFaceMask();
      if (!captureFaceMask) throw new Error('Landmark face contour was not created');
      const attachment = {
        crop: { x: 600, y: 120, width: 80, height: 80 },
        headX: capturePose.headX, headY: capturePose.headY,
        faceWidth: capturePose.faceWidth, quaternion: capturePose.quaternion,
        depth: 70
      };
      const marker = document.createElement('canvas'); marker.width = 20; marker.height = 20;
      const markerContext = marker.getContext('2d');
      markerContext.fillStyle = '#ff0000'; markerContext.fillRect(0, 0, 20, 10);
      markerContext.fillStyle = '#00ff00'; markerContext.fillRect(0, 10, 20, 10);
      window.MirrorlyAR.setHair(marker, { ...layerStyle, aiAttachment: attachment }, '#ffffff');
      frame(0);
      const markerGl = canvas.getContext('webgl2');
      const sample = (x, y) => {
        const pixel = new Uint8Array(4);
        markerGl.readPixels(x, canvas.height - 1 - y, 1, 1, markerGl.RGBA, markerGl.UNSIGNED_BYTE, pixel);
        return [...pixel];
      };
      const top = sample(640, 130), bottom = sample(640, 190);
      if (top[0] < 220 || top[1] > 30 || bottom[1] < 220 || bottom[0] > 30) throw new Error('AI texture is flipped or misplaced: ' + top + '/' + bottom);
      if (window.MirrorlyAR.getStatus(now).renderMode !== 'ai') throw new Error('AI attachment mode was not reported');
      for (let i = 0; i < 30; i++) frame(1);
      const hidden = new Uint8Array(canvas.width * canvas.height * 4);
      markerGl.readPixels(0, 0, canvas.width, canvas.height, markerGl.RGBA, markerGl.UNSIGNED_BYTE, hidden);
      if (hidden.some((v, i) => i % 4 === 3 && v > 0)) throw new Error('Single-view AI remains visible at excessive yaw');

      // Synthetic portraits/masks exercise extraction without paid generation.
      const portrait = document.createElement('canvas'); portrait.width = 1280; portrait.height = 720;
      const pc = portrait.getContext('2d');
      pc.fillStyle = '#789abc'; pc.fillRect(0, 0, 1280, 720);
      pc.fillStyle = '#111111'; pc.fillRect(820, 190, 32, 55);
      pc.fillRect(790, 210, 62, 4);
      pc.fillStyle = '#70432f'; pc.fillRect(650, 275, 15, 25);
      const edited = document.createElement('canvas'); edited.width = 1280; edited.height = 720;
      const ec = edited.getContext('2d'); ec.drawImage(portrait, 0, 0);
      ec.fillStyle = '#789abc'; ec.fillRect(820, 190, 32, 55);
      ec.fillRect(790, 210, 62, 4);
      ec.fillStyle = '#70432f'; ec.fillRect(760, 200, 48, 45);
      const mask = () => ({ width: 1280, height: 720, data: new Float32Array(1280 * 720) });
      const newMask = mask(), oldMask = mask();
      const maskRect = (m, x, y, w, h) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) m.data[yy * m.width + xx] = 1; };
      maskRect(newMask, 760, 200, 48, 45); maskRect(newMask, 650, 275, 15, 25);
      maskRect(oldMask, 820, 190, 32, 55); maskRect(oldMask, 650, 275, 15, 25);
      maskRect(oldMask, 790, 210, 62, 4);
      const contourPixels = captureFaceMask.getContext('2d').getImageData(0, 0, 1280, 720).data;
      let foreheadSample;
      for (let y = Math.ceil(capturePose.foreheadY); y < capturePose.foreheadY + capturePose.faceHeight * 0.2 && !foreheadSample; y++) {
        for (let x = Math.floor(capturePose.foreheadX - capturePose.faceWidth * 0.42); x <= capturePose.foreheadX + capturePose.faceWidth * 0.42; x++) {
          const dx = x - capturePose.faceCenterX, dy = y - capturePose.faceCenterY;
          const localX = dx * Math.cos(capturePose.roll) + dy * Math.sin(capturePose.roll);
          const localY = -dx * Math.sin(capturePose.roll) + dy * Math.cos(capturePose.roll);
          const oldOval = (localX / (capturePose.faceWidth * 0.455)) ** 2 + ((localY - capturePose.faceHeight * 0.025) / (capturePose.faceHeight * 0.505)) ** 2;
          if (contourPixels[(y * 1280 + x) * 4 + 3] > 240 && oldOval > 1.08) { foreheadSample = { x, y }; break; }
        }
      }
      if (!foreheadSample) throw new Error('Canonical forehead fixture does not cover the old oval seam');
      ec.fillStyle = '#70432f'; ec.fillRect(foreheadSample.x - 3, foreheadSample.y - 3, 7, 7);
      maskRect(newMask, foreheadSample.x - 3, foreheadSample.y - 3, 7, 7);
      const editedImage = new Image(); editedImage.src = edited.toDataURL('image/png'); await editedImage.decode();
      const fixtureCapture = {
        width: 1280, height: 720, portrait, style: catalog[0], originalHairMask: oldMask, faceMask: captureFaceMask,
        pose: { ...capturePose, x: capturePose.headX, y: capturePose.headY, width: 470, height: 380 }
      };
      // All 8 cuts / 5 colors exercise real edit-mask and upload preparation,
      // including the PNG-only men's styles that used to read undefined.split.
      const savedStyle = state.style, savedColor = state.color;
      let styleMasks = 0, referencePngBytes = 0, referenceJpegBytes = 0;
      try {
        for (const style of hairstyles) {
          await hairImages.get(style.id).decode();
          state.style = style;
          for (const color of colors) {
            state.color = color;
            const edit = createLiveAiEditMask({ ...fixtureCapture, style, originalHairMask: null });
            const pixels = edit.getContext('2d').getImageData(0, 0, edit.width, edit.height).data;
            let changed = 0;
            for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 224) changed++;
            const protectedFacePixel = (Math.round(capturePose.faceCenterY) * edit.width + Math.round(capturePose.faceCenterX)) * 4 + 3;
            if (changed < 500 || changed > 800000 || pixels[3] !== 255) throw new Error('Invalid edit mask for ' + style.id);
            if (pixels[protectedFacePixel] !== 255) throw new Error('Central facial features remain editable for ' + style.id);
            const reference = new Image(); reference.src = createStyleReferenceDataUrl(); await reference.decode();
            if (!reference.src.startsWith('data:image/jpeg;') || Math.max(reference.naturalWidth, reference.naturalHeight) > 768) throw new Error('Reference upload was not bounded JPEG');
            styleMasks++;
          }
          const reference = document.createElement('canvas');
          const hair = hairImages.get(style.id); reference.width = hair.naturalWidth; reference.height = hair.naturalHeight;
          reference.getContext('2d').drawImage(hair, 0, 0);
          referencePngBytes += Math.floor(reference.toDataURL('image/png').split(',')[1].length * 3 / 4);
          referenceJpegBytes += Math.floor(createStyleReferenceDataUrl().split(',')[1].length * 3 / 4);
        }
        const uploadSource = document.createElement('canvas'); uploadSource.width = 1920; uploadSource.height = 1080;
        const uc = uploadSource.getContext('2d'); uc.fillStyle = '#abcdef'; uc.fillRect(0, 0, 1920, 1080);
        uc.fillStyle = '#123456'; uc.fillRect(1880, 1040, 40, 40);
        const portraitUpload = new Image(); portraitUpload.src = createAiUploadDataUrl(uploadSource); await portraitUpload.decode();
        const maskUpload = new Image(); maskUpload.src = createAiUploadDataUrl(uploadSource); await maskUpload.decode();
        if (portraitUpload.naturalWidth !== 1280 || portraitUpload.naturalHeight !== 720 || portraitUpload.naturalWidth !== maskUpload.naturalWidth) throw new Error('Portrait/mask upload scaling differs');
        const resized = document.createElement('canvas'); resized.width = 1280; resized.height = 720;
        resized.getContext('2d').drawImage(portraitUpload, 0, 0);
        if (resized.getContext('2d').getImageData(1275, 715, 1, 1).data[0] !== 18) throw new Error('Full-frame upload cropped the lower edge');
        if (uploadSource.width !== 1920 || uploadSource.height !== 1080) throw new Error('Upload resize modified the displayed capture');
        if (referenceJpegBytes >= referencePngBytes) throw new Error('Optimized reference payload is not smaller');
      } finally { state.style = savedStyle; state.color = savedColor; }
      const falseFaceX = Math.round(capturePose.faceCenterX);
      const falseFaceY = Math.round(capturePose.faceCenterY);
      maskRect(newMask, falseFaceX - 12, falseFaceY - 12, 25, 25);
      const faceLeakCanvas = document.createElement('canvas');
      faceLeakCanvas.width = editedImage.naturalWidth; faceLeakCanvas.height = editedImage.naturalHeight;
      const faceLeakContext = faceLeakCanvas.getContext('2d');
      faceLeakContext.drawImage(editedImage, 0, 0);
      faceLeakContext.fillStyle = '#ded7e8';
      faceLeakContext.fillRect(falseFaceX - 12, falseFaceY - 12, 25, 25);
      const faceLeakImage = new Image();
      faceLeakImage.src = faceLeakCanvas.toDataURL('image/png');
      await faceLeakImage.decode();
      const merged = buildLiveAiMergedLayer(faceLeakImage, fixtureCapture, newMask);
      const crop = merged.profile.aiAttachment.crop;
      const patchSample = (image, x, y) => [...image.getContext('2d').getImageData(x - crop.x, y - crop.y, 1, 1).data];
      if (patchSample(merged.source, 835, 215)[3] !== 0) throw new Error('Frozen background remains attached to scalp hair');
      if (merged.repairSource !== null) throw new Error('Live AI layer retained frozen portrait/background repair pixels');
      if (patchSample(merged.foregroundSource, 835, 215)[3] !== 0) throw new Error('Foreground mask retains old-hair/background pixels outside face');
      if (patchSample(merged.foregroundSource, foreheadSample.x, foreheadSample.y)[3] < 230) throw new Error('Landmark forehead hair was clipped by the old oval');
      if (patchSample(merged.source, falseFaceX, falseFaceY)[3] !== 0
        || patchSample(merged.foregroundSource, falseFaceX, falseFaceY)[3] !== 0) {
        throw new Error('Altered face pixels leaked through the hairstyle face opening');
      }
      window.MirrorlyAR.setEnabled(false); window.MirrorlyAR.setEnabled(true); frame(0);
      window.MirrorlyAR.setHair(merged.source, merged.profile, '#70432f', merged.foregroundSource, merged.repairSource);
      frame(0);
      if (sample(foreheadSample.x, foreheadSample.y)[3] < 200) throw new Error('Forehead strands were hidden by the live face depth mesh');
      const backgroundLeak = sample(835, 215);
      if (backgroundLeak[3] > 5) throw new Error('Frozen background pixels leaked into the rendered hair layer');
      const checkNoRepairGhost = () => {
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        markerGl.readPixels(0, 0, canvas.width, canvas.height, markerGl.RGBA, markerGl.UNSIGNED_BYTE, pixels);
        let visibleHair = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 24) continue;
          if (pixels[i + 2] > 100) throw new Error('Frozen room pixels form a moving repair patch');
          visibleHair++;
        }
        if (visibleHair < 20) throw new Error('Hair was hidden instead of just the background repair');
      };
      for (let i = 0; i < 15; i++) frame(0, 630, 0.4);
      checkNoRepairGhost();
      window.MirrorlyAR.setEnabled(false); window.MirrorlyAR.setEnabled(true); frame(0, 590);
      checkNoRepairGhost();
      window.MirrorlyAR.setEnabled(false); window.MirrorlyAR.setEnabled(true); frame(0);
      if (!window.MirrorlyAR.getStatus(now).metrics.personalRegistration) throw new Error('Personal landmark registration did not run');

      // Multi-view: a side salon view takes over where a single front view hides.
      window.MirrorlyAR.setEnabled(false); window.MirrorlyAR.setEnabled(true);
      for (let i = 0; i < 20; i++) frame(0.45);
      const sidePose = window.MirrorlyAR.getCapturePose();
      const sideMarker = document.createElement('canvas'); sideMarker.width = 20; sideMarker.height = 20;
      const sideContext = sideMarker.getContext('2d'); sideContext.fillStyle = '#ff0000'; sideContext.fillRect(0, 0, 20, 20);
      const sideAttachment = {
        crop: { x: sidePose.headX - 60, y: sidePose.headY - 120, width: 120, height: 80 },
        headX: sidePose.headX, headY: sidePose.headY, faceWidth: sidePose.faceWidth,
        quaternion: sidePose.quaternion, depth: sidePose.foreheadDepth, depthSamples: sidePose.depthSamples,
        personalAnchors: sidePose.personalAnchors, depthStrength: 0.32,
        viewFadeStart: 30 * Math.PI / 180, viewFadeEnd: 45 * Math.PI / 180
      };
      window.MirrorlyAR.setHair(merged.source, merged.profile, '#70432f', merged.foregroundSource, null,
        [{ source: sideMarker, foregroundSource: null, attachment: sideAttachment }]);
      const redPixels = () => {
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        markerGl.readPixels(0, 0, canvas.width, canvas.height, markerGl.RGBA, markerGl.UNSIGNED_BYTE, pixels);
        let red = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 120 && pixels[i] > 150 && pixels[i + 1] < 60) red++;
        return red;
      };
      window.MirrorlyAR.setEnabled(false); window.MirrorlyAR.setEnabled(true);
      for (let i = 0; i < 20; i++) frame(0);
      const frontRed = redPixels();
      if (window.MirrorlyAR.getStatus(now).metrics.aiViews !== 2) throw new Error('Side view was not attached');
      for (let i = 0; i < 30; i++) frame(1);
      const turnedRed = redPixels();
      if (turnedRed < 200 || turnedRed < frontRed * 4) throw new Error('Side view did not take over at a wide turn: ' + frontRed + '/' + turnedRed);
      window.MirrorlyAR.setHair(merged.source, merged.profile, '#70432f', merged.foregroundSource, null);
      if (window.MirrorlyAR.getStatus(now).metrics.aiViews !== 1) throw new Error('Side view meshes were not released');
      window.MirrorlyAR.setEnabled(false); window.MirrorlyAR.setEnabled(true); frame(0);

      // Live real-hair removal on the actual preview canvas, mocked mask only.
      const savedLiveMask = window.MirrorlyAR.getLiveHairMask;
      try {
        resizeCanvas(1280, 720);
        context.fillStyle = '#4a7fb0'; context.fillRect(0, 0, 1280, 720);
        context.fillStyle = '#d9a383'; context.beginPath(); context.ellipse(640, 380, 95, 125, 0, 0, Math.PI * 2); context.fill();
        context.fillStyle = '#140c08'; context.fillRect(520, 150, 240, 110);
        const liveMask = { width: 320, height: 180, data: new Float32Array(320 * 180), version: 1, at: 0 };
        for (let y = 38; y < 65; y++) for (let x = 130; x < 190; x++) liveMask.data[y * 320 + x] = 1;
        window.MirrorlyAR.getLiveHairMask = () => liveMask;
        const removalPose = { faceCenterX: 640, faceCenterY: 380, faceWidth: 190, faceHeight: 250, roll: 0 };
        resetLiveHairRemoval();
        suppressLiveRealHair(removalPose, 0);
        const px = (x, y) => [...context.getImageData(x, y, 1, 1).data];
        const removed = px(560, 175), cheek = px(640, 420);
        if (removed[0] + removed[1] + removed[2] < 200 || removed[2] < 100) throw new Error('Real hair was not replaced by surrounding background: ' + removed);
        if (Math.abs(cheek[0] - 0xd9) > 2 || Math.abs(cheek[1] - 0xa3) > 2) throw new Error('Face pixels were altered by real-hair removal: ' + cheek);
      } finally {
        window.MirrorlyAR.getLiveHairMask = savedLiveMask;
        resetLiveHairRemoval();
      }

      const tailCanvas = document.createElement('canvas'); tailCanvas.width = 1280; tailCanvas.height = 720;
      const tc = tailCanvas.getContext('2d'); tc.drawImage(portrait, 0, 0);
      tc.fillStyle = '#70432f'; tc.fillRect(650, 275, 15, 415);
      const tailMask = mask(); maskRect(tailMask, 650, 275, 15, 415);
      const tailImage = new Image(); tailImage.src = tailCanvas.toDataURL('image/png'); await tailImage.decode();
      const smallFaceCapture = { ...fixtureCapture, originalHairMask: null, pose: { ...fixtureCapture.pose, faceWidth: 100, faceHeight: 115 } };
      const longLayer = buildLiveAiMergedLayer(tailImage, smallFaceCapture, tailMask);
      const layerSample = (layer, x, y) => {
        const c = layer.profile.aiAttachment.crop;
        return [...layer.source.getContext('2d').getImageData(x - c.x, y - c.y, 1, 1).data];
      };
      if (layerSample(longLayer, 655, 670)[3] < 230 || longLayer.edgeClipped) throw new Error('Long hair was clipped by the face-height ROI');
      tc.fillRect(650, 690, 15, 30); maskRect(tailMask, 650, 690, 15, 30);
      tailImage.src = tailCanvas.toDataURL('image/png'); await tailImage.decode();
      const croppedLayer = buildLiveAiMergedLayer(tailImage, smallFaceCapture, tailMask);
      if (!croppedLayer.edgeClipped || layerSample(croppedLayer, 655, 719)[3] !== 0) throw new Error('Cropped bottom edge remains opaque');
      const fadedAlpha = layerSample(croppedLayer, 655, 708)[3];
      if (fadedAlpha <= 0 || fadedAlpha >= 230 || layerSample(croppedLayer, 655, 660)[3] < 230) throw new Error('Cropped edge fade is not localized/smooth');

      // Exercise the actual preview path with a mocked camera and no requests.
      const originalUpdate = window.MirrorlyAR.update;
      const originalStatus = window.MirrorlyAR.getStatus;
      const originalRaf = window.requestAnimationFrame;
      const originalDraw = context.drawImage;
      let overlayArgument;
      window.requestAnimationFrame = () => 0;
      window.MirrorlyAR.update = (_now, _controls, show) => { overlayArgument = show; };
      window.MirrorlyAR.getStatus = () => ({ tracking: false });
      Object.defineProperties(document.querySelector('#cameraVideo'), {
        readyState: { configurable: true, value: 2 }, videoWidth: { configurable: true, value: 1280 }, videoHeight: { configurable: true, value: 720 }
      });
      context.drawImage = function (source, ...args) { return originalDraw.call(this, source === document.querySelector('#cameraVideo') ? portrait : source, ...args); };
      try {
        state.active = true; state.demo = false; state.capturedFrame = null;
        state.aiResult = null; state.holdCapturedFrame = false; state.liveAr = true;
        state.showOverlay = true; state.liveAiHair = null; state.liveAiHairKey = '';
        render(now); if (overlayArgument) throw new Error('Catalog mesh was shown before AI');
        const raw = [...context.getImageData(900, 600, 1, 1).data];
        if (raw[0] !== 120 || raw[1] !== 154 || raw[2] !== 188) throw new Error('Waiting camera frame was altered');
        state.liveAiHair = merged; state.liveAiHairKey = currentLookKey(); state.liveAiHairGenerating = true;
        render(now); if (overlayArgument) throw new Error('AI hair was displayed during generation');
        state.liveAiHairGenerating = false;
        render(now); if (!overlayArgument) throw new Error('Completed AI hair was not displayed');
        const live = [...context.getImageData(900, 600, 1, 1).data];
        if (live[0] !== 120 || live[1] !== 154 || live[2] !== 188) throw new Error('Live camera was darkened by a cinematic filter');
        state.liveAiHairKey = 'stale-look';
        render(now); if (overlayArgument) throw new Error('Old AI style was displayed after selection change');
      } finally {
        state.active = false; window.MirrorlyAR.update = originalUpdate;
        window.MirrorlyAR.getStatus = originalStatus; window.requestAnimationFrame = originalRaf;
        context.drawImage = originalDraw;
      }
      // Exercise both actual client actions with synthetic frames and a fetch
      // mock. This catches request assembly / timing errors syntax checks miss.
      const savedFetch = window.fetch, savedCapture = captureLivePortrait;
      const savedSegment = window.MirrorlyAR.segmentHair, savedPose = window.MirrorlyAR.getCapturePose;
      const savedMask = window.MirrorlyAR.createCaptureFaceMask;
      const savedStatus = window.MirrorlyAR.getStatus;
      const aiCalls = [];
      let sideRequestsInFlight = 0;
      let maximumSideRequestsInFlight = 0;
      const syntheticResult = createAiUploadDataUrl(edited, 'jpeg');
      try {
        window.fetch = async (url, options) => {
          if (url !== '/api/ai-ar-hair' && url !== '/api/ai-render') throw new Error('Unexpected endpoint in AI client fixture');
          const payload = JSON.parse(options.body); aiCalls.push({ url, payload });
          if (!payload.portrait.startsWith('data:image/png;') || !payload.arPreview.startsWith('data:image/jpeg;') || !payload.styleReference.startsWith('data:image/jpeg;')) throw new Error('Incorrect optimized upload formats');
          if (url === '/api/ai-render' && !payload.viewLabel && (!state.holdCapturedFrame || state.aiResult)) throw new Error('Optional photo did not hold the original capture');
          if (payload.viewLabel === 'left' || payload.viewLabel === 'right') {
            sideRequestsInFlight += 1;
            maximumSideRequestsInFlight = Math.max(maximumSideRequestsInFlight, sideRequestsInFlight);
            await new Promise(resolve => setTimeout(resolve, 15));
            sideRequestsInFlight -= 1;
          }
          return { ok: true, json: async () => ({ image: syntheticResult, timings: { apiMs: 13 } }) };
        };
        captureLivePortrait = () => portrait;
        window.MirrorlyAR.getStatus = () => ({ tracking: true, pose: fixtureCapture.pose });
        window.MirrorlyAR.getCapturePose = () => capturePose;
        window.MirrorlyAR.createCaptureFaceMask = () => captureFaceMask;
        window.MirrorlyAR.segmentHair = async source => source === portrait ? oldMask : newMask;
        state.style = hairstyles.find(style => style.id === 'curtain-bangs'); state.color = colors[2];
        state.arReady = true; state.aiAvailable = true; state.liveAr = true;
        state.demo = false; state.capturedFrame = null; state.liveAiHairGenerating = false;
        await createLiveAiHair();
        if (!state.liveAiHair || state.liveAiHairKey !== currentLookKey() || state.liveAiTimings?.apiMs !== 13) throw new Error('Actual live AI action failed for PNG-only curtain bangs');
        state.liveAr = false; state.captured = true; state.capturedFrame = portrait;
        state.aiResult = null; state.aiRendering = false; state.aiRefreshPending = false;
        await createAiStill();
        if (!state.aiResult || state.aiPhotoTimings?.apiMs !== 13 || state.holdCapturedFrame) throw new Error('Actual optional photo action failed');
        if (aiCalls.length !== 2 || aiCalls[0].url !== '/api/ai-ar-hair' || aiCalls[1].url !== '/api/ai-render') throw new Error('AI action silently made extra requests');
        state.aiResult = null; state.holdCapturedFrame = false; state.captured = false;
        state.salonCaptureActive = true; state.salonCaptureIndex = 3; state.salonResults = [];
        state.salonCaptures = salonViewDefinitions.map((view, index) => ({
          ...view,
          viewId: view.id,
          frame: portrait,
          pose: { ...capturePose, yaw: index === 0 ? 0 : (index === 1 ? .3 : -.3) },
          detection: fixtureCapture.pose,
          thumbnail: syntheticResult
        }));
        await createSalonResults();
        if (state.salonResults.length !== 3 || state.aiResult !== state.salonResults[0]?.image) throw new Error('Guided salon generation did not retain all three results: results=' + state.salonResults.length + ', calls=' + aiCalls.length + ', guide=' + salonCaptureGuide.textContent + ', error=' + state.salonError);
        if (aiCalls.length !== 5 || aiCalls.slice(2).some(call => call.url !== '/api/ai-render')) throw new Error('Guided salon generation did not make exactly three explicit edits');
        if (aiCalls[2].payload.consistencyReference || !aiCalls[3].payload.consistencyReference || !aiCalls[4].payload.consistencyReference) throw new Error('Side views do not reuse the approved front hairstyle');
        if (maximumSideRequestsInFlight !== 2) throw new Error('Side salon views were not generated concurrently after the front result');
        const metrics = window.MirrorlyAiDiagnostics.getMetrics();
        if (JSON.stringify(metrics).includes('data:image') || !Object.values(metrics).every(m => Object.values(m).every(n => Number.isFinite(n) && n >= 0))) throw new Error('AI diagnostics leaked pixels or invalid timing');
      } finally {
        window.fetch = savedFetch; captureLivePortrait = savedCapture;
        window.MirrorlyAR.segmentHair = savedSegment; window.MirrorlyAR.getCapturePose = savedPose;
        window.MirrorlyAR.createCaptureFaceMask = savedMask; window.MirrorlyAR.getStatus = savedStatus;
      }
      window.MirrorlyAR.setEnabled(false);
      if (window.MirrorlyAR.getStatus(now).tracking) throw new Error('Pause still reports tracking');
      window.MirrorlyAR.dispose();
      state.arReady = false; state.liveAr = false; state.liveAiHair = null; state.aiResult = null;
      if (styleGrid.querySelector('.true-3d-badge, em') || [...styleGrid.querySelectorAll('button')].some(b => /AI LIVE|LIVE AR|TRUE 3D/.test(b.textContent))) throw new Error('Hairstyle card badges remain visible');
      await Promise.all([...demoImages.values()].map(image => image.decode()));
      await Promise.all([...hairImages.values()].map(image => image.decode()));
      const review = document.createElement('canvas'); review.width = 1920; review.height = 720;
      const reviewContext = review.getContext('2d');
      const selectedBeforeDemo = state.style;
      state.aiAvailable = false;
      startDemo();
      const cards = [...styleGrid.querySelectorAll('button')];
      const demoCategories = [];
      for (const [index, style] of hairstyles.entries()) {
        cards[index].click();
        const expected = style.category === "Men's styles" ? 'male' : 'female';
        if (getDemoCategory() !== expected || document.querySelector('#previewCanvas').dataset.demoCategory !== expected) throw new Error('Demo did not switch category for ' + style.id);
        const layout = getDemoPhotoLayout(state.capturedFrame);
        if (!layout || layout.image !== demoImages.get(expected) || !state.detection?.mirrored) throw new Error('Demo portrait or measured fit missing');
        const main = document.querySelector('#previewCanvas');
        drawDemoScene(); drawPhotorealisticHair();
        if (['crew-cut', 'buzz-cut', 'skin-fade'].includes(style.id)) {
          for (const eyeX of [0.442, 0.55]) {
            const x = Math.round(main.width * eyeX), y = Math.round(main.height * 0.318);
            const original = state.capturedFrame.getContext('2d').getImageData(x, y, 1, 1).data;
            const shown = main.getContext('2d').getImageData(x, y, 1, 1).data;
            if ([0, 1, 2].some(c => Math.abs(original[c] - shown[c]) > 10)) throw new Error('Short demo hair covers an eye: ' + style.id);
          }
        }
        if (['bob', 'feather', 'crew-cut', 'buzz-cut', 'skin-fade'].includes(style.id)) {
          const x = Math.round(main.width * 0.5), y = Math.round(main.height * (expected === 'male' ? 0.12 : 0.14));
          const original = state.capturedFrame.getContext('2d').getImageData(x, y, 1, 1).data;
          const shown = main.getContext('2d').getImageData(x, y, 1, 1).data;
          if ([0, 1, 2].reduce((sum, c) => sum + Math.abs(original[c] - shown[c]), 0) < 60) throw new Error('Demo scalp remains exposed: ' + style.id);
        }
        reviewContext.drawImage(main, (index % 4) * 480, Math.floor(index / 4) * 360, 480, 360);
        const preview = stylePreviewCanvases.get(style.id);
        if (preview.hidden || !preview.getContext('2d').getImageData(90, 55, 1, 1).data[3]) throw new Error('Category demo card is blank');
        demoCategories.push({ style: style.id, category: expected });
      }
      window.MirrorlyDemoReview = review;
      state.demo = false; state.active = false; state.captured = false;
      const realCapture = document.createElement('canvas'); realCapture.width = 960; realCapture.height = 720;
      state.capturedFrame = realCapture;
      cards[0].click(); cards[4].click();
      if (state.capturedFrame !== realCapture) throw new Error('Selecting a category replaced a real captured portrait');
      state.capturedFrame = null; state.detection = null; state.style = selectedBeforeDemo;
      const gl = canvas.getContext('webgl2');
      const glError = gl?.getError();
      if (glError !== 0) throw new Error('WebGL error ' + glError);
      if (!salonCapturePanel || !salonCaptureButton || !salonGenerateButton
        || typeof beginSalonCapture !== 'function' || typeof createSalonResults !== 'function') {
        throw new Error('Guided three-view salon workflow is unavailable');
      }
      const savedSalonPrepare = window.MirrorlyAR.prepareHairSegmentation;
      const salonLiveBefore = state.liveAr;
      const salonAvailableBefore = state.aiAvailable;
      window.MirrorlyAR.prepareHairSegmentation = async () => true;
      state.liveAr = true;
      state.aiAvailable = true;
      state.salonCaptureActive = false;
      salonCapturePanel.hidden = true;
      await beginSalonCapture();
      if (salonCapturePanel.hidden || !state.salonCaptureActive || state.salonCaptureIndex !== 0
        || salonCaptureTitle.textContent !== 'Capture the front view') {
        throw new Error('Create salon result did not open the guided capture panel');
      }
      cancelSalonCapture();
      window.MirrorlyAR.prepareHairSegmentation = savedSalonPrepare;
      state.liveAr = salonLiveBefore;
      state.aiAvailable = salonAvailableBefore;
      const qualityHair = { data: new Float32Array(1000) };
      qualityHair.data.fill(1, 0, 100);
      const qualityFrame = { width: 1280, height: 720 };
      const baseQualityPose = { yaw: 0, pitch: 0, roll: 0, faceWidth: 300 };
      if (!assessSalonCapture(qualityFrame, baseQualityPose, qualityHair, 0).valid) {
        throw new Error('Valid front salon capture was rejected');
      }
      if (assessSalonCapture(qualityFrame, { ...baseQualityPose, yaw: .35 }, qualityHair, 0).valid) {
        throw new Error('Turned face passed the front salon capture gate');
      }
      const previousSideSign = state.salonSideSign;
      state.salonSideSign = 1;
      if (!assessSalonCapture(qualityFrame, { ...baseQualityPose, yaw: -.3 }, qualityHair, 2).valid) {
        throw new Error('Valid opposite-side salon capture was rejected');
      }
      state.salonSideSign = previousSideSign;
      const previousAiAvailable = state.aiAvailable;
      state.aiAvailable = previousAiAvailable;
      updateLiveAiHairButton();
      return { passed: true, checks, glError, occluder: stale.metrics.occluder, modelFallback: true, layeredFallback: true, ghostPixels: 0,
        aiTextureOrientation: true, transparentHairOnly: true, protectedFaceFeatures: true, foregroundMask: true, aiOnlyPreview: true,
        foreheadContour: true, longHairExtent: true, croppedEdgeFade: true, repairMotionFade: true,
        liveCameraUnshaded: true, canonicalVertices: canonicalPoints.length, styleMasks,
        segmenterWarmup: true, fullFrameUploads: true, liveAndPhotoActions: true,
        numericAiTimings: true, referencePngBytes, referenceJpegBytes,
        demoCategories, cardBadgesRemoved: true, demoHeadFit: true, realCapturePreserved: true,
        guidedSalonCapture: true, salonButtonOpens: true, parallelSalonSides: true };
    })()`
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  assert.equal(result.result?.value?.passed, true);
  if (process.env.MIRRORLY_DEMO_REVIEW === '1') {
    const demo = await send('Runtime.evaluate', { expression: 'window.MirrorlyDemoReview.toDataURL("image/png")', returnByValue: true });
    const previewDir = fs.mkdtempSync(path.join(root, '.edge-demo-review-'));
    const previewFile = path.join(previewDir, 'demo-review.png');
    fs.writeFileSync(previewFile, Buffer.from(demo.result.value.split(',')[1], 'base64'));
    console.log('Demo review: ' + previewFile);
  }
  console.log(JSON.stringify(result.result.value, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const request of pending.values()) clearTimeout(request.timeout);
  if (socket?.readyState === WebSocket.OPEN) {
    await send('Browser.close').catch(() => {});
    socket.close();
  }
  browser.kill();
  // Only remove the test's own verified temporary profile, never a user profile.
  if (path.dirname(profile) === root && path.basename(profile).startsWith('.edge-accuracy-')) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await delay(200); }
    }
  }
});
