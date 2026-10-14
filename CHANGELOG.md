# Mirrorly change history

Dated decisions moved out of `SKILL.md` on 2026-10-08. `SKILL.md` describes current behaviour only. The full earlier skill text is in git at commit `1bb767a`.

## 2026-10-11 — Snap Camera Kit live mirror

- The user asked for Snapchat-like AR. Banuba Web offers hair segmentation and recolouring but no ready-made 3D hairstyles; its wig try-on is a separate, non-live AI product. DeepAR renders whatever 3D models it is given, and Mirrorly's models are drafts. Snap Camera Kit is Snap's own lens engine and runs on the web, so it was chosen.
- Added `public/snap.js`, `snap-config.cjs`, `/api/snap-config`, a git-ignored esbuild bundle of `@snap/camera-kit@1.22.0` (Snap confidential, never committed), and `.env.example`. The local 2.5D AR remains the fallback.
- The user created a Snap account and the Camera Kit app "Mirrorly" (staging enabled). With the staging token and Snap's demo lens group, `npm run test:snap` loaded 23 demo lenses and rendered "CamKit Hair Color" through Mirrorly. The badge moved to its own element (the preview card's `::after` was already in use). A temporary `SNAP_LENS_MAP` maps all styles to the hair-colour demo lens until real haircut lenses exist.
- Edge's fake webcam ends after about 2 s, so the probe streams the demo portrait instead.
- Next: haircut lenses from Lens Studio's Hair Simulation template, starting with `bob`.
- Later the same day: `bob` was built from the Hair Simulation template (Mid-Length "Smooth Straight Gradient", Hair Brown) and published Hidden to the Lens Folder "Mirrorly Haircuts", then went into Snap review. In Lens Scheduler, that folder was added as a Lens Source and the Lens Group "Mirrorly Haircuts" (`3ee369af-965e-4445-b7ca-a74c8e3b8f68`) was created. `bob` cannot be added until it is approved. **Decision:** `.env.local` stays on the demo group until `bob` is in the new group, so the mirror never points at an empty group.

## 2026-10-12 — First haircut lens live

- `bob` became available overnight and was added to the "Mirrorly Haircuts" group. `.env.local` was switched to that group and the temporary `SNAP_LENS_MAP` was removed, so lenses are now matched by name (backup at `.env.local.bak2`). `npm run test:snap` applied `bob` and rendered a jaw-length bob on the demo portrait. Open points: the colour is ash-blonde regardless of the selected colour, and there are template sparkles near the head.
- **Webcam check failed at first:** the user saw Mirrorly's own AI hair instead of the lens. Cause: a race in `snap.js`, where concurrent `showLook` calls at camera start hid the lens. Fixed by sharing one session-setup promise and not bumping `lookVersion` on internal restarts. Added `getStatus().step`. After the fix, the lens shows on the real webcam (fringe hangs low over the eyes). The user decided to build the remaining seven lenses before the next full check.
- **Decision:** Claude builds the lens projects through Lens Studio 5.24's built-in MCP server (registered at user scope as `lens-studio`), and the user only publishes. The hairstyle mapping and the two styles without a template match (buzz cut, skin fade) are recorded in `SKILL.md`.
- `feather` project built through the MCP: `bob` was saved (the user's choice), then `project.saveTo` made `lens-studio\feather\feather\feather.esproj`, and Lens Studio switched to it. Wavy (top plus "Big Wavy Gradient Secondary" layers) is enabled in Hair Brown, the bob is off, and it was checked in the preview on "Idle Person 1". **Decision (user):** keep the template's `Vignette` and `Bokeh_VFX` (sparkles) in all lenses.
- `feather` was submitted. Lens Studio then restarted into an empty project. `feather` was reopened through `openProject`, and `v-cut` was built from it: Long Hair → Straight Long only, Hair Brown, previewed and saved.
- `v-cut` was submitted. Publishing left the project unsaved (`v-cut*`), and it was saved at the user's request. `u-cut` was built next. **Decision (user):** `u-cut` uses Straight Long, the same as `v-cut`, instead of the planned Messy Long. In the preview, Messy Long was a shaggy shoulder-length cut with strands across the eyes and mouth. The template has no other long, smooth style, and U versus V only differs at the back, which front-facing lenses barely show.
- `u-cut` was submitted and saved (`u-cut*` after publish), and `crew-cut` was built. Previewed on a man (`Idle Person 3`): Casual Short Straight is a chin-length blonde mop, and Pointy is a tall spike, so **Short Sleek** was chosen (short sides with a little height on top). On `Idle Person 2` (long hair), Bald ML hair hiding left the hair below the jaw visible.
- **Decision (user): dark brown for new lenses.** The template's "Hair Brown" has a pale-gold highlight (`Tweak_N17`) and a near-white sheen (`Tweak_N18`), so it looks golden-blonde. In `crew-cut` they were changed to a neutral dark brown (values in `SKILL.md`), previewed and saved. `bob`, `feather`, `v-cut` and `u-cut` keep the old colour until they are re-published as updates.
- `crew-cut` was submitted (no unsaved changes this time). `curtain-bangs` was built from it, with the dark brown carried over. On the male sample, Smooth Straight Gradient (middle part, sides falling to both sides) beat Wavy (too big and long). It was shortened with `HairVisual.strandCut` 0.55 (found in `editor.d.ts`), which gives it a different shape from `crew-cut`.
- `curtain-bangs` was submitted. `buzz-cut` was built as Short Sleek with `strandCut` 0.2 instead of hair hiding only: on `Idle Person 1` the real hair is fully hidden and there's a short textured top, but the sides look bald rather than stubbly.
- `buzz-cut` was submitted and saved (`buzz-cut*` after publish). `skin-fade` was built as Short Sleek with `strandCut` 0.5: a textured top with bare sides, which is distinct from buzz (0.2) and crew (1.0). **All eight lens projects are built**; the next step is Snap approval and adding them to the group.
- `skin-fade` was submitted. All seven new lenses are "under processing" in Snap review and can't be added to the group yet.
- The user reported all eight approved and added. `tests/snap-live-probe.cjs` now prints `lensNames`. It showed 5 lenses in the group; `curtain-bangs`, `buzz-cut` and `skin-fade` were missing. After the user added them, `test:snap` showed 8.
- **Fixed, `snap.js`:** `loadConfig()` cached a failed `/api/snap-config` fetch for the whole session, so one transient "Failed to fetch" at page load (seen in a webcam probe) disabled the Snap lenses until reload. A failed fetch now clears `configPromise`, so the next `showLook` retries. On a rerun, the webcam probe showed `feather` live on the real webcam.
- **User feedback:** "Snap lenses are working super good". The user wants the Snap watermark removed and colours that change with the selection and look realistic.
- **Decision:** colour via one script per lens that reads the existing `hairColor` launch param, not 40 per-colour lenses (submission limits, and five times the publishing). Values are hand-tuned per Mirrorly colour in the Lens Studio preview, because a formula made blonde lemon-yellow and copper dyed-red. Added to all 8 projects, with a dark-brown default. `snap.js` removes and re-applies the lens when only the colour changes, so the script runs again. All 8 lenses must be re-published as updates.
- All 8 updates were re-published, with Claude opening each project and the user publishing it. The `bob` update was verified live: `test:snap` switched Copper → Golden Blonde on the same lens, both natural. `test:snap` was fixed to use app.js's hex values and now reports the stalled step when `showLook` hangs (seen intermittently).
- **User feedback:** the colours look fine; the user wants more realistic hair, and U Cut and V Cut look the same. **Decision (user): template tweaks on all 8.** Strands are denser and finer, with half the blur. V Cut is long (0.85) and U Cut shoulder-length (0.6); the crew cut was trimmed to 0.75. The stepped cut was rejected because it leaves a dark clump under the chin. Each lens was previewed and saved; all 8 must be re-published as updates. Fully realistic hair would need custom hair models.
- The realism update went live (`bob` verified denser with colour switching). `test:snap` cleanup now tolerates Edge holding the profile (EPERM).
- **User feedback:** the men's lenses don't look like Mirrorly's card pictures. They were matched in Lens Studio: curtain bangs = straight centre part plus a wavy secondary layer; crew cut shortened to 0.6; skin fade 0.45 with messier noise; buzz cut 0.2, denser and calmer. The buzz cut's bald sides remain a template limit. These 4 must be re-published.
- The men's lenses were re-tuned to the user's reference photos (crew: 0.35, stiff, upright; skin fade: 0.45, calm, combed forward). A buzz with a fade was impossible in the template: grooms cut tiny clump into tufts, and the head meshes don't cover the scalp.
- **User feedback:** still not satisfied with the men's cuts; Feather "is a mess". **Decision:** Feather was rebuilt as Straight Long plus the wavy secondary layer. A **lens-creator brief** was written (Claude Docs) for realistic custom lenses, because the Hair Simulation template's fixed grooms have reached their limit.
- **Watermark:** this is Snap's staging-token watermark. It is removed only by Snap's app approval and the production token; no code workaround.

## 2026-10-13 — Less shiny hair

- **User feedback:** the lenses look "so shiny", which makes them look artificial. The shine comes from the Hair Simulation material: `Tweak_N14` is Primary Specular Intensity (template 0.9), and `Tweak_N18` is the Specular Light Color. (Other tweaks: `N13` Primary Diffuse Intensity 0.25, `N12` Hair Growth, `N10` Blur Multiplier, `N9` Alpha Test Threshold, `N19`/`N20` Lit Offset/Rotation.)
- **Change:** `MirrorlyHairColor.js` now sets `Tweak_N14 = 0.5` (`SPECULAR_INTENSITY`) and scales the sheen colour by 0.7 (`SHEEN_SCALE`). 0.4 looked flat; 0.5 kept a soft sheen. Checked in the Feather preview with dark brown and golden blonde. The same script was copied to all 8 projects (identical md5). Feather was saved; the user re-published all 8 as updates the same day.
- **Decision (user): "Option 1", presenting the live lens as a preview.** The user expects clients may still find the AR lens unnatural. The template's limits are reached, and no live AR cut looks fully real. So the live lens is presented as "shape and length, live", and the AI salon result as "the realistic look". Changes: `captureFaceButton` now reads **See realistic result** (`SALON_BUTTON_LABEL` in `app.js`), shown in the gold primary style (`.featured`) while a Snap lens is visible. A note `#snapPreviewNote` under the HUD ("Live preview of shape and length. Tap See realistic result for a photo-realistic look.") shows only with the lens. The HUD label "LIVE AI AR" became **LIVE PREVIEW**, and the start-screen text was rewritten to match. The other options are still open: a lens creator (brief ready), marketplace lenses, and another vendor (not recommended; other vendors are only better at recolouring the client's own hair).
- **Demo mode uses the Snap lenses (user: "apply everything to the demo mode").** Before, demo showed only the flat PNG overlays, so none of the new framing was visible there. Demo now streams the fictional portrait (a pre-mirrored 960×720 canvas at 30 fps) into Camera Kit, so it shows the same lenses and a demo version of the preview note. Added `tests/snap-demo-probe.cjs`; it passed on Bob (female portrait) and Crew Cut (male portrait).
- **2026-10-14: the less-shine updates are live.** Snap approved all 8 updates. `npm run test:snap` (8 lenses; `bob` Copper → Golden Blonde) and `tests/snap-demo-probe.cjs` (Bob, Crew Cut) passed, and the hair looks matte. No code change was needed.
- **Camera Kit app review findings:** the submission is in the Snap Kit portal (kit.snapchat.com/manage), not My Lenses. It needs a public privacy policy URL, demo videos that show the Camera Kit Terms of Service being displayed and accepted, branding, and Trusted Origins for web. Mirrorly does not show the Camera Kit terms yet.

## 2026-10-08 (webcam feedback) — Cheek gap and forehead window

- **Webcam result:** real-hair removal left a bright wall-coloured wedge beside the cheek, and a hard-edged hair "window" appeared on the forehead when the head tilted down.
- **Cheek wedge:** face protection was widened to the full face width. Hair beside the cheek and jaw is now filled with shadowed skin instead of room colour.
- **Forehead window:** `?debugLayers` showed it was the front (over-face) layer, which is cut along the frozen capture face contour and drawn without depth testing. Its contour edge is now feathered outward, and it fades from 20° to 35°.
- **Occlusion:** a probe showed the face mesh hid only 0.4% of the hair at 0.45 rad pitch, so occlusion was ruled out as the main cause. A 0.1-face-width back-layer bias was added anyway as a margin for real brows.

## 2026-10-08 — Live real-hair removal, personal registration, multi-view

- A VIDEO-mode Hair Segmenter runs on the live frame. The customer's own hair outside the new cut is covered with a learned background plate or push-pull fill. The face from the eyebrows down is protected.
- 26 rigid upper-face landmarks are stored at capture. Each frame, the AI layer is registered to the customer's own landmarks, which replaced the bounded canonical forehead correction. In synthetic tests, yaw/pitch drift of 4–8 px dropped below 0.25 px.
- The three salon views are reused as view-dependent live layers, extending coverage from about 45° to about 60–70°.
- A per-frame skin-tone gain keeps the hair matched to exposure and white-balance changes.
- A perspective camera was evaluated and rejected. Capture and render share weak-perspective fitting, so it would mostly cancel out.

## 2026-09-26 — Transparent live hair and forehead anchor

- The live texture became strictly hair-only. Reconstructed background from the generated portrait is never copied into the tracked texture. This fixed the doubled face and frozen room rectangle seen in webcam testing.
- The central facial-feature ellipse is opaque (protected) in the remote edit mask and forced transparent locally.
- A bounded forehead-anchor correction was added; it was superseded on 2026-10-08.

## 2026-09-24 — Live AR fine tuning

- Paid live generation requires a near-frontal capture: |yaw| ≤ 0.22, |pitch| ≤ 0.18, |roll| ≤ 0.14 rad.
- Edit-mask expansion around original hair was set to 2.5% of face width (3–14 px), and the repair matte to 1.5% (2–10 px).
- Semantic hair retention was lowered to 0.05, with alpha feathered from 0.035 to 0.52.
- Settings changed: a 48×8 mesh, 32% temple curvature, a 30–45° fade, and new pose-filter constants.
- The hairline contact shade now runs only when generated AI hair is active.

## 2026-09-23 — Guided salon result

- `Create salon result` replaced the automatic optional-photo action.
- Front, left and right views are captured with local quality gates. The front view is generated first; the two side views then run concurrently, using the front result as a consistency reference.
- Only `public/models/hair_segmenter.tflite` is served. The copy at the repository root is redundant.

## 2026-09-20 → 2026-09-23 — DeepAR experiment (removed)

- DeepAR hairstyle effects and an AI handoff were built, then removed in `d6dd53f`. The `.deepar` exports remain in git history. The license key was always read from the environment and never committed.
- The untracked local leftovers are the DeepAR SDK zip, `assets-source/deepar-studio-input/` and `free_package/`.

## Before 2026-09-23 — Feather model swap

- The Feather profile moved from `feather-cc-by.glb` to `feather-cc0.glb` (CC0 bob topology with Feather shaping). The previous skill text still described the CC BY model as the one in use; corrected on 2026-10-08.

## 2026-09-14 — Performance, contour, frontend

- Live AI hair and the AI photo were optimized while keeping medium quality: full-frame resizing, JPEG guides and references, and bounded JPEG output. The 8 shape-reference uploads went from 11,788,023 to 620,157 bytes. 20 seconds is a target, not a measured result.
- PNG-only men's styles use their decoded alpha silhouette as the edit-mask guide.
- The landmark face contour replaced the generic oval for the foreground split. Head-connected semantic components keep full-length V/U tails. Edges clipped by the image border get a localized feather.
- The live prompt treats the placement preview as geometry only: no CGI finish, and the webcam's own exposure, noise and light are kept.
- Hairstyle-card badges (AI LIVE, LIVE AR, TRUE 3D) were removed at the frontend's request. Demo mode uses fictional male and female portraits by cut category.
- A known issue was recorded: demo PNG defects (Feather magenta fringe, teal/ear gaps, oversized Curtain Bangs).

## 2026-09-13 — AI-only live attachment and tracking accuracy

- The customer-facing live view shows only completed, matching AI hair. Catalog GLBs and PNGs are kept for internal validation only.
- Capture-pose head anchoring was added: the capture quaternion is undone once, then the current pose is applied around the head origin.
- Weak-perspective fitting to 15 canonical landmarks with robust weights. One Euro filtering of position and scale, plus quaternion smoothing. Inference-adaptive detection up to 60 Hz. A sealed 468-landmark depth occluder.

## 2026-08-25 — Optional AI photo benchmark

- A medium-quality JPEG still completed in 30.4 s, versus 92.3 s for high-quality PNG. This is a comparison only; API latency varies.
