const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

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
  ".task": "application/octet-stream",
  ".png": "image/png",
  ".svg": "image/svg+xml"
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

async function renderAiHairstyle(request, response) {
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
    const arPreview = decodePngDataUrl(body.arPreview, "AR preview");
    const styleReference = decodePngDataUrl(body.styleReference, "Style reference");
    const prompt = [
      "The first image is the original portrait to edit. The second image is an AR placement preview showing the intended cut, color, approximate length, and placement. The third image is a hairstyle shape reference only.",
      `Replace only the person's existing hair with ${hairstyle} in ${body.colorName}.`,
      "Preserve the exact face identity, facial features, expression, skin tone, head position, body, clothing, accessories, chair, background, camera angle, crop, and webcam lighting.",
      "Merge the hairstyle into the photograph with a natural scalp attachment, believable roots and hairline, soft temple contact, individual strands, realistic density and gravity, and matching highlights, shadows, sharpness, noise, and color spill.",
      "Hair may pass naturally in front of and behind the face, but keep the eyes, nose, mouth, and face clearly visible.",
      "Hide all original hair that conflicts with the selected style.",
      "Remove every halo, hard mask boundary, transparent hole, colored fringe, duplicate strand, floating edge, and pasted-wig appearance.",
      "Do not beautify or modify the face. Do not change anatomy, age, pose, clothes, room, or add text, UI, or a watermark. Return one photorealistic edited portrait."
    ].join(" ");

    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("image[]", new Blob([portrait], { type: "image/png" }), "portrait.png");
    form.append("image[]", new Blob([arPreview], { type: "image/png" }), "ar-placement-preview.png");
    form.append("image[]", new Blob([styleReference], { type: "image/png" }), "hairstyle-reference.png");
    form.append("prompt", prompt);
    form.append("quality", "high");

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
    sendJson(response, 200, { image: `data:image/png;base64,${imageBase64}` });
  } catch (error) {
    console.error("Mirrorly AI still failed:", error.message);
    sendJson(response, 500, { error: error.message || "AI still rendering failed" });
  }
}

const server = http.createServer((request, response) => {
  const decodedPath = decodeURIComponent(request.url.split("?")[0]);

  if (request.method === "GET" && decodedPath === "/api/ai-status") {
    sendJson(response, 200, {
      available: Boolean(process.env.OPENAI_API_KEY),
      model: "gpt-image-2"
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
