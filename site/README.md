# Aperture — v0 Splat Test Site

Static one-page site that embeds two Scaniverse Gaussian Splat captures (bedroom + living room) for a personal quality test. No build step, no deps.

> Why Scaniverse, not Luma: Luma killed consumer 3D capture in 2025 — their mobile app is now Dream Machine (video gen) only. Scaniverse (Niantic) is free, unlimited, on-device, and gives you an iframe embed.

## Workflow

1. **Capture** both rooms in the Scaniverse iOS/Android app using **Splat** mode. On-device processing takes a few minutes.
2. **Upload + grab embed**: in the app, Share → Upload to Scaniverse → open the resulting web page → copy the iframe embed code.
3. **Swap the placeholders** in `index.html`: replace each `<iframe src="…">` block with the iframe Scaniverse gave you. Update the captions too.
4. **Fill in the captions and notes** (capture date, quality verdict, floater notes).
5. **Run locally** to sanity-check:
   ```
   cd "site"
   python3 -m http.server 8000
   # open http://localhost:8000
   ```
6. **Deploy** to Vercel:
   ```
   cd "site"
   npx vercel --prod
   ```
   Or drag-drop the `site/` folder into the Vercel dashboard.

## Scene IDs

- Bedroom: _TBD_
- Living Room: _TBD_

## Success criteria

- Both iframes load in <5s on mobile LTE.
- You can identify specific objects (bed, couch) in each scene.
- Touch controls (drag to rotate, pinch to zoom) work on iOS Safari and Chrome.
- Written one-line verdict per scene in the footer of `index.html`.

If yes → continue to the self-hosted INRIA path in `../plan.md`. If no → kill or rescope.
