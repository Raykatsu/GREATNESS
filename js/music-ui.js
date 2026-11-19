// Musique, côté écran : réglages (Moi → Réglages → Musique), carte « En écoute » de l'accueil, lecteur de la séance et
// bande-son de fin de séance. Le morceau en cours vient de music.js, les couleurs de musictheme.js.
import { state, save } from "./store.js";
import {
  SOURCE_NAME, statsfmId, musicSource, setMusic, nowPlaying, onMusic, musicError, musicFunction, spotifyConfigured, spotifyLinked, spotifyLogin,
  spotifyLogout, spotifyControl, appleAvailable, appleAsk, searchMusic, LASTFM_RE,
} from "./music.js";
import { refreshMusicTheme } from "./musictheme.js";
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
  if (!musicSource() && !m.hideInvite) return `<section class="card m-invite mt" id="music-home">
    <span class="m-inv-ic">${MI.note}</span><button class="grow m-inv-go" id="music-go"><b>Ta musique, tes couleurs</b>
      <span class="small muted">${nb("Spotify, Deezer, Apple Music… : l'app prend les couleurs de la pochette du morceau que tu écoutes.")}</span></button>
    <button class="icon-btn plain sm" id="music-hide" aria-label="Masquer">${I.x}</button></section>`;
  return `<div id="music-home" hidden></div>`;
}
export function bindMusicHome(root) {
  const el = $("#music-home", root);
  if (!el) return;
  if (el.classList.contains("m-now")) {
    el.onclick = e => { if (!e.target.closest("[data-mctl], #music-dance")) openMusic(); }; // toute la carte s'ouvre au doigt
  }
  $("#music-go", el)?.addEventListener("click", () => openMusic());
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
onMusic(() => {
  const home = document.getElementById("music-home");
  if (home) { home.outerHTML = musicHomeCard(); bindMusicHome(document); }
  const bar = document.getElementById("music-bar");
  if (bar) { bar.innerHTML = musicBarHtml(); bindMusicBar(bar); }
  if (sheetDraw) sheetDraw();
});
if (typeof addEventListener === "function") addEventListener("music-tint", () => sheetDraw?.());

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
const errText = e => ERRORS[musicSource() === "statsfm" && ERRORS[`SF_${e}`] ? `SF_${e}` : e] || "La musique ne répond pas pour le moment. Je réessaie toute seule.";
let sheetDraw = null;

export function openMusic() {
  const m = () => state.profile.music || {};
  let pick = musicSource() || (musicFunction() ? "lastfm" : "manual"), results = [];
  const sources = [
    musicFunction() && ["lastfm", "Spotify, Deezer, YouTube Music, Tidal… par Last.fm"],
    musicFunction() && ["statsfm", "Spotify et Apple Music, par ton profil stats.fm"],
    spotifyConfigured() && ["spotify", "En direct, avec lecture et pause"],
    appleAvailable() && ["apple", "Le morceau en cours dans l'app Musique"],
    ["manual", "Un morceau pour l'ambiance, sans compte"],
  ].filter(Boolean);
  const sh = sheet(`<div class="m-sheet">
    <h2 class="h2">Musique</h2>
    <p class="muted small">${nb("L'app vit avec ta musique : ses couleurs suivent la pochette du morceau en cours, et chaque séance garde sa bande-son.")}</p>
    <div id="ms-now"></div>
    <div class="eyebrow mt">D'où vient ta musique ?</div>
    <div class="m-srcs" id="ms-srcs" role="radiogroup" aria-label="Source de la musique">${sources.map(([k, d]) => `<button class="m-src" data-src="${k}" role="radio">
      <b>${SOURCE_NAME[k]}</b><span class="xs muted">${d}</span></button>`).join("")}</div>
    <div id="ms-detail" class="m-detail"></div>
    <div class="eyebrow mt">Effets</div>
    <label class="toggle set-row"><div class="grow"><b>Couleurs de la pochette</b><span class="xs muted">Boutons, anneaux et lueurs du fond prennent les couleurs du morceau</span></div><input type="checkbox" id="ms-theme" ${m().theme !== false ? "checked" : ""}/></label>
    <label class="toggle set-row"><div class="grow"><b>Décor</b><span class="xs muted">La pochette floutée derrière l'écran</span></div><input type="checkbox" id="ms-deco" ${m().deco !== false ? "checked" : ""}/></label>
    <label class="toggle set-row"><div class="grow"><b>Garder les couleurs</b><span class="xs muted">Quand la musique s'arrête, l'app reste aux couleurs du dernier morceau</span></div><input type="checkbox" id="ms-keep" ${m().keep !== false ? "checked" : ""}/></label>
    <label class="toggle set-row"><div class="grow"><b>Le mannequin danse</b><span class="xs muted">Sur l'accueil, quand tu ne touches plus l'écran depuis 20 secondes pendant que la musique joue</span></div><input type="checkbox" id="ms-dance" ${m().dance !== false ? "checked" : ""}/></label>
    <button class="btn btn-soft btn-block mt-s" id="ms-dance-now">${MI.dance} Faire danser le mannequin</button>
    ${musicSource() ? `<button class="btn btn-ghost btn-block mt" id="ms-off">${I.x} Couper la musique dans l'app</button>` : ""}
  </div>`, { z: 80, onClose: () => { sheetDraw = null; } });
  const el = sh.el;

  const nowBox = () => {
    const t = nowPlaying(), tint = musicTint(), err = musicError();
    $("#ms-now", el).innerHTML = t ? `<div class="card m-prev">${art(t, "lg")}<div class="grow m-txt"><span class="eyebrow">${status(t)} · ${SOURCE_NAME[t.src]}</span>${names(t)}
        ${tint ? `<div class="m-sw" aria-label="Couleurs de la pochette">${[tint.neutral ? "" : tint.accent, tint.neutral ? "" : tint.accent2, `rgb(${tint.ambient})`, `rgb(${tint.ambient2})`].filter(Boolean).map(c => `<i style="background:${c}"></i>`).join("")}</div>` : ""}</div>${controls(t)}</div>`
      : musicSource() ? `<p class="m-wait small ${err ? "err" : "muted"}">${nb(err ? errText(err) : "Lance un morceau : ses couleurs arrivent ici dans quelques secondes.")}</p>` : "";
    bindControls($("#ms-now", el));
  };
  const detail = () => {
    $$("#ms-srcs .m-src", el).forEach(b => { const on = b.dataset.src === pick; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    const box = $("#ms-detail", el);
    if (pick === "lastfm") {
      box.innerHTML = `<label class="field"><span>Ton pseudo Last.fm</span><div class="m-row"><input class="input" id="ms-user" maxlength="15" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="pseudo" value="${esc(m().user || "")}"/>
        <button class="btn btn-primary" id="ms-save">${musicSource() === "lastfm" ? "Changer" : "Relier"}</button></div></label>
        <details class="card adv mt-s"><summary>Relier ton appli de musique à Last.fm</summary><ol class="m-steps small">
          <li>${nb("Crée un compte gratuit sur last.fm.")}</li>
          <li>${nb("Spotify : sur last.fm, Paramètres → Applications → Spotify Scrobbling → Connecter.")}</li>
          <li>${nb("Deezer : sur deezer.com dans un navigateur, Mon compte → Partage → Last.fm → Relier.")}</li>
          <li>${nb("Tidal, YouTube Music, Apple Music sur ordinateur : leur réglage Last.fm, ou l'extension Web Scrobbler.")}</li>
          <li>${nb("Écris ton pseudo Last.fm ici : le morceau en cours arrive en 15 secondes environ.")}</li></ol></details>`;
      $("#ms-save", box).onclick = async () => {
        const u = $("#ms-user", box).value.trim();
        if (!LASTFM_RE.test(u)) return toast("Pseudo Last.fm invalide (2 à 15 lettres, chiffres, _ ou -)", 3000);
        await setMusic({ src: "lastfm", user: u });
        toast(musicError() ? errText(musicError()) : "Last.fm relié ✓", 3500);
        redraw();
      };
    } else if (pick === "statsfm") {
      box.innerHTML = `<label class="field"><span>Ton profil stats.fm</span><div class="m-row"><input class="input" id="ms-sf" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="pseudo ou lien du profil" value="${esc(m().sfUser || "")}"/>
        <button class="btn btn-primary" id="ms-sf-save">${musicSource() === "statsfm" ? "Changer" : "Relier"}</button></div></label>
        <details class="card adv mt-s"><summary>Préparer ton profil stats.fm</summary><ol class="m-steps small">
          <li>${nb("Dans l'app stats.fm, ouvre les réglages de confidentialité et laisse visible l'écoute en cours.")}</li>
          <li>${nb("Copie le lien de ton profil (stats.fm/ton-pseudo) et colle-le ici, ou écris juste ton pseudo.")}</li>
          <li>${nb("Le morceau en cours arrive en 15 secondes environ, depuis Spotify ou Apple Music.")}</li></ol></details>`;
      $("#ms-sf-save", box).onclick = async () => {
        const u = statsfmId($("#ms-sf", box).value);
        if (!u) return toast("Profil stats.fm invalide : écris ton pseudo ou colle le lien de ton profil", 3500);
        await setMusic({ src: "statsfm", sfUser: u });
        toast(musicError() ? errText(musicError()) : "stats.fm relié ✓", 4000);
        redraw();
      };
    } else if (pick === "spotify") {
      box.innerHTML = spotifyLinked() ? `<p class="small">${nb("Spotify est connecté : le morceau en cours arrive en direct, et tu peux mettre en pause ou passer au suivant depuis l'app (Premium).")}</p>
        <div class="grid2"><button class="btn btn-primary" id="ms-use">Utiliser Spotify</button><button class="btn btn-soft" id="ms-sp-out">Se déconnecter</button></div>`
        : `<p class="small">${nb("Connexion directe : le morceau en temps réel, avec lecture, pause et morceau suivant depuis l'app (Spotify Premium).")}</p>
        <p class="xs muted">${nb("Pendant sa phase de test, Spotify n'ouvre l'accès qu'à 5 comptes invités par le créateur de l'app. Sinon, passe par Last.fm : il marche avec Spotify pour tout le monde.")}</p>
        <button class="btn btn-primary btn-block" id="ms-sp-in">Se connecter à Spotify</button>`;
      $("#ms-sp-in", box)?.addEventListener("click", async () => {
        try { if (await spotifyLogin()) { toast("Spotify connecté ✓"); await setMusic({ src: "spotify" }); redraw(); } }
        catch (e) { if (e.message !== "CANCELLED") toast(e.message === "DENIED" ? "Connexion Spotify refusée" : `Connexion Spotify impossible (${e.message})`, 4000); }
      });
      $("#ms-use", box)?.addEventListener("click", async () => { await setMusic({ src: "spotify" }); redraw(); });
      $("#ms-sp-out", box)?.addEventListener("click", () => { spotifyLogout(); setMusic({}); redraw(); });
    } else if (pick === "apple") {
      box.innerHTML = `<p class="small">${nb("Le morceau en cours dans l'app Musique de ton iPhone (Apple Music ou ta bibliothèque).")}</p>
        <button class="btn btn-primary btn-block" id="ms-apple">${musicSource() === "apple" ? "Relire le morceau en cours" : "Autoriser Apple Music"}</button>`;
      $("#ms-apple", box).onclick = async () => {
        try { await appleAsk(); await setMusic({ src: "apple" }); toast("Apple Music relié ✓"); }
        catch (e) { toast(errText(e.message), 4500); }
        redraw();
      };
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
  const redraw = () => { if (!el.isConnected) return; nowBox(); detail(); };
  sheetDraw = nowBox;
  $$("#ms-srcs .m-src", el).forEach(b => b.onclick = () => { pick = b.dataset.src; detail(); });
  $("#ms-theme", el).onchange = e => { setMusic({ theme: e.target.checked }); refreshMusicTheme(); };
  $("#ms-deco", el).onchange = e => { setMusic({ deco: e.target.checked }); refreshMusicTheme(); };
  $("#ms-keep", el).onchange = e => { setMusic({ keep: e.target.checked }); refreshMusicTheme(); };
  $("#ms-dance", el).onchange = e => { setMusic({ dance: e.target.checked }); };
  $("#ms-dance-now", el).onclick = () => { sh.close(); openDance(); };
  $("#ms-off", el)?.addEventListener("click", () => { setMusic({ src: "" }); refreshMusicTheme(); sh.close(); toast("Musique coupée dans l'app"); }); // couleurs gardées comprises
  redraw();
}
