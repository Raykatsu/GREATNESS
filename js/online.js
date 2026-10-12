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
  constructor(code) { super(MESSAGES[code] || MESSAGES.DOWN); this.code = code; }
}

// Envoie la conversation et renvoie { text, sources, remaining } ; onDelta(texte complet) pendant le flux.
export async function onlineChat({ system, messages, search = true, onDelta, signal, timeoutMs = 45000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  signal?.addEventListener("abort", () => ctrl.abort());
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
  } catch {
    clearTimeout(timer);
    downUntil = Date.now() + 60e3;
    throw new OnlineError("DOWN");
  }
  if (res.status === 404) { clearTimeout(timer); downUntil = Date.now() + 30 * 60e3; throw new OnlineError("NOT_DEPLOYED"); }
  if (!res.ok || !res.body) { clearTimeout(timer); downUntil = Date.now() + 2 * 60e3; throw new OnlineError("DOWN"); }

  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "", text = "", end = null;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
        if (!line.startsWith("data:")) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.error) {
          if (ev.error === "NO_KEY" || ev.error === "DOWN") downUntil = Date.now() + (ev.error === "NO_KEY" ? 30 : 2) * 60e3;
          throw new OnlineError(ev.error);
        }
        if (ev.t) { text += ev.t; onDelta?.(text); }
        if (ev.done) end = ev;
      }
    }
  } catch (e) {
    if (e instanceof OnlineError) throw e;
    throw new OnlineError("DOWN");
  } finally {
    clearTimeout(timer);
  }
  if (!text.trim()) throw new OnlineError("DOWN");
  if (end?.remaining != null) lastRemaining = end.remaining;
  return { text: text.trim(), sources: end?.sources || [], remaining: end?.remaining ?? null, blocked: !!end?.blocked };
}
