# Preview Capture Guide

To reproduce the full-page NailNow sketch that matches what is committed in this repository:

1. Start a simple static server from the repository root:
   ```bash
   python -m http.server 8000
   ```
2. In a separate terminal, capture the homepage with Playwright (Chromium):
   ```bash
   npx playwright screenshot http://127.0.0.1:8000/index.html artifacts/nailnow-home.png --full-page --device="Desktop Chrome"
   ```
   The `artifacts/nailnow-home.png` file will mirror what is hosted on GitHub Pages for the latest commit.
3. To capture the “Quem somos” page, replace the URL:
   ```bash
   npx playwright screenshot http://127.0.0.1:8000/quem-somos.html artifacts/nailnow-about.png --full-page --device="Desktop Chrome"
   ```

> Tip: Commit the exported PNGs if you need to share the sketches inside a pull request.
