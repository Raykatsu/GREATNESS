// Modèle anatomique 3D interactif, en WebGL pur (aucune dépendance), qu'on fait pivoter au doigt. Le corps est bâti
// de « ventres musculaires » (ellipsoïdes) ; le muscle visé s'allume selon son rôle, et on touche un muscle pour le
// choisir. Hors ligne, sans image sous licence. Si l'appareil n'a pas de WebGL, l'app retombe sur la planche 2D.
import { MUSCLES } from "./body.js";
import { $, I, sheet } from "./ui.js";

export function supports3D() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl") || c.getContext("experimental-webgl")); }
  catch { return false; }
}

/* ---------- petite algèbre 4×4 ---------- */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mul = (A, B) => { const C = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += A[k * 4 + j] * B[i * 4 + k]; C[i * 4 + j] = s; } return C; };
const persp = (f, a, n, z) => { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (z + n) / (n - z), -1, 0, 0, 2 * z * n / (n - z), 0]; };
const look = (e, c, u) => { const z = nrm(sub(e, c)), x = nrm(cross(u, z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; };
const rotY = a => { const s = Math.sin(a), c = Math.cos(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
const rotX = a => { const s = Math.sin(a), c = Math.cos(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };

/* ---------- le corps : ventres musculaires (ellipsoïdes) ---------- */
// b:1 → pièce de base (grise, non sélectionnable) ; mir:1 → dupliquée en miroir sur x.
const P = [
  { b: 1, c: [0, .9, 0], r: [.12, .145, .135] }, { b: 1, c: [0, .74, -.01], r: [.08, .08, .08] },
  { id: "traps", c: [0, .69, -.04], r: [.21, .08, .11] },
  { b: 1, c: [0, .5, -.01], r: [.22, .21, .14] }, { b: 1, c: [0, .2, 0], r: [.2, .15, .135] },
  { id: "delts", c: [.26, .62, .01], r: [.12, .12, .11], mir: 1 },
  { id: "pecs", c: [.1, .55, .12], r: [.13, .1, .05], mir: 1 },
  { id: "lats", c: [.19, .46, -.07], r: [.09, .17, .08], mir: 1 },
  { id: "abs", c: [0, .31, .12], r: [.11, .17, .045] },
  { id: "obliques", c: [.15, .31, .07], r: [.045, .14, .07], mir: 1 },
  { id: "lowerback", c: [0, .33, -.13], r: [.13, .13, .055] },
  { id: "glutes", c: [.1, .06, -.12], r: [.13, .12, .1], mir: 1 },
  { b: 1, c: [.335, .46, 0], r: [.088, .23, .088], mir: 1 },
  { id: "biceps", c: [.335, .47, .07], r: [.068, .15, .055], mir: 1 },
  { id: "triceps", c: [.345, .47, -.07], r: [.068, .15, .055], mir: 1 },
  { id: "forearms", c: [.385, .13, .02], r: [.072, .2, .07], mir: 1 },
  { b: 1, c: [.42, -.1, .03], r: [.055, .09, .05], mir: 1 },
  { b: 1, c: [.11, -.2, 0], r: [.13, .27, .13], mir: 1 },
  { id: "quads", c: [.11, -.22, .1], r: [.1, .24, .06], mir: 1 },
  { id: "hams", c: [.11, -.22, -.1], r: [.09, .22, .06], mir: 1 },
  { id: "adductors", c: [.035, -.2, .04], r: [.05, .2, .06], mir: 1 },
  { b: 1, c: [.11, -.51, .01], r: [.088, .085, .088], mir: 1 },
  { id: "calves", c: [.11, -.69, -.04], r: [.085, .18, .07], mir: 1 },
  { b: 1, c: [.11, -.69, .04], r: [.062, .2, .06], mir: 1 },
  { id: "abductors", c: [.205, .05, -.02], r: [.055, .085, .075], mir: 1 },
  { b: 1, c: [.11, -.95, .07], r: [.06, .05, .13], mir: 1 },
];
function ellipsoid(c, r, LA = 16, LO = 22) {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= LA; i++) { const th = i / LA * Math.PI, st = Math.sin(th), ct = Math.cos(th);
    for (let j = 0; j <= LO; j++) { const ph = j / LO * 2 * Math.PI, ux = st * Math.cos(ph), uy = ct, uz = st * Math.sin(ph);
      pos.push(c[0] + r[0] * ux, c[1] + r[1] * uy, c[2] + r[2] * uz); nor.push(...nrm([ux / r[0], uy / r[1], uz / r[2]])); } }
  for (let i = 0; i < LA; i++) for (let j = 0; j < LO; j++) { const a = i * (LO + 1) + j, b = a + LO + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  return { pos, nor, idx };
}
// toutes les pièces (avec miroir)
export const PARTS = P.flatMap(p => (p.mir ? [1, -1] : [1]).map(s => {
  const c = [p.c[0] * s, p.c[1], p.c[2]], m = ellipsoid(c, p.r);
  return { id: p.b ? null : p.id, cc: c, rr: Math.max(...p.r), ...m };
}));

// couleur [r,g,b] 0→1 d'une variable CSS (suit le thème)
function cssRGB(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = v.match(/^#?([0-9a-f]{6})$/i);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
    const n = v.match(/(\d+(?:\.\d+)?)/g);
    if (n && n.length >= 3) return n.slice(0, 3).map(x => +x / 255);
  } catch { /* ignore */ }
  return fallback;
}

const VS = `attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uMVP;uniform mat4 uM;varying vec3 vN;varying vec3 vW;
 void main(){vN=mat3(uM)*aNor;vW=(uM*vec4(aPos,1.)).xyz;gl_Position=uMVP*vec4(aPos,1.);}`;
const FS = `precision mediump float;varying vec3 vN;varying vec3 vW;uniform vec3 uC;uniform vec3 uL;uniform vec3 uE;
 void main(){vec3 N=normalize(vN);vec3 V=normalize(uE-vW);vec3 L=normalize(uL);float d=max(dot(N,L),0.);
  vec3 sky=vec3(.58,.66,.8),grd=vec3(.16,.18,.24);vec3 amb=mix(grd,sky,N.y*.5+.5);
  vec3 H=normalize(L+V);float sp=pow(max(dot(N,H),0.),22.)*.25;float rim=pow(1.-max(dot(N,V),0.),3.)*.28;
  vec3 c=uC*(amb*.55+.78*d)+sp+rim*vec3(.5,.62,.9);gl_FragColor=vec4(pow(c,vec3(.92)),1.);}`;

// Ouvre le modèle 3D. cls : muscle → classe de couleur (mus p / s / st / an, sinon gris). onExercises : callback(muscle).
export function open3D({ cls, title = "Modèle 3D", legend = "", onExercises } = {}) {
  const sh = sheet(`<div class="d3">
    <div class="eyebrow">${I.rotate || ""} 3D</div><h2 class="h2">${title}</h2>
    <div class="d3-stage"><canvas class="d3-cv" aria-label="Modèle anatomique 3D"></canvas>
      <div class="d3-hint">Fais pivoter · touche un muscle</div></div>
    ${legend ? `<div class="d3-legend">${legend}</div>` : ""}
    <div class="d3-sel" id="d3-sel" hidden></div>
  </div>`, { z: 86 });
  const cv = $(".d3-cv", sh.el), selBox = $("#d3-sel", sh.el);
  const gl = cv.getContext("webgl") || cv.getContext("experimental-webgl");
  if (!gl) { sh.close(); return false; }

  const COL = { "mus p": cssRGB("--mus1", [1, .23, .3]), "mus s": cssRGB("--mus2", [1, .62, .26]),
    "mus st": cssRGB("--mus-st", [.24, .53, 1]), "mus an": cssRGB("--mus-an", [.17, .78, .71]), base: cssRGB("--anat-mus", [.56, .6, .68]) };
  let pick = null; // muscle choisi par toucher
  const colorOf = p => (!p.id ? COL.base : p.id === pick ? COL["mus p"] : (COL[cls?.(p.id)] || COL.base));

  const shC = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, shC(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, shC(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr); gl.useProgram(pr); gl.enable(gl.DEPTH_TEST);
  const aPos = gl.getAttribLocation(pr, "aPos"), aNor = gl.getAttribLocation(pr, "aNor");
  const uMVP = gl.getUniformLocation(pr, "uMVP"), uM = gl.getUniformLocation(pr, "uM"), uC = gl.getUniformLocation(pr, "uC"), uL = gl.getUniformLocation(pr, "uL"), uE = gl.getUniformLocation(pr, "uE");
  const bufs = PARTS.map(P => {
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    const inter = []; for (let i = 0; i < P.pos.length / 3; i++) inter.push(P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2], P.nor[i * 3], P.nor[i * 3 + 1], P.nor[i * 3 + 2]);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inter), gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(P.idx), gl.STATIC_DRAW);
    return { vb, ib, n: P.idx.length, part: P };
  });

  const cam = [0, .05, 3.15];
  let yaw = 0.35, pitch = 0.05, spin = true, raf = 0, W = 1, H = 1, mvp = null, model = null;
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1), rect = cv.getBoundingClientRect();
    W = Math.max(1, rect.width | 0); H = Math.max(1, rect.height | 0);
    cv.width = W * dpr; cv.height = H * dpr; gl.viewport(0, 0, cv.width, cv.height);
  }
  function render() {
    raf = 0;
    const proj = persp(34 * Math.PI / 180, cv.width / cv.height, .1, 20), view = look(cam, [0, .02, 0], [0, 1, 0]);
    model = mul(rotY(yaw), rotX(pitch)); mvp = mul(proj, mul(view, model));
    gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp)); gl.uniformMatrix4fv(uM, false, new Float32Array(model));
    gl.uniform3fv(uL, [.4, .7, 1]); gl.uniform3fv(uE, cam);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (const B of bufs) {
      gl.uniform3fv(uC, colorOf(B.part));
      gl.bindBuffer(gl.ARRAY_BUFFER, B.vb); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(aNor); gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 24, 12);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, B.ib); gl.drawElements(gl.TRIANGLES, B.n, gl.UNSIGNED_SHORT, 0);
    }
  }
  const draw = () => { if (!raf && sh.el.isConnected) raf = requestAnimationFrame(render); };
  // toucher un muscle : on projette le centre de chaque pièce à l'écran, on prend la plus proche du doigt (la plus en avant)
  function pickAt(px, py) {
    let best = null, bd = 1e9;
    for (const B of bufs) {
      const p = B.part; if (!p.id) continue;
      const w = [mvp[0] * p.cc[0] + mvp[4] * p.cc[1] + mvp[8] * p.cc[2] + mvp[12], mvp[1] * p.cc[0] + mvp[5] * p.cc[1] + mvp[9] * p.cc[2] + mvp[13], mvp[3] * p.cc[0] + mvp[7] * p.cc[1] + mvp[11] * p.cc[2] + mvp[15]];
      if (w[2] <= 0) continue;
      const sx = (w[0] / w[2] * .5 + .5) * W, sy = (1 - (w[1] / w[2] * .5 + .5)) * H;
      const d = Math.hypot(sx - px, sy - py) - p.rr / w[2] * H * .5; // marge = rayon projeté
      if (d < bd) { bd = d; best = p.id; }
    }
    return bd < 30 ? best : null;
  }
  function select(m) {
    pick = m; draw();
    if (!m) { selBox.hidden = true; return; }
    selBox.hidden = false;
    selBox.innerHTML = `<div class="grow"><b>${MUSCLES[m] || m}</b></div>${onExercises ? `<button class="btn btn-sm btn-primary" id="d3-ex">${I.play || ""} Voir les exercices</button>` : ""}`;
    const b = $("#d3-ex", selBox); if (b) b.onclick = () => { sh.close(); onExercises(m); };
  }

  // pivoter au doigt ; un simple toucher (sans glisser) choisit un muscle
  let drag = null, moved = 0;
  const down = e => { const t = e.touches?.[0] || e; drag = { x: t.clientX, y: t.clientY }; moved = 0; spin = false; };
  const move = e => { if (!drag) return; const t = e.touches?.[0] || e; const dx = t.clientX - drag.x, dy = t.clientY - drag.y;
    yaw += dx * .01; pitch = Math.max(-.8, Math.min(.8, pitch + dy * .01)); drag = { x: t.clientX, y: t.clientY }; moved += Math.abs(dx) + Math.abs(dy); draw(); e.preventDefault?.(); };
  const up = e => { if (drag && moved < 6) { const r = cv.getBoundingClientRect(), t = e.changedTouches?.[0] || e; select(pickAt(t.clientX - r.left, t.clientY - r.top)); } drag = null; };
  cv.addEventListener("mousedown", down); addEventListener("mousemove", move); addEventListener("mouseup", up);
  cv.addEventListener("touchstart", down, { passive: true }); cv.addEventListener("touchmove", move, { passive: false }); cv.addEventListener("touchend", up);

  const ro = new ResizeObserver(() => { resize(); draw(); }); ro.observe(cv);
  resize();
  let last = performance.now();
  (function loop(now) { if (!sh.el.isConnected) { ro.disconnect(); removeEventListener("mousemove", move); removeEventListener("mouseup", up); return; }
    if (spin) { yaw += (now - last) * .0003; draw(); } last = now; requestAnimationFrame(loop); })(last);
  draw();
  return true;
}
