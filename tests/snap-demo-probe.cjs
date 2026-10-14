// Live Snap check of demo mode (manual: node tests/snap-demo-probe.cjs, server
// running). Clicks "Try demo mode" and checks that the Snap lens renders on the
// fictional demo portrait with the preview note, then switches to a men's cut.
// Contacts Snap with the .env.local token; never prints it. Screenshots go to %TEMP%.
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
  '--window-size=1400,1000', `--user-data-dir=${profile}`, 'http://localhost:4173/?snapDemoProbe'], { windowsHide: true, stdio: 'ignore' });
const pending = new Map();
let socket;
let id = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = Date.now() + 120000;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const messageId = ++id;
    const timeout = setTimeout(() => { pending.delete(messageId); reject(new Error(`${method} timed out`)); }, 60000);
    pending.set(messageId, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
}

const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

async function waitForLens(label) {
  // Waits for a Snap step to settle on "shown" (or fail), up to 45 s.
  const until = Date.now() + 45000;
  let status;
  while (Date.now() < until) {
    status = await ev('window.MirrorlySnap.getStatus()');
    if (status.visible && status.step === 'shown') break;
    await delay(500);
  }
  await delay(4000);
  const shot = path.join(os.tmpdir(), `mirrorly-snap-demo-${label}.png`);
  fs.writeFileSync(shot, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  return {
    visible: status.visible, step: status.step, error: status.error || null,
    note: await ev("(() => { const n = document.querySelector('#snapPreviewNote'); return n.hidden ? null : n.textContent; })()"),
    look: await ev("document.querySelector('#selectedLookLabel').textContent"),
    screenshot: shot
  };
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
  while (!(await ev("document.readyState === 'complete' && !!window.MirrorlySnap"))) {
    assert.ok(Date.now() < deadline, 'Mirrorly scripts did not load');
    await delay(100);
  }
  await ev("document.querySelector('#demoButton').click()");
  const report = { women: await waitForLens('women') };
  await ev("[...document.querySelectorAll('#styleGrid button')].find((b) => /crew/i.test(b.textContent)).click()");
  report.men = await waitForLens('men');
  console.log(JSON.stringify(report, null, 2));
  if (!report.women.visible || !report.men.visible || !report.women.note) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try { socket?.close(); } catch {}
  browser.kill();
  await delay(500);
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch (error) {
    console.warn('Could not remove ' + profile + ': ' + error.code);
  }
});
