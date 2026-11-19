// Tes morceaux de records : avec quels sons tu soulèves le plus lourd. Chaque série retient le morceau qui passait
// (live.js : set.song, son rang dans la bande-son de la séance). Pour chaque morceau : les records battus pendant qu'il
// passait, et l'intensité de tes séries (charge × répétitions, rapportée à ton meilleur niveau sur l'exercice à ce
// moment-là) comparée à ta moyenne. Plus la playlist de ces morceaux. Logique pure, testée dans Node ; l'onglet
// Progrès l'affiche (songs-ui.js).

const e1rm = (w, r) => (w > 0 ? w * (1 + r / 30) : 0); // même formule que store.js
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const songKey = t => `${norm(t.artist)}|${norm(t.title)}`;

// Les morceaux de tes séances, du plus « porteur » au moins : records battus, puis gain d'intensité, puis séries.
// lift : en %, l'intensité moyenne de tes séries sur ce morceau par rapport à toutes tes séries (null : moins de
// minSets séries comparables, pas assez pour juger)
export function songRecords(sessions = [], { minSets = 3 } = {}) {
  const best = {}, songs = new Map();
  let total = 0, n = 0;
  const list = sessions.filter(s => s?.sets?.length).sort((a, b) => (a.date || 0) - (b.date || 0));
  for (const s of list) {
    for (const set of s.sets) {
      const load = set.weight > 0, score = load ? e1rm(set.weight, set.reps) : Number(set.reps) || 0;
      if (!score) continue;
      const k = `${set.exId}${load ? "" : "|reps"}`, prev = best[k] || 0;
      const rel = prev ? Math.min(score / prev, 1.5) : null; // le tout premier essai sert de référence
      const record = prev > 0 && score > prev + 0.01;
      if (score > prev) best[k] = score;
      if (rel !== null) { total += rel; n++; }
      const song = Number.isInteger(set.song) ? s.music?.[set.song] : null;
      if (!song?.title) continue;
      const sk = songKey(song);
      const e = songs.get(sk) || { title: song.title, artist: song.artist || "", art: "", sets: 0, records: 0, rel: 0, n: 0, best: null, days: new Set() };
      e.sets++;
      e.days.add(s.id || s.date);
      if (record) e.records++;
      if (rel !== null) { e.rel += rel; e.n++; }
      if (load && (!e.best || score > e.best.score)) e.best = { score, name: set.name || "", weight: set.weight, reps: set.reps };
      if (!e.art && song.art) e.art = song.art;
      songs.set(sk, e);
    }
  }
  const avg = n ? total / n : 1;
  return [...songs.values()].map(e => ({
    title: e.title, artist: e.artist, art: e.art, sets: e.sets, sessions: e.days.size, records: e.records,
    lift: e.n >= minSets ? Math.round((e.rel / e.n / avg - 1) * 100) : null,
    best: e.best ? { name: e.best.name, weight: e.best.weight, reps: e.best.reps } : null,
  })).sort((a, b) => b.records - a.records || (b.lift ?? -1e9) - (a.lift ?? -1e9) || b.sets - a.sets);
}

// La playlist de tes morceaux de records : ceux qui t'ont vu battre un record ou soulever plus lourd que d'habitude
export const recordPlaylist = (songs, max = 20) => songs.filter(s => s.records > 0 || (s.lift ?? 0) > 0).slice(0, max);
// en texte, à copier ou partager
export const playlistText = list => list.map((s, i) => `${i + 1}. ${s.title}${s.artist ? ` — ${s.artist}` : ""}`).join("\n");
// écouter un morceau : recherche dans Spotify ou Apple Music
export function listenUrl(s, where = "apple") {
  const q = encodeURIComponent(`${s.artist} ${s.title}`.trim());
  return where === "spotify" ? `https://open.spotify.com/search/${q}` : `https://music.apple.com/search?term=${q}`;
}
