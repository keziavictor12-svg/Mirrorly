---
name: mirrorly
description: Build, run, maintain, publish, and extend the local Mirrorly 3D Salon hairstyle try-on application and its supporting product materials. Use for Mirrorly camera capture, AR face tracking, photorealistic hairstyle overlays, AI hairstyle still rendering, OpenAI API-key setup or billing-limit troubleshooting, hair colors, face alignment, cinematic compositing, local server startup, GitHub synchronization, PowerPoint concept references, requirements documents, or packaging work in C:\Users\DELL\mirrorly.
---

# Mirrorly

Work only inside `C:\Users\DELL\mirrorly` unless the user explicitly expands scope. Preserve the customer's existing documents, generated source images, and unrelated worktree changes.

## Workspace map

- Application: `MirrorlyLaptopApp/`
- Git repository root: `MirrorlyLaptopApp/.git/`
- Public GitHub repository: `https://github.com/keziavictor12-svg/Mirrorly`
- Repository exclusions: `MirrorlyLaptopApp/.gitignore`
- Project skill/source of truth: `MirrorlyLaptopApp/SKILL.md`
- Web entry point: `MirrorlyLaptopApp/public/index.html`
- Styling: `MirrorlyLaptopApp/public/styles.css`
- Camera, capture, fitting, tinting, and compositing: `MirrorlyLaptopApp/public/app.js`
- Live pose fitting and temporal filters: `MirrorlyLaptopApp/public/tracking.js`
- Deterministic tracking regression tests: `MirrorlyLaptopApp/tests/tracking.test.cjs`
- Headless Edge/WebGL integration test: `MirrorlyLaptopApp/tests/browser-tracking.cjs`
- Local HTTP server: `MirrorlyLaptopApp/server.js`
- Secure API-key setup and server restart: `Set-MirrorlyApiKey-And-Restart.ps1`
- Final and source hairstyle assets: `MirrorlyLaptopApp/public/assets/hair/`
- Browser-ready true-3D hairstyles: `MirrorlyLaptopApp/public/assets/models/`
- Licensed 3D source meshes and textures: `MirrorlyLaptopApp/assets-source/makehuman-cc0/` and `MirrorlyLaptopApp/assets-source/makehuman-cc-by/`
- Reproducible OBJ-to-GLB build: `MirrorlyLaptopApp/scripts/Build-Mirrorly3DAssets.ps1`
- Internal GLB loader test: `MirrorlyLaptopApp/public/3d-smoke-test.html`
- Concept presentation and video/reference materials: `Mirrorly_Video/`
- Primary concept walkthrough: `Mirrorly_Video/Mirrorly_3D_Concept_Walkthrough.pptx`
- AI merge proof: `Mirrorly_Video/ai-merge-proof-feather.png`
- Product requirements and delivery plan: `Mirrorly_Product_Requirements_and_Delivery_Plan.md`
- Requirements variants: root-level `Mirrorly_*.docx` files
- Document/build automation: root-level `*mirrorly*.ps1` and `*Mirrorly*.ps1` files

## Start and verify

Run from PowerShell:

```powershell
Set-Location 'C:\Users\DELL\mirrorly\MirrorlyLaptopApp'
npm run check
npm start
```

Open `http://localhost:4173/`. Add a unique query string such as `?v=YYYYMMDD-HHMM` after asset or JavaScript changes to bypass the browser cache. DeepAR's current Web license is bound to `localhost`; the page redirects `127.0.0.1` requests to that licensed hostname.

Before starting another server, check port 4173. Reuse a working server or stop only the process that owns that port. Keep the root route query-safe: `/` with any query string must serve `public/index.html`.

## Current product scope

Maintain a laptop-local, single-salon experience:

1. Start the webcam locally.
2. Automatically enter Live AI AR after camera permission; do not require a captured photo to begin the hairstyle try-on.
3. Track face position, scale, roll, yaw, and pitch continuously and keep the selected hairstyle attached as the user moves.
4. Keep the customer-facing live preview camera-only until a completed AI hairstyle matches the selected style and color. Never show the catalog GLB/PNG first, while generating, after failure, or after a selection change. Keep the eight catalog GLBs for internal validation/preloading, not as a visible customer fallback.
5. Keep Optional AI photo as a secondary action that freezes the current pose and preserves the captured-face side-card workflow.
6. Automatically align live and captured hairstyles from MediaPipe measurements using fixed internal fit defaults; do not expose manual fit controls or a Step 3 section.
7. When the user explicitly selects Optional AI photo, create an identity-preserving AI still that replaces hair pixels instead of layering a PNG.
8. Save a local PNG preview.

Keep live camera frames and MediaPipe landmark processing in browser memory. Local tracking starts automatically after camera permission, but AI hair generation is an explicit paid action: **Create AI hair for live AR** captures/uploads one frame with a hidden placement guide, edit mask, and hairstyle reference, then applies the finished AI layer locally. Style/color changes hide stale hair and require an explicit generation for that look; do not silently make additional paid requests. Optional AI photo is the separate still-photo action. Neither action uploads continuously. Do not persist portraits server-side, expose the API key to browser code, or add accounts, cloud storage, tracking, comparison UI, or language options unless requested.

## Hairstyle catalog

Keep these eight photorealistic, hair-only overlays:

- Women's styles: Bob Cut, Feather Cut, V Cut, U Cut
- Men's styles: Crew Cut, Buzz Cut, Curtain Bangs, Skin Fade

Keep these five common colors:

- Natural Black
- Dark Brown
- Chestnut Brown
- Copper
- Golden Blonde

Every hairstyle must support every color and appear in both the captured-face side card and main preview.

## Asset rules

Store the final transparent PNG as `<style>.png` and retain its untouched generated input as `<style>-source.png`. Do not reference source files from the application.

For a new photorealistic hairstyle asset:

1. Generate a front-facing, centered, hair-only salon overlay with an empty face opening.
2. Exclude faces, eyes, ears, necks, shoulders, mannequins, text, watermarks, cast shadows, and backgrounds.
3. Use a uniform removable chroma background when transparency is unavailable.
4. Remove chroma, despill edges, and validate transparent corners and fine strands.
5. Add style-specific `faceOpeningRatio`, `faceCenterYRatio`, and optional `faceOffsetXRatio` values in `public/app.js`.
6. Test the asset on an actual captured face rather than only its standalone thumbnail.

Use `Mirrorly_Video/ffmpeg-tools/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe` for local image/video processing when needed. Python is not currently installed on this laptop; do not rely on Microsoft Store Python aliases.

## Alignment and realism

Treat alignment as style-specific. Do not change Bob or Feather calibration when correcting V, U, or men's cuts.

- Increasing `faceOpeningRatio` makes the full asset smaller and narrows its opening over the face.
- Decreasing `faceCenterYRatio` moves the asset lower; increasing it moves the asset higher.
- Use `faceOffsetXRatio` only for an asset whose visual center differs from its transparent face opening.
- Prefer small calibration changes and verify with a newly captured frame.
- Keep opacity at 100 by default.
- Preserve strand texture when applying dark colors; avoid heavy multiply tints.
- Apply the cinematic lighting wash and vignette after drawing both the captured frame and hair so they share one grade.
- After every new capture, measure the frozen mirrored frame with the bundled MediaPipe model and use its center, face bounds, and roll for the main portrait and all side-card previews.
- Use a soft hairline/contact shadow and light edge feathering; avoid hard halos or thick shadows.
- In live mode, render the tracked hairstyle in the transparent AR canvas over the mirrored camera feed so both layers share the same viewport. Keep captured-photo compositing separate and optional.
- Keep the capture guide large enough for comfortable laptop positioning. The current guide is centered at 45% canvas height with horizontal radius `min(17% canvas width, 19% canvas height)` and vertical radius `min(30% canvas height, 1.46 * horizontal radius)`.
- Preserve the enlarged desktop preview area in `styles.css`: `min-height: clamp(640px, 72vh, 780px)`. Keep responsive overrides practical for tablet and mobile layouts.

Browser `FaceDetector` support is optional. The bundled MediaPipe model is the primary tracker. Keep alignment automatic with fixed internal defaults, provide retake as the recovery path when measurement is unavailable, and do not claim pixel-perfect automatic alignment.

Live tracking uses the bundled MediaPipe Face Landmarker, local `hair_segmenter.tflite`, local WASM runtime, and Three.js renderer in `public/ar.js`. The numeric `MirrorlyAR.getStatus()` hook must not expose camera pixels or identity data. All eight textured catalog GLBs remain available in `public/assets/models/`: Bob/Crew are direct conversions, Feather uses attributed CC BY 4.0 `o4saken_long01`, and V/U/Buzz/Curtain/Skin Fade are deterministic CC0 MakeHuman variants. The customer-facing live view now displays only matching completed AI hair, not these catalog meshes or PNG fallbacks. Keep the raw camera unchanged while waiting; build the live placement reference off-screen. Segment both the frozen original portrait and AI result locally. Retain semantic AI hair even where its pixels barely changed. Keep replacement background in a separate, capture-screen-anchored repair texture, never in scalp or foreground hair. Split foreground hair using the measured landmark face contour with a soft contact margin, not a generic ellipse. On segmentation failure, use the fitted difference-mask AI layer without background repair, not catalog hair.

### AI-only live attachment (2026-09-13)

- `liveAiHairReady()` gates both `MirrorlyAR.update(..., showOverlay)` and compositing. Generation, missing/mismatched results, pause, or failure leaves the live camera unchanged. Do not auto-generate on camera start or style/color changes.
- `MirrorlyAR.getCapturePose()` supplies raw numeric head position, quaternion, face scale, and three forehead/temple depth samples for the frozen frame. Undo the capture quaternion before storing normalized crop points, then project them through the current filtered pose about the head origin. Preserve asymmetric crop offsets and pixel aspect ratio; do not apply the captured rotation twice.
- Render generated AI pixels in realism-first photographic mode: keep only about 12% of measured forehead/temple depth rather than bending the image into a rigid 3D sheet. This remains single-view **2.5D**, not a volumetric AI-generated hairstyle. Retain behind-face depth testing and a semantic-only foreground layer. Seal the tessellation's eye/inner-lip boundaries in the depth-only occluder to prevent rear hair leaking into the eyes.
- Keep full opacity within roughly 10 degrees of the captured front view, fade from about 10 to 15 degrees, and hide beyond that range; never invent unseen sides by displaying a distorted plane or reverting to catalog hair. Apply bounded RGB correction from unchanged portrait pixels so the AI hair retains the webcam's exposure and white balance. A new frontal generation is the recovery path.
- Reject results if the requested style/color or live session changed, including after local segmentation. Keep Optional AI Photo and its server endpoint unchanged during these live-only corrections.
- Hairstyle cards have no AI LIVE, LIVE AR, or TRUE 3D badge, per the 2026-09-14 frontend request. Do not imply that the personalized AI layer itself is a true-3D GLB.
- For crown transparency gaps, fill only small enclosed semantic-matte components above the upper-forehead limit. Preserve the outer silhouette and face opening, and retain the AI photo's RGB so scalp parting is not painted over. If a screenshot still says TRUE 3D, have the user reload the current build before evaluating the new live layer.

### Live contour, extent and dark-patch correction (2026-09-14)

- Freeze `MirrorlyAR.createCaptureFaceMask()` alongside the original portrait and raw capture pose. The local canvas follows the ordered 36-point face boundary with a soft margin; never expose it or the raw landmarks through diagnostics. Intersect semantic hair with this measured contour for the foreground layer so the forehead depth mesh does not cut a broad band out of valid hair.
- Use `selectHeadHair()` to keep whole semantic components touching the captured head seed. Inspect their full image extent, including long V/U tails below the seed; do not clip semantic hair with a fixed face-height ellipse. Ignore unrelated background hair components.
- If hair reaches the generated image border, feather alpha only along those clipped borders using `captureEdgeAlpha()`, and tell the user to move back/regenerate for the complete cut. Edge blending cannot reconstruct missing hair outside the capture. Never trigger a paid retry automatically.
- `buildLiveAiMergedLayer()` returns separate `source`, `foregroundSource`, and optional `repairSource` canvases with matching crop coordinates. `source` and `foregroundSource` contain hair only; replacement room pixels must never rotate or curve with the head.
- Render `repairSource` behind the face/hair at fixed capture-screen coordinates. In realism-first mode, `backgroundRepairOpacity()` starts fading after about 0.8% of a face width or roughly one degree of rotation and is gone well before the broader AI hair view limit. Hair remains tracked when a repair fades. The customer's original hair may become visible again during movement; a frozen repair is not live inpainting.
- Do not apply `applyCinematicFinish()`, vignette, contact shadows, tone mapping, or exposure changes to the live camera/face. AI hair textures use their original photographic RGB. Optional AI Photo and the non-live workflow remain unchanged.
- Treat the live placement preview and hairstyle image as synthetic geometry guides only. The live prompt must use them for silhouette, cut, hairline, length, and placement while explicitly rejecting their rendered material, repeated strand pattern, studio highlights, CGI/plastic finish, or lighting. Require irregular real strands, flyaways, density variation, natural roots/scalp, translucent edge wisps, and the original webcam's exposure, focus, noise, compression, white balance, and directional light. Keep this change live-only; do not modify the Optional AI Photo prompt when addressing a live AR complaint.
- Include the generic 468-vertex canonical fixture in tests with its upstream URL, hash, Apache-2.0 notice and license. Test forehead pixels outside the old oval, full long-hair extent, edge blending, rolled/translated repair disappearance with hair still visible, and unchanged live camera RGB. These controlled tests do not prove real-webcam perfection.

For maintaining or adding true-3D hairstyles:

1. Put licensed source OBJ, textures, and license notes under `assets-source/`; never lose provenance.
2. Add an MTL with diffuse/normal textures and run `npm run build:3d-assets` to create browser-ready GLBs.
3. Add a `model3d` profile in `public/app.js` with `src`, `anchor`, `canonicalFaceWidth`, offsets, occluder calibration, and license.
4. Load GLBs through the vendored Three.js `GLTFLoader`; do not convert them back to billboard planes.
5. Keep scale uniform. Use the MediaPipe pose matrix for rotation and 2D mirrored landmarks for stable screen translation/scale.
6. Verify the raw mesh on `3d-smoke-test.html`, then test on a real face at frontal and 15-30 degree head rotations.
7. Treat AI-generated meshes as draft geometry requiring Blender cleanup, scalp fitting, retopology/decimation, textures, pivots, and license review before shipping.

### Live tracking accuracy

Use the 2026-09-13 accuracy refinement in `public/tracking.js` and `public/ar.js`:

- Fit a uniform scale and head-origin translation against 15 canonical MediaPipe landmarks projected through the measured pose; use robust residual weighting rather than projected temple width. Preserve the canonical measurements' upstream URL and Apache-2.0 attribution. This is weak-perspective fitting, not physical head measurement or a calibrated perspective camera.
- Apply the full mirrored pose quaternion (`S R S`, with `S = diag(-1, -1, 1)`) to GLBs. Do not attenuate yaw/pitch using the old 35% depth default or independently combine Euler angles from different sources. Rotate each style's calibration offsets with the head and preserve its original anchor.
- Run time-based One Euro position/scale filtering and quaternion smoothing once per detected video frame, not per display frame. Keep filters across style/color changes, reset on restart or reacquisition, and reject malformed meshes.
- Process distinct video frames at an inference-time-adaptive interval with a 60 Hz ceiling; do not restore the fixed 66 ms / 15 fps limit. MediaPipe still runs synchronously on the main thread, so actual tracking speed depends on the laptop.
- Render the 468-landmark tessellated face as depth-only geometry instead of a flat circle. Keep it aligned with the filtered head pose; preserve behind-face versus foreground ordering for segmented AI planes.
- Fade briefly on missed detections and hide by 220 ms; never report active tracking before the first successful detection or while paused.
- Keep all eight GLBs intact for asset validation/preloading, but suppress GLB/PNG output in the customer-facing live view until matching AI is ready. Generated AI hair is non-volumetric and requires a forward-facing generation pose.
- Use the numeric `MirrorlyAR.getStatus().metrics` diagnostics for inference time, tracking fps, fit error, frame age, and occluder type. Do not expose landmarks, frames, or identity data through diagnostics.

Validate with `npm run check`, `npm test` and, with the local server running, `npm run test:browser`. Tests cover head/crop projection, depth curvature, eye/mouth topology closure, AI-only display gates, all eight internal GLBs, texture orientation, local semantic extraction, isolated background-repair retention/fading, measured foreground contours, long hair and cropped edges, unshaded camera pixels, excessive turns, pause/loss/reacquisition, and the actual preview waiting path. Fixtures are synthetic and make no camera or paid AI calls. They do not establish Snapchat-level accuracy on real people; verify diverse webcams, turns, lighting, ears, and hairlines before claiming that. Leave Optional AI Photo unchanged during live-only work.

The optional final still is implemented by POST /api/ai-render in server.js using GPT Image 2 image editing. Optional AI photo must freeze the current live pose, measure it with MediaPipe, build the AR placement guide on an off-screen canvas, and then call the endpoint. The visible main preview must hold the untouched captured portrait without an AR hairstyle or cinematic overlay until the final AI image is decoded; only then replace the captured portrait. The browser sends the untouched captured portrait first, the hidden AR composite second, and the tinted hairstyle asset third. Keep all three inputs because they preserve identity, placement, and cut shape; GPT Image 2 processes every image input at high fidelity automatically. Request quality=medium, output_format=jpeg, and output_compression=90 to reduce latency while retaining salon-preview quality. Show elapsed time while AI finishes. A controlled local test on 2026-08-25 completed in 30.4 seconds versus 92.3 seconds for high-quality PNG; treat this only as a comparison benchmark because API latency varies. Keep OPENAI_API_KEY server-side as an environment variable. Treat the hidden AR result and the AI result as the photographic render for this separate still-photo workflow. Prompt the model to preserve identity, face, expression, body, clothing, background, crop, and lighting while replacing only hair. Never claim that remote generative image editing runs on every live camera frame. Do not modify this Optional AI Photo path when refining live AI AR.

## AI request performance and format compatibility

The 2026-09-14 request explicitly authorized optimizing both Live AI hair and Optional AI Photo while retaining medium quality. Keep the optional-photo freeze/hold/identity-preservation flow intact; its transport settings may share the live optimization. Live-only tracking work still must not change the optional-photo workflow.

- All four men's catalog assets are PNG-only and have no SVG `viewBox` or `path`. `drawLiveAiStyleMask` must use the decoded PNG alpha silhouette for these styles; use an SVG path only when valid SVG metadata exists. Preserve each style's calibrated transform. Do not call `.split()` on an absent `viewBox` or invent an empty mask.
- Keep all three model inputs: portrait, hidden placement guide, and tinted cut-shape reference. `createAiUploadDataUrl` resizes the complete frame without cropping. Upload portrait and live edit mask as PNG with the same dimensions and a 1280-pixel maximum edge; retain the original captured canvas for the waiting preview. Opaque placement guides use JPEG with a 1280-pixel maximum edge; shape references use JPEG with a 768-pixel maximum edge and quality 0.9.
- Both endpoints accept PNG or JPEG references with correct MIME types and filenames. Portrait and alpha edit mask remain PNG. Keep legacy PNG-reference clients working. If the page reports "AR placement preview must be a PNG image" after this change, the old server is still running: restart the verified Mirrorly listener, not just the browser.
- Both endpoints use GPT Image 2, medium quality, JPEG output, and compression 90. `chooseAiOutputSize` targets the model's 655360-pixel minimum, rounding edges up to multiples of 16 and retaining the whole frame's aspect ratio approximately. A 1280x720 upload requests 1088x608; do not restore `size=auto` for optional photos or full-resolution PNG output for live hair without reviewing latency.
- Warm the bundled local Hair Segmenter after live tracking initializes. Cache one initialization promise. This must not upload frames, generate AI images, or introduce automatic paid retries or per-frame/style-change generation.
- Show elapsed live-generation time. `MirrorlyAiDiagnostics.getMetrics()` records numeric preparation, request, API, post-processing, and total milliseconds for both flows in browser session memory only. Server responses expose numeric timings and `/api/ai-status` exposes the 20-second target, not a deadline. Never include portraits, keys, or landmarks in diagnostics.
- Twenty seconds is a target, not a confirmed benchmark or guarantee. Do not abort paid generation at 20 seconds and call that a speed improvement. Measure a newly consented generation before reporting real latency; model load, remote generation, and network variation remain outside the browser's control.

Validate with `npm run check`, `npm test`, and `npm run test:browser` against the restarted server. The current suite has 35 unit tests plus real Edge/WebGL checks for 8 styles x 5 colors, decoded masks/JPEG references, full-frame resizing, one local warmup, both actual frontend actions, DeepAR's 40-look manifest, and numeric timings. API responses are mocked; tests use generic fixtures and make no paid requests. The eight shape-reference uploads measured 11788023 bytes before versus 620157 bytes after (about 95% smaller); this is a transport comparison, not proof of 20-second AI generation.

## AI key and billing operations

Use `Set-MirrorlyApiKey-And-Restart.ps1` for key setup. It prompts with `Read-Host -AsSecureString`, saves `OPENAI_API_KEY` at user scope, restarts only the Node `server.js` process listening on port 4173, and verifies `/api/ai-status`. Never request that the user paste a key into chat, print the stored value, commit it, put it in browser code, or write it to project files.

Check that this utility actually exists before invoking it; it was absent from this workspace on 2026-09-14. For a restart with an already configured key, read the user-scoped key without displaying it, verify the exact Node listener on port 4173 belongs to Mirrorly, and launch the absolute `server.js` in the app directory with the key inherited and `-WindowStyle Hidden`. Do not stop the existing AI-enabled server if the stored key is unavailable. Verify `available`, `quality`, and both output formats after restarting.

Run the setup utility in a visible PowerShell window:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\DELL\mirrorly\Set-MirrorlyApiKey-And-Restart.ps1"
```

Verify presence without exposing the value:

```powershell
[bool][Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
Invoke-RestMethod 'http://localhost:4173/api/ai-status'
```

Interpret common AI failures accurately:

- Missing key or HTTP 503 from Mirrorly: run the secure setup utility and restart.
- Authentication failure or HTTP 401: create a valid project key, rerun the setup utility, and do not reveal either key.
- Billing hard limit or insufficient quota: the key reached OpenAI, but its organization or project cannot spend. Keep the local AR capture visible, show a concise billing message, and do not break face capture. Open the Platform billing overview, organization/project limits, and usage dashboard. Add API credits or a payment method and raise the applicable hard spend limit for the project associated with the key. Retry without restarting when funding the same project; rerun the setup utility only when switching keys or projects.
- Ordinary HTTP 429 rate limit: distinguish request/image-per-minute throttling from a billing hard limit; wait and retry only for throttling.

Do not bypass billing limits, silently switch accounts, or reduce quality while claiming billing is fixed. The current live customer fallback is the untouched camera, not a catalog AR overlay. Keep the captured still held in the optional photo path.

## DeepAR provider

DeepAR Web SDK 5.6.22 is installed through `deepar`. `public/deepar.js` is the customer-facing adapter; it reuses the existing camera video element, renders into `#deeparRoot`, switches the effect matching the selected style/color, pauses with Live AR, and exposes the rendered canvas for local snapshots. Keep the isolated validation surface at `public/deepar-test.html`, served from `/vendor/deepar/`.

- DeepAR cannot initialize without `DEEPAR_LICENSE_KEY`; load it from the ignored local environment or server environment and never commit or print it.
- Store exported DeepAR Studio effects at `public/assets/deepar/effects/<style-id>-<color-slug>.deepar`. `deepar-config.cjs` defines and tests the exact 8 x 5 manifest.
- Activate DeepAR only when the current selection has a matching effect. If a look is missing or switching fails, pause DeepAR and immediately restore the existing local live renderer so a stale wrong effect is never visible.
- `DEEPAR_EFFECT_URL` may point to a licensed effect for the isolated smoke test only. The default test uses the SDK's bundled sample effect.
- Do not represent successful SDK loading as successful hairstyle replacement; the license and engine do not convert PNG or GLB assets into DeepAR effects.
- Do not modify or route Optional AI Photo through DeepAR. Keep `/api/ai-render`, its capture flow, and its existing model inputs unchanged.

### DeepAR hairstyle export handoff (2026-09-21)

All eight base hairstyle effects are exported from their own imported GLB and installed in `public\assets\deepar\effects\`. The shared base effect for each style serves all five color selections through the `MeshRenderer` material color uniform, so `/api/deepar-config` reports 40 configured looks when the DeepAR key is available.

- Editable Studio projects: `assets-source\deepar-studio-input\<style>.deeparproj`; Bob uses `Bob_f.deeparproj`. DeepAR Studio 4.5.2.139 is installed at `C:\Program Files\DeepAR Studio\deepar_studio.exe`.
- App effects: `bob.deepar`, `feather.deepar`, `v-cut.deepar`, `u-cut.deepar`, `crew-cut.deepar`, `buzz-cut.deepar`, `curtain-bangs.deepar`, and `skin-fade.deepar`. Every package has a distinct SHA-256 hash and contains its style's own Studio-imported mesh and material resources.
- Corrected Hair-node transforms use identity rotation and uniform scale. Bob `[0, -45, -8.7]`, scale `7.5`; Feather `[-0.45, -44.55, -8.85]`, scale `7.5`; V Cut `[0, -43.5, -8.85]`, scale `7.5`; U Cut `[0, -43.5, -8.85]`, scale `7.5`; Crew Cut `[0, -65.125, -11.13]`, scale `8.5`; Buzz Cut `[0, -61.98, -10.62]`, scale `8.5`; Curtain Bangs `[0.255, -53.055, -10.28]`, scale `8.5`; Skin Fade `[0, -57.56, -10.45]`, scale `8.5`.
- The old copied Bob transform `[15.0088615, -9.0701027, 8.1312523]`, tilted rotation, and nonuniform scale caused the hair to float above the face. Do not restore it. The corrected values were calibrated against each source GLB's bounds and the Studio head reference.
- Export source mapping: `BOB_final.deepar` to `bob.deepar`, `feather.deepar`, `V-cutv.deepar` to `v-cut.deepar`, `u-cut.deepar`, `crew-cut.deepar`, `epbuzz-cut.deepar` to `buzz-cut.deepar`, `curtainbang.deepar` to `curtain-bangs.deepar`, and `skinfade.deepar` to `skin-fade.deepar`. The `epbuzz-cut` name was a native Save-dialog artifact; it is the final Buzz build exported from the corrected project.
- Temporary Studio helpers remain in `C:\Users\DELL\AppData\Local\Temp\mirrorly-deepar-reference-20260920\`: `Send-StudioFileDrop.ps1`, `Link-StudioHair.ps1`, and `Studio-Interact.ps1`. Studio export dialogs may require scrolling before the final Export button appears. Confirm the foreground process before GUI automation because the user's desktop may be active.
- Use `http://localhost:4173/` for the licensed camera test. The current license rejects `127.0.0.1`; `public/index.html` redirects that hostname to `localhost` before DeepAR starts. A DeepAR watermark is controlled by the DeepAR license tier and is separate from mesh alignment.
- Keep the editable project directories as local working sources unless the user explicitly requests committing their large generated caches. Commit the compiled app effects and this reproducible transform record. For future fitting, change one style's `Hair` node only, reopen the saved project, inspect against the Studio head, export, replace its app file, and rerun the DeepAR tests.
- Studio head-reference calibration is complete. A final real-camera review should check frontal fit and moderate yaw on more than one person before production sign-off; hairstyle geometry cannot guarantee identical hairline coverage for every head shape.
- Validation on 2026-09-22 passed `npm run check`, all 35 unit tests, and the Edge/WebGL browser suite. The running licensed configuration reported 40 of 40 looks across eight unique base effects.
## Git repository and safe publishing

Keep the Git repository scoped to `MirrorlyLaptopApp/`. The configured remote is:

```text
https://github.com/keziavictor12-svg/Mirrorly.git
```

The destination repository is public. Before every push, assume all committed files are visible to anyone and verify that no customer photos, local browser profiles, API keys, passwords, tokens, or environment files are staged.

Keep `.gitignore` protecting at least:

- `node_modules/`
- `.env` and `.env.*`, except an intentional `.env.example`
- `.edge*/` browser-test profiles
- logs and runtime output
- generated validation screenshots
- editor and operating-system metadata

Never use or store an account password for GitHub operations. Authenticate with GitHub CLI browser authorization, Windows Credential Manager, a narrowly scoped token, or SSH. Never print an authentication token. If a credential is pasted into chat or another exposed surface, do not use it and instruct the user to rotate it.

Before committing:

1. Run `npm run check`.
2. Run a staged secret-value scan for OpenAI/GitHub token patterns and private-key headers; report filenames only and never echo matched values.
3. Review `git status --short` and the staged file list.
4. Confirm `node_modules`, `.edge*`, local environment files, and validation screenshots are ignored.
5. Update `MirrorlyLaptopApp/SKILL.md` with changed behavior and synchronize any additional local Mirrorly skill copy if one exists.
6. Commit on `main`, push normally without force, and verify local and remote commit SHAs match.

Do not overwrite non-empty remote history without first fetching and reconciling it. Do not use force push unless the user explicitly requests it and the exact impact has been reviewed.

## UI rules

- Preserve the dark teal and warm-gold salon presentation.
- Keep live AI AR primary and Optional AI photo secondary. Local camera/tracking, style/color selection, pause/restart, and saving work without optional-photo capture; creating personalized live AI hair explicitly uploads one frozen frame.
- Keep women's and men's style labels in the two-column selector.
- Keep hairstyle thumbnails free of AI LIVE badges. In demo mode only, use the bundled fictional photographic male portrait for men's cuts and female portrait for women's cuts; switch the main portrait and use each card's own category portrait. `demoProfiles` fits these fixed assets, not customer faces. Never replace a real camera/captured portrait based on the selected category, infer a customer's gender, or make paid demo-generation requests. Source images and prompts are documented under `public/assets/demo/`.
- Keep the control panel scrollable so all eight styles and five colors remain reachable.
- Keep the customer-facing flow limited to Step 1 (style) and Step 2 (color); do not restore the Step 3 fit-control section unless the user explicitly requests it.
- Keep the header count synchronized with the catalog.
- Preserve camera privacy messaging and the simulation disclaimer.
- Keep the interface responsive for a salon laptop and smaller screens.

## Validation checklist

After code or asset changes:

1. Run `npm run check` in `MirrorlyLaptopApp`.
   Also run `npm test` and `npm run test:browser` after live-tracker changes; keep the local server running for the browser test.
2. Confirm `/`, `app.js`, every referenced hairstyle PNG, and every configured GLB return HTTP 200.
3. Open `/3d-smoke-test.html` and confirm all eight labeled GLB meshes load and rotate before testing the camera.
4. Open a cache-busted URL in Edge.
5. Confirm hairstyle-card badges are absent and the photographic demo switches male/female portraits with the cut category, including category-specific side cards. Start the live mirror and confirm local tracking starts but the customer view stays camera-only. Create AI hair explicitly; reveal it only after decoding/segmentation. Verify generation/failure waiting behavior and suppression of catalog GLB/PNG output.
6. Move the test face and verify the pose changes while tracking stays active; confirm the multi-landmark anchor remains stable during translation, scale, roll, yaw, and pitch changes.
7. Verify generated room pixels are absent from hair textures. Keep the bounded repair separate, screen-anchored, and faded during movement. Foreground strands follow the measured face contour, rear pixels are occluded, eyes remain natural, long ends are not clipped by a fixed ROI, and hair fades during excessive turns. Live camera RGB must not receive cinematic shading.
8. Check all five colors on at least one short and one long hairstyle.
9. Verify pause/restart, Optional AI photo, return to live mirror, automatic alignment, and save preview.
10. If OPENAI_API_KEY is configured and funded, verify Optional AI photo creates the still without changing the live try-on into a capture-first flow, replaces original hair, removes the hollow opening and fringe, preserves identity, and saves with an ai-realistic filename. Confirm its client and server blocks remain unchanged when only live AR is being refined.
11. Check for exposed original hairlines, cheek/eye overlap, green or white fringe, hard seams, excessive shadow, and GLB clipping through the face occluder.
12. Confirm the enlarged capture guide and desktop portrait area remain visible without crowding the controls.
13. Before publishing, run the Git safety checks above, confirm the repository skill copy matches this file, and verify the pushed SHA.

## Known limitations

- The bundled photographic demo still uses static transparent hairstyle PNG compositing. Review on 2026-09-14 found magenta edge contamination on Feather Cut and visible teal/ear gaps where transparent hair is layered over the portrait instead of inpainted into it. Curtain Bangs is also oversized and too voluminous for its men's-style label, even with demo-only scaling. Treat these as catalog-asset defects, not portrait-category switching or live-tracker errors.
- Before claiming photographic demo quality, replace or despill the affected cuts with clean-alpha, hair-only assets and recalibrate their demo-only profiles against both bundled portraits. Do not hide edge defects with a dark wash or heavy blur, and do not change customer/live calibration to compensate for fixed demo assets.
- Captured-photo alignment is guide-based when measurement is unavailable; the primary Live AI AR path uses the bundled MediaPipe tracker.
- The local Hair Segmenter isolates generated live hair and the face-depth occluder handles front/back ordering, but fine ear-level occlusion and strand-level geometry are still approximate. The optional AI photo handles final photographic blending when billing is available.
- GPT Image editing is intentionally not called per video frame; live movement comes from local MediaPipe tracking plus Three.js rendering.
- The six newly added GLB profiles use a balanced adult-head first-pass calibration; validate and refine their anchors across diverse real faces before production salon rollout.
- The AI layer uses measured depth but is single-view 2.5D, not personalized scalp geometry or calibrated perspective. Its separate original-hair repair uses one frozen AI background and fades during head movement; original hair can reappear, and camera/lighting changes cannot always be inferred from head pose. Large turns hide hair; robust multi-view replacement and ear/hand occlusion require further work. Clipped image borders can only be blended, not reconstructed. Do not claim Snapchat parity from synthetic tests.
- Color tinting recolors the overlay, not the customer's original hair.
- The app is browser-based and is not yet packaged as a Windows executable.
