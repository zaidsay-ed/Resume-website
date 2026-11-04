/* Particle field: one Points cloud that morphs between four shapes as you scroll.
   0 raw cloud → 1 streams converging (extract) → 2 table rows (transform) → 3 bar chart (load).
   app.js writes window.fieldState; this file only reads it. */
import * as THREE from "three";

const S = (window.fieldState = window.fieldState || { p: 0, x: 0, y: 0, alpha: 1, intro: 0, scale: 1 });
const canvas = document.getElementById("field");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
} catch (e) {
  document.documentElement.classList.add("no-webgl");
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 16);

const small = window.innerWidth < 720;
const N = small ? 6500 : 15000;

// ---------- shapes ----------
const A = new Float32Array(N * 3); // cloud
const C = new Float32Array(N * 3); // table
const D = new Float32Array(N * 3); // bars
const E = new Float32Array(N * 3); // service graph (software mode)
const lane = new Float32Array(N);  // stream lane start y
const tpos = new Float32Array(N);  // position along stream
const jit = new Float32Array(N * 3);
const rnd = new Float32Array(N);
const hue = new Float32Array(N);
const size = new Float32Array(N);

function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// table layout: 6 columns x 13 rows of "cells", each cell a row of dots
const COLS = 6, ROWS = 13, colW = 2.25, gap = 0.45, rowH = 0.62;
const tableW = COLS * colW + (COLS - 1) * gap;
// bar chart: rising values, like a metric improving over time
const BARS = [1.3, 2.1, 1.7, 2.9, 2.5, 3.8, 3.3, 4.7, 4.3, 6.0];
const barW = 0.95, barGap = 0.5;
const chartW = BARS.length * barW + (BARS.length - 1) * barGap;
const barTotal = BARS.reduce((a, b) => a + b, 0);
const LANES = [-3.6, -2.2, -0.8, 0.9, 2.3, 3.7];
// software mode: a small service architecture, client → API → services → stores
const NODES = [[-7.2, 0], [-3.4, 1.6], [-3.4, -1.6], [0.6, 3.0], [0.6, 0], [0.6, -3.0], [4.8, 2.0], [4.8, -0.6], [4.8, -3.2]];
const NODE_R = [0.75, 0.55, 0.55, 0.5, 0.5, 0.5, 0.6, 0.6, 0.6];
const LINKS = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5], [3, 6], [4, 6], [4, 7], [5, 7], [5, 8]];

for (let i = 0; i < N; i++) {
  const r = Math.random();
  rnd[i] = r;
  size[i] = 0.6 + Math.random() * 1.0;
  hue[i] = Math.random() < 0.1 ? 1 : 0;

  // cloud: lumpy ellipsoid
  const rr = 5.2 * Math.cbrt(Math.random());
  const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
  A[i * 3] = rr * Math.sin(ph) * Math.cos(th) * 1.35 + gauss() * 0.3;
  A[i * 3 + 1] = rr * Math.cos(ph) * 0.85 + gauss() * 0.3;
  A[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th) + gauss() * 0.3;

  // stream
  lane[i] = LANES[i % LANES.length];
  tpos[i] = Math.random();
  jit[i * 3] = gauss() * 0.12; jit[i * 3 + 1] = gauss() * 0.12; jit[i * 3 + 2] = gauss() * 0.25;

  // table: pick a cell, then a point along its row line
  const cell = Math.floor(Math.random() * COLS * ROWS);
  const col = cell % COLS, row = Math.floor(cell / COLS);
  const fill = row === 0 ? 0.95 : 0.35 + ((Math.sin(cell * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.6; // ragged cell widths, like text
  const x0 = -tableW / 2 + col * (colW + gap);
  C[i * 3] = x0 + Math.random() * colW * fill;
  C[i * 3 + 1] = (ROWS / 2 - row - 0.5) * rowH + gauss() * 0.025 + (row === 0 ? 0.25 : 0);
  C[i * 3 + 2] = gauss() * 0.04;
  if (row === 0) hue[i] = 1;

  // bars: choose a bar weighted by height, fill its volume
  let pick = Math.random() * barTotal, b = 0;
  while (pick > BARS[b]) { pick -= BARS[b]; b++; }
  const bx = -chartW / 2 + b * (barW + barGap);
  D[i * 3] = bx + Math.random() * barW;
  D[i * 3 + 1] = -3.4 + Math.random() * BARS[b];
  D[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  if (b === BARS.length - 1 && Math.random() < 0.7) hue[i] = 1;

  // graph: 55% of particles sit on nodes, the rest along links
  if (Math.random() < 0.55) {
    const n = Math.floor(Math.random() * NODES.length), rad = NODE_R[n] * Math.cbrt(Math.random());
    const t2 = Math.random() * Math.PI * 2, p2 = Math.acos(2 * Math.random() - 1);
    E[i * 3] = NODES[n][0] + rad * Math.sin(p2) * Math.cos(t2);
    E[i * 3 + 1] = NODES[n][1] + rad * Math.cos(p2);
    E[i * 3 + 2] = rad * Math.sin(p2) * Math.sin(t2);
  } else {
    const l = LINKS[Math.floor(Math.random() * LINKS.length)], u = Math.random();
    const a = NODES[l[0]], c = NODES[l[1]];
    E[i * 3] = a[0] + (c[0] - a[0]) * u + gauss() * 0.04;
    E[i * 3 + 1] = a[1] + (c[1] - a[1]) * u + gauss() * 0.04;
    E[i * 3 + 2] = gauss() * 0.04;
  }
}

const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(A, 3));
geo.setAttribute("aC", new THREE.BufferAttribute(C, 3));
geo.setAttribute("aD", new THREE.BufferAttribute(D, 3));
geo.setAttribute("aE", new THREE.BufferAttribute(E, 3));
geo.setAttribute("aLane", new THREE.BufferAttribute(lane, 1));
geo.setAttribute("aT", new THREE.BufferAttribute(tpos, 1));
geo.setAttribute("aJit", new THREE.BufferAttribute(jit, 3));
geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));
geo.setAttribute("aHue", new THREE.BufferAttribute(hue, 1));
geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));

const uniforms = {
  uTime: { value: 0 },
  uP: { value: 0 },
  uIntro: { value: reduce ? 1 : 0 },
  uMode: { value: S.mode || 0 },
  uAlpha: { value: 1 },
  uPR: { value: renderer.getPixelRatio() },
  uMouse: { value: new THREE.Vector2(0, 0) },
  uMouseOn: { value: 0 },
  uWhite: { value: new THREE.Color("#E9EFEA") },
  uAmber: { value: new THREE.Color("#FFC24B") }
};

const mat = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    uniform float uTime, uP, uIntro, uPR, uMode;
    uniform vec2 uMouse;
    uniform float uMouseOn;
    attribute vec3 aC, aD, aE, aJit;
    attribute float aLane, aT, aRnd, aHue, aSize;
    varying float vHue, vFade;

    float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
    float stage(float local) { return ease(local * 1.6 - aRnd * 0.6); }

    void main() {
      // streams flowing left to right and merging into one pipe
      float t = fract(aT + uTime * 0.035);
      float x = -10.0 + 20.0 * t;
      float merge = smoothstep(-3.0, 3.5, x);
      vec3 B = vec3(x, mix(aLane, 0.0, merge) + aJit.y * mix(1.0, 2.2, merge), aJit.z) + vec3(aJit.x, 0.0, 0.0);

      vec3 Acl = position;
      Acl += 0.25 * vec3(sin(uTime * 0.4 + aRnd * 40.0), cos(uTime * 0.35 + aRnd * 30.0), sin(uTime * 0.3 + aRnd * 20.0));

      // software mode swaps the table for a service graph
      vec3 mid = mix(aC, aE, uMode);
      vec3 pos;
      if (uP <= 1.0)      pos = mix(Acl, B, stage(uP));
      else if (uP <= 2.0) pos = mix(B, mid, stage(uP - 1.0));
      else                pos = mix(mid, aD, stage(uP - 2.0));

      // shimmer on structured shapes
      pos.z += 0.04 * sin(uTime * 1.5 + aRnd * 60.0);

      // intro: particles fall in from far away
      float k = ease(uIntro * 1.4 - aRnd * 0.4);
      vec3 far = normalize(position + 0.001) * (18.0 + aRnd * 14.0);
      pos = mix(far, pos, k);

      // cursor gently pushes particles away
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      vec2 toM = mv.xy - uMouse;
      float d = length(toM);
      mv.xy += normalize(toM + 0.0001) * smoothstep(2.8, 0.0, d) * 0.9 * uMouseOn;

      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPR * (40.0 / -mv.z) * (aHue > 0.5 ? 1.25 : 1.0);
      vHue = aHue;
      vFade = k;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uAlpha;
    uniform vec3 uWhite, uAmber;
    varying float vHue, vFade;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      vec3 col = mix(uWhite, uAmber, vHue);
      gl_FragColor = vec4(col, a * uAlpha * (vHue > 0.5 ? 0.95 : 0.55) * vFade);
    }
  `
});

const AMBER = new THREE.Color("#FFC24B"), BLUE = new THREE.Color("#6CC4FF");
const points = new THREE.Points(geo, mat);
const group = new THREE.Group();
group.add(points);
scene.add(group);

// ---------- sizing ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep about 22 units of width visible on narrow screens
  camera.position.z = Math.max(16, (camera.aspect < 1 ? 12.5 : 22) / (2 * Math.tan(THREE.MathUtils.degToRad(22.5)) * camera.aspect));
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);

// ---------- input ----------
const mouse = new THREE.Vector2(0, 0), mouseNDC = new THREE.Vector2(0, 0);
let mouseOn = 0;
window.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") mouseOn = 1;
  mouseNDC.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
}, { passive: true });

// ---------- adaptive quality: halve the particles if frames are slow ----------
let fpsFrames = 0, fpsStart = 0, degraded = false;
function checkFps(now) {
  if (degraded) return;
  if (!fpsStart) { fpsStart = now; return; }
  fpsFrames++;
  const el = now - fpsStart;
  if (el > 2500) {
    const fps = fpsFrames / (el / 1000);
    if (fps < 40) {
      degraded = true;
      geo.setDrawRange(0, Math.floor(N / 2));
      renderer.setPixelRatio(1);
      uniforms.uPR.value = 1;
      resize();
    }
    fpsFrames = 0; fpsStart = now;
  }
}

// ---------- loop ----------
const clock = new THREE.Clock();
let visible = true;
document.addEventListener("visibilitychange", () => { visible = !document.hidden; });

function frame(now) {
  requestAnimationFrame(frame);
  if (!visible) return;
  if (S.intro >= 1) checkFps(now || performance.now());
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!reduce) uniforms.uTime.value += dt;

  uniforms.uP.value += (S.p - uniforms.uP.value) * Math.min(1, dt * 6);
  uniforms.uAlpha.value += (S.alpha - uniforms.uAlpha.value) * Math.min(1, dt * 4);
  uniforms.uIntro.value = reduce ? 1 : S.intro;
  const tm = S.mode || 0;
  uniforms.uMode.value += (tm - uniforms.uMode.value) * Math.min(1, dt * (reduce ? 60 : 3));
  uniforms.uAmber.value.copy(AMBER).lerp(BLUE, uniforms.uMode.value);

  // mouse in view space at z=0 plane
  const halfH = Math.tan(THREE.MathUtils.degToRad(22.5)) * camera.position.z;
  mouse.lerp(new THREE.Vector2(mouseNDC.x * halfH * camera.aspect, mouseNDC.y * halfH), Math.min(1, dt * 8));
  uniforms.uMouse.value.copy(mouse);
  uniforms.uMouseOn.value += (mouseOn - uniforms.uMouseOn.value) * Math.min(1, dt * 3);

  group.position.x += (S.x - group.position.x) * Math.min(1, dt * 3);
  group.position.y += (S.y - group.position.y) * Math.min(1, dt * 3);
  const sc = group.scale.x + ((S.scale || 1) - group.scale.x) * Math.min(1, dt * 3);
  group.scale.setScalar(sc);
  // tilt toward the cursor; a slow turn while the data is still raw
  const raw = Math.max(0, 1 - uniforms.uP.value);
  group.rotation.y += ((mouseNDC.x * 0.18 + raw * Math.sin(uniforms.uTime.value * 0.15) * 0.4) - group.rotation.y) * Math.min(1, dt * 2);
  group.rotation.x += ((-mouseNDC.y * 0.12) - group.rotation.x) * Math.min(1, dt * 2);

  renderer.render(scene, camera);
}
frame();
window.dispatchEvent(new Event("field:ready"));
