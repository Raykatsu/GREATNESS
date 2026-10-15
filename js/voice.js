// Mode mains libres : on parle au coach pendant la séance.
// « 8 reps, difficile », « 10 à 60 kilos », « valide », « passe », « annule », « go ».
// Et les questions : « Coach, j'ai mal à l'épaule, je remplace par quoi ? », « Combien de repos ? »

const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'-]/g, " ").replace(/\s+/g, " ").trim();

const UNITS = { zero: 0, vingts: 20, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100 };

// Remplace les nombres écrits en lettres par des chiffres (« vingt et un » → 21, « soixante deux et demi » → 62.5).
export function wordsToNumbers(t) {
  const words = t.split(" ");
  const out = [];
  for (let i = 0; i < words.length; i++) {
    if (!(words[i] in UNITS)) { out.push(words[i]); continue; }
    let total = 0, prev = 0;
    while (i < words.length) {
      const w = words[i];
      if (w === "et" && words[i + 1] in UNITS) { i++; continue; }
      if (!(w in UNITS)) break;
      const v = UNITS[w];
      if (v === 100) total = (total || 1) * 100;
      else if (v === 20 && prev === 4) total += 76; // quatre-vingt(s)
      else total += v;
      prev = v; i++;
    }
    if (words[i] === "et" && words[i + 1] === "demi") { total += 0.5; i += 2; }
    i--;
    out.push(String(total));
  }
  return out.join(" ").replace(/(\d+) (?:virgule|point) (\d)/g, "$1.$2").replace(/(\d+),(\d)/g, "$1.$2");
}

const RPE_WORDS = [
  [/(echec|a fond|impossible|max(imum)?|je peux plus|limite absolue)/, 10],
  [/(tres dur|tres difficile|super dur|hyper dur|vraiment dur|tres dure)/, 9],
  [/\b(dur|dure|difficile|chaud|costaud)\b/, 8],
  [/\b(modere|moyen|moyenne|correct|ok|normal|ca va)\b/, 7],
  [/\b(facile|tranquille|leger|easy|trop simple)\b/, 6],
];

// Une question pour le coach : commence par « coach » ou par un mot interrogatif → { action: "ask", q }
const ASK = /^(coach\b|est ce que|est ce qu|comment|pourquoi|combien|quel|quelle|quels|quelles|qu est ce|je peux|je dois|on peut|c est normal|dois je|faut il|tu peux|tu penses|tu crois|ca sert)/;
export function parseQuestion(text) {
  const t = norm(text).replace(/^(dis|eh|he|hey|ok|bon)\s+/, "");
  if (!ASK.test(t)) return null;
  const q = String(text).trim().replace(/^\s*(?:(?:dis|eh|hé|hey|ok|bon)[\s,]+)?coach\b[\s,!:.]*/i, "").trim();
  return q.replace(/[\s?.!]+$/, "").length >= 4 ? { action: "ask", q } : null;
}

export function parseVoice(text) {
  const t = wordsToNumbers(norm(text));
  if (!t) return null;
  if (/\b(stop micro|coupe le micro|arrete d ecouter|micro off)\b/.test(t)) return { action: "stop" };
  const ask = parseQuestion(text);
  if (ask) return ask;
  if (/\b(annule|annuler|efface|retour arriere)\b/.test(t)) return { action: "undo" };
  if (/\b(exercice suivant|passe l exercice|passe|suivant|skip)\b/.test(t) && !/\d/.test(t)) return { action: "skip" };
  if (/\b(go|c est parti|pret|on y va|fin du repos|repos fini|j y vais|allez)\b/.test(t) && !/\d/.test(t)) return { action: "go" };

  const res = { action: "log" };
  const w = t.match(/(\d+(?:\.\d+)?)\s*(kilos?|kg|kilogrammes?)/);
  if (w) res.weight = +w[1];
  const r = t.match(/(\d+)\s*(reps?|repetitions?|fois|rep)\b/) || t.replace(w?.[0] || "@@", " ").match(/\b(\d{1,3})\b/);
  if (r) res.reps = +r[1];
  const sec = t.match(/(\d+)\s*(secondes?|sec|s)\b/);
  if (sec) res.reps = +sec[1];
  const rpeNum = t.match(/(rpe|ressenti|difficulte|note)\s*(\d+)/);
  if (rpeNum) res.rpe = Math.max(6, Math.min(10, +rpeNum[2]));
  else for (const [re, v] of RPE_WORDS) if (re.test(t)) { res.rpe = v; break; }
  const validate = /\b(valide|valider|validee|c est bon|serie faite|c est fait|j ai fini|termine|ok c est bon|note)\b/.test(t);
  if (res.reps == null && res.rpe == null && res.weight == null && !validate) return null;
  return res;
}

/* ---------- Écoute continue ---------- */
export const voiceSupported = () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export class Listener {
  constructor({ onCommand, onHeard, onState }) {
    Object.assign(this, { onCommand, onHeard, onState, active: false, paused: false });
  }
  start() {
    if (!voiceSupported()) return false;
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.rec = new R();
    this.rec.lang = "fr-FR";
    this.rec.continuous = true;
    this.rec.interimResults = false;
    this.rec.onresult = e => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript;
      this.onHeard?.(text);
      const cmd = parseVoice(text);
      if (cmd) this.onCommand?.(cmd, text);
    };
    // le navigateur coupe l'écoute après un silence : on relance tant que le mode est actif
    this.rec.onend = () => { if (this.active && !this.paused) setTimeout(() => this.listen(), 250); };
    this.rec.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { this.stop(); this.onState?.("denied"); } };
    this.active = true;
    this.listen();
    this.onState?.("on");
    return true;
  }
  listen() { try { this.rec?.start(); } catch { /* déjà en écoute */ } }
  // pendant que le coach parle, on n'écoute pas (sinon il s'entend lui-même)
  pause() { if (!this.active) return; this.paused = true; try { this.rec?.stop(); } catch { /* rien */ } }
  resume() { if (!this.active || !this.paused) return; this.paused = false; this.listen(); }
  stop() { this.active = false; try { this.rec?.stop(); } catch { /* rien */ } this.onState?.("off"); }
}
