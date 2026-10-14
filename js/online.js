// IA en ligne (Gemini, via la fonction Supabase « coach ») : bien plus intelligente que l'IA
// du téléphone, avec la recherche Google. La clé reste sur le serveur ; l'app envoie seulement
// la question, la conversation récente et les données du compte (profil, séances, records…).
import { SUPABASE_URL, SUPABASE_ANON_KEY, AI_FUNCTION } from "./config.js";
import { isOnlineMode, authToken } from "./cloud.js";

let downUntil = 0, lastRemaining = null;
export const onlineRemaining = () => lastRemaining;

// Disponible : comptes en ligne, connecté au serveur, réseau présent, pas de panne récente.
export const onlineReady = () => isOnlineMode() && !!authToken() && navigator.onLine !== false && Date.now() > downUntil;

const MESSAGES = {
  LIMIT: "Tu as utilisé tous tes messages à l'IA en ligne pour aujourd'hui. Je repasse en mode simple jusqu'à demain.",
  BAD_TOKEN: "Reconnecte-toi (verrouille puis retape ton code) pour utiliser l'IA en ligne.",
  NO_KEY: "L'IA en ligne n'est pas encore configurée sur le serveur.",
  NOT_DEPLOYED: "L'IA en ligne n'est pas encore installée sur le serveur.",
  DOWN: "L'IA en ligne ne répond pas pour le moment.",
};
export class OnlineError extends Error {
  // detail : cause technique (statut HTTP, texte du serveur…) pour comprendre une panne
  constructor(code, detail = "") { super(MESSAGES[code] || MESSAGES.DOWN); this.code = code; this.detail = String(detail || "").slice(0, 220); }
}

// Envoie la conversation et renvoie { text, sources, remaining, cut } ; onDelta(texte complet) pendant le flux.
// waitMs : silence maximal du serveur (il envoie un signe de vie toutes les 8 s pendant que Gemini réfléchit),
// si bien qu'une longue réponse n'est jamais coupée tant qu'elle arrive.
export async function onlineChat({ system, messages, search = true, onDelta, signal, waitMs = 40000 }) {
  const ctrl = new AbortController();
  let timer = 0;
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => ctrl.abort(), waitMs); };
  arm();
  signal?.addEventListener("abort", () => ctrl.abort());
  const silent = () => `pas de réponse du serveur pendant ${Math.round(waitMs / 1000)} s`;
  let res;
  try {
    res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${AI_FUNCTION}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        ...(SUPABASE_ANON_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: authToken(), system, messages, search }),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    downUntil = Date.now() + 60e3;
    // « Failed to fetch » : réseau coupé, ou le serveur a refusé la vérification préalable (CORS)
    throw new OnlineError("DOWN", ctrl.signal.aborted ? silent() : `réseau ou CORS : ${e?.message || e}`);
  }
  const fail = async (code, minutes, detail) => {
    clearTimeout(timer);
    downUntil = Date.now() + minutes * 60e3;
    throw new OnlineError(code, detail);
  };
  if (res.status === 404) await fail("NOT_DEPLOYED", 30, `HTTP 404 ${(await res.text().catch(() => "")).slice(0, 120)}`);
  if (!res.ok || !res.body) await fail("DOWN", 2, `HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 160)}`);
  // Une réponse qui n'est pas un flux : ce n'est pas la fonction de GREATNESS (ex. le code d'exemple de Supabase)
  if (!/event-stream/i.test(res.headers.get("content-type") || "")) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    await fail("DOWN", 30, /@supabase\/server|MISSING_CREDENTIALS|Hello/i.test(body)
      ? "la fonction installée sur Supabase est le code d'exemple, pas celle de GREATNESS"
      : `réponse inattendue du serveur : ${body.slice(0, 140)}`);
  }

  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "", text = "", end = null, cut = false;
  try {
    read: for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      arm();
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
        if (!line.startsWith("data:")) continue; // signe de vie (« : ping »)
        let ev;
        try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.error) {
          if (text.trim()) { cut = true; break read; } // on garde le début de la réponse
          if (ev.error === "NO_KEY" || ev.error === "DOWN") downUntil = Date.now() + (ev.error === "NO_KEY" ? 30 : 2) * 60e3;
          throw new OnlineError(ev.error, ev.detail || `erreur du serveur : ${ev.error}`);
        }
        if (ev.t) { text += ev.t; onDelta?.(text); }
        if (ev.done) end = ev;
      }
    }
  } catch (e) {
    if (e instanceof OnlineError) throw e;
    if (!text.trim()) throw new OnlineError("DOWN", ctrl.signal.aborted ? silent() : `flux interrompu : ${e?.message || e}`);
    cut = true;
  } finally {
    clearTimeout(timer);
    reader.cancel().catch(() => {});
  }
  if (!text.trim()) throw new OnlineError("DOWN", "réponse vide" + (end?.blocked ? " (bloquée par le filtre de sécurité de Google)" : ""));
  if (end?.remaining != null) lastRemaining = end.remaining;
  return { text: text.trim(), sources: end?.sources || [], remaining: end?.remaining ?? null, blocked: !!end?.blocked, cut: cut || !end || !!end.cut };
}

// Demande JSON à la fonction (analyse de repas, aliment cherché par son nom)
async function foodTask(payload, ms) {
  if (!isOnlineMode() || !authToken()) throw new OnlineError("DOWN", "comptes en ligne non configurés");
  if (navigator.onLine === false) throw new OnlineError("DOWN", "pas de connexion");
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), ms);
  let res;
  try {
    res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${AI_FUNCTION}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        ...(SUPABASE_ANON_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: authToken(), task: "food", ...payload }),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new OnlineError("DOWN", ctrl.signal.aborted ? "pas de réponse à temps" : `réseau : ${e?.message || e}`);
  } finally { clearTimeout(timer); }
  if (res.status === 404) throw new OnlineError("NOT_DEPLOYED", "HTTP 404");
  const j = await res.json().catch(() => null);
  if (!j) throw new OnlineError("DOWN", `HTTP ${res.status}`);
  if (j.error) throw new OnlineError(j.error, j.detail);
  if (j.remaining != null) lastRemaining = j.remaining;
  return j;
}

// Analyse d'un repas par l'IA en ligne (description ou photo) → { items: [{ name, grams, kcal, protein, carbs, fat, fiber }], note }
export async function foodAI({ text = "", image = null } = {}) {
  const j = await foodTask({ text, image }, 75000);
  return { items: Array.isArray(j.items) ? j.items : [], note: j.note || "" };
}

// Plan de repas sur mesure → { days: [{ meals: [{ meal, name, items: [{ name, grams, kcal, protein, carbs, fat }] }] }], shopping, tips }
export async function mealPlanAI({ days = 3, kcal, protein, diet = [], prefs = "" } = {}) {
  const j = await foodTask({ task: "mealplan", days, kcal, protein, diet, prefs }, 120000);
  return { days: Array.isArray(j.days) ? j.days : [], shopping: Array.isArray(j.shopping) ? j.shopping : [], tips: j.tips || "" };
}

// Coach vidéo : technique d'après des images d'une vidéo → { score, verdict, good, fix: [{ issue, why, cue, frame }], safety, drill, view }
export async function formAI({ exercise, cues = [], note = "", frames = [] } = {}) {
  const j = await foodTask({ task: "form", exercise, cues, note, frames }, 120000);
  return { score: +j.score || 0, verdict: j.verdict || "", good: Array.isArray(j.good) ? j.good : [], fix: Array.isArray(j.fix) ? j.fix : [], safety: j.safety || "", drill: j.drill || "", view: j.view || "" };
}

// Un aliment, un plat ou un produit cherché par son nom → { foods: [{ name, brand, kcal, protein… pour 100 g, portion_label, portion_grams, liquid }], note }
export async function foodInfoAI(q) {
  const j = await foodTask({ mode: "info", text: String(q || "").slice(0, 120) }, 45000);
  return { foods: Array.isArray(j.foods) ? j.foods : [], note: j.note || "" };
}
