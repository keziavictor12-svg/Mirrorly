---
name: mirrorly
description: Build, run, maintain, test, and publish the Mirrorly laptop hairstyle try-on app in C:\Users\DELL\mirrorly. Use for the Snap Camera Kit live mirror and Snap hair lenses (Lens Studio, lens groups), live AR face tracking and AI hair attachment, real-hair removal, guided three-view salon results, hairstyle catalog and colors, OpenAI key or billing troubleshooting, local server startup, tests, and GitHub publishing.
---

# Mirrorly

Mirrorly is a laptop-local, single-salon hairstyle try-on app. Local MediaPipe tracking runs in the browser. Paid OpenAI image edits run only when the user explicitly asks for one. Work only inside `C:\Users\DELL\mirrorly` unless the user widens scope, and preserve unrelated files and worktree changes. This file describes current behaviour; dated history and rationale are in `CHANGELOG.md`.

## Current status and next steps (updated 2026-10-13)

Read this first in a new chat; it is the hand-off point.

**Resume checklist (the user will say "continue mirrorly" after restarting Claude Code):**
1. `ToolSearch` for `+lens-studio`. If no tools are found, the session predates registration or Lens Studio is closed: check `Get-Process "Lens Studio"` and port 50040, and re-register if the token changed (see "Lens Studio MCP" below).
2. Read the project `AGENTS.md` (`lens-studio\bob\bob\AGENTS.md`), then introspect the open scene through the MCP before changing anything. If the window title shows `*` (unsaved), ask before saving or discarding.
3. Build one lens at a time (mapping below, but `u-cut` uses Straight Long and `crew-cut` uses Short Sleek; `curtain-bangs` uses Smooth Straight with `strandCut` 0.55; `buzz-cut` uses Short Sleek with `strandCut` 0.2 and `skin-fade` uses 0.5; all eight done. Copies inherit `strandCut` changes, so reset them. Publishing leaves the project unsaved (`*`); the user chose to save it before the next copy) with the recipe under "How Claude builds the next lens". Then hand over to the user to Publish (new lens, Hidden, folder "Mirrorly Haircuts", exact lens name).
4. After Snap approves the lenses: the user adds them to group "Mirrorly Haircuts" and saves. No `.env.local` change is needed (name matching). Verify with `npm run test:snap` and `node tests/snap-webcam-probe.cjs`.
5. Keep `SKILL.md` and `CHANGELOG.md` updated after each lens.

**Goal set by the user:** the live mirror must look and behave like Snapchat haircut lenses. Mirrorly's own 2.5D AI layer cannot reach that (a flat photo has no sides or back, and image APIs take 20–30 s per image). The chosen route is **Snap Camera Kit** for the live mirror, with the OpenAI **salon result** kept for the photo-realistic take-home still.

**Done and verified on 2026-10-11:**
- Snap Camera Kit is integrated (see "Snap Camera Kit live mirror" below).
- The user's Snap account and Camera Kit app "Mirrorly" exist in the organization "Mirrorly". The **staging** token is enabled; production status is "Unknown" (no version set yet).
- `.env.local` (since 2026-10-12) holds `SNAP_CAMERA_KIT_API_TOKEN` (staging) and `SNAP_LENS_GROUP_ID=3ee369af-965e-4445-b7ca-a74c8e3b8f68` (the user's "Mirrorly Haircuts" group). There is no `SNAP_LENS_MAP`; lenses are matched by name. Backups: `.env.local.bak` (before Snap) and `.env.local.bak2` (the demo-group setup: group `728e36d7-90b6-42e6-88ec-9982fbd32575` with Snap's 23 sample lenses, plus a map pointing every style at "CamKit Hair Color" 43293650876). Both are git-ignored.
- `npm run test:snap` and `node tests/snap-webcam-probe.cjs` both pass with `bob` (2026-10-12).
- Also done (2026-10-08 webcam feedback): the real-hair cover no longer paints a wall-coloured wedge beside the cheek, and the front over-face AI layer feathers its edge and retires from 20° to 35°.

**Committed (2026-10-14):** the Snap integration, preview framing, demo lenses, cheek and front-layer fixes, `?debugLayers`, tests and docs are in commit `d212236` on `main`, at the user's request. **Pushed** to `origin/main` on 2026-10-14 (the user confirmed the repo stays public). Later commits: ask before pushing. Left untracked on purpose: the DeepAR and RK3588 work, `public/assets/deepar/`, the root `hair_segmenter.tflite` copy and two unreferenced review GLBs (`review-short-messy.glb`, `review-short03-raw.glb`). The `lens-studio/` folder is outside the repo. Never stage `.env.local`, `.env.local.bak*` or `public/vendor/snap/`.

**Latest (2026-10-12, late): the user is still not satisfied with the men's cuts, and Feather "is a mess".** Decision (user): save a new Feather and write a lens-creator brief. **Feather** is now Straight Long (0.8, density 80, width 0.84) plus Wavy's "Big Wavy Gradient Secondary" (Wavy's top HairVisual disabled), saved but **not yet re-published**. Tried and rejected: adding Smooth Straight as a middle layer (it looked like a bob with extensions). The template has reached its limits (fixed groom shapes, no stubble or fades). **Lens creator brief:** Claude Docs doc "Mirrorly Lens Creator Brief", https://claude.ai/code/artifact/6cb3b50e-e7cb-49ad-ac01-33ff2948d232 (private until the user shares it). It covers the eight lens names, look and must-haves, the `hairColor` hex values, Lens Studio 5.24 / SDK 1.22.0, hiding real hair, performance, acceptance checks, and a reference-image mapping. Next: the user republishes Feather (and the 4 men's updates, if not done), shares the brief with a creator, and gets Snap approval → `test:snap` → check in Edge.

**Latest (2026-10-13): less shine.** The user said the hair looked "so shiny", so artificial. `MirrorlyHairColor.js` now lowers the material's Primary Specular Intensity (`Tweak_N14`, template 0.9) to 0.5 and scales the sheen colour (`Tweak_N18`) by 0.7. It was checked in the Feather preview (dark brown, golden blonde) and copied to all 8 projects; Feather is saved. **Published (2026-10-13):** the user re-published all 8 as updates (feather, bob, buzz-cut, crew-cut, curtain-bangs, skin-fade, u-cut, v-cut); this includes the rebuilt Feather. **Next:** once Snap approves them, the user checks in Edge. If it is still too shiny, lower `SPECULAR_INTENSITY` (0.4 looked flat) or `SHEEN_SCALE`, in one copy, then copy it to all 8.

**Latest (2026-10-13, later): Option 1, preview framing (uncommitted; check, unit and browser tests pass).** The user asked what to do if the client still finds the lens unnatural. Options given: (1) present the live lens as a preview and the AI salon result as the realistic look, (2) a lens creator using the brief, (3) marketplace lenses, (4) another vendor (not recommended). The user chose **option 1**, now implemented (see "Snap Camera Kit live mirror" → Preview framing). Next: the user checks it in Edge with a Snap lens running (reload with a new `?v=`), and decides on option 2 if the client wants a better live look. Feather was also reopened in Lens Studio (a stray `v-cut` window opened with it). **Then (same day), demo mode got the Snap lenses too:** the user said "apply everything to the demo mode" and that they saw no change (the note only appeared with a live lens, and demo never used Snap). Demo now streams the fictional portrait into Snap. Verified with the new `node tests/snap-demo-probe.cjs`: Bob on the female and Crew Cut on the male portrait, both `shown`, with the demo note. Screenshots are `%TEMP%\mirrorly-snap-demo-women.png` and `-men.png` (fictional portraits, OK to view). Camera Kit app review: the submission is in the **Snap Kit portal** (kit.snapchat.com/manage), not My Lenses. Every field is required: a public privacy-policy URL, demo videos that show the **Camera Kit Terms of Service being displayed and accepted** (Mirrorly has no such screen yet), branding, and web **Trusted Origins** under Platform Identifiers (it is unknown whether localhost is accepted). Offered: a terms screen plus privacy-policy text; the user hasn't answered. **Form state (user's screenshot, 2026-10-13):** the description is filled in; the "generate content for Snapchat" checkbox should be **unticked** (Mirrorly posts nothing to Snapchat); the "How does your integration work?" text was supplied (it mentions the ToS acceptance, so the app needs that screen before submitting); the Privacy Policy URL (must be HTTPS) is still empty; demo videos are not recorded. Submit was blocked with "Enter at least one Platform ID". Advised: Stage Production, Origin `http://localhost:4173` (fallback `http://127.0.0.1:4173`; otherwise a real domain, e.g. under asyncsolution.com). The production token only works on the listed origins. The user is trying this now.

**Earlier (2026-10-12, late): the 4 men's lenses were re-tuned (cards plus the user's reference photos) and re-published one by one: buzz-cut, skin-fade, crew-cut, with curtain-bangs last. Next: after Snap approval, `test:snap`, then the user checks the men's styles in Edge. Then ask about committing.** The user said the men's styles didn't look like the cards ("yes" confirmed that meaning).
- **curtain-bangs:** Smooth Straight Gradient `strandCut` 0.55 (centre part) plus Wavy's "Big Wavy Gradient Secondary" layer at 0.6 for wavy volume. Wavy's *top* HairVisual component is disabled (`enabled = false` on the component, object on). Wavy alone was a mop with the fringe over the forehead.
- **crew-cut:** Short Sleek **0.35**, `stiffness` **1.0** (stands up), `noise` **0.5**, `density` **60**. Reference photo from the user: `C:\Users\DELL\Pictures\crew.jpg` (short bristly top brushed up, high fade). The earlier 0.6 version was replaced.
- **Reference photos from the user** (keep using them for these styles): crew `Pictures\crew.jpg`, skin fade `Pictures\download.webp`, buzz `Pictures\buzz-cut-with-fade-buzzcut-number-3.webp`.
- **skin-fade:** Short Sleek **0.45**, `noise` **0.3**, `stiffness` 0.65 → **0.25** (the user wanted it "less messier", per a reference photo `C:\Users\DELL\Pictures\download.webp`: a neat short top combed forward with a fade). Lower stiffness lets the fringe fall forward. Tried: 0.38 (exposes the crown spike), stiffness 0.1 / noise 0.15 (no better), and Smooth Straight at 0.25 (bowl cut covering the sides). The crown spike is part of the Short Sleek groom.
- **buzz-cut:** Short Sleek 0.2, `density` 30 → **50**, `noise` → **0.4** (even top; 0.28 looked spiky). The card's hair-covered sides are impossible: Short Sleek grows no low side hair.
- **The user asked for a buzz like a reference photo (very short even buzz, fade to skin on the sides, crisp hairline; `C:\Users\DELL\Pictures\buzz-cut-with-fade-buzzcut-number-3.webp`). Tried and failed (2026-10-12):** (1) Casual Short Straight / full-scalp grooms cut to 0.07–0.15 at density 100 (the max): strands do grow on the sides, but they form tufts, a flat-top shelf and bald bands, never an even carpet. (2) Painting the scalp: an Uber Unlit material with a UV-grid probe on `Head Occluder` and on a `HeadMeshPreset` mesh. Both render, with wraparound UVs (U around the head, V top to bottom), but sit from the brows to the neck and auto-position, so the scalp isn't covered. Setting `passInfos[0].baseTex` via the Editor API throws "Object is null"; asset-graphql `setProperty(... "passInfos.0.baseTex", REFERENCE)` works. All test objects and assets were deleted, and `buzz-cut` was re-saved unchanged. A true buzz/fade needs a custom fitted scalp mesh plus a stubble/fade texture: lens-creator work.

**Earlier (2026-10-12, ~16:30): the realism + U/V update is saved in all 8 projects and re-published as updates (skin-fade, buzz-cut, crew-cut, curtain-bangs, bob, feather, u-cut, with v-cut last). The user reported them live: `test:snap` showed 8 lenses and the denser `bob` with Copper → Golden Blonde switching. `snap-live-probe.cjs` cleanup now retries and only warns, since an EPERM on the `.edge-snap-*` profile made a passing run exit 1. Mirrorly is open in Edge (`?v=20261012-1700`) for the user's hands-on check of all eight, especially U vs V and smoothness. Next: their feedback, then ask about committing.** The user said "color looks fine now" and asked for more realistic hair and a clearer U vs V difference. They chose "template tweaks, all 8":
- Every visible `HairVisual`: `density` ×2 and `strandWidth` ×0.8, except Feather's thick Wavy strands, which became bulky (Wavy 5/3.0 → 8/2.0; secondary 8/1.9 → 12/1.3). The Hair Blur Settings `smoothness` went from 0.5 to 0.25 (component id `9621c5a7-…` is the same in every copy).
- **V Cut** = Straight Long `strandCut` 0.85 (mid-chest); **U Cut** = Straight Long 0.6 (shoulder), both unstepped. **Crew Cut** trimmed from 1.0 to 0.75 (the swoop hung past the eyebrow).
- Tried and rejected: `steppedCutEnabled` (layered V, but a dark hair clump under the chin at any length), the Blonde and Curly long models (curly shags, not U/V), `clumpDensity` (stays 0, has no effect), and asset-library hair (only "Messy Hair" and a curly wig).
- The template's limits remain: chunky tails on Straight Long, and real long hair still showing below the jaw. Truly realistic hair needs custom hair models (a lens creator).
- Optimization Settings uses `fpsThreshold` (fallback mode only below 10 fps), so quality isn't reduced on normal devices. If doubled density pushes a slow laptop under 10 fps, the template falls back to lower quality automatically.

**Earlier (2026-10-12, ~15:00): lens colours.** The user said the Snap lenses work "super good", but wants (1) no Snap watermark and (2) colours that follow the selection and look realistic.
- **Colour, done in all 8 lens projects (saved, not yet re-published):** `Assets/MirrorlyHairColor.js` on a root object "Mirrorly Hair Color" (inputs `hairMaterial` = Hair Brown, `previewColor` = "") reads the `hairColor` launch param and sets `Tweak_N39`/`N17`/`N18` from a hand-tuned table for Mirrorly's five hex colours (each previewed for realism: honey, then golden blonde; copper toned down from dyed red), with a formula fallback. Without the param the authored default is dark brown (also reset in `bob`, `feather`, `v-cut` and `u-cut`). Launch params don't exist in the Lens Studio preview; type a hex into `previewColor` to test, then clear it. `snap.js` now removes the lens before re-applying the same lens with a new colour, so the script restarts. **Re-publishing (2026-10-12):** Claude opened each project in turn (`openProject`) and the user published it as an update: buzz-cut, skin-fade, curtain-bangs, crew-cut, u-cut, v-cut, feather, then bob last. Publishing as an update did not leave the project unsaved. **Verified (later on 2026-10-12): the `bob` update is live.** `test:snap` now uses app.js's exact hex values (it used to send Copper as `#a4522f`, which hit the formula fallback), switches the same lens Copper → Golden Blonde, and saves `%TEMP%\mirrorly-snap-probe.png` and `mirrorly-snap-probe-blonde.png`. Both showed natural tuned colours, and the switch reached `step: "shown"`. The other seven updates were not checked individually; the user is checking them in Edge. **Flaky:** 2 of 4 `test:snap` runs hung inside `showLook` (CDP timeout) and passed when rerun unchanged. The probe now wraps `showLook` in a 40 s race that reports the stalled `getStatus().step`; if it recurs, note the step (likely a Snap network fetch in `applyLens`) and watch for the same stall in the real app.
- **Watermark:** it can't be removed in code. It goes away only with the **production** API token, which Snap enables after approving the Camera Kit app ("Submit for App Review" in the portal; 1–2 business days or longer). The user then pastes the production token into `.env.local` (`SNAP_CAMERA_KIT_API_TOKEN`) themselves, and the server is restarted. Keep the "Powered by Snap Camera Kit" badge per Snap branding rules. **The user asked whether the watermark could be blurred or hidden instead; declined (it obscures Snap's staging marker, against the developer terms, and risks the app being disabled).** On 2026-10-12 the user reported "now it is in review", then clarified "all 8 are in review now": that was the **8 lens updates**. Whether the Camera Kit **app** review (watermark) has been submitted is unconfirmed; ask.

**Earlier (2026-10-12, 14:50): all eight lenses are approved and in the group. `npm run test:snap` (which now prints `lensNames`) sees 8. The webcam probe showed `feather` live (`step: "shown"`, AI button hidden), but saw only 5 lenses minutes after the user added the last three: Snap propagation is uneven for a few minutes. Mirrorly is open in the user's Edge (`?v=20261012-1450`) for a hands-on try of all eight styles. Next: get the user's feedback, then ask about committing (Git checklist). Optional: re-publish `bob`, `feather`, `v-cut` and `u-cut` in dark brown, and shorten `bob`'s fringe. The webcam probe closes its own Edge window when it finishes; tell the user beforehand, since they read it as "the app closed". Earlier plan: wait for Snap approval, then the user adds the seven new lenses to group "Mirrorly Haircuts" in Lens Scheduler (only approved lenses are listed), then Claude runs `npm run test:snap` and the webcam probe. Then check Mirrorly with all eight. Later: re-publish `bob`, `feather`, `v-cut` and `u-cut` with the dark-brown values via "Select a Lens to Update" (they still render golden-blonde).**

| Lens | Project | Build | Published | In group |
|---|---|---|---|---|
| `bob` | `lens-studio\bob\bob` | done | yes, live 2026-10-14 (less-shine update) | yes |
| `feather` | `lens-studio\feather\feather` | done (Wavy + secondary layer, Hair Brown) | yes, live 2026-10-14 (less-shine update) | yes |
| `v-cut` | `lens-studio\v-cut\v-cut` | done (Long Hair → Straight Long only, Hair Brown; strands look a little thin) | yes, live 2026-10-14 (less-shine update) | yes |
| `u-cut` | `lens-studio\u-cut\u-cut` | done: **Straight Long**, same as `v-cut` (user's choice; Messy Long looked like a shag with strands across the face) | yes, live 2026-10-14 (less-shine update) | yes |
| `crew-cut` | `lens-studio\crew-cut\crew-cut` | done: Short Hair → **Short Sleek** (not Casual Short Straight, which renders as a chin-length mop; Pointy is a novelty spike), **dark brown** | yes, live 2026-10-14 (less-shine update) | yes |
| `curtain-bangs` | `lens-studio\curtain-bangs\curtain-bangs` | done: Mid-Length → **Smooth Straight Gradient** (the `bob` base) with `strandCut` **0.55**, dark brown: a middle part with the fringe to both sides, ending just above the jaw. Wavy was too big and long | yes, live 2026-10-14 (less-shine update) | yes |
| `buzz-cut` | `lens-studio\buzz-cut\buzz-cut` | done: Short Hair → **Short Sleek** with `strandCut` **0.2**, dark brown: a short textured top. The sides look bald rather than stubbly (the template can't draw stubble). Real hair was fully hidden on `Idle Person 1`. 0.35 was a spiky crop. In this copy, Smooth Straight's `strandCut` was reset to 1 | yes, live 2026-10-14 (less-shine update) | yes |
| `skin-fade` | `lens-studio\skin-fade\skin-fade` | done: Short Hair → **Short Sleek** with `strandCut` **0.5**, dark brown: a textured top with length and bare, close sides. It sits between buzz (0.2) and crew (1.0) | yes, live 2026-10-14 (less-shine update) | yes |

**Shortening hair:** `HairVisual.strandCut` is the fraction of each strand's length that is kept (template values 0.675–1). 1.0 → 0.7 shortens Smooth Straight from the jaw to the mouth; 0.55 is only a little shorter. Try it for `buzz-cut` and `skin-fade`.

**Dark brown (from `crew-cut` on; the user's decision):** the template's "Hair Brown" renders golden-blonde. Its graph-material tweaks on `passInfos[0]` are `Tweak_N39` (base), `Tweak_N17` (a pale-gold highlight, the main cause) and `Tweak_N18` (near-white sheen, alpha 0.84). Set them with `pass.Tweak_N39 = new vec4(...)` (read them with `pass[name]`; `getProperty` throws). Dark-brown values: N39 `0.22, 0.14, 0.08, 1`; N17 `0.33, 0.24, 0.16, 1`; N18 `0.32, 0.25, 0.19, 0.84`. Each project has its own copy of the material, so copies made from `crew-cut` inherit it; check the values after `saveTo`. Original values: N39 `0.502, 0.290, 0.094`; N17 `1, 0.89, 0.592`; N18 `1, 1, 1, 0.84`. Preview men's cuts on `Video/Idle/Idle Person 3.mp4` (a man with short hair). `Idle Person 2` is a woman with long hair, and shows that the template's Bald ML hair hiding does not reach hair below the jaw: long real hair stays visible under short cuts, with a blurred band.
| others | — | — | — | — |

**After publishing, Lens Studio may restart into an empty "Project"** (seen after `feather`, 11:19). The MCP server comes back up with the empty project, so reopen the last lens with `model.openProject(new Editor.Path('.../<name>.esproj'))` (empty project unsaved = Don't Save) before the next `saveTo`. The token stayed the same.

**How Claude builds the next lens (proven with `feather`):** in Lens Studio, through `ExecuteEditorCode`: `model.project.save()` (the save lives on `project`, not on `IModel`), create `lens-studio\<name>\<name>\`, then `model.project.saveTo(new Editor.Path('.../<name>.esproj'))`. Lens Studio switches to the copy and the MCP keeps working on port 50040. Toggle `enabled` on the scene objects, then set `HairVisual.hairMaterial` to the "Hair Brown" asset on **every** layer of the style (Wavy has two). Preview with `PreviewPanelTool setConfig` Multimedia `Video/Idle/Idle Person 1.mp4` (the default is an empty room), refresh, then `CapturePanelScreenshotTool` `Snap.Plugin.Gui.PreviewPanel`, then `project.save()`. Each copy starts from the previously open lens, so switch the previous style off. The scene tree: under `Hair`, Short Hair {Short Sleek Silver, Pointy Green}, Mid-Length {Smooth Straight Gradient, Casual Short Straight Glowing Orange, Wavy, Messy Long}, Long {Curly Hair Mint Blue, Blonde, Straight Long}, Tied Up; the parent group must be enabled too. The user chose to **keep** `Vignette` and `Bokeh_VFX` (sparkles) under Front Orthographic Camera → Screen Overlay. The icon is inherited from `bob`.

**Lens Studio MCP (set up 2026-10-12):** Lens Studio 5.24 runs a local MCP server while a project is open (`http://localhost:50040/mcp`, bearer token in the project's `.mcp.json`; never print it). It is registered in Claude Code at **user scope** as `lens-studio` (`claude mcp add --scope user --transport http lens-studio ... --header "Authorization: <from .mcp.json>"`; the CLI is `C:\Users\DELL\.local\bin\claude.exe`). Its tools appear as deferred `mcp__lens-studio__*` (load with ToolSearch), e.g. `ExecuteEditorCode` and `scene-graphql`. They are only available in a session started **after** registration, and only while Lens Studio is open. If the token changes (new project or relaunch) and the server shows as failing, re-add it with the new `.mcp.json` token. Project rules are in the generated `AGENTS.md` of each Lens Studio project: **never call the MCP server by curl or raw HTTP**, edit only under `Assets/`, never touch `Cache/`, and check Editor API calls against `Support/editor.d.ts`. Publishing (Snap portal, new lens, Hidden, folder "Mirrorly Haircuts", lens name) stays with the user. Note: the project manifest says `lensName: Hair Simulation`. Snap's lens name ("bob") was set in the portal, so the user must type the exact Mirrorly name there each time.

**Hair Simulation template contents (from `bob`'s Assets):** scene hair objects under Short Hair / Mid-Length Hair / Long Hair / Tied Up Hair / Facial Hair: Casual Short Straight Glowing Orange, Short Sleek Silver, Smooth Straight Gradient, Curly Hair Mint Blue, Wavy (+ Big Wavy Gradient Secondary), Messy Long, Straight Long, Double Ponytail(s), Single Bun(s), Blonde Bang, beard and mustaches. Materials include "Hair Brown" (used for all Mirrorly lenses). **Planned mapping:** `feather` = Wavy; `v-cut` = Straight Long; `u-cut` = Straight Long (changed from Messy Long on 2026-10-12); `crew-cut` = Short Sleek (changed 2026-10-12; Casual Short Straight is a chin-length mop); `curtain-bangs` = Smooth Straight Gradient with `strandCut` 0.55 (changed 2026-10-12); `buzz-cut` = Short Sleek with `strandCut` 0.2 (changed 2026-10-12); `skin-fade` = Short Sleek with `strandCut` 0.5 (changed 2026-10-12). Also shorten or raise `bob`'s fringe (it covers the eyes). (`bob`'s unsaved changes were saved into `bob.esproj` on 2026-10-12 at the user's request.)

Real-webcam result for `bob` (after the `snap.js` race fix below): the Snap lens shows automatically on camera start, with the "Camera Kit Staging" watermark and the badge. The hair is golden-brown and the **fringe hangs low over the eyes**; consider shortening it or moving it up in Lens Studio.

**Fixed 2026-10-12, `snap.js` race:** camera start plus the style/colour sync call `showLook` 2–3 times at once. The second call saw the half-built session (no lenses yet) and hid the lens, and `stop()` inside setup bumped `lookVersion`, so the first call thought it was stale. Now concurrent callers share one `sessionSetup` promise, and internal restarts don't bump `lookVersion`. `getStatus().step` reports the last Camera Kit step reached (`bootstrap`, `setSource`, `play`, `loadLensGroups`, `applyLens`, `playLens`, `shown`). `npm run test:snap` calls `showLook` once, so it cannot catch races. For the real flow, run `node tests/snap-webcam-probe.cjs` with the server up. It opens a separate, visible Edge profile with the real webcam auto-granted (`--use-fake-ui-for-media-stream`), waits for live AR to auto-start (it never clicks `liveArButton`, which toggles to Pause) and writes `MirrorlySnap.getStatus()`, app flags and console errors to `%TEMP%\mirrorly-snap-webcam.json`, plus a screenshot to `%TEMP%\mirrorly-snap-webcam.png`. The screenshot is the user's face: keep it local and delete it after viewing. Results go to a file because `process.exit` can drop piped `console.log` output on Windows. Success looks like `visible: true`, `step: "shown"`, `aiButtonHidden: true`.

| Item | State |
|---|---|
| `bob` lens | Approved and in Lens Group "Mirrorly Haircuts" (it was offered in "Add Lenses to Group" the next morning) |
| Lens Source | Lens Folder "Mirrorly Haircuts" (alongside the pre-existing User Profile "Main Snapchat user source" and Snapchat Pack "Test Lenses") |
| Lens Group | "Mirrorly Haircuts", ID `3ee369af-965e-4445-b7ca-a74c8e3b8f68`, 1 lens |
| `.env.local` | `SNAP_LENS_GROUP_ID` = that group; the temporary `SNAP_LENS_MAP` was removed (name matching). Previous file backed up to `.env.local.bak2` (git-ignored via `.env*`). Server restarted |
| `npm run test:snap` | Passed: 1 lens, `bob` applied by name, a jaw-length bob rendered on the demo portrait |

Observed in the probe screenshot: the hair renders light ash-blonde, not brown, and 2–3 white translucent hexagon sparkles float near the head (they look like template effects or particles). Mirrorly's colour choice does not recolour it yet, because the lens ignores the `hairColor` launch param. Ask the user on the webcam whether to remove the sparkles in Lens Studio and how to handle colour (one lens per colour named `bob-<color-slug>`, or a script reading the launch params).

Resume: get webcam feedback on Bob Cut. The other seven styles have no lens, so they fall back to Mirrorly's local AR (camera-only until AI hair is generated). Then step 6.

**Lens Studio and portal facts learned on 2026-10-11:**
- `bob` project: `C:\Users\DELL\mirrorly\lens-studio\bob\bob\bob.esproj`. Hair Simulation template, Mid-Length Hair → "Smooth Straight Gradient" only, Hair Material swapped to "Hair Brown". Icon: `lens-studio\bob-icon.png` (1024², teal/gold).
- Lens Studio 5.24 has no Camera Kit publish target; keep "Snapchat". Clear the Lens Icon/Preview warnings first. Publish opens the web portal: pick the org and folder, choose a **new** lens (not "Select a Lens to Update"), Publish, visibility **Hidden**. Publishing ties the lens permanently to the user's Snap profile. Skip the Lens Creator Rewards terms.
- Lens Scheduler → Lens Sources → **Add Lens Source** offers User Profile, Snapchat Pack, Business Profile and **Lens Folder**; choose Lens Folder.
- "Add Lenses to Group" lists **only approved lenses**. The search matches substrings ("bo" found "CamKit Soundboard"), so a missing lens means it is still in review, not misnamed.
- The group ID appears in the URL: `.../camera-kit/lens-scheduler/groups/<group-id>`.
- Submission limits shown in the portal sidebar: Non-Lens+ 19 left, Lens+ 10 left (as of 2026-10-11). Eight haircut lenses fit.

**Seeing the user's Edge screen:** Claude can screenshot it directly instead of asking for screenshots. The monitor setup changes: on 2026-10-11 there were two 1920×1080 monitors with Edge on the right, and on 2026-10-12 only the laptop screen. Always list the monitors first (`[System.Windows.Forms.Screen]::AllScreens`), then capture `SystemInformation.VirtualScreen` with PowerShell `System.Drawing` `CopyFromScreen`, save it to the scratchpad and Read it. A pure-white image means the region was off-screen. Only screenshot when the user asks to check the screen.

**Next steps (user-driven; Claude cannot operate Lens Studio's GUI reliably):**
1. **Lens Studio 5.24.1** is installed at `C:\Program Files\Snap Inc\Lens Studio\Lens Studio.exe` (verified 2026-10-11). It is compatible: the Camera Kit Web changelog says 1.21.0 added Lens Studio 5.24 support, and Mirrorly pins 1.22.0, and older-Lens-Studio lenses keep running in newer SDKs. Sign in with the same Snap account. Don't upgrade Lens Studio beyond what the pinned SDK supports; a lens from an incompatible version silently does not appear.
2. Build **one** lens first, `bob`, from the **Hair Simulation** template. It includes Snap's "Bald ML" hair hiding, the blur layer and the head collider. Enable the template hairstyle closest to a bob and name the lens exactly `bob`.
3. **Publish → Upload to Lens Folder** (Camera Kit only, not public Snapchat), in the "Mirrorly" organization.
4. In my-lenses.snapchat.com → **Lens Scheduler**: **Add Lens Source** for that folder (easy to miss), create a **Lens Group**, **Add Lens** `bob`, then save and copy the group ID. *(Source and group done; adding `bob` waits for approval.)*
5. Claude then sets `SNAP_LENS_GROUP_ID` to that group, **deletes the temporary `SNAP_LENS_MAP` line** (name matching takes over), restarts the server, runs `npm run test:snap`, and opens Edge for a webcam check of Bob Cut.
6. Repeat for `feather`, `v-cut`, `u-cut`, `crew-cut`, `buzz-cut`, `curtain-bangs` and `skin-fade`. Alternatives are buying lenses on Snap's Creator Marketplace, or hiring a lens creator with the eight Mirrorly reference images and this naming rule.
7. Before customer use: submit the app for Snap review to activate the **production** token, which removes the "Camera Kit Staging" watermark. Check Snap's Camera Kit branding guidelines. Then commit and push.

Guide the user step by step from their screenshots; their Snap pages are in Edge.

## Workspace (verified 2026-10-11)

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
| `server.js` | Static server plus `/api/ai-status`, `/api/ai-ar-hair`, `/api/ai-render`, `/api/snap-config` |
| `public/snap.js`, `snap-config.cjs` | Snap Camera Kit live mirror and its configuration |
| `scripts/build-snap-camera-kit.cjs` | Builds the git-ignored Camera Kit browser bundle |
| `tests/` | `tracking.test.cjs`, `live-ar.test.cjs`, `snap.test.cjs`, `ai-performance.test.cjs` (unit); `browser-tracking.cjs` (Edge/WebGL); `snap-live-probe.cjs` (`npm run test:snap`, live Snap check, demo portrait); `snap-webcam-probe.cjs` (real webcam, full app flow); `snap-demo-probe.cjs` (demo mode with Snap lenses, women's and men's portraits) |
| `.env.example` | Template for `.env.local`: OpenAI key and Snap token, group and optional lens map |
| `CHANGELOG.md` | Dated decisions and history |

Untracked local work, not part of the shipped app:
- `android-rk3588/` and `scripts/Build-RK3588Android.ps1`: an Android WebView shell for RK3588 (see its README).
- DeepAR SDK zip and folders, `assets-source/deepar-studio-input/`, `free_package/`: the DeepAR integration was removed in `d6dd53f`. Do not reintroduce it unless asked.

Outside the app: `C:\Users\DELL\mirrorly\Mirrorly_Concept_Walkthrough.pptx` and reference media. Python is not installed; don't rely on Microsoft Store aliases.

## Run and verify

```powershell
Set-Location 'C:\Users\DELL\mirrorly\MirrorlyLaptopApp'
npm run check    # syntax
npm test         # unit tests (47 as of 2026-10-11)
npm start        # http://localhost:4173/
npm run test:browser   # needs the server running
npm run test:snap      # live Snap check with the .env.local token; contacts Snap
node tests/snap-webcam-probe.cjs   # real webcam + full app flow; results in %TEMP%
```

- `test:snap` streams the bundled fictional demo portrait at 30 fps as the "camera". It prints the lens count and the applied lens, and saves a screenshot to `%TEMP%\mirrorly-snap-probe.png` (view it to confirm). Edge's `--use-fake-device-for-media-stream` webcam ends after about 2 s and has no face, so don't use it for Snap checks.
- After editing `.env.local`, restart the server; settings are read at startup.

- Before starting a server, check port 4173. Reuse a working server, or stop only the Node `server.js` process that owns the port.
- `/` with any query string must serve `index.html`. Add `?v=YYYYMMDD-HHMM` after asset or JS changes.
- Restart the server after backend changes. A message like "must be a PNG image" means an old server is still running.

## Customer flow

1. **Start live AI mirror.** The camera opens and local tracking starts automatically. The preview stays **camera-only**.
2. **Step 1 style, Step 2 color.** There is no Step 3 and no manual fit controls; alignment is automatic.
3. **Create AI hair for live AR** (button injected in `app.js`). This is an explicit paid action: one frozen frontal frame, an edit mask, a hidden placement guide and a style reference are uploaded to `/api/ai-ar-hair`. The result is extracted locally into a hair-only layer that follows the head.
4. **See realistic result** (the salon result; the button was called "Create salon result" until 2026-10-13). A guided front/left/right capture runs with local quality gates. `Generate three salon views` then makes 3 paid edits via `/api/ai-render`: the front first, then both sides concurrently with the front as a consistency reference. The views are held in session memory and can be saved individually. On returning to the live mirror, all three are reused as view-dependent live AR, with no extra calls.
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
- `SNAP_CAMERA_KIT_API_TOKEN` reaches the browser by Snap's design, but it is still a credential. It lives only in `.env.local`. Never ask the user to paste it in chat (have them paste it into `.env.local` themselves), never print it (mask values when inspecting `.env.local`), and never commit it. Lens group IDs and lens IDs are not secret.

**Honesty**
- Live AI hair is single-view (or three-view) **2.5D**, not volumetric.
- Tests are synthetic. Do not claim Snapchat parity or pixel-perfect alignment without real-webcam evaluation across diverse customers.

## Snap Camera Kit live mirror

The live hairstyle can be rendered by Snap's own lens engine (`public/snap.js`, `snap-config.cjs`). When Snap has a lens for the selected look, it takes over the live view and Mirrorly's local AR pauses. Without a configured lens, the local AR below is the fallback.

- **Setup** (the user's own Snap developer account): activate Camera Kit at my-lenses.snapchat.com/camera-kit, then put `SNAP_CAMERA_KIT_API_TOKEN` and `SNAP_LENS_GROUP_ID` in `.env.local` (see `.env.example`). Restart the server and check `/api/snap-config`. The token is only served once both values are set.
- **Lens per look**: lenses are matched by the optional `SNAP_LENS_MAP` JSON (`"style:Color"` before `"style"`), otherwise by lens name `<style-id>-<color-slug>` and then `<style-id>`. Each lens receives launch params `styleId`, `hairColor` (hex) and `hairColorName`, so one lens per style can recolour itself.
- **The bundle is Snap confidential software** under the Snap Developer Terms. `npm install` runs `npm run build:snap` (esbuild, `scripts/build-snap-camera-kit.cjs`), which writes `public/vendor/snap/camera-kit.mjs`. It is git-ignored; never commit or publish it, especially since the repo is public.
- **Demo mode (since 2026-10-13)** shows the Snap lenses on the fictional demo portrait. `getDemoFeedStream()` draws `drawDemoScene` into a pre-mirrored 960×720 canvas (the same 4:3 as the demo canvas, so Save preview isn't stretched) at 30 fps and passes its `captureStream` to `showLook`. `syncSnapLook()` stops the feed whenever demo is off; camera start calls it to hide the demo lens. The portrait follows the style category automatically. The demo note text differs ("Demo of the live preview. Start the camera…"); the salon button stays disabled in demo. Check with `node tests/snap-demo-probe.cjs`.
- **Hidden** during guided salon capture, "hold for before", pause and captured results. Mirrorly's tracking and AI flows run there. "Create AI hair for live AR" is hidden while a Snap lens is showing.
- **Branding**: a "Powered by Snap Camera Kit" badge shows while a lens runs. Snap requires its branding, so check Snap's Camera Kit design guidelines for the exact asset before customer use.
- `MirrorlySnap.getStatus()` reports configured/missing, visibility, lens count and names, and the last error (no token).
- If the browser console reports a network or WebAssembly error: Camera Kit loads its runtime from Snap's CDN and needs `*.snapar.com` and `cf-st.sc-cdn.net` reachable. Supported browsers are Chrome 95+, Edge 79+ and Safari 16+.
- Quality depends on the lenses themselves (Lens Studio hair templates or bought lenses), not on Mirrorly code.
- **Getting lenses into Mirrorly:** Lens Studio **Publish → Upload to Lens Folder**, then in My Lenses **Lens Scheduler → Add Lens Source** for that folder, then add the lenses to a **Lens Group**. The app references the group ID, never a folder. `MirrorlySnap.getLenses()` lists the ids and names Mirrorly sees (useful for `SNAP_LENS_MAP`).
- **Staging vs production:** the staging token shows a "Camera Kit Staging" watermark on the face. Production needs a Camera Kit app version and Snap review.
- **Lens Studio compatibility:** a lens built in a Lens Studio version incompatible with the Camera Kit SDK version (`@snap/camera-kit` **1.22.0**, pinned exactly) does not appear. Upgrade the SDK only together with a lens check.
- `syncSnapLook()` in `app.js` decides visibility. It runs after live AR starts, on style/colour changes, before/after mode, salon cancel and pause. `snapLookStream()` returns the demo feed in demo mode, otherwise the camera stream in live mode (no capture or salon capture in progress, overlay on); `snapLookAllowed()` checks it. While a Snap lens is visible, `render()` skips `MirrorlyAR.update` to save CPU, and Save preview captures the Snap canvas.
- **Preview framing (2026-10-13, the user's decision):** the live lens is sold as "shape and length, live", and the salon result as the realistic look. While a lens is visible, `syncSnapLook()` shows `#snapPreviewNote` (under the HUD, so it can't collide with the badge or the toolbar) and adds `.featured` (the gold primary style) to `captureFaceButton`, whose label is `SALON_BUTTON_LABEL` = "See realistic result". The HUD says "LIVE PREVIEW". Don't present the lens as photo-realistic in UI text.
- The badge is a real element (`.snap-badge`). Do not use `.preview-card::after`, which already carries the preview lighting overlay.

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
| Attachment | mesh 48×8; `depthStrength` 0.32; fade 30°→45° per view; back layer +0.1 face width toward the camera | `buildLiveAiMergedLayer`, `renderAiViews` |
| Front (over-face) layer | face contour sharp inside, blurred 3.5% face width outward; fades 20°→35° (`frontLayerOpacity`) | `buildLiveAiMergedLayer`, `tracking.js` |
| Registration | x/y filter 2.0 / 0.02, scale 1.5 / 0.5; reject scale outside 0.8–1.25 or shift > 0.3 face width | `ar.js`, `registerPersonalAnchors` |
| View blend | weight `coverage / (angle + 0.06)^4`, at most 2 views | `aiViewBlend` |
| Real-hair removal | 320 px; ≤ 30 Hz (`1.5 ×` segmentation ms); mask smoothstep 0.22–0.6, 1-px dilation; protected ellipse 0.50 fw × 0.42 fh centred +0.12 fh; beside-cheek band (0.95 fw × 0.7 fh, below brow) filled with skin × 0.55 instead of room colour | `ar.js`, `suppressLiveRealHair` |
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

For artifacts on a real webcam, open `/?debugLayers`. It tints the real-hair cover blue, the AI back layer red and the front (over-face) layer green. It is diagnostic only, so never ship a link with it to customers.

The browser tests use synthetic landmarks, masks and mocked API responses. Passing them does not prove real-webcam quality.

## Known limitations

- **Snap:** all eight styles have a lens (2026-10-12). The live versions (2026-10-14) follow Mirrorly's colour choice and have the reduced shine. They show template sparkles (kept by the user). `u-cut` and `v-cut` differ only in length (shoulder vs mid-chest), and the buzz cut has bald rather than stubbly sides. The template hides real hair only near the head, so long hair below the jaw stays visible under short cuts. The staging watermark is shown until production approval.

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
