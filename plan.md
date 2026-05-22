# Splat Weekend: A Karpathy-Style Learning Sprint on 3D Gaussian Splatting

## TL;DR

A ~20-hour weekend timeboxed to *understand* 3D Gaussian Splatting (3DGS) from the math up, not just call Luma's API. By Sunday 8pm you will (a) be able to explain what a Gaussian splat is at the parameter level, (b) have trained at least one scene yourself from raw photos using the INRIA reference implementation or nerfstudio, (c) have a self-hosted, custom-rendered splat tour deployed on a URL you control, and (d) know whether the capture-quality ceiling is high enough to interest you in any downstream play (robotics training data, your Round Rock listing, insurance, etc.). Services revenue is *not* the goal. The optional Mon–Wed stretch is one free pilot capture to pressure-test the workflow against a real subject, not to start a business.

## Premise & Scope

- **What this is:** A learning sprint on a frontier 3D representation that touches your photonics / Physical AI thesis (sensor fusion, embodied AI training data, lidar adjacency to OUST).
- **What this is not:** A business. The X post is content marketing dressed as a case study. The "$18k/month in 11 days" claim is unverified. We are using its *technical recipe* and ignoring its *business claims*.
- **Hard constraints:**
  - Timebox: Friday night reading + Saturday + Sunday. Stop Sunday 9pm regardless of state.
  - Cash cap: $50 total (Lambda Labs / Colab Pro one-month, *if* needed).
  - Context-switch cost: zero touch on Zumo or Poop AI work Sat–Sun.
- **Karpathy discipline:** No black boxes where you can avoid it. You will run COLMAP yourself for at least one scene, you will train Gaussians yourself for at least one scene, and you will write the viewer wrapper yourself (not iframe SuperSplat). Use Luma *for contrast*, not as the primary path.

## Why This Is Worth The Weekend (Strategic Connection)

You are tracking ~25 photonics companies and have flagged Physical AI / robotics as a thesis lane (OUST). 3DGS is the representation layer that:
- Robotics simulators are adopting for photoreal training environments (NVIDIA Isaac Sim integrations, various sim2real pipelines).
- Lidar/SAR/sensor-fusion companies will increasingly produce as output, not just point clouds.
- Insurance, AEC (architecture/engineering/construction), and asset documentation pipelines are early-adopting in the ways real estate is *not*.

Understanding 3DGS at the math level upgrades your read on this whole sector. The real estate scanning hustle is the bait; the splat literacy is the catch.

Bonus optional payoff: 901 S Mays #19 is overdue for a decision. A self-rendered splat tour of that unit is a $0 listing differentiator if you still want to move it.

## Sunday 8pm Checkpoint — Learning Objectives

You should be able to answer all of the following without looking anything up:

1. **What is a 3D Gaussian, parametrically?** State the parameter vector for one splat and what each component does.
2. **Why is 3DGS faster than NeRF at render time?** Explain in terms of explicit vs. implicit representation and rasterization vs. ray marching.
3. **What does COLMAP do and why do you need it?** Explain the Structure-from-Motion bootstrap and what the splat trainer consumes as input.
4. **What is differentiable rasterization?** Explain at a high level how gradients flow back from the rendered image to the splat parameters.
5. **What are the two most common failure modes of a phone-captured splat?** (Hint: think about what SfM and Gaussian densification each fail at.)
6. **What is the splat file you ship?** (.ply vs .splat vs .ksplat — what's the difference and what does a browser viewer actually consume?)

If you can't answer one of these Sunday night, the sprint failed. Re-allocate next weekend.

## Concept Primer (Read Before You Code)

A 3D Gaussian splat scene is roughly **a few hundred thousand to a few million tiny 3D ellipsoids** floating in space, each with:

- **Mean** $\mu \in \mathbb{R}^3$ — position
- **Covariance** $\Sigma \in \mathbb{R}^{3\times3}$ — shape and orientation (typically parameterized as scale $s \in \mathbb{R}^3$ + quaternion rotation $q \in \mathbb{R}^4$, so $\Sigma = R S S^T R^T$)
- **Opacity** $\alpha \in [0,1]$
- **Color** — usually as spherical harmonics (SH) coefficients of degree 0–3, so color varies with viewing angle (this is why splats handle specular/glossy surfaces better than naive point clouds; 16 RGB SH coefficients per splat for degree 3, so 48 values)

That's roughly **59 parameters per splat** (3 + 3 + 4 + 1 + 48). A typical room scene is 500K–2M splats → 30M–120M trainable parameters.

**Training loop, at the level you need to know:**

1. **Initialize** splats from a sparse point cloud (from COLMAP SfM).
2. **For each training iteration:**
   - Pick a training image (one of your phone photos).
   - **Project** all visible splats into that camera's view using the camera intrinsics + pose COLMAP gave you.
   - **Rasterize** them in depth-sorted order using $\alpha$-blending (this is the "differentiable rasterization" step — the contribution of each splat to each pixel is a differentiable function of its parameters).
   - **Compute loss** between rendered image and ground-truth photo (L1 + a structural similarity term).
   - **Backprop** through the rasterizer to get gradients on all splat parameters.
   - **Adaptive density control:** clone, split, or prune splats based on gradient magnitudes (this is the secret sauce — splats with high gradient get split into two; nearly transparent ones get pruned).
3. Stop after ~30K iterations. Export the splats as a binary file.

**Why faster than NeRF:** NeRF queries an MLP at every sample point along every ray for every pixel — millions of MLP evaluations per frame. 3DGS rasterizes explicit primitives — one pass, GPU-friendly. NeRF: minutes per frame on training hardware. 3DGS: 100+ fps on a laptop GPU.

**Why SfM is the hidden hard step:** Splat training assumes you know exactly where each photo was taken (camera pose) and the camera's intrinsics. COLMAP solves this via feature matching across overlapping photos. If COLMAP fails to register all your photos (common in featureless rooms, glass, mirrors), your training set is degraded and the scene looks like garbage. **80% of bad splats are bad SfM, not bad training.**

## Friday Night (90 min) — Reading

Don't skip. The Karpathy approach is "read it twice before you touch a keyboard."

1. **The original paper:** Kerbl, Kopanas, Leimkühler, Drettakis, *"3D Gaussian Splatting for Real-Time Radiance Field Rendering"*, SIGGRAPH 2023.  
   Source: `https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/`  
   Read sections 3, 4, and 5 carefully. Skim 6.
2. **Aras Pranckevičius's explainer series** — he wrote a clear, code-flavored breakdown of how the rasterizer actually works. Search "Aras 3D Gaussian Splatting" — there's a multi-part series on his blog.
3. **The "splatting myths" debate** — skim a recent comparison of 3DGS vs. its successors (2D Gaussian Splatting, Mip-Splatting, deformable splats, Gaussian Frosting). This grounds you in where the frontier is *now*, not where it was when the paper dropped.

Don't read tutorials yet. Read the source.

## Saturday — Capture & Managed Pipeline

**Goal:** Get a working splat tour the easy way first, so you have a quality bar to compare against on Sunday.

### Morning (3–4 hr): First Captures

1. **Verify current free-tier limits** on Luma AI and Polycam before doing anything. *(I don't trust the X post's "unlimited free" claim — they've been tightening. Confirm at lumalabs.ai and poly.cam directly.)*
2. **Two captures, same room** — your apartment or wherever:
   - Capture A: Luma AI's iOS app, follow their on-screen guide (slow walk, full coverage, overlap heavily).
   - Capture B: Polycam's Gaussian Splat mode on the same room.
3. Compare the outputs side by side. Note what artifacts each produces (Luma tends to over-smooth, Polycam tends to leave floaters).
4. **Export the .splat or .ply file** from whichever you can — this matters because Sunday you'll render it with your own viewer.

### Afternoon (3–4 hr): Inspect & Edit

1. Load both files in **SuperSplat** (`https://playcanvas.com/supersplat/editor` — open-source, runs in browser, no install).
2. Walk around. Find the floaters. Crop them. Export cleaned versions.
3. **Look at the raw splat count.** How many primitives? What's the file size? This is your baseline.
4. Note: SuperSplat is the canonical *editor*. The *viewer* you'll build Sunday will be much simpler.

End-of-day reflection (10 min, in writing): What does the managed pipeline get right? What does it hide from you? What would you need to control yourself to push quality higher?

## Sunday — Self-Hosted Pipeline & Custom Viewer

**Goal:** Replicate Saturday's result *without Luma or Polycam* and deploy it on infrastructure you control.

### Morning (4 hr): Train Your Own Scene

This is the meat of the weekend. Two viable paths:

**Path A — INRIA reference implementation (more Karpathy-style)**
- Repo: `https://github.com/graphdeco-inria/gaussian-splatting`
- Requires CUDA-capable GPU. If you don't have a workstation, rent one: Lambda Labs on-demand H100 (~$2-3/hr) or RunPod (~$0.50–1.50/hr for an RTX 4090). Should take 30–60 min of training time at most.
- Pipeline you'll run yourself:
  1. Take 100–300 photos of a room (or extract frames from a video with ffmpeg).
  2. Run COLMAP feature extraction + matching + sparse reconstruction. **Watch what fails to register.**
  3. Pass the COLMAP output to the splat trainer (`train.py`).
  4. Wait. Watch the loss curve. Sample the rendered output every few thousand iters.
  5. Export the final .ply.

**Path B — nerfstudio's `splatfacto`**
- Repo: `https://github.com/nerfstudio-project/nerfstudio`
- More opinionated, easier setup, better tooling for inspection (`ns-viewer`).
- Same conceptual pipeline, more guardrails.

**Recommendation:** Path A for the first attempt. If COLMAP hangs or you can't get CUDA working in <60 min, switch to Path B. The point is to train *something* yourself, not to fight environment setup.

What you're learning here, beyond the obvious: how brittle the SfM step is, how training time scales, what the loss curve looks like, what the densification cycle does to splat count over training.

### Afternoon (3 hr): Custom Web Viewer

**Do not iframe SuperSplat.** You're going to use one of:

- **`gsplat.js`** by Dylan Ebert (`https://github.com/dylanebert/gsplat.js`) — minimal three.js-based splat renderer, easy to wrap.
- **`@playcanvas/supersplat-viewer`** — the viewer underneath the SuperSplat editor, usable standalone.
- **`@mkkellogg/gaussian-splats-3d`** — another solid three.js implementation.

Build a single-page site (Next.js since you already use it, or just a static HTML page) with:
- The splat scene as the main canvas
- WASD/touch controls
- A loading state with progress
- Mobile-responsive
- Deployed on Vercel or Cloudflare Pages

Use your `.splat` file from the morning's training run (or Saturday's Luma capture if training failed). Push it to the deploy. **Send yourself the URL on your phone and walk through your apartment in the splat tour.** That moment is the deliverable.

### Evening (1 hr): Self-Quiz

Sit with a notebook. Try to answer the six checkpoint questions in the *Learning Objectives* section above without looking anything up. For each one you can't answer, go back and read.

## Deliverables (Sunday 9pm)

By Sunday evening you should have, on disk and on a public URL:

1. A trained splat scene (`.ply` or `.splat`) you produced yourself with COLMAP → INRIA/nerfstudio.
2. A second splat scene produced via Luma or Polycam, for comparison.
3. A simple deployed web page rendering scene #1 with your own JS viewer, on a Vercel/CF Pages URL.
4. A written page of notes answering the six checkpoint questions in your own words.
5. A one-page "what would I build with this" note — three speculative product/business angles, ranked by your fit. (This is the optionality you keep open for later. Not a commitment.)

## Tooling Cheat Sheet

| Step | Managed (Saturday) | Self-Hosted (Sunday) |
|---|---|---|
| Capture | Luma AI / Polycam apps | iPhone Camera or video → ffmpeg frame extract |
| Camera pose / SfM | (hidden in app) | COLMAP |
| Training | (hidden in app) | INRIA `gaussian-splatting` or nerfstudio `splatfacto` |
| GPU | (cloud, hidden) | Local CUDA card, Lambda Labs, or RunPod (~$0.50–3/hr) |
| Editor | SuperSplat (browser) | SuperSplat (still the right tool) |
| Viewer | Luma's iframe | `gsplat.js` / `supersplat-viewer` in your own Next.js page |
| Hosting | Luma's CDN | Cloudflare R2 or Vercel for the .splat file + page |

## Hardware Reality Check

You need a CUDA-capable GPU somewhere in the loop for training. Options:

- **Have an M-series Mac only:** Skip local training. Use RunPod or Lambda Labs for ~2 hours. Budget $5–10.
- **Have a gaming PC with NVIDIA card (RTX 30-series or better):** Train locally, free.
- **Don't want to deal with cloud:** Use Polycam's hosted splat pipeline as a *substitute* for the training step and focus the Karpathy effort on the viewer + SfM understanding. Note this is a compromise — you'd be skipping the most educational part.

Confirm before Friday night which path you're taking.

## Optional Stretch — Mon/Tue Evening (Cap: 1 client, $0 revenue)

If, *and only if*, the weekend sprint completed successfully and you still want a real subject test:

- One free capture of one property. Round Rock condo #19 is the obvious candidate — you already own the decision around it.
- Deploy the tour as part of an actual listing experiment.
- Done. No second pilot. No sales calls.

The point is to test the workflow end-to-end on a real subject. The point is *not* to start the services business. If you find yourself drafting cold emails to hotels, stop and reread the kill criteria.

## Kill Criteria — What This Cannot Become

Active prohibitions, in writing, so you don't drift:

- **No services business.** No cold outreach to hotels, agents, dealerships, or Airbnb hosts. The X post's "Day 2: walk into three businesses" is the part you ignore.
- **No second property pilot** beyond the Round Rock condo unless a clear thesis-fit lane emerges (robotics training data, AEC documentation, etc.).
- **No splat-as-a-service SaaS** without first running the 5-angle pressure test against it on its own merits. Splat infra is a real opportunity but it deserves its own analysis, not drift from this sprint.
- **Stop Sunday 9pm regardless.** If the trained scene looks terrible, that's still a successful sprint — you learned the failure modes.

## Open Questions / Things to Verify Before Friday Night

I have moderate-to-low confidence on the following, and you should sanity-check at session start (pricing especially moves fast):

- **Luma AI's current free-tier limits.** *(Low confidence — they've been tightening over the past year. Confirm at lumalabs.ai/dream-machine pricing page.)*
- **Polycam's free splat captures per month.** *(Low confidence — they've moved tiers around.)*
- **Whether the INRIA repo still builds cleanly with current CUDA toolkit versions** — environment setup is the most likely time sink. nerfstudio is more reliable here.
- **Current SOTA beyond vanilla 3DGS** — Mip-Splatting, 2D Gaussian Splatting (Huang et al.), Gaussian Frosting, deformable variants. *(Moderate confidence on names; verify which ones have usable open implementations now.)* Not needed for the weekend, but worth scanning the landscape Sunday evening so you know what's next.
- **Whether your phone (which iPhone model?) supports Luma's best capture mode** — some recent iOS captures use depth from the lidar sensor on Pro models for better initialization.

## Cost Cap

| Item | Est. |
|---|---|
| Luma AI (free tier) | $0 |
| Polycam (free tier or 1 month) | $0–$15 |
| Cloud GPU for training (Lambda/RunPod, 2 hours) | $1–$6 |
| Vercel / Cloudflare hosting | $0 |
| **Total** | **$1–$21** |

If the weekend sprint costs more than $50, something has gone wrong in execution. Stop and reassess.

## What All Five Angles Missed (Revisited Under New Framing)

The original pressure-test was against the wrong premise. Under the *learning sprint* framing, the strongest remaining objection isn't strategic — it's about attention residue: your weekly recap flagged two consecutive zero-ship weeks. The risk isn't that splats are a bad bet; it's that this becomes a third zero-ship weekend disguised as learning. The mitigation is the explicit Sunday 9pm deliverable: a deployed URL with a custom-rendered splat scene. That's a *shipped artifact*, not just a tutorial completion.

## One Concrete Next Step

Friday at 8pm, sit down with the INRIA paper PDF and a notebook. Read Sections 3–5 with a pen. Don't open a terminal, don't touch Luma, don't bookmark tutorials. Just read the paper twice. The whole weekend's quality is gated on whether you actually understand what's happening inside a splat before you train one.
