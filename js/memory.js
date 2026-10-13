// Mémoire du coach : ce qu'il sait de toi sur la durée (blessure, matériel, préférences, contraintes…).
// Ajoutée par l'IA en ligne (action « remember »), par toi (« retiens que… ») ou dans les réglages.
import { newId } from "./nutrition.js";
import { norm } from "./foods.js";

export const MEMORY_MAX = 30;

export function addMemory(state, text, src = "user") {
  const t = String(text || "").replace(/\s+/g, " ").trim().replace(/^(que|qu')\s*/i, "").slice(0, 200);
  if (t.length < 3) return null;
  state.memory ||= [];
  // déjà connu (même texte, à la ponctuation près) : on rafraîchit juste la date
  const key = x => norm(x).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim(), k = key(t);
  const same = state.memory.find(m => key(m.text) === k);
  if (same) { same.at = Date.now(); return same; }
  const m = { id: newId(), text: t.charAt(0).toUpperCase() + t.slice(1), at: Date.now(), src };
  state.memory.push(m);
  while (state.memory.length > MEMORY_MAX) {
    const old = state.memory.shift();
    (state.deleted ||= {}); (state.deleted.memory ||= []).push(old.id);
  }
  return m;
}

export function removeMemory(state, id) {
  state.memory = (state.memory || []).filter(m => m.id !== id);
  (state.deleted ||= {}); (state.deleted.memory ||= []).push(id);
}

// « retiens que j'ai mal au genou », « souviens-toi que je n'ai pas de barre » → texte à retenir, sinon null
export function memoryCommand(text) {
  const m = String(text || "").trim().match(/^(?:retiens|souviens[- ]toi|rappelle[- ]toi|n'oublie pas|note|mémorise|memorise)\s+(?:bien\s+)?(?:que|qu'|:)\s*(.+)$/i);
  return m ? m[1].trim() : null;
}

export function memoryContext(state) {
  const list = state.memory || [];
  return list.length ? `À retenir sur l'athlète (tiens-en compte) :\n- ${list.map(m => m.text).join("\n- ")}` : "";
}
