# Mirrorly Laptop App

A single-salon hairstyle preview application combining live, local AI face tracking with moving AR hairstyles and an optional identity-preserving AI photo render.

## Run it

1. Open PowerShell in this folder.
2. Run `npm start`.
3. Open `http://127.0.0.1:4173` in Microsoft Edge or Google Chrome.
4. Select **Start live AI mirror**, choose a style/color, then select **Create AI hair for live AR**. The camera stays unchanged until AI hair is ready; finished hair follows your head locally. Use **Try demo mode** without a camera.

The browser may ask for camera permission. Tracking is local. **Create AI hair for live AR** explicitly uploads one frozen frame to generate the personalized layer; no continuous uploads occur. Style/color changes hide stale AI hair and require another explicit generation. **Optional AI photo** is a separate still-photo workflow.

## Enable realistic AI stills

Local camera/tracking works without a key. Personalized live AI hair and the optional merged still require funded API access; the key stays in the local Node server.

```powershell
$env:OPENAI_API_KEY='your-key-set-locally'
npm start
```

Do not place the key in `public/app.js`, HTML, or browser storage. Local MediaPipe tracking does not require it; generating personalized AI hair does. For a final photo, choose the style/color, then **Optional AI photo**. Mirrorly freezes/measures that pose and requests a merged still with three high-fidelity alignment inputs, medium-quality JPEG, and `output_compression=90`. The visible preview holds the untouched captured portrait and shows elapsed time; the AR guide is off-screen. It changes only when the final AI image is ready.

## AI speed target

Both Live AI hair and Optional AI Photo retain medium quality and all three references. Full-frame uploads are resized without cropping, opaque guides/references use JPEG, and both outputs are bounded-size JPEG. The original captured preview is preserved while waiting. Men's PNG-only styles now use their decoded alpha silhouettes for the edit mask rather than missing SVG metadata.

Twenty seconds is a target, not a guaranteed or measured completion time. The local segmenter warms without making an API call; no automatic paid retries are added. Session-only numeric timings are available at `MirrorlyAiDiagnostics.getMetrics()`. Restart the Node server after backend updates: refreshing an old server can cause a JPEG preview to be rejected as "must be a PNG image".

## Included in this first build

- Local laptop webcam preview
- Live AI AR starts automatically after camera permission using a bundled 478-point MediaPipe face tracker and a Three.js WebGL hairstyle layer
- Real-time position, scale, roll, yaw, and pitch response while the customer moves
- Style/color selection with camera-only waiting until matching AI hair is generated
- Optional local face capture that freezes the current pose for a photographic AI render
- Automatic captured-face measurement using the bundled 478-point model, including face center, size, and roll
- Optional GPT Image 2 still rendering that receives the original portrait, AR placement preview, and selected hairstyle reference, then replaces and blends the hair as photographic pixels
- Eight salon cuts: Bob, Feather, V Cut, U Cut, Crew Cut, Buzz Cut, Curtain Bangs, and Skin Fade
- Realistic bundled male/female demo portraits that switch with the hairstyle category; no AI LIVE labels on hairstyle cards. Camera and captured customer photos are never swapped by category.
- A textured volumetric catalog GLB for every cut, retained for internal validation but not shown as the customer-facing fallback
- Personalized AI live hair with capture-pose head anchoring, measured foreground contour/depth, a separate motion-faded original-hair repair, and webcam-matched strand/lighting instructions that explicitly reject a CGI or plastic 3D-render finish
- Side-card previews showing the captured face with every hairstyle
- Five common salon hair-colour choices
- Automatic hairstyle alignment using the bundled MediaPipe face measurement
- Simplified two-step frontend with no manual fit-control section
- Local PNG snapshot download
- Responsive single-salon interface
- No server-side image storage, accounts, or tracking

## Prototype limitations

### Live tracking refinement

The tracker fits head position/scale using pose-projected canonical landmarks and quaternion filtering. Its 468-landmark depth occluder seals eye/mouth holes so rear hair cannot leak through them. The personalized AI layer undoes the captured pose and attaches to the current head origin on a subdivided, measured-depth strip, preserving crop offsets and image orientation. Both the renderer and compositor suppress temporary catalog hair, pending AI, and mismatched looks. Diagnostics are available through `MirrorlyAR.getStatus().metrics` without exposing camera pixels. Pose rendering follows the [MediaPipe transformation-matrix model](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker).

Run `npm test` for 33 deterministic regressions and `npm run test:browser` with the local server running for the real Edge/WebGL integration test, including all 40 style/color masks and both AI frontend actions. Tests use synthetic face landmarks and mocked API responses; they do not upload photos or call paid AI. Actual webcam accuracy, scalp fitting, and hair replacement still need evaluation; Snapchat-level quality is not yet established. Optional AI Photo keeps its original freeze/hold workflow while sharing the explicitly requested transport optimization.

The foreground mask now follows the captured landmark face contour instead of a generic oval. Head-connected semantic hair retains its full length; generated-image borders receive a localized alpha fade when clipped. Hair and background repairs are separate: frozen room pixels stay at capture-screen coordinates and fade with head motion instead of forming dark rotating patches. Live camera pixels receive no cinematic wash or vignette. Regressions use an attributed generic 468-vertex canonical model, not customer photographs.

The 2026-09-24 AR tuning expands the editable old-hair boundary to remove long lengths and halos, retains connected fine strands at lower segmentation confidence, uses a denser 48 x 8 attachment mesh with gentle scalp curvature, and keeps the fixed background repair stable through normal tracking jitter. A subtle color-matched contact shadow now blends generated roots into the measured forehead. Live generation also requires a more frontal, level capture before any paid request.

### Remaining limitations

- The customer-facing live hairstyle is single-view AI **2.5D**, not a generated volumetric GLB; internal GLB assets remain available on `3d-smoke-test.html`.
- The hair stays fully visible through roughly 14 degrees of view change and fades out by about 22 degrees instead of showing a hollow/distorted side view. Its separate frozen background repair fades much earlier on movement, so original hair can reappear. Room/camera/lighting changes cannot always be inferred from head pose. Multi-view scalp fitting/replacement still needs work.
- Clipped image-border hair can be softly blended but not reconstructed outside the photo; move back and regenerate for the complete cut.
- Live AI AR remains an approximate tracked overlay; frame-by-frame generative image editing is not used because remote image generation is not interactive. Realistic hairline integration is available through the optional photo when API billing is available.
- Color choices recolor the hairstyle asset rather than the customer's existing hair.
- The application currently runs in a browser rather than as a packaged Windows executable.

## Suggested next milestone

Test identity preservation and hairstyle consistency across a diverse salon evaluation set, add an explicit consent/retention policy for production AI uploads, then package the application for Windows.

## Guided salon result

`Create salon result` starts a local quality-gated front, left, and right capture. Mirrorly checks face pose, distance, roll, pitch, and visible hair coverage with MediaPipe before accepting each view. No frame uploads during these checks. After all three views pass, `Generate three salon views` explicitly starts three AI edits. The front result establishes the selected cut and color; both side requests include that approved front result as a consistency reference. The three generated views stay in browser session memory for inspection and individual saving.

This workflow is the realistic salon output. The local live renderer is an approximate preview and does not remove real hair. Three-view generation makes three paid image API calls only after the user presses Generate; selection changes never trigger those calls automatically.