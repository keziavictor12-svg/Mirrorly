# Fictional salon demo portraits

`male-demo.png` and `female-demo.png` were created with Codex's built-in image-generation tool on 2026-09-14. They depict fictional adults, not customer portraits. Their neutral clean-shaven scalps are base images: the offline demo overlays the selected existing hairstyle and color. These photographs are static assets, not generated 3D models or per-frame AI.

The demo uses the men's/women's catalog category to select the base portrait. It must never use this mapping to infer a customer's gender or replace a real capture. No paid app API requests are needed to display these assets.

`demoProfiles` defines fixed head-fit anchors for these photographs. A demo-only curtain-bangs profile scales its overlay to this head; none of these settings change customer/live calibration. Browser regressions check category switching, exposed crown pixels, short-hair eye clearance, and preserving real captures.

## Prompt set

Shared prompt: "Use case: photorealistic-natural. Asset type: offline demo base portrait for a salon hairstyle try-on app. Create a realistic photographic head-and-shoulders portrait, landscape 4:3, single adult centered looking straight at camera, upright head, neutral friendly expression, natural eyes and skin texture. Dark teal softly blurred premium salon background, dark teal salon cape, soft even neutral studio light, no harsh shadows. Composition is crucial: face center at 50% image width and 45% image height; face skin outline from approximately 29% to 64% image height, cheek width approximately 25% image width. Include the full top of scalp and shoulders and leave clear space around the head for short and long hair overlays. The scalp is clean shaven: this is a neutral head base onto which the application composites its existing hairstyle assets. No head hair or fringe, no hat, no hands, no extra people, no text, no watermark, no UI. Photographic skin/eyes/ears/nose/lips, not illustration, cartoon, mannequin or CGI."

Male suffix: "Subject: fictional adult man in his late twenties with medium-brown skin, masculine facial features, subtle realistic jaw stubble, no beard bulk."

Female suffix: "Subject: fictional adult woman in her late twenties with medium-brown skin, feminine facial features, natural understated makeup, no jewelry."
