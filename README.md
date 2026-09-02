# Mirrorly Laptop App

A single-salon hairstyle preview application combining live, local AI face tracking with moving AR hairstyles and an optional identity-preserving AI photo render.

## Run it

1. Open PowerShell in this folder.
2. Run `npm start`.
3. Open `http://127.0.0.1:4173` in Microsoft Edge or Google Chrome.
4. Select **Start live AI mirror**. The app starts face tracking automatically; choose a style or color and move naturally to see it follow the customer. Use **Try demo mode** without a camera.

The browser may ask for camera permission. Live camera frames and landmark tracking remain on the laptop. No photo capture or upload is required for the live try-on. A frozen still is uploaded only if the user explicitly selects **Optional AI photo**.

## Enable realistic AI stills

The AR preview works without an API key. The final merged still uses the OpenAI Image Edit API and keeps the key in the local Node server.

```powershell
$env:OPENAI_API_KEY='your-key-set-locally'
npm start
```

Do not place the key in `public/app.js`, HTML, or browser storage. The key is not needed for live AI AR, which uses the bundled local MediaPipe model. If a photographic result is wanted, choose the style and color, then select **Optional AI photo**. Mirrorly freezes that pose, measures the face, and requests the realistic merged still. To reduce waiting time while retaining salon-preview quality, the server keeps all three high-fidelity alignment inputs but requests medium-quality JPEG output with `output_compression=90`. During processing, the main preview holds the untouched captured portrait and shows elapsed time; the AR placement guide is rendered only on an off-screen canvas for the AI request. The visible portrait changes only when the final AI image is ready.

## Included in this first build

- Local laptop webcam preview
- Live AI AR starts automatically after camera permission using a bundled 478-point MediaPipe face tracker and a Three.js WebGL hairstyle layer
- Real-time position, scale, roll, yaw, and pitch response while the customer moves
- Immediate hairstyle and color changes on the moving live overlay without requiring capture
- Optional local face capture that freezes the current pose for a photographic AI render
- Automatic captured-face measurement using the bundled 478-point model, including face center, size, and roll
- Optional GPT Image 2 still rendering that receives the original portrait, AR placement preview, and selected hairstyle reference, then replaces and blends the hair as photographic pixels
- Eight photorealistic salon cuts: Bob, Feather, V Cut, U Cut, Crew Cut, Buzz Cut, Curtain Bangs, and Skin Fade
- Side-card previews showing the captured face with every hairstyle
- Five common salon hair-colour choices
- Automatic hairstyle alignment using the bundled MediaPipe face measurement
- Simplified two-step frontend with no manual fit-control section
- Local PNG snapshot download
- Responsive single-salon interface
- No server-side image storage, accounts, or tracking

## Prototype limitations

- Bob and Crew use volumetric GLB meshes in live AR; Feather, V, U, Buzz, Curtain Bangs, and Skin Fade use tracked PNG-plane fallbacks.
- Live AI AR remains an approximate tracked overlay; frame-by-frame generative image editing is not used because remote image generation is not interactive. Realistic hairline integration is available through the optional photo when API billing is available.
- Color choices recolor the hairstyle asset rather than the customer's existing hair.
- The application currently runs in a browser rather than as a packaged Windows executable.

## Suggested next milestone

Test identity preservation and hairstyle consistency across a diverse salon evaluation set, add an explicit consent/retention policy for production AI uploads, then package the application for Windows.
