// Mode histoire : dix chapitres où ton coach défend la ville contre la Flemme. Chaque chapitre a un objectif tiré
// de tes vraies séances (à faire depuis le début du chapitre) ; le réussir débloque un costume pour le coach et
// ouvre le chapitre suivant. Les séances importées d'une autre app ne comptent pas. Logique pure, testée.
import { PROGRAMS } from "./data.js";
import { COSTUMES } from "./costumes.js";
import { LOC } from "./i18n.js";

const MOBILITY = new Set(PROGRAMS.filter(p => ["mobility", "stretch", "care"].includes(p.cat)).map(p => p.id));
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const own = (st, from) => (st.sessions || []).filter(s => !s.imported && s.date >= from);
const nf = n => Math.round(n).toLocaleString(LOC());

// Objectifs : valeur atteinte depuis le début du chapitre, et façon de l'écrire
export const GOALS = {
  sessions: { val: (st, f) => own(st, f).length, fmt: n => `${nf(n)} séance${n > 1 ? "s" : ""}` },
  volume: { val: (st, f) => own(st, f).reduce((a, s) => a + (s.volume || 0), 0), fmt: n => `${nf(n)} kg soulevés` },
  prs: { val: (st, f) => own(st, f).reduce((a, s) => a + (s.prs?.length || 0), 0), fmt: n => `${nf(n)} record${n > 1 ? "s" : ""} battu${n > 1 ? "s" : ""}` },
  minutes: { val: (st, f) => Math.floor(own(st, f).reduce((a, s) => a + (s.durationSec || 0), 0) / 60), fmt: n => `${nf(n)} min d'entraînement` },
  interval: { val: (st, f) => own(st, f).filter(s => s.kind === "interval").length, fmt: n => `${nf(n)} séance${n > 1 ? "s" : ""} au minuteur d'intervalles` },
  mobility: { val: (st, f) => own(st, f).filter(s => MOBILITY.has(s.programId)).length, fmt: n => `${nf(n)} séance${n > 1 ? "s" : ""} de mobilité` },
  food: { val: (st, f) => Object.entries(st.food || {}).filter(([k, d]) => k >= dayKey(f) && d?.items?.length).length, fmt: n => `${nf(n)} jour${n > 1 ? "s" : ""} de repas notés` },
  video: { val: (st, f) => (st.formChecks || []).filter(c => c.at >= f).length, fmt: n => `${nf(n)} analyse${n > 1 ? "s" : ""} vidéo de ta technique` },
};

// {coach} : le nom de ton coach
export const CHAPTERS = [
  { id: "reveil", title: "Le réveil", goal: { kind: "sessions", n: 2 }, reward: "bandeau",
    text: "Un brouillard gris recouvre la ville : la Flemme s'est installée sur tous les canapés. {coach} t'a choisi pour la repousser. Première mission : réveiller tes muscles." },
  { id: "salle", title: "La salle abandonnée", goal: { kind: "volume", n: 5000 }, reward: "neon",
    text: "Au bout de la rue, une vieille salle prend la poussière. {coach} en a trouvé la clé. Pour rallumer les néons, il faut faire bouger de la fonte, beaucoup de fonte." },
  { id: "dojo", title: "Le gardien du dojo", goal: { kind: "prs", n: 1 }, reward: "lunettes",
    text: "Le gardien du dojo ne laisse passer que ceux qui se dépassent. {coach} te le promet : il suffit d'aller une fois plus loin que toi-même." },
  { id: "tempete", title: "La tempête", goal: { kind: "interval", n: 1 }, reward: "glace",
    text: "Une tempête de fatigue souffle sur les toits. Pour la traverser, {coach} propose la méthode des héros : des efforts courts, intenses, minutés." },
  { id: "marche", title: "Le marché", goal: { kind: "food", n: 3 }, reward: "casquette",
    text: "Les sbires de la Flemme distribuent des beignets gratuits au marché. {coach} a un plan : savoir exactement ce que tu manges, trois jours durant." },
  { id: "pont", title: "Le pont suspendu", goal: { kind: "minutes", n: 120 }, reward: "feu",
    text: "Le pont qui relie les deux quartiers tremble. Il ne tiendra que si quelqu'un tient plus longtemps que lui : deux heures d'entraînement, pas une minute de moins." },
  { id: "maitre", title: "Le maître de la technique", goal: { kind: "video", n: 1 }, reward: "cape",
    text: "Un vieux maître observe tout, caché sur le toit. Il a une seule exigence : voir ta technique. {coach} sort la caméra." },
  { id: "chat", title: "La souplesse du chat", goal: { kind: "mobility", n: 2 }, reward: "symbiote",
    text: "La Flemme a raidi le dos de la moitié de la ville. Pour lui échapper, {coach} veut que tu sois souple comme un chat : deux séances de mobilité." },
  { id: "tournoi", title: "Le tournoi", goal: { kind: "prs", n: 3 }, reward: "medaille",
    text: "Le grand tournoi commence. Les meilleurs athlètes de la ville sont là, et la Flemme a parié contre toi. Trois records, et la médaille est à toi." },
  { id: "sommet", title: "Le sommet", goal: { kind: "sessions", n: 6 }, reward: ["couronne", "or"],
    text: "Le repaire de la Flemme est tout en haut de la tour. {coach} t'attend au pied de l'escalier : six séances pour gravir les étages et chasser la Flemme pour de bon." },
];

const rewards = c => [].concat(c.reward);

// État : { chapter: index du chapitre en cours, started: début du chapitre (ms), done: { id: date } }
export function storyStart(now = Date.now()) { return { chapter: 0, started: now, done: {} }; }

// Où en est l'histoire : chapitre en cours (ou fini), progression, costumes gagnés
export function storyStatus(st, now = Date.now()) {
  const s = st.story || storyStart(now), i = Math.min(s.chapter || 0, CHAPTERS.length);
  const ch = CHAPTERS[i] || null;
  const unlocked = CHAPTERS.filter(c => s.done?.[c.id]).flatMap(rewards);
  if (!ch) return { finished: true, index: CHAPTERS.length, total: CHAPTERS.length, unlocked };
  const val = Math.max(0, GOALS[ch.goal.kind].val(st, s.started || now));
  return { finished: false, index: i, total: CHAPTERS.length, chapter: ch, value: Math.min(val, ch.goal.n), goal: ch.goal.n, pct: Math.min(1, val / ch.goal.n),
    label: GOALS[ch.goal.kind].fmt(ch.goal.n), progress: `${nf(Math.min(val, ch.goal.n))} / ${nf(ch.goal.n)}`, rewards: rewards(ch), unlocked };
}

// Chapitres réussis depuis la dernière vérification : on les valide et on ouvre les suivants (le chapitre suivant
// commence à cet instant, pour que chaque objectif demande de nouvelles séances). Renvoie les chapitres gagnés.
export function advanceStory(st, now = Date.now()) {
  st.story ||= storyStart(now);
  const won = [];
  for (let guard = 0; guard < CHAPTERS.length; guard++) {
    const s = storyStatus(st, now);
    if (s.finished || s.pct < 1) break;
    st.story.done = { ...st.story.done, [s.chapter.id]: now };
    st.story.chapter = s.index + 1;
    st.story.started = now;
    won.push({ chapter: s.chapter, rewards: s.rewards });
  }
  return won;
}

// Texte d'un chapitre avec le nom du coach
export const chapterText = (ch, coach = "Ton coach") => ch.text.replace(/\{coach\}/g, coach);
// Costume porté : seulement s'il a été gagné
export function wornCostume(st) {
  const id = st.profile?.costume;
  return id && COSTUMES[id] && storyStatus(st).unlocked.includes(id) ? id : null;
}
