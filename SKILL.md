---
name: mirrorly
description: Build, run, maintain, test, and publish the Mirrorly laptop hairstyle try-on app in C:\Users\DELL\mirrorly. Use for live AR face tracking and AI hair attachment, real-hair removal, guided three-view salon results, hairstyle catalog and colors, OpenAI key or billing troubleshooting, local server startup, tests, and GitHub publishing.
---

# Mirrorly

Mirrorly is a laptop-local, single-salon hairstyle try-on app. Local MediaPipe tracking runs in the browser. Paid OpenAI image edits run only when the user explicitly asks for one. Work only inside `C:\Users\DELL\mirrorly` unless the user widens scope, and preserve unrelated files and worktree changes. This file describes current behaviour; dated history and rationale are in `CHANGELOG.md`.

## Workspace (verified 2026-10-08)

| Path (under `MirrorlyLaptopApp/`) | Purpose |
|---|---|
| `public/index.html`, `public/styles.css` | UI shell and styling |
| `public/app.js` | App state, camera, AI requests, AI-layer extraction, live compositing, real-hair removal, salon flow, demo mode |
| `public/ar.js` | `window.MirrorlyAR`: Face Landmarker, Hair Segmenters, Three.js renderer, AI view meshes |
| `public/tracking.js` | `window.MirrorlyTracking`: pure math (pose fit, filters, attachment projection, registration, view blend, push-pull fill). Node-testable |
| `public/models/` | `face_landmarker.task`, `hair_segmenter.tflite` (the only served copy; the copy at the repo root is redundant) |
| `public/assets/hair/`, `public/assets/models/` | Catalog PNGs (`<style>.png` plus untouched `<style>-source.png`) and GLBs |
| `public/assets/demo/` | Fictional demo portraits and their prompts |
| `public/licenses/` | MediaPipe Apache-2.0 notice |
| `assets-source/makehuman-cc0/`, `makehuman-cc-by/` | Licensed source meshes. Keep provenance |
| `scripts/Build-Mirrorly3DAssets.ps1` | OBJ→GLB build (`npm run build:3d-assets`) |
| `server.js` | Static server plus `/api/ai-status`, `/api/ai-ar-hair`, `/api/ai-render` |
| `tests/` | `tracking.test.cjs`, `live-ar.test.cjs`, `ai-performance.test.cjs` (unit); `browser-tracking.cjs` (Edge/WebGL) |
| `CHANGELOG.md` | Dated decisions and history |

Untracked local work, not part of the shipped app:
- `android-rk3588/` and `scripts/Build-RK3588Android.ps1`: an Android WebView shell for RK3588 (see its README).
- DeepAR SDK zip and folders, `assets-source/deepar-studio-input/`, `free_package/`: the DeepAR integration was removed in `d6dd53f`. Do not reintroduce it unless asked.

Outside the app: `C:\Users\DELL\mirrorly\Mirrorly_Concept_Walkthrough.pptx` and reference media. Python is not installed; don't rely on Microsoft Store aliases.

## Run and verify

```powershell
Set-Location 'C:\Users\DELL\mirrorly\MirrorlyLaptopApp'
npm run check    # syntax
npm test         # unit tests (40 as of 2026-10-08)
npm start        # http://localhost:4173/
npm run test:browser   # needs the server running
```

- Before starting a server, check port 4173. Reuse a working server, or stop only the Node `server.js` process that owns the port.
- `/` with any query string must serve `index.html`. Add `?v=YYYYMMDD-HHMM` after asset or JS changes.
- Restart the server after backend changes. A message like "must be a PNG image" means an old server is still running.

## Customer flow

1. **Start live AI mirror.** The camera opens and local tracking starts automatically. The preview stays **camera-only**.
2. **Step 1 style, Step 2 color.** There is no Step 3 and no manual fit controls; alignment is automatic.
3. **Create AI hair for live AR** (button injected in `app.js`). This is an explicit paid action: one frozen frontal frame, an edit mask, a hidden placement guide and a style reference are uploaded to `/api/ai-ar-hair`. The result is extracted locally into a hair-only layer that follows the head.
4. **Create salon result.** A guided front/left/right capture runs with local quality gates. `Generate three salon views` then makes 3 paid edits via `/api/ai-render`: the front first, then both sides concurrently with the front as a consistency reference. The views are held in session memory and can be saved individually. On returning to the live mirror, all three are reused as view-dependent live AR, with no extra calls.
5. **Save preview** downloads a local PNG. **Try demo mode** uses the fictional portraits and makes no paid calls.

`createAiStill()` is the legacy single-still "Optional AI photo" path. No UI button reaches it, but the browser test still exercises it. Do not delete it, and do not describe it to users as a current feature.

## Non-negotiable rules

**Privacy**
- Camera frames, landmarks, masks, background plates and skin samples stay in browser memory.
- Uploads happen only on the explicit actions above. Never upload continuously or per frame, never auto-generate on camera start or on a style/color change, and never retry a paid call automatically.
- Never persist portraits server-side.
- `MirrorlyAR.getStatus()` and `MirrorlyAiDiagnostics.getMetrics()` expose numbers only, never pixels, landmarks or identity data.
- Compositing inputs (`getCapturePose`, `createCaptureFaceMask`, `getLiveHairMask`) are local only.

**Display gate**
- `liveAiHairReady()` / `shouldDisplayAiHair` show hair only when a completed result matches the current style and color.
- Never show catalog GLB/PNG hair to the customer, whether as a placeholder, while generating, on failure, or after a selection change. A style or color change hides stale hair.

**Hair-only live texture**
- The tracked texture contains transparent hair pixels only; `repairSource` is always `null`. No generated face, neck, ear, clothing or room pixels.
- The central eye/nose/cheek/mouth/chin region is forced transparent.
- Elsewhere inside the face contour, a pixel is accepted only with both a material RGB change and support from the selected style's silhouette.

**Live camera pixels**
- Never apply cinematic wash, vignette, tone mapping or exposure changes to the live face.
- The only permitted live modification is real-hair removal, which runs while AI hair is displayed and outside the protected eyebrow-to-chin ellipse.

**Secrets**
- `OPENAI_API_KEY` is server-side only. Never ask for it in chat, print it, commit it, or put it in browser code or project files.

**Honesty**
- Live AI hair is single-view (or three-view) **2.5D**, not volumetric.
- Tests are synthetic. Do not claim Snapchat parity or pixel-perfect alignment without real-webcam evaluation across diverse customers.

## Live AR pipeline

1. **Tracking** (`ar.js`, `tracking.js`): Face Landmarker in VIDEO mode, with a GPU delegate and CPU fallback.
   - `fitFace` does a weak-perspective, robust fit of 15 canonical landmarks (Apache-2.0 canonical model, attribution in `tracking.js`), using the MediaPipe pose matrix for rotation.
   - The mirrored quaternion is `S R S`, with `S = diag(-1, -1, 1)`.
   - One Euro position/scale filtering and quaternion smoothing run once per detected frame.
   - On a missed detection the hair fades and is hidden by 220 ms. Filters reset on restart or reacquisition.
2. **Capture** (`createLiveAiHair`): requires a near-frontal pose.
   - It freezes the portrait, `getCapturePose()` (head origin, quaternion, depth samples, `personalAnchors`), the landmark face-contour mask, and the original-hair segmentation.
3. **Edit mask**:
   - Hairstyle silhouette (PNG alpha for the men's PNG-only styles; SVG path only when valid `viewBox`/`path` metadata exists).
   - Plus expanded original hair.
   - Minus the protected central face.
4. **Extraction** (`buildLiveAiMergedLayer`):
   - Segment the AI result locally and keep head-connected components (`selectHeadHair`, full long tails).
   - Fill small crown holes, and apply the face-contour and feature rules above.
   - Apply bounded RGB correction toward the capture's exposure, and feather edges clipped by the image border (tell the user to move back and regenerate).
   - The output is `source` and `foregroundSource` canvases, plus `profile.aiAttachment` (crop, capture pose, depth samples, `personalAnchors`, `skinReference`).
5. **Render** (`renderAiViews`):
   - A 48×8 strip per view: undo the capture rotation once, project through the current filtered pose about the head origin, then apply **personal registration**. This is a robust scale plus translation fit of the stored anchors to the customer's current landmarks, One Euro filtered.
   - Legacy attachments without anchors use the bounded forehead correction.
   - The depth-only 468-landmark occluder has sealed eyes and mouth. The foreground layer is drawn in front of it.
   - `aiViewBlend` draws the nearest view first and at most one neighbour over it. Each view fades over 30–45° from its own capture pose.
   - Material colour follows `setLiveSkinTone` relative to `skinReference`.
6. **Composite** (`compositeLiveAr`, `app.js`):
   - Mirrored camera, then `suppressLiveRealHair`, then the hairline contact shade, then the AR canvas.
   - Real-hair removal uses a second, VIDEO-mode Hair Segmenter on a 320-px mirrored frame. Covered pixels come from a background plate learned outside the head and torso envelope, otherwise from `pushPullFill`. The cover is rebuilt only when a new mask arrives.

## Tunable parameters

Change these only with a reason, then verify on a real face. Values are current as of 2026-10-08.

| Area | Setting | Where |
|---|---|---|
| Live capture gate | \|yaw\| ≤ 0.22, \|pitch\| ≤ 0.18, \|roll\| ≤ 0.14 rad | `createLiveAiHair` |
| Salon gates | front \|yaw\| ≤ 0.16; sides 0.18–0.58, opposite signs; pitch ≤ 0.24; roll ≤ 0.20; face width 16–52% of frame; hair coverage 0.8–62% | `assessSalonCapture` |
| Pose filter | position/center/forehead 2.3 / 0.28; scale 1.8 / 3.2; quaternion `3.8 + 6·travel/dt` | `PoseFilter` |
| Detection rate | interval `max(1000/60, 1.2 × inference ms)` | `ar.js update` |
| Attachment | mesh 48×8; `depthStrength` 0.32; fade 30°→45° per view | `buildLiveAiMergedLayer`, `shapeAttachmentMesh` |
| Registration | x/y filter 2.0 / 0.02, scale 1.5 / 0.5; reject scale outside 0.8–1.25 or shift > 0.3 face width | `ar.js`, `registerPersonalAnchors` |
| View blend | weight `coverage / (angle + 0.06)^4`, at most 2 views | `aiViewBlend` |
| Real-hair removal | 320 px; ≤ 30 Hz (`1.5 ×` segmentation ms); mask smoothstep 0.22–0.6, 1-px dilation; protected ellipse 0.42 fw × 0.40 fh centred +0.14 fh | `ar.js`, `suppressLiveRealHair` |
| Lighting | per-channel ratio 0.7–1.4 (sRGB), smoothing 0.12 | `updateViewLighting` |
| Edit mask | original-hair expansion 2.5% of face width (3–14 px); repair matte 1.5% (2–10 px) | `createLiveAiEditMask` |
| Extraction | semantic retention ≥ 0.05; alpha feather 0.035–0.52 | `selectHeadHair`, `buildLiveAiMergedLayer` |
| Uploads | portrait and mask PNG ≤ 1280 px; guides JPEG ≤ 1280; references JPEG ≤ 768, q 0.9 | `createAiUploadDataUrl` |
| API | GPT Image 2, `quality=medium`, `output_format=jpeg`, `output_compression=90`; size via `chooseAiOutputSize` (≥ 655,360 px, multiples of 16; 1280×720 → 1088×608) | `server.js` |
| Capture guide | centre 45% height; rx `min(17% w, 19% h)`; ry `min(30% h, 1.46·rx)` | `drawCaptureGuide` |
| Preview size | desktop `min-height: clamp(640px, 72vh, 780px)` | `styles.css` |

Twenty seconds is the AI latency *target* exposed by `/api/ai-status`, not a measured guarantee. Never abort a paid generation to meet it.

## Catalog and assets

- Eight cuts. Women: Bob, Feather, V Cut, U Cut. Men: Crew Cut, Buzz Cut, Curtain Bangs, Skin Fade.
- Five colors: Natural Black, Dark Brown, Chestnut Brown, Copper, Golden Blonde. Every cut supports every color. Keep the header count in sync with the catalog.
- **New PNG asset**:
  - Generate a front-facing, centered, hair-only overlay with an empty face opening: no face, ears, neck, text or background.
  - Use a removable chroma background if needed, then remove the chroma, despill, and check corners and strands.
  - Add `faceOpeningRatio`, `faceCenterYRatio` and optionally `faceOffsetXRatio` in `app.js`, and test on a real captured face.
  - Calibration is per style; do not move Bob/Feather when fixing others.
  - Increasing `faceOpeningRatio` makes the asset smaller. Decreasing `faceCenterYRatio` moves it lower.
- **GLBs** are internal (preload, `3d-smoke-test.html`, browser test):
  - Keep the licensed OBJ, textures and license notes under `assets-source/`.
  - Build with `npm run build:3d-assets`, load through the vendored `GLTFLoader`, and use uniform scale.
  - All eight profiles load CC0 MakeHuman-derived GLBs; Feather uses `feather-cc0.glb`. `feather-cc-by.glb` (CC BY 4.0 `o4saken_long01` by 04saken) is retained but unreferenced, so keep its attribution if it is ever re-enabled. Treat AI-generated meshes as drafts that need cleanup and license review.
- Use `ffmpeg` for media processing only if it is present. The old bundled copy under `Mirrorly_Video/` no longer exists.

## AI key and billing

`Set-MirrorlyApiKey-And-Restart.ps1` does **not** exist in this workspace. Check before you reference it.

Without the script:
- Have the user set the key themselves in their own terminal: `[Environment]::SetEnvironmentVariable('OPENAI_API_KEY', '<key>', 'User')`, entered locally, never in chat.
- Restart only the verified Mirrorly `node server.js` listener on port 4173. Do not stop an AI-enabled server if the stored key is unavailable.

Check presence without revealing the value: `[bool][Environment]::GetEnvironmentVariable('OPENAI_API_KEY','User')`, then `Invoke-RestMethod http://localhost:4173/api/ai-status` (confirm `available` and the quality/format fields).

| Symptom | Meaning / action |
|---|---|
| 503 from Mirrorly | Key missing. Set it and restart |
| 401 | Invalid key. Create a new project key; never reveal either key |
| Billing hard limit / insufficient quota | The key works but the project can't spend. Add credits or a payment method, or raise the project limit. Retry without a restart if it's the same project |
| Ordinary 429 | Rate limit. Wait and retry manually |

Never bypass billing, switch accounts silently, or lower quality while claiming billing is fixed. On failure, the live view stays camera-only.

## Git and publishing

- The repo is `MirrorlyLaptopApp/`, remote `https://github.com/keziavictor12-svg/Mirrorly.git` (public). Every committed file is world-visible, including history.
- `.gitignore` must cover `node_modules/`, `.env*` (except an intentional `.env.example`), `.edge*/`, logs, validation screenshots, and editor/OS metadata.
- Before committing:
  1. Run `npm run check` and the tests.
  2. Scan the staged diff and any unpushed commits for OpenAI/GitHub/AWS token patterns and private-key headers. Report filenames only.
  3. Review `git status --short` and stage files explicitly; don't sweep in the untracked DeepAR/RK3588 work.
  4. Update this file (and `CHANGELOG.md` for decisions).
  5. Commit on `main`, push without force, and verify that local and remote SHAs match.
- Check `git log origin/main..main` first. Unpushed commits will be published too.
- Never force-push or overwrite remote history without explicit approval. Never use account passwords; never print tokens. If a credential appears in chat, don't use it and tell the user to rotate it.

## UI rules

- Keep the dark teal and warm-gold salon look, the two-column women's/men's style selector, and a scrollable control panel so all 8 styles and 5 colors are reachable.
- Live AR is primary; the salon result is secondary. No AI LIVE / LIVE AR / TRUE 3D badges on cards.
- Demo mode switches between the male and female fictional portraits by cut category and uses `demoProfiles`. Never swap a real camera or captured portrait, and never infer a customer's gender.
- Keep the camera-privacy messaging and the simulation disclaimer. Keep the layout responsive for a salon laptop, tablet and mobile.
- No accounts, cloud storage, analytics, comparison UI or language options unless requested.

## Validation checklist

1. `npm run check`, `npm test`, and `npm run test:browser` against a freshly restarted server.
2. `/`, the JS files, every hairstyle PNG and every GLB return HTTP 200. `3d-smoke-test.html` loads all eight GLBs.
3. In Edge with a cache-busted URL:
   - The camera starts tracking but stays camera-only. AI hair appears only after explicit generation and matches the style and color.
   - Failure leaves the camera unchanged.
4. Move, scale, roll, yaw and pitch: the hair stays attached with no drift at the hairline, and fades past the covered range.
   - After a three-view salon result, turning hands over to the side views.
5. Real-hair removal: long original hair outside a short cut is covered with no visible smear once the background has been seen. Face, brows and beard are unchanged.
6. No room, face, neck, ear or clothing pixels in the hair texture. Eyes are natural, with no rear hair through the eyes, and long ends are not clipped.
7. All five colors on one short and one long cut. Pause/restart, the salon flow (gates, 3 views, save), return to live, and save preview.
8. Before publishing, complete the Git checklist.

The browser tests use synthetic landmarks, masks and mocked API responses. Passing them does not prove real-webcam quality.

## Known limitations

- Live AI hair is 2.5D: one view, or three after a salon result, extracted from generated photos. There is no back-of-head view, and ear- and hand-level occlusion is approximate.
- Real-hair removal fill:
  - It is soft until the room behind the head has been seen. Hair hanging below the eyebrows (fringe) is not removed, because that region is protected.
  - It requires the live segmenter. Without it, lighting gain is also inactive.
- The second segmenter adds main-thread and GPU load. Monitor `metrics.liveHairSegmentationMs` and `metrics.inferenceMs` on salon hardware.
- Image-border clipping can only be feathered, not reconstructed.
- Color choices tint the new hairstyle, not the customer's own hair.
- Demo PNG defects: magenta fringe on Feather, teal/ear gaps, and oversized Curtain Bangs. Fix the assets; don't hide the defects with blur or a dark wash.
- The six non-Bob/Crew GLBs use first-pass calibration.
- The app runs in a browser. There is no packaged Windows build; the RK3588 Android shell is untracked work in progress.
