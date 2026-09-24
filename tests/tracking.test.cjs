const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const THREE = require('three');
const tracking = require('../public/tracking.js');
const canonicalFixture = require('./fixtures/mediapipe-canonical-points.json');

function fixture({ yaw = 0, pitch = 0, roll = 0, scale = 12, tx = 620, ty = 350, width = 1280, height = 720 } = {}) {
  const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
  const matrix = rotation.clone().setPosition(1.2, -0.3, -50).toArray();
  const e = rotation.elements;
  const r = [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
  const landmarks = Array.from({ length: 478 }, () => ({ x: tx / width, y: ty / height, z: 0 }));
  for (const [index, point] of canonicalFixture.points.entries()) {
    const p = tracking.transform(r, point);
    landmarks[index] = { x: (tx + p[0] * scale) / width, y: (ty - p[1] * scale) / height, z: -p[2] * scale / width };
  }
  const origin = tracking.transform(r, tracking.headOrigin);
  return {
    landmarks, matrix: { data: matrix }, width, height,
    expected: { x: width - tx - scale * origin[0], y: ty - scale * origin[1], faceWidth: scale * tracking.faceWidthCm, r }
  };
}

test('canonical pose fitting preserves head scale across yaw, pitch, and roll', () => {
  for (const yaw of [-1.05, -0.6, 0, 0.6, 1.05]) {
    for (const pitch of [-0.4, 0, 0.4]) {
      for (const roll of [-0.5, 0, 0.5]) {
        const f = fixture({ yaw, pitch, roll });
        const pose = tracking.fitFace(f.landmarks, f.width, f.height, f.matrix);
        assert.ok(pose, `missing pose: ${yaw}/${pitch}/${roll}`);
        for (const key of ['x', 'y', 'faceWidth']) assert.ok(Math.abs(pose[key] - f.expected[key]) < 1e-7, `${key} drift`);
        assert.ok(pose.fitErrorPx < 1e-7);
        const expectedQ = tracking.quaternionFromRotation(tracking.screenRotation(f.expected.r));
        assert.ok(Math.abs(pose.quaternion.reduce((sum, v, i) => sum + v * expectedQ[i], 0)) > 0.999999);
      }
    }
  }
});

test('fitting uses pixel aspect ratio consistently at different resolutions', () => {
  for (const [width, height] of [[640, 480], [1280, 720], [720, 1280]]) {
    const f = fixture({ width, height, tx: width / 2, ty: height / 2, scale: 10, yaw: 0.4 });
    const pose = tracking.fitFace(f.landmarks, width, height, f.matrix);
    assert.ok(Math.abs(pose.faceWidth - f.expected.faceWidth) < 1e-7);
  }
});

test('robust fit resists a single badly localized temple landmark', () => {
  const f = fixture({ yaw: 0.4 });
  f.landmarks[234].x += 30 / f.width;
  f.landmarks[234].y -= 20 / f.height;
  const pose = tracking.fitFace(f.landmarks, f.width, f.height, f.matrix);
  assert.ok(pose);
  assert.ok(Math.abs(pose.faceWidth / f.expected.faceWidth - 1) < 0.015);
  assert.ok(Math.hypot(pose.x - f.expected.x, pose.y - f.expected.y) < 2);
});

test('column-major and row-major affine matrix layouts produce the same pose', () => {
  const f = fixture({ yaw: 0.4, pitch: -0.2, roll: 0.25 });
  const row = new THREE.Matrix4().fromArray(f.matrix.data).transpose().toArray();
  assert.deepEqual(tracking.rotationFromMatrix(f.matrix), tracking.rotationFromMatrix({ data: row, layout: 'row-major' }));
});

test('invalid and collapsed landmarks do not enter the renderer', () => {
  const f = fixture();
  f.landmarks[100].z = NaN;
  assert.equal(tracking.fitFace(f.landmarks, f.width, f.height, f.matrix), null);
  assert.equal(tracking.fitFace([], 640, 480, f.matrix), null);
  const collapsed = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  assert.equal(tracking.fitFace(collapsed, 640, 480, f.matrix), null);
});

test('matrix-free fallback recovers the measured 3D head orientation', () => {
  const f = fixture({ yaw: 0.4, pitch: 0.15, roll: -0.2 });
  const pose = tracking.fitFace(f.landmarks, f.width, f.height, null);
  assert.ok(pose && !pose.usedMatrix);
  assert.ok(Math.abs(pose.faceWidth / f.expected.faceWidth - 1) < 0.015);
});

test('time-based position filtering reduces static jitter while retaining movement', () => {
  const filter = new tracking.OneEuroFilter(2.5, 0.14);
  const values = [];
  for (let i = 0; i < 90; i += 1) values.push(filter.filter(400 + (i % 2 ? 2 : -2), i * 1000 / 30));
  const rms = Math.sqrt(values.slice(30).reduce((sum, v) => sum + (v - 400) ** 2, 0) / 60);
  assert.ok(rms < 1.2, `static jitter ${rms}`);
  const moving = filter.filter(460, 3000);
  assert.ok(moving > 448, `movement lags: ${moving}`);
});

test('pose filters are display-independent and quaternion-sign safe', () => {
  const f = fixture();
  const pose = tracking.fitFace(f.landmarks, f.width, f.height, f.matrix);
  const filter = new tracking.PoseFilter();
  filter.filter(pose, 0);
  const next = filter.filter({ ...pose, quaternion: pose.quaternion.map((v) => -v) }, 33);
  assert.ok(Math.abs(next.quaternion.reduce((sum, v, i) => sum + v * pose.quaternion[i], 0)) > 0.999999);
  const run = (fps) => {
    const p = new tracking.OneEuroFilter(2.5, 0.14);
    let last;
    for (let frame = 0; frame <= fps; frame += 1) last = p.filter(100 + frame / fps * 100, frame / fps * 1000);
    return last;
  };
  assert.ok(Math.abs(run(30) - run(60)) < 2);
  filter.reset();
  assert.equal(filter.filter({ ...pose, x: 50 }, 5000).x, 50);
});

test('tracking never starts fresh before detection and expires without ghost hair', () => {
  assert.deepEqual(tracking.trackingAge(20, null), { tracking: false, opacity: 0 });
  assert.equal(tracking.trackingAge(120, 0).opacity, 1);
  assert.equal(tracking.trackingAge(170, 0).opacity, 0.5);
  assert.deepEqual(tracking.trackingAge(221, 0), { tracking: false, opacity: 0 });
  const context = { window: {}, performance: { now: () => 0 } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/ar.js'), 'utf8'), context);
  assert.equal(context.window.MirrorlyAR.getStatus().tracking, false);
});

test('all catalog styles have genuine GLB meshes and valid calibration', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const start = source.indexOf('const hairstyles = ');
  const end = source.indexOf('const pngPreferredLiveStyles', start);
  const context = {};
  vm.runInNewContext(source.slice(start, end) + '\nglobalThis.catalog = hairstyles;', context);
  assert.equal(context.catalog.length, 8);
  for (const style of context.catalog) {
    assert.ok(style.model3d.canonicalFaceWidth > 1 && style.model3d.anchor.every(Number.isFinite));
    const buffer = fs.readFileSync(path.join(__dirname, '../public', style.model3d.src));
    assert.equal(buffer.readUInt32LE(0), 0x46546c67);
    assert.equal(buffer.readUInt32LE(4), 2);
    const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
    assert.ok(gltf.meshes?.length);
    assert.ok(gltf.meshes.some((mesh) => mesh.primitives.some((p) => gltf.accessors[p.attributes.POSITION].count > 100)));
  }
});

test('AI capture crop round-trips without double rotation or aspect distortion', () => {
  for (const yaw of [-0.3, 0, 0.3]) {
    for (const roll of [-0.15, 0, 0.15]) {
      const f = fixture({ yaw, pitch: 0.12, roll });
      const pose = tracking.fitFace(f.landmarks, f.width, f.height, f.matrix);
      const attachment = {
        crop: { x: 487, y: 112, width: 329, height: 447 },
        headX: pose.x, headY: pose.y, faceWidth: pose.faceWidth,
        quaternion: pose.quaternion, depth: 72
      };
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.31, 0.62]]) {
        const point = tracking.capturePointToHead(attachment, u, v);
        const projected = tracking.projectHeadPoint(point, pose);
        assert.ok(Math.abs(projected[0] - (487 + 329 * u)) < 1e-8);
        assert.ok(Math.abs(projected[1] - (112 + 447 * v)) < 1e-8);
        const scaled = tracking.projectHeadPoint(point, { ...pose, x: pose.x + 60, y: pose.y - 20, faceWidth: pose.faceWidth * 1.4 });
        assert.ok(Math.abs(scaled[0] - (pose.x + 60 + (projected[0] - pose.x) * 1.4)) < 1e-8);
      }
    }
  }
});

test('AI attachment rotates offsets about the head origin, not crop center', () => {
  const attachment = {
    crop: { x: 520, y: 120, width: 240, height: 420 },
    headX: 600, headY: 350, faceWidth: 200, depth: 80, quaternion: [0, 0, 0, 1]
  };
  const point = tracking.capturePointToHead(attachment, 0.5, 0.5);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5).toArray();
  const projected = tracking.projectHeadPoint(point, { x: 600, y: 350, faceWidth: 200, quaternion: q });
  assert.ok(Math.abs(projected[0] - (600 + 40 * Math.cos(0.5) + 80 * Math.sin(0.5))) < 1e-8);
});

test('measured temple depths curve the AI strip while preserving capture pixels', () => {
  const attachment = {
    crop: { x: 500, y: 130, width: 200, height: 420 },
    headX: 600, headY: 350, faceWidth: 200, depth: 80, quaternion: [0, 0, 0, 1],
    depthSamples: [{ x: 500, depth: 0 }, { x: 600, depth: 80 }, { x: 700, depth: 0 }]
  };
  const pose = { x: 600, y: 350, faceWidth: 200, quaternion: [0, 0, 0, 1] };
  for (const [u, expectedDepth] of [[0, 0], [0.5, 80], [1, 0]]) {
    const p = tracking.projectHeadPoint(tracking.capturePointToHead(attachment, u, 0.3), pose);
    assert.ok(Math.abs(p[0] - (500 + u * 200)) < 1e-8);
    assert.ok(Math.abs(p[2] - expectedDepth) < 1e-8);
  }
});

test('AI attachment uses gentle scalp curvature without rigid warping', () => {
  const attachment = {
    crop: { x: 500, y: 130, width: 200, height: 420 },
    headX: 600, headY: 350, faceWidth: 200, depth: 80, depthStrength: 0.20,
    quaternion: [0, 0, 0, 1],
    depthSamples: [{ x: 500, depth: 0 }, { x: 600, depth: 80 }, { x: 700, depth: 0 }]
  };
  const pose = { x: 600, y: 350, faceWidth: 200, quaternion: [0, 0, 0, 1] };
  const edge = tracking.projectHeadPoint(tracking.capturePointToHead(attachment, 0, 0.3), pose);
  const crown = tracking.projectHeadPoint(tracking.capturePointToHead(attachment, 0.5, 0.3), pose);
  assert.ok(Math.abs(edge[2] - 64) < 1e-8);
  assert.ok(Math.abs(crown[2] - 80) < 1e-8);
});

test('customer live preview never shows catalog hair or a pending/stale AI result', () => {
  const ready = { liveAr: true, showOverlay: true, liveAiHairGenerating: false, liveAiHair: {}, liveAiHairKey: 'bob:brown' };
  assert.equal(tracking.shouldDisplayAiHair(ready, 'bob:brown'), true);
  for (const changes of [{ liveAr: false }, { showOverlay: false }, { liveAiHairGenerating: true }, { liveAiHair: null }, { liveAiHairKey: 'feather:black' }]) {
    assert.equal(tracking.shouldDisplayAiHair({ ...ready, ...changes }, 'bob:brown'), false);
  }
});

test('single-view AI hair hides at large turns without hiding pure roll', () => {
  const attachment = { quaternion: [0, 0, 0, 1] };
  const pose = (axis, angle) => ({ quaternion: new THREE.Quaternion().setFromAxisAngle(axis, angle).toArray() });
  assert.equal(tracking.aiViewOpacity(pose(new THREE.Vector3(0, 1, 0), 0), attachment), 1);
  assert.equal(tracking.aiViewOpacity(pose(new THREE.Vector3(0, 1, 0), 0.9), attachment), 0);
  assert.equal(tracking.aiViewOpacity(pose(new THREE.Vector3(0, 0, 1), 0.9), attachment), 1);
});

test('AI hair stays stable through small turns and fades before side distortion', () => {
  const attachment = { quaternion: [0, 0, 0, 1], viewFadeStart: 14 * Math.PI / 180, viewFadeEnd: 22 * Math.PI / 180 };
  const pose = (degrees) => ({ quaternion: new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0), degrees * Math.PI / 180).toArray() });
  assert.equal(tracking.aiViewOpacity(pose(12), attachment), 1);
  assert.ok(tracking.aiViewOpacity(pose(18), attachment) > 0 && tracking.aiViewOpacity(pose(18), attachment) < 1);
  assert.equal(tracking.aiViewOpacity(pose(23), attachment), 0);
});

test('AI matte fills small crown gaps without filling the face or outer silhouette', () => {
  const mask = { width: 20, height: 24, data: new Float32Array(20 * 24) };
  for (let y = 2; y < 22; y++) for (let x = 2; x < 18; x++) mask.data[y * 20 + x] = 1;
  mask.data[5 * 20 + 10] = 0;
  for (let y = 11; y < 20; y++) for (let x = 6; x < 14; x++) mask.data[y * 20 + x] = 0;
  mask.data[15 * 20 + 3] = 0;
  const fixed = tracking.fillHairMatteHoles(mask, 8, 10);
  assert.equal(fixed.data[5 * 20 + 10], 1);
  assert.equal(fixed.data[14 * 20 + 10], 0);
  assert.equal(fixed.data[15 * 20 + 3], 0);
  assert.equal(fixed.data[0], 0);
  assert.equal(mask.data[5 * 20 + 10], 0, 'source mask was mutated');
});

test('frozen background repairs fade on tilt, translation and scale without hiding hair', () => {
  const attachment = { headX: 600, headY: 350, faceWidth: 200, quaternion: [0, 0, 0, 1] };
  const pose = { x: 600, y: 350, faceWidth: 200, quaternion: [0, 0, 0, 1] };
  assert.equal(tracking.backgroundRepairOpacity(pose, attachment), 1);
  assert.equal(tracking.backgroundRepairOpacity({ ...pose, quaternion: [0, 0, 0, -1] }, attachment), 1);
  for (const axis of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)]) {
    const tilted = { ...pose, quaternion: new THREE.Quaternion().setFromAxisAngle(axis, 0.25).toArray() };
    assert.equal(tracking.backgroundRepairOpacity(tilted, attachment), 0);
    assert.equal(tracking.aiViewOpacity(tilted, attachment), 1, 'usable hair was hidden with the repair');
  }
  assert.equal(tracking.backgroundRepairOpacity({ ...pose, x: 630 }, attachment), 0);
  assert.equal(tracking.backgroundRepairOpacity({ ...pose, faceWidth: 230 }, attachment), 0);
  const fading = tracking.backgroundRepairOpacity({ ...pose, x: 614.5 }, attachment);
  assert.ok(Math.abs(fading - 0.5) < 1e-8, 'repair does not fade smoothly');
});

test('realism-first frozen repair disappears before the photographic hair layer', () => {
  const attachment = {
    headX: 600, headY: 350, faceWidth: 200, quaternion: [0, 0, 0, 1],
    viewFadeStart: 14 * Math.PI / 180, viewFadeEnd: 22 * Math.PI / 180,
    repairTravelStart: 0.015, repairTravelEnd: 0.08,
    repairZoomStart: 0.018, repairZoomEnd: 0.08,
    repairAngleStart: 0.03, repairAngleEnd: 0.14
  };
  const turned = { x: 600, y: 350, faceWidth: 200, quaternion: new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0), 0.15).toArray() };
  assert.equal(tracking.backgroundRepairOpacity(turned, attachment), 0);
  assert.equal(tracking.aiViewOpacity(turned, attachment), 1);
});

test('head-connected hair keeps long tails and excludes unrelated background hair', () => {
  const mask = { width: 30, height: 60, data: new Float32Array(30 * 60) };
  for (let y = 5; y < 60; y++) for (let x = 14; x < 17; x++) mask.data[y * 30 + x] = 0.9;
  for (let y = 20; y < 30; y++) for (let x = 2; x < 5; x++) mask.data[y * 30 + x] = 1;
  const selected = tracking.selectHeadHair(mask, { left: 10, right: 20, top: 4, bottom: 12 });
  assert.ok(selected.data[59 * 30 + 15] > 0.89, 'tail was clipped below seed rectangle');
  assert.equal(selected.data[25 * 30 + 3], 0, 'background component was retained');
});

test('head selection retains connected low-confidence edge wisps', () => {
  const mask = { width: 18, height: 18, data: new Float32Array(18 * 18) };
  for (let y = 4; y < 14; y++) for (let x = 7; x < 11; x++) mask.data[y * 18 + x] = 0.9;
  mask.data[6 * 18 + 6] = 0.06;
  mask.data[5 * 18 + 6] = 0.06;
  mask.data[5 * 18 + 5] = 0.06;
  mask.data[14 * 18 + 16] = 0.06;
  const selected = tracking.selectHeadHair(mask, { left: 6, right: 12, top: 3, bottom: 9 });
  assert.ok(selected.data[5 * 18 + 5] > 0.05, 'connected edge wisp was discarded');
  assert.equal(selected.data[14 * 18 + 16], 0, 'isolated low-confidence noise was retained');
});
test('cropped edge feather is zero at the border and preserves unclipped interior/tips', () => {
  const edges = { bottom: true };
  assert.equal(tracking.captureEdgeAlpha(50, 99, 100, 100, edges, 20), 0);
  assert.equal(tracking.captureEdgeAlpha(50, 89, 100, 100, edges, 20), 0.5);
  assert.equal(tracking.captureEdgeAlpha(50, 70, 100, 100, edges, 20), 1);
  assert.equal(tracking.captureEdgeAlpha(50, 99, 100, 100, {}, 20), 1);
});

test('depth mask seals actual MediaPipe eye/mouth boundaries and keeps outer face outline', async () => {
  const vision = await import(pathToFileURL(path.join(__dirname, '../public/vendor/mediapipe/vision_bundle.mjs')).href);
  const triangles = tracking.sealedFaceTriangles(vision.FaceLandmarker.FACE_LANDMARKS_TESSELATION);
  const ordered = tracking.orderedContour(vision.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL);
  assert.equal(ordered.length, 36);
  assert.equal(new Set(ordered).size, 36);
  const edges = new Map();
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3);
    for (const pair of [[a, b], [b, c], [c, a]]) {
      const key = pair.sort((x, y) => x - y).join(':');
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const outline = new Set(vision.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL.map(({ start, end }) => [Math.min(start, end), Math.max(start, end)].join(':')));
  const boundaries = [...edges].filter(([, count]) => count === 1).map(([key]) => key);
  assert.equal(boundaries.length, outline.size);
  assert.ok(boundaries.every((key) => outline.has(key)), 'eye or mouth boundary remains open');
});
