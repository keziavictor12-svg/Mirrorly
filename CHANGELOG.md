# Mirrorly change history

Dated decisions moved out of `SKILL.md` on 2026-10-08. `SKILL.md` describes current behaviour only. The full earlier skill text is in git at commit `1bb767a`.

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
