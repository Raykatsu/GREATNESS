// Succès à débloquer.
import { state, save, streak, weekStats } from "./store.js";

const S = () => state.sessions;
const vol = () => S().reduce((a, s) => a + (s.volume || 0), 0);
const prs = () => S().reduce((a, s) => a + (s.prs?.length || 0), 0);
const hour = h => S().some(s => { const x = new Date(s.date).getHours(); return h(x); });
const cats = () => new Set(S().map(s => s.programId));

export const BADGES = [
  { id: "first", icon: "🏁", name: "Première mission", desc: "Terminer ta première séance", test: () => S().length >= 1 },
  { id: "s10", icon: "🎯", name: "Pilier de la salle", desc: "10 séances", test: () => S().length >= 10 },
  { id: "s50", icon: "🏙️", name: "Gardien de New York", desc: "50 séances", test: () => S().length >= 50 },
  { id: "s100", icon: "👑", name: "Légende", desc: "100 séances", test: () => S().length >= 100 },
  { id: "streak3", icon: "🔥", name: "Lancé", desc: "3 jours d'affilée", test: () => streak() >= 3 },
  { id: "streak7", icon: "☄️", name: "Inarrêtable", desc: "7 jours d'affilée", test: () => streak() >= 7 },
  { id: "week4", icon: "📅", name: "Semaine de héros", desc: "4 séances dans la même semaine", test: () => weekStats().count >= 4 },
  { id: "pr1", icon: "🏆", name: "Premier record", desc: "Battre un record personnel", test: () => prs() >= 1 },
  { id: "pr10", icon: "💎", name: "Collectionneur", desc: "10 records battus", test: () => prs() >= 10 },
  { id: "vol10", icon: "💪", name: "10 tonnes", desc: "10 000 kg soulevés au total", test: () => vol() >= 10000 },
  { id: "vol100", icon: "🦾", name: "100 tonnes", desc: "100 000 kg soulevés au total", test: () => vol() >= 100000 },
  { id: "early", icon: "🌅", name: "Lève-tôt", desc: "Une séance avant 8 h", test: () => hour(h => h < 8) },
  { id: "night", icon: "🌙", name: "Oiseau de nuit", desc: "Une séance après 21 h", test: () => hour(h => h >= 21) },
  { id: "explorer", icon: "🧭", name: "Explorateur", desc: "5 programmes différents essayés", test: () => cats().size >= 5 },
  { id: "creator", icon: "🛠️", name: "Inventeur", desc: "Créer ta propre séance", test: () => state.customPrograms.length >= 1 },
  { id: "body", icon: "📏", name: "Mesuré", desc: "Enregistrer ton poids ou tes mensurations", test: () => (state.body || []).length >= 1 },
  { id: "friend", icon: "🤝", name: "Équipe", desc: "Avoir un ami dans l'app", test: () => (state.friendsCount || 0) >= 1 },
  { id: "chat", icon: "🧠", name: "Curieux", desc: "Poser 10 questions au coach", test: () => state.chat.filter(m => m.role === "user").length >= 10 },
  { id: "goal", icon: "🥇", name: "Objectif atteint", desc: "Réussir le test final d'un objectif chiffré", test: () => (state.goals || []).some(g => g.result?.success) },
  { id: "interval", icon: "⏱️", name: "Chrono", desc: "Terminer une séance au minuteur d'intervalles", test: () => S().some(s => s.kind === "interval") },
];

// Vérifie et enregistre les nouveaux succès. Renvoie ceux qui viennent d'être débloqués.
export function checkBadges() {
  state.badges ||= {};
  const fresh = BADGES.filter(b => !state.badges[b.id] && safe(b.test));
  if (fresh.length) {
    fresh.forEach(b => (state.badges[b.id] = Date.now()));
    save();
  }
  return fresh;
}
const safe = fn => { try { return fn(); } catch { return false; } };
