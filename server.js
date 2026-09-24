const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

function loadLocalEnvironment(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(name in process.env)) process.env[name] = value;
  }
}

loadLocalEnvironment(path.join(__dirname, ".env.local"));

const host = "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const publicDir = path.join(__dirname, "public");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
    ".bin": "application/octet-stream",
    ".task": "application/octet-stream",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
};

const hairstylePrompts = {
  bob: "a polished jaw-length bob cut with a softly curved salon finish",
  feather: "a shoulder-length feather cut with soft, airy, face-framing layers",
  "v-cut": "long layered hair with a clearly defined V-shaped finish",
  "u-cut": "long layered hair with a smooth rounded U-shaped finish",
  "crew-cut": "a neat crew cut with a textured top and tapered sides",
  "buzz-cut": "a short even buzz cut with a natural scalp transition",
  "curtain-bangs": "medium curtain bangs with a center part and sweeping fringe",
  "skin-fade": "a textured short top with a clean skin fade"
};

const hairColors = new Set([
  "Natural Black",
  "Dark Brown",
  "Chestnut Brown",
  "Copper",
  "Golden Blonde"
]);

const aiRenderSettings = Object.freeze({
  model: "gpt-image-2",
  quality: "medium",
  outputFormat: "jpeg",
  outputCompression: "90"
});

const aiArRenderSettings = Object.freeze({
  model: 'gpt-image-2',
  quality: 'medium',
  outputFormat: 'jpeg',
  outputCompression: '90'
});

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request, limit = 14 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("The captured image is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON request"));
      }
    });
    request.on("error", reject);
  });
}

function decodePngDataUrl(value, label) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value || "");
  if (!match) throw new Error(`${label} must be a PNG image`);
  return Buffer.from(match[1], "base64");
}

function decodeReferenceDataUrl(value, label) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(value || '');
  if (!match) throw new Error(label + ' must be a PNG or JPEG image');
  return { data: Buffer.from(match[2], 'base64'), type: 'image/' + match[1], extension: match[1] === 'jpeg' ? 'jpg' : 'png' };
}

async function renderAiHairstyle(request, response) {
  const startedAt = performance.now();
  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, {
      error: "AI still rendering is installed but OPENAI_API_KEY is not configured on this laptop."
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const hairstyle = hairstylePrompts[body.styleId];
    if (!hairstyle || !hairColors.has(body.colorName)) {
      sendJson(response, 400, { error: "Unsupported hairstyle or hair color" });
      return;
    }

    const portrait = decodePngDataUrl(body.portrait, "Portrait");
    const arPreview = decodeReferenceDataUrl(body.arPreview, "AR preview");
    const styleReference = decodeReferenceDataUrl(body.styleReference, "Style reference");
    const consistencyReference = body.consistencyReference
      ? decodeReferenceDataUrl(body.consistencyReference, "Approved front hairstyle reference")
      : null;
    const viewLabel = new Set(["front", "left", "right"]).has(body.viewLabel) ? body.viewLabel : "front";
    const portraitSize = readPngDimensions(portrait);
    const outputSize = chooseAiOutputSize(portraitSize.width, portraitSize.height);
    const prompt = [
      "The first image is the original portrait to edit. The second image is an AR placement preview showing the intended cut, color, approximate length, and placement. The third image is a hairstyle shape reference only.",
      `This is the ${viewLabel} view of a guided three-angle salon capture. Preserve this exact camera angle and head pose.`,
      consistencyReference
        ? "The fourth image is the approved front hairstyle result for the same person and selection. Match its haircut identity, part, length, density, texture, and color while preserving the face and pose from the first image."
        : "Establish a clear, repeatable hairstyle identity that matching side views can follow.",
      `Replace only the person's existing hair with ${hairstyle} in ${body.colorName}.`,
      "Preserve the exact face identity, facial features, expression, skin tone, head position, body, clothing, accessories, chair, background, camera angle, crop, and webcam lighting.",
      "Merge the hairstyle into the photograph with a natural scalp attachment, believable roots and hairline, soft temple contact, individual strands, realistic density and gravity, and matching highlights, shadows, sharpness, noise, and color spill.",
      "Hair may pass naturally in front of and behind the face, but keep the eyes, nose, mouth, and face clearly visible.",
      "Hide all original hair that conflicts with the selected style.",
      "Remove every halo, hard mask boundary, transparent hole, colored fringe, duplicate strand, floating edge, and pasted-wig appearance.",
      "Do not beautify or modify the face. Do not change anatomy, age, pose, clothes, room, or add text, UI, or a watermark. Return one photorealistic edited portrait."
    ].join(" ");

    const form = new FormData();
    form.append("model", aiRenderSettings.model);
    form.append("image[]", new Blob([portrait], { type: "image/png" }), "portrait.png");
    form.append("image[]", new Blob([arPreview.data], { type: arPreview.type }), "ar-placement-preview." + arPreview.extension);
    form.append("image[]", new Blob([styleReference.data], { type: styleReference.type }), "hairstyle-reference." + styleReference.extension);
    if (consistencyReference) {
      form.append("image[]", new Blob([consistencyReference.data], { type: consistencyReference.type }), "approved-front-hairstyle." + consistencyReference.extension);
    }
    form.append("prompt", prompt);
    form.append("quality", aiRenderSettings.quality);
    form.append("output_format", aiRenderSettings.outputFormat);
    form.append("output_compression", aiRenderSettings.outputCompression);
    form.append("size", outputSize);

    const apiStartedAt = performance.now();
    const apiResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(240000)
    });
    const result = await apiResponse.json();
    if (!apiResponse.ok) {
      throw new Error(result.error?.message || `Image edit failed (${apiResponse.status})`);
    }
    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error("The image model returned no image");
    sendJson(response, 200, { image: `data:image/jpeg;base64,${imageBase64}`, outputSize,
      timings: { preparationMs: Math.round(apiStartedAt - startedAt), apiMs: Math.round(performance.now() - apiStartedAt), totalMs: Math.round(performance.now() - startedAt) } });
  } catch (error) {
    console.error("Mirrorly AI still failed:", error.message);
    sendJson(response, 500, { error: error.message || "AI still rendering failed" });
  }
}

function readPngDimensions(buffer) {
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error('Live portrait must be a valid PNG image');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function chooseAiOutputSize(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Portrait dimensions must be positive integers');
  }
  if (Math.max(width, height) / Math.min(width, height) > 3) {
    throw new Error('Portrait aspect ratio is not supported');
  }
  const minimumPixels = 655360;
  // Bound output close to the model's minimum area, retaining the full frame.
  let scale = Math.sqrt(minimumPixels / (width * height));
  let outputWidth = Math.ceil(width * scale / 16) * 16;
  let outputHeight = Math.ceil(height * scale / 16) * 16;
  if (Math.max(outputWidth, outputHeight) > 3840) {
    scale = 3840 / Math.max(outputWidth, outputHeight);
    outputWidth = Math.floor(outputWidth * scale / 16) * 16;
    outputHeight = Math.floor(outputHeight * scale / 16) * 16;
  }
  if (Math.max(outputWidth, outputHeight) / Math.min(outputWidth, outputHeight) > 3) {
    throw new Error('Live portrait aspect ratio is not supported');
  }
  return outputWidth + 'x' + outputHeight;
}

async function renderLiveAiHairLayer(request, response) {
  const startedAt = performance.now();
  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, {
      error: 'Live AI hair generation requires OPENAI_API_KEY on this laptop.'
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const hairstyle = hairstylePrompts[body.styleId];
    if (!hairstyle || !hairColors.has(body.colorName)) {
      sendJson(response, 400, { error: 'Unsupported hairstyle or hair color' });
      return;
    }

    const portrait = decodePngDataUrl(body.portrait, 'Live portrait');
    const editMask = decodePngDataUrl(body.editMask, 'Live hairstyle mask');
    const arPreview = decodeReferenceDataUrl(body.arPreview, 'AR placement preview');
    const styleReference = decodeReferenceDataUrl(body.styleReference, 'Style reference');
    const portraitSize = readPngDimensions(portrait);
    const maskSize = readPngDimensions(editMask);
    if (maskSize.width !== portraitSize.width || maskSize.height !== portraitSize.height) {
      throw new Error('Live hairstyle mask must match the portrait dimensions');
    }
    const outputSize = chooseAiOutputSize(portraitSize.width, portraitSize.height);
    const prompt = [
      'The first image is the exact live webcam portrait to edit.',
      'The second and third images are synthetic geometry guides only. Use them only for the hairstyle silhouette, cut, hairline, length, and placement. Do not copy their rendered texture, smooth clumps, painted highlights, studio lighting, edge color, or material finish.',
      'The transparent area of the supplied edit mask is the only region where hair may be changed.',
      'Replace only the existing hair with ' + hairstyle + ' in ' + body.colorName + '.',
      'Render real human hair photographed by the same webcam: irregular strand thickness, fine flyaways, slight asymmetry, natural density variation, believable root direction, subtle scalp visibility at a part, and translucent wisps at the silhouette.',
      'Match the portrait\'s existing directional light, exposure, white balance, focus, sensor noise, compression, highlights, and shadows. Do not relight or beautify the frame.',
      'Preserve the exact identity, face, expression, skin, pose, anatomy, body, clothes, room, camera angle, crop, and image dimensions from the first portrait.',
      'Merge natural roots and individual strands into the scalp and temples. Remove every pixel of old hair that is outside or conflicts with the selected cut, including long lengths, buns, flyaways, and dark edge halos.',
      'Where a shorter cut exposes areas previously covered by old hair, reconstruct the original wall, curtain, chair, or room from nearby portrait pixels inside the editable region. Do not leave duplicate old hair behind the new style.',
      'The hair must not look like CGI, a 3D render, a game asset, an illustration, a plastic surface, a mannequin, a helmet, or a pasted wig.',
      'Do not leave a face-shaped hole, hard oval edge, halo, floating layer, black geometry, repeated strand pattern, or perfect specular band.',
      'At normal viewing size and at 100 percent crop, the edited region should look like pixels from the same unedited webcam photograph.',
      'Return one complete edited portrait in the exact original coordinate system.'
    ].join(' ');

    const form = new FormData();
    form.append('model', aiArRenderSettings.model);
    form.append('mask', new Blob([editMask], { type: 'image/png' }), 'hairstyle-edit-mask.png');
    form.append('image[]', new Blob([portrait], { type: 'image/png' }), 'live-portrait.png');
    form.append('image[]', new Blob([arPreview.data], { type: arPreview.type }), 'synthetic-placement-geometry-guide.' + arPreview.extension);
    form.append('image[]', new Blob([styleReference.data], { type: styleReference.type }), 'synthetic-cut-shape-guide.' + styleReference.extension);
    form.append('prompt', prompt);
    form.append('quality', aiArRenderSettings.quality);
    form.append('size', outputSize);
    form.append('output_format', aiArRenderSettings.outputFormat);
    form.append('output_compression', aiArRenderSettings.outputCompression);

    const apiStartedAt = performance.now();
    const apiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: form,
      signal: AbortSignal.timeout(240000)
    });
    const result = await apiResponse.json();
    if (!apiResponse.ok) {
      throw new Error(result.error?.message || 'Live AI hair generation failed (' + apiResponse.status + ')');
    }
    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error('The image model returned no merged portrait');
    sendJson(response, 200, {
      image: 'data:image/jpeg;base64,' + imageBase64,
      sourceWidth: portraitSize.width,
      sourceHeight: portraitSize.height,
      outputSize,
      timings: { preparationMs: Math.round(apiStartedAt - startedAt), apiMs: Math.round(performance.now() - apiStartedAt), totalMs: Math.round(performance.now() - startedAt) }
    });
  } catch (error) {
    console.error('Mirrorly live AI hair failed:', error.message);
    sendJson(response, 500, { error: error.message || 'Live AI hair generation failed' });
  }
}

const server = http.createServer((request, response) => {
  if (request.method === 'POST' && request.url.split('?')[0] === '/api/ai-ar-hair') {
    renderLiveAiHairLayer(request, response);
    return;
  }
  const decodedPath = decodeURIComponent(request.url.split("?")[0]);

  if (request.method === "GET" && decodedPath === "/api/ai-status") {
    sendJson(response, 200, {
      available: Boolean(process.env.OPENAI_API_KEY),
      model: aiRenderSettings.model,
      quality: aiRenderSettings.quality,
      outputFormat: aiRenderSettings.outputFormat,
      liveOutputFormat: aiArRenderSettings.outputFormat,
      targetLatencySeconds: 20,
      outputPixelTarget: 655360
    });
    return;
  }

  if (request.method === "POST" && decodedPath === "/api/ai-render") {
    renderAiHairstyle(request, response);
    return;
  }

  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.resolve(publicDir, `.${requestedPath}`);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Mirrorly is running at http://${host}:${port}`);
  console.log("Press Ctrl+C to stop.");
});
