# Mirrorly Laptop App

A single-salon hairstyle preview application combining local AR face tracking with automatic identity-preserving AI rendering after face capture.

## Run it

1. Open PowerShell in this folder.
2. Run `npm start`.
3. Open `http://127.0.0.1:4173` in Microsoft Edge or Google Chrome.
4. Select **Allow camera**, position the customer inside the guide, and choose **Capture face**. Use **Try demo mode** without a camera.

The browser may ask for camera permission. Live camera frames remain in the browser. A frozen still is uploaded only after the user explicitly presses **Capture + AI merge**.

## Enable realistic AI stills

The AR preview works without an API key. The final merged still uses the OpenAI Image Edit API and keeps the key in the local Node server.

```powershell
$env:OPENAI_API_KEY='your-key-set-locally'
npm start
```

Do not place the key in `public/app.js`, HTML, or browser storage. Choose the style and color, then select **Capture + AI merge**. Mirrorly measures the face, displays the AR fit, and automatically requests the realistic merged still. There is no separate AI-render button. To reduce waiting time while retaining salon-preview quality, the server keeps all three high-fidelity alignment inputs but requests medium-quality JPEG output with `output_compression=90`. The AR preview stays visible and shows elapsed time while the AI edit finishes.

## Included in this first build

- Local laptop webcam preview
- Live AR mode using a bundled 478-point MediaPipe face tracker and a Three.js WebGL hairstyle layer
- Real-time position, scale, roll, yaw, and pitch response while the customer moves
- Local face capture that freezes the camera into a hairstyle portrait
- Automatic captured-face measurement using the bundled 478-point model, including face center, size, and roll
- Optional GPT Image 2 still rendering that receives the original portrait, AR placement preview, and selected hairstyle reference, then replaces and blends the hair as photographic pixels
- Eight photorealistic salon cuts: Bob, Feather, V Cut, U Cut, Crew Cut, Buzz Cut, Curtain Bangs, and Skin Fade
- Side-card previews showing the captured face with every hairstyle
- Five common salon hair-colour choices
- Manual horizontal, vertical, scale, rotation, opacity, and depth controls
- Automatic face-box alignment when the browser FaceDetector API is available
- Local PNG snapshot download
- Responsive single-salon interface
- No server-side image storage, accounts, or tracking

## Prototype limitations

- Live AR uses tracked 3D planes for the current PNG assets; fully volumetric GLB hairstyles are the next asset milestone.
- Live AR remains an approximate tracked overlay; realistic hairline integration runs automatically after capture when API billing is available. If AI is unavailable, Mirrorly keeps the local AR-fitted capture.
- Color choices recolor the hairstyle asset rather than the customer's existing hair.
- The application currently runs in a browser rather than as a packaged Windows executable.

## Suggested next milestone

Test identity preservation and hairstyle consistency across a diverse salon evaluation set, add an explicit consent/retention policy for production AI uploads, then package the application for Windows.
