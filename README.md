# Aperture

Weekend test of a phone-captured 3D Gaussian Splat wrapped in a custom WebGL viewer. Zero infra cost, ~zero deps. The goal isn't a business — it's enough hands-on with 3DGS to decide whether the workflow is worth pursuing downstream (robotics training data, listings, AEC, insurance).

**Live:** https://site-ten-xi-60.vercel.app

## What's here

| Path | Purpose |
|---|---|
| `site/` | Static deployed site. HTML + CSS + one JS module. No build step. |
| `site/scans/scan1.spz` | Scan #1 — West Oak Hill living room, 294K gaussians, 6.4 MB. |
| `plan.md` | Original 20-hour Karpathy-style learning sprint plan (north star). |
| `SUMMARY.md` | What actually shipped + decisions made along the way. |

## Stack

| Layer | Tool | Why |
|---|---|---|
| Capture | **Scaniverse** (iOS, Niantic) | Free, unlimited, on-device. Luma killed consumer 3D capture; Polycam paywalled it. |
| Format | **SPZ** (Niantic open spec) | ~10× smaller than `.ply`. |
| Hosting | Local `site/scans/*.spz` | Scaniverse CDN has no CORS headers + scan pages set `x-frame-options: SAMEORIGIN`. We download once and serve from our own static site. |
| Renderer | **Spark** (`@sparkjsdev/spark`) + Three.js + `OrbitControls` | Loaded via CDN importmap, no bundler. Viewer reproduces Scaniverse's exact starting camera (center/pitch/yaw/radius from scan metadata). |
| Deploy | Vercel (static) | Free tier, ~7 MB per scan, instant deploys. |

## Local dev

```bash
cd site
python3 -m http.server 8000
# open http://localhost:8000
```

Or via the included `.claude/launch.json`: just run `mcp__Claude_Preview__preview_start name=site`.

## Adding a new scan

1. Capture in Scaniverse iOS app (Classic → Splat mode).
2. Tap **Share → Upload to Scaniverse**, copy the `scaniverse.com/scan/<id>` URL.
3. Download the SPZ + metadata locally:

   ```bash
   ID="<scan_id>"
   N="<scan_number>"  # e.g. 2
   curl -o "site/scans/scan$N.spz"         "https://scaniverse.com/api/media/$ID/gaussians.spz"
   curl -o "site/scans/scan$N-preview.jpg" "https://scaniverse.com/api/media/$ID/preview.jpg"

   # Grab the starting camera so the viewer matches Scaniverse's:
   curl -s "https://scaniverse.com/scan/$ID" | python3 -c "
   import sys, re
   m = re.search(r'\"metadata\":(.+?)\}\}', sys.stdin.read(), re.DOTALL)
   print(m.group(1)[:600] if m else 'no match')"
   ```
4. In `site/index.html`, add a new `<section class="scene">` mirroring scan #1. Copy the `data-*` attributes and replace `center-x/y/z`, `radius`, `radius-max`, `pitch`, `yaw` with the values from the metadata above.

## Deploy

```bash
cd site
vercel --prod --scope <your-vercel-scope>
```

The `vercel.json` in `site/` sets a long-lived `Cache-Control` on `.spz` files since they never change.

## What broke vs. the original plan

The original spec called for Luma AI + iframe embed. None of that survived contact with reality:

- **Luma killed consumer 3D capture** in 2025 — `app.lumalabs.ai` is Dream Machine (video gen) only.
- **Scaniverse blocks cross-origin iframes** (`x-frame-options: SAMEORIGIN`) and **doesn't send CORS headers** on the SPZ CDN, so we can neither embed their viewer nor fetch the SPZ directly from a browser.
- **Fix:** download the SPZ once with `curl`, host it on our own static site, render it with Spark + Three.js. This actually moves us closer to `plan.md`'s "build your own viewer" goal anyway.

Full play-by-play in [`SUMMARY.md`](./SUMMARY.md).

## Status

- ✅ Scan #1 captured + rendering on the live site with WASD walk-through
- ⏳ Sunday self-hosted INRIA training (from `plan.md`)
