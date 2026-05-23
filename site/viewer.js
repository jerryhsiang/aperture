import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

// One Spark viewer per .viewer element. Reproduces Scaniverse's own starting
// camera (center / pitch / yaw / radius) so the splat opens in the same
// orientation users see on scaniverse.com.

function makeStartPosition(target, radius, pitch, yaw) {
  // pitch < 0 → camera above target, looking down
  const p = -pitch; // turn into positive angle above horizon
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return new THREE.Vector3(
    target.x + radius * cp * sy,
    target.y + radius * sp,
    target.z + radius * cp * cy,
  );
}

function initViewer(container) {
  const splatUrl = container.dataset.splat;
  if (!splatUrl) return;

  const status = container.querySelector(".viewer-status");

  // Scaniverse-supplied starting camera (from scan metadata).
  // Falls back to safe defaults if not provided.
  const target = new THREE.Vector3(
    parseFloat(container.dataset.centerX ?? "0"),
    parseFloat(container.dataset.centerY ?? "0"),
    parseFloat(container.dataset.centerZ ?? "0"),
  );
  const radius = parseFloat(container.dataset.radius ?? "5");
  const pitch = parseFloat(container.dataset.pitch ?? "-0.35");
  const yaw = parseFloat(container.dataset.yaw ?? "0");
  const radiusMin = parseFloat(container.dataset.radiusMin ?? "0.1");
  const radiusMax = parseFloat(container.dataset.radiusMax ?? "10");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.01,
    200,
  );
  camera.position.copy(makeStartPosition(target, radius, pitch, yaw));

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.domElement.classList.add("viewer-canvas");
  renderer.domElement.setAttribute("tabindex", "0");
  container.appendChild(renderer.domElement);

  const spark = new SparkRenderer({ renderer });
  scene.add(spark);

  // Orbit-style controls (matches Scaniverse's web viewer UX). Drag to look,
  // right-drag or two-finger to pan, scroll/pinch to zoom.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = radiusMin;
  controls.maxDistance = radiusMax;
  controls.maxPolarAngle = Math.PI; // allow over-the-top
  controls.update();

  const splat = new SplatMesh({
    url: splatUrl,
    onLoad: () => {
      if (status) status.remove();
      container.classList.add("loaded");
    },
  });
  // Identity transform — Scaniverse's metadata is in the same coordinate
  // frame Spark loads .spz into, so no rotation/translation needed.
  scene.add(splat);

  // Focus canvas so keyboard events reach this viewer (not the page).
  renderer.domElement.addEventListener("pointerdown", () => {
    renderer.domElement.focus();
  });

  // WASD walking — move BOTH the camera and the orbit target by the same
  // world-space vector so the look-direction is preserved while you translate.
  // Q/E = down/up. Movement speed scales with scene radius so a small room
  // (1.87m here) moves at the same perceived pace as a larger scan.
  const keys = new Set();
  const onKey = (e) => {
    if (document.activeElement !== renderer.domElement) return;
    const k = e.key.toLowerCase();
    if (!"wasdqe".includes(k) && k !== " ") return;
    e.preventDefault();
    if (e.type === "keydown") keys.add(k);
    else keys.delete(k);
  };
  renderer.domElement.addEventListener("keydown", onKey);
  renderer.domElement.addEventListener("keyup", onKey);

  const moveSpeed = Math.max(0.4, radius * 0.5); // units per second
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const step = new THREE.Vector3();
  let lastTime = performance.now();

  function applyWalk() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (keys.size === 0) return;

    // Forward = direction camera looks (target - position), flattened to XZ
    // so W/S walk along the ground rather than tilting up/down.
    fwd.subVectors(controls.target, camera.position);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-8) return;
    fwd.normalize();
    right.crossVectors(fwd, up).normalize();

    step.set(0, 0, 0);
    if (keys.has("w")) step.addScaledVector(fwd, 1);
    if (keys.has("s")) step.addScaledVector(fwd, -1);
    if (keys.has("d")) step.addScaledVector(right, 1);
    if (keys.has("a")) step.addScaledVector(right, -1);
    if (keys.has("e") || keys.has(" ")) step.y += 1;
    if (keys.has("q")) step.y -= 1;
    if (step.lengthSq() === 0) return;

    step.normalize().multiplyScalar(moveSpeed * dt);
    camera.position.add(step);
    controls.target.add(step);
  }

  // Resize
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(container);

  // Lazy render
  let visible = false;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
    },
    { threshold: 0.01 },
  );
  io.observe(container);

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    applyWalk();
    controls.update();
    renderer.render(scene, camera);
  });
}

document.querySelectorAll(".viewer:not(.placeholder)").forEach(initViewer);
