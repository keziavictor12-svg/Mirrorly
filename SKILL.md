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
- Repository copy of this skill: `MirrorlyLaptopApp/SKILL.md`
- Web entry point: `MirrorlyLaptopApp/public/index.html`
- Styling: `MirrorlyLaptopApp/public/styles.css`
- Camera, capture, fitting, tinting, and compositing: `MirrorlyLaptopApp/public/app.js`
- Local HTTP server: `MirrorlyLaptopApp/server.js`
- Secure API-key setup and server restart: `Set-MirrorlyApiKey-And-Restart.ps1`
- Final and source hairstyle assets: `MirrorlyLaptopApp/public/assets/hair/`
- Browser-ready true-3D hairstyles: `MirrorlyLaptopApp/public/assets/models/`
- Licensed 3D source meshes and textures: `MirrorlyLaptopApp/assets-source/makehuman-cc0/`
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

Open `http://127.0.0.1:4173/`. Add a unique query string such as `?v=YYYYMMDD-HHMM` after asset or JavaScript changes to bypass the browser cache.

Before starting another server, check port 4173. Reuse a working server or stop only the process that owns that port. Keep the root route query-safe: `/` with any query string must serve `public/index.html`.

## Current product scope

Maintain a laptop-local, single-salon experience:

1. Start the webcam locally.
2. Choose Live AR for continuous 478-point MediaPipe tracking, or use the enlarged face guide and portrait area for capture mode.
3. Track position, scale, roll, yaw, and pitch in Live AR, or capture a mirrored still frame.
4. Show the captured face with every hairstyle in the side cards.
5. Apply the selected hairstyle and color to the main portrait.
6. Automatically align the hairstyle from the captured MediaPipe face measurement using fixed internal fit defaults; do not expose manual fit controls or a Step 3 section.
7. After the user presses `Capture + AI merge`, automatically create an identity-preserving AI still that replaces hair pixels instead of layering a PNG.
8. Save a local PNG preview.

Keep live camera frames in browser memory. AI rendering is integrated into face capture: after the user presses the clearly labelled `Capture + AI merge` button, upload only the frozen portrait, AR placement preview, and selected hairstyle reference. Do not add a separate AI-render option. Do not upload continuously, persist portraits server-side, expose the API key to browser code, or add accounts, cloud storage, tracking, comparison UI, or language options unless the user requests them.

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
- Do not place hairstyles in a separate frame over live video. Capture the face first, composite it into the portrait, and show all styles in the side list.
- Keep the capture guide large enough for comfortable laptop positioning. The current guide is centered at 45% canvas height with horizontal radius `min(17% canvas width, 19% canvas height)` and vertical radius `min(30% canvas height, 1.46 * horizontal radius)`.
- Preserve the enlarged desktop preview area in `styles.css`: `min-height: clamp(640px, 72vh, 780px)`. Keep responsive overrides practical for tablet and mobile layouts.

Browser `FaceDetector` support is optional. The bundled MediaPipe model is the primary tracker. Keep alignment automatic with fixed internal defaults, provide retake as the recovery path when measurement is unavailable, and do not claim pixel-perfect automatic alignment.

Live AR is implemented with the bundled MediaPipe Face Landmarker model in `public/models/`, its local WASM runtime in `public/vendor/mediapipe/`, and a local Three.js renderer in `public/ar.js`. Bob Cut and Crew Cut are the first true-3D proof styles: they load CC0 MakeHuman meshes from `public/assets/models/*.glb`, use PBR lighting, a depth-only face occluder, the MediaPipe facial transformation matrix for yaw and pitch, mirrored landmark translation/scale, and crown/head pivots calibrated in `public/app.js`. The other six styles still render as tracked PNG planes and must be described as fallbacks, not true 3D. Keep the plane available while a GLB is loading or if loading fails.

For additional true-3D hairstyles:

1. Put licensed source OBJ, textures, and license notes under `assets-source/`; never lose provenance.
2. Add an MTL with diffuse/normal textures and run `npm run build:3d-assets` to create browser-ready GLBs.
3. Add a `model3d` profile in `public/app.js` with `src`, `anchor`, `canonicalFaceWidth`, offsets, occluder calibration, and license.
4. Load GLBs through the vendored Three.js `GLTFLoader`; do not convert them back to billboard planes.
5. Keep scale uniform. Use the MediaPipe pose matrix for rotation and 2D mirrored landmarks for stable screen translation/scale.
6. Verify the raw mesh on `3d-smoke-test.html`, then test on a real face at frontal and 15-30 degree head rotations.
7. Treat AI-generated meshes as draft geometry requiring Blender cleanup, scalp fitting, retopology/decimation, textures, pivots, and license review before shipping.

The final still is implemented by `POST /api/ai-render` in `server.js` using GPT Image 2 image editing. Face capture must first measure with MediaPipe, build the AR placement guide on an off-screen canvas, and then call the endpoint automatically. The visible main preview must hold the untouched captured portrait without an AR hairstyle or cinematic overlay until the final AI image is decoded; only then replace the captured portrait. The browser sends the untouched captured portrait first, the hidden AR composite second, and the tinted hairstyle asset third. Keep all three inputs because they preserve identity, placement, and cut shape; GPT Image 2 processes every image input at high fidelity automatically. Request `quality=medium`, `output_format=jpeg`, and `output_compression=90` to reduce latency while retaining salon-preview quality. Show elapsed time while AI finishes. A controlled local test on 2026-08-25 completed in 30.4 seconds versus 92.3 seconds for high-quality PNG; treat this only as a comparison benchmark because API latency varies. Keep `OPENAI_API_KEY` server-side as an environment variable. Treat the hidden AR result as placement guidance and the AI result as the photographic render within the same capture flow. Prompt the model to preserve identity, face, expression, body, clothing, background, crop, and lighting while replacing only hair. Never describe the hidden AR overlay itself as photorealistic AI hair replacement.

## AI key and billing operations

Use `Set-MirrorlyApiKey-And-Restart.ps1` for key setup. It prompts with `Read-Host -AsSecureString`, saves `OPENAI_API_KEY` at user scope, restarts only the Node `server.js` process listening on port 4173, and verifies `/api/ai-status`. Never request that the user paste a key into chat, print the stored value, commit it, put it in browser code, or write it to project files.

Run the setup utility in a visible PowerShell window:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\DELL\mirrorly\Set-MirrorlyApiKey-And-Restart.ps1"
```

Verify presence without exposing the value:

```powershell
[bool][Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
Invoke-RestMethod 'http://127.0.0.1:4173/api/ai-status'
```

Interpret common AI failures accurately:

- Missing key or HTTP 503 from Mirrorly: run the secure setup utility and restart.
- Authentication failure or HTTP 401: create a valid project key, rerun the setup utility, and do not reveal either key.
- Billing hard limit or insufficient quota: the key reached OpenAI, but its organization or project cannot spend. Keep the local AR capture visible, show a concise billing message, and do not break face capture. Open the Platform billing overview, organization/project limits, and usage dashboard. Add API credits or a payment method and raise the applicable hard spend limit for the project associated with the key. Retry without restarting when funding the same project; rerun the setup utility only when switching keys or projects.
- Ordinary HTTP 429 rate limit: distinguish request/image-per-minute throttling from a billing hard limit; wait and retry only for throttling.

Do not attempt to bypass billing limits, silently switch accounts, or reduce image quality while claiming the billing problem is fixed. Preserve the AR preview as a no-cost local fallback when AI rendering is unavailable.

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
5. Keep this source skill and `MirrorlyLaptopApp/SKILL.md` synchronized in the same commit.
6. Commit on `main`, push normally without force, and verify local and remote commit SHAs match.

Do not overwrite non-empty remote history without first fetching and reconciling it. Do not use force push unless the user explicitly requests it and the exact impact has been reviewed.

## UI rules

- Preserve the dark teal and warm-gold salon presentation.
- Keep women's and men's style labels in the two-column selector.
- Keep the control panel scrollable so all eight styles and five colors remain reachable.
- Keep the customer-facing flow limited to Step 1 (style) and Step 2 (color); do not restore the Step 3 fit-control section unless the user explicitly requests it.
- Keep the header count synchronized with the catalog.
- Preserve camera privacy messaging and the simulation disclaimer.
- Keep the interface responsive for a salon laptop and smaller screens.

## Validation checklist

After code or asset changes:

1. Run `npm run check` in `MirrorlyLaptopApp`.
2. Confirm `/`, `app.js`, every referenced hairstyle PNG, and every configured GLB return HTTP 200.
3. Open `/3d-smoke-test.html` and confirm both CC0 proof meshes load before testing the camera.
4. Open a cache-busted URL in Edge.
5. Start Live AR and verify Bob and Crew show the `TRUE 3D` badge, rotate volumetrically, and fall back cleanly if a mesh cannot load.
6. Capture a face and switch through all eight styles.
7. Check all five colors on at least one short and one long hairstyle.
8. Verify retake, before view, automatic alignment, and save preview.
9. If `OPENAI_API_KEY` is configured and funded, verify `Capture + AI merge` automatically creates the still without a separate AI button, replaces original hair, removes the hollow opening and fringe, preserves identity, and saves with an `ai-realistic` filename.
10. Check for exposed original hairlines, cheek/eye overlap, green or white fringe, hard seams, excessive shadow, and GLB clipping through the face occluder.
11. Confirm the enlarged capture guide and desktop portrait area remain visible without crowding the controls.
12. Before publishing, run the Git safety checks above, confirm the repository skill copy matches this file, and verify the pushed SHA.

## Known limitations

- Alignment is guide-based when the browser lacks `FaceDetector`.
- Bob and Crew have geometric depth occlusion, but Live AR does not yet perform semantic hair/ear segmentation. The integrated post-capture AI render handles the final photographic merge when billing is available.
- Feather, V, U, Buzz, Curtain Bangs, and Skin Fade remain PNG fallbacks until calibrated GLBs are sourced or generated.
- Color tinting recolors the overlay, not the customer's original hair.
- The app is browser-based and is not yet packaged as a Windows executable.
