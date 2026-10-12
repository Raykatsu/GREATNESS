// IA locale : un vrai modèle de langage (Qwen) qui tourne dans le navigateur grâce à WebGPU.
// Gratuit, privé (rien ne quitte le téléphone), téléchargé une seule fois puis gardé en cache.
const WEBLLM = "https://esm.run/@mlc-ai/web-llm@0.2.85";
const PREF = "greatness.llm";

let engine = null, loading = null, status = "off", progress = 0, progressText = "", lastError = "", listeners = [];

// Téléphone : la mémoire est limitée, le navigateur ferme l'app si le modèle est trop gros.
export const isPhone = () => typeof navigator !== "undefined" && (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const MODELS = [
  { id: "Qwen3.5-0.8B", name: "Léger", size: "≈ 0,6 Go", note: "Conseillé sur téléphone" },
  { id: "Qwen3.5-2B", name: "Équilibré", size: "≈ 1,4 Go", note: "Téléphone très récent (8 Go de RAM) ou ordinateur" },
  { id: "Qwen3.5-4B", name: "Puissant", size: "≈ 2,6 Go", note: "Ordinateur seulement", desktopOnly: true },
];
export const modelAllowed = m => !(m.desktopOnly && isPhone());
const defaultModel = () => (isPhone() ? "Qwen3.5-0.8B" : "Qwen3.5-2B");

const emit = () => listeners.forEach(fn => fn(info()));
export const onChange = fn => { listeners.push(fn); return () => (listeners = listeners.filter(f => f !== fn)); };
export const info = () => ({ status, progress, progressText, error: lastError, model: prefs().model, ready: status === "ready" });

export function prefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(PREF) || "{}"); } catch { /* préférences abîmées */ }
  p = { model: defaultModel(), enabled: false, ...p };
  if (!MODELS.some(m => m.id === p.model && modelAllowed(m))) p.model = defaultModel();
  return p;
}
function setPrefs(p) { try { localStorage.setItem(PREF, JSON.stringify({ ...prefs(), ...p })); } catch { /* stockage plein */ } }

// Si l'app a été fermée en plein chargement (souvent : mémoire du téléphone pleine), on ne
// relance pas tout seul (sinon elle replanterait à chaque ouverture) et on passe au modèle plus petit.
(function crashCheck() {
  if (typeof localStorage === "undefined") return;
  const p = prefs();
  // ancienne version : le modèle Équilibré était choisi par défaut, trop lourd pour beaucoup de téléphones
  if (!p.v && isPhone() && p.model !== "Qwen3.5-0.8B" && p.enabled) {
    setPrefs({ v: 2, model: "Qwen3.5-0.8B", enabled: false, pending: null });
    status = "error";
    lastError = "Le modèle Équilibré est trop lourd pour la plupart des téléphones. J'ai choisi le modèle Léger : touche « Activer l'IA ».";
    return;
  }
  if (!p.v) setPrefs({ v: 2 });
  if (!p.pending) return;
  const i = MODELS.findIndex(m => m.id === p.model);
  const smaller = i > 0 ? MODELS[i - 1] : null;
  setPrefs({ pending: null, enabled: false, ...(smaller ? { model: smaller.id } : {}) });
  status = "error";
  lastError = smaller
    ? `Le chargement s'est arrêté avant la fin : le téléphone a sans doute manqué de mémoire. J'ai choisi le modèle ${smaller.name}, plus petit : réessaie.`
    : "Le chargement s'est arrêté avant la fin (app fermée, écran verrouillé ou mémoire pleine). Ferme les autres apps, garde l'écran allumé et réessaie : le téléchargement reprend où il s'était arrêté.";
})();

export const supported = () => typeof navigator !== "undefined" && !!navigator.gpu;

// Variante f16 si le GPU la gère (plus légère), sinon f32.
async function modelId(base) {
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("no adapter");
    return `${base}-${adapter.features.has("shader-f16") ? "q4f16_1" : "q4f32_1"}-MLC`;
  } catch {
    return `${base}-q4f32_1-MLC`;
  }
}

let wake = null;
const keepAwake = async on => {
  try { if (on) wake = await navigator.wakeLock?.request("screen"); else { await wake?.release(); wake = null; } } catch { /* pas grave */ }
};

function explain(e) {
  const t = String(e?.message || e);
  if (/quota|storage|space/i.test(t)) return "Pas assez de place sur le téléphone pour l'IA. Libère de l'espace ou choisis le modèle Léger.";
  if (/memory|OOM|out of|allocation|buffer size|device.*lost|lost.*device/i.test(t)) return "Pas assez de mémoire sur ce téléphone pour ce modèle : choisis le modèle Léger et ferme les autres apps.";
  if (/fetch|network|Failed to fetch|load failed|timeout/i.test(t)) return "Le téléchargement a été coupé (connexion). Réessaie en Wi-Fi : il reprend où il s'était arrêté.";
  return `L'IA n'a pas pu démarrer sur ce navigateur (${t.slice(0, 90)}).`;
}

export async function enable(base = prefs().model) {
  setPrefs({ model: base, enabled: true });
  if (isPhone()) await wipeFiles(m => m.id !== base); // garde la place pour le modèle choisi
  return load();
}

export function load() {
  if (!supported()) { status = "unsupported"; emit(); return Promise.resolve(false); }
  if (engine) return Promise.resolve(true);
  if (loading) return loading;
  status = "loading"; progress = 0; progressText = "Préparation…"; lastError = ""; emit();
  loading = (async () => {
    try {
      navigator.storage?.persist?.().catch(() => {});
      const webllm = await import(WEBLLM);
      const id = await modelId(prefs().model);
      setPrefs({ pending: Date.now() });
      keepAwake(true);
      const worker = new Worker(new URL("./llm-worker.js", import.meta.url), { type: "module" });
      engine = await webllm.CreateWebWorkerMLCEngine(worker, id, {
        initProgressCallback: r => {
          progress = r.progress || 0;
          progressText = /fetch|download|Loading model from cache/i.test(r.text) ? (/cache/i.test(r.text) ? "Chargement depuis le téléphone…" : "Téléchargement…") : "Préparation…";
          emit();
        },
      }, { context_window_size: isPhone() ? 2048 : 4096 }); // contexte réduit sur téléphone : moins de mémoire
      setPrefs({ pending: null });
      status = "ready"; progress = 1; emit();
      return true;
    } catch (e) {
      console.warn("llm", e);
      try { await engine?.unload(); } catch { /* rien */ }
      engine = null;
      setPrefs({ pending: null, enabled: false });
      status = "error";
      lastError = explain(e);
      emit();
      return false;
    } finally {
      keepAwake(false);
      loading = null;
    }
  })();
  return loading;
}

// Démarre l'IA en arrière-plan si elle a déjà été activée sur cet appareil.
export function autoload() {
  if (prefs().enabled && supported()) setTimeout(() => load(), 1500);
}

export async function disable({ removeFiles = false } = {}) {
  setPrefs({ enabled: false });
  try { await engine?.unload(); } catch { /* déjà déchargé */ }
  engine = null; status = "off"; progress = 0; emit();
  if (removeFiles) await wipeFiles();
}

async function wipeFiles(which = () => true) {
  try {
    const webllm = await import(WEBLLM);
    for (const m of MODELS.filter(which)) for (const q of ["q4f16_1", "q4f32_1"]) await webllm.deleteModelAllInfoInCache(`${m.id}-${q}-MLC`).catch(() => {});
  } catch { /* hors ligne */ }
}

// Le modèle n'a pas d'avis sur le raisonnement à afficher : on retire les balises de réflexion.
const clean = s => s.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/^\s+/, "");

let busy = Promise.resolve();
export function chat(messages, { onDelta, maxTokens = isPhone() ? 450 : 700, temperature = 0.6 } = {}) {
  // une seule génération à la fois
  const run = busy.then(async () => {
    if (!engine) throw new Error("IA locale non chargée");
    const stream = await engine.chat.completions.create({
      messages, stream: true, temperature, top_p: 0.9, max_tokens: maxTokens,
      extra_body: { enable_thinking: false },
    });
    let raw = "";
    for await (const chunk of stream) {
      raw += chunk.choices?.[0]?.delta?.content || "";
      onDelta?.(clean(raw));
    }
    return clean(raw).trim();
  });
  busy = run.catch(() => {});
  return run;
}

export const interrupt = () => engine?.interruptGenerate?.();
