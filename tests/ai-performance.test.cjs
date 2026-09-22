const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Readable } = require('node:stream');

// Exercise real endpoint preparation with a mocked HTTP server and API fetch.
// No stored key, webcam portrait, external network or paid generation is used.
function loadServer(apiAvailable = true) {
  const calls = [];
  const context = {
    require: name => name === 'node:http'
      ? { createServer: () => ({ listen() {} }) }
      : (name.startsWith('./') ? require(path.resolve(__dirname, '..', name)) : require(name)),
    __dirname: path.resolve(__dirname, '..'), Buffer, FormData, Blob, AbortSignal, performance,
    process: { env: apiAvailable ? { OPENAI_API_KEY: 'synthetic-test-only' } : {} },
    console: { log() {}, error() {} },
    fetch: async (url, options) => {
      calls.push({ url, form: options.body });
      return { ok: true, json: async () => ({ data: [{ b64_json: 'c3ludGhldGlj' }] }) };
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8')
    + '\nglobalThis.hooks = { chooseAiOutputSize, renderAiHairstyle, renderLiveAiHairLayer };', context);
  return { hooks: context.hooks, calls };
}

function png(width, height) {
  const bytes = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  return 'data:image/png;base64,' + bytes.toString('base64');
}

function body(legacyReferences = false) {
  const reference = legacyReferences ? png(768, 768) : 'data:image/jpeg;base64,/9j/2Q==';
  return { portrait: png(1280, 720), editMask: png(1280, 720), arPreview: reference,
    styleReference: reference, styleId: 'curtain-bangs', colorName: 'Chestnut Brown' };
}

async function invoke(handler, data) {
  const request = Readable.from([Buffer.from(JSON.stringify(data))]);
  const response = {
    writeHead(status, headers) { this.status = status; this.headers = headers; return this; },
    end(text) { this.payload = JSON.parse(text); }
  };
  await handler(request, response);
  return response;
}

test('AI output area is bounded, valid and aspect-preserving across webcam sizes', () => {
  const { hooks } = loadServer();
  for (const [width, height] of [[640, 480], [1280, 720], [1920, 1080], [3840, 2160], [1080, 1920], [1024, 1024], [300, 100]]) {
    const [w, h] = hooks.chooseAiOutputSize(width, height).split('x').map(Number);
    assert.equal(w % 16, 0); assert.equal(h % 16, 0);
    assert.ok(w * h >= 655360 && w * h <= 700000, 'unexpected output pixel area');
    assert.ok(Math.max(w, h) <= 3840);
    assert.ok(Math.abs((w / h) / (width / height) - 1) < 0.035, 'frame aspect ratio changed');
  }
  assert.equal(hooks.chooseAiOutputSize(1280, 720), '1088x608');
  for (const dimensions of [[0, 720], [1280, -1], [NaN, 100], [1280.5, 720], [4000, 100]]) {
    assert.throws(() => hooks.chooseAiOutputSize(...dimensions));
  }
});

for (const endpoint of ['renderAiHairstyle', 'renderLiveAiHairLayer']) {
  test(endpoint + ' retains all three inputs, medium quality and compressed JPEG output', async () => {
    const { hooks, calls } = loadServer();
    const response = await invoke(hooks[endpoint], body());
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.openai.com/v1/images/edits');
    const form = calls[0].form;
    assert.equal(form.get('model'), 'gpt-image-2');
    assert.equal(form.get('quality'), 'medium');
    assert.equal(form.get('size'), '1088x608');
    assert.equal(form.get('output_format'), 'jpeg');
    assert.equal(form.get('output_compression'), '90');
    const images = form.getAll('image[]');
    assert.equal(images.length, 3);
    assert.deepEqual(images.map(image => image.type), ['image/png', 'image/jpeg', 'image/jpeg']);
    assert.ok(images[1].name.endsWith('.jpg'));
    if (endpoint === 'renderLiveAiHairLayer') {
      assert.equal(form.get('mask').type, 'image/png');
      assert.match(images[1].name, /^synthetic-placement-geometry-guide\./);
      assert.match(images[2].name, /^synthetic-cut-shape-guide\./);
      const prompt = form.get('prompt');
      assert.match(prompt, /synthetic geometry guides only/);
      assert.match(prompt, /real human hair photographed by the same webcam/);
      assert.match(prompt, /must not look like CGI, a 3D render/);
      assert.match(prompt, /exact original coordinate system/);
    }
    assert.ok(response.payload.image.startsWith('data:image/jpeg;base64,'));
    assert.equal(response.payload.outputSize, '1088x608');
    assert.deepEqual(Object.keys(response.payload.timings).sort(), ['apiMs', 'preparationMs', 'totalMs']);
    assert.ok(Object.values(response.payload.timings).every(n => Number.isFinite(n) && n >= 0));
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(JSON.stringify(response.payload).includes('synthetic-test-only'), false);
  });

  test(endpoint + ' accepts older PNG references without a second API request', async () => {
    const { hooks, calls } = loadServer();
    const response = await invoke(hooks[endpoint], body(true));
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].form.getAll('image[]').every(image => image.type === 'image/png'));
  });

  test(endpoint + ' does not call the API for invalid style, references or missing credentials', async () => {
    const { hooks, calls } = loadServer();
    assert.equal((await invoke(hooks[endpoint], { ...body(), styleId: 'unsupported' })).status, 400);
    assert.equal((await invoke(hooks[endpoint], { ...body(), arPreview: 'not-an-image' })).status, 500);
    assert.equal(calls.length, 0);
    const unavailable = loadServer(false);
    assert.equal((await invoke(unavailable.hooks[endpoint], body())).status, 503);
    assert.equal(unavailable.calls.length, 0);
  });
}

test('live edit mask must match the PNG portrait dimensions before any paid request', async () => {
  const { hooks, calls } = loadServer();
  const response = await invoke(hooks.renderLiveAiHairLayer, { ...body(), editMask: png(640, 480) });
  assert.equal(response.status, 500);
  assert.equal(calls.length, 0);
  assert.match(response.payload.error, /match the portrait dimensions/);
});
