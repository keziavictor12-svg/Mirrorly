// Real-webcam Snap check (manual: node tests/snap-webcam-probe.cjs, server running).
// Opens Mirrorly in a separate, visible Edge profile with the real webcam auto-granted,
// lets live AR auto-start (never clicks liveArButton: it toggles to Pause), then
// writes MirrorlySnap.getStatus(), app flags and console errors to
// %TEMP%\mirrorly-snap-webcam.json, plus a screenshot (the customer's face) to
// %TEMP%\mirrorly-snap-webcam.png. Both stay local; delete the PNG after viewing.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-snapdiag-'));
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser = spawn(edge, ['--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--use-fake-ui-for-media-stream',
  '--window-size=1400,1000', `--user-data-dir=${profile}`, 'http://localhost:4173/?v=diag'], { stdio: 'ignore' });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let socket, id = 0; const pending = new Map(); const logs = [];
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); socket.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
(async () => {
  const portFile = path.join(profile, 'DevToolsActivePort');
  while (!fs.existsSync(portFile)) await delay(150);
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  let page; while (!page) { const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); page = pages.find((p) => p.type === 'page' && p.url.startsWith('http://localhost:4173/')); if (!page) await delay(150); }
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => { socket.onopen = r; });
  socket.onmessage = (e) => { const m = JSON.parse(e.data);
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
    if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400));
    const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } };
  await send('Runtime.enable');
  while (!(await ev("document.readyState==='complete' && !!window.MirrorlySnap"))) await delay(200);
  await ev("document.getElementById('startCameraButton').click()");
  for (let i = 0; i < 40 && !(await ev("!document.getElementById('liveArButton').disabled")); i++) await delay(500);
  const liveDisabled = await ev("document.getElementById('liveArButton').disabled");
  
  await delay(20000);
  const out = await ev(`({ liveArButtonWasDisabled: ${liveDisabled}, snap: window.MirrorlySnap.getStatus(), hint: document.querySelector('.tracking-hint, #trackingHint')?.textContent,
    aiButtonHidden: [...document.querySelectorAll('button')].find(b => /AI hair/.test(b.textContent))?.hidden,
    snapCanvas: !!document.querySelector('.snap-live-canvas'), snapCanvasHidden: document.querySelector('.snap-live-canvas')?.hidden })`);
  out.flags = await ev("({active: state.active, liveAr: state.liveAr, demo: state.demo, captured: state.captured, salon: state.salonCaptureActive, overlay: state.showOverlay, stream: !!video.srcObject, allowed: snapLookAllowed(), style: state.style?.id, color: state.color?.name})");
  out.manual = await ev("Promise.race([syncSnapLook().then(r => ({returned: r})), new Promise(r => setTimeout(() => r({timedOut: true}), 10000))]).then(x => ({...x, status: window.MirrorlySnap.getStatus()}))");
  await delay(3000);
  out.after3s = await ev("({ visible: window.MirrorlySnap.getStatus().visible, canvasHidden: document.querySelector('.snap-live-canvas')?.hidden })");
  fs.writeFileSync(path.join(os.tmpdir(), "mirrorly-snap-webcam.json"), JSON.stringify({ ...out, logs }, null, 2));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(os.tmpdir(), 'mirrorly-snap-webcam.png'), Buffer.from(shot.data, 'base64'));
  browser.kill(); process.exit(0);
})().catch((e) => { console.error(e); browser.kill(); process.exit(1); });


