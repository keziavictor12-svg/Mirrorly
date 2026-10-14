// Live Snap Camera Kit check (manual: npm run test:snap). Unlike the regular
// suite this contacts Snap with the token from .env.local. The "camera" is the
// bundled fictional demo portrait streamed at 30 fps, so face and hair lenses
// have a real head to work on. No customer camera or images are used.
// (Edge's --use-fake-device webcam ends after ~2 s and has no face.)
// Prints lens ids/names and saves a screenshot path; never prints the token.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(root, '.edge-snap-'));
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert.ok(edge, 'Edge is required');
const browser = spawn(edge, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
  '--window-size=1400,1000',
  `--user-data-dir=${profile}`, 'http://localhost:4173/?snapProbe&portrait=' + (process.argv[2] || 'female')], { windowsHide: true, stdio: 'ignore' });
const pending = new Map();
let socket;
let id = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = Date.now() + 90000;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const messageId = ++id;
    const timeout = setTimeout(() => { pending.delete(messageId); reject(new Error(`${method} timed out`)); }, 60000);
    pending.set(messageId, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
}

async function main() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  while (!fs.existsSync(portFile)) { assert.ok(Date.now() < deadline, 'Edge did not start'); await delay(150); }
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
  while (!(await send('Runtime.evaluate', { expression: "document.readyState === 'complete' && !!window.MirrorlySnap", returnByValue: true })).result.value) {
    assert.ok(Date.now() < deadline, 'Mirrorly scripts did not load');
    await delay(100);
  }
  const evaluation = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const report = { steps: [] };
      try {
        const config = await window.MirrorlySnap.loadConfig();
        report.configured = config.available;
        if (!config.available) return { ...report, error: 'Snap not configured: ' + config.missing.join(', ') };
        const portrait = new Image();
        portrait.src = 'assets/demo/' + (new URLSearchParams(location.search).get('portrait') || 'female') + '-demo.png';
        await portrait.decode();
        const feed = document.createElement('canvas');
        feed.width = 1280; feed.height = 720;
        const feedContext = feed.getContext('2d');
        const drawFeed = () => {
          // Cover-fit the portrait into a 16:9 webcam frame (pre-mirrored so the
          // mirrored preview shows it the right way round).
          const scale = Math.max(feed.width / portrait.naturalWidth, feed.height / portrait.naturalHeight);
          const w = portrait.naturalWidth * scale, h = portrait.naturalHeight * scale;
          feedContext.setTransform(-1, 0, 0, 1, feed.width, 0);
          feedContext.drawImage(portrait, (feed.width - w) / 2, (feed.height - h) / 2, w, h);
        };
        drawFeed();
        setInterval(drawFeed, 33);
        const stream = feed.captureStream(30);
        report.steps.push('demo portrait feed ready (' + portrait.naturalWidth + 'x' + portrait.naturalHeight + ')');
        const card = document.querySelector('.preview-card');
        // Same hex values as app.js, so the lenses use their tuned colours.
        const copper = { name: 'Copper', value: '#ad5b37' };
        window.__probe = { stream, card };
        // Fail with the stalled Camera Kit step instead of a bare CDP timeout.
        const showLook = window.MirrorlySnap.showLook;
        window.MirrorlySnap.showLook = (...args) => Promise.race([showLook(...args), new Promise((_, reject) =>
          setTimeout(() => reject(new Error('showLook stalled at step ' + window.MirrorlySnap.getStatus().step)), 40000))]);
        // First call bootstraps Camera Kit and loads the lens groups.
        await window.MirrorlySnap.showLook(stream, card, { id: 'bob' }, copper);
        report.lenses = window.MirrorlySnap.getLenses();
        report.lensCount = report.lenses.length;
        report.status = window.MirrorlySnap.getStatus();
        report.steps.push('lens groups loaded: ' + report.lenses.length);
        if (!report.lenses.length) return { ...report, error: report.status.error || 'No lenses in the configured group' };
        // Use the configured lens for this style, or map the first lens to it.
        if (!window.MirrorlySnap.findLens(report.lenses, config.lensMap, 'bob', 'Copper')) {
          config.lensMap = { ...config.lensMap, bob: report.lenses[0].id };
        }
        report.shown = await window.MirrorlySnap.showLook(stream, card, { id: 'bob' }, copper);
        report.applied = window.MirrorlySnap.findLens(report.lenses, config.lensMap, 'bob', 'Copper')?.name;
        report.steps.push('applied lens: ' + report.applied + ' -> shown=' + report.shown);
        await new Promise((resolve) => setTimeout(resolve, 6000));
        report.streamStillActive = stream.active;
        const live = window.MirrorlySnap.getCanvas();
        report.canvas = live ? { width: live.width, height: live.height } : null;
        report.status = window.MirrorlySnap.getStatus();
      } catch (error) {
        report.error = (error && (error.name + ': ' + error.message)) || String(error);
      }
      return report;
    })()`
  });
  const report = evaluation.result.value || { error: evaluation.exceptionDetails?.text };
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const shotPath = path.join(os.tmpdir(), 'mirrorly-snap-probe.png');
  fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  report.screenshot = shotPath;
  if (report.shown) {
    // Switch colour on the same lens: the lens must restart and read the new hairColor.
    const switched = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const { stream, card } = window.__probe;
        const shown = await window.MirrorlySnap.showLook(stream, card, { id: 'bob' }, { name: 'Golden Blonde', value: '#cba669' });
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return { shown, step: window.MirrorlySnap.getStatus().step };
      })()`
    });
    report.colourSwitch = switched.result.value;
    const blondeShot = await send('Page.captureScreenshot', { format: 'png' });
    report.colourSwitch.screenshot = path.join(os.tmpdir(), 'mirrorly-snap-probe-blonde.png');
    fs.writeFileSync(report.colourSwitch.screenshot, Buffer.from(blondeShot.data, 'base64'));
  }
  const { lenses, status, ...summary } = report;
  const lensNames = (lenses || []).map((lens) => lens.name);
  console.log(JSON.stringify({ ...summary, lensNames, visible: status?.visible, error: report.error || status?.error || null }, null, 2));
  if (report.error || !report.shown) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try { socket?.close(); } catch {}
  browser.kill();
  await delay(500);
  // Edge can hold profile files briefly after exit; retry, and never fail the check on cleanup.
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch (error) {
    console.warn('Could not remove ' + profile + ': ' + error.code);
  }
});
