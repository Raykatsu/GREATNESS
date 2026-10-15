// Remontée des plantages : une erreur JavaScript non rattrapée est envoyée à la base (une fois par jour et par
// message, 10 au plus par jour), pour être corrigée vite. Rien de personnel : le message, l'endroit dans le code,
// la version de l'app et le navigateur.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { APP_VERSION } from "./version.js";

const KEY = "greatness.errors";
// bruit sans intérêt : extensions, réseau coupé, annulations, scripts d'autres sites
const NOISE = /ResizeObserver loop|^Script error\.?$|AbortError|The operation was aborted|Failed to fetch|NetworkError|Load failed|cancelled|annulé|chrome-extension:|safari-extension:/i;

// L'endroit dans notre code : « js/live.js:412:15 » (premier appel venant de l'app)
export function placeOf(stack = "", file = "", line = 0, col = 0) {
  for (const l of String(stack).split("\n")) {
    const m = l.match(/((?:js|sw)[\w/.-]*\.js):(\d+):(\d+)/);
    if (m) return `${m[1]}:${m[2]}:${m[3]}`;
  }
  const f = String(file).match(/((?:js|sw)[\w/.-]*\.js)$/);
  return f ? `${f[1]}:${line}:${col}` : "";
}
// Faut-il l'envoyer ? (pas de bruit, pas deux fois le même message le même jour, 10 par jour au plus)
export function shouldReport(msg, store, day = new Date().toISOString().slice(0, 10)) {
  if (!msg || NOISE.test(msg)) return false;
  if (store.day !== day) { store.day = day; store.seen = {}; store.n = 0; }
  if (store.n >= 10 || store.seen[msg]) return false;
  store.seen[msg] = 1; store.n++;
  return true;
}

function report(err, file, line, col) {
  try {
    const msg = String(err?.message ? `${err.name || "Error"}: ${err.message}` : err || "").slice(0, 300);
    let store = {};
    try { store = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* mode privé */ }
    if (!SUPABASE_URL || !shouldReport(msg, store)) return;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* mode privé */ }
    const stack = String(err?.stack || "").replace(/https?:\/\/[^\s)]+?\/((?:js|sw)[\w/.-]*\.js)/g, "$1").slice(0, 1200);
    fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/gt_error_log`, {
      method: "POST", keepalive: true,
      headers: { apikey: SUPABASE_ANON_KEY, ...(SUPABASE_ANON_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}), "Content-Type": "application/json" },
      body: JSON.stringify({ p_msg: msg, p_place: placeOf(err?.stack, file, line, col), p_stack: stack, p_version: APP_VERSION, p_ua: navigator.userAgent.slice(0, 160) }),
    }).catch(() => {});
  } catch { /* ne jamais planter en signalant un plantage */ }
}

if (typeof window !== "undefined") {
  addEventListener("error", e => report(e.error || e.message, e.filename, e.lineno, e.colno));
  addEventListener("unhandledrejection", e => report(e.reason));
}
