// Open Food Facts : la base libre et mondiale des produits alimentaires (plus de 3 millions de produits).
// Recherche par code-barres ou par nom ; pas de clé, pas de compte. Les produits déjà vus restent en cache.
import { offFood, cleanBarcode } from "./nutrition.js";

const API = "https://world.openfoodfacts.org";
const SEARCH = "https://search.openfoodfacts.org/search";
const FIELDS = "code,product_name,product_name_fr,generic_name,generic_name_fr,brands,serving_size,serving_quantity,nutriments,nutriscore_grade,image_front_small_url";
const CACHE = "greatness.off";

function readCache() { try { return JSON.parse(localStorage.getItem(CACHE) || "{}"); } catch { return {}; } }
function writeCache(code, food) {
  try {
    const c = readCache();
    c[code] = { f: food, t: Date.now() };
    const keys = Object.keys(c);
    if (keys.length > 150) keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - 150).forEach(k => delete c[k]);
    localStorage.setItem(CACHE, JSON.stringify(c));
  } catch { /* stockage plein : tant pis pour le cache */ }
}

// fetch avec délai maximal (AbortSignal.timeout n'existe pas partout)
function get(url, ms, outer) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
  outer?.addEventListener("abort", () => ctrl.abort());
  return fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } }).finally(() => clearTimeout(t));
}

// Produit d'un code-barres : null s'il est inconnu (ou sans valeurs nutritionnelles) ; erreur si le réseau ne répond pas.
export async function lookupBarcode(raw) {
  const code = cleanBarcode(raw) || String(raw).replace(/\D/g, "");
  const hit = readCache()[code];
  if (hit) return hit.f;
  const r = await get(`${API}/api/v2/product/${code}.json?fields=${FIELDS}&lc=fr`, 10000);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Open Food Facts : HTTP ${r.status}`);
  const j = await r.json();
  if (!j.product) return null;
  const food = offFood(j.product, code);
  if (food) writeCache(code, food);
  return food;
}

// Recherche par nom (produits de marque) : nouveau moteur de recherche, puis l'ancien en secours.
export async function searchOff(q, { signal } = {}) {
  const enc = encodeURIComponent(q.trim());
  try {
    const r = await get(`${SEARCH}?q=${enc}&langs=fr&page_size=24&fields=${FIELDS}`, 8000, signal);
    if (r.ok) {
      const list = ((await r.json()).hits || []).map(p => offFood(p, p.code)).filter(Boolean);
      if (list.length) return list;
    }
  } catch (e) { if (signal?.aborted) throw e; }
  const r = await get(`${API}/cgi/search.pl?search_terms=${enc}&search_simple=1&action=process&json=1&page_size=24&lc=fr&fields=${FIELDS}`, 12000, signal);
  if (!r.ok) throw new Error(`Open Food Facts : HTTP ${r.status}`);
  return ((await r.json()).products || []).map(p => offFood(p, p.code)).filter(Boolean);
}
