# Aperture — Splat Tour v0

A weekend-scale test of phone-captured 3D Gaussian Splats wrapped in a custom WebGL viewer. The point isn't to start a business — it's to know whether the capture-quality + browser-render loop is good enough to be interesting downstream (robotics training data, listings, AEC, insurance).

## Status (2026-05-22)

- ✅ Scan #1 captured (Scaniverse, 294K gaussians, 6.4 MB SPZ)
- ✅ Custom viewer rendering scan in-page (Spark + Three.js, WASD walk-through)
- ✅ Deployed to Vercel: https://site-ten-xi-60.vercel.app
- ⏳ Additional scans — TBD

## Stack (what shipped)

| Layer | Tool | Notes |
|---|---|---|
| Capture | **Scaniverse** (iOS, Niantic) | Free, unlimited, on-device. Luma killed consumer 3D capture; their mobile app is Dream Machine only now. Polycam paywalled splat export. |
| Format | **SPZ** (Niantic open spec) | ~10× smaller than `.ply`. Scaniverse CDN serves at `/api/media/<id>/gaussians.spz`. |
| Hosting | Local `site/scans/*.spz` | Scaniverse CDN has no CORS headers and the scan pages set `x-frame-options: SAMEORIGIN`, so we can neither fetch cross-origin nor iframe their UI. Download once, serve from our own static site. |
| Renderer | **Spark** (`@sparkjsdev/spark`) on Three.js | Loaded via CDN importmap, no build step. `SplatMesh` + `SparkRenderer` + `SparkControls` (WASD + mouse + touch). |
| Site | Static HTML/CSS/JS | One `index.html`, one `viewer.js`. Zero deps, zero bundler. |
| Deploy | Vercel (planned) | Free tier. ~14 MB per deployment with two scans + preview JPGs. |

## What went wrong that we had to design around

1. **Original spec called for Luma + iframe embed.** Luma killed consumer 3D capture sometime in 2025 — their `app.lumalabs.ai` is Dream Machine (video gen) only, and the mobile app no longer offers capture.
2. **Switched to Scaniverse.** Free, no account, on-device — best of the alternatives. But Scaniverse scan pages set `x-frame-options: SAMEORIGIN`, so we can't embed `scaniverse.com/scan/<id>` in our own site's iframe.
3. **Scaniverse's CDN doesn't send CORS headers.** Can't `fetch()` the `.spz` from a browser running on a different origin either.
4. **Fix:** download the `.spz` file once via `curl`, commit it into `site/scans/`, render it locally with Spark JS. This actually pulls us closer to `plan.md`'s "custom viewer" goal anyway.
5. **Spark's Scaniverse splats render Y-down by default** — needed a 180° rotation around the X axis (`splat.quaternion.set(1, 0, 0, 0)`) to put the room right-side up.
6. **Camera-inside-splat problem.** Default camera position was inside the captured volume → giant near-plane blobs blocked the view. Backed camera out to `(0, 0.5, -8)` looking at origin; user walks in with WASD.

## File layout

```
Aperture/
  plan.md                  # Original 20-hour Karpathy-style learning sprint plan (north star)
  SUMMARY.md               # This file — what actually shipped and decisions made
  .gitignore
  .claude/launch.json      # Local preview server config (python3 -m http.server 8000)
  site/
    index.html             # Two viewer containers + intro/footer
    styles.css             # Apple-ish dark theme, mobile-responsive
    viewer.js              # ES module — one Spark viewer per .viewer element
    README.md              # Deploy notes + capture workflow
    scans/
      scan1.spz            # 6.4 MB — West Oak Hill capture, 294K gaussians
      scan1-preview.jpg    # 53 KB — Scaniverse-generated thumbnail
```

## Workflow to add a scan

1. Open Scaniverse app → Classic → tap capture → Splat mode.
2. Walk the room (60–90s, three height passes, heavy overlap, avoid mirrors).
3. Wait for on-device processing (3–10 min).
4. Tap **Share → Upload to Scaniverse** → copy the `scaniverse.com/scan/<id>` URL.
5. Send the URL back here. The wiring step is:
   ```bash
   N=2  # next free scan number
   ID=<scan_id>
   curl -o "site/scans/scan$N.spz"         "https://scaniverse.com/api/media/$ID/gaussians.spz"
   curl -o "site/scans/scan$N-preview.jpg" "https://scaniverse.com/api/media/$ID/preview.jpg"
   ```
   Then update `index.html` — add a new `<section class="scene">` block mirroring scan #1 with `data-splat="scans/scan$N.spz"` and the metadata-derived `data-*` camera attributes.

## Sunday 8pm checkpoint — Learning Objectives (from `plan.md`)

You should be able to answer these without looking anything up:

1. **What is a 3D Gaussian, parametrically?** State the parameter vector for one splat and what each component does.
2. **Why is 3DGS faster than NeRF at render time?** Explicit vs. implicit, rasterization vs. ray marching.
3. **What does COLMAP do and why do you need it?** SfM bootstrap and what the trainer consumes.
4. **What is differentiable rasterization?** How gradients flow from rendered pixels to splat params.
5. **What are the two most common failure modes of a phone-captured splat?**
6. **What is the splat file you ship?** `.ply` vs `.splat` vs `.ksplat` vs `.spz` — what does a browser viewer actually consume?

## Concept primer (from `plan.md`)

A 3D Gaussian splat scene is a few hundred thousand to a few million tiny 3D ellipsoids floating in space, each with:

- **Mean** μ ∈ ℝ³ — position
- **Covariance** Σ ∈ ℝ³ˣ³ — shape and orientation (scale s ∈ ℝ³ + quaternion rotation q ∈ ℝ⁴, Σ = R S Sᵀ Rᵀ)
- **Opacity** α ∈ [0,1]
- **Color** — usually spherical harmonics degree 0–3, so color varies with viewing angle (16 RGB SH coefficients per splat for degree 3 = 48 values)

That's ~59 parameters per splat (3 + 3 + 4 + 1 + 48). A typical room scene is 500K–2M splats → 30M–120M trainable parameters. Our captured scan has 294K gaussians → ~17M parameters.

**Training loop sketch** (we did *not* train ourselves yet — that's the Sunday self-hosted path in `plan.md`):
1. Initialize splats from a sparse point cloud (from COLMAP SfM).
2. For each training iter: project splats to image plane → rasterize with α-blending → compute L1+SSIM loss vs. ground-truth photo → backprop.
3. Adaptive density control: clone/split/prune splats by gradient magnitude.
4. Stop at ~30K iters. Export .ply.

**Why faster than NeRF:** NeRF queries an MLP at every sample along every ray. 3DGS rasterizes explicit primitives. NeRF: minutes/frame. 3DGS: 100+ fps on a laptop GPU.

**Why SfM is the hidden hard step:** 80% of bad splats are bad SfM, not bad training. Featureless rooms, glass, mirrors break COLMAP.

## Premise & scope (from `plan.md`)

- **What this is:** A learning sprint on a frontier 3D representation that touches the photonics / Physical AI thesis (sensor fusion, embodied AI training data, lidar adjacency to OUST).
- **What this is not:** A business. The X post claim of "$18k/month in 11 days" is unverified marketing.
- **Hard constraints:**
  - Timebox: Friday night + Saturday + Sunday. Stop Sunday 9pm regardless of state.
  - Cash cap: $50 total. We're at $0 so far.
  - Zero touch on Zumo or Poop AI work over the weekend.
- **Karpathy discipline:** No black boxes where avoidable. We didn't iframe Scaniverse's viewer — we wrote a Three.js wrapper around Spark. COLMAP/INRIA training is still on the Sunday menu.

## Kill criteria (active prohibitions)

- **No services business.** No cold outreach to hotels, agents, dealerships, or Airbnb hosts.
- **No second property pilot** beyond Round Rock condo #19 unless a clear thesis-fit lane emerges.
- **No splat-as-a-service SaaS** without first running a separate 5-angle pressure test.
- **Stop Sunday 9pm regardless.** Bad splats = successful sprint (you learned the failure modes).

## Strategic connection (why it's worth the weekend)

3DGS is the representation layer that:
- Robotics simulators are adopting for photoreal training environments (NVIDIA Isaac Sim).
- Lidar/SAR/sensor-fusion companies will increasingly produce as output, not just point clouds.
- Insurance, AEC, and asset documentation pipelines are early-adopting where real estate is not.

Understanding 3DGS at the math level upgrades the read on the whole sector. The real estate hustle is the bait; the splat literacy is the catch.

## Open questions

- Does Scaniverse's on-device pipeline use the same densification recipe as INRIA, or a simplified one? (Niantic hasn't published.)
- How does scan quality scale with capture duration and overlap density? Need to capture a 2nd room and compare.
- Worth comparing Scaniverse output against an INRIA-trained scene from the same photo set? That's the Sunday block in `plan.md`.
