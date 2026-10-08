(function (root) {
  "use strict";

  // Canonical measurements (cm), Apache-2.0 / The MediaPipe Authors.
  // Distribution license and attribution: ./licenses/.
  // https://github.com/google-ai-edge/mediapipe/blob/v0.10.21/mediapipe/modules/face_geometry/data/canonical_face_model.obj
  // Retain landmark IDs: these are not a fitted customer face or identity data.
  const canonical = Object.freeze({
    10: [0, 8.261778, 4.481535],
    152: [0, -9.403378, 4.264492],
    234: [-7.664182, 0.673132, -2.435867],
    454: [7.664182, 0.673132, -2.435867],
    33: [-4.445859, 2.663991, 3.173422],
    263: [4.445859, 2.663991, 3.173422],
    127: [-7.743095, 2.364999, -2.005167],
    356: [7.743095, 2.364999, -2.005167],
    162: [-7.555811, 4.106811, -0.991917],
    389: [7.555811, 4.106811, -0.991917],
    168: [0, 3.271027, 5.236015],
    6: [0, 2.473255, 5.788627],
    1: [0, -1.126865, 7.475604],
    4: [0, -0.463170, 7.586580],
    5: [0, 0.365669, 7.242870]
  });
  const faceWidthCm = 15.328364;
  const headOrigin = [0, (8.261778 - 9.403378) / 2, -2.435867];
  const faceHeightCm = 8.261778 + 9.403378;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const median = (values) => {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 0;
  };
  const norm = (v) => Math.hypot(...v);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const normalize = (v) => v.map((value) => value / norm(v));

  function transform(rotation, point) {
    return [
      dot(rotation.slice(0, 3), point),
      dot(rotation.slice(3, 6), point),
      dot(rotation.slice(6, 9), point)
    ];
  }

  function rotationFromMatrix(matrix) {
    const data = matrix?.data;
    if (data?.length !== 16 || !Array.from(data).every(Number.isFinite)) return null;
    // MediaPipe packed matrices are column-major. Also accept explicit row-major
    // fixtures; the affine last row identifies layout when translation exists.
    const columnAffine = Math.hypot(data[3], data[7], data[11]) < 1e-5;
    const rowAffine = Math.hypot(data[12], data[13], data[14]) < 1e-5;
    if (!columnAffine && !rowAffine) return null;
    const rowMajor = matrix.layout === "row-major" || (!columnAffine && rowAffine);
    const get = (r, c) => data[rowMajor ? r * 4 + c : c * 4 + r];
    const x = [get(0, 0), get(1, 0), get(2, 0)];
    const y = [get(0, 1), get(1, 1), get(2, 1)];
    if (norm(x) < 1e-6 || norm(y) < 1e-6) return null;
    const a = normalize(x);
    const b = y.map((value, i) => value - dot(y, a) * a[i]);
    if (norm(b) < 1e-6) return null;
    const c = cross(a, normalize(b));
    const up = normalize(b);
    return [a[0], up[0], c[0], a[1], up[1], c[1], a[2], up[2], c[2]];
  }

  function quaternionFromRotation(r) {
    let x, y, z, w;
    const trace = r[0] + r[4] + r[8];
    if (trace > 0) {
      const s = Math.sqrt(trace + 1) * 2;
      w = s / 4; x = (r[7] - r[5]) / s; y = (r[2] - r[6]) / s; z = (r[3] - r[1]) / s;
    } else if (r[0] > r[4] && r[0] > r[8]) {
      const s = Math.sqrt(1 + r[0] - r[4] - r[8]) * 2;
      w = (r[7] - r[5]) / s; x = s / 4; y = (r[1] + r[3]) / s; z = (r[2] + r[6]) / s;
    } else if (r[4] > r[8]) {
      const s = Math.sqrt(1 + r[4] - r[0] - r[8]) * 2;
      w = (r[2] - r[6]) / s; x = (r[1] + r[3]) / s; y = s / 4; z = (r[5] + r[7]) / s;
    } else {
      const s = Math.sqrt(1 + r[8] - r[0] - r[4]) * 2;
      w = (r[3] - r[1]) / s; x = (r[2] + r[6]) / s; y = (r[5] + r[7]) / s; z = s / 4;
    }
    return normalize([x, y, z, w]);
  }

  function screenRotation(rotation) {
    // Mirror X and convert Y-up to pixel Y-down exactly once: S R S.
    const signs = [-1, -1, 1];
    return rotation.map((value, i) => value * signs[Math.floor(i / 3)] * signs[i % 3]);
  }

  function fallbackRotation(landmarks, width, height) {
    const a = landmarks[33], b = landmarks[263];
    const x = [(b.x - a.x) * width, -(b.y - a.y) * height, -(b.z - a.z) * width];
    const top = landmarks[10], bottom = landmarks[152];
    const y = [(top.x - bottom.x) * width, -(top.y - bottom.y) * height, -(top.z - bottom.z) * width];
    if (norm(x) < 1 || norm(y) < 1) return null;
    const right = normalize(x);
    const up = normalize(y.map((value, i) => value - dot(y, right) * right[i]));
    if (!up.every(Number.isFinite)) return null;
    const forward = cross(right, up);
    return [right[0], up[0], forward[0], right[1], up[1], forward[1], right[2], up[2], forward[2]];
  }

  function fitFace(landmarks, width, height, matrix) {
    if (!width || !height || landmarks?.length < 468) return null;
    // A malformed mesh must never enter the GPU depth buffer.
    if (!landmarks.slice(0, 468).every((p) => p && [p.x, p.y, p.z].every(Number.isFinite))) return null;
    const rotation = rotationFromMatrix(matrix) || fallbackRotation(landmarks, width, height);
    if (!rotation) return null;
    const points = Object.entries(canonical).map(([id, point]) => {
      const predicted = transform(rotation, point);
      const observed = landmarks[id];
      return { px: -predicted[0], py: -predicted[1], x: (1 - observed.x) * width, y: observed.y * height, weight: 1 };
    });
    let scale, tx, ty;
    // Robust similarity fit in screen space: rotation is fixed by the measured
    // pose, and projected canonical geometry removes yaw/pitch foreshortening.
    for (let pass = 0; pass < 3; pass += 1) {
      const total = points.reduce((sum, p) => sum + p.weight, 0);
      const means = points.reduce((sum, p) => {
        sum[0] += p.px * p.weight; sum[1] += p.py * p.weight;
        sum[2] += p.x * p.weight; sum[3] += p.y * p.weight;
        return sum;
      }, [0, 0, 0, 0]).map((v) => v / total);
      let numerator = 0, denominator = 0;
      for (const p of points) {
        numerator += p.weight * ((p.px - means[0]) * (p.x - means[2]) + (p.py - means[1]) * (p.y - means[3]));
        denominator += p.weight * ((p.px - means[0]) ** 2 + (p.py - means[1]) ** 2);
      }
      if (denominator < 1e-6) return null;
      scale = numerator / denominator;
      tx = means[2] - scale * means[0]; ty = means[3] - scale * means[1];
      const residuals = points.map((p) => Math.hypot(p.x - tx - scale * p.px, p.y - ty - scale * p.py));
      const threshold = Math.max(2, median(residuals) * 2.5);
      points.forEach((p, i) => { p.weight = Math.min(1, threshold / Math.max(1e-6, residuals[i])); });
    }
    const faceWidth = scale * faceWidthCm;
    const error = Math.sqrt(points.reduce((sum, p) => sum + p.weight * ((p.x - tx - scale * p.px) ** 2 + (p.y - ty - scale * p.py) ** 2), 0) / points.reduce((sum, p) => sum + p.weight, 0));
    if (faceWidth < 20 || faceWidth > Math.max(width, height) * 1.6 || error / faceWidth > 0.18) return null;
    const origin = transform(rotation, headOrigin);
    const q = quaternionFromRotation(screenRotation(rotation));
    const sr = screenRotation(rotation);
    const pitch = Math.asin(clamp(-sr[5], -1, 1));
    const yaw = Math.atan2(sr[2], sr[8]);
    const roll = Math.atan2(sr[3], sr[4]);
    const top = landmarks[10], bottom = landmarks[152];
    return {
      x: tx - scale * origin[0], y: ty - scale * origin[1],
      faceWidth, faceHeight: scale * faceHeightCm,
      faceCenterX: (1 - (top.x + bottom.x) / 2) * width,
      faceCenterY: (top.y + bottom.y) / 2 * height,
      foreheadX: (1 - top.x) * width, foreheadY: top.y * height,
      pixelsPerCm: scale, quaternion: q, roll, yaw, pitch,
      fitErrorPx: error, usedMatrix: Boolean(rotationFromMatrix(matrix)),
      depthOrigin: (landmarks[234].z + landmarks[454].z) / 2
    };
  }

  function slerp(a, b, amount) {
    let next = b.slice();
    let cosine = dot(a, next);
    if (cosine < 0) { next = next.map((v) => -v); cosine = -cosine; }
    if (cosine > 0.9995) return normalize(a.map((v, i) => v + (next[i] - v) * amount));
    const angle = Math.acos(clamp(cosine, -1, 1));
    return a.map((v, i) => (v * Math.sin((1 - amount) * angle) + next[i] * Math.sin(amount * angle)) / Math.sin(angle));
  }

  const alpha = (cutoff, dt) => 1 - Math.exp(-2 * Math.PI * cutoff * dt);
  class OneEuroFilter {
    constructor(minCutoff, beta) { this.minCutoff = minCutoff; this.beta = beta; this.reset(); }
    reset() { this.value = null; this.raw = null; this.velocity = 0; this.time = null; }
    filter(next, now) {
      if (this.time === null) { this.time = now; this.raw = next; this.value = next; return next; }
      if (now <= this.time) return this.value;
      const dt = clamp((now - this.time) / 1000, 0.001, 0.25);
      const velocity = (next - this.raw) / dt;
      this.velocity += (velocity - this.velocity) * alpha(1, dt);
      this.value += (next - this.value) * alpha(this.minCutoff + this.beta * Math.abs(this.velocity), dt);
      this.time = now; this.raw = next;
      return this.value;
    }
  }

  class PoseFilter {
    constructor() { this.reset(); }
    reset() {
      this.x = new OneEuroFilter(2.3, 0.28); this.y = new OneEuroFilter(2.3, 0.28);
      this.scale = new OneEuroFilter(1.8, 3.2);
      this.faceCenterX = new OneEuroFilter(2.3, 0.28); this.faceCenterY = new OneEuroFilter(2.3, 0.28);
      this.foreheadX = new OneEuroFilter(2.3, 0.28); this.foreheadY = new OneEuroFilter(2.3, 0.28);
      this.quaternion = null; this.rawQuaternion = null; this.time = null;
    }
    filter(pose, now) {
      const dt = this.time === null ? 0 : clamp((now - this.time) / 1000, 0, 0.25);
      const next = {
        ...pose,
        x: this.x.filter(pose.x, now), y: this.y.filter(pose.y, now),
        faceCenterX: this.faceCenterX.filter(pose.faceCenterX, now),
        faceCenterY: this.faceCenterY.filter(pose.faceCenterY, now),
        foreheadX: this.foreheadX.filter(pose.foreheadX, now),
        foreheadY: this.foreheadY.filter(pose.foreheadY, now)
      };
      const ratio = Math.exp(this.scale.filter(Math.log(pose.faceWidth), now)) / pose.faceWidth;
      next.faceWidth *= ratio; next.faceHeight *= ratio;
      next.quaternion = pose.quaternion.slice();
      if (this.quaternion) {
        const travel = 2 * Math.acos(clamp(Math.abs(dot(this.rawQuaternion, pose.quaternion)), -1, 1));
        next.quaternion = slerp(this.quaternion, pose.quaternion, alpha(3.8 + 6 * travel / Math.max(dt, 0.001), dt));
      }
      this.quaternion = next.quaternion; this.rawQuaternion = pose.quaternion.slice(); this.time = now;
      return next;
    }
  }

  function trackingAge(now, lastFaceAt) {
    if (lastFaceAt === null || now < lastFaceAt) return { tracking: false, opacity: 0 };
    const age = now - lastFaceAt;
    return { tracking: age < 220, opacity: clamp((220 - age) / 100, 0, 1) };
  }

  function rotatePoint(q, point) {
    const [x, y, z, w] = q;
    const t = cross([x, y, z], point).map((v) => 2 * v);
    const c = cross([x, y, z], t);
    return point.map((v, i) => v + w * t[i] + c[i]);
  }

  // Capture pixels are already posed. Undo that pose before attaching them to
  // the head, otherwise roll/yaw is applied twice around the image crop center.
  function capturePointToHead(attachment, u, v) {
    const { crop, headX, headY, faceWidth, quaternion, depth } = attachment;
    const pixelX = crop.x + u * crop.width;
    const samples = attachment.depthSamples;
    let pixelDepth = depth;
    if (samples?.length >= 2) {
      pixelDepth = samples[0].depth;
      for (let i = 1; i < samples.length; i += 1) {
        const a = samples[i - 1], b = samples[i];
        const t = clamp((pixelX - a.x) / Math.max(1e-6, b.x - a.x), 0, 1);
        pixelDepth = a.depth + (b.depth - a.depth) * t;
        if (pixelX <= b.x) break;
      }
    }
    // A generated photograph should remain mostly photographic. Retain only a
    // small amount of measured temple curvature in realism-first mode instead
    // of bending the entire texture like a rigid 3D sheet.
    const depthStrength = clamp(attachment.depthStrength ?? 1, 0, 1);
    pixelDepth = depth + (pixelDepth - depth) * depthStrength;
    const point = [
      (pixelX - headX) / faceWidth,
      (crop.y + v * crop.height - headY) / faceWidth,
      pixelDepth / faceWidth
    ];
    return rotatePoint([-quaternion[0], -quaternion[1], -quaternion[2], quaternion[3]], point);
  }

  function projectHeadPoint(point, pose) {
    const p = rotatePoint(pose.quaternion, point).map((v) => v * pose.faceWidth);
    return [pose.x + p[0], pose.y + p[1], p[2]];
  }

  function aiViewAngle(pose, attachment) {
    const relative = rotatePoint(pose.quaternion,
      rotatePoint([-attachment.quaternion[0], -attachment.quaternion[1], -attachment.quaternion[2], attachment.quaternion[3]], [0, 0, 1]));
    return Math.acos(clamp(relative[2], -1, 1));
  }

  function aiViewOpacity(pose, attachment) {
    // A single edited portrait has no unseen side/back view. Hide gracefully
    // outside its useful range rather than showing a detached, hollow billboard.
    const angle = aiViewAngle(pose, attachment);
    const fadeStart = attachment.viewFadeStart ?? 0.61;
    const fadeEnd = Math.max(fadeStart + 1e-6, attachment.viewFadeEnd ?? 0.78);
    return clamp((fadeEnd - angle) / (fadeEnd - fadeStart), 0, 1);
  }

  // View-dependent texturing for front/left/right generated views. The nearest
  // view is drawn first; at most one neighbour is layered over it so sequential
  // "over" compositing yields a normalized two-view blend instead of ghosting
  // three textures. Overall opacity still fades once every view is out of range.
  function aiViewBlend(pose, attachments) {
    const opacity = attachments.map(() => 0);
    const views = attachments.map((attachment, index) => {
      const coverage = aiViewOpacity(pose, attachment);
      return { index, coverage, weight: coverage > 0 ? coverage / Math.pow(aiViewAngle(pose, attachment) + 0.06, 4) : 0 };
    }).filter((view) => view.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 2);
    if (!views.length) return { opacity, order: [] };
    const total = Math.max(...views.map((view) => view.coverage));
    let accumulated = 0;
    views.forEach((view, k) => {
      accumulated += view.weight;
      opacity[view.index] = k === 0 ? total : total * view.weight / accumulated;
    });
    return { opacity, order: views.map((view) => view.index) };
  }

  // Rigid upper-face landmarks: forehead, brow ridge, temples, eye corners and
  // nose bridge. Mouth and jaw are excluded because expressions move them.
  const personalAnchorIds = Object.freeze([10, 151, 9, 8, 168, 6, 108, 337, 67, 297, 109, 338,
    54, 284, 21, 251, 127, 356, 162, 389, 70, 300, 33, 263, 133, 362]);

  // Store the customer's own captured landmarks in head-local, face-width units
  // (same space as capturePointToHead). Numeric registration geometry only.
  function capturePersonalAnchors(landmarks, width, height, pose) {
    if (!landmarks || !pose?.quaternion || !(pose.faceWidth > 0)) return null;
    const inverse = [-pose.quaternion[0], -pose.quaternion[1], -pose.quaternion[2], pose.quaternion[3]];
    return personalAnchorIds.map((id) => {
      const p = landmarks[id];
      return rotatePoint(inverse, [
        ((1 - p.x) * width - pose.x) / pose.faceWidth,
        (p.y * height - pose.y) / pose.faceWidth,
        (pose.depthOrigin - p.z) * width / pose.faceWidth
      ]);
    });
  }

  // Fit the attachment to the customer's own current landmarks instead of the
  // generic canonical face. Solves a robust scale about the head origin plus a
  // screen translation, so canonical-shape mismatch no longer leaves hair
  // floating or sliding. Returns null when the measurement is implausible.
  function registerPersonalAnchors(anchors, landmarks, width, height, pose) {
    if (!anchors?.length || !landmarks || !pose) return null;
    const points = [];
    for (let i = 0; i < anchors.length; i += 1) {
      const observed = landmarks[personalAnchorIds[i]];
      if (!observed || !Number.isFinite(observed.x) || !Number.isFinite(observed.y)) continue;
      const predicted = projectHeadPoint(anchors[i], pose);
      points.push({ ax: predicted[0] - pose.x, ay: predicted[1] - pose.y,
        bx: (1 - observed.x) * width - pose.x, by: observed.y * height - pose.y, weight: 1 });
    }
    if (points.length < 6) return null;
    let scale = 1, dx = 0, dy = 0;
    for (let pass = 0; pass < 3; pass += 1) {
      const total = points.reduce((sum, p) => sum + p.weight, 0);
      const m = points.reduce((sum, p) => {
        sum[0] += p.ax * p.weight; sum[1] += p.ay * p.weight; sum[2] += p.bx * p.weight; sum[3] += p.by * p.weight;
        return sum;
      }, [0, 0, 0, 0]).map((v) => v / total);
      let numerator = 0, denominator = 0;
      for (const p of points) {
        numerator += p.weight * ((p.ax - m[0]) * (p.bx - m[2]) + (p.ay - m[1]) * (p.by - m[3]));
        denominator += p.weight * ((p.ax - m[0]) ** 2 + (p.ay - m[1]) ** 2);
      }
      if (denominator < 1e-6) return null;
      scale = numerator / denominator;
      dx = m[2] - scale * m[0]; dy = m[3] - scale * m[1];
      const residuals = points.map((p) => Math.hypot(p.bx - dx - scale * p.ax, p.by - dy - scale * p.ay));
      const threshold = Math.max(1.5, median(residuals) * 2.5);
      points.forEach((p, i) => { p.weight = Math.min(1, threshold / Math.max(1e-6, residuals[i])); });
    }
    // Implausible corrections indicate a bad detection, not a real head change.
    if (!(scale > 0.8 && scale < 1.25) || Math.hypot(dx, dy) > pose.faceWidth * 0.3) return null;
    return { scale, dx, dy };
  }

  function applyRegistration(point, pose, registration) {
    if (!registration) return point;
    return [
      pose.x + registration.scale * (point[0] - pose.x) + registration.dx,
      pose.y + registration.scale * (point[1] - pose.y) + registration.dy,
      point[2] * registration.scale
    ];
  }

  // Push-pull hole filling (scattered-data interpolation). weight=1 keeps the
  // pixel, weight=0 is reconstructed from progressively coarser neighbours.
  // Used at low resolution to cover the customer's real hair in live view.
  function pushPullFill(color, weight, width, height) {
    const levels = [{ color, weight, width, height }];
    while (levels[levels.length - 1].width > 1 || levels[levels.length - 1].height > 1) {
      const fine = levels[levels.length - 1];
      const w = Math.max(1, Math.ceil(fine.width / 2)), h = Math.max(1, Math.ceil(fine.height / 2));
      const c = new Float32Array(w * h * 3), wt = new Float32Array(w * h);
      for (let y = 0; y < fine.height; y += 1) for (let x = 0; x < fine.width; x += 1) {
        const f = y * fine.width + x, k = (y >> 1) * w + (x >> 1), fw = fine.weight[f];
        if (fw <= 0) continue;
        wt[k] += fw;
        c[k * 3] += fine.color[f * 3] * fw; c[k * 3 + 1] += fine.color[f * 3 + 1] * fw; c[k * 3 + 2] += fine.color[f * 3 + 2] * fw;
      }
      for (let k = 0; k < w * h; k += 1) {
        if (wt[k] > 0) { c[k * 3] /= wt[k]; c[k * 3 + 1] /= wt[k]; c[k * 3 + 2] /= wt[k]; }
        wt[k] = Math.min(1, wt[k]);
      }
      levels.push({ color: c, weight: wt, width: w, height: h });
    }
    let filled = levels[levels.length - 1].color;
    for (let level = levels.length - 2; level >= 0; level -= 1) {
      const fine = levels[level], coarse = levels[level + 1];
      const out = new Float32Array(fine.width * fine.height * 3);
      for (let y = 0; y < fine.height; y += 1) {
        const cy = clamp((y + 0.5) / 2 - 0.5, 0, coarse.height - 1), y0 = Math.floor(cy), y1 = Math.min(coarse.height - 1, y0 + 1), ty = cy - y0;
        for (let x = 0; x < fine.width; x += 1) {
          const cx = clamp((x + 0.5) / 2 - 0.5, 0, coarse.width - 1), x0 = Math.floor(cx), x1 = Math.min(coarse.width - 1, x0 + 1), tx = cx - x0;
          const f = y * fine.width + x, fw = fine.weight[f];
          for (let ch = 0; ch < 3; ch += 1) {
            const top = filled[(y0 * coarse.width + x0) * 3 + ch] * (1 - tx) + filled[(y0 * coarse.width + x1) * 3 + ch] * tx;
            const bottom = filled[(y1 * coarse.width + x0) * 3 + ch] * (1 - tx) + filled[(y1 * coarse.width + x1) * 3 + ch] * tx;
            out[f * 3 + ch] = fine.color[f * 3 + ch] * fw + (top * (1 - ty) + bottom * ty) * (1 - fw);
          }
        }
      }
      filled = out;
    }
    return filled;
  }

  function backgroundRepairOpacity(pose, attachment) {
    // These are frozen room pixels, NOT hair attached to the scalp. Only use
    // them near the capture pose; otherwise they form dark moving polygons.
    if (!pose || !attachment || !(attachment.faceWidth > 0) || !(pose.faceWidth > 0)) return 0;
    const travel = Math.hypot(pose.x - attachment.headX, pose.y - attachment.headY) / attachment.faceWidth;
    const zoom = Math.abs(Math.log(pose.faceWidth / attachment.faceWidth));
    const angle = 2 * Math.acos(clamp(Math.abs(dot(pose.quaternion, attachment.quaternion)), 0, 1));
    const fade = (value, start, end) => {
      const t = clamp((value - start) / (end - start), 0, 1);
      return 1 - t * t * (3 - 2 * t);
    };
    return Math.min(
      fade(travel, attachment.repairTravelStart ?? 0.025, attachment.repairTravelEnd ?? 0.12),
      fade(zoom, attachment.repairZoomStart ?? 0.025, attachment.repairZoomEnd ?? 0.10),
      fade(angle, attachment.repairAngleStart ?? 0.035, attachment.repairAngleEnd ?? 0.18)
    );
  }

  function shouldDisplayAiHair(liveState, lookKey) {
    return Boolean(liveState.liveAr && liveState.showOverlay && !liveState.liveAiHairGenerating
      && liveState.liveAiHair && liveState.liveAiHairKey === lookKey);
  }

  function orderedContour(connections) {
    const adjacency = new Map();
    for (const { start, end } of connections) {
      if (!adjacency.has(start)) adjacency.set(start, []);
      if (!adjacency.has(end)) adjacency.set(end, []);
      adjacency.get(start).push(end); adjacency.get(end).push(start);
    }
    if (!adjacency.size || [...adjacency.values()].some((neighbors) => neighbors.length !== 2)) return [];
    const start = connections[0].start, ids = [];
    let previous = -1, current = start;
    do {
      ids.push(current);
      const next = adjacency.get(current).find((id) => id !== previous);
      previous = current; current = next;
    } while (current !== start && ids.length <= adjacency.size);
    return current === start && ids.length === adjacency.size ? ids : [];
  }

  function selectHeadHair(mask, seed) {
    if (!mask?.data || !mask.width || !mask.height) return mask;
    const { width, height } = mask;
    const data = new Float32Array(width * height);
    const visited = new Uint8Array(data.length), queue = new Uint32Array(data.length);
    for (let start = 0; start < data.length; start += 1) {
      if (visited[start] || mask.data[start] < 0.05) continue;
      let read = 0, count = 1, touchesHead = false;
      visited[start] = 1; queue[0] = start;
      while (read < count) {
        const index = queue[read++], x = index % width, y = Math.floor(index / width);
        if (x >= seed.left && x <= seed.right && y >= seed.top && y <= seed.bottom) touchesHead = true;
        for (const next of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1]) {
          if (next < 0 || visited[next] || mask.data[next] < 0.05) continue;
          visited[next] = 1; queue[count++] = next;
        }
      }
      if (touchesHead) for (let i = 0; i < count; i += 1) data[queue[i]] = mask.data[queue[i]];
    }
    return { ...mask, data };
  }

  function captureEdgeAlpha(x, y, width, height, clipped, feather) {
    let distance = feather;
    if (clipped.left) distance = Math.min(distance, x);
    if (clipped.right) distance = Math.min(distance, width - 1 - x);
    if (clipped.top) distance = Math.min(distance, y);
    if (clipped.bottom) distance = Math.min(distance, height - 1 - y);
    const t = clamp(distance / Math.max(1, feather), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function fillHairMatteHoles(mask, maxPixels, maxY) {
    if (!mask?.data || !mask.width || !mask.height) return mask;
    const { width, height } = mask;
    const data = Float32Array.from(mask.data);
    const visited = new Uint8Array(width * height);
    const queue = new Uint32Array(width * height);
    for (let start = 0; start < width * height; start += 1) {
      if (visited[start] || data[start] >= 0.5) continue;
      let read = 0, count = 1, open = false, protectedFace = false;
      queue[0] = start; visited[start] = 1;
      while (read < count) {
        const index = queue[read++], x = index % width, y = Math.floor(index / width);
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) open = true;
        if (y >= maxY) protectedFace = true;
        for (const next of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1]) {
          if (next < 0 || visited[next] || data[next] >= 0.5) continue;
          visited[next] = 1; queue[count++] = next;
        }
      }
      // Only fill small enclosed crown/upper-temple matte dropouts. Keep the
      // outer silhouette and large face opening transparent; RGB is untouched,
      // so natural scalp parting from the AI photograph is preserved.
      if (!open && !protectedFace && count <= maxPixels) {
        for (let i = 0; i < count; i += 1) data[queue[i]] = 1;
      }
    }
    return { ...mask, data };
  }

  function sealedFaceTriangles(connections) {
    const triangles = [];
    const edges = new Map();
    for (let i = 0; i + 2 < connections.length; i += 3) {
      const a = connections[i].start, b = connections[i].end, c = connections[i + 1].end;
      triangles.push(a, b, c);
      for (const [x, y] of [[a, b], [b, c], [c, a]]) {
        const key = [Math.min(x, y), Math.max(x, y)].join(':');
        const edge = edges.get(key) || { x, y, count: 0 };
        edge.count += 1; edges.set(key, edge);
      }
    }
    const adjacency = new Map();
    for (const { x, y, count } of edges.values()) {
      if (count !== 1) continue;
      if (!adjacency.has(x)) adjacency.set(x, []);
      if (!adjacency.has(y)) adjacency.set(y, []);
      adjacency.get(x).push(y); adjacency.get(y).push(x);
    }
    const visited = new Set();
    for (const start of adjacency.keys()) {
      if (visited.has(start)) continue;
      const loop = [];
      let previous = -1, next = start;
      while (!visited.has(next)) {
        visited.add(next); loop.push(next);
        const candidates = adjacency.get(next) || [];
        const following = candidates.find((id) => id !== previous);
        previous = next; next = following;
        if (next === undefined) break;
      }
      // Face outline stays open; only seal the two eyelid and inner-lip holes.
      if (next !== start || loop.length > 24 || loop.length < 3) continue;
      for (let i = 1; i < loop.length - 1; i += 1) triangles.push(loop[0], loop[i], loop[i + 1]);
    }
    return triangles;
  }

  const api = { canonical, headOrigin, faceWidthCm, transform, screenRotation, quaternionFromRotation, rotationFromMatrix, fitFace, OneEuroFilter, PoseFilter, trackingAge,
    rotatePoint, capturePointToHead, projectHeadPoint, aiViewAngle, aiViewOpacity, aiViewBlend, backgroundRepairOpacity, shouldDisplayAiHair, sealedFaceTriangles, fillHairMatteHoles,
    orderedContour, selectHeadHair, captureEdgeAlpha, personalAnchorIds, capturePersonalAnchors, registerPersonalAnchors, applyRegistration, pushPullFill };
  root.MirrorlyTracking = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
