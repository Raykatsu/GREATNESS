// Musique, côté écran : réglages (Moi → Réglages → Musique), carte « En écoute » de l'accueil, lecteur de la séance et
// bande-son de fin de séance. Le morceau en cours vient de music.js, les couleurs de musictheme.js.
import { state, save } from "./store.js";
import {
  SOURCE_NAME, statsfmId, musicSource, setMusic, nowPlaying, onMusic, musicError, musicErrors, musicFunction, spotifyConfigured, spotifyLinked, spotifyLogin,
  spotifyLogout, spotifyControl, appleAvailable, appleAsk, appleState, autoSources, searchMusic, LASTFM_RE,
} from "./music.js";
import { refreshMusicTheme, musicVibe } from "./musictheme.js";
import { VIBES } from "./vibe.js";
import { cleanWar } from "./warsong.js";
import { musicTint } from "./actions.js";
import { openDance } from "./dance-ui.js";
import { $, $$, esc, I, sheet, toast } from "./ui.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const MI = {
  note: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>'),
  pause: svg('<path d="M8 5v14M16 5v14" stroke-width="3.2"/>'),
  next: svg('<path d="m5 5 9 7-9 7z" fill="currentColor"/><path d="M18 5v14" stroke-width="2.6"/>'),
  previous: svg('<path d="m19 5-9 7 9 7z" fill="currentColor"/><path d="M6 5v14" stroke-width="2.6"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
  dance: svg('<circle cx="13" cy="4.2" r="2"/><path d="m6 8.5 4-1.5 3.5 1 3-3.5M13.5 8 12 13l3.5 2.5-1 5M12 13l-3.5 2-3.5-.5"/>'),
};
// typographie française : espace fine insécable avant « : ; ! ? % » (la traduction l'ignore, i18n.js)
const nb = s => s.replace(/ ([?!:;»%])/g, " $1");
const art = (t, cls = "") => (t?.art ? `<img class="m-art ${cls}" src="${esc(t.art)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>` : `<span class="m-art m-art-none ${cls}">${MI.note}</span>`);
const status = t => (t.src === "manual" ? "Ambiance" : t.playing ? "En écoute" : "En pause");
// boutons du lecteur : seulement avec Spotify connecté en direct (lecture à distance)
const controls = t => (t?.src === "spotify" && spotifyLinked() ? `<div class="m-ctl">
  <button class="icon-btn plain sm" data-mctl="previous" aria-label="Morceau précédent">${MI.previous}</button>
  <button class="icon-btn sm m-pp" data-mctl="${t.playing ? "pause" : "play"}" aria-label="${t.playing ? "Pause" : "Lecture"}">${t.playing ? MI.pause : MI.play}</button>
  <button class="icon-btn plain sm" data-mctl="next" aria-label="Morceau suivant">${MI.next}</button></div>` : "");
const names = t => `<b class="ellipsis" translate="no">${esc(t.title)}</b><span class="m-by ellipsis" translate="no">${esc(t.artist)}</span>`;

/* ---------- Carte de l'accueil ---------- */
export function musicHomeCard() {
  const t = nowPlaying(), m = state.profile.music || {};
  // la carte n'est pas elle-même un bouton : ses boutons (ouvrir la musique, danser, lecteur) sont côte à côte, pas
  // imbriqués (lecteur d'écran)
  if (t) return `<section class="card m-now tap mt" id="music-home">
    <button class="m-open" id="music-open">${art(t)}<span class="grow m-txt"><span class="eyebrow">${status(t)} · ${SOURCE_NAME[t.src]}</span>${names(t)}</span></button>
    <button class="icon-btn plain sm m-dance" id="music-dance" aria-label="Faire danser le mannequin">${MI.dance}</button>${controls(t)}</section>`;
  // rien à lire encore (musique coupée, aucun compte relié, Apple Music pas encore autorisé) : l'invitation
  const apple = appleAvailable() && musicSource() === "auto" && appleState() !== "authorized" && appleState() !== "denied";
  const ready = autoSources().some(k => k !== "apple" || appleState() === "authorized");
  if ((!musicSource() || (musicSource() === "auto" && !ready)) && !m.hideInvite) return `<section class="card m-invite mt" id="music-home">
    <span class="m-inv-ic">${MI.note}</span><button class="grow m-inv-go" id="music-go"><b>Ta musique, tes couleurs</b>
      <span class="small muted">${nb(apple ? "Autorise l'app Musique : ce que tu écoutes donne ses couleurs et son ambiance à l'app, tout seul."
        : "Spotify, Deezer, Apple Music… : l'app prend les couleurs de la pochette du morceau que tu écoutes.")}</span></button>
    <button class="icon-btn plain sm" id="music-hide" aria-label="Masquer">${I.x}</button></section>`;
  return `<div id="music-home" hidden></div>`;
}
export function bindMusicHome(root) {
  const el = $("#music-home", root);
  if (!el) return;
  if (el.classList.contains("m-now")) {
    el.onclick = e => { if (!e.target.closest("[data-mctl], #music-dance")) openMusic(); }; // toute la carte s'ouvre au doigt
  }
  // app iPhone, Apple Music pas encore autorisé : un geste suffit (l'iPhone demande l'accès) ; sinon les réglages Musique
  $("#music-go", el)?.addEventListener("click", async () => {
    if (appleAvailable() && musicSource() === "auto" && !["authorized", "denied"].includes(appleState())) {
      try { await appleAsk(); } catch { /* refusé : les réglages le disent */ }
      await setMusic({ asked: true });
      if (appleState() === "authorized") return redrawHome();
    }
    openMusic();
  });
  $("#music-dance", el)?.addEventListener("click", e => { e.stopPropagation(); openDance(); });
  $("#music-hide", el)?.addEventListener("click", () => { state.profile.music = { ...(state.profile.music || {}), hideInvite: true }; save(); el.remove(); });
  bindControls(el);
}
function bindControls(root) {
  $$("[data-mctl]", root).forEach(b => b.onclick = async e => {
    e.stopPropagation();
    b.disabled = true;
    const r = await spotifyControl(b.dataset.mctl);
    b.disabled = false;
    if (r === "PREMIUM") toast("Lecture à distance : Spotify Premium requis", 3500);
    else if (r === "NO_DEVICE") toast("Ouvre Spotify sur un appareil pour lancer la lecture", 3500);
    else if (r !== "ok") toast("Spotify ne répond pas", 2500);
  });
}

/* ---------- Lecteur de la séance ---------- */
export function musicBarHtml() {
  const t = nowPlaying();
  return t ? `<div class="m-bar">${art(t, "sm")}<div class="grow m-txt">${names(t)}</div>${controls(t)}</div>` : "";
}
export const bindMusicBar = root => bindControls(root);

/* ---------- Bande-son d'une séance (fin de séance, historique) ---------- */
export function soundtrackHtml(list = []) {
  if (!list.length) return "";
  const shown = list.slice(0, 6);
  return `<div class="m-sound"><div class="eyebrow">${MI.note} Bande-son de la séance</div>
    <div class="m-sound-row">${shown.map(t => `<div class="m-sound-it">${art(t, "md")}<b class="ellipsis" translate="no">${esc(t.title)}</b><span class="ellipsis" translate="no">${esc(t.artist)}</span></div>`).join("")}</div>
    ${list.length > shown.length ? `<p class="xs muted">+${list.length - shown.length} <span>${list.length - shown.length > 1 ? "autres morceaux pendant la séance" : "autre morceau pendant la séance"}</span></p>` : ""}</div>`;
}

// Mise à jour en place à chaque nouveau morceau (accueil, séance, réglages ouverts)
function redrawHome() { const home = document.getElementById("music-home"); if (home) { home.outerHTML = musicHomeCard(); bindMusicHome(document); } }
onMusic(() => {
  redrawHome();
  const bar = document.getElementById("music-bar");
  if (bar) { bar.innerHTML = musicBarHtml(); bindMusicBar(bar); }
  if (sheetDraw) sheetDraw();
});
if (typeof addEventListener === "function") {
  addEventListener("music-tint", () => sheetDraw?.());
  addEventListener("music-vibe", () => sheetDraw?.());
  addEventListener("music-auth", () => { redrawHome(); sheetDraw?.(); }); // accès à l'app Musique accordé ou refusé
}

/* ---------- Réglages : d'où vient ta musique ---------- */
const ERRORS = {
  NO_KEY: "Last.fm n'est pas encore branché sur le serveur : il manque la clé Last.fm (voir SUPABASE.md, « Musique »).",
  USER_NOT_FOUND: "Ce pseudo Last.fm n'existe pas : vérifie l'orthographe.",
  SF_USER_NOT_FOUND: "Ce profil stats.fm n'existe pas : vérifie le pseudo, ou colle le lien de ton profil.",
  PRIVATE: "Ton profil stats.fm cache ce que tu écoutes : dans stats.fm, rends visible l'écoute en cours (réglages de confidentialité).",
  RATE_LIMIT: "Trop de demandes d'un coup : réessaie dans une minute.",
  DENIED: "Accès refusé : autorise GREATNESS dans Réglages → Confidentialité → Médias et Apple Music.",
  NOT_LINKED: "Spotify n'est plus connecté : reconnecte-toi.",
};
// k : la source en cause (en automatique, chaque compte a ses erreurs)
const errText = (e, k = musicSource()) => ERRORS[k === "statsfm" && ERRORS[`SF_${e}`] ? `SF_${e}` : e] || "La musique ne répond pas pour le moment. Je réessaie toute seule.";
let sheetDraw = null;

export function openMusic() {
  const m = () => state.profile.music || {};
  // deux façons : ce que joue le téléphone (automatique, avec les comptes reliés), ou une ambiance choisie
  let pick = musicSource() === "manual" ? "manual" : "auto", results = [];
  const sources = [
    ["auto", "Ce que joue ton téléphone, tout seul : le morceau qui joue, d'où qu'il vienne"],
    ["manual", "Un morceau pour l'ambiance, sans compte"],
  ];
  const sh = sheet(`<div class="m-sheet">
    <h2 class="h2">Musique</h2>
    <p class="muted small">${nb("L'app vit avec ta musique : ses couleurs suivent la pochette du morceau en cours, et chaque séance garde sa bande-son.")}</p>
    <div id="ms-now"></div>
    <div class="eyebrow mt">D'où vient ta musique ?</div>
    <div class="m-srcs" id="ms-srcs" role="radiogroup" aria-label="Source de la musique">${sources.map(([k, d]) => `<button class="m-src" data-src="${k}" role="radio">
      <b>${k === "auto" ? "Ton téléphone" : SOURCE_NAME[k]}</b><span class="xs muted">${d}</span></button>`).join("")}</div>
    <div id="ms-detail" class="m-detail"></div>
    <div class="eyebrow mt">Ta chanson de guerre</div>
    <div class="card m-war" id="ms-war"></div>
    <div class="eyebrow mt">Effets</div>
    <label class="toggle set-row"><div class="grow"><b>Couleurs de la pochette</b><span class="xs muted">Boutons, anneaux et lueurs du fond prennent les couleurs du morceau</span></div><input type="checkbox" id="ms-theme" ${m().theme !== false ? "checked" : ""}/></label>
    <label class="toggle set-row"><div class="grow"><b>Ambiance du morceau</b><span class="xs muted">Formes, titres, mouvements et décor suivent l'énergie du morceau, au rythme de son tempo</span></div><input type="checkbox" id="ms-vibe" ${m().vibe !== false ? "checked" : ""}/></label>
    <label class="toggle set-row"><div class="grow"><b>Décor</b><span class="xs muted">La pochette floutée derrière l'écran</span></div><input type="checkbox" id="ms-deco" ${m().deco !== false ? "checked" : ""}/></label>
    <label class="toggle set-row"><div class="grow"><b>Garder les couleurs</b><span class="xs muted">Quand la musique s'arrête, l'app reste aux couleurs du dernier morceau</span></div><input type="checkbox" id="ms-keep" ${m().keep !== false ? "checked" : ""}/></label>
    <label class="toggle set-row"><div class="grow"><b>Le mannequin danse</b><span class="xs muted">Sur l'accueil, quand tu ne touches plus l'écran depuis 20 secondes pendant que la musique joue</span></div><input type="checkbox" id="ms-dance" ${m().dance !== false ? "checked" : ""}/></label>
    <button class="btn btn-soft btn-block mt-s" id="ms-dance-now">${MI.dance} Faire danser le mannequin</button>
    ${musicSource() ? `<button class="btn btn-ghost btn-block mt" id="ms-off">${I.x} Couper la musique dans l'app</button>` : ""}
  </div>`, { z: 80, onClose: () => { sheetDraw = null; } });
  const el = sh.el;

  // l'ambiance du morceau en cours (vibe.js) : son nom, ce qu'elle change, son tempo
  const vibeChip = () => {
    const v = musicVibe(), d = v && VIBES[v.vibe];
    return d && m().vibe !== false ? `<span class="m-vibe" id="ms-vibe-now" title="${d.what}">Ambiance : <b>${d.name}</b>${v.bpm ? `<span translate="no"> · ${v.bpm} BPM</span>` : ""}</span>` : "";
  };
  // rien en cours : une erreur, ou ce qu'il reste à faire (relier un compte, lancer un morceau)
  const hint = () => (musicError() ? errText(musicError())
    : musicSource() !== "manual" && !autoSources().length ? "Relie un de tes comptes ci-dessous : l'app suivra ensuite toute seule ce que tu écoutes."
    : musicSource() ? "Lance un morceau : ses couleurs arrivent ici dans quelques secondes." : "");
  const nowBox = () => {
    const t = nowPlaying(), tint = musicTint(), err = musicError();
    $("#ms-now", el).innerHTML = t ? `<div class="card m-prev">${art(t, "lg")}<div class="grow m-txt"><span class="eyebrow">${status(t)} · ${SOURCE_NAME[t.src]}</span>${names(t)}
        ${vibeChip()}
        ${tint ? `<div class="m-sw" aria-label="Couleurs de la pochette">${[tint.neutral ? "" : tint.accent, tint.neutral ? "" : tint.accent2, `rgb(${tint.ambient})`, `rgb(${tint.ambient2})`].filter(Boolean).map(c => `<i style="background:${c}"></i>`).join("")}</div>` : ""}</div>${controls(t)}</div>`
      : hint() ? `<p class="m-wait small ${err ? "err" : "muted"}">${nb(hint())}</p>` : "";
    bindControls($("#ms-now", el));
    // erreurs de chaque compte du mode automatique (profil caché, accès refusé…), à jour sans effacer ce qu'on tape
    const errs = musicErrors();
    $$("[data-err]", el).forEach(n => { const e = errs[n.dataset.err]; n.textContent = e ? nb(errText(e, n.dataset.err)) : ""; });
  };
  // un compte relié (pseudo ou profil) : le mode automatique le lit avec les autres
  const linkRow = (k, name, sub, id, value, label, placeholder, max, steps) => `<div class="m-link">
      <div class="m-link-h"><b>${name}</b><span class="xs muted">${sub}</span><span class="xs m-err" data-err="${k}"></span></div>
      <div class="m-row"><input class="input" id="${id}" maxlength="${max}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${label}" placeholder="${placeholder}" value="${esc(value || "")}"/>
        <button class="btn btn-soft" id="${id}-save">${value ? "Changer" : "Relier"}</button></div>${steps}</div>`;
  const detail = () => {
    $$("#ms-srcs .m-src", el).forEach(b => { const on = b.dataset.src === pick; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    const box = $("#ms-detail", el);
    if (pick === "auto") {
      const c = m(), apple = appleState();
      box.innerHTML = `<div class="m-links">
        <div class="m-link"><div class="m-link-h"><b>Apple Music</b><span class="xs muted">${!appleAvailable() ? "Lue directement par l'app GREATNESS sur iPhone"
          : apple === "authorized" ? "Lue directement sur ton iPhone ✓" : apple === "denied" ? "Accès refusé : Réglages de l'iPhone → GREATNESS → Médias et Apple Music" : "L'app Musique de ton iPhone, lue directement"}</span>
          <span class="xs m-err" data-err="apple"></span></div>
          ${appleAvailable() && apple !== "authorized" ? `<button class="btn btn-soft btn-sm" id="ms-apple">Autoriser</button>` : ""}</div>
        ${spotifyConfigured() ? `<div class="m-link"><div class="m-link-h"><b>Spotify</b><span class="xs muted">${spotifyLinked() ? "Connecté en direct ✓ : lecture et pause depuis l'app" : "En direct, avec lecture et pause (Premium)"}</span><span class="xs m-err" data-err="spotify"></span></div>
          ${spotifyLinked() ? `<button class="btn btn-ghost btn-sm" id="ms-sp-out">Se déconnecter</button>` : `<button class="btn btn-soft btn-sm" id="ms-sp-in">Se connecter à Spotify</button>`}</div>` : ""}
        ${musicFunction() ? linkRow("statsfm", "stats.fm", "Spotify et Apple Music, par ton profil stats.fm", "ms-sf", c.sfUser, "Ton profil stats.fm", "pseudo ou lien du profil", 80,
          `<details class="adv"><summary>Préparer ton profil stats.fm</summary><ol class="m-steps small">
          <li>${nb("Dans l'app stats.fm, ouvre les réglages de confidentialité et laisse visible l'écoute en cours.")}</li>
          <li>${nb("Copie le lien de ton profil (stats.fm/ton-pseudo) et colle-le ici, ou écris juste ton pseudo.")}</li>
          <li>${nb("Le morceau en cours arrive en 15 secondes environ, depuis Spotify ou Apple Music.")}</li></ol></details>`) : ""}
        ${musicFunction() ? linkRow("lastfm", "Last.fm", "Spotify, Deezer, YouTube Music, Tidal… par Last.fm", "ms-user", c.user, "Ton pseudo Last.fm", "pseudo", 15,
          `<details class="adv"><summary>Relier ton appli de musique à Last.fm</summary><ol class="m-steps small">
          <li>${nb("Crée un compte gratuit sur last.fm.")}</li>
          <li>${nb("Spotify : sur last.fm, Paramètres → Applications → Spotify Scrobbling → Connecter.")}</li>
          <li>${nb("Deezer : sur deezer.com dans un navigateur, Mon compte → Partage → Last.fm → Relier.")}</li>
          <li>${nb("Tidal, YouTube Music, Apple Music sur ordinateur : leur réglage Last.fm, ou l'extension Web Scrobbler.")}</li>
          <li>${nb("Écris ton pseudo Last.fm ici : le morceau en cours arrive en 15 secondes environ.")}</li></ol></details>`) : ""}
      </div>
      <p class="xs muted mt-s">${nb("iOS ne laisse aucune app lire ce que jouent Spotify, Deezer ou YouTube Music : relie-les une fois par stats.fm ou Last.fm, l'app suit ensuite toute seule.")}</p>
      ${musicSource() === "auto" ? "" : `<button class="btn btn-primary btn-block mt-s" id="ms-auto">Suivre ce que joue mon téléphone</button>`}`;
      // relier, changer ou retirer (champ vide) un compte ; la musique passe en automatique
      const link = async (field, raw, clean, bad, ok, k) => {
        if (!raw.trim()) { await setMusic({ [field]: "" }); toast("Compte retiré"); return redraw(); }
        const u = clean(raw);
        if (!u) return toast(bad, 3500);
        await setMusic({ src: "auto", [field]: u });
        const e = musicErrors()[k];
        toast(e ? errText(e, k) : ok, e ? 4500 : 3500);
        redraw();
      };
      $("#ms-sf-save", box)?.addEventListener("click", () => link("sfUser", $("#ms-sf", box).value, statsfmId, "Profil stats.fm invalide : écris ton pseudo ou colle le lien de ton profil", "stats.fm relié ✓", "statsfm"));
      $("#ms-user-save", box)?.addEventListener("click", () => link("user", $("#ms-user", box).value, v => (LASTFM_RE.test(v.trim()) ? v.trim() : ""), "Pseudo Last.fm invalide (2 à 15 lettres, chiffres, _ ou -)", "Last.fm relié ✓", "lastfm"));
      $("#ms-apple", box)?.addEventListener("click", async () => {
        try { await appleAsk(); await setMusic({ src: "auto" }); toast("Apple Music relié ✓"); }
        catch (e) { toast(errText(e.message, "apple"), 4500); }
        redraw();
      });
      $("#ms-sp-in", box)?.addEventListener("click", async () => {
        try { if (await spotifyLogin()) { toast("Spotify connecté ✓"); await setMusic({ src: "auto" }); redraw(); } }
        catch (e) { if (e.message !== "CANCELLED") toast(e.message === "DENIED" ? "Connexion Spotify refusée" : `Connexion Spotify impossible (${e.message})`, 4000); }
      });
      $("#ms-sp-out", box)?.addEventListener("click", () => { spotifyLogout(); setMusic({}); redraw(); });
      $("#ms-auto", box)?.addEventListener("click", async () => { await setMusic({ src: "auto" }); redraw(); });
    } else if (pick === "manual") {
      box.innerHTML = `<form class="m-row" id="ms-form"><input class="input" id="ms-q" maxlength="80" placeholder="Un morceau, un artiste, un album…" aria-label="Chercher un morceau" autocomplete="off"/>
        <button class="btn btn-soft" aria-label="Chercher">${MI.search}</button></form>
        <div class="m-results" id="ms-res">${results.map((t, i) => `<button class="m-res" data-i="${i}">${art(t, "md")}<b class="ellipsis" translate="no">${esc(t.title)}</b><span class="ellipsis" translate="no">${esc(t.artist)}</span></button>`).join("")}</div>`;
      $("#ms-form", box).onsubmit = async e => {
        e.preventDefault();
        const q = $("#ms-q", box).value;
        $("#ms-res", box).innerHTML = `<p class="small muted"><i class="spinner"></i> Recherche…</p>`;
        try { results = await searchMusic(q); } catch { results = []; toast("Recherche impossible pour le moment", 3000); }
        detail();
        $("#ms-q", box).value = q;
        if (!results.length) $("#ms-res", box).innerHTML = `<p class="small muted">Aucun résultat.</p>`;
      };
      $$(".m-res", box).forEach(b => b.onclick = async () => {
        const t = results[+b.dataset.i];
        await setMusic({ src: "manual", pick: { title: t.title, artist: t.artist, album: t.album, art: t.art } });
        toast("Ambiance choisie ✓");
        redraw();
      });
    } else box.innerHTML = "";
  };
  // ta chanson de guerre (warsong.js) : choisie dans le catalogue, ou le morceau en cours ; proposée juste avant ta série
  // la plus lourde
  let warFound = [];
  const warBox = () => {
    const w = m().war, t = nowPlaying(), box = $("#ms-war", el);
    if (!box) return;
    box.innerHTML = `${w ? `<div class="m-war-now">${art(w, "sm")}<div class="grow m-txt"><b class="ellipsis" translate="no">${esc(w.title)}</b><span class="m-by ellipsis" translate="no">${esc(w.artist)}</span></div>
        <button class="btn btn-ghost btn-sm" id="ms-war-x">Retirer</button></div>`
      : `<p class="xs muted">${nb("Le morceau qui te galvanise : l'app te le propose juste avant ta série la plus lourde ou une tentative de record.")}</p>`}
      ${t && t.src !== "manual" && t.title !== w?.title ? `<button class="btn btn-soft btn-block mt-s" id="ms-war-now">${MI.note} Prendre le morceau en cours</button>` : ""}
      <form class="m-row mt-s" id="ms-war-f"><input class="input" id="ms-war-q" maxlength="80" placeholder="Chercher ta chanson de guerre…" aria-label="Chercher ta chanson de guerre" autocomplete="off"/>
        <button class="btn btn-soft" aria-label="Chercher">${MI.search}</button></form>
      <div class="m-results" id="ms-war-res">${warFound.map((r, i) => `<button class="m-res" data-w="${i}">${art(r, "md")}<b class="ellipsis" translate="no">${esc(r.title)}</b><span class="ellipsis" translate="no">${esc(r.artist)}</span></button>`).join("")}</div>`;
    const pick = async song => { warFound = []; await setMusic({ war: cleanWar(song) }); toast("Chanson de guerre choisie 🔥"); warBox(); };
    $("#ms-war-x", box)?.addEventListener("click", async () => { await setMusic({ war: null }); warBox(); });
    $("#ms-war-now", box)?.addEventListener("click", () => pick(nowPlaying()));
    $("#ms-war-f", box).onsubmit = async e => {
      e.preventDefault();
      const q = $("#ms-war-q", box).value;
      try { warFound = await searchMusic(q); } catch { warFound = []; toast("Recherche impossible pour le moment", 3000); }
      warBox();
      $("#ms-war-q", box).value = q;
      if (!warFound.length) $("#ms-war-res", box).innerHTML = `<p class="small muted">Aucun résultat.</p>`;
    };
    $$("[data-w]", box).forEach(b => b.onclick = () => pick(warFound[+b.dataset.w]));
  };
  const redraw = () => { if (!el.isConnected) return; nowBox(); detail(); warBox(); };
  sheetDraw = nowBox;
  $$("#ms-srcs .m-src", el).forEach(b => b.onclick = () => { pick = b.dataset.src; detail(); });
  $("#ms-theme", el).onchange = e => { setMusic({ theme: e.target.checked }); refreshMusicTheme(); };
  $("#ms-deco", el).onchange = e => { setMusic({ deco: e.target.checked }); refreshMusicTheme(); };
  $("#ms-vibe", el).onchange = e => { setMusic({ vibe: e.target.checked }); refreshMusicTheme(); };
  $("#ms-keep", el).onchange = e => { setMusic({ keep: e.target.checked }); refreshMusicTheme(); };
  $("#ms-dance", el).onchange = e => { setMusic({ dance: e.target.checked }); };
  $("#ms-dance-now", el).onclick = () => { sh.close(); openDance(); };
  $("#ms-off", el)?.addEventListener("click", () => { setMusic({ src: "" }); refreshMusicTheme(); sh.close(); toast("Musique coupée dans l'app"); }); // couleurs gardées comprises
  redraw();
}
