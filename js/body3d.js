// Corps 3D interactif : le modèle anatomique libre BodyParts3D / Z-Anatomy (CC BY-SA), allégé par
// tools/anatomy/export_web.py, affiché en WebGL sans bibliothèque. On le fait tourner au doigt, on zoome à deux doigts,
// on touche un muscle pour savoir lequel c'est. Même code couleur que la planche (js/anatomy.js) : rôles d'un mouvement,
// niveaux de récupération… Le fichier (≈ 3 Mo) n'est chargé qu'à l'ouverture, puis gardé hors ligne par sw.js.
// Format de assets/anatomy/body.bin (décrit par body.json) : positions (3 × int16 quantifiés dans la boîte lo → hi),
// normales + groupe (4 × int8 : nx, ny, nz sur ±127, puis l'index du groupe dans « parts »), indices (uint32), puis le
// squelette des démos animées (4 × uint8 par sommet : ses deux os, le poids du premier et la part de la rotation de
// l'avant-bras qu'il suit ; os décrits dans « rig », articulations des doigts dans « fingers »).
import { ANAT_DIR, ANAT_CREDIT, bodyMap } from "./anatomy.js";
import { MUSCLES } from "./body.js";
import { $, $$, esc, I, sheet } from "./ui.js";

/* ---------- Données ---------- */
// buf : ArrayBuffer de body.bin, meta : contenu de body.json
export function decodeBody(buf, meta) {
  const { v, t, off } = meta;
  const pos = new Int16Array(buf, off.pos, v * 3);
  const nor = new Int8Array(buf, off.nor, v * 4);
  const idx = new Uint32Array(buf, off.idx, t * 3);
  const skin = off.skin != null && buf.byteLength >= off.skin + v * 4 ? new Uint8Array(buf, off.skin, v * 4) : null;
  return { pos, nor, idx, skin, rig: meta.rig || null, fingers: meta.fingers || null, frow: meta.frow ?? null, v, t, lo: meta.lo, hi: meta.hi, parts: meta.parts };
}
let loading = null;
export const loadBody = () => (loading ||= Promise.all([
  fetch(`${ANAT_DIR}body.json`).then(r => { if (!r.ok) throw new Error("body.json"); return r.json(); }),
  fetch(`${ANAT_DIR}body.bin`).then(r => { if (!r.ok) throw new Error("body.bin"); return r.arrayBuffer(); }),
]).then(([meta, buf]) => decodeBody(buf, meta)).catch(e => { loading = null; throw e; }));

/* ---------- Couleurs ---------- */
// Couleurs du thème (variables CSS de la légende), en linéaire pour l'éclairage
const ROLE_VAR = { p: "--mus1", s: "--mus2", st: "--mus-st", an: "--mus-an", rc0: "--rc0", rc1: "--rc1", rc2: "--rc2", rc3: "--rc3" };
export const hexToLinear = hex => {
  const h = String(hex || "").trim().replace("#", ""), n = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const c = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255);
  return c.some(Number.isNaN) ? [0.8, 0.1, 0.1] : c.map(x => Math.pow(x, 2.2));
};
const NATURAL = { bone: [0.60, 0.53, 0.41], tendon: [0.66, 0.62, 0.55], muscle: [0.36, 0.045, 0.035] };
const DIM = { bone: [0.22, 0.22, 0.23], tendon: [0.26, 0.26, 0.27], muscle: [0.085, 0.09, 0.105] };
// Une couleur par groupe de « parts » : naturel (écorché rouge), ou gris + rôles quand cls est donné (comme la planche)
export function colorTable(parts, cls, css = v => "") {
  const base = cls ? DIM : NATURAL;
  return parts.map(p => {
    if (p === "bone" || p === "tendon" || p === "muscle") return base[p];
    const role = cls ? String(cls(p) || "").split(" ")[1] : null;
    return role && ROLE_VAR[role] ? hexToLinear(css(ROLE_VAR[role]) || "#ff3b4e") : base.muscle;
  });
}

/* ---------- Petites matrices (colonne d'abord, comme WebGL) ---------- */
export const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
export const perspective = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f); return o; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function lookAt(eye, at, up) {
  const z = norm(sub(eye, at)), x = norm(cross(up, z)), y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}
// Caméra en orbite autour du corps : lacet (yaw, 0 = de face), tangage limité, distance
export function orbitEye(target, yaw, pitch, dist) {
  return [target[0] + dist * Math.sin(yaw) * Math.cos(pitch), target[1] + dist * Math.sin(pitch), target[2] + dist * Math.cos(yaw) * Math.cos(pitch)];
}

/* ---------- WebGL ---------- */
const VS = `attribute vec3 aPos; attribute vec3 aNor; attribute float aPart;
uniform mat4 uMVP; uniform vec3 uLo; uniform vec3 uSpan; uniform vec3 uCol[20];
varying vec3 vN; varying vec3 vC; varying vec3 vW; varying float vPart;
void main() {
  vec3 p = uLo + (aPos + 32768.0) / 65535.0 * uSpan;
  vec3 w = vec3(p.x, p.z, -p.y);
  vN = vec3(aNor.x, aNor.z, -aNor.y) / 127.0;
  vC = uCol[int(aPart + 0.5)]; vW = w; vPart = aPart;
  gl_Position = uMVP * vec4(w, 1.0);
}`;
const FS = `precision mediump float;
varying vec3 vN; varying vec3 vC; varying vec3 vW; varying float vPart;
uniform vec3 uEye; uniform vec3 uKey; uniform vec3 uFill; uniform vec3 uBack; uniform float uPick; uniform float uSel;
void main() {
  if (uPick > 0.5) { gl_FragColor = vec4((vPart + 1.0) / 255.0, 0.0, 0.0, 1.0); return; }
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(uEye - vW);
  float k = dot(n, uKey), wrap = max((k + 0.4) / 1.4, 0.0);
  float f = max(dot(n, uFill), 0.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6) * (0.35 + 0.65 * max(dot(n, uBack), 0.0));
  float s = pow(max(dot(n, normalize(uKey + v)), 0.0), 42.0);
  vec3 c = vC * (0.12 + 0.62 * mix(max(k, 0.0), wrap, 0.45) + 0.24 * f) + vec3(0.92, 0.95, 1.0) * (0.20 * s + 0.30 * rim);
  if (abs(vPart - uSel) < 0.5) c += vec3(0.10, 0.03, 0.02) + 0.25 * vC;
  gl_FragColor = vec4(pow(c, vec3(0.4545)), 1.0);
}`;

function program(gl) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

// Démarre la vue dans un canevas. Renvoie { setColors, view, destroy } ; onPick(nom de groupe ou null).
function mount(canvas, body, colors, { onPick, onReady } = {}) {
  const gl = canvas.getContext("webgl2", { antialias: true }) || canvas.getContext("webgl", { antialias: true });
  if (!gl) throw new Error("WebGL indisponible");
  if (!(gl instanceof (window.WebGL2RenderingContext || Object)) && !gl.getExtension("OES_element_index_uint")) throw new Error("WebGL : index 32 bits indisponibles");
  const prog = program(gl);
  gl.useProgram(prog);
  const buf = (target, data) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
  const pb = buf(gl.ARRAY_BUFFER, body.pos), nb = buf(gl.ARRAY_BUFFER, body.nor), ib = buf(gl.ELEMENT_ARRAY_BUFFER, body.idx);
  const aPos = gl.getAttribLocation(prog, "aPos"), aNor = gl.getAttribLocation(prog, "aNor"), aPart = gl.getAttribLocation(prog, "aPart");
  gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.SHORT, false, 6, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.enableVertexAttribArray(aNor); gl.vertexAttribPointer(aNor, 3, gl.BYTE, false, 4, 0);
  gl.enableVertexAttribArray(aPart); gl.vertexAttribPointer(aPart, 1, gl.BYTE, false, 4, 3);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  const U = n => gl.getUniformLocation(prog, n);
  const lo = body.lo, span = body.hi.map((h, i) => h - lo[i]);
  gl.uniform3fv(U("uLo"), lo); gl.uniform3fv(U("uSpan"), span);
  const target0 = [lo[0] + span[0] / 2, lo[2] + span[2] / 2, -(lo[1] + span[1] / 2)]; // centre du corps (repère du monde)
  const H = span[2], FOV = 0.52;
  const dist0 = (H * 0.52) / Math.tan(FOV / 2);
  const cam = { yaw: 0, pitch: 0.05, dist: dist0, ty: target0[1], spin: true };
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  let sel = -1, raf = 0, dead = false;
  const setColors = cols => { const f = new Float32Array(60); cols.slice(0, 20).forEach((c, i) => f.set(c, i * 3)); gl.uniform3fv(U("uCol[0]"), f); draw(); };
  const size = () => {
    const r = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * r), h = Math.round(canvas.clientHeight * r);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  };
  const frame = (pick = false) => {
    size();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const target = [target0[0], cam.ty, target0[2]], eye = orbitEye(target, cam.yaw, cam.pitch, cam.dist);
    const proj = perspective(FOV, canvas.width / Math.max(1, canvas.height), 0.05, 20);
    gl.uniformMatrix4fv(U("uMVP"), false, mul(proj, lookAt(eye, target, [0, 1, 0])));
    // lumières attachées à la caméra : principale en haut à gauche, d'appoint à droite, contre-jour derrière
    const fwd = norm(sub(target, eye)), right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
    const dir = (a, b, c) => norm([right[0] * a + up[0] * b - fwd[0] * c, right[1] * a + up[1] * b - fwd[1] * c, right[2] * a + up[2] * b - fwd[2] * c]);
    gl.uniform3fv(U("uEye"), eye); gl.uniform3fv(U("uKey"), dir(-0.55, 0.65, 0.55)); gl.uniform3fv(U("uFill"), dir(0.8, 0.1, 0.4)); gl.uniform3fv(U("uBack"), dir(0.2, 0.4, -0.9));
    gl.uniform1f(U("uPick"), pick ? 1 : 0); gl.uniform1f(U("uSel"), sel);
    gl.drawElements(gl.TRIANGLES, body.t * 3, gl.UNSIGNED_INT, 0);
  };
  function draw() { if (!raf && !dead) raf = requestAnimationFrame(tick); }
  function tick(ts) {
    raf = 0;
    if (dead) return;
    if (!canvas.isConnected) return kill(); // la carte ou la feuille a disparu : on libère le contexte WebGL
    if (cam.spin) { cam.yaw += 0.006; draw(); }
    frame();
  }
  function kill() { dead = true; cancelAnimationFrame(raf); ro?.disconnect(); gl.getExtension("WEBGL_lose_context")?.loseContext(); }
  // Toucher un muscle : on rend les groupes en couleurs « identifiants » et on lit le pixel touché
  const pick = (x, y) => {
    const r = canvas.getBoundingClientRect(), px = Math.round((x - r.left) / r.width * canvas.width), py = Math.round((1 - (y - r.top) / r.height) * canvas.height);
    gl.disable(gl.BLEND);
    frame(true);
    const out = new Uint8Array(4);
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    const id = out[0] - 1;
    sel = id >= 3 ? id : -1;
    frame();
    onPick?.(id >= 0 ? body.parts[id] : null);
  };
  // Gestes : glisser = tourner, pincer = zoomer, deux doigts = monter/descendre, toucher = nommer, double-toucher = recadrer
  const pts = new Map();
  let start = null, lastTap = 0, pinch0 = 0, dist0p = 0, mid0 = 0, ty0 = 0;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    cam.spin = false;
    if (pts.size === 1) start = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0p = cam.dist; mid0 = (a[1] + b[1]) / 2; ty0 = cam.ty; start = null; }
  });
  canvas.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 7) start.moved = true;
      cam.yaw -= dx * 0.009;
      cam.pitch = Math.max(-0.7, Math.min(0.7, cam.pitch + dy * 0.006));
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch0 > 0) cam.dist = Math.max(0.5, Math.min(dist0 * 1.6, dist0p * pinch0 / Math.max(20, d)));
      cam.ty = Math.max(lo[2], Math.min(lo[2] + H, ty0 + ((a[1] + b[1]) / 2 - mid0) * cam.dist * 0.0018));
    }
    draw();
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (start && !start.moved && performance.now() - start.t < 450 && pts.size === 0) {
      const now = performance.now();
      if (now - lastTap < 320) { Object.assign(cam, { dist: dist0, ty: target0[1], pitch: 0.05 }); draw(); }
      else pick(e.clientX, e.clientY);
      lastTap = now;
    }
    if (!pts.size) start = null;
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", e => { e.preventDefault(); cam.spin = false; cam.dist = Math.max(0.5, Math.min(dist0 * 1.6, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); draw(); }, { passive: false });
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => draw()) : null;
  ro?.observe(canvas);
  setColors(colors);
  onReady?.();
  return {
    setColors,
    view(name) { cam.spin = false; Object.assign(cam, { yaw: { front: 0, side: Math.PI / 2, back: Math.PI }[name] ?? 0, pitch: 0.05, dist: dist0, ty: target0[1] }); draw(); },
    spin(on) { cam.spin = !!on; if (on) draw(); },
    destroy: kill,
  };
}

/* ---------- Écran ---------- */
const PART_NAME = { bone: "Un os", tendon: "Tendon", muscle: "Muscle profond ou du visage" };
// Le corps 3D dans une carte (récap de fin de séance, live.js) : il tourne seul, aux couleurs données, sans gestes (le
// toucher ouvre la vue plein écran) ; il s'arrête hors de l'écran et au bout d'une minute, et se libère quand la carte
// disparaît. Rejette sans WebGL (la planche reste affichée).
export async function mountInline(host, cls) {
  const body = await loadBody();
  if (!host.isConnected) return null;
  const canvas = document.createElement("canvas");
  canvas.className = "b3d-inline";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v);
  let v;
  try { v = mount(canvas, body, colorTable(body.parts, cls, css)); } catch (e) { canvas.remove(); throw e; }
  const t0 = performance.now(), stop = () => v.spin(false), timer = setTimeout(stop, 60000);
  const io = typeof IntersectionObserver === "function" ? new IntersectionObserver(([e]) => {
    if (!canvas.isConnected) { io.disconnect(); clearTimeout(timer); return; }
    v.spin(e.isIntersecting && performance.now() - t0 < 60000);
  }) : null;
  io?.observe(host);
  return { ...v, destroy() { io?.disconnect(); clearTimeout(timer); v.destroy(); } };
}

// opts : title, cls (classe par muscle, comme bodyMap), legend ([variable CSS de la couleur, libellé]…),
// onMuscle(m) pour « Voir les exercices » sur le muscle touché, onClose à la fermeture
export function openBody3D({ title = "Le corps humain", cls = null, legend = [], onMuscle = null, onClose = null } = {}) {
  const sh = sheet(`<div class="b3d">
    <div class="eyebrow">Anatomie 3D</div><h2 class="h2">${esc(title)}</h2>
    <div class="b3d-stage"><canvas class="b3d-cv" aria-label="Corps humain en 3D, à faire tourner"></canvas>
      <div class="b3d-load" id="b3d-load"><i class="spinner"></i><span>Chargement du corps 3D…</span></div>
      <div class="b3d-tip" id="b3d-tip" aria-live="polite" hidden></div></div>
    <div class="seg b3d-views" id="b3d-views"><button data-v="front" class="on">Face</button><button data-v="side">Profil</button><button data-v="back">Dos</button></div>
    ${legend.length ? `<div class="b3d-leg">${legend.map(([v, l]) => `<span><i style="background:var(${v})"></i>${esc(l)}</span>`).join("")}</div>` : ""}
    <p class="xs muted b3d-help">Fais glisser pour tourner, pince pour zoomer, touche un muscle pour le nommer. Double-touche pour recadrer.</p>
    <p class="xs dim b3d-credit">${esc(ANAT_CREDIT)}</p></div>`, { z: 75, onClose: () => { viewer?.destroy(); onClose?.(); } });
  const canvas = $(".b3d-cv", sh.el), tip = $("#b3d-tip", sh.el), load = $("#b3d-load", sh.el);
  let viewer = null;
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v);
  const showTip = part => {
    if (!part) { tip.hidden = true; return; }
    const m = MUSCLES[part];
    tip.hidden = false;
    tip.innerHTML = m ? `<b>${esc(m)}</b>${onMuscle ? `<button class="chip red" id="b3d-go">${I.play} Voir les exercices</button>` : ""}` : `<b>${esc(PART_NAME[part] || part)}</b>`;
    $("#b3d-go", tip)?.addEventListener("click", () => { sh.close(); onMuscle(part); });
  };
  $$("#b3d-views button", sh.el).forEach(b => b.onclick = () => {
    $$("#b3d-views button", sh.el).forEach(x => x.classList.toggle("on", x === b));
    viewer?.view(b.dataset.v);
  });
  loadBody().then(body => {
    if (!sh.el.isConnected) return;
    viewer = mount(canvas, body, colorTable(body.parts, cls, css), { onPick: showTip, onReady: () => load.remove() });
    sh.el.querySelector(".b3d").dataset.ready = "1";
  }).catch(err => {
    // pas de WebGL, ou fichier introuvable hors ligne : la planche en images prend le relais
    console.warn("Corps 3D :", err);
    if (!sh.el.isConnected) return;
    $(".b3d-stage", sh.el).innerHTML = `<div class="b3d-fallback">${bodyMap({}, { cls: cls || (() => "mz"), label: title })}
      <p class="small muted">La vue 3D n'a pas pu s'ouvrir sur cet appareil. Voici la planche à la place.</p></div>`;
    $("#b3d-views", sh.el).hidden = true;
    sh.el.querySelector(".b3d").dataset.ready = "fallback";
  });
  return sh;
}
