// Tes morceaux de records, à l'écran : la carte de l'onglet Progrès (les trois morceaux qui te portent le plus, avec
// leurs records et leur gain d'intensité) et la feuille de la playlist (copier, partager, écouter dans Spotify ou
// Apple Music). Les calculs : songstats.js.
import { state } from "./store.js";
import { songRecords, recordPlaylist, playlistText, listenUrl, tempoPlaylist } from "./songstats.js";
import { knownTempo, tempoOf } from "./trackinfo.js";
import { spotifyLinked, spotifyPlayList } from "./music.js";
import { $, esc, sheet, toast } from "./ui.js";

const note = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
const art = s => (s.art ? `<img class="m-art sm" src="${esc(s.art)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>` : `<span class="m-art sm m-art-none">${note}</span>`);
// « 🏆 2 records · +6 % d'intensité · 14 séries »
const facts = s => [
  s.records ? `<span class="song-pr">🏆 <b class="tnum">${s.records}</b> ${s.records > 1 ? "records" : "record"}</span>` : "",
  s.lift ? `<span class="${s.lift > 0 ? "song-up" : "song-down"}"><b class="tnum">${s.lift > 0 ? "+" : ""}${s.lift} %</b> d'intensité</span>` : "",
  `<span><b class="tnum">${s.sets}</b> ${s.sets > 1 ? "séries" : "série"}</span>`,
].filter(Boolean).join(" · ");
const row = (s, i) => `<div class="song-row">${i !== undefined ? `<span class="song-n tnum">${i + 1}</span>` : ""}${art(s)}
  <div class="grow m-txt"><b class="ellipsis" translate="no">${esc(s.title)}</b><span class="m-by ellipsis" translate="no">${esc(s.artist)}</span><span class="xs muted song-facts">${facts(s)}</span></div></div>`;

// La carte de l'onglet Progrès (rien tant qu'aucune série n'a retenu de morceau)
export function songsCardHtml(st = state) {
  const songs = songRecords(st.sessions || []);
  if (!songs.length) return "";
  return `<div class="section"><h2>Tes morceaux de records</h2>${recordPlaylist(songs).length ? `<button class="me-add" id="songs-all">Ta playlist</button>` : ""}</div>
    <div class="card card-list songs-card">${songs.slice(0, 3).map(s => row(s)).join("")}
      ${songs.length >= 2 ? `<button class="set-row set-act songs-tempo" id="songs-tempo"><span class="grow"><b>Ta playlist de séance au bon tempo</b><span class="xs muted">Calme à l'échauffement, intense sur les séries lourdes</span></span>›</button>` : ""}</div>`;
}
export function bindSongsCard(root, st = state) {
  $("#songs-all", root)?.addEventListener("click", () => openSongs(st));
  $("#songs-tempo", root)?.addEventListener("click", () => openTempo(st));
}

// La playlist de séance au bon tempo (tempoPlaylist) : le tempo des morceaux encore inconnus est cherché à l'ouverture
const PHASE_NAME = { warm: "Échauffement", work: "Séries", heavy: "Séries lourdes" };
const PHASE_SUB = { warm: "moins de 115 BPM", work: "115 à 139 BPM", heavy: "140 BPM et plus" };
export function openTempo(st = state) {
  const songs = songRecords(st.sessions || [], { minSets: 1 });
  const sh = sheet(`<div class="songs-sheet tempo-sheet">
    <h2 class="h2">Ta playlist de séance au bon tempo</h2>
    <p class="muted small">Tes morceaux de séance, du plus calme au plus intense : de quoi t'échauffer, enchaîner tes séries, puis tout donner sur les plus lourdes.</p>
    <div id="tempo-body"><p class="muted small"><i class="spinner"></i> Je cherche le tempo de tes morceaux…</p></div>
  </div>`);
  const body = $("#tempo-body", sh.el);
  let list = [];
  const draw = () => {
    const phases = tempoPlaylist(songs, s => knownTempo(s)?.bpm || 0);
    list = phases.flatMap(p => p.songs);
    if (!list.length) { body.innerHTML = `<p class="muted small">Pas encore assez de morceaux au tempo connu : écoute ta musique pendant tes séances, la playlist se remplira toute seule.</p>`; return; }
    body.innerHTML = `${phases.map(p => `<div class="eyebrow mt-s">${PHASE_NAME[p.id]} · ${PHASE_SUB[p.id]}</div>
      <div class="card card-list">${p.songs.map(s => `<div class="cmp song-row"><span class="grow ellipsis" translate="no"><b>${esc(s.title)}</b>${s.artist ? ` <span class="muted">· ${esc(s.artist)}</span>` : ""}</span><span class="chip tnum">${s.bpm} BPM</span></div>`).join("")}</div>`).join("")}
      <div class="grid2 mt">${spotifyLinked() ? `<button class="btn btn-primary" id="tempo-play">Lancer dans Spotify</button>` : ""}<button class="btn btn-soft" id="tempo-copy">Copier la liste</button></div>`;
    $("#tempo-copy", body).onclick = async () => { try { await navigator.clipboard.writeText(playlistText(list)); toast("Liste copiée ✓"); } catch { toast("Copie impossible sur cet appareil", 3000); } };
    $("#tempo-play", body)?.addEventListener("click", async e => {
      e.currentTarget.disabled = true;
      const r = await spotifyPlayList(list);
      e.currentTarget.disabled = false;
      toast(r === "ok" ? "C'est parti dans Spotify ✓" : r === "PREMIUM" ? "Lecture à distance : Spotify Premium requis" : r === "NO_DEVICE" ? "Ouvre Spotify sur un appareil pour lancer la lecture" : "Spotify ne répond pas", 3500);
    });
  };
  // les tempos encore inconnus (au plus 24 morceaux), puis l'affichage
  const missing = songs.filter(s => !knownTempo(s)?.bpm).slice(0, 24);
  Promise.all(missing.map(s => tempoOf(s).catch(() => null))).then(() => { if (sh.el.isConnected) draw(); });
  if (!missing.length) draw();
  return sh;
}

// La playlist : les morceaux sur lesquels tu as battu un record ou soulevé plus lourd que d'habitude
export function openSongs(st = state) {
  const list = recordPlaylist(songRecords(st.sessions || []));
  const sh = sheet(`<div class="songs-sheet">
    <h2 class="h2">Ta playlist de records</h2>
    <p class="muted small">Les morceaux sur lesquels tu as battu un record ou soulevé plus lourd que d'habitude.</p>
    <div class="card card-list">${list.map((s, i) => `${row(s, i)}<div class="song-go"><a class="btn btn-ghost btn-sm" href="${listenUrl(s, "spotify")}" target="_blank" rel="noopener">Spotify</a>
      <a class="btn btn-ghost btn-sm" href="${listenUrl(s, "apple")}" target="_blank" rel="noopener">Apple Music</a></div>`).join("")}</div>
    <div class="grid2 mt"><button class="btn btn-soft" id="songs-copy">Copier la liste</button><button class="btn btn-primary" id="songs-share">Partager</button></div>
  </div>`);
  const text = playlistText(list);
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast("Liste copiée ✓"); } catch { toast("Copie impossible sur cet appareil", 3000); } };
  $("#songs-copy", sh.el).onclick = copy;
  $("#songs-share", sh.el).onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Ma playlist de records", text }); return; } catch (e) { if (e?.name === "AbortError") return; } }
    copy();
  };
  return sh;
}
