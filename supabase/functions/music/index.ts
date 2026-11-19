// GREATNESS : fonction « music », deux services pour la partie musique de l'app (js/music.js, js/musictheme.js) :
// - ?lastfm=PSEUDO : le morceau en cours d'un compte Last.fm, le pont universel (Spotify, Deezer, YouTube Music,
//   Tidal… y envoient ce qu'on écoute). La clé Last.fm reste ici (secret LASTFM_API_KEY). Pochette absente ou
//   générique : retrouvée dans le catalogue iTunes. Réponse gardée 10 s par pseudo (plusieurs écrans, un appel) ;
// - ?cover=ADRESSE : une pochette d'un hôte connu (Spotify, Last.fm, Deezer, Apple), renvoyée avec l'autorisation de
//   lecture (CORS) pour que l'app en tire ses couleurs. Les autres adresses sont refusées ;
// - ?statsfm=PROFIL : le morceau en cours d'un profil stats.fm (l'app de statistiques de Spotify et d'Apple Music),
//   par son API publique, sans clé : il faut seulement que le profil laisse voir l'écoute en cours. Réponse gardée 10 s ;
// - ?bpm=1&artist=…&title=…[&isrc=…] : le tempo du morceau, d'après le catalogue public de Deezer (pour le mannequin
//   qui danse, js/dance-ui.js, et l'ambiance du thème). 0 si inconnu ; gardé en mémoire ;
// - ?search=TERME[&limit=12][&country=fr] : le catalogue iTunes (choix manuel, genre d'un morceau), lu par le serveur :
//   sur iPhone, l'adresse du catalogue renvoie vers l'app Musique et l'app ne peut pas la lire elle-même.
// Déployée automatiquement par GitHub Actions (voir SUPABASE.md, « Musique »).
const VERSION = "music-4";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

export const USER_RE = /^[A-Za-z][\w-]{1,14}$/;
const PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f"; // l'étoile grise de Last.fm, pas une vraie pochette
const COVER_HOSTS = new Set(["i.scdn.co", "mosaic.scdn.co", "image-cdn-ak.spotifycdn.com", "image-cdn-fa.spotifycdn.com", "lastfm.freetls.fastly.net",
  "e-cdns-images.dzcdn.net", "cdn-images.dzcdn.net", "cdns-images.dzcdn.net", "cdn.stats.fm"]);
export function coverAllowed(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && !x.username && !x.port && (COVER_HOSTS.has(x.hostname) || /^is\d{1,2}-ssl\.mzstatic\.com$/.test(x.hostname));
  } catch { return false; }
}

const big = (u: string) => u.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/i, "/600x600bb.$2");
// Réponse de Last.fm (user.getRecentTracks) → le morceau en cours, ou null (rien en cours)
// deno-lint-ignore no-explicit-any
export function parseLastfm(j: any) {
  const list = j?.recenttracks?.track;
  const t = Array.isArray(list) ? list[0] : list;
  if (!t || t["@attr"]?.nowplaying !== "true") return null;
  const imgs = Array.isArray(t.image) ? t.image : [];
  // deno-lint-ignore no-explicit-any
  const art = [...imgs].reverse().map((i: any) => String(i?.["#text"] || "")).find(u => u && !u.includes(PLACEHOLDER)) || "";
  return {
    title: String(t.name || "").slice(0, 120), artist: String(t.artist?.["#text"] ?? t.artist?.name ?? "").slice(0, 120),
    album: String(t.album?.["#text"] || "").slice(0, 120), art, playing: true, url: /^https:\/\//.test(t.url || "") ? String(t.url) : "",
  };
}
// Pochette d'un morceau dans le catalogue iTunes (quand Last.fm n'en a pas)
export async function itunesArt(artist: string, title: string): Promise<string> {
  const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`.slice(0, 120))}&media=music&entity=song&limit=1`);
  if (!r.ok) return "";
  const a = (await r.json())?.results?.[0]?.artworkUrl100;
  return typeof a === "string" ? big(a) : "";
}

const memo = new Map<string, { at: number; body: unknown }>();
async function lastfm(user: string) {
  const key = env("LASTFM_API_KEY");
  if (!key) return json({ ok: false, error: "NO_KEY" }, 503);
  if (!USER_RE.test(user)) return json({ ok: false, error: "BAD_USER" }, 400);
  const k = user.toLowerCase(), hit = memo.get(k);
  if (hit && Date.now() - hit.at < 10000) return json(hit.body);
  const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(user)}&limit=1&format=json&api_key=${encodeURIComponent(key)}`,
    { headers: { "User-Agent": `GREATNESS/${VERSION}` } });
  const j = await r.json().catch(() => ({}));
  const code = Number(j?.error) || 0;
  if (code === 6) return json({ ok: false, error: "USER_NOT_FOUND" }, 404);
  if (code === 29) return json({ ok: false, error: "RATE_LIMIT" }, 429);
  if (code === 10 || code === 26) return json({ ok: false, error: "NO_KEY" }, 503);
  if (!r.ok || code) return json({ ok: false, error: "LASTFM" }, 502);
  const track = parseLastfm(j);
  if (track && !track.art) track.art = await itunesArt(track.artist, track.title).catch(() => "");
  const body = { ok: true, track };
  if (memo.size > 500) memo.clear();
  memo.set(k, { at: Date.now(), body });
  return json(body);
}

// stats.fm : GET /users/{profil}/streams/current → { item: { isPlaying, progressMs, platform, track: { name, durationMs,
// artists: [{ name }], albums: [{ name, image }], externalIds: { spotify: [id] } } } } (SDK officiel statsfm.js)
export const SF_USER_RE = /^[A-Za-z0-9._-]{2,40}$/;
const SF_API = "https://api.stats.fm/api/v1";
// deno-lint-ignore no-explicit-any
export function parseStatsfm(j: any) {
  const it = j?.item, t = it?.track;
  if (!t?.name) return null;
  const album = Array.isArray(t.albums) ? t.albums[0] : null, sp = Array.isArray(t.externalIds?.spotify) ? String(t.externalIds.spotify[0] || "") : "";
  const ms = Number(t.durationMs) || 0, at = Number(it.progressMs);
  return {
    title: String(t.name).slice(0, 120),
    // deno-lint-ignore no-explicit-any
    artist: (Array.isArray(t.artists) ? t.artists : []).map((a: any) => String(a?.name || "")).filter(Boolean).join(", ").slice(0, 120),
    album: String(album?.name || "").slice(0, 120), art: /^https:\/\//.test(album?.image || "") ? String(album.image) : "",
    playing: it.isPlaying !== false, url: /^[A-Za-z0-9]{10,40}$/.test(sp) ? `https://open.spotify.com/track/${sp}` : "",
    ...(ms > 0 ? { duration: Math.round(ms) } : {}), ...(ms > 0 && at >= 0 ? { progress: Math.round(at) } : {}),
  };
}
const sfGet = (path: string) => fetch(`${SF_API}${path}`, { headers: { "User-Agent": `GREATNESS/${VERSION}`, Accept: "application/json" } });
// Rien en cours : le profil existe-t-il, cache-t-il l'écoute en cours ? (vérifié au plus toutes les 10 min)
const sfProfiles = new Map<string, { at: number; exists: boolean; hidden: boolean }>();
async function sfProfile(user: string) {
  const k = user.toLowerCase(), hit = sfProfiles.get(k);
  if (hit && Date.now() - hit.at < 600000) return hit;
  const r = await sfGet(`/users/${encodeURIComponent(user)}`);
  const j = r.ok ? await r.json().catch(() => ({})) : {}, u = j?.item ?? j;
  const info = { at: Date.now(), exists: r.ok, hidden: u?.privacySettings?.currentlyPlaying === false };
  if (sfProfiles.size > 500) sfProfiles.clear();
  sfProfiles.set(k, info);
  return info;
}
const sfMemo = new Map<string, { at: number; body: unknown }>();
async function statsfm(user: string) {
  if (!SF_USER_RE.test(user)) return json({ ok: false, error: "BAD_USER" }, 400);
  const k = user.toLowerCase(), hit = sfMemo.get(k);
  if (hit && Date.now() - hit.at < 10000) return json(hit.body);
  const r = await sfGet(`/users/${encodeURIComponent(user)}/streams/current`);
  if (r.status === 429) return json({ ok: false, error: "RATE_LIMIT" }, 429);
  let track = null;
  if (r.ok && r.status !== 204) track = parseStatsfm(await r.json().catch(() => ({})));
  else if ([204, 401, 403, 404].includes(r.status)) {
    // rien en cours, ou un profil introuvable ou qui cache son écoute : le profil le dit
    const p = await sfProfile(user);
    if (!p.exists) return json({ ok: false, error: "USER_NOT_FOUND" }, 404);
    if (p.hidden || r.status === 401 || r.status === 403) return json({ ok: false, error: "PRIVATE" }, 403);
  } else return json({ ok: false, error: "STATSFM" }, 502);
  // une pochette d'un hôte inconnu ne se laisserait pas lire : celle du catalogue iTunes
  if (track && track.art && !coverAllowed(track.art)) track.art = "";
  if (track && !track.art) track.art = await itunesArt(track.artist, track.title).catch(() => "");
  const body = { ok: true, track };
  if (sfMemo.size > 500) sfMemo.clear();
  sfMemo.set(k, { at: Date.now(), body });
  return json(body);
}

// Catalogue iTunes : les champs utiles de chaque morceau ; gardé 1 h par recherche
const searchMemo = new Map<string, { at: number; body: unknown }>();
// deno-lint-ignore no-explicit-any
export const itunesPick = (x: any) => ({
  trackName: String(x?.trackName || "").slice(0, 120), artistName: String(x?.artistName || "").slice(0, 120), collectionName: String(x?.collectionName || "").slice(0, 120),
  artworkUrl100: /^https:\/\//.test(x?.artworkUrl100 || "") ? String(x.artworkUrl100) : "", trackViewUrl: /^https:\/\//.test(x?.trackViewUrl || "") ? String(x.trackViewUrl) : "",
  primaryGenreName: String(x?.primaryGenreName || "").slice(0, 60),
});
async function search(q: URLSearchParams) {
  const term = (q.get("search") || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (term.length < 2) return json({ ok: false, error: "BAD_TERM" }, 400);
  const limit = Math.min(25, Math.max(1, Math.round(Number(q.get("limit")) || 12)));
  const country = /^[a-z]{2}$/i.test(q.get("country") || "") ? String(q.get("country")).toLowerCase() : "fr";
  const k = `${country}|${limit}|${term.toLowerCase()}`, hit = searchMemo.get(k);
  if (hit && Date.now() - hit.at < 3600000) return json(hit.body);
  const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}&country=${country}`,
    { headers: { "User-Agent": `GREATNESS/${VERSION}` } });
  if (!r.ok) return json({ ok: false, error: "ITUNES" }, 502);
  const j = await r.json().catch(() => ({}));
  const body = { ok: true, results: (Array.isArray(j?.results) ? j.results : []).slice(0, limit).map(itunesPick).filter(x => x.trackName || x.collectionName) };
  if (searchMemo.size > 1000) searchMemo.clear();
  searchMemo.set(k, { at: Date.now(), body });
  return json(body);
}

// Tempo d'un morceau : par son code ISRC, sinon par l'artiste et le titre ; entre 50 et 220 BPM, sinon 0
const tempoMemo = new Map<string, number>();
export const tempoOk = (n: unknown) => { const v = Math.round(Number(n) || 0); return v >= 50 && v <= 220 ? v : 0; };
async function bpm(q: URLSearchParams) {
  const isrc = (q.get("isrc") || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 15).toUpperCase();
  const artist = (q.get("artist") || "").replace(/"/g, "").slice(0, 100).trim(), title = (q.get("title") || "").replace(/"/g, "").slice(0, 100).trim();
  if (!isrc && !(artist && title)) return json({ ok: false, error: "BAD_TRACK" }, 400);
  const key = isrc || `${artist}|${title}`.toLowerCase();
  if (tempoMemo.has(key)) return json({ ok: true, bpm: tempoMemo.get(key) });
  const get = async (u: string) => { const r = await fetch(u); return r.ok ? await r.json().catch(() => ({})) : {}; };
  let found = 0;
  if (isrc) found = tempoOk((await get(`https://api.deezer.com/track/isrc:${isrc}`))?.bpm);
  if (!found && artist && title) {
    const id = (await get(`https://api.deezer.com/search/track?q=${encodeURIComponent(`artist:"${artist}" track:"${title}"`)}&limit=1`))?.data?.[0]?.id;
    if (id) found = tempoOk((await get(`https://api.deezer.com/track/${encodeURIComponent(String(id))}`))?.bpm);
  }
  if (tempoMemo.size > 2000) tempoMemo.clear();
  tempoMemo.set(key, found);
  return json({ ok: true, bpm: found });
}

async function cover(u: string) {
  if (!coverAllowed(u)) return json({ ok: false, error: "BAD_COVER" }, 400);
  const r = await fetch(u);
  const type = r.headers.get("content-type") || "";
  // une redirection vers un autre site n'est pas suivie
  if (!r.ok || !type.startsWith("image/") || (r.url && !coverAllowed(r.url))) return json({ ok: false, error: "COVER" }, 502);
  const buf = await r.arrayBuffer();
  if (buf.byteLength > 2_000_000) return json({ ok: false, error: "TOO_BIG" }, 413);
  return new Response(buf, { headers: { ...CORS, "Content-Type": type, "Cache-Control": "public, max-age=604800, immutable" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const q = new URL(req.url).searchParams;
  try {
    if (q.has("lastfm")) return await lastfm(q.get("lastfm") || "");
    if (q.has("statsfm")) return await statsfm(q.get("statsfm") || "");
    if (q.has("cover")) return await cover(q.get("cover") || "");
    if (q.has("bpm")) return await bpm(q);
    if (q.has("search")) return await search(q);
    return new Response(`GREATNESS · fonction musique en ligne (${VERSION}${env("LASTFM_API_KEY") ? ", Last.fm prêt" : ", clé Last.fm absente"})`,
      { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    console.error("music", e);
    return json({ ok: false, error: "ERROR" }, 500);
  }
});
