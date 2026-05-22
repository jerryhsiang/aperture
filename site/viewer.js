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

  // Focus canvas for keyboard events if added later.
  renderer.domElement.addEventListener("pointerdown", () => {
    renderer.domElement.focus();
  });

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
    controls.update();
    renderer.render(scene, camera);
  });
}

document.querySelectorAll(".viewer:not(.placeholder)").forEach(initViewer);
