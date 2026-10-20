// Couche IA (Claude) — optionnelle. Sans clé API, l'app fonctionne avec le moteur local.
// La clé est stockée uniquement sur cet appareil (localStorage) et envoyée directement à l'API Anthropic.
import { state } from "./store.js";
import { coachName, coachPersona } from "./chars/index.js";
import { LOC, aiLangNote } from "./i18n.js";

const MODEL = "claude-opus-5-5";
const SDK_URL = "https://esm.sh/@anthropic-ai/sdk@0.131.0";
// Fallback serveur si une requête est refusée par les classifieurs de sécurité.
const BETAS = ["server-side-fallback-2026-07-01"];

// La personnalité suit le coach choisi par l'utilisateur (Alex par défaut).
const SYSTEM_FR = () => `Tu es le coach de GREATNESS, une app de musculation. Tu incarnes ${coachName()} en version coach sportif : ${coachPersona() || "drôle et bienveillant"}.
Tu parles français, tu tutoies, tu es direct et motivant, avec de temps en temps une petite référence à ton personnage sans en abuser.
Tu pilotes l'entraînement : tu donnes des consignes techniques précises, tu ajustes charges, répétitions et temps de repos selon les performances réelles (reps réalisées, RPE de 1 à 10) et la fatigue.
Règles de sécurité : jamais d'échec musculaire sur les gros mouvements, toute douleur = arrêt de l'exercice et alternative, pas de diagnostic médical (oriente vers un professionnel si besoin). Progression prudente : +2,5 à +5 kg max par série.
Sois bref : en séance, 1 à 2 phrases maximum.`;


let clientPromise = null;

export const aiReady = () => !!(state.profile.aiEnabled && state.profile.aiKey);

async function client() {
  if (!clientPromise) {
    clientPromise = import(SDK_URL).then(mod => {
      const Anthropic = mod.default;
      return new Anthropic({ apiKey: state.profile.aiKey, dangerouslyAllowBrowser: true });
    }).catch(err => { clientPromise = null; throw err; });
  }
  return clientPromise;
}

export function resetClient() { clientPromise = null; }

function textOf(msg) {
  if (msg.stop_reason === "refusal") return null;
  return msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
}

function historyDigest(limit = 6) {
  return state.sessions.slice(-limit).map(s => ({
    date: new Date(s.date).toLocaleDateString(LOC()), programme: s.name, minutes: Math.round(s.durationSec / 60),
    volume_kg: s.volume, fatigue_fin: s.fatigue, records: s.prs?.length || 0,
  }));
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

// Test de connexion depuis le profil.
// app en anglais : même consigne, réponse en anglais
const SYSTEM_BASE = () => SYSTEM_FR() + aiLangNote();

export async function testKey() {
  const c = await client();
  const msg = await c.beta.messages.create({
    model: MODEL, max_tokens: 200, betas: BETAS, fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM_BASE(),
    messages: [{ role: "user", content: "Présente-toi en une phrase." }],
  });
  return textOf(msg) || "Connexion OK.";
}

// Ajustement en temps réel après une série : réponse JSON structurée.
const ADJUST_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string", description: "Consigne courte (max 2 phrases) pour la prochaine série." },
    next_weight_kg: { type: "number", description: "Charge conseillée pour la prochaine série (0 si poids du corps)." },
    next_reps: { type: "integer", description: "Nombre de répétitions visé pour la prochaine série." },
    rest_seconds: { type: "integer", description: "Repos conseillé avant la prochaine série, en secondes." },
  },
  required: ["message", "next_weight_kg", "next_reps", "rest_seconds"],
  additionalProperties: false,
};

export async function aiAdjust(session, lastSet, local) {
  const c = await client();
  const payload = {
    seance: session.snapshot(),
    derniere_serie: lastSet,
    decision_moteur_local: local,
  };
  const msg = await withTimeout(c.beta.messages.create({
    model: MODEL, max_tokens: 2000, betas: BETAS, fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: ADJUST_SCHEMA } },
    system: SYSTEM_BASE(),
    messages: [{ role: "user", content:
      "Série terminée. Voici l'état de la séance en JSON. Valide ou corrige la décision du moteur local pour la PROCHAINE série " +
      "de l'exercice en cours (ou du suivant s'il vient de changer) et donne une consigne.\n\n" + JSON.stringify(payload) }],
  }), 20000);
  const txt = textOf(msg);
  if (!txt) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

// Briefing d'avant-séance.
export async function aiBrief(session) {
  const c = await client();
  const msg = await withTimeout(c.beta.messages.create({
    model: MODEL, max_tokens: 1500, betas: BETAS, fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM_BASE(),
    messages: [{ role: "user", content:
      `Briefing d'avant-séance en 3 phrases max : état de forme, objectif du jour, une consigne clé.\n` +
      `Check-in (1-5) : ${JSON.stringify(session.readiness)}\nPlan : ${JSON.stringify(session.snapshot())}\nHistorique récent : ${JSON.stringify(historyDigest())}` }],
  }), 25000);
  return textOf(msg);
}

// Débrief de fin de séance.
export async function aiDebrief(summary) {
  const c = await client();
  const msg = await withTimeout(c.beta.messages.create({
    model: MODEL, max_tokens: 2500, betas: BETAS, fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM_BASE(),
    messages: [{ role: "user", content:
      `Débrief de séance en 4 phrases max : ce qui était bien, ce qu'il faut corriger, et quoi faire à la prochaine séance.\n` +
      `Séance : ${JSON.stringify(summary)}\nHistorique : ${JSON.stringify(historyDigest())}` }],
  }), 40000);
  return textOf(msg);
}

// Chat libre avec streaming.
export async function aiChat(messages, onDelta) {
  const c = await client();
  const context = `Contexte athlète — poids de corps : ${state.profile.bodyweight} kg, objectif : ${state.profile.goal}. ` +
    `Records : ${JSON.stringify(state.lifts)}. Séances récentes : ${JSON.stringify(historyDigest(10))}.`;
  const stream = c.beta.messages.stream({
    model: MODEL, max_tokens: 16000, betas: BETAS, fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM_BASE() + "\nHors séance, tu peux développer un peu plus (programmation, nutrition générale, récupération), en restant concis.\n" + context,
    messages,
  });
  stream.on("text", delta => onDelta(delta));
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new Error("Je ne peux pas répondre à ça.");
  return textOf(final);
}
