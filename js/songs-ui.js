// Tes morceaux de records, à l'écran : la carte de l'onglet Progrès (les trois morceaux qui te portent le plus, avec
// leurs records et leur gain d'intensité) et la feuille de la playlist (copier, partager, écouter dans Spotify ou
// Apple Music). Les calculs : songstats.js.
import { state } from "./store.js";
import { songRecords, recordPlaylist, playlistText, listenUrl } from "./songstats.js";
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
    <div class="card card-list songs-card">${songs.slice(0, 3).map(s => row(s)).join("")}</div>`;
}
export function bindSongsCard(root, st = state) {
  $("#songs-all", root)?.addEventListener("click", () => openSongs(st));
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
