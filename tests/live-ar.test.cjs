const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const tracking = require('../public/tracking.js');
const canonicalFixture = require('./fixtures/mediapipe-canonical-points.json');

// Generic canonical face (Apache-2.0 fixture), optionally reshaped so it no
// longer matches the canonical model the pose fitter assumes.
function fixture({ yaw = 0, pitch = 0, roll = 0, scale = 12, tx = 620, ty = 350, width = 1280, height = 720, reshape = null } = {}) {
  const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
  const matrix = rotation.clone().setPosition(1.2, -0.3, -50).toArray();
  const e = rotation.elements;
  const r = [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
  const landmarks = Array.from({ length: 478 }, () => ({ x: tx / width, y: ty / height, z: 0 }));
  for (const [index, original] of canonicalFixture.points.entries()) {
    const point = reshape ? reshape(original, index) : original;
    const p = tracking.transform(r, point);
    landmarks[index] = { x: (tx + p[0] * scale) / width, y: (ty - p[1] * scale) / height, z: -p[2] * scale / width };
  }
  return { landmarks, matrix: { data: matrix }, width, height };
}

// A taller forehead and deeper profile than the canonical model.
const personShape = (p) => [p[0], p[1] > 2 ? p[1] * 1.15 : p[1] * 0.92, p[2] * 1.3 + 1.5];

function anchorError(anchors, f, pose, registration) {
  let worst = 0;
  tracking.personalAnchorIds.forEach((id, i) => {
    const projected = tracking.applyRegistration(tracking.projectHeadPoint(anchors[i], pose), pose, registration);
    const observed = [(1 - f.landmarks[id].x) * f.width, f.landmarks[id].y * f.height];
    worst = Math.max(worst, Math.hypot(projected[0] - observed[0], projected[1] - observed[1]));
  });
  return worst;
}

test('personal registration is the identity at the capture pose', () => {
  const f = fixture({ reshape: personShape });
  const pose = tracking.fitFace(f.landmarks, f.width, f.height, f.matrix);
  const anchors = tracking.capturePersonalAnchors(f.landmarks, f.width, f.height, pose);
  const registration = tracking.registerPersonalAnchors(anchors, f.landmarks, f.width, f.height, pose);
  assert.ok(Math.abs(registration.scale - 1) < 1e-6);
  assert.ok(Math.hypot(registration.dx, registration.dy) < 1e-4);
});

test('personal registration removes canonical-shape drift after the head moves', () => {
  const capture = fixture({ reshape: personShape });
  const capturePose = tracking.fitFace(capture.landmarks, capture.width, capture.height, capture.matrix);
  const anchors = tracking.capturePersonalAnchors(capture.landmarks, capture.width, capture.height, capturePose);
  // Weak-perspective fitting is exact under pure roll/translation; canonical
  // shape mismatch shows up once the head yaws or pitches.
  for (const moved of [{ yaw: 0.4 }, { yaw: -0.35, pitch: 0.2 }, { pitch: -0.25, ty: 300, scale: 10, roll: 0.2 }]) {
    const f = fixture({ ...moved, reshape: personShape });
    const pose = tracking.fitFace(f.landmarks, f.width, f.height, f.matrix);
    const before = anchorError(anchors, f, pose, null);
    const registration = tracking.registerPersonalAnchors(anchors, f.landmarks, f.width, f.height, pose);
    assert.ok(registration, JSON.stringify(moved));
    const after = anchorError(anchors, f, pose, registration);
    assert.ok(before > 1, `fixture should drift without registration: ${before}`);
    assert.ok(after < 0.25, `registered drift ${after}px for ${JSON.stringify(moved)}`);
  }
});

test('personal registration rejects implausible corrections', () => {
  const capture = fixture();
  const pose = tracking.fitFace(capture.landmarks, capture.width, capture.height, capture.matrix);
  const anchors = tracking.capturePersonalAnchors(capture.landmarks, capture.width, capture.height, pose);
  const far = fixture({ tx: 1000 });
  assert.equal(tracking.registerPersonalAnchors(anchors, far.landmarks, far.width, far.height, pose), null);
  assert.equal(tracking.registerPersonalAnchors(null, capture.landmarks, capture.width, capture.height, pose), null);
});

function viewAttachment(yaw) {
  const f = fixture({ yaw });
  const pose = tracking.fitFace(f.landmarks, f.width, f.height, f.matrix);
  return { quaternion: pose.quaternion, viewFadeStart: 30 * Math.PI / 180, viewFadeEnd: 45 * Math.PI / 180 };
}

function poseAt(yaw) {
  const f = fixture({ yaw });
  return tracking.fitFace(f.landmarks, f.width, f.height, f.matrix);
}

test('multi-view blend keeps the front view primary when facing forward', () => {
  const views = [viewAttachment(0), viewAttachment(0.45), viewAttachment(-0.45)];
  const blend = tracking.aiViewBlend(poseAt(0), views);
  assert.equal(blend.order[0], 0);
  assert.equal(blend.opacity[0], 1);
  assert.ok(blend.opacity[1] < 0.05 && blend.opacity[2] < 0.05);
});

test('multi-view blend hands over to the matching side view and extends turn range', () => {
  const views = [viewAttachment(0), viewAttachment(0.45), viewAttachment(-0.45)];
  const side = tracking.aiViewBlend(poseAt(0.5), views);
  assert.equal(side.order[0], 1);
  assert.ok(side.opacity[2] === 0, 'opposite view must not ghost in');
  // 60 degrees: beyond the front view's range but still covered by a side.
  const wide = tracking.aiViewBlend(poseAt(60 * Math.PI / 180), views);
  assert.ok(wide.opacity[1] > 0.5 && wide.opacity[0] === 0);
  const frontOnly = tracking.aiViewBlend(poseAt(60 * Math.PI / 180), [views[0]]);
  assert.equal(frontOnly.opacity[0], 0);
});

test('multi-view blend composites to normalized weights at the midpoint', () => {
  const views = [viewAttachment(0), viewAttachment(0.4)];
  const blend = tracking.aiViewBlend(poseAt(0.2), views);
  assert.equal(blend.order.length, 2);
  const [first, second] = blend.order;
  // Sequential "over": first layer weight = o1 * (1 - o2), second = o2.
  const firstWeight = blend.opacity[first] * (1 - blend.opacity[second]);
  assert.ok(Math.abs(firstWeight + blend.opacity[second] - 1) < 1e-9);
  assert.ok(blend.opacity[second] > 0.3 && blend.opacity[second] <= 0.5);
});

test('push-pull fill reconstructs holes from neighbours and keeps valid pixels', () => {
  const width = 40, height = 24;
  const color = new Float32Array(width * height * 3);
  const weight = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = y * width + x;
    // Horizontal gradient with a hair-shaped hole in the middle.
    color[i * 3] = x * 5; color[i * 3 + 1] = 100; color[i * 3 + 2] = 200 - x * 2;
    weight[i] = x >= 14 && x < 26 && y >= 6 && y < 18 ? 0 : 1;
    if (!weight[i]) { color[i * 3] = 0; color[i * 3 + 1] = 0; color[i * 3 + 2] = 0; }
  }
  const filled = tracking.pushPullFill(color, weight, width, height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = y * width + x;
    if (weight[i]) {
      assert.ok(Math.abs(filled[i * 3] - x * 5) < 1e-3, 'valid pixel changed');
    } else {
      assert.ok(Math.abs(filled[i * 3 + 1] - 100) < 1, 'constant channel not preserved in hole');
      assert.ok(filled[i * 3] > 14 * 5 - 25 && filled[i * 3] < 26 * 5 + 25, 'gradient not interpolated across hole');
    }
  }
});
