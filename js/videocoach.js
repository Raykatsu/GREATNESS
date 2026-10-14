// Coach vidéo IA : tu filmes une série (ou choisis une vidéo), l'app en extrait une douzaine d'images et l'IA en
// ligne (Gemini, via la fonction « coach ») analyse ta technique : note, points forts, corrections avec l'image
// où le défaut se voit, consigne à te dire, exercice correctif. La vidéo ne quitte pas le téléphone : seules
// ces images partent à l'analyse.
import { EXERCISES } from "./data.js";
import { state, save } from "./store.js";
import { onlineReady, formAI } from "./online.js";
import { $, esc, I, sheet, toast, ring, animateRings } from "./ui.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const VIDEO = svg('<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 5-3v9l-5-3z"/>');

// Images d'une vidéo : jusqu'à `max`, environ deux par seconde, sur `span` secondes au plus (le milieu d'une
// longue vidéo), réduites à `size` px. → [{ t, dataUrl, mime, data }]
export async function extractFrames(file, { max = 12, span = 16, size = 512, onProgress } = {}) {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.setAttribute("playsinline", ""); v.src = url;
  try {
    await new Promise((res, rej) => {
      v.onloadedmetadata = res;
      v.onerror = () => rej(new Error("Vidéo illisible sur ce téléphone."));
      setTimeout(() => rej(new Error("La vidéo met trop de temps à s'ouvrir.")), 20000);
    });
    // iPhone : une brève lecture muette charge les images (sinon elles sortent noires)
    try { await v.play(); v.pause(); } catch { /* lecture refusée : on tente quand même */ }
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    if (!dur || !v.videoWidth) throw new Error("Vidéo illisible sur ce téléphone.");
    const len = Math.min(dur, span), start = dur > span ? (dur - span) / 2 : 0;
    const n = Math.max(4, Math.min(max, Math.round(len * 2)));
    const c = document.createElement("canvas"), k = Math.min(1, size / Math.max(v.videoWidth, v.videoHeight));
    c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
    const g = c.getContext("2d"), out = [];
    for (let i = 0; i < n; i++) {
      const t = start + (len * (i + 0.5)) / n;
      await seek(v, t);
      g.drawImage(v, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/jpeg", 0.72);
      out.push({ t, dataUrl, mime: "image/jpeg", data: dataUrl.split(",")[1] });
      onProgress?.((i + 1) / n);
    }
    return out;
  } finally { v.removeAttribute("src"); v.load?.(); URL.revokeObjectURL(url); }
}
const seek = (v, t) => new Promise(res => {
  let done = false;
  const end = () => { if (done) return; done = true; v.removeEventListener("seeked", end); res(); };
  v.addEventListener("seeked", end);
  v.currentTime = t;
  setTimeout(end, 2500);
});

// Analyses passées (les 40 dernières, sur le compte) : { id, exId, at, score, verdict, fix: [défauts] }
export function rememberCheck(st, exId, r) {
  st.formChecks ||= [];
  st.formChecks.push({ id: `fc-${Date.now()}`, exId, at: Date.now(), score: r.score, verdict: r.verdict, fix: (r.fix || []).map(f => f.issue) });
  if (st.formChecks.length > 40) st.formChecks.splice(0, st.formChecks.length - 40);
}
export const pastChecks = (st, exId) => (st.formChecks || []).filter(c => c.exId === exId);

const TIPS = `<ul class="vc-tips">
  <li>${I.check}<span>Téléphone posé (contre un sac, une bouteille), <b>de profil</b> ou de trois quarts, à 2-3 m.</span></li>
  <li>${I.check}<span>Tout le corps et la charge dans l'image, bonne lumière.</span></li>
  <li>${I.check}<span>1 à 5 répétitions, 5 à 15 secondes suffisent.</span></li>
</ul>`;

export function openVideoCoach(ex) {
  const id = ex.id, past = pastChecks(state, id);
  if (!onlineReady()) {
    sheet(`<div class="eyebrow">${VIDEO} Coach vidéo IA</div><h2 class="h2">Analyse de ta technique</h2>
      <p class="muted small">L'analyse vidéo passe par l'IA en ligne : il faut un compte en ligne et une connexion. En attendant, le bouton « Vérifier ma technique » corrige ta posture en direct, sans internet.</p>`, { z: 90 });
    return;
  }
  const sh = sheet(`<div class="eyebrow">${VIDEO} Coach vidéo IA</div><h2 class="h2">${esc(ex.name)} : ta technique</h2>
    <p class="muted small">Filme une série : l'IA regarde ta posture, ton amplitude et tes alignements, puis te dit quoi corriger, image à l'appui.</p>
    ${TIPS}
    ${past.length ? `<p class="xs muted vc-past">${I.clock} Dernières notes : ${past.slice(-5).map(c => `<b>${c.score}</b>`).join(" → ")}</p>` : ""}
    <label class="field mt-s"><span>Une question pour le coach (facultatif)</span><input class="input" id="vc-note" maxlength="200" placeholder="Ex : mon dos s'arrondit-il en bas ?"/></label>
    <label class="btn btn-primary btn-lg btn-block mt vc-pick">${VIDEO} Filmer ou choisir une vidéo<input type="file" id="vc-file" accept="video/*" hidden/></label>
    <p class="xs muted mt-s">La vidéo reste sur ton téléphone : seules une douzaine d'images partent à l'analyse. Compte pour un message de l'IA.</p>
    <div id="vc-out" class="mt" aria-live="polite"></div>`, { z: 90 });
  const out = $("#vc-out", sh.el);
  $("#vc-file", sh.el).onchange = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const pick = $(".vc-pick", sh.el);
    pick.classList.add("busy");
    out.innerHTML = `<div class="vc-wait"><i class="spinner"></i><span id="vc-step">Lecture de la vidéo…</span><div class="vc-bar"><i id="vc-prog"></i></div></div>`;
    const step = t => { const s = $("#vc-step", out); if (s) s.textContent = t; };
    const prog = p => { const b = $("#vc-prog", out); if (b) b.style.transform = `scaleX(${p})`; };
    try {
      const frames = await extractFrames(file, { onProgress: p => prog(p * 0.35) });
      if (!sh.el.isConnected) return;
      step("L'IA analyse ta technique…");
      let p = 0.35;
      const creep = setInterval(() => prog((p = Math.min(0.95, p + 0.02))), 700);
      let r;
      try { r = await formAI({ exercise: ex.name, cues: ex.cues || EXERCISES[id]?.cues || [], note: $("#vc-note", sh.el)?.value || "", frames: frames.map(({ mime, data }) => ({ mime, data })) }); }
      finally { clearInterval(creep); }
      if (!sh.el.isConnected) return;
      if (r.score > 0) { rememberCheck(state, id, r); save(); }
      out.innerHTML = resultHtml(r, frames, past.at(-1));
      animateRings(out);
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      out.innerHTML = `<div class="card vc-err">${I.alert}<span>${esc(err.message || "Analyse impossible.")}${err.detail ? `<small class="xs muted"> (${esc(err.detail)})</small>` : ""}</span></div>`;
    } finally { pick.classList.remove("busy"); }
  };
}

// Résultat : note, verdict, points forts, corrections (avec l'image où ça se voit), sécurité, exercice correctif
export function resultHtml(r, frames = [], prev = null) {
  if (!(r.score > 0)) {
    return `<div class="card vc-err">${I.alert}<span>${esc(r.verdict || "Je ne vois pas l'exercice sur cette vidéo.")}${r.view ? ` ${esc(r.view)}` : ""}</span></div>`;
  }
  const tone = r.score >= 85 ? "hi" : r.score >= 65 ? "mid" : "lo";
  const delta = prev ? r.score - prev.score : null;
  return `<div class="card vc-head ${tone}">${ring(r.score / 100, r.score, 64)}<div class="grow"><b>${esc(r.verdict)}</b>
      ${delta ? `<span class="xs ${delta > 0 ? "vc-up" : "muted"}">${delta > 0 ? "+" : ""}${delta} depuis la dernière analyse</span>` : ""}</div></div>
    ${r.good?.length ? `<h3 class="demo-h">Ce qui est bien</h3><ul class="demo-list ok">${r.good.map(g => `<li>${I.check}${esc(g)}</li>`).join("")}</ul>` : ""}
    ${r.fix?.length ? `<h3 class="demo-h">À corriger</h3>${r.fix.map((f, i) => `<div class="card vc-fix">
        ${f.frame && frames[f.frame - 1] ? `<img src="${frames[f.frame - 1].dataUrl}" alt="Image ${f.frame} de ta vidéo" loading="lazy"/>` : ""}
        <div class="grow"><b><span class="vc-n">${i + 1}</span>${esc(f.issue)}</b><p class="small muted">${esc(f.why)}</p>
          ${f.cue ? `<p class="vc-cue">${I.mic}<span>« ${esc(f.cue)} »</span></p>` : ""}</div></div>`).join("")}` : ""}
    ${r.safety ? `<div class="card vc-safe">${I.alert}<span>${esc(r.safety)}</span></div>` : ""}
    ${r.drill ? `<p class="cam-tip mt-s">${I.sparkle}<span><b>Exercice correctif :</b> ${esc(r.drill)}</span></p>` : ""}
    ${r.view ? `<p class="xs muted">${I.camera} ${esc(r.view)}</p>` : ""}
    ${frames.length ? `<div class="vc-strip" aria-label="Images analysées">${frames.map((f, i) => `<img src="${f.dataUrl}" alt="Image ${i + 1}" loading="lazy"/>`).join("")}</div>` : ""}`;
}
