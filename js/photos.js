// Photos avant / après : prises avec un cadrage « fantôme » (la photo précédente en transparence) et un
// retardateur, comparées avec un curseur, partagées en une image. Elles restent sur le téléphone
// (IndexedDB), jamais envoyées en ligne.
import { state, currentUser } from "./store.js";
import { beep, vibrate } from "./fx.js";
import { measureNear, spanText } from "./records.js";
import { $, $$, esc, I, sheet, toast, confirmSheet } from "./ui.js";

const DAY = 864e5;
export const POSES = [["face", "Face"], ["profil", "Profil"], ["dos", "Dos"]];
const poseName = k => (POSES.find(p => p[0] === k) || POSES[0])[1];
const fmtDay = (t, o = { day: "numeric", month: "short", year: "numeric" }) => new Date(t).toLocaleDateString("fr-FR", o);
const num = v => String(Math.round(v * 10) / 10).replace(".", ",");

/* ---------- Stockage local ---------- */
let dbp = null;
const db = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open("greatness-photos", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("photos", { keyPath: "id" }).createIndex("user", "user");
  r.onsuccess = () => res(r.result);
  r.onerror = () => { dbp = null; rej(r.error); };
}));
async function run(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction("photos", mode), req = fn(t.objectStore("photos"));
    t.oncomplete = () => res(req?.result);
    t.onerror = t.onabort = () => rej(t.error);
  });
}
export const listPhotos = async () => ((await run("readonly", s => s.index("user").getAll(currentUser))) || []).sort((a, b) => a.date - b.date);
const putPhoto = p => run("readwrite", s => s.put(p));
const deletePhoto = id => run("readwrite", s => s.delete(id));

/* ---------- Images ---------- */
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const toBlob = (c, q = 0.86) => new Promise(r => c.toBlob(r, "image/jpeg", q));
function fit(src, max) {
  const w = src.naturalWidth || src.videoWidth || src.width, h = src.naturalHeight || src.videoHeight || src.height, k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  return c;
}
// Photo + vignette à partir d'une image, d'un canvas ou d'une vidéo (miroir pour la caméra frontale)
async function encode(src, { mirror = false } = {}) {
  const out = {};
  for (const [k, max, q] of [["img", 1600, 0.86], ["thumb", 360, 0.8]]) {
    const c = fit(src, max), g = c.getContext("2d");
    if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(src, 0, 0, c.width, c.height);
    out[k] = await toBlob(c, q);
  }
  return out;
}

/* ---------- Carte de l'onglet Progrès ---------- */
const urls = new Set();
const url = b => { const u = URL.createObjectURL(b); urls.add(u); return u; };
const freeUrls = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); };

export const photosSection = () => `<div class="section"><h2>Photos avant / après</h2><button class="me-add" id="ph-add">${I.plus}Photo</button></div><div class="card ph-card" id="ph-card"><div class="ph-skel"></div></div>`;

export async function mountPhotos(root, refresh) {
  const box = $("#ph-card", root), add = $("#ph-add", root);
  if (!box) return;
  const again = () => (refresh ? refresh() : mountPhotos(root));
  if (add) add.onclick = () => addPhoto(again);
  if (!("indexedDB" in window)) { box.innerHTML = `<div class="empty">${I.camera}<b>Photos indisponibles</b>Ce navigateur ne permet pas de les garder.</div>`; return; }
  let list = [];
  try { list = await listPhotos(); } catch { /* stockage bloqué (navigation privée) */ }
  if (!box.isConnected) return;
  freeUrls();
  if (!list.length) {
    box.innerHTML = `<div class="empty ph-empty">${I.camera}<b>Vois ton corps changer</b>Une photo de face, de profil et de dos toutes les 4 semaines, toujours au même endroit : le cadrage fantôme t'aide à refaire la même.
      <button class="btn btn-primary btn-sm mt-s" id="ph-first">${I.camera} Première photo</button><small class="xs dim">Tes photos restent sur ce téléphone, jamais envoyées en ligne.</small></div>`;
    $("#ph-first", box).onclick = () => addPhoto(again);
    return;
  }
  const last = list[list.length - 1], due = last.date + 28 * DAY;
  const byPose = POSES.map(([k]) => list.filter(p => p.pose === k)).filter(l => l.length >= 2).sort((a, b) => (b[b.length - 1].date - b[0].date) - (a[a.length - 1].date - a[0].date))[0];
  box.innerHTML = `
    ${byPose ? `<button class="ph-hero" id="ph-cmp"><span class="ph-pair"><img src="${url(byPose[0].thumb)}" alt=""><img src="${url(byPose[byPose.length - 1].thumb)}" alt=""></span>
      <span class="grow"><b>Comparer avant / après</b><small>${poseName(byPose[0].pose)} · ${spanText(byPose[byPose.length - 1].date - byPose[0].date)}${(() => { const a = measureNear(state.body, byPose[0].date), b = measureNear(state.body, byPose[byPose.length - 1].date); return a && b ? ` · ${b - a > 0 ? "+" : "−"}${num(Math.abs(b - a))} kg` : ""; })()}</small></span>${I.chev}</button>` : ""}
    <div class="ph-strip">${list.slice().reverse().slice(0, 12).map(p => `<button class="ph-th" data-ph="${p.id}"><img src="${url(p.thumb)}" alt="Photo ${esc(poseName(p.pose))} du ${fmtDay(p.date)}" loading="lazy"><span>${fmtDay(p.date, { day: "numeric", month: "short" })}</span></button>`).join("")}</div>
    <div class="ph-foot xs ${Date.now() > due ? "due" : "dim"}">${Date.now() > due ? `${I.clock} C'est le moment d'une nouvelle photo !` : `Prochaine photo conseillée le ${fmtDay(due, { day: "numeric", month: "long" })}`} · ${list.length} photo${list.length > 1 ? "s" : ""}, sur ce téléphone uniquement</div>`;
  $("#ph-cmp", box)?.addEventListener("click", () => openCompare(list, byPose[0].pose));
  $$("[data-ph]", box).forEach(b => b.onclick = () => openPhoto(list.find(p => p.id === b.dataset.ph), list, again));
}

/* ---------- Ajout ---------- */
function addPhoto(done) {
  let pose = "face";
  const sh = sheet(`<h2 class="h2">Nouvelle photo</h2><p class="small muted" style="margin:6px 0 0">Même endroit, même lumière, même tenue à chaque fois : la comparaison sera parlante.</p>
    <div class="seg mt" id="ph-pose" style="--n:3">${POSES.map(([k, l]) => `<button data-p="${k}" class="${k === pose ? "on" : ""}">${l}</button>`).join("")}</div>
    <button class="btn btn-primary btn-lg btn-block mt" id="ph-cam">${I.camera} Prendre avec le cadrage</button>
    <label class="btn btn-soft btn-block mt-s ph-file">${I.plus} Choisir dans la galerie<input type="file" accept="image/*" id="ph-in" class="sr-only"></label>
    <p class="xs dim mt-s">Le cadrage montre ta photo précédente en transparence et lance un retardateur pour que tu aies le temps de te placer.</p>`);
  $$("#ph-pose button", sh.el).forEach(b => b.onclick = () => { pose = b.dataset.p; $$("#ph-pose button", sh.el).forEach(x => x.classList.toggle("on", x === b)); });
  const store = async (enc, date = Date.now()) => {
    const weight = measureNear(state.body, date) || null;
    try {
      await putPhoto({ id: "ph" + date.toString(36) + Math.random().toString(36).slice(2, 6), user: currentUser, date, pose, weight, ...enc });
      navigator.storage?.persist?.().catch(() => {});
      toast("Photo enregistrée sur ce téléphone ✓");
      done?.();
    } catch { toast("Impossible d'enregistrer la photo (stockage plein ou bloqué)."); }
  };
  $("#ph-cam", sh.el).onclick = async () => {
    const prev = (await listPhotos().catch(() => [])).filter(p => p.pose === pose).pop();
    sh.close();
    ghostCam({ ghost: prev?.img, pose, onShot: store });
  };
  $("#ph-in", sh.el).onchange = async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    sh.close();
    const u = URL.createObjectURL(f);
    try { const img = await loadImg(u); await store(await encode(img), f.lastModified && Date.now() - f.lastModified < 365 * DAY ? f.lastModified : Date.now()); }
    catch { toast("Cette image n'a pas pu être lue."); }
    finally { URL.revokeObjectURL(u); }
  };
}

// Caméra plein écran : photo précédente en transparence, retardateur, aperçu avant de garder
function ghostCam({ ghost, pose, onShot }) {
  const wrap = document.createElement("div");
  wrap.className = "cam ghost-cam mirror";
  const gu = ghost ? URL.createObjectURL(ghost) : null;
  wrap.innerHTML = `<video playsinline muted></video>${gu ? `<img class="gc-ghost" src="${gu}" alt="">` : `<svg class="gc-guide" viewBox="0 0 100 160" aria-hidden="true"><path d="M50 14a11 11 0 1 1 0 22a11 11 0 1 1 0-22M32 44h36l8 44-8 2-4-28v34l4 52h-10l-6-44-6 44h-10l4-52V62l-4 28-8-2z"/></svg>`}
    <div class="cam-top"><button class="icon-btn" data-x aria-label="Fermer">${I.x}</button>
      <div class="cam-title"><b>Photo ${esc(poseName(pose).toLowerCase())}</b><small>${gu ? "Aligne-toi sur ta photo précédente" : "Tout le corps dans le cadre, téléphone posé à hauteur de taille"}</small></div>
      <button class="icon-btn" data-flip aria-label="Changer de caméra">${I.refresh}</button></div>
    ${gu ? `<label class="gc-op"><span>Fantôme</span><input type="range" min="0" max="80" value="40" aria-label="Transparence de la photo précédente"></label>` : ""}
    <div class="gc-count" aria-live="assertive"></div>
    <div class="cam-bottom gc-bottom"><div class="seg gc-timer" style="--n:3"><button data-t="0">0 s</button><button data-t="3">3 s</button><button data-t="10" class="on">10 s</button></div>
      <button class="gc-shoot" aria-label="Prendre la photo"></button></div>
    <div class="gc-review" hidden><img alt="Aperçu"><div class="cam-bottom"><button class="btn btn-soft" data-redo>${I.undo} Reprendre</button><button class="btn btn-primary" data-keep>${I.check} Garder</button></div></div>`;
  document.body.appendChild(wrap);
  const video = $("video", wrap);
  let stream = null, facing = "user", timer = 10, counting = null, shot = null;
  const stop = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; };
  const close = () => { clearInterval(counting); stop(); if (gu) URL.revokeObjectURL(gu); if (shot) URL.revokeObjectURL(shot.u); wrap.remove(); };
  async function start() {
    stop();
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1440 }, height: { ideal: 1920 } }, audio: false }); }
    catch { toast("Autorise la caméra, ou choisis une photo dans la galerie.", 3500); return close(); }
    video.srcObject = stream;
    wrap.classList.toggle("mirror", facing === "user");
    await video.play().catch(() => {});
  }
  async function take() {
    if (!stream || video.readyState < 2) return;
    const enc = await encode(video, { mirror: facing === "user" });
    wrap.classList.add("flash"); setTimeout(() => wrap.classList.remove("flash"), 300);
    shot = { enc, u: URL.createObjectURL(enc.img) };
    const rv = $(".gc-review", wrap);
    $("img", rv).src = shot.u; rv.hidden = false;
  }
  $("[data-x]", wrap).onclick = close;
  $("[data-flip]", wrap).onclick = () => { facing = facing === "user" ? "environment" : "user"; start(); };
  $$(".gc-timer button", wrap).forEach(b => b.onclick = () => { timer = +b.dataset.t; $$(".gc-timer button", wrap).forEach(x => x.classList.toggle("on", x === b)); });
  $(".gc-op input", wrap)?.addEventListener("input", e => { $(".gc-ghost", wrap).style.opacity = e.target.value / 100; });
  $(".gc-shoot", wrap).onclick = () => {
    if (counting) { clearInterval(counting); counting = null; $(".gc-count", wrap).textContent = ""; return; } // second appui : annule
    if (!timer) return void take();
    let n = timer;
    const show = () => { $(".gc-count", wrap).textContent = n; beep(n <= 3 ? 1040 : 760, 0.08); vibrate(10); };
    show();
    counting = setInterval(() => {
      n--;
      if (n > 0) return show();
      clearInterval(counting); counting = null; $(".gc-count", wrap).textContent = "";
      take();
    }, 1000);
  };
  $("[data-redo]", wrap).onclick = () => { $(".gc-review", wrap).hidden = true; URL.revokeObjectURL(shot.u); shot = null; };
  $("[data-keep]", wrap).onclick = () => { const s = shot; shot = null; URL.revokeObjectURL(s.u); close(); onShot(s.enc); };
  start();
}

/* ---------- Voir une photo ---------- */
function openPhoto(p, list, done) {
  if (!p) return;
  const u = URL.createObjectURL(p.img);
  const sh = sheet(`<div class="ph-view"><img src="${u}" alt="Photo ${esc(poseName(p.pose))}"></div>
    <div class="row between mt-s"><div><b>${esc(poseName(p.pose))}</b><div class="small muted">${fmtDay(p.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${p.weight ? ` · ${num(p.weight)} kg` : ""}</div></div></div>
    <div class="grid2 mt"><button class="btn btn-soft" id="pv-save">${I.send} Enregistrer</button><button class="btn btn-danger" id="pv-del">${I.trash} Supprimer</button></div>
    ${list.filter(x => x.pose === p.pose).length >= 2 ? `<button class="btn btn-primary btn-block mt-s" id="pv-cmp">Comparer avec une autre</button>` : ""}`, { onClose: () => URL.revokeObjectURL(u) });
  $("#pv-save", sh.el).onclick = () => shareBlob(p.img, `greatness-${p.pose}-${new Date(p.date).toISOString().slice(0, 10)}.jpg`);
  $("#pv-del", sh.el).onclick = async () => {
    if (!(await confirmSheet("Supprimer cette photo ?", "Elle sera effacée de ce téléphone.", "Supprimer", true))) return;
    await deletePhoto(p.id).catch(() => {});
    sh.close(); toast("Photo supprimée"); done?.();
  };
  $("#pv-cmp", sh.el)?.addEventListener("click", () => { sh.close(); openCompare(list, p.pose, p.id); });
}

/* ---------- Comparer ---------- */
function openCompare(all, pose, focusId) {
  const poses = POSES.filter(([k]) => all.filter(p => p.pose === k).length >= 2);
  if (!poses.length) return toast("Il faut au moins 2 photos de la même pose.");
  if (!poses.some(([k]) => k === pose)) pose = poses[0][0];
  let list = all.filter(p => p.pose === pose), a = list[0], b = list[list.length - 1], mode = "wipe";
  if (focusId && focusId !== a.id) b = list.find(p => p.id === focusId) || b;
  const own = [];
  const u = p => { const x = URL.createObjectURL(p.img); own.push(x); return x; };
  const sh = sheet(`<h2 class="h2">Avant / après</h2>
    ${poses.length > 1 ? `<div class="seg mt-s" id="cp-pose" style="--n:${poses.length}">${poses.map(([k, l]) => `<button data-p="${k}" class="${k === pose ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}
    <div id="cp-main"></div>
    <div class="seg mt-s" id="cp-mode" style="--n:2"><button data-m="wipe" class="on">Glisser</button><button data-m="side">Côte à côte</button></div>
    <div id="cp-pick"></div>
    <button class="btn btn-primary btn-block mt" id="cp-share">${I.send} Partager l'avant / après</button>
    <p class="xs dim mt-s" style="text-align:center">L'image est créée sur ton téléphone ; tu choisis à qui l'envoyer.</p>`, { onClose: () => own.forEach(x => URL.revokeObjectURL(x)) });
  const stats = () => {
    const parts = [spanText(b.date - a.date)];
    const w1 = a.weight || measureNear(state.body, a.date), w2 = b.weight || measureNear(state.body, b.date);
    if (w1 && w2) parts.push(`${w2 - w1 > 0 ? "+" : w2 < w1 ? "−" : ""}${num(Math.abs(w2 - w1))} kg`);
    const t1 = measureNear(state.body, a.date, "waist"), t2 = measureNear(state.body, b.date, "waist");
    if (t1 && t2) parts.push(`tour de taille ${t2 - t1 > 0 ? "+" : t2 < t1 ? "−" : ""}${num(Math.abs(t2 - t1))} cm`);
    return parts.join(" · ");
  };
  const lab = (p, k) => `${k} · ${fmtDay(p.date, { day: "numeric", month: "short", ...(new Date(p.date).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) })}${p.weight ? ` · ${num(p.weight)} kg` : ""}`;
  const draw = () => {
    const ua = u(a), ub = u(b), main = $("#cp-main", sh.el);
    main.innerHTML = mode === "wipe"
      ? `<div class="cmp-view mt" style="--x:50%"><img src="${ub}" alt="Après"><img class="cmp-before" src="${ua}" alt="Avant">
          <div class="cmp-line"><span class="cmp-knob">${I.back}${I.chev}</span></div>
          <span class="cmp-lab l">${esc(lab(a, "Avant"))}</span><span class="cmp-lab r">${esc(lab(b, "Après"))}</span>
          <input type="range" class="cmp-range" min="0" max="100" value="50" step="0.5" aria-label="Glisser pour comparer"></div>`
      : `<div class="cmp-side mt"><figure><img src="${ua}" alt="Avant"><figcaption>${esc(lab(a, "Avant"))}</figcaption></figure><figure><img src="${ub}" alt="Après"><figcaption>${esc(lab(b, "Après"))}</figcaption></figure></div>`;
    main.insertAdjacentHTML("beforeend", `<div class="cmp-stats">${esc(stats())}</div>`);
    const r = $(".cmp-range", main);
    if (r) r.oninput = () => $(".cmp-view", main).style.setProperty("--x", `${r.value}%`);
    const pick = $("#cp-pick", sh.el), row = (k, cur) => `<div class="cp-row"><span class="xs muted">${k}</span><div class="ph-strip">${list.map(p => `<button class="ph-th ${p.id === cur.id ? "on" : ""}" data-k="${k}" data-id="${p.id}"><img src="${u({ img: p.thumb })}" alt=""><span>${fmtDay(p.date, { day: "numeric", month: "short" })}</span></button>`).join("")}</div></div>`;
    pick.innerHTML = row("Avant", a) + row("Après", b);
    $$("[data-id]", pick).forEach(x => x.onclick = () => { const p = list.find(q => q.id === x.dataset.id); if (x.dataset.k === "Avant") a = p; else b = p; if (a.date > b.date) [a, b] = [b, a]; draw(); });
  };
  $$("#cp-mode button", sh.el).forEach(x => x.onclick = () => { mode = x.dataset.m; $$("#cp-mode button", sh.el).forEach(y => y.classList.toggle("on", y === x)); draw(); });
  $$("#cp-pose button", sh.el).forEach(x => x.onclick = () => {
    pose = x.dataset.p; list = all.filter(p => p.pose === pose); a = list[0]; b = list[list.length - 1];
    $$("#cp-pose button", sh.el).forEach(y => y.classList.toggle("on", y === x)); draw();
  });
  $("#cp-share", sh.el).onclick = async () => {
    const blob = await composite(a, b, stats()).catch(() => null);
    if (blob) shareBlob(blob, "greatness-avant-apres.jpg", "Mon avant / après sur GREATNESS 💪");
  };
  draw();
}

// Image à partager : les deux photos côte à côte, dates et poids, progression
async function composite(a, b, line) {
  const ua = URL.createObjectURL(a.img), ub = URL.createObjectURL(b.img);
  try {
    const [ia, ib] = await Promise.all([loadImg(ua), loadImg(ub)]);
    const H = 1200, wa = Math.round((ia.naturalWidth / ia.naturalHeight) * H), wb = Math.round((ib.naturalWidth / ib.naturalHeight) * H);
    const pad = 24, top = 110, bottom = 150, c = document.createElement("canvas");
    c.width = wa + wb + pad * 3; c.height = H + top + bottom;
    const g = c.getContext("2d");
    g.fillStyle = "#0b0b10"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(ia, pad, top, wa, H); g.drawImage(ib, pad * 2 + wa, top, wb, H);
    g.fillStyle = "#fff"; g.textBaseline = "middle"; g.textAlign = "center";
    g.font = "800 54px Outfit, system-ui, sans-serif"; g.fillText("AVANT / APRÈS", c.width / 2, top / 2);
    g.font = "600 36px Inter, system-ui, sans-serif";
    const cap = (p, k) => `${k} · ${fmtDay(p.date, { day: "numeric", month: "short", year: "numeric" })}${p.weight ? ` · ${num(p.weight)} kg` : ""}`;
    g.fillText(cap(a, "Avant"), pad + wa / 2, top + H + 46); g.fillText(cap(b, "Après"), pad * 2 + wa + wb / 2, top + H + 46);
    g.fillStyle = "#ff5466"; g.font = "700 38px Inter, system-ui, sans-serif"; g.fillText(line, c.width / 2, top + H + 108);
    g.fillStyle = "rgba(255,255,255,.55)"; g.font = "600 26px Inter, system-ui, sans-serif"; g.textAlign = "right"; g.fillText("GREATNESS", c.width - pad, top / 2);
    return await toBlob(c, 0.9);
  } finally { URL.revokeObjectURL(ua); URL.revokeObjectURL(ub); }
}

async function shareBlob(blob, name, text = "") {
  const file = new File([blob], name, { type: "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e?.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Image téléchargée ✓");
}
