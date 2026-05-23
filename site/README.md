# `site/` — Aperture static site

Static deployable site that loads `.spz` Gaussian Splat files and renders them in-browser with a custom Spark + Three.js viewer. No build step, no dependencies, no bundler.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure, importmap (CDN URLs for three / spark), one `<div class="viewer">` per scan. |
| `viewer.js` | ES module that initializes one Spark + Three.js viewer per `.viewer` element on the page. |
| `styles.css` | Dark theme, 16:9 viewer containers, mobile-responsive, hint overlay. |
| `vercel.json` | Sets `Cache-Control: public, max-age=31536000, immutable` on `.spz` assets. |
| `scans/scan1.spz` | Scan #1 — West Oak Hill living room (6.4 MB, 294K gaussians). |
| `scans/scan1-preview.jpg` | Scaniverse-generated preview thumbnail. |

## How the viewer is set up

Each `<div class="viewer">` declares a Scaniverse-supplied starting camera via `data-*` attributes:

```html
<div
  class="viewer"
  data-splat="scans/scan1.spz"
  data-center-x="0.024079919"
  data-center-y="-0.5108332"
  data-center-z="-1.7559862"
  data-radius="1.8683064"
  data-radius-min="0.1"
  data-radius-max="2.8024597"
  data-pitch="-0.36302692"
  data-yaw="0.24435559"
>
```

`viewer.js` reads those values from the scan's metadata (fetched from `scaniverse.com/scan/<id>`) and reproduces Scaniverse's exact opening view — same camera position, same target, same orbit constraints. Without this, the splat renders in some arbitrary orientation depending on Spark's defaults.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Or use the included `.claude/launch.json` config (`name: "site"`) with the preview MCP.

## Deploy

```bash
vercel --prod --scope <your-vercel-scope>
```

The included `vercel.json` ensures `.spz` files get long-lived caching.

## Adding a scan

See the top-level [`README.md`](../README.md) and [`SUMMARY.md`](../SUMMARY.md) for the full workflow.

The condensed version:

1. Scaniverse iOS app → Classic → Splat mode → capture room.
2. Share → Upload to Scaniverse → copy `scaniverse.com/scan/<id>` URL.
3. Download SPZ + grab metadata:
   ```bash
   ID="<scan_id>"
   curl -o "scans/scan2.spz"        "https://scaniverse.com/api/media/$ID/gaussians.spz"
   curl -o "scans/scan2-preview.jpg" "https://scaniverse.com/api/media/$ID/preview.jpg"
   curl -s "https://scaniverse.com/scan/$ID" \
     | python3 -c "import sys,re; m=re.search(r'\"metadata\":(.+?)\\}\\}', sys.stdin.read(), re.DOTALL); print(m.group(1)[:600])"
   ```
4. In `index.html`: replace the `Scan #2 — pending` placeholder with a viewer block using the scan's metadata.

## Why a custom viewer (not just Scaniverse's iframe)?

- Scaniverse scan pages set `x-frame-options: SAMEORIGIN` — they can't be iframed from a different domain.
- Scaniverse's CDN serves the SPZ without `Access-Control-Allow-Origin` headers — cross-origin `fetch()` from a browser fails.
- We download the SPZ once on the dev machine and serve it from our own deployment, then render it with [Spark](https://github.com/sparkjsdev/spark) on top of [Three.js](https://threejs.org).
- This matches `plan.md`'s "build your own viewer" Sunday goal anyway, so it's not just a workaround — it's the intended direction.

## Browser support

WebGL2 required (basically everything since 2017). Spark uses WebGPU when available for additional perf but falls back gracefully.
